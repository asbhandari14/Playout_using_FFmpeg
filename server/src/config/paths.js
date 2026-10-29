import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of server project: d:\Office_Work\10.   Playlist_Playout_using_Ffmpeg\server
export const SERVER_ROOT = path.resolve(__dirname, '../../');

export const UPLOADS_DIR = path.resolve(SERVER_ROOT, 'uploads');
export const TEMP_DIR = path.resolve(UPLOADS_DIR, 'temp');
export const VIDEOS_DIR = path.resolve(UPLOADS_DIR, 'videos');
export const THUMBNAILS_DIR = path.resolve(UPLOADS_DIR, 'thumbnails');
export const BRANDING_DIR = path.resolve(UPLOADS_DIR, 'branding');
export const STREAMS_DIR = path.resolve(SERVER_ROOT, 'streams');

// Ensure all essential directories exist
[UPLOADS_DIR, TEMP_DIR, VIDEOS_DIR, THUMBNAILS_DIR, BRANDING_DIR, STREAMS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
