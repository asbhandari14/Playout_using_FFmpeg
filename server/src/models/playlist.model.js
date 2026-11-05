import mongoose from 'mongoose';
import {
  PLAYLIST_ITEM_STATUS,
  PLAYLIST_TYPE,
  PLAYLIST_PRIORITY,
  SCHEDULE_OPTION
} from '../config/constants.js';

export { PLAYLIST_TYPE, PLAYLIST_PRIORITY, SCHEDULE_OPTION };

/**
 * Helper to safely extract local midnight Date without UTC shifting
 */
const parseDateMidnight = (val, isEnd = false) => {
  if (!val) return null;
  if (typeof val === 'string' && val.includes('-')) {
    const parts = val.split('T')[0].split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      return isEnd ? new Date(y, m, d, 23, 59, 59, 999) : new Date(y, m, d, 0, 0, 0, 0);
    }
  }
  const d = new Date(val);
  return isEnd
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

/**
 * Checks if a playlist is currently scheduled and active based on active status,
 * date range, days of week, and daily start/end wall-clock time.
 */
export const isPlaylistCurrentlyActive = (playlist, now = new Date()) => {
  if (!playlist) return false;

  // 1. Check whether it is ON (isActive: true)
  if (playlist.isActive === false) return false;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  const currentTimeStr = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');

  // 2. Date scheduling window check (if scheduleOption is 'date' OR startDate/endDate set)
  if (playlist.scheduleOption === SCHEDULE_OPTION.DATE || (playlist.startDate && playlist.endDate)) {
    if (playlist.startDate) {
      const startDay = parseDateMidnight(playlist.startDate, false);
      const today = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);
      if (today < startDay) return false;
    }
    if (playlist.endDate) {
      const endDay = parseDateMidnight(playlist.endDate, true);
      if (now > endDay) return false;
    }
  }

  // 3. Weekly scheduling days of the week check
  if (playlist.scheduleOption === SCHEDULE_OPTION.WEEKLY) {
    if (Array.isArray(playlist.daysOfWeek) && playlist.daysOfWeek.length > 0) {
      if (!playlist.daysOfWeek.includes(currentDay)) return false;
    }
  }

  // 4. Daily wall-clock time window check (HH:mm:ss or HH:mm)
  // Evaluated if startTime or endTime is set (for any scheduleOption)
  const hasStart = Boolean(playlist.startTime && String(playlist.startTime).trim());
  const hasEnd = Boolean(playlist.endTime && String(playlist.endTime).trim());

  if (hasStart && hasEnd) {
    const rawStart = String(playlist.startTime).trim();
    const rawEnd = String(playlist.endTime).trim();
    const start = rawStart.length === 5 ? rawStart + ':00' : rawStart;
    const end = rawEnd.length === 5 ? rawEnd + ':00' : rawEnd;

    if (start <= end) {
      if (currentTimeStr < start || currentTimeStr > end) return false;
    } else {
      // Overnight wraps past midnight (e.g. 23:00 to 02:00)
      if (currentTimeStr < start && currentTimeStr > end) return false;
    }
  } else if (hasStart) {
    const rawStart = String(playlist.startTime).trim();
    const start = rawStart.length === 5 ? rawStart + ':00' : rawStart;
    if (currentTimeStr < start) return false;
  } else if (hasEnd) {
    const rawEnd = String(playlist.endTime).trim();
    const end = rawEnd.length === 5 ? rawEnd + ':00' : rawEnd;
    if (currentTimeStr > end) return false;
  }

  return true;
};

/**
 * Resolves what to play for a channel based on strict priority hierarchy:
 * 1. Emergency Playlist (Priority 5 - highest)
 * 2. Advertisement Playlist (Priority 4)
 * 3. Live Scheduling Playlist (Priority 3)
 * 4. Scheduling Playlist (Priority 2)
 * 5. Default Playlist (Priority 1 - lowest)
 *
 * For each tier:
 * - Checks whether channel has this playlist
 * - Checks if it is ON (isActive: true)
 * - Checks current date and time against schedule data and time
 * - If it falls in range, returns this playlist (plays till the time ends)
 * - Then moves down to next tier in priority order
 */
