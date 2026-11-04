import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { fetchChannels } from '../store/slices/channelSlice.js';
import { logoutUser } from '../store/slices/authSlice.js';
import { formatStorageComparison } from './useStorageCalc.js';

export default function useChannel() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { list: channels, loading, error } = useSelector((state) => state.channels);
  const { user: currentUser } = useSelector((state) => state.auth);

  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchChannels());

    const handleOnline = () => {
      dispatch(fetchChannels());
    };
    window.addEventListener('online', handleOnline);

    const socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000
    });

    socket.on('connect', () => {
      dispatch(fetchChannels());
    });

    socket.on('stream_status', () => {
      dispatch(fetchChannels());
    });

    socket.on('channel_storage_updated', () => {
      dispatch(fetchChannels());
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      socket.disconnect();
    };
  }, [dispatch]);

  const filteredChannels = useMemo(() => {
    const list = Array.isArray(channels) ? channels : [];
    const q = searchQuery.trim().toLowerCase();

    const filtered = q
      ? list.filter((ch) => {
          const name = (ch.name || '').toLowerCase();
          const key = (ch.streamKey || '').toLowerCase();
          return name.includes(q) || key.includes(q);
        })
      : list;

    return filtered.map((ch) => {
      const isLive = ch.status === 'live';
      const serverBase = ch.server?.hlsBaseUrl || 'http://127.0.0.1:81';
      const rtmpBase = ch.server?.rtmpBaseUrl || 'rtmp://127.0.0.1/static';
      const hlsUrl = ch.hlsUrl || `${serverBase}/${ch.name}/index.m3u8`;
      const rtmpUrl = ch.rtmpUrl || `${rtmpBase}/${ch.name}`;
      const resolution = ch.outputSettings?.resolution || '1280x720';
      const fps = ch.outputSettings?.fps || 25;
      const bitrate = ch.outputSettings?.videoBitrate || '2500k';
      const streamFormat = `${resolution} @ ${fps}fps (${bitrate})`;
      const assignedOperator = ch.assignedUser?.name || 'Unassigned';
      const mediaServer = ch.server?.name || 'Default Media Server';

      const usedBytes = ch.usedStorage || 0;
      const allocatedBytes = ch.allocatedStorage || 0;
      const storageDisplay = formatStorageComparison(usedBytes, allocatedBytes);

      return {
        ...ch,
        isLive,
        hlsUrl,
        rtmpUrl,
        streamFormat,
        assignedOperator,
        mediaServer,
        usedBytes,
        allocatedBytes,
        storageDisplay
      };
    });
  }, [channels, searchQuery]);

  const openChannelStudio = useCallback(
    (channelId) => {
      if (channelId) {
        navigate(`/channels/${channelId}`);
      }
    },
    [navigate]
  );

  const toggleProfileMenu = useCallback(() => {
    setIsProfileMenuOpen((prev) => !prev);
  }, []);

  const logout = useCallback(() => {
    setIsProfileMenuOpen(false);
    dispatch(logoutUser());
    navigate('/login');
  }, [dispatch, navigate]);

  return {
    currentUser,
    channels,
    filteredChannels,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    isProfileMenuOpen,
    toggleProfileMenu,
    openChannelStudio,
    logout
  };
}

