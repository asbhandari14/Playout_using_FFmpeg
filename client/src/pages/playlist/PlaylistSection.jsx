import React from 'react';
import { Search, PlusCircle } from 'lucide-react';
import PlaylistScheduleTable from '../../components/table/PlaylistScheduleTable.jsx';
import { PLAYLIST_TYPE_CONFIG } from '../../hooks/usePlaylist.js';

export default function PlaylistSection({
  type = 'default',
  playlists = [],
  searchQuery = '',
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
  onOpenStudio
}) {
  const typeConfig = PLAYLIST_TYPE_CONFIG[type] || PLAYLIST_TYPE_CONFIG.default;

  return (
    <div className="space-y-5">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl text-white tracking-wide">{typeConfig.label}</h1>
            <span
              className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${typeConfig.colorClass}`}
            >
              Priority {typeConfig.priority}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{typeConfig.description}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={`Search ${typeConfig.shortLabel} playlists...`}
              className="w-48 sm:w-60 pl-9 pr-3.5 py-2 bg-[#0c101c] border border-[#1c2539] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
            />
          </div>

          <button
            onClick={onCreate}
            className="px-4 py-2 rounded-md bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-medium text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer shrink-0"
          >
            <PlusCircle size={14} />
            <span>Create {typeConfig.shortLabel}</span>
          </button>
        </div>
      </div>

      {/* Playlist Schedule Table */}
      <PlaylistScheduleTable
        playlists={playlists}
        onEdit={onEdit}
        onDelete={onDelete}
        onOpenStudio={onOpenStudio}
      />
    </div>
  );
}
