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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white capitalize tracking-wide">{section}</h1>
          <p className="text-xs text-slate-400 mt-0.5">Broadcasting module configuration</p>
        </div>
      </div>

      <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl p-12 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[#101726] border border-[#1f2b44] mx-auto flex items-center justify-center text-cyan-400 mb-4">
          {Icon && <Icon size={28} />}
        </div>
        <h3 className="text-base font-bold text-white capitalize mb-1">{section} Management</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
          Manage your streaming assets, analytics, and channel outputs directly from the Tarangix Lite control deck.
        </p>

        {firstChannel && (
          <button
            onClick={onOpenControlRoom}
            className="px-5 py-2.5 rounded-xl bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-extrabold text-xs inline-flex items-center gap-2 transition"
          >
            <Radio size={15} />
            <span>Open Live Control Room ({firstChannel.name})</span>
          </button>
        )}
      </div>
    </div>
  );
}