import fs from 'fs';
import path from 'path';
import { Channel } from '../models/channel.model.js';
import { io } from '../server.js';
import { STREAMS_DIR, SERVER_ROOT } from '../config/paths.js';
import { streamManager } from '../services/streaming/streamManager.js';
import {
  renderTickerImage,
  normalizeAndTrimLogo,
  scaleAndSaveLogo,
  clearStreamBrandingFile,
  analyzeAndNormalizeLBand,
  analyzeAndNormalizeAshton
} from '../services/streaming/brandingAssets.js';
import { probeVideo, generateMovBugPreview } from '../utils/media.js';
import { calculateChannelStorage, validateStorageAvailability } from '../services/channel.service.js';

const bugPreviewInFlight = new Map();

const unlinkRelativeAsset = (relPath, excludeAbs = '') => {
  if (!relPath) return false;
  const fullPath = path.resolve(SERVER_ROOT, relPath);
  if (excludeAbs && fullPath === excludeAbs) return false;
  if (!fs.existsSync(fullPath)) return false;
  try {
    fs.unlinkSync(fullPath);
    return true;
  } catch (e) {
    console.warn('[Branding] Failed to unlink branding asset:', e.message);
    return false;
  }
};

const createRelativeMovBugPreview = async (movAbsPath, duration = 0) => {
  if (!movAbsPath || !fs.existsSync(movAbsPath)) return '';
  let resolvedDuration = Number(duration) || 0;
  if (!resolvedDuration) {
    try {
      const meta = await probeVideo(movAbsPath);
      resolvedDuration = meta.duration || 0;
    } catch { }
  }
  const parsed = path.parse(movAbsPath);
  const generated = await generateMovBugPreview(
    movAbsPath,
    path.join(parsed.dir, parsed.name),
    resolvedDuration
  );
  return generated ? path.relative(SERVER_ROOT, generated).replace(/\\/g, '/') : '';
};

