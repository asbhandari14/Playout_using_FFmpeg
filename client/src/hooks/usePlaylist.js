import { useEffect, useMemo, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPlaylists,
  fetchActivePlaylist,
  setCurrentPlaylist,
  createPlaylistThunk,
  updatePlaylistThunk,
  deletePlaylistThunk,
  savePlaylistThunk,
  clearPlaylistThunk,
  addItem,
  removeItem,
  moveItem,
  duplicateItem,
  formatTime
} from '../store/slices/playlistSlice.js';

export const PLAYLIST_TYPE_CONFIG = {
  emergency: {
    type: 'emergency',
    priority: 5,
    label: 'Emergency Playlist',
    shortLabel: 'Emergency',
    badge: 'P5 (Highest)',
    colorClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    activeBadgeClass: 'bg-rose-600 text-white animate-pulse',
    description: 'Highest priority override (preempts all other broadcasts)'
  },
  advertisement: {
    type: 'advertisement',
    priority: 4,
    label: 'Advertisement Playlist',
    shortLabel: 'Advertisement',
    badge: 'P4 (Ad Playout)',
    colorClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    activeBadgeClass: 'bg-amber-600 text-white animate-pulse',
    description: '2nd highest priority (commercial breaks & sponsors)'
  },
  live_schedule: {
    type: 'live_schedule',
    priority: 3,
    label: 'Live Schedule',
    shortLabel: 'Live Schedule',
    badge: 'P3 (Live Event)',
    colorClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    activeBadgeClass: 'bg-purple-600 text-white animate-pulse',
    description: '3rd highest priority (live stream relay & scheduled live feeds)'
  },
  scheduling: {
    type: 'scheduling',
    priority: 2,
    label: 'Scheduling Playlist',
    shortLabel: 'Schedule',
    badge: 'P2 (Scheduled)',
    colorClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    activeBadgeClass: 'bg-blue-600 text-white animate-pulse',
    description: '4th highest priority (timed shows & time-slot broadcasts)'
  },
  default: {
    type: 'default',
    priority: 1,
    label: 'Default Playlist',
    shortLabel: 'Default',
    badge: 'P1 (Lowest / Baseline)',
    colorClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    activeBadgeClass: 'bg-emerald-600 text-white animate-pulse',
    description: 'Lowest priority continuous 24/7 background loop'
  }
};

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', full: 'Sunday' },
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' }
];

export const isPlaylistActiveNow = (playlist, now = new Date()) => {
  if (!playlist || !playlist.isActive) return false;

  if (playlist.type === 'default' && (!playlist.scheduleOption || playlist.scheduleOption === 'none')) {
    return true;
  }
  if (playlist.type === 'emergency' && (!playlist.scheduleOption || playlist.scheduleOption === 'none')) {
    return true;
  }

  const currentDay = now.getDay();
  const currentTime = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');

  // Date check
  if (playlist.scheduleOption === 'date') {
    if (playlist.startDate && now < new Date(playlist.startDate)) return false;
    if (playlist.endDate) {
      const end = new Date(playlist.endDate);
      end.setHours(23, 59, 59, 999);
      if (now > end) return false;
    }
  }

  // Weekly check
  if (playlist.scheduleOption === 'weekly') {
    if (Array.isArray(playlist.daysOfWeek) && playlist.daysOfWeek.length > 0) {
      if (!playlist.daysOfWeek.includes(currentDay)) return false;
    }
  }

  // Time window check
  if (playlist.startTime && playlist.endTime) {
    const start = playlist.startTime.length === 5 ? `${playlist.startTime}:00` : playlist.startTime;
    const end = playlist.endTime.length === 5 ? `${playlist.endTime}:00` : playlist.endTime;
    if (start <= end) {
      if (currentTime < start || currentTime > end) return false;
    } else {
      if (currentTime < start && currentTime > end) return false;
    }
  } else if (playlist.startTime) {
    const start = playlist.startTime.length === 5 ? `${playlist.startTime}:00` : playlist.startTime;
    if (currentTime < start) return false;
  }

  return true;
};

export const formatScheduleSummary = (playlist) => {
  if (!playlist) return '';
  if (!playlist.scheduleOption || playlist.scheduleOption === 'none') {
    return playlist.type === 'default' ? '24/7 Baseline Playout' : 'Continuous / Manual Trigger';
  }

  const parts = [];

  if (playlist.scheduleOption === 'weekly') {
    if (Array.isArray(playlist.daysOfWeek) && playlist.daysOfWeek.length > 0) {
      const dayNames = playlist.daysOfWeek
        .slice()
        .sort((a, b) => a - b)
        .map((d) => DAYS_OF_WEEK.find((item) => item.value === d)?.label || d)
        .join(', ');
      parts.push(`Weekly (${dayNames})`);
    } else {
      parts.push('Weekly (Every day)');
    }
  } else if (playlist.scheduleOption === 'date') {
    const startStr = playlist.startDate ? new Date(playlist.startDate).toLocaleDateString() : '';
    const endStr = playlist.endDate ? new Date(playlist.endDate).toLocaleDateString() : '';
    if (startStr && endStr) {
      parts.push(`${startStr} - ${endStr}`);
    } else if (startStr) {
      parts.push(`From ${startStr}`);
    } else if (endStr) {
      parts.push(`Until ${endStr}`);
    }
  }

  if (playlist.startTime && playlist.endTime) {
    parts.push(`${playlist.startTime} - ${playlist.endTime}`);
  } else if (playlist.startTime) {
    parts.push(`From ${playlist.startTime}`);
  }

  return parts.join(' | ') || 'Configured Schedule';
};

