import mongoose from 'mongoose';

const commercialItemSchema = new mongoose.Schema(
  {
    index: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    brand: {
      type: String,
      default: '',
      trim: true
    },
    duration: {
      type: Number,
      default: 30
    },
    durationFormatted: {
      type: String,
      default: '00:30'
    },
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      default: null
    }
  },
  { _id: false }
);

const epgSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true
    },
    // Calendar broadcast date (YYYY-MM-DD, e.g. "2026-11-14")
    date: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    // Wall-clock start time (HH:MM:SS, e.g. "20:00:00")
    startTime: {
      type: String,
      required: true,
      trim: true
    },
    // Wall-clock end time (HH:MM:SS, e.g. "20:20:00")
    endTime: {
      type: String,
      required: true,
      trim: true
    },
    // Seconds from midnight (0..86400) for timeline sorting
    startSeconds: {
      type: Number,
      required: true
    },
    endSeconds: {
      type: Number,
      required: true
    },
    // Duration in seconds
    duration: {
      type: Number,
      required: true
    },
    durationFormatted: {
      type: String,
      default: '00:00'
    },
    // Program Information (Title, Description, Category, Rating)
    program: {
      title: {
        type: String,
        required: true,
        trim: true
      },
      subTitle: {
        type: String,
        default: '',
        trim: true
      },
      description: {
        type: String,
        default: '',
        trim: true
      },
      category: {
        type: String,
        default: 'General',
        trim: true
      },
      genre: {
        type: String,
        default: '',
        trim: true
      },
      rating: {
        type: String,
        default: '',
        trim: true
      },
      icon: {
        type: String,
        default: '',
        trim: true
      },
      episode: {
        type: String,
        default: '',
        trim: true
      }
    },
    // Broadcast Priority: 5 (Emergency) > 4 (Ad) > 3 (Live) > 2 (Schedule) > 1 (Default)
    priority: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
      default: 1
    },
    // Content type
    type: {
      type: String,
      enum: ['default', 'scheduling', 'live_schedule', 'advertisement', 'emergency', 'schedule_event', 'custom'],
      default: 'default'
    },
    // Playout execution status: PLAYED | PLAYING | QUEUED
    status: {
      type: String,
      enum: ['PLAYED', 'PLAYING', 'QUEUED'],
      default: 'QUEUED',
      index: true
    },
    // Linked playlist reference (optional)
    playlist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playlist',
      default: null
    },
    playlistName: {
      type: String,
      default: '',
      trim: true
    },
    // Linked primary media asset reference (optional)
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      default: null
    },
    // Breakdown of commercials airing in this break (if type === 'advertisement')
    commercials: [commercialItemSchema],
    // Whether this event renders an on-screen countdown timer (during ad breaks)
    hasTimerOverlay: {
      type: Boolean,
      default: false
    },
    // Flag for live remote ingest broadcast
    isLive: {
      type: Boolean,
      default: false
    },
    // Flag if manually created or customized by an operator
    isCustom: {
      type: Boolean,
      default: false
    },
    // Published state for consumer EPG export
    isPublished: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Compound Index for fast daily channel EPG lookups and sorting
epgSchema.index({ channel: 1, date: 1, startSeconds: 1 });
epgSchema.index({ channel: 1, status: 1 });

export const Epg = mongoose.model('Epg', epgSchema);
