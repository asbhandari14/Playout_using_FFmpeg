import mongoose from 'mongoose';
import { PLAYLIST_ITEM_STATUS } from '../config/constants.js';

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
      unique: true
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

export const Playlist = mongoose.model('Playlist', playlistSchema);
