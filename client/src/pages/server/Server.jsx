import React from 'react';
import { Search, PlusCircle, Server as ServerIcon, Copy, Check, Pencil, Trash2 } from 'lucide-react';

export default function Server({
  servers = [],
  searchQuery = '',
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
  copiedUrl = '',
  onCopyUrl
}) {
  return (
    <div className="space-y-5">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl text-white tracking-wide">Servers</h1>
          <p className="text-xs text-slate-400">Manage streaming and ingest media servers</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search servers..."
              className="w-48 sm:w-56 pl-9 pr-3.5 py-2 bg-[#0c101c] border border-[#1c2539] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
            />
          </div>

          <button
            onClick={onCreate}
            className="px-4 py-2 rounded-md bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-medium text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <PlusCircle size={14} />
            <span>Add Server</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#161f33] text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                <th className="py-3.5 px-5">Server / Stream Name</th>
                <th className="py-3.5 px-5">Stream URL</th>
                <th className="py-3.5 px-5">Category</th>
                <th className="py-3.5 px-5">Username</th>
                <th className="py-3.5 px-5">RTMP Target</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131b2e]">
              {servers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 text-xs">
                    No servers configured. Click "+ Add Server" to configure a media server.
                  </td>
                </tr>
              ) : (
                servers.map((srv) => {
                  const urlDisplay = srv.streamUrl || srv.hlsBaseUrl || '';
                  const isCopied = copiedUrl === urlDisplay;
                  const rtmpTarget = srv.rtmpBaseUrl || 'rtmp://127.0.0.1/static';

                  return (
                    <tr key={srv._id} className="hover:bg-[#101524] transition">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#121929] border border-[#222f49] flex items-center justify-center text-[#00bcd4] shrink-0">
                            <ServerIcon size={14} />
                          </div>
                          <div>
                            <span className="font-bold text-white block">
                              {srv.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {srv.createdBy?.name ? `By ${srv.createdBy.name}` : 'Default Cluster'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2 max-w-xs sm:max-w-md">
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
                      </td>

                      <td className="py-3.5 px-5">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg border border-[#27354f] bg-[#101625] text-slate-300 text-[11px] font-medium">
                          {srv.category || 'General'}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-slate-300 font-medium">
                        {srv.serverUsername || <span className="text-slate-500 italic">None</span>}
                      </td>

                      <td className="py-3.5 px-5">
                        <span className="font-mono text-[11px] text-slate-400 truncate block max-w-xs">
                          {rtmpTarget}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-right">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
