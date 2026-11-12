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
  Layers,
  Calendar
} from 'lucide-react';

export default function BroadcastHeader({
  channel,
  totalRunTime = '00:00:00',
  isLive = false,
  onToggleLive,
  onOpenSettings,
  onOpenMoreSettings,
  onOpenSchedules,
  currentOnAirSchedule = null
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
    <header className="min-h-11 lg:h-11 2xl:h-13 bg-[#0a0c10] border-b border-[#1d2331] px-2.5 sm:px-3.5 2xl:px-5 py-1.5 lg:py-0 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 select-none z-30 shrink-0">
      {/* Left: Back button & Channel Info */}
      <div className="flex items-center gap-2 sm:gap-2.5 2xl:gap-3.5 min-w-0">
        <button
          onClick={() => navigate('/channels')}
          className="w-7 h-7 2xl:w-8 2xl:h-8 rounded-lg bg-[#141822] border border-[#242c3d] hover:border-[#38455e] hover:bg-[#1a2130] flex items-center justify-center text-slate-300 hover:text-white transition shadow-sm shrink-0"
          title="Back to Channels"
        >
          <ArrowLeft size={14} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center text-blue-500 shrink-0">
            <Radio size={14} className={isLive ? 'animate-pulse text-red-500' : ''} />
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs 2xl:text-sm tracking-wide text-white uppercase truncate max-w-32.5 sm:max-w-50 2xl:max-w-none">
                {channel?.name || 'SAI LEELA'}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLive ? 'bg-red-500 animate-ping' : 'bg-slate-600'
                  }`}
              ></span>
            </div>
            <span className="text-[8px] 2xl:text-[9px] font-bold text-slate-400 tracking-widest uppercase">
              CONTROL ROOM
            </span>
          </div>
        </div>
      </div>

      {/* Center: Realtime Clock & Total Run Time widgets */}
      <div className="hidden md:flex items-center gap-2 2xl:gap-3">
        {/* Realtime clock */}
        <div className="flex items-center gap-1.5 bg-[#12161f] border border-[#222938] px-2.5 py-0.5 2xl:px-3 2xl:py-1 rounded-lg 2xl:rounded-xl text-slate-200 shadow-inner">
          <Clock size={12} className="text-blue-400" />
          <span className="font-mono text-[11px] 2xl:text-xs font-semibold tracking-wider">
            {currentTime}
          </span>
        </div>
      </div>

      {/* Right: Live broadcast toggle, Schedules, Dashboard, More Setting */}
      <div className="flex items-center gap-1.5 2xl:gap-2.5 flex-wrap">
        <div
          className={`hidden sm:flex p-1 2xl:p-1.5 rounded-md 2xl:rounded-lg border items-center justify-center transition ${isLive
            ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400 shadow-sm shadow-emerald-500/20'
            : 'bg-[#141822] border-[#242c3d] text-slate-600'
            }`}
          title={isLive ? 'Stream is ON AIR' : 'Stream is IDLE'}
        >
          <Radio size={12} className={isLive ? 'animate-pulse' : ''} />
        </div>

        {/* START LIVE / STOP LIVE Button */}
        <button
          onClick={onToggleLive}
          className={`px-2.5 py-1 2xl:px-4 2xl:py-1.5 rounded-lg 2xl:rounded-xl font-bold text-[10.5px] 2xl:text-xs uppercase tracking-wider flex items-center gap-1.5 transition shadow-lg shrink-0 ${isLive
            ? 'bg-[#ef4444] hover:bg-red-600 active:bg-red-700 text-white shadow-red-600/30 animate-pulse'
            : 'bg-[#10b981] hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
        >
          {isLive ? (
            <>
              <Square size={11} className="fill-current" />
              <span>STOP LIVE</span>
            </>
          ) : (
            <>
              <Play size={11} className="fill-current" />
              <span>START LIVE</span>
            </>
          )}
        </button>

        {/* Schedules Playout Button */}
        <button
          onClick={onOpenSchedules}
          className={`px-2 sm:px-2.5 py-1 2xl:px-3 2xl:py-1.5 rounded-md 2xl:rounded-lg border flex items-center gap-1 text-[10px] font-bold tracking-wider shadow-sm transition group shrink-0 ${currentOnAirSchedule
            ? 'bg-amber-950/80 border-amber-500 text-amber-300 animate-pulse shadow-amber-500/30'
            : 'bg-linear-to-r from-amber-950/40 via-orange-950/40 to-yellow-950/40 hover:from-amber-900/60 hover:to-orange-900/60 border-amber-500/40 hover:border-amber-400/80 text-amber-200 hover:text-white'
            }`}
          title="Open Scheduled Video Playout Manager"
        >
          <Calendar size={12} className={currentOnAirSchedule ? 'text-amber-300 animate-bounce' : 'text-amber-400 group-hover:scale-110 transition duration-200'} />
          <span className="hidden sm:inline uppercase text-[9.5px] 2xl:text-[10px] tracking-wider font-extrabold">
            {currentOnAirSchedule ? 'SCHEDULE LIVE' : 'Schedules'}
          </span>
        </button>

        {/* Dashboard button */}
        <button
          onClick={() => { navigate('/dashboard') }}
          className="px-2 sm:px-2.5 py-1 2xl:px-3 2xl:py-1.5 rounded-md 2xl:rounded-lg bg-linear-to-r from-blue-900/40 cursor-pointer text-blue-200 hover:text-white transition flex items-center gap-1 text-[10px] font-bold tracking-wider shadow-sm group shrink-0"
          title="Open Ad & Playout Graphics Dashboard (L-Band, Ashton Band)"
        >
          <Sliders size={12} className="text-blue-400 group-hover:rotate-45 transition duration-200" />
          <span className="hidden sm:inline uppercase text-[9.5px] 2xl:text-[10px] tracking-wider font-extrabold">Dashboard</span>
        </button>

        {/* More Setting Button */}
        <button
          onClick={onOpenMoreSettings}
          className="px-2 sm:px-2.5 py-1 2xl:px-3 2xl:py-1.5 rounded-md 2xl:rounded-lg bg-linear-to-r from-blue-900/40 via-indigo-900/40 to-purple-900/40 hover:from-blue-800/60 hover:to-purple-800/60 border border-blue-500/40 hover:border-blue-400/80 text-blue-200 hover:text-white transition flex items-center gap-1 text-[10px] font-bold tracking-wider shadow-sm group shrink-0"
          title="Open Ad & Playout Graphics Dashboard (L-Band, Ashton Band)"
        >
          <Sliders size={12} className="text-blue-400 group-hover:rotate-45 transition duration-200" />
          <span className="hidden sm:inline uppercase text-[9.5px] 2xl:text-[10px] tracking-wider font-extrabold">More Setting</span>
        </button>
      </div>

    </header>
  );
}
