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
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true
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

