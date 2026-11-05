import mongoose from 'mongoose';
import {
  PLAYLIST_ITEM_STATUS,
  PLAYLIST_TYPE,
  PLAYLIST_PRIORITY,
  SCHEDULE_OPTION
} from '../config/constants.js';

export { PLAYLIST_TYPE, PLAYLIST_PRIORITY, SCHEDULE_OPTION };

/**
 * Checks if a playlist is currently scheduled and active based on date range,
 * days of week, and daily start/end wall-clock time.
 */
export const isPlaylistCurrentlyActive = (playlist, now = new Date()) => {
  if (!playlist || !playlist.isActive) return false;

  // Unscheduled default playlist is always eligible
  if (playlist.type === PLAYLIST_TYPE.DEFAULT && (!playlist.scheduleOption || playlist.scheduleOption === SCHEDULE_OPTION.NONE)) {
    return true;
  }

  // Unscheduled emergency playlist is immediately triggered when active
  if (playlist.type === PLAYLIST_TYPE.EMERGENCY && (!playlist.scheduleOption || playlist.scheduleOption === SCHEDULE_OPTION.NONE)) {
    return true;
  }

  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentTimeStr = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');

  // 1. Date scheduling window check
  if (playlist.scheduleOption === SCHEDULE_OPTION.DATE) {
    if (playlist.startDate && now < new Date(playlist.startDate)) return false;
    if (playlist.endDate) {
      const end = new Date(playlist.endDate);
      end.setHours(23, 59, 59, 999);
      if (now > end) return false;
    }
  }

  // 2. Weekly scheduling days of the week check
  if (playlist.scheduleOption === SCHEDULE_OPTION.WEEKLY) {
    if (Array.isArray(playlist.daysOfWeek) && playlist.daysOfWeek.length > 0) {
      if (!playlist.daysOfWeek.includes(currentDay)) return false;
    }
  }

  // 3. Daily wall-clock time window check (HH:mm:ss or HH:mm)
  if (playlist.startTime && playlist.endTime) {
    const start = playlist.startTime.length === 5 ? `${playlist.startTime}:00` : playlist.startTime;
    const end = playlist.endTime.length === 5 ? `${playlist.endTime}:00` : playlist.endTime;

    if (start <= end) {
      if (currentTimeStr < start || currentTimeStr > end) return false;
    } else {
      // Wraps past midnight
      if (currentTimeStr < start && currentTimeStr > end) return false;
    }
  } else if (playlist.startTime) {
    const start = playlist.startTime.length === 5 ? `${playlist.startTime}:00` : playlist.startTime;
    if (currentTimeStr < start) return false;
  }

  return true;
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
playlistSchema.pre('save', function (next) {
  if (this.type && PLAYLIST_PRIORITY[this.type] !== undefined) {
    this.priority = PLAYLIST_PRIORITY[this.type];
  }
  next();
});

// Indexes for high-performance lookup by priority and channel
playlistSchema.index({ channel: 1, type: 1 });
playlistSchema.index({ channel: 1, priority: -1, isActive: 1 });

export const Playlist = mongoose.model('Playlist', playlistSchema);

// Safe cleanup of legacy unique index on channel if it exists in MongoDB
Playlist.collection?.dropIndex('channel_1').catch(() => {});
