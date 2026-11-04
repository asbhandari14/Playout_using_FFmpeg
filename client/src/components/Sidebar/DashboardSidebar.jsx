import React from 'react';
import { LayoutDashboard, Server as ServerIcon, User as UserIcon } from 'lucide-react';

const ACTIVE_CLASS =
  "bg-[#101726] text-white relative before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-6 before:bg-[#00bcd4] before:rounded-r-full";
const INACTIVE_CLASS = 'text-slate-400 hover:text-slate-200 hover:bg-[#111726]/60';
const BASE_CLASS =
  'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base transition cursor-pointer';

export default function DashboardSidebar({ currentUser, isOpen, activeSection, onNavigate }) {
  const isChannelsActive = activeSection === 'channels' || activeSection === 'dashboard';
  const isServersActive = activeSection === 'servers';
  const isUsersActive = activeSection === 'users';

  return (
    <aside
      className={`${
        isOpen ? 'w-60 xl:w-60' : 'w-0 -translate-x-full'
      } bg-[#090d16] border-r border-[#141b2b] flex flex-col shrink-0 transition-all duration-300 overflow-y-auto select-none`}
    >
      {/* Greeting */}
      <div className="px-5 pt-5 pb-2">
        <span className="text-sm text-slate-400 tracking-wide">
          Hi, {currentUser?.name || 'Super Admin Account'}
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="p-3 space-y-1 text-xs">
        <button
          onClick={() => onNavigate('channels')}
          className={`${BASE_CLASS} ${isChannelsActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <LayoutDashboard size={20} className={isChannelsActive ? 'text-[#00bcd4]' : ''} />
          <span>Channel</span>
        </button>

        <button
          onClick={() => onNavigate('servers')}
          className={`${BASE_CLASS} ${isServersActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <ServerIcon size={20} className={isServersActive ? 'text-[#00bcd4]' : ''} />
          <span>Server</span>
        </button>

        <button
          onClick={() => onNavigate('users')}
          className={`${BASE_CLASS} ${isUsersActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
        >
          <UserIcon size={20} className={isUsersActive ? 'text-[#00bcd4]' : ''} />
          <span>User</span>
        </button>
      </nav>
    </aside>
  );
}
