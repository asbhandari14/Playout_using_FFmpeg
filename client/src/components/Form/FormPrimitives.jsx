import React from 'react';

export const FORM_CARD_CLASS =
  'bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl p-4 sm:p-5 2xl:p-6 shadow-xl';

export const FORM_SHELL_CLASS =
  'flex items-center gap-2 px-3 py-1.5 2xl:py-2 rounded-lg bg-[#090d16] border border-[#1c2538] focus-within:border-[#00bcd4] transition';

export const FORM_INPUT_CLASS =
  'w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs';

export const FORM_SELECT_CLASS =
  'w-full px-3 py-1.5 2xl:py-2 rounded-lg bg-[#090d16] border border-[#1c2538] text-slate-200 focus:outline-none focus:border-[#00bcd4] text-xs transition cursor-pointer';

export const FORM_BTN_CANCEL =
  'px-4 py-1.5 2xl:py-2 rounded-lg border border-[#1e2638] text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#161e2e] transition cursor-pointer';

export const FORM_BTN_PRIMARY =
  'px-4 py-1.5 2xl:py-2 rounded-lg text-xs font-bold bg-[#00bcd4] hover:bg-[#06b6d4] text-black shadow-md shadow-cyan-500/20 transition cursor-pointer flex items-center gap-1.5';

export function FormField({ label, hint, required, className = '', children }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="text-slate-300 font-semibold text-xs flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-cyan-400 font-bold">*</span>}
        </label>
        {hint && <span className="text-[10px] text-slate-500 truncate">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

