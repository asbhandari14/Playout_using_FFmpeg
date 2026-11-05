import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setSelectedAsset } from '../../store/slices/assetSlice.js';
import {
  Save,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Play,
  MoreVertical,
  Copy,
  Film,
  CheckCircle2,
  Layers,
  Radio,
  Calendar
} from 'lucide-react';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';
import PlaylistSettingsModal from '../modals/PlaylistSettingsModal.jsx';
import PlaylistSelector from '../playlist/PlaylistSelector.jsx';
import { usePlaylist, PLAYLIST_TYPE_CONFIG } from '../../hooks/usePlaylist.js';

const PLAYLIST_ROW_GRID = 'grid grid-cols-[32px_36px_minmax(220px,1fr)_75px_75px_90px_120px] items-center gap-2';

export default function PlaylistTable({ channelId, onPlayFromIndex }) {
  const dispatch = useDispatch();

  const {
    sortedPlaylists,
    currentPlaylist,
    activeOnAirPlaylist,
    activeStatusMap,
    items,
    totalDurationFormatted,
    hasUnsavedChanges,
    saveSuccess,
    loading,
    handleSelectPlaylist,
    handleCreatePlaylist,
    handleUpdatePlaylist,
    handleDeletePlaylist,
    handleSaveCurrent,
    handleClearCurrent,
    handleAddItem,
    handleRemoveItem,
    handleMoveItem,
    handleDuplicateItem,
    formatScheduleSummary
  } = usePlaylist(channelId);

  const [activeMenuIndex, setActiveMenuIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggedRowIndex, setDraggedRowIndex] = useState(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [playlistToEdit, setPlaylistToEdit] = useState(null);
  const [isDeletePlaylistModalOpen, setIsDeletePlaylistModalOpen] = useState(false);
  const [playlistToDeleteId, setPlaylistToDeleteId] = useState(null);

  // Drag and drop handlers
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    setDragOverIndex(null);

    // 1. Dragging asset from Asset Library
    const rawAsset = e.dataTransfer.getData('application/json');
    if (rawAsset) {
      try {
        const asset = JSON.parse(rawAsset);
        handleAddItem(asset);
        return;
      } catch (err) {
        // ignore
      }
    }

    // 2. Reordering existing row
    if (draggedRowIndex !== null && targetIndex !== null) {
      handleMoveItem(draggedRowIndex, targetIndex);
      setDraggedRowIndex(null);
    }
  };

  const handleOpenEditSettings = (playlist) => {
    setPlaylistToEdit(playlist);
    setIsSettingsModalOpen(true);
  };

  const handleOpenCreateNew = () => {
    setPlaylistToEdit(null);
    setIsSettingsModalOpen(true);
  };

  const handleSaveSettings = async (formData) => {
    if (playlistToEdit && playlistToEdit._id) {
      await handleUpdatePlaylist(playlistToEdit._id, formData);
    } else {
      await handleCreatePlaylist(formData);
    }
  };

  const handleRequestDeletePlaylist = (playlistId) => {
    setPlaylistToDeleteId(playlistId);
    setIsSettingsModalOpen(false);
    setIsDeletePlaylistModalOpen(true);
  };

  const handleConfirmDeletePlaylist = async () => {
    if (playlistToDeleteId) {
      await handleDeletePlaylist(playlistToDeleteId);
      setPlaylistToDeleteId(null);
      setIsDeletePlaylistModalOpen(false);
    }
  };

  const currentTypeConfig = currentPlaylist
    ? PLAYLIST_TYPE_CONFIG[currentPlaylist.type] || PLAYLIST_TYPE_CONFIG.default
    : PLAYLIST_TYPE_CONFIG.default;

  const isOnAir = activeOnAirPlaylist && currentPlaylist && activeOnAirPlaylist._id === currentPlaylist._id;
  const scheduleSummary = formatScheduleSummary(currentPlaylist);

  return (
    <div
      className="flex-1 flex flex-col bg-[#11141a] select-none text-slate-200 overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => handleDrop(e, items.length)}
    >
      {/* Multi-tier Playlist Tabs Selector */}
      <PlaylistSelector
        playlists={sortedPlaylists}
        currentPlaylist={currentPlaylist}
        activeOnAirPlaylist={activeOnAirPlaylist}
        activeStatusMap={activeStatusMap}
        onSelectPlaylist={handleSelectPlaylist}
        onOpenSettings={handleOpenEditSettings}
        onCreateNew={handleOpenCreateNew}
      />

      {/* Broadcast Window Header with Priority & Schedule Info */}
      <div className="px-4 py-2.5 bg-[#141822] border-b border-[#202736] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-blue-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 m-0">
              {currentPlaylist?.name || 'Broadcast Window'}
            </h3>

            {/* Priority Badge */}
            <span
              className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                currentTypeConfig.colorClass
              }`}
            >
              Priority {currentPlaylist?.priority || currentTypeConfig.priority}: {currentTypeConfig.shortLabel}
            </span>

            {/* On-Air badge if currently live */}
            {isOnAir && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                ON AIR NOW
              </span>
            )}
          </div>

          {/* Schedule Info Text */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#0c0e14] border border-[#232b3c] text-[11px] text-slate-400 font-medium">
            <Calendar size={12} className="text-slate-500" />
            <span>{scheduleSummary}</span>
          </div>

          {/* Time range indicator */}
          <div className="px-2.5 py-0.5 rounded-lg bg-[#0c0e14] border border-[#232b3c] font-mono text-[11px] font-semibold text-sky-400">
            00:00:00 &rarr; {totalDurationFormatted}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}

          <button
            onClick={handleSaveCurrent}
            disabled={loading}
            className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition shadow-sm ${
              hasUnsavedChanges
                ? 'bg-[#2563eb] hover:bg-blue-600 text-white shadow-blue-600/30 animate-pulse'
                : 'bg-[#1b2230] hover:bg-[#232c3d] text-slate-300'
            }`}
          >
            <Save size={13} />
            <span>Save</span>
          </button>

          <button
            onClick={() => setIsClearModalOpen(true)}
            disabled={items.length === 0}
            className="px-3 py-1.5 rounded-lg bg-[#1b2230] hover:bg-red-950/40 hover:text-red-400 text-slate-400 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-40"
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Live Relay Banner (for live_schedule) */}
      {currentPlaylist?.type === 'live_schedule' && currentPlaylist.liveSourceUrl && (
        <div className="px-4 py-2 bg-purple-950/20 border-b border-purple-800/40 flex items-center justify-between text-xs text-purple-300">
          <div className="flex items-center gap-2">
            <Radio size={14} className="animate-pulse text-purple-400" />
            <span>Live Stream Relay Source:</span>
            <span className="font-mono text-[11px] bg-black/40 px-2 py-0.5 rounded border border-purple-800/60 text-purple-200">
              {currentPlaylist.liveSourceUrl}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Assets below will play as fallback or sequential slots
          </span>
        </div>
      )}

      {/* Playlist Grid Table with Horizontal Scaling & Scrolling Container */}
      <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-[#1e2738] scrollbar-track-transparent">
        <div className="min-w-[700px]">
          {/* Grid Header */}
          <div className={`px-4 py-2.5 bg-[#141822] text-slate-400 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10 border-b border-[#202736] ${PLAYLIST_ROW_GRID}`}>
            <div className="text-center"></div>
            <div className="text-center font-mono">#</div>
            <div>Media Asset</div>
            <div className="text-center">Dur</div>
            <div className="text-center">Start</div>
            <div className="text-center">Status</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-[#1b212e]">
            {items.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <div className="flex flex-col items-center justify-center">
                  <Film size={28} className="text-slate-600 mb-2 stroke-[1.5]" />
                  <span className="text-xs font-medium text-slate-400">
                    "{currentPlaylist?.name || 'Playlist'}" is currently empty
                  </span>
                  <span className="text-[11px] text-slate-600 mt-0.5">
                    Drag assets from the Assets Library or click "+" to build the {currentTypeConfig.shortLabel} sequence
                  </span>
                </div>
              </div>
            ) : (
              items.map((item, index) => {
                const asset = item.asset || {};
                const isPlaying = item.status === 'playing';
                const isPlayed = item.status === 'played';
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={item._id || index}
                    draggable
                    onDragStart={() => setDraggedRowIndex(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`px-4 py-2 text-xs transition group ${PLAYLIST_ROW_GRID} ${
                      isDragOver ? 'border-t-2 border-blue-500 bg-blue-950/20' : ''
                    } ${
                      isPlaying
                        ? 'bg-blue-950/40 border-l-2 border-blue-500'
                        : isPlayed
                        ? 'bg-[#101318]/60 opacity-60'
                        : 'hover:bg-[#161b25]'
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="text-center">
                      <div className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing inline-block">
                        <GripVertical size={15} />
                      </div>
                    </div>

                    {/* Order # */}
                    <div className="text-center font-mono text-[11px] text-slate-400">
                      {index + 1}
                    </div>

                    {/* Thumbnail + Title */}
                    <div>
                      <div
                        onClick={() => dispatch(setSelectedAsset(asset))}
                        className="flex items-center gap-2.5 cursor-pointer max-w-full"
                      >
                        <div className="w-12 h-8 rounded bg-black/60 border border-[#232b3c] overflow-hidden shrink-0 flex items-center justify-center">
                          {asset.thumbnailPath ? (
                            <img
                              src={`/${asset.thumbnailPath}`}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Film size={14} className="text-slate-600" />
                          )}
                        </div>
                        <span title={asset.originalName || 'Video Asset'} className="font-semibold text-slate-200 group-hover:text-blue-400 transition truncate max-w-[280px]">
                          {asset.originalName || 'Video Asset'}
                        </span>
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="text-center font-mono text-[11px] text-slate-300">
                      {asset.durationFormatted || '00:00'}
                    </div>

                    {/* Cumulative Start */}
                    <div className="text-center font-mono text-[11px] text-sky-400 font-medium">
                      {item.startOffsetFormatted || '00:00'}
                    </div>

                    {/* Status Badge */}
                    <div className="text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          isPlaying
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/50 animate-pulse'
                            : isPlayed
                            ? 'bg-slate-800 text-slate-500'
                            : 'bg-slate-800/80 text-slate-300 border border-slate-700/60'
                        }`}
                      >
                        {item.status || 'QUEUED'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 relative">
                        {/* Play from here button */}
                        <button
                          onClick={() => onPlayFromIndex && onPlayFromIndex(index)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1e2533] transition"
                          title="Play From Here"
                        >
                          <Play size={13} className="fill-current" />
                        </button>

                        {/* Move Up */}
                        <button
                          disabled={index === 0}
                          onClick={() => handleMoveItem(index, index - 1)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1e2533] disabled:opacity-30 transition"
                          title="Move Up"
                        >
                          <ChevronUp size={14} />
                        </button>

                        {/* Move Down */}
                        <button
                          disabled={index === items.length - 1}
                          onClick={() => handleMoveItem(index, index + 1)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1e2533] disabled:opacity-30 transition"
                          title="Move Down"
                        >
                          <ChevronDown size={14} />
                        </button>

                        {/* 3-dots Context Menu */}
                        <button
                          onClick={() =>
                            setActiveMenuIndex(activeMenuIndex === index ? null : index)
                          }
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1e2533] transition"
                          title="Options"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {activeMenuIndex === index && (
                          <div className="absolute right-0 top-7 w-32 bg-[#161b24] border border-[#2b3548] rounded-xl shadow-2xl py-1 z-30 text-xs">
                            <button
                              onClick={() => {
                                handleDuplicateItem(index);
                                setActiveMenuIndex(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#202736] flex items-center gap-2"
                            >
                              <Copy size={12} />
                              Duplicate
                            </button>
                            <button
                              onClick={() => {
                                setItemToRemove({ index, name: item.asset?.originalName || `Item #${index + 1}` });
                                setActiveMenuIndex(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-950/30 flex items-center gap-2"
                            >
                              <Trash2 size={12} />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Playlist Settings / Schedule Modal */}
      <PlaylistSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        playlist={playlistToEdit}
        onSave={handleSaveSettings}
        onDelete={handleRequestDeletePlaylist}
      />

      {/* Clear Entire Playlist Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={() => {
          handleClearCurrent();
          setIsClearModalOpen(false);
        }}
        title={`Clear "${currentPlaylist?.name || 'Broadcast'}" Playlist`}
        message="Are you sure you want to clear all media items from this playlist? All queued items will be removed."
        confirmText="Clear All Playlist"
      />

      {/* Remove Single Item Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!itemToRemove}
        onClose={() => setItemToRemove(null)}
        onConfirm={() => {
          if (itemToRemove && itemToRemove.index !== undefined) {
            handleRemoveItem(itemToRemove.index);
          }
          setItemToRemove(null);
        }}
        title="Remove From Playlist"
        itemName={itemToRemove?.name}
        message="Are you sure you want to remove this video item from the active broadcast playlist?"
        confirmText="Remove Item"
      />

      {/* Delete Playlist Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isDeletePlaylistModalOpen}
        onClose={() => setIsDeletePlaylistModalOpen(false)}
        onConfirm={handleConfirmDeletePlaylist}
        title="Delete Playlist"
        itemName={sortedPlaylists.find((p) => p._id === playlistToDeleteId)?.name}
        message="Are you sure you want to permanently delete this playlist configuration and its items?"
        confirmText="Delete Playlist"
      />
    </div>
  );
}
