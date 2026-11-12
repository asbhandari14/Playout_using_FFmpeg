import fs from 'fs';
import path from 'path';
import { SERVER_ROOT, STREAMS_DIR } from '../../config/paths.js';
import { Channel } from '../../models/channel.model.js';
import { Playlist } from '../../models/playlist.model.js';
import { Server } from '../../models/server.model.js';
import { EncoderService } from './encoderService.js';
import { FeederService } from './feederService.js';
import { CHANNEL_STATUS } from '../../config/constants.js';
import { createFlussonicStream, sanitizeStreamKey } from '../flussonicService.js';
import { io } from '../../server.js';

class StreamManager {
  constructor() {
    this.activeStreams = new Map();
    this.nextZmqPort = 5600;
    this.fireTimers = new Map();
    this.recoveryMap = new Map();
    this.reloadingChannels = new Set();
  }

  clearRecovery(channelId) {
    const chIdStr = String(channelId);
    if (this.recoveryMap.has(chIdStr)) {
      const rec = this.recoveryMap.get(chIdStr);
      if (rec?.timer) clearTimeout(rec.timer);
      this.recoveryMap.delete(chIdStr);
    }
    this.reloadingChannels.delete(chIdStr);
  }

  /**
   * Continuous auto-recovery retry loop with exponential backoff for network outages
   */
  scheduleAutoRecovery(channelId, lastPos = null) {
    const chIdStr = String(channelId);
    this.reloadingChannels.add(chIdStr);
    const existingRec = this.recoveryMap.get(chIdStr) || { count: 0, lastPos };
    const count = existingRec.count + 1;
    const pos = lastPos || existingRec.lastPos || { index: 0, offsetSeconds: 0 };

    if (existingRec.timer) clearTimeout(existingRec.timer);

    let delayMs = 3000;
    if (count === 2) delayMs = 5000;
    else if (count >= 3) delayMs = 10000;

    console.log(`[StreamManager Auto-Recovery] Scheduling reconnect attempt #${count} for channel ${chIdStr} in ${delayMs / 1000}s...`);

    if (io) {
      io.to(`channel:${chIdStr}`).emit('stream_status', {
        channelId: chIdStr,
        status: 'reconnecting',
        attempt: count
      });
    }

    const timer = setTimeout(async () => {
      try {
        const channel = await Channel.findById(chIdStr);
        if (!channel) {
          this.clearRecovery(chIdStr);
          return;
        }

        await this.stopStream(chIdStr, { isReloading: true });

        console.log(`[StreamManager Auto-Recovery] Executing reconnect attempt #${count} for '${channel.name}'...`);
        const streamInstance = await this.startStream(chIdStr, pos.index, {
          isReloading: true,
          startOffsetSeconds: pos.offsetSeconds
        });

        if (streamInstance) {
          console.log(`[StreamManager Auto-Recovery] 🚀 Channel '${channel.name}' (${chIdStr}) recovered successfully on attempt #${count}!`);
          this.clearRecovery(chIdStr);
        }
      } catch (err) {
        console.warn(`[StreamManager Auto-Recovery] Attempt #${count} for channel ${chIdStr} failed (${err.message}). Retrying...`);
        this.scheduleAutoRecovery(chIdStr, pos);
      }
    }, delayMs);

    this.recoveryMap.set(chIdStr, { count, timer, lastPos: pos });
  }

