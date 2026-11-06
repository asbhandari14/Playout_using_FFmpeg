import fs from 'fs';
import path from 'path';
import { Channel } from '../models/channel.model.js';
import { User } from '../models/user.model.js';
import { Server } from '../models/server.model.js';
import { Playlist } from '../models/playlist.model.js';
import { Asset } from '../models/asset.model.js';
import { ROLES, CHANNEL_STATUS } from '../config/constants.js';
import { createFlussonicStream, deleteFlussonicStream, sanitizeStreamKey } from '../services/flussonicService.js';
import {
  ensureChannelUploadDirs,
  getChannelUploadsDir,
  getChannelFolderName,
  findChannelUploadsDirById,
  STREAMS_DIR
} from '../config/paths.js';
import { z } from 'zod';

export const parseStorageToBytes = (amount, unit = 'GB') => {
  const val = Number(amount);
  if (!val || val <= 0 || isNaN(val)) return 0;
  const u = String(unit).trim().toUpperCase();
  if (u === 'TB') return Math.round(val * 1024 * 1024 * 1024 * 1024);
  if (u === 'MB') return Math.round(val * 1024 * 1024);
  return Math.round(val * 1024 * 1024 * 1024);
};

// GET /api/channels
export const getChannels = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const filter = {};

    // RBAC:
    if (req.user.role === ROLES.USER) {
      // User can only see channels assigned to them
      filter.assignedUser = req.user._id;
    } else if (req.user.role === ROLES.ADMIN) {
      // Admin sees channels created by them OR assigned to users they created
      const managedUsers = await User.find({ createdBy: req.user._id }).select('_id');
      const managedUserIds = managedUsers.map(u => u._id);
      filter.$or = [
        { createdBy: req.user._id },
        { assignedUser: { $in: [...managedUserIds, req.user._id] } }
      ];
    }

    if (status && Object.values(CHANNEL_STATUS).includes(status)) {
      filter.status = status;
    }

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const channels = await Channel.find(filter)
      .populate('server', 'name streamUrl rtmpBaseUrl hlsBaseUrl category')
      .populate('assignedUser', 'name email role')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({ channels, total: channels.length });
  } catch (error) {
    next(error);
  }
};

// GET /api/channels/:id
export const getChannelById = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id)
      .populate('server', 'name streamUrl rtmpBaseUrl hlsBaseUrl category')
      .populate('assignedUser', 'name email role')
      .populate('createdBy', 'name email role');

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // RBAC check:
    if (req.user.role === ROLES.USER && String(channel.assignedUser?._id || channel.assignedUser) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this channel' });
    }

    if (req.user.role === ROLES.ADMIN) {
      const isOwner = String(channel.createdBy?._id || channel.createdBy) === String(req.user._id);
      const isAssigned = String(channel.assignedUser?._id || channel.assignedUser) === String(req.user._id);
      const userManaged = await User.exists({ _id: channel.assignedUser?._id || channel.assignedUser, createdBy: req.user._id });
      if (!isOwner && !isAssigned && !userManaged) {
        return res.status(403).json({ message: 'Forbidden: You do not manage this channel' });
      }
    }

    return res.status(200).json({ channel });
  } catch (error) {
    next(error);
  }
};

