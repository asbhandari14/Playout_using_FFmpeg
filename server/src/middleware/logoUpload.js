import multer from 'multer';
import path from 'path';
import { Channel } from '../models/Channel.js';
import { ensureChannelUploadDirs } from '../config/paths.js';

const getChannelSubdir = async (req, subfolderKey) => {
  const channelId = req.params?.channelId || req.body?.channelId || 'default';
  let channelName = req.body?.channelName;
  if (!channelName && channelId !== 'default') {
    try {
      const ch = await Channel.findById(channelId).select('name');
      channelName = ch?.name;
    } catch {}
  }
  const dirs = ensureChannelUploadDirs(channelId, channelName);
  return dirs[subfolderKey] || dirs.baseDir;
};

const imageFilter = (req, file, cb) => {
  const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image type. Please upload transparent PNG or JPG.'), false);
  }
};

// Logo -> logo_img
const logoStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const dir = await getChannelSubdir(req, 'logoDir');
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `logo_${Date.now()}${ext}`);
  }
});

export const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

// L-Band -> lband_img
const lbandStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const dir = await getChannelSubdir(req, 'lbandDir');
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `lband_${Date.now()}${ext}`);
  }
});

export const uploadLBand = multer({
  storage: lbandStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Ashton Band -> ashtonBand_img
const ashtonStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const dir = await getChannelSubdir(req, 'ashtonDir');
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `ashton_${Date.now()}${ext}`);
  }
});

export const uploadAshton = multer({
  storage: ashtonStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Station Bug -> logo_img
const bugStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const dir = await getChannelSubdir(req, 'logoDir');
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `bug_${Date.now()}${ext}`);
  }
});

const bugFilter = (req, file, cb) => {
  const allowed = ['.png', '.mov'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PNG (.png) and QuickTime MOV (.mov) files are supported for Station Bug.'), false);
  }
};

export const uploadBug = multer({
  storage: bugStorage,
  fileFilter: bugFilter,
  limits: { fileSize: 300 * 1024 * 1024 }
});
