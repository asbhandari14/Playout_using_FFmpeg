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
  Info,
  PanelBottom,
  CreditCard
} from 'lucide-react';

const ACTIVE_CLASS =
  "bg-[#131b2b] text-white font-semibold relative before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-5 before:bg-[#00bcd4] before:rounded-r-full";
const INACTIVE_CLASS = 'text-slate-400 hover:text-slate-200 hover:bg-[#131926]';
const BASE_CLASS =
  'w-full flex items-center justify-between px-2.5 py-1.5 2xl:px-3 2xl:py-2 rounded-lg font-mono text-sm 2xl:text-[13px] transition cursor-pointer';

export default function DashboardSidebar({
  currentUser,
  isOpen,
  onClose,
  activeSection,
  onNavigate
}) {
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
  const isLBandActive = activeSection === 'lband';
  const isAshtonActive = activeSection === 'ashton';

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static top-11 bottom-0 left-0 z-40 lg:z-auto ${isOpen
          ? 'w-52 xl:w-56 2xl:w-64 translate-x-0'
          : 'w-52 lg:w-0 -translate-x-full lg:border-r-0 lg:overflow-hidden'
          } bg-[#0d111a] border-r border-[#1e2638] flex flex-col shrink-0 transition-all duration-200 overflow-y-auto select-none`}
      >
        {/* Greeting */}
        <div className="px-4 pt-3.5 pb-2 border-b border-[#182032]">
          <span className="text-[11px] 2xl:text-xs font-medium text-slate-300 block truncate">
            Hi, {currentUser?.name || 'Super Admin'}
          </span>
          <span className="text-[9.5px] text-cyan-400 uppercase font-mono tracking-wider">
            {currentUser?.role || 'Admin'}
          </span>
        </div>

        {/* Main Management Section */}
        <nav className="p-2.5 2xl:p-3 space-y-0.5 text-xs">
          <div className="px-2.5 py-1 text-[9.5px] 2xl:text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Management
          </div>

          <button
            onClick={() => handleNav('channels', '/dashboard')}
            className={`${BASE_CLASS} ${isChannelsActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard size={15} className={isChannelsActive ? 'text-[#00bcd4]' : ''} />
              <span>Channel</span>
            </div>
          </button>

          <button
            onClick={() => handleNav('servers', '/servers')}
            className={`${BASE_CLASS} ${isServersActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              <ServerIcon size={15} className={isServersActive ? 'text-[#00bcd4]' : ''} />
              <span>Server</span>
            </div>
          </button>

          <button
            onClick={() => handleNav('users', '/users')}
            className={`${BASE_CLASS} ${isUsersActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              <UserIcon size={15} className={isUsersActive ? 'text-[#00bcd4]' : ''} />
              <span>User</span>
            </div>
          </button>

          <button
            onClick={() => handleNav('info', '/info')}
            className={`${BASE_CLASS} ${isInfoActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              <Info size={15} className={isInfoActive ? 'text-[#00bcd4]' : ''} />
              <span>Info</span>
            </div>
          </button>

          {/* Playlists & Playout Section */}
          <div className="pt-3 px-2.5 py-1 text-[9.5px] 2xl:text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Playlists & Playout
          </div>

          {/* 1. Emergency Playlist (Priority 5) */}
          <button
            onClick={() => handleNav('emergency_playlist', '/playlists/emergency')}
            className={`${BASE_CLASS} ${isEmergencyActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              {/* <AlertTriangle size={15} className={isEmergencyActive ? 'text-rose-400' : 'text-rose-500/80'} /> */}
              <span>Emergency Playlist</span>
            </div>
          </button>

          {/* 2. Advertisement Playlist (Priority 4) */}
          <button
            onClick={() => handleNav('advertisement_playlist', '/playlists/advertisement')}
            className={`${BASE_CLASS} ${isAdActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              {/* <Megaphone size={15} className={isAdActive ? 'text-amber-400' : 'text-amber-500/80'} /> */}
              <span>Ad Playlist</span>
            </div>
          </button>

          {/* 3. Live Scheduling (Priority 3) */}
          <button
            onClick={() => handleNav('live_schedule', '/playlists/live-schedule')}
            className={`${BASE_CLASS} ${isLiveActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              {/* <Radio size={15} className={isLiveActive ? 'text-purple-400' : 'text-purple-500/80'} /> */}
              <span>Live Scheduling</span>
            </div>
          </button>

          {/* 4. Scheduling Playlist (Priority 2) */}
          <button
            onClick={() => handleNav('scheduling_playlist', '/playlists/scheduling')}
            className={`${BASE_CLASS} ${isSchedulingActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              {/* <Calendar size={15} className={isSchedulingActive ? 'text-blue-400' : 'text-blue-500/80'} /> */}
              <span>Scheduling Playlist</span>
            </div>
          </button>

          {/* 5. Default Playlist (Priority 1) */}
          <button
            onClick={() => handleNav('default_playlist', '/playlists/default')}
            className={`${BASE_CLASS} ${isDefaultActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              {/* <Layers size={15} className={isDefaultActive ? 'text-emerald-400' : 'text-emerald-500/80'} /> */}
              <span>Default Playlist</span>
            </div>
          </button>

          {/* Graphic Overlays Section */}
          <div className="pt-3 px-2.5 py-1 text-[9.5px] 2xl:text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Graphic Overlays
          </div>

          {/* L-Band */}
          <button
            onClick={() => handleNav('lband', '/lband')}
            className={`${BASE_CLASS} ${isLBandActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              <PanelBottom size={15} className={isLBandActive ? 'text-[#00bcd4]' : ''} />
              <span>L-Band</span>
            </div>
          </button>

          {/* Ashton Band */}
          <button
            onClick={() => handleNav('ashton', '/ashton')}
            className={`${BASE_CLASS} ${isAshtonActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard size={15} className={isAshtonActive ? 'text-[#00bcd4]' : ''} />
              <span>Ashton Band</span>
            </div>
          </button>
        </nav>
      </aside>
    </>
  );
}
