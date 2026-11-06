import React from 'react';
import { ChevronDown, LogOut, Radio } from 'lucide-react';
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
  onLogoClick,
  onOpenControlRoom,
  onLogout
}) {

  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  return (
    <header className="h-16 bg-[#080c14] border-b border-[#141b2b] px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0 shadow-md">
      {/* Left: Brand */}
      <div className="flex items-center space-x-3.5">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={onLogoClick}>
          <span className="text-lg text-white">
            Playout <span className="text-slate-300">Lite</span>
          </span>
        </div>
      </div>

      {/* Right: User account dropdown */}
      <div className="flex items-center space-x-3">

        {
          (user && user.role === 'super_admin' || user.role == "admin") && (
            <div>
              <button
                className="px-3 py-1.5 rounded-lg bg-[#0c121f] border border-[#1b253b] hover:border-slate-600 transition text-base text-white"
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </button>
            </div>
          )
        }
        <div className="relative">
          <button
            onClick={onToggleProfileMenu}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#0c121f] border border-[#1b253b] hover:border-slate-600 transition"
          >
            <div className="w-7 h-7 rounded-full bg-[#00bcd4] text-black font-extrabold text-xs flex items-center justify-center shadow-sm">
              {getInitials(currentUser?.name)}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-white leading-tight">
                {currentUser?.name || 'Super Admin Account'}
              </span>
              <span className="text-[10px] text-slate-400 leading-tight">
                {currentUser?.email || 'example@mail.com'}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 top-12 w-52 bg-[#0e1422] border border-[#1f2b42] rounded-2xl shadow-2xl py-1.5 z-50 text-xs">
              <div className="px-3.5 py-2 border-b border-[#1b253b]">
                <p className="font-bold text-white">{currentUser?.name || 'Super Admin'}</p>
                <p className="text-[10px] text-slate-400">{currentUser?.email || 'admin@playout.com'}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {currentUser?.role || 'Super Admin'}
                </span>
              </div>

              <button
                onClick={onOpenControlRoom}
                className="w-full px-3.5 py-2 text-left text-slate-300 hover:text-white hover:bg-[#162136] flex items-center gap-2"
              >
                <Radio size={14} className="text-cyan-400" />
                <span>Open Control Room</span>
              </button>

              <button
                onClick={onLogout}
                className="w-full px-3.5 py-2 text-left text-rose-400 hover:bg-rose-950/30 flex items-center gap-2 border-t border-[#1b253b]"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}