import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Server as ServerIcon,
  User as UserIcon,
  AlertTriangle,
  Megaphone,
  Radio,
  Calendar,
  Layers,
  Info
} from 'lucide-react';

const ACTIVE_CLASS =
  "bg-[#101726] text-white relative before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-6 before:bg-[#00bcd4] before:rounded-r-full";
const INACTIVE_CLASS = 'text-slate-400 hover:text-slate-200 hover:bg-[#111726]/60';
const BASE_CLASS =
  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-base transition cursor-pointer';

export default function DashboardSidebar({ currentUser, isOpen, activeSection, onNavigate }) {
  const navigate = useNavigate();

  const handleNav = (section, routePath) => {
    if (onNavigate) {
      onNavigate(section);
    }
    if (routePath) {
      navigate(routePath);
    }
  };

  const isChannelsActive = activeSection === 'channels' || activeSection === 'dashboard';
  const isInfoActive = activeSection === 'info';
  const isServersActive = activeSection === 'servers';
  const isUsersActive = activeSection === 'users';
  const isDefaultActive = activeSection === 'default_playlist';
  const isSchedulingActive = activeSection === 'scheduling_playlist';
  const isLiveActive = activeSection === 'live_schedule';
  const isAdActive = activeSection === 'advertisement_playlist';
  const isEmergencyActive = activeSection === 'emergency_playlist';

  return (
    <aside
      className={`${
        isOpen ? 'w-64 xl:w-64' : 'w-0 -translate-x-full'
      } bg-[#090d16] border-r border-[#141b2b] flex flex-col shrink-0 transition-all duration-300 overflow-y-auto select-none`}
    >
      {/* Greeting */}
      <div className="px-5 pt-5 pb-2">
        <span className="text-xs text-slate-400 tracking-wide block truncate">
          Hi, {currentUser?.name || 'Super Admin Account'}
        </span>
        <span className="text-[10px] text-cyan-400 uppercase font-mono tracking-wider">
          {currentUser?.role || 'Admin'}
        </span>
      </div>

      {/* Main Management Section */}
      <nav className="p-3 space-y-1 text-xs">
        <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
          Management
        </div>

        <button
          onClick={() => handleNav('channels', '/dashboard')}
          className={`${BASE_CLASS} ${isChannelsActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <div className="flex items-center gap-3">
            <LayoutDashboard size={18} className={isChannelsActive ? 'text-[#00bcd4]' : ''} />
            <span>Channel</span>
          </div>
        </button>

        <button
          onClick={() => handleNav('servers', '/servers')}
          className={`${BASE_CLASS} ${isServersActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <div className="flex items-center gap-3">
            <ServerIcon size={18} className={isServersActive ? 'text-[#00bcd4]' : ''} />
            <span>Server</span>
          </div>
        </button>

        <button
          onClick={() => handleNav('users', '/users')}
          className={`${BASE_CLASS} ${isUsersActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <div className="flex items-center gap-3">
            <UserIcon size={18} className={isUsersActive ? 'text-[#00bcd4]' : ''} />
            <span>User</span>
          </div>
        </button>

        <button
          onClick={() => handleNav('info', '/info')}
          className={`${BASE_CLASS} ${isInfoActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <div className="flex items-center gap-3">
            <Info size={18} className={isInfoActive ? 'text-[#00bcd4]' : ''} />
            <span>Info</span>
          </div>
        </button>

        {/* Playlists & Playout Section */}
        <div className="pt-4 px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
          Playlists & Playout
        </div>

        {/* 1. Emergency Playlist (Priority 5) */}
        <button
          onClick={() => handleNav('emergency_playlist', '/playlists/emergency')}
          className={`${BASE_CLASS} ${isEmergencyActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className={isEmergencyActive ? 'text-rose-400' : 'text-rose-500/80'} />
            <span>Emergency Playlist</span>
          </div>
          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
            P5
          </span>
        </button>

        {/* 2. Advertisement Playlist (Priority 4) */}
        <button
          onClick={() => handleNav('advertisement_playlist', '/playlists/advertisement')}
          className={`${BASE_CLASS} ${isAdActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <div className="flex items-center gap-3">
            <Megaphone size={18} className={isAdActive ? 'text-amber-400' : 'text-amber-500/80'} />
            <span>Ad Playlist</span>
          </div>
          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            P4
          </span>
        </button>

        {/* 3. Live Scheduling (Priority 3) */}
        <button
          onClick={() => handleNav('live_schedule', '/playlists/live-schedule')}
          className={`${BASE_CLASS} ${isLiveActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <div className="flex items-center gap-3">
            <Radio size={18} className={isLiveActive ? 'text-purple-400' : 'text-purple-500/80'} />
            <span>Live Scheduling</span>
          </div>
          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
            P3
          </span>
        </button>

        {/* 4. Scheduling Playlist (Priority 2) */}
        <button
          onClick={() => handleNav('scheduling_playlist', '/playlists/scheduling')}
          className={`${BASE_CLASS} ${isSchedulingActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <div className="flex items-center gap-3">
            <Calendar size={18} className={isSchedulingActive ? 'text-blue-400' : 'text-blue-500/80'} />
            <span>Scheduling Playlist</span>
          </div>
          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            P2
          </span>
        </button>

        {/* 5. Default Playlist (Priority 1) */}
        <button
          onClick={() => handleNav('default_playlist', '/playlists/default')}
          className={`${BASE_CLASS} ${isDefaultActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <div className="flex items-center gap-3">
            <Layers size={18} className={isDefaultActive ? 'text-emerald-400' : 'text-emerald-500/80'} />
            <span>Default Playlist</span>
          </div>
          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            P1
          </span>
        </button>
      </nav>
    </aside>
  );
}
