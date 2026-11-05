import fs from 'fs';
import path from 'path';
import { Asset } from '../models/asset.model.js';
import { Channel } from '../models/channel.model.js';
import { Playlist } from '../models/playlist.model.js';
import { ASSET_STATUS, ROLES } from '../config/constants.js';
import { checkStorageQuota, mergeChunks, processUploadedAsset } from '../services/assetService.js';
import { calculateChannelStorage, validateStorageAvailability } from '../services/channel.service.js';
import {
  SERVER_ROOT,
  UPLOADS_DIR,
  TEMP_DIR,
  ensureChannelUploadDirs,
  getChannelFolderName
} from '../config/paths.js';

// POST /api/assets/upload/chunk
export const uploadChunkHandler = async (req, res, next) => {
  try {
    const { uploadId, chunkIndex, totalChunks, fileName, fileSize, category, channelId } = req.body;

    if (!channelId || !uploadId || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({ message: 'Missing required upload chunk parameters' });
    }

    // Check channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // RBAC: user can only upload to assigned channel
    if (req.user.role === ROLES.USER && String(channel.assignedUser) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this channel' });
    }

    const currentIdx = parseInt(chunkIndex, 10);
    const total = parseInt(totalChunks, 10);

    // On first chunk, check storage quota
    if (currentIdx === 0) {
      const storageValidation = await validateStorageAvailability(channelId, parseInt(fileSize || 0, 10));
      if (!storageValidation.allowed) {
        return res.status(400).json({
          message: storageValidation.message
        });
      }
    }

    // If last chunk, merge all chunks into final file inside channel video directory
    if (currentIdx === total - 1) {
      const chunksDir = path.join(TEMP_DIR, uploadId);
      const { videoDir } = ensureChannelUploadDirs(channelId, channel.name);

      const ext = path.extname(fileName) || '.mp4';
      const cleanName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const uniqueSuffix = Date.now();
      const finalFileName = `${cleanName}_${uniqueSuffix}${ext}`;
      const destinationFile = path.join(videoDir, finalFileName);

      await mergeChunks(chunksDir, total, destinationFile);

      // Create Asset record
      const channelFolder = getChannelFolderName(channelId, channel.name);
      const relativePath = `uploads/${channelFolder}/video/${finalFileName}`;
      const asset = await Asset.create({
        channel: channelId,
        originalName: fileName,
        filePath: relativePath,
        category: category || 'General',
        size: parseInt(fileSize || 0, 10),
        status: ASSET_STATUS.PROCESSING,
        createdBy: req.user._id
      });

      // Update channel storage calculation immediately
      calculateChannelStorage(channelId);

      // Trigger background processing asynchronously
      setImmediate(() => {
        processUploadedAsset(asset._id, channelId);
      });

      return res.status(201).json({
        message: 'Upload complete, processing media metadata and thumbnail...',
        asset
      });
    }

    return res.status(200).json({
      message: `Chunk ${currentIdx + 1}/${total} uploaded successfully`,
      chunkIndex: currentIdx
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/assets/upload/direct
export const uploadDirectHandler = async (req, res, next) => {
  try {
    const { channelId, category } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // RBAC: user can only upload to assigned channel
    if (req.user.role === ROLES.USER && String(channel.assignedUser) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this channel' });
    }

    // Check quota
    const storageValidation = await validateStorageAvailability(channelId, req.file.size);
    if (!storageValidation.allowed) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: storageValidation.message
      });
    }

    const relativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/');

    const asset = await Asset.create({
      channel: channelId,
      originalName: req.file.originalname,
      filePath: relativePath,
      category: category || 'General',
      size: req.file.size,
      status: ASSET_STATUS.PROCESSING,
      createdBy: req.user._id
    });

    // Update channel storage calculation immediately
    calculateChannelStorage(channelId);

    // Start background processing
    setImmediate(() => {
      processUploadedAsset(asset._id, channelId);
    });

    return res.status(201).json({
      message: 'Upload received, analyzing video...',
      asset
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/assets
export const getAssets = async (req, res, next) => {
  try {
    const { channelId, category, search, page = 1, limit = 100 } = req.query;

    if (!channelId) {
      return res.status(400).json({ message: 'channelId query parameter is required' });
    }

    const filter = { channel: channelId };

    if (category && category !== 'All categories') {
      filter.category = category;
    }

    if (search) {
      filter.originalName = { $regex: search, $options: 'i' };
    }

    const assets = await Asset.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const quota = await checkStorageQuota(channelId);

    return res.status(200).json({
      assets,
      storage: quota
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/assets/:id
export const getAssetById = async (req, res, next) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    return res.status(200).json({ asset });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/assets/:id
export const deleteAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    // RBAC: user can only delete assets on assigned channel
    if (req.user.role === ROLES.USER) {
      const channel = await Channel.findById(asset.channel);
      if (String(channel?.assignedUser) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Forbidden: You cannot delete assets on this channel' });
      }
    }

    // Remove video file from disk
    const absoluteVideoPath = path.resolve(SERVER_ROOT, asset.filePath);
    if (fs.existsSync(absoluteVideoPath)) {
      try {
        fs.unlinkSync(absoluteVideoPath);
      } catch (err) {
        console.error('Error deleting video file:', err);
      }
    }

    // Remove thumbnail
    if (asset.thumbnailPath) {
      const absoluteThumbPath = path.resolve(SERVER_ROOT, asset.thumbnailPath);
      if (fs.existsSync(absoluteThumbPath)) {
        try {
          fs.unlinkSync(absoluteThumbPath);
        } catch (err) {
          console.error('Error deleting thumbnail file:', err);
        }
      }
    }

    // Remove asset references from playlist
    await Playlist.updateOne(
      { channel: asset.channel },
      { $pull: { items: { asset: asset._id } } }
    );

    await Asset.findByIdAndDelete(req.params.id);

    // Recalculate channel storage after file deletion
    await calculateChannelStorage(asset.channel);

    return res.status(200).json({ message: 'Asset deleted successfully', assetId: req.params.id });
  } catch (error) {
    next(error);
  }
};

// GET /api/assets/storage/summary
export const getStorageSummary = async (req, res, next) => {
  try {
    const { channelId } = req.query;
    if (!channelId) {
      return res.status(400).json({ message: 'channelId is required' });
    }
    const quota = await checkStorageQuota(channelId);
    return res.status(200).json({ storage: quota });
  } catch (error) {
    next(error);
  }
};
