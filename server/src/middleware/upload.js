import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { TEMP_DIR, VIDEOS_DIR } from '../config/paths.js';

// Storage engine for chunked uploads
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const rawId = req.body?.uploadId || req.query?.uploadId || req.headers['x-upload-id'] || 'general';
    const safeUploadId = String(rawId).replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkDir = path.join(TEMP_DIR, safeUploadId);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }
    cb(null, chunkDir);
  },
  filename: (req, file, cb) => {
    const chunkIndex = req.body?.chunkIndex ?? req.query?.chunkIndex ?? req.headers['x-chunk-index'] ?? '0';
    cb(null, `chunk_${chunkIndex}`);
  }
});

// Storage engine for direct file upload
const directStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const channelId = req.body.channelId || req.params.channelId || 'default';
    const channelDir = path.join(VIDEOS_DIR, channelId);
    if (!fs.existsSync(channelDir)) {
      fs.mkdirSync(channelDir, { recursive: true });
    }
    cb(null, channelDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `video_${uniqueSuffix}${ext}`);
  }
});

// File filter for video assets
const videoFilter = (req, file, cb) => {
  const allowedExtensions = ['.mp4', '.mov', '.mkv', '.ts', '.avi', '.flv', '.m4v'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext) || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type '${ext}'. Allowed: mp4, mov, mkv, ts, avi, flv, m4v`), false);
  }
};

export const uploadChunk = multer({
  storage: chunkStorage,
  limits: { fileSize: 250 * 1024 * 1024 } // 50MB per chunk max
});

export const uploadDirect = multer({
  storage: directStorage,
  fileFilter: videoFilter,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB max per file
});
