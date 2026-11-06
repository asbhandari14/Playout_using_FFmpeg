import React, { useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Lock,
  Shield,
  UserCheck,
  User as UserIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';

const shellClass =
  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition';
const inputClass =
  'w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-lg font-mono';

function Field({ label, hint, required, children, className = '' }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-slate-300 flex items-center gap-1 text-base">
          <span>{label}</span>
          {required && <span className="text-cyan-400 font-bold">*</span>}
        </label>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function CreateUserForm({
  formData = {},
  setFormData,
  currentUser = null,
  onSubmit,
  onCancel
}) {
  const [showPassword, setShowPassword] = useState(false);

  const set = (field, transform) => (e) =>
    setFormData((prev) => {
      const val = transform ? transform(e.target.value) : e.target.value;
      return {
        ...prev,
        [field]: val,
        ...(field === 'name' ? { username: val } : {})
      };
    });

  const setCheckbox = (field) => (e) =>
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.checked
    }));

  const isAdmin = currentUser?.role === 'admin';
  const selectedRole = formData.role || 'user';

  return (
    <div className="space-y-4 select-none">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Users</span>
      </button>

      <div>
        <h1 className="text-2xl text-white tracking-wide">Create User</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Add a new user account to the cloud playout system with role-based access control
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-[#0b0e18] border border-[#161f33] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Full Name */}
          <Field label="Full Name" required>
            <div className={shellClass}>
              <UserIcon size={15} className="text-slate-500 shrink-0" />
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={set('name')}
                placeholder="e.g. Master Control Operator"
                className={inputClass}
              />
            </div>
          </Field>

          {/* Email Address */}
          <Field label="Email Address" required>
            <div className={shellClass}>
              <Mail size={15} className="text-slate-500 shrink-0" />
              <input
                type="email"
                required
                value={formData.email || ''}
                onChange={set('email')}
                placeholder="operator@playout.com"
                className={inputClass}
              />
            </div>
          </Field>

          {/* Password */}
          <Field label="Account Password" required>
            <div className={shellClass}>
              <Lock size={15} className="text-slate-500 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={formData.password || ''}
                onChange={set('password')}
                placeholder="Enter secure password"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-slate-500 hover:text-slate-300 transition shrink-0 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>

          {/* Role / Access Level */}
          <Field
            label="Role & Access Level"
            required
          >
            <div className={shellClass}>
              <Shield size={15} className="text-slate-500 shrink-0" />
              <select
                value={selectedRole}
                onChange={set('role')}
                disabled={isAdmin}
                className="w-full bg-transparent text-slate-100 focus:outline-none text-lg cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <option value="user" className="bg-[#0b0e18] text-slate-200">
                  User
                </option>
                {!isAdmin && (
                  <>
                    <option value="admin" className="bg-[#0b0e18] text-slate-200">
                      Admin
                    </option>
                    <option value="super_admin" className="bg-[#0b0e18] text-slate-200">
                      Super Admin
                    </option>
                  </>
                )}
              </select>
            </div>
          </Field>
        </div>

        {/* Account Status Switch (isActive)
        <div className="pt-2 border-t border-[#161f33]">
          <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#090d16] border border-[#1a2337] cursor-pointer hover:border-slate-600 transition">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 text-xs">Account Status</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${formData.isActive !== false
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                    }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${formData.isActive !== false ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                      }`}
                  />
                  <span>{formData.isActive !== false ? 'Active' : 'Suspended'}</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {formData.isActive !== false
                  ? 'User is allowed to log in and operate channels immediately.'
                  : 'Account is deactivated. Login attempts will be blocked.'}
              </span>
            </div>
            <input
              type="checkbox"
              checked={formData.isActive !== false}
              onChange={setCheckbox('isActive')}
              className="rounded w-4 h-4 text-cyan-500 bg-[#121929] border-[#222c42] focus:ring-0 cursor-pointer"
            />
          </label>
        </div> */}

        {/* Action Buttons */}
        <div className="pt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-10 py-4 rounded-xl text-lg font-medium text-slate-300 hover:bg-[#161f33] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 rounded-xl text-lg font-medium bg-[#00bcd4] hover:bg-[#06b6d4] text-black shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-2"
          >
            <UserCheck size={14} />
            <span>Create User</span>
          </button>
        </div>
      </form>
    </div>
  );
}
