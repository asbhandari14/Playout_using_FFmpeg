import React from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Radio,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { PLAYLIST_TYPE_CONFIG, DAYS_OF_WEEK } from '../../hooks/usePlaylist.js';

const shellClass =
  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition';
const inputClass =
  'w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs';
const selectClass =
  'w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer';

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

export default function CreatePlaylistForm({
  formData,
  setFormData,
  channels = [],
  onSubmit,
  onCancel,
  forcedType = null
}) {
  const set = (field, transform) => (e) =>
    setFormData((prev) => ({
      ...prev,
      [field]: transform ? transform(e.target.value) : e.target.value
    }));

  const handleCheckbox = (field) => (e) =>
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.checked
    }));

  const toggleDayOfWeek = (dayVal) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.daysOfWeek) ? prev.daysOfWeek : [];
      const exists = current.includes(dayVal);
      const updated = exists ? current.filter((d) => d !== dayVal) : [...current, dayVal].sort((a, b) => a - b);
      return { ...prev, daysOfWeek: updated };
    });
  };

  const selectedType = forcedType || formData.type || 'default';
  const typeConfig = PLAYLIST_TYPE_CONFIG[selectedType] || PLAYLIST_TYPE_CONFIG.default;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Playlists</span>
      </button>

      <div>
        <h1 className="text-xl text-white tracking-wide">
          Create {typeConfig.shortLabel} Playlist
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure schedule window, priority, and playback settings
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-[#0b0e18] border border-[#161f33] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Channel Selector */}
          <Field label="Channel *">
            <div className={shellClass}>
              <select
                required
                value={formData.channel || formData.channelId || ''}
                onChange={set('channel')}
                className={selectClass}
              >
                <option value="" disabled className="bg-[#0b0e18]">Select Channel</option>
                {channels.map((ch) => (
                  <option key={ch._id} value={ch._id} className="bg-[#0b0e18] text-slate-200">
                    {ch.name} ({ch.status === 'live' ? 'ONLINE' : 'IDLE'})
                  </option>
                ))}
              </select>
            </div>
          </Field>

          {/* Playlist Name */}
          <Field label="Playlist Name *">
            <div className={shellClass}>
              <Layers size={15} className="text-slate-500 shrink-0" />
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={set('name')}
                placeholder={`e.g. ${typeConfig.shortLabel} Broadcast Playout`}
                className={inputClass}
              />
            </div>
          </Field>

          {/* Playlist Type & Priority */}
          {!forcedType && (
            <Field label="Playlist Type & Playout Priority" className="md:col-span-2">
              <div className={shellClass}>
                <select
                  value={formData.type || 'default'}
                  onChange={set('type')}
                  className={selectClass}
                >
                  <option value="emergency" className="bg-[#0b0e18]">Emergency Playlist (Priority 5 - Highest)</option>
                  <option value="advertisement" className="bg-[#0b0e18]">Advertisement Playlist (Priority 4 - 2nd Highest)</option>
                  <option value="live_schedule" className="bg-[#0b0e18]">Live Schedule (Priority 3 - 3rd Highest)</option>
                  <option value="scheduling" className="bg-[#0b0e18]">Scheduling Playlist (Priority 2 - 4th Highest)</option>
                  <option value="default" className="bg-[#0b0e18]">Default Playlist (Priority 1 - Lowest / Baseline)</option>
                </select>
              </div>
            </Field>
          )}

          {/* Type Badge Card */}
          {/* <div className={`md:col-span-2 p-3 rounded-xl border text-xs flex items-center justify-between ${typeConfig.colorClass}`}>
            <div>
              <span className="font-bold block">{typeConfig.label}</span>
              <span className="text-[11px] opacity-80">{typeConfig.description}</span>
            </div>
            <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-black/40 border border-current">
              {typeConfig.badge}
            </span>
          </div> */}

          {/* Live Schedule Stream URL */}
          {selectedType === 'live_schedule' && (
            <Field label="Live Stream Relay Source URL" hint="Optional live input" className="md:col-span-2">
              <div className={shellClass}>
                <Radio size={15} className="text-purple-400 shrink-0" />
                <input
                  type="text"
                  value={formData.liveSourceUrl || ''}
                  onChange={set('liveSourceUrl')}
                  placeholder="rtmp://... or https://.../stream.m3u8"
                  className={`${inputClass} font-mono text-[11px] text-purple-300`}
                />
              </div>
            </Field>
          )}

          {/* Schedule Option */}
          <div className="md:col-span-2 pt-2 border-t border-[#1a2337]">
            <label className="block text-slate-300 font-semibold mb-2 flex items-center gap-1.5 text-xs">
              <Calendar size={14} className="text-[#00bcd4]" />
              <span>Scheduling Option</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'none', label: 'None (24x7 / Manual)', desc: 'Always active or baseline' },
                { id: 'weekly', label: 'Weekly Schedule', desc: 'Recurring days of week' },
                { id: 'date', label: 'Date Schedule', desc: 'Specific date range' }
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`p-2.5 rounded-xl border cursor-pointer text-center transition flex flex-col items-center justify-center ${(formData.scheduleOption || 'none') === opt.id
                    ? 'bg-[#00bcd4]/15 border-[#00bcd4] text-[#00bcd4] font-semibold'
                    : 'bg-[#090d16] border-[#1a2337] text-slate-400 hover:border-slate-600'
                    }`}
                >
                  <input
                    type="radio"
                    name="scheduleOption"
                    value={opt.id}
                    checked={(formData.scheduleOption || 'none') === opt.id}
                    onChange={set('scheduleOption')}
                    className="sr-only"
                  />
                  <span className="text-xs">{opt.label}</span>
                  <span className="text-[9px] opacity-70 mt-0.5">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date range fields */}
          {formData.scheduleOption === 'date' && (
            <>
              <Field label="Start Date">
                <div className={shellClass}>
                  <input
                    type="date"
                    value={formData.startDate || ''}
                    onChange={set('startDate')}
                    className={inputClass}
                  />
                </div>
              </Field>
              <Field label="End Date">
                <div className={shellClass}>
                  <input
                    type="date"
                    value={formData.endDate || ''}
                    onChange={set('endDate')}
                    className={inputClass}
                  />
                </div>
              </Field>
            </>
          )}

          {/* Weekly days chips */}
          {formData.scheduleOption === 'weekly' && (
            <div className="md:col-span-2 p-3 rounded-xl bg-[#090d16] border border-[#1a2337] space-y-2">
              <label className="block text-slate-400 font-semibold text-[11px]">
                Active Days of the Week
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((d) => {
                  const selected = Array.isArray(formData.daysOfWeek) && formData.daysOfWeek.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDayOfWeek(d.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${selected
                        ? 'bg-[#00bcd4] text-black border-[#00bcd4] shadow-sm'
                        : 'bg-[#111726] text-slate-400 border-[#1a2337] hover:border-slate-500'
                        }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily Time Window */}
          <Field label="Daily Start Time (HH:mm)" hint="Optional daily slot">
            <div className={shellClass}>
              <Clock size={15} className="text-slate-500 shrink-0" />
              <input
                type="time"
                step="1"
                value={formData.startTime || ''}
                onChange={set('startTime')}
                className={`${inputClass} font-mono`}
              />
            </div>
          </Field>

          <Field label="Daily End Time (HH:mm)" hint="Optional daily slot">
            <div className={shellClass}>
              <Clock size={15} className="text-slate-500 shrink-0" />
              <input
                type="time"
                step="1"
                value={formData.endTime || ''}
                onChange={set('endTime')}
                className={`${inputClass} font-mono`}
              />
            </div>
          </Field>

          {/* Toggles */}
          <div className="md:col-span-2 flex items-center justify-between p-3.5 rounded-xl bg-[#090d16] border border-[#1a2337]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.loop !== false}
                onChange={handleCheckbox('loop')}
                className="rounded bg-[#101726] border-slate-700 text-[#00bcd4] focus:ring-0"
              />
              <span className="font-semibold text-slate-200">Loop Playback</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive !== false}
                onChange={handleCheckbox('isActive')}
                className="rounded bg-[#101726] border-slate-700 text-[#00bcd4] focus:ring-0"
              />
              <span className="font-semibold text-slate-200">Enable Playlist (Active)</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#161f33] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-[#1b253b] text-slate-300 hover:text-white hover:bg-[#121929] transition font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-medium shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-2"
          >
            <Layers size={14} />
            <span>Create Playlist</span>
          </button>
        </div>
      </form>
    </div>
  );
}

