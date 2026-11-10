import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const OnlineDot = () => (
  <span className="relative flex h-2 w-2 shrink-0" title="Online">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
  </span>
);

export default function PlaylistSelector({
  playlists = [],
  currentPlaylist = null,
  activeOnAirPlaylist = null,
  onSelectPlaylist
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const defaultPlaylist =
    playlists.find((p) => p.type === 'default') || playlists[0] || null;

  const selectedPlaylist =
    (currentPlaylist && playlists.find((p) => p._id === currentPlaylist._id)) ||
    defaultPlaylist;

  const isSelectedOnline = Boolean(
    activeOnAirPlaylist &&
    selectedPlaylist &&
    activeOnAirPlaylist._id === selectedPlaylist._id
  );

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSelect = (playlist) => {
    if (onSelectPlaylist) {
      onSelectPlaylist(playlist);
    }
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-36 sm:w-40 xl:w-48 2xl:w-56 shrink-0 select-none"
    >
      <button
        type="button"
        onClick={() => playlists.length > 0 && setIsOpen((prev) => !prev)}
        disabled={playlists.length === 0}
        className="w-full bg-[#0b0e14] border border-[#232a39] hover:border-[#313b50] focus:outline-none focus:border-blue-500 text-[11px] 2xl:text-xs font-medium text-slate-200 rounded-md 2xl:rounded-lg px-2.5 py-1 2xl:px-3 2xl:py-1.5 flex items-center justify-between gap-2 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="truncate">
            {selectedPlaylist ? selectedPlaylist.name : 'No playlists available'}
          </span>
          {isSelectedOnline && <OnlineDot />}
        </span>
        <ChevronDown
          size={13}
          className={`text-slate-500 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && playlists.length > 0 && (
        <div className="absolute right-0 top-full mt-1 min-w-full w-max max-w-[260px] bg-[#0b0e14] border border-[#232a39] rounded-md 2xl:rounded-lg shadow-xl shadow-black/70 py-1 max-h-48 overflow-y-auto z-40">
          {playlists.map((p) => {
            const isOnline = Boolean(activeOnAirPlaylist && activeOnAirPlaylist._id === p._id);
            const isSelected = Boolean(selectedPlaylist && selectedPlaylist._id === p._id);

            return (
              <button
                key={p._id}
                type="button"
                onClick={() => handleSelect(p)}
                className={`w-full text-left px-2.5 py-1.5 2xl:px-3 2xl:py-2 text-[11px] 2xl:text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#172033] text-white font-semibold'
                    : 'text-slate-300 hover:bg-[#151b26] hover:text-white'
                }`}
              >
                <span className="truncate">{p.name}</span>
                {isOnline && <OnlineDot />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
