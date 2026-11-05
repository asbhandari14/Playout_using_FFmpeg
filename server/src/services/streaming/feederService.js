import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Playlist, isPlaylistCurrentlyActive, resolveChannelActivePlaylist, PLAYLIST_TYPE } from '../../models/playlist.model.js';
import { Channel } from '../../models/channel.model.js';
import { Schedule } from '../../models/schedule.model.js';
import { Asset } from '../../models/asset.model.js';
import { io } from '../../server.js';
import { SERVER_ROOT } from '../../config/paths.js';
import { PLAYLIST_ITEM_STATUS } from '../../config/constants.js';
import { buildBackInTimerFilter } from './brandingAssets.js';
import { killProcessTree } from '../../utils/processHelper.js';

export class FeederService {
  constructor(channelId, encoderProcess, options = {}, encoder = null) {
    this.channelId = channelId;
    this.encoderProcess = encoderProcess;
    this.encoder = encoder;
    this.isRunning = false;
    this.currentDecoder = null;
    this.currentIndex = options.startIndex || 0;
    this.startOffsetSeconds = options.startOffsetSeconds || 0;
    this.currentAssetStartTime = null;
    this.currentAssetDuration = null;
    this.currentOffsetAtStart = 0;
    this.currentVideoPath = null;
    this.currentAsset = null;
    this.isScheduleActive = false;
    this.wasInterruptedBySchedule = false;
    this.interruptedState = null;
    this.scheduleBrandingSnapshot = null;
    this.currentPlayingPlaylist = null;
    this.wasPreemptedByPriority = false;
    this.priorityCheckTimer = null;
  }

  getEncoder() {
    return this.encoder || null;
  }

  /**
   * Restore all branding overlays (ticker, bug, ashton, lband, logo) that were active before schedule started
   */
  async restorePreScheduleBranding() {
    try {
      const channelDoc = await Channel.findById(this.channelId);
      const snap = this.scheduleBrandingSnapshot || channelDoc?.branding?.preScheduleBranding;
      if (!snap) return;

      this.scheduleBrandingSnapshot = null;
      console.log(`[Feeder:${this.channelId}] Restoring pre-schedule branding on air:`, snap);

      const encoder = this.getEncoder();
      if (encoder && encoder.isRunning) {
        if (snap.logo?.suppressed && snap.logo?.enabled) {
          await encoder.setLogoEnabled(true).catch(() => { });
        }
        if (snap.bug?.enabled) {
          await encoder.setBugEnabled(true).catch(() => { });
        }
        if (snap.ticker?.enabled) {
          await encoder.setTickerEnabled(true).catch(() => { });
        }
        if (snap.ashton?.enabled) {
          await encoder.setAshtonLive(true, snap.ashton.squeeze !== false).catch(() => { });
        }
        if (snap.lband?.enabled) {
          await encoder.setLBandEnabled(true).catch(() => { });
        }
      }

      const restoreDbFields = {
        'branding.preScheduleBranding': null,
        'branding.ticker.enabled': !!snap.ticker?.enabled,
        'branding.bug.enabled': !!snap.bug?.enabled,
        'branding.ashton.enabled': !!snap.ashton?.enabled,
        'branding.ashton.squeeze': snap.ashton?.squeeze !== false,
        'branding.lband.enabled': !!snap.lband?.enabled
      };
      if (snap.logo?.suppressed) {
        restoreDbFields['branding.logo.enabled'] = !!snap.logo.enabled;
      }

      await Channel.findByIdAndUpdate(this.channelId, {
        $set: restoreDbFields
      });

      if (io) {
        io.to(`channel:${this.channelId}`).emit('branding_updated', {
          type: 'all',
          branding: {
            ticker: { enabled: !!snap.ticker?.enabled },
            bug: { enabled: !!snap.bug?.enabled },
            ashton: { enabled: !!snap.ashton?.enabled, squeeze: snap.ashton?.squeeze !== false },
            lband: { enabled: !!snap.lband?.enabled },
            ...(snap.logo?.suppressed ? { logo: { enabled: !!snap.logo.enabled } } : {})
          }
        });
      }
    } catch (err) {
      console.error(`[Feeder:${this.channelId}] Error restoring pre-schedule branding:`, err);
    }
  }

