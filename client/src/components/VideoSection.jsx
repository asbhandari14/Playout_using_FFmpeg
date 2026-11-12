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
  const lastMediaRecoveryRef = useRef(0);
  const stallRecoveryTimerRef = useRef(null);

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

  const recoverStalledLiveVideo = () => {
    const video = liveVideoRef.current;
    if (video && video.buffered && video.buffered.length > 0) {
      const liveEnd = video.buffered.end(video.buffered.length - 1);
      if (liveEnd - video.currentTime > 1.5) {
        video.currentTime = Math.max(video.currentTime, liveEnd - 2);
      }
    }
    if (hlsInstanceRef.current) {
      try {
        hlsInstanceRef.current.startLoad();
      } catch { }
    }
    if (video && video.paused) {
      video.play().catch(() => { });
    }
  };

  // Destroy HLS instance cleanly on component unmount
  useEffect(() => {
    return () => {
      if (stallRecoveryTimerRef.current) {
        clearTimeout(stallRecoveryTimerRef.current);
        stallRecoveryTimerRef.current = null;
      }
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      currentLoadedHlsUrlRef.current = null;
    };
  }, []);

  // Setup HLS player for LIVE PROGRAM (PGM) when channel is confirmed online
  useEffect(() => {
    if (!liveVideoRef.current) return;

    if (isLive && isChannelOnline && hlsUrl) {
      // Keep active MSE buffer intact when polling re-runs with the same stream URL
      if (hlsInstanceRef.current && currentLoadedHlsUrlRef.current === hlsUrl) {
        if (liveVideoRef.current && liveVideoRef.current.paused) {
          liveVideoRef.current.play().catch(() => { });
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
          lowLatencyMode: false,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
          maxBufferLength: 12,
          maxMaxBufferLength: 24,
          maxBufferHole: 1.5,
          nudgeOffset: 0.2,
          nudgeMaxRetry: 10,
          fragLoadingMaxRetry: 6,
          manifestLoadingMaxRetry: 6,
          levelLoadingMaxRetry: 6
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
          if (!data.fatal) {
            if (
              data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
              data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL ||
              data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE
            ) {
              recoverStalledLiveVideo();
            }
            return;
          }

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Auto-retry when network disconnects without destroying player
              console.warn('[HLS PGM] Network error encountered, retrying startLoad in 2s...');
              setTimeout(() => {
                if (hlsInstanceRef.current) {
                  try {
                    if (
                      data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                      data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR
                    ) {
                      hlsInstanceRef.current.loadSource(hlsUrl);
                    }
                    hlsInstanceRef.current.startLoad();
                  } catch { }
                }
              }, 2000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR: {
              const now = Date.now();
              if (now - lastMediaRecoveryRef.current >= 4000) {
                lastMediaRecoveryRef.current = now;
                hls.recoverMediaError();
              } else {
                setTimeout(() => {
                  if (hlsInstanceRef.current === hls) {
                    lastMediaRecoveryRef.current = Date.now();
                    hls.recoverMediaError();
                  }
                }, 4000);
              }
              break;
            }
            default:
              if (hlsInstanceRef.current) {
                hlsInstanceRef.current.destroy();
                hlsInstanceRef.current = null;
              }
              currentLoadedHlsUrlRef.current = null;
              break;
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
    <div className="flex flex-col bg-[#0f1218] border-b border-[#1f2635] shrink-0">
      {/* Header with status badge */}
      <div className="px-3 py-1.5 2xl:px-4 2xl:py-2 bg-[#12161f] border-b border-[#1f2635] flex items-center justify-between">
        <div className="flex items-center gap-1.5 2xl:gap-2">
          <Film size={13} className="text-blue-500" />
          <h2 className="text-[11px] 2xl:text-xs font-bold uppercase tracking-wider text-slate-200 m-0">
            Playout Production Deck
          </h2>
        </div>

        {/* Live on air badge */}
        <div
          className={`px-2.5 py-0.5 2xl:px-3 2xl:py-1 rounded-full text-[9px] 2xl:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition ${isLive && isChannelOnline
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
              ? 'Live'
              : isLive
                ? (checkingOnline ? 'Polling HLS feed...' : 'Connecting to HLS stream...')
                : 'Playout Deck Standby'}
          </span>
        </div>
      </div>

      {/* Two players side by side */}
      <div className="p-2 2xl:p-3 grid grid-cols-1 md:grid-cols-2 gap-2 2xl:gap-3">
        {/* Left: LOCAL PREVIEW */}
        <div className="bg-[#141822] border border-[#232b3c] rounded-lg 2xl:rounded-xl overflow-hidden flex flex-col shadow-lg">
          <div className="px-2.5 py-1 2xl:px-3 2xl:py-1.5 bg-[#161b26] border-b border-[#232b3c] flex items-center justify-between text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-slate-300">
            <span>Local Preview</span>
            {selectedAsset && (
              <span className="text-[9.5px] 2xl:text-[10px] font-normal text-slate-400 truncate max-w-[160px] 2xl:max-w-[220px]">
                {selectedAsset.originalName}
              </span>
            )}
          </div>

          <div className="relative w-full aspect-video max-h-[195px] xl:max-h-[215px] 2xl:max-h-[275px] min-[1800px]:max-h-[340px] bg-black flex items-center justify-center overflow-hidden group">
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
              <div className="text-center p-3 text-slate-500 text-[11px] 2xl:text-xs flex flex-col items-center">
                <Film size={22} className="text-slate-600 mb-1" />
                <span>Select any video from Assets Library</span>
                <span className="text-[9.5px] 2xl:text-[10px] text-slate-600">to preview locally before broadcast</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: LIVE PROGRAM (PGM) */}
        <div
          className={`bg-[#141822] border rounded-lg 2xl:rounded-xl overflow-hidden flex flex-col shadow-lg transition ${isLive && isChannelOnline
            ? 'border-red-600/70 shadow-red-950/20'
            : isLive
              ? 'border-amber-600/50 shadow-amber-950/20'
              : 'border-[#232b3c]'
            }`}
        >
          <div className="px-2.5 py-1 2xl:px-3 2xl:py-1.5 bg-[#161b26] border-b border-[#232b3c] flex items-center justify-between text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5 text-red-500">
              <Radio size={12} className={isLive && isChannelOnline ? 'animate-pulse text-red-500' : isLive ? 'animate-pulse text-amber-500' : 'text-slate-500'} />
              <span className="text-slate-100">Live Program (PGM)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={`text-[8.5px] 2xl:text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${isLive && isChannelOnline
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

          <div className="relative w-full aspect-video max-h-[195px] xl:max-h-[215px] 2xl:max-h-[275px] min-[1800px]:max-h-[340px] bg-black flex items-center justify-center overflow-hidden">
            {/* The live video element stays permanently mounted in the DOM to avoid GPU/Direct3D decoder rebuilds and green/black flashes */}
            <video
              ref={liveVideoRef}
              className={`w-full h-full object-contain transition-opacity duration-300 ${isLive && isChannelOnline ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              muted={liveMuted}
              autoPlay
              playsInline
              onPlaying={() => {
                setHlsError(false);
                if (stallRecoveryTimerRef.current) {
                  clearTimeout(stallRecoveryTimerRef.current);
                  stallRecoveryTimerRef.current = null;
                }
              }}
              onWaiting={() => {
                if (!isLive || !isChannelOnline || stallRecoveryTimerRef.current) return;
                stallRecoveryTimerRef.current = setTimeout(() => {
                  stallRecoveryTimerRef.current = null;
                  recoverStalledLiveVideo();
                }, 4000);
              }}
              onStalled={() => {
                if (!isLive || !isChannelOnline || stallRecoveryTimerRef.current) return;
                stallRecoveryTimerRef.current = setTimeout(() => {
                  stallRecoveryTimerRef.current = null;
                  recoverStalledLiveVideo();
                }, 3000);
              }}
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
                {liveMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            )}

            {/* Transient HLS syncing overlay */}
            {isLive && isChannelOnline && hlsError && (
              <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-center p-3 z-10">
                <Radio size={20} className="text-amber-500 animate-pulse mb-1.5" />
                <span className="text-[11px] 2xl:text-xs font-semibold text-slate-200">
                  Syncing RTMP / HLS Stream...
                </span>
                <span className="text-[9.5px] 2xl:text-[10px] text-slate-400 mt-0.5">
                  Buffering initial live segments
                </span>
              </div>
            )}

            {/* Connecting screen */}
            {isLive && !isChannelOnline && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 bg-black/90 z-10">
                <div className="w-8 h-8 2xl:w-10 2xl:h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-1.5">
                  <Radio size={17} className="animate-pulse text-amber-400" />
                </div>
                <span className="text-[11px] 2xl:text-xs font-semibold text-slate-200">Checking Live Stream Availability...</span>
                <span className="text-[9.5px] 2xl:text-[10px] text-amber-400/90 mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  Polling HLS feed on Flussonic Media Server ({checkingOnline ? 'Querying...' : 'Waiting for broadcast'})
                </span>
              </div>
            )}

            {/* Playout Standby / Offline screen */}
            {!isLive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 bg-[#0a0d14] z-10">
                <div className="w-8 h-8 2xl:w-9 2xl:h-9 rounded-full bg-red-950/20 border border-red-900/30 flex items-center justify-center text-red-400 mb-1.5">
                  <Radio size={16} />
                </div>
                <span className="text-[11px] 2xl:text-xs font-semibold text-slate-300">Live Stream Offline</span>
                <span className="text-[9.5px] 2xl:text-[10px] text-slate-500 mt-0.5">
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
