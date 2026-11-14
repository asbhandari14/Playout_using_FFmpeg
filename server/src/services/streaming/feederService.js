import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Playlist, isPlaylistCurrentlyActive, resolveChannelActivePlaylist, parseTimeToSeconds, PLAYLIST_TYPE } from '../../models/playlist.model.js';
import { Channel } from '../../models/channel.model.js';
import { Schedule } from '../../models/schedule.model.js';
import { Asset } from '../../models/asset.model.js';
import { io } from '../../server.js';
import { SERVER_ROOT } from '../../config/paths.js';
import { PLAYLIST_ITEM_STATUS } from '../../config/constants.js';
import { buildBackInTimerFilter } from './brandingAssets.js';
import { killProcessTree } from '../../utils/processHelper.js';
import { formatDuration, probeVideo } from '../../utils/media.js';

/**
 * Computes exact remaining seconds for an Advertisement Playlist Back-In countdown.
 * Sums remaining items from `itemIndex` onward, respects daily `endTime` windows
 * (including "00:00:00" and midnight wraparound), and distinguishes looping vs non-looping breaks.
 */
export const computeAdBackInRemainingSeconds = (playlist, itemIndex, currentAsset, now = new Date()) => {
  const items = Array.isArray(playlist?.items) ? playlist.items : [];
  let remainingItemsSec = Math.max(0, Number(currentAsset?.duration) || 30);

  for (let idx = itemIndex + 1; idx < items.length; idx++) {
    const nextAsset = items[idx]?.asset;
    if (!nextAsset) continue;
    const dur = Number(nextAsset.duration);
    if (Number.isFinite(dur) && dur > 0) {
      remainingItemsSec += dur;
    }
  }

  const hasEnd = Boolean(playlist?.endTime && String(playlist.endTime).trim());
  if (!hasEnd) {
    return remainingItemsSec;
  }

  const endSec = parseTimeToSeconds(playlist.endTime);
  if (endSec === null || !Number.isFinite(endSec)) {
    return remainingItemsSec;
  }

  const curSec =
    now.getHours() * 3600 +
    now.getMinutes() * 60 +
    now.getSeconds() +
    now.getMilliseconds() / 1000;

  const hasStart = Boolean(playlist?.startTime && String(playlist.startTime).trim());
  const startSec = hasStart ? parseTimeToSeconds(playlist.startTime) : null;

  let remainingWindowSec = null;
  if (startSec !== null && Number.isFinite(startSec) && startSec > endSec) {
    // Overnight slot wrapping midnight (e.g. 23:55:00 -> 00:05:00)
    if (curSec >= startSec) {
      remainingWindowSec = (86400 - curSec) + endSec;
    } else if (curSec <= endSec) {
      remainingWindowSec = endSec - curSec;
    }
  } else if (endSec >= curSec) {
    remainingWindowSec = endSec - curSec;
  }

  if (remainingWindowSec === null) {
    return remainingItemsSec;
  }

  const safeWindowSec = Math.max(0.5, remainingWindowSec);
  return playlist.loop === false
    ? Math.min(remainingItemsSec, safeWindowSec)
    : safeWindowSec;
};

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
    this.currentSchedule = null;
    this.currentScheduleAsset = null;
    this.currentScheduleAssetIndex = 0;
    this.currentScheduleTargetEndTime = null;
    this.wasPreemptedByPriority = false;
    this.interruptedPlaylistStates = new Map();
    this.completedNonLoopingPlaylists = new Map();
    this.priorityCheckTimer = null;
    this.audioProbeCache = new Map();
    this.lastAppliedBrandingKey = null;
    this.isCheckingPriority = false;
  }

  getTargetFps() {
    return this.encoder?.channel?.outputSettings?.fps || 25;
  }

  async checkVideoHasAudio(videoPath) {
    if (this.audioProbeCache.has(videoPath)) {
      return this.audioProbeCache.get(videoPath);
    }
    try {
      const info = await probeVideo(videoPath);
      const hasAudio = info.hasAudio !== false;
      this.audioProbeCache.set(videoPath, hasAudio);
      return hasAudio;
    } catch {
      return true;
    }
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
    const rawOffset = (this.currentOffsetAtStart || 0) + elapsed;
    const maxOffset = this.currentAssetDuration > 1
      ? this.currentAssetDuration - 1
      : Math.max(0, rawOffset);
    return {
      index: this.currentIndex,
      offsetSeconds: Math.max(0, Math.min(rawOffset, maxOffset))
    };
  }

  /**
   * Returns complete real-time information about what scheduling is playing
   * and what video is playing on this channel at this exact second.
   */
  getCurrentlyPlayingInfo() {
    const now = Date.now();
    let elapsedSeconds = 0;
    let remainingSeconds = 0;
    let progressPercent = 0;

    if (this.currentAssetStartTime) {
      const runSec = Math.max(0, (now - this.currentAssetStartTime) / 1000);
      elapsedSeconds = Math.max(0, (this.currentOffsetAtStart || 0) + runSec);
      if (this.currentAssetDuration && this.currentAssetDuration > 0) {
        remainingSeconds = Math.max(0, this.currentAssetDuration - elapsedSeconds);
        progressPercent = Math.min(100, Math.round((elapsedSeconds / this.currentAssetDuration) * 1000) / 10);
      }
    }

    if (this.isScheduleActive && this.currentSchedule) {
      const scheduleRemainingSec = this.currentScheduleTargetEndTime
        ? Math.max(0, (this.currentScheduleTargetEndTime - now) / 1000)
        : remainingSeconds;

      const schedAssets = Array.isArray(this.currentSchedule.assets) && this.currentSchedule.assets.length > 0
        ? this.currentSchedule.assets
        : (this.currentSchedule.asset ? [this.currentSchedule.asset] : []);

      return {
        isLive: true,
        playoutSource: 'schedule',
        scheduling: {
          source: 'schedule_event',
          id: this.currentSchedule._id,
          name: this.currentSchedule.title,
          title: this.currentSchedule.title,
          type: this.currentSchedule.type || 'video',
          priority: this.currentSchedule.priority || 10,
          dailyStartTime: this.currentSchedule.dailyStartTime,
          dailyEndTime: this.currentSchedule.dailyEndTime || '',
          duration: this.currentSchedule.duration || 0,
          durationFormatted: formatDuration(this.currentSchedule.duration || 0),
          remainingWindowSeconds: Math.ceil(scheduleRemainingSec),
          remainingWindowFormatted: formatDuration(scheduleRemainingSec),
          currentAssetIndex: this.currentScheduleAssetIndex || 0,
          totalAssets: schedAssets.length || 1,
          daysOfWeek: this.currentSchedule.daysOfWeek || [],
          startDate: this.currentSchedule.startDate || null,
          endDate: this.currentSchedule.endDate || null
        },
        video: {
          assetId: this.currentScheduleAsset?._id || this.currentAsset?._id || null,
          title: this.currentScheduleAsset?.originalName || this.currentAsset?.originalName || 'Scheduled Video',
          originalName: this.currentScheduleAsset?.originalName || this.currentAsset?.originalName || '',
          filePath: this.currentScheduleAsset?.filePath || this.currentAsset?.filePath || '',
          thumbnailPath: this.currentScheduleAsset?.thumbnailPath || this.currentAsset?.thumbnailPath || '',
          itemIndex: this.currentScheduleAssetIndex || 0,
          totalItems: schedAssets.length || 1,
          duration: this.currentAssetDuration || this.currentScheduleAsset?.duration || 0,
          durationFormatted: formatDuration(this.currentAssetDuration || this.currentScheduleAsset?.duration || 0),
          elapsedSeconds: Math.round(elapsedSeconds * 10) / 10,
          elapsedFormatted: formatDuration(elapsedSeconds),
          remainingSeconds: Math.round(remainingSeconds * 10) / 10,
          remainingFormatted: formatDuration(remainingSeconds),
          progressPercent,
          status: 'playing'
        },
        interruptedState: {
          isInterrupted: Boolean(this.interruptedState),
          pausedPlaylist: this.currentPlayingPlaylist ? {
            id: this.currentPlayingPlaylist._id,
            name: this.currentPlayingPlaylist.name,
            type: this.currentPlayingPlaylist.type,
            priority: this.currentPlayingPlaylist.priority
          } : null,
          pausedItemIndex: this.interruptedState?.index ?? null,
          pausedOffsetSeconds: this.interruptedState ? Math.round((this.interruptedState.offsetSeconds || 0) * 10) / 10 : 0,
          pausedOffsetFormatted: this.interruptedState ? formatDuration(this.interruptedState.offsetSeconds || 0) : '00:00',
          pausedVideo: this.interruptedState?.asset ? {
            assetId: this.interruptedState.asset._id,
            title: this.interruptedState.asset.originalName,
            originalName: this.interruptedState.asset.originalName,
            duration: this.interruptedState.asset.duration
          } : null
        }
      };
    }

    // Regular Priority Playlist playout
    const playlistItems = Array.isArray(this.currentPlayingPlaylist?.items)
      ? this.currentPlayingPlaylist.items
      : [];

    return {
      isLive: true,
      playoutSource: this.currentPlayingPlaylist ? 'playlist' : 'standby',
      scheduling: this.currentPlayingPlaylist ? {
        source: 'priority_playlist',
        id: this.currentPlayingPlaylist._id,
        name: this.currentPlayingPlaylist.name,
        type: this.currentPlayingPlaylist.type,
        priority: this.currentPlayingPlaylist.priority,
        scheduleOption: this.currentPlayingPlaylist.scheduleOption || 'none',
        loop: this.currentPlayingPlaylist.loop !== false,
        totalItems: playlistItems.length,
        startTime: this.currentPlayingPlaylist.startTime || '',
        endTime: this.currentPlayingPlaylist.endTime || '',
        startDate: this.currentPlayingPlaylist.startDate || null,
        endDate: this.currentPlayingPlaylist.endDate || null,
        daysOfWeek: this.currentPlayingPlaylist.daysOfWeek || [],
        liveSourceUrl: this.currentPlayingPlaylist.liveSourceUrl || '',
        showLogo: this.currentPlayingPlaylist.showLogo !== false,
        showBug: this.currentPlayingPlaylist.showBug !== false,
        showTicker: this.currentPlayingPlaylist.showTicker !== false,
        showBackInTimer: Boolean(this.currentPlayingPlaylist.showBackInTimer)
      } : null,
      video: (this.currentPlayingPlaylist && this.currentAsset) ? {
        assetId: this.currentAsset._id,
        title: this.currentAsset.originalName,
        originalName: this.currentAsset.originalName,
        filePath: this.currentAsset.filePath || '',
        thumbnailPath: this.currentAsset.thumbnailPath || '',
        itemIndex: this.currentIndex,
        totalItems: playlistItems.length,
        duration: this.currentAssetDuration || this.currentAsset.duration || 0,
        durationFormatted: formatDuration(this.currentAssetDuration || this.currentAsset.duration || 0),
        elapsedSeconds: Math.round(elapsedSeconds * 10) / 10,
        elapsedFormatted: formatDuration(elapsedSeconds),
        remainingSeconds: Math.round(remainingSeconds * 10) / 10,
        remainingFormatted: formatDuration(remainingSeconds),
        progressPercent,
        status: 'playing'
      } : null,
      interruptedState: {
        isInterrupted: false
      }
    };
  }

  /**
   * Dynamically applies on-air branding overlays (logo, bug, ticker)
   * according to the active playlist's configuration via live ZMQ.
   */
  async applyPlaylistBranding(playlist) {
    if (!playlist) return;
    const brandingKey = `${playlist._id}:${playlist.updatedAt ? new Date(playlist.updatedAt).getTime() : ''}`;
    if (this.lastAppliedBrandingKey === brandingKey) return;
    try {
      const channelDoc = await Channel.findById(this.channelId);
      if (channelDoc) {
        this.lastAppliedBrandingKey = brandingKey;
      }
      if (!channelDoc || !channelDoc.branding) return;

      const encoder = this.getEncoder();
      if (!encoder || !encoder.isRunning) return;

      // Channel master branding capability (must be configured on channel level)
      const masterLogoConfigured = Boolean(channelDoc.branding.logo?.assetPath && channelDoc.branding.logo?.enabled);
      const masterBugConfigured = Boolean(channelDoc.branding.bug?.assetPath && channelDoc.branding.bug?.enabled);
      const masterTickerConfigured = Boolean(channelDoc.branding.ticker?.enabled);

      // Playlist-specific permission flags (defaults to true if omitted)
      const allowLogo = playlist.showLogo !== false;
      const allowBug = playlist.showBug !== false;
      const allowTicker = playlist.showTicker !== false;

      // Apply via live ZMQ with zero stream restart
      if (masterLogoConfigured && allowLogo) {
        await encoder.setLogoEnabled(true).catch(() => {});
      } else {
        await encoder.setLogoEnabled(false).catch(() => {});
      }

      if (masterBugConfigured && allowBug) {
        await encoder.setBugEnabled(true).catch(() => {});
      } else {
        await encoder.setBugEnabled(false).catch(() => {});
      }

      if (masterTickerConfigured && allowTicker) {
        await encoder.setTickerEnabled(true).catch(() => {});
      } else {
        await encoder.setTickerEnabled(false).catch(() => {});
      }

      console.log(
        `[Feeder:${this.channelId}] Applied branding for playlist "${playlist.name}" (${playlist.type}): ` +
        `logo=${allowLogo && masterLogoConfigured}, bug=${allowBug && masterBugConfigured}, ticker=${allowTicker && masterTickerConfigured}`
      );
    } catch (err) {
      console.warn(`[Feeder:${this.channelId}] Warning applying playlist branding:`, err.message);
    }
  }

  /**
   * Applies playlist branding asynchronously without blocking decoder startup on pipe:0.
   * Waits for the encoder to process its first frame so filter_complex ZMQ commands succeed immediately.
   */
  schedulePlaylistBranding(playlist) {
    if (!playlist) return;
    const targetId = String(playlist._id);
    const enc = this.getEncoder();
    if (!enc || !enc.isRunning) return;

    const run = async () => {
      if (!enc.hasFirstPts && typeof enc.waitForFirstFrame === 'function') {
        const ready = await enc.waitForFirstFrame(25000);
        if (!ready) return;
      }
      if (!this.isRunning || String(this.currentPlayingPlaylist?._id || '') !== targetId) {
        return;
      }
      await this.applyPlaylistBranding(playlist);
    };

    run().catch(() => {});
  }

  /**
   * Resolves the highest-priority active playlist matching current time/date/day.
   * Priority: emergency (5) > advertisement (4) > live_schedule (3) > scheduling (2) > default (1)
   */
  async resolveActivePlaylist() {
    try {
      const now = new Date();
      if (this.completedNonLoopingPlaylists && this.completedNonLoopingPlaylists.size > 0) {
        for (const [id, expireTime] of this.completedNonLoopingPlaylists.entries()) {
          if (Date.now() > expireTime) {
            this.completedNonLoopingPlaylists.delete(id);
          }
        }
      }
      const active = await resolveChannelActivePlaylist(this.channelId, now, this.completedNonLoopingPlaylists);
      return active || null;
    } catch (err) {
      console.warn(`[Feeder:${this.channelId}] Error resolving active playlist:`, err.message);
      return null;
    }
  }

  /**
   * Checks whether the active priority playlist has changed for this channel.
   * If a higher-priority playlist is armed/scheduled, or current playlist's window expired,
   * terminates current video decoder immediately so playLoop can transition seamlessly.
   */
  async checkPriorityTransition() {
    if (!this.isRunning || this.isCheckingPriority) {
      return false;
    }

    // If a calendar schedule is playing, allow Emergency playlist (Priority 5) to preempt immediately
    if (this.isScheduleActive) {
      const activeEmergency = await this.resolveActivePlaylist();
      if (activeEmergency?.type !== PLAYLIST_TYPE.EMERGENCY) {
        return false;
      }
    }
    this.isCheckingPriority = true;

    try {
      const targetPlaylist = await this.resolveActivePlaylist();
      const currentId = this.currentPlayingPlaylist?._id ? String(this.currentPlayingPlaylist._id) : null;
      const targetId = targetPlaylist?._id ? String(targetPlaylist._id) : null;

      if (currentId !== targetId || (this.isScheduleActive && targetPlaylist?.type === PLAYLIST_TYPE.EMERGENCY)) {
        console.log(
          `[Feeder:${this.channelId}] >>> REAL-TIME PRIORITY TRANSITION <<<` +
          `\nFrom: "${this.currentPlayingPlaylist?.name || (this.isScheduleActive ? 'Calendar Schedule' : 'Standby Slate')}" (${this.currentPlayingPlaylist?.type || (this.isScheduleActive ? 'schedule' : 'standby')}, P${this.currentPlayingPlaylist?.priority || 0})` +
          `\nTo:   "${targetPlaylist?.name || 'Standby Slate'}" (${targetPlaylist?.type || 'standby'}, P${targetPlaylist?.priority || 0})` +
          `\nPreempting currently playing video decoder to switch immediately.`
        );

        if (this.isScheduleActive && targetPlaylist?.type === PLAYLIST_TYPE.EMERGENCY) {
          console.log(`[Feeder:${this.channelId}] Emergency playlist preempted active calendar schedule.`);
          this.isScheduleActive = false;
          this.currentSchedule = null;
          this.currentScheduleAsset = null;
          this.currentScheduleTargetEndTime = null;
        }

        // Mid-video state capture: If the playlist being preempted was active,
        // capture its exact playback offset so it can seamlessly resume at this exact second
        if (this.currentPlayingPlaylist?._id) {
          const prevId = String(this.currentPlayingPlaylist._id);
          const currentItem = this.currentPlayingPlaylist.items?.[this.currentIndex];
          const pos = this.currentDecoder
            ? this.getCurrentPlaybackPosition()
            : { index: this.currentIndex, offsetSeconds: Math.max(0, this.startOffsetSeconds || 0) };
          this.interruptedPlaylistStates.set(prevId, {
            index: this.currentIndex,
            offsetSeconds: pos.offsetSeconds,
            assetId: currentItem?.asset?._id ? String(currentItem.asset._id) : (this.currentAsset?._id ? String(this.currentAsset._id) : null),
            videoPath: this.currentVideoPath,
            duration: this.currentAssetDuration,
            savedAt: Date.now()
          });
          console.log(
            `[Feeder:${this.channelId}] Saved mid-video resume state for playlist "${this.currentPlayingPlaylist.name}": item #${this.currentIndex + 1} at ${pos.offsetSeconds.toFixed(1)}s`
          );
        }

        this.wasPreemptedByPriority = true;
        this.currentPlayingPlaylist = targetPlaylist;

        // Apply new playlist branding immediately (non-blocking once encoder is live)
        if (targetPlaylist) {
          this.schedulePlaylistBranding(targetPlaylist);
        }

        if (this.currentDecoder) {
          const dec = this.currentDecoder;
          this.currentDecoder = null;
          try {
            dec.stdout.unpipe();
            dec.stdout.destroy();
          } catch { }
          try {
            await killProcessTree(dec);
          } catch { }
        }

        return true;
      }
    } catch (err) {
      console.warn(`[Feeder:${this.channelId}] Warning checking priority transition:`, err.message);
    } finally {
      this.isCheckingPriority = false;
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
          this.currentPlayingPlaylist = null;
          this.currentAsset = null;
          this.currentAssetStartTime = null;
          this.currentAssetDuration = null;
          this.lastAppliedBrandingKey = null;
          currentPlaylistId = null;
          console.log(`[Feeder:${this.channelId}] No scheduled playlist active at this time. Feeding live standby slate to maintain broadcast...`);
          const enc = this.getEncoder();
          if (enc && enc.isRunning) {
            const disableOverlays = () => {
              if (!this.isRunning || this.currentPlayingPlaylist) return;
              enc.setLogoEnabled(false).catch(() => {});
              enc.setBugEnabled(false).catch(() => {});
              enc.setTickerEnabled(false).catch(() => {});
            };
            if (enc.hasFirstPts || typeof enc.waitForFirstFrame !== 'function') {
              disableOverlays();
            } else {
              enc.waitForFirstFrame(25000).then((ready) => {
                if (ready) disableOverlays();
              }).catch(() => {});
            }
          }
          await this.streamStandbySlate(3);
          continue;
        }

        // If active playlist changed to a different one, restore saved state or reset to 0
        const targetPlaylistId = String(playlist._id);
        const isSwitchingPlaylist = !currentPlaylistId || String(currentPlaylistId) !== targetPlaylistId;

        if (isSwitchingPlaylist) {
          this.wasPreemptedByPriority = false;
          const savedState = this.interruptedPlaylistStates.get(targetPlaylistId);
          if (savedState) {
            this.interruptedPlaylistStates.delete(targetPlaylistId);
            const isValidIndex = Number.isInteger(savedState.index) && savedState.index >= 0 && savedState.index < (playlist.items?.length || 0);
            if (isValidIndex) {
              let resumeIdx = savedState.index;
              let resumeOffset = Math.max(0, savedState.offsetSeconds || 0);

              const candidateItem = playlist.items[resumeIdx];
              const candidateAssetId = candidateItem?.asset?._id ? String(candidateItem.asset._id) : null;

              if (savedState.assetId && savedState.assetId !== candidateAssetId) {
                const shiftedIdx = playlist.items.findIndex((it) => String(it?.asset?._id || '') === savedState.assetId);
                if (shiftedIdx !== -1) {
                  resumeIdx = shiftedIdx;
                } else {
                  console.warn(`[Feeder:${this.channelId}] Saved asset no longer in playlist "${playlist.name}". Starting from beginning.`);
                  resumeIdx = 0;
                  resumeOffset = 0;
                }
              }

              const targetItem = playlist.items[resumeIdx];
              const targetDuration = Number(targetItem?.asset?.duration) || 0;

              // Near-end boundary check: if video was interrupted within 2 seconds of completion, advance to next item
              if (targetDuration > 2 && resumeOffset >= targetDuration - 2) {
                console.log(
                  `[Feeder:${this.channelId}] Saved position in "${targetItem?.asset?.originalName || 'video'}" was within 2s of end (${resumeOffset.toFixed(1)}s / ${targetDuration}s). Advancing to next item.`
                );
                resumeIdx++;
                resumeOffset = 0;
                if (resumeIdx >= playlist.items.length) {
                  resumeIdx = playlist.loop ? 0 : playlist.items.length;
                }
              }

              this.currentIndex = resumeIdx;
              this.startOffsetSeconds = resumeOffset;
              if (this.currentIndex < (playlist.items?.length || 0)) {
                const activeItem = playlist.items[this.currentIndex];
                console.log(
                  `[Feeder:${this.channelId}] Resuming playlist "${playlist.name}" (${playlist.type}) from saved position: ` +
                  `item #${this.currentIndex + 1}/${playlist.items.length} ("${activeItem?.asset?.originalName || 'video'}") ` +
                  `at offset ${this.startOffsetSeconds.toFixed(1)}s`
                );
              }
            } else {
              this.currentIndex = 0;
              this.startOffsetSeconds = 0;
            }
          } else if (currentPlaylistId) {
            console.log(
              `[Feeder:${this.channelId}] Active playlist changed to "${playlist.name}" (${playlist.type}, priority ${playlist.priority}). Starting from beginning.`
            );
            this.currentIndex = 0;
            this.startOffsetSeconds = 0;
          }
        }
        currentPlaylistId = targetPlaylistId;
        this.currentPlayingPlaylist = playlist;
        this.schedulePlaylistBranding(playlist);

        // Special handling for live_schedule with a direct liveSourceUrl
        if (playlist.type === PLAYLIST_TYPE.LIVE_SCHEDULE && playlist.liveSourceUrl && (!playlist.items || playlist.items.length === 0)) {
          console.log(`[Feeder:${this.channelId}] Relaying live schedule stream: ${playlist.liveSourceUrl}`);
          await this.streamAsset(playlist.liveSourceUrl, 0);
          this.wasPreemptedByPriority = false;
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

          // Gate: if a scheduled broadcast is active, wait until it finishes before starting next item
          while (this.isScheduleActive && this.isRunning) {
            await new Promise((r) => setTimeout(r, 250));
          }

          // Before playing next item, check if active playlist has changed or expired!
          const activeCheck = await this.resolveActivePlaylist();
          const activeCheckId = activeCheck?._id ? String(activeCheck._id) : null;
          if (activeCheckId !== String(playlist._id)) {
            console.log(
              `[Feeder:${this.channelId}] Active playlist changed or expired (now: "${activeCheck?.name || 'Standby Slate'}"). Switching immediately.`
            );
            if (playlist._id) {
              const currentItem = playlist.items[i];
              this.interruptedPlaylistStates.set(String(playlist._id), {
                index: i,
                offsetSeconds: 0,
                assetId: currentItem?.asset?._id ? String(currentItem.asset._id) : null,
                savedAt: Date.now()
              });
            }
            this.currentIndex = 0;
            this.startOffsetSeconds = 0;
            currentPlaylistId = activeCheckId;
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

          // Mark item PLAYING (non-blocking to eliminate inter-video DB gap)
          Playlist.updateOne(
            { _id: playlist._id, 'items._id': item._id },
            { $set: { 'items.$.status': PLAYLIST_ITEM_STATUS.PLAYING } }
          ).catch(() => { });

          Channel.findByIdAndUpdate(this.channelId, {
            currentPlayingIndex: i,
            currentAssetId: asset._id
          }).catch(() => { });

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

          // Build Back-In Countdown Timer overlay if this is an Advertisement playlist and showBackInTimer is enabled
          let timerFilter = null;
          if (playlist.type === PLAYLIST_TYPE.ADVERTISEMENT && playlist.showBackInTimer) {
            try {
              const freshCh = await Channel.findById(this.channelId).select('branding.backInTimer');
              const timerCfg = freshCh?.branding?.backInTimer || {};

              const countdownSec = computeAdBackInRemainingSeconds(playlist, i, asset);
              timerFilter = buildBackInTimerFilter(timerCfg, countdownSec);
              console.log(
                `[Feeder:${this.channelId}] Applied Back-In Countdown Timer (${Math.ceil(countdownSec)}s) to ad playlist "${playlist.name}"`
              );
            } catch (tErr) {
              console.warn(`[Feeder:${this.channelId}] Warning preparing Back-In timer for ad:`, tErr.message);
            }
          }

          // Play the asset through decoder
          this.currentAsset = asset;
          this.currentVideoPath = absolutePath;
          await this.streamAsset(absolutePath, asset.duration, 0, timerFilter);

          // If playback was preempted by priority transition (e.g. emergency armed or schedule window ended):
          if (this.wasPreemptedByPriority) {
            console.log(
              `[Feeder:${this.channelId}] Playout preempted by priority transition. Advancing immediately to new active playlist.`
            );
            this.wasPreemptedByPriority = false;
            break;
          }

          // If playback was paused by a scheduled video broadcast, wait until schedule finishes
          if (this.isScheduleActive) {
            console.log(`[Feeder:${this.channelId}] Regular play loop waiting for scheduled video to complete...`);
            while (this.isScheduleActive && this.isRunning) {
              await new Promise((r) => setTimeout(r, 250));
            }
            if (this.wasInterruptedBySchedule) {
              this.wasInterruptedBySchedule = false;
              // Decrement i so next for-loop iteration re-enters the same item with this.startOffsetSeconds
              i = this.currentIndex - 1;
              continue;
            }
          }

          // Mark item PLAYED (non-blocking)
          Playlist.updateOne(
            { _id: playlist._id, 'items._id': item._id },
            { $set: { 'items.$.status': PLAYLIST_ITEM_STATUS.PLAYED } }
          ).catch(() => { });

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
            this.startOffsetSeconds = 0;
            const now = new Date();
            let expireTime = Date.now() + 60000;
            if (playlist.endTime) {
              const endSec = parseTimeToSeconds(playlist.endTime);
              if (endSec !== null) {
                const curSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                const remainingSec = endSec >= curSec ? (endSec - curSec) : 60;
                expireTime = Date.now() + (remainingSec + 5) * 1000;
              }
            }
            this.completedNonLoopingPlaylists.set(String(playlist._id), expireTime);
            continue;
          }
          // Default playlist must never terminate a live broadcast channel when reaching the end
          console.warn(`[Feeder:${this.channelId}] Default playlist has loop=false; forcing continuous loop to keep channel live.`);
          this.currentIndex = 0;
          this.startOffsetSeconds = 0;
          Playlist.updateOne(
            { _id: playlist._id },
            { $set: { 'items.$[].status': PLAYLIST_ITEM_STATUS.QUEUED } }
          ).catch(() => { });
          continue;
        }

        // Reset to beginning of playlist for seamless loop (non-blocking)
        this.currentIndex = 0;
        this.startOffsetSeconds = 0;
        Playlist.updateOne(
          { _id: playlist._id },
          { $set: { 'items.$[].status': PLAYLIST_ITEM_STATUS.QUEUED } }
        ).catch(() => { });
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
  async streamAsset(videoPath, _duration, maxDuration = 0, timerFilter = null, seekOffset = 0) {
    if (!this.isRunning || !this.encoderProcess?.stdin?.writable) {
      return;
    }

    // Ensure any previously running decoder is cleanly detached and killed before launching next
    if (this.currentDecoder) {
      const oldDec = this.currentDecoder;
      this.currentDecoder = null;
      try {
        oldDec.stdout.unpipe();
        oldDec.stdout.destroy();
      } catch { }
      try {
        await killProcessTree(oldDec);
      } catch { }
    }

    const enc = this.getEncoder();
    if (enc) {
      enc.setTransitioning(true);
    }

    const hasAudio = await this.checkVideoHasAudio(videoPath);
    if (!this.isRunning || !this.encoderProcess?.stdin?.writable) {
      if (enc) enc.setTransitioning(false);
      return;
    }

    return new Promise((resolve) => {
      const fps = this.getTargetFps();
      let startOffset = seekOffset > 0 ? seekOffset : Math.max(0, this.startOffsetSeconds || 0);
      if (_duration > 1 && startOffset >= _duration) {
        startOffset = 0;
      }
      this.startOffsetSeconds = 0; // reset after initial resume
      this.currentAssetStartTime = Date.now();
      this.currentAssetDuration = _duration;
      this.currentOffsetAtStart = startOffset;

      const baseVf = `fps=${fps},scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2`;
      let vfArg = baseVf;
      if (timerFilter) {
        if (timerFilter.includes('movie=')) {
          vfArg = `${baseVf}[vbase]; ${timerFilter}`;
        } else {
          vfArg = `${baseVf},${timerFilter}`;
        }
      }

      // Decoder process arguments
      // Normalizes to 1280x720, <fps>, AAC stereo 44.1kHz, outputs mpegts on stdout
      const decoderArgs = [
        '-re', // Real-time native pacing
        ...(startOffset > 0 ? ['-ss', String(startOffset)] : []),
        '-i', videoPath,
        ...(!hasAudio ? ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'] : []),
        ...(maxDuration > 0 ? ['-t', String(maxDuration)] : []),
        '-vf', vfArg,
        ...(!hasAudio ? ['-map', '0:v:0', '-map', '1:a:0', '-shortest'] : ['-map', '0:v:0', '-map', '0:a:0']),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        '-g', String(fps),
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        '-muxdelay', '0',
        '-muxpreload', '0',
        '-f', 'mpegts',
        'pipe:1'
      ];

      const decoder = spawn('ffmpeg', decoderArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.currentDecoder = decoder;

      if (enc) {
        enc.setTransitioning(false);
      }

      if (decoder.stderr) {
        decoder.stderr.on('data', (chunk) => {
          const msg = chunk.toString();
          if (/error|invalid data|failed|no such file|corrupt|unable to/i.test(msg)) {
            console.warn(`[Feeder:${this.channelId} Decoder stderr] ${msg.trim()}`);
          }
        });
      }

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
        if (enc) {
          enc.resetWatchdog();
        }
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

      const fps = this.getTargetFps();
      const slateArgs = [
        '-re',
        '-f', 'lavfi', '-i', `color=c=0x0c0e12:s=1280x720:r=${fps}:d=${duration}`,
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
    this.wasInterruptedBySchedule = true;

    // 1. Capture exact paused position of currently playing video (or start at beginning if startup gate)
    const pos = this.getCurrentPlaybackPosition();
    this.interruptedState = {
      index: this.currentIndex,
      offsetSeconds: hadRegularVideoPlaying ? pos.offsetSeconds : (this.startOffsetSeconds || 0),
      videoPath: this.currentVideoPath,
      duration: this.currentAssetDuration,
      asset: this.currentAsset
    };

    if (this.currentPlayingPlaylist?._id) {
      const prevId = String(this.currentPlayingPlaylist._id);
      this.interruptedPlaylistStates.set(prevId, {
        index: this.interruptedState.index,
        offsetSeconds: this.interruptedState.offsetSeconds,
        assetId: this.interruptedState.asset?._id ? String(this.interruptedState.asset._id) : null,
        videoPath: this.interruptedState.videoPath,
        duration: this.interruptedState.duration,
        savedAt: Date.now()
      });
    }

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
      const dec = this.currentDecoder;
      this.currentDecoder = null;
      try {
        dec.stdout.unpipe();
        dec.stdout.destroy();
      } catch { }
      try {
        await killProcessTree(dec);
      } catch { }
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

    this.currentSchedule = schedule;
    this.currentScheduleTargetEndTime = targetEndTime;

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
          this.currentScheduleAsset = currentSchedAsset;
          this.currentScheduleAssetIndex = assetIdx % scheduledAssets.length;
          this.currentAsset = currentSchedAsset;
          this.currentVideoPath = scheduleAssetPath;
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
    let resumeIdx = this.interruptedState.index;
    let resumeOffset = this.interruptedState.offsetSeconds;
    const itemDur = Number(this.interruptedState.duration) || 0;
    if (itemDur > 2 && resumeOffset >= itemDur - 2) {
      console.log(
        `[Feeder:${this.channelId}] Interrupted video was within 2s of end (${resumeOffset.toFixed(1)}s / ${itemDur}s). Advancing to next item on schedule complete.`
      );
      resumeIdx++;
      resumeOffset = 0;
    }
    this.startOffsetSeconds = resumeOffset;
    this.currentIndex = resumeIdx;
    this.isScheduleActive = false;
    this.currentSchedule = null;
    this.currentScheduleAsset = null;
    this.currentScheduleTargetEndTime = null;

    return true;
  }

  stop() {
    this.isRunning = false;
    if (this.priorityCheckTimer) {
      clearInterval(this.priorityCheckTimer);
      this.priorityCheckTimer = null;
    }
    this.currentPlayingPlaylist = null;
    this.currentSchedule = null;
    this.currentScheduleAsset = null;
    this.currentScheduleTargetEndTime = null;
    if (this.isScheduleActive && this.scheduleBrandingSnapshot) {
      this.restorePreScheduleBranding().catch(() => { });
    }
    this.isScheduleActive = false;
    this.wasInterruptedBySchedule = false;
    this.interruptedState = null;
    if (this.interruptedPlaylistStates) {
      this.interruptedPlaylistStates.clear();
    }
    if (this.completedNonLoopingPlaylists) {
      this.completedNonLoopingPlaylists.clear();
    }
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
