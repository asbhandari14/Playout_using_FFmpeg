import React from 'react';
import { Upload, X, ChevronDown, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export default function AssetUploadModal({
  isOpen,
  isUploading,
  uploadFiles,
  uploadCategory,
  onCategoryChange,
  onStartUpload,
  onClose
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#131720] border border-[#252c3c] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#222938] flex items-center justify-between bg-[#161b26]">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-blue-500" />
            <h3 className="text-sm font-bold text-white m-0">Upload Video Assets</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#222938] transition disabled:opacity-50 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Target Category
            </label>
            <div className="relative">
              <select
                value={uploadCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                disabled={isUploading}
                className="w-full pl-3 pr-8 py-2 bg-[#0c1017] border border-[#232b3d] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="Promos">Promos</option>
                <option value="General">General</option>
                <option value="Episodes">Episodes</option>
                <option value="Songs">Songs</option>
                <option value="Ads">Ads</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Selected Files ({uploadFiles.length})
            </label>
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {uploadFiles.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-[#0c1017] border border-[#1e2533] rounded-xl flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200 truncate max-w-[260px]">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-500">{item.size}</span>
                  </div>

                  <div className="w-full bg-[#171d29] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.status === 'completed'
                          ? 'bg-emerald-500'
                          : item.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-blue-500'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">
                      {item.status === 'uploading' && `Uploading... ${item.progress}%`}
                      {item.status === 'completed' && 'Upload Complete (Processing)'}
                      {item.status === 'failed' && (item.error || 'Failed')}
                      {item.status === 'queued' && 'Queued'}
                    </span>
                    <span>
                      {item.status === 'completed' && (
                        <CheckCircle2 size={13} className="text-emerald-500" />
                      )}
                      {item.status === 'uploading' && (
                        <Clock size={13} className="text-blue-500 animate-spin" />
                      )}
                      {item.status === 'failed' && (
                        <AlertTriangle size={13} className="text-rose-500" />
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#222938] bg-[#161b26] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#202736] transition disabled:opacity-50 cursor-pointer"
          >
            {uploadFiles.every((f) => f.status === 'completed') ? 'Done' : 'Cancel'}
          </button>
          {!uploadFiles.every((f) => f.status === 'completed') && (
            <button
              onClick={onStartUpload}
              disabled={isUploading || uploadFiles.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <Clock size={14} className="animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>Start Upload</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

