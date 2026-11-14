import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of server project: d:\Office_Work\10.   Playlist_Playout_using_Ffmpeg\server
export const SERVER_ROOT = path.resolve(__dirname, '../../');

// Main uploads & streams directories inside server
export const UPLOADS_DIR = path.resolve(SERVER_ROOT, 'uploads');
export const TEMP_DIR = path.resolve(UPLOADS_DIR, 'temp');
export const STREAMS_DIR = path.resolve(SERVER_ROOT, 'streams');

// Backward compatibility references (mapped to channel folders)
export const VIDEOS_DIR = path.resolve(UPLOADS_DIR, 'videos');
export const THUMBNAILS_DIR = path.resolve(UPLOADS_DIR, 'thumbnails');
export const BRANDING_DIR = path.resolve(UPLOADS_DIR, 'branding');

export const CHANNEL_SUBFOLDERS = {
  THUMBNAILS: 'thumbnails_img',
  VIDEO: 'video',
  LOGO: 'logo_img',
  LBAND: 'lband_img',
  ASHTON: 'ashtonBand_img',
  TIMER: 'timer_img'
};

/**
 * Sanitize channel name for safe folder path
 */
export const sanitizeChannelName = (name) => {
  if (!name) return 'channel';
  return String(name).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
};

/**
 * Get channel folder name: ${channelId}_${channelName}
 */
export const getChannelFolderName = (channelId, channelName) => {
  const safeName = sanitizeChannelName(channelName);
  return `${channelId}_${safeName}`;
};

/**
 * Find existing channel folder inside server/uploads if it starts with channelId_
 */
export const findChannelUploadsDirById = (channelId) => {
  if (!channelId) return null;
  const idStr = String(channelId);
  try {
    if (fs.existsSync(UPLOADS_DIR)) {
      const items = fs.readdirSync(UPLOADS_DIR);
      const match = items.find((item) => item.startsWith(`${idStr}_`));
      if (match) {
        return path.resolve(UPLOADS_DIR, match);
      }
    }
  } catch (err) {
    console.warn('[paths] Error searching for channel uploads dir by id:', err.message);
  }
  return null;
};

/**
 * Get channel base uploads directory: server/uploads/${channelId}_${channelName}
 */
export const getChannelUploadsDir = (channelId, channelName) => {
  if (channelName) {
    const folder = getChannelFolderName(channelId, channelName);
    return path.resolve(UPLOADS_DIR, folder);
  }
  const existing = findChannelUploadsDirById(channelId);
  if (existing) return existing;
  return path.resolve(UPLOADS_DIR, `${channelId}_channel`);
};

/**
 * Ensure channel upload directories exist:
 * server/uploads/${channelId}_${channelName}/
 *   - thumbnails_img/
 *   - video/
 *   - logo_img/
 *   - lband_img/
 *   - ashtonBand_img/
 */
export const ensureChannelUploadDirs = (channelId, channelName) => {
  const channelBaseDir = getChannelUploadsDir(channelId, channelName);
  const dirs = {
    baseDir: channelBaseDir,
    thumbnailsDir: path.join(channelBaseDir, CHANNEL_SUBFOLDERS.THUMBNAILS),
    videoDir: path.join(channelBaseDir, CHANNEL_SUBFOLDERS.VIDEO),
    logoDir: path.join(channelBaseDir, CHANNEL_SUBFOLDERS.LOGO),
    lbandDir: path.join(channelBaseDir, CHANNEL_SUBFOLDERS.LBAND),
    ashtonDir: path.join(channelBaseDir, CHANNEL_SUBFOLDERS.ASHTON),
    timerDir: path.join(channelBaseDir, CHANNEL_SUBFOLDERS.TIMER)
  };

  Object.values(dirs).forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return dirs;
};

// Ensure base server uploads, temp, and streams directories exist
[UPLOADS_DIR, TEMP_DIR, STREAMS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