// PUT /api/channels/:channelId/logo
export const updateLogoBranding = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    if(!channelId){
      return res.status(404).json({
        success: false,
        message: "Channel Id not found"
      })
    }
    const { assetPath, enabled, position, sizePercent, marginX, marginY, showDuringSchedule } = req.body || {};

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const previousLogo = channel.branding?.logo || {};
    const previousSize = Number(previousLogo.sizePercent ?? 10);
    const requestedSize = sizePercent !== undefined ? Number(sizePercent) : undefined;
    const sizeActuallyChanged = requestedSize !== undefined && requestedSize !== previousSize;

    const updateFields = {};
    if (assetPath !== undefined) updateFields['branding.logo.assetPath'] = assetPath;
    if (enabled !== undefined) updateFields['branding.logo.enabled'] = !!enabled;
    if (position !== undefined) updateFields['branding.logo.position'] = position;
    if (sizePercent !== undefined) updateFields['branding.logo.sizePercent'] = Number(sizePercent);
    if (marginX !== undefined) updateFields['branding.logo.marginX'] = Number(marginX);
    if (marginY !== undefined) updateFields['branding.logo.marginY'] = Number(marginY);
    if (showDuringSchedule !== undefined) updateFields['branding.logo.showDuringSchedule'] = !!showDuringSchedule;

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    if (!updatedChannel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const currentLogo = updatedChannel.branding?.logo || {};

    // If stream is offline, pre-scale logo image on disk for next cold start
    const stream = streamManager.getStream(channelId);
    const masterPathRel = currentLogo.assetPath || previousLogo.assetPath;
    let scaledInfo = null;
    if (!stream?.encoder?.isRunning && (sizeActuallyChanged || assetPath !== undefined) && masterPathRel) {
      const fullMasterPath = path.resolve(SERVER_ROOT, masterPathRel);
      if (fs.existsSync(fullMasterPath)) {
        const channelStreamDir = path.join(STREAMS_DIR, String(channelId));
        if (!fs.existsSync(channelStreamDir)) {
          fs.mkdirSync(channelStreamDir, { recursive: true });
        }
        const targetLogoFile = path.join(channelStreamDir, 'logo.png');
        const resolution = channel.outputSettings?.resolution || '1280x720';
        const canvasHeight = channel.outputSettings?.height || 720;
        const targetSize = currentLogo.sizePercent !== undefined ? currentLogo.sizePercent : 10;

        scaledInfo = await scaleAndSaveLogo(fullMasterPath, targetLogoFile, {
          resolution,
          canvasHeight,
          sizePercent: targetSize
        });
        console.log(`[Branding] Offline logo pre-scaled to ${scaledInfo.width}x${scaledInfo.height}px (size: ${targetSize}%) for channel ${channelId}`);
      }
    }

    // LIVE STREAM CONTROL: instant live ZMQ commands with ZERO stream restarts
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel) {
        if (!stream.encoder.channel.branding) stream.encoder.channel.branding = {};
        stream.encoder.channel.branding.logo = {
          ...stream.encoder.channel.branding.logo,
          ...currentLogo
        };
      }

      if (sizeActuallyChanged) {
        scaledInfo = await stream.encoder.setLogoSize(currentLogo.sizePercent, { reposition: false });
      }

      // Check if a schedule is currently actively broadcasting
      if (stream.feeder?.isScheduleActive) {
        const allowOnSchedule = currentLogo.showDuringSchedule !== false;

        // If enabled state or showDuringSchedule was modified while schedule is active, keep pending restore state updated
        if (stream.feeder.scheduleBrandingSnapshot?.logo) {
          if (enabled !== undefined) {
            stream.feeder.scheduleBrandingSnapshot.logo.enabled = !!enabled;
          }
          stream.feeder.scheduleBrandingSnapshot.logo.suppressed = !allowOnSchedule && Boolean(currentLogo.enabled);
          await Channel.findByIdAndUpdate(channelId, {
            $set: {
              'branding.preScheduleBranding.logo.enabled': stream.feeder.scheduleBrandingSnapshot.logo.enabled,
              'branding.preScheduleBranding.logo.suppressed': stream.feeder.scheduleBrandingSnapshot.logo.suppressed
            }
          });
        }

        if (allowOnSchedule && currentLogo.enabled) {
          await stream.encoder.setLogoPosition(
            currentLogo.position,
            currentLogo.marginX,
            currentLogo.marginY
          );
        } else {
          // If not permitted during schedule or disabled, ensure logo is off-screen
          await stream.encoder.setLogoEnabled(false);
        }
      } else {
        if (currentLogo.enabled) {
          await stream.encoder.setLogoPosition(
            currentLogo.position,
            currentLogo.marginX,
            currentLogo.marginY
          );
        } else {
          await stream.encoder.setLogoEnabled(false);
        }
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'logo',
        logo: currentLogo
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: sizeActuallyChanged
        ? `Logo resized to ${currentLogo.sizePercent}% (${scaledInfo ? scaledInfo.height + 'px' : ''})`
        : 'Logo branding settings updated on air via ZMQ',
      logo: currentLogo
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/channels/:channelId/logo
export const removeLogo = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    unlinkRelativeAsset(channel.branding?.logo?.assetPath);

    // Reset active stream logo.png to a 1x1 transparent PNG so running FFmpeg stays safe
    const targetLogoFile = path.join(STREAMS_DIR, String(channelId), 'logo.png');
    clearStreamBrandingFile(targetLogoFile);

    const updateSet = {
      'branding.logo.assetPath': '',
      'branding.logo.enabled': false
    };
    if (channel.branding?.preScheduleBranding?.logo) {
      updateSet['branding.preScheduleBranding.logo.enabled'] = false;
      updateSet['branding.preScheduleBranding.logo.suppressed'] = false;
    }

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: updateSet },
      { new: true }
    );

    const currentLogo = updatedChannel?.branding?.logo || { assetPath: '', enabled: false };

    // LIVE ZMQ CONTROL: Disable logo overlay and clear in-memory branding without restart
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel?.branding?.logo) {
        stream.encoder.channel.branding.logo.assetPath = '';
        stream.encoder.channel.branding.logo.enabled = false;
      }
      stream.encoder.logoAspectRatio = 1.0;
      if (stream.feeder?.scheduleBrandingSnapshot?.logo) {
        stream.feeder.scheduleBrandingSnapshot.logo.enabled = false;
        stream.feeder.scheduleBrandingSnapshot.logo.suppressed = false;
      }
      await stream.encoder.setLogoEnabled(false);
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'logo',
        logo: currentLogo
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: 'Logo deleted successfully',
      logo: currentLogo
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/channels/:channelId/logo/upload
export const uploadLogoFile = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    // Validate channelId and file presence
    if(!channelId) {
      return res.status(400).json({ message: 'Channel ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No logo image file provided' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // ==========================================================================================================================================
    //    01.   Validate storage quota ( Check whether the user have enough storage to store the uploaded logo )
    // ==========================================================================================================================================
    const storageValidation = await validateStorageAvailability(channelId, req.file.size);
    if (!storageValidation.allowed) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: storageValidation.message });
    }


    // ==========================================================================================================================================
    //    02.   Use normalizeAndTrimLogo function ( to automatically inspect uploaded logo, crop outer transparent padding to keep only actual visible logo content )
    // ==========================================================================================================================================
    const trimResult = await normalizeAndTrimLogo(req.file.path);
    const relativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');

    // ==========================================================================================================================================
    // 2. Prepare target logo.png in channel stream directory with resolution-appropriate sizing:
    // If resolution is 1280x720 -> height 70px
    // If resolution is 1920x1080 -> height 100px
    // ==========================================================================================================================================
    const channelStreamDir = path.join(STREAMS_DIR, String(channelId));
    if (!fs.existsSync(channelStreamDir)) {
      fs.mkdirSync(channelStreamDir, { recursive: true });
    }
    const targetLogoFile = path.join(channelStreamDir, 'logo.png');

    const resolution = channel.outputSettings?.resolution || '1280x720';
    const canvasHeight = channel.outputSettings?.height || 720;
    const defaultSizePercent = 10;

    const scaled = await scaleAndSaveLogo(req.file.path, targetLogoFile, {
      resolution,
      canvasHeight,
      sizePercent: defaultSizePercent
    });

    // Clean up previous logo file from disk if it exists
    unlinkRelativeAsset(channel.branding?.logo?.assetPath, path.resolve(req.file.path));

    // ==========================================================================================================================================
    //    04.  Update channel branding in database
    // ==========================================================================================================================================
    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $set: {
          'branding.logo.assetPath': relativePath,
          'branding.logo.enabled': true,
          'branding.logo.sizePercent': defaultSizePercent
        }
      },
      { new: true }
    );

    const currentLogo = updatedChannel?.branding?.logo || {};

    // ==========================================================================================================================================
    //    05. LIVE STREAM CONTROL:
    //        Push new logo directly to the live FFmpeg overlay via ZMQ with ZERO stream restarts!
    // ==========================================================================================================================================
    const stream = streamManager.getStream(channelId);
    console.log("stream value", stream);
    if (stream?.encoder?.isRunning) {
      console.log(
        `[Branding] Channel ${channelId} is live on air. Dynamically updating logo overlay on air via ZMQ (${scaled.width}x${scaled.height}px, zero stream restart)...`
      );

      // Keep in-memory encoder branding synchronized
      if (stream.encoder.channel) {
        if (!stream.encoder.channel.branding) stream.encoder.channel.branding = {};
        stream.encoder.channel.branding.logo = {
          ...stream.encoder.channel.branding.logo,
          ...currentLogo
        };
      }

      // Update aspect ratio cache based on the newly scaled logo dimensions
      if (scaled.width && scaled.height) {
        stream.encoder.logoAspectRatio = scaled.width / scaled.height;
      }

      // If feeder has a schedule currently broadcasting, respect schedule branding suppression
      if (stream.feeder?.isScheduleActive) {
        const allowOnSchedule = currentLogo.showDuringSchedule !== false;
        if (stream.feeder.scheduleBrandingSnapshot?.logo) {
          stream.feeder.scheduleBrandingSnapshot.logo.enabled = true;
          stream.feeder.scheduleBrandingSnapshot.logo.suppressed = !allowOnSchedule;
          await Channel.findByIdAndUpdate(channelId, {
            $set: {
              'branding.preScheduleBranding.logo.enabled': true,
              'branding.preScheduleBranding.logo.suppressed': !allowOnSchedule
            }
          });
        }

        if (allowOnSchedule) {
          await stream.encoder.setLogoSize(currentLogo.sizePercent || defaultSizePercent);
          await stream.encoder.setLogoPosition(
            currentLogo.position || 'top-right',
            currentLogo.marginX !== undefined ? currentLogo.marginX : 2,
            currentLogo.marginY !== undefined ? currentLogo.marginY : 2
          );
          await stream.encoder.setLogoEnabled(true);
        } else {
          await stream.encoder.setLogoEnabled(false);
        }
      } else {
        // Normal live playback: dynamically resize and position logo via ZMQ on the fly
        await stream.encoder.setLogoSize(currentLogo.sizePercent || defaultSizePercent);
        await stream.encoder.setLogoPosition(
          currentLogo.position || 'top-right',
          currentLogo.marginX !== undefined ? currentLogo.marginX : 2,
          currentLogo.marginY !== undefined ? currentLogo.marginY : 2
        );
        await stream.encoder.setLogoEnabled(true);
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'logo',
        logo: currentLogo
      });
    }

    const resLabel = resolution.toLowerCase().includes('1080') || canvasHeight >= 1080 ? '1080p' : '720p';
    const message = trimResult.trimmed
      ? `Logo trimmed & scaled to ${scaled.width}x${scaled.height}px for ${resLabel} (${scaled.height}px height, transparent padding removed)`
      : `Logo uploaded & scaled to ${scaled.width}x${scaled.height}px for ${resLabel}`;

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message,
      logo: currentLogo,
      dimensions: {
        originalWidth: trimResult.originalWidth,
        originalHeight: trimResult.originalHeight,
        trimmedWidth: trimResult.width,
        trimmedHeight: trimResult.height,
        scaledWidth: scaled.width,
        scaledHeight: scaled.height,
        resolution
      }
    });
  } catch (error) {
    console.error('[Branding Controller] uploadLogoFile error:', error);
    next(error);
  }
};

