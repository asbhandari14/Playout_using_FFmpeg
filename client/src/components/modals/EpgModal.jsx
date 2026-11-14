import React, { useEffect } from 'react';
import { X, Calendar, Tv } from 'lucide-react';
import EpgSection from '../epg/EpgSection.jsx';

/**
 * EpgModal: Popup broadcast guide modal.
 * Can be opened from ChannelTable, ChannelCard, ControlRoom, or Dashboard.
 */
export default function EpgModal({
  isOpen,
  onClose,
  channel = null,
  channels = []
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resolvedChannels = Array.isArray(channels) && channels.length > 0
    ? channels
    : (channel ? [channel] : []);

  const activeChannelId = channel?._id ? String(channel._id) : (resolvedChannels[0]?._id ? String(resolvedChannels[0]._id) : null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-black/80 backdrop-blur-md animate-fadeIn select-none font-mono"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1500px] h-[92vh] bg-[#0a0d13] border border-[#222c3f] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="px-4 py-3 bg-[#0d121c] border-b border-[#1b2333] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Calendar size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 m-0">
                <span>Electronic Programme Guide (EPG)</span>
                {channel?.name && (
                  <span className="text-cyan-400 font-semibold">— {channel.name}</span>
                )}
                {channel?.status === 'online' && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    ON AIR
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 m-0">
                24-Hour Broadcast Micro-Event Timeline &amp; Commercial Breaks Guide
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close EPG (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 bg-[#0a0d13]">
          <EpgSection
            channels={resolvedChannels}
            activeChannelId={activeChannelId}
          />
        </div>
      </div>
    </div>
  );
}
