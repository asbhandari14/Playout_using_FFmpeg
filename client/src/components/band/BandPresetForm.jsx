import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  Timer,
  Check,
  X,
  Tv,
  PanelBottom,
  CreditCard,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import BandPreviewScreen from './BandPreviewScreen.jsx';
import {
  resolveMediaUrl,
  sanitizeVideoWindow,
  detectLBandCutoutFromUrl,
  detectAshtonHeightFromUrl
} from '../../utils/bandGeometry.js';

export default function BandPresetForm({
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
  const bandLabel = isLBand ? 'L-Band' : 'Ashton Band';

  const [channelId, setChannelId] = useState(
    initialData?.channel?._id || initialData?.channel || channel?._id || channels[0]?._id || ''
  );
  const [title, setTitle] = useState(initialData?.title || '');
  const [duration, setDuration] = useState(initialData?.duration || 10);

  // L-Band video window geometry (1280x720)
  const [windowX, setWindowX] = useState(initialData?.windowX ?? 300);
  const [windowY, setWindowY] = useState(initialData?.windowY ?? 20);
  const [windowWidth, setWindowWidth] = useState(initialData?.windowWidth ?? 960);
  const [windowHeight, setWindowHeight] = useState(initialData?.windowHeight ?? 540);
  const [autoDetectedNote, setAutoDetectedNote] = useState('');

  // Ashton Band squeeze & lower-third height
  const [ashtonSqueeze, setAshtonSqueeze] = useState(
    initialData?.ashtonSqueeze !== undefined ? initialData.ashtonSqueeze : true
  );
  const [ashtonHeight, setAshtonHeight] = useState(initialData?.ashtonHeight || 160);

  // Image upload & preview
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(resolveMediaUrl(initialData?.imagePath));
  const [isDetecting, setIsDetecting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDuration(initialData.duration || 10);
      setWindowX(initialData.windowX ?? 300);
      setWindowY(initialData.windowY ?? 20);
      setWindowWidth(initialData.windowWidth ?? 960);
      setWindowHeight(initialData.windowHeight ?? 540);
      setAshtonSqueeze(initialData.ashtonSqueeze !== undefined ? initialData.ashtonSqueeze : true);
      setAshtonHeight(initialData.ashtonHeight || 160);
      if (!imageFile) {
        setPreviewUrl(resolveMediaUrl(initialData.imagePath));
      }
    }
  }, [initialData, imageFile]);

  useEffect(() => {
    if (!imageFile) return;
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    let cancelled = false;
    setIsDetecting(true);
    (async () => {
      if (isLBand) {
        const res = await detectLBandCutoutFromUrl(objectUrl);
        if (cancelled) return;
        setWindowX(res.windowX);
        setWindowY(res.windowY);
        setWindowWidth(res.windowWidth);
        setWindowHeight(res.windowHeight);
        setAutoDetectedNote(
          res.detected
            ? `Auto-detected window: ${res.windowWidth}x${res.windowHeight} at (${res.windowX}, ${res.windowY})`
            : 'No transparent cutout found — using default video window (editable below)'
        );
      } else {
        const res = await detectAshtonHeightFromUrl(objectUrl);
        if (cancelled) return;
        setAshtonHeight(res.ashtonHeight);
        setAutoDetectedNote(
          res.detected
            ? `Auto-detected banner height: ${res.ashtonHeight}px (Video window: 1280x${720 - res.ashtonHeight})`
            : 'Using standard 160px lower-third banner height (editable below)'
        );
      }
      setIsDetecting(false);
    })();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile, isLBand]);

  const handleAutoDetectClick = async () => {
    if (!previewUrl) return;
    setIsDetecting(true);
    if (isLBand) {
      const res = await detectLBandCutoutFromUrl(previewUrl);
      setWindowX(res.windowX);
      setWindowY(res.windowY);
      setWindowWidth(res.windowWidth);
      setWindowHeight(res.windowHeight);
      setAutoDetectedNote(
        res.detected
          ? `Auto-detected window: ${res.windowWidth}x${res.windowHeight} at (${res.windowX}, ${res.windowY})`
          : 'No transparent cutout found — reset to default window'
      );
    } else {
      const res = await detectAshtonHeightFromUrl(previewUrl);
      setAshtonHeight(res.ashtonHeight);
      setAutoDetectedNote(`Auto-detected height: ${res.ashtonHeight}px`);
    }
    setIsDetecting(false);
  };

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
    setAutoDetectedNote('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(`Please enter ${bandLabel} title`);
      return;
    }
    if (!imageFile && !previewUrl) {
      toast.error(`Please upload an image for the ${bandLabel}`);
      return;
    }

    const formData = new FormData();
    // Append type before image so multer routes upload to lband_img / ashtonBand_img
    formData.append('type', type);
    formData.append('title', title.trim());
    formData.append('duration', Math.max(1, Number(duration) || 10));

    if (isLBand) {
      const cleanWin = sanitizeVideoWindow({ windowX, windowY, windowWidth, windowHeight });
      formData.append('windowX', cleanWin.windowX);
      formData.append('windowY', cleanWin.windowY);
      formData.append('windowWidth', cleanWin.windowWidth);
      formData.append('windowHeight', cleanWin.windowHeight);
    } else {
      formData.append('ashtonSqueeze', ashtonSqueeze);
      formData.append('ashtonHeight', Math.max(60, Math.min(400, Number(ashtonHeight) || 160)));
    }

    if (imageFile) {
      formData.append('image', imageFile);
    }

    onSubmit({
      channelId,
      bandId: initialData?._id,
      formData
    });
  };

  const canSwitchChannel =
    (currentUser?.role === 'super_admin' || currentUser?.role === 'admin') &&
    channels.length > 1;

  const activeChannelName = channels.find((c) => c._id === channelId)?.name || channel?.name || 'Live Playout';
  const ashtonVideoH = Math.max(20, 720 - (Number(ashtonHeight) || 160));

  return (
    <div className="space-y-3.5 select-none font-sans">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to {bandLabel}s</span>
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              {isLBand ? <PanelBottom size={15} /> : <CreditCard size={15} />}
            </div>
            <h1 className="text-base sm:text-lg 2xl:text-xl text-white tracking-tight">
              {isEdit ? `Update ${bandLabel}` : `Create ${bandLabel}`}
            </h1>
          </div>
          <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
            {isLBand
              ? 'Upload L-Band artwork, auto-detect or adjust the Video Window (X, Y, W, H), and preview live placement before saving'
              : 'Upload Ashton lower-third artwork, adjust video squeeze/window height, and preview live placement before saving'}
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

      {/* 2-Column Layout: Preview Left | Form Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-4">
          <BandPreviewScreen
            type={type}
            previewUrl={previewUrl}
            channelName={activeChannelName}
            windowX={windowX}
            windowY={windowY}
            windowWidth={windowWidth}
            windowHeight={windowHeight}
            ashtonSqueeze={ashtonSqueeze}
            ashtonHeight={ashtonHeight}
            duration={duration}
            emptyHint={`Upload an ${bandLabel} image on the right to preview & auto-detect window`}
          />

          {autoDetectedNote && (
            <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/50 text-[11px] font-mono text-cyan-200 flex items-center gap-2">
              <Sparkles size={14} className="text-cyan-400 shrink-0" />
              <span>{autoDetectedNote}</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 text-xs"
          >
            {/* Title */}
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1">
                {bandLabel} Title <span className="text-cyan-400">*</span>
              </label>
              <div className="flex items-center gap-2 px-3 py-1.5 2xl:py-2 rounded-lg bg-[#090d16] border border-[#1c2538] focus-within:border-[#00bcd4] transition">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isLBand ? 'e.g. Prime Sponsor L-Band' : 'e.g. Breaking News Lower Third'}
                  className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                />
              </div>
            </div>

            {/* Graphic Image Upload */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 text-xs font-semibold">
                  {bandLabel} Image {!isEdit && <span className="text-cyan-400">*</span>}
                </label>
                <span className="text-[10px] text-slate-500">Transparent PNG recommended (1280x720)</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="band-preset-file-upload"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#1c263b] hover:border-cyan-500/60 bg-[#090d16] hover:bg-[#0c121f] rounded-xl p-3.5 transition cursor-pointer flex flex-col items-center justify-center gap-2 group"
              >
                {previewUrl ? (
                  <div className="w-full flex items-center justify-between gap-3 bg-[#0d1424] border border-[#1f2d47] p-2.5 rounded-lg">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={previewUrl}
                        alt="Selected graphic"
                        className="w-16 h-10 object-contain bg-black/40 rounded border border-[#2b3a58] shrink-0"
                      />
                      <div className="truncate">
                        <span className="text-xs text-white font-bold block truncate">
                          {imageFile ? imageFile.name : 'Current Graphic Loaded'}
                        </span>
                        <span className="text-[10px] text-cyan-400">
                          {isDetecting ? 'Analyzing transparent cutout...' : 'Click to replace image'}
                        </span>
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
                      Click to upload {bandLabel} image
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Video window coordinates will be detected automatically
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Band Duration */}
            <div>
              <label className="text-slate-300 text-xs font-semibold mb-1 flex items-center gap-1.5">
                <Timer size={13} className="text-emerald-400" />
                <span>{bandLabel} Duration (seconds) <span className="text-cyan-400">*</span></span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-1.5 2xl:py-2 rounded-lg bg-[#090d16] border border-[#1c2538] focus-within:border-[#00bcd4] transition">
                  <input
                    type="number"
                    min="1"
                    max="3600"
                    required
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-transparent text-slate-100 focus:outline-none text-xs font-mono"
                    placeholder="e.g. 10"
                  />
                  <span className="text-slate-500 font-bold">sec</span>
                </div>
                <div className="flex items-center gap-1">
                  {[5, 10, 15, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDuration(sec)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold border transition cursor-pointer ${
                        Number(duration) === sec
                          ? 'bg-[#00bcd4] text-black border-[#00bcd4]'
                          : 'bg-[#090d16] text-slate-400 border-[#1c2538] hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Video Window Geometry Section */}
            <div className="p-3.5 bg-[#090d16] border border-[#1a2337] rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Maximize2 size={13} className="text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Video Window (1280x720 Canvas)
                  </span>
                </div>
                {previewUrl && (
                  <button
                    type="button"
                    onClick={handleAutoDetectClick}
                    disabled={isDetecting}
                    className="px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/60 border border-cyan-800/70 text-cyan-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles size={11} />
                    <span>{isDetecting ? 'Detecting...' : 'Auto-Detect'}</span>
                  </button>
                )}
              </div>

              {isLBand ? (
                <>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed">
                    Automatically set from your uploaded L-Band image cutout. Adjust X, Y, Width, or Height below and verify immediately in the preview before saving.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">X (px)</label>
                      <input
                        type="number"
                        min="0"
                        max="1200"
                        step="2"
                        value={windowX}
                        onChange={(e) => setWindowX(Number(e.target.value))}
                        className="w-full bg-[#0e1422] border border-[#1e293d] focus:border-[#00bcd4] rounded-lg px-2.5 py-1.5 text-slate-100 text-xs font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">Y (px)</label>
                      <input
                        type="number"
                        min="0"
                        max="640"
                        step="2"
                        value={windowY}
                        onChange={(e) => setWindowY(Number(e.target.value))}
                        className="w-full bg-[#0e1422] border border-[#1e293d] focus:border-[#00bcd4] rounded-lg px-2.5 py-1.5 text-slate-100 text-xs font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">Width (px)</label>
                      <input
                        type="number"
                        min="64"
                        max="1280"
                        step="2"
                        value={windowWidth}
                        onChange={(e) => setWindowWidth(Number(e.target.value))}
                        className="w-full bg-[#0e1422] border border-[#1e293d] focus:border-[#00bcd4] rounded-lg px-2.5 py-1.5 text-slate-100 text-xs font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">Height (px)</label>
                      <input
                        type="number"
                        min="64"
                        max="720"
                        step="2"
                        value={windowHeight}
                        onChange={(e) => setWindowHeight(Number(e.target.value))}
                        className="w-full bg-[#0e1422] border border-[#1e293d] focus:border-[#00bcd4] rounded-lg px-2.5 py-1.5 text-slate-100 text-xs font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Squeeze toggle */}
                  <div className="flex items-center justify-between gap-4 pb-2 border-b border-[#182236]">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Squeeze Program Video</span>
                      <span className="text-[10px] text-slate-400">
                        Push video up above the banner so lower-third content is never covered
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAshtonSqueeze((prev) => !prev)}
                      className={`w-11 h-6 rounded-full transition p-1 flex items-center cursor-pointer shrink-0 ${
                        ashtonSqueeze ? 'bg-[#00bcd4] justify-end' : 'bg-slate-700 justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-black shadow-md" />
                    </button>
                  </div>

                  {/* Banner Height & resulting Video Window */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10.5px] text-slate-300 font-semibold">
                        Ashton Banner Height (px)
                      </label>
                      <span className="font-mono text-xs text-cyan-300 font-bold">{ashtonHeight}px</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="360"
                      step="2"
                      value={ashtonHeight}
                      onChange={(e) => setAshtonHeight(Number(e.target.value))}
                      className="w-full accent-[#00bcd4] cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-1">X (px)</label>
                      <input
                        type="number"
                        value={0}
                        readOnly
                        className="w-full bg-[#0b101b] border border-[#1a2234] rounded-lg px-2.5 py-1.5 text-slate-400 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-1">Y (px)</label>
                      <input
                        type="number"
                        value={0}
                        readOnly
                        className="w-full bg-[#0b101b] border border-[#1a2234] rounded-lg px-2.5 py-1.5 text-slate-400 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-1">Width (px)</label>
                      <input
                        type="number"
                        value={1280}
                        readOnly
                        className="w-full bg-[#0b101b] border border-[#1a2234] rounded-lg px-2.5 py-1.5 text-slate-400 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                        {ashtonSqueeze ? 'Video Height (px)' : 'Band Height (px)'}
                      </label>
                      <input
                        type="number"
                        min="60"
                        max="660"
                        step="2"
                        value={ashtonSqueeze ? ashtonVideoH : ashtonHeight}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          if (ashtonSqueeze) {
                            const nextBandH = Math.max(60, Math.min(400, 720 - val));
                            setAshtonHeight(nextBandH - (nextBandH % 2));
                          } else {
                            const nextBandH = Math.max(60, Math.min(400, val));
                            setAshtonHeight(nextBandH - (nextBandH % 2));
                          }
                        }}
                        className="w-full bg-[#0e1422] border border-[#1e293d] focus:border-[#00bcd4] rounded-lg px-2.5 py-1.5 text-slate-100 text-xs font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}
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
                    <span>{isEdit ? `Update ${bandLabel}` : `Save ${bandLabel}`}</span>
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

