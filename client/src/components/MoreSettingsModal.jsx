import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';
import {
  X,
  Sliders,
  Tv,
  Layout,
  Maximize,
  Minimize2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  Sparkles,
  Layers,
  Radio,
  RefreshCw,
  Info,
  Flame,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Timer,
  Check
} from 'lucide-react';

export default function MoreSettingsModal({
  isOpen,
  onClose,
  channel,
  onChannelUpdated
}) {
  const [activeTab, setActiveTab] = useState('lband'); // 'lband' | 'ashton'
  const [alert, setAlert] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // L-Band state
  const [lbandEnabled, setLbandEnabled] = useState(false);
  const [lbandPreset, setLbandPreset] = useState('top-right');
  const [lbandWindowX, setLbandWindowX] = useState(300);
  const [lbandWindowY, setLbandWindowY] = useState(20);
  const [lbandWindowW, setLbandWindowW] = useState(960);
  const [lbandWindowH, setLbandWindowH] = useState(540);
  const [lbandAssetPath, setLbandAssetPath] = useState('');
  const lbandInputRef = useRef(null);

  // Ashton Band state
  const [ashtonEnabled, setAshtonEnabled] = useState(false);
  const [ashtonSqueeze, setAshtonSqueeze] = useState(true); // true = squeeze, false = overlay
  const [ashtonHeight, setAshtonHeight] = useState(160);
  const [ashtonAssetPath, setAshtonAssetPath] = useState('');
  const ashtonInputRef = useRef(null);

  // Quick Fire state for L-Band and Ashton Band (auto-closes after duration)
  const [lbandFireDuration, setLbandFireDuration] = useState(60);
  const [lbandFireRemaining, setLbandFireRemaining] = useState(0);
  const [ashtonFireDuration, setAshtonFireDuration] = useState(60);
  const [ashtonFireRemaining, setAshtonFireRemaining] = useState(0);

  // Scheduled overlay states
  const [lbandSchedules, setLbandSchedules] = useState([]);
  const [ashtonSchedules, setAshtonSchedules] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedStartTime, setSchedStartTime] = useState('14:00:00');
  const [schedDuration, setSchedDuration] = useState(60);
  const [schedDays, setSchedDays] = useState([0, 1, 2, 3, 4, 5, 6]);

  // Countdown effect for fired L-Band
  useEffect(() => {
    if (lbandFireRemaining <= 0) return;
    const interval = setInterval(() => {
      setLbandFireRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setLbandEnabled(false);
          showAlert('info', 'L-Band 60s Fire duration completed. Closed automatically.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lbandFireRemaining]);

  // Countdown effect for fired Ashton Band
  useEffect(() => {
    if (ashtonFireRemaining <= 0) return;
    const interval = setInterval(() => {
      setAshtonFireRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setAshtonEnabled(false);
          showAlert('info', 'Ashton Band 60s Fire duration completed. Closed automatically.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [ashtonFireRemaining]);

  // Fetch overlay schedules
  const fetchSchedules = async () => {
    if (!channel?._id) return;
    try {
      const res = await api.get(`/channels/${channel._id}/schedules`);
      const all = res.data || [];
      setLbandSchedules(all.filter((s) => s.type === 'lband'));
      setAshtonSchedules(all.filter((s) => s.type === 'ashton'));
    } catch (err) {
      console.warn('Failed to load overlay schedules:', err);
    }
  };

  useEffect(() => {
    if (isOpen && channel?._id) {
      fetchSchedules();
    }
  }, [isOpen, channel?._id]);

  const handleFireLBand = async (duration = lbandFireDuration) => {
    if (lbandFireRemaining > 0) {
      setLbandFireRemaining(0);
      handleSaveLBand(false);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.post(`/channels/${channel._id}/lband/fire`, { duration });
      setLbandEnabled(true);
      setLbandFireRemaining(res.data?.duration || duration);
      showAlert('success', `L-Band fired live for ${res.data?.duration || duration}s! Will close automatically.`);
      if (onChannelUpdated) onChannelUpdated();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to fire L-Band');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFireAshton = async (duration = ashtonFireDuration) => {
    if (ashtonFireRemaining > 0) {
      setAshtonFireRemaining(0);
      handleSaveAshton(false, ashtonSqueeze);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.post(`/channels/${channel._id}/ashton/fire`, { duration, squeeze: ashtonSqueeze });
      setAshtonEnabled(true);
      setAshtonFireRemaining(res.data?.duration || duration);
      showAlert('success', `Ashton Band fired live for ${res.data?.duration || duration}s! Will close automatically.`);
      if (onChannelUpdated) onChannelUpdated();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to fire Ashton Band');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateOverlaySchedule = async (type) => {
    if (!schedTitle.trim()) {
      showAlert('error', 'Please enter a title for the schedule');
      return;
    }
    if (!schedStartTime) {
      showAlert('error', 'Please specify a start air time');
      return;
    }
    try {
      await api.post(`/channels/${channel._id}/schedules`, {
        title: schedTitle.trim(),
        type,
        dailyStartTime: schedStartTime,
        duration: Number(schedDuration) || 60,
        daysOfWeek: schedDays,
        ashtonSqueeze: ashtonSqueeze !== false,
        enabled: true
      });
      showAlert('success', `${type === 'lband' ? 'L-Band' : 'Ashton Band'} schedule created!`);
      setSchedTitle('');
      setShowScheduleForm(false);
      fetchSchedules();
      if (onChannelUpdated) onChannelUpdated();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to create schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await api.delete(`/channels/${channel._id}/schedules/${scheduleId}`);
      showAlert('success', 'Schedule deleted');
      fetchSchedules();
    } catch (err) {
      showAlert('error', 'Failed to delete schedule');
    }
  };

  const handleToggleSchedule = async (schedule) => {
    try {
      await api.put(`/channels/${channel._id}/schedules/${schedule._id}`, {
        enabled: !schedule.enabled
      });
      fetchSchedules();
    } catch (err) {
      showAlert('error', 'Failed to toggle schedule');
    }
  };

  // Sync state from channel branding
  useEffect(() => {
    if (channel?.branding) {
      const bLband = channel.branding.lband || {};
      setLbandEnabled(!!bLband.enabled);
      setLbandPreset(bLband.preset || 'top-right');
      setLbandWindowX(bLband.windowX !== undefined ? bLband.windowX : 300);
      setLbandWindowY(bLband.windowY !== undefined ? bLband.windowY : 20);
      setLbandWindowW(bLband.windowWidth || 960);
      setLbandWindowH(bLband.windowHeight || 540);
      setLbandAssetPath(bLband.assetPath || '');

      const bAshton = channel.branding.ashton || {};
      setAshtonEnabled(!!bAshton.enabled);
      setAshtonSqueeze(bAshton.squeeze !== false);
      setAshtonHeight(bAshton.height || 160);
      setAshtonAssetPath(bAshton.assetPath || '');
    }
  }, [channel]);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 3500);
  };

  // Preset selector helper for L-Band
  const handleApplyLBandPreset = (presetKey) => {
    setLbandPreset(presetKey);
    if (presetKey === 'top-right') {
      setLbandWindowX(300);
      setLbandWindowY(20);
      setLbandWindowW(960);
      setLbandWindowH(540);
    } else if (presetKey === 'top-left') {
      setLbandWindowX(20);
      setLbandWindowY(20);
      setLbandWindowW(960);
      setLbandWindowH(540);
    } else if (presetKey === 'center') {
      setLbandWindowX(160);
      setLbandWindowY(20);
      setLbandWindowW(960);
      setLbandWindowH(540);
    }
  };

  // Toggle or Update L-Band
  const handleSaveLBand = async (newEnabledState = null) => {
    if (!channel?._id) return;
    const targetEnabled = newEnabledState !== null ? newEnabledState : lbandEnabled;
    
    // Instant optimistic UI update
    setLbandEnabled(targetEnabled);
    setIsSubmitting(true);

    try {
      const res = await api.put(`/channels/${channel._id}/lband`, {
        enabled: targetEnabled,
        preset: lbandPreset,
        windowX: lbandWindowX,
        windowY: lbandWindowY,
        windowWidth: lbandWindowW,
        windowHeight: lbandWindowH
      });
      setLbandEnabled(res.data.lband.enabled);
      showAlert(
        'success',
        targetEnabled
          ? 'L-Band ad applied live! Stream video shrunk to transparent cutout window.'
          : 'L-Band ad removed from live stream.'
      );
      if (onChannelUpdated) onChannelUpdated();
    } catch (err) {
      // Revert on error
      setLbandEnabled(!targetEnabled);
      showAlert('error', err.response?.data?.message || err.message || 'Failed to update L-Band ad');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload custom L-Band graphic with auto-cutout detection
  const handleUploadLBand = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !channel?._id) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('lband', file);

    try {
      const res = await api.post(`/channels/${channel._id}/lband/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLbandAssetPath(res.data.lband?.assetPath || '');
      if (res.data.lband?.enabled !== undefined) {
        setLbandEnabled(Boolean(res.data.lband.enabled));
      }
      if (res.data.detected) {
        setLbandWindowX(res.data.detected.windowX);
        setLbandWindowY(res.data.detected.windowY);
        setLbandWindowW(res.data.detected.windowWidth);
        setLbandWindowH(res.data.detected.windowHeight);
        setLbandPreset('auto-detected');
      }
      showAlert(
        'success',
        `L-Band uploaded! Cutout detected (${res.data.detected?.windowWidth || 960}x${res.data.detected?.windowHeight || 540}). Click 'Apply L-Band' when ready to put on air.`
      );
      if (onChannelUpdated) onChannelUpdated();
    } catch (err) {
      showAlert('error', err.response?.data?.message || err.message || 'Failed to upload L-Band graphic');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle or Update Ashton Band
  const handleSaveAshton = async (newEnabledState = null, newSqueezeState = null) => {
    if (!channel?._id) return;
    const targetEnabled = newEnabledState !== null ? newEnabledState : ashtonEnabled;
    const targetSqueeze = newSqueezeState !== null ? newSqueezeState : ashtonSqueeze;

    // Instant optimistic UI update
    setAshtonEnabled(targetEnabled);
    setAshtonSqueeze(targetSqueeze);
    setIsSubmitting(true);

    try {
      const res = await api.put(`/channels/${channel._id}/ashton`, {
        enabled: targetEnabled,
        squeeze: targetSqueeze,
        height: ashtonHeight
      });
      setAshtonEnabled(res.data.ashton.enabled);
      setAshtonSqueeze(res.data.ashton.squeeze);
      showAlert(
        'success',
        targetEnabled
          ? `Ashton Band applied live (${targetSqueeze ? 'Video Squeezed Upward' : 'Overlay Mode'})`
          : 'Ashton Band removed from live stream.'
      );
      if (onChannelUpdated) onChannelUpdated();
    } catch (err) {
      // Revert on error
      setAshtonEnabled(!targetEnabled);
      showAlert('error', err.response?.data?.message || err.message || 'Failed to update Ashton Band');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload custom Ashton graphic with auto-height detection
  const handleUploadAshton = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !channel?._id) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('ashton', file);

    try {
      const res = await api.post(`/channels/${channel._id}/ashton/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAshtonAssetPath(res.data.ashton?.assetPath || '');
      if (res.data.ashton?.enabled !== undefined) {
        setAshtonEnabled(Boolean(res.data.ashton.enabled));
      }
      if (res.data.detected) {
        setAshtonHeight(res.data.detected.height);
      }
      showAlert(
        'success',
        `Ashton Band uploaded! Height detected (${res.data.detected?.height || 160}px). Click 'Apply Ashton Band' when ready to put on air.`
      );
      if (onChannelUpdated) onChannelUpdated();
    } catch (err) {
      showAlert('error', err.response?.data?.message || err.message || 'Failed to upload Ashton graphic');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#0b0e14] border border-[#222b3d] rounded-2xl w-full max-w-5xl h-[88vh] max-h-[820px] flex flex-col shadow-2xl shadow-black/80 overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="px-6 py-3.5 border-b border-[#1b2333] flex items-center justify-between bg-gradient-to-r from-[#0f1420] to-[#0a0d14]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sliders size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-white tracking-wide uppercase">
                  Ad &amp; Playout Graphics Dashboard
                </h2>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-950/80 border border-blue-700/60 text-blue-400 uppercase">
                  DVE Squeeze Engine
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Channel: <span className="font-semibold text-slate-200">{channel?.name}</span> • Live Broadcast Graphics Control
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Live Indicator Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#131926] border border-[#222c3f] text-xs">
              <span className={`w-2 h-2 rounded-full ${channel?.status === 'live' ? 'bg-red-500 animate-ping' : 'bg-slate-500'}`} />
              <span className="text-[10px] font-bold text-slate-300 uppercase">
                {channel?.status === 'live' ? 'Stream Live' : 'Stream Idle'}
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#141a26] border border-[#243044] hover:bg-[#1e2738] text-slate-400 hover:text-white flex items-center justify-center transition"
              title="Close Dashboard"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#1b2333] px-6 bg-[#0d111a] text-xs">
          <button
            onClick={() => setActiveTab('lband')}
            className={`py-3 px-4 font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'lband'
                ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layout size={15} />
            <span>L-Band Ad (Squeeze-Back DVE)</span>
            {lbandEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('ashton')}
            className={`py-3 px-4 font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition ${
              activeTab === 'ashton'
                ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Maximize size={15} />
            <span>Ashton Band (Lower Third)</span>
            {ashtonEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            )}
          </button>
        </div>

        {/* Toast Alert */}
        {alert && (
          <div
            className={`mx-6 mt-3 px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 border animate-fade-in ${
              alert.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-600/60 text-emerald-300'
                : 'bg-red-950/70 border-red-600/60 text-red-300'
            }`}
          >
            {alert.type === 'success' ? (
              <CheckCircle2 size={14} className="shrink-0" />
            ) : (
              <AlertCircle size={14} className="shrink-0" />
            )}
            <span className="font-medium">{alert.message}</span>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ============================================================== */}
          {/* TAB 1: L-BAND AD (SQUEEZE-BACK DVE)                            */}
          {/* ============================================================== */}
          {activeTab === 'lband' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Interactive Visual Preview Screen (7 cols) */}
              <div className="lg:col-span-7 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Tv size={15} className="text-blue-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                      Live Playout Visual Simulation (16:9 DVE)
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                      lbandFireRemaining > 0
                        ? 'bg-amber-950 border border-amber-500 text-amber-300 animate-pulse'
                        : lbandEnabled
                        ? 'bg-emerald-950 border border-emerald-600 text-emerald-400'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {lbandFireRemaining > 0 ? (
                      <>
                        <Flame size={11} className="fill-current text-amber-400" />
                        <span>FIRED ({lbandFireRemaining}s)</span>
                      </>
                    ) : lbandEnabled ? (
                      '● ON AIR (Squeezed)'
                    ) : (
                      'Full Screen'
                    )}
                  </span>
                </div>

                {/* Simulated 16:9 Broadcast Output Display */}
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#232d40] shadow-inner flex items-center justify-center">
                  
                  {/* Background L-Band Graphic Layer (Smooth Slide & Fade Animation) */}
                  <div
                    style={{
                      transform: lbandEnabled ? 'translateX(0) scale(1)' : 'translateX(-50px) scale(0.97)',
                      opacity: lbandEnabled ? 1 : 0,
                      transition: 'transform 1.8s cubic-bezier(0.65, 0, 0.35, 1), opacity 1.8s cubic-bezier(0.65, 0, 0.35, 1)',
                      pointerEvents: lbandEnabled ? 'auto' : 'none'
                    }}
                    className="absolute inset-0 z-20 pointer-events-none"
                  >
                    {lbandAssetPath ? (
                      <img
                        src={`http://localhost:5000/${lbandAssetPath}`}
                        alt="L-Band Graphic"
                        className="w-full h-full object-fill pointer-events-none"
                      />
                    ) : (
                      <>
                        {/* Left Sidebar Frame */}
                        <div
                          style={{ width: `${(lbandWindowX / 1280) * 100}%` }}
                          className="absolute left-0 top-0 bottom-0 bg-gradient-to-b from-[#090d16] via-[#111827] to-[#0f172a] border-r-2 border-blue-500/80 p-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="px-2 py-1 rounded bg-blue-900/60 border border-blue-600/50 text-[10px] font-extrabold text-blue-200 flex items-center gap-1.5 uppercase">
                              <Radio size={10} className="animate-pulse text-red-500" />
                              <span>SPONSOR SPOT</span>
                            </div>
                            <div className="p-2 rounded-lg bg-[#0b0e14]/90 border border-slate-700 text-[9px] text-slate-300 font-bold uppercase text-center">
                              PROMO / AD GRAPHIC
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-blue-950/80 border border-blue-500/40 text-[8px] text-center text-blue-300 font-semibold uppercase">
                            24x7 HD LIVE
                          </div>
                        </div>

                        {/* Top Margin Strip */}
                        <div
                          style={{
                            left: `${(lbandWindowX / 1280) * 100}%`,
                            height: `${(lbandWindowY / 720) * 100}%`
                          }}
                          className="absolute top-0 right-0 bg-[#090d16]"
                        />

                        {/* Bottom Banner Frame */}
                        <div
                          style={{
                            left: `${(lbandWindowX / 1280) * 100}%`,
                            top: `${((lbandWindowY + lbandWindowH) / 720) * 100}%`,
                            height: `${((720 - (lbandWindowY + lbandWindowH)) / 720) * 100}%`
                          }}
                          className="absolute bottom-0 right-0 bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] border-t-2 border-blue-500/80 px-4 py-1.5 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-extrabold text-[9px] uppercase">
                              AD
                            </span>
                            <span className="text-[10px] font-bold text-slate-200 uppercase">
                              LIVE ON-AIR PROMOTIONAL BRANDING
                            </span>
                          </div>
                          <span className="text-[9px] font-mono text-blue-400">
                            WWW.CLOUDPLAYOUT.TV
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Program Stream Video Layer: Squeezed into Cutout when L-Band is ON */}
                  <div
                    style={
                      lbandEnabled
                        ? {
                            position: 'absolute',
                            left: `${(lbandWindowX / 1280) * 100}%`,
                            top: `${(lbandWindowY / 720) * 100}%`,
                            width: `${(lbandWindowW / 1280) * 100}%`,
                            height: `${(lbandWindowH / 720) * 100}%`,
                            transition: 'all 1.8s cubic-bezier(0.65, 0, 0.35, 1)'
                          }
                        : {
                            position: 'absolute',
                            left: '0%',
                            top: '0%',
                            width: '100%',
                            height: '100%',
                            transition: 'all 1.8s cubic-bezier(0.65, 0, 0.35, 1)'
                          }
                    }
                    className={`bg-slate-900 border-2 overflow-hidden flex flex-col items-center justify-center relative ${
                      lbandEnabled ? 'border-cyan-400/90 shadow-lg shadow-cyan-500/20' : 'border-transparent'
                    }`}
                  >
                    {/* Simulated live video content */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/80 flex items-center justify-center">
                      <div className="flex flex-col items-center text-center p-4">
                        <div className="w-12 h-12 rounded-full bg-blue-600/30 border border-blue-400/50 flex items-center justify-center text-blue-300 mb-2">
                          <Tv size={24} />
                        </div>
                        <span className="text-xs font-black uppercase text-white tracking-widest">
                          {channel?.name || 'LIVE STREAM PROGRAM'}
                        </span>
                        <span className="text-[9px] font-mono text-cyan-400 mt-1">
                          {lbandEnabled
                            ? `DVE SQUEEZE: ${lbandWindowW}x${lbandWindowH} @ (${lbandWindowX}, ${lbandWindowY})`
                            : 'FULL SCREEN: 1280x720'}
                        </span>
                      </div>
                    </div>

                    {/* Squeeze Badge */}
                    {lbandEnabled && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 border border-cyan-400/60 text-[8px] font-extrabold text-cyan-300 uppercase">
                        Squeezed Inside L-Band Cutout
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#101520] border border-[#1e2738] flex items-start gap-2.5 text-slate-400 text-xs">
                  <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[11px]">
                    When L-Band is applied, the live stream video automatically shrinks and scales cleanly into the transparent cutout window of the L-Band graphic without stopping or interrupting the playout stream.
                  </p>
                </div>
              </div>

              {/* Right Column: Controls & Upload Settings (5 cols) */}
              <div className="lg:col-span-5 space-y-5 bg-[#0f131c] border border-[#1e2738] p-5 rounded-2xl">
                
                {/* Apply to Air Switch & Quick Fire */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Live Broadcast Status
                    </span>
                    {lbandFireRemaining > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-600/70 px-2 py-0.5 rounded-full animate-pulse">
                        <Flame size={11} className="fill-current text-amber-400" />
                        <span>Fired Countdown: {lbandFireRemaining}s</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Manual Air Toggle */}
                    <button
                      onClick={() => {
                        if (lbandFireRemaining > 0) setLbandFireRemaining(0);
                        handleSaveLBand(!lbandEnabled);
                      }}
                      disabled={isSubmitting}
                      className={`py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-lg ${
                        lbandEnabled && lbandFireRemaining === 0
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                      }`}
                    >
                      {lbandEnabled && lbandFireRemaining === 0 ? (
                        <>
                          <Square size={13} className="fill-current" />
                          <span>REMOVE FROM AIR</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} className="fill-current" />
                          <span>TAKE TO AIR</span>
                        </>
                      )}
                    </button>

                    {/* 🔥 QUICK FIRE BUTTON (Default 60s) */}
                    <button
                      onClick={() => handleFireLBand(lbandFireDuration)}
                      disabled={isSubmitting}
                      className={`py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-lg ${
                        lbandFireRemaining > 0
                          ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse shadow-amber-900/50'
                          : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-orange-900/40'
                      }`}
                      title="Instantly display L-Band for 60 seconds and automatically close"
                    >
                      <Flame size={14} className={lbandFireRemaining > 0 ? 'text-yellow-200 fill-current' : 'text-amber-200'} />
                      <span>
                        {lbandFireRemaining > 0
                          ? `FIRED: ${lbandFireRemaining}s (STOP)`
                          : `FIRE (${lbandFireDuration}s)`}
                      </span>
                    </button>
                  </div>

                  {/* Duration Selector for Quick Fire */}
                  <div className="flex items-center justify-between px-1 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                      <Timer size={11} className="text-amber-400" />
                      <span>Fire Duration:</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[30, 60, 90, 120].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setLbandFireDuration(sec)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                            lbandFireDuration === sec
                              ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                              : 'bg-[#182030] text-slate-400 hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cutout Window Geometry Presets */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Transparent Cutout Geometry
                    </span>
                    {lbandPreset === 'auto-detected' && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                        <Sparkles size={10} />
                        <span>Auto-Detected from PNG</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleApplyLBandPreset('top-right')}
                      className={`py-2 px-3 rounded-xl border text-left text-xs font-semibold transition ${
                        lbandPreset === 'top-right'
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : 'bg-[#141a26] border-[#222c3f] text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-extrabold text-[11px] text-blue-400">Top-Right Window</div>
                      <div className="text-[9px] text-slate-400">Standard 960x540 (X:300, Y:20)</div>
                    </button>

                    <button
                      onClick={() => handleApplyLBandPreset('top-left')}
                      className={`py-2 px-3 rounded-xl border text-left text-xs font-semibold transition ${
                        lbandPreset === 'top-left'
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : 'bg-[#141a26] border-[#222c3f] text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-extrabold text-[11px] text-blue-400">Top-Left Window</div>
                      <div className="text-[9px] text-slate-400">Right Column + Bottom Bar</div>
                    </button>
                  </div>
                </div>

                {/* Coordinate Inputs */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Window Width (px)
                    </label>
                    <input
                      type="number"
                      value={lbandWindowW}
                      onChange={(e) => setLbandWindowW(Number(e.target.value))}
                      className="w-full bg-[#121620] border border-[#242e42] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Window Height (px)
                    </label>
                    <input
                      type="number"
                      value={lbandWindowH}
                      onChange={(e) => setLbandWindowH(Number(e.target.value))}
                      className="w-full bg-[#121620] border border-[#242e42] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      X Position (px)
                    </label>
                    <input
                      type="number"
                      value={lbandWindowX}
                      onChange={(e) => setLbandWindowX(Number(e.target.value))}
                      className="w-full bg-[#121620] border border-[#242e42] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Y Position (px)
                    </label>
                    <input
                      type="number"
                      value={lbandWindowY}
                      onChange={(e) => setLbandWindowY(Number(e.target.value))}
                      className="w-full bg-[#121620] border border-[#242e42] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Upload Custom Graphic */}
                <div className="pt-2 border-t border-[#1e2738]">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                    Custom L-Band Graphic (1280x720 PNG)
                  </span>

                  <input
                    ref={lbandInputRef}
                    type="file"
                    accept="image/png,image/webp"
                    onChange={handleUploadLBand}
                    className="hidden"
                  />

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => lbandInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#171e2c] hover:bg-[#20293b] border border-[#27344c] text-xs font-bold text-slate-200 hover:text-white flex items-center justify-center space-x-2 transition"
                    >
                      <Upload size={14} className="text-blue-400" />
                      <span>Upload Custom PNG</span>
                    </button>

                    {lbandAssetPath && (
                      <span className="text-[10px] text-emerald-400 font-bold px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/60">
                        Custom Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Save Settings Button */}
                <button
                  onClick={() => handleSaveLBand(lbandEnabled)}
                  disabled={isSubmitting}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs uppercase tracking-wide text-white transition flex items-center justify-center space-x-2"
                >
                  <RefreshCw size={13} className={isSubmitting ? 'animate-spin' : ''} />
                  <span>Update Cutout Dimensions</span>
                </button>

                {/* Scheduled L-Band Events Section */}
                <div className="border-t border-[#1e2738] pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={12} className="text-amber-400" />
                      <span>Scheduled L-Band Events ({lbandSchedules.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowScheduleForm(!showScheduleForm)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 transition"
                    >
                      <Plus size={11} />
                      <span>{showScheduleForm ? 'Close Form' : '+ Schedule L-Band'}</span>
                    </button>
                  </div>

                  {/* Inline Form to create an L-Band Schedule */}
                  {showScheduleForm && (
                    <div className="bg-[#141a26] border border-[#232d40] rounded-xl p-3.5 space-y-2.5 shadow-inner">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide block">
                        New Scheduled L-Band Trigger
                      </span>
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-1">Schedule Name / Title</label>
                        <input
                          type="text"
                          value={schedTitle}
                          onChange={(e) => setSchedTitle(e.target.value)}
                          placeholder="e.g. Daily Promo Squeeze"
                          className="w-full bg-[#0a0d14] border border-[#222b3e] focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-1">Air Time</label>
                          <input
                            type="time"
                            step="1"
                            value={schedStartTime}
                            onChange={(e) => setSchedStartTime(e.target.value)}
                            className="w-full bg-[#0a0d14] border border-[#222b3e] focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-300 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-1">Duration (seconds)</label>
                          <input
                            type="number"
                            min="5"
                            max="3600"
                            value={schedDuration}
                            onChange={(e) => setSchedDuration(Number(e.target.value))}
                            className="w-full bg-[#0a0d14] border border-[#222b3e] focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Days of week selector */}
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-1">Days of Week</label>
                        <div className="flex gap-1">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSchedDays((prev) =>
                                  prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
                                );
                              }}
                              className={`flex-1 h-6 rounded text-[9px] font-bold transition ${
                                schedDays.includes(idx)
                                  ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                                  : 'bg-[#0a0d14] text-slate-500 hover:text-white'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCreateOverlaySchedule('lband')}
                        className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition mt-2 shadow-md"
                      >
                        <Check size={12} strokeWidth={3} />
                        <span>Save L-Band Schedule</span>
                      </button>
                    </div>
                  )}

                  {/* List of L-Band schedules */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {lbandSchedules.length === 0 ? (
                      <span className="text-[10px] text-slate-500 italic block py-1">
                        No L-Band schedules configured. Schedule an event to automatically display L-Band at set times.
                      </span>
                    ) : (
                      lbandSchedules.map((s) => (
                        <div
                          key={s._id}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#141a26] border border-[#1e2738] text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-200 block text-[11px]">{s.title}</span>
                            <span className="text-[10px] font-mono text-amber-400/90">
                              {s.dailyStartTime} ({s.duration}s)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleSchedule(s)}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${
                                s.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {s.enabled ? 'ACTIVE' : 'OFF'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSchedule(s._id)}
                              className="p-1 rounded text-slate-500 hover:text-red-400 transition"
                              title="Delete schedule"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: ASHTON BAND (LOWER THIRD BANNER)                        */}
          {/* ============================================================== */}
          {activeTab === 'ashton' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Interactive Visual Preview Screen (7 cols) */}
              <div className="lg:col-span-7 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Tv size={15} className="text-purple-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                      Ashton Band Playout Simulation
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ashtonFireRemaining > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 border border-amber-500/50 text-amber-300 flex items-center gap-1 animate-pulse">
                        <Flame size={10} className="fill-current text-amber-400" />
                        <span>FIRED ({ashtonFireRemaining}s)</span>
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                        ashtonEnabled
                          ? 'bg-emerald-950 border border-emerald-600 text-emerald-400'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {ashtonEnabled ? '● ON AIR' : 'OFF AIR'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 border border-purple-700 text-purple-300 uppercase">
                      {ashtonSqueeze ? 'Video Squeezed' : 'Overlay Mode'}
                    </span>
                  </div>
                </div>

                {/* Simulated 16:9 Broadcast Output Display */}
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#232d40] shadow-inner flex flex-col">
                  
                  {/* Program Stream Video Layer */}
                  <div
                    style={{
                      height: (ashtonEnabled && ashtonSqueeze)
                        ? `${((720 - ashtonHeight) / 720) * 100}%`
                        : '100%',
                      width: '100%',
                      transition: 'height 1.8s cubic-bezier(0.65, 0, 0.35, 1)'
                    }}
                    className="relative bg-slate-900 flex items-center justify-center overflow-hidden border-b border-indigo-500/40"
                  >
                    <div className="flex flex-col items-center text-center p-4">
                      <div className="w-11 h-11 rounded-full bg-purple-600/30 border border-purple-400/50 flex items-center justify-center text-purple-300 mb-2">
                        <Tv size={22} />
                      </div>
                      <span className="text-xs font-black uppercase text-white tracking-widest">
                        {channel?.name || 'LIVE STREAM PROGRAM'}
                      </span>
                      <span className="text-[9px] font-mono text-purple-400 mt-1">
                        {ashtonEnabled && ashtonSqueeze
                          ? `SQUEEZED TO 1280x${720 - ashtonHeight} (CONTENT NEVER COVERED)`
                          : 'FULL SCREEN: 1280x720'}
                      </span>
                    </div>

                    {ashtonEnabled && ashtonSqueeze && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 border border-purple-400/60 text-[8px] font-extrabold text-purple-300 uppercase">
                        Squeezed Upward
                      </div>
                    )}
                  </div>

                  {/* Ashton Band Banner Layer (Positioned at bottom with smooth appear / disappear animation) */}
                  <div
                    style={
                      ashtonSqueeze
                        ? {
                            height: `${(ashtonHeight / 720) * 100}%`,
                            width: '100%',
                            transform: ashtonEnabled ? 'translateY(0)' : 'translateY(100%)',
                            opacity: ashtonEnabled ? 1 : 0,
                            transition: 'transform 1.8s cubic-bezier(0.65, 0, 0.35, 1), opacity 1.8s cubic-bezier(0.65, 0, 0.35, 1)',
                            pointerEvents: ashtonEnabled ? 'auto' : 'none'
                          }
                        : {
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: `${(ashtonHeight / 720) * 100}%`,
                            transform: ashtonEnabled ? 'translateY(0)' : 'translateY(100%)',
                            opacity: ashtonEnabled ? 1 : 0,
                            transition: 'transform 1.8s cubic-bezier(0.65, 0, 0.35, 1), opacity 1.8s cubic-bezier(0.65, 0, 0.35, 1)',
                            pointerEvents: ashtonEnabled ? 'auto' : 'none'
                          }
                    }
                    className="shadow-2xl z-30 overflow-hidden flex items-center justify-center shrink-0"
                  >
                    {ashtonAssetPath ? (
                      <img
                        src={`http://localhost:5000/${ashtonAssetPath}`}
                        alt="Ashton Band Graphic"
                        className="w-full h-full object-fill pointer-events-none"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-[#0b0f19] via-[#111827] to-[#1e293b] border-t-2 border-amber-400 px-5 py-2.5 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="px-2.5 py-1 rounded bg-red-600 text-white text-[10px] font-black tracking-wider flex items-center gap-1.5 uppercase shadow">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            <span>SPECIAL</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-white uppercase tracking-wide">
                              LIVE TRANSMISSION &amp; BROADCAST STREAM
                            </span>
                            <span className="text-[9px] font-semibold text-slate-300 uppercase">
                              CONTINUOUS HD PLAYOUT WITH ASHTON GRAPHICS
                            </span>
                          </div>
                        </div>

                        <div className="hidden sm:flex flex-col items-end text-right">
                          <span className="text-[10px] font-bold text-amber-400 uppercase">
                            BREAKING BULLETIN
                          </span>
                          <span className="text-[8px] text-slate-400 font-mono">
                            PLAYOUT SYSTEM v2.0
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#101520] border border-[#1e2738] flex items-start gap-2.5 text-slate-400 text-xs">
                  <Info size={16} className="text-purple-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[11px]">
                    Choose between <span className="text-white font-bold">Squeeze Mode</span> (which automatically pushes and scales the live video up so nothing is covered) or <span className="text-white font-bold">Overlay Mode</span> (which places the Ashton band directly over the lower portion of the full video).
                  </p>
                </div>
              </div>

              {/* Right Column: Controls & Mode Selector (5 cols) */}
              <div className="lg:col-span-5 space-y-5 bg-[#0f131c] border border-[#1e2738] p-5 rounded-2xl">
                
                {/* Apply to Air Switch & Quick Fire */}
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Live Broadcast Status
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveAshton(!ashtonEnabled)}
                      disabled={isSubmitting}
                      className={`flex-1 py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-lg ${
                        ashtonEnabled
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                      }`}
                    >
                      {ashtonEnabled ? (
                        <>
                          <Square size={14} className="fill-current" />
                          <span>REMOVE ASHTON</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} className="fill-current" />
                          <span>APPLY ASHTON</span>
                        </>
                      )}
                    </button>

                    {/* 🔥 Quick Fire Button */}
                    <button
                      onClick={handleFireAshton}
                      disabled={isSubmitting}
                      className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-lg ${
                        ashtonFireRemaining > 0
                          ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-amber-900/50 animate-pulse'
                          : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-900/40'
                      }`}
                      title="Instantly display Ashton Band for duration and automatically close"
                    >
                      <Flame size={14} className={ashtonFireRemaining > 0 ? 'text-yellow-200 fill-current' : 'text-amber-200'} />
                      <span>
                        {ashtonFireRemaining > 0
                          ? `FIRED: ${ashtonFireRemaining}s (STOP)`
                          : `FIRE (${ashtonFireDuration}s)`}
                      </span>
                    </button>
                  </div>

                  {/* Duration Selector for Quick Fire */}
                  <div className="flex items-center justify-between px-1 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                      <Timer size={11} className="text-purple-400" />
                      <span>Fire Duration:</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[30, 60, 90, 120].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setAshtonFireDuration(sec)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                            ashtonFireDuration === sec
                              ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                              : 'bg-[#182030] text-slate-400 hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Squeeze vs Overlay Mode Selector */}
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                    Video Display Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Squeeze Option */}
                    <button
                      onClick={() => {
                        setAshtonSqueeze(true);
                        if (ashtonEnabled) handleSaveAshton(true, true);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                        ashtonSqueeze
                          ? 'bg-purple-950/40 border-purple-500 text-white shadow-md shadow-purple-950/50'
                          : 'bg-[#141a26] border-[#222c3f] text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-extrabold text-xs text-purple-300 uppercase">
                          Squeeze Video
                        </span>
                        <Minimize2 size={14} className="text-purple-400" />
                      </div>
                      <span className="text-[10px] text-slate-400 leading-tight">
                        Shrinks &amp; pushes video upward so no video content is hidden.
                      </span>
                    </button>

                    {/* Overlay Option */}
                    <button
                      onClick={() => {
                        setAshtonSqueeze(false);
                        if (ashtonEnabled) handleSaveAshton(true, false);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                        !ashtonSqueeze
                          ? 'bg-purple-950/40 border-purple-500 text-white shadow-md shadow-purple-950/50'
                          : 'bg-[#141a26] border-[#222c3f] text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-extrabold text-xs text-purple-300 uppercase">
                          Overlay On Video
                        </span>
                        <Layers size={14} className="text-purple-400" />
                      </div>
                      <span className="text-[10px] text-slate-400 leading-tight">
                        Normal full-screen video with the band overlaid at bottom.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Band Height Slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Band Height (px)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-[9px] font-bold text-purple-300 bg-purple-950/70 border border-purple-800/60 px-2 py-0.5 rounded-full">
                        <Sparkles size={10} />
                        <span>Auto: {ashtonHeight}px</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-purple-400">
                        {ashtonHeight}px
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="120"
                    max="220"
                    value={ashtonHeight}
                    onChange={(e) => setAshtonHeight(Number(e.target.value))}
                    className="w-full accent-purple-500 bg-[#141a26] h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                    <span>120px (Compact)</span>
                    <span>160px (Standard)</span>
                    <span>220px (Prominent)</span>
                  </div>
                </div>

                {/* Upload Custom Ashton Banner */}
                <div className="pt-2 border-t border-[#1e2738]">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                    Custom Ashton Band Graphic (PNG)
                  </span>

                  <input
                    ref={ashtonInputRef}
                    type="file"
                    accept="image/png,image/webp"
                    onChange={handleUploadAshton}
                    className="hidden"
                  />

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => ashtonInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#171e2c] hover:bg-[#20293b] border border-[#27344c] text-xs font-bold text-slate-200 hover:text-white flex items-center justify-center space-x-2 transition"
                    >
                      <Upload size={14} className="text-purple-400" />
                      <span>Upload Custom Banner</span>
                    </button>

                    {ashtonAssetPath && (
                      <span className="text-[10px] text-emerald-400 font-bold px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/60">
                        Custom Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Update Settings Button */}
                <button
                  onClick={() => handleSaveAshton(ashtonEnabled, ashtonSqueeze)}
                  disabled={isSubmitting}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs uppercase tracking-wide text-white transition flex items-center justify-center space-x-2"
                >
                  <RefreshCw size={13} className={isSubmitting ? 'animate-spin' : ''} />
                  <span>Update Ashton Settings</span>
                </button>

                {/* Scheduled Ashton Band Events Section */}
                <div className="border-t border-[#1e2738] pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={12} className="text-purple-400" />
                      <span>Scheduled Ashton Events ({ashtonSchedules.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowScheduleForm(!showScheduleForm)}
                      className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-[10px] font-bold flex items-center gap-1 transition"
                    >
                      <Plus size={11} />
                      <span>{showScheduleForm ? 'Close Form' : 'Schedule Ashton'}</span>
                    </button>
                  </div>

                  {/* Inline Form to create an Ashton Band Schedule */}
                  {showScheduleForm && (
                    <div className="bg-[#141a26] border border-[#232d40] rounded-xl p-3.5 space-y-2.5 shadow-inner">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wide block">
                        New Scheduled Ashton Band Trigger
                      </span>
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-1">Schedule Name / Title</label>
                        <input
                          type="text"
                          value={schedTitle}
                          onChange={(e) => setSchedTitle(e.target.value)}
                          placeholder="e.g. Breaking News Lower Third"
                          className="w-full bg-[#0a0d14] border border-[#222b3e] focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-1">Air Time</label>
                          <input
                            type="time"
                            step="1"
                            value={schedStartTime}
                            onChange={(e) => setSchedStartTime(e.target.value)}
                            className="w-full bg-[#0a0d14] border border-[#222b3e] focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-purple-300 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-1">Duration (seconds)</label>
                          <input
                            type="number"
                            min="5"
                            max="3600"
                            value={schedDuration}
                            onChange={(e) => setSchedDuration(Number(e.target.value))}
                            className="w-full bg-[#0a0d14] border border-[#222b3e] focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Ashton Mode Selector in Schedule Form */}
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-1">Display Mode</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAshtonSqueeze(true)}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition ${
                              ashtonSqueeze
                                ? 'bg-purple-950/60 border-purple-500 text-purple-200'
                                : 'bg-[#0a0d14] border-[#222b3e] text-slate-400'
                            }`}
                          >
                            Squeeze Video
                          </button>
                          <button
                            type="button"
                            onClick={() => setAshtonSqueeze(false)}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition ${
                              !ashtonSqueeze
                                ? 'bg-purple-950/60 border-purple-500 text-purple-200'
                                : 'bg-[#0a0d14] border-[#222b3e] text-slate-400'
                            }`}
                          >
                            Overlay Only
                          </button>
                        </div>
                      </div>

                      {/* Days of week selector */}
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-1">Days of Week</label>
                        <div className="flex gap-1">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSchedDays((prev) =>
                                  prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
                                );
                              }}
                              className={`flex-1 h-6 rounded text-[9px] font-bold transition ${
                                schedDays.includes(idx)
                                  ? 'bg-purple-600 text-white font-extrabold shadow-sm'
                                  : 'bg-[#0a0d14] text-slate-500 hover:text-white'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCreateOverlaySchedule('ashton')}
                        className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition mt-2 shadow-md"
                      >
                        <Check size={12} strokeWidth={3} />
                        <span>Save Ashton Schedule</span>
                      </button>
                    </div>
                  )}

                  {/* List of Ashton schedules */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {ashtonSchedules.length === 0 ? (
                      <span className="text-[10px] text-slate-500 italic block py-1">
                        No Ashton Band schedules configured. Schedule an event to automatically display Ashton Band at set times.
                      </span>
                    ) : (
                      ashtonSchedules.map((s) => (
                        <div
                          key={s._id}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#141a26] border border-[#1e2738] text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-200 block text-[11px]">{s.title}</span>
                            <span className="text-[10px] font-mono text-purple-400/90">
                              {s.dailyStartTime} ({s.duration}s) • {s.ashtonSqueeze !== false ? 'Squeeze' : 'Overlay'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleSchedule(s)}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${
                                s.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {s.enabled ? 'ACTIVE' : 'OFF'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSchedule(s._id)}
                              className="p-1 rounded text-slate-500 hover:text-red-400 transition"
                              title="Delete schedule"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Modal Footer */}
        <div className="px-6 py-3 border-t border-[#1b2333] flex items-center justify-between bg-[#090c12]">
          <div className="flex items-center space-x-2 text-[10px] text-slate-400">
            <Radio size={12} className="text-blue-500" />
            <span>Zero-Restart ZMQ Runtime DVE Switching Engine</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#141a26] border border-[#222c3f] hover:bg-[#1b2333] text-slate-200 hover:text-white text-xs font-semibold transition"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
