import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  Calendar,
  Clock,
  Timer,
  Layers,
  Sparkles,
  Check,
  X,
  Play,
  Eye,
  Tv,
  PanelBottom,
  CreditCard,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const DAYS_MAP = [
  { day: 1, label: 'Mon', full: 'Monday' },
  { day: 2, label: 'Tue', full: 'Tuesday' },
  { day: 3, label: 'Wed', full: 'Wednesday' },
  { day: 4, label: 'Thu', full: 'Thursday' },
  { day: 5, label: 'Fri', full: 'Friday' },
  { day: 6, label: 'Sat', full: 'Saturday' },
  { day: 0, label: 'Sun', full: 'Sunday' }
];

export default function BandForm({
  type = 'lband', // 'lband' | 'ashton'
  initialData = null,
  channel = null,
  channels = [],
  currentUser = null,
  onSubmit,
  onCancel,
  isSubmitting = false
}) {
  const isEdit = Boolean(initialData?._id);
  const isLBand = type === 'lband';

  const [channelId, setChannelId] = useState(
    initialData?.channel?._id || initialData?.channel || channel?._id || channels[0]?._id || ''
  );
  const [title, setTitle] = useState(initialData?.title || '');
  const [scheduleOption, setScheduleOption] = useState(
    initialData?.scheduleOption || '24/7'
  );
  const [dailyStartTime, setDailyStartTime] = useState(
    initialData?.dailyStartTime ? initialData.dailyStartTime.substring(0, 5) : '14:00'
  );
  const [dailyEndTime, setDailyEndTime] = useState(
    initialData?.dailyEndTime ? initialData.dailyEndTime.substring(0, 5) : '15:00'
  );
  const [duration, setDuration] = useState(initialData?.duration || 5); // 5 seconds display
  const [gapMinutes, setGapMinutes] = useState(
    initialData?.gapMinutes !== undefined ? initialData.gapMinutes : 20 // 20 minutes gap
  );
  const [daysOfWeek, setDaysOfWeek] = useState(
    Array.isArray(initialData?.daysOfWeek) && initialData.daysOfWeek.length > 0
      ? initialData.daysOfWeek
      : [0, 1, 2, 3, 4, 5, 6]
  );
  const [startDate, setStartDate] = useState(
    initialData?.startDate ? new Date(initialData.startDate).toISOString().substring(0, 10) : ''
  );
  const [endDate, setEndDate] = useState(
    initialData?.endDate ? new Date(initialData.endDate).toISOString().substring(0, 10) : ''
  );
  const [enabled, setEnabled] = useState(
    initialData?.enabled !== undefined ? initialData.enabled : true
  );

  // Ashton specific
  const [ashtonSqueeze, setAshtonSqueeze] = useState(
    initialData?.ashtonSqueeze !== undefined ? initialData.ashtonSqueeze : true
  );
  const [ashtonHeight, setAshtonHeight] = useState(initialData?.ashtonHeight || 160);

  // L-Band specific cutout
  const [windowX, setWindowX] = useState(initialData?.windowX || 300);
  const [windowY, setWindowY] = useState(initialData?.windowY || 20);
  const [windowWidth, setWindowWidth] = useState(initialData?.windowWidth || 960);
  const [windowHeight, setWindowHeight] = useState(initialData?.windowHeight || 540);

  // File upload state & object URL for live real-time preview
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSimulatingAir, setIsSimulatingAir] = useState(true);
  const fileInputRef = useRef(null);

  // Initialize preview image from initialData
  useEffect(() => {
    if (initialData?.imagePath) {
      const cleanPath = initialData.imagePath.startsWith('/')
        ? initialData.imagePath
        : `/${initialData.imagePath}`;
      setPreviewUrl(cleanPath);
    }
  }, [initialData]);

  // Clean up created object URL on unmount or file change
  useEffect(() => {
    if (!imageFile) return;
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setImageFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleDay = (dayNum) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort()
    );
  };

  // Calculate live playout summary details (how many times it airs in the window)
  const calculationSummary = useMemo(() => {
    if (!dailyStartTime || !dailyEndTime) return null;
    const [sh, sm] = dailyStartTime.split(':').map(Number);
    const [eh, em] = dailyEndTime.split(':').map(Number);
    const startMins = (sh || 0) * 60 + (sm || 0);
    const endMins = (eh || 0) * 60 + (em || 0);
    let totalWindowMins = endMins >= startMins ? endMins - startMins : 1440 - startMins + endMins;
    if (totalWindowMins === 0) totalWindowMins = 1440; // 24 hours

    const gap = Number(gapMinutes) || 0;
    let occurrences = 1;
    if (gap > 0 && totalWindowMins > 0) {
      occurrences = Math.floor(totalWindowMins / gap) + (totalWindowMins % gap >= 0 ? 0 : 0);
      if (occurrences < 1) occurrences = 1;
    }

    return {
      totalWindowMins,
      occurrences: gap > 0 ? occurrences : 1,
      gap
    };
  }, [dailyStartTime, dailyEndTime, gapMinutes]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a schedule title');
      return;
    }

    if (!isEdit && !imageFile && !previewUrl) {
      toast.error(`Please upload an image for the ${isLBand ? 'L-Band' : 'Ashton Band'}`);
      return;
    }

    if (scheduleOption === 'weekly' && daysOfWeek.length === 0) {
      toast.error('Please select at least one day of the week');
      return;
    }

    if (scheduleOption === 'datewise' && (!startDate || !endDate)) {
      toast.error('Please select both start date and end date');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('type', type);
    formData.append('scheduleOption', scheduleOption);
    formData.append('dailyStartTime', dailyStartTime.length === 5 ? `${dailyStartTime}:00` : dailyStartTime);
    formData.append('dailyEndTime', dailyEndTime.length === 5 ? `${dailyEndTime}:00` : dailyEndTime);
    formData.append('duration', Number(duration) || 5);
    formData.append('gapMinutes', Number(gapMinutes) || 0);
    formData.append('enabled', enabled);
    formData.append('daysOfWeek', JSON.stringify(daysOfWeek));

    if (startDate) formData.append('startDate', startDate);
    if (endDate) formData.append('endDate', endDate);

    if (type === 'ashton') {
      formData.append('ashtonSqueeze', ashtonSqueeze);
      formData.append('ashtonHeight', Number(ashtonHeight) || 160);
    } else {
      formData.append('windowX', Number(windowX) || 300);
      formData.append('windowY', Number(windowY) || 20);
      formData.append('windowWidth', Number(windowWidth) || 960);
      formData.append('windowHeight', Number(windowHeight) || 540);
    }

    if (imageFile) {
      formData.append('image', imageFile);
    }

    onSubmit({
      channelId,
      scheduleId: initialData?._id,
      formData
    });
  };

  // Convert 1280x720 coordinates to percentages for L-Band visual preview
  const cutoutStyles = useMemo(() => {
    const leftPct = (Number(windowX) / 1280) * 100;
    const topPct = (Number(windowY) / 720) * 100;
    const widthPct = (Number(windowWidth) / 1280) * 100;
    const heightPct = (Number(windowHeight) / 720) * 100;
    return {
      left: `${Math.max(0, Math.min(100, leftPct))}%`,
      top: `${Math.max(0, Math.min(100, topPct))}%`,
      width: `${Math.max(10, Math.min(100, widthPct))}%`,
      height: `${Math.max(10, Math.min(100, heightPct))}%`
    };
  }, [windowX, windowY, windowWidth, windowHeight]);

  const canSwitchChannel = (currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && channels.length > 1;

  return (
    <div className="space-y-3.5 select-none font-sans">
      {/* Top back navigation button */}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to {isLBand ? 'L-Bands' : 'Ashton Bands'}</span>
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              {isLBand ? <PanelBottom size={15} /> : <CreditCard size={15} />}
            </div>
            <h1 className="text-base sm:text-lg 2xl:text-xl text-white tracking-tight">
              {isEdit ? `Update ${isLBand ? 'L-Band' : 'Ashton Band'}` : `Create New ${isLBand ? 'L-Band' : 'Ashton Band'}`}
            </h1>
          </div>
          <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
            {isLBand
              ? 'Configure L-Band graphic overlay, transparent cutout scaling, and playout recurrence'
              : 'Configure lower-third Ashton Band banner graphic, video squeeze, and playout recurrence'}
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

      {/* Main 2-Column Grid: Left = Preview, Right = Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ================= LEFT COLUMN: LIVE VISUAL PREVIEW ================= */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-4">
          <div className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Eye size={14} className="text-cyan-400" />
                <span>16:9 Broadcast Playout Preview</span>
              </span>
              <button
                type="button"
                onClick={() => setIsSimulatingAir((prev) => !prev)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition flex items-center gap-1.5 cursor-pointer ${isSimulatingAir
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700'
                  }`}
                title="Toggle overlay display in preview"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isSimulatingAir ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                <span>{isSimulatingAir ? 'Overlay ON Air' : 'Overlay OFF'}</span>
              </button>
            </div>

            {/* Simulated 16:9 Broadcast Screen */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#05070d] border border-[#1c263b] shadow-inner select-none">
              {/* Program Video Simulation Layer */}
              <div
                className="absolute inset-0 transition-all duration-300 overflow-hidden flex flex-col justify-between p-3"
                style={
                  !isSimulatingAir
                    ? { inset: 0 }
                    : isLBand && previewUrl
                      ? {
                        left: cutoutStyles.left,
                        top: cutoutStyles.top,
                        width: cutoutStyles.width,
                        height: cutoutStyles.height,
                        borderRadius: '4px'
                      }
                      : !isLBand && ashtonSqueeze && previewUrl
                        ? {
                          left: 0,
                          top: 0,
                          width: '100%',
                          height: '75%'
                        }
                        : { inset: 0 }
                }
              >
                {/* Background visual inside video layer */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/80 via-slate-900 to-cyan-950/70" />

                {/* Subtitle / channel live watermark */}
                <div className="relative z-10 flex items-center justify-between text-[9px] font-mono font-bold text-white/80">
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600/90 text-white tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    LIVE
                  </span>
                  <span className="bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-cyan-300 border border-cyan-500/20">
                    1080p • 25fps
                  </span>
                </div>

                <div className="relative z-10 text-center my-auto">
                  <Tv size={26} className="mx-auto text-cyan-400/60 mb-1" />
                  <p className="text-[11px] font-bold text-slate-200 tracking-wide font-mono">
                    MAIN BROADCAST PROGRAM
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono">Live Ingest & Playout Feed</p>
                </div>

                <div className="relative z-10 text-right text-[8px] text-slate-400 font-mono">
                  Channel: {channel?.name || 'Live Playout'}
                </div>
              </div>

              {/* Graphic Overlay Layer */}
              {isSimulatingAir && previewUrl && (
                <>
                  {isLBand ? (
                    // L-Band Full Graphic with Cutout
                    <img
                      src={previewUrl}
                      alt="L-Band Preview"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
                    />
                  ) : (
                    // Ashton Band Lower-Third
                    <div className="absolute bottom-0 left-0 right-0 h-1/4 z-20 overflow-hidden flex items-center justify-center bg-black/40">
                      <img
                        src={previewUrl}
                        alt="Ashton Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Empty placeholder graphic when no image is loaded */}
              {isSimulatingAir && !previewUrl && (
                <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] p-4 text-center">
                  <div className="p-2.5 rounded-xl bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 mb-2">
                    <Upload size={18} />
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-200">
                    No Graphic Selected Yet
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                    Upload an image on the right to see live preview
                  </span>
                </div>
              )}
            </div>

            {/* Preview Specifications */}
            <div className="p-3 bg-[#070a12] border border-[#182236] rounded-xl font-mono text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-slate-400">
                <span>Overlay Type:</span>
                <span className="text-cyan-300 font-bold uppercase">{isLBand ? 'L-Band Cutout' : 'Ashton Lower Third'}</span>
              </div>
              {isLBand ? (
                <div className="flex items-center justify-between text-slate-400">
                  <span>Transparent Cutout:</span>
                  <span className="text-slate-200">{windowWidth}x{windowHeight} at ({windowX}, {windowY})</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-slate-400">
                  <span>Playout Mode:</span>
                  <span className="text-slate-200">{ashtonSqueeze ? 'Video Squeezed (Pushed Up)' : 'Overlay (Floating)'}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-slate-400">
                <span>Display Duration:</span>
                <span className="text-emerald-400 font-bold">{duration} seconds</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Interval / Gap:</span>
                <span className="text-amber-400 font-bold">{gapMinutes > 0 ? `Every ${gapMinutes} minutes` : 'Once per window'}</span>
              </div>
            </div>

            {/* Calculation helper box */}
            {calculationSummary && (
              <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-xl font-mono text-xs text-cyan-300 flex items-start gap-2.5">
                <Sparkles size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold block text-white text-[11px] mb-0.5">Automated Playout Plan</span>
                  <span className="text-[11px] text-cyan-200/90">
                    Between <strong className="text-white">{dailyStartTime}</strong> and <strong className="text-white">{dailyEndTime}</strong> ({calculationSummary.totalWindowMins} mins), this graphic will air for <strong className="text-emerald-300">{duration}s</strong> every <strong className="text-amber-300">{gapMinutes} mins</strong> (approx. <strong className="text-cyan-300">{calculationSummary.occurrences} times</strong>).
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT COLUMN: FORM CONTROLS ================= */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 text-xs"
          >
            {/* Title / Name */}
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
                  placeholder={isLBand ? 'e.g. Nike Prime Time L-Band' : 'e.g. Breaking News Lower Third'}
                  className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                />
              </div>
            </div>

            {/* Graphic Image Upload */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 text-xs font-semibold">
                  {isLBand ? 'L-Band Graphic Image' : 'Ashton Band Banner Image'}{' '}
                  {!isEdit && <span className="text-cyan-400">*</span>}
                </label>
                <span className="text-[10px] text-slate-500">PNG / JPG (Transparent PNG recommended)</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="band-file-upload"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#1c263b] hover:border-cyan-500/60 bg-[#090d16] hover:bg-[#0c121f] rounded-xl p-4 transition cursor-pointer flex flex-col items-center justify-center gap-2 group"
              >
                {previewUrl ? (
                  <div className="w-full flex items-center justify-between gap-3 bg-[#0d1424] border border-[#1f2d47] p-2.5 rounded-lg">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={previewUrl}
                        alt="Selected graphic"
                        className="w-14 h-9 object-contain bg-black/40 rounded border border-[#2b3a58] shrink-0"
                      />
                      <div className="truncate">
                        <span className="text-xs text-white font-bold block truncate">
                          {imageFile ? imageFile.name : 'Current Image Loaded'}
                        </span>
                        <span className="text-[10px] text-cyan-400">Click to replace file</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                      title="Clear image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-[#121929] border border-[#222f49] flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
                      <Upload size={18} />
                    </div>
                    <span className="text-xs text-slate-300 font-semibold">
                      Click to choose graphic image or drag and drop
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Standard frame: 1280x720 Broadcast Canvas
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Schedule Type (24/7, Weekly, Datewise) */}
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1">Schedule Airing Pattern</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '24/7', label: '24/7 Daily', hint: 'Every day' },
                  { id: 'weekly', label: 'Weekly', hint: 'Specific days' },
                  { id: 'datewise', label: 'Datewise', hint: 'Date range' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScheduleOption(opt.id)}
                    className={`py-2 px-3 rounded-xl border text-center transition cursor-pointer ${scheduleOption === opt.id
                        ? 'bg-cyan-950/60 border-[#00bcd4] text-cyan-300 shadow-md shadow-cyan-500/10'
                        : 'bg-[#090d16] border-[#1a2337] text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                  >
                    <span className="font-bold block text-xs">{opt.label}</span>
                    <span className="text-[10px] text-slate-500 block">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly Days Selector */}
            {scheduleOption === 'weekly' && (
              <div className="p-3 bg-[#090d16] border border-[#1a2337] rounded-xl space-y-2">
                <span className="text-xs text-slate-300 font-bold block">Select Active Days:</span>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_MAP.map((d) => {
                    const isSelected = daysOfWeek.includes(d.day);
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => toggleDay(d.day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${isSelected
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
            )}

            {/* Datewise Date Range Pickers */}
            {scheduleOption === 'datewise' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-[#090d16] border border-[#1a2337] rounded-xl">
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Start Date *</label>
                  <input
                    type="date"
                    required={scheduleOption === 'datewise'}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#0e1422] border border-[#1e293d] rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-[#00bcd4] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">End Date *</label>
                  <input
                    type="date"
                    required={scheduleOption === 'datewise'}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#0e1422] border border-[#1e293d] rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-[#00bcd4] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Time Window (Start Time & End Time) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-slate-300 text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-cyan-400" />
                  <span>Start Time *</span>
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
                  <span>End Time *</span>
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

            {/* Duration & Gap */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-slate-300 text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Timer size={13} className="text-emerald-400" />
                  <span>Display Duration (seconds) *</span>
                </label>
                <div className="flex items-center gap-2 px-3 py-1.5 2xl:py-2 rounded-lg bg-[#090d16] border border-[#1c2538] focus-within:border-[#00bcd4] transition">
                  <input
                    type="number"
                    min="2"
                    max="3600"
                    required
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full bg-transparent text-slate-100 focus:outline-none text-xs font-mono"
                    placeholder="e.g. 5"
                  />
                  <span className="text-slate-500 font-bold">sec</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  How long overlay stays visible on air
                </span>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-amber-400" />
                  <span>Playout Gap / Interval (minutes) *</span>
                </label>
                <div className="flex items-center gap-2 px-3 py-1.5 2xl:py-2 rounded-lg bg-[#090d16] border border-[#1c2538] focus-within:border-[#00bcd4] transition">
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    required
                    value={gapMinutes}
                    onChange={(e) => setGapMinutes(Number(e.target.value))}
                    className="w-full bg-transparent text-slate-100 focus:outline-none text-xs font-mono"
                    placeholder="e.g. 20"
                  />
                  <span className="text-slate-500 font-bold">min</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Interval between successive shows (0 = once)
                </span>
              </div>
            </div>

            {/* Ashton Specific Squeeze Toggle */}
            {!isLBand && (
              <div className="p-3.5 bg-[#090d16] border border-[#1a2337] rounded-xl flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Squeeze Program Video</span>
                  <span className="text-[10px] text-slate-400">
                    Push video up smoothly so Ashton graphic doesn't obstruct lower third
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAshtonSqueeze((prev) => !prev)}
                  className={`w-11 h-6 rounded-full transition p-1 flex items-center cursor-pointer ${ashtonSqueeze ? 'bg-[#00bcd4] justify-end' : 'bg-slate-700 justify-start'
                    }`}
                >
                  <span className="w-4 h-4 rounded-full bg-black shadow-md" />
                </button>
              </div>
            )}

            {/* Active Switch */}
            <div className="p-3.5 bg-[#090d16] border border-[#1a2337] rounded-xl flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Enabled on Broadcast</span>
                <span className="text-[10px] text-slate-400">
                  When enabled, clock engine will trigger this overlay automatically
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((prev) => !prev)}
                className={`w-11 h-6 rounded-full transition p-1 flex items-center cursor-pointer ${enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
                  }`}
              >
                <span className="w-4 h-4 rounded-full bg-black shadow-md" />
              </button>
            </div>

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
                disabled={isSubmitting}
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
                    <span>{isEdit ? 'Update Schedule' : 'Create Schedule'}</span>
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
