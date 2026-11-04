import fs from 'fs';
import path from 'path';
import { Channel } from '../models/Channel.js';
import { Asset } from '../models/Asset.js';
import {
  UPLOADS_DIR,
  ensureChannelUploadDirs,
  getChannelFolderName,
  CHANNEL_SUBFOLDERS
} from '../config/paths.js';

export const migrateUploadsToChannelFolders = async () => {
  try {
    const channels = await Channel.find({});
    if (!channels || channels.length === 0) return;

    console.log(`[Uploads Migration] Checking ${channels.length} channel(s) for folder structure alignment...`);

    const legacyVideosDir = path.join(UPLOADS_DIR, 'videos');
    const legacyThumbsDir = path.join(UPLOADS_DIR, 'thumbnails');
    const legacyBrandingDir = path.join(UPLOADS_DIR, 'branding');

    for (const ch of channels) {
      const channelId = String(ch._id);
      const channelName = ch.name || 'channel';
      const channelFolder = getChannelFolderName(channelId, channelName);
      const dirs = ensureChannelUploadDirs(channelId, channelName);

      // 1. Migrate Videos from server/uploads/videos/${channelId} -> server/uploads/${channelFolder}/video/
      const oldChannelVideoDir = path.join(legacyVideosDir, channelId);
      if (fs.existsSync(oldChannelVideoDir)) {
        const files = fs.readdirSync(oldChannelVideoDir);
        for (const f of files) {
          const oldFilePath = path.join(oldChannelVideoDir, f);
          const newFilePath = path.join(dirs.videoDir, f);
          if (fs.existsSync(oldFilePath) && !fs.existsSync(newFilePath)) {
            try {
              fs.renameSync(oldFilePath, newFilePath);
            } catch {
              fs.copyFileSync(oldFilePath, newFilePath);
              fs.unlinkSync(oldFilePath);
            }
          }
        }
        try {
          fs.rmdirSync(oldChannelVideoDir);
        } catch {}
      }

      // 2. Migrate Assets in DB & Thumbnails
      const assets = await Asset.find({ channel: channelId });
      for (const asset of assets) {
        let modified = false;

        // Check if filePath needs migration
        if (asset.filePath) {
          const baseName = path.basename(asset.filePath);
          const expectedRelPath = `uploads/${channelFolder}/${CHANNEL_SUBFOLDERS.VIDEO}/${baseName}`;
          if (asset.filePath !== expectedRelPath) {
            asset.filePath = expectedRelPath;
            modified = true;
          }
        }

        // Migrate Thumbnail file
        if (asset.thumbnailPath) {
          const thumbBase = path.basename(asset.thumbnailPath);
          const oldThumbPath = path.join(legacyThumbsDir, thumbBase);
          const newThumbPath = path.join(dirs.thumbnailsDir, thumbBase);
          if (fs.existsSync(oldThumbPath) && !fs.existsSync(newThumbPath)) {
            try {
              fs.renameSync(oldThumbPath, newThumbPath);
            } catch {
              fs.copyFileSync(oldThumbPath, newThumbPath);
              fs.unlinkSync(oldThumbPath);
            }
          }
          const expectedThumbRel = `uploads/${channelFolder}/${CHANNEL_SUBFOLDERS.THUMBNAILS}/${thumbBase}`;
          if (asset.thumbnailPath !== expectedThumbRel) {
            asset.thumbnailPath = expectedThumbRel;
            modified = true;
          }
        }

        if (modified) {
          await asset.save();
        }
      }

      // 3. Migrate Branding files (Logo, Bug, LBand, Ashton)
      if (fs.existsSync(legacyBrandingDir)) {
        const brandingFiles = fs.readdirSync(legacyBrandingDir);
        for (const bf of brandingFiles) {
          if (!bf.includes(channelId)) continue;
          const oldBfPath = path.join(legacyBrandingDir, bf);
          let targetDir = null;

          if (bf.startsWith('logo_') || bf.startsWith('bug_')) {
            targetDir = dirs.logoDir;
          } else if (bf.startsWith('lband_')) {
            targetDir = dirs.lbandDir;
          } else if (bf.startsWith('ashton_')) {
            targetDir = dirs.ashtonDir;
          }

          if (targetDir) {
            const newBfPath = path.join(targetDir, bf);
            if (fs.existsSync(oldBfPath) && !fs.existsSync(newBfPath)) {
              try {
                fs.renameSync(oldBfPath, newBfPath);
              } catch {
                fs.copyFileSync(oldBfPath, newBfPath);
                fs.unlinkSync(oldBfPath);
              }
            }
          }
        }
      }

      // 4. Update Channel branding assetPaths in DB
      let channelBrandingModified = false;
      if (ch.branding) {
        if (ch.branding.logo?.assetPath) {
          const base = path.basename(ch.branding.logo.assetPath);
          const newPath = `uploads/${channelFolder}/${CHANNEL_SUBFOLDERS.LOGO}/${base}`;
          if (ch.branding.logo.assetPath !== newPath) {
            ch.branding.logo.assetPath = newPath;
            channelBrandingModified = true;
          }
        }
        if (ch.branding.bug?.assetPath) {
          const base = path.basename(ch.branding.bug.assetPath);
          const newPath = `uploads/${channelFolder}/${CHANNEL_SUBFOLDERS.LOGO}/${base}`;
          if (ch.branding.bug.assetPath !== newPath) {
            ch.branding.bug.assetPath = newPath;
            channelBrandingModified = true;
          }
        }
        if (ch.branding.lband?.assetPath) {
          const base = path.basename(ch.branding.lband.assetPath);
          const newPath = `uploads/${channelFolder}/${CHANNEL_SUBFOLDERS.LBAND}/${base}`;
          if (ch.branding.lband.assetPath !== newPath) {
            ch.branding.lband.assetPath = newPath;
            channelBrandingModified = true;
          }
        }
        if (ch.branding.ashton?.assetPath) {
          const base = path.basename(ch.branding.ashton.assetPath);
          const newPath = `uploads/${channelFolder}/${CHANNEL_SUBFOLDERS.ASHTON}/${base}`;
          if (ch.branding.ashton.assetPath !== newPath) {
            ch.branding.ashton.assetPath = newPath;
            channelBrandingModified = true;
          }
        }
        if (channelBrandingModified) {
          await ch.save();
        }
      }
    }

    // Clean up old legacy folders if empty
    [legacyVideosDir, legacyThumbsDir, legacyBrandingDir].forEach((dir) => {
      try {
        if (fs.existsSync(dir)) {
          const items = fs.readdirSync(dir);
          if (items.length === 0) {
            fs.rmdirSync(dir);
          }
        }
      } catch {}
    });

    console.log('[Uploads Migration] Channel upload structure verified and synced.');
  } catch (err) {
    console.warn('[Uploads Migration] Migration notice:', err.message);
  }
};

