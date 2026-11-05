import React from 'react';
import {
  ArrowLeft,
  Globe,
  HardDrive,
  Lock,
  Radio,
  Server as ServerIcon,
  User as UserIcon,
  UserCheck
} from 'lucide-react';
import { DEFAULT_SERVER_URL } from '../../constants/dashboard.js';

const shellClass =
  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition';
const amountShellClass =
  'flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition';
const inputClass =
  'w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs';
const selectClass =
  'px-3 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] text-slate-200 focus:outline-none text-xs';
const textInputClass =
  'px-3 py-2 rounded-xl bg-[#090d16] border border-[#1a2337] text-slate-200 focus:outline-none text-xs';
const unitSelectClass =
  'bg-transparent text-slate-300 font-semibold focus:outline-none border-l border-slate-700 pl-2 text-xs cursor-pointer';

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

export default function CreateChannelForm({
  formData,
  setFormData,
  servers = [],
  users = [],
  onSubmit,
  onCancel
}) {
  const set = (field, transform) => (e) =>
    setFormData((prev) => ({
      ...prev,
      [field]: transform ? transform(e.target.value) : e.target.value
    }));

  const handleServerChange = (e) => {
    const srv = servers.find((s) => s._id === e.target.value);
    setFormData((prev) => ({
      ...prev,
      server: e.target.value,
      serverDomain: srv?.streamUrl || DEFAULT_SERVER_URL
    }));
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Channels</span>
      </button>

      <div>
        <h1 className="text-xl text-white tracking-wide">Create Channel</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Add a new streaming channel with media server playout configuration
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-[#0b0e18] border border-[#161f33] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <Field label="Channel Name">
            <div className={shellClass}>
              <Globe size={15} className="text-slate-500 shrink-0" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={set('name')}
                placeholder="Enter channel name"
                className={inputClass}
              />
            </div>
          </Field>

          <Field label="Server Domain">
            <div className={shellClass}>
              <ServerIcon size={15} className="text-slate-500 shrink-0" />
              <select
                value={formData.server}
                onChange={handleServerChange}
                className="w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer"
              >
                {servers.length > 0 ? (
                  servers.map((s) => (
                    <option key={s._id} value={s._id} className="bg-[#0b0e18] text-slate-200">
                      {s.name} ({s.streamUrl || 'http://127.0.0.1:81'})
                    </option>
                  ))
                ) : (
                  <option value="" className="bg-[#0b0e18] text-slate-200">
                    Default Flussonic Server ({DEFAULT_SERVER_URL})
                  </option>
                )}
              </select>
            </div>
          </Field>

          <Field label="Server username">
            <div className={shellClass}>
              <UserIcon size={15} className="text-slate-500 shrink-0" />
              <input
                type="text"
                value={formData.serverUsername}
                onChange={set('serverUsername')}
                placeholder="Enter username"
                className={inputClass}
              />
            </div>
          </Field>

          <Field label="Server Password">
            <div className={shellClass}>
              <Lock size={15} className="text-slate-500 shrink-0" />
              <input
                type="password"
                value={formData.serverPassword}
                onChange={set('serverPassword')}
                placeholder="Enter password"
                className={inputClass}
              />
            </div>
          </Field>

          <Field label="Assign User" className="md:col-span-2">
            <div className={shellClass}>
              <UserCheck size={15} className="text-slate-500 shrink-0" />
              <select
                required
                value={formData.assignedUser}
                onChange={set('assignedUser')}
                className="w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer"
              >
                <option value="" disabled className="bg-[#0b0e18]">Select User</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id} className="bg-[#0b0e18] text-slate-200">
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Storage Quota" hint="0 or blank = Unlimited" className="md:col-span-2">
            <div className={amountShellClass}>
              <HardDrive size={15} className="text-slate-500 shrink-0" />
              <input
                type="number"
                min="0"
                step="any"
                value={formData.allocatedStorageAmount ?? ''}
                onChange={set('allocatedStorageAmount')}
                placeholder="e.g. 10"
                className={inputClass}
              />
              <select
                value={formData.allocatedStorageUnit || 'GB'}
                onChange={set('allocatedStorageUnit')}
                className={unitSelectClass}
              >
                <option value="MB" className="bg-[#0b0e18] text-slate-200">MB</option>
                <option value="GB" className="bg-[#0b0e18] text-slate-200">GB</option>
                <option value="TB" className="bg-[#0b0e18] text-slate-200">TB</option>
              </select>
            </div>
          </Field>

          <Field label="Output Resolution & FPS">
            <div className="grid grid-cols-2 gap-2">
              <select value={formData.resolution} onChange={set('resolution')} className={selectClass}>
                <option value="1280x720" className="bg-[#0b0e18]">1280x720 (720p HD)</option>
                <option value="1920x1080" className="bg-[#0b0e18]">1920x1080 (1080p Full HD)</option>
              </select>
              <select value={formData.fps} onChange={set('fps', Number)} className={selectClass}>
                <option value={25} className="bg-[#0b0e18]">25 FPS</option>
                <option value={30} className="bg-[#0b0e18]">30 FPS</option>
                <option value={60} className="bg-[#0b0e18]">60 FPS</option>
              </select>
            </div>
          </Field>

          <Field label="Target Bitrates">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={formData.videoBitrate}
                onChange={set('videoBitrate')}
                placeholder="Video (2500k)"
                className={textInputClass}
              />
              <input
                type="text"
                value={formData.audioBitrate}
                onChange={set('audioBitrate')}
                placeholder="Audio (128k)"
                className={textInputClass}
              />
            </div>
          </Field>
        </div>

        <div className="pt-4 border-t border-[#161f33] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#161f33] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 rounded-xl text-xs font-extrabold bg-[#00bcd4] hover:bg-[#06b6d4] text-black shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-2"
          >
            <Radio size={14} />
            <span>Create Channel</span>
          </button>
        </div>
      </form>
    </div>
  );
}