  /**
   * Start live broadcast for a channel
   */
  async startStream(channelId, startIndex = 0, { isReloading = false, startOffsetSeconds = 0 } = {}) {
    const chIdStr = String(channelId);
    if (this.activeStreams.has(chIdStr)) {
      const existing = this.activeStreams.get(chIdStr);
      const isAlive = existing &&
        existing.encoder?.isRunning &&
        existing.encoder?.process &&
        !existing.encoder.process.killed &&
        existing.encoder.process.exitCode === null;

      if (isAlive) {
        console.log(`[StreamManager] Channel ${chIdStr} is already running.`);
        return existing;
      }

      console.warn(`[StreamManager] Channel ${chIdStr} has a stale/dead stream instance. Cleaning up before restart...`);
      await this.stopStream(chIdStr, { isReloading: true });
    }

    if (!isReloading) {
      this.clearRecovery(chIdStr);
    }

    const channel = await Channel.findById(chIdStr).populate({
      path: 'server',
      select: '+serverPasswordEncrypted'
    });
    if (!channel) {
      throw new Error(`Channel ${chIdStr} not found`);
    }

    // Allocate ZMQ port (wrap within 5600-5999)
    if (this.nextZmqPort > 5999) {
      this.nextZmqPort = 5600;
    }
    const zmqPort = this.nextZmqPort++;

    console.log(`[StreamManager] Initializing stream for channel '${channel.name}' (Port: ${zmqPort})`);

    // Ensure stream is provisioned on Flussonic Media Server before launching encoder (skip delay on reload)
    if (channel.server && !isReloading) {
      let streamKey = sanitizeStreamKey(channel.streamKey || channel.name);
      if (channel.rtmpUrl) {
        const urlMatch = channel.rtmpUrl.match(/\/([^/?#]+)(?:\?.*)?$/);
        if (urlMatch && urlMatch[1]) {
          streamKey = sanitizeStreamKey(urlMatch[1]);
        }
      }
      console.log(`[StreamManager] Pre-provisioning stream '${streamKey}' on Flussonic Media Server...`);
      try {
        const provResult = await createFlussonicStream(channel.server, streamKey, {
          title: channel.name
        });
        console.log(`[StreamManager] Flussonic response: ${provResult.message}`);
      } catch (fErr) {
        console.warn(`[StreamManager] Flussonic pre-start provisioning warning:`, fErr.message);
      }
      // Brief pause to allow Flussonic listener to register before FFmpeg connects
      await new Promise((r) => setTimeout(r, 600));
    }

    // Restore any leftover preScheduleBranding snapshot if a previous schedule was interrupted
    if (channel.branding?.preScheduleBranding) {
      const snap = channel.branding.preScheduleBranding;
      console.log(`[StreamManager] Restoring leftover preScheduleBranding for '${channel.name}':`, snap);
      if (snap.logo?.suppressed && channel.branding.logo) {
        channel.branding.logo.enabled = !!snap.logo.enabled;
      }
      if (channel.branding.ticker) channel.branding.ticker.enabled = !!snap.ticker?.enabled;
      if (channel.branding.bug) channel.branding.bug.enabled = !!snap.bug?.enabled;
      if (channel.branding.ashton) {
        channel.branding.ashton.enabled = !!snap.ashton?.enabled;
        channel.branding.ashton.squeeze = snap.ashton?.squeeze !== false;
      }
      if (channel.branding.lband) channel.branding.lband.enabled = !!snap.lband?.enabled;
      channel.branding.preScheduleBranding = null;
      await Channel.findByIdAndUpdate(chIdStr, {
        $set: {
          ...(snap.logo?.suppressed ? { 'branding.logo.enabled': !!snap.logo.enabled } : {}),
          'branding.ticker.enabled': !!snap.ticker?.enabled,
          'branding.bug.enabled': !!snap.bug?.enabled,
          'branding.ashton.enabled': !!snap.ashton?.enabled,
          'branding.ashton.squeeze': snap.ashton?.squeeze !== false,
          'branding.lband.enabled': !!snap.lband?.enabled,
          'branding.preScheduleBranding': null
        }
      });
    }

    // 1. Launch long-running Encoder process
    const encoder = new EncoderService(channel, zmqPort);
    encoder.onUnexpectedExit = (code) => {
      const activeStream = this.activeStreams.get(chIdStr);
      if (!encoder.isStopping) {
        const pos = activeStream?.feeder?.getCurrentPlaybackPosition
          ? activeStream.feeder.getCurrentPlaybackPosition()
          : { index: startIndex, offsetSeconds: startOffsetSeconds };

        console.warn(
          `[StreamManager] Live encoder for channel '${channel.name}' (${chIdStr}) exited unexpectedly (code ${code}). ` +
          `Auto-recovering live stream...`
        );
        this.scheduleAutoRecovery(chIdStr, pos);
      }
    };

    try {
      await encoder.start();
    } catch (encErr) {
      encoder.stop();
      throw encErr;
    }

    // 2. Launch playlist Feeder process
    const feeder = new FeederService(chIdStr, encoder.process, { startIndex, startOffsetSeconds }, encoder);
    feeder.encoder = encoder;
    feeder.start();

    const streamInstance = {
      channelId: chIdStr,
      channel,
      encoder,
      feeder,
      zmqPort,
      startedAt: new Date(),
      isStopping: false
    };

    this.activeStreams.set(chIdStr, streamInstance);
    this.clearRecovery(chIdStr);

    // Update Channel status in DB
    await Channel.findByIdAndUpdate(chIdStr, { status: CHANNEL_STATUS.LIVE });

    if (io) {
      io.to(`channel:${chIdStr}`).emit('stream_status', {
        channelId: chIdStr,
        status: CHANNEL_STATUS.LIVE,
        zmqPort
      });
    }

    console.log(`[StreamManager] Channel '${channel.name}' is now ON AIR!`);

    // Immediately check if an active ad or schedule should begin airing on air right now
    setTimeout(async () => {
      try {
        const { schedulerService } = await import('./schedulerService.js');
        schedulerService.checkSchedules().catch(() => { });
      } catch { }
    }, 600);

    return streamInstance;
  }

  /**
   * Stop live broadcast for a channel
   */
  async stopStream(channelId, { isReloading = false } = {}) {
    const chIdStr = String(channelId);
    if (isReloading) {
      this.reloadingChannels.add(chIdStr);
    } else {
      this.clearRecovery(chIdStr);
    }

    const stream = this.activeStreams.get(chIdStr);
    if (!stream) {
      if (!isReloading) {
        // Ensure DB status is set to idle
        await Channel.findByIdAndUpdate(chIdStr, {
          status: CHANNEL_STATUS.IDLE,
          currentPlayingIndex: -1
        });
      }
      return false;
    }

    console.log(`[StreamManager] ${isReloading ? 'Pausing for reload' : 'Stopping'} stream for channel ${chIdStr}`);

    stream.isStopping = true;
    if (stream.encoder) stream.encoder.isStopping = true;

    // Stop feeder first so no more MPEG-TS packets are pushed
    if (stream.feeder) {
      stream.feeder.stop();
      if (typeof stream.feeder.flushDbWrites === 'function') {
        await stream.feeder.flushDbWrites(1500);
      }
    }

    // Stop encoder
    if (stream.encoder) {
      stream.encoder.stop();
    }

    this.clearFireTimer(chIdStr, 'lband');
    this.clearFireTimer(chIdStr, 'ashton');
    this.activeStreams.delete(chIdStr);

    // If reloading for live asset updates, maintain LIVE status and do not broadcast IDLE
    if (!isReloading) {
      // Update channel status to idle
      await Channel.findByIdAndUpdate(chIdStr, {
        status: CHANNEL_STATUS.IDLE,
        currentPlayingIndex: -1
      });

      if (io) {
        io.to(`channel:${chIdStr}`).emit('stream_status', {
          channelId: chIdStr,
          status: CHANNEL_STATUS.IDLE
        });
      }
    }

    return true;
  }

  getStream(channelId) {
    return this.activeStreams.get(String(channelId)) || null;
  }

  /**
   * Retrieves complete real-time information about which scheduling and which video
   * is currently playing on the channel.
   */
  getChannelCurrentlyPlaying(channelId) {
    const chIdStr = String(channelId);
    const stream = this.getStream(chIdStr);
    if (!stream || !stream.feeder || !stream.feeder.isRunning) {
      return null;
    }
    const info = stream.feeder.getCurrentlyPlayingInfo();
    const lbandTimer = this.fireTimers.get(`${chIdStr}:lband`);
    const ashtonTimer = this.fireTimers.get(`${chIdStr}:ashton`);

    return {
      channelId: chIdStr,
      channelName: stream.channel?.name,
      startedAt: stream.startedAt,
      zmqPort: stream.zmqPort,
      ...info,
      activeFireTimers: {
        lband: lbandTimer ? {
          active: true,
          duration: lbandTimer.duration,
          expiresAt: lbandTimer.expiresAt,
          remainingSeconds: Math.max(0, Math.ceil((lbandTimer.expiresAt - Date.now()) / 1000))
        } : null,
        ashton: ashtonTimer ? {
          active: true,
          duration: ashtonTimer.duration,
          expiresAt: ashtonTimer.expiresAt,
          remainingSeconds: Math.max(0, Math.ceil((ashtonTimer.expiresAt - Date.now()) / 1000))
        } : null
      }
    };
  }

  /**
   * Checks and triggers priority playout transitions for a channel.
   * Called when playlists are created, updated, saved, or deleted, or during clock ticks.
   */
  async checkChannelPriorityPlayout(channelId) {
    const chIdStr = String(channelId);
    const stream = this.getStream(chIdStr);
    if (stream && stream.feeder && stream.feeder.isRunning) {
      return await stream.feeder.checkPriorityTransition().catch((err) => {
        console.warn(`[StreamManager] Priority transition check error for channel ${chIdStr}:`, err.message);
        return false;
      });
    }
    return false;
  }

  isChannelLive(channelId) {
    return this.activeStreams.has(String(channelId));
  }

  isChannelReloading(channelId) {
    return this.reloadingChannels.has(String(channelId));
  }

  /**
   * Jump an active broadcast immediately to a specific playlist item index.
   */
  async jumpToIndex(channelId, startIndex = 0) {
    const chIdStr = String(channelId);
    const safeIndex = Math.max(0, Number(startIndex) || 0);
    if (!this.activeStreams.has(chIdStr)) {
      return this.startStream(chIdStr, safeIndex);
    }
    console.log(`[StreamManager] Jumping live channel ${chIdStr} to playlist item #${safeIndex + 1}...`);
    this.reloadingChannels.add(chIdStr);
    try {
      await this.stopStream(chIdStr, { isReloading: true });
      await new Promise((r) => setTimeout(r, 200));
      return await this.startStream(chIdStr, safeIndex, { isReloading: true });
    } catch (err) {
      this.reloadingChannels.delete(chIdStr);
      throw err;
    }
  }

  /**
   * Seamlessly restarts the live stream to reload updated branding image assets (lband / ashton / resized logo)
   * Keeps live status active to prevent player reloads or black/green screen flashes
   */
  async restartStream(channelId) {
    const chIdStr = String(channelId);
    const stream = this.activeStreams.get(chIdStr);
    if (!stream) return null;
    const pos = stream.feeder?.getCurrentPlaybackPosition
      ? stream.feeder.getCurrentPlaybackPosition()
      : { index: stream.feeder?.currentIndex || 0, offsetSeconds: 0 };
    console.log(`[StreamManager] Reloading live stream branding assets for channel ${chIdStr} (resuming item ${pos.index} at ${pos.offsetSeconds.toFixed(1)}s)...`);
    this.reloadingChannels.add(chIdStr);
    try {
      await this.stopStream(chIdStr, { isReloading: true });
      await new Promise((r) => setTimeout(r, 300));
      return await this.startStream(chIdStr, pos.index, { isReloading: true, startOffsetSeconds: pos.offsetSeconds });
    } catch (err) {
      this.reloadingChannels.delete(chIdStr);
      throw err;
    }
  }

  /**
   * PM2 Crash Recovery: Resumes all channels that were live before restart
   */
  async recoverActiveChannels() {
    try {
      const liveChannels = await Channel.find({ status: CHANNEL_STATUS.LIVE });
      if (liveChannels.length === 0) return;

      console.log(`[StreamManager PM2 Recovery] Found ${liveChannels.length} channel(s) flagged as live. Resuming...`);

      for (const channel of liveChannels) {
        const resumeIndex = Math.max(0, channel.currentPlayingIndex || 0);
        try {
          await this.startStream(String(channel._id), resumeIndex);
        } catch (startErr) {
          console.warn(`[StreamManager PM2 Recovery] Could not immediately start channel '${channel.name}': ${startErr.message}. Initiating auto-recovery loop...`);
          this.scheduleAutoRecovery(String(channel._id), { index: resumeIndex, offsetSeconds: 0 });
        }
      }
    } catch (err) {
      console.error('[StreamManager Recovery Error]', err);
    }
  }

  /**
   * Instantly fire L-Band for a given duration (default 60s), then automatically close
   */
  async fireLBand(channelId, duration = 60, customImagePath = null, cutout = null) {
    const dur = Math.max(1, Math.min(3600, Number(duration) || 60));
    const channelIdStr = String(channelId);
    console.log(`[StreamManager] 🔥 Quick Fire L-Band triggered for channel ${channelIdStr} (${dur}s duration)`);

    this.clearFireTimer(channelIdStr, 'lband');

    // If custom image path is provided for this specific L-Band schedule
    if (customImagePath) {
      const fullCustomPath = path.resolve(SERVER_ROOT, customImagePath);
      if (fs.existsSync(fullCustomPath)) {
        const channelStreamDir = path.join(STREAMS_DIR, channelIdStr);
        if (!fs.existsSync(channelStreamDir)) {
          fs.mkdirSync(channelStreamDir, { recursive: true });
        }
        const targetLBandFile = path.join(channelStreamDir, 'lband.png');
        try {
          fs.copyFileSync(fullCustomPath, targetLBandFile);
          console.log(`[StreamManager] Applied custom L-Band graphic: ${customImagePath}`);
        } catch (copyErr) {
          console.warn(`[StreamManager] Warning copying custom L-Band file:`, copyErr.message);
        }
      }
    }

    const stream = this.getStream(channelIdStr);
    const channel = await Channel.findById(channelIdStr);
    if (!channel) throw new Error('Channel not found');

    if (!channel.branding) channel.branding = {};
    if (!channel.branding.lband) channel.branding.lband = {};
    channel.branding.lband.enabled = true;

    if (cutout) {
      if (cutout.windowX !== undefined) channel.branding.lband.windowX = Number(cutout.windowX);
      if (cutout.windowY !== undefined) channel.branding.lband.windowY = Number(cutout.windowY);
      if (cutout.windowWidth !== undefined) channel.branding.lband.windowWidth = Number(cutout.windowWidth);
      if (cutout.windowHeight !== undefined) channel.branding.lband.windowHeight = Number(cutout.windowHeight);
    }

    await Channel.findByIdAndUpdate(channelIdStr, {
      $set: {
        'branding.lband.enabled': true,
        ...(cutout
          ? {
              'branding.lband.windowX': channel.branding.lband.windowX,
              'branding.lband.windowY': channel.branding.lband.windowY,
              'branding.lband.windowWidth': channel.branding.lband.windowWidth,
              'branding.lband.windowHeight': channel.branding.lband.windowHeight
            }
          : {})
      }
    });

    if (stream && stream.encoder) {
      if (stream.encoder.channel?.branding?.lband) {
        stream.encoder.channel.branding.lband.enabled = true;
        if (cutout) {
          stream.encoder.channel.branding.lband.windowX = channel.branding.lband.windowX;
          stream.encoder.channel.branding.lband.windowY = channel.branding.lband.windowY;
          stream.encoder.channel.branding.lband.windowWidth = channel.branding.lband.windowWidth;
          stream.encoder.channel.branding.lband.windowHeight = channel.branding.lband.windowHeight;
        }
      }
      try {
        await stream.encoder.setLBandEnabled(true);
      } catch (encErr) {
        console.warn(`[StreamManager] Warning setting L-Band live on encoder:`, encErr.message);
      }
    }

    const expiresAt = Date.now() + dur * 1000;
    const timerId = setTimeout(async () => {
      console.log(`[StreamManager] ⏱️ L-Band ${dur}s duration expired for channel ${channelIdStr}. Closing automatically...`);
      this.fireTimers.delete(`${channelIdStr}:lband`);
      try {
        await Channel.findByIdAndUpdate(channelIdStr, {
          $set: { 'branding.lband.enabled': false }
        });
        const currentStream = this.getStream(channelIdStr);
        if (currentStream && currentStream.encoder) {
          if (currentStream.encoder.channel?.branding?.lband) {
            currentStream.encoder.channel.branding.lband.enabled = false;
          }
          await currentStream.encoder.setLBandEnabled(false);
        }
        if (io) {
          io.to(`channel:${channelIdStr}`).emit('branding_updated', {
            type: 'lband',
            lband: {
              ...channel.branding.lband,
              enabled: false,
              fireActive: false
            }
          });
        }
      } catch (err) {
        console.error(`[StreamManager] Error auto-closing fired L-Band on channel ${channelIdStr}:`, err);
      }
    }, dur * 1000);

    this.fireTimers.set(`${channelIdStr}:lband`, {
      timerId,
      expiresAt,
      duration: dur
    });

    if (io) {
      io.to(`channel:${channelIdStr}`).emit('branding_updated', {
        type: 'lband',
        lband: {
          ...channel.branding.lband,
          enabled: true,
          fireActive: true,
          fireExpiresAt: expiresAt,
          fireDuration: dur
        }
      });
    }

    return {
      success: true,
      fireActive: true,
      duration: dur,
      expiresAt
    };
  }

  /**
   * Cancel active fired L-Band and close immediately
   */
  async cancelFireLBand(channelId) {
    const channelIdStr = String(channelId);
    this.clearFireTimer(channelIdStr, 'lband');

    await Channel.findByIdAndUpdate(channelIdStr, {
      $set: { 'branding.lband.enabled': false }
    });

    const stream = this.getStream(channelIdStr);
    if (stream && stream.encoder) {
      if (stream.encoder.channel?.branding?.lband) {
        stream.encoder.channel.branding.lband.enabled = false;
      }
      await stream.encoder.setLBandEnabled(false);
    }

    if (io) {
      io.to(`channel:${channelIdStr}`).emit('branding_updated', {
        type: 'lband',
        lband: {
          enabled: false,
          fireActive: false
        }
      });
    }

    return { success: true, enabled: false, fireActive: false };
  }

  /**
   * Instantly fire Ashton Band for a given duration (default 60s), then automatically close
   */
  async fireAshton(channelId, duration = 60, squeeze = true, customImagePath = null, customHeight = null) {
    const dur = Math.max(1, Math.min(3600, Number(duration) || 60));
    const channelIdStr = String(channelId);
    console.log(`[StreamManager] 🔥 Quick Fire Ashton Band triggered for channel ${channelIdStr} (${dur}s duration, squeeze: ${squeeze})`);

    this.clearFireTimer(channelIdStr, 'ashton');

    // If custom image path is provided for this specific Ashton Band schedule
    if (customImagePath) {
      const fullCustomPath = path.resolve(SERVER_ROOT, customImagePath);
      if (fs.existsSync(fullCustomPath)) {
        const channelStreamDir = path.join(STREAMS_DIR, channelIdStr);
        if (!fs.existsSync(channelStreamDir)) {
          fs.mkdirSync(channelStreamDir, { recursive: true });
        }
        const targetAshtonFile = path.join(channelStreamDir, 'ashton.png');
        try {
          fs.copyFileSync(fullCustomPath, targetAshtonFile);
          console.log(`[StreamManager] Applied custom Ashton Band graphic: ${customImagePath}`);
        } catch (copyErr) {
          console.warn(`[StreamManager] Warning copying custom Ashton file:`, copyErr.message);
        }
      }
    }

    const stream = this.getStream(channelIdStr);
    const channel = await Channel.findById(channelIdStr);
    if (!channel) throw new Error('Channel not found');

    if (!channel.branding) channel.branding = {};
    if (!channel.branding.ashton) channel.branding.ashton = {};
    channel.branding.ashton.enabled = true;
    channel.branding.ashton.squeeze = !!squeeze;
    if (customHeight) channel.branding.ashton.height = Number(customHeight);

    await Channel.findByIdAndUpdate(channelIdStr, {
      $set: {
        'branding.ashton.enabled': true,
        'branding.ashton.squeeze': !!squeeze,
        ...(customHeight ? { 'branding.ashton.height': Number(customHeight) } : {})
      }
    });

    if (stream && stream.encoder) {
      if (stream.encoder.channel?.branding?.ashton) {
        stream.encoder.channel.branding.ashton.enabled = true;
        stream.encoder.channel.branding.ashton.squeeze = !!squeeze;
        if (customHeight) stream.encoder.channel.branding.ashton.height = Number(customHeight);
      }
      try {
        await stream.encoder.setAshtonLive(true, !!squeeze);
      } catch (encErr) {
        console.warn(`[StreamManager] Warning setting Ashton live on encoder:`, encErr.message);
      }
    }

    const expiresAt = Date.now() + dur * 1000;
    const timerId = setTimeout(async () => {
      console.log(`[StreamManager] ⏱️ Ashton Band ${dur}s duration expired for channel ${channelIdStr}. Closing automatically...`);
      this.fireTimers.delete(`${channelIdStr}:ashton`);
      try {
        await Channel.findByIdAndUpdate(channelIdStr, {
          $set: { 'branding.ashton.enabled': false }
        });
        const currentStream = this.getStream(channelIdStr);
        if (currentStream && currentStream.encoder) {
          if (currentStream.encoder.channel?.branding?.ashton) {
            currentStream.encoder.channel.branding.ashton.enabled = false;
          }
          await currentStream.encoder.setAshtonLive(false, !!squeeze);
        }
        if (io) {
          io.to(`channel:${channelIdStr}`).emit('branding_updated', {
            type: 'ashton',
            ashton: {
              ...channel.branding.ashton,
              enabled: false,
              fireActive: false
            }
          });
        }
      } catch (err) {
        console.error(`[StreamManager] Error auto-closing fired Ashton Band on channel ${channelIdStr}:`, err);
      }
    }, dur * 1000);

    this.fireTimers.set(`${channelIdStr}:ashton`, {
      timerId,
      expiresAt,
      duration: dur
    });

    if (io) {
      io.to(`channel:${channelIdStr}`).emit('branding_updated', {
        type: 'ashton',
        ashton: {
          ...channel.branding.ashton,
          enabled: true,
          squeeze: !!squeeze,
          fireActive: true,
          fireExpiresAt: expiresAt,
          fireDuration: dur
        }
      });
    }

    return {
      success: true,
      fireActive: true,
      duration: dur,
      expiresAt
    };
  }

  /**
   * Cancel active fired Ashton Band and close immediately
   */
  async cancelFireAshton(channelId) {
    const channelIdStr = String(channelId);
    this.clearFireTimer(channelIdStr, 'ashton');

    await Channel.findByIdAndUpdate(channelIdStr, {
      $set: { 'branding.ashton.enabled': false }
    });

    const stream = this.getStream(channelIdStr);
    if (stream && stream.encoder) {
      if (stream.encoder.channel?.branding?.ashton) {
        stream.encoder.channel.branding.ashton.enabled = false;
      }
      await stream.encoder.setAshtonLive(false);
    }

    if (io) {
      io.to(`channel:${channelIdStr}`).emit('branding_updated', {
        type: 'ashton',
        ashton: {
          enabled: false,
          fireActive: false
        }
      });
    }

    return { success: true, enabled: false, fireActive: false };
  }

  clearFireTimer(channelId, type) {
    const key = `${channelId}:${type}`;
    if (this.fireTimers.has(key)) {
      const item = this.fireTimers.get(key);
      clearTimeout(item.timerId);
      this.fireTimers.delete(key);
    }
  }

  getFireStatus(channelId, type) {
    const key = `${channelId}:${type}`;
    if (this.fireTimers.has(key)) {
      const item = this.fireTimers.get(key);
      const remaining = Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000));
      return {
        fireActive: remaining > 0,
        fireExpiresAt: item.expiresAt,
        fireDuration: item.duration,
        fireRemaining: remaining
      };
    }
    return { fireActive: false };
  }

  /**
   * Stop all active channel streams (for graceful shutdown)
   */
  async stopAllStreams() {
    console.log(`[StreamManager] Stopping all ${this.activeStreams.size} active stream(s)...`);
    const channelIds = Array.from(this.activeStreams.keys());
    for (const channelId of channelIds) {
      try {
        await this.stopStream(channelId);
      } catch (err) {
        console.error(`[StreamManager] Error stopping stream ${channelId}:`, err);
      }
    }
  }
}

export const streamManager = new StreamManager();