  getCurrentPlaybackPosition() {
    if (!this.currentAssetStartTime) {
      return { index: this.currentIndex, offsetSeconds: 0 };
    }
    const elapsed = (Date.now() - this.currentAssetStartTime) / 1000;
    const currentOffset = (this.currentOffsetAtStart || 0) + elapsed;
    return {
      index: this.currentIndex,
      offsetSeconds: Math.max(0, currentOffset)
    };
  }

  /**
   * Resolves the highest-priority active playlist matching current time/date/day.
   * Priority: emergency (5) > advertisement (4) > live_schedule (3) > scheduling (2) > default (1)
   */
  async resolveActivePlaylist() {
    try {
      const active = await resolveChannelActivePlaylist(this.channelId, new Date());
      if (active) return active;

      return await Playlist.findOne({ channel: this.channelId }).populate({
        path: 'items.asset',
        select: 'originalName filePath duration durationFormatted status'
      });
    } catch (err) {
      console.warn(`[Feeder:${this.channelId}] Error resolving active playlist:`, err.message);
      return await Playlist.findOne({ channel: this.channelId }).populate({
        path: 'items.asset',
        select: 'originalName filePath duration durationFormatted status'
      });
    }
  }

  /**
   * Checks whether the active priority playlist has changed for this channel.
   * If a higher-priority playlist is armed/scheduled, or current playlist's window expired,
   * terminates current video decoder immediately so playLoop can transition seamlessly.
   */
  async checkPriorityTransition() {
    if (!this.isRunning || this.isScheduleActive) {
      return false;
    }

    try {
      const targetPlaylist = await this.resolveActivePlaylist();
      if (!targetPlaylist) return false;

      const currentId = this.currentPlayingPlaylist?._id ? String(this.currentPlayingPlaylist._id) : null;
      const targetId = String(targetPlaylist._id);

      if (currentId && currentId !== targetId) {
        console.log(
          `[Feeder:${this.channelId}] >>> REAL-TIME PRIORITY TRANSITION <<<` +
          `\nFrom: "${this.currentPlayingPlaylist?.name}" (${this.currentPlayingPlaylist?.type}, P${this.currentPlayingPlaylist?.priority})` +
          `\nTo:   "${targetPlaylist.name}" (${targetPlaylist.type}, P${targetPlaylist.priority})` +
          `\nPreempting currently playing video decoder to switch immediately.`
        );

        this.wasPreemptedByPriority = true;
        this.currentPlayingPlaylist = targetPlaylist;

        if (this.currentDecoder) {
          try {
            this.currentDecoder.stdout.unpipe();
          } catch { }
          try {
            killProcessTree(this.currentDecoder);
          } catch { }
          this.currentDecoder = null;
        }

        return true;
      }
    } catch (err) {
      console.warn(`[Feeder:${this.channelId}] Warning checking priority transition:`, err.message);
    }

    return false;
  }

  async start() {
    this.isRunning = true;
    this.playLoop();
  }

