import { Router } from 'express';
import { Playlist } from '../models/playlist.model.js';
import { Channel } from '../models/channel.model.js';
import { User } from '../models/user.model.js';
import { ROLES } from '../config/constants.js';
import {
  createPlaylist,
  updatePlaylist,
  deletePlaylist
} from '../controllers/playlist.controller.js';
import { getCurrentlyPlayingHandler } from '../controllers/stream.controller.js';
import { auth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(auth);

// Now Playing playout status for a channel
router.get('/:channelId/now-playing', getCurrentlyPlayingHandler);
router.get('/:channelId/currently-playing', getCurrentlyPlayingHandler);

// GET /api/playlists - List playlists across channels (or filtered by ?channelId=...&type=...)
router.get('/', async (req, res, next) => {
  try {
    const { channelId, type, isActive } = req.query;
    const filter = {};

    // RBAC: regular user only sees playlists for channels assigned to them
    if (req.user.role === ROLES.USER) {
      const userChannels = await Channel.find({
        $or: [{ assignedUser: req.user._id }, { createdBy: req.user._id }]
      }).select('_id');
      const userChannelIds = userChannels.map((c) => c._id);

      if (channelId) {
        if (!userChannelIds.some((id) => String(id) === String(channelId))) {
          return res.status(200).json({ playlists: [] });
        }
        filter.channel = channelId;
      } else {
        filter.channel = { $in: userChannelIds };
      }
    } else if (req.user.role === ROLES.ADMIN) {
      const managedUsers = await User.find({ createdBy: req.user._id }).select('_id');
      const managedUserIds = managedUsers.map((u) => u._id);
      const adminChannels = await Channel.find({
        $or: [
          { createdBy: req.user._id },
          { assignedUser: { $in: [...managedUserIds, req.user._id] } }
        ]
      }).select('_id');
      const adminChannelIds = adminChannels.map((c) => c._id);

      if (channelId) {
        if (!adminChannelIds.some((id) => String(id) === String(channelId))) {
          return res.status(200).json({ playlists: [] });
        }
        filter.channel = channelId;
      } else {
        filter.channel = { $in: adminChannelIds };
      }
    } else {
      if (channelId) filter.channel = channelId;
    }

    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const playlists = await Playlist.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .populate('channel', 'name status hlsUrl streamKey')
      .populate({
        path: 'items.asset',
        select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
      })
      .populate('createdBy', 'name email');

    return res.status(200).json({ playlists });
  } catch (err) {
    next(err);
  }
});

// POST /api/playlists - Create new playlist
router.post('/', async (req, res, next) => {
  const channelId = req.body.channelId || req.body.channel;
  if (!channelId) {
    return res.status(400).json({ message: 'channelId is required to create a playlist' });
  }

  if (req.user.role === ROLES.USER) {
    const ch = await Channel.findById(channelId);
    if (!ch || (String(ch.assignedUser) !== String(req.user._id) && String(ch.createdBy) !== String(req.user._id))) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this channel' });
    }
  }

  req.params.channelId = channelId;
  return createPlaylist(req, res, next);
});

// GET /api/playlists/:playlistId
router.get('/:playlistId', async (req, res, next) => {
  try {
    const playlist = await Playlist.findById(req.params.playlistId)
      .populate('channel', 'name status hlsUrl streamKey assignedUser createdBy')
      .populate({
        path: 'items.asset',
        select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
      })
      .populate('createdBy', 'name email');

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (req.user.role === ROLES.USER) {
      const chAssigned = String(playlist.channel?.assignedUser?._id || playlist.channel?.assignedUser || '');
      const chCreator = String(playlist.channel?.createdBy?._id || playlist.channel?.createdBy || '');
      if (chAssigned !== String(req.user._id) && chCreator !== String(req.user._id)) {
        return res.status(403).json({ message: 'Forbidden: You do not have access to this playlist' });
      }
    }

    return res.status(200).json({ playlist });
  } catch (err) {
    next(err);
  }
});

// PUT /api/playlists/:playlistId
router.put('/:playlistId', async (req, res, next) => {
  try {
    const { playlistId } = req.params;
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (req.user.role === ROLES.USER) {
      const ch = await Channel.findById(playlist.channel);
      if (!ch || (String(ch.assignedUser) !== String(req.user._id) && String(ch.createdBy) !== String(req.user._id))) {
        return res.status(403).json({ message: 'Forbidden: You do not have access to this channel' });
      }
    }

    req.params.channelId = playlist.channel;
    return updatePlaylist(req, res, next);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/playlists/:playlistId
router.delete('/:playlistId', async (req, res, next) => {
  try {
    const { playlistId } = req.params;
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (req.user.role === ROLES.USER) {
      const ch = await Channel.findById(playlist.channel);
      if (!ch || (String(ch.assignedUser) !== String(req.user._id) && String(ch.createdBy) !== String(req.user._id))) {
        return res.status(403).json({ message: 'Forbidden: You do not have access to this channel' });
      }
    }

    req.params.channelId = playlist.channel;
    return deletePlaylist(req, res, next);
  } catch (err) {
    next(err);
  }
});

export default router;

