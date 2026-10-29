import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Playlist } from '../../models/Playlist.js';
import { Channel } from '../../models/Channel.js';
import { io } from '../../server.js';
import { SERVER_ROOT } from '../../config/paths.js';
import { PLAYLIST_ITEM_STATUS } from '../../config/constants.js';

export class FeederService {
  constructor(channelId, encoderProcess, options = {}) {
    this.channelId = channelId;
    this.encoderProcess = encoderProcess;
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
   * Spawns decoder ffmpeg to normalize asset and stream MPEG-TS directly to encoder stdin
   */
  streamAsset(videoPath, _duration, maxDuration = 0) {
    return new Promise((resolve) => {
      if (!this.isRunning || !this.encoderProcess?.stdin?.writable) {
        return resolve();
      }

      const startOffset = Math.max(0, this.startOffsetSeconds || 0);
      this.startOffsetSeconds = 0; // reset after initial resume
      this.currentAssetStartTime = Date.now();
      this.currentAssetDuration = _duration;
      this.currentOffsetAtStart = startOffset;

      // Decoder process arguments
      // Normalizes to 1280x720, 25fps, AAC, outputs mpegts on stdout
      const decoderArgs = [
        '-re', // Real-time native pacing
        ...(startOffset > 0 ? ['-ss', String(startOffset)] : []),
        '-i', videoPath,
        ...(maxDuration > 0 ? ['-t', String(maxDuration)] : []),
        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=25',
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

    const asset = schedule.asset;
    if (!asset || !asset.filePath) {
      console.warn(`[Feeder:${this.channelId}] Scheduled event '${schedule.title}' has no valid asset.`);
      return false;
    }

    const scheduleAssetPath = path.resolve(SERVER_ROOT, asset.filePath);
    if (!fs.existsSync(scheduleAssetPath)) {
      console.warn(`[Feeder:${this.channelId}] Scheduled asset missing on disk: ${scheduleAssetPath}`);
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
      `[Feeder:${this.channelId}] >>> PAUSING PLAYLIST ITEM #${this.interruptedState.index + 1} AT ${this.interruptedState.offsetSeconds.toFixed(1)}s FOR SCHEDULE: "${schedule.title}" <<<`
    );

    // 2. Kill current regular decoder so it immediately stops streaming regular frames
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
        assetId: asset._id,
        assetName: asset.originalName,
        duration: schedule.duration || asset.duration,
        dailyStartTime: schedule.dailyStartTime,
        dailyEndTime: schedule.dailyEndTime || '',
        pausedAtOffset: this.interruptedState.offsetSeconds,
        pausedItemIndex: this.interruptedState.index
      });
    }

    // 4. Stream scheduled asset directly into the persistent encoder stdin
    // If dailyEndTime is provided, stream until the wall-clock reaches dailyEndTime (looping asset if needed)
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
        `[Feeder:${this.channelId}] Schedule window active until ${schedule.dailyEndTime} (${Math.round((targetEndTime - Date.now()) / 1000)}s total)`
      );
    } else if (schedule.duration && Number(schedule.duration) > 0) {
      targetEndTime = Date.now() + Number(schedule.duration) * 1000;
    } else {
      targetEndTime = Date.now() + (Number(asset.duration) || 60) * 1000;
    }

    try {
      while (this.isRunning && this.isScheduleActive && Date.now() < targetEndTime) {
        const remainingSeconds = Math.max(0.5, (targetEndTime - Date.now()) / 1000);
        await this.streamAsset(scheduleAssetPath, asset.duration, remainingSeconds);

        // If scheduled block has more time remaining, brief pause before looping asset
        if (this.isRunning && this.isScheduleActive && Date.now() < targetEndTime - 1000) {
          console.log(
            `[Feeder:${this.channelId}] Looping scheduled asset until window ends at ${schedule.dailyEndTime || 'duration'}...`
          );
          await new Promise((r) => setTimeout(r, 150));
        } else {
          break;
        }
      }
    } catch (err) {
      console.error(`[Feeder:${this.channelId}] Error streaming scheduled video:`, err);
    }

    // 5. Scheduled asset has completed!
    console.log(
      `[Feeder:${this.channelId}] >>> SCHEDULE "${schedule.title}" COMPLETE. RESUMING PAUSED VIDEO AT ${this.interruptedState.offsetSeconds.toFixed(1)}s <<<`
    );

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
