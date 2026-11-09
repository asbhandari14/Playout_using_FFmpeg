import { Schedule } from '../../models/schedule.model.js';
import { streamManager } from './streamManager.js';

class SchedulerService {
  constructor() {
    this.intervalId = null;
    this.isChecking = false;
  }

  start() {
    if (this.intervalId) return;
    console.log('[SchedulerService] Starting Playout Schedule Clock Service (1s tick)...');
    this.intervalId = setInterval(() => {
      this.checkSchedules().catch((err) => {
        console.error('[SchedulerService] Error checking schedules:', err);
      });
    }, 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SchedulerService] Stopped Playout Schedule Clock Service.');
    }
  }

  /**
   * Checks whether an active schedule exists right now for a given channel.
   * Evaluates date range, day of week, time window, and remaining duration.
   * Used for startup gate (when coming online) and real-time clock evaluations.
   */
  async getActiveScheduleForChannel(channelId, now = new Date()) {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentSecOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    const schedules = await Schedule.find({
      channel: channelId,
      enabled: true
    })
      .populate('assets')
      .populate('asset')
      .sort({ priority: -1, createdAt: 1 });

    for (const schedule of schedules) {
      // 1. Verify Date Range (Optional startDate and endDate)
      if (schedule.startDate) {
        const start = new Date(schedule.startDate);
        start.setHours(0, 0, 0, 0);
        if (now < start) continue;
      }

      if (schedule.endDate) {
        const end = new Date(schedule.endDate);
        end.setHours(23, 59, 59, 999);
        if (now > end) continue;
      }

      // 2. Verify Day of Week (empty means all days)
      if (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0) {
        if (!schedule.daysOfWeek.includes(currentDayOfWeek)) {
          continue;
        }
      }

      // 3. Time Window matching
      if (!schedule.dailyStartTime) continue;
      const [sh, sm, ss] = schedule.dailyStartTime.split(':').map(Number);
      const startSec = (sh || 0) * 3600 + (sm || 0) * 60 + (ss || 0);

      let endSec;
      if (schedule.dailyEndTime) {
        const [eh, em, es] = schedule.dailyEndTime.split(':').map(Number);
        endSec = (eh || 0) * 3600 + (em || 0) * 60 + (es || 0);
      } else {
        const dur =
          (Number(schedule.duration) > 0 ? Number(schedule.duration) : 0) ||
          (Array.isArray(schedule.assets) && schedule.assets.length > 0
            ? schedule.assets.reduce((sum, a) => sum + (Number(a?.duration) || 0), 0)
            : Number(schedule.asset?.duration) || 60);
        endSec = startSec + Math.max(10, Math.round(dur));
      }

      let isMatch = false;
      if (endSec > startSec) {
        isMatch = currentSecOfDay >= startSec && currentSecOfDay < endSec;
      } else {
        isMatch = currentSecOfDay >= startSec || currentSecOfDay < (endSec % 86400);
      }

      if (!isMatch) continue;

      if (schedule.lastAiredDate === todayStr) {
        const windowEnded = endSec > startSec
          ? currentSecOfDay >= endSec
          : (currentSecOfDay >= endSec && currentSecOfDay < startSec);
        if (windowEnded) continue;
      }

      return schedule;
    }

    return null;
  }

  /**
   * Check and fire all active L-Band and Ashton Band overlay schedules for a channel.
   * Supports 24/7, weekly, datewise, and repeat gap intervals.
   */
  async checkOverlaySchedules(channelIdStr, now = new Date()) {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentDayOfWeek = now.getDay();
    const currentSecOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    const overlaySchedules = await Schedule.find({
      channel: channelIdStr,
      enabled: true,
      type: { $in: ['lband', 'ashton'] }
    });

    for (const schedule of overlaySchedules) {
      // 1. Date range (for datewise)
      if (schedule.scheduleOption === 'datewise' || schedule.startDate || schedule.endDate) {
        if (schedule.startDate) {
          const start = new Date(schedule.startDate);
          start.setHours(0, 0, 0, 0);
          if (now < start) continue;
        }
        if (schedule.endDate) {
          const end = new Date(schedule.endDate);
          end.setHours(23, 59, 59, 999);
          if (now > end) continue;
        }
      }

      // 2. Day of week (for weekly)
      if (schedule.scheduleOption === 'weekly' || (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0)) {
        if (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0) {
          if (!schedule.daysOfWeek.includes(currentDayOfWeek)) continue;
        }
      }

      // 3. Time Window
      if (!schedule.dailyStartTime) continue;
      const [sh, sm, ss] = schedule.dailyStartTime.split(':').map(Number);
      const startSec = (sh || 0) * 3600 + (sm || 0) * 60 + (ss || 0);

      let endSec = startSec + 3600;
      if (schedule.dailyEndTime) {
        const [eh, em, es] = schedule.dailyEndTime.split(':').map(Number);
        endSec = (eh || 0) * 3600 + (em || 0) * 60 + (es || 0);
      }

      let inWindow = false;
      if (endSec > startSec) {
        inWindow = currentSecOfDay >= startSec && currentSecOfDay <= endSec;
      } else {
        inWindow = currentSecOfDay >= startSec || currentSecOfDay <= (endSec % 86400);
      }

      if (!inWindow) continue;

      // 4. Interval / Gap checking
      const gapMinutes = Number(schedule.gapMinutes) || 0;
      const gapMs = gapMinutes * 60 * 1000;

      if (schedule.lastFiredAt) {
        const elapsedMs = now.getTime() - new Date(schedule.lastFiredAt).getTime();
        if (gapMs > 0) {
          if (elapsedMs < gapMs) {
            continue; // Wait for gap interval
          }
        } else {
          // If no gap specified, only fire once per day/window
          if (schedule.lastAiredDate === todayStr) continue;
        }
      }

      // 5. Fire the overlay schedule!
      schedule.lastFiredAt = now;
      schedule.lastAiredDate = todayStr;
      await schedule.save();

      const dur = Number(schedule.duration) || 5;

      if (schedule.type === 'lband') {
        console.log(`[SchedulerService] ⚡ Firing scheduled L-Band "${schedule.title}" (${dur}s duration, gap: ${gapMinutes}m) on channel ${channelIdStr}`);
        streamManager.fireLBand(channelIdStr, dur, schedule.imagePath, {
          windowX: schedule.windowX,
          windowY: schedule.windowY,
          windowWidth: schedule.windowWidth,
          windowHeight: schedule.windowHeight
        }).catch((err) => {
          console.error(`[SchedulerService] Error triggering L-Band schedule '${schedule.title}':`, err);
        });
      } else if (schedule.type === 'ashton') {
        const squeeze = schedule.ashtonSqueeze !== false;
        console.log(`[SchedulerService] ⚡ Firing scheduled Ashton Band "${schedule.title}" (${dur}s duration, squeeze: ${squeeze}, gap: ${gapMinutes}m) on channel ${channelIdStr}`);
        streamManager.fireAshton(channelIdStr, dur, squeeze, schedule.imagePath, schedule.ashtonHeight).catch((err) => {
          console.error(`[SchedulerService] Error triggering Ashton schedule '${schedule.title}':`, err);
        });
      }
    }
  }

  async checkSchedules() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      if (streamManager.activeStreams.size === 0) {
        return;
      }

      const activeChannelIds = Array.from(streamManager.activeStreams.keys());
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      for (const channelIdStr of activeChannelIds) {
        const stream = streamManager.getStream(channelIdStr);
        if (!stream || !stream.feeder) continue;

        // Check priority-based playlist transitions on the 1-second clock tick
        stream.feeder.checkPriorityTransition().catch(() => { });

        // Check and trigger all dynamic L-Band and Ashton Band overlay schedules with repeat intervals
        this.checkOverlaySchedules(channelIdStr, now).catch((err) => {
          console.error(`[SchedulerService] Error checking overlay schedules for channel ${channelIdStr}:`, err);
        });

        // Check video interrupt schedules
        const schedule = await this.getActiveScheduleForChannel(channelIdStr, now);
        if (!schedule) continue;

        if (schedule.type === 'video') {
          if (stream.feeder.isScheduleActive) {
            continue;
          }

          console.log(
            `[SchedulerService] Triggering scheduled video/ad "${schedule.title}" for channel ${channelIdStr} (Window: ${schedule.dailyStartTime} -> ${schedule.dailyEndTime || 'completion'})`
          );

          stream.feeder
            .interruptWithSchedule(schedule)
            .catch((err) => {
              console.error(`[SchedulerService] Execution error on schedule '${schedule.title}':`, err);
            });
        }
      }
    } finally {
      this.isChecking = false;
    }
  }
}

export const schedulerService = new SchedulerService();
