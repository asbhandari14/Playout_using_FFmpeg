import { streamManager } from '../services/streaming/streamManager.js';
import { Channel } from '../models/channel.model.js';
import { ROLES } from '../config/constants.js';

// POST /api/channels/:channelId/start
export const startStreamHandler = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { startIndex = 0 } = req.body || {};


    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // RBAC: user can only start streams for channels assigned to them
    if (req.user.role === ROLES.USER && String(channel.assignedUser) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this channel' });
    }

    const stream = await streamManager.startStream(channelId, startIndex || 0);

    return res.status(200).json({
      message: `Broadcast live stream started for '${channel.name}'`,
      status: 'live',
      zmqPort: stream.zmqPort
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/channels/:channelId/stop
export const stopStreamHandler = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    if (req.user.role === ROLES.USER && String(channel.assignedUser) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this channel' });
    }

    await streamManager.stopStream(channelId);

    return res.status(200).json({
      message: `Broadcast live stream stopped for '${channel.name}'`,
      status: 'idle'
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/channels/:channelId/stream/status
export const getStreamStatusHandler = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const isLive = streamManager.isChannelLive(channelId);
    const stream = streamManager.getStream(channelId);

    return res.status(200).json({
      channelId,
      isLive,
      startedAt: stream?.startedAt || null,
      zmqPort: stream?.zmqPort || null
    });
  } catch (error) {
    next(error);
  }
};
