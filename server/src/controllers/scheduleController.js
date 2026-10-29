import { Schedule } from '../models/Schedule.js';
import { Asset } from '../models/Asset.js';
import { Channel } from '../models/Channel.js';
import { io } from '../server.js';

// Helper to normalize HH:mm to HH:mm:ss
const normalizeTimeStr = (timeStr) => {
  if (!timeStr) return '00:00:00';
  const parts = String(timeStr).trim().split(':');
  const h = String(parts[0] || '0').padStart(2, '0');
  const m = String(parts[1] || '0').padStart(2, '0');
  const s = String(parts[2] || '0').padStart(2, '0');
  return `${h}:${m}:${s}`;
};

// Calculate window duration between HH:mm:ss start and end
export const calcWindowDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const [sh, sm, ss] = startTime.split(':').map(Number);
  const [eh, em, es] = endTime.split(':').map(Number);
  const startSec = (sh || 0) * 3600 + (sm || 0) * 60 + (ss || 0);
  const endSec = (eh || 0) * 3600 + (em || 0) * 60 + (es || 0);
  if (endSec >= startSec) {
    return endSec - startSec;
  }
  // Midnight wraparound (e.g. 23:45:00 to 00:15:00)
  return 86400 - startSec + endSec;
};

// GET /api/channels/:channelId/schedules
export const getSchedules = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const schedules = await Schedule.find({ channel: channelId })
      .populate('asset', 'originalName filePath duration durationFormatted thumbnailPath category')
      .sort({ dailyStartTime: 1, createdAt: 1 });

    return res.status(200).json(schedules);
  } catch (error) {
    next(error);
  }
};

// POST /api/channels/:channelId/schedules
export const createSchedule = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const {
      title,
      assetId,
      dailyStartTime,
      dailyEndTime,
      duration,
      startDate,
      endDate,
      daysOfWeek,
      priority,
      enabled
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Schedule title is required' });
    }
    if (!assetId) {
      return res.status(400).json({ message: 'Media asset is required for schedule' });
    }
    if (!dailyStartTime) {
      return res.status(400).json({ message: 'Daily air time (HH:mm:ss) is required' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const normalizedTime = normalizeTimeStr(dailyStartTime);
    const normalizedEndTime = dailyEndTime ? normalizeTimeStr(dailyEndTime) : '';
    let finalDuration = duration && Number(duration) > 0 ? Number(duration) : Number(asset.duration) || 60;
    if (normalizedEndTime) {
      const winDur = calcWindowDuration(normalizedTime, normalizedEndTime);
      if (winDur > 0) finalDuration = winDur;
    }

    // Normalize days of week
    let normalizedDays = [];
    if (Array.isArray(daysOfWeek)) {
      normalizedDays = daysOfWeek.map(Number).filter((d) => !isNaN(d) && d >= 0 && d <= 6);
    }

    const schedule = new Schedule({
      channel: channelId,
      title: title.trim(),
      asset: assetId,
      dailyStartTime: normalizedTime,
      dailyEndTime: normalizedEndTime,
      duration: finalDuration,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      daysOfWeek: normalizedDays,
      priority: priority !== undefined ? Number(priority) : 1,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      createdBy: req.user?._id
    });

    await schedule.save();

    const populated = await Schedule.findById(schedule._id).populate(
      'asset',
      'originalName filePath duration durationFormatted thumbnailPath category'
    );

    if (io) {
      io.to(`channel:${channelId}`).emit('schedules_updated', {
        action: 'created',
        schedule: populated
      });
    }

    return res.status(201).json({
      message: 'Schedule created successfully',
      schedule: populated
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/channels/:channelId/schedules/:scheduleId
export const updateSchedule = async (req, res, next) => {
  try {
    const { channelId, scheduleId } = req.params;
    const {
      title,
      assetId,
      dailyStartTime,
      dailyEndTime,
      duration,
      startDate,
      endDate,
      daysOfWeek,
      priority,
      enabled
    } = req.body;

    const schedule = await Schedule.findOne({ _id: scheduleId, channel: channelId });
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    if (title !== undefined) schedule.title = title.trim();
    if (assetId !== undefined) {
      const asset = await Asset.findById(assetId);
      if (!asset) return res.status(404).json({ message: 'Asset not found' });
      schedule.asset = assetId;
      if (!duration) schedule.duration = Number(asset.duration) || 60;
    }
    if (dailyStartTime !== undefined) schedule.dailyStartTime = normalizeTimeStr(dailyStartTime);
    if (dailyEndTime !== undefined) {
      schedule.dailyEndTime = dailyEndTime ? normalizeTimeStr(dailyEndTime) : '';
    }
    if (schedule.dailyStartTime && schedule.dailyEndTime) {
      const winDur = calcWindowDuration(schedule.dailyStartTime, schedule.dailyEndTime);
      if (winDur > 0) schedule.duration = winDur;
    } else if (duration !== undefined) {
      schedule.duration = Number(duration);
    }
    if (startDate !== undefined) schedule.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) schedule.endDate = endDate ? new Date(endDate) : null;
    if (daysOfWeek !== undefined && Array.isArray(daysOfWeek)) {
      schedule.daysOfWeek = daysOfWeek.map(Number).filter((d) => !isNaN(d) && d >= 0 && d <= 6);
    }
    if (priority !== undefined) schedule.priority = Number(priority);
    if (enabled !== undefined) schedule.enabled = Boolean(enabled);

    await schedule.save();

    const populated = await Schedule.findById(schedule._id).populate(
      'asset',
      'originalName filePath duration durationFormatted thumbnailPath category'
    );

    if (io) {
      io.to(`channel:${channelId}`).emit('schedules_updated', {
        action: 'updated',
        schedule: populated
      });
    }

    return res.status(200).json({
      message: 'Schedule updated successfully',
      schedule: populated
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/channels/:channelId/schedules/:scheduleId/toggle
export const toggleSchedule = async (req, res, next) => {
  try {
    const { channelId, scheduleId } = req.params;
    const schedule = await Schedule.findOne({ _id: scheduleId, channel: channelId });
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    schedule.enabled = !schedule.enabled;
    await schedule.save();

    const populated = await Schedule.findById(schedule._id).populate(
      'asset',
      'originalName filePath duration durationFormatted thumbnailPath category'
    );

    if (io) {
      io.to(`channel:${channelId}`).emit('schedules_updated', {
        action: 'toggled',
        schedule: populated
      });
    }

    return res.status(200).json({
      message: `Schedule ${schedule.enabled ? 'enabled' : 'disabled'} successfully`,
      schedule: populated
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/channels/:channelId/schedules/:scheduleId
export const deleteSchedule = async (req, res, next) => {
  try {
    const { channelId, scheduleId } = req.params;
    const deleted = await Schedule.findOneAndDelete({ _id: scheduleId, channel: channelId });
    if (!deleted) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('schedules_updated', {
        action: 'deleted',
        scheduleId
      });
    }

    return res.status(200).json({
      message: 'Schedule deleted successfully',
      scheduleId
    });
  } catch (error) {
    next(error);
  }
};

