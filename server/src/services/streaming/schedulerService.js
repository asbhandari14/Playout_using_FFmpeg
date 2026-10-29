import { Schedule } from '../../models/Schedule.js';
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

  async checkSchedules() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      if (streamManager.activeStreams.size === 0) {
        this.isChecking = false;
        return;
      }

      const activeChannelIds = Array.from(streamManager.activeStreams.keys());
      const now = new Date();

      // Today's date string in YYYY-MM-DD
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const currentSecOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

      // Find enabled schedules for active channels
      const schedules = await Schedule.find({
        channel: { $in: activeChannelIds },
        enabled: true
      })
        .populate('asset')
        .sort({ priority: -1, createdAt: 1 });

      for (const schedule of schedules) {
        const channelIdStr = String(schedule.channel);
        const stream = streamManager.getStream(channelIdStr);

        if (!stream || !stream.feeder || stream.feeder.isScheduleActive) {
          continue;
        }

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

        // 3. Prevent duplicate execution on the same calendar day
        if (schedule.lastAiredDate === todayStr) {
          continue;
        }

        // 4. Check time window match
        if (!schedule.dailyStartTime) continue;
        const [sh, sm, ss] = schedule.dailyStartTime.split(':').map(Number);
        const startSec = (sh || 0) * 3600 + (sm || 0) * 60 + (ss || 0);

        let isMatch = false;
        if (schedule.dailyEndTime) {
          const [eh, em, es] = schedule.dailyEndTime.split(':').map(Number);
          const endSec = (eh || 0) * 3600 + (em || 0) * 60 + (es || 0);
          
          if (endSec > startSec) {
            // Standard daytime window (e.g. 14:00:00 to 14:30:00)
            isMatch = currentSecOfDay >= startSec && currentSecOfDay < endSec;
          } else {
            // Midnight crossing window (e.g. 23:30:00 to 00:30:00)
            isMatch = currentSecOfDay >= startSec || currentSecOfDay < endSec;
          }
        } else {
          // Point-in-time trigger (0-4s window tolerance)
          const diff = currentSecOfDay - startSec;
          isMatch = diff >= 0 && diff <= 4;
        }

        if (isMatch) {
          console.log(
            `[SchedulerService] Triggering scheduled event "${schedule.title}" for channel ${channelIdStr} (Window: ${schedule.dailyStartTime} -> ${schedule.dailyEndTime || 'completion'})`
          );

          // Mark as aired today immediately to prevent duplicate triggers
          schedule.lastAiredDate = todayStr;
          await schedule.save();

          // Trigger smooth video interruption & resumption on feeder
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

