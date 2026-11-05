import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  Upload,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Clock,
  Calendar,
  Layers,
  AlertTriangle,
  Film,
  CheckCircle2,
  Copy,
  Sliders,
  Play,
  X,
  FileVideo,
  RefreshCw,
  Eye,
  Tv,
  Megaphone,
  CalendarClock,
  Radio
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../../api/axios.js';
import { formatBytes } from '../../hooks/useStorageCalc.js';
import { DAYS_OF_WEEK } from '../../hooks/usePlaylist.js';

const shellClass =
  'flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-cyan-500 transition';
const inputClass =
  'w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs';
const selectClass =
  'w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer';

const CATEGORIES = ['All categories', 'Promos', 'General', 'Episodes', 'Songs', 'Ads'];

const formatSeconds = (totalSeconds) => {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '00:00:00';
  const total = Math.floor(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0')
  ].join(':');
};

const TYPE_CONFIGS = {
  emergency: {
    type: 'emergency',
    priority: 5,
    title: 'Emergency Playlist',
    shortLabel: 'Emergency',
    badge: 'Priority 5 (Critical Override)',
    badgeSmall: 'P5 Override',
    dotColor: 'bg-rose-500',
    accentText: 'text-rose-400',
    accentBg: 'bg-rose-500/15',
    accentBorder: 'border-rose-500/30',
    tagBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    dropHighlight: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-950/15',
    rowHoverBorder: 'hover:border-rose-500/50',
    dragOverRow: 'border-rose-500 bg-rose-950/30',
    buttonClass: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30',
    icon: AlertTriangle,
    description: 'Highest priority override. Preempts all scheduled and background programming immediately when armed and active.',
    emptySubtitle: 'Click "+" on any uploaded video or drag & drop videos here to build your emergency sequence.',
    placeholderTitle: 'e.g. Breaking News Emergency Override',
    defaultCategory: 'All categories'
  },
  advertisement: {
    type: 'advertisement',
    priority: 4,
    title: 'Ad Playlist',
    shortLabel: 'Ad Playlist',
    badge: 'Priority 4 (Ad Playout)',
    badgeSmall: 'P4 Commercial',
    dotColor: 'bg-amber-500',
    accentText: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
    accentBorder: 'border-amber-500/30',
    tagBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    dropHighlight: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-950/15',
    rowHoverBorder: 'hover:border-amber-500/50',
    dragOverRow: 'border-amber-500 bg-amber-950/30',
    buttonClass: 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30 font-extrabold',
    icon: Megaphone,
    description: '2nd highest priority. Preempts scheduling and default playout for scheduled commercial breaks and sponsor slots.',
    emptySubtitle: 'Click "+" on any ad clip or drag & drop videos here to build your commercial break lineup.',
    placeholderTitle: 'e.g. Prime Time Commercial Break',
    defaultCategory: 'Ads'
  },
  scheduling: {
    type: 'scheduling',
    priority: 2,
    title: 'Scheduling Playlist',
    shortLabel: 'Scheduling',
    badge: 'Priority 2 (Scheduled Playout)',
    badgeSmall: 'P2 Scheduled',
    dotColor: 'bg-blue-500',
    accentText: 'text-blue-400',
    accentBg: 'bg-blue-500/15',
    accentBorder: 'border-blue-500/30',
    tagBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    dropHighlight: 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-950/15',
    rowHoverBorder: 'hover:border-blue-500/50',
    dragOverRow: 'border-blue-500 bg-blue-950/30',
    buttonClass: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30',
    icon: CalendarClock,
    description: '4th highest priority. Scheduled programming, movies, and episodic broadcasts during defined date or time slots.',
    emptySubtitle: 'Click "+" on any video or drag & drop clips here to build your scheduled program sequence.',
    placeholderTitle: 'e.g. Evening Prime Schedule',
    defaultCategory: 'All categories'
  },
  live_schedule: {
    type: 'live_schedule',
    priority: 3,
    title: 'Live Schedule',
    shortLabel: 'Live Schedule',
    badge: 'Priority 3 (Live Event Relay)',
    badgeSmall: 'P3 Live Relay',
    dotColor: 'bg-purple-500',
    accentText: 'text-purple-400',
    accentBg: 'bg-purple-500/15',
    accentBorder: 'border-purple-500/30',
    tagBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    dropHighlight: 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-950/15',
    rowHoverBorder: 'hover:border-purple-500/50',
    dragOverRow: 'border-purple-500 bg-purple-950/30',
    buttonClass: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30',
    icon: Radio,
    description: '3rd highest priority. Scheduled live stream relays with video items playing as fallback or sequential slots.',
    emptySubtitle: 'Click "+" on any video or drag & drop clips here to configure fallback and sequential playout.',
    placeholderTitle: 'e.g. Championship Live Stream Relay',
    defaultCategory: 'All categories'
  },
  default: {
    type: 'default',
    priority: 1,
    title: 'Default Playlist',
    shortLabel: 'Default',
    badge: 'Priority 1 (Baseline Loop)',
    badgeSmall: 'P1 Baseline',
    dotColor: 'bg-emerald-500',
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
    accentBorder: 'border-emerald-500/30',
    tagBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    dropHighlight: 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-950/15',
    rowHoverBorder: 'hover:border-emerald-500/50',
    dragOverRow: 'border-emerald-500 bg-emerald-950/30',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30',
    icon: Layers,
    description: 'Lowest priority baseline. Continuous 24/7 background broadcast whenever no higher-priority playlists are active.',
    emptySubtitle: 'Click "+" on any video or drag & drop clips here to build your 24/7 channel baseline loop.',
    placeholderTitle: 'e.g. 24/7 Channel Baseline Playout',
    defaultCategory: 'All categories'
  }
};

