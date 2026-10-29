import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../store/slices/authSlice.js';
import { Radio, Server, Users, Tv, LogOut, ArrowLeft, Shield } from 'lucide-react';

export default function Navbar({ channelTitle = null, onBack = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate('/login');
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const canManage = isSuperAdmin || isAdmin;

  const getRoleBadge = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-900/60 text-purple-300 border-purple-700/60';
      case 'admin':
        return 'bg-blue-900/60 text-blue-300 border-blue-700/60';
      default:
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/60';
    }
  };

  return (
    <header className="h-14 bg-[#0d0f14] border-b border-[#1f2633] px-4 flex items-center justify-between select-none z-40 sticky top-0">
      {/* Left: Back / Brand */}
      <div className="flex items-center space-x-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-[#181d27] border border-[#273042] flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#202736] transition"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
        ) : (
          <Link
            to="/channels"
            className="w-8 h-8 rounded-lg bg-[#181d27] border border-[#273042] flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#202736] transition"
          >
            <Tv size={16} />
          </Link>
        )}

        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
          <Link to="/channels" className="flex flex-col">
            <span className="font-bold tracking-wider text-xs text-blue-400 uppercase">
              Cloud Playout
            </span>
            <span className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
              {channelTitle || 'Control Room'}
            </span>
          </Link>
        </div>
      </div>

      {/* Center: Management Navigation Links (hidden if in live deck or regular user) */}
      {!channelTitle && (
        <nav className="hidden md:flex items-center space-x-1 bg-[#131720] p-1 rounded-lg border border-[#222938]">
          <Link
            to="/channels"
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition ${
              location.pathname === '/channels'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a202c]'
            }`}
          >
            <Tv size={14} />
            Channels
          </Link>

          {canManage && (
            <>
              <Link
                to="/servers"
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition ${
                  location.pathname === '/servers'
                    ? 'bg-[#2563eb] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a202c]'
                }`}
              >
                <Server size={14} />
                Servers
              </Link>

              <Link
                to="/users"
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition ${
                  location.pathname === '/users'
                    ? 'bg-[#2563eb] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a202c]'
                }`}
              >
                <Users size={14} />
                Users
              </Link>
            </>
          )}
        </nav>
      )}

      {/* Right: User Role Badge & Actions */}
      <div className="flex items-center space-x-3">
        {user && (
          <div className="flex items-center space-x-2">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-medium text-slate-200">{user.name}</span>
              <span className="text-[10px] text-slate-400">{user.email}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wide ${getRoleBadge(
                user.role
              )}`}
            >
              {user.role?.replace('_', ' ')}
            </span>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-[#1f2633] transition"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