// PUT /api/channels/:channelId/bug
export const updateBugBranding = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const {
      assetPath,
      enabled,
      position,
      positionX,
      positionY,
      sizePercent,
      marginX,
      marginY
    } = req.body || {};

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const previousBug = channel.branding?.bug || {};
    const previousSize = Number(previousBug.sizePercent ?? 8);
    const requestedSize = sizePercent !== undefined ? Number(sizePercent) : undefined;
    const sizeActuallyChanged = requestedSize !== undefined && requestedSize !== previousSize;

    const updateFields = {};
    if (assetPath !== undefined) updateFields['branding.bug.assetPath'] = assetPath;
    if (enabled !== undefined) updateFields['branding.bug.enabled'] = !!enabled;
    if (position !== undefined) updateFields['branding.bug.position'] = position;
    if (positionX !== undefined) updateFields['branding.bug.positionX'] = Number(positionX);
    if (positionY !== undefined) updateFields['branding.bug.positionY'] = Number(positionY);
    if (sizePercent !== undefined) updateFields['branding.bug.sizePercent'] = Number(sizePercent);
    if (marginX !== undefined) updateFields['branding.bug.marginX'] = Number(marginX);
    if (marginY !== undefined) updateFields['branding.bug.marginY'] = Number(marginY);

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    if (!updatedChannel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const currentBug = updatedChannel.branding?.bug || {};

    // LIVE STREAM CONTROL: instant live ZMQ commands with ZERO stream restarts
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel) {
        if (!stream.encoder.channel.branding) stream.encoder.channel.branding = {};
        stream.encoder.channel.branding.bug = {
          ...stream.encoder.channel.branding.bug,
          ...currentBug
        };
      }

      if (sizeActuallyChanged) {
        console.log(`[Branding] Dynamic live bug resize to ${currentBug.sizePercent}% via ZMQ...`);
        await stream.encoder.setBugSize(currentBug.sizePercent, { reposition: false });
      }

      if (stream.feeder?.isScheduleActive && stream.feeder.scheduleBrandingSnapshot) {
        if (enabled !== undefined) {
          stream.feeder.scheduleBrandingSnapshot.bug.enabled = !!enabled;
          await Channel.findByIdAndUpdate(channelId, {
            $set: { 'branding.preScheduleBranding.bug.enabled': !!enabled }
          });
        }
        // Keep bug suppressed on air while schedule is active
        await stream.encoder.setBugEnabled(false);
      } else if (currentBug.enabled) {
        await stream.encoder.setBugPosition(currentBug);
      } else {
        await stream.encoder.setBugEnabled(false);
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'bug',
        bug: currentBug
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: sizeActuallyChanged
        ? `Bug resized to ${currentBug.sizePercent}%`
        : 'Bug branding settings updated on air via ZMQ',
      bug: currentBug
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/channels/:channelId/bug
export const removeBug = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Delete stored bug asset and any generated browser preview (.webm/.png) from disk
    unlinkRelativeAsset(channel.branding?.bug?.assetPath);
    unlinkRelativeAsset(channel.branding?.bug?.previewPath);

    // Reset active stream bug.png to a 1x1 transparent PNG so running FFmpeg stays safe
    const channelStreamDir = path.join(STREAMS_DIR, String(channelId));
    clearStreamBrandingFile(path.join(channelStreamDir, 'bug.png'));

    const stream = streamManager.getStream(channelId);
    const encoderUsingMov = Boolean(stream?.encoder?.isRunning && stream.encoder.isBugMov);
    if (!encoderUsingMov) {
      const streamMovFile = path.join(channelStreamDir, 'bug.mov');
      if (fs.existsSync(streamMovFile)) {
        try {
          fs.unlinkSync(streamMovFile);
        } catch (e) {
          console.warn('[Branding] Failed to unlink stream bug.mov:', e.message);
        }
      }
    }

    const updateSet = {
      'branding.bug.assetPath': '',
      'branding.bug.previewPath': '',
      'branding.bug.enabled': false,
      'branding.bug.isMov': false,
      'branding.bug.isGif': false
    };
    if (channel.branding?.preScheduleBranding?.bug) {
      updateSet['branding.preScheduleBranding.bug.enabled'] = false;
      updateSet['branding.preScheduleBranding.bug.suppressed'] = false;
    }

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: updateSet },
      { new: true }
    );

    const currentBug = updatedChannel?.branding?.bug || {
      assetPath: '',
      previewPath: '',
      enabled: false,
      isMov: false,
      isGif: false
    };

    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel?.branding?.bug) {
        stream.encoder.channel.branding.bug.assetPath = '';
        stream.encoder.channel.branding.bug.previewPath = '';
        stream.encoder.channel.branding.bug.enabled = false;
        stream.encoder.channel.branding.bug.isMov = false;
        stream.encoder.channel.branding.bug.isGif = false;
      }
      stream.encoder.bugAspectRatio = 1.0;
      if (stream.feeder?.scheduleBrandingSnapshot?.bug) {
        stream.feeder.scheduleBrandingSnapshot.bug.enabled = false;
        stream.feeder.scheduleBrandingSnapshot.bug.suppressed = false;
      }
      await stream.encoder.setBugEnabled(false);
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'bug',
        bug: currentBug
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: 'Station bug deleted successfully',
      bug: currentBug
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/channels/:channelId/bug/upload
export const uploadBugFile = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No bug file provided' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Validate storage quota
    const storageValidation = await validateStorageAvailability(channelId, req.file.size);
    if (!storageValidation.allowed) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: storageValidation.message });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.png' && ext !== '.mov') {
      return res.status(400).json({
        message: 'Invalid file format. Station Bug supports PNG (.png) and QuickTime MOV (.mov) files only.'
      });
    }

    const isMov = ext === '.mov';
    const relativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');

    const channelStreamDir = path.join(STREAMS_DIR, String(channelId));
    if (!fs.existsSync(channelStreamDir)) {
      fs.mkdirSync(channelStreamDir, { recursive: true });
    }

    const defaultSizePercent = 8;
    const resolution = channel.outputSettings?.resolution || '1280x720';
    const canvasHeight = channel.outputSettings?.height || 720;

    const stream = streamManager.getStream(channelId);
    const encoderRunning = Boolean(stream?.encoder?.isRunning);
    const encoderUsingMov = Boolean(stream?.encoder?.isBugMov);
    const requiresEncoderRestart = encoderRunning && (encoderUsingMov !== isMov || isMov);

    let targetBugFile;
    let scaledWidth = 80;
    let scaledHeight = 60;
    let movDuration = 0;
    let previewRelativePath = '';

    if (isMov) {
      // QuickTime MOV: skip writing over an active FFmpeg-locked bug.mov; restartStream copies and reloads it safely
      targetBugFile = path.join(channelStreamDir, 'bug.mov');
      if (!requiresEncoderRestart) {
        fs.copyFileSync(req.file.path, targetBugFile);
      }

      try {
        const meta = await probeVideo(req.file.path);
        scaledWidth = meta.width || 80;
        scaledHeight = meta.height || 60;
        movDuration = meta.duration || 0;
      } catch (pErr) {
        console.warn('[Branding] Warning probing MOV bug dimensions:', pErr.message);
      }

      try {
        previewRelativePath = await createRelativeMovBugPreview(req.file.path, movDuration);
      } catch (prevErr) {
        console.warn('[Branding] Warning generating MOV bug browser preview:', prevErr.message);
      }
    } else {
      // Static PNG image: trim transparent borders and pre-scale
      await normalizeAndTrimLogo(req.file.path);
      targetBugFile = path.join(channelStreamDir, 'bug.png');
      const scaled = await scaleAndSaveLogo(req.file.path, targetBugFile, {
        resolution,
        canvasHeight,
        sizePercent: defaultSizePercent
      });
      scaledWidth = scaled.width;
      scaledHeight = scaled.height;
    }

    // Clean up previous bug file and preview file from disk if they exist
    unlinkRelativeAsset(channel.branding?.bug?.assetPath, path.resolve(req.file.path));
    unlinkRelativeAsset(
      channel.branding?.bug?.previewPath,
      previewRelativePath ? path.resolve(SERVER_ROOT, previewRelativePath) : ''
    );

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $set: {
          'branding.bug.assetPath': relativePath,
          'branding.bug.previewPath': previewRelativePath,
          'branding.bug.enabled': true,
          'branding.bug.sizePercent': defaultSizePercent,
          'branding.bug.isMov': isMov,
          'branding.bug.isGif': false
        }
      },
      { new: true }
    );

    const currentBug = updatedChannel?.branding?.bug || {};

    // LIVE STREAM CONTROL: switch FFmpeg bug input when format changes (PNG <-> MOV) or MOV is replaced; otherwise update PNG via ZMQ
    if (requiresEncoderRestart) {
      console.log(`[Branding] Channel ${channelId} is live on air. Restarting encoder to switch bug source (${isMov ? 'MOV' : 'PNG'})...`);
      await streamManager.restartStream(channelId);
      if (!isMov) {
        const staleStreamMov = path.join(channelStreamDir, 'bug.mov');
        if (fs.existsSync(staleStreamMov)) {
          try {
            fs.unlinkSync(staleStreamMov);
          } catch (e) {
            console.warn('[Branding] Failed to unlink stale stream bug.mov:', e.message);
          }
        }
      }
    } else if (encoderRunning) {
      console.log(`[Branding] Channel ${channelId} is live on air. Dynamically updating station bug overlay via ZMQ (zero restart)...`);
      if (stream.encoder.channel) {
        if (!stream.encoder.channel.branding) stream.encoder.channel.branding = {};
        stream.encoder.channel.branding.bug = {
          ...stream.encoder.channel.branding.bug,
          ...currentBug
        };
      }
      if (scaledWidth && scaledHeight) {
        stream.encoder.bugAspectRatio = scaledWidth / scaledHeight;
      }
      if (stream.feeder?.isScheduleActive && stream.feeder.scheduleBrandingSnapshot) {
        if (stream.feeder.scheduleBrandingSnapshot.bug) {
          stream.feeder.scheduleBrandingSnapshot.bug.enabled = true;
        }
        await Channel.findByIdAndUpdate(channelId, {
          $set: { 'branding.preScheduleBranding.bug.enabled': true }
        });
        await stream.encoder.setBugSize(currentBug.sizePercent || defaultSizePercent, { reposition: false });
        await stream.encoder.setBugEnabled(false);
      } else {
        await stream.encoder.setBugSize(currentBug.sizePercent || defaultSizePercent);
        await stream.encoder.setBugPosition(currentBug);
        await stream.encoder.setBugEnabled(true);
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'bug',
        bug: currentBug
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: isMov
        ? 'Station Bug QuickTime MOV uploaded & pushed live on air'
        : 'Station Bug PNG image uploaded & pushed live on air',
      bug: currentBug,
      dimensions: {
        width: scaledWidth,
        height: scaledHeight,
        isMov
      }
    });
  } catch (error) {
    console.error('[Branding Controller] uploadBugFile error:', error);
    next(error);
  }
};

