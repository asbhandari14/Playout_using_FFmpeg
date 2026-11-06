import { Router } from 'express';
import { Playlist } from '../models/playlist.model.js';
import {
  createPlaylist,
  updatePlaylist,
  deletePlaylist
} from '../controllers/playlist.controller.js';
import { getCurrentlyPlayingHandler } from '../controllers/stream.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Now Playing playout status for a channel
router.get('/:channelId/now-playing', getCurrentlyPlayingHandler);
router.get('/:channelId/currently-playing', getCurrentlyPlayingHandler);

// GET /api/playlists - List playlists across channels (or filtered by ?channelId=...&type=...)
router.get('/', async (req, res, next) => {
  try {
    const { channelId, type, isActive } = req.query;
    const filter = {};
    if (channelId) filter.channel = channelId;
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
router.post('/', (req, res, next) => {
  const channelId = req.body.channelId || req.body.channel;
  if (!channelId) {
    return res.status(400).json({ message: 'channelId is required to create a playlist' });
  }
  req.params.channelId = channelId;
  return createPlaylist(req, res, next);
});

// GET /api/playlists/:playlistId
router.get('/:playlistId', async (req, res, next) => {
  try {
    const playlist = await Playlist.findById(req.params.playlistId)
      .populate('channel', 'name status hlsUrl streamKey')
      .populate({
        path: 'items.asset',
        select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
      })
      .populate('createdBy', 'name email');

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
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
    req.params.channelId = playlist.channel;
    return deletePlaylist(req, res, next);
  } catch (err) {
    next(err);
  }
});

export default router;

