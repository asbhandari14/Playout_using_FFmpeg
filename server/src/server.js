import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import app from './app.js';
import { connectDB } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;

// Ensure necessary directories exist
const uploadDir = path.resolve(__dirname, '../../uploads');
const tempDir = path.resolve(uploadDir, 'temp');
const thumbsDir = path.resolve(uploadDir, 'thumbnails');
const brandingDir = path.resolve(uploadDir, 'branding');
const streamsDir = path.resolve(__dirname, '../../streams');

[uploadDir, tempDir, thumbsDir, brandingDir, streamsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const server = http.createServer(app);

// Setup Socket.IO
export const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Channel room join
  socket.on('join_channel', (channelId) => {
    socket.join(`channel:${channelId}`);
    console.log(`[Socket.IO] Socket ${socket.id} joined channel:${channelId}`);
  });

  socket.on('leave_channel', (channelId) => {
    socket.leave(`channel:${channelId}`);
    console.log(`[Socket.IO] Socket ${socket.id} left channel:${channelId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

import { streamManager } from './services/streaming/streamManager.js';

// Start DB and Server
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, async () => {
      console.log(`=======================================================`);
      console.log(`  Cloud Playout Control Room Server running on port ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=======================================================`);

      // PM2 Crash Recovery: Resumes all channels that were live before restart/crash
      await streamManager.recoverActiveChannels();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Graceful Shutdown
const handleGracefulShutdown = async (signal) => {
  console.log(`\n[Process] Received ${signal}. Starting graceful shutdown...`);
  try {
    await streamManager.stopAllStreams();
    server.close(() => {
      console.log('[Process] HTTP server closed cleanly. Exiting.');
      process.exit(0);
    });
  } catch (err) {
    console.error('[Process] Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

// Clean shutdown for nodemon restart without broken pipe crashes
process.once('SIGUSR2', async () => {
  console.log('\n[Process] Nodemon restarting. Stopping active streams cleanly...');
  try {
    await streamManager.stopAllStreams();
  } catch {}
  process.kill(process.pid, 'SIGUSR2');
});

// Suppress unhandled EPIPE / ECONNRESET on dead child process pipes
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
    return;
  }
  console.error('[Process Uncaught Exception]', err);
});

startServer();

export { server };

