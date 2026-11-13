import { BandPreset } from '../../models/bandPreset.model.js';

/**
 * Evaluates whether an overlay Schedule is eligible right now based on
 * enabled flag, YYYY-MM-DD date bounds, day of week, and HH:mm:ss time window.
 */
export const isOverlayScheduleActiveNow = (schedule, now = new Date()) => {
  if (!schedule || !schedule.enabled) return false;

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentDayOfWeek = now.getDay();
  const currentSecOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const formatLocalDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  if (schedule.startDate) {
    const startStr = formatLocalDate(schedule.startDate);
    if (startStr && todayStr < startStr) return false;
  }
  if (schedule.endDate) {
    const endStr = formatLocalDate(schedule.endDate);
    if (endStr && todayStr > endStr) return false;
  }

  if (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0) {
    if (!schedule.daysOfWeek.includes(currentDayOfWeek)) return false;
  }

  if (!schedule.dailyStartTime) return false;
  const [sh, sm, ss] = schedule.dailyStartTime.split(':').map(Number);
  const startSec = (sh || 0) * 3600 + (sm || 0) * 60 + (ss || 0);

  let endSec = startSec + 3600;
  if (schedule.dailyEndTime) {
    const [eh, em, es] = schedule.dailyEndTime.split(':').map(Number);
    endSec = (eh || 0) * 3600 + (em || 0) * 60 + (es || 0);
  }

  if (endSec > startSec) {
    return currentSecOfDay >= startSec && currentSecOfDay <= endSec;
  }
  return currentSecOfDay >= startSec || currentSecOfDay <= (endSec % 86400);
};

/**
 * Resolves the ordered list of Band items for a Schedule while preserving
 * exact user-configured ordering and duplicate occurrences.
 */
export const resolveOrderedBandsForSchedule = async (schedule) => {
  if (!schedule) return [];

  const rawIds = Array.isArray(schedule.bandPresets) && schedule.bandPresets.length > 0
    ? schedule.bandPresets.map((item) => (typeof item === 'object' && item?._id ? String(item._id) : String(item))).filter(Boolean)
    : schedule.bandPreset
      ? [typeof schedule.bandPreset === 'object' && schedule.bandPreset?._id ? String(schedule.bandPreset._id) : String(schedule.bandPreset)]
      : [];

  if (rawIds.length > 0) {
    const docs = await BandPreset.find({ _id: { $in: rawIds } }).lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const ordered = rawIds.map((id) => byId.get(id)).filter(Boolean);
    if (ordered.length > 0) {
      return ordered;
    }
  }

  // Fallback for legacy single-image schedule
  if (schedule.imagePath) {
    return [{
      _id: schedule._id,
      title: schedule.title,
      type: schedule.type,
      imagePath: schedule.imagePath,
      duration: Number(schedule.duration) || 10,
      windowX: schedule.windowX ?? 300,
      windowY: schedule.windowY ?? 20,
      windowWidth: schedule.windowWidth ?? 960,
      windowHeight: schedule.windowHeight ?? 540,
      ashtonSqueeze: schedule.ashtonSqueeze !== false,
      ashtonHeight: schedule.ashtonHeight || 160
    }];
  }

  return [];
};

/**
 * Resolves gap duration in seconds for an overlay schedule.
 * Uses explicit gapSeconds when configured, falling back to legacy gapMinutes * 60.
 */
export const getOverlayGapSeconds = (schedule) => {
  if (!schedule) return 0;
  if (schedule.gapSeconds !== undefined && schedule.gapSeconds !== null) {
    return Math.max(0, Number(schedule.gapSeconds) || 0);
  }
  return Math.max(0, (Number(schedule.gapMinutes) || 0) * 60);
};

export const getOverlayGapMs = (schedule) => getOverlayGapSeconds(schedule) * 1000;