export default function PlaylistBuilder({
  formData,
  setFormData,
  channels = [],
  onSubmit,
  onCancel,
  mode = 'create',
  forcedType = null
}) {
  const fileInputRef = useRef(null);

  // Resolve playlist type
  const activeType = forcedType || formData?.type || 'default';
  const typeConfig = TYPE_CONFIGS[activeType] || TYPE_CONFIGS.default;
  const TypeIcon = typeConfig.icon;

  // Active channel for assets
  const currentChannelId = formData.channel || formData.channelId || channels[0]?._id || '';

  // Auto-initialize form settings if needed
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      type: activeType,
      channel: prev.channel || channels[0]?._id || '',
      loop: prev.loop !== undefined ? prev.loop : true,
      isActive: prev.isActive !== undefined ? prev.isActive : true
    }));
  }, [activeType, channels, setFormData]);

  // ---------- Column 1: Uploaded Videos State ----------
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(typeConfig.defaultCategory || 'All categories');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadAlert, setUploadAlert] = useState(null);

  // ---------- Column 2: Playlist Drag & Drop State ----------
  const [draggedRowIndex, setDraggedRowIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDropZoneActive, setIsDropZoneActive] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch uploaded videos for current channel
  const fetchVideos = useCallback(async (channelId) => {
    if (!channelId) return;
    setLoadingVideos(true);
    try {
      const res = await api.get('/assets', {
        params: { channelId, limit: 200 }
      });
      setUploadedVideos(res.data?.assets || []);
    } catch (err) {
      console.warn('Error fetching channel assets:', err.message);
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    if (currentChannelId) {
      fetchVideos(currentChannelId);
    }
  }, [currentChannelId, fetchVideos]);

  // Socket listener for asset updates
  useEffect(() => {
    if (!currentChannelId) return;
    const socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000
    });

    socket.on('asset_ready', () => fetchVideos(currentChannelId));
    socket.on('channel_storage_updated', () => fetchVideos(currentChannelId));

    return () => {
      socket.disconnect();
    };
  }, [currentChannelId, fetchVideos]);

  // Filter uploaded videos
  const filteredUploadedVideos = useMemo(() => {
    return uploadedVideos.filter((v) => {
      const matchesSearch =
        !videoSearchQuery ||
        (v.originalName && v.originalName.toLowerCase().includes(videoSearchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategory === 'All categories' || v.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [uploadedVideos, videoSearchQuery, selectedCategory]);

  // ---------- Column 2: Items & Cumulative Timing Calculation ----------
  const playlistItems = useMemo(() => {
    const list = Array.isArray(formData.items) ? formData.items : [];
    let cumulative = 0;
    return list.map((item, index) => {
      const assetObj = item.asset || item;
      const duration = assetObj?.duration || 0;
      const startOffset = cumulative;
      cumulative += duration;
      return {
        ...item,
        asset: assetObj,
        order: index + 1,
        startOffset,
        startOffsetFormatted: formatSeconds(startOffset),
        durationFormatted: assetObj?.durationFormatted || formatSeconds(duration),
        status: item.status || 'queued'
      };
    });
  }, [formData.items]);

  const totalRuntimeSeconds = useMemo(() => {
    return (formData.items || []).reduce((acc, item) => {
      const d = item.asset?.duration || item.duration || 0;
      return acc + d;
    }, 0);
  }, [formData.items]);

  const totalRuntimeFormatted = useMemo(() => {
    return formatSeconds(totalRuntimeSeconds);
  }, [totalRuntimeSeconds]);

  // Count occurrences of an asset in current playlist
  const getAssetCountInPlaylist = useCallback(
    (assetId) => {
      if (!formData.items) return 0;
      return formData.items.filter((it) => (it.asset?._id || it.asset) === assetId).length;
    },
    [formData.items]
  );

  // Recalculate and update items in formData
  const updatePlaylistItems = useCallback(
    (newItems) => {
      setFormData((prev) => ({
        ...prev,
        items: newItems
      }));
    },
    [setFormData]
  );

  // Add video to playlist
  const handleAddVideo = useCallback(
    (video) => {
      if (!video) return;
      const current = Array.isArray(formData.items) ? formData.items : [];
      const newItem = {
        _id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        asset: video,
        status: 'queued'
      };
      updatePlaylistItems([...current, newItem]);
    },
    [formData.items, updatePlaylistItems]
  );

  // Remove video from playlist
  const handleRemoveItem = useCallback(
    (index) => {
      const current = Array.isArray(formData.items) ? formData.items : [];
      const updated = current.filter((_, idx) => idx !== index);
      updatePlaylistItems(updated);
    },
    [formData.items, updatePlaylistItems]
  );

  // Move item up
  const handleMoveUp = useCallback(
    (index) => {
      if (index <= 0) return;
      const current = Array.isArray(formData.items) ? [...formData.items] : [];
      const [item] = current.splice(index, 1);
      current.splice(index - 1, 0, item);
      updatePlaylistItems(current);
    },
    [formData.items, updatePlaylistItems]
  );

  // Move item down
  const handleMoveDown = useCallback(
    (index) => {
      const current = Array.isArray(formData.items) ? [...formData.items] : [];
      if (index >= current.length - 1) return;
      const [item] = current.splice(index, 1);
      current.splice(index + 1, 0, item);
      updatePlaylistItems(current);
    },
    [formData.items, updatePlaylistItems]
  );

  // Duplicate item
  const handleDuplicateItem = useCallback(
    (index) => {
      const current = Array.isArray(formData.items) ? [...formData.items] : [];
      const target = current[index];
      if (!target) return;
      const duplicated = {
        ...target,
        _id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      };
      current.splice(index + 1, 0, duplicated);
      updatePlaylistItems(current);
    },
    [formData.items, updatePlaylistItems]
  );

  // Clear all items
  const handleClearAll = useCallback(() => {
    updatePlaylistItems([]);
  }, [updatePlaylistItems]);

  // Reorder row via drag & drop within playlist
  const handleReorderRow = useCallback(
    (fromIndex, toIndex) => {
      if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
      const current = Array.isArray(formData.items) ? [...formData.items] : [];
      const [moved] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, moved);
      updatePlaylistItems(current);
    },
    [formData.items, updatePlaylistItems]
  );

  // Drop asset into Column 2
  const handleDropAsset = (e, targetIndex = null) => {
    e.preventDefault();
    setIsDropZoneActive(false);
    setDragOverIndex(null);

    // 1. Asset dragged from Column 1
    const rawAsset = e.dataTransfer.getData('application/json');
    if (rawAsset) {
      try {
        const video = JSON.parse(rawAsset);
        const current = Array.isArray(formData.items) ? [...formData.items] : [];
        const newItem = {
          _id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          asset: video,
          status: 'queued'
        };
        if (targetIndex !== null && targetIndex >= 0 && targetIndex <= current.length) {
          current.splice(targetIndex, 0, newItem);
          updatePlaylistItems(current);
        } else {
          updatePlaylistItems([...current, newItem]);
        }
        return;
      } catch (err) {
        console.error('Invalid JSON dropped:', err);
      }
    }

    // 2. Reordering within Column 2
    if (draggedRowIndex !== null && targetIndex !== null) {
      handleReorderRow(draggedRowIndex, targetIndex);
      setDraggedRowIndex(null);
    }
  };

  // Upload Video directly from Column 1
  const handleUploadFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !currentChannelId) return;

    const file = files[0];
    setIsUploading(true);
    setUploadProgress(0);
    setUploadFileName(file.name);
    setUploadAlert(null);

    try {
      const CHUNK_SIZE = 2 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const form = new FormData();
        form.append('uploadId', uploadId);
        form.append('chunkIndex', String(chunkIndex));
        form.append('totalChunks', String(totalChunks));
        form.append('fileName', file.name);
        form.append('fileSize', String(file.size));
        form.append('channelId', currentChannelId);
        form.append('category', activeType === 'advertisement' ? 'Ads' : 'General');
        form.append('chunk', chunk);

        await api.post('/assets/upload/chunk', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const pct = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        setUploadProgress(pct);
      }

      setUploadAlert({ type: 'success', message: `${file.name} uploaded successfully!` });
      setTimeout(() => setUploadAlert(null), 4000);
      fetchVideos(currentChannelId);
    } catch (err) {
      setUploadAlert({
        type: 'error',
        message: err.response?.data?.message || `Failed to upload ${file.name}`
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---------- Form handlers (Column 3) ----------
  const handleFieldChange = (field, transform) => (e) => {
    const val = transform ? transform(e.target.value) : e.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: val
    }));
  };

  const handleCheckboxChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.checked
    }));
  };

  const handleToggleDayOfWeek = (dayVal) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.daysOfWeek) ? prev.daysOfWeek : [];
      const exists = current.includes(dayVal);
      const updated = exists ? current.filter((d) => d !== dayVal) : [...current, dayVal].sort((a, b) => a - b);
      return { ...prev, daysOfWeek: updated };
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert(`Please enter a title for this ${typeConfig.shortLabel} Playlist`);
      return;
    }
    if (!currentChannelId) {
      alert('Please select a target channel');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeChannelObj = channels.find((c) => c._id === currentChannelId) || channels[0];

  return (
    <div className="space-y-4 select-none">
      {/* Top Navigation & Type Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d111a] border border-[#1b2336] p-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl bg-[#141a27] hover:bg-[#1a2336] text-slate-300 hover:text-white transition cursor-pointer border border-[#202b42] flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft size={15} />
            <span>Back to Playlists</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${typeConfig.dotColor} animate-ping`} />
              <h1 className="text-lg font-black text-white tracking-wide">
                {mode === 'edit' ? `Edit ${typeConfig.title}` : `Create ${typeConfig.title}`}
              </h1>
              <span className={`font-mono text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${typeConfig.accentBg} ${typeConfig.accentText} ${typeConfig.accentBorder}`}>
                {typeConfig.badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {typeConfig.description}
            </p>
          </div>
        </div>

        {/* Quick action buttons top bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-xl border border-[#20293d] hover:bg-[#161c2a] text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFormSubmit}
            disabled={isSubmitting}
            className={`px-4 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer disabled:opacity-50 ${typeConfig.buttonClass}`}
          >
            <TypeIcon size={14} />
            <span>{isSubmitting ? 'Saving...' : mode === 'edit' ? 'Save Changes' : `Create ${typeConfig.shortLabel}`}</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-170px)] lg:min-h-[620px]">
        {/* ========================================================
            COLUMN 1: UPLOADED VIDEOS (Left, 4 cols)
            ======================================================== */}
        <div className="lg:col-span-4 h-full flex flex-col bg-[#0b0e17] border border-[#182032] rounded-2xl overflow-hidden shadow-2xl">
          {/* Column 1 Header */}
          <div className="p-3.5 border-b border-[#182032] bg-[#0e121e] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film size={16} className="text-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Uploaded Videos
              </h2>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#161d2d] text-cyan-300 font-semibold border border-[#212c44]">
                {uploadedVideos.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchVideos(currentChannelId)}
                title="Refresh videos"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#182032] transition cursor-pointer"
              >
                <RefreshCw size={13} className={loadingVideos ? 'animate-spin text-cyan-400' : ''} />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !currentChannelId}
                className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-[11px] flex items-center gap-1 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Upload size={12} />
                <span>Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,.mp4,.mov,.mkv,.ts,.avi,.flv,.m4v"
                className="hidden"
                onChange={handleUploadFiles}
              />
            </div>
          </div>

          {/* Upload Progress Bar if uploading */}
          {isUploading && (
            <div className="p-2.5 bg-[#0f1728] border-b border-cyan-800/40 text-xs text-cyan-300 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="truncate max-w-[200px]">{uploadFileName}</span>
                <span className="font-mono font-bold">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-[#080d16] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload Notification Alert */}
          {uploadAlert && (
            <div
              className={`p-2 px-3 text-[11px] border-b flex items-center gap-2 ${
                uploadAlert.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              <CheckCircle2 size={13} />
              <span>{uploadAlert.message}</span>
            </div>
          )}

          {/* Search & Category Filter */}
          <div className="p-2.5 border-b border-[#182032] space-y-2 bg-[#090d16]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search uploaded videos..."
                value={videoSearchQuery}
                onChange={(e) => setVideoSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-[#0e1320] border border-[#1c2539] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
              {videoSearchQuery && (
                <button
                  type="button"
                  onClick={() => setVideoSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? `${typeConfig.accentBg} ${typeConfig.accentText} border ${typeConfig.accentBorder}`
                      : 'bg-[#121826] text-slate-400 hover:text-slate-200 border border-[#1c2539]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Video Assets Scrollable List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {loadingVideos ? (
              <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center">
                <RefreshCw size={20} className="animate-spin mb-2 text-cyan-400" />
                <span>Loading channel assets...</span>
              </div>
            ) : filteredUploadedVideos.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center">
                <FileVideo size={28} className="mb-2 text-slate-600 stroke-[1.5]" />
                <span className="font-semibold text-slate-400">
                  {videoSearchQuery ? 'No matching videos found' : 'No videos uploaded for this channel'}
                </span>
                <span className="text-[10px] text-slate-600 mt-1">
                  {videoSearchQuery ? 'Try clearing your search query' : 'Click "Upload" above to add videos'}
                </span>
              </div>
            ) : (
              filteredUploadedVideos.map((video) => {
                const countInPlaylist = getAssetCountInPlaylist(video._id);

                return (
                  <div
                    key={video._id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify(video));
                      e.dataTransfer.setData('text/plain', video._id);
                    }}
                    className={`p-2 rounded-xl bg-[#0e1320] border border-[#1b2438] ${typeConfig.rowHoverBorder} hover:bg-[#12192a] transition flex items-center justify-between gap-2.5 group cursor-grab active:cursor-grabbing`}
                  >
                    {/* Thumbnail + Details */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Video Thumbnail */}
                      <div
                        onClick={() => setPreviewVideo(video)}
                        title="Click to preview video"
                        className="relative w-16 h-11 rounded-lg bg-black/60 border border-[#222c42] overflow-hidden shrink-0 cursor-pointer group/thumb"
                      >
                        {video.thumbnailPath ? (
                          <img
                            src={`/${video.thumbnailPath}`}
                            alt=""
                            className="w-full h-full object-cover group-hover/thumb:scale-105 transition"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileVideo size={16} className="text-slate-600" />
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition">
                          <Play size={12} className="text-white fill-white" />
                        </div>
                        {/* Duration pill */}
                        <span className="absolute bottom-0.5 right-0.5 bg-black/80 font-mono text-[9px] text-cyan-300 font-semibold px-1 rounded">
                          {video.durationFormatted || '00:00'}
                        </span>
                      </div>

                      {/* Video Information */}
                      <div className="min-w-0">
                        <h4
                          title={video.originalName}
                          className={`text-xs font-semibold text-slate-200 truncate group-hover:${typeConfig.accentText} transition`}
                        >
                          {video.originalName}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-mono">
                          <span>{video.resolution || '1280x720'}</span>
                          <span>•</span>
                          <span>{formatBytes(video.size, 1)}</span>
                          {video.category && (
                            <>
                              <span>•</span>
                              <span className="px-1 py-0.2 rounded bg-[#182136] text-slate-300">
                                {video.category}
                              </span>
                            </>
                          )}
                        </div>
                        {countInPlaylist > 0 && (
                          <span className={`inline-block mt-1 text-[9px] font-bold ${typeConfig.accentText} ${typeConfig.accentBg} px-1.5 py-0.2 rounded border ${typeConfig.accentBorder} font-mono`}>
                            In Playlist: {countInPlaylist}x
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewVideo(video)}
                        title="Preview video"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2336] transition cursor-pointer"
                      >
                        <Eye size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddVideo(video)}
                        title={`Add to ${typeConfig.shortLabel}`}
                        className="px-2 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1 transition shadow cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer info */}
          <div className="p-2 px-3 border-t border-[#182032] bg-[#090d16] text-[10px] text-slate-500 flex items-center justify-between">
            <span>Drag any video into the middle column &rarr;</span>
            <span className="font-mono text-cyan-400">{filteredUploadedVideos.length} available</span>
          </div>
        </div>

        {/* ========================================================
            COLUMN 2: PLAYLIST PLAYOUT SEQUENCE (Center, 5 cols)
            ======================================================== */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsDropZoneActive(true);
          }}
          onDragLeave={() => setIsDropZoneActive(false)}
          onDrop={(e) => handleDropAsset(e, playlistItems.length)}
          className={`lg:col-span-5 h-full flex flex-col bg-[#0b0e17] border rounded-2xl overflow-hidden shadow-2xl transition-all ${
            isDropZoneActive
              ? typeConfig.dropHighlight
              : 'border-[#182032]'
          }`}
        >
          {/* Column 2 Header */}
          <div className="p-3.5 border-b border-[#182032] bg-[#0e121e] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded-lg ${typeConfig.accentBg} ${typeConfig.accentText} border ${typeConfig.accentBorder}`}>
                <TypeIcon size={15} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    {typeConfig.title}
                  </h2>
                  <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${typeConfig.tagBadge}`}>
                    {typeConfig.badgeSmall}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Duration & Clear */}
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 rounded-lg bg-[#090d16] border border-[#1d263b] text-right font-mono">
                <span className="text-[10px] text-slate-400 block -mb-0.5">Runtime:</span>
                <span className={`text-xs font-bold ${typeConfig.accentText}`}>
                  {totalRuntimeFormatted}
                </span>
              </div>

              {playlistItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  title="Clear all videos"
                  className="p-1.5 rounded-lg border border-[#212c44] text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Subheader / Table column headers */}
          <div className="px-3 py-1.5 bg-[#090d16] border-b border-[#182032] grid grid-cols-[28px_24px_1fr_65px_65px_70px] items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="text-center">#</span>
            <span></span>
            <span>Media Clip</span>
            <span className="text-center">Duration</span>
            <span className="text-center">Playout</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Playlist Items List / Drop Zone */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {playlistItems.length === 0 ? (
              <div
                className={`h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center transition ${
                  isDropZoneActive
                    ? `${typeConfig.accentBorder} ${typeConfig.accentBg}`
                    : 'border-[#1e273a] text-slate-500'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl ${typeConfig.accentBg} border ${typeConfig.accentBorder} flex items-center justify-center ${typeConfig.accentText} mb-3 shadow-lg`}>
                  <TypeIcon size={24} />
                </div>
                <h3 className="text-xs font-bold text-slate-300">
                  {typeConfig.title} is Empty
                </h3>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                  {typeConfig.emptySubtitle}
                </p>
                <span className="inline-block mt-3 px-3 py-1 rounded-full bg-[#141b2a] border border-[#222e47] text-[10px] text-slate-400 font-mono">
                  Dropzone Ready
                </span>
              </div>
            ) : (
              playlistItems.map((item, index) => {
                const asset = item.asset || {};
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={item._id || index}
                    draggable
                    onDragStart={() => setDraggedRowIndex(index)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIndex(index);
                    }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e) => handleDropAsset(e, index)}
                    className={`px-3 py-2 rounded-xl border grid grid-cols-[28px_24px_1fr_65px_65px_70px] items-center gap-2 text-xs transition group ${
                      isDragOver
                        ? typeConfig.dragOverRow
                        : `border-[#1a2336] bg-[#0e1320] hover:bg-[#12192a]`
                    }`}
                  >
                    {/* Index # */}
                    <div className="text-center font-mono text-[11px] font-bold text-slate-400">
                      {index + 1}
                    </div>

                    {/* Drag Handle */}
                    <div className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing text-center">
                      <GripVertical size={14} />
                    </div>

                    {/* Thumbnail + Video Title */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        onClick={() => setPreviewVideo(asset)}
                        title="Click to preview"
                        className="w-10 h-7 rounded bg-black/60 border border-[#222c42] overflow-hidden shrink-0 cursor-pointer flex items-center justify-center"
                      >
                        {asset.thumbnailPath ? (
                          <img
                            src={`/${asset.thumbnailPath}`}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <Film size={12} className="text-slate-600" />
                        )}
                      </div>

                      <span
                        title={asset.originalName || 'Video Asset'}
                        className={`font-medium text-slate-200 truncate group-hover:${typeConfig.accentText} transition`}
                      >
                        {asset.originalName || 'Video Asset'}
                      </span>
                    </div>

                    {/* Clip Duration */}
                    <div className="text-center font-mono text-[11px] text-slate-300">
                      {item.durationFormatted}
                    </div>

                    {/* Cumulative Playout Start */}
                    <div className={`text-center font-mono text-[11px] ${typeConfig.accentText} font-semibold`}>
                      {item.startOffsetFormatted}
                    </div>

                    {/* Actions: Move Up, Move Down, Duplicate, Delete */}
                    <div className="flex items-center justify-end gap-1">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          title="Move Up"
                          className="text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronUp size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === playlistItems.length - 1}
                          title="Move Down"
                          className="text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronDown size={11} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDuplicateItem(index)}
                        title="Duplicate Clip"
                        className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-[#1a2336] transition cursor-pointer"
                      >
                        <Copy size={12} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        title="Remove Clip"
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Column 2 Footer */}
          <div className="p-2.5 px-3 border-t border-[#182032] bg-[#090d16] flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              Total: <strong className="text-white">{playlistItems.length}</strong> videos
            </span>
            <div className="flex items-center gap-1.5 font-mono text-slate-300">
              <Clock size={12} className={typeConfig.accentText} />
              <span>Playout Length: <strong className={typeConfig.accentText}>{totalRuntimeFormatted}</strong></span>
            </div>
          </div>
        </div>

        {/* ========================================================
            COLUMN 3: CONFIGURATION FORM (Right, 3 cols)
            ======================================================== */}
        <div className="lg:col-span-3 h-full flex flex-col bg-[#0b0e17] border border-[#182032] rounded-2xl overflow-hidden shadow-2xl">
          {/* Column 3 Header */}
          <div className="p-3.5 border-b border-[#182032] bg-[#0e121e] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders size={16} className={typeConfig.accentText} />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {typeConfig.shortLabel} Options
              </h2>
            </div>
            <span className={`font-mono text-[9px] px-2 py-0.5 rounded ${typeConfig.accentBg} ${typeConfig.accentText} border ${typeConfig.accentBorder} font-bold`}>
              {formData.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>

          {/* Form Content (Scrollable) */}
          <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
            {/* Channel Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Tv size={13} className="text-cyan-400" />
                  <span>Channel *</span>
                </label>
                <span className="text-[10px] text-slate-500">Target Channel</span>
              </div>
              <div className={shellClass}>
                <select
                  required
                  value={currentChannelId}
                  onChange={(e) => {
                    const newChan = e.target.value;
                    setFormData((prev) => ({ ...prev, channel: newChan }));
                  }}
                  className={selectClass}
                >
                  <option value="" disabled className="bg-[#0b0e18]">Select Channel</option>
                  {channels.map((ch) => (
                    <option key={ch._id} value={ch._id} className="bg-[#0b0e18] text-slate-200">
                      {ch.name} ({ch.status === 'live' ? 'ONLINE' : 'IDLE'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Playlist Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Layers size={13} className={typeConfig.accentText} />
                  <span>Playlist Title *</span>
                </label>
              </div>
              <div className={shellClass}>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={handleFieldChange('name')}
                  placeholder={typeConfig.placeholderTitle}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Playout Priority Badge Card */}
            {/* <div className={`p-3 rounded-xl border ${typeConfig.accentBorder} ${typeConfig.accentBg} ${typeConfig.accentText} text-xs`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold flex items-center gap-1">
                  <TypeIcon size={13} />
                  <span>Priority {typeConfig.priority}: {typeConfig.title}</span>
                </span>
                <span className="font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-black/40 border border-current uppercase">
                  P{typeConfig.priority}
                </span>
              </div>
              <p className="text-[10px] opacity-80 leading-relaxed">
                {typeConfig.description}
              </p>
            </div> */}

            {/* Live Stream URL (for live_schedule) */}
            {activeType === 'live_schedule' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Radio size={13} className="text-purple-400" />
                    <span>Live Stream Relay Source URL</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Optional</span>
                </div>
                <div className={shellClass}>
                  <input
                    type="text"
                    value={formData.liveSourceUrl || ''}
                    onChange={handleFieldChange('liveSourceUrl')}
                    placeholder="rtmp://... or https://.../stream.m3u8"
                    className={`${inputClass} font-mono text-[11px] text-purple-300`}
                  />
                </div>
              </div>
            )}

            {/* Scheduling Trigger Mode (Date Option) */}
            <div className="pt-2 border-t border-[#182032]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Calendar size={13} className="text-cyan-400" />
                  <span>Schedule Trigger</span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'none', label: 'None (24x7)', desc: 'Continuous' },
                  { id: 'date', label: 'Date Range', desc: 'Date window' },
                  { id: 'weekly', label: 'Weekly', desc: 'Specific days' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, scheduleOption: opt.id }))}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                      (formData.scheduleOption || 'none') === opt.id
                        ? `${typeConfig.accentBg} ${typeConfig.accentBorder} ${typeConfig.accentText} font-bold`
                        : 'bg-[#090d16] border-[#1a2337] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-[11px]">{opt.label}</span>
                    <span className="text-[9px] opacity-70 mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range Fields (when scheduleOption === 'date') */}
            {formData.scheduleOption === 'date' && (
              <div className="space-y-2 p-2.5 rounded-xl bg-[#090d16] border border-[#1a2337]">
                <div>
                  <label className="text-slate-400 text-[10px] block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate || ''}
                    onChange={handleFieldChange('startDate')}
                    className="w-full bg-[#0e1320] border border-[#1c2539] rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] block mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate || ''}
                    onChange={handleFieldChange('endDate')}
                    className="w-full bg-[#0e1320] border border-[#1c2539] rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Weekly Days of Week (when scheduleOption === 'weekly') */}
            {formData.scheduleOption === 'weekly' && (
              <div className="p-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] space-y-1.5">
                <label className="text-slate-400 text-[10px] block font-semibold">Active Days of Week</label>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS_OF_WEEK.map((d) => {
                    const isSelected = Array.isArray(formData.daysOfWeek) && formData.daysOfWeek.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => handleToggleDayOfWeek(d.value)}
                        className={`py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                          isSelected
                            ? `${typeConfig.accentBg} ${typeConfig.accentText} border ${typeConfig.accentBorder} font-black`
                            : 'bg-[#111624] text-slate-400 border border-[#1a2337] hover:border-slate-500'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daily Playout Time Window */}
            <div className="pt-2 border-t border-[#182032] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Clock size={13} className="text-cyan-400" />
                  <span>Daily Time Window</span>
                </label>
                <span className="text-[10px] text-slate-500">Optional slot</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 text-[10px] block mb-1">Start (HH:mm)</label>
                  <input
                    type="time"
                    step="1"
                    value={formData.startTime || ''}
                    onChange={handleFieldChange('startTime')}
                    className="w-full bg-[#090d16] border border-[#1a2337] rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] block mb-1">End (HH:mm)</label>
                  <input
                    type="time"
                    step="1"
                    value={formData.endTime || ''}
                    onChange={handleFieldChange('endTime')}
                    className="w-full bg-[#090d16] border border-[#1a2337] rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>
              <p className="text-[9px] text-slate-500 leading-tight">
                Leave empty for continuous 24-hour playback while armed.
              </p>
            </div>

            {/* Loop & Enable Switches */}
            <div className="pt-2 border-t border-[#182032] space-y-2">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] cursor-pointer hover:border-slate-600 transition">
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-200 text-xs">Loop Playback</span>
                  <span className="text-[9px] text-slate-500">Loop sequence continuously</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.loop !== false}
                  onChange={handleCheckboxChange('loop')}
                  className="rounded w-4 h-4 text-cyan-500 bg-[#121929] border-[#222c42] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`flex items-center justify-between p-2.5 rounded-xl border ${typeConfig.accentBorder} ${typeConfig.accentBg} cursor-pointer transition`}>
                <div className="flex flex-col">
                  <span className={`font-bold text-xs flex items-center gap-1.5 ${typeConfig.accentText}`}>
                    <span className={`w-2 h-2 rounded-full ${formData.isActive !== false ? `${typeConfig.dotColor} animate-pulse` : 'bg-slate-600'}`} />
                    <span>Enable {typeConfig.shortLabel}</span>
                  </span>
                  <span className="text-[9px] text-slate-400">Arm playlist for scheduled playout</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isActive !== false}
                  onChange={handleCheckboxChange('isActive')}
                  className="rounded w-4 h-4 text-cyan-500 bg-[#121929] border-slate-700 focus:ring-0 cursor-pointer"
                />
              </label>
            </div>

            {/* Quick Summary Box */}
            <div className="p-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] text-[11px] space-y-1 font-mono text-slate-400">
              <div className="flex justify-between">
                <span>Channel:</span>
                <span className="text-slate-200 font-bold truncate max-w-[120px]">
                  {activeChannelObj?.name || 'Selected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Clips Count:</span>
                <span className="text-cyan-400 font-bold">{playlistItems.length} items</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className={`font-bold ${typeConfig.accentText}`}>{totalRuntimeFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={formData.isActive !== false ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {formData.isActive !== false ? 'ARMED & ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            </div>
          </form>

          {/* Column 3 Footer Action Buttons */}
          <div className="p-3 border-t border-[#182032] bg-[#0e121e] flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded-xl border border-[#212b40] hover:bg-[#161c2a] text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={isSubmitting}
              className={`flex-1 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer disabled:opacity-50 ${typeConfig.buttonClass}`}
            >
              <TypeIcon size={14} />
              <span>{isSubmitting ? 'Saving...' : mode === 'edit' ? 'Save Changes' : `Create ${typeConfig.shortLabel}`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          VIDEO PREVIEW MODAL
          ======================================================== */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0f131c] border border-[#212c44] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#212c44] flex items-center justify-between bg-[#121722]">
              <div className="flex items-center gap-2">
                <Play size={16} className={`${typeConfig.accentText} fill-current`} />
                <h3 className="text-xs font-bold text-white truncate max-w-md">
                  {previewVideo.originalName || 'Video Preview'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#20293d] transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 bg-black flex items-center justify-center">
              <video
                controls
                autoPlay
                src={`/${previewVideo.filePath}`}
                className="w-full max-h-[380px] rounded-lg shadow-lg"
              />
            </div>

            <div className="p-3.5 px-4 border-t border-[#212c44] bg-[#121722] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                <span>Duration: {previewVideo.durationFormatted || '00:00'}</span>
                <span>•</span>
                <span>Size: {formatBytes(previewVideo.size, 1)}</span>
                <span>•</span>
                <span>Resolution: {previewVideo.resolution || '1280x720'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleAddVideo(previewVideo);
                  setPreviewVideo(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <Plus size={14} />
                <span>Add to {typeConfig.shortLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

