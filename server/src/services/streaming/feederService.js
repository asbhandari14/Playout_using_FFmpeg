import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Playlist } from '../../models/Playlist.js';
import { Channel } from '../../models/Channel.js';
import { io } from '../../server.js';
import { SERVER_ROOT } from '../../config/paths.js';
import { PLAYLIST_ITEM_STATUS } from '../../config/constants.js';
import { buildBackInTimerFilter } from './brandingAssets.js';

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
          await encoder.setLogoEnabled(true).catch(() => {});
        }
        if (snap.bug?.enabled) {
          await encoder.setBugEnabled(true).catch(() => {});
        }
        if (snap.ticker?.enabled) {
          await encoder.setTickerEnabled(true).catch(() => {});
        }
        if (snap.ashton?.enabled) {
          await encoder.setAshtonLive(true, snap.ashton.squeeze !== false).catch(() => {});
        }
        if (snap.lband?.enabled) {
          await encoder.setLBandEnabled(true).catch(() => {});
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

  async start() {
    this.isRunning = true;
    this.playLoop();
  }

  async playLoop() {
    while (this.isRunning) {
      try {
        const playlist = await Playlist.findOne({ channel: this.channelId }).populate({
          path: 'items.asset',
          select: 'originalName filePath duration durationFormatted status'
        });

        if (!playlist || !playlist.items || playlist.items.length === 0) {
          console.log(`[Feeder:${this.channelId}] Playlist is empty. Feeding live standby slate to maintain broadcast...`);
          await this.streamStandbySlate(3);
          continue;
        }

        // Loop through playlist items
        for (let i = this.currentIndex; i < playlist.items.length; i++) {
          if (!this.isRunning) break;

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
            { channel: this.channelId, 'items._id': item._id },
            { $set: { 'items.$.status': PLAYLIST_ITEM_STATUS.PLAYING } }
          );

          await Channel.findByIdAndUpdate(this.channelId, {
            currentPlayingIndex: i,
            currentAssetId: asset._id
          });

          if (io) {
            io.to(`channel:${this.channelId}`).emit('stream_item_playing', {
              channelId: this.channelId,
              index: i,
              assetId: asset._id,
              assetName: asset.originalName,
              duration: asset.duration
            });
          }

          console.log(`[Feeder:${this.channelId}] Playing item #${i + 1}: ${asset.originalName} (${asset.duration}s)`);

          // Play the asset through decoder
          this.currentAsset = asset;
          this.currentVideoPath = absolutePath;
          await this.streamAsset(absolutePath, asset.duration);

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
            { channel: this.channelId, 'items._id': item._id },
            { $set: { 'items.$.status': PLAYLIST_ITEM_STATUS.PLAYED } }
          );

          if (io) {
            io.to(`channel:${this.channelId}`).emit('stream_item_played', {
              channelId: this.channelId,
              index: i,
              assetId: asset._id
            });
          }
        }

        // Check if loop enabled
        if (!playlist.loop) {
          console.log(`[Feeder:${this.channelId}] Playlist finished (loop disabled). Stopping.`);
          this.isRunning = false;
          break;
        }

        // Reset to beginning of playlist for seamless loop
        this.currentIndex = 0;
        await Playlist.updateOne(
          { channel: this.channelId },
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
  streamAsset(videoPath, _duration, maxDuration = 0, timerFilter = null) {
    return new Promise((resolve) => {
      if (!this.isRunning || !this.encoderProcess?.stdin?.writable) {
        return resolve();
      }

      const startOffset = Math.max(0, this.startOffsetSeconds || 0);
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

        decoder.stdout.on('error', (err) => {
          if (err.code === 'EPIPE' || err.code === 'EOF') return;
          console.warn(`[Decoder stdout error]`, err.message);
        });

        // Pipe decoder stdout into encoder stdin WITHOUT closing encoder stdin when decoder finishes!
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

          decoder.on('error', (err) => {
            console.error(`[Decoder error]`, err.message);
            try {
              decoder.stdout.unpipe();
            } catch { }
            this.currentDecoder = null;
            resolve();
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
            if (err.code === 'EPIPE' || err.code === 'EOF') return;
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

    if (scheduledAssets.length === 0) {
      console.warn(`[Feeder:${this.channelId}] Scheduled event '${schedule.title}' has no valid media assets.`);
      return false;
    }

    this.isScheduleActive = true;
    this.wasInterruptedBySchedule = true;

    // 1. Capture exact paused position of currently playing video
    const pos = this.getCurrentPlaybackPosition();
    this.interruptedState = {
      index: this.currentIndex,
      offsetSeconds: pos.offsetSeconds,
      videoPath: this.currentVideoPath,
      duration: this.currentAssetDuration,
      asset: this.currentAsset
    };

    console.log(
      `[Feeder:${this.channelId}] >>> PAUSING PLAYLIST ITEM #${this.interruptedState.index + 1} AT ${this.interruptedState.offsetSeconds.toFixed(1)}s FOR SCHEDULE: "${schedule.title}" (${scheduledAssets.length} video(s)) <<<`
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
          await encoder.setLogoEnabled(false).catch(() => {});
        }
        if (this.scheduleBrandingSnapshot.ticker.enabled) {
          await encoder.setTickerEnabled(false).catch(() => {});
        }
        if (this.scheduleBrandingSnapshot.bug.enabled) {
          await encoder.setBugEnabled(false).catch(() => {});
        }
        if (this.scheduleBrandingSnapshot.ashton.enabled) {
          await encoder.setAshtonLive(false).catch(() => {});
        }
        if (this.scheduleBrandingSnapshot.lband.enabled) {
          await encoder.setLBandEnabled(false).catch(() => {});
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
      } catch {}
      try {
        this.currentDecoder.kill('SIGINT');
      } catch {}
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

    try {
      let assetIdx = 0;
      while (this.isRunning && this.isScheduleActive && Date.now() < targetEndTime) {
        const currentSchedAsset = scheduledAssets[assetIdx % scheduledAssets.length];
        const scheduleAssetPath = path.resolve(SERVER_ROOT, currentSchedAsset.filePath);

        if (fs.existsSync(scheduleAssetPath)) {
          const remainingSeconds = Math.max(0.5, (targetEndTime - Date.now()) / 1000);
          console.log(
            `[Feeder:${this.channelId}] [Schedule Playlist Item ${assetIdx + 1}/${scheduledAssets.length}] Streaming: "${currentSchedAsset.originalName}" (${remainingSeconds.toFixed(1)}s window remaining)`
          );

          // Build Back In Countdown Timer overlay if enabled for this channel and permitted during ad
          let timerFilter = null;
          try {
            const freshCh = await Channel.findById(this.channelId).select('branding.backInTimer');
            const timerCfg = freshCh?.branding?.backInTimer;
            if (timerCfg?.enabled && timerCfg?.showDuringSchedule !== false) {
              timerFilter = buildBackInTimerFilter(timerCfg, remainingSeconds);
              console.log(
                `[Feeder:${this.channelId}] Applied frame-accurate Back In timer (${Math.ceil(remainingSeconds)}s countdown) to scheduled ad`
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
              totalAssets: scheduledAssets.length,
              remainingSeconds: Math.ceil(remainingSeconds),
              hasTimer: Boolean(timerFilter)
            });
          }

          await this.streamAsset(scheduleAssetPath, currentSchedAsset.duration, remainingSeconds, timerFilter);
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
    if (this.isScheduleActive && this.scheduleBrandingSnapshot) {
      this.restorePreScheduleBranding().catch(() => {});
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
        this.currentDecoder.kill('SIGINT');
      } catch {}
      this.currentDecoder = null;
    }
  }
}
