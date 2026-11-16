import { Router } from 'express';
import {
  getChannels,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  CheckChannelOnlineOrOffline
} from '../controllers/channel.controller.js';
import {
  getPlaylist,
  savePlaylist,
  clearPlaylist,
  getPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  getActivePlaylist
} from '../controllers/playlist.controller.js';
import {
  updateLogoBranding,
  removeLogo,
  uploadLogoFile,
  updateBugBranding,
  removeBug,
  uploadBugFile,
  ensureBugPreview,
  updateTickerBranding,
  removeTicker,
  updateLBandBranding,
  fireLBandLive,
  removeLBand,
  uploadLBandFile,
  updateAshtonBranding,
  fireAshtonLive,
  removeAshton,
  uploadAshtonFile,
  updateTimerBranding,
  removeTimer,
  uploadTimerImage
} from '../controllers/branding.controller.js';
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  toggleSchedule,
  deleteSchedule,
  playScheduleNow
} from '../controllers/schedule.controller.js';
import {
  getBands,
  createBand,
  updateBand,
  deleteBand,
  fireBandNow
} from '../controllers/band.controller.js';
import {
  startStreamHandler,
  stopStreamHandler,
  getStreamStatusHandler,
  getCurrentlyPlayingHandler
} from '../controllers/stream.controller.js';
import {
  getChannelEpgHandler,
  getChannelEpgXmlHandler,
  syncChannelEpgHandler
} from '../controllers/epg.controller.js';
import { auth } from '../middleware/auth.middleware.js';
import { role, channelAccess } from '../middleware/role.middleware.js';
import { uploadLogo, uploadBug, uploadLBand, uploadAshton, uploadOverlay, uploadTimer } from '../middleware/logoUpload.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Public XMLTV EPG endpoint (accessible by external players like VLC, TiviMate, and IPTV boxes)
router.get('/:channelId/epg.xml', getChannelEpgXmlHandler);

router.use(auth);

// Electronic Programme Guide (EPG)
router.get('/:channelId/epg', channelAccess, getChannelEpgHandler);
router.post('/:channelId/epg/sync', channelAccess, syncChannelEpgHandler);

// Global Playout / Now-Playing Status
router.get('/now-playing', getCurrentlyPlayingHandler);
router.get('/currently-playing', getCurrentlyPlayingHandler);

// List channels: super_admin, admin, user
router.get('/', role([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER]), getChannels);
router.get('/:id', role([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER]), getChannelById);

// Create, update, delete channels: super_admin and admin only
router.post('/', role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), createChannel);
router.put('/:id', role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), updateChannel);
router.delete('/:id', role([ROLES.SUPER_ADMIN, ROLES.ADMIN]), deleteChannel);

// Channel stream live status check (online vs offline)
router.post('/check-online', CheckChannelOnlineOrOffline);
router.post('/check-status', CheckChannelOnlineOrOffline);
router.post('/:channelId/check-online', channelAccess, CheckChannelOnlineOrOffline);

// Live Stream controls (Start / Stop / Status / Now Playing)
router.post('/:channelId/start', channelAccess, startStreamHandler);
router.post('/:channelId/stop', channelAccess, stopStreamHandler);
router.get('/:channelId/stream/status', channelAccess, getStreamStatusHandler);
router.get('/:channelId/now-playing', channelAccess, getCurrentlyPlayingHandler);
router.get('/:channelId/currently-playing', channelAccess, getCurrentlyPlayingHandler);
router.get('/:channelId/current-playout', channelAccess, getCurrentlyPlayingHandler);
router.get('/:channelId/stream/now-playing', channelAccess, getCurrentlyPlayingHandler);

// Playlist routes (accessible to assigned user, admin, super_admin)
router.get('/:channelId/playlists', channelAccess, getPlaylists);
router.post('/:channelId/playlists', channelAccess, createPlaylist);
router.get('/:channelId/playlist/active', channelAccess, getActivePlaylist);
router.put('/:channelId/playlists/:playlistId', channelAccess, updatePlaylist);
router.delete('/:channelId/playlists/:playlistId', channelAccess, deletePlaylist);
router.get('/:channelId/playlist', channelAccess, getPlaylist);
router.put('/:channelId/playlist', channelAccess, savePlaylist);
router.delete('/:channelId/playlist', channelAccess, clearPlaylist);

// Branding controls (Logo & Ticker)
router.put('/:channelId/logo', channelAccess, updateLogoBranding);
router.delete('/:channelId/logo', channelAccess, removeLogo);
router.post('/:channelId/logo/upload', channelAccess, uploadLogo.single('logo'), uploadLogoFile);

// Station Bug controls (Image & Animated GIF)
router.put('/:channelId/bug', channelAccess, updateBugBranding);
router.delete('/:channelId/bug', channelAccess, removeBug);
router.post('/:channelId/bug/upload', channelAccess, uploadBug.single('bug'), uploadBugFile);
router.post('/:channelId/bug/preview', channelAccess, ensureBugPreview);

router.put('/:channelId/ticker', channelAccess, updateTickerBranding);
router.delete('/:channelId/ticker', channelAccess, removeTicker);

// Dynamic Ad & Graphics controls (L-Band & Ashton Band)
router.put('/:channelId/lband', channelAccess, updateLBandBranding);
router.post('/:channelId/lband/fire', channelAccess, fireLBandLive);
router.delete('/:channelId/lband', channelAccess, removeLBand);
router.post('/:channelId/lband/upload', channelAccess, uploadLBand.single('lband'), uploadLBandFile);

router.put('/:channelId/ashton', channelAccess, updateAshtonBranding);
router.post('/:channelId/ashton/fire', channelAccess, fireAshtonLive);
router.delete('/:channelId/ashton', channelAccess, removeAshton);
router.post('/:channelId/ashton/upload', channelAccess, uploadAshton.single('ashton'), uploadAshtonFile);

// Back In Timer controls (countdown overlay during commercial / ad schedules)
router.put('/:channelId/timer', channelAccess, updateTimerBranding);
router.delete('/:channelId/timer', channelAccess, removeTimer);
router.post('/:channelId/timer/upload', channelAccess, uploadTimer.single('image'), uploadTimerImage);

// Reusable L-Band & Ashton Band Library Presets
router.get('/:channelId/bands', channelAccess, getBands);
router.post('/:channelId/bands', channelAccess, uploadOverlay.single('image'), createBand);
router.put('/:channelId/bands/:bandId', channelAccess, uploadOverlay.single('image'), updateBand);
router.post('/:channelId/bands/:bandId/play-now', channelAccess, fireBandNow);
router.delete('/:channelId/bands/:bandId', channelAccess, deleteBand);

// Scheduled Playout routes (time-based video interruption and resumption)
router.get('/:channelId/schedules', channelAccess, getSchedules);
router.post('/:channelId/schedules', channelAccess, uploadOverlay.single('image'), createSchedule);
router.put('/:channelId/schedules/:scheduleId', channelAccess, uploadOverlay.single('image'), updateSchedule);
router.patch('/:channelId/schedules/:scheduleId/toggle', channelAccess, toggleSchedule);
router.post('/:channelId/schedules/:scheduleId/play-now', channelAccess, playScheduleNow);
router.delete('/:channelId/schedules/:scheduleId', channelAccess, deleteSchedule);

export default router;
