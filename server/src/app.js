import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from "dns";

// Import Routes
import authRoutes from './routes/auth.route.js';
import userRoutes from './routes/user.route.js';
import serverRoutes from './routes/server.route.js';
import channelRoutes from './routes/channel.route.js';
import assetRoutes from './routes/asset.route.js';
import playlistRoutes from './routes/playlist.route.js';

// Import Middleware
import { errorHandler } from './middleware/errorHandler.js';
// import helmet from 'helmet';
import morgan from 'morgan';

// Import path
import { UPLOADS_DIR, STREAMS_DIR } from './config/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security and utility middleware
// app.use(
//   helmet({
//     crossOriginResourcePolicy: { policy: 'cross-origin' },
//     contentSecurityPolicy: false // Allow local HLS and media testing
//   })
// );

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

dns.setServers(['0.0.0.0', '8.8.8.8']);

app.use(cookieParser());
app.use(express.json({}));
app.use(express.urlencoded({ extended: true }));

// Static uploads and streams directories
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/streams', express.static(STREAMS_DIR));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/playlists', playlistRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `API route not found: ${req.originalUrl}` });
});

// Centralized error handler
app.use(errorHandler);

export default app;
