import React, { useState, useEffect } from 'react';
import Modal from './Modal.jsx';
import { PLAYLIST_TYPE_CONFIG, DAYS_OF_WEEK } from '../../hooks/usePlaylist.js';
import { Calendar, Clock, AlertTriangle, Radio, Film, Layers, Trash2 } from 'lucide-react';

export default function PlaylistSettingsModal({
  isOpen,
  onClose,
  playlist = null,
  onSave,
  onDelete
}) {
  const isEditing = Boolean(playlist && playlist._id);

  const [formData, setFormData] = useState({
    name: '',
    type: 'default',
    scheduleOption: 'none',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    daysOfWeek: [],
    liveSourceUrl: '',
    loop: true,
    isActive: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state with selected playlist when opening
  useEffect(() => {
    if (playlist) {
      setFormData({
        name: playlist.name || '',
        type: playlist.type || 'default',
        scheduleOption: playlist.scheduleOption || 'none',
        startDate: playlist.startDate ? new Date(playlist.startDate).toISOString().split('T')[0] : '',
        endDate: playlist.endDate ? new Date(playlist.endDate).toISOString().split('T')[0] : '',
        startTime: playlist.startTime || '',
        endTime: playlist.endTime || '',
        daysOfWeek: Array.isArray(playlist.daysOfWeek) ? [...playlist.daysOfWeek] : [],
        liveSourceUrl: playlist.liveSourceUrl || '',
        loop: playlist.loop !== undefined ? playlist.loop : true,
        isActive: playlist.isActive !== undefined ? playlist.isActive : true
      });
    } else {
      setFormData({
        name: '',
        type: 'scheduling',
        scheduleOption: 'none',
        startDate: '',
        endDate: '',
        startTime: '',
        endTime: '',
        daysOfWeek: [],
        liveSourceUrl: '',
        loop: true,
        isActive: true
      });
    }
    setErrorMsg('');
  }, [playlist, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const toggleDayOfWeek = (dayValue) => {
    setFormData((prev) => {
      const exists = prev.daysOfWeek.includes(dayValue);
      const updated = exists
        ? prev.daysOfWeek.filter((d) => d !== dayValue)
        : [...prev.daysOfWeek, dayValue].sort((a, b) => a - b);
      return { ...prev, daysOfWeek: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim()) {
      setErrorMsg('Please enter a playlist name');
      return;
    }

    if (formData.scheduleOption === 'date') {
      if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
        setErrorMsg('Start date must be earlier than or equal to End date');
        return;
      }
    }

    if (formData.scheduleOption === 'weekly' && formData.daysOfWeek.length === 0) {
      setErrorMsg('Please select at least one day for weekly scheduling');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        ...formData,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save playlist settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTypeConfig = PLAYLIST_TYPE_CONFIG[formData.type] || PLAYLIST_TYPE_CONFIG.default;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Playlist: ${playlist?.name}` : 'Create New Playlist'}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Playlist Name */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">
            Playlist Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Primetime Scheduling, Commercial Ad Break, Breaking News"
            className="w-full bg-[#0d1017] border border-[#232b3c] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
            required
          />
        </div>

        {/* Playlist Type & Priority */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">
            Playlist Type & Playout Priority
          </label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full bg-[#0d1017] border border-[#232b3c] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="emergency">Emergency Playlist (Priority 5 - Highest)</option>
            <option value="advertisement">Advertisement Playlist (Priority 4 - 2nd Highest)</option>
            <option value="live_schedule">Live Schedule (Priority 3 - 3rd Highest)</option>
            <option value="scheduling">Scheduling Playlist (Priority 2 - 4th Highest)</option>
            <option value="default">Default Playlist (Priority 1 - Lowest / Baseline)</option>
          </select>

          {/* Priority Details Card */}
          <div className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center justify-between ${selectedTypeConfig.colorClass}`}>
            <div>
              <span className="font-bold block">{selectedTypeConfig.label}</span>
              <span className="text-[11px] opacity-80">{selectedTypeConfig.description}</span>
            </div>
            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-black/40 border border-current">
              {selectedTypeConfig.badge}
            </span>
          </div>
        </div>

        {/* If Live Schedule: Live Stream Source URL */}
        {formData.type === 'live_schedule' && (
          <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-800/40 space-y-2">
            <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
              <Radio size={14} />
              <span>Live Relay Stream URL (Optional)</span>
            </div>
            <input
              type="text"
              name="liveSourceUrl"
              value={formData.liveSourceUrl}
              onChange={handleChange}
              placeholder="rtmp://... or https://.../stream.m3u8"
              className="w-full bg-[#0d1017] border border-[#232b3c] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500 font-mono text-xs"
            />
            <span className="text-[10px] text-slate-400 block">
              If provided, Feeder will relay this live input during scheduled times. You can also add pre-recorded assets below.
            </span>
          </div>
        )}

        {/* Scheduling Mode Option */}
        <div className="pt-2 border-t border-[#1e2535]">
          <label className="block text-slate-300 font-semibold mb-2 flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-400" />
            <span>Scheduling Option</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'none', label: 'None (Manual / 24x7)', desc: 'Always eligible or baseline' },
              { id: 'weekly', label: 'Weekly Schedule', desc: 'Recurring days of week' },
              { id: 'date', label: 'Date Schedule', desc: 'Specific date range' }
            ].map((opt) => (
              <label
                key={opt.id}
                className={`p-2.5 rounded-lg border cursor-pointer text-center transition flex flex-col items-center justify-center ${formData.scheduleOption === opt.id
                  ? 'bg-blue-600/15 border-blue-500 text-blue-300 font-semibold shadow-sm'
                  : 'bg-[#0d1017] border-[#232b3c] text-slate-400 hover:border-slate-600'
                  }`}
              >
                <input
                  type="radio"
                  name="scheduleOption"
                  value={opt.id}
                  checked={formData.scheduleOption === opt.id}
                  onChange={handleChange}
                  className="sr-only"
                />
                <span className="text-xs">{opt.label}</span>
                <span className="text-[9px] opacity-70 mt-0.5">{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Schedule Fields */}
        {formData.scheduleOption === 'date' && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#0d1017] border border-[#232b3c]">
            <div>
              <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full bg-[#141822] border border-[#232b3c] rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                End Date
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full bg-[#141822] border border-[#232b3c] rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Weekly Schedule Days of the Week */}
        {formData.scheduleOption === 'weekly' && (
          <div className="p-3 rounded-lg bg-[#0d1017] border border-[#232b3c] space-y-2">
            <label className="block text-slate-400 font-semibold text-[11px]">
              Active Days of the Week
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map((d) => {
                const selected = formData.daysOfWeek.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDayOfWeek(d.value)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition border ${selected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-[#141822] text-slate-400 border-[#232b3c] hover:border-slate-500'
                      }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Daily Time Window (Applies to both weekly and date scheduling or daily recurring) */}
        <div className="p-3 rounded-lg bg-[#0d1017] border border-[#232b3c] space-y-2">
          <label className="block text-slate-300 font-semibold flex items-center gap-1.5">
            <Clock size={14} className="text-amber-400" />
            <span>Daily Playout Time Window (Optional)</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-slate-400 text-[10px] mb-1">Start Time (HH:mm)</span>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                step="1"
                className="w-full bg-[#141822] border border-[#232b3c] rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <span className="block text-slate-400 text-[10px] mb-1">End Time (HH:mm)</span>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                step="1"
                className="w-full bg-[#141822] border border-[#232b3c] rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
          <span className="text-[10px] text-slate-500 block">
            Leave blank if playlist runs the whole day during the scheduled dates/days.
          </span>
        </div>

        {/* Options: Loop & Active */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1017] border border-[#232b3c]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="loop"
              checked={formData.loop}
              onChange={handleChange}
              className="rounded bg-[#141822] border-slate-700 text-blue-600 focus:ring-0"
            />
            <span className="font-semibold text-slate-200">Loop Playback</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="rounded bg-[#141822] border-slate-700 text-blue-600 focus:ring-0"
            />
            <span className="font-semibold text-slate-200">Enable Playlist (Active)</span>
          </label>
        </div>

        {/* Footer Buttons */}
        <div className="pt-3 border-t border-[#1e2535] flex items-center justify-between">
          {isEditing && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(playlist._id)}
              className="px-3 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/60 font-semibold flex items-center gap-1.5 transition"
            >
              <Trash2 size={13} />
              <span>Delete Playlist</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#141822] hover:bg-[#1e2535] text-slate-300 font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-600/30 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Playlist' : 'Create Playlist'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

