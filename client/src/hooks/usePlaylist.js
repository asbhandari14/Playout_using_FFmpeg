import { toast } from 'react-hot-toast';
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

/**
 * Helper to safely extract local midnight Date without UTC shifting
 */
const parseDateMidnight = (val, isEnd = false) => {
  if (!val) return null;
  if (typeof val === 'string' && val.includes('-')) {
    const parts = val.split('T')[0].split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      return isEnd ? new Date(y, m, d, 23, 59, 59, 999) : new Date(y, m, d, 0, 0, 0, 0);
    }
  }
  const d = new Date(val);
  return isEnd
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

export const isPlaylistActiveNow = (playlist, now = new Date()) => {
  if (!playlist || playlist.isActive === false) return false;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  const currentTime = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');

  // 1. Date range check (if scheduleOption is 'date' OR startDate/endDate set)
  if (playlist.scheduleOption === 'date' || (playlist.startDate && playlist.endDate)) {
    if (playlist.startDate) {
      const startDay = parseDateMidnight(playlist.startDate, false);
      const today = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);
      if (today < startDay) return false;
    }
    if (playlist.endDate) {
      const endDay = parseDateMidnight(playlist.endDate, true);
      if (now > endDay) return false;
    }
  }

  // 2. Weekly check
  if (playlist.scheduleOption === 'weekly') {
    if (Array.isArray(playlist.daysOfWeek) && playlist.daysOfWeek.length > 0) {
      if (!playlist.daysOfWeek.includes(currentDay)) return false;
    }
  }

  // 3. Time window check (HH:mm:ss or HH:mm)
  const hasStart = Boolean(playlist.startTime && String(playlist.startTime).trim());
  const hasEnd = Boolean(playlist.endTime && String(playlist.endTime).trim());

  if (hasStart && hasEnd) {
    const rawStart = String(playlist.startTime).trim();
    const rawEnd = String(playlist.endTime).trim();
    const start = rawStart.length === 5 ? `${rawStart}:00` : rawStart;
    const end = rawEnd.length === 5 ? `${rawEnd}:00` : rawEnd;

    if (start <= end) {
      if (currentTime < start || currentTime > end) return false;
    } else {
      // Overnight wraps past midnight (e.g. 23:00 to 02:00)
      if (currentTime < start && currentTime > end) return false;
    }
  } else if (hasStart) {
    const rawStart = String(playlist.startTime).trim();
    const start = rawStart.length === 5 ? `${rawStart}:00` : rawStart;
    if (currentTime < start) return false;
  } else if (hasEnd) {
    const rawEnd = String(playlist.endTime).trim();
    const end = rawEnd.length === 5 ? `${rawEnd}:00` : rawEnd;
    if (currentTime > end) return false;
  }

  return true;
};

/**
 * Resolves the client-side active playlist following the exact priority order:
 * Emergency (5) -> Advertisement (4) -> Live Schedule (3) -> Scheduling (2) -> Default (1)
 */
export const resolveClientActivePlaylist = (playlists = [], now = new Date()) => {
  if (!playlists || playlists.length === 0) return null;

  const priorityOrder = ['emergency', 'advertisement', 'live_schedule', 'scheduling', 'default'];

  for (const type of priorityOrder) {
    const candidates = playlists.filter((p) => p.type === type && p.isActive !== false);
    for (const p of candidates) {
      if (isPlaylistActiveNow(p, now)) {
        const hasItems = Array.isArray(p.items) && p.items.length > 0;
        const hasLiveSource = p.type === 'live_schedule' && Boolean(p.liveSourceUrl);
        if (hasItems || hasLiveSource) {
          return p;
        }
      }
    }
  }

  const fallbackDefault = playlists.find(
    (p) => p.type === 'default' && Array.isArray(p.items) && p.items.length > 0
  );
  if (fallbackDefault) return fallbackDefault;

  return playlists.find((p) => Array.isArray(p.items) && p.items.length > 0) || playlists[0] || null;
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

  // Client-resolved active playlist based on priority hierarchy
  const resolvedActivePlaylist = useMemo(() => {
    const now = new Date(currentTick);
    return resolveClientActivePlaylist(playlists, now);
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
      try {
        const res = await dispatch(createPlaylistThunk({ channelId, ...playlistData })).unwrap();
        toast.success(`Playlist "${playlistData.name || 'New'}" created successfully`);
        return res;
      } catch (err) {
        toast.error(err || 'Failed to create playlist');
        throw err;
      }
    },
    [channelId, dispatch]
  );

  const handleUpdatePlaylist = useCallback(
    async (playlistId, playlistData) => {
      try {
        const res = await dispatch(updatePlaylistThunk({ channelId, playlistId, ...playlistData })).unwrap();
        toast.success('Playlist updated successfully');
        return res;
      } catch (err) {
        toast.error(err || 'Failed to update playlist');
        throw err;
      }
    },
    [channelId, dispatch]
  );

  const handleDeletePlaylist = useCallback(
    async (playlistId) => {
      try {
        const res = await dispatch(deletePlaylistThunk({ channelId, playlistId })).unwrap();
        toast.success('Playlist deleted');
        return res;
      } catch (err) {
        toast.error(err || 'Failed to delete playlist');
        throw err;
      }
    },
    [channelId, dispatch]
  );

  const handleSaveCurrent = useCallback(async () => {
    if (!currentPlaylist) return;
    try {
      await dispatch(
        savePlaylistThunk({
          channelId,
          playlistId: currentPlaylist._id,
          items,
          loop: currentPlaylist.loop !== undefined ? currentPlaylist.loop : true,
          type: currentPlaylist.type
        })
      ).unwrap();
      toast.success(`Playlist "${currentPlaylist.name || 'Broadcast'}" saved successfully`);
    } catch (err) {
      toast.error(err || 'Failed to save playlist');
    }
  }, [channelId, currentPlaylist, items, dispatch]);

  const handleClearCurrent = useCallback(async () => {
    if (!currentPlaylist) return;
    try {
      await dispatch(
        clearPlaylistThunk({
          channelId,
          playlistId: currentPlaylist._id
        })
      ).unwrap();
      toast.success('Broadcast playlist cleared');
    } catch (err) {
      toast.error(err || 'Failed to clear playlist');
    }
  }, [channelId, currentPlaylist, dispatch]);

  const handleAddItem = useCallback(
    (asset) => {
      dispatch(addItem(asset));
      toast.success(`Added "${asset.originalName}" to playlist`);
    },
    [dispatch]
  );

  const handleRemoveItem = useCallback(
    (index) => {
      dispatch(removeItem(index));
      toast('Item removed from playlist', { icon: '🗑️' });
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
      toast.success('Video clip duplicated in sequence');
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
    resolvedActivePlaylist,
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
    isPlaylistActiveNow,
    resolveClientActivePlaylist
  };
}
