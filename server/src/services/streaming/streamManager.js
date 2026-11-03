import { Channel } from '../../models/Channel.js';
import { Playlist } from '../../models/Playlist.js';
import { Server } from '../../models/Server.js';
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
  }

  /**
   * Start live broadcast for a channel
   */
  async startStream(channelId, startIndex = 0, { isReloading = false, startOffsetSeconds = 0 } = {}) {
    if (this.activeStreams.has(channelId)) {
      console.log(`[StreamManager] Channel ${channelId} is already running.`);
      return this.activeStreams.get(channelId);
    }

    const channel = await Channel.findById(channelId).populate({
      path: 'server',
      select: '+serverPasswordEncrypted'
    });
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    // Allocate ZMQ port
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
      await Channel.findByIdAndUpdate(channelId, {
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
      const activeStream = this.activeStreams.get(channelId);
      if (activeStream && !activeStream.isStopping) {
        console.warn(
          `[StreamManager] Live encoder for channel '${channel.name}' (${channelId}) exited unexpectedly (code ${code}). ` +
          `Network connection may have reset. Auto-recovering live stream in 3s...`
        );
        setTimeout(async () => {
          const current = this.activeStreams.get(channelId);
          if (current && !current.isStopping) {
            try {
              await this.restartStream(channelId);
            } catch (rErr) {
              console.error(`[StreamManager] Auto-recovery error for channel ${channelId}:`, rErr.message);
            }
          }
        }, 3000);
      }
    };
    await encoder.start();

    // 2. Launch playlist Feeder process
    const feeder = new FeederService(channelId, encoder.process, { startIndex, startOffsetSeconds }, encoder);
    feeder.encoder = encoder;
    feeder.start();

    const streamInstance = {
      channelId,
      channel,
      encoder,
      feeder,
      zmqPort,
      startedAt: new Date()
    };

    this.activeStreams.set(channelId, streamInstance);

    // Update Channel status in DB
    await Channel.findByIdAndUpdate(channelId, { status: CHANNEL_STATUS.LIVE });

    if (io) {
      io.to(`channel:${channelId}`).emit('stream_status', {
        channelId,
        status: CHANNEL_STATUS.LIVE,
        zmqPort
      });
    }

    console.log(`[StreamManager] Channel '${channel.name}' is now ON AIR!`);

    // Immediately check if an active ad or schedule should begin airing on air right now
    setTimeout(async () => {
      try {
        const { schedulerService } = await import('./schedulerService.js');
        schedulerService.checkSchedules().catch(() => {});
      } catch {}
    }, 600);

    return streamInstance;
  }

  /**
   * Stop live broadcast for a channel
   */
  async stopStream(channelId, { isReloading = false } = {}) {
    const stream = this.activeStreams.get(channelId);
    if (!stream) {
      if (!isReloading) {
        // Ensure DB status is set to idle
        await Channel.findByIdAndUpdate(channelId, {
          status: CHANNEL_STATUS.IDLE,
          currentPlayingIndex: -1
        });
      }
      return false;
    }

    console.log(`[StreamManager] ${isReloading ? 'Pausing for reload' : 'Stopping'} stream for channel ${channelId}`);

    stream.isStopping = true;
    if (stream.encoder) stream.encoder.isStopping = true;

    // Stop feeder first so no more MPEG-TS packets are pushed
    if (stream.feeder) {
      stream.feeder.stop();
    }

    // Stop encoder
    if (stream.encoder) {
      stream.encoder.stop();
    }

    this.clearFireTimer(channelId, 'lband');
    this.clearFireTimer(channelId, 'ashton');
    this.activeStreams.delete(channelId);

    // If reloading for live asset updates, maintain LIVE status and do not broadcast IDLE
    if (!isReloading) {
      // Update channel status to idle
      await Channel.findByIdAndUpdate(channelId, {
        status: CHANNEL_STATUS.IDLE,
        currentPlayingIndex: -1
      });

      if (io) {
        io.to(`channel:${channelId}`).emit('stream_status', {
          channelId,
          status: CHANNEL_STATUS.IDLE
        });
      }
    }

    return true;
  }

  getStream(channelId) {
    return this.activeStreams.get(channelId) || null;
  }

  isChannelLive(channelId) {
    return this.activeStreams.has(channelId);
  }

  /**
   * Seamlessly restarts the live stream to reload updated branding image assets (lband / ashton / resized logo)
   * Keeps live status active to prevent player reloads or black/green screen flashes
   */
  async restartStream(channelId) {
    const stream = this.activeStreams.get(channelId);
    if (!stream) return null;
    const pos = stream.feeder?.getCurrentPlaybackPosition
      ? stream.feeder.getCurrentPlaybackPosition()
      : { index: stream.feeder?.currentIndex || 0, offsetSeconds: 0 };
    console.log(`[StreamManager] Reloading live stream branding assets for channel ${channelId} (resuming item ${pos.index} at ${pos.offsetSeconds.toFixed(1)}s)...`);
    await this.stopStream(channelId, { isReloading: true });
    await new Promise((r) => setTimeout(r, 300));
    return this.startStream(channelId, pos.index, { isReloading: true, startOffsetSeconds: pos.offsetSeconds });
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
        await this.startStream(String(channel._id), resumeIndex);
      }
    } catch (err) {
      console.error('[StreamManager Recovery Error]', err);
    }
  }

  /**
   * Instantly fire L-Band for a given duration (default 60s), then automatically close
   */
  async fireLBand(channelId, duration = 60) {
    const dur = Math.max(5, Math.min(3600, Number(duration) || 60));
    const channelIdStr = String(channelId);
    console.log(`[StreamManager] 🔥 Quick Fire L-Band triggered for channel ${channelIdStr} (${dur}s duration)`);

    this.clearFireTimer(channelIdStr, 'lband');

    const stream = this.getStream(channelIdStr);
    const channel = await Channel.findById(channelIdStr);
    if (!channel) throw new Error('Channel not found');

    if (!channel.branding) channel.branding = {};
    if (!channel.branding.lband) channel.branding.lband = {};
    channel.branding.lband.enabled = true;

    await Channel.findByIdAndUpdate(channelIdStr, {
      $set: { 'branding.lband.enabled': true }
    });

    if (stream && stream.encoder) {
      if (stream.encoder.channel?.branding?.lband) {
        stream.encoder.channel.branding.lband.enabled = true;
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
  async fireAshton(channelId, duration = 60, squeeze = true) {
    const dur = Math.max(5, Math.min(3600, Number(duration) || 60));
    const channelIdStr = String(channelId);
    console.log(`[StreamManager] 🔥 Quick Fire Ashton Band triggered for channel ${channelIdStr} (${dur}s duration, squeeze: ${squeeze})`);

    this.clearFireTimer(channelIdStr, 'ashton');

    const stream = this.getStream(channelIdStr);
    const channel = await Channel.findById(channelIdStr);
    if (!channel) throw new Error('Channel not found');

    if (!channel.branding) channel.branding = {};
    if (!channel.branding.ashton) channel.branding.ashton = {};
    channel.branding.ashton.enabled = true;
    channel.branding.ashton.squeeze = !!squeeze;

    await Channel.findByIdAndUpdate(channelIdStr, {
      $set: {
        'branding.ashton.enabled': true,
        'branding.ashton.squeeze': !!squeeze
      }
    });

    if (stream && stream.encoder) {
      if (stream.encoder.channel?.branding?.ashton) {
        stream.encoder.channel.branding.ashton.enabled = true;
        stream.encoder.channel.branding.ashton.squeeze = !!squeeze;
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

