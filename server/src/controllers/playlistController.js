import { Playlist } from '../models/Playlist.js';
import { Asset } from '../models/Asset.js';
import { Channel } from '../models/Channel.js';
import { formatDuration } from '../utils/media.js';
import { io } from '../server.js';
import { ROLES, PLAYLIST_ITEM_STATUS } from '../config/constants.js';

// GET /api/channels/:channelId/playlist
export const getPlaylist = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    let playlist = await Playlist.findOne({ channel: channelId }).populate({
      path: 'items.asset',
      select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
    });

    if (!playlist) {
      playlist = await Playlist.create({
        channel: channelId,
        items: [],
        createdBy: req.user._id
      });
    }

    return res.status(200).json({ playlist });
  } catch (error) {
    next(error);
  }
};

// PUT /api/channels/:channelId/playlist
// Save / reorder playlist items
export const savePlaylist = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { items = [], loop } = req.body || {};


    let playlist = await Playlist.findOne({ channel: channelId });
    if (!playlist) {
      playlist = new Playlist({
        channel: channelId,
        items: [],
        createdBy: req.user._id
      });
    }

    if (loop !== undefined) {
      playlist.loop = loop;
    }

    // Fetch asset durations to compute cumulative start times accurately
    const assetIds = (items || []).map((it) => it.asset?._id || it.asset);
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

    playlist.items = formattedItems;
    playlist.totalDuration = cumulativeSeconds;
    playlist.totalDurationFormatted = formatDuration(cumulativeSeconds);

    await playlist.save();

    const populated = await Playlist.findById(playlist._id).populate({
      path: 'items.asset',
      select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
    });

    if (io) {
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

// DELETE /api/channels/:channelId/playlist
export const clearPlaylist = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    const playlist = await Playlist.findOneAndUpdate(
      { channel: channelId },
      { items: [], totalDuration: 0, totalDurationFormatted: '00:00:00' },
      { new: true }
    );

    if (io) {
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
