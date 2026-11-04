import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import app from './app.js';

// Import DB
import { connectDB } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { UPLOADS_DIR, TEMP_DIR, STREAMS_DIR } from './config/paths.js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;

// Ensure necessary base directories exist inside server
[UPLOADS_DIR, TEMP_DIR, STREAMS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const server = http.createServer(app);

// Handle client TCP stream reset errors (e.g. network disconnect, aborted requests)
server.on('clientError', (err, socket) => {
  const isNetworkDrop =
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'EPIPE' ||
    err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    (err.message && err.message.includes('ECONNRESET'));

  if (isNetworkDrop || !socket.writable) {
    try {
      socket.destroy();
    } catch {}
    return;
  }
  try {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  } catch {
    try {
      socket.destroy();
    } catch {}
  }
});

server.on('error', (err) => {
  console.error('[HTTP Server Error]', err);
});

// Setup Socket.IO
export const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 10000
});

app.set('io', io);

// Suppress Engine.IO connection reset errors during network drops
io.engine.on('connection_error', (err) => {
  const isNetworkDrop =
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNABORTED' ||
    (err.message && err.message.includes('ECONNRESET'));

  if (!isNetworkDrop) {
    console.warn(`[Socket.IO Engine Error] ${err.message}`);
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Catch socket errors so network disconnects do not become unhandled exceptions
  socket.on('error', (err) => {
    if (err.code === 'ECONNRESET' || (err.message && err.message.includes('ECONNRESET'))) {
      return;
    }
    console.warn(`[Socket.IO Socket Error ${socket.id}]:`, err.message);
  });

  // Channel room join
  socket.on('join_channel', (channelId) => {
    socket.join(`channel:${channelId}`);
    console.log(`[Socket.IO] Socket ${socket.id} joined channel:${channelId}`);
  });

  socket.on('leave_channel', (channelId) => {
    socket.leave(`channel:${channelId}`);
    console.log(`[Socket.IO] Socket ${socket.id} left channel:${channelId}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected (${reason}): ${socket.id}`);
  });
});

import { streamManager } from './services/streaming/streamManager.js';
import { schedulerService } from './services/streaming/schedulerService.js';
import { migrateUploadsToChannelFolders } from './utils/migrateUploads.js';
import { channelStorageCron } from './services/channel.service.js';

// Start DB and Server
const startServer = async () => {
  try {
    await connectDB();
    await migrateUploadsToChannelFolders();
    server.listen(PORT, '0.0.0.0', async () => {
      console.log(`Server is running at the PORT : ${PORT}`);

      // PM2 Crash Recovery: Resumes all channels that were live before restart/crash
      await streamManager.recoverActiveChannels();

      // Playout Scheduler Clock Service
      schedulerService.start();

      // Channel Storage Calculator Cron Job (1-minute interval)
      channelStorageCron.start();
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
    schedulerService.stop();
    channelStorageCron.stop();
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
    schedulerService.stop();
    channelStorageCron.stop();
    await streamManager.stopAllStreams();
  } catch {}
  process.kill(process.pid, 'SIGUSR2');
});

// Suppress unhandled network disconnects (ECONNRESET, EPIPE, etc.) so process never crashes
process.on('uncaughtException', (err) => {
  const isNetworkDrop =
    err.code === 'EPIPE' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    (err.message && (err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED')));

  if (isNetworkDrop) {
    console.warn(`[Process Handled Network Disconnect Exception]: ${err.message}`);
    return;
  }
  console.error('[Process Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  const isNetworkDrop =
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'EPIPE' ||
    err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    (err.message && (err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED')));

  if (isNetworkDrop) {
    console.warn(`[Process Handled Network Disconnect Rejection]: ${err.message}`);
    return;
  }
  console.error('[Process Unhandled Rejection]:', reason);
});

startServer();

export { server };

