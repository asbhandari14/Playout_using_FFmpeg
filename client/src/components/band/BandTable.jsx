import React from 'react';
import {
  PlusCircle,
  Search,
  Calendar,
  Clock,
  Timer,
  Play,
  Pencil,
  Trash2,
  PanelBottom,
  CreditCard,
  Layers
} from 'lucide-react';
import TableScrollContainer from '../table/TableScrollContainer.jsx';
import { resolveMediaUrl } from '../../utils/bandGeometry.js';

const BAND_LIBRARY_GRID_COLS =
  'grid grid-cols-[68px_minmax(170px,1.5fr)_190px_110px_120px] items-center gap-3';

const SCHEDULE_GRID_COLS =
  'grid grid-cols-[64px_minmax(150px,1.3fr)_150px_145px_100px_100px_104px] items-center gap-2.5';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BandTable({
  type = 'lband', // 'lband' | 'ashton'
  activeTab = 'bands', // 'bands' | 'schedules'
  onTabChange,
  bands = [],
  schedules = [],
  channels = [],
  selectedChannelId = '',
  onSelectChannel,
  currentUser = null,
  searchQuery = '',
  onSearchChange,
  onCreateBand,
  onEditBand,
  onDeleteBand,
  onFireBandLive,
  onCreateSchedule,
  onEditSchedule,
  onDeleteSchedule,
  onToggleScheduleStatus,
  onFireScheduleLive,
  firingId = null,
  isLoading = false
}) {
  const isLBand = type === 'lband';
  const bandLabel = isLBand ? 'L-Band' : 'Ashton Band';
  const canSwitchChannel =
    (currentUser?.role === 'super_admin' || currentUser?.role === 'admin') &&
    channels.length > 0;

  const currentChannel = channels.find((c) => c._id === selectedChannelId) || channels[0];
  const q = searchQuery.toLowerCase();

  const filteredBands = bands.filter((b) => {
    if (!q) return true;
    return b.title && b.title.toLowerCase().includes(q);
  });

  const resolveScheduleBands = (item) => {
    if (Array.isArray(item.bandPresets) && item.bandPresets.length > 0) {
      return item.bandPresets
        .map((b) => (typeof b === 'object' && b?._id ? b : bands.find((x) => x._id === b)))
        .filter(Boolean);
    }
    if (item.bandPreset) {
      const b = typeof item.bandPreset === 'object' ? item.bandPreset : bands.find((x) => x._id === item.bandPreset);
      return b ? [b] : [];
    }
    return [];
  };

  const filteredSchedules = schedules.filter((s) => {
    if (!q) return true;
    const seqTitles = resolveScheduleBands(s).map((b) => b.title?.toLowerCase() || '').join(' ');
    return (
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.bandPreset?.title && s.bandPreset.title.toLowerCase().includes(q)) ||
      seqTitles.includes(q) ||
      (s.dailyStartTime && s.dailyStartTime.includes(q))
    );
  });

  const formatDays = (days) => {
    if (!Array.isArray(days) || days.length === 0 || days.length === 7) return 'All Days';
    return days.map((d) => DAYS_SHORT[d]).filter(Boolean).join(', ');
  };

  const formatDateRange = (start, end) => {
    if (!start && !end) return 'Every Day';
    const s = start ? new Date(start).toLocaleDateString() : 'Start';
    const e = end ? new Date(end).toLocaleDateString() : 'Ongoing';
    return `${s} → ${e}`;
  };

  return (
    <div className="space-y-3.5 2xl:space-y-4 select-none font-mono">
      {/* Top Header & Dual Primary Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-base sm:text-lg 2xl:text-xl text-white tracking-tight">
            {isLBand ? 'L-Band Graphic Overlays' : 'Ashton Band Banner Overlays'}
          </h1>
          <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
            {isLBand
              ? 'Create reusable L-Band graphics with video window geometry, then schedule automated air times'
              : 'Create reusable lower-third Ashton banners with video window squeeze, then schedule automated air times'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canSwitchChannel && (
            <div className="flex items-center gap-1.5 bg-[#0f131c] border border-[#1f2738] px-2.5 py-1.5 2xl:py-2 rounded-lg text-xs">
              <select
                value={selectedChannelId || ''}
                onChange={(e) => onSelectChannel?.(e.target.value)}
                className="bg-transparent text-cyan-300 font-semibold focus:outline-none cursor-pointer pr-1"
              >
                {channels.map((ch) => (
                  <option key={ch._id} value={ch._id} className="bg-[#0b0e18] text-slate-200">
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={`Search ${bandLabel}s & schedules...`}
              className="w-40 sm:w-48 2xl:w-56 pl-8 pr-3 py-1.5 2xl:py-2 bg-[#0f131c] border border-[#1f2738] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
            />
          </div> */}

          {/* Button 1: Create L-Band / Create Ashton Band */}
          <button
            type="button"
            onClick={onCreateBand}
            className="px-3 py-1.5 2xl:px-3.5 2xl:py-2 rounded-lg bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition cursor-pointer shrink-0"
          >
            <PlusCircle size={14} />
            <span>Create {bandLabel}</span>
          </button>

          {/* Button 2: Add Schedule */}
          <button
            type="button"
            onClick={onCreateSchedule}
            className="px-3 py-1.5 2xl:px-3.5 2xl:py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer shrink-0"
          >
            <Calendar size={14} />
            <span>Add Schedule</span>
          </button>
        </div>
      </div>

      {/* View Tabs: Created Bands vs Schedules */}
      <div className="flex items-center gap-2 border-b border-[#1c2436]">
        <button
          type="button"
          onClick={() => onTabChange?.('bands')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'bands'
            ? 'border-[#00bcd4] text-cyan-300'
            : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          {isLBand ? <PanelBottom size={14} /> : <CreditCard size={14} />}
          <span>{bandLabel}s ({bands.length})</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange?.('schedules')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'schedules'
            ? 'border-emerald-400 text-emerald-300'
            : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <Calendar size={14} />
          <span>Schedules ({schedules.length})</span>
        </button>
      </div>

      {/* Table Body */}
      <div className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl overflow-hidden shadow-xl">
        {activeTab === 'bands' ? (
          <TableScrollContainer>
            <div className="w-full min-w-[740px]">
              <div
                className={`${BAND_LIBRARY_GRID_COLS} px-4 py-2.5 2xl:px-5 2xl:py-3 bg-[#131926] border-b border-[#1e2638] text-[10px] 2xl:text-[10.5px] uppercase font-bold text-slate-400 tracking-wider`}
              >
                <div>Preview</div>
                <div>{bandLabel} Title</div>
                <div>Video Window</div>
                <div>Duration</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="divide-y divide-[#171f31]">
                {isLoading ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading {bandLabel}s...
                  </div>
                ) : filteredBands.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-cyan-400 mx-auto mb-2">
                      {isLBand ? <PanelBottom size={18} /> : <CreditCard size={18} />}
                    </div>
                    <p className="text-white font-semibold text-xs">
                      No {bandLabel}s created yet
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      {searchQuery
                        ? `No ${bandLabel} matches your search.`
                        : `Create a ${bandLabel} for "${currentChannel?.name || 'this channel'}" first, then assign it to broadcast schedules.`}
                    </p>
                    {!searchQuery && (
                      <button
                        type="button"
                        onClick={onCreateBand}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/60 transition text-xs font-semibold cursor-pointer"
                      >
                        <PlusCircle size={13} />
                        <span>Create {bandLabel}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredBands.map((band) => {
                    const imgUrl = resolveMediaUrl(band.imagePath);
                    const isFiring = firingId === band._id;
                    const squeezeH = 720 - (band.ashtonHeight || 160);

                    return (
                      <div
                        key={band._id}
                        className={`${BAND_LIBRARY_GRID_COLS} px-4 py-2.5 2xl:px-5 2xl:py-3 hover:bg-[#141b29] transition text-xs`}
                      >
                        <div>
                          {imgUrl ? (
                            <div className="w-14 h-9 rounded-md bg-black/60 border border-[#202c44] overflow-hidden flex items-center justify-center">
                              <img src={imgUrl} alt={band.title} className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-14 h-9 rounded-md bg-[#0e1422] border border-[#1b253b] flex items-center justify-center text-slate-500 text-[10px]">
                              No Img
                            </div>
                          )}
                        </div>

                        <div className="truncate">
                          <span className="font-semibold text-white block truncate text-xs">
                            {band.title}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {band.imagePath ? band.imagePath.split('/').pop() : 'Custom Graphic'}
                          </span>
                        </div>

                        <div className="font-mono text-[11px] text-cyan-300">
                          {isLBand ? (
                            <div>
                              <span>{band.windowWidth ?? 960}x{band.windowHeight ?? 540}</span>
                              <span className="block text-[10px] text-slate-400">
                                X:{band.windowX ?? 300} • Y:{band.windowY ?? 20}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span>{band.ashtonSqueeze !== false ? `1280x${squeezeH} (Squeezed)` : '1280x720 (Overlay)'}</span>
                              <span className="block text-[10px] text-slate-400">
                                Banner H: {band.ashtonHeight || 160}px
                              </span>
                            </div>
                          )}
                        </div>

                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-bold text-[11px]">
                            <Timer size={11} />
                            <span>{band.duration || 10}s</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isFiring}
                            onClick={() => onFireBandLive?.(band)}
                            className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 hover:bg-[#00bcd4] hover:text-black hover:border-[#00bcd4] transition cursor-pointer disabled:opacity-50"
                            title={`Trigger ${bandLabel} Live On Air`}
                          >
                            {isFiring ? (
                              <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                              <Play size={13} fill="currentColor" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditBand?.(band)}
                            className="p-1.5 rounded-lg bg-[#0e1422] border border-[#1b253b] text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition cursor-pointer"
                            title={`Edit ${bandLabel}`}
                          >
                            <Pencil size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteBand?.(band)}
                            className="p-1.5 rounded-lg bg-[#0e1422] border border-[#1b253b] text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition cursor-pointer"
                            title={`Delete ${bandLabel}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </TableScrollContainer>
        ) : (
          <TableScrollContainer>
            <div className="w-full min-w-[850px]">
              <div
                className={`${SCHEDULE_GRID_COLS} px-4 py-2.5 2xl:px-5 2xl:py-3 bg-[#131926] border-b border-[#1e2638] text-[10px] 2xl:text-[10.5px] uppercase font-bold text-slate-400 tracking-wider`}
              >
                <div>Band</div>
                <div>Schedule Title</div>
                <div>Dates &amp; Weekdays</div>
                <div>Start → End Time</div>
                <div>Duration / Gap</div>
                <div className="text-center">Enable Schedule</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="divide-y divide-[#171f31]">
                {isLoading ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading schedules...
                  </div>
                ) : filteredSchedules.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mx-auto mb-2">
                      <Calendar size={18} />
                    </div>
                    <p className="text-white font-semibold text-xs">
                      No {bandLabel} schedules found
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      {searchQuery
                        ? 'No schedules match your search filter.'
                        : `Add a schedule and choose one of your created ${bandLabel}s to play automatically.`}
                    </p>
                    {!searchQuery && (
                      <button
                        type="button"
                        onClick={onCreateSchedule}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 hover:bg-emerald-900/60 transition text-xs font-semibold cursor-pointer"
                      >
                        <Calendar size={13} />
                        <span>Add First Schedule</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredSchedules.map((item) => {
                    const seqBands = resolveScheduleBands(item);
                    const firstBand = seqBands[0] || item.bandPreset;
                    const imgUrl = resolveMediaUrl(firstBand?.imagePath || item.imagePath);
                    const totalCycleSec = seqBands.length > 0
                      ? seqBands.reduce((sum, b) => sum + (Number(b.duration) || 10), 0)
                      : (Number(item.duration) || 10);
                    const gapSec =
                      item.gapSeconds !== undefined && item.gapSeconds !== null
                        ? Math.max(0, Number(item.gapSeconds) || 0)
                        : Math.max(0, Math.round((Number(item.gapMinutes) || 0) * 60));
                    const isFiring = firingId === item._id;

                    return (
                      <div
                        key={item._id}
                        className={`${SCHEDULE_GRID_COLS} px-4 py-2.5 2xl:px-5 2xl:py-3 hover:bg-[#141b29] transition text-xs`}
                      >
                        <div className="relative w-12">
                          {imgUrl ? (
                            <div className="w-12 h-8 rounded-md bg-black/60 border border-[#202c44] overflow-hidden flex items-center justify-center">
                              <img src={imgUrl} alt={item.title} className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-12 h-8 rounded-md bg-[#0e1422] border border-[#1b253b] flex items-center justify-center text-slate-500 text-[10px]">
                              No Img
                            </div>
                          )}
                          {seqBands.length > 1 && (
                            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-[#00bcd4] text-black font-bold text-[9px] shadow">
                              {seqBands.length}
                            </span>
                          )}
                        </div>

                        <div className="truncate">
                          <span className="font-semibold text-white block truncate text-xs">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-cyan-400 flex items-center gap-1 truncate mt-0.5">
                            <Layers size={10} className="shrink-0" />
                            <span className="truncate" title={seqBands.map((b, i) => `${i + 1}. ${b.title}`).join(' → ')}>
                              {seqBands.length > 1
                                ? `${seqBands.length} ordered: ${seqBands.map((b, i) => `#${i + 1} ${b.title}`).join(' → ')}`
                                : (firstBand?.title || (isLBand ? `Cutout ${item.windowWidth || 960}x${item.windowHeight || 540}` : 'Custom Ashton'))}
                            </span>
                          </span>
                        </div>

                        <div>
                          <span className="text-[10.5px] font-medium text-slate-200 block truncate">
                            {formatDateRange(item.startDate, item.endDate)}
                          </span>
                          <span className="text-[10px] text-purple-300 block truncate mt-0.5">
                            {formatDays(item.daysOfWeek)}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 text-slate-200 font-mono text-[11px]">
                            <Clock size={12} className="text-cyan-400 shrink-0" />
                            <span>
                              {item.dailyStartTime || '00:00:00'} → {item.dailyEndTime || '23:59:59'}
                            </span>
                          </div>
                          {item.lastFiredAt && (
                            <span className="text-[9px] text-slate-500 block mt-0.5 truncate">
                              Last fired: {new Date(item.lastFiredAt).toLocaleTimeString()}
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1">
                            <Timer size={12} className="text-emerald-400 shrink-0" />
                            <span className="text-emerald-400 font-bold truncate" title={`Total cycle: ${totalCycleSec}s`}>
                              {seqBands.length > 1
                                ? `${seqBands.slice(0, 3).map((b) => `${b.duration || 10}s`).join(' / ')}${seqBands.length > 3 ? '…' : ''}`
                                : `${totalCycleSec}s`}
                            </span>
                          </div>
                          <span className="text-[10px] text-amber-400/90 block mt-0.5">
                            {gapSec > 0 ? `${gapSec}s gap • Loop ∞` : 'Loop ∞'}
                          </span>
                        </div>

                        <div className="text-center">
                          <button
                            type="button"
                            onClick={() => onToggleScheduleStatus?.(item)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${item.enabled
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900/60'
                              : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white'
                              }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${item.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                            <span>{item.enabled ? 'Enabled' : 'Disabled'}</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isFiring}
                            onClick={() => onFireScheduleLive?.(item)}
                            className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 hover:bg-[#00bcd4] hover:text-black hover:border-[#00bcd4] transition cursor-pointer disabled:opacity-50"
                            title="Trigger Schedule Live On Air"
                          >
                            {isFiring ? (
                              <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                              <Play size={13} fill="currentColor" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditSchedule?.(item)}
                            className="p-1.5 rounded-lg bg-[#0e1422] border border-[#1b253b] text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition cursor-pointer"
                            title="Edit Schedule"
                          >
                            <Pencil size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteSchedule?.(item)}
                            className="p-1.5 rounded-lg bg-[#0e1422] border border-[#1b253b] text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition cursor-pointer"
                            title="Delete Schedule"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </TableScrollContainer>
        )}
      </div>
    </div>
  );
}
