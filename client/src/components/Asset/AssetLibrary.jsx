import React from 'react';
import {
  Film,
  Upload,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  GripVertical,
  ChevronDown,
  FileVideo
} from 'lucide-react';
import useAssetLibrary from '../../hooks/useAssetLibrary.js';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';
import AssetUploadModal from './AssetUploadModal.jsx';
import AssetStorageFooter from './AssetStorageFooter.jsx';

export default function AssetLibrary({ channelId, onAddToPlaylist }) {
  const {
    assets,
    selectedAsset,
    categoryFilter,
    searchQuery,
    storageDisplay,
    fileInputRef,
    isUploadModalOpen,
    uploadFiles,
    uploadCategory,
    setUploadCategory,
    isUploading,
    assetToDelete,
    categories,
    handleFilesSelected,
    handleStartUpload,
    handleDelete,
    handleConfirmDelete,
    handleCancelDelete,
    handleDragStart,
    handleSearchChange,
    handleCategoryChange,
    handleSelectAsset,
    handleCloseUploadModal
  } = useAssetLibrary(channelId);

  return (
    <div className="h-full flex flex-col bg-[#12151b] border-r border-[#202634] select-none text-slate-200 overflow-hidden">
      {/* Top Header */}
      <div className="px-3 py-2 2xl:px-4 2xl:py-2.5 border-b border-[#202634] flex items-center justify-between bg-[#151922] shrink-0">
        <div className="flex items-center gap-1.5 2xl:gap-2">
          <Film size={13} className="text-blue-500" />
          <h2 className="text-[11px] 2xl:text-xs font-bold uppercase tracking-wider text-slate-200 m-0">
            Assets Library
          </h2>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="p-2 2xl:p-3 space-y-1.5 2xl:space-y-2 border-b border-[#1c222e] shrink-0">
        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search (1280×720)..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-7 pr-2.5 py-1 2xl:py-1.5 bg-[#0b0e14] border border-[#232a39] rounded-md 2xl:rounded-lg text-[11px] 2xl:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Upload + Category Filter */}
        <div className="flex items-center gap-1.5 2xl:gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-1 px-2 2xl:py-1.5 2xl:px-3 rounded-md 2xl:rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white font-medium text-[11px] 2xl:text-xs flex items-center justify-center gap-1 2xl:gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Upload size={12} />
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

          <div className="relative flex-1 min-w-0">
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full appearance-none bg-[#0b0e14] border border-[#232a39] text-[11px] 2xl:text-xs text-slate-300 rounded-md 2xl:rounded-lg pl-2 pr-6 py-1 2xl:pl-3 2xl:pr-7 2xl:py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer truncate"
            >
              {categories.map((c) => (
                <option key={c} value={c} className="bg-[#0b0e14]">
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Asset Cards List */}
      <div className="flex-1 overflow-y-auto p-2 2xl:p-2.5 space-y-1.5 2xl:space-y-2 min-h-0">
        {assets.length === 0 ? (
          <div className="text-center py-8 2xl:py-12 text-slate-500 text-[11px] 2xl:text-xs flex flex-col items-center">
            <FileVideo size={24} className="mb-1.5 text-slate-600 stroke-[1.5]" />
            <span>No video assets found</span>
            <span className="text-[9.5px] 2xl:text-[10px] text-slate-600 mt-0.5">Click Upload to add videos</span>
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
                onClick={() => handleSelectAsset(asset)}
                className={`p-1.5 2xl:p-2 rounded-lg 2xl:rounded-xl border transition cursor-pointer group flex items-center gap-1.5 2xl:gap-2.5 ${isSelected
                  ? 'bg-[#182030] border-blue-500/80 shadow-md shadow-blue-500/10'
                  : 'bg-[#151922] border-[#222938] hover:border-[#2f394d] hover:bg-[#181d28]'
                  }`}
              >
                {/* Drag Handle */}
                <div
                  className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0"
                  title="Drag into Playlist"
                >
                  <GripVertical size={13} />
                </div>

                {/* Thumbnail */}
                <div className="w-12 h-8 2xl:w-16 2xl:h-11 rounded-md 2xl:rounded-lg bg-[#0a0d13] border border-[#222a3a] overflow-hidden shrink-0 relative flex items-center justify-center">
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
                    <FileVideo size={14} className="text-slate-600" />
                  )}
                  {/* Duration overlay badge */}
                  <span className="absolute bottom-0.5 right-0.5 bg-black/85 text-[8px] 2xl:text-[9px] font-mono text-slate-200 px-1 rounded leading-tight">
                    {asset.durationFormatted || '00:00'}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 leading-tight">
                  <h4
                    className="text-[11px] 2xl:text-xs font-semibold text-slate-100 truncate group-hover:text-blue-400 transition m-0"
                    title={asset.originalName}
                  >
                    {asset.originalName}
                  </h4>

                  <div className="flex items-center gap-1.5 mt-0.5 text-[9.5px] 2xl:text-[10px] text-slate-400">
                    <span>{asset.durationFormatted || '00:00'}</span>
                    <span>•</span>
                    <span>{asset.sizeFormatted}</span>
                  </div>

                  {/* Status Badge */}
                  <div className="mt-0.5 2xl:mt-1 flex items-center gap-1">
                    {isReady && (
                      <span className="inline-flex items-center gap-0.5 text-[8.5px] 2xl:text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                        <CheckCircle2 size={10} /> READY
                      </span>
                    )}
                    {isProcessing && (
                      <span className="inline-flex items-center gap-1 text-[8.5px] 2xl:text-[9px] font-bold text-blue-400 uppercase tracking-wider animate-pulse">
                        <div className="w-2 h-2 rounded-full border border-blue-400 border-t-transparent animate-spin" />
                        PROCESSING
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center gap-1 text-[8.5px] 2xl:text-[9px] font-bold text-red-400 uppercase tracking-wider">
                        <AlertTriangle size={10} /> FAILED
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-0.5 2xl:gap-1 shrink-0">
                  {isReady && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToPlaylist(asset);
                      }}
                      className="w-6 h-6 2xl:w-7 2xl:h-7 rounded-md 2xl:rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white flex items-center justify-center transition shadow-sm cursor-pointer"
                      title="Add to Playlist"
                    >
                      <Plus size={12} />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDelete(e, asset)}
                    className="w-6 h-6 2xl:w-7 2xl:h-7 rounded-md 2xl:rounded-lg text-slate-500 hover:text-red-400 hover:bg-[#1f2636] flex items-center justify-center transition cursor-pointer"
                    title="Delete Asset"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Storage Counter */}
      <AssetStorageFooter storageDisplay={storageDisplay} />

      {/* Upload Progress Modal */}
      <AssetUploadModal
        isOpen={isUploadModalOpen}
        isUploading={isUploading}
        uploadFiles={uploadFiles}
        uploadCategory={uploadCategory}
        onCategoryChange={setUploadCategory}
        onStartUpload={handleStartUpload}
        onClose={handleCloseUploadModal}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(assetToDelete)}
        title="Delete Video Asset"
        message="Are you sure you want to permanently delete this media file from local disk storage? Any playlist referencing this asset might fail to play."
        onConfirm={handleConfirmDelete}
        onClose={handleCancelDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
