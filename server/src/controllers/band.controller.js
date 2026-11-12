import path from 'path';
import fs from 'fs';
import { BandPreset } from '../models/bandPreset.model.js';
import { Schedule } from '../models/schedule.model.js';
import { Channel } from '../models/channel.model.js';
import { SERVER_ROOT } from '../config/paths.js';
import { analyzeAndNormalizeLBand, analyzeAndNormalizeAshton } from '../services/streaming/brandingAssets.js';

const getIO = (req) => req?.app?.get('io') || null;

const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== '';

const toEven = (num, fallback) => {
  const n = Number(num);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return rounded - (rounded % 2);
};

const normalizeLBandWindow = (raw = {}, fallback = {}) => {
  const baseX = hasValue(raw.windowX) ? raw.windowX : (fallback.windowX ?? 300);
  const baseY = hasValue(raw.windowY) ? raw.windowY : (fallback.windowY ?? 20);
  const baseW = hasValue(raw.windowWidth) ? raw.windowWidth : (fallback.windowWidth ?? 960);
  const baseH = hasValue(raw.windowHeight) ? raw.windowHeight : (fallback.windowHeight ?? 540);

  let windowX = Math.max(0, Math.min(1216, toEven(baseX, 300)));
  let windowY = Math.max(0, Math.min(656, toEven(baseY, 20)));
  let windowWidth = Math.max(64, Math.min(1280 - windowX, toEven(baseW, 960)));
  let windowHeight = Math.max(64, Math.min(720 - windowY, toEven(baseH, 540)));

  return { windowX, windowY, windowWidth, windowHeight };
};

const unlinkIfUnused = async (relPath) => {
  if (!relPath) return;
  const [presetCount, scheduleCount] = await Promise.all([
    BandPreset.countDocuments({ imagePath: relPath }),
    Schedule.countDocuments({ imagePath: relPath })
  ]);
  if (presetCount > 0 || scheduleCount > 0) return;

  const fullPath = path.resolve(SERVER_ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (err) {
      console.warn('[BandController] Failed to unlink old band asset:', err.message);
    }
  }
};

// GET /api/v1/channels/:channelId/bands
export const getBands = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { type } = req.query;

    const query = { channel: channelId };
    if (type && ['lband', 'ashton'].includes(type)) {
      query.type = type;
    }

    const bands = await BandPreset.find(query).sort({ createdAt: -1 });
    return res.status(200).json(bands);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/channels/:channelId/bands
