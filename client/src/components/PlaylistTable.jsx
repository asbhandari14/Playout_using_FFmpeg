import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  savePlaylistThunk,
  clearPlaylistThunk,
  removeItem,
  moveItem,
  duplicateItem,
  addItem
} from '../store/slices/playlistSlice.js';
import { setSelectedAsset } from '../store/slices/assetSlice.js';
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
  Clock,
  Layers
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal.jsx';

export default function PlaylistTable({ channelId, onPlayFromIndex }) {
  const dispatch = useDispatch();
  const {
    items,
    totalDurationFormatted,
    hasUnsavedChanges,
    saveSuccess,
    loading
  } = useSelector((state) => state.playlist);

  const [activeMenuIndex, setActiveMenuIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggedRowIndex, setDraggedRowIndex] = useState(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);

  // Drag and drop from Asset Library or row reorder
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

    // 1. If dragging an asset from Library
    const rawAsset = e.dataTransfer.getData('application/json');
    if (rawAsset) {
      try {
        const asset = JSON.parse(rawAsset);
        dispatch(addItem(asset));
        return;
      } catch (err) {
        // ignore
      }
    }

    // 2. If reordering existing row
    if (draggedRowIndex !== null && targetIndex !== null) {
      dispatch(moveItem({ fromIndex: draggedRowIndex, toIndex: targetIndex }));
      setDraggedRowIndex(null);
    }
  };

  const handleSave = () => {
    dispatch(savePlaylistThunk({ channelId, items, loop: true }));
  };

  const handleClear = () => {
    setIsClearModalOpen(true);
  };

  const handleConfirmClear = () => {
    dispatch(clearPlaylistThunk(channelId));
    setIsClearModalOpen(false);
  };

  const handleConfirmRemoveItem = () => {
    if (itemToRemove !== null && itemToRemove.index !== undefined) {
      dispatch(removeItem(itemToRemove.index));
    }
    setItemToRemove(null);
  };

  return (
    <div
      className="flex-1 flex flex-col bg-[#11141a] select-none text-slate-200 overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => handleDrop(e, items.length)}
    >
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#141822] border-b border-[#202736] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Layers size={15} className="text-blue-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 m-0">
              Broadcast Window
            </h3>
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
            onClick={handleSave}
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
            onClick={handleClear}
            disabled={items.length === 0}
            className="px-3 py-1.5 rounded-lg bg-[#1b2230] hover:bg-red-950/40 hover:text-red-400 text-slate-400 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-40"
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Playlist Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#141822] text-slate-400 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10 border-b border-[#202736]">
            <tr>
              <th className="py-2.5 px-3 w-8 text-center"></th>
              <th className="py-2.5 px-3 w-8 text-center">#</th>
              <th className="py-2.5 px-3">Media Asset</th>
              <th className="py-2.5 px-3 w-20 text-center">Dur</th>
              <th className="py-2.5 px-3 w-20 text-center">Start</th>
              <th className="py-2.5 px-3 w-24 text-center">Status</th>
              <th className="py-2.5 px-3 w-28 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b212e]">
            {items.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <Film size={28} className="text-slate-600 mb-2 stroke-[1.5]" />
                    <span className="text-xs font-medium text-slate-400">
                      Broadcast window is currently empty
                    </span>
                    <span className="text-[11px] text-slate-600 mt-0.5">
                      Drag assets from the Assets Library or click "+" to build the continuous playout
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const asset = item.asset || {};
                const isPlaying = item.status === 'playing';
                const isPlayed = item.status === 'played';
                const isDragOver = dragOverIndex === index;

                return (
                  <tr
                    key={item._id || index}
                    draggable
                    onDragStart={() => setDraggedRowIndex(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`transition group ${
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
                    <td className="py-2 px-2 text-center">
                      <div className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing inline-block">
                        <GripVertical size={15} />
                      </div>
                    </td>

                    {/* Order # */}
                    <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-400">
                      {index + 1}
                    </td>

                    {/* Thumbnail + Title */}
                    <td className="py-2 px-3">
                      <div
                        onClick={() => dispatch(setSelectedAsset(asset))}
                        className="flex items-center gap-2.5 cursor-pointer"
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
                        <span className="font-semibold text-slate-200 group-hover:text-blue-400 transition truncate max-w-[280px]">
                          {asset.originalName || 'Video Asset'}
                        </span>
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-300">
                      {asset.durationFormatted || '00:00'}
                    </td>

                    {/* Cumulative Start */}
                    <td className="py-2 px-3 text-center font-mono text-[11px] text-sky-400 font-medium">
                      {item.startOffsetFormatted || '00:00'}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2 px-3 text-center">
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
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-right">
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
                          onClick={() => dispatch(moveItem({ fromIndex: index, toIndex: index - 1 }))}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1e2533] disabled:opacity-30 transition"
                          title="Move Up"
                        >
                          <ChevronUp size={14} />
                        </button>

                        {/* Move Down */}
                        <button
                          disabled={index === items.length - 1}
                          onClick={() => dispatch(moveItem({ fromIndex: index, toIndex: index + 1 }))}
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
                                dispatch(duplicateItem(index));
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Clear Entire Playlist Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClear}
        title="Clear Broadcast Playlist"
        message="Are you sure you want to clear all media items from the broadcast playlist? All queued items will be removed from this channel."
        confirmText="Clear All Playlist"
      />

      {/* Remove Single Item Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!itemToRemove}
        onClose={() => setItemToRemove(null)}
        onConfirm={handleConfirmRemoveItem}
        title="Remove From Playlist"
        itemName={itemToRemove?.name}
        message="Are you sure you want to remove this video item from the active broadcast playlist?"
        confirmText="Remove Item"
      />
    </div>
  );
}
