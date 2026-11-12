import mongoose from 'mongoose';

const bandPresetSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['lband', 'ashton'],
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    imagePath: {
      type: String,
      default: '',
      trim: true
    },
    // Display duration on air in seconds
    duration: {
      type: Number,
      default: 10,
      min: 1
    },
    // L-Band video window cutout coordinates on 1280x720 broadcast canvas
    windowX: { type: Number, default: 300 },
    windowY: { type: Number, default: 20 },
    windowWidth: { type: Number, default: 960 },
    windowHeight: { type: Number, default: 540 },
    // Ashton Band display mode & banner height
    ashtonSqueeze: {
      type: Boolean,
      default: true
    },
    ashtonHeight: {
      type: Number,
      default: 160
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

export const BandPreset = mongoose.model('BandPreset', bandPresetSchema);

