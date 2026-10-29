import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { BRANDING_DIR } from '../config/paths.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(BRANDING_DIR)) {
      fs.mkdirSync(BRANDING_DIR, { recursive: true });
    }
    cb(null, BRANDING_DIR);
  },
  filename: (req, file, cb) => {
    const channelId = req.params.channelId || 'default';
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `logo_${channelId}_${Date.now()}${ext}`);
  }
});

const imageFilter = (req, file, cb) => {
  const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image type. Please upload transparent PNG or JPG.'), false);
  }
};

export const uploadLogo = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

const lbandStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(BRANDING_DIR)) {
      fs.mkdirSync(BRANDING_DIR, { recursive: true });
    }
    cb(null, BRANDING_DIR);
  },
  filename: (req, file, cb) => {
    const channelId = req.params.channelId || 'default';
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `lband_${channelId}_${Date.now()}${ext}`);
  }
});

export const uploadLBand = multer({
  storage: lbandStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 25 * 1024 * 1024 }
});

const ashtonStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(BRANDING_DIR)) {
      fs.mkdirSync(BRANDING_DIR, { recursive: true });
    }
    cb(null, BRANDING_DIR);
  },
  filename: (req, file, cb) => {
    const channelId = req.params.channelId || 'default';
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `ashton_${channelId}_${Date.now()}${ext}`);
  }
});

export const uploadAshton = multer({
  storage: ashtonStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 25 * 1024 * 1024 }
});
