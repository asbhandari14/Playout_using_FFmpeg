import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Tv,
  Server as ServerIcon,
  Globe,
  Radio,
  Monitor,
  Activity,
  Volume2,
  Film,
  Key,
  User as UserIcon,
  Lock,
  Copy,
  Check,
  ExternalLink,
  HardDrive,
  Info as InfoIcon,
  Layers
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { bytesToStorage } from '../../hooks/useStorageCalc.js';
import {
  FORM_CARD_CLASS,
  FORM_SHELL_CLASS,
  FORM_INPUT_CLASS,
  FORM_BTN_CANCEL,
  FORM_BTN_PRIMARY,
  FormField as Field
} from './FormPrimitives.jsx';

const shellClass = FORM_SHELL_CLASS;
const inputClass = FORM_INPUT_CLASS;

export default function ChannelInfoForm({
  channels = [],
  selectedChannelId = null,
  onCancel,
  onOpenStudio
}) {
  const [activeChannelId, setActiveChannelId] = useState(
    selectedChannelId || channels[0]?._id || null
  );
  const [copiedField, setCopiedField] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);

  // Sync selected channel if initial prop or list updates
  const activeChannel = useMemo(() => {
    if (!channels || channels.length === 0) return null;
    return channels.find((c) => c._id === activeChannelId) || channels[0];
  }, [channels, activeChannelId]);

  // Derived fields and endpoints
  const {
    channelName,
    serverName,
    serverCategory,
    assignedUserName,
    assignedUserEmail,
    finalHlsUrl,
    finalRtmpUrl,
    resolutionDisplay,
    videoBitrateDisplay,
    audioBitrateDisplay,
    fpsDisplay,
    streamKey,
    storageDisplay,
    status,
    isLive
  } = useMemo(() => {
    if (!activeChannel) {
      return {
        channelName: '',
        serverName: 'Not Assigned',
        serverCategory: '',
        assignedUserName: 'Unassigned',
        assignedUserEmail: '',
        finalHlsUrl: '',
        finalRtmpUrl: '',
        resolutionDisplay: '1280x720 (720p HD)',
        videoBitrateDisplay: '2500k',
        audioBitrateDisplay: '128k',
        fpsDisplay: '25 FPS',
        streamKey: '',
        storageDisplay: '0 GB / 0 GB',
        status: 'idle',
        isLive: false
      };
    }

    const cName = activeChannel.name || 'Unnamed Channel';
    const srv = activeChannel.server;
    const srvName = srv?.name || (typeof srv === 'string' ? srv : 'Default Media Server');
    const srvCat = srv?.category || 'General';

    const usr = activeChannel.assignedUser;
    const usrName = usr?.name || 'Unassigned';
    const usrEmail = usr?.email ? `(${usr.email})` : '';

    // Stream key & endpoints fallback
    const rawKey = activeChannel.streamKey || activeChannel.name || 'channel_live';
    const cleanKey = rawKey
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');

    const streamUrl = srv?.streamUrl || srv?.hlsBaseUrl || 'http://127.0.0.1:81';
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

    const hls = activeChannel.hlsUrl || `${cleanUrl}/${cleanKey}/index.m3u8`;
    const rtmp = activeChannel.rtmpUrl || `rtmp://${hostname}/static/${cleanKey}`;

    // Playout encoding parameters
    const output = activeChannel.outputSettings || {};
    const res = output.resolution || activeChannel.resolution || '1280x720';
    const vBit = output.videoBitrate || activeChannel.videoBitrate || '2500k';
    const aBit = output.audioBitrate || activeChannel.audioBitrate || '128k';
    const fpsVal = output.fps || activeChannel.fps || 25;

    // Storage formatting
    const usedBytes = activeChannel.usedStorage || 0;
    const allocatedBytes = activeChannel.allocatedStorage || 0;
    const used = bytesToStorage(usedBytes);
    const allocated = bytesToStorage(allocatedBytes);
    const storageText =
      allocatedBytes > 0
        ? `${used.amount} ${used.unit} / ${allocated.amount} ${allocated.unit}`
        : `${used.amount} ${used.unit} (Unlimited)`;

    const st = activeChannel.status || 'idle';
    const live = st === 'live' || st === 'running' || st === 'playing';

    return {
      channelName: cName,
      serverName: srvName,
      serverCategory: srvCat,
      assignedUserName: usrName,
      assignedUserEmail: usrEmail,
      finalHlsUrl: hls,
      finalRtmpUrl: rtmp,
      resolutionDisplay: res === '1920x1080' ? '1920x1080 (1080p FHD)' : '1280x720 (720p HD)',
      videoBitrateDisplay: `${vBit} (H.264)`,
      audioBitrateDisplay: `${aBit} (AAC Stereo)`,
      fpsDisplay: `${fpsVal} FPS`,
      streamKey: activeChannel.streamKey || cleanKey,
      storageDisplay: storageText,
      status: st,
      isLive: live
    };
  }, [activeChannel]);

  const copyToClipboard = (text, type, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(type);
    toast.success(`Copied ${label || type} to clipboard`);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const copyAllDetails = () => {
    if (!activeChannel) return;
    const infoText = [
      `Channel Name: ${channelName}`,
      `Status: ${status.toUpperCase()}`,
      `Assigned Media Server: ${serverName}`,
      `HLS Playback URL: ${finalHlsUrl}`,
      `RTMP Ingest URL: ${finalRtmpUrl}`,
      `Stream Key: ${streamKey}`,
      `Resolution: ${resolutionDisplay}`,
      `Video Bitrate: ${videoBitrateDisplay}`,
      `Audio Bitrate: ${audioBitrateDisplay}`,
      `Framerate: ${fpsDisplay}`,
      `Assigned User: ${assignedUserName} ${assignedUserEmail}`,
      `Storage Usage: ${storageDisplay}`
    ].join('\n');

    navigator.clipboard.writeText(infoText);
    setCopiedAll(true);
    toast.success('All channel configuration endpoints copied to clipboard!');
    setTimeout(() => setCopiedAll(false), 2500);
  };

  if (!channels || channels.length === 0) {
    return (
      <div className="space-y-3.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Channels</span>
        </button>

        <div className={`${FORM_CARD_CLASS} p-8 text-center text-slate-400`}>
          <Tv size={30} className="mx-auto mb-2.5 text-slate-600" />
          <h2 className="text-base text-white font-bold mb-1">No Channels Configured</h2>
          <p className="text-xs text-slate-400">
            Create a broadcast channel first to inspect technical streaming parameters and endpoints.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 select-none">
      {/* Top back navigation button */}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Channels</span>
      </button>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg 2xl:text-xl text-white tracking-tight">
              Channel Information
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider font-mono ${isLive
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                  : status === 'error'
                    ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                    : 'bg-slate-800/60 text-slate-300 border border-slate-700/60'
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : status === 'error' ? 'bg-rose-400' : 'bg-slate-400'
                  }`}
              />
              <span>{isLive ? 'Live Playout' : status?.toUpperCase() || 'Idle'}</span>
            </span>
          </div>
          <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
            Technical broadcast specifications, streaming endpoints, and media server configuration
          </p>
        </div>

        {/* Channel Switcher Dropdown (if multiple channels exist) */}
        {channels.length > 1 && (
          <div className="flex items-center gap-2 bg-[#10141e] border border-[#1e2638] px-3 py-1.5 rounded-lg shrink-0 text-xs">
            <Tv size={14} className="text-[#00bcd4] shrink-0" />
            <span className="text-slate-400">Channel:</span>
            <select
              value={activeChannel?._id || ''}
              onChange={(e) => setActiveChannelId(e.target.value)}
              className="bg-transparent text-cyan-300 font-semibold text-xs focus:outline-none cursor-pointer pr-1"
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

      {/* Main Info Form Card */}
      <div className={`${FORM_CARD_CLASS} space-y-4`}>
        {/* Read-only notice badge */}
        <div className="px-3 py-2 bg-cyan-950/20 border border-cyan-800/40 rounded-lg flex items-center justify-between gap-2 text-cyan-300 text-xs">
          <div className="flex items-center gap-2">
            <Lock size={13} className="text-cyan-400 shrink-0" />
            <span className="font-semibold">System Managed Configuration (Read-Only)</span>
          </div>
          <span className="text-[10.5px] text-slate-400 hidden sm:inline">
            Playout endpoints and encoder parameters cannot be edited directly
          </span>
        </div>

        {/* Row 1: Channel Name & Assigned Server */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Channel Name" hint="Assigned broadcast channel">
            <div className={shellClass}>
              <Tv size={16} className="text-[#00bcd4] shrink-0" />
              <input
                type="text"
                readOnly
                value={channelName}
                className={`${inputClass} cursor-default`}
                title="Channel Name (Read-Only)"
              />
            </div>
          </Field>

          <Field label="Assigned Media Server" hint={serverCategory ? `Cluster: ${serverCategory}` : 'Media server'}>
            <div className={shellClass}>
              <ServerIcon size={16} className="text-slate-500 shrink-0" />
              <input
                type="text"
                readOnly
                value={serverName}
                className={`${inputClass} cursor-default`}
                title="Assigned Media Server (Read-Only)"
              />
            </div>
          </Field>
        </div>

        {/* Row 2: HLS Playback URL */}
        <Field label="HLS Playback URL" hint="Live stream playback endpoint (.m3u8)">
          <div className={shellClass}>
            <Globe size={14} className="text-[#00bcd4] shrink-0" />
            <input
              type="text"
              readOnly
              value={finalHlsUrl}
              className={`${inputClass} font-mono text-[#00bcd4] cursor-default select-all`}
              title="Click and copy HLS Playback URL"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(finalHlsUrl, 'hls', 'HLS Playback URL')}
              className="text-slate-400 hover:text-cyan-400 transition shrink-0 p-1 cursor-pointer"
              title="Copy HLS URL"
            >
              {copiedField === 'hls' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </Field>

        {/* Row 3: RTMP Ingest / Stream URL */}
        <Field label="RTMP Ingest / Stream URL" hint="Live RTMP broadcast stream ingest endpoint">
          <div className={shellClass}>
            <Radio size={14} className="text-[#00bcd4] shrink-0" />
            <input
              type="text"
              readOnly
              value={finalRtmpUrl}
              className={`${inputClass} font-mono text-[#00bcd4] cursor-default select-all`}
              title="Click and copy RTMP Ingest URL"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(finalRtmpUrl, 'rtmp', 'RTMP Ingest URL')}
              className="text-slate-400 hover:text-cyan-400 transition shrink-0 p-1 cursor-pointer"
              title="Copy RTMP URL"
            >
              {copiedField === 'rtmp' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </Field>

        {/* Row 4: Output Resolution, Video Bitrate & Audio Bitrate */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Output Resolution" hint="FFmpeg canvas dimension">
            <div className={shellClass}>
              <Monitor size={16} className="text-slate-500 shrink-0" />
              <input
                type="text"
                readOnly
                value={resolutionDisplay}
                className={`${inputClass} cursor-default`}
                title="Output Resolution (Read-Only)"
              />
            </div>
          </Field>

          <Field label="Video Bitrate" hint="H.264 video encoder target">
            <div className={shellClass}>
              <Activity size={16} className="text-slate-500 shrink-0" />
              <input
                type="text"
                readOnly
                value={videoBitrateDisplay}
                className={`${inputClass} cursor-default`}
                title="Video Bitrate (Read-Only)"
              />
            </div>
          </Field>

          <Field label="Audio Bitrate" hint="AAC stereo audio encoder target">
            <div className={shellClass}>
              <Volume2 size={16} className="text-slate-500 shrink-0" />
              <input
                type="text"
                readOnly
                value={audioBitrateDisplay}
                className={`${inputClass} cursor-default`}
                title="Audio Bitrate (Read-Only)"
              />
            </div>
          </Field>
        </div>

        {/* Row 5: Frame Rate, Stream Key & Assigned User */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Framerate" hint="Output FPS">
            <div className={shellClass}>
              <Film size={16} className="text-slate-500 shrink-0" />
              <input
                type="text"
                readOnly
                value={fpsDisplay}
                className={`${inputClass} cursor-default`}
                title="Framerate (Read-Only)"
              />
            </div>
          </Field>

          <Field label="Stream Key" hint="Sanitized stream key">
            <div className={shellClass}>
              <Key size={16} className="text-slate-500 shrink-0" />
              <input
                type="text"
                readOnly
                value={streamKey}
                className={`${inputClass} cursor-default select-all`}
                title="Stream Key (Read-Only)"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(streamKey, 'key', 'Stream Key')}
                className="text-slate-400 hover:text-cyan-400 transition shrink-0 p-1 cursor-pointer"
                title="Copy Stream Key"
              >
                {copiedField === 'key' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
          </Field>

          <Field label="Assigned Operator" hint="Channel user">
            <div className={shellClass}>
              <UserIcon size={16} className="text-slate-500 shrink-0" />
              <input
                type="text"
                readOnly
                value={`${assignedUserName} ${assignedUserEmail}`}
                className={`${inputClass} cursor-default truncate`}
                title={`${assignedUserName} ${assignedUserEmail}`}
              />
            </div>
          </Field>
        </div>

        {/* Row 6: Storage Usage */}
        <Field label="Media Storage Usage" hint="Used vs Allocated storage space">
          <div className={shellClass}>
            <HardDrive size={16} className="text-slate-500 shrink-0" />
            <input
              type="text"
              readOnly
              value={storageDisplay}
              className={`${inputClass} cursor-default`}
              title="Storage Usage"
            />
          </div>
        </Field>

        {/* Actions Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-[#1a2234]">
          <button
            type="button"
            onClick={copyAllDetails}
            className="w-full sm:w-auto px-3.5 py-1.5 2xl:py-2 rounded-lg border border-[#1e2638] text-cyan-400 hover:text-white hover:bg-[#161e2e] transition font-semibold flex items-center justify-center gap-1.5 cursor-pointer text-xs"
          >
            {copiedAll ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedAll ? 'All Details Copied!' : 'Copy All Endpoints'}</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onCancel}
              className={FORM_BTN_CANCEL}
            >
              Back to Channels
            </button>

            {onOpenStudio && activeChannel?._id && (
              <button
                type="button"
                onClick={() => onOpenStudio(activeChannel._id)}
                className={FORM_BTN_PRIMARY}
              >
                <ExternalLink size={14} />
                <span>Open Playout Studio</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

