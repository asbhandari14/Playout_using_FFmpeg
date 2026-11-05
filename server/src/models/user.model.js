import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Method to verify password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash password
userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

// Create default Super Admin if User collection is empty
userSchema.statics.createDefaultUser = async function () {
    try {
        const userExists = await this.exists({});

        if (userExists) {
            console.log("[Default User] Users already exist. Skipping creation.");
            return;
        }

        const hashedPassword = await this.hashPassword("123456");

        await this.create({
            name: "Super Admin",
            email: "example@mail.com",
            passwordHash: hashedPassword,
            role: ROLES.SUPER_ADMIN,
        });

        console.log("[Default User] Default Super Admin created successfully.");

    } catch (error) {
        console.error("[Default User] Error creating default user:", error);
        throw error;
    }
};

export const User = mongoose.model('User', userSchema);