// POST /api/channels/:channelId/bug/preview
export const ensureBugPreview = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const chIdStr = String(channelId);
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const currentBug = channel.branding?.bug || {};
    const assetPath = currentBug.assetPath || '';
    const isMov = Boolean(currentBug.isMov || String(assetPath).toLowerCase().endsWith('.mov'));
    if (!assetPath || !isMov) {
      return res.status(200).json({ bug: currentBug });
    }

    if (currentBug.previewPath) {
      const existingPreviewAbs = path.resolve(SERVER_ROOT, currentBug.previewPath);
      if (fs.existsSync(existingPreviewAbs)) {
        return res.status(200).json({ bug: currentBug });
      }
    }

    let pending = bugPreviewInFlight.get(chIdStr);
    if (!pending) {
      pending = (async () => {
        const assetAbs = path.resolve(SERVER_ROOT, assetPath);
        const streamBugAbs = path.join(STREAMS_DIR, chIdStr, 'bug.mov');
        const sourceMov = fs.existsSync(assetAbs) ? assetAbs : (fs.existsSync(streamBugAbs) ? streamBugAbs : '');
        const previewRel = await createRelativeMovBugPreview(sourceMov);
        if (!previewRel) return currentBug;

        const updated = await Channel.findOneAndUpdate(
          { _id: channelId, 'branding.bug.assetPath': assetPath },
          { $set: { 'branding.bug.previewPath': previewRel } },
          { new: true }
        );
        if (!updated) {
          unlinkRelativeAsset(previewRel);
          return {};
        }
        const updatedBug = updated.branding?.bug || { ...currentBug, previewPath: previewRel };
        if (io) {
          io.to(`channel:${channelId}`).emit('branding_updated', {
            type: 'bug',
            bug: updatedBug
          });
        }
        return updatedBug;
      })().finally(() => {
        bugPreviewInFlight.delete(chIdStr);
      });
      bugPreviewInFlight.set(chIdStr, pending);
    }

    const resolvedBug = await pending;
    return res.status(200).json({ bug: resolvedBug });
  } catch (error) {
    next(error);
  }
};

