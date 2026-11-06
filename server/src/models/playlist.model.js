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
export const parseLocalDateMidnight = (val, isEnd = false) => {
  if (!val) return null;
  let y, m, d;
  if (val instanceof Date) {
    const iso = val.toISOString().split('T')[0];
    const parts = iso.split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    d = parseInt(parts[2], 10);
  } else if (typeof val === 'string') {
    const datePart = val.split('T')[0].trim();
    const parts = datePart.split('-');
    if (parts.length === 3) {
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      d = parseInt(parts[2], 10);
    } else {
      const dt = new Date(val);
      y = dt.getFullYear();
      m = dt.getMonth();
      d = dt.getDate();
    }
  } else {
    const dt = new Date(val);
    y = dt.getFullYear();
    m = dt.getMonth();
    d = dt.getDate();
  }

  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return isEnd
    ? new Date(y, m, d, 23, 59, 59, 999)
    : new Date(y, m, d, 0, 0, 0, 0);
};

export const parseTimeToSeconds = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parts.length >= 3 ? parseInt(parts[2], 10) : 0;
  if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
  return h * 3600 + m * 60 + s;
};

/**
 * Checks if a playlist is currently scheduled and active based on:
 * 1. Enabled status (isActive === true)
 * 2. Has playable videos (items.length > 0 or liveSourceUrl for live_schedule)
 * 3. Date scheduling range (startDate & endDate)
 * 4. Weekly scheduling days of the week (daysOfWeek)
 * 5. Daily start/end wall-clock time window (startTime & endTime)
 * 6. 24/7 continuous playout (scheduleOption === 'none' without constraints)
 */
export const isPlaylistCurrentlyActive = (playlist, now = new Date()) => {
  if (!playlist) return false;

  // 1. Must be enabled (isActive: true)
  if (playlist.isActive !== true) return false;

  // 2. Must contain playable media
  const hasLiveSource = playlist.type === PLAYLIST_TYPE.LIVE_SCHEDULE && Boolean(playlist.liveSourceUrl);
  const hasItems = Array.isArray(playlist.items) && playlist.items.length > 0;
  if (!hasItems && !hasLiveSource) {
    return false;
  }

  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  // 3. Date scheduling window check
  if (playlist.scheduleOption === SCHEDULE_OPTION.DATE || playlist.startDate || playlist.endDate) {
    const currentLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    if (playlist.startDate) {
      const startDay = parseLocalDateMidnight(playlist.startDate, false);
      if (startDay && currentLocalMidnight < startDay) {
        return false;
      }
    }

    if (playlist.endDate) {
      const endDay = parseLocalDateMidnight(playlist.endDate, true);
      if (endDay && now > endDay) {
        return false;
      }
    }
  }

  // 4. Weekly scheduling days of the week check
  if (
    playlist.scheduleOption === SCHEDULE_OPTION.WEEKLY ||
    (Array.isArray(playlist.daysOfWeek) && playlist.daysOfWeek.length > 0 && playlist.scheduleOption !== SCHEDULE_OPTION.NONE)
  ) {
    if (!Array.isArray(playlist.daysOfWeek) || playlist.daysOfWeek.length === 0 || !playlist.daysOfWeek.includes(currentDay)) {
      return false;
    }
  }

  // 5. Daily wall-clock time window check (HH:mm:ss or HH:mm)
  const hasStart = Boolean(playlist.startTime && String(playlist.startTime).trim());
  const hasEnd = Boolean(playlist.endTime && String(playlist.endTime).trim());

  if (hasStart || hasEnd) {
    const startSec = hasStart ? parseTimeToSeconds(playlist.startTime) : null;
    const endSec = hasEnd ? parseTimeToSeconds(playlist.endTime) : null;

    if (startSec !== null && endSec !== null) {
      if (startSec <= endSec) {
        // Normal daily slot (e.g. 22:03:00 to 22:05:00)
        if (currentSec < startSec || currentSec > endSec) {
          return false;
        }
      } else {
        // Wraps past midnight (e.g. 23:00:00 to 02:00:00)
        if (currentSec < startSec && currentSec > endSec) {
          return false;
        }
      }
    } else if (startSec !== null) {
      if (currentSec < startSec) return false;
    } else if (endSec !== null) {
      if (currentSec > endSec) return false;
    }
  }

  // All checks passed -> Playlist is active right now
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
 * - Checks if it has playable video (items.length > 0 or liveSourceUrl)
 * - Checks current date and time against schedule data and time (24/7, weekly, or datewise)
 * - If it falls in range, returns this playlist (plays till the time ends)
 * - If no playlist matches its schedule, returns null (Standby slate broadcasted to keep stream alive).
 *   NEVER falls back to playing scheduled playlists out of their scheduled windows!
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
        return p;
      }
    }
  }

  // If no playlist matches its schedule right now, return null!
  // Standby slate will be broadcasted to keep channel live on air.
  return null;
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
    // On-air branding & overlay visibility during this playlist playout
    showLogo: {
      type: Boolean,
      default: true
    },
    showBug: {
      type: Boolean,
      default: true
    },
    showTicker: {
      type: Boolean,
      default: true
    },
    // Advertisement playlist only: whether to show the "Back In" countdown timer overlay
    showBackInTimer: {
      type: Boolean,
      default: false
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
