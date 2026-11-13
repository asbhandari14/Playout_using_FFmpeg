import React, { useEffect, useCallback } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

/**
 * Reusable broadcast-grade ConfirmDelete Modal.
 * Replaces native browser window.confirm with an elegant, styled confirmation dialog.
 */
export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title = 'Confirm Deletion',
  itemName = '',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isLoading = false,
  danger = true
}) {
  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') {
      onClose();
    } else if (typeof onCancel === 'function') {
      onCancel();
    }
  }, [onClose, onCancel]);

  const handleConfirm = useCallback(() => {
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  }, [onConfirm]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && !isLoading) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, isLoading]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) handleClose();
      }}
    >
      <div
        className="w-full max-w-md bg-[#131722] border border-[#242f44] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden transform transition-all duration-200 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Danger Accent */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                danger
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}
            >
              {danger ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                {title}
              </h3>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Confirmation Required
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1f2838] transition disabled:opacity-40 cursor-pointer"
            title="Cancel and close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-5 py-2 space-y-2.5">
          {itemName ? (
            <div className="p-2.5 rounded-lg bg-[#0d1017] border border-[#1e2738] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span className="text-xs font-mono font-bold text-slate-200 truncate">
                {itemName}
              </span>
            </div>
          ) : null}

          <p className="text-xs text-slate-300 leading-relaxed">
            {message}
          </p>

          <p className="text-[11px] text-slate-400 italic flex items-center gap-1.5">
            <span className="text-rose-400 font-bold">Note:</span> This action is permanent and cannot be reversed.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-3.5 bg-[#0e121a] border-t border-[#1c2434] flex items-center justify-end space-x-2.5 mt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-lg bg-[#1a2130] hover:bg-[#232c3f] border border-[#27344c] text-xs font-semibold text-slate-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg font-bold text-xs tracking-wide uppercase transition flex items-center gap-1.5 shadow-lg cursor-pointer ${
              danger
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50 hover:shadow-rose-900/60'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
            } disabled:opacity-50`}
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {danger ? <Trash2 size={14} /> : <AlertTriangle size={14} />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