// PUT /api/channels/:channelId/ticker
export const updateTickerBranding = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const {
      text,
      bgColor,
      textColor,
      fontFamily,
      fontSize,
      width,
      paddingY,
      marginBottom,
      alignment,
      speed,
      enabled
    } = req.body || {};

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const updateFields = {};
    if (text !== undefined) updateFields['branding.ticker.text'] = text;
    if (bgColor !== undefined) updateFields['branding.ticker.bgColor'] = bgColor;
    if (textColor !== undefined) updateFields['branding.ticker.textColor'] = textColor;
    if (fontFamily !== undefined) updateFields['branding.ticker.fontFamily'] = fontFamily;
    if (fontSize !== undefined) updateFields['branding.ticker.fontSize'] = Number(fontSize);
    if (width !== undefined) updateFields['branding.ticker.width'] = Number(width);
    if (paddingY !== undefined) updateFields['branding.ticker.paddingY'] = Number(paddingY);
    if (marginBottom !== undefined) updateFields['branding.ticker.marginBottom'] = Number(marginBottom);
    if (alignment !== undefined) updateFields['branding.ticker.alignment'] = alignment;
    if (speed !== undefined) updateFields['branding.ticker.speed'] = Number(speed);
    if (enabled !== undefined) updateFields['branding.ticker.enabled'] = Boolean(enabled);

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    const currentTicker = updatedChannel?.branding?.ticker || {};

    // Render transparent PNG strip with Sharp (supporting Hindi/Unicode and infinite seamless scrolling)
    const channelStreamDir = path.join(STREAMS_DIR, String(channelId));
    if (!fs.existsSync(channelStreamDir)) {
      fs.mkdirSync(channelStreamDir, { recursive: true });
    }
    const targetTickerFile = path.join(channelStreamDir, 'ticker.png');

    const tickerMeta = await renderTickerImage({
      text: currentTicker.text,
      bgColor: currentTicker.bgColor,
      textColor: currentTicker.textColor,
      fontFamily: currentTicker.fontFamily,
      fontSize: currentTicker.fontSize,
      widthPercent: currentTicker.width,
      paddingY: currentTicker.paddingY,
      alignment: currentTicker.alignment,
      outputPath: targetTickerFile
    });

    // LIVE ZMQ CONTROL: Send enable and position commands
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel) {
        if (!stream.encoder.channel.branding) stream.encoder.channel.branding = {};
        stream.encoder.channel.branding.ticker = {
          ...stream.encoder.channel.branding.ticker,
          ...currentTicker
        };
      }

      if (stream.feeder?.isScheduleActive && stream.feeder.scheduleBrandingSnapshot) {
        if (enabled !== undefined) {
          stream.feeder.scheduleBrandingSnapshot.ticker.enabled = !!enabled;
          await Channel.findByIdAndUpdate(channelId, {
            $set: { 'branding.preScheduleBranding.ticker.enabled': !!enabled }
          });
        }
        // Keep ticker suppressed on air while schedule is active
        await stream.encoder.setTickerEnabled(false);
      } else {
        // Dynamically adjust ticker position, crop width, text scroll expression, and visibility via ZMQ with zero stream restart
        const shouldShowTicker = currentTicker.enabled !== false;
        await stream.encoder.setTickerPosition(
          currentTicker.marginBottom,
          currentTicker.speed,
          currentTicker.alignment,
          tickerMeta,
          { reposition: shouldShowTicker }
        );
        if (!shouldShowTicker) {
          await stream.encoder.setTickerEnabled(false);
        }
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'ticker',
        ticker: currentTicker
      });
    }

    return res.status(200).json({
      message: 'Ticker rendered & pushed live to air via ZMQ',
      ticker: currentTicker
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/channels/:channelId/ticker
export const removeTicker = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const existingChannel = await Channel.findById(channelId);
    if (!existingChannel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const updateSet = { 'branding.ticker.enabled': false };
    if (existingChannel.branding?.preScheduleBranding?.ticker) {
      updateSet['branding.preScheduleBranding.ticker.enabled'] = false;
      updateSet['branding.preScheduleBranding.ticker.suppressed'] = false;
    }

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: updateSet },
      { new: true }
    );

    const currentTicker = updatedChannel?.branding?.ticker || {};

    // LIVE ZMQ CONTROL: disable ticker overlay without restart
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel?.branding?.ticker) {
        stream.encoder.channel.branding.ticker.enabled = false;
      }
      if (stream.feeder?.scheduleBrandingSnapshot?.ticker) {
        stream.feeder.scheduleBrandingSnapshot.ticker.enabled = false;
        stream.feeder.scheduleBrandingSnapshot.ticker.suppressed = false;
      }
      await stream.encoder.setTickerEnabled(false);
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'ticker',
        ticker: currentTicker
      });
    }

    return res.status(200).json({
      message: 'Ticker removed from live air via ZMQ',
      ticker: currentTicker
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/channels/:channelId/lband
export const updateLBandBranding = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { enabled, preset, windowX, windowY, windowWidth, windowHeight } = req.body || {};

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    if (!channel.branding) {
      channel.branding = {};
    }
    if (!channel.branding.lband) {
      channel.branding.lband = {};
    }

    const previousW = channel.branding.lband.windowWidth;
    const previousH = channel.branding.lband.windowHeight;
    const previousX = channel.branding.lband.windowX;
    const previousY = channel.branding.lband.windowY;

    if (enabled !== undefined) channel.branding.lband.enabled = Boolean(enabled);
    if (preset !== undefined) channel.branding.lband.preset = preset;
    if (windowX !== undefined) channel.branding.lband.windowX = Number(windowX);
    if (windowY !== undefined) channel.branding.lband.windowY = Number(windowY);
    if (windowWidth !== undefined) channel.branding.lband.windowWidth = Number(windowWidth);
    if (windowHeight !== undefined) channel.branding.lband.windowHeight = Number(windowHeight);

    // Save with findByIdAndUpdate to avoid schema validation conflicts on unrelated fields
    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $set: {
          'branding.lband.enabled': channel.branding.lband.enabled,
          'branding.lband.preset': channel.branding.lband.preset,
          'branding.lband.windowX': channel.branding.lband.windowX,
          'branding.lband.windowY': channel.branding.lband.windowY,
          'branding.lband.windowWidth': channel.branding.lband.windowWidth,
          'branding.lband.windowHeight': channel.branding.lband.windowHeight
        }
      },
      { new: true }
    );

    if (enabled === false) {
      streamManager.clearFireTimer(channelId, 'lband');
    }

    // LIVE STREAM CONTROL
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel) {
        if (!stream.encoder.channel.branding) stream.encoder.channel.branding = {};
        stream.encoder.channel.branding.lband = {
          ...stream.encoder.channel.branding.lband,
          ...channel.branding.lband
        };
      }

      // If cutout window dimensions changed, the FFmpeg scale/pad filtergraph MUST restart to re-calculate video scaling
      const dimensionsChanged =
        (windowWidth !== undefined && Number(windowWidth) !== previousW) ||
        (windowHeight !== undefined && Number(windowHeight) !== previousH) ||
        (windowX !== undefined && Number(windowX) !== previousX) ||
        (windowY !== undefined && Number(windowY) !== previousY);

      if (stream.feeder?.isScheduleActive && stream.feeder.scheduleBrandingSnapshot) {
        if (enabled !== undefined) {
          stream.feeder.scheduleBrandingSnapshot.lband.enabled = !!enabled;
          await Channel.findByIdAndUpdate(channelId, {
            $set: { 'branding.preScheduleBranding.lband.enabled': !!enabled }
          });
        }
        // Keep L-Band suppressed on air while schedule is active
        await stream.encoder.setLBandEnabled(false);
      } else {
        // Dynamically apply L-Band squeeze and overlay positioning via ZMQ with zero stream restart
        await stream.encoder.setLBandEnabled(channel.branding.lband.enabled);
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'lband',
        lband: updatedChannel?.branding?.lband || channel.branding.lband
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: channel.branding.lband.enabled
        ? 'L-Band ad applied live to broadcast stream'
        : 'L-Band ad removed from live broadcast stream',
      lband: updatedChannel?.branding?.lband || channel.branding.lband
    });
  } catch (error) {
    console.error('[Branding Controller] updateLBandBranding error:', error);
    next(error);
  }
};

