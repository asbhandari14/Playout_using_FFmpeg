import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';

import { fetchChannelById, updateChannelStatus, updateCurrentChannelBranding } from '../store/slices/channelSlice.js';
import {
  fetchAssets,
  updateAssetProgress,
  updateAssetReady,
  updateAssetFailed
} from '../store/slices/assetSlice.js';
import {
  fetchPlaylist,
  setPlaylistState,
  addItem
} from '../store/slices/playlistSlice.js';
import api from '../api/axios.js';

import BroadcastHeader from '../components/BroadcastHeader.jsx';
import AssetLibrary from '../components/AssetLibrary.jsx';
import VideoSection from '../components/VideoSection.jsx';
import PlaylistTable from '../components/PlaylistTable.jsx';
import LiveControls from '../components/LiveControls.jsx';
import Modal from '../components/Modal.jsx';
import MoreSettingsModal from '../components/MoreSettingsModal.jsx';
import ScheduleModal from '../components/ScheduleModal.jsx';

export default function ControlRoomPage() {
  const { channelId } = useParams();
  const dispatch = useDispatch();

  const { currentChannel } = useSelector((state) => state.channels);
  const { selectedAsset, categoryFilter, searchQuery } = useSelector((state) => state.assets);
  const { totalDurationFormatted } = useSelector((state) => state.playlist);

  const [isLive, setIsLive] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMoreSettingsOpen, setIsMoreSettingsOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [currentOnAirSchedule, setCurrentOnAirSchedule] = useState(null);

  // Initial data loading
  useEffect(() => {
    if (channelId) {
      dispatch(fetchChannelById(channelId));
      dispatch(fetchAssets({ channelId, category: categoryFilter, search: searchQuery }));
      dispatch(fetchPlaylist(channelId));
    }
  }, [dispatch, channelId, categoryFilter, searchQuery]);

  // Sync live status with channel object
  useEffect(() => {
    if (currentChannel) {
      setIsLive(currentChannel.status === 'live');
    }
  }, [currentChannel]);

  // Socket.IO real-time channel connection
  useEffect(() => {
    if (!channelId) return;

    const socket = io();

    socket.on('connect', () => {
      socket.emit('join_channel', channelId);
    });

    socket.on('asset_progress', (data) => {
      dispatch(updateAssetProgress(data));
    });

    socket.on('asset_ready', (data) => {
      dispatch(updateAssetReady(data));
    });

    socket.on('asset_failed', (data) => {
      dispatch(updateAssetFailed(data));
    });

    socket.on('playlist_updated', (data) => {
      dispatch(setPlaylistState(data));
    });

    socket.on('branding_updated', (data) => {
      if (data?.type && data[data.type]) {
        dispatch(updateCurrentChannelBranding({ [data.type]: data[data.type] }));
      }
      dispatch(fetchChannelById(channelId));
    });

    socket.on('stream_status', (data) => {
      if (data.channelId === channelId) {
        setIsLive(data.status === 'live');
        dispatch(updateChannelStatus({ channelId, status: data.status }));
        if (data.status === 'idle') {
          setCurrentOnAirSchedule(null);
        }
      }
    });

    socket.on('schedule_started', (data) => {
      if (data.channelId === channelId) {
        console.log('[Socket.IO] Scheduled broadcast started:', data);
        setCurrentOnAirSchedule(data);
      }
    });

    socket.on('schedule_ended', (data) => {
      if (data.channelId === channelId) {
        console.log('[Socket.IO] Scheduled broadcast ended:', data);
        setCurrentOnAirSchedule(null);
      }
    });

    return () => {
      socket.emit('leave_channel', channelId);
      socket.disconnect();
    };
  }, [channelId, dispatch]);

  // Toggle Live Broadcast
  const handleToggleLive = async () => {
    try {
      if (isLive) {
        await api.post(`/channels/${channelId}/stop`);
        setIsLive(false);
        dispatch(updateChannelStatus({ channelId, status: 'idle' }));
      } else {
        await api.post(`/channels/${channelId}/start`, { startIndex: 0 });
        setIsLive(true);
        dispatch(updateChannelStatus({ channelId, status: 'live' }));
      }

    } catch (err) {
      alert(err.response?.data?.message || 'Error toggling live broadcast stream');
    }
  };

  // Add asset from library to playlist
  const handleAddToPlaylist = (asset) => {
    dispatch(addItem(asset));
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0c0e12] overflow-hidden select-none">
      {/* Top Header */}
      <BroadcastHeader
        channel={currentChannel}
        totalRunTime={totalDurationFormatted}
        isLive={isLive}
        onToggleLive={handleToggleLive}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenMoreSettings={() => setIsMoreSettingsOpen(true)}
        onOpenSchedules={() => setIsScheduleModalOpen(true)}
        currentOnAirSchedule={currentOnAirSchedule}
      />

      {/* Main 3-Column Studio Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Assets Library (approx 22% width / 300px min) */}
        <div className="w-[300px] xl:w-[340px] shrink-0 h-full flex flex-col">
          <AssetLibrary
            channelId={channelId}
            onAddToPlaylist={handleAddToPlaylist}
          />
        </div>

        {/* CENTER PANEL: Playout Production Deck (Video Section + Broadcast Window Table) */}
        <div className="flex-1 h-full flex flex-col overflow-hidden min-w-[500px]">
          {/* Top of center: Local Preview + Live PGM Players */}
          <VideoSection
            channel={currentChannel}
            selectedAsset={selectedAsset}
            isLive={isLive}
          />

          {/* Bottom of center: Broadcast Window Playlist Table */}
          <PlaylistTable
            channelId={channelId}
            onPlayFromIndex={(index) => {
              // Trigger play from here
              console.log('Play from index:', index);
            }}
          />
        </div>

        {/* RIGHT PANEL: Live Controls (Logo & Ticker Tabs, approx 24% width / 320px min) */}
        <div className="w-[310px] xl:w-[350px] shrink-0 h-full flex flex-col">
          <LiveControls
            channel={currentChannel}
            onBrandingUpdated={(payload) => {
              if (!payload) return;
              if (payload.type && payload.data) {
                dispatch(updateCurrentChannelBranding({ [payload.type]: payload.data }));
              } else if (payload.logo || payload.ticker || payload.lband || payload.ashton || payload.bug) {
                dispatch(updateCurrentChannelBranding(payload));
              } else {
                dispatch(updateCurrentChannelBranding({ logo: payload }));
              }
              dispatch(fetchChannelById(channelId));
            }}
          />
        </div>
      </div>

      {/* Settings Modal */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Channel Stream Settings"
      >
        <div className="space-y-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
              Channel Name
            </span>
            <div className="font-semibold text-slate-200 bg-[#0a0d13] p-2 rounded-lg border border-[#232b3c]">
              {currentChannel?.name}
            </div>
          </div>

          <div>
            <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
              Assigned Flussonic Server
            </span>
            <div className="font-semibold text-slate-200 bg-[#0a0d13] p-2 rounded-lg border border-[#232b3c]">
              {currentChannel?.server?.name} ({currentChannel?.server?.streamUrl || currentChannel?.server?.hlsBaseUrl || 'http://94.136.185.222:81'})
            </div>
          </div>

          <div>
            <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
              HLS Playout Output URL
            </span>
            <div className="font-mono text-emerald-400 text-xs bg-[#0a0d13] p-2 rounded-lg border border-[#232b3c] break-all select-all">
              {currentChannel?.hlsUrl || `${currentChannel?.server?.hlsBaseUrl}/${currentChannel?.streamKey || currentChannel?.name}/index.m3u8`}
            </div>
          </div>

          <div>
            <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
              RTMP Target Playout URL
            </span>
            <div className="font-mono text-blue-400 text-xs bg-[#0a0d13] p-2 rounded-lg border border-[#232b3c] break-all select-all">
              {currentChannel?.rtmpUrl || `${currentChannel?.server?.rtmpBaseUrl}/${currentChannel?.streamKey || currentChannel?.name}`}
            </div>
          </div>


          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
                Output Resolution
              </span>
              <div className="font-mono text-slate-300 bg-[#0a0d13] p-2 rounded-lg border border-[#232b3c]">
                {currentChannel?.outputSettings?.resolution || '1280x720'}
              </div>
            </div>
            <div>
              <span className="text-slate-400 block mb-1 uppercase font-bold text-[10px]">
                Framerate (FPS)
              </span>
              <div className="font-mono text-slate-300 bg-[#0a0d13] p-2 rounded-lg border border-[#232b3c]">
                {currentChannel?.outputSettings?.fps || 25} fps
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#232a38] flex justify-end">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* More Settings: Ad & Playout Graphics Dashboard Modal */}
      <MoreSettingsModal
        isOpen={isMoreSettingsOpen}
        onClose={() => setIsMoreSettingsOpen(false)}
        channel={currentChannel}
        onChannelUpdated={() => dispatch(fetchChannelById(channelId))}
      />

      {/* Scheduled Playout Manager Modal */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        channelId={channelId}
        channelName={currentChannel?.name}
        currentOnAirSchedule={currentOnAirSchedule}
      />
    </div>
  );
}
