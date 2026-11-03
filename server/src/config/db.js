import mongoose from 'mongoose';

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

    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cloud_playout');
    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    process.exit(1);
  }
};
