import path from 'path';
import fs from 'fs';
import { Schedule } from '../models/schedule.model.js';
import { BandPreset } from '../models/bandPreset.model.js';
import { Asset } from '../models/asset.model.js';
import { Channel } from '../models/channel.model.js';
import { SERVER_ROOT } from '../config/paths.js';
import { analyzeAndNormalizeLBand, analyzeAndNormalizeAshton } from '../services/streaming/brandingAssets.js';

// Helper to access Socket.IO without circular dependency on server.js
const getIO = (req) => req?.app?.get('io') || null;

// Dynamic import helper to avoid circular dependency with streamManager / server / channelRoutes
const triggerSchedulerDirect = () => {
  import('../services/streaming/schedulerService.js').then(({ schedulerService }) => {
    schedulerService.checkSchedules().catch((err) => {
      console.warn('[ScheduleController] Direct schedule check error:', err.message);
    });
  }).catch(() => { });
};

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
    const { type } = req.query;

    const query = { channel: channelId };
    if (type) {
      query.type = type;
    }

    const schedules = await Schedule.find(query)
      .populate('bandPreset')
      .populate('assets', 'originalName filePath duration durationFormatted thumbnailPath category')
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
      type = 'video',
      ashtonSqueeze = true,
      assetId,
      assetIds,
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

    const scheduleType = ['video', 'lband', 'ashton'].includes(type) ? type : 'video';
    const rawBandPresetId = req.body.bandPresetId || req.body.bandPreset || null;

    let linkedPreset = null;
    if (rawBandPresetId && (scheduleType === 'lband' || scheduleType === 'ashton')) {
      linkedPreset = await BandPreset.findOne({ _id: rawBandPresetId, channel: channelId });
      if (!linkedPreset) {
        return res.status(404).json({ message: `Selected ${scheduleType === 'lband' ? 'L-Band' : 'Ashton Band'} was not found` });
      }
    }

    let imageRelativePath = linkedPreset?.imagePath || req.body.imagePath || '';
    let detectedCutout = null;
    let detectedAshton = null;

    if (req.file) {
      imageRelativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');
      try {
        if (scheduleType === 'lband') {
          detectedCutout = await analyzeAndNormalizeLBand(req.file.path, null);
        } else if (scheduleType === 'ashton') {
          detectedAshton = await analyzeAndNormalizeAshton(req.file.path, null);
        }
      } catch (analErr) {
        console.warn('[ScheduleController] Graphic analysis warning:', analErr.message);
      }
    }

    if ((scheduleType === 'lband' || scheduleType === 'ashton') && !imageRelativePath) {
      return res.status(400).json({
        message: `Please select an existing ${scheduleType === 'lband' ? 'L-Band' : 'Ashton Band'} or upload a graphic image`
      });
    }

    let finalAssetIds = [];
    let totalAssetDuration = 60;

    if (scheduleType === 'video') {
      if (Array.isArray(assetIds) && assetIds.length > 0) {
        finalAssetIds = assetIds.map(String).filter(Boolean);
      } else if (assetId) {
        finalAssetIds = [String(assetId)];
      }

      if (finalAssetIds.length === 0) {
        return res.status(400).json({ message: 'At least one media asset is required for video schedule' });
      }

      const foundAssets = await Asset.find({ _id: { $in: finalAssetIds } });
      if (!foundAssets || foundAssets.length === 0) {
        return res.status(404).json({ message: 'Selected media assets not found' });
      }

      totalAssetDuration = foundAssets.reduce((sum, a) => sum + (Number(a.duration) || 0), 0) || 60;
    } else {
      totalAssetDuration =
        duration && Number(duration) > 0
          ? Number(duration)
          : (linkedPreset?.duration ? Number(linkedPreset.duration) : 10);
    }

    if (!dailyStartTime) {
      return res.status(400).json({ message: 'Daily air time (HH:mm:ss) is required' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const normalizedTime = normalizeTimeStr(dailyStartTime);
    const normalizedEndTime = dailyEndTime ? normalizeTimeStr(dailyEndTime) : '';
    let finalDuration = duration && Number(duration) > 0 ? Number(duration) : totalAssetDuration;
    if (normalizedEndTime && scheduleType === 'video') {
      const winDur = calcWindowDuration(normalizedTime, normalizedEndTime);
      if (winDur > 0) finalDuration = winDur;
    }

    // Normalize days of week (accept array or comma-separated string from FormData)
    let normalizedDays = [];
    if (typeof daysOfWeek === 'string') {
      try {
        const parsed = JSON.parse(daysOfWeek);
        if (Array.isArray(parsed)) normalizedDays = parsed.map(Number);
      } catch {
        normalizedDays = daysOfWeek.split(',').map((s) => Number(s.trim())).filter((d) => !isNaN(d) && d >= 0 && d <= 6);
      }
    } else if (Array.isArray(daysOfWeek)) {
      normalizedDays = daysOfWeek.map(Number).filter((d) => !isNaN(d) && d >= 0 && d <= 6);
    }

    const hasVal = (v) => v !== undefined && v !== null && String(v).trim() !== '';

    const schedule = new Schedule({
      channel: channelId,
      title: title.trim(),
      type: scheduleType,
      bandPreset: linkedPreset?._id || null,
      imagePath: imageRelativePath,
      scheduleOption: req.body.scheduleOption || (normalizedDays.length > 0 && normalizedDays.length < 7 ? 'weekly' : (startDate || endDate ? 'datewise' : '24/7')),
      gapMinutes: hasVal(req.body.gapMinutes) ? Number(req.body.gapMinutes) : 20,
      ashtonSqueeze: linkedPreset
        ? linkedPreset.ashtonSqueeze !== false
        : (ashtonSqueeze !== false && ashtonSqueeze !== 'false'),
      ashtonHeight: linkedPreset?.ashtonHeight ?? (hasVal(req.body.ashtonHeight) ? Number(req.body.ashtonHeight) : (detectedAshton?.height ?? 160)),
      windowX: linkedPreset?.windowX ?? (hasVal(req.body.windowX) ? Number(req.body.windowX) : (detectedCutout?.windowX ?? 300)),
      windowY: linkedPreset?.windowY ?? (hasVal(req.body.windowY) ? Number(req.body.windowY) : (detectedCutout?.windowY ?? 20)),
      windowWidth: linkedPreset?.windowWidth ?? (hasVal(req.body.windowWidth) ? Number(req.body.windowWidth) : (detectedCutout?.windowWidth ?? 960)),
      windowHeight: linkedPreset?.windowHeight ?? (hasVal(req.body.windowHeight) ? Number(req.body.windowHeight) : (detectedCutout?.windowHeight ?? 540)),
      assets: finalAssetIds,
      asset: finalAssetIds[0] || null,
      dailyStartTime: normalizedTime,
      dailyEndTime: normalizedEndTime,
      duration: finalDuration,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      daysOfWeek: normalizedDays,
      priority: priority !== undefined ? Number(priority) : 1,
      enabled: enabled !== undefined ? (enabled === true || enabled === 'true') : true,
      createdBy: req.user?._id
    });

    await schedule.save();

    // Immediately evaluate scheduler so active ad/schedule begins airing directly without waiting
    triggerSchedulerDirect();

    const populated = await Schedule.findById(schedule._id)
      .populate('bandPreset')
      .populate('assets', 'originalName filePath duration durationFormatted thumbnailPath category')
      .populate('asset', 'originalName filePath duration durationFormatted thumbnailPath category');

    const io = getIO(req);
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
      type,
      ashtonSqueeze,
      assetId,
      assetIds,
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
    if (type !== undefined && ['video', 'lband', 'ashton'].includes(type)) {
      schedule.type = type;
    }
    if (ashtonSqueeze !== undefined) {
      schedule.ashtonSqueeze = ashtonSqueeze !== false && ashtonSqueeze !== 'false';
    }

    const rawBandPresetId = req.body.bandPresetId ?? req.body.bandPreset;
    if (rawBandPresetId !== undefined) {
      if (rawBandPresetId) {
        const linkedPreset = await BandPreset.findOne({ _id: rawBandPresetId, channel: channelId });
        if (!linkedPreset) {
          return res.status(404).json({ message: 'Selected Band preset was not found' });
        }
        schedule.bandPreset = linkedPreset._id;
        schedule.imagePath = linkedPreset.imagePath;
        schedule.duration = linkedPreset.duration;
        schedule.windowX = linkedPreset.windowX;
        schedule.windowY = linkedPreset.windowY;
        schedule.windowWidth = linkedPreset.windowWidth;
        schedule.windowHeight = linkedPreset.windowHeight;
        schedule.ashtonSqueeze = linkedPreset.ashtonSqueeze;
        schedule.ashtonHeight = linkedPreset.ashtonHeight;
      } else {
        schedule.bandPreset = null;
      }
    }

    if (req.file) {
      const relPath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');
      schedule.imagePath = relPath;
      try {
        if (schedule.type === 'lband') {
          const detected = await analyzeAndNormalizeLBand(req.file.path, null);
          if (req.body.windowX === undefined) schedule.windowX = detected.windowX;
          if (req.body.windowY === undefined) schedule.windowY = detected.windowY;
          if (req.body.windowWidth === undefined) schedule.windowWidth = detected.windowWidth;
          if (req.body.windowHeight === undefined) schedule.windowHeight = detected.windowHeight;
        } else if (schedule.type === 'ashton') {
          const detected = await analyzeAndNormalizeAshton(req.file.path, null);
          if (req.body.ashtonHeight === undefined) schedule.ashtonHeight = detected.height;
        }
      } catch (err) {
        console.warn('[ScheduleController] Graphic analysis error on update:', err.message);
      }
    } else if (req.body.imagePath) {
      schedule.imagePath = req.body.imagePath;
    }

    if (req.body.scheduleOption) schedule.scheduleOption = req.body.scheduleOption;
    if (req.body.gapMinutes !== undefined && req.body.gapMinutes !== '') schedule.gapMinutes = Number(req.body.gapMinutes);
    if (req.body.ashtonHeight !== undefined && req.body.ashtonHeight !== '') schedule.ashtonHeight = Number(req.body.ashtonHeight);
    if (req.body.windowX !== undefined && req.body.windowX !== '') schedule.windowX = Number(req.body.windowX);
    if (req.body.windowY !== undefined && req.body.windowY !== '') schedule.windowY = Number(req.body.windowY);
    if (req.body.windowWidth !== undefined && req.body.windowWidth !== '') schedule.windowWidth = Number(req.body.windowWidth);
    if (req.body.windowHeight !== undefined && req.body.windowHeight !== '') schedule.windowHeight = Number(req.body.windowHeight);

    if (assetIds !== undefined || assetId !== undefined) {
      let finalAssetIds = [];
      if (Array.isArray(assetIds) && assetIds.length > 0) {
        finalAssetIds = assetIds.map(String).filter(Boolean);
      } else if (assetId) {
        finalAssetIds = [String(assetId)];
      }

      if (finalAssetIds.length > 0) {
        const foundAssets = await Asset.find({ _id: { $in: finalAssetIds } });
        if (foundAssets && foundAssets.length > 0) {
          schedule.assets = finalAssetIds;
          schedule.asset = finalAssetIds[0];
          const totalDur = foundAssets.reduce((sum, a) => sum + (Number(a.duration) || 0), 0);
          if (!duration && !schedule.dailyEndTime) {
            schedule.duration = totalDur || 60;
          }
        }
      }
    }

    if (dailyStartTime !== undefined) schedule.dailyStartTime = normalizeTimeStr(dailyStartTime);
    if (dailyEndTime !== undefined) {
      schedule.dailyEndTime = dailyEndTime ? normalizeTimeStr(dailyEndTime) : '';
    }
    if (schedule.type === 'video' && schedule.dailyStartTime && schedule.dailyEndTime) {
      const winDur = calcWindowDuration(schedule.dailyStartTime, schedule.dailyEndTime);
      if (winDur > 0) schedule.duration = winDur;
    } else if (duration !== undefined && duration !== '') {
      schedule.duration = Number(duration);
    }
    if (startDate !== undefined) schedule.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) schedule.endDate = endDate ? new Date(endDate) : null;
    if (daysOfWeek !== undefined) {
      if (typeof daysOfWeek === 'string') {
        try {
          const parsed = JSON.parse(daysOfWeek);
          if (Array.isArray(parsed)) schedule.daysOfWeek = parsed.map(Number);
        } catch {
          schedule.daysOfWeek = daysOfWeek.split(',').map((s) => Number(s.trim())).filter((d) => !isNaN(d) && d >= 0 && d <= 6);
        }
      } else if (Array.isArray(daysOfWeek)) {
        schedule.daysOfWeek = daysOfWeek.map(Number).filter((d) => !isNaN(d) && d >= 0 && d <= 6);
      }
    }
    if (priority !== undefined) schedule.priority = Number(priority);
    if (enabled !== undefined) schedule.enabled = enabled === true || enabled === 'true';

    // Reset lastAiredDate so updated schedule is eligible to air immediately
    schedule.lastAiredDate = '';

    await schedule.save();

    // Immediately evaluate scheduler so active ad/schedule begins airing directly without waiting
    triggerSchedulerDirect();

    const populated = await Schedule.findById(schedule._id)
      .populate('bandPreset')
      .populate('assets', 'originalName filePath duration durationFormatted thumbnailPath category')
      .populate('asset', 'originalName filePath duration durationFormatted thumbnailPath category');

    const io = getIO(req);
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

    // Immediately evaluate scheduler so active ad/schedule begins airing directly without waiting
    triggerSchedulerDirect();

    const populated = await Schedule.findById(schedule._id)
      .populate('bandPreset')
      .populate('assets', 'originalName filePath duration durationFormatted thumbnailPath category')
      .populate('asset', 'originalName filePath duration durationFormatted thumbnailPath category');

    const io = getIO(req);
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

    const io = getIO(req);
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

// POST /api/channels/:channelId/schedules/:scheduleId/play-now
// Trigger scheduled ad or video immediately live on air on demand
export const playScheduleNow = async (req, res, next) => {
  try {
    const { channelId, scheduleId } = req.params;
    const schedule = await Schedule.findOne({ _id: scheduleId, channel: channelId })
      .populate('bandPreset')
      .populate('assets')
      .populate('asset');

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    const { streamManager } = await import('../services/streaming/streamManager.js');
    const stream = streamManager.getStream(channelId);
    if (!stream || !stream.feeder) {
      return res.status(400).json({
        message: 'Channel is currently offline. Please start live broadcast first.'
      });
    }

    const preset = schedule.bandPreset;
    if (schedule.type === 'lband') {
      const dur = Number(preset?.duration || schedule.duration) || 10;
      const imgPath = preset?.imagePath || schedule.imagePath;
      await streamManager.fireLBand(channelId, dur, imgPath, {
        windowX: preset?.windowX ?? schedule.windowX,
        windowY: preset?.windowY ?? schedule.windowY,
        windowWidth: preset?.windowWidth ?? schedule.windowWidth,
        windowHeight: preset?.windowHeight ?? schedule.windowHeight
      });
      return res.status(200).json({
        success: true,
        message: `L-Band graphic "${schedule.title}" fired live on air for ${dur}s!`
      });
    } else if (schedule.type === 'ashton') {
      const dur = Number(preset?.duration || schedule.duration) || 10;
      const squeeze = preset ? preset.ashtonSqueeze !== false : schedule.ashtonSqueeze !== false;
      const imgPath = preset?.imagePath || schedule.imagePath;
      const height = preset?.ashtonHeight ?? schedule.ashtonHeight;
      await streamManager.fireAshton(channelId, dur, squeeze, imgPath, height);
      return res.status(200).json({
        success: true,
        message: `Ashton Band "${schedule.title}" fired live on air for ${dur}s!`
      });
    } else {
      // Direct video / ad playback
      schedule.lastAiredDate = '';
      await schedule.save();

      const started = await stream.feeder.interruptWithSchedule(schedule);
      if (!started) {
        return res.status(400).json({
          message: 'A schedule or ad is already actively playing on air.'
        });
      }

      return res.status(200).json({
        success: true,
        message: `Schedule "${schedule.title}" is now playing live on air!`
      });
    }
  } catch (error) {
    next(error);
  }
};

