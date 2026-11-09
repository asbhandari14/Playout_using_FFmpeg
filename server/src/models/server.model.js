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
      trim: true,
      unique: true,
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
    },

    toObject: {
      transform: (doc, ret) => {
        delete ret.serverPasswordEncrypted;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Method to set encrypted password
serverSchema.methods.setPassword = function (plainPassword) {
  if (plainPassword) {
    this.serverPasswordEncrypted = encrypt(plainPassword);
  }
};

// Retrieve decrypted password for internal workers
serverSchema.methods.getDecryptedPassword = function () {
  if (!this.serverPasswordEncrypted) {
    return '';
  }

  return decrypt(this.serverPasswordEncrypted);
};

export const Server = mongoose.model('Server', serverSchema);
