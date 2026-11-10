import React from 'react';
import {
  UploadCloud,
  Cloud,
  TrendingUp,
  IndianRupee,
  ListFilter,
  HardDrive,
  Cookie,
  Radio
} from 'lucide-react';

const SECTION_ICONS = {
  upload: UploadCloud,
  public: Cloud,
  analytics: TrendingUp,
  plans: IndianRupee,
  logs: ListFilter,
  storage: HardDrive,
  cookies: Cookie
};

export default function ModulePlaceholder({ section, firstChannel, onOpenControlRoom }) {
  const Icon = SECTION_ICONS[section];

  return (
    <div className="space-y-3.5 2xl:space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg 2xl:text-xl font-bold text-white capitalize tracking-tight">
            {section}
          </h1>
          <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
            Broadcasting module configuration
          </p>
        </div>
      </div>

      <div className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl p-8 2xl:p-10 text-center shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-[#151d2e] border border-[#232f48] mx-auto flex items-center justify-center text-cyan-400 mb-3">
          {Icon && <Icon size={22} />}
        </div>
        <h3 className="text-sm font-bold text-white capitalize mb-1">{section} Management</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
          Manage your streaming assets, analytics, and channel outputs directly from the Tarangix Lite control deck.
        </p>

        {firstChannel && (
          <button
            onClick={onOpenControlRoom}
            className="px-4 py-2 rounded-lg bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-bold text-xs inline-flex items-center gap-2 transition cursor-pointer"
          >
            <Radio size={14} />
            <span>Open Live Control Room ({firstChannel.name})</span>
          </button>
        )}
      </div>
    </div>
  );
}