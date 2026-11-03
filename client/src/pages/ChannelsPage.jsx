import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  clearChannelAlerts
} from '../store/slices/channelSlice.js';
import { fetchServers } from '../store/slices/serverSlice.js';
import { fetchUsers } from '../store/slices/userSlice.js';
import Navbar from '../components/Navbar.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx';
import { io } from 'socket.io-client';
import {
  Tv,
  Plus,
  Search,
  Radio,
  Edit2,
  Trash2,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

export default function ChannelsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { list: channels, loading, error, successMessage } = useSelector((state) => state.channels);
  const { list: servers } = useSelector((state) => state.servers);
  const { list: users } = useSelector((state) => state.users);
  const { user: currentUser } = useSelector((state) => state.auth);

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [channelToDelete, setChannelToDelete] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [server, setServer] = useState('');
  const [assignedUser, setAssignedUser] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [resolution, setResolution] = useState('1280x720');
  const [fps, setFps] = useState(25);
  const [videoBitrate, setVideoBitrate] = useState('2500k');
  const [audioBitrate, setAudioBitrate] = useState('128k');

  const canManage = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  useEffect(() => {
    dispatch(fetchChannels({ search }));
    if (canManage) {
      dispatch(fetchServers());
      dispatch(fetchUsers());
    }

    const handleOnline = () => {
      console.log('[ChannelsPage] Internet restored. Re-fetching channels...');
      dispatch(fetchChannels({ search }));
    };
    window.addEventListener('online', handleOnline);

    const socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000
    });

    socket.on('connect', () => {
      dispatch(fetchChannels({ search }));
    });

    socket.on('stream_status', () => {
      dispatch(fetchChannels({ search }));
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      socket.disconnect();
    };
  }, [dispatch, search, canManage]);

  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => dispatch(clearChannelAlerts()), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error, dispatch]);

  const handleOpenAdd = () => {
    setEditingChannel(null);
    setName('');
    setServer(servers[0]?._id || '');
    setAssignedUser(users[0]?._id || currentUser?._id || '');
    setStreamKey('');
    setResolution('1280x720');
    setFps(25);
    setVideoBitrate('2500k');
    setAudioBitrate('128k');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (channel) => {
    setEditingChannel(channel);
    setName(channel.name);
    setServer(channel.server?._id || channel.server || '');
    setAssignedUser(channel.assignedUser?._id || channel.assignedUser || '');
    setStreamKey(channel.streamKey);
    setResolution(channel.outputSettings?.resolution || '1280x720');
    setFps(channel.outputSettings?.fps || 25);
    setVideoBitrate(channel.outputSettings?.videoBitrate || '2500k');
    setAudioBitrate(channel.outputSettings?.audioBitrate || '128k');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name,
      server,
      assignedUser,
      streamKey,
      outputSettings: { resolution, fps: Number(fps), videoBitrate, audioBitrate }
    };

    if (editingChannel) {
      await dispatch(updateChannel({ id: editingChannel._id, data: payload }));
    } else {
      await dispatch(createChannel(payload));
    }
    setIsModalOpen(false);
  };

  const handleDelete = (ch) => {
    setChannelToDelete(ch);
  };

  const handleConfirmDelete = async () => {
    if (channelToDelete?._id) {
      await dispatch(deleteChannel(channelToDelete._id));
    }
    setChannelToDelete(null);
  };

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Alerts */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}
        {error && (
          <div className="p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 m-0">
              <Tv className="text-blue-500" size={22} />
              Broadcast Channels
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Select a channel to enter the Playout Control Room deck or configure output feeds.
            </p>
          </div>

          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition shadow-lg shadow-blue-600/20"
            >
              <Plus size={16} />
              Create Channel
            </button>
          )}
        </div>

        {/* Search */}
        <div className="bg-[#12161f] border border-[#222938] rounded-xl p-3.5">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading && channels.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500 text-xs">
              Loading broadcast channels...
            </div>
          ) : channels.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500 text-xs">
              No channels available. {canManage && 'Click "Create Channel" to launch one.'}
            </div>
          ) : (
            channels.map((ch) => {
              const isLive = ch.status === 'live';
              return (
                <div
                  key={ch._id}
                  className="bg-[#12161f] border border-[#222938] hover:border-[#2f394d] rounded-2xl p-5 shadow-xl flex flex-col justify-between transition group relative overflow-hidden"
                >
                  {/* Glowing line for live channel */}
                  {isLive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 animate-pulse"></div>
                  )}

                  <div>
                    {/* Channel Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                            isLive
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          }`}
                        >
                          <Radio size={18} className={isLive ? 'animate-pulse' : ''} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-white group-hover:text-blue-400 transition m-0">
                            {ch.name}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Key: {ch.streamKey}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isLive
                            ? 'bg-red-950/80 text-red-400 border border-red-700/80 animate-pulse shadow-sm shadow-red-900/50'
                            : 'bg-slate-800/80 text-slate-300 border border-slate-700/60'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isLive ? 'bg-red-500 animate-ping' : 'bg-slate-400'
                          }`}
                        ></span>
                        {isLive ? 'ON AIR' : 'IDLE'}
                      </span>
                    </div>

                    {/* Metadata details */}
                    <div className="space-y-2 py-3 border-y border-[#1c2230] text-[11px] text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Assigned Operator</span>
                        <span className="font-semibold text-slate-200">
                          {ch.assignedUser?.name || 'Unassigned'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Media Server</span>
                        <span className="text-slate-300">{ch.server?.name || 'Default Flussonic'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Stream Format</span>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {ch.outputSettings?.resolution || '1280x720'} @ {ch.outputSettings?.fps || 25}fps (
                          {ch.outputSettings?.videoBitrate || '2500k'})
                        </span>
                      </div>

                      {/* Display HLS and RTMP URLs */}
                      <div className="pt-2 space-y-1.5 border-t border-[#181e2b]">
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                            HLS Output URL
                          </span>
                          <code
                            className="text-emerald-400 bg-[#0a0d13] px-2 py-0.5 rounded block truncate font-mono text-[10px] border border-[#1f2635]"
                            title={ch.hlsUrl || `${ch.server?.hlsBaseUrl}/${ch.name}/index.m3u8`}
                          >
                            {ch.hlsUrl || `${ch.server?.hlsBaseUrl || 'http://127.0.0.1:81'}/${ch.name}/index.m3u8`}
                          </code>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                            RTMP Push URL
                          </span>
                          <code
                            className="text-blue-400 bg-[#0a0d13] px-2 py-0.5 rounded block truncate font-mono text-[10px] border border-[#1f2635]"
                            title={ch.rtmpUrl || `${ch.server?.rtmpBaseUrl}/${ch.name}`}
                          >
                            {ch.rtmpUrl || `${ch.server?.rtmpBaseUrl || 'rtmp://127.0.0.1/static'}/${ch.name}`}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-5 pt-2 flex items-center justify-between gap-2">
                    <button
                      onClick={() => navigate(`/channels/${ch._id}`)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition shadow-md shadow-blue-600/20"
                    >
                      <PlayCircle size={16} />
                      Enter Control Room
                    </button>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(ch)}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-[#1a202c] rounded-lg transition"
                          title="Edit Channel"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(ch)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-[#1a202c] rounded-lg transition"
                          title="Delete Channel"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Add / Edit Channel Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingChannel ? 'Edit Broadcast Channel' : 'Create New Broadcast Channel'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Channel Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!streamKey || streamKey === name) setStreamKey(e.target.value);
              }}
              placeholder="e.g. playlistTestOne"
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Media Server</label>
            <select
              required
              value={server}
              onChange={(e) => setServer(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {servers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.streamUrl || s.hlsBaseUrl})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Assigned User / Operator
            </label>
            <select
              required
              value={assignedUser}
              onChange={(e) => setAssignedUser(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.email}) - [{u.role}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Stream Key / Stream Identifier (Optional - Defaults to Channel Name)
            </label>
            <input
              type="text"
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              placeholder={name || 'playlistTestOne'}
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
            />
          </div>

          {/* Real-time Generated Streaming URLs Preview */}
          {(() => {
            const selectedServerObj = servers.find((s) => s._id === server);
            const streamUrlBase =
              selectedServerObj?.streamUrl || selectedServerObj?.hlsBaseUrl || 'http://94.136.185.222:81';
            let hostname = '94.136.185.222';
            let cleanBase = streamUrlBase.trim().replace(/\/+$/, '');
            try {
              const p = new URL(cleanBase.startsWith('http') ? cleanBase : `http://${cleanBase}`);
              hostname = p.hostname;
              cleanBase = `${p.protocol}//${p.host}`;
            } catch (e) {
              const m = cleanBase.match(/^(?:https?:\/\/)?([^:/]+)/i);
              if (m) hostname = m[1];
            }
            const cleanChName = name.trim() || 'playlistTestOne';
            const previewHls = `${cleanBase}/${cleanChName}/index.m3u8`;
            const previewRtmp = `rtmp://${hostname}/static/${cleanChName}`;

            return (
              <div className="bg-[#0b0e14] border border-[#1f2637] rounded-xl p-3 space-y-2 text-[11px]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Radio size={12} className="text-blue-500" />
                  Auto-Generated Playout Endpoints:
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                    HLS Live Stream URL:
                  </span>
                  <code className="text-emerald-400 font-mono text-[10px] break-all block">
                    {previewHls}
                  </code>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                    RTMP Target URL:
                  </span>
                  <code className="text-blue-400 font-mono text-[10px] break-all block">
                    {previewRtmp}
                  </code>
                </div>
              </div>
            );
          })()}


          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="1280x720">1280x720 (720p HD - Optimal)</option>
                <option value="1920x1080">1920x1080 (1080p FHD)</option>
                <option value="854x480">854x480 (480p SD)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Framerate (FPS)</label>
              <input
                type="number"
                value={fps}
                onChange={(e) => setFps(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Video Bitrate</label>
              <input
                type="text"
                value={videoBitrate}
                onChange={(e) => setVideoBitrate(e.target.value)}
                placeholder="2500k"
                className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Audio Bitrate</label>
              <input
                type="text"
                value={audioBitrate}
                onChange={(e) => setAudioBitrate(e.target.value)}
                placeholder="128k"
                className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#232a38] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-2 rounded-lg bg-[#1a202c] hover:bg-[#222b3b] text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-md shadow-blue-600/20"
            >
              {editingChannel ? 'Save Changes' : 'Create Channel'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!channelToDelete}
        onClose={() => setChannelToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Broadcast Channel"
        itemName={channelToDelete?.name}
        message="Are you sure you want to delete this channel and its associated playlist? Playout streams will be stopped immediately."
        confirmText="Delete Channel"
      />
    </div>
  );
}
