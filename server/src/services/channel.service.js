import fs from 'fs';
import path from 'path';
import { Channel } from '../models/channel.model.js';
import { getChannelUploadsDir, findChannelUploadsDirById } from '../config/paths.js';
import { io } from '../server.js';

/**
 * Recursively calculate total size in bytes of all files in a directory
 */
export const calculateDirectorySize = (dirPath) => {
  if (!dirPath || !fs.existsSync(dirPath)) return 0;
  let totalBytes = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          totalBytes += calculateDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          totalBytes += stat.size;
        }
      } catch (statErr) {
        console.warn(`[channel.service] Warning reading stat for ${fullPath}:`, statErr.message);
      }
    }
  } catch (err) {
    console.warn(`[channel.service] Warning reading directory ${dirPath}:`, err.message);
  }

  return totalBytes;
};

/**
 * Calculate the specific channel's storage on disk and update its usedStorage field in DB
 * Scans the channel upload directory: server/uploads/${channelId}_${channelName}
 */
export const calculateChannelStorage = async (channelId) => {
  if (!channelId) return 0;

  try {
    const channel = await Channel.findById(channelId).select('name usedStorage allocatedStorage');
    if (!channel) return 0;

    let channelDir = getChannelUploadsDir(channel._id, channel.name);
    if (!fs.existsSync(channelDir)) {
      const fallbackDir = findChannelUploadsDirById(channel._id);
      if (fallbackDir && fs.existsSync(fallbackDir)) {
        channelDir = fallbackDir;
      }
    }

    const totalBytes = calculateDirectorySize(channelDir);

    await Channel.findByIdAndUpdate(channelId, {
      $set: { usedStorage: totalBytes }
    });

    if (io) {
      io.to(`channel:${channelId}`).emit('channel_storage_updated', {
        channelId: String(channelId),
        usedStorage: totalBytes,
        allocatedStorage: channel.allocatedStorage || 0
      });
    }

    return totalBytes;
  } catch (error) {
    console.error(`[channel.service] Error calculating storage for channel ${channelId}:`, error);
    return 0;
  }
};

/**
 * Validate whether incoming upload size (logo, video, bug, lband, ashton)
 * is within the channel's available storage quota.
 *
 * @param {string} channelId - Channel ID
 * @param {number} incomingBytes - Incoming file size in bytes
 * @returns {Promise<{ allowed: boolean, message?: string, totalUsed: number, allocatedStorage: number, remainingBytes: number, isUnlimited?: boolean }>}
 */
export const validateStorageAvailability = async (channelId, incomingBytes = 0) => {
  const channel = await Channel.findById(channelId).select('name usedStorage allocatedStorage');
  if (!channel) {
    return {
      allowed: false,
      message: 'Channel not found'
    };
  }

  const allocated = Number(channel.allocatedStorage) || 0;
  // If allocated is 0, storage quota is unlimited
  if (allocated === 0) {
    return {
      allowed: true,
      totalUsed: channel.usedStorage || 0,
      allocatedStorage: 0,
      remainingBytes: Infinity,
      isUnlimited: true
    };
  }

  // Calculate actual current storage from disk (or use cached channel.usedStorage)
  let currentUsed = Number(channel.usedStorage) || 0;
  if (!currentUsed) {
    currentUsed = await calculateChannelStorage(channelId);
  }

  const incoming = Number(incomingBytes) || 0;
  const remainingBytes = Math.max(0, allocated - currentUsed);

  if (currentUsed + incoming > allocated) {
    const formatBytes = (b) => {
      if (b >= 1024 * 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
      if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    };

    return {
      allowed: false,
      message: `No available storage remaining. Upload size (${formatBytes(incoming)}) exceeds remaining quota (${formatBytes(remainingBytes)} remaining of ${formatBytes(allocated)} allocated).`,
      totalUsed: currentUsed,
      allocatedStorage: allocated,
      remainingBytes,
      isUnlimited: false
    };
  }

  return {
    allowed: true,
    totalUsed: currentUsed,
    allocatedStorage: allocated,
    remainingBytes: remainingBytes - incoming,
    isUnlimited: false
  };
};

/**
 * Calculate storage for all channels and update each channel's usedStorage in DB
 */
export const calculateAllChannelsStorage = async () => {
  try {
    const channels = await Channel.find({}).select('_id name');
    const results = {};
    for (const ch of channels) {
      const used = await calculateChannelStorage(ch._id);
      results[String(ch._id)] = used;
    }
    return results;
  } catch (err) {
    console.error('[channel.service] Error calculating storage for all channels:', err);
    return {};
  }
};

/**
 * Background Cron Job: Runs every 1 minute to calculate and update storage for all channels
 */
class ChannelStorageCron {
  constructor() {
    this.timer = null;
    this.isChecking = false;
  }

  start() {
    if (this.timer) return;
    console.log('[ChannelStorageCron] Starting 1-minute storage scan cron job...');

    // Run initial scan in background shortly after start
    setTimeout(() => {
      this.runTick();
    }, 2000);

    // Recurring scan every 1 minute (60,000 ms)
    this.timer = setInterval(() => {
      this.runTick();
    }, 60 * 1000);
  }

  async runTick() {
    if (this.isChecking) return;
    this.isChecking = true;
    try {
      await calculateAllChannelsStorage();
    } catch (err) {
      console.error('[ChannelStorageCron] Cron tick error:', err);
    } finally {
      this.isChecking = false;
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[ChannelStorageCron] Stopped 1-minute storage scan cron job.');
    }
  }
}

export const channelStorageCron = new ChannelStorageCron();

export default {
  calculateDirectorySize,
  calculateChannelStorage,
  calculateAllChannelsStorage,
  channelStorageCron
};

