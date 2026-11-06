import { streamManager } from '../services/streaming/streamManager.js';
import { Channel } from '../models/channel.model.js';
import { User } from '../models/user.model.js';
import { Asset } from '../models/asset.model.js';
import { Playlist, resolveChannelActivePlaylist, isPlaylistCurrentlyActive } from '../models/playlist.model.js';
import { Schedule } from '../models/schedule.model.js';
import { schedulerService } from '../services/streaming/schedulerService.js';
import { formatDuration } from '../utils/media.js';
import { ROLES } from '../config/constants.js';

// POST /api/channels/:channelId/start
export async function startStreamHandler(req, res, next) {
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
}

// POST /api/channels/:channelId/stop
export async function stopStreamHandler(req, res, next) {
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
}

// GET /api/channels/:channelId/stream/status
export async function getStreamStatusHandler(req, res, next) {
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
}

// GET /api/channels/:channelId/now-playing
// GET /api/channels/:channelId/currently-playing
// GET /api/channels/now-playing
export async function getCurrentlyPlayingHandler(req, res, next) {
  try {
    const channelId = req.params.channelId || req.params.id || req.query.channelId;

    // -------------------------------------------------------------
    // Single Channel Playout Query
    // -------------------------------------------------------------
    if (channelId) {
      const channel = await Channel.findById(channelId)
        .populate('server', 'name streamUrl rtmpBaseUrl hlsBaseUrl category')
        .populate('assignedUser', 'name email role')
        .populate('currentAssetId', 'originalName filePath duration durationFormatted thumbnailPath');

      if (!channel) {
        return res.status(404).json({ success: false, message: 'Channel not found' });
      }

      // RBAC check: Users can only see channels assigned to them
      if (req.user.role === ROLES.USER && String(channel.assignedUser?._id || channel.assignedUser) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Forbidden: You are not assigned to this channel' });
      }

      const isLive = streamManager.isChannelLive(channelId);
      const liveInfo = streamManager.getChannelCurrentlyPlaying(channelId);

      if (isLive && liveInfo) {
        return res.status(200).json({
          success: true,
          isLive: true,
          channel: {
            _id: channel._id,
            name: channel.name,
            status: channel.status || 'live',
            hlsUrl: channel.hlsUrl,
            rtmpUrl: channel.rtmpUrl,
            server: channel.server,
            assignedUser: channel.assignedUser
          },
          playoutSource: liveInfo.playoutSource,
          scheduling: liveInfo.scheduling,
          video: liveInfo.video,
          interruptedState: liveInfo.interruptedState,
          activeFireTimers: liveInfo.activeFireTimers,
          startedAt: liveInfo.startedAt,
          zmqPort: liveInfo.zmqPort,
          branding: {
            logo: channel.branding?.logo?.enabled ? channel.branding.logo : { enabled: false },
            bug: channel.branding?.bug?.enabled ? channel.branding.bug : { enabled: false },
            ticker: channel.branding?.ticker?.enabled ? channel.branding.ticker : { enabled: false },
            lband: channel.branding?.lband?.enabled ? channel.branding.lband : { enabled: false },
            ashton: channel.branding?.ashton?.enabled ? channel.branding.ashton : { enabled: false },
            backInTimer: channel.branding?.backInTimer?.enabled ? channel.branding.backInTimer : { enabled: false }
          }
        });
      }

      // Channel is NOT live (idle or stopped).
      // Resolve what WOULD play right now according to schedules and priority hierarchy
      const now = new Date();
      const activeSchedule = await schedulerService.getActiveScheduleForChannel(channel._id, now);
      const activePlaylist = await resolveChannelActivePlaylist(channel._id, now);

      let lastPlayedVideo = null;
      if (channel.currentAssetId) {
        lastPlayedVideo = {
          assetId: channel.currentAssetId._id,
          title: channel.currentAssetId.originalName,
          originalName: channel.currentAssetId.originalName,
          duration: channel.currentAssetId.duration,
          durationFormatted: channel.currentAssetId.durationFormatted,
          index: channel.currentPlayingIndex
        };
      }

      const firstScheduledAsset = activeSchedule?.assets?.[0] || activeSchedule?.asset || null;
      const firstPlaylistAsset = activePlaylist?.items?.[0]?.asset || null;

      return res.status(200).json({
        success: true,
        isLive: false,
        channel: {
          _id: channel._id,
          name: channel.name,
          status: channel.status || 'idle',
          hlsUrl: channel.hlsUrl,
          rtmpUrl: channel.rtmpUrl,
          server: channel.server,
          assignedUser: channel.assignedUser
        },
        playoutSource: activeSchedule ? 'schedule' : (activePlaylist ? 'playlist' : 'idle'),
        scheduling: activeSchedule ? {
          source: 'schedule_event',
          id: activeSchedule._id,
          name: activeSchedule.title,
          title: activeSchedule.title,
          type: activeSchedule.type,
          priority: activeSchedule.priority || 10,
          dailyStartTime: activeSchedule.dailyStartTime,
          dailyEndTime: activeSchedule.dailyEndTime || '',
          duration: activeSchedule.duration || 0,
          durationFormatted: formatDuration(activeSchedule.duration || 0),
          status: 'ready_offline'
        } : (activePlaylist ? {
          source: 'priority_playlist',
          id: activePlaylist._id,
          name: activePlaylist.name,
          type: activePlaylist.type,
          priority: activePlaylist.priority,
          scheduleOption: activePlaylist.scheduleOption || 'none',
          totalItems: activePlaylist.items?.length || 0,
          status: 'ready_offline'
        } : null),
        video: activeSchedule && firstScheduledAsset ? {
          assetId: firstScheduledAsset._id,
          title: firstScheduledAsset.originalName,
          originalName: firstScheduledAsset.originalName,
          duration: firstScheduledAsset.duration || 0,
          durationFormatted: formatDuration(firstScheduledAsset.duration || 0),
          status: 'ready_offline'
        } : (activePlaylist && firstPlaylistAsset ? {
          assetId: firstPlaylistAsset._id,
          title: firstPlaylistAsset.originalName,
          originalName: firstPlaylistAsset.originalName,
          duration: firstPlaylistAsset.duration || 0,
          durationFormatted: formatDuration(firstPlaylistAsset.duration || 0),
          status: 'ready_offline'
        } : lastPlayedVideo),
        lastPlayedVideo,
        message: 'Channel is currently offline/idle. Playout will start from the active scheduling when the stream is started.'
      });
    }

    // -------------------------------------------------------------
    // Multi-Channel Query (/api/channels/now-playing)
    // -------------------------------------------------------------
    const filter = {};
    if (req.user.role === ROLES.USER) {
      filter.assignedUser = req.user._id;
    } else if (req.user.role === ROLES.ADMIN) {
      const managedUsers = await User.find({ createdBy: req.user._id }).select('_id');
      const managedIds = managedUsers.map((u) => u._id);
      filter.$or = [
        { createdBy: req.user._id },
        { assignedUser: { $in: [...managedIds, req.user._id] } }
      ];
    }

    const channels = await Channel.find(filter)
      .populate('server', 'name streamUrl')
      .populate('assignedUser', 'name email role')
      .populate('currentAssetId', 'originalName duration durationFormatted');

    const now = new Date();
    const channelStatuses = await Promise.all(
      channels.map(async (ch) => {
        const isLive = streamManager.isChannelLive(ch._id);
        if (isLive) {
          const liveInfo = streamManager.getChannelCurrentlyPlaying(ch._id);
          return {
            channelId: ch._id,
            channelName: ch.name,
            status: ch.status || 'live',
            isLive: true,
            playoutSource: liveInfo?.playoutSource || 'playlist',
            scheduling: liveInfo?.scheduling || null,
            video: liveInfo?.video || null,
            interruptedState: liveInfo?.interruptedState || null,
            activeFireTimers: liveInfo?.activeFireTimers || null
          };
        }

        const activeSchedule = await schedulerService.getActiveScheduleForChannel(ch._id, now);
        const activePlaylist = await resolveChannelActivePlaylist(ch._id, now);

        return {
          channelId: ch._id,
          channelName: ch.name,
          status: ch.status || 'idle',
          isLive: false,
          playoutSource: activeSchedule ? 'schedule' : (activePlaylist ? 'playlist' : 'idle'),
          scheduling: activeSchedule ? {
            source: 'schedule_event',
            id: activeSchedule._id,
            title: activeSchedule.title,
            type: activeSchedule.type
          } : (activePlaylist ? {
            source: 'priority_playlist',
            id: activePlaylist._id,
            name: activePlaylist.name,
            type: activePlaylist.type,
            priority: activePlaylist.priority
          } : null),
          video: activePlaylist?.items?.[0]?.asset ? {
            assetId: activePlaylist.items[0].asset._id,
            title: activePlaylist.items[0].asset.originalName,
            duration: activePlaylist.items[0].asset.duration
          } : (ch.currentAssetId ? {
            assetId: ch.currentAssetId._id,
            title: ch.currentAssetId.originalName,
            duration: ch.currentAssetId.duration
          } : null)
        };
      })
    );

    return res.status(200).json({
      success: true,
      totalChannels: channelStatuses.length,
      channels: channelStatuses
    });
  } catch (error) {
    next(error);
  }
}

export { getCurrentlyPlayingHandler as getNowPlayingHandler };

