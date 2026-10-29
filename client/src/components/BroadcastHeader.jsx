import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Radio,
  Clock,
  Film,
  Settings,
  Square,
  Play,
  Maximize2,
  Tv,
  Sliders,
  Layers
} from 'lucide-react';

export default function BroadcastHeader({
  channel,
  totalRunTime = '00:00:00',
  isLive = false,
  onToggleLive,
  onOpenSettings,
  onOpenMoreSettings
}) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState('');

  // Ticking 24h digital clock (HH:MM:SS)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hrs}:${mins}:${secs}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 bg-[#0a0c10] border-b border-[#1d2331] px-4 flex items-center justify-between select-none z-30">
      {/* Left: Back button & Channel Info */}
      <div className="flex items-center space-x-3.5">
        <button
          onClick={() => navigate('/channels')}
          className="w-8 h-8 rounded-lg bg-[#141822] border border-[#242c3d] hover:border-[#38455e] hover:bg-[#1a2130] flex items-center justify-center text-slate-300 hover:text-white transition shadow-sm"
          title="Back to Channels"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center space-x-2.5">
          <div className="flex items-center gap-1.5 text-blue-500">
            <Radio size={16} className={isLive ? 'animate-pulse text-red-500' : ''} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-wide text-white uppercase">
                {channel?.name || 'SAI LEELA'}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isLive ? 'bg-red-500 animate-ping' : 'bg-slate-600'
                }`}
              ></span>
            </div>
            <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">
              CONTROL ROOM
            </span>
          </div>
        </div>
      </div>

      {/* Center: Realtime Clock & Total Run Time widgets */}
      <div className="hidden md:flex items-center space-x-3">
        {/* Realtime clock */}
        <div className="flex items-center space-x-2 bg-[#12161f] border border-[#222938] px-3 py-1 rounded-xl text-slate-200 shadow-inner">
          <Clock size={14} className="text-blue-400" />
          <span className="font-mono text-xs font-semibold tracking-wider">
            {currentTime}
          </span>
        </div>

        {/* Total Run Time */}
        <div className="flex items-center space-x-2 bg-[#12161f] border border-[#222938] px-3 py-1 rounded-xl shadow-inner">
          <Film size={14} className="text-amber-400" />
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
              Total Run Time
            </span>
            <span className="font-mono text-xs font-semibold text-slate-200">
              {totalRunTime}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Live broadcast toggle, Settings, Fullscreen */}
      <div className="flex items-center space-x-3">
        {/* Live indicator dot/tower */}
        <div
          className={`p-1.5 rounded-lg border flex items-center justify-center transition ${
            isLive
              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400 shadow-sm shadow-emerald-500/20'
              : 'bg-[#141822] border-[#242c3d] text-slate-600'
          }`}
          title={isLive ? 'Stream is ON AIR' : 'Stream is IDLE'}
        >
          <Radio size={14} className={isLive ? 'animate-pulse' : ''} />
        </div>

        {/* START LIVE / STOP LIVE Button */}
        <button
          onClick={onToggleLive}
          className={`px-4 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition shadow-lg ${
            isLive
              ? 'bg-[#ef4444] hover:bg-red-600 active:bg-red-700 text-white shadow-red-600/30 animate-pulse'
              : 'bg-[#10b981] hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-emerald-600/20'
          }`}
        >
          {isLive ? (
            <>
              <Square size={13} className="fill-current" />
              <span>STOP LIVE</span>
            </>
          ) : (
            <>
              <Play size={13} className="fill-current" />
              <span>START LIVE</span>
            </>
          )}
        </button>

        {/* More Setting Button */}
        <button
          onClick={onOpenMoreSettings}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-purple-900/40 hover:from-blue-800/60 hover:to-purple-800/60 border border-blue-500/40 hover:border-blue-400/80 text-blue-200 hover:text-white transition flex items-center gap-1.5 text-xs font-bold tracking-wider shadow-sm group"
          title="Open Ad & Playout Graphics Dashboard (L-Band, Ashton Band)"
        >
          <Sliders size={13} className="text-blue-400 group-hover:rotate-45 transition duration-200" />
          <span className="uppercase text-[10px] tracking-wider font-extrabold">More Setting</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg bg-[#141822] border border-[#242c3d] text-slate-300 hover:text-white hover:bg-[#1a2130] transition flex items-center gap-1.5 text-xs font-semibold px-2.5"
          title="Channel Stream Settings"
        >
          <Settings size={14} />
          <span className="hidden sm:inline uppercase text-[10px]">Settings</span>
        </button>
      </div>
    </header>
  );
}
