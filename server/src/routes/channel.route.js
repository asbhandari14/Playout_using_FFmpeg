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
  removeTimer
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
import { auth } from '../middleware/auth.middleware.js';
import { role } from '../middleware/role.middleware.js';
import { uploadLogo, uploadBug, uploadLBand, uploadAshton, uploadOverlay } from '../middleware/logoUpload.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(auth);

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
router.post('/:channelId/check-online', CheckChannelOnlineOrOffline);

// Live Stream controls (Start / Stop / Status / Now Playing)
router.post('/:channelId/start', startStreamHandler);
router.post('/:channelId/stop', stopStreamHandler);
router.get('/:channelId/stream/status', getStreamStatusHandler);
router.get('/:channelId/now-playing', getCurrentlyPlayingHandler);
router.get('/:channelId/currently-playing', getCurrentlyPlayingHandler);
router.get('/:channelId/current-playout', getCurrentlyPlayingHandler);
router.get('/:channelId/stream/now-playing', getCurrentlyPlayingHandler);

// Playlist routes (accessible to assigned user, admin, super_admin)
router.get('/:channelId/playlists', getPlaylists);
router.post('/:channelId/playlists', createPlaylist);
router.get('/:channelId/playlist/active', getActivePlaylist);
router.put('/:channelId/playlists/:playlistId', updatePlaylist);
router.delete('/:channelId/playlists/:playlistId', deletePlaylist);
router.get('/:channelId/playlist', getPlaylist);
router.put('/:channelId/playlist', savePlaylist);
router.delete('/:channelId/playlist', clearPlaylist);

// Branding controls (Logo & Ticker)
router.put('/:channelId/logo', updateLogoBranding);
router.delete('/:channelId/logo', removeLogo);
router.post('/:channelId/logo/upload', uploadLogo.single('logo'), uploadLogoFile);

// Station Bug controls (Image & Animated GIF)
router.put('/:channelId/bug', updateBugBranding);
router.delete('/:channelId/bug', removeBug);
router.post('/:channelId/bug/upload', uploadBug.single('bug'), uploadBugFile);
router.post('/:channelId/bug/preview', ensureBugPreview);

router.put('/:channelId/ticker', updateTickerBranding);
router.delete('/:channelId/ticker', removeTicker);

// Dynamic Ad & Graphics controls (L-Band & Ashton Band)
router.put('/:channelId/lband', updateLBandBranding);
router.post('/:channelId/lband/fire', fireLBandLive);
router.delete('/:channelId/lband', removeLBand);
router.post('/:channelId/lband/upload', uploadLBand.single('lband'), uploadLBandFile);

router.put('/:channelId/ashton', updateAshtonBranding);
router.post('/:channelId/ashton/fire', fireAshtonLive);
router.delete('/:channelId/ashton', removeAshton);
router.post('/:channelId/ashton/upload', uploadAshton.single('ashton'), uploadAshtonFile);

// Back In Timer controls (countdown overlay during commercial / ad schedules)
router.put('/:channelId/timer', updateTimerBranding);
router.delete('/:channelId/timer', removeTimer);

// Reusable L-Band & Ashton Band Library Presets
router.get('/:channelId/bands', getBands);
router.post('/:channelId/bands', uploadOverlay.single('image'), createBand);
router.put('/:channelId/bands/:bandId', uploadOverlay.single('image'), updateBand);
router.post('/:channelId/bands/:bandId/play-now', fireBandNow);
router.delete('/:channelId/bands/:bandId', deleteBand);

// Scheduled Playout routes (time-based video interruption and resumption)
router.get('/:channelId/schedules', getSchedules);
router.post('/:channelId/schedules', uploadOverlay.single('image'), createSchedule);
router.put('/:channelId/schedules/:scheduleId', uploadOverlay.single('image'), updateSchedule);
router.patch('/:channelId/schedules/:scheduleId/toggle', toggleSchedule);
router.post('/:channelId/schedules/:scheduleId/play-now', playScheduleNow);
router.delete('/:channelId/schedules/:scheduleId', deleteSchedule);

export default router;
