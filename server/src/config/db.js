import mongoose from 'mongoose';
import { User } from '../models/user.model.js';

export const connectDB = async () => {
  try {
    mongoose.connection.on('error', (err) => {
      console.warn(`[MongoDB] Connection error (network glitch): ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected from database. Auto-reconnecting...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] Reconnected to database.');
    });

    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);

    // Create default Super Admin if no users exist
    await User.createDefaultUser();
    
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    process.exit(1);
  }
};
