import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Calendar,
  Clock,
  Sparkles,
  Check,
  Tv,
  PanelBottom,
  CreditCard,
  PlusCircle,
  Power,
  Trash2,
  ListOrdered
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import BandPreviewScreen from './BandPreviewScreen.jsx';
import { resolveMediaUrl } from '../../utils/bandGeometry.js';
import { ToggleSwitch } from '../form/FormPrimitives.jsx';

const DAYS_MAP = [
  { day: 0, label: 'Sun', full: 'Sunday' },
  { day: 1, label: 'Mon', full: 'Monday' },
  { day: 2, label: 'Tue', full: 'Tuesday' },
  { day: 3, label: 'Wed', full: 'Wednesday' },
  { day: 4, label: 'Thu', full: 'Thursday' },
  { day: 5, label: 'Fri', full: 'Friday' },
  { day: 6, label: 'Sat', full: 'Saturday' }
];

export default function BandForm({
  type = 'lband', // 'lband' | 'ashton'
  bands = [],
  initialData = null,
  channel = null,
  channels = [],
  currentUser = null,
  onSubmit,
  onCreateBandShortcut,
  onCancel,
  isSubmitting = false
}) {
  const isEdit = Boolean(initialData?._id);
  const isLBand = type === 'lband';
  const bandLabel = isLBand ? 'L-Band' : 'Ashton Band';

  const initialBandIds = useMemo(() => {
    if (Array.isArray(initialData?.bandPresets) && initialData.bandPresets.length > 0) {
      return initialData.bandPresets
        .map((b) => (typeof b === 'object' && b?._id ? b._id : b))
        .filter(Boolean);
    }
    if (initialData?.bandPreset) {
      const id = typeof initialData.bandPreset === 'object' ? initialData.bandPreset._id : initialData.bandPreset;
      return id ? [id] : [];
    }
    if (!initialData?.imagePath && bands[0]?._id) {
      return [bands[0]._id];
    }
    return [];
  }, [initialData, bands]);

  const [channelId, setChannelId] = useState(
    initialData?.channel?._id || initialData?.channel || channel?._id || channels[0]?._id || ''
  );
  const [selectedBandIds, setSelectedBandIds] = useState(initialBandIds);
  const [pickerBandId, setPickerBandId] = useState(bands[0]?._id || '');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [title, setTitle] = useState(initialData?.title || '');
  const [dailyStartTime, setDailyStartTime] = useState(
    initialData?.dailyStartTime ? initialData.dailyStartTime.substring(0, 8) : '14:00:00'
  );
  const [dailyEndTime, setDailyEndTime] = useState(
    initialData?.dailyEndTime ? initialData.dailyEndTime.substring(0, 8) : '15:00:00'
  );
  const [startDate, setStartDate] = useState(
    initialData?.startDate ? new Date(initialData.startDate).toISOString().substring(0, 10) : ''
  );
  const [endDate, setEndDate] = useState(
    initialData?.endDate ? new Date(initialData.endDate).toISOString().substring(0, 10) : ''
  );
  const [daysOfWeek, setDaysOfWeek] = useState(
    Array.isArray(initialData?.daysOfWeek) && initialData.daysOfWeek.length > 0
      ? initialData.daysOfWeek
      : [0, 1, 2, 3, 4, 5, 6]
  );
  const [gapSeconds, setGapSeconds] = useState(
    initialData?.gapSeconds !== undefined && initialData?.gapSeconds !== null
      ? Number(initialData.gapSeconds)
      : (initialData?.gapMinutes !== undefined ? Math.round(Number(initialData.gapMinutes) * 60) : 60)
  );
  const [enabled, setEnabled] = useState(
    initialData?.enabled !== undefined ? initialData.enabled : true
  );

  // Sync default picker and initial band selection if bands finish loading after mount
  useEffect(() => {
    if (!pickerBandId && bands.length > 0) {
      setPickerBandId(bands[0]._id);
    }
    if (selectedBandIds.length === 0 && bands.length > 0 && !initialData?.imagePath && !isEdit) {
      setSelectedBandIds([bands[0]._id]);
    }
  }, [bands, pickerBandId, selectedBandIds.length, initialData, isEdit]);

  const initialPresetObjectsMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(initialData?.bandPresets)) {
      initialData.bandPresets.forEach((b) => {
        if (b && typeof b === 'object' && b._id) map.set(String(b._id), b);
      });
    }
    if (initialData?.bandPreset && typeof initialData.bandPreset === 'object' && initialData.bandPreset._id) {
      map.set(String(initialData.bandPreset._id), initialData.bandPreset);
    }
    return map;
  }, [initialData]);

  const selectedBands = useMemo(() => {
    const list = selectedBandIds
      .map((id) => bands.find((b) => String(b._id) === String(id)) || initialPresetObjectsMap.get(String(id)))
      .filter(Boolean);

    if (list.length === 0 && initialData?.imagePath) {
      return [
        {
          title: initialData.title || bandLabel,
          imagePath: initialData.imagePath,
          duration: initialData.duration || 10,
          windowX: initialData.windowX ?? 300,
          windowY: initialData.windowY ?? 20,
          windowWidth: initialData.windowWidth ?? 960,
          windowHeight: initialData.windowHeight ?? 540,
          ashtonSqueeze: initialData.ashtonSqueeze !== false,
          ashtonHeight: initialData.ashtonHeight || 160
        }
      ];
    }
    return list;
  }, [bands, selectedBandIds, initialPresetObjectsMap, initialData, bandLabel]);

  const activePreviewBand = selectedBands[previewIndex] || selectedBands[0] || null;

  const handleAddBandToSequence = (bandIdToAdd = pickerBandId) => {
    if (!bandIdToAdd) {
      toast.error(`Please select a ${bandLabel} first`);
      return;
    }
    setSelectedBandIds((prev) => {
      const next = [...prev, bandIdToAdd];
      setPreviewIndex(next.length - 1);
      return next;
    });
  };

  const handleMoveBand = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= selectedBandIds.length) return;
    setSelectedBandIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setPreviewIndex(target);
  };

  const handleRemoveBand = (index) => {
    setSelectedBandIds((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      setPreviewIndex((curr) => Math.max(0, Math.min(curr, next.length - 1)));
      return next;
    });
  };

  const toggleDay = (dayNum) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort()
    );
  };

  const isAllDays = daysOfWeek.length === 7;
  const toggleAllDays = () => {
    setDaysOfWeek(isAllDays ? [] : [0, 1, 2, 3, 4, 5, 6]);
  };

  const calculationSummary = useMemo(() => {
    if (!dailyStartTime || !dailyEndTime) return null;
    const [sh, sm] = dailyStartTime.split(':').map(Number);
    const [eh, em] = dailyEndTime.split(':').map(Number);
    const startMins = (sh || 0) * 60 + (sm || 0);
    const endMins = (eh || 0) * 60 + (em || 0);
    let totalWindowMins = endMins >= startMins ? endMins - startMins : 1440 - startMins + endMins;
    if (totalWindowMins === 0) totalWindowMins = 1440;

    const totalCycleSec =
      selectedBands.reduce((sum, b) => sum + (Number(b.duration) || 10), 0) ||
      Number(initialData?.duration) ||
      10;
    const count = Math.max(1, selectedBands.length);
    const avgDurSec = Math.round(totalCycleSec / count);
    const gap = Math.max(0, Number(gapSeconds) || 0);
    const stepPeriodSec = gap > 0 ? avgDurSec + gap : avgDurSec + 3;
    const totalWindowSec = totalWindowMins * 60;
    const estimatedPlays = Math.max(1, Math.floor(totalWindowSec / stepPeriodSec));

    return {
      totalWindowMins,
      gap,
      count: selectedBands.length,
      avgDurSec,
      totalCycleSec,
      estimatedPlays
    };
  }, [dailyStartTime, dailyEndTime, gapSeconds, selectedBands, initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a schedule title');
      return;
    }

    if (selectedBandIds.length === 0 && !selectedBands[0]?.imagePath) {
      toast.error(`Please add at least one ${bandLabel} to the sequence`);
      return;
    }

    if (daysOfWeek.length === 0) {
      toast.error('Please select at least one weekday');
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      toast.error('End date cannot be earlier than start date');
      return;
    }

    const scheduleOption =
      startDate || endDate
        ? 'datewise'
        : daysOfWeek.length < 7
          ? 'weekly'
          : '24/7';

    const firstBand = selectedBands[0] || null;
    const payload = {
      title: title.trim(),
      type,
      bandPresetIds: selectedBandIds,
      bandPresetId: selectedBandIds[0] || null,
      repeatForever: true,
      scheduleOption,
      dailyStartTime: dailyStartTime.length === 5 ? `${dailyStartTime}:00` : dailyStartTime,
      dailyEndTime: dailyEndTime ? (dailyEndTime.length === 5 ? `${dailyEndTime}:00` : dailyEndTime) : '',
      gapSeconds: Math.max(0, Number(gapSeconds) || 0),
      gapMinutes: Number((Math.max(0, Number(gapSeconds) || 0) / 60).toFixed(2)),
      daysOfWeek,
      startDate: startDate || '',
      endDate: endDate || '',
      enabled
    };

    if (firstBand) {
      payload.duration = selectedBands.reduce((sum, b) => sum + (Number(b.duration) || 10), 0) || 10;
      payload.imagePath = firstBand.imagePath || '';
      if (isLBand) {
        payload.windowX = firstBand.windowX ?? 300;
        payload.windowY = firstBand.windowY ?? 20;
        payload.windowWidth = firstBand.windowWidth ?? 960;
        payload.windowHeight = firstBand.windowHeight ?? 540;
      } else {
        payload.ashtonSqueeze = firstBand.ashtonSqueeze !== false;
        payload.ashtonHeight = firstBand.ashtonHeight || 160;
      }
    }

    onSubmit({
      channelId,
      scheduleId: initialData?._id,
      payload
    });
  };

  const canSwitchChannel =
    (currentUser?.role === 'super_admin' || currentUser?.role === 'admin') &&
    channels.length > 1;

  const activeChannelName = channels.find((c) => c._id === channelId)?.name || channel?.name || 'Live Playout';

  return (
    <div className="space-y-3.5 select-none font-mono">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to {bandLabel} Schedules</span>
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              {isLBand ? <PanelBottom size={15} /> : <CreditCard size={15} />}
            </div>
            <h1 className="text-base sm:text-lg 2xl:text-xl text-white tracking-tight">
              {isEdit ? `Update ${bandLabel} Schedule` : `Add ${bandLabel} Schedule`}
            </h1>
          </div>
          <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
            Add one or more {bandLabel}s in playback order and configure start/end time, loop behavior, dates, and weekdays
          </p>
        </div>

        {canSwitchChannel && !isEdit && (
          <div className="flex items-center gap-1.5 bg-[#10141e] border border-[#1e2638] px-2.5 py-1.5 rounded-lg text-xs">
            <Tv size={14} className="text-[#00bcd4]" />
            <span className="text-slate-400">Channel:</span>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="bg-transparent text-cyan-300 font-semibold focus:outline-none cursor-pointer"
            >
              {channels.map((ch) => (
                <option key={ch._id} value={ch._id} className="bg-[#0b0e18] text-slate-200">
                  {ch.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Live Preview of active Band in sequence */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-4">
          <BandPreviewScreen
            type={type}
            previewUrl={resolveMediaUrl(activePreviewBand?.imagePath)}
            channelName={activeChannelName}
            windowX={activePreviewBand?.windowX ?? 300}
            windowY={activePreviewBand?.windowY ?? 20}
            windowWidth={activePreviewBand?.windowWidth ?? 960}
            windowHeight={activePreviewBand?.windowHeight ?? 540}
            ashtonSqueeze={activePreviewBand?.ashtonSqueeze !== false}
            ashtonHeight={activePreviewBand?.ashtonHeight || 160}
            duration={activePreviewBand?.duration || 10}
            emptyHint={`Add a ${bandLabel} on the right and click any step to preview broadcast placement`}
          />

          {selectedBands.length > 0 && (
            <div className="px-3 py-2 bg-[#0d121d] border border-[#1d273b] rounded-lg text-[11px] text-slate-300 flex items-center justify-between">
              <span className="truncate">
                Previewing <strong className="text-cyan-300">#{Math.min(previewIndex, selectedBands.length - 1) + 1}</strong> of {selectedBands.length}:{' '}
                <strong className="text-white">{activePreviewBand?.title}</strong>
              </span>
              <span className="text-emerald-400 font-mono font-bold shrink-0 ml-2">
                {activePreviewBand?.duration || 10}s
              </span>
            </div>
          )}

          {calculationSummary && (
            <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-xl font-mono text-xs text-cyan-300 flex items-start gap-2.5">
              <Sparkles size={16} className="text-cyan-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold block text-white text-[11px] mb-0.5">Automated Playout Plan</span>
                <span className="text-[11px] text-cyan-200/90">
                  Between <strong className="text-white">{dailyStartTime}</strong> and <strong className="text-white">{dailyEndTime || 'end'}</strong>,{' '}
                  {calculationSummary.count > 1 ? (
                    <>
                      each trigger plays the next {bandLabel} in order (#1 → #2 → ... across{' '}
                      <strong className="text-white">{calculationSummary.count}</strong> bands)
                    </>
                  ) : (
                    <>selected {bandLabel} airs</>
                  )}{' '}
                  for <strong className="text-emerald-300">~{calculationSummary.avgDurSec}s</strong>{' '}
                  {calculationSummary.gap > 0
                    ? `with ${calculationSummary.gap}s gap between plays (~${calculationSummary.estimatedPlays} plays)`
                    : `continuously back-to-back (~${calculationSummary.estimatedPlays} plays)`}{' '}
                  repeating in order until End Time.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Schedule Form */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 text-xs"
          >
            {/* Select & Order Multiple L-Bands / Ashton Bands */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                  <ListOrdered size={14} className="text-cyan-400" />
                  <span>{bandLabel} Sequence Queue (Order Matters) <span className="text-cyan-400">*</span></span>
                </label>
                {onCreateBandShortcut && (
                  <button
                    type="button"
                    onClick={onCreateBandShortcut}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <PlusCircle size={12} />
                    <span>+ Create {bandLabel}</span>
                  </button>
                )}
              </div>

              {bands.length === 0 && selectedBands.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#090d16] border border-amber-500/30 text-center space-y-2">
                  <p className="text-xs text-amber-300 font-semibold">
                    No {bandLabel} created yet for this channel
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Create a {bandLabel} with its artwork, duration, and video window first, then build your sequence here.
                  </p>
                  {onCreateBandShortcut && (
                    <button
                      type="button"
                      onClick={onCreateBandShortcut}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-bold text-xs transition cursor-pointer"
                    >
                      <PlusCircle size={13} />
                      <span>Create {bandLabel}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Add Band Picker Row */}
                  {bands.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={pickerBandId}
                        onChange={(e) => setPickerBandId(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-[#090d16] border border-[#1c2538] focus:border-[#00bcd4] text-slate-100 text-xs focus:outline-none cursor-pointer"
                      >
                        {bands.map((b) => (
                          <option key={b._id} value={b._id} className="bg-[#0b0e18] text-slate-200">
                            {b.title} ({b.duration || 10}s •{' '}
                            {isLBand
                              ? `${b.windowWidth ?? 960}x${b.windowHeight ?? 540} @ (${b.windowX ?? 300},${b.windowY ?? 20})`
                              : `${b.ashtonSqueeze !== false ? 'Squeeze' : 'Overlay'} H:${b.ashtonHeight || 160}px`}
                            )
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleAddBandToSequence(pickerBandId)}
                        className="px-3 py-2 rounded-lg bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-sm"
                      >
                        <PlusCircle size={13} />
                        <span>Add</span>
                      </button>
                    </div>
                  )}

                  {/* Ordered Sequence List */}
                  {selectedBands.length > 0 ? (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                      {selectedBands.map((band, idx) => {
                        const isActivePreview = idx === Math.min(previewIndex, selectedBands.length - 1);
                        return (
                          <div
                            key={`${band._id || band.title}-${idx}`}
                            onClick={() => setPreviewIndex(idx)}
                            className={`flex items-center gap-2.5 p-2 rounded-lg border transition cursor-pointer ${
                              isActivePreview
                                ? 'bg-cyan-950/30 border-cyan-500/70'
                                : 'bg-[#090d16] border-[#1a2337] hover:border-slate-600'
                            }`}
                          >
                            <span className="w-6 h-6 rounded-md bg-[#00bcd4]/15 border border-[#00bcd4]/40 text-cyan-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>

                            {band.imagePath && (
                              <img
                                src={resolveMediaUrl(band.imagePath)}
                                alt={band.title}
                                className="w-12 h-7 object-contain bg-black/50 rounded border border-[#24324d] shrink-0"
                              />
                            )}

                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-white block truncate">
                                {band.title}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block truncate">
                                <strong className="text-emerald-400">{band.duration || 10}s</strong> •{' '}
                                {isLBand
                                  ? `${band.windowWidth ?? 960}x${band.windowHeight ?? 540} (${band.windowX ?? 300},${band.windowY ?? 20})`
                                  : `${band.ashtonSqueeze !== false ? 'Squeeze' : 'Overlay'} H:${band.ashtonHeight || 160}px`}
                              </span>
                            </div>

                            {selectedBandIds.length > 0 && (
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveBand(idx, -1)}
                                  title="Move Up"
                                  className="p-1 rounded bg-[#111827] border border-[#1f2a40] text-slate-300 hover:text-cyan-300 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === selectedBandIds.length - 1}
                                  onClick={() => handleMoveBand(idx, 1)}
                                  title="Move Down"
                                  className="p-1 rounded bg-[#111827] border border-[#1f2a40] text-slate-300 hover:text-cyan-300 disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBand(idx)}
                                  title="Remove from Sequence"
                                  className="p-1 rounded bg-[#111827] border border-[#1f2a40] text-slate-400 hover:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-[#090d16] border border-dashed border-[#24324d] text-center text-[11px] text-slate-400">
                      Select a {bandLabel} above and click <strong className="text-cyan-300">+ Add</strong> to build your playback order.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Schedule Title */}
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1">
                Schedule Title <span className="text-cyan-400">*</span>
              </label>
              <div className="flex items-center gap-2 px-3 py-1.5 2xl:py-2 rounded-lg bg-[#090d16] border border-[#1c2538] focus-within:border-[#00bcd4] transition">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g. Evening Prime ${bandLabel} Schedule`}
                  className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                />
              </div>
            </div>

            {/* Start Time & End Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-slate-300 text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-cyan-400" />
                  <span>Start Time <span className="text-cyan-400">*</span></span>
                </label>
                <div className="flex items-center gap-2 px-3 py-1.5 2xl:py-2 rounded-lg bg-[#090d16] border border-[#1c2538] focus-within:border-[#00bcd4] transition">
                  <input
                    type="time"
                    step="1"
                    required
                    value={dailyStartTime}
                    onChange={(e) => setDailyStartTime(e.target.value)}
                    className="w-full bg-transparent text-slate-100 focus:outline-none text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-cyan-400" />
                  <span>End Time <span className="text-cyan-400">*</span></span>
                </label>
                <div className="flex items-center gap-2 px-3 py-1.5 2xl:py-2 rounded-lg bg-[#090d16] border border-[#1c2538] focus-within:border-[#00bcd4] transition">
                  <input
                    type="time"
                    step="1"
                    required
                    value={dailyEndTime}
                    onChange={(e) => setDailyEndTime(e.target.value)}
                    className="w-full bg-transparent text-slate-100 focus:outline-none text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Start Date & End Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-slate-300 text-xs font-semibold mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-amber-400" />
                    <span>Start Date</span>
                  </span>
                  {startDate && (
                    <button
                      type="button"
                      onClick={() => setStartDate('')}
                      className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#090d16] border border-[#1c2538] focus:border-[#00bcd4] rounded-lg px-3 py-1.5 2xl:py-2 text-slate-100 text-xs font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-amber-400" />
                    <span>End Date</span>
                  </span>
                  {endDate && (
                    <button
                      type="button"
                      onClick={() => setEndDate('')}
                      className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#090d16] border border-[#1c2538] focus:border-[#00bcd4] rounded-lg px-3 py-1.5 2xl:py-2 text-slate-100 text-xs font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Weekdays */}
            <div className="p-3 bg-[#090d16] border border-[#1a2337] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">Weekdays</span>
                <button
                  type="button"
                  onClick={toggleAllDays}
                  className="text-[10.5px] font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                >
                  {isAllDays ? 'Unselect All' : 'Select All Days'}
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS_MAP.map((d) => {
                  const isSelected = daysOfWeek.includes(d.day);
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => toggleDay(d.day)}
                      title={d.full}
                      className={`py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#00bcd4] text-black border-[#00bcd4] shadow-sm'
                          : 'bg-[#0e1422] text-slate-400 border-[#1a2337] hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gap Between Each Band Play (seconds) */}
            <div>
              <label className="text-slate-300 text-xs font-semibold mb-1 flex items-center gap-1.5">
                <Clock size={13} className="text-amber-400" />
                <span>Gap Between Each Band Play (seconds)</span>
              </label>
              <div className="flex items-center gap-2 px-3 py-1.5 2xl:py-2 rounded-lg bg-[#090d16] border border-[#1c2538] focus-within:border-[#00bcd4] transition">
                <input
                  type="number"
                  min="0"
                  max="86400"
                  value={gapSeconds}
                  onChange={(e) => setGapSeconds(Number(e.target.value))}
                  className="w-full bg-transparent text-slate-100 focus:outline-none text-xs font-mono"
                  placeholder="e.g. 60 (0 = continuous back-to-back)"
                />
                <span className="text-slate-500 font-bold">sec</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Wait time in seconds after each band closes before the next band plays (#1 → wait → #2 → ... looping infinitely until End Time). Use 0 for continuous play.
              </span>
            </div>

            {/* Enable Schedule Switch */}
            <label className="p-3.5 bg-[#090d16] border border-[#1a2337] rounded-xl flex items-center justify-between gap-4 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Power size={16} className={enabled ? 'text-emerald-400' : 'text-slate-500'} />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Enable Schedule</span>
                  <span className="text-[10px] text-slate-400">
                    {enabled
                      ? `Active — scheduler will trigger ${bandLabel} automatically on air`
                      : 'Paused — schedule is saved as disabled until enabled'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className={`text-[11px] font-bold ${enabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
                <ToggleSwitch
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  ariaLabel="Enable Schedule"
                />
              </div>
            </label>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1a2234]">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-1.5 2xl:py-2 rounded-lg border border-[#1e2638] text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#161e2e] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (selectedBandIds.length === 0 && !selectedBands[0]?.imagePath)}
                className="px-4 py-1.5 2xl:py-2 rounded-lg text-xs font-bold bg-[#00bcd4] hover:bg-[#06b6d4] text-black shadow-md shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>{isEdit ? 'Update Schedule' : 'Save Schedule'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
