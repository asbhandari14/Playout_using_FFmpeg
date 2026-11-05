import React, { useState } from 'react';
import { Layers, Calendar, Clock, Radio, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { PLAYLIST_TYPE_CONFIG, formatScheduleSummary, isPlaylistActiveNow } from '../../hooks/usePlaylist.js';

const SCHEDULE_GRID_COLS = 'grid grid-cols-[140px_minmax(200px,1.4fr)_140px_minmax(180px,1.2fr)_130px_100px_130px_100px] items-center gap-4';

export default function PlaylistScheduleTable({
  playlists = [],
  onEdit,
  onDelete,
  onOpenStudio
}) {
  const [currentTick] = useState(() => Date.now());
  const now = new Date(currentTick);

  return (
    <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl overflow-hidden shadow-2xl">
      {/* Horizontal Scaling & Scrolling Container */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#1e2738] scrollbar-track-transparent">
        <div className="min-w-[1150px]">
          {/* Grid Header */}
          <div className={`px-5 py-3.5 bg-[#0e1320] border-b border-[#161f33] text-[10px] uppercase font-extrabold text-slate-400 tracking-wider ${SCHEDULE_GRID_COLS}`}>
            <div>Priority & Type</div>
            <div>Playlist Name</div>
            <div>Channel</div>
            <div>Schedule Window</div>
            <div>Time Slot</div>
            <div className="text-center">Status</div>
            <div className="text-center">Items / Duration</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-[#131b2e]">
            {playlists.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No playlists found for this section. Click "+ Create Playlist" to configure one.
              </div>
            ) : (
              playlists.map((playlist) => {
                const typeConfig = PLAYLIST_TYPE_CONFIG[playlist.type] || PLAYLIST_TYPE_CONFIG.default;
                const isActiveRightNow = isPlaylistActiveNow(playlist, now);
                const scheduleSummary = formatScheduleSummary(playlist);
                const channel = playlist.channel || {};

                return (
                  <div
                    key={playlist._id}
                    className={`px-5 py-3.5 hover:bg-[#101524] transition text-xs ${SCHEDULE_GRID_COLS}`}
                  >
                    {/* Priority & Type */}
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${typeConfig.colorClass}`}
                      >
                        <span>P{playlist.priority || typeConfig.priority}</span>
                        <span>•</span>
                        <span>{typeConfig.shortLabel}</span>
                      </span>
                    </div>

                    {/* Playlist Name */}
                    <div>
                      <div className="flex items-center gap-2 max-w-full">
                        <div className="w-7 h-7 rounded-lg bg-[#121929] border border-[#222f49] flex items-center justify-center text-[#00bcd4] shrink-0">
                          {playlist.type === 'live_schedule' ? (
                            <Radio size={14} />
                          ) : (
                            <Layers size={14} />
                          )}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-white block truncate">
                            {playlist.name}
                          </span>
                          {playlist.type === 'live_schedule' && playlist.liveSourceUrl && (
                            <span className="text-[10px] text-purple-400 font-mono truncate max-w-xs block">
                              {playlist.liveSourceUrl}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Channel */}
                    <div>
                      {channel.name ? (
                        <div
                          onClick={() => onOpenStudio?.(channel._id)}
                          className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer group truncate"
                          title="Open Channel Studio"
                        >
                          <span className="truncate">{channel.name}</span>
                          <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition shrink-0" />
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">All Channels</span>
                      )}
                    </div>

                    {/* Schedule Window */}
                    <div className="text-slate-300">
                      <div className="flex items-center gap-1.5 truncate">
                        <Calendar size={13} className="text-slate-500 shrink-0" />
                        <span className="font-medium text-[11px] truncate">{scheduleSummary}</span>
                      </div>
                    </div>

                    {/* Time Slot */}
                    <div className="text-slate-300">
                      {playlist.startTime || playlist.endTime ? (
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-amber-400/80 shrink-0" />
                          <span className="font-mono text-[11px] text-amber-300 font-medium">
                            {playlist.startTime || '00:00'} - {playlist.endTime || '23:59'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">24 Hours</span>
                      )}
                    </div>

                    {/* Active Status */}
                    <div className="text-center">
                      {!playlist.isActive ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-500 text-[10px] font-bold uppercase">
                          Disabled
                        </span>
                      ) : isActiveRightNow ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border border-emerald-800/80 bg-emerald-950/70 text-emerald-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border border-blue-900/60 bg-blue-950/40 text-blue-400 text-[10px] font-bold uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                          Scheduled
                        </span>
                      )}
                    </div>

                    {/* Items / Duration */}
                    <div className="text-center">
                      <span className="font-mono text-[11px] text-slate-300">
                        {playlist.items?.length || 0} items ({playlist.totalDurationFormatted || '00:00:00'})
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {channel._id && (
                          <button
                            onClick={() => onOpenStudio?.(channel._id)}
                            className="p-1.5 rounded-lg bg-[#121929] hover:bg-[#1c273e] text-cyan-400 hover:text-white transition cursor-pointer"
                            title="Open Studio"
                          >
                            <ExternalLink size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => onEdit?.(playlist)}
                          className="p-1.5 rounded-lg bg-[#121929] hover:bg-[#1c273e] text-slate-300 hover:text-white transition cursor-pointer"
                          title="Edit Playlist Schedule"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => onDelete?.(playlist)}
                          className="p-1.5 rounded-lg bg-[#121929] hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Delete Playlist"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
