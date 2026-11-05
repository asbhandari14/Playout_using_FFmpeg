import React from 'react';
import { Server as ServerIcon, Copy, Check, Pencil, Trash2 } from 'lucide-react';

const SERVER_GRID_COLS = 'grid grid-cols-[220px_minmax(240px,1.5fr)_130px_130px_minmax(180px,1fr)_100px] items-center gap-4';

export default function ServerTable({
  servers = [],
  onCopyUrl,
  copiedUrl = '',
  onEdit,
  onDelete
}) {
  return (
    <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl overflow-hidden shadow-2xl">
      {/* Horizontal Scaling & Scrolling Container */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#1e2738] scrollbar-track-transparent">
        <div className="min-w-[1000px]">
          {/* Grid Header */}
          <div className={`px-5 py-3.5 bg-[#0e1320] border-b border-[#161f33] text-[10px] uppercase font-extrabold text-slate-400 tracking-wider ${SERVER_GRID_COLS}`}>
            <div>Server / Stream Name</div>
            <div>Stream URL</div>
            <div>Category</div>
            <div>Username</div>
            <div>RTMP Target</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-[#131b2e]">
            {servers.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No servers configured. Click "+ Add Server" to configure a media server.
              </div>
            ) : (
              servers.map((srv) => {
                const urlDisplay = srv.streamUrl || srv.hlsBaseUrl || '';
                const isCopied = copiedUrl === urlDisplay;
                const rtmpTarget = srv.rtmpBaseUrl || 'rtmp://127.0.0.1/static';

                return (
                  <div
                    key={srv._id}
                    className={`px-5 py-3.5 hover:bg-[#101524] transition text-xs ${SERVER_GRID_COLS}`}
                  >
                    {/* Server Name */}
                    <div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#121929] border border-[#222f49] flex items-center justify-center text-[#00bcd4] shrink-0">
                          <ServerIcon size={14} />
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-white block truncate">
                            {srv.name}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate block">
                            {srv.createdBy?.name ? `By ${srv.createdBy.name}` : 'Default Cluster'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stream URL */}
                    <div>
                      <div className="flex items-center gap-2 max-w-full">
                        <button
                          onClick={() => onCopyUrl?.(urlDisplay)}
                          className="p-1 rounded bg-[#121827] hover:bg-[#1c273e] text-cyan-400 hover:text-white transition shrink-0 cursor-pointer"
                          title="Copy Stream URL"
                        >
                          {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                        <span className="font-mono text-[11px] text-slate-300 truncate select-all">
                          {urlDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-lg border border-[#27354f] bg-[#101625] text-slate-300 text-[11px] font-medium truncate max-w-full">
                        {srv.category || 'General'}
                      </span>
                    </div>

                    {/* Username */}
                    <div className="text-slate-300 font-medium truncate">
                      {srv.serverUsername || <span className="text-slate-500 italic">None</span>}
                    </div>

                    {/* RTMP Target */}
                    <div>
                      <span className="font-mono text-[11px] text-slate-400 truncate block max-w-full">
                        {rtmpTarget}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => onEdit?.(srv)}
                          className="p-1 rounded text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                          title="Edit Server"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => onDelete?.('server', srv)}
                          className="p-1 rounded text-rose-500 hover:text-rose-400 transition cursor-pointer"
                          title="Delete Server"
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
