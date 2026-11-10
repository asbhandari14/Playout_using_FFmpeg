import React from 'react';
import { Server as ServerIcon, Copy, Check, Pencil, Trash2 } from 'lucide-react';
import TableScrollContainer from './TableScrollContainer.jsx';

const SERVER_GRID_COLS =
  'grid grid-cols-[160px_minmax(160px,1.4fr)_95px_95px_minmax(125px,1fr)_76px] items-center gap-2.5';

export default function ServerTable({
  servers = [],
  onCopyUrl,
  copiedUrl = '',
  onEdit,
  onDelete
}) {
  return (
    <div className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl overflow-hidden shadow-xl">
      {/* Horizontal Scaling & Scrolling Container */}
      <TableScrollContainer>
        <div className="w-full min-w-[796px]">
          {/* Grid Header */}
          <div
            className={`px-4 py-2.5 2xl:px-5 2xl:py-3 bg-[#131926] border-b border-[#1e2638] text-[10px] 2xl:text-[10.5px] uppercase font-bold text-slate-400 tracking-wider ${SERVER_GRID_COLS}`}
          >
            <div>Server / Stream Name</div>
            <div>Stream URL</div>
            <div>Category</div>
            <div>Username</div>
            <div>RTMP Target</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-[#171f31]">
            {servers.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
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
                    className={`px-4 py-2.5 2xl:px-5 2xl:py-3 hover:bg-[#141b29] transition text-xs ${SERVER_GRID_COLS}`}
                  >
                    {/* Server Name */}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 2xl:w-7 2xl:h-7 rounded-md 2xl:rounded-lg bg-[#151d2e] border border-[#232f48] flex items-center justify-center text-[#00bcd4] shrink-0">
                          <ServerIcon size={13} />
                        </div>
                        <div className="truncate">
                          <span className="font-semibold text-white block truncate">
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
                      <div className="flex items-center gap-1.5 max-w-full">
                        <button
                          onClick={() => onCopyUrl?.(urlDisplay)}
                          className="p-1 rounded bg-[#141b2b] hover:bg-[#1d273e] text-cyan-400 hover:text-white transition shrink-0 cursor-pointer"
                          title="Copy Stream URL"
                        >
                          {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                        <span className="font-mono text-[11px] text-slate-300 truncate select-all">
                          {urlDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md border border-[#25324a] bg-[#0d121d] text-slate-300 text-[10.5px] font-medium truncate max-w-full">
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onEdit?.(srv)}
                          className="p-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 transition cursor-pointer"
                          title="Edit Server"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete?.('server', srv)}
                          className="p-1 rounded-md text-rose-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                          title="Delete Server"
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
