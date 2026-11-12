import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    // Primary list of videos in the scheduled playlist
    assets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset'
      }
    ],
    // Single asset fallback for backwards compatibility
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      default: null
    },
    // Exact wall-clock air time (HH:mm:ss or HH:mm, e.g. "14:30:00")
    dailyStartTime: {
      type: String,
      required: true,
      trim: true
    },
    // Exact wall-clock end time (HH:mm:ss or HH:mm, e.g. "15:00:00")
    dailyEndTime: {
      type: String,
      default: '',
      trim: true
    },
    // Duration in seconds (0 = use asset duration)
    duration: {
      type: Number,
      default: 0
    },
    // Schedule type: 'video' (commercial break) | 'lband' (graphic squeeze) | 'ashton' (lower third)
    type: {
      type: String,
      enum: ['video', 'lband', 'ashton'],
      default: 'video'
    },
    // Optional link to a reusable BandPreset (L-Band or Ashton Band)
    bandPreset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BandPreset',
      default: null
    },
    // Image path for L-Band or Ashton graphic
    imagePath: {
      type: String,
      default: '',
      trim: true
    },
    // Schedule option: '24/7' | 'weekly' | 'datewise'
    scheduleOption: {
      type: String,
      enum: ['24/7', 'weekly', 'datewise'],
      default: '24/7'
    },
    // Interval/gap between successive triggers in minutes (e.g. 20)
    gapMinutes: {
      type: Number,
      default: 20
    },
    // Timestamp when this schedule was last fired live
    lastFiredAt: {
      type: Date,
      default: null
    },
    // For ashton schedule: true = squeeze, false = overlay
    ashtonSqueeze: {
      type: Boolean,
      default: true
    },
    // Ashton height in pixels
    ashtonHeight: {
      type: Number,
      default: 160
    },
    // L-Band cutout dimensions
    windowX: { type: Number, default: 300 },
    windowY: { type: Number, default: 20 },
    windowWidth: { type: Number, default: 960 },
    windowHeight: { type: Number, default: 540 },
    // Optional date range window
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    // Selected days of the week: [0..6] (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    // If empty array, schedule airs every day
    daysOfWeek: {
      type: [Number],
      default: []
    },
    enabled: {
      type: Boolean,
      default: true
    },
    priority: {
      type: Number,
      default: 1
    },
    // Tracks the last calendar date (YYYY-MM-DD) on which this schedule fired
    lastAiredDate: {
      type: String,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

export const Schedule = mongoose.model('Schedule', scheduleSchema);

