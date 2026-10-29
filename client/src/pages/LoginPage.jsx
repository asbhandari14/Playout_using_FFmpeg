import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginUser, clearError } from '../store/slices/authSlice.js';
import { Tv, Radio, Lock, Mail, AlertCircle, Shield, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('superadmin@playout.com');
  const [password, setPassword] = useState('Password@123');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/channels');
    }
    return () => {
      dispatch(clearError());
    };
  }, [isAuthenticated, navigate, dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;
    dispatch(loginUser({ email, password }));
  };

  const handleQuickLogin = (quickEmail) => {
    setEmail(quickEmail);
    setPassword('Password@123');
    dispatch(loginUser({ email: quickEmail, password: 'Password@123' }));
  };

  return (
    <div className="min-h-screen bg-[#090b0e] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        {/* App Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 mb-3 shadow-lg shadow-blue-500/5">
            <Radio size={28} className="animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white m-0">
            Cloud Playout Control Room
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-medium">
            Broadcast Ingest & Live Automation Console
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#12161f] border border-[#222938] rounded-2xl p-7 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-950/50 border border-red-800/60 flex items-start space-x-3 text-red-300 text-xs animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Operator Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@playout.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0b0e14] border border-[#252c3c] rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0b0e14] border border-[#252c3c] rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#2563eb] hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <span>Access Control Deck</span>
              )}
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="mt-6 pt-5 border-t border-[#1f2533]">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
              1-Click Demo Login Roles
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('superadmin@playout.com')}
                className="px-2 py-1.5 rounded-lg bg-[#181d28] border border-[#283244] hover:border-purple-500/50 hover:bg-purple-950/20 text-slate-300 hover:text-purple-300 text-[11px] font-medium transition text-center"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@playout.com')}
                className="px-2 py-1.5 rounded-lg bg-[#181d28] border border-[#283244] hover:border-blue-500/50 hover:bg-blue-950/20 text-slate-300 hover:text-blue-300 text-[11px] font-medium transition text-center"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('operator@playout.com')}
                className="px-2 py-1.5 rounded-lg bg-[#181d28] border border-[#283244] hover:border-emerald-500/50 hover:bg-emerald-950/20 text-slate-300 hover:text-emerald-300 text-[11px] font-medium transition text-center"
              >
                Operator
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Cloud Playout Platform &copy; 2026. All rights reserved.
        </p>
      </div>
    </div>
  );
}