// POST /api/channels/:channelId/lband/upload
export const uploadLBandFile = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No L-Band image file provided' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Validate storage quota
    const storageValidation = await validateStorageAvailability(channelId, req.file.size);
    if (!storageValidation.allowed) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: storageValidation.message });
    }

    const channelStreamDir = path.join(STREAMS_DIR, String(channelId));
    if (!fs.existsSync(channelStreamDir)) {
      fs.mkdirSync(channelStreamDir, { recursive: true });
    }
    const targetLBandFile = path.join(channelStreamDir, 'lband.png');

    const isLive = streamManager.isChannelLive(channelId);
    const wasAlreadyEnabled = Boolean(channel.branding?.lband?.enabled);

    // 1. Automatically analyze transparent video cutout & normalize to 1280x720 broadcast frame
    const detected = await analyzeAndNormalizeLBand(req.file.path, targetLBandFile);

    const relativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');

    // Clean up previous L-Band file from disk if it exists
    const previousLbandPath = channel.branding?.lband?.assetPath;
    if (previousLbandPath) {
      const fullOldPath = path.resolve(SERVER_ROOT, previousLbandPath);
      if (fs.existsSync(fullOldPath) && fullOldPath !== path.resolve(req.file.path)) {
        try {
          fs.unlinkSync(fullOldPath);
        } catch (e) {
          console.warn('[Branding] Failed to unlink old lband:', e.message);
        }
      }
    }

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $set: {
          'branding.lband.assetPath': relativePath,
          'branding.lband.enabled': wasAlreadyEnabled,
          'branding.lband.windowX': detected.windowX,
          'branding.lband.windowY': detected.windowY,
          'branding.lband.windowWidth': detected.windowWidth,
          'branding.lband.windowHeight': detected.windowHeight,
          'branding.lband.preset': 'auto-detected'
        }
      },
      { new: true }
    );

    // 2. LIVE STREAM CONTROL: dynamically update L-Band via ZMQ with zero stream restart
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel) {
        if (!stream.encoder.channel.branding) stream.encoder.channel.branding = {};
        stream.encoder.channel.branding.lband = {
          ...stream.encoder.channel.branding.lband,
          ...updatedChannel.branding.lband
        };
      }
      if (wasAlreadyEnabled) {
        await stream.encoder.setLBandEnabled(true);
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'lband',
        lband: updatedChannel?.branding?.lband
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: `L-Band analyzed: transparent cutout detected (${detected.windowWidth}x${detected.windowHeight} at X:${detected.windowX}, Y:${detected.windowY}). Ready to apply.`,
      lband: updatedChannel?.branding?.lband,
      detected
    });
  } catch (error) {
    console.error('[Branding Controller] uploadLBandFile error:', error);
    next(error);
  }
};

