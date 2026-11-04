import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Asset } from '../models/Asset.js';
import { Channel } from '../models/Channel.js';
import { ASSET_STATUS } from '../config/constants.js';
import { probeVideo, generateThumbnail, normalizeVideo } from '../utils/media.js';
import { io } from '../server.js';
import { SERVER_ROOT, ensureChannelUploadDirs, getChannelFolderName } from '../config/paths.js';
import { calculateChannelStorage } from './channel.service.js';

const MAX_STORAGE_PER_CHANNEL = 10 * 1024 * 1024 * 1024; // 10 GB default quota

/**
 * Check if channel has enough storage quota
 */
export const checkStorageQuota = async (channelId, incomingBytes = 0) => {
  const channel = await Channel.findById(channelId).select('allocatedStorage usedStorage');
  const assets = await Asset.find({ channel: channelId });
  const assetSizeSum = assets.reduce((acc, curr) => acc + (curr.size || 0), 0);
  const totalUsed = Math.max(channel?.usedStorage || 0, assetSizeSum);
  const totalCount = assets.length;

  const allocated = Number(channel?.allocatedStorage) || 0;
  // If allocatedStorage is 0, it means unlimited or unassigned (fallback to 10GB default limit for safety)
  const quotaBytes = allocated > 0 ? allocated : MAX_STORAGE_PER_CHANNEL;
  const isUnlimited = allocated === 0;

  return {
    allowed: isUnlimited || totalUsed + incomingBytes <= quotaBytes,
    totalUsed,
    totalUsedMB: (totalUsed / (1024 * 1024)).toFixed(2),
    totalUsedGB: (totalUsed / (1024 * 1024 * 1024)).toFixed(2),
    totalUsedFormatted:
      totalUsed >= 1024 * 1024 * 1024
        ? `${(totalUsed / (1024 * 1024 * 1024)).toFixed(2)} GB`
        : `${(totalUsed / (1024 * 1024)).toFixed(1)} MB`,
    allocatedStorage: allocated,
    quotaBytes,
    quotaGB: isUnlimited ? 'Unlimited' : (quotaBytes / (1024 * 1024 * 1024)).toFixed(1),
    quotaFormatted: isUnlimited
      ? 'Unlimited'
      : allocated >= 1024 * 1024 * 1024 * 1024
        ? `${(allocated / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`
        : `${(allocated / (1024 * 1024 * 1024)).toFixed(1)} GB`,
    isUnlimited,
    totalCount
  };
};

/**
 * Merge chunked upload files into final destination
 */
export const mergeChunks = async (chunksDir, totalChunks, destinationFile) => {
  const writeStream = fs.createWriteStream(destinationFile);

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunksDir, `chunk_${i}`);
    if (!fs.existsSync(chunkPath)) {
      throw new Error(`Missing chunk file: ${chunkPath}`);
    }

    const chunkData = fs.readFileSync(chunkPath);
    writeStream.write(chunkData);
  }

  writeStream.end();

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // Clean up chunks folder
  try {
    fs.rmSync(chunksDir, { recursive: true, force: true });
  } catch (err) {
    console.error('Error removing chunk directory:', err);
  }
};

/**
 * Background processing job for uploaded asset
 */
export const processUploadedAsset = async (assetId, channelId) => {
  try {
    const asset = await Asset.findById(assetId);
    if (!asset) return;

    // Update status to processing
    asset.status = ASSET_STATUS.PROCESSING;
    await asset.save();

    if (io) {
      io.to(`channel:${channelId}`).emit('asset_progress', {
        assetId,
        status: ASSET_STATUS.PROCESSING,
        progress: 25,
        message: 'Analyzing video metadata...'
      });
    }

    // Step 1: Probe metadata
    const absoluteVideoPath = path.resolve(SERVER_ROOT, asset.filePath);
    const meta = await probeVideo(absoluteVideoPath);

    asset.duration = meta.duration;
    asset.durationFormatted = meta.durationFormatted;
    asset.resolution = meta.resolution;
    asset.codec = meta.codec;
    asset.size = meta.size || fs.statSync(absoluteVideoPath).size;

    if (io) {
      io.to(`channel:${channelId}`).emit('asset_progress', {
        assetId,
        status: ASSET_STATUS.PROCESSING,
        progress: 50,
        message: 'Generating frame thumbnail...'
      });
    }

    // Step 2: Generate thumbnail inside channel thumbnails_img directory
    const channel = await Channel.findById(channelId).select('name');
    const channelName = channel?.name || 'channel';
    const { thumbnailsDir } = ensureChannelUploadDirs(channelId, channelName);
    const thumbFilename = `thumb_${asset._id}.jpg`;
    const absoluteThumbPath = path.join(thumbnailsDir, thumbFilename);
    await generateThumbnail(absoluteVideoPath, absoluteThumbPath, meta.duration);

    const channelFolder = getChannelFolderName(channelId, channelName);
    asset.thumbnailPath = `uploads/${channelFolder}/thumbnails_img/${thumbFilename}`;
    await asset.save();

    // Recalculate channel storage after thumbnail generation
    await calculateChannelStorage(channelId);

    // Step 3: Normalization check
    // Low CPU priority: if video is already 1280x720, 25fps, h264, keep as-is!
    const needsTranscode = meta.width !== 1280 || meta.height !== 720 || meta.fps !== 25 || meta.codec !== 'h264';

    if (needsTranscode) {
      if (io) {
        io.to(`channel:${channelId}`).emit('asset_progress', {
          assetId,
          status: ASSET_STATUS.PROCESSING,
          progress: 75,
          message: 'Optimizing and normalizing video to 720p 25fps...'
        });
      }

      const normFilename = `norm_${path.basename(asset.filePath)}`;
      const normPath = path.join(path.dirname(absoluteVideoPath), normFilename);

      await normalizeVideo(absoluteVideoPath, normPath);

      // Remove raw upload file if normalized video was created
      if (fs.existsSync(absoluteVideoPath) && path.resolve(absoluteVideoPath) !== path.resolve(normPath)) {
        try {
          fs.unlinkSync(absoluteVideoPath);
        } catch (e) {
          console.warn('[AssetService] Could not unlink pre-normalized video:', e.message);
        }
      }

      // Replace filePath with normalized video
      asset.filePath = path.relative(SERVER_ROOT, normPath).replace(/\\/g, '/');
      const normStats = fs.statSync(normPath);
      asset.size = normStats.size;
      asset.resolution = '1280x720';
      asset.codec = 'h264';
    }

    // Mark READY
    asset.status = ASSET_STATUS.READY;
    await asset.save();

    // Recalculate channel storage after video processing
    await calculateChannelStorage(channelId);

    if (io) {
      io.to(`channel:${channelId}`).emit('asset_ready', {
        assetId,
        status: ASSET_STATUS.READY,
        asset,
        progress: 100,
        message: 'Asset ready for playout'
      });
    }

    console.log(`[AssetService] Asset ${assetId} processed successfully: ${asset.originalName}`);
  } catch (error) {
    console.error(`[AssetService] Processing failed for asset ${assetId}:`, error);
    await Asset.findByIdAndUpdate(assetId, { status: ASSET_STATUS.FAILED });
    if (io) {
      io.to(`channel:${channelId}`).emit('asset_failed', {
        assetId,
        status: ASSET_STATUS.FAILED,
        error: error.message
      });
    }
  }
};
