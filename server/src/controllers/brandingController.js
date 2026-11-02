import fs from 'fs';
import path from 'path';
import { Channel } from '../models/Channel.js';
import { io } from '../server.js';
import { STREAMS_DIR, SERVER_ROOT } from '../config/paths.js';
import { streamManager } from '../services/streaming/streamManager.js';
import {
  renderTickerImage,
  normalizeAndTrimLogo,
  scaleAndSaveLogo,
  analyzeAndNormalizeLBand,
  analyzeAndNormalizeAshton
} from '../services/streaming/brandingAssets.js';

// PUT /api/channels/:channelId/logo
export const updateLogoBranding = async (req, res, next) => {
  try {
    const { channelId } = req.params;
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

        if (allowOnSchedule && currentLogo.enabled !== false) {
          if (sizeActuallyChanged) {
            scaledInfo = await stream.encoder.setLogoSize(currentLogo.sizePercent);
          } else {
            await stream.encoder.setLogoPosition(
              currentLogo.position,
              currentLogo.marginX,
              currentLogo.marginY
            );
          }
        } else {
          // If not permitted during schedule or disabled, ensure logo is off-screen
          await stream.encoder.setLogoEnabled(false);
        }
      } else {
        if (currentLogo.enabled !== false) {
          if (sizeActuallyChanged) {
            console.log(`[Branding] Dynamic live logo resize to ${currentLogo.sizePercent}% via ZMQ (zero video interruption)...`);
            scaledInfo = await stream.encoder.setLogoSize(currentLogo.sizePercent);
          } else {
            await stream.encoder.setLogoPosition(
              currentLogo.position,
              currentLogo.marginX,
              currentLogo.marginY
            );
          }
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
    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: { 'branding.logo.enabled': false } },
      { new: true }
    );
    if (!updatedChannel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const currentLogo = updatedChannel.branding?.logo || {};

    // LIVE ZMQ CONTROL: Disable logo overlay without restart
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel?.branding?.logo) {
        stream.encoder.channel.branding.logo.enabled = false;
      }
      await stream.encoder.setLogoEnabled(false);
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'logo',
        logo: currentLogo
      });
    }

    return res.status(200).json({
      message: 'Logo disabled from live air via ZMQ',
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
    if (!req.file) {
      return res.status(400).json({ message: 'No logo image file provided' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // 1. Automatically inspect uploaded logo, crop outer transparent padding to keep only actual visible logo content
    const trimResult = await normalizeAndTrimLogo(req.file.path);

    const relativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');

    // 2. Prepare target logo.png in channel stream directory with resolution-appropriate sizing:
    // If resolution is 1280x720 -> height 70px
    // If resolution is 1920x1080 -> height 100px
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

    // 3. Update channel branding in database
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

    // 4. LIVE STREAM CONTROL:
    // If stream is active on air, seamlessly reload stream to load new cropped & scaled logo dimensions into FFmpeg
    const isLive = streamManager.isChannelLive(channelId);
    if (isLive) {
      console.log(`[Branding] Channel ${channelId} is live on air. Seamlessly reloading stream to display new logo (${scaled.width}x${scaled.height}px)...`);
      await streamManager.restartStream(channelId);
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

      if (stream.feeder?.isScheduleActive && stream.feeder.scheduleBrandingSnapshot) {
        if (enabled !== undefined) {
          stream.feeder.scheduleBrandingSnapshot.bug.enabled = !!enabled;
          await Channel.findByIdAndUpdate(channelId, {
            $set: { 'branding.preScheduleBranding.bug.enabled': !!enabled }
          });
        }
        // Keep bug suppressed on air while schedule is active
        await stream.encoder.setBugEnabled(false);
      } else if (currentBug.enabled !== false) {
        if (sizeActuallyChanged) {
          console.log(`[Branding] Dynamic live bug resize to ${currentBug.sizePercent}% via ZMQ...`);
          await stream.encoder.setBugSize(currentBug.sizePercent);
        }
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
    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: { 'branding.bug.enabled': false } },
      { new: true }
    );
    if (!updatedChannel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const currentBug = updatedChannel.branding?.bug || {};

    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel?.branding?.bug) {
        stream.encoder.channel.branding.bug.enabled = false;
      }
      await stream.encoder.setBugEnabled(false);
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'bug',
        bug: currentBug
      });
    }

    return res.status(200).json({
      message: 'Bug disabled from live air via ZMQ',
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
      return res.status(400).json({ message: 'No bug image or GIF file provided' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const isGif =
      req.file.mimetype === 'image/gif' ||
      path.extname(req.file.originalname).toLowerCase() === '.gif';

    const relativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');

    const channelStreamDir = path.join(STREAMS_DIR, String(channelId));
    if (!fs.existsSync(channelStreamDir)) {
      fs.mkdirSync(channelStreamDir, { recursive: true });
    }

    const defaultSizePercent = 8;
    const resolution = channel.outputSettings?.resolution || '1280x720';
    const canvasHeight = channel.outputSettings?.height || 720;

    let targetBugFile;
    let scaledWidth = 80;
    let scaledHeight = 60;

    if (isGif) {
      // Animated GIF: preserve all frames and copy directly to stream folder
      targetBugFile = path.join(channelStreamDir, 'bug.gif');
      fs.copyFileSync(req.file.path, targetBugFile);

      try {
        const meta = await sharp(req.file.path, { animated: true }).metadata();
        const effectiveHeight = meta.pageHeight || meta.height || 60;
        scaledWidth = meta.width || 80;
        scaledHeight = effectiveHeight;
      } catch {}
    } else {
      // Static image: trim transparent borders and pre-scale
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

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $set: {
          'branding.bug.assetPath': relativePath,
          'branding.bug.enabled': true,
          'branding.bug.sizePercent': defaultSizePercent,
          'branding.bug.isGif': isGif
        }
      },
      { new: true }
    );

    const currentBug = updatedChannel?.branding?.bug || {};

    // LIVE STREAM CONTROL: hot-swap stream to mount new bug file descriptor cleanly
    const isLive = streamManager.isChannelLive(channelId);
    if (isLive) {
      console.log(`[Branding] Channel ${channelId} is live on air. Seamlessly reloading stream to display new bug (${isGif ? 'animated GIF' : 'image'})...`);
      await streamManager.restartStream(channelId);
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'bug',
        bug: currentBug
      });
    }

    return res.status(200).json({
      message: isGif
        ? 'Station Bug animated GIF uploaded & pushed live on air'
        : 'Station Bug image uploaded & pushed live on air',
      bug: currentBug,
      dimensions: {
        width: scaledWidth,
        height: scaledHeight,
        isGif
      }
    });
  } catch (error) {
    console.error('[Branding Controller] uploadBugFile error:', error);
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

    const previousTicker = channel.branding?.ticker || {};
    const previousFontSize = Number(previousTicker.fontSize) || 26;
    const previousWidth = Number(previousTicker.width) || 100;
    const previousPaddingY = Number(previousTicker.paddingY) || 12;

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

      // Check if ticker background dimensions or text changed. If so, FFmpeg cannot dynamically
      // change overlay input dimensions without an input frame error, so reload seamlessly.
      const textChanged = text !== undefined && text !== previousTicker.text;
      const dimensionsChanged =
        (fontSize !== undefined && Number(fontSize) !== previousFontSize) ||
        (width !== undefined && Number(width) !== previousWidth) ||
        (paddingY !== undefined && Number(paddingY) !== previousPaddingY) ||
        textChanged;

      if (stream.feeder?.isScheduleActive && stream.feeder.scheduleBrandingSnapshot) {
        if (enabled !== undefined) {
          stream.feeder.scheduleBrandingSnapshot.ticker.enabled = !!enabled;
          await Channel.findByIdAndUpdate(channelId, {
            $set: { 'branding.preScheduleBranding.ticker.enabled': !!enabled }
          });
        }
        // Keep ticker suppressed on air while schedule is active
        await stream.encoder.setTickerEnabled(false);
      } else if (dimensionsChanged) {
        console.log(`[Branding] Ticker dimensions or text changed. Seamlessly reloading live stream...`);
        await streamManager.restartStream(channelId);
      } else {
        await stream.encoder.setTickerPosition(
          currentTicker.marginBottom,
          currentTicker.speed,
          currentTicker.alignment,
          tickerMeta
        );
        await stream.encoder.setTickerEnabled(currentTicker.enabled !== false);
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
    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: { 'branding.ticker.enabled': false } },
      { new: true }
    );
    if (!updatedChannel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const currentTicker = updatedChannel.branding?.ticker || {};

    // LIVE ZMQ CONTROL: disable ticker overlay without restart
    const stream = streamManager.getStream(channelId);
    if (stream?.encoder?.isRunning) {
      if (stream.encoder.channel?.branding?.ticker) {
        stream.encoder.channel.branding.ticker.enabled = false;
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
      } else if (dimensionsChanged) {
        console.log(`[Branding] L-Band cutout dimensions changed. Restarting stream seamlessly...`);
        await streamManager.restartStream(channelId);
      } else {
        // Just toggling on/off: use instant live ZMQ
        const zmqRes = await stream.encoder.setLBandEnabled(channel.branding.lband.enabled);
        if (zmqRes === null) {
          // If ZMQ did not respond, seamlessly reload stream with L-Band filtergraph
          console.log(`[Branding] ZMQ command not acknowledged. Seamlessly restarting encoder with L-Band filtergraph...`);
          await streamManager.restartStream(channelId);
        }
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'lband',
        lband: updatedChannel?.branding?.lband || channel.branding.lband
      });
    }

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

    const channelStreamDir = path.join(STREAMS_DIR, String(channelId));
    if (!fs.existsSync(channelStreamDir)) {
      fs.mkdirSync(channelStreamDir, { recursive: true });
    }
    const targetLBandFile = path.join(channelStreamDir, 'lband.png');

    // 1. If stream is currently running AND L-Band is already actively on air, pause it to release locks
    const isLive = streamManager.isChannelLive(channelId);
    const wasAlreadyEnabled = Boolean(channel.branding?.lband?.enabled);
    let resumeIndex = 0;
    if (isLive && wasAlreadyEnabled) {
      const activeStream = streamManager.getStream(channelId);
      resumeIndex = Math.max(0, activeStream?.feeder?.currentIndex || 0);
      console.log(`[Branding] Releasing encoder file locks for channel ${channelId} to update active L-Band...`);
      await streamManager.stopStream(channelId);
      await new Promise((r) => setTimeout(r, 300));
    }

    // 2. Automatically analyze transparent video cutout & normalize to 1280x720 broadcast frame
    const detected = await analyzeAndNormalizeLBand(req.file.path, targetLBandFile);

    const relativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');

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

    // 3. If stream was live and already had L-Band enabled, resume it with the newly analyzed cutout and graphic
    if (isLive && wasAlreadyEnabled) {
      console.log(`[Branding] Resuming live stream for channel ${channelId} with updated L-Band (index: ${resumeIndex})...`);
      await streamManager.startStream(channelId, resumeIndex);
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'lband',
        lband: updatedChannel?.branding?.lband
      });
    }

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
      const zmqRes = await stream.encoder.setLBandEnabled(false);
      if (zmqRes === null) {
        await streamManager.restartStream(channelId);
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'lband',
        lband: updatedChannel.branding?.lband
      });
    }

    return res.status(200).json({
      message: 'L-Band ad disabled from live stream',
      lband: updatedChannel.branding?.lband
    });
  } catch (error) {
    console.error('[Branding Controller] removeLBand error:', error);
    next(error);
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
      } else if (heightChanged) {
        console.log(`[Branding] Ashton Band height changed. Restarting stream seamlessly...`);
        await streamManager.restartStream(channelId);
      } else {
        const zmqRes = await stream.encoder.setAshtonLive(
          channel.branding.ashton.enabled,
          channel.branding.ashton.squeeze !== false
        );
        if (zmqRes === null) {
          console.log(`[Branding] ZMQ command not acknowledged. Seamlessly restarting encoder with Ashton filtergraph...`);
          await streamManager.restartStream(channelId);
        }
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'ashton',
        ashton: updatedChannel?.branding?.ashton || channel.branding.ashton
      });
    }

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

    const channelStreamDir = path.join(STREAMS_DIR, String(channelId));
    if (!fs.existsSync(channelStreamDir)) {
      fs.mkdirSync(channelStreamDir, { recursive: true });
    }
    const targetAshtonFile = path.join(channelStreamDir, 'ashton.png');

    // 1. If stream is currently running AND Ashton is already actively on air, pause it to release locks
    const isLive = streamManager.isChannelLive(channelId);
    const wasAlreadyEnabled = Boolean(channel.branding?.ashton?.enabled);
    let resumeIndex = 0;
    if (isLive && wasAlreadyEnabled) {
      const activeStream = streamManager.getStream(channelId);
      resumeIndex = Math.max(0, activeStream?.feeder?.currentIndex || 0);
      console.log(`[Branding] Releasing encoder file locks for channel ${channelId} to update active Ashton Band...`);
      await streamManager.stopStream(channelId);
      await new Promise((r) => setTimeout(r, 300));
    }

    // 2. Automatically analyze Ashton Band height & format, and compose 1280x720 broadcast frame
    const detected = await analyzeAndNormalizeAshton(req.file.path, targetAshtonFile);

    const relativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');

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

    // 3. If stream was live and already had Ashton enabled, resume it with the newly analyzed Ashton graphic
    if (isLive && wasAlreadyEnabled) {
      console.log(`[Branding] Resuming live stream for channel ${channelId} with updated Ashton Band (index: ${resumeIndex})...`);
      await streamManager.startStream(channelId, resumeIndex);
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'ashton',
        ashton: updatedChannel?.branding?.ashton
      });
    }

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
      const zmqRes = await stream.encoder.setAshtonLive(false);
      if (zmqRes === null) {
        await streamManager.restartStream(channelId);
      }
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('branding_updated', {
        type: 'ashton',
        ashton: updatedChannel.branding?.ashton
      });
    }

    return res.status(200).json({
      message: 'Ashton Band removed from live stream',
      ashton: updatedChannel.branding?.ashton
    });
  } catch (error) {
    console.error('[Branding Controller] removeAshton error:', error);
    next(error);
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
