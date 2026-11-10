import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Tv,
  Radio,
  Server as ServerIcon,
  UserCheck,
  HardDrive,
  Copy,
  Check,
  Cpu,
  Music,
  Sliders,
  Sparkles,
  AlertTriangle,
  Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  FORM_CARD_CLASS,
  FORM_SHELL_CLASS,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_BTN_CANCEL,
  FORM_BTN_PRIMARY,
  FormField as Field
} from './FormPrimitives.jsx';

export default function CreateChannelForm({
  formData = {},
  setFormData,
  servers = [],
  users = [],
  currentUser = null,
  onSubmit,
  onCancel
}) {
  const [copiedField, setCopiedField] = useState('');

  const set = (field, transform) => (e) =>
    setFormData((prev) => ({
      ...prev,
      [field]: transform ? transform(e.target.value) : e.target.value
    }));

  // Selected server object
  const selectedServer = useMemo(() => {
    return servers.find((s) => s._id === formData.server) || servers[0] || null;
  }, [servers, formData.server]);

  // Derive sanitized stream key and live endpoint URLs
  const endpoints = useMemo(() => {
    const rawKey = formData.streamKey || formData.name || 'channel_live';
    const sanitizedKey = rawKey
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');

    const streamUrl = selectedServer?.streamUrl || selectedServer?.hlsBaseUrl || 'http://127.0.0.1:81';
    let cleanUrl = streamUrl.trim().replace(/\/+$/, '');
    let hostname = '127.0.0.1';

    try {
      const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `http://${cleanUrl}`);
      hostname = parsed.hostname;
      cleanUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      const match = cleanUrl.match(/^(?:https?:\/\/)?([^:/]+)/i);
      if (match) hostname = match[1];
    }

    return {
      streamKey: sanitizedKey,
      rtmpUrl: `rtmp://${hostname}/static/${sanitizedKey}`,
      hlsUrl: `${cleanUrl}/${sanitizedKey}/index.m3u8`,
      hostname
    };
  }, [selectedServer, formData.streamKey, formData.name]);

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(type);
    toast.success(`Copied ${type === 'rtmp' ? 'RTMP Ingest' : 'HLS Playback'} URL to clipboard`);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const handleAutoSlug = () => {
    if (!formData.name) {
      toast.error('Enter a Channel Name first');
      return;
    }
    const slug = formData.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');
    setFormData((prev) => ({ ...prev, streamKey: slug }));
    toast.success(`Stream key generated: ${slug}`);
  };

  return (
    <div className="space-y-3.5 select-none">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Channels</span>
      </button>

      <div>
        <h1 className="text-base sm:text-lg 2xl:text-xl text-white tracking-tight">
          Create Channel
        </h1>
        <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
          Provision a new broadcast playout channel on Flussonic Media Server with automated RTMP/HLS pipelines
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className={`${FORM_CARD_CLASS} space-y-4 2xl:space-y-5`}
      >
        {/* Server check alert if none exists */}
        {servers.length === 0 && (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-3 text-xs text-amber-300">
            <AlertTriangle size={18} className="shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold">No Media Server Configured</p>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                You must add at least one Media Server (e.g. Flussonic stream server) before creating a broadcast channel.
              </p>
            </div>
          </div>
        )}

        {/* 1. Channel Identity */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-1.5">
            <Tv size={14} />
            <span>Channel Identity & Stream Key</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            {/* Channel Name */}
            <Field label="Channel Name" required hint="Broadcast display name">
              <div className={FORM_SHELL_CLASS}>
                <Tv size={14} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={set('name')}
                  placeholder="e.g. Sports HD 1"
                  className={FORM_INPUT_CLASS}
                />
              </div>
            </Field>

            {/* Stream Key / Identifier */}
            <Field
              label="Stream Key / Identifier"
              hint="Flussonic stream slug (a-z, 0-9, _, -)"
            >
              <div className="flex items-center gap-2">
                <div className={`${FORM_SHELL_CLASS} flex-1`}>
                  <Radio size={14} className="text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={formData.streamKey || ''}
                    onChange={set('streamKey')}
                    placeholder={formData.name ? endpoints.streamKey : 'e.g. sports_hd_1'}
                    className={FORM_INPUT_CLASS}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAutoSlug}
                  title="Generate Stream Key from Channel Name"
                  className="px-2.5 py-1.5 2xl:py-2 rounded-lg bg-[#141b2b] hover:bg-[#1a253d] border border-[#222f49] text-cyan-400 text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1"
                >
                  <Sparkles size={13} />
                  <span className="hidden sm:inline">Auto</span>
                </button>
              </div>
            </Field>
          </div>
        </div>

        {/* 2. Infrastructure & Operator Assignment */}
        <div className="pt-3 border-t border-[#1a2234]">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-2.5 flex items-center gap-1.5">
            <ServerIcon size={13} />
            <span>Server & Operator Assignment</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            {/* Media Server Selection */}
            <Field label="Media Server" required hint="Flussonic media streaming host">
              <div className={FORM_SHELL_CLASS}>
                <ServerIcon size={14} className="text-slate-500 shrink-0" />
                <select
                  required
                  value={formData.server || ''}
                  onChange={set('server')}
                  className="w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer"
                >
                  <option value="" disabled className="bg-[#0b0e18]">
                    -- Select Target Media Server --
                  </option>
                  {servers.map((s) => (
                    <option key={s._id} value={s._id} className="bg-[#0b0e18] text-slate-200">
                      {s.name} ({s.category || 'General'}) — {s.streamUrl}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            {/* Assigned User */}
            <Field label="Assigned User" required hint="User responsible for managing playout">
              <div className={FORM_SHELL_CLASS}>
                <UserCheck size={14} className="text-slate-500 shrink-0" />
                <select
                  required
                  value={formData.assignedUser || ''}
                  onChange={set('assignedUser')}
                  className="w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer"
                >
                  <option value="" disabled className="bg-[#0b0e18]">
                    -- Select Channel Operator --
                  </option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id} className="bg-[#0b0e18] text-slate-200">
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          </div>
        </div>

        {/* 3. Live Streaming Endpoints Preview Card */}
        <div className="p-3 rounded-lg bg-[#090d16] border border-[#1c2538] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Radio size={14} className="text-cyan-400" />
              <span>Live Broadcast Endpoints Preview</span>
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              Flussonic Pipeline
            </span>
          </div>

          <div className="space-y-2 font-mono text-[11px]">
            {/* RTMP Ingest */}
            <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[#0d121f] border border-[#182236]">
              <div className="truncate flex items-center gap-2">
                <span className="text-slate-500 font-bold uppercase text-[9px] w-12 shrink-0">RTMP</span>
                <span className="text-slate-200 truncate select-all">{endpoints.rtmpUrl}</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(endpoints.rtmpUrl, 'rtmp')}
                className="text-slate-400 hover:text-cyan-400 transition shrink-0 p-1 cursor-pointer"
                title="Copy RTMP Ingest URL"
              >
                {copiedField === 'rtmp' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>

            {/* HLS Playback */}
            <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[#0d121f] border border-[#182236]">
              <div className="truncate flex items-center gap-2">
                <span className="text-cyan-400 font-bold uppercase text-[9px] w-12 shrink-0">HLS</span>
                <span className="text-slate-200 truncate select-all">{endpoints.hlsUrl}</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(endpoints.hlsUrl, 'hls')}
                className="text-slate-400 hover:text-cyan-400 transition shrink-0 p-1 cursor-pointer"
                title="Copy HLS Playback URL"
              >
                {copiedField === 'hls' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* 4. Storage Quota */}
        <div className="pt-3 border-t border-[#1a2234]">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-2.5 flex items-center gap-1.5">
            <HardDrive size={13} />
            <span>Media Storage Allocation</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <Field
              label="Allocated Storage Quota"
              hint="0 or blank = Unlimited disk allocation"
            >
              <div className={FORM_SHELL_CLASS}>
                <HardDrive size={14} className="text-slate-500 shrink-0" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.allocatedStorageAmount ?? ''}
                  onChange={set('allocatedStorageAmount')}
                  placeholder="e.g. 50 (or leave empty for unlimited)"
                  className={FORM_INPUT_CLASS}
                />
                <select
                  value={formData.allocatedStorageUnit || 'GB'}
                  onChange={set('allocatedStorageUnit')}
                  className="bg-transparent text-slate-300 font-bold focus:outline-none border-l border-slate-700 pl-2 text-xs cursor-pointer"
                >
                  <option value="MB" className="bg-[#0b0e18] text-slate-200">MB</option>
                  <option value="GB" className="bg-[#0b0e18] text-slate-200">GB</option>
                  <option value="TB" className="bg-[#0b0e18] text-slate-200">TB</option>
                </select>
              </div>
            </Field>

            <div className="flex items-center text-[11px] text-slate-400 bg-[#090d16] border border-[#1c2538] rounded-lg p-2.5">
              <Info size={14} className="text-slate-500 mr-2 shrink-0" />
              <span>
                Uploads for this channel will be isolated in dedicated directory structure. Playout stops asset ingestion if quota is exceeded.
              </span>
            </div>
          </div>
        </div>

        {/* 5. Playout Output Settings (FFmpeg Specs) */}
        <div className="pt-3 border-t border-[#1a2234]">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-2.5 flex items-center gap-1.5">
            <Sliders size={13} />
            <span>Output Playout Encoding Settings (FFmpeg)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Resolution */}
            <Field label="Resolution" hint="Width × Height">
              <select
                value={formData.resolution || '1280x720'}
                onChange={set('resolution')}
                className={FORM_SELECT_CLASS}
              >
                <option value="1920x1080" className="bg-[#0b0e18]">1920x1080 (1080p FHD)</option>
                <option value="1280x720" className="bg-[#0b0e18]">1280x720 (720p HD)</option>
              </select>
            </Field>

            {/* Framerate */}
            <Field label="Framerate" hint="Output FPS">
              <select
                value={formData.fps || 25}
                onChange={set('fps', Number)}
                className={FORM_SELECT_CLASS}
              >
                <option value={25} className="bg-[#0b0e18]">25 FPS (Broadcast / PAL)</option>
                <option value={30} className="bg-[#0b0e18]">30 FPS (NTSC Standard)</option>
                <option value={50} className="bg-[#0b0e18]">50 FPS (High Motion)</option>
                <option value={60} className="bg-[#0b0e18]">60 FPS (Ultra Smooth)</option>
              </select>
            </Field>

            {/* Video Bitrate */}
            <Field label="Video Bitrate" hint="H.264 Target">
              <select
                value={formData.videoBitrate || '2500k'}
                onChange={set('videoBitrate')}
                className={FORM_SELECT_CLASS}
              >
                <option value="6000k" className="bg-[#0b0e18]">6000k (High Quality FHD)</option>
                <option value="4000k" className="bg-[#0b0e18]">4000k (Pro HD 1080p)</option>
                <option value="2500k" className="bg-[#0b0e18]">2500k (Recommended 720p)</option>
                <option value="1500k" className="bg-[#0b0e18]">1500k (Standard/Eco)</option>
                <option value="1000k" className="bg-[#0b0e18]">1000k (Low Bandwidth)</option>
              </select>
            </Field>

            {/* Audio Bitrate */}
            <Field label="Audio Bitrate" hint="AAC Stereo">
              <select
                value={formData.audioBitrate || '128k'}
                onChange={set('audioBitrate')}
                className={FORM_SELECT_CLASS}
              >
                <option value="320k" className="bg-[#0b0e18]">320k (Studio Master)</option>
                <option value="256k" className="bg-[#0b0e18]">256k (Pro Audio)</option>
                <option value="192k" className="bg-[#0b0e18]">192k (High Quality)</option>
                <option value="128k" className="bg-[#0b0e18]">128k (Standard AAC)</option>
                <option value="96k" className="bg-[#0b0e18]">96k (Speech / Radio)</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-[#1a2234] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className={FORM_BTN_CANCEL}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={FORM_BTN_PRIMARY}
          >
            <Radio size={14} />
            <span>Create Channel</span>
          </button>
        </div>
      </form>
    </div>
  );
}
