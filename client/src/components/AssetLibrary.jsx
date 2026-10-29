import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  uploadAssetChunked,
  deleteAsset,
  setSelectedAsset,
  setCategoryFilter,
  setSearchQuery
} from '../store/slices/assetSlice.js';
import {
  Film,
  Upload,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HardDrive,
  GripVertical,
  ChevronDown,
  X,
  FileVideo
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal.jsx';

export default function AssetLibrary({ channelId, onAddToPlaylist }) {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);

  const {
    list: assets,
    storage,
    selectedAsset,
    categoryFilter,
    searchQuery,
    loading
  } = useSelector((state) => state.assets);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [assetToDelete, setAssetToDelete] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('Promos');
  const [isUploading, setIsUploading] = useState(false);

  // File selection
  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newUploads = files.map((file) => ({
      file,
      id: Math.random().toString(36).substring(2),
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      progress: 0,
      status: 'queued'
    }));

    setUploadFiles((prev) => [...prev, ...newUploads]);
    setIsUploadModalOpen(true);
  };

  const handleStartUpload = async () => {
    if (uploadFiles.length === 0 || isUploading) return;
    setIsUploading(true);

    for (let i = 0; i < uploadFiles.length; i++) {
      const item = uploadFiles[i];
      if (item.status === 'completed') continue;

      setUploadFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f))
      );

      try {
        await dispatch(
          uploadAssetChunked({
            channelId,
            category: uploadCategory,
            file: item.file,
            onProgress: (percent) => {
              setUploadFiles((prev) =>
                prev.map((f, idx) => (idx === i ? { ...f, progress: percent } : f))
              );
            }
          })
        ).unwrap();

        setUploadFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, progress: 100, status: 'completed' } : f))
        );
      } catch (err) {
        setUploadFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'failed', error: err || 'Upload failed' } : f
          )
        );
      }
    }

    setIsUploading(false);
  };

  const handleDelete = (e, asset) => {
    e.stopPropagation();
    setAssetToDelete(asset);
  };

  const handleConfirmDelete = async () => {
    if (assetToDelete?._id) {
      await dispatch(deleteAsset(assetToDelete._id));
    }
    setAssetToDelete(null);
  };

  const handleDragStart = (e, asset) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Categories list
  const categories = ['All categories', 'Promos', 'General', 'Episodes', 'Songs', 'Ads'];

  return (
    <div className="h-full flex flex-col bg-[#12151b] border-r border-[#202634] select-none text-slate-200">
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-[#202634] flex items-center justify-between bg-[#151922]">
        <div className="flex items-center gap-2">
          <Film size={15} className="text-blue-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 m-0">
            Assets Library
          </h2>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="p-3 space-y-2.5 border-b border-[#1c222e]">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search (1280×720)..."
            value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            className="w-full pl-8 pr-3 py-1.5 bg-[#0b0e14] border border-[#232a39] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Upload + Category Filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-1.5 px-3 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <Upload size={14} />
            <span>Upload</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,.mp4,.mov,.mkv,.ts,.avi,.flv,.m4v"
            className="hidden"
            onChange={handleFilesSelected}
          />

          <div className="relative flex-1">
            <select
              value={categoryFilter}
              onChange={(e) => dispatch(setCategoryFilter(e.target.value))}
              className="w-full appearance-none bg-[#0b0e14] border border-[#232a39] text-xs text-slate-300 rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:border-blue-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Asset Cards List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {assets.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center">
            <FileVideo size={28} className="mb-2 text-slate-600 stroke-[1.5]" />
            <span>No video assets found</span>
            <span className="text-[10px] text-slate-600 mt-0.5">Click Upload to add videos</span>
          </div>
        ) : (
          assets.map((asset) => {
            const isSelected = selectedAsset?._id === asset._id;
            const isReady = asset.status === 'ready';
            const isProcessing = asset.status === 'processing' || asset.status === 'uploading';
            const isFailed = asset.status === 'failed';

            return (
              <div
                key={asset._id}
                draggable={isReady}
                onDragStart={(e) => handleDragStart(e, asset)}
                onClick={() => dispatch(setSelectedAsset(asset))}
                className={`p-2 rounded-xl border transition cursor-pointer group flex items-center gap-2.5 ${
                  isSelected
                    ? 'bg-[#182030] border-blue-500/80 shadow-md shadow-blue-500/10'
                    : 'bg-[#151922] border-[#222938] hover:border-[#2f394d] hover:bg-[#181d28]'
                }`}
              >
                {/* Drag Handle */}
                <div
                  className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0"
                  title="Drag into Playlist"
                >
                  <GripVertical size={16} />
                </div>

                {/* Thumbnail */}
                <div className="w-16 h-11 rounded-lg bg-[#0a0d13] border border-[#222a3a] overflow-hidden shrink-0 relative flex items-center justify-center">
                  {asset.thumbnailPath ? (
                    <img
                      src={`/${asset.thumbnailPath}`}
                      alt={asset.originalName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <FileVideo size={18} className="text-slate-600" />
                  )}
                  {/* Duration overlay badge */}
                  <span className="absolute bottom-0.5 right-0.5 bg-black/85 text-[9px] font-mono text-slate-200 px-1 rounded">
                    {asset.durationFormatted || '00:00'}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4
                    className="text-xs font-semibold text-slate-100 truncate group-hover:text-blue-400 transition m-0"
                    title={asset.originalName}
                  >
                    {asset.originalName}
                  </h4>

                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                    <span>{asset.durationFormatted || '00:00'}</span>
                    <span>•</span>
                    <span>{(asset.size / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>

                  {/* Status Badge */}
                  <div className="mt-1 flex items-center gap-1.5">
                    {isReady && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                        <CheckCircle2 size={11} /> READY
                      </span>
                    )}
                    {isProcessing && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-400 uppercase tracking-wider animate-pulse">
                        <div className="w-2 h-2 rounded-full border border-blue-400 border-t-transparent animate-spin"></div>
                        PROCESSING
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase tracking-wider">
                        <AlertTriangle size={11} /> FAILED
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {isReady && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToPlaylist(asset);
                      }}
                      className="w-7 h-7 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white flex items-center justify-center transition shadow-sm"
                      title="Add to Playlist"
                    >
                      <Plus size={14} />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDelete(e, asset)}
                    className="w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-[#1f2636] flex items-center justify-center transition"
                    title="Delete Asset"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Storage Counter */}
      <div className="p-3 border-t border-[#1c222e] bg-[#10131a] flex items-center justify-between text-[11px]">
        <div>
          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">
            Storage Usage
          </span>
          <span className="font-semibold text-slate-200">{storage.totalUsedGB || '0.00'} GB</span>
        </div>

        <div className="px-2 py-0.5 rounded-full bg-[#1b2230] border border-[#263146] text-slate-300 text-[10px] font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          <span>{storage.totalCount || assets.length} FILES</span>
        </div>
      </div>

      {/* Upload Progress Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#131720] border border-[#252c3c] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[#222938] flex items-center justify-between bg-[#161b26]">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-blue-500" />
                <h3 className="text-sm font-bold text-white m-0">Upload Video Assets</h3>
              </div>
              <button
                disabled={isUploading}
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Assign Category
                </label>
                <input
                  type="text"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  placeholder="e.g. Promos / Commercials"
                  className="w-full px-3 py-1.5 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Upload items list */}
              <div className="space-y-2">
                {uploadFiles.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#0c0f16] border border-[#1f2636] rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200 truncate max-w-[260px]">
                        {item.name}
                      </span>
                      <span className="text-slate-500 text-[10px]">{item.size}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-[#1b2230] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          item.status === 'failed'
                            ? 'bg-red-500'
                            : item.status === 'completed'
                            ? 'bg-emerald-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {item.status === 'queued' && 'Ready in queue'}
                        {item.status === 'uploading' && `Uploading chunks... ${item.progress}%`}
                        {item.status === 'completed' && 'Upload completed (Processing in background)'}
                        {item.status === 'failed' && (
                          <span className="text-red-400">Failed: {item.error}</span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#202736] flex items-center justify-end gap-2 bg-[#121620]">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setIsUploadModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-[#1a202c] hover:bg-[#222b3b] text-slate-300 text-xs font-medium transition"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isUploading || uploadFiles.length === 0}
                onClick={handleStartUpload}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : 'Start Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!assetToDelete}
        onClose={() => setAssetToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Media Asset"
        itemName={assetToDelete?.originalName}
        message="Are you sure you want to permanently delete this media file from local disk storage? Any playlist referencing this asset might fail to play."
        confirmText="Delete Asset"
      />
    </div>
  );
}
