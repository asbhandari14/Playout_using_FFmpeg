import React from 'react';

export default function AssetStorageFooter({ storageDisplay }) {
  const { used = '0.00 MB', total = 'Unlimited', filesCount = 0 } = storageDisplay || {};

  return (
    <div className="px-3 py-1.5 2xl:p-3 border-t border-[#1c222e] bg-[#10131a] flex items-center justify-between text-[10px] 2xl:text-[11px] shrink-0">
      <div>
        <span className="text-[8px] 2xl:text-[9px] font-semibold text-slate-500 uppercase tracking-wider block">
          Storage Usage
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="font-semibold text-cyan-400 font-mono">{used}</span>
          <span className="text-slate-500 font-bold">/</span>
          <span className="font-semibold text-slate-200 font-mono">{total}</span>
        </div>
      </div>

      <div className="px-2 py-0.5 rounded-full bg-[#1b2230] border border-[#263146] text-slate-300 text-[9px] 2xl:text-[10px] font-medium flex items-center gap-1 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span className="font-mono">{filesCount} FILES</span>
      </div>
    </div>
  );
}

