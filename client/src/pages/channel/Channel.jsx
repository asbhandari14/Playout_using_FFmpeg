import React from 'react';
import { Search, PlusCircle, Radio, Copy, Check, Pencil, ExternalLink, Trash2 } from 'lucide-react';
import { RTMP_BASE_URL } from '../../constants/dashboard.js';

export default function Channel({
  channels,
  searchQuery,
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
  onOpenStudio,
  copiedUrl,
  onCopyUrl
}) {
  return (
    <div className="space-y-5">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl text-white tracking-wide">Channels</h1>
          <p className="text-xs text-slate-400">Manage live channels</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search channels..."
              className="w-48 sm:w-56 pl-9 pr-3.5 py-2 bg-[#0c101c] border border-[#1c2539] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
            />
          </div>

          <button
            onClick={onCreate}
            className="px-4 py-2 rounded-md bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-medium text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <PlusCircle size={14} />
            <span>Add Channel</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#161f33] text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                <th className="py-3.5 px-5">Channel</th>
                <th className="py-3.5 px-5">URL</th>
                <th className="py-3.5 px-5">Created By</th>
                <th className="py-3.5 px-5">Assigned To</th>
                <th className="py-3.5 px-5 text-center">Restreams</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131b2e]">
              {channels.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 text-xs">
                    No channels available. Click "+ Add Channel" to provision a stream.
                  </td>
                </tr>
              ) : (
                channels.map((ch) => {
                  const rtmpDisplay = ch.rtmpUrl || `${RTMP_BASE_URL}${ch.streamKey || ch.name}`;
                  const isCopied = copiedUrl === rtmpDisplay;
                  return (
                    <tr key={ch._id} className="hover:bg-[#101524] transition">
                      <td className="py-3.5 px-5">
                        <div
                          onClick={() => onOpenStudio(ch._id)}
                          className="flex items-center gap-2.5 cursor-pointer group"
                          title="Open Channel Studio"
                        >
                          <div className="w-7 h-7 rounded-lg bg-[#121929] border border-[#222f49] flex items-center justify-center text-[#00bcd4] shrink-0 group-hover:scale-105 transition">
                            <Radio size={14} />
                          </div>
                          <span className="font-bold text-white group-hover:text-cyan-400 transition">
                            {ch.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2 max-w-xs sm:max-w-md">
                          <button
                            onClick={() => onCopyUrl(rtmpDisplay)}
                            className="p-1 rounded bg-[#121827] hover:bg-[#1c273e] text-cyan-400 hover:text-white transition shrink-0"
                            title="Copy RTMP Stream URL"
                          >
                            {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                          <span className="font-mono text-[11px] text-slate-300 truncate select-all">
                            {rtmpDisplay}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-slate-300 font-medium">
                        {ch.createdBy?.name || 'Super Admin Account'}
                      </td>

                      <td className="py-3.5 px-5 text-slate-300 font-medium">
                        {ch.assignedUser?.name || 'Unassigned'}
                      </td>

                      <td className="py-3.5 px-5 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg border border-[#27354f] bg-[#101625] text-slate-200 text-xs font-semibold">
                          10
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => onEdit(ch)}
                            className="p-1 rounded text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                            title="Edit Channel"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => onOpenStudio(ch._id)}
                            className="p-1 rounded text-cyan-400 hover:text-white transition cursor-pointer"
                            title="Open Live Playout Studio"
                          >
                            <ExternalLink size={15} />
                          </button>
                          <button
                            onClick={() => onDelete('channel', ch)}
                            className="p-1 rounded text-rose-500 hover:text-rose-400 transition cursor-pointer"
                            title="Delete Channel"
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