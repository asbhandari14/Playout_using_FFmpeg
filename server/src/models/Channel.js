import mongoose from 'mongoose';
import { CHANNEL_STATUS, LOGO_POSITIONS } from '../config/constants.js';

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true
    },
    server: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      required: [true, 'Assigned server is required']
    },
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned user is required']
    },
    streamKey: {
      type: String,
      default: '',
      trim: true
    },
    hlsUrl: {
      type: String,
      default: '',
      trim: true
    },
    rtmpUrl: {
      type: String,
      default: '',
      trim: true
    },

    status: {
      type: String,
      enum: Object.values(CHANNEL_STATUS),
      default: CHANNEL_STATUS.IDLE
    },
    currentPlayingIndex: {
      type: Number,
      default: -1
    },
    currentAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      default: null
    },
    outputSettings: {
      resolution: { type: String, default: '1280x720' },
      width: { type: Number, default: 1280 },
      height: { type: Number, default: 720 },
      fps: { type: Number, default: 25 },
      videoBitrate: { type: String, default: '2500k' },
      audioBitrate: { type: String, default: '128k' }
    },
    branding: {
      logo: {
        assetPath: { type: String, default: '' },
        enabled: { type: Boolean, default: false },
        position: {
          type: String,
          enum: Object.values(LOGO_POSITIONS),
          default: LOGO_POSITIONS.TOP_RIGHT
        },
        sizePercent: { type: Number, default: 10 },
        marginX: { type: Number, default: 2 },
        marginY: { type: Number, default: 2 }
      },
      ticker: {
        enabled: { type: Boolean, default: false },
        text: { type: String, default: 'Welcome to Cloud Playout Live Broadcast' },
        bgColor: { type: String, default: '#000000dd' },
        textColor: { type: String, default: '#ffffff' },
        fontFamily: { type: String, default: 'Sans Bold' },
        fontSize: { type: Number, default: 26 },
        width: { type: Number, default: 100 },
        paddingY: { type: Number, default: 12 },
        marginBottom: { type: Number, default: 0 },
        alignment: { type: String, default: 'center' },
        speed: { type: Number, default: 3 }
      },
      lband: {
        enabled: { type: Boolean, default: false },
        assetPath: { type: String, default: '' },
        preset: { type: String, default: 'top-right' },
        windowX: { type: Number, default: 300 },
        windowY: { type: Number, default: 20 },
        windowWidth: { type: Number, default: 960 },
        windowHeight: { type: Number, default: 540 }
      },
      ashton: {
        enabled: { type: Boolean, default: false },
        assetPath: { type: String, default: '' },
        squeeze: { type: Boolean, default: true },
        height: { type: Number, default: 160 }
      }
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

export const Channel = mongoose.model('Channel', channelSchema);
