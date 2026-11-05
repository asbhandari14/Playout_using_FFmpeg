import { toast } from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import api from '../../api/axios.js';
import {
  X,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Play,
  Film,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Radio,
  Check,
  ArrowUp,
  ArrowDown,
  Layers,
  Tv,
  Flame,
  Timer,
  Layout
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 }
];

export default function ScheduleModal({
  isOpen,
  onClose,
  channelId,
  channelName,
  currentOnAirSchedule = null
}) {
  const [schedules, setSchedules] = useState([]);
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);

  // Helper for current time string HH:mm:ss
  const getNowTimeString = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [scheduleType, setScheduleType] = useState('video'); // 'video' | 'lband' | 'ashton'
  const [overlayDuration, setOverlayDuration] = useState(60);
  const [ashtonSqueeze, setAshtonSqueeze] = useState(true);
  const [title, setTitle] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [assetToAdd, setAssetToAdd] = useState('');
  const [dailyStartTime, setDailyStartTime] = useState(getNowTimeString());
  const [dailyEndTime, setDailyEndTime] = useState('');
  const [selectedDays, setSelectedDays] = useState([0, 1, 2, 3, 4, 5, 6]); // Default all 7 days
  const [hasDateRange, setHasDateRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Helpers for multi-asset management
  const getAssetById = (id) => assets.find((a) => String(a._id) === String(id));

  const getTotalSelectedAssetsDurationFormatted = () => {
    const totalSec = selectedAssetIds.reduce((sum, id) => {
      const a = getAssetById(id);
      return sum + (Number(a?.duration) || 0);
    }, 0);
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleAddAssetToSchedule = (assetId) => {
    if (!assetId) return;
    setSelectedAssetIds((prev) => [...prev, assetId]);
  };

  const handleRemoveAssetFromSchedule = (index) => {
    setSelectedAssetIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveAsset = (index, direction) => {
    setSelectedAssetIds((prev) => {
      const copy = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Helper to compute window duration string
  const computeWindowDurationStr = (start, end) => {
    if (!start || !end) return '';
    const [sh, sm, ss] = start.split(':').map(Number);
    const [eh, em, es] = end.split(':').map(Number);
    const startSec = (sh || 0) * 3600 + (sm || 0) * 60 + (ss || 0);
    const endSec = (eh || 0) * 3600 + (em || 0) * 60 + (es || 0);
    let durSec = endSec >= startSec ? endSec - startSec : 86400 - startSec + endSec;
    const h = Math.floor(durSec / 3600);
    const m = Math.floor((durSec % 3600) / 60);
    const s = durSec % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 3500);
  };

  // Load schedules and assets when modal opens
  useEffect(() => {
    if (isOpen && channelId) {
      loadSchedules();
      loadAssets();
    }
  }, [isOpen, channelId]);

  const loadSchedules = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/channels/${channelId}/schedules`);
      setSchedules(res.data || []);
    } catch (err) {
      console.error('Failed to load schedules:', err);
      showAlert('error', 'Failed to load schedules');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAssets = async () => {
    try {
      const res = await api.get('/assets', { params: { channelId } });
      const assetList = res.data?.assets || (Array.isArray(res.data) ? res.data : []);
      const readyAssets = assetList.filter((a) => a.status === 'ready');
      setAssets(readyAssets);
      if (readyAssets.length > 0 && !assetToAdd) {
        setAssetToAdd(readyAssets[0]._id);
      }
    } catch (err) {
      console.error('Failed to load assets for scheduling:', err);
    }
  };

  const resetForm = () => {
    setTitle('');
    setScheduleType('video');
    setOverlayDuration(60);
    setAshtonSqueeze(true);
    setSelectedAssetIds([]);
    setAssetToAdd(assets.length > 0 ? assets[0]._id : '');
    setDailyStartTime(getNowTimeString());
    setDailyEndTime('');
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setHasDateRange(false);
    setStartDate('');
    setEndDate('');
    setEnabled(true);
    setEditingScheduleId(null);
    setIsFormOpen(false);
  };

  const handleOpenCreateForm = () => {
    resetForm();
    setDailyStartTime(getNowTimeString());
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    if (assets.length > 0) {
      setSelectedAssetIds([assets[0]._id]);
      setAssetToAdd(assets[0]._id);
    }
    setIsFormOpen(true);
  };

  // Immediate manual trigger for scheduled ad / video directly on air
  const handleAirNow = async (sched) => {
    try {
      setIsLoading(true);
      const res = await api.post(`/channels/${channelId}/schedules/${sched._id}/play-now`);
      showAlert('success', res.data?.message || `Schedule "${sched.title}" is now airing!`);
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to trigger schedule live on air');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSchedule = (sched) => {
    setEditingScheduleId(sched._id);
    setTitle(sched.title || '');
    setScheduleType(sched.type || 'video');
    setOverlayDuration(sched.duration || 60);
    setAshtonSqueeze(sched.ashtonSqueeze !== false);
    
    // Populate playlist of assets
    if (Array.isArray(sched.assets) && sched.assets.length > 0) {
      setSelectedAssetIds(sched.assets.map((a) => a?._id || a));
    } else if (sched.asset) {
      setSelectedAssetIds([sched.asset?._id || sched.asset]);
    } else {
      setSelectedAssetIds([]);
    }

    if (assets.length > 0) {
      setAssetToAdd(assets[0]._id);
    }

    setDailyStartTime(sched.dailyStartTime || '12:00:00');
    setDailyEndTime(sched.dailyEndTime || '');
    setSelectedDays(Array.isArray(sched.daysOfWeek) ? sched.daysOfWeek : []);
    if (sched.startDate || sched.endDate) {
      setHasDateRange(true);
      setStartDate(sched.startDate ? sched.startDate.substring(0, 10) : '');
      setEndDate(sched.endDate ? sched.endDate.substring(0, 10) : '');
    } else {
      setHasDateRange(false);
      setStartDate('');
      setEndDate('');
    }
    setEnabled(sched.enabled !== false);
    setIsFormOpen(true);
  };

  const handleToggleDay = (dayVal) => {
    if (selectedDays.includes(dayVal)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayVal));
    } else {
      setSelectedDays([...selectedDays, dayVal].sort());
    }
  };

  const handleSelectAllDays = () => setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  const handleSelectWeekdays = () => setSelectedDays([1, 2, 3, 4, 5]);
  const handleSelectWeekends = () => setSelectedDays([0, 6]);
  const handleClearDays = () => setSelectedDays([]);

  const handleSubmitSchedule = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showAlert('error', 'Please enter a schedule title');
      return;
    }
    if (scheduleType === 'video' && selectedAssetIds.length === 0) {
      showAlert('error', 'Please add at least one video to the schedule');
      return;
    }
    if (!dailyStartTime) {
      showAlert('error', 'Please specify a start time');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        title: title.trim(),
        type: scheduleType,
        dailyStartTime,
        dailyEndTime: dailyEndTime ? dailyEndTime : '',
        daysOfWeek: selectedDays,
        startDate: hasDateRange && startDate ? startDate : null,
        endDate: hasDateRange && endDate ? endDate : null,
        enabled
      };

      if (scheduleType === 'video') {
        payload.assetIds = selectedAssetIds;
        payload.assetId = selectedAssetIds[0];
      } else {
        payload.duration = Number(overlayDuration) || 60;
        if (scheduleType === 'ashton') {
          payload.ashtonSqueeze = ashtonSqueeze;
        }
      }

      if (editingScheduleId) {
        await api.put(`/channels/${channelId}/schedules/${editingScheduleId}`, payload);
        showAlert('success', 'Schedule updated successfully');
      } else {
        await api.post(`/channels/${channelId}/schedules`, payload);
        showAlert('success', 'Schedule created successfully');
      }

      resetForm();
      loadSchedules();
    } catch (err) {
      console.error('Save schedule error:', err);
      showAlert('error', err.response?.data?.message || 'Failed to save schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (scheduleId) => {
    try {
      await api.patch(`/channels/${channelId}/schedules/${scheduleId}/toggle`);
      loadSchedules();
    } catch (err) {
      console.error('Toggle schedule error:', err);
      showAlert('error', 'Failed to toggle schedule state');
    }
  };

  const handleDeleteSchedule = async (scheduleId, schedTitle) => {
    if (!window.confirm(`Are you sure you want to delete schedule "${schedTitle}"?`)) {
      return;
    }
    try {
      await api.delete(`/channels/${channelId}/schedules/${scheduleId}`);
      showAlert('success', 'Schedule deleted');
      loadSchedules();
    } catch (err) {
      console.error('Delete schedule error:', err);
      showAlert('error', 'Failed to delete schedule');
    }
  };

  const formatDaysDisplay = (days) => {
    if (!days || days.length === 0 || days.length === 7) {
      return 'Every Day';
    }
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((d) => dayNames[d]).join(', ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c0e14] border border-[#232b3e] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#111520] border-b border-[#232b3e]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400">
              <Calendar size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-wide text-white uppercase">
                  Scheduled Video Playout Manager
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {channelName || 'Playout Channel'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Airs scheduled videos at exact times, smoothly pausing and resuming regular broadcast with zero HLS freeze.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isFormOpen && (
              <button
                onClick={handleOpenCreateForm}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-extrabold text-xs tracking-wider flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20"
              >
                <Plus size={15} />
                <span>NEW SCHEDULE</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1a2130] transition border border-transparent hover:border-[#2a3449]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Real-time On-Air Schedule Banner */}
        {currentOnAirSchedule && (
          <div className="bg-gradient-to-r from-amber-950/80 via-orange-950/80 to-amber-950/80 border-b border-amber-500/50 px-6 py-2.5 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2.5">
              <Radio size={16} className="text-amber-400 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                ON AIR SCHEDULE:
              </span>
              <span className="text-xs font-extrabold text-white">
                "{currentOnAirSchedule.title}"
              </span>
              <span className="text-[11px] text-amber-200/80">
                ({currentOnAirSchedule.assetCount > 1 ? `${currentOnAirSchedule.assetCount} videos playlist` : currentOnAirSchedule.assetName})
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded">
              Regular stream will resume automatically
            </span>
          </div>
        )}

        {/* Alert Feedback Toast */}
        {alert && (
          <div
            className={`mx-6 mt-3 px-4 py-2.5 rounded-xl border flex items-center space-x-2 text-xs font-semibold animate-fade-in ${
              alert.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                : 'bg-red-950/50 border-red-500/50 text-red-300'
            }`}
          >
            {alert.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-400 shrink-0" />
            )}
            <span>{alert.message}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Form Card (Create or Edit) */}
          {isFormOpen && (
            <div className="bg-[#111624] border border-[#2b354c] rounded-2xl p-5 shadow-inner animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[#212a3d] mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" />
                  <h3 className="text-xs font-extrabold tracking-wider uppercase text-white">
                    {editingScheduleId ? 'Edit Scheduled Item' : 'Create New Scheduled Item'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSubmitSchedule} className="space-y-4">
                {/* Schedule Type Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Schedule Type
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setScheduleType('video')}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition ${
                        scheduleType === 'video'
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-md'
                          : 'bg-[#0a0d14] border-[#222b3e] text-slate-400 hover:text-white'
                      }`}
                    >
                      <Film size={16} className={scheduleType === 'video' ? 'text-amber-400' : 'text-slate-500'} />
                      <div>
                        <div className="font-extrabold text-xs">Video Playout</div>
                        <div className="text-[10px] text-slate-400">Pauses stream & airs video</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScheduleType('lband')}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition ${
                        scheduleType === 'lband'
                          ? 'bg-blue-500/20 border-blue-500 text-white shadow-md'
                          : 'bg-[#0a0d14] border-[#222b3e] text-slate-400 hover:text-white'
                      }`}
                    >
                      <Layout size={16} className={scheduleType === 'lband' ? 'text-blue-400' : 'text-slate-500'} />
                      <div>
                        <div className="font-extrabold text-xs">L-Band Squeeze</div>
                        <div className="text-[10px] text-slate-400">Shrinks video into L-frame</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScheduleType('ashton')}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition ${
                        scheduleType === 'ashton'
                          ? 'bg-purple-500/20 border-purple-500 text-white shadow-md'
                          : 'bg-[#0a0d14] border-[#222b3e] text-slate-400 hover:text-white'
                      }`}
                    >
                      <Tv size={16} className={scheduleType === 'ashton' ? 'text-purple-400' : 'text-slate-500'} />
                      <div>
                        <div className="font-extrabold text-xs">Ashton Band</div>
                        <div className="text-[10px] text-slate-400">Lower-third bulletin banner</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Schedule Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Evening Bulletin / Daily Promo / News Pod"
                    className="w-full bg-[#0a0d14] border border-[#222b3e] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                    required
                  />
                </div>

                {/* Conditional: Scheduled Video Playlist Builder */}
                {scheduleType === 'video' ? (
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={13} className="text-amber-400" />
                        <span>Scheduled Video Playlist ({selectedAssetIds.length} video{selectedAssetIds.length === 1 ? '' : 's'})</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Combined Runtime: <strong className="text-amber-300">{getTotalSelectedAssetsDurationFormatted()}</strong>
                      </span>
                    </div>

                    {/* Add Video to Schedule Bar */}
                    <div className="flex items-center gap-2 mb-2">
                      <select
                        value={assetToAdd}
                        onChange={(e) => setAssetToAdd(e.target.value)}
                        className="flex-1 bg-[#0a0d14] border border-[#222b3e] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition"
                      >
                        {assets.length === 0 ? (
                          <option value="">No ready video assets found</option>
                        ) : (
                          assets.map((asset) => (
                            <option key={asset._id} value={asset._id}>
                              {asset.originalName} ({asset.durationFormatted || `${asset.duration}s`})
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddAssetToSchedule(assetToAdd)}
                        disabled={!assetToAdd}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-1 transition disabled:opacity-50"
                      >
                        <Plus size={13} strokeWidth={2.5} />
                        <span>Add Video</span>
                      </button>
                    </div>

                    {/* Selected Video Playlist Queue List */}
                    <div className="bg-[#0a0d14] border border-[#222b3e] rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                      {selectedAssetIds.length === 0 ? (
                        <div className="py-5 text-center text-xs text-slate-500">
                          No videos added to this scheduled playlist yet. Select a video above and click "+ Add Video".
                        </div>
                      ) : (
                        <div className="divide-y divide-[#171f2e]">
                          {selectedAssetIds.map((id, index) => {
                            const assetObj = getAssetById(id);
                            return (
                              <div
                                key={`${id}-${index}`}
                                className="px-3 py-1.5 flex items-center justify-between hover:bg-[#121722] transition text-xs"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span className="font-mono text-[10px] font-bold text-slate-500 w-5">
                                    #{index + 1}
                                  </span>
                                  <Film size={13} className="text-amber-400 shrink-0" />
                                  <span className="font-semibold text-slate-200 truncate">
                                    {assetObj ? assetObj.originalName : 'Media Asset'}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                    ({assetObj?.durationFormatted || `${assetObj?.duration || 0}s`})
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-3">
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => handleMoveAsset(index, -1)}
                                    className="p-1 rounded bg-[#161d2b] hover:bg-[#20293d] text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition"
                                    title="Move Up"
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === selectedAssetIds.length - 1}
                                    onClick={() => handleMoveAsset(index, 1)}
                                    className="p-1 rounded bg-[#161d2b] hover:bg-[#20293d] text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition"
                                    title="Move Down"
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAssetFromSchedule(index)}
                                    className="p-1 rounded bg-[#161d2b] hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition ml-1"
                                    title="Remove from schedule"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Overlay Duration & Mode Settings for L-Band and Ashton */
                  <div className="bg-[#0a0d14] border border-[#222b3e] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Timer size={13} className={scheduleType === 'lband' ? 'text-blue-400' : 'text-purple-400'} />
                        <span>{scheduleType === 'lband' ? 'L-Band' : 'Ashton Band'} Display Duration</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        {overlayDuration} seconds
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="5"
                        max="3600"
                        value={overlayDuration}
                        onChange={(e) => setOverlayDuration(Number(e.target.value))}
                        className="w-32 bg-[#121722] border border-[#242e42] rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5">
                        {[30, 60, 90, 120, 300].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setOverlayDuration(sec)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${
                              overlayDuration === sec
                                ? (scheduleType === 'lband' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white')
                                : 'bg-[#182030] text-slate-400 hover:text-white'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>

                    {scheduleType === 'ashton' && (
                      <div className="pt-2 border-t border-[#1e2738]">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Ashton Display Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setAshtonSqueeze(true)}
                            className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition ${
                              ashtonSqueeze
                                ? 'bg-purple-950/60 border-purple-500 text-purple-200'
                                : 'bg-[#121722] border-[#222b3e] text-slate-400'
                            }`}
                          >
                            Squeeze Video Upward
                          </button>
                          <button
                            type="button"
                            onClick={() => setAshtonSqueeze(false)}
                            className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition ${
                              !ashtonSqueeze
                                ? 'bg-purple-950/60 border-purple-500 text-purple-200'
                                : 'bg-[#121722] border-[#222b3e] text-slate-400'
                            }`}
                          >
                            Overlay On Video
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 italic">
                      ℹ️ Live graphics will smoothly appear at the scheduled time, stay active for {overlayDuration}s, and automatically retreat without interrupting the ongoing stream.
                    </div>
                  </div>
                )}

                {/* Daily Start/End Time & Days of Week */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                  {/* Daily Start Time */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock size={13} className="text-amber-400" />
                        <span>Start Time (HH:MM:SS)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setDailyStartTime(getNowTimeString())}
                        className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold underline"
                        title="Set start time to current second"
                      >
                        Now
                      </button>
                    </div>
                    <input
                      type="time"
                      step="1"
                      value={dailyStartTime}
                      onChange={(e) => setDailyStartTime(e.target.value)}
                      className="w-full bg-[#0a0d14] border border-[#222b3e] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs font-mono text-amber-300 focus:outline-none transition"
                      required
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Exact start time (defaults to now)
                    </span>
                  </div>

                  {/* Daily End Time */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Clock size={13} className="text-orange-400" />
                      <span>End Time (Optional)</span>
                    </label>
                    <input
                      type="time"
                      step="1"
                      value={dailyEndTime}
                      onChange={(e) => setDailyEndTime(e.target.value)}
                      className="w-full bg-[#0a0d14] border border-[#222b3e] focus:border-orange-500 rounded-xl px-3.5 py-2 text-xs font-mono text-orange-300 focus:outline-none transition"
                    />
                    <span className="text-[10px] text-amber-400/90 font-mono mt-1 block truncate" title={dailyEndTime ? computeWindowDurationStr(dailyStartTime, dailyEndTime) : ''}>
                      {dailyEndTime
                        ? `Window: ${computeWindowDurationStr(dailyStartTime, dailyEndTime)}`
                        : 'Single video play'}
                    </span>
                  </div>

                  {/* Recurring Days Selection */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Recurring Days of Week
                      </label>
                      <div className="flex items-center space-x-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={handleSelectAllDays}
                          className="text-amber-400 hover:underline px-1"
                        >
                          All
                        </button>
                        <span className="text-slate-600">|</span>
                        <button
                          type="button"
                          onClick={handleSelectWeekdays}
                          className="text-slate-400 hover:text-white px-1"
                        >
                          Weekdays
                        </button>
                        <span className="text-slate-600">|</span>
                        <button
                          type="button"
                          onClick={handleSelectWeekends}
                          className="text-slate-400 hover:text-white px-1"
                        >
                          Weekends
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = selectedDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => handleToggleDay(day.value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border ${
                              isSelected
                                ? 'bg-amber-500 border-amber-400 text-black shadow-sm'
                                : 'bg-[#0a0d14] border-[#222b3e] text-slate-400 hover:border-[#33415c] hover:text-white'
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Optional Date Range Window */}
                <div className="pt-2 border-t border-[#1e2638]">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasDateRange}
                        onChange={(e) => setHasDateRange(e.target.checked)}
                        className="rounded bg-[#0a0d14] border-[#252f44] text-amber-500 focus:ring-amber-500/20"
                      />
                      <span className="text-xs font-bold text-slate-300">
                        Set Active Calendar Date Range (Optional)
                      </span>
                    </label>
                    <span className="text-[10px] text-slate-500">
                      Leave unchecked to air perpetually on selected days
                    </span>
                  </div>

                  {hasDateRange && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-3 bg-[#0a0d14] border border-[#1e2638] rounded-xl animate-fade-in">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Start Date (From)
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-[#111622] border border-[#222b3e] focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          End Date (Until)
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-[#111622] border border-[#222b3e] focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1e2638]">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-xl bg-[#141a26] hover:bg-[#1a2333] border border-[#222b3e] text-xs font-semibold text-slate-300 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Check size={14} strokeWidth={2.5} />
                        <span>{editingScheduleId ? 'Update Schedule' : 'Save Schedule'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Schedules Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Film size={15} className="text-slate-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  Scheduled Playout Queue ({schedules.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Videos trigger automatically at daily air time
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Loading schedules...
              </div>
            ) : schedules.length === 0 ? (
              <div className="py-12 border border-dashed border-[#222b3e] rounded-2xl flex flex-col items-center justify-center text-center p-6">
                <Clock size={32} className="text-slate-600 mb-2" />
                <h4 className="text-sm font-bold text-slate-300 mb-1">
                  No Scheduled Videos Configured
                </h4>
                <p className="text-xs text-slate-500 max-w-md mb-4">
                  Schedule time-based programs or ads that will seamlessly pause your regular playlist and resume from where it left off.
                </p>
                <button
                  onClick={handleOpenCreateForm}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs tracking-wider flex items-center gap-1.5 transition"
                >
                  <Plus size={14} />
                  <span>Create First Schedule</span>
                </button>
              </div>
            ) : (
              <div className="border border-[#222b3e] rounded-2xl overflow-hidden bg-[#0c0f17]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#121622] text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-[#222b3e]">
                    <tr>
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Scheduled Content</th>
                      <th className="py-3 px-4">Air Time</th>
                      <th className="py-3 px-4">Days</th>
                      <th className="py-3 px-4">Date Window</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#192030]">
                    {schedules.map((sched) => {
                      const isOnAir = currentOnAirSchedule?.scheduleId === sched._id;
                      return (
                        <tr
                          key={sched._id}
                          className={`hover:bg-[#141a27] transition ${
                            isOnAir ? 'bg-amber-950/30' : ''
                          }`}
                        >
                          {/* Title */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-white flex items-center gap-1.5">
                                {isOnAir && (
                                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                )}
                                <span>{sched.title}</span>
                              </span>
                              {sched.type === 'lband' && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-950/90 border border-blue-500/60 text-blue-300">
                                  L-BAND
                                </span>
                              )}
                              {sched.type === 'ashton' && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-950/90 border border-purple-500/60 text-purple-300">
                                  ASHTON
                                </span>
                              )}
                              {(!sched.type || sched.type === 'video') && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-950/90 border border-amber-500/60 text-amber-300">
                                  VIDEO
                                </span>
                              )}
                            </div>
                            {isOnAir && (
                              <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block mt-0.5">
                                Currently Playing
                              </span>
                            )}
                          </td>

                          {/* Scheduled Content */}
                          <td className="py-3 px-4">
                            {sched.type === 'lband' ? (
                              <div>
                                <div className="font-bold text-blue-300 flex items-center gap-1.5">
                                  <Layout size={13} className="text-blue-400" />
                                  <span>L-Band Squeeze Overlay</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Duration: {sched.duration || 60}s
                                </div>
                              </div>
                            ) : sched.type === 'ashton' ? (
                              <div>
                                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                                  <Tv size={13} className="text-purple-400" />
                                  <span>Ashton Band ({sched.ashtonSqueeze !== false ? 'Squeeze' : 'Overlay'})</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Duration: {sched.duration || 60}s
                                </div>
                              </div>
                            ) : sched.assets && sched.assets.length > 1 ? (
                              <div>
                                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                                  <Layers size={13} className="text-amber-400" />
                                  <span>{sched.assets.length} Videos Playlist</span>
                                </div>
                                <div
                                  className="text-[10px] text-slate-400 truncate max-w-[200px]"
                                  title={sched.assets.map((a) => a?.originalName).join(' ➔ ')}
                                >
                                  {sched.assets.map((a) => a?.originalName || 'Asset').join(' • ')}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div
                                  className="font-medium text-slate-200 truncate max-w-[200px]"
                                  title={sched.assets?.[0]?.originalName || sched.asset?.originalName}
                                >
                                  {sched.assets?.[0]?.originalName || sched.asset?.originalName || 'Asset Removed'}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Duration: {sched.duration || sched.asset?.duration || 0}s
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Daily Start & End Time */}
                          <td className="py-3 px-4">
                            <div className="font-mono text-xs font-bold text-amber-300 flex items-center gap-1">
                              <span>{sched.dailyStartTime}</span>
                              {sched.dailyEndTime && (
                                <>
                                  <span className="text-slate-500">→</span>
                                  <span className="text-orange-300">{sched.dailyEndTime}</span>
                                </>
                              )}
                            </div>
                            {sched.dailyEndTime ? (
                              <span className="text-[10px] text-amber-400/90 font-mono block">
                                Window: {computeWindowDurationStr(sched.dailyStartTime, sched.dailyEndTime)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic block">
                                Single playback
                              </span>
                            )}
                          </td>

                          {/* Days of Week */}
                          <td className="py-3 px-4">
                            <span className="text-[11px] text-slate-300 font-medium">
                              {formatDaysDisplay(sched.daysOfWeek)}
                            </span>
                          </td>

                          {/* Date Range Window */}
                          <td className="py-3 px-4">
                            {sched.startDate || sched.endDate ? (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {sched.startDate ? sched.startDate.substring(0, 10) : 'Any'} →{' '}
                                {sched.endDate ? sched.endDate.substring(0, 10) : 'Any'}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Always Active</span>
                            )}
                          </td>

                          {/* Active Status Toggle */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleActive(sched._id)}
                              className="focus:outline-none transition inline-flex items-center"
                              title={sched.enabled ? 'Click to Disable' : 'Click to Enable'}
                            >
                              {sched.enabled ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700 text-[10px] font-bold">
                                  PAUSED
                                </span>
                              )}
                            </button>
                          </td>

                          {/* Edit / Delete / Air Now Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleAirNow(sched)}
                                className="px-2 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 transition flex items-center gap-1 text-[11px] font-bold shadow-sm"
                                title="Air this schedule directly on the live broadcast now"
                              >
                                <Play size={11} className="fill-emerald-400" />
                                <span>Air Now</span>
                              </button>
                              <button
                                onClick={() => handleEditSchedule(sched)}
                                className="p-1.5 rounded-lg bg-[#141926] hover:bg-[#1f283d] text-slate-400 hover:text-white border border-[#222a3d] transition"
                                title="Edit Schedule"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteSchedule(sched._id, sched.title)}
                                className="p-1.5 rounded-lg bg-[#141926] hover:bg-red-950/50 text-slate-400 hover:text-red-400 border border-[#222a3d] hover:border-red-500/40 transition"
                                title="Delete Schedule"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#0e111a] border-t border-[#1e2638] flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Scheduler Engine: Running (Wall-Clock Precision)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#141926] hover:bg-[#1a2333] border border-[#252f44] text-slate-300 hover:text-white font-medium transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

