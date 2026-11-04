import React from 'react';
import { Lock, Mail, AlertCircle } from 'lucide-react';

const inputClass =
  'w-full pl-9 pr-3 py-2.5 bg-[#0b0e14] border border-[#252c3c] rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition';
const labelClass =
  'block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider';
const iconWrapClass =
  'absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500';

export default function LoginForm({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  loading,
  error,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222938] rounded-2xl p-7 shadow-2xl backdrop-blur-xl">
      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-950/50 border border-red-800/60 flex items-start space-x-3 text-red-300 text-xs animate-shake">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">

        {/* Email Input */}
        <div>
          <label className={labelClass}>Email</label>
          <div className="relative">
            <div className={iconWrapClass}>
              <Mail size={16} />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="operator@playout.com"
              className={inputClass}
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <label className={labelClass}>Password</label>
          <div className="relative">
            <div className={iconWrapClass}>
              <Lock size={16} />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#2563eb] hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2 mt-8"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <span>Login</span>
          )}
        </button>
      </form>
    </div>
  );
}