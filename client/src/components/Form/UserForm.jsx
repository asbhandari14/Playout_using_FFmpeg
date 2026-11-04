import React from 'react';
import {
  ArrowLeft,
  Mail,
  Lock,
  Shield,
  Gauge,
  Clock,
  HardDrive,
  UserCheck,
  User as UserIcon
} from 'lucide-react';
import { DEFAULT_PERMISSIONS } from '../../constants/dashboard.js';

const shellClass =
  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition';
const amountShellClass =
  'flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition';
const inputClass =
  'w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs';
const unitSelectClass =
  'bg-transparent text-slate-300 font-semibold focus:outline-none border-l border-slate-700 pl-2 text-xs';

function Field({ label, hint, className = '', children }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-slate-300 font-semibold">{label}</label>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function AmountField({ label, icon: Icon, amount, unit, placeholder, onAmountChange, onUnitChange }) {
  return (
    <Field label={label} hint="0 or blank = Unlimited">
      <div className={amountShellClass}>
        <Icon size={15} className="text-slate-500 shrink-0" />
        <input
          type="number"
          min="0"
          value={amount}
          onChange={onAmountChange}
          placeholder={placeholder}
          className={inputClass}
        />
        <select value={unit} onChange={onUnitChange} className={unitSelectClass}>
          <option value="GB" className="bg-[#0b0e18]">GB</option>
          <option value="TB" className="bg-[#0b0e18]">TB</option>
        </select>
      </div>
    </Field>
  );
}

export default function UserForm({
  mode, // 'create' | 'edit'
  formData,
  setFormData,
  onTogglePermission,
  onSubmit,
  onCancel
}) {
  const isCreate = mode === 'create';
  const set = (field, transform) => (e) =>
    setFormData((prev) => ({
      ...prev,
      [field]: transform ? transform(e.target.value) : e.target.value
    }));

  return (
    <div className="space-y-4 max-w-5xl">
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Users</span>
      </button>

      <div>
        <h1 className="text-xl text-white tracking-wide">
          {isCreate ? 'Create User' : 'Update User'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isCreate
            ? 'Add a new system user with specific access permissions'
            : 'Update system user details and specific access permissions'}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-[#0b0e18] border border-[#161f33] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <Field label="Username">
            <div className={shellClass}>
              <UserIcon size={15} className="text-slate-500 shrink-0" />
              <input
                type="text"
                required
                value={formData.username}
                onChange={set('username')}
                placeholder="Enter username"
                className={inputClass}
              />
            </div>
          </Field>

          <Field label="Email">
            <div className={shellClass}>
              <Mail size={15} className="text-slate-500 shrink-0" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={set('email')}
                placeholder="user@example.com"
                className={inputClass}
              />
            </div>
          </Field>

          <Field label="Password">
            <div className={shellClass}>
              <Lock size={15} className="text-slate-500 shrink-0" />
              <input
                type="password"
                required={isCreate}
                value={formData.password}
                onChange={set('password')}
                placeholder={isCreate ? 'Enter password' : 'Leave blank to keep current password'}
                className={inputClass}
              />
            </div>
          </Field>

          <Field label="Access Level">
            <div className={shellClass}>
              <Shield size={15} className="text-slate-500 shrink-0" />
              <select
                value={formData.role}
                onChange={set('role')}
                className="w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer"
              >
                <option value="user" className="bg-[#0b0e18] text-slate-200">User (Standard Access)</option>
                <option value="admin" className="bg-[#0b0e18] text-slate-200">Admin (Channel Manager)</option>
                <option value="super_admin" className="bg-[#0b0e18] text-slate-200">Super Admin (Full System Control)</option>
              </select>
            </div>
          </Field>

          <AmountField
            label="Allocated Bandwidth"
            icon={Gauge}
            amount={formData.bandwidthAmount}
            unit={formData.bandwidthUnit}
            placeholder="Enter bandwidth amount"
            onAmountChange={set('bandwidthAmount')}
            onUnitChange={set('bandwidthUnit')}
          />

          <AmountField
            label="Allocated Storage"
            icon={HardDrive}
            amount={formData.storageAmount}
            unit={formData.storageUnit}
            placeholder="Enter storage amount"
            onAmountChange={set('storageAmount')}
            onUnitChange={set('storageUnit')}
          />

          <Field
            label="Bandwidth Grace Period (Days)"
            hint="Default: 3 Days (0 = No Grace)"
            className="md:col-span-2"
          >
            <div className={`${amountShellClass} max-w-xs`}>
              <Clock size={15} className="text-slate-500 shrink-0" />
              <input
                type="number"
                min="0"
                value={formData.gracePeriodDays}
                onChange={set('gracePeriodDays', Number)}
                className={inputClass}
              />
            </div>
          </Field>
        </div>

        {/* Permissions */}
        <div className="pt-2">
          <label className="block text-slate-300 font-semibold mb-3 text-xs">Permissions</label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_PERMISSIONS.map((perm) => {
              const isActive = formData.permissions.includes(perm);
              return (
                <button
                  type="button"
                  key={perm}
                  onClick={() => onTogglePermission(perm)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${isActive
                    ? 'border-[#00bcd4]/80 bg-[#00bcd4]/10 text-[#00bcd4] shadow-sm shadow-cyan-500/20'
                    : 'border-[#1f293d] bg-[#0c101b] text-slate-400 hover:border-slate-600'
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#00bcd4]' : 'bg-slate-600'}`} />
                  {perm}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#161f33] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#161f33] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 rounded-xl text-xs font-extrabold bg-[#00bcd4] hover:bg-[#06b6d4] text-black shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-2"
          >
            <UserCheck size={14} />
            <span>{isCreate ? 'Create User' : 'Update User'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}