import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Asset } from '../models/Asset.js';
import { ASSET_STATUS } from '../config/constants.js';
import { probeVideo, generateThumbnail, normalizeVideo } from '../utils/media.js';
import { io } from '../server.js';
import { SERVER_ROOT, THUMBNAILS_DIR } from '../config/paths.js';

const MAX_STORAGE_PER_CHANNEL = 10 * 1024 * 1024 * 1024; // 10 GB default quota

/**
 * Check if channel has enough storage quota
 */
export const checkStorageQuota = async (channelId, incomingBytes = 0) => {
  const assets = await Asset.find({ channel: channelId });
  const totalUsed = assets.reduce((acc, curr) => acc + (curr.size || 0), 0);
  const totalCount = assets.length;

  return {
    allowed: totalUsed + incomingBytes <= MAX_STORAGE_PER_CHANNEL,
    totalUsed,
    totalUsedMB: (totalUsed / (1024 * 1024)).toFixed(2),
    totalUsedGB: (totalUsed / (1024 * 1024 * 1024)).toFixed(2),
    quotaGB: (MAX_STORAGE_PER_CHANNEL / (1024 * 1024 * 1024)).toFixed(1),
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

    // Step 2: Generate thumbnail
    const thumbFilename = `thumb_${asset._id}.jpg`;
    const absoluteThumbPath = path.join(THUMBNAILS_DIR, thumbFilename);
    await generateThumbnail(absoluteVideoPath, absoluteThumbPath, meta.duration);

    asset.thumbnailPath = `uploads/thumbnails/${thumbFilename}`;

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