export function usePlaylist(channelId) {
  const dispatch = useDispatch();
  const {
    playlists,
    currentPlaylist,
    activeOnAirPlaylist,
    allActiveCandidates,
    items,
    totalDuration,
    totalDurationFormatted,
    loop,
    hasUnsavedChanges,
    loading,
    error,
    saveSuccess
  } = useSelector((state) => state.playlist);

  const [currentTick, setCurrentTick] = useState(() => Date.now());

  // Initial fetch and 10s poll for active on-air playlist
  useEffect(() => {
    if (channelId) {
      dispatch(fetchPlaylists(channelId));
      dispatch(fetchActivePlaylist(channelId));

      const interval = setInterval(() => {
        setCurrentTick(Date.now());
        dispatch(fetchActivePlaylist(channelId));
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [channelId, dispatch]);

  // Derived playlists list sorted by priority (highest priority 5 first, down to 1)
  const sortedPlaylists = useMemo(() => {
    return [...playlists].sort((a, b) => (b.priority || 1) - (a.priority || 1));
  }, [playlists]);

  // Map of active statuses for each playlist calculated for current tick
  const activeStatusMap = useMemo(() => {
    const now = new Date(currentTick);
    const map = {};
    for (const p of playlists) {
      map[p._id] = isPlaylistActiveNow(p, now);
    }
    return map;
  }, [playlists, currentTick]);

  // Grouped counts by type
  const playlistCountsByType = useMemo(() => {
    const counts = {
      emergency: 0,
      advertisement: 0,
      live_schedule: 0,
      scheduling: 0,
      default: 0
    };
    playlists.forEach((p) => {
      if (counts[p.type] !== undefined) {
        counts[p.type] += 1;
      }
    });
    return counts;
  }, [playlists]);

  // Action handlers
  const handleSelectPlaylist = useCallback(
    (playlist) => {
      dispatch(setCurrentPlaylist(playlist));
    },
    [dispatch]
  );

  const handleCreatePlaylist = useCallback(
    async (playlistData) => {
      return await dispatch(createPlaylistThunk({ channelId, ...playlistData })).unwrap();
    },
    [channelId, dispatch]
  );

  const handleUpdatePlaylist = useCallback(
    async (playlistId, playlistData) => {
      return await dispatch(updatePlaylistThunk({ channelId, playlistId, ...playlistData })).unwrap();
    },
    [channelId, dispatch]
  );

  const handleDeletePlaylist = useCallback(
    async (playlistId) => {
      return await dispatch(deletePlaylistThunk({ channelId, playlistId })).unwrap();
    },
    [channelId, dispatch]
  );

  const handleSaveCurrent = useCallback(() => {
    if (!currentPlaylist) return;
    dispatch(
      savePlaylistThunk({
        channelId,
        playlistId: currentPlaylist._id,
        items,
        loop: currentPlaylist.loop !== undefined ? currentPlaylist.loop : true,
        type: currentPlaylist.type
      })
    );
  }, [channelId, currentPlaylist, items, dispatch]);

  const handleClearCurrent = useCallback(() => {
    if (!currentPlaylist) return;
    dispatch(
      clearPlaylistThunk({
        channelId,
        playlistId: currentPlaylist._id
      })
    );
  }, [channelId, currentPlaylist, dispatch]);

  const handleAddItem = useCallback(
    (asset) => {
      dispatch(addItem(asset));
    },
    [dispatch]
  );

  const handleRemoveItem = useCallback(
    (index) => {
      dispatch(removeItem(index));
    },
    [dispatch]
  );

  const handleMoveItem = useCallback(
    (fromIndex, toIndex) => {
      dispatch(moveItem({ fromIndex, toIndex }));
    },
    [dispatch]
  );

  const handleDuplicateItem = useCallback(
    (index) => {
      dispatch(duplicateItem(index));
    },
    [dispatch]
  );

  return {
    playlists,
    sortedPlaylists,
    currentPlaylist,
    activeOnAirPlaylist,
    allActiveCandidates,
    items,
    totalDuration,
    totalDurationFormatted,
    loop,
    hasUnsavedChanges,
    loading,
    error,
    saveSuccess,
    activeStatusMap,
    playlistCountsByType,
    // Methods
    handleSelectPlaylist,
    handleCreatePlaylist,
    handleUpdatePlaylist,
    handleDeletePlaylist,
    handleSaveCurrent,
    handleClearCurrent,
    handleAddItem,
    handleRemoveItem,
    handleMoveItem,
    handleDuplicateItem,
    formatTime,
    formatScheduleSummary,
    isPlaylistActiveNow
  };
}
