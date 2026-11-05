import React from 'react';
import { Radio, Copy, Check, Pencil, ExternalLink, Trash2 } from 'lucide-react';
import { RTMP_BASE_URL } from '../../constants/dashboard.js';

const CHANNEL_GRID_COLS = 'grid grid-cols-[200px_minmax(240px,1.5fr)_140px_140px_160px_90px_110px] items-center gap-4';

export default function ChannelTable({
  channels = [],
  onOpenStudio,
  onCopyUrl,
  copiedUrl = '',
  onEdit,
  onDelete
}) {
  return (
    <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl overflow-hidden shadow-2xl">
      {/* Horizontal Scaling & Scrolling Container */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#1e2738] scrollbar-track-transparent">
        <div className="min-w-[1080px]">
          {/* Grid Header */}
          <div className={`px-5 py-3.5 bg-[#0e1320] border-b border-[#161f33] text-[10px] uppercase font-extrabold text-slate-400 tracking-wider ${CHANNEL_GRID_COLS}`}>
            <div>Channel</div>
            <div>Stream URL</div>
            <div>Created By</div>
            <div>Assigned To</div>
            <div className="text-center">Storage</div>
            <div className="text-center">Restreams</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-[#131b2e]">
            {channels.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No channels available. Click "+ Add Channel" to provision a stream.
              </div>
            ) : (
              channels.map((ch) => {
                const rtmpDisplay = ch.rtmpUrl || `${RTMP_BASE_URL}${ch.streamKey || ch.name}`;
                const isCopied = copiedUrl === rtmpDisplay;
                return (
                  <div
                    key={ch._id}
                    className={`px-5 py-3.5 hover:bg-[#101524] transition text-xs ${CHANNEL_GRID_COLS}`}
                  >
                    {/* Channel */}
                    <div>
                      <div
                        onClick={() => onOpenStudio?.(ch._id)}
                        className="flex items-center gap-2.5 cursor-pointer group"
                        title="Open Channel Studio"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#121929] border border-[#222f49] flex items-center justify-center text-[#00bcd4] shrink-0 group-hover:scale-105 transition">
                          <Radio size={14} />
                        </div>
                        <span className="font-bold text-white group-hover:text-cyan-400 transition truncate">
                          {ch.name}
                        </span>
                      </div>
                    </div>

                    {/* URL */}
                    <div>
                      <div className="flex items-center gap-2 max-w-full">
                        <button
                          onClick={() => onCopyUrl?.(rtmpDisplay)}
                          className="p-1 rounded bg-[#121827] hover:bg-[#1c273e] text-cyan-400 hover:text-white transition shrink-0 cursor-pointer"
                          title="Copy RTMP Stream URL"
                        >
                          {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                        <span className="font-mono text-[11px] text-slate-300 truncate select-all">
                          {rtmpDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Created By */}
                    <div className="text-slate-300 font-medium truncate">
                      {ch.createdBy?.name || 'Super Admin Account'}
                    </div>

                    {/* Assigned To */}
                    <div className="text-slate-300 font-medium truncate">
                      {ch.assignedUser?.name || 'Unassigned'}
                    </div>

                    {/* Storage */}
                    <div className="text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg border border-[#27354f] bg-[#101625] text-cyan-300 font-mono text-[11px] font-semibold truncate max-w-full">
                        {ch.storageDisplay || '0.00 GB / Unlimited'}
                      </span>
                    </div>

                    {/* Restreams */}
                    <div className="text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg border border-[#27354f] bg-[#101625] text-slate-200 text-xs font-semibold">
                        10
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => onEdit?.(ch)}
                          className="p-1 rounded text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                          title="Edit Channel"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => onOpenStudio?.(ch._id)}
                          className="p-1 rounded text-cyan-400 hover:text-white transition cursor-pointer"
                          title="Open Live Playout Studio"
                        >
                          <ExternalLink size={15} />
                        </button>
                        <button
                          onClick={() => onDelete?.('channel', ch)}
                          className="p-1 rounded text-rose-500 hover:text-rose-400 transition cursor-pointer"
                          title="Delete Channel"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