// DELETE /api/channels/:channelId/lband
export const removeLBand = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $set: {
          'branding.lband.enabled': false
        }
      },
      { new: true }
    );

    if (!updatedChannel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // LIVE ZMQ CONTROL: disable L-Band
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel?.branding?.lband) {
        stream.encoder.channel.branding.lband.enabled = false;
      }
      await stream.encoder.setLBandEnabled(false);
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'lband',
        lband: updatedChannel.branding?.lband
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: 'L-Band ad disabled from live stream',
      lband: updatedChannel.branding?.lband
    });
  } catch (error) {
    console.error('[Branding Controller] removeLBand error:', error);
    next(error);
  }
};

// POST /api/channels/:channelId/lband/fire
export const fireLBandLive = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { duration = 60 } = req.body || {};

    const cleanDuration = Math.max(5, Math.min(3600, Number(duration) || 60));
    const result = await streamManager.fireLBand(channelId, cleanDuration);

    return res.status(200).json({
      success: true,
      message: `L-Band fired live for ${result.duration} seconds`,
      ...result
    });
  } catch (error) {
    console.error('[Branding Controller] fireLBandLive error:', error);
    return res.status(error.status || 500).json({
      message: error.message || 'Failed to fire L-Band'
    });
  }
};

// PUT /api/channels/:channelId/ashton
export const updateAshtonBranding = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { enabled, squeeze, height } = req.body || {};

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    if (!channel.branding) {
      channel.branding = {};
    }
    if (!channel.branding.ashton) {
      channel.branding.ashton = {};
    }

    const previousHeight = channel.branding.ashton.height;
    if (enabled !== undefined) channel.branding.ashton.enabled = Boolean(enabled);
    if (squeeze !== undefined) channel.branding.ashton.squeeze = Boolean(squeeze);
    if (height !== undefined) channel.branding.ashton.height = Number(height);

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $set: {
          'branding.ashton.enabled': channel.branding.ashton.enabled,
          'branding.ashton.squeeze': channel.branding.ashton.squeeze,
          'branding.ashton.height': channel.branding.ashton.height
        }
      },
      { new: true }
    );

    if (enabled === false) {
      streamManager.clearFireTimer(channelId, 'ashton');
    }

    // LIVE STREAM CONTROL
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel) {
        if (!stream.encoder.channel.branding) stream.encoder.channel.branding = {};
        stream.encoder.channel.branding.ashton = {
          ...stream.encoder.channel.branding.ashton,
          ...channel.branding.ashton
        };
      }

      const heightChanged = height !== undefined && Number(height) !== previousHeight;

      if (stream.feeder?.isScheduleActive && stream.feeder.scheduleBrandingSnapshot) {
        if (enabled !== undefined) {
          stream.feeder.scheduleBrandingSnapshot.ashton.enabled = !!enabled;
        }
        if (squeeze !== undefined) {
          stream.feeder.scheduleBrandingSnapshot.ashton.squeeze = !!squeeze;
        }
        await Channel.findByIdAndUpdate(channelId, {
          $set: {
            'branding.preScheduleBranding.ashton.enabled': stream.feeder.scheduleBrandingSnapshot.ashton.enabled,
            'branding.preScheduleBranding.ashton.squeeze': stream.feeder.scheduleBrandingSnapshot.ashton.squeeze
          }
        });
        // Keep Ashton suppressed on air while schedule is active
        await stream.encoder.setAshtonLive(false);
      } else {
        // Dynamically apply Ashton Band squeeze/overlay via ZMQ with zero stream restart
        await stream.encoder.setAshtonLive(
          channel.branding.ashton.enabled,
          channel.branding.ashton.squeeze !== false
        );
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'ashton',
        ashton: updatedChannel?.branding?.ashton || channel.branding.ashton
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: channel.branding.ashton.enabled
        ? `Ashton band applied live (${channel.branding.ashton.squeeze ? 'Video Squeezed' : 'Overlay Mode'})`
        : 'Ashton band removed from live stream',
      ashton: updatedChannel?.branding?.ashton || channel.branding.ashton
    });
  } catch (error) {
    console.error('[Branding Controller] updateAshtonBranding error:', error);
    next(error);
  }
};

