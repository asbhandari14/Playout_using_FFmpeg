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

export function ToggleSwitch({
  checked = false,
  onChange,
  name,
  disabled = false,
  size = 'md',
  className = '',
  ariaLabel
}) {
  const trackSize = size === 'sm' ? 'w-8 h-[18px]' : 'w-10 h-[22px]';
  const thumbSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const translateOn = size === 'sm' ? 'translate-x-3.5' : 'translate-x-[18px]';

  return (
    <span
      className={`relative inline-flex items-center shrink-0 ${trackSize} ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <input
        type="checkbox"
        name={name}
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel || name}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10 m-0"
      />
      <span
        aria-hidden="true"
        className={`w-full h-full rounded-full transition-colors duration-200 flex items-center p-[3px] ${
          checked ? 'bg-[#1d5eff] shadow-inner shadow-blue-900/40' : 'bg-[#2a3346]'
        }`}
      >
        <span
          className={`${thumbSize} rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
            checked ? translateOn : 'translate-x-0'
          }`}
        />
      </span>
    </span>
  );
}

