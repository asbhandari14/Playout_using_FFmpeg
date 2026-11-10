import React from 'react';
import {
  PlusCircle,
  Search,
  Tv,
  Calendar,
  Clock,
  Timer,
  Play,
  Pencil,
  Trash2,
  Check,
  Eye,
  PanelBottom,
  CreditCard,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import TableScrollContainer from '../table/TableScrollContainer.jsx';

const BAND_GRID_COLS =
  'grid grid-cols-[64px_minmax(150px,1.4fr)_100px_130px_115px_86px_96px] items-center gap-2.5';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BandTable({
  type = 'lband', // 'lband' | 'ashton'
  schedules = [],
  channels = [],
  selectedChannelId = '',
  onSelectChannel,
  currentUser = null,
  searchQuery = '',
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
  onToggleStatus,
  onFireLive,
  firingId = null,
  isLoading = false
}) {
  const isLBand = type === 'lband';
  const canSwitchChannel =
    (currentUser?.role === 'super_admin' || currentUser?.role === 'admin') &&
    channels.length > 0;

  const currentChannel = channels.find((c) => c._id === selectedChannelId) || channels[0];

  const filtered = schedules.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.scheduleOption && s.scheduleOption.toLowerCase().includes(q)) ||
      (s.dailyStartTime && s.dailyStartTime.includes(q))
    );
  });

  const formatDays = (days) => {
    if (!Array.isArray(days) || days.length === 0 || days.length === 7) return 'All Days';
    return days.map((d) => DAYS_SHORT[d]).join(', ');
  };

  const formatDateRange = (start, end) => {
    if (!start && !end) return 'Indefinite';
    const s = start ? new Date(start).toLocaleDateString() : 'Start';
    const e = end ? new Date(end).toLocaleDateString() : 'Ongoing';
    return `${s} → ${e}`;
  };

  return (
    <div className="space-y-3.5 2xl:space-y-4 select-none font-sans">
      {/* Top Header & Channel Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg 2xl:text-xl text-white tracking-tight">
              {isLBand ? 'L-Band Graphic Overlays' : 'Ashton Band Banner Overlays'}
            </h1>
          </div>
          <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
            {isLBand
              ? 'Multi-schedule L-Band commercial squeezes with duration and repeat intervals'
              : 'Multi-schedule lower-third Ashton banners with program squeeze and repeat intervals'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Channel Selector for Admins */}
          {canSwitchChannel && (
            <div className="flex items-center gap-1.5 bg-[#0f131c] border border-[#1f2738] px-2.5 py-1.5 2xl:py-2 rounded-lg text-xs">
              {/* <Tv size={14} className="text-[#00bcd4] shrink-0" />
              <span className="text-slate-400">Channel:</span> */}
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

          {/* Search box */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={`Search ${isLBand ? 'L-Bands' : 'Ashton Bands'}...`}
              className="w-44 sm:w-52 2xl:w-60 pl-8 pr-3 py-1.5 2xl:py-2 bg-[#0f131c] border border-[#1f2738] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
            />
          </div>

          {/* Add Band Button */}
          <button
            onClick={onCreate}
            className="px-3 py-1.5 2xl:px-3.5 2xl:py-2 rounded-lg bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition cursor-pointer shrink-0"
          >
            <PlusCircle size={14} />
            <span>Add {isLBand ? 'L-Band' : 'Ashton Band'}</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl overflow-hidden shadow-xl">
        <TableScrollContainer>
          <div className="w-full min-w-[836px]">
            {/* Table Header */}
            <div className={`${BAND_GRID_COLS} px-4 py-2.5 2xl:px-5 2xl:py-3 bg-[#131926] border-b border-[#1e2638] text-[10px] 2xl:text-[10.5px] uppercase font-bold text-slate-400 tracking-wider`}>
              <div>Preview</div>
              <div>Schedule Title</div>
              <div>Airing Type</div>
              <div>Air Window</div>
              <div>Duration / Gap</div>
              <div className="text-center">Status</div>
              <div className="text-right">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-[#171f31]">
              {isLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading schedules...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-cyan-400 mx-auto mb-2">
                    {isLBand ? <PanelBottom size={18} /> : <CreditCard size={18} />}
                  </div>
                  <p className="text-white font-semibold text-xs">
                    No {isLBand ? 'L-Band' : 'Ashton Band'} schedules found
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    {searchQuery
                      ? 'No items match your search filter.'
                      : `Channel "${currentChannel?.name || 'this channel'}" does not have any ${isLBand ? 'L-Band' : 'Ashton Band'} schedules configured yet.`}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={onCreate}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/60 transition text-xs font-semibold cursor-pointer"
                    >
                      <PlusCircle size={13} />
                      <span>Create First {isLBand ? 'L-Band' : 'Ashton Band'}</span>
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((item) => {
                  const imgUrl = item.imagePath
                    ? item.imagePath.startsWith('/')
                      ? item.imagePath
                      : `/${item.imagePath}`
                    : '';
                  const isFiring = firingId === item._id;

                  return (
                    <div
                      key={item._id}
                      className={`${BAND_GRID_COLS} px-4 py-2.5 2xl:px-5 2xl:py-3 hover:bg-[#141b29] transition text-xs`}
                    >
                      {/* 1. Preview Thumbnail */}
                      <div>
                        {imgUrl ? (
                          <div className="w-12 h-8 rounded-md bg-black/60 border border-[#202c44] overflow-hidden flex items-center justify-center relative group">
                            <img
                              src={imgUrl}
                              alt={item.title}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-8 rounded-md bg-[#0e1422] border border-[#1b253b] flex items-center justify-center text-slate-500 text-[10px]">
                            No Img
                          </div>
                        )}
                      </div>

                      {/* 2. Title & Specifics */}
                      <div className="truncate">
                        <span className="font-semibold text-white block truncate text-xs">
                          {item.title}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                          {isLBand ? (
                            <span>Cutout: {item.windowWidth || 960}x{item.windowHeight || 540}</span>
                          ) : (
                            <span className={item.ashtonSqueeze !== false ? 'text-cyan-400' : 'text-slate-400'}>
                              {item.ashtonSqueeze !== false ? 'Video Squeezed' : 'Overlay Mode'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3. Airing Type */}
                      <div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.scheduleOption === '24/7'
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                            : item.scheduleOption === 'weekly'
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                              : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                            }`}
                        >
                          <Calendar size={11} />
                          <span>{item.scheduleOption || '24/7'}</span>
                        </span>
                        {item.scheduleOption === 'weekly' && (
                          <span className="block text-[9px] text-slate-400 mt-1 truncate">
                            {formatDays(item.daysOfWeek)}
                          </span>
                        )}
                        {item.scheduleOption === 'datewise' && (
                          <span className="block text-[9px] text-slate-400 mt-1 truncate">
                            {formatDateRange(item.startDate, item.endDate)}
                          </span>
                        )}
                      </div>

                      {/* 4. Air Window */}
                      <div>
                        <div className="flex items-center gap-1.5 text-slate-200">
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

                      {/* 5. Duration / Gap */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Timer size={12} className="text-emerald-400 shrink-0" />
                          <span className="text-emerald-400 font-bold">{item.duration || 5}s display</span>
                        </div>
                        <span className="text-[10px] text-amber-400/90 block mt-0.5">
                          {item.gapMinutes > 0 ? `Every ${item.gapMinutes} mins` : 'Once per window'}
                        </span>
                      </div>

                      {/* 6. Status Toggle */}
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => onToggleStatus?.(item)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${item.enabled
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900/60'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${item.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                          <span>{item.enabled ? 'Active' : 'Disabled'}</span>
                        </button>
                      </div>

                      {/* 7. Actions */}
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Instant Fire Live on Air button */}
                        <button
                          type="button"
                          disabled={isFiring}
                          onClick={() => onFireLive?.(item)}
                          className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 hover:bg-[#00bcd4] hover:text-black hover:border-[#00bcd4] transition cursor-pointer disabled:opacity-50"
                          title="Trigger Live On Air Now"
                        >
                          {isFiring ? (
                            <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <Play size={13} fill="currentColor" />
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => onEdit?.(item)}
                          className="p-1.5 rounded-lg bg-[#0e1422] border border-[#1b253b] text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition cursor-pointer"
                          title="Edit Schedule"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => onDelete?.(item)}
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
      </div>
    </div>
  );
}
