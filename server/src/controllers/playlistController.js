import {
  Playlist,
  PLAYLIST_TYPE,
  PLAYLIST_PRIORITY,
  SCHEDULE_OPTION,
  isPlaylistCurrentlyActive
} from '../models/Playlist.js';
import { Asset } from '../models/Asset.js';
import { Channel } from '../models/Channel.js';
import { formatDuration } from '../utils/media.js';
import { io } from '../server.js';
import { ROLES, PLAYLIST_ITEM_STATUS } from '../config/constants.js';

export { isPlaylistCurrentlyActive };

/**
 * Calculates item orders, cumulative start offsets, and total duration for a playlist.
 */
export const calculateFormattedItems = async (items = []) => {
  const assetIds = (items || []).map((it) => it.asset?._id || it.asset).filter(Boolean);
  const assets = await Asset.find({ _id: { $in: assetIds } });
  const assetMap = new Map(assets.map((a) => [String(a._id), a]));

  let cumulativeSeconds = 0;
  const formattedItems = [];

  for (let i = 0; i < (items || []).length; i++) {
    const it = items[i];
    const assetIdStr = String(it.asset?._id || it.asset);
    const assetObj = assetMap.get(assetIdStr);
    const duration = assetObj?.duration || 0;

    formattedItems.push({
      asset: assetIdStr,
      order: i + 1,
      startOffset: cumulativeSeconds,
      startOffsetFormatted: formatDuration(cumulativeSeconds),
      status: it.status || PLAYLIST_ITEM_STATUS.QUEUED
    });

    cumulativeSeconds += duration;
  }

  return {
    formattedItems,
    totalDuration: cumulativeSeconds,
    totalDurationFormatted: formatDuration(cumulativeSeconds)
  };
};

// GET /api/channels/:channelId/playlists
// Returns all playlists configured for this channel
export const getPlaylists = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { type, isActive } = req.query;

    const filter = { channel: channelId };
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const playlists = await Playlist.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .populate({
        path: 'items.asset',
        select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
      })
      .populate('createdBy', 'name email');

    return res.status(200).json({ playlists });
  } catch (error) {
    next(error);
  }
};

// GET /api/channels/:channelId/playlist
// Backwards compatible: returns the specified playlist (by query playlistId / type) or the channel's default playlist
export const getPlaylist = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { playlistId, type } = req.query;

    let query = { channel: channelId };
    if (playlistId) {
      query._id = playlistId;
    } else if (type) {
      query.type = type;
    } else {
      query.type = PLAYLIST_TYPE.DEFAULT;
    }

    let playlist = await Playlist.findOne(query).populate({
      path: 'items.asset',
      select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
    });

    // If default playlist doesn't exist, create it
    if (!playlist && (!type || type === PLAYLIST_TYPE.DEFAULT) && !playlistId) {
      playlist = await Playlist.create({
        channel: channelId,
        name: 'Default Playlist',
        type: PLAYLIST_TYPE.DEFAULT,
        priority: PLAYLIST_PRIORITY[PLAYLIST_TYPE.DEFAULT],
        scheduleOption: SCHEDULE_OPTION.NONE,
        items: [],
        createdBy: req.user._id
      });
    }

    return res.status(200).json({ playlist });
  } catch (error) {
    next(error);
  }
};