  async playLoop() {
    // -------------------------------------------------------------------------
    // STARTUP / RECOVERY GATE:
    // When coming online from offline, FIRST check if a schedule exists right now!
    // If a schedule exists covering the current time slot, play the schedule
    // DIRECTLY (with timeline sync / remaining time) BEFORE touching normal playlist!
    // If NO schedule exists, proceed straight to the normal playlist feed.
    // -------------------------------------------------------------------------
    try {
      const { schedulerService } = await import('./schedulerService.js');
      const activeSchedule = await schedulerService.getActiveScheduleForChannel(this.channelId);

      if (activeSchedule && activeSchedule.type === 'video' && !this.isScheduleActive && this.isRunning) {
        console.log(
          `[Feeder:${this.channelId}] [Startup Gate] Active schedule "${activeSchedule.title}" found for current time slot. ` +
          `Streaming scheduled video DIRECTLY as per slot and remaining time. (Normal playlist deferred until schedule ends).`
        );
        await this.interruptWithSchedule(activeSchedule);
      } else if (activeSchedule && (activeSchedule.type === 'lband' || activeSchedule.type === 'ashton')) {
        const { streamManager } = await import('./streamManager.js');
        const dur = Number(activeSchedule.duration) || 60;
        const channelIdStr = String(this.channelId);
        if (activeSchedule.type === 'lband') {
          streamManager.fireLBand(channelIdStr, dur).catch(() => { });
        } else {
          streamManager.fireAshton(channelIdStr, dur, activeSchedule.ashtonSqueeze !== false).catch(() => { });
        }
      }
    } catch (startupSchedErr) {
      console.warn(`[Feeder:${this.channelId}] Warning checking initial schedule on startup:`, startupSchedErr.message);
    }

    let currentPlaylistId = null;

    while (this.isRunning) {
      try {
        const playlist = await this.resolveActivePlaylist();

        if (!playlist) {
          console.log(`[Feeder:${this.channelId}] No playlist configured. Feeding live standby slate...`);
          await this.streamStandbySlate(3);
          continue;
        }

        // If active playlist changed to a different one, reset index to 0
        if (currentPlaylistId && String(currentPlaylistId) !== String(playlist._id)) {
          console.log(
            `[Feeder:${this.channelId}] Active playlist changed to "${playlist.name}" (${playlist.type}, priority ${playlist.priority}). Starting from beginning.`
          );
          this.currentIndex = 0;
        }
        currentPlaylistId = String(playlist._id);
        this.currentPlayingPlaylist = playlist;

        // Special handling for live_schedule with a direct liveSourceUrl
        if (playlist.type === PLAYLIST_TYPE.LIVE_SCHEDULE && playlist.liveSourceUrl && (!playlist.items || playlist.items.length === 0)) {
          console.log(`[Feeder:${this.channelId}] Relaying live schedule stream: ${playlist.liveSourceUrl}`);
          await this.streamAsset(playlist.liveSourceUrl, 0);
          continue;
        }

        if (!playlist.items || playlist.items.length === 0) {
          console.log(`[Feeder:${this.channelId}] Playlist "${playlist.name}" is empty. Feeding live standby slate to maintain broadcast...`);
          await this.streamStandbySlate(3);
          continue;
        }

        // Loop through playlist items
        for (let i = this.currentIndex; i < playlist.items.length; i++) {
          if (!this.isRunning) break;

          // Before playing next item, check if a higher-priority playlist has become active!
          const activeCheck = await this.resolveActivePlaylist();
          if (activeCheck && String(activeCheck._id) !== String(playlist._id)) {
            console.log(
              `[Feeder:${this.channelId}] Preempting for higher/different active playlist: "${activeCheck.name}" (${activeCheck.type}, priority ${activeCheck.priority}).`
            );
            this.currentIndex = 0;
            currentPlaylistId = String(activeCheck._id);
            this.currentPlayingPlaylist = activeCheck;
            break;
          }

          this.currentIndex = i;
          const item = playlist.items[i];
          const asset = item.asset;

          if (!asset || !asset.filePath) {
            console.warn(`[Feeder:${this.channelId}] Item at index ${i} has no valid media file. Skipping.`);
            continue;
          }

          const absolutePath = path.resolve(SERVER_ROOT, asset.filePath);
          if (!fs.existsSync(absolutePath)) {
            console.warn(`[Feeder:${this.channelId}] Asset file missing on disk: ${absolutePath}`);
            continue;
          }

          // Mark item PLAYING
          await Playlist.updateOne(
            { _id: playlist._id, 'items._id': item._id },
            { $set: { 'items.$.status': PLAYLIST_ITEM_STATUS.PLAYING } }
          );

          await Channel.findByIdAndUpdate(this.channelId, {
            currentPlayingIndex: i,
            currentAssetId: asset._id
          });

          if (io) {
            io.to(`channel:${this.channelId}`).emit('stream_item_playing', {
              channelId: this.channelId,
              playlistId: playlist._id,
              playlistType: playlist.type,
              index: i,
              assetId: asset._id,
              assetName: asset.originalName,
              duration: asset.duration
            });
          }

          console.log(`[Feeder:${this.channelId}] Playing [${playlist.type.toUpperCase()}] item #${i + 1}: ${asset.originalName} (${asset.duration}s)`);

          // Play the asset through decoder
          this.currentAsset = asset;
          this.currentVideoPath = absolutePath;
          await this.streamAsset(absolutePath, asset.duration);

          // If playback was preempted by priority transition (e.g. emergency armed or schedule window ended):
          if (this.wasPreemptedByPriority) {
            console.log(
              `[Feeder:${this.channelId}] Playout preempted by priority transition. Advancing immediately to new active playlist.`
            );
            this.wasPreemptedByPriority = false;
            this.currentIndex = 0;
            break;
          }

          // If playback was paused by a scheduled video broadcast, wait until schedule finishes
          if (this.wasInterruptedBySchedule) {
            console.log(`[Feeder:${this.channelId}] Regular play loop waiting for scheduled video to complete...`);
            while (this.isScheduleActive && this.isRunning) {
              await new Promise((r) => setTimeout(r, 400));
            }
            this.wasInterruptedBySchedule = false;
            // Decrement i so next for-loop iteration re-enters the same item with this.startOffsetSeconds
            i = this.currentIndex - 1;
            continue;
          }

          // Mark item PLAYED
          await Playlist.updateOne(
            { _id: playlist._id, 'items._id': item._id },
            { $set: { 'items.$.status': PLAYLIST_ITEM_STATUS.PLAYED } }
          );

          if (io) {
            io.to(`channel:${this.channelId}`).emit('stream_item_played', {
              channelId: this.channelId,
              playlistId: playlist._id,
              playlistType: playlist.type,
              index: i,
              assetId: asset._id
            });
          }
        }

        // Check if loop enabled
        if (!playlist.loop) {
          console.log(`[Feeder:${this.channelId}] Playlist "${playlist.name}" finished (loop disabled).`);
          if (playlist.type !== PLAYLIST_TYPE.DEFAULT) {
            console.log(`[Feeder:${this.channelId}] Finished non-looping ${playlist.type} playlist. Returning to default loop.`);
            this.currentIndex = 0;
            continue;
          }
          this.isRunning = false;
          break;
        }

        // Reset to beginning of playlist for seamless loop
        this.currentIndex = 0;
        await Playlist.updateOne(
          { _id: playlist._id },
          { $set: { 'items.$[].status': PLAYLIST_ITEM_STATUS.QUEUED } }
        );
      } catch (err) {
        console.error(`[Feeder:${this.channelId}] Playback loop error:`, err);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  /**
   * Spawns decoder ffmpeg to normalize asset and stream MPEG-TS directly to encoder stdin.
   * If timerFilter is provided (during schedule ads), burns in the exact frame-accurate countdown overlay.
   */
  streamAsset(videoPath, _duration, maxDuration = 0, timerFilter = null, seekOffset = 0) {
    return new Promise((resolve) => {
      if (!this.isRunning || !this.encoderProcess?.stdin?.writable) {
        return resolve();
      }

      const startOffset = seekOffset > 0 ? seekOffset : Math.max(0, this.startOffsetSeconds || 0);
      this.startOffsetSeconds = 0; // reset after initial resume
      this.currentAssetStartTime = Date.now();
      this.currentAssetDuration = _duration;
      this.currentOffsetAtStart = startOffset;

      const baseVf = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=25';
      const vfArg = timerFilter ? `${baseVf},${timerFilter}` : baseVf;

      // Decoder process arguments
      // Normalizes to 1280x720, 25fps, AAC, outputs mpegts on stdout
      const decoderArgs = [
        '-re', // Real-time native pacing
        ...(startOffset > 0 ? ['-ss', String(startOffset)] : []),
        '-i', videoPath,
        ...(maxDuration > 0 ? ['-t', String(maxDuration)] : []),
        '-vf', vfArg,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'mpegts',
        'pipe:1'
      ];

      const decoder = spawn('ffmpeg', decoderArgs, {
        stdio: ['ignore', 'pipe', 'ignore']
      });

      this.currentDecoder = decoder;

      // Real-time priority ticker: checks every second while video is decoding
      if (this.priorityCheckTimer) {
        clearInterval(this.priorityCheckTimer);
        this.priorityCheckTimer = null;
      }
      this.priorityCheckTimer = setInterval(() => {
        if (!this.isRunning || !this.currentDecoder) {
          if (this.priorityCheckTimer) {
            clearInterval(this.priorityCheckTimer);
            this.priorityCheckTimer = null;
          }
          return;
        }
        this.checkPriorityTransition().catch(() => { });
      }, 1000);

      decoder.stdout.on('error', (err) => {
        if (err.code === 'EPIPE' || err.code === 'EOF' || err.code === 'ECONNRESET') return;
        console.warn(`[Decoder stdout error]`, err.message);
      });

      // Pipe decoder stdout into encoder stdin WITHOUT closing encoder stdin when decoder finishes!
      if (this.encoderProcess?.stdin?.writable) {
        decoder.stdout.pipe(this.encoderProcess.stdin, { end: false });
      }

      const cleanupDecoder = () => {
        if (this.priorityCheckTimer) {
          clearInterval(this.priorityCheckTimer);
          this.priorityCheckTimer = null;
        }
        try {
          decoder.stdout.unpipe();
        } catch { }
        this.currentDecoder = null;
        resolve();
      };

      decoder.on('close', cleanupDecoder);

      decoder.on('error', (err) => {
        console.error(`[Decoder error]`, err.message);
        cleanupDecoder();
      });
    });
  }

  /**
   * Generates a real-time 1280x720 video slate with silent audio
   * Keeps encoder active and connected to Flussonic RTMP even if playlist is empty or waiting
   */
  streamStandbySlate(duration = 3) {
    return new Promise((resolve) => {
      if (!this.isRunning || !this.encoderProcess?.stdin?.writable) {
        return resolve();
      }

      const slateArgs = [
        '-re',
        '-f', 'lavfi', '-i', `color=c=0x0c0e12:s=1280x720:r=25:d=${duration}`,
        '-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`,
        '-t', `${duration}`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'mpegts',
        'pipe:1'
      ];

      const decoder = spawn('ffmpeg', slateArgs, {
        stdio: ['ignore', 'pipe', 'ignore']
      });

      this.currentDecoder = decoder;

      decoder.stdout.on('error', (err) => {
        if (err.code === 'EPIPE' || err.code === 'EOF' || err.code === 'ECONNRESET') return;
        console.warn(`[Slate decoder stdout error]`, err.message);
      });

      if (this.encoderProcess?.stdin?.writable) {
        decoder.stdout.pipe(this.encoderProcess.stdin, { end: false });
      }

      decoder.on('close', () => {
        try {
          decoder.stdout.unpipe();
        } catch { }
        this.currentDecoder = null;
        resolve();
      });

      decoder.on('error', () => {
        try {
          decoder.stdout.unpipe();
        } catch { }
        this.currentDecoder = null;
        resolve();
      });
    });
  }

  /**
   * Seamlessly pauses current playing video, streams the scheduled video,
   * and then resumes the original video from the exact second it was paused.
   */
  async interruptWithSchedule(schedule) {
    if (this.isScheduleActive) {
      console.warn(`[Feeder:${this.channelId}] Schedule interrupt requested but another schedule is active.`);
      return false;
    }

    let scheduledAssets = [];
    if (Array.isArray(schedule.assets) && schedule.assets.length > 0) {
      scheduledAssets = schedule.assets.filter((a) => a && a.filePath);
    } else if (schedule.asset && schedule.asset.filePath) {
      scheduledAssets = [schedule.asset];
    }

    // Auto-resolve media assets from database if not pre-populated
    if (scheduledAssets.length === 0) {
      const rawIds = (Array.isArray(schedule.assets) && schedule.assets.length > 0)
        ? schedule.assets.map((a) => a?._id || a)
        : (schedule.asset ? [schedule.asset?._id || schedule.asset] : []);
      if (rawIds.length > 0) {
        const found = await Asset.find({ _id: { $in: rawIds } });
        scheduledAssets = found.filter((a) => a && a.filePath);
      }
    }

    if (scheduledAssets.length === 0) {
      console.warn(`[Feeder:${this.channelId}] Scheduled event '${schedule.title}' has no valid media assets.`);
      return false;
    }

    const hadRegularVideoPlaying = Boolean(this.currentVideoPath && this.currentDecoder);
    this.isScheduleActive = true;
    this.wasInterruptedBySchedule = hadRegularVideoPlaying;

    // 1. Capture exact paused position of currently playing video (or start at beginning if startup gate)
    const pos = this.getCurrentPlaybackPosition();
    this.interruptedState = {
      index: this.currentIndex,
      offsetSeconds: hadRegularVideoPlaying ? pos.offsetSeconds : (this.startOffsetSeconds || 0),
      videoPath: this.currentVideoPath,
      duration: this.currentAssetDuration,
      asset: this.currentAsset
    };

    console.log(
      `[Feeder:${this.channelId}] >>> ${hadRegularVideoPlaying ? 'PAUSING PLAYLIST ITEM #' + (this.interruptedState.index + 1) + ' AT ' + this.interruptedState.offsetSeconds.toFixed(1) + 's' : 'DIRECT STARTUP PLAYOUT'} FOR SCHEDULE: "${schedule.title}" (${scheduledAssets.length} video(s)) <<<`
    );

    // 2. Snapshot current branding state (ticker, bug, ashton, lband, logo) and suppress secondary overlays (and logo if showDuringSchedule is false)
    try {
      const channelDoc = await Channel.findById(this.channelId);
      const shouldShowLogo = channelDoc?.branding?.logo?.showDuringSchedule !== false;
      const logoWasEnabled = Boolean(channelDoc?.branding?.logo?.enabled);

      this.scheduleBrandingSnapshot = {
        ticker: { enabled: !!channelDoc?.branding?.ticker?.enabled },
        bug: { enabled: !!channelDoc?.branding?.bug?.enabled },
        ashton: {
          enabled: !!channelDoc?.branding?.ashton?.enabled,
          squeeze: channelDoc?.branding?.ashton?.squeeze !== false
        },
        lband: { enabled: !!channelDoc?.branding?.lband?.enabled },
        logo: {
          enabled: logoWasEnabled,
          suppressed: !shouldShowLogo && logoWasEnabled
        }
      };

      console.log(
        `[Feeder:${this.channelId}] Saved pre-schedule branding snapshot for "${schedule.title}":`,
        this.scheduleBrandingSnapshot
      );

      // Immediately suppress overlays on air via live ZMQ
      const encoder = this.getEncoder();
      if (encoder && encoder.isRunning) {
        if (!shouldShowLogo && logoWasEnabled) {
          await encoder.setLogoEnabled(false).catch(() => { });
        }
        if (this.scheduleBrandingSnapshot.ticker.enabled) {
          await encoder.setTickerEnabled(false).catch(() => { });
        }
        if (this.scheduleBrandingSnapshot.bug.enabled) {
          await encoder.setBugEnabled(false).catch(() => { });
        }
        if (this.scheduleBrandingSnapshot.ashton.enabled) {
          await encoder.setAshtonLive(false).catch(() => { });
        }
        if (this.scheduleBrandingSnapshot.lband.enabled) {
          await encoder.setLBandEnabled(false).catch(() => { });
        }
      }

      // Persist snapshot and suppress branding states in DB so UI reflects that overlays are suppressed
      const updateFields = {
        'branding.preScheduleBranding': this.scheduleBrandingSnapshot,
        'branding.ticker.enabled': false,
        'branding.bug.enabled': false,
        'branding.ashton.enabled': false,
        'branding.lband.enabled': false
      };
      if (!shouldShowLogo && logoWasEnabled) {
        updateFields['branding.logo.enabled'] = false;
      }

      await Channel.findByIdAndUpdate(this.channelId, { $set: updateFields });

      if (io) {
        io.to(`channel:${this.channelId}`).emit('branding_updated', {
          type: 'all',
          branding: {
            ticker: { enabled: false },
            bug: { enabled: false },
            ashton: { enabled: false },
            lband: { enabled: false },
            ...(!shouldShowLogo && logoWasEnabled ? { logo: { enabled: false } } : {})
          }
        });
      }
    } catch (bErr) {
      console.warn(`[Feeder:${this.channelId}] Warning suppressing branding for schedule:`, bErr.message);
    }

    // 3. Kill current regular decoder so it immediately stops streaming regular frames
    if (this.currentDecoder) {
      try {
        this.currentDecoder.stdout.unpipe();
      } catch { }
      try {
        this.currentDecoder.kill('SIGINT');
      } catch { }
      this.currentDecoder = null;
    }

    // 3. Emit schedule_started event to UI
    if (io) {
      io.to(`channel:${this.channelId}`).emit('schedule_started', {
        channelId: this.channelId,
        scheduleId: schedule._id,
        title: schedule.title,
        assetCount: scheduledAssets.length,
        assetName: scheduledAssets.map((a) => a.originalName).join(', '),
        duration: schedule.duration,
        dailyStartTime: schedule.dailyStartTime,
        dailyEndTime: schedule.dailyEndTime || '',
        pausedAtOffset: this.interruptedState.offsetSeconds,
        pausedItemIndex: this.interruptedState.index
      });
    }

    // 4. Stream scheduled asset playlist directly into the persistent encoder stdin
    // If dailyEndTime is provided, stream until the wall-clock reaches dailyEndTime (looping through playlist if needed)
    let targetEndTime = null;
    const now = new Date();
    if (schedule.dailyEndTime) {
      const [eh, em, es] = schedule.dailyEndTime.split(':').map(Number);
      const endD = new Date();
      endD.setHours(eh || 0, em || 0, es || 0, 0);
      // If end time is earlier than or equal to now (e.g. wraps past midnight)
      if (endD.getTime() <= now.getTime()) {
        endD.setDate(endD.getDate() + 1);
      }
      targetEndTime = endD.getTime();
      console.log(
        `[Feeder:${this.channelId}] Schedule window active until ${schedule.dailyEndTime} (${Math.round((targetEndTime - Date.now()) / 1000)}s total, ${scheduledAssets.length} video(s))`
      );
    } else if (schedule.duration && Number(schedule.duration) > 0) {
      targetEndTime = Date.now() + Number(schedule.duration) * 1000;
    } else {
      const totalDur = scheduledAssets.reduce((sum, a) => sum + (Number(a.duration) || 0), 0) || 60;
      targetEndTime = Date.now() + totalDur * 1000;
    }

    // ------------------------------------------------------------------------
    // TIMELINE SYNCHRONIZATION: Calculate which video should be playing now
    // and at what exact second offset if the server restarted mid-schedule.
    // E.g., Schedule 10:00-10:30 with 3x10min videos; server boots at 10:15:
    // Video 1 (10:00-10:10) is skipped, Video 2 starts at 05:00 (300s) until 10:20,
    // Video 3 plays 10:20-10:30.
    // ------------------------------------------------------------------------
    let startAssetIdx = 0;
    let initialSeekOffsetSec = 0;

    // Timeline synchronization applies when an explicit dailyEndTime is set (fixed programming block)
    if (schedule.dailyStartTime && schedule.dailyEndTime) {
      const [sh, sm, ss] = schedule.dailyStartTime.split(':').map(Number);
      const startD = new Date(now);
      startD.setHours(sh || 0, sm || 0, ss || 0, 0);

      // Handle midnight-crossing schedules (e.g. 23:30 to 00:30)
      const [eh, em, es] = schedule.dailyEndTime.split(':').map(Number);
      const endD = new Date(now);
      endD.setHours(eh || 0, em || 0, es || 0, 0);
      if (endD.getTime() <= startD.getTime() && now.getTime() < endD.getTime()) {
        startD.setDate(startD.getDate() - 1);
      }

      const elapsedSecSinceScheduleStart = Math.max(0, (now.getTime() - startD.getTime()) / 1000);

      if (elapsedSecSinceScheduleStart > 0 && scheduledAssets.length > 0) {
        // Collect duration of each scheduled video in seconds
        const assetDurations = scheduledAssets.map((a) => Math.max(1, Number(a.duration) || 600));
        const totalPlaylistSec = assetDurations.reduce((sum, d) => sum + d, 0);

        // If schedule window is longer than the playlist, playlist loops
        const effectiveElapsedSec = totalPlaylistSec > 0
          ? elapsedSecSinceScheduleStart % totalPlaylistSec
          : 0;

        let accumulated = 0;
        for (let i = 0; i < scheduledAssets.length; i++) {
          const dur = assetDurations[i];
          if (effectiveElapsedSec < accumulated + dur) {
            startAssetIdx = i;
            initialSeekOffsetSec = Math.max(0, effectiveElapsedSec - accumulated);
            break;
          }
          accumulated += dur;
        }

        console.log(
          `[Feeder:${this.channelId}] Timeline Sync: Schedule started ${Math.round(elapsedSecSinceScheduleStart)}s ago. ` +
          `Jumping directly to scheduled item #${startAssetIdx + 1}/${scheduledAssets.length} ("${scheduledAssets[startAssetIdx]?.originalName}") ` +
          `at seek offset ${initialSeekOffsetSec.toFixed(1)}s (skipping ${startAssetIdx} earlier completed video(s)).`
        );
      }
    }

    try {
      let assetIdx = startAssetIdx;
      let isFirstItem = true;

      while (this.isRunning && this.isScheduleActive && Date.now() < targetEndTime) {
        const currentSchedAsset = scheduledAssets[assetIdx % scheduledAssets.length];
        const scheduleAssetPath = path.resolve(SERVER_ROOT, currentSchedAsset.filePath);

        if (fs.existsSync(scheduleAssetPath)) {
          const remainingWindowSeconds = Math.max(0.5, (targetEndTime - Date.now()) / 1000);
          const assetDuration = Math.max(1, Number(currentSchedAsset.duration) || 600);

          // For the first item upon mid-schedule recovery, seek to initialSeekOffsetSec and play only its remaining duration
          const seekOffset = isFirstItem ? initialSeekOffsetSec : 0;
          const assetRemainingDuration = Math.max(0.5, assetDuration - seekOffset);
          const maxPlayDuration = Math.min(assetRemainingDuration, remainingWindowSeconds);

          console.log(
            `[Feeder:${this.channelId}] [Schedule Item ${assetIdx + 1}/${scheduledAssets.length}] ` +
            `Streaming: "${currentSchedAsset.originalName}" from ${seekOffset.toFixed(1)}s for ${maxPlayDuration.toFixed(1)}s ` +
            `(${remainingWindowSeconds.toFixed(1)}s window remaining)`
          );

          // Build Back In Countdown Timer overlay if enabled for this channel and permitted during ad
          let timerFilter = null;
          try {
            const freshCh = await Channel.findById(this.channelId).select('branding.backInTimer');
            const timerCfg = freshCh?.branding?.backInTimer;
            if (timerCfg?.enabled) {
              timerFilter = buildBackInTimerFilter(timerCfg, remainingWindowSeconds);
              console.log(
                `[Feeder:${this.channelId}] Applied frame-accurate Back In timer (${Math.ceil(remainingWindowSeconds)}s countdown) to scheduled ad`
              );
            }
          } catch (tErr) {
            console.warn(`[Feeder:${this.channelId}] Warning preparing Back In timer:`, tErr.message);
          }

          if (io) {
            io.to(`channel:${this.channelId}`).emit('schedule_item_playing', {
              channelId: this.channelId,
              scheduleId: schedule._id,
              assetIndex: assetIdx % scheduledAssets.length,
              assetName: currentSchedAsset.originalName,
              assetDuration: currentSchedAsset.duration,
              seekOffset: Math.round(seekOffset),
              totalAssets: scheduledAssets.length,
              remainingSeconds: Math.ceil(remainingWindowSeconds),
              hasTimer: Boolean(timerFilter)
            });
          }

          await this.streamAsset(scheduleAssetPath, assetDuration, maxPlayDuration, timerFilter, seekOffset);
          isFirstItem = false;
        }

        assetIdx++;

        // If no explicit dailyEndTime was set, stop after playing all assets in the scheduled playlist once
        if (!schedule.dailyEndTime && assetIdx >= scheduledAssets.length) {
          break;
        }

        // If scheduled block has more time remaining, brief pause before playing next video
        if (this.isRunning && this.isScheduleActive && Date.now() < targetEndTime - 1000) {
          await new Promise((r) => setTimeout(r, 120));
        } else {
          break;
        }
      }
    } catch (err) {
      console.error(`[Feeder:${this.channelId}] Error streaming scheduled video playlist:`, err);
    }

    // 5. Scheduled asset has completed!
    console.log(
      `[Feeder:${this.channelId}] >>> SCHEDULE "${schedule.title}" COMPLETE. RESTORING PRE-SCHEDULE BRANDING & RESUMING PAUSED VIDEO AT ${this.interruptedState.offsetSeconds.toFixed(1)}s <<<`
    );

    // Restore pre-schedule branding on air and in DB (ticker, bug, ashton, lband)
    await this.restorePreScheduleBranding();

    // Mark schedule as completed today
    try {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      await Schedule.findByIdAndUpdate(schedule._id, { lastAiredDate: todayStr });
    } catch (sErr) {
      console.warn(`[Feeder:${this.channelId}] Warning marking schedule lastAiredDate:`, sErr.message);
    }

    if (io) {
      io.to(`channel:${this.channelId}`).emit('schedule_ended', {
        channelId: this.channelId,
        scheduleId: schedule._id,
        title: schedule.title,
        resumedAtOffset: this.interruptedState.offsetSeconds,
        resumedItemIndex: this.interruptedState.index
      });
    }

    // 6. Set resume offset so playLoop resumes at this exact point
    this.startOffsetSeconds = this.interruptedState.offsetSeconds;
    this.currentIndex = this.interruptedState.index;
    this.isScheduleActive = false;

    return true;
  }

  stop() {
    this.isRunning = false;
    if (this.priorityCheckTimer) {
      clearInterval(this.priorityCheckTimer);
      this.priorityCheckTimer = null;
    }
    this.currentPlayingPlaylist = null;
    if (this.isScheduleActive && this.scheduleBrandingSnapshot) {
      this.restorePreScheduleBranding().catch(() => { });
    }
    this.isScheduleActive = false;
    this.wasInterruptedBySchedule = false;
    this.interruptedState = null;
    if (this.currentDecoder) {
      try {
        if (this.currentDecoder.stdout) {
          this.currentDecoder.stdout.unpipe();
          this.currentDecoder.stdout.destroy();
        }
        killProcessTree(this.currentDecoder);
      } catch { }
      this.currentDecoder = null;
    }
  }
}
