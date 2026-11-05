import React from 'react';
import { Search, PlusCircle } from 'lucide-react';
import ChannelTable from '../../components/table/ChannelTable';

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

      {/* Channel Table Component */}
      <ChannelTable
        channels={channels}
        onOpenStudio={onOpenStudio}
        onCopyUrl={onCopyUrl}
        copiedUrl={copiedUrl}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