// GET /api/channels/:channelId/playlist/active
// Resolves the currently highest-priority active playlist based on schedule
export const getActivePlaylist = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const now = new Date();

    const playlists = await Playlist.find({ channel: channelId, isActive: true })
      .sort({ priority: -1 })
      .populate({
        path: 'items.asset',
        select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
      });

    // Find the highest priority playlist currently matching schedule
    const activePlaylist = playlists.find((p) => isPlaylistCurrentlyActive(p, now)) || null;

    return res.status(200).json({
      activePlaylist,
      allActiveCandidates: playlists.map((p) => ({
        _id: p._id,
        name: p.name,
        type: p.type,
        priority: p.priority,
        isCurrentlyActive: isPlaylistCurrentlyActive(p, now)
      }))
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/channels/:channelId/playlists
// Create a new playlist (default, scheduling, live_schedule, advertisement, emergency)
export const createPlaylist = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const {
      name,
      type = PLAYLIST_TYPE.DEFAULT,
      scheduleOption = SCHEDULE_OPTION.NONE,
      startDate,
      endDate,
      startTime,
      endTime,
      daysOfWeek = [],
      liveSourceUrl = '',
      loop = true,
      isActive = true,
      items = []
    } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Determine priority based on playlist type:
    // emergency (5) > advertisement (4) > live_schedule (3) > scheduling (2) > default (1)
    const priority = PLAYLIST_PRIORITY[type] || 1;

    const { formattedItems, totalDuration, totalDurationFormatted } = await calculateFormattedItems(items);

    const playlist = await Playlist.create({
      channel: channelId,
      name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} Playlist`,
      type,
      priority,
      scheduleOption,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      startTime: startTime || '',
      endTime: endTime || '',
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
      liveSourceUrl: liveSourceUrl || '',
      loop: loop !== undefined ? Boolean(loop) : true,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      items: formattedItems,
      totalDuration,
      totalDurationFormatted,
      createdBy: req.user._id
    });

    const populated = await Playlist.findById(playlist._id).populate({
      path: 'items.asset',
      select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
    });

    if (io) {
      io.to(`channel:${channelId}`).emit('playlists_updated', { channelId });
      io.to(`channel:${channelId}`).emit('playlist_updated', populated);
    }

    return res.status(201).json({
      message: 'Playlist created successfully',
      playlist: populated
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/channels/:channelId/playlists/:playlistId
// Update playlist settings, schedule, and items
export const updatePlaylist = async (req, res, next) => {
  try {
    const { channelId, playlistId } = req.params;
    const {
      name,
      type,
      scheduleOption,
      startDate,
      endDate,
      startTime,
      endTime,
      daysOfWeek,
      liveSourceUrl,
      loop,
      isActive,
      items
    } = req.body;

    let playlist = await Playlist.findOne({ _id: playlistId, channel: channelId });
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (name !== undefined) playlist.name = name;
    if (type !== undefined) {
      playlist.type = type;
      playlist.priority = PLAYLIST_PRIORITY[type] || 1;
    }
    if (scheduleOption !== undefined) playlist.scheduleOption = scheduleOption;
    if (startDate !== undefined) playlist.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) playlist.endDate = endDate ? new Date(endDate) : null;
    if (startTime !== undefined) playlist.startTime = startTime;
    if (endTime !== undefined) playlist.endTime = endTime;
    if (daysOfWeek !== undefined) playlist.daysOfWeek = Array.isArray(daysOfWeek) ? daysOfWeek : [];
    if (liveSourceUrl !== undefined) playlist.liveSourceUrl = liveSourceUrl;
    if (loop !== undefined) playlist.loop = Boolean(loop);
    if (isActive !== undefined) playlist.isActive = Boolean(isActive);

    if (items !== undefined) {
      const { formattedItems, totalDuration, totalDurationFormatted } = await calculateFormattedItems(items);
      playlist.items = formattedItems;
      playlist.totalDuration = totalDuration;
      playlist.totalDurationFormatted = totalDurationFormatted;
    }

    await playlist.save();

    const populated = await Playlist.findById(playlist._id).populate({
      path: 'items.asset',
      select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
    });

    if (io) {
      io.to(`channel:${channelId}`).emit('playlists_updated', { channelId });
      io.to(`channel:${channelId}`).emit('playlist_updated', populated);
    }

    return res.status(200).json({
      message: 'Playlist updated successfully',
      playlist: populated
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/channels/:channelId/playlist
// Save / reorder playlist items (defaults to default playlist or specified playlistId in body)
export const savePlaylist = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { items = [], loop, playlistId, type } = req.body || {};

    let query = { channel: channelId };
    if (playlistId) {
      query._id = playlistId;
    } else if (type) {
      query.type = type;
    } else {
      query.type = PLAYLIST_TYPE.DEFAULT;
    }

    let playlist = await Playlist.findOne(query);
    if (!playlist) {
      playlist = new Playlist({
        channel: channelId,
        name: type ? `${type.charAt(0).toUpperCase() + type.slice(1)} Playlist` : 'Default Playlist',
        type: type || PLAYLIST_TYPE.DEFAULT,
        priority: PLAYLIST_PRIORITY[type || PLAYLIST_TYPE.DEFAULT],
        items: [],
        createdBy: req.user._id
      });
    }

    if (loop !== undefined) {
      playlist.loop = loop;
    }

    const { formattedItems, totalDuration, totalDurationFormatted } = await calculateFormattedItems(items);
    playlist.items = formattedItems;
    playlist.totalDuration = totalDuration;
    playlist.totalDurationFormatted = totalDurationFormatted;

    await playlist.save();

    const populated = await Playlist.findById(playlist._id).populate({
      path: 'items.asset',
      select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
    });

    if (io) {
      io.to(`channel:${channelId}`).emit('playlists_updated', { channelId });
      io.to(`channel:${channelId}`).emit('playlist_updated', populated);
    }

    return res.status(200).json({
      message: 'Playlist saved successfully',
      playlist: populated
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/channels/:channelId/playlists/:playlistId
// Deletes a specific playlist
export const deletePlaylist = async (req, res, next) => {
  try {
    const { channelId, playlistId } = req.params;

    const playlist = await Playlist.findOne({ _id: playlistId, channel: channelId });
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    await Playlist.findByIdAndDelete(playlistId);

    if (io) {
      io.to(`channel:${channelId}`).emit('playlists_updated', { channelId });
    }

    return res.status(200).json({
      message: 'Playlist deleted successfully',
      playlistId
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/channels/:channelId/playlist
// Clear items of default playlist or specified playlist
export const clearPlaylist = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { playlistId, type } = req.query;

    let query = { channel: channelId };
    if (playlistId) {
      query._id = playlistId;
    } else if (type) {
      query.type = type;
    } else {
      query.type = PLAYLIST_TYPE.DEFAULT;
    }

    const playlist = await Playlist.findOneAndUpdate(
      query,
      { items: [], totalDuration: 0, totalDurationFormatted: '00:00:00' },
      { new: true }
    );

    if (io) {
      io.to(`channel:${channelId}`).emit('playlists_updated', { channelId });
      io.to(`channel:${channelId}`).emit('playlist_updated', playlist);
    }

    return res.status(200).json({
      message: 'Broadcast playlist cleared',
      playlist
    });
  } catch (error) {
    next(error);
  }
};
