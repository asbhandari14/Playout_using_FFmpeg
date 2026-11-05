import React from 'react';
import { PLAYLIST_TYPE_CONFIG } from '../../hooks/usePlaylist.js';
import { Plus, Settings } from 'lucide-react';

export default function PlaylistSelector({
  playlists = [],
  currentPlaylist = null,
  activeOnAirPlaylist = null,
  activeStatusMap = {},
  onSelectPlaylist,
  onOpenSettings,
  onCreateNew
}) {
  return (
    <div className="bg-[#121620] border-b border-[#202736] px-4 py-2 flex flex-wrap items-center justify-between gap-2 select-none">
      {/* Left: Playlist Tabs / Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none max-w-full">
        {playlists.map((p) => {
          const isSelected = currentPlaylist && currentPlaylist._id === p._id;
          const isOnAir = activeOnAirPlaylist && activeOnAirPlaylist._id === p._id;
          const isActiveNow = Boolean(activeStatusMap[p._id]);
          const typeConfig = PLAYLIST_TYPE_CONFIG[p.type] || PLAYLIST_TYPE_CONFIG.default;

          return (
            <button
              key={p._id}
              onClick={() => onSelectPlaylist(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition shrink-0 ${
                isSelected
                  ? 'bg-[#1e2535] border-blue-500 text-white shadow-sm ring-1 ring-blue-500/30'
                  : 'bg-[#151a24] border-[#222a3a] text-slate-400 hover:text-slate-200 hover:bg-[#1a212e]'
              }`}
            >
              {/* Priority badge */}
              <span
                className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                  typeConfig.colorClass
                }`}
              >
                P{p.priority || typeConfig.priority}
              </span>

              {/* Playlist name */}
              <span className="truncate max-w-[130px] font-medium">{p.name}</span>

              {/* On-air or live status indicator */}
              {isOnAir ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  ON AIR
                </span>
              ) : isActiveNow ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  ACTIVE
                </span>
              ) : !p.isActive ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-500">
                  OFF
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {currentPlaylist && (
          <button
            onClick={() => onOpenSettings(currentPlaylist)}
            className="px-2.5 py-1.5 rounded-lg bg-[#1a212e] hover:bg-[#232c3d] text-slate-300 border border-[#232b3c] text-xs font-medium flex items-center gap-1.5 transition"
            title="Edit Schedule & Priority"
          >
            <Settings size={13} className="text-slate-400" />
            <span className="hidden sm:inline">Schedule Settings</span>
          </button>
        )}

        <button
          onClick={onCreateNew}
          className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition"
          title="Create New Playlist"
        >
          <Plus size={14} />
          <span>New Playlist</span>
        </button>
      </div>
    </div>
  );
}
