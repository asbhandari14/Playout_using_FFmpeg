import { toast } from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { fetchChannelById, updateChannelStatus, updateCurrentChannelBranding } from '../../store/slices/channelSlice.js';
import {
  fetchAssets,
  updateAssetProgress,
  updateAssetReady,
  updateAssetFailed
} from '../../store/slices/assetSlice.js';
import {
  fetchPlaylists,
  fetchActivePlaylist,
  setPlaylistState,
  addItem
} from '../../store/slices/playlistSlice.js';
import api from '../../api/axios.js';

import BroadcastHeader from '../../components/header/BroadcastHeader.jsx';
import AssetLibrary from '../../components/asset/AssetLibrary.jsx';
import VideoSection from '../../components/VideoSection.jsx';
import PlaylistTable from '../../components/table/PlaylistTable.jsx';
import LiveControls from '../../components/LiveControls.jsx';
import Modal from '../../components/modals/Modal.jsx';
import MoreSettingsModal from '../../components/modals/MoreSettingsModal.jsx';
import ScheduleModal from '../../components/modals/ScheduleModal.jsx';

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
      dispatch(fetchPlaylists(channelId));
      dispatch(fetchActivePlaylist(channelId));
    }
  }, [dispatch, channelId, categoryFilter, searchQuery]);

  // Sync live status with channel object
  useEffect(() => {
    if (currentChannel) {
      setIsLive(currentChannel.status === 'live');
    }
  }, [currentChannel]);

  // Real-time channel sync & periodic telemetry polling (No WebSockets)
  useEffect(() => {
    if (!channelId) return;

    let isMounted = true;

    // Initial load
    dispatch(fetchChannelById(channelId));
    dispatch(fetchPlaylists(channelId));
    dispatch(fetchActivePlaylist(channelId));

    const syncLiveTelemetry = async () => {
      try {
        const res = await api.get(`/channels/${channelId}/now-playing`);
        if (!isMounted) return;

        if (res.data?.success) {
          const liveStatus = Boolean(res.data.isLive);
          setIsLive(liveStatus);
          dispatch(updateChannelStatus({ channelId, status: liveStatus ? 'live' : 'idle' }));

          if (res.data.branding) {
            dispatch(updateCurrentChannelBranding(res.data.branding));
          }

          if (res.data.scheduling?.source === 'schedule_event') {
            setCurrentOnAirSchedule(res.data.scheduling);
          } else {
            setCurrentOnAirSchedule(null);
          }
        }
      } catch (err) {
        // Quietly ignore transient network glitches during polling
      }
    };

    // Immediate first check
    syncLiveTelemetry();

    // 2.5s polling loop for live playout status and on-air telemetry
    const pollTimer = setInterval(syncLiveTelemetry, 2500);

    const handleOnline = () => {
      dispatch(fetchChannelById(channelId));
      dispatch(fetchPlaylists(channelId));
      dispatch(fetchActivePlaylist(channelId));
      syncLiveTelemetry();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
      window.removeEventListener('online', handleOnline);
    };
  }, [channelId, dispatch]);

  // Toggle Live Broadcast
  const handleToggleLive = async () => {
    try {
      if (isLive) {
        await api.post(`/channels/${channelId}/stop`);
        setIsLive(false);
        dispatch(updateChannelStatus({ channelId, status: 'idle' }));
        toast.success('Live broadcast stopped');
      } else {
        await api.post(`/channels/${channelId}/start`, { startIndex: 0 });
        setIsLive(true);
        dispatch(updateChannelStatus({ channelId, status: 'live' }));
        toast.success('Live broadcast started!');
      }

    } catch (err) {
      toast.error(err.response?.data?.message || 'Error toggling live broadcast stream');
    }
  };

  // Start or jump live broadcast from a specific playlist item
  const handlePlayFromIndex = async (index) => {
    try {
      await api.post(`/channels/${channelId}/start`, { startIndex: index });
      setIsLive(true);
      dispatch(updateChannelStatus({ channelId, status: 'live' }));
      toast.success(`Playing from playlist item #${index + 1}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error starting playback from selected item');
    }
  };

  // Add asset from library to playlist
  const handleAddToPlaylist = (asset) => {
    dispatch(addItem(asset));
    toast.success(`Added "${asset.originalName}" to playlist`);
  };

  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col bg-[#0c0e12] overflow-x-hidden lg:overflow-hidden select-none">
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
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden min-h-0">

        {/* LEFT PANEL: Assets Library */}
        <div className="order-2 lg:order-1 w-full lg:w-[215px] xl:w-[235px] 2xl:w-[280px] min-[1800px]:w-[320px] shrink-0 h-[380px] lg:h-full flex flex-col border-t lg:border-t-0 border-[#202634]">
          <AssetLibrary
            channelId={channelId}
            onAddToPlaylist={handleAddToPlaylist}
          />
        </div>

        {/* CENTER PANEL: Playout Production Deck (Video Section + Broadcast Window Table) */}
        <div className="order-1 lg:order-2 flex-1 lg:h-full flex flex-col lg:overflow-hidden min-w-0">
          {/* Top of center: Local Preview + Live PGM Players */}
          <VideoSection
            channel={currentChannel}
            selectedAsset={selectedAsset}
            isLive={isLive}
          />

          {/* Bottom of center: Broadcast Window Playlist Table */}
          <PlaylistTable
            channelId={channelId}
            onPlayFromIndex={handlePlayFromIndex}
          />
        </div>

        {/* RIGHT PANEL: Live Controls (Logo, Bug, Ticker & Timer Tabs) */}
        <div className="order-3 w-full lg:w-[235px] xl:w-[255px] 2xl:w-[300px] min-[1800px]:w-[340px] shrink-0 lg:h-full flex flex-col border-t lg:border-t-0 border-[#202634]">
          <LiveControls
            channel={currentChannel}
            currentOnAirSchedule={currentOnAirSchedule}
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
      {/* <Modal
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
      </Modal> */}

      {/* More Settings: Ad & Playout Graphics Dashboard Modal */}
      {/* <MoreSettingsModal
        isOpen={isMoreSettingsOpen}
        onClose={() => setIsMoreSettingsOpen(false)}
        channel={currentChannel}
        onChannelUpdated={() => dispatch(fetchChannelById(channelId))}
      /> */}

      {/* Scheduled Playout Manager Modal */}
      {/* <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        channelId={channelId}
        channelName={currentChannel?.name}
        currentOnAirSchedule={currentOnAirSchedule}
      /> */}
    </div>
  );
}
