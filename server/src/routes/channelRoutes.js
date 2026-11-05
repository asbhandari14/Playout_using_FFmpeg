import { Router } from 'express';
import {
  getChannels,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  createChannelSchema,
  updateChannelSchema,
  CheckChannelOnlineOrOffline
} from '../controllers/channelController.js';
import {
  getPlaylist,
  savePlaylist,
  clearPlaylist,
  getPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  getActivePlaylist
} from '../controllers/playlistController.js';
import {
  updateLogoBranding,
  removeLogo,
  uploadLogoFile,
  updateBugBranding,
  removeBug,
  uploadBugFile,
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
} from '../controllers/brandingController.js';
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  toggleSchedule,
  deleteSchedule,
  playScheduleNow
} from '../controllers/scheduleController.js';
import {
  startStreamHandler,
  stopStreamHandler,
  getStreamStatusHandler
} from '../controllers/streamController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { uploadLogo, uploadBug, uploadLBand, uploadAshton } from '../middleware/logoUpload.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

// List channels: super_admin, admin, user
router.get('/', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER]), getChannels);
router.get('/:id', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER]), getChannelById);

// Create, update, delete channels: super_admin and admin only
router.post('/', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), validate(createChannelSchema), createChannel);
router.put('/:id', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), validate(updateChannelSchema), updateChannel);
router.delete('/:id', authorize([ROLES.SUPER_ADMIN, ROLES.ADMIN]), deleteChannel);

// Channel stream live status check (online vs offline)
router.post('/check-online', CheckChannelOnlineOrOffline);
router.post('/check-status', CheckChannelOnlineOrOffline);
router.post('/:channelId/check-online', CheckChannelOnlineOrOffline);

// Live Stream controls (Start / Stop / Status)
router.post('/:channelId/start', startStreamHandler);
router.post('/:channelId/stop', stopStreamHandler);
router.get('/:channelId/stream/status', getStreamStatusHandler);

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

// Scheduled Playout routes (time-based video interruption and resumption)
router.get('/:channelId/schedules', getSchedules);
router.post('/:channelId/schedules', createSchedule);
router.put('/:channelId/schedules/:scheduleId', updateSchedule);
router.patch('/:channelId/schedules/:scheduleId/toggle', toggleSchedule);
router.post('/:channelId/schedules/:scheduleId/play-now', playScheduleNow);
router.delete('/:channelId/schedules/:scheduleId', deleteSchedule);

export default router;