export const createBand = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { title, type = 'lband', duration, ashtonSqueeze = true } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Band title is required' });
    }

    const bandType = type === 'ashton' ? 'ashton' : 'lband';
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    let imagePath = req.body.imagePath || '';
    let detectedLBand = null;
    let detectedAshton = null;

    if (req.file) {
      imagePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');
      try {
        if (bandType === 'lband') {
          detectedLBand = await analyzeAndNormalizeLBand(req.file.path, null);
        } else {
          detectedAshton = await analyzeAndNormalizeAshton(req.file.path, null);
        }
      } catch (err) {
        console.warn('[BandController] Graphic analysis warning:', err.message);
      }
    }

    if (!imagePath) {
      return res.status(400).json({ message: `Please upload an image for this ${bandType === 'lband' ? 'L-Band' : 'Ashton Band'}` });
    }

    const lbandWindow = normalizeLBandWindow(req.body, detectedLBand || {});
    const rawAshtonH = hasValue(req.body.ashtonHeight)
      ? req.body.ashtonHeight
      : (detectedAshton?.height ?? 160);
    const ashtonHeight = Math.max(60, Math.min(400, toEven(rawAshtonH, 160)));

    const band = new BandPreset({
      channel: channelId,
      type: bandType,
      title: title.trim(),
      imagePath,
      duration: Math.max(1, Number(duration) || 10),
      ...lbandWindow,
      ashtonSqueeze: ashtonSqueeze !== false && ashtonSqueeze !== 'false',
      ashtonHeight,
      createdBy: req.user?._id
    });

    await band.save();

    const io = getIO(req);
    if (io) {
      io.to(`channel:${channelId}`).emit('bands_updated', { action: 'created', band });
    }

    return res.status(201).json({
      message: `${bandType === 'lband' ? 'L-Band' : 'Ashton Band'} created successfully`,
      band
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/channels/:channelId/bands/:bandId
export const updateBand = async (req, res, next) => {
  try {
    const { channelId, bandId } = req.params;
    const band = await BandPreset.findOne({ _id: bandId, channel: channelId });
    if (!band) {
      return res.status(404).json({ message: 'Band preset not found' });
    }

    const previousImagePath = band.imagePath;
    let detectedLBand = null;
    let detectedAshton = null;

    if (req.file) {
      band.imagePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');
      try {
        if (band.type === 'lband') {
          detectedLBand = await analyzeAndNormalizeLBand(req.file.path, null);
        } else {
          detectedAshton = await analyzeAndNormalizeAshton(req.file.path, null);
        }
      } catch (err) {
        console.warn('[BandController] Graphic analysis warning on update:', err.message);
      }
    } else if (hasValue(req.body.imagePath)) {
      band.imagePath = req.body.imagePath;
    }

    if (hasValue(req.body.title)) band.title = req.body.title.trim();
    if (hasValue(req.body.duration)) band.duration = Math.max(1, Number(req.body.duration) || band.duration);

    if (band.type === 'lband') {
      const updatedWin = normalizeLBandWindow(req.body, detectedLBand || {
        windowX: band.windowX,
        windowY: band.windowY,
        windowWidth: band.windowWidth,
        windowHeight: band.windowHeight
      });
      band.windowX = updatedWin.windowX;
      band.windowY = updatedWin.windowY;
      band.windowWidth = updatedWin.windowWidth;
      band.windowHeight = updatedWin.windowHeight;
    } else {
      if (req.body.ashtonSqueeze !== undefined) {
        band.ashtonSqueeze = req.body.ashtonSqueeze !== false && req.body.ashtonSqueeze !== 'false';
      }
      if (hasValue(req.body.ashtonHeight) || detectedAshton?.height) {
        const rawH = hasValue(req.body.ashtonHeight) ? req.body.ashtonHeight : detectedAshton.height;
        band.ashtonHeight = Math.max(60, Math.min(400, toEven(rawH, band.ashtonHeight)));
      }
    }

    await band.save();

    // Keep linked schedules synced with updated preset graphic, duration, and window dimensions
    await Schedule.updateMany(
      { channel: channelId, bandPreset: band._id },
      {
        $set: {
          imagePath: band.imagePath,
          duration: band.duration,
          windowX: band.windowX,
          windowY: band.windowY,
          windowWidth: band.windowWidth,
          windowHeight: band.windowHeight,
          ashtonSqueeze: band.ashtonSqueeze,
          ashtonHeight: band.ashtonHeight
        }
      }
    );

    if (req.file && previousImagePath && previousImagePath !== band.imagePath) {
      await unlinkIfUnused(previousImagePath);
    }

    const io = getIO(req);
    if (io) {
      io.to(`channel:${channelId}`).emit('bands_updated', { action: 'updated', band });
    }

    return res.status(200).json({
      message: `${band.type === 'lband' ? 'L-Band' : 'Ashton Band'} updated successfully`,
      band
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/channels/:channelId/bands/:bandId
export const deleteBand = async (req, res, next) => {
  try {
    const { channelId, bandId } = req.params;
    const deleted = await BandPreset.findOneAndDelete({ _id: bandId, channel: channelId });
    if (!deleted) {
      return res.status(404).json({ message: 'Band preset not found' });
    }

    await Schedule.updateMany(
      { channel: channelId, bandPreset: bandId },
      { $set: { bandPreset: null } }
    );

    await unlinkIfUnused(deleted.imagePath);

    const io = getIO(req);
    if (io) {
      io.to(`channel:${channelId}`).emit('bands_updated', { action: 'deleted', bandId });
    }

    return res.status(200).json({
      message: `${deleted.type === 'lband' ? 'L-Band' : 'Ashton Band'} deleted successfully`,
      bandId
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/channels/:channelId/bands/:bandId/play-now
export const fireBandNow = async (req, res, next) => {
  try {
    const { channelId, bandId } = req.params;
    const band = await BandPreset.findOne({ _id: bandId, channel: channelId });
    if (!band) {
      return res.status(404).json({ message: 'Band preset not found' });
    }

    const { streamManager } = await import('../services/streaming/streamManager.js');
    const stream = streamManager.getStream(channelId);
    if (!stream || !stream.feeder) {
      return res.status(400).json({
        message: 'Channel is currently offline. Please start live broadcast first.'
      });
    }

    const dur = Math.max(1, Number(band.duration) || 10);
    if (band.type === 'lband') {
      await streamManager.fireLBand(channelId, dur, band.imagePath, {
        windowX: band.windowX,
        windowY: band.windowY,
        windowWidth: band.windowWidth,
        windowHeight: band.windowHeight
      });
      return res.status(200).json({
        success: true,
        message: `L-Band "${band.title}" fired live on air for ${dur}s!`
      });
    }

    await streamManager.fireAshton(
      channelId,
      dur,
      band.ashtonSqueeze !== false,
      band.imagePath,
      band.ashtonHeight
    );
    return res.status(200).json({
      success: true,
      message: `Ashton Band "${band.title}" fired live on air for ${dur}s!`
    });
  } catch (error) {
    next(error);
  }
};

