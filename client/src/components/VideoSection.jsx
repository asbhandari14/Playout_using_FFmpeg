import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Radio, Play, Pause, Volume2, VolumeX, Maximize, Film } from 'lucide-react';
import api from '../api/axios.js';

export default function VideoSection({ channel, selectedAsset, isLive = false }) {
  const localVideoRef = useRef(null);
  const liveVideoRef = useRef(null);
  const hlsInstanceRef = useRef(null);
  const currentLoadedHlsUrlRef = useRef(null);
  const consecutiveFailuresRef = useRef(0);

  const [liveMuted, setLiveMuted] = useState(true);
  const [hlsError, setHlsError] = useState(false);
  const [isChannelOnline, setIsChannelOnline] = useState(false);
  const [checkingOnline, setCheckingOnline] = useState(false);

  // Live Program (PGM) always plays the channel's official HLS stream URL (nothing less, nothing more)
  const hlsUrl = channel?.hlsUrl?.trim()
    || (channel?.server?.hlsBaseUrl && (channel?.streamKey || channel?.name)
      ? `${channel.server.hlsBaseUrl.replace(/\/+$/, '')}/${channel.streamKey || channel.name}/index.m3u8`
      : (channel?._id ? `/streams/${channel._id}/hls/index.m3u8` : null));

  // Polling: Continuously check whether channel status is Online or Offline via CheckChannelOnlineOrOffline
  useEffect(() => {
    let isSubscribed = true;
    let pollTimer = null;

    if (!isLive || !hlsUrl) {
      consecutiveFailuresRef.current = 0;
      setIsChannelOnline(false);
      return;
    }

    const checkOnlineStatus = async () => {
      try {
        setCheckingOnline(true);
        const res = await api.post('/channels/check-online', { hlsUrl });
        if (isSubscribed) {
          const online = res.data?.status === 'Online' || res.data?.isOnline === true;
          if (online) {
            consecutiveFailuresRef.current = 0;
            setIsChannelOnline(true);
          } else {
            consecutiveFailuresRef.current += 1;
            // Require 3 consecutive failed checks (approx 9s) before marking offline during active live broadcast
            if (consecutiveFailuresRef.current >= 3) {
              setIsChannelOnline(false);
            }
          }
        }
      } catch {
        if (isSubscribed) {
          consecutiveFailuresRef.current += 1;
          if (consecutiveFailuresRef.current >= 3) {
            setIsChannelOnline(false);
          }
        }
      } finally {
        if (isSubscribed) {
          setCheckingOnline(false);
        }
      }
    };

    // Immediate initial check
    checkOnlineStatus();

    // Continuous polling: poll every 3 seconds while isLive is active
    pollTimer = setInterval(checkOnlineStatus, 3000);

    return () => {
      isSubscribed = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [isLive, hlsUrl]);

  // Setup HLS player for LIVE PROGRAM (PGM) when channel is confirmed online
  useEffect(() => {
    if (!liveVideoRef.current) return;

    if (isLive && isChannelOnline && hlsUrl) {
      // If an HLS instance is already active and playing this exact URL, refresh source & resume playback!
      if (hlsInstanceRef.current && currentLoadedHlsUrlRef.current === hlsUrl) {
        try {
          hlsInstanceRef.current.loadSource(hlsUrl);
          hlsInstanceRef.current.startLoad();
        } catch {}
        if (liveVideoRef.current && liveVideoRef.current.paused) {
          liveVideoRef.current.play().catch(() => {});
        }
        return;
      }

      currentLoadedHlsUrlRef.current = hlsUrl;
      setHlsError(false);

      if (Hls.isSupported()) {
        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy();
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 1, // Only buffer 1 segment behind live edge
          liveMaxLatencyDurationCount: 2, // Never let player lag more than 2 segments
          maxBufferLength: 4, // Max 4 seconds buffer
          maxMaxBufferLength: 6
        });

        hls.loadSource(hlsUrl);
        hls.attachMedia(liveVideoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setHlsError(false);
          liveVideoRef.current?.play().catch(() => {
            if (liveVideoRef.current) {
              liveVideoRef.current.muted = true;
              setLiveMuted(true);
              liveVideoRef.current.play().catch(() => { });
            }
          });
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          setHlsError(false);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Auto-retry when network disconnects without destroying player
                console.warn('[HLS PGM] Network error encountered, retrying startLoad in 2s...');
                setTimeout(() => {
                  if (hlsInstanceRef.current) {
                    try {
                      hlsInstanceRef.current.loadSource(hlsUrl);
                      hlsInstanceRef.current.startLoad();
                    } catch {}
                  }
                }, 2000);
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                if (hlsInstanceRef.current) {
                  hlsInstanceRef.current.destroy();
                  hlsInstanceRef.current = null;
                }
                currentLoadedHlsUrlRef.current = null;
                break;
            }
          }
        });

        hlsInstanceRef.current = hls;
      } else if (liveVideoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari/iOS)
        liveVideoRef.current.src = hlsUrl;
        liveVideoRef.current.play().catch(() => { });
      }
    } else if (!isLive) {
      // Only tear down and clear media when explicitly toggled off air
      currentLoadedHlsUrlRef.current = null;
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (liveVideoRef.current) {
        liveVideoRef.current.removeAttribute('src');
        liveVideoRef.current.load();
      }
    }

    return () => {
      // Cleanup on unmount
      if (!isLive && hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [isLive, isChannelOnline, hlsUrl]);

  return (
    <div className="flex flex-col bg-[#0f1218] border-b border-[#1f2635]">
      {/* Header with status badge */}
      <div className="px-4 py-2.5 bg-[#12161f] border-b border-[#1f2635] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film size={15} className="text-blue-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 m-0">
            Playout Production Deck
          </h2>
        </div>

        {/* Live on air badge */}
        <div
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition ${isLive && isChannelOnline
            ? 'bg-red-500/10 border border-red-500/40 text-red-400 shadow-sm'
            : isLive
              ? 'bg-amber-500/10 border border-amber-500/40 text-amber-400 shadow-sm'
              : 'bg-slate-800 border border-slate-700 text-slate-400'
            }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isLive && isChannelOnline
              ? 'bg-red-400 animate-ping'
              : isLive
                ? 'bg-amber-400 animate-ping'
                : 'bg-slate-500'
              }`}
          ></span>
          <span>
            {isLive && isChannelOnline
              ? 'Live HLS on air'
              : isLive
                ? (checkingOnline ? 'Polling HLS feed...' : 'Connecting to HLS stream...')
                : 'Playout Deck Standby'}
          </span>
        </div>
      </div>

      {/* Two players side by side */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: LOCAL PREVIEW */}
        <div className="bg-[#141822] border border-[#232b3c] rounded-xl overflow-hidden flex flex-col shadow-lg">
          <div className="px-3 py-1.5 bg-[#161b26] border-b border-[#232b3c] flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-300">
            <span>Local Preview</span>
            {selectedAsset && (
              <span className="text-[10px] font-normal text-slate-400 truncate max-w-[180px]">
                {selectedAsset.originalName}
              </span>
            )}
          </div>

          <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group">
            {selectedAsset?.filePath ? (
              <video
                ref={localVideoRef}
                key={selectedAsset._id}
                src={`/${selectedAsset.filePath}`}
                controls
                className="w-full h-full object-contain"
                poster={selectedAsset.thumbnailPath ? `/${selectedAsset.thumbnailPath}` : undefined}
              />
            ) : (
              <div className="text-center p-4 text-slate-500 text-xs flex flex-col items-center">
                <Film size={26} className="text-slate-600 mb-1.5" />
                <span>Select any video from Assets Library</span>
                <span className="text-[10px] text-slate-600">to preview locally before broadcast</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: LIVE PROGRAM (PGM) */}
        <div
          className={`bg-[#141822] border rounded-xl overflow-hidden flex flex-col shadow-lg transition ${isLive && isChannelOnline
            ? 'border-red-600/70 shadow-red-950/20'
            : isLive
              ? 'border-amber-600/50 shadow-amber-950/20'
              : 'border-[#232b3c]'
            }`}
        >
          <div className="px-3 py-1.5 bg-[#161b26] border-b border-[#232b3c] flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5 text-red-500">
              <Radio size={13} className={isLive && isChannelOnline ? 'animate-pulse text-red-500' : isLive ? 'animate-pulse text-amber-500' : 'text-slate-500'} />
              <span className="text-slate-100">Live Program (PGM)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${isLive && isChannelOnline
                  ? 'bg-red-950/80 text-red-400 border border-red-800 animate-pulse'
                  : isLive
                    ? 'bg-amber-950/80 text-amber-400 border border-amber-800 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
              >
                {isLive && isChannelOnline ? 'ON AIR' : isLive ? 'CONNECTING' : 'OFF AIR'}
              </span>
            </div>
          </div>

          <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
            {/* The live video element stays permanently mounted in the DOM to avoid GPU/Direct3D decoder rebuilds and green/black flashes */}
            <video
              ref={liveVideoRef}
              className={`w-full h-full object-contain transition-opacity duration-300 ${isLive && isChannelOnline ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              muted={liveMuted}
              autoPlay
              playsInline
            />

            {/* Volume toggle button for Live PGM */}
            {isLive && isChannelOnline && (
              <button
                onClick={() => {
                  const next = !liveMuted;
                  setLiveMuted(next);
                  if (liveVideoRef.current) liveVideoRef.current.muted = next;
                }}
                className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white backdrop-blur transition z-10"
                title={liveMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {liveMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
            )}

            {/* Transient HLS syncing overlay */}
            {isLive && isChannelOnline && hlsError && (
              <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-center p-4 z-10">
                <Radio size={24} className="text-amber-500 animate-pulse mb-2" />
                <span className="text-xs font-semibold text-slate-200">
                  Syncing RTMP / HLS Stream...
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                  Buffering initial live segments
                </span>
              </div>
            )}

            {/* Connecting screen */}
            {isLive && !isChannelOnline && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/90 z-10">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
                  <Radio size={20} className="animate-pulse text-amber-400" />
                </div>
                <span className="font-semibold text-slate-200">Checking Live Stream Availability...</span>
                <span className="text-[10px] text-amber-400/90 mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  Polling HLS feed on Flussonic Media Server ({checkingOnline ? 'Querying...' : 'Waiting for broadcast'})
                </span>
              </div>
            )}

            {/* Playout Standby / Offline screen */}
            {!isLive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-[#0a0d14] z-10">
                <div className="w-9 h-9 rounded-full bg-red-950/20 border border-red-900/30 flex items-center justify-center text-red-400 mb-2">
                  <Radio size={18} />
                </div>
                <span className="font-semibold text-slate-300">Live Stream Offline</span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Click 'START LIVE' above to push playout feed to Flussonic RTMP
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
