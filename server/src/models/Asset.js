import mongoose from 'mongoose';
import { ASSET_STATUS } from '../config/constants.js';

const assetSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true
    },
    originalName: {
      type: String,
      required: true,
      trim: true
    },
    filePath: {
      type: String,
      required: true
    },
    thumbnailPath: {
      type: String,
      default: ''
    },
    duration: {
      type: Number,
      default: 0 // Duration in seconds
    },
    durationFormatted: {
      type: String,
      default: '00:00'
    },
    size: {
      type: Number,
      default: 0 // Bytes
    },
    resolution: {
      type: String,
      default: '1280x720'
    },
    codec: {
      type: String,
      default: 'h264'
    },
    status: {
      type: String,
      enum: Object.values(ASSET_STATUS),
      default: ASSET_STATUS.UPLOADING
    },
    category: {
      type: String,
      default: 'All categories',
      trim: true
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

export const Asset = mongoose.model('Asset', assetSchema);
