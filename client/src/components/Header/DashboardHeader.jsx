import React from 'react';
import { ChevronDown, LogOut, Radio, Menu, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const getInitials = (name) => {
  if (!name) return 'SA';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

export default function DashboardHeader({
  currentUser,
  isProfileMenuOpen,
  onToggleProfileMenu,
  onToggleSidebar,
  onLogoClick,
  onOpenControlRoom,
  onLogout
}) {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const canAccessDashboard = user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <header className="h-11 2xl:h-13 bg-[#10141d] border-b border-[#1e2638] px-3 sm:px-4 2xl:px-6 flex items-center justify-between z-30 sticky top-0 shrink-0 select-none">
      {/* Left: Menu Toggle + Brand */}
      <div className="flex items-center gap-2.5">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg bg-[#151b28] hover:bg-[#1c2435] border border-[#232d42] text-slate-300 hover:text-white transition cursor-pointer"
            title="Toggle Sidebar"
          >
            <Menu size={15} />
          </button>
        )}

        <div className="flex items-center gap-2 cursor-pointer" onClick={onLogoClick}>
          <span className="text-sm 2xl:text-base font-bold tracking-wide text-white">
            Playout <span className="text-[#00bcd4] font-semibold">Lite</span>
          </span>
        </div>
      </div>

      {/* Right: Actions + User Account Dropdown */}
      <div className="flex items-center gap-2 2xl:gap-2.5">
        {/* {canAccessDashboard && (
          <button
            type="button"
            className="px-2.5 py-1 2xl:px-3 2xl:py-1.5 rounded-lg bg-[#151b28] hover:bg-[#1b2333] border border-[#232d42] transition text-[11px] 2xl:text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            <LayoutDashboard size={13} className="text-[#00bcd4]" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
        )} */}

        <div className="relative">
          <button
            type="button"
            onClick={onToggleProfileMenu}
            className="flex items-center gap-2 px-2 py-1 2xl:px-2.5 rounded-full bg-[#151b28] border border-[#232d42] hover:border-slate-600 transition cursor-pointer"
          >
            <div className="w-6 h-6 2xl:w-7 2xl:h-7 rounded-full bg-[#00bcd4] text-black font-extrabold text-[10px] 2xl:text-xs flex items-center justify-center shrink-0">
              {getInitials(currentUser?.name)}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[11px] 2xl:text-xs font-semibold text-white leading-tight max-w-[130px] truncate">
                {currentUser?.name || 'Super Admin'}
              </span>
              <span className="text-[9.5px] text-slate-400 leading-tight max-w-[130px] truncate">
                {currentUser?.email || 'admin@playout.com'}
              </span>
            </div>
            <ChevronDown size={13} className="text-slate-400" />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 top-10 2xl:top-11 w-48 bg-[#101624] border border-[#1f2b42] rounded-xl shadow-2xl py-1 z-50 text-[11px] 2xl:text-xs">
              <div className="px-3 py-2 border-b border-[#1b253b]">
                <p className="font-bold text-white truncate">{currentUser?.name || 'Super Admin'}</p>
                <p className="text-[10px] text-slate-400 truncate">{currentUser?.email || 'admin@playout.com'}</p>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {currentUser?.role || 'Super Admin'}
                </span>
              </div>

              <button
                type="button"
                onClick={onOpenControlRoom}
                className="w-full px-3 py-1.5 text-left text-slate-300 hover:text-white hover:bg-[#162136] flex items-center gap-2 cursor-pointer"
              >
                <Radio size={13} className="text-cyan-400" />
                <span>Open Control Room</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-rose-950/30 flex items-center gap-2 border-t border-[#1b253b] cursor-pointer"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}