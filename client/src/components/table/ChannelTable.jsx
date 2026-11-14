import React from 'react';
import { Radio, Copy, Check, Pencil, ExternalLink, Trash2, Calendar } from 'lucide-react';
import { RTMP_BASE_URL } from '../../constants/dashboard.js';
import TableScrollContainer from './TableScrollContainer.jsx';

const CHANNEL_GRID_COLS =
  'grid grid-cols-[150px_minmax(160px,1.5fr)_100px_100px_120px_70px_120px] items-center gap-2.5';

export default function ChannelTable({
  channels = [],
  onOpenStudio,
  onCopyUrl,
  copiedUrl = '',
  onEdit,
  onDelete,
  onOpenEpg
}) {
  return (
    <div className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl overflow-hidden shadow-xl">
      {/* Horizontal Scaling & Scrolling Container */}
      <TableScrollContainer>
        <div className="w-full min-w-[886px]">
          {/* Grid Header */}
          <div
            className={`px-4 py-2.5 2xl:px-5 2xl:py-3 bg-[#131926] border-b border-[#1e2638] text-[10px] 2xl:text-[10.5px] uppercase font-bold text-slate-400 tracking-wider ${CHANNEL_GRID_COLS}`}
          >
            <div>Channel</div>
            <div>Stream URL</div>
            <div>Created By</div>
            <div>Assigned To</div>
            <div className="text-center">Storage</div>
            <div className="text-center">Restreams</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-[#171f31]">
            {channels.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
                No channels available. Click "+ Add Channel" to provision a stream.
              </div>
            ) : (
              channels.map((ch) => {
                const rtmpDisplay = ch.rtmpUrl || `${RTMP_BASE_URL}${ch.streamKey || ch.name}`;
                const isCopied = copiedUrl === rtmpDisplay;
                return (
                  <div
                    key={ch._id}
                    className={`px-4 py-2.5 2xl:px-5 2xl:py-3 hover:bg-[#141b29] transition text-xs ${CHANNEL_GRID_COLS}`}
                  >
                    {/* Channel */}
                    <div>
                      <div
                        onClick={() => onOpenStudio?.(ch._id)}
                        className="flex items-center gap-2 cursor-pointer group"
                        title="Open Channel Studio"
                      >
                        <div className="w-6 h-6 2xl:w-7 2xl:h-7 rounded-md 2xl:rounded-lg bg-[#151d2e] border border-[#232f48] flex items-center justify-center text-[#00bcd4] shrink-0 group-hover:scale-105 transition">
                          <Radio size={13} />
                        </div>
                        <span className="font-semibold text-white group-hover:text-cyan-400 transition truncate">
                          {ch.name}
                        </span>
                      </div>
                    </div>

                    {/* URL */}
                    <div>
                      <div className="flex items-center gap-1.5 max-w-full">
                        <button
                          onClick={() => onCopyUrl?.(rtmpDisplay)}
                          className="p-1 rounded bg-[#141b2b] hover:bg-[#1d273e] text-cyan-400 hover:text-white transition shrink-0 cursor-pointer"
                          title="Copy RTMP Stream URL"
                        >
                          {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                        <span className="font-mono text-[11px] text-slate-300 truncate select-all">
                          {rtmpDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Created By */}
                    <div className="text-slate-300 font-medium truncate">
                      {ch.createdBy?.name || 'Super Admin'}
                    </div>

                    {/* Assigned To */}
                    <div className="text-slate-300 font-medium truncate">
                      {ch.assignedUser?.name || 'Unassigned'}
                    </div>

                    {/* Storage */}
                    <div className="text-center">
                      <span className="inline-block px-2 py-0.5 rounded-md border border-[#25324a] bg-[#0d121d] text-cyan-300 font-mono text-[10.5px] font-semibold truncate max-w-full">
                        {ch.storageDisplay || '0.00 GB / Unlimited'}
                      </span>
                    </div>

                    {/* Restreams */}
                    <div className="text-center">
                      <span className="inline-block px-2 py-0.5 rounded-md border border-[#25324a] bg-[#0d121d] text-slate-200 font-mono text-[11px] font-semibold">
                        10
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenEpg?.(ch)}
                          className="p-1 rounded-md text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 transition cursor-pointer"
                          title="View Channel EPG Guide"
                        >
                          <Calendar size={14} />
                        </button>
                        <button
                          onClick={() => onEdit?.(ch)}
                          className="p-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 transition cursor-pointer"
                          title="Edit Channel"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => onOpenStudio?.(ch._id)}
                          className="p-1 rounded-md text-cyan-400 hover:text-white hover:bg-cyan-950/30 transition cursor-pointer"
                          title="Open Live Playout Studio"
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => onDelete?.('channel', ch)}
                          className="p-1 rounded-md text-rose-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                          title="Delete Channel"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </TableScrollContainer>
    </div>
  );
}
