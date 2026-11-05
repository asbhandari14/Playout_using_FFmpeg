import React from 'react';
import {
  ArrowLeft,
  Server as ServerIcon,
  Globe,
  Tag,
  User as UserIcon,
  Lock
} from 'lucide-react';

const shellClass =
  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition';
const inputClass =
  'w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs';

function Field({ label, hint, className = '', children }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-slate-300 font-semibold">{label}</label>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function CreateServerForm({
  formData,
  setFormData,
  onSubmit,
  onCancel
}) {
  const set = (field) => (e) =>
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value
    }));

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Servers</span>
      </button>

      <div>
        <h1 className="text-xl text-white tracking-wide">Add Media Server</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure a new RTMP ingest and HLS playback server cluster
        </p>
      </div>

      <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <form onSubmit={onSubmit} className="space-y-6 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Server Name */}
            <Field label="Stream Name *">
              <div className={shellClass}>
                <ServerIcon size={16} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={set('name')}
                  placeholder="e.g. Flussonic Primary Cluster"
                  className={inputClass}
                />
              </div>
            </Field>

            {/* Category */}
            <Field label="Category" hint="Optional grouping">
              <div className={shellClass}>
                <Tag size={16} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={formData.category || 'General'}
                  onChange={set('category')}
                  placeholder="e.g. General, Cloud Transcoder, Backup"
                  className={inputClass}
                />
              </div>
            </Field>
          </div>

          {/* Stream URL */}
          <Field
            label="Stream URL (Base Host & Port) *"
            hint="Format: http://ip_or_domain:port"
          >
            <div className={shellClass}>
              <Globe size={16} className="text-slate-500 shrink-0" />
              <input
                type="text"
                required
                value={formData.streamUrl || ''}
                onChange={set('streamUrl')}
                placeholder="http://94.136.185.222:81"
                className={`${inputClass} font-mono text-[11px] text-[#00bcd4]`}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              RTMP and HLS base URLs are automatically derived from this host (e.g.{' '}
              <code className="text-slate-400">http://94.136.185.222:81</code>).
            </p>
          </Field>

          {/* Username & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Stream Username" hint="Optional API/Relay auth">
              <div className={shellClass}>
                <UserIcon size={16} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={formData.serverUsername || ''}
                  onChange={set('serverUsername')}
                  placeholder="admin"
                  className={inputClass}
                />
              </div>
            </Field>

            <Field label="Stream Password" hint="Optional auth">
              <div className={shellClass}>
                <Lock size={16} className="text-slate-500 shrink-0" />
                <input
                  type="password"
                  value={formData.serverPassword || ''}
                  onChange={set('serverPassword')}
                  placeholder="••••••••••••"
                  className={inputClass}
                />
              </div>
            </Field>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#161f33]">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-[#1b253b] text-slate-300 hover:text-white hover:bg-[#121929] transition font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-extrabold shadow-lg shadow-cyan-500/20 transition cursor-pointer"
            >
              Create Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