export const resolveChannelActivePlaylist = async (channelId, now = new Date()) => {
  const playlists = await Playlist.find({ channel: channelId, isActive: true })
    .populate({
      path: 'items.asset',
      select: 'originalName filePath thumbnailPath duration durationFormatted size resolution codec status category'
    });

  if (!playlists || playlists.length === 0) {
    return null;
  }

  const priorityOrder = [
    PLAYLIST_TYPE.EMERGENCY,      // Priority 5
    PLAYLIST_TYPE.ADVERTISEMENT,  // Priority 4
    PLAYLIST_TYPE.LIVE_SCHEDULE,  // Priority 3
    PLAYLIST_TYPE.SCHEDULING,     // Priority 2
    PLAYLIST_TYPE.DEFAULT         // Priority 1
  ];

  for (const type of priorityOrder) {
    const candidates = playlists.filter((p) => p.type === type);
    if (candidates.length === 0) continue;

    for (const p of candidates) {
      if (isPlaylistCurrentlyActive(p, now)) {
        const hasItems = Array.isArray(p.items) && p.items.length > 0;
        const hasLiveSource = p.type === PLAYLIST_TYPE.LIVE_SCHEDULE && Boolean(p.liveSourceUrl);
        if (hasItems || hasLiveSource) {
          return p;
        }
      }
    }
  }

  // Fallback: Default playlist with items
  const fallbackDefault = playlists.find(
    (p) => p.type === PLAYLIST_TYPE.DEFAULT && Array.isArray(p.items) && p.items.length > 0
  );
  if (fallbackDefault) return fallbackDefault;

  // Final fallback to any playlist with items
  return playlists.find((p) => Array.isArray(p.items) && p.items.length > 0) || playlists[0] || null;
};

const playlistItemSchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  startOffset: {
    type: Number,
    default: 0 // cumulative start seconds
  },
  startOffsetFormatted: {
    type: String,
    default: '00:00'
  },
  status: {
    type: String,
    enum: Object.values(PLAYLIST_ITEM_STATUS),
    default: PLAYLIST_ITEM_STATUS.QUEUED
  }
});

const playlistSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true
    },
    name: {
      type: String,
      default: 'Default Playlist',
      trim: true
    },
    // Playlist type: default | scheduling | live_schedule | advertisement | emergency
    type: {
      type: String,
      enum: Object.values(PLAYLIST_TYPE),
      default: PLAYLIST_TYPE.DEFAULT,
      required: true,
      index: true
    },
    // Priority: emergency (5 - highest) > advertisement (4) > live_schedule (3) > scheduling (2) > default (1 - lowest)
    priority: {
      type: Number,
      default: 1,
      index: true
    },
    // Schedule option: none | weekly | date
    scheduleOption: {
      type: String,
      enum: Object.values(SCHEDULE_OPTION),
      default: SCHEDULE_OPTION.NONE
    },
    // Date scheduling range
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    // Time scheduling (daily wall-clock window, e.g. "09:00:00", "18:00:00")
    startTime: {
      type: String,
      default: '',
      trim: true
    },
    endTime: {
      type: String,
      default: '',
      trim: true
    },
    // Weekly scheduling days: [0..6] (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    daysOfWeek: {
      type: [Number],
      default: []
    },
    // Optional live stream input URL (for live_schedule)
    liveSourceUrl: {
      type: String,
      default: '',
      trim: true
    },
    items: [playlistItemSchema],
    totalDuration: {
      type: Number,
      default: 0
    },
    totalDurationFormatted: {
      type: String,
      default: '00:00:00'
    },
    loop: {
      type: Boolean,
      default: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook: auto-assign priority based on type if not explicitly set
playlistSchema.pre('save', function () {
  if (this.type && PLAYLIST_PRIORITY[this.type] !== undefined) {
    this.priority = PLAYLIST_PRIORITY[this.type];
  }

});

// Indexes for high-performance lookup by priority and channel
playlistSchema.index({ channel: 1, type: 1 });
playlistSchema.index({ channel: 1, priority: -1, isActive: 1 });

export const Playlist = mongoose.model('Playlist', playlistSchema);