// POST /api/channels
export const createChannel = async (req, res, next) => {
  try {
    const { name, server, assignedUser, streamKey, outputSettings, allocatedStorage } = req.body;

    // Verify server exists (select +serverPasswordEncrypted for Flussonic authentication)
    const serverExists = await Server.findById(server).select('+serverPasswordEncrypted');
    if (!serverExists) {
      return res.status(404).json({ message: 'Specified server does not exist' });
    }

    // Verify assigned user exists
    const userExists = await User.findById(assignedUser);
    if (!userExists) {
      return res.status(404).json({ message: 'Assigned user does not exist' });
    }

    // Admin can only assign server/user that they created or themselves
    if (req.user.role === ROLES.ADMIN) {
      if (String(serverExists.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Admins can only use servers they created' });
      }
      if (String(userExists.createdBy) !== String(req.user._id) && String(userExists._id) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Admins can only assign users they created' });
      }
    }

    // Derive HLS and RTMP URLs from Server's streamUrl and Channel Name
    const streamUrl = serverExists.streamUrl || serverExists.hlsBaseUrl || 'http://127.0.0.1:81';
    let cleanUrl = streamUrl.trim().replace(/\/+$/, '');
    let hostname = '127.0.0.1';
    try {
      const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `http://${cleanUrl}`);
      hostname = parsed.hostname;
      cleanUrl = `${parsed.protocol}//${parsed.host}`;
    } catch (e) {
      const match = cleanUrl.match(/^(?:https?:\/\/)?([^:/]+)/i);
      if (match) hostname = match[1];
    }

    const channelNameClean = name.trim();
    const actualStreamKey = sanitizeStreamKey(streamKey) || sanitizeStreamKey(channelNameClean);
    const hlsUrl = `${cleanUrl}/${actualStreamKey}/index.m3u8`;
    const rtmpUrl = `rtmp://${hostname}/static/${actualStreamKey}`;

    let finalAllocatedStorage = Number(allocatedStorage) || 0;
    if (req.body.allocatedStorageAmount !== undefined && req.body.allocatedStorageAmount !== '') {
      finalAllocatedStorage = parseStorageToBytes(req.body.allocatedStorageAmount, req.body.allocatedStorageUnit);
    }

    const channel = await Channel.create({
      name: channelNameClean,
      server,
      assignedUser,
      streamKey: actualStreamKey,
      allocatedStorage: finalAllocatedStorage,
      hlsUrl,
      rtmpUrl,
      outputSettings: {
        resolution: outputSettings?.resolution || '1280x720',
        width: 1280,
        height: 720,
        fps: outputSettings?.fps || 25,
        videoBitrate: outputSettings?.videoBitrate || '2500k',
        audioBitrate: outputSettings?.audioBitrate || '128k'
      },
      createdBy: req.user._id
    });

    // Ensure channel upload folder structure exists: uploads/${channelId}_${channelName}/
    ensureChannelUploadDirs(channel._id, channel.name);

    // Automatically create empty playlist for this channel
    await Playlist.create({
      channel: channel._id,
      items: [],
      createdBy: req.user._id
    });

    // Automatically provision the channel stream in Flussonic Media Server
    let flussonicSync = null;
    try {
      flussonicSync = await createFlussonicStream(serverExists, actualStreamKey, {
        title: channelNameClean
      });
    } catch (fErr) {
      console.warn('[Channel] Flussonic auto-provisioning notice:', fErr.message);
      flussonicSync = { success: false, message: fErr.message };
    }

    const populated = await Channel.findById(channel._id)
      .populate('server', 'name streamUrl rtmpBaseUrl hlsBaseUrl category')
      .populate('assignedUser', 'name email role')
      .populate('createdBy', 'name email role');

    return res.status(201).json({
      message: flussonicSync?.success
        ? `Channel '${channelNameClean}' created and provisioned on Flussonic Media Server`
        : `Channel '${channelNameClean}' created successfully (${flussonicSync?.message || 'Flussonic stream configured'})`,
      channel: populated,
      flussonicSync
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/channels/:id
export const updateChannel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, server, assignedUser, streamKey, outputSettings, allocatedStorage } = req.body || {};
    const channel = await Channel.findById(id);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // RBAC: Admins can only edit channels they created
    if (req.user.role === ROLES.ADMIN && String(channel.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You cannot modify channels you did not create' });
    }

    const oldName = channel.name;
    const oldServerId = String(channel.server);
    const oldStreamKey = channel.streamKey;

    if (name) channel.name = name.trim();
    if (server) channel.server = server;
    if (assignedUser) channel.assignedUser = assignedUser;
    if (streamKey) channel.streamKey = sanitizeStreamKey(streamKey);
    if (allocatedStorage !== undefined) {
      channel.allocatedStorage = Math.max(0, Number(allocatedStorage));
    } else if (req.body.allocatedStorageAmount !== undefined) {
      channel.allocatedStorage = parseStorageToBytes(req.body.allocatedStorageAmount, req.body.allocatedStorageUnit);
    }
    if (outputSettings) {
      channel.outputSettings = { ...channel.outputSettings.toObject(), ...outputSettings };
    }

    // Recompute HLS & RTMP URLs if name, streamKey or server updated
    const targetServer = await Server.findById(channel.server).select('+serverPasswordEncrypted');
    if (targetServer) {
      const sUrl = targetServer.streamUrl || targetServer.hlsBaseUrl || 'http://127.0.0.1:81';
      let cleanUrl = sUrl.trim().replace(/\/+$/, '');
      let hostname = '127.0.0.1';
      try {
        const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `http://${cleanUrl}`);
        hostname = parsed.hostname;
        cleanUrl = `${parsed.protocol}//${parsed.host}`;
      } catch (e) {
        const match = cleanUrl.match(/^(?:https?:\/\/)?([^:/]+)/i);
        if (match) hostname = match[1];
      }
      const streamIdentifier = sanitizeStreamKey(channel.streamKey || channel.name);
      channel.hlsUrl = `${cleanUrl}/${streamIdentifier}/index.m3u8`;
      channel.rtmpUrl = `rtmp://${hostname}/static/${streamIdentifier}`;
    }

    await channel.save();

    // If channel name changed, rename upload directory and update DB asset/branding paths
    if (channel.name !== oldName) {
      const oldUploadDir = getChannelUploadsDir(id, oldName);
      const newUploadDir = getChannelUploadsDir(id, channel.name);
      const oldFolder = getChannelFolderName(id, oldName);
      const newFolder = getChannelFolderName(id, channel.name);

      if (fs.existsSync(oldUploadDir) && oldUploadDir !== newUploadDir) {
        try {
          fs.renameSync(oldUploadDir, newUploadDir);

          const assets = await Asset.find({ channel: id });
          for (const a of assets) {
            let changed = false;
            if (a.filePath && a.filePath.includes(`uploads/${oldFolder}/`)) {
              a.filePath = a.filePath.replace(`uploads/${oldFolder}/`, `uploads/${newFolder}/`);
              changed = true;
            }
            if (a.thumbnailPath && a.thumbnailPath.includes(`uploads/${oldFolder}/`)) {
              a.thumbnailPath = a.thumbnailPath.replace(`uploads/${oldFolder}/`, `uploads/${newFolder}/`);
              changed = true;
            }
            if (changed) await a.save();
          }

          if (channel.branding) {
            ['logo', 'bug', 'lband', 'ashton'].forEach((key) => {
              if (channel.branding[key]?.assetPath?.includes(`uploads/${oldFolder}/`)) {
                channel.branding[key].assetPath = channel.branding[key].assetPath.replace(
                  `uploads/${oldFolder}/`,
                  `uploads/${newFolder}/`
                );
              }
            });
            await channel.save();
          }
        } catch (renameErr) {
          console.warn('[Channel] Error renaming uploads directory on channel update:', renameErr.message);
        }
      }
    }

    // If channel name, streamKey or server changed, sync with Flussonic
    let flussonicSync = null;
    if (targetServer && (channel.name !== oldName || String(channel.server) !== oldServerId || channel.streamKey !== oldStreamKey)) {
      try {
        const streamIdentifier = sanitizeStreamKey(channel.streamKey || channel.name);
        flussonicSync = await createFlussonicStream(targetServer, streamIdentifier, {
          title: channel.name
        });
      } catch (fErr) {
        console.warn('[Channel] Flussonic update sync notice:', fErr.message);
      }
    }

    const updated = await Channel.findById(id)
      .populate('server', 'name streamUrl rtmpBaseUrl hlsBaseUrl category')
      .populate('assignedUser', 'name email role')
      .populate('createdBy', 'name email role');

    return res.status(200).json({
      message: 'Channel updated successfully',
      channel: updated,
      flussonicSync
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/channels/:id
export const deleteChannel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const channel = await Channel.findById(id);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    if (req.user.role === ROLES.ADMIN && String(channel.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You cannot delete channels you did not create' });
    }

    // Cannot delete if channel is currently live
    if (channel.status === CHANNEL_STATUS.LIVE) {
      return res.status(400).json({ message: 'Cannot delete a channel while it is broadcasting live. Stop stream first.' });
    }

    // Delete stream configuration from Flussonic Media Server too
    try {
      const server = await Server.findById(channel.server).select('+serverPasswordEncrypted');
      if (server) {
        const streamIdentifier = sanitizeStreamKey(channel.streamKey || channel.name);
        await deleteFlussonicStream(server, streamIdentifier);
      }
    } catch (fErr) {
      console.warn('[Channel] Flussonic stream deletion notice:', fErr.message);
    }

    // Delete channel assets from database
    await Asset.deleteMany({ channel: id });

    // Delete playlist
    await Playlist.deleteMany({ channel: id });

    // Delete channel uploads folder on disk: uploads/${channelId}_${channelName}/
    try {
      const channelUploadDir = getChannelUploadsDir(id, channel.name);
      if (fs.existsSync(channelUploadDir)) {
        fs.rmSync(channelUploadDir, { recursive: true, force: true });
      }
      const fallbackDir = findChannelUploadsDirById(id);
      if (fallbackDir && fs.existsSync(fallbackDir)) {
        fs.rmSync(fallbackDir, { recursive: true, force: true });
      }
    } catch (fsErr) {
      console.warn('[Channel] Error removing channel uploads dir on deletion:', fsErr.message);
    }

    // Delete channel runtime stream folder on disk: streams/${channelId}/
    try {
      const streamFolder = path.join(STREAMS_DIR, String(id));
      if (fs.existsSync(streamFolder)) {
        fs.rmSync(streamFolder, { recursive: true, force: true });
      }
    } catch (stErr) {
      console.warn('[Channel] Error removing channel stream runtime dir:', stErr.message);
    }

    await Channel.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Channel deleted successfully from system and Flussonic' });
  } catch (error) {
    next(error);
  }
};

// Check Channel Online Or Offline
export const CheckChannelOnlineOrOffline = async (req, res) => {
  try {
    let { hlsUrl } = req.body || {};
    const { channelId, id } = req.params || {};

    if (!hlsUrl && (channelId || id)) {
      const channel = await Channel.findById(channelId || id);
      if (channel) {
        hlsUrl =
          channel.hlsUrl ||
          (channel.server?.hlsBaseUrl && channel.streamKey
            ? `${channel.server.hlsBaseUrl}/${channel.streamKey}/index.m3u8`
            : null);
      }
    }

    if (!hlsUrl) {
      return res.status(400).json({
        success: false,
        message: 'hlsUrl is required.'
      });
    }

    let isOnline = false;
    try {
      let targetUrl = String(hlsUrl).trim();
      if (targetUrl.startsWith('/')) {
        const port = process.env.PORT || 5000;
        targetUrl = `http://127.0.0.1:${port}${targetUrl}`;
      }

      let data = '';
      try {
        const axiosModule = await import('axios');
        const axios = axiosModule.default || axiosModule;
        const response = await axios.get(targetUrl, { timeout: 5000 });
        data =
          typeof response.data === 'string'
            ? response.data.trim()
            : response.data
              ? JSON.stringify(response.data)
              : '';
      } catch {
        // Fallback to native Node fetch if axios is unavailable or throws
        if (typeof fetch === 'function') {
          const response = await fetch(targetUrl, { signal: AbortSignal.timeout(5000) });
          if (response.ok) {
            data = (await response.text()).trim();
          }
        }
      }

      if (data && data.toLowerCase() !== 'not found' && !data.toLowerCase().includes('cannot get')) {
        isOnline = true;
      }
    } catch {
      isOnline = false;
    }

    if (isOnline) {
      return res.status(200).json({
        success: true,
        status: 'Online',
        isOnline: true
      });
    } else {
      return res.status(200).json({
        success: true,
        status: 'Offline',
        isOnline: false
      });
    }
  } catch (error) {
    console.error('error', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};