// POST /api/channels/:channelId/ashton/upload
export const uploadAshtonFile = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No Ashton Band graphic provided' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Validate storage quota
    const storageValidation = await validateStorageAvailability(channelId, req.file.size);
    if (!storageValidation.allowed) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: storageValidation.message });
    }

    const channelStreamDir = path.join(STREAMS_DIR, String(channelId));
    if (!fs.existsSync(channelStreamDir)) {
      fs.mkdirSync(channelStreamDir, { recursive: true });
    }
    const targetAshtonFile = path.join(channelStreamDir, 'ashton.png');

    const isLive = streamManager.isChannelLive(channelId);
    const wasAlreadyEnabled = Boolean(channel.branding?.ashton?.enabled);

    // 1. Automatically analyze Ashton Band height & format, and compose 1280x720 broadcast frame
    const detected = await analyzeAndNormalizeAshton(req.file.path, targetAshtonFile);

    const relativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');

    // Clean up previous Ashton Band file from disk if it exists
    const previousAshtonPath = channel.branding?.ashton?.assetPath;
    if (previousAshtonPath) {
      const fullOldPath = path.resolve(SERVER_ROOT, previousAshtonPath);
      if (fs.existsSync(fullOldPath) && fullOldPath !== path.resolve(req.file.path)) {
        try {
          fs.unlinkSync(fullOldPath);
        } catch (e) {
          console.warn('[Branding] Failed to unlink old ashton:', e.message);
        }
      }
    }

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $set: {
          'branding.ashton.assetPath': relativePath,
          'branding.ashton.enabled': wasAlreadyEnabled,
          'branding.ashton.height': detected.height
        }
      },
      { new: true }
    );

    // 2. LIVE STREAM CONTROL: dynamically update Ashton Band via ZMQ with zero stream restart
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel) {
        if (!stream.encoder.channel.branding) stream.encoder.channel.branding = {};
        stream.encoder.channel.branding.ashton = {
          ...stream.encoder.channel.branding.ashton,
          ...updatedChannel.branding.ashton
        };
      }
      if (wasAlreadyEnabled) {
        await stream.encoder.setAshtonLive(true, updatedChannel.branding?.ashton?.squeeze !== false);
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'ashton',
        ashton: updatedChannel?.branding?.ashton
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: `Ashton Band analyzed: banner height detected as ${detected.height}px. Ready to apply.`,
      ashton: updatedChannel?.branding?.ashton,
      detected
    });
  } catch (error) {
    console.error('[Branding Controller] uploadAshtonFile error:', error);
    next(error);
  }
};

// DELETE /api/channels/:channelId/ashton
export const removeAshton = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $set: {
          'branding.ashton.enabled': false
        }
      },
      { new: true }
    );

    if (!updatedChannel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // LIVE ZMQ CONTROL: disable Ashton
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel?.branding?.ashton) {
        stream.encoder.channel.branding.ashton.enabled = false;
      }
      await stream.encoder.setAshtonLive(false);
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'ashton',
        ashton: updatedChannel.branding?.ashton
      });
    }

    await calculateChannelStorage(channelId);

    return res.status(200).json({
      message: 'Ashton Band removed from live stream',
      ashton: updatedChannel.branding?.ashton
    });
  } catch (error) {
    console.error('[Branding Controller] removeAshton error:', error);
    next(error);
  }
};

// POST /api/channels/:channelId/ashton/fire
export const fireAshtonLive = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { duration = 60, squeeze = true } = req.body || {};

    const cleanDuration = Math.max(5, Math.min(3600, Number(duration) || 60));
    const result = await streamManager.fireAshton(channelId, cleanDuration, squeeze !== false);

    return res.status(200).json({
      success: true,
      message: `Ashton Band fired live for ${result.duration} seconds`,
      ...result
    });
  } catch (error) {
    console.error('[Branding Controller] fireAshtonLive error:', error);
    return res.status(error.status || 500).json({
      message: error.message || 'Failed to fire Ashton Band'
    });
  }
};

// PUT /api/channels/:channelId/timer
export const updateTimerBranding = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const {
      enabled,
      showDuringSchedule,
      label,
      format,
      position,
      positionX,
      positionY,
      fontSize,
      fontColor,
      bgColor
    } = req.body || {};

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const updateFields = {};
    if (enabled !== undefined) {
      updateFields['branding.backInTimer.enabled'] = Boolean(enabled);
      updateFields['branding.backInTimer.showDuringSchedule'] = Boolean(enabled);
    } else if (showDuringSchedule !== undefined) {
      updateFields['branding.backInTimer.enabled'] = Boolean(showDuringSchedule);
      updateFields['branding.backInTimer.showDuringSchedule'] = Boolean(showDuringSchedule);
    }
    if (label !== undefined) updateFields['branding.backInTimer.label'] = String(label);
    if (format !== undefined) updateFields['branding.backInTimer.format'] = format === 'SS' ? 'SS' : 'MM:SS';
    if (position !== undefined) updateFields['branding.backInTimer.position'] = position;
    if (positionX !== undefined) updateFields['branding.backInTimer.positionX'] = Number(positionX);
    if (positionY !== undefined) updateFields['branding.backInTimer.positionY'] = Number(positionY);
    if (fontSize !== undefined) updateFields['branding.backInTimer.fontSize'] = Number(fontSize);
    if (fontColor !== undefined) updateFields['branding.backInTimer.fontColor'] = fontColor;
    if (bgColor !== undefined) updateFields['branding.backInTimer.bgColor'] = bgColor;

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    const timer = updatedChannel.branding?.backInTimer;

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'timer',
        timer
      });
    }

    return res.status(200).json({
      message: timer.enabled
        ? `Back In Timer enabled (${timer.showDuringSchedule ? 'Active during ads' : 'Hidden during ads'})`
        : 'Back In Timer disabled',
      timer
    });
  } catch (error) {
    console.error('[Branding Controller] updateTimerBranding error:', error);
    next(error);
  }
};

// DELETE /api/channels/:channelId/timer
export const removeTimer = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: { 'branding.backInTimer.enabled': false } },
      { new: true }
    );

    if (!updatedChannel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'timer',
        timer: updatedChannel.branding?.backInTimer
      });
    }

    return res.status(200).json({
      message: 'Back In Timer disabled',
      timer: updatedChannel.branding?.backInTimer
    });
  } catch (error) {
    console.error('[Branding Controller] removeTimer error:', error);
    next(error);
  }
};
