import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto.js';

const serverSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Server name is required'],
      trim: true
    },
    category: {
      type: String,
      default: 'General',
      trim: true
    },
    serverUsername: {
      type: String,
      trim: true,
      default: ''
    },
    // Encrypted at rest, never selected by default or returned in responses
    serverPasswordEncrypted: {
      type: String,
      default: '',
      select: false
    },
    streamUrl: {
      type: String,
      required: [true, 'Stream URL is required (e.g. http://94.136.185.222:81)'],
      trim: true
    },
    rtmpBaseUrl: {
      type: String,
      trim: true,
      default: ''
    },
    hlsBaseUrl: {
      type: String,
      trim: true,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },

  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.serverPasswordEncrypted;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Pre-save hook: auto-derive RTMP and HLS base URLs from streamUrl if not explicitly provided
serverSchema.pre('save', function () {
  if (this.streamUrl) {
    let clean = this.streamUrl.trim().replace(/\/+$/, '');
    let host = '127.0.0.1';
    try {
      const p = new URL(clean.startsWith('http') ? clean : `http://${clean}`);
      host = p.hostname;
      clean = `${p.protocol}//${p.host}`;
    } catch (e) {
      const m = clean.match(/^(?:https?:\/\/)?([^:/]+)/i);
      if (m) host = m[1];
    }
    if (!this.hlsBaseUrl) this.hlsBaseUrl = clean;
    if (!this.rtmpBaseUrl) this.rtmpBaseUrl = `rtmp://${host}/static`;
  }
});

// Method to set encrypted password
serverSchema.methods.setPassword = function (plainPassword) {

  if (plainPassword) {
    this.serverPasswordEncrypted = encrypt(plainPassword);
  }
};

// Method to retrieve decrypted password for internal streaming workers only
serverSchema.methods.getDecryptedPassword = function () {
  return decrypt(this.serverPasswordEncrypted);
};

export const Server = mongoose.model('Server', serverSchema);
