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
  Info
} from 'lucide-react';
import {
  FORM_CARD_CLASS,
  FORM_SHELL_CLASS,
  FORM_INPUT_CLASS,
  FORM_BTN_CANCEL,
  FORM_BTN_PRIMARY,
  FormField as Field
} from './FormPrimitives.jsx';

export default function UpdateUserForm({
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

  // const roleDescriptions = {
  //   user: {
  //     title: 'Operator (Standard Access)',
  //     desc: 'Can manage assigned channel playlists, upload media clips, preview streams, and trigger live branding overlays (Ticker, Logo, Ashton, L-Band).',
  //     badge: 'Operator Level',
  //     color: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
  //   },
  //   admin: {
  //     title: 'Admin (Channel Manager)',
  //     desc: 'Can create and manage broadcast channels, configure media servers, assign operators, and schedule playout programs.',
  //     badge: 'Manager Level',
  //     color: 'border-blue-500/30 bg-blue-500/10 text-blue-300'
  //   },
  //   super_admin: {
  //     title: 'Super Admin (Full System Control)',
  //     desc: 'Unrestricted master access to all broadcast channels, media servers, user accounts, and system-level configurations.',
  //     badge: 'Master Level',
  //     color: 'border-purple-500/30 bg-purple-500/10 text-purple-300'
  //   }
  // };

  // const currentRoleInfo = roleDescriptions[selectedRole] || roleDescriptions.user;
  // const displayName = formData.name || formData.username || 'User';

  return (
    <div className="space-y-3.5 select-none">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Users</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-lg 2xl:text-xl text-white tracking-tight">
            Update User
          </h1>
          <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
            Modify account details, credentials, access role, and active status
          </p>
        </div>

        {formData.createdBy && (
          <div className="text-[11px] text-slate-400 bg-[#10141e] border border-[#1e2638] px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0">
            <Info size={12} className="text-slate-400" />
            <span>
              Managed by:{' '}
              <span className="text-slate-200 font-semibold">
                {formData.createdBy?.name || formData.createdBy?.email || 'System'}
              </span>
            </span>
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className={`${FORM_CARD_CLASS} space-y-4`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          {/* Full Name */}
          <Field label="Full Name" required hint="Display name in system">
            <div className={FORM_SHELL_CLASS}>
              <UserIcon size={14} className="text-slate-500 shrink-0" />
              <input
                type="text"
                required
                value={formData.name || formData.username || ''}
                onChange={set('name')}
                placeholder="Enter user name"
                className={FORM_INPUT_CLASS}
              />
            </div>
          </Field>

          {/* Email Address */}
          <Field label="Email Address" required hint="Used for system login">
            <div className={FORM_SHELL_CLASS}>
              <Mail size={14} className="text-slate-500 shrink-0" />
              <input
                type="email"
                required
                value={formData.email || ''}
                onChange={set('email')}
                placeholder="user@playout.com"
                className={FORM_INPUT_CLASS}
              />
            </div>
          </Field>

          {/* Password (Optional on update) */}
          <Field
            label="New Password"
            hint="Leave blank to keep existing password"
          >
            <div className={FORM_SHELL_CLASS}>
              <Lock size={14} className="text-slate-500 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                minLength={6}
                value={formData.password || ''}
                onChange={set('password')}
                placeholder="Leave blank to keep current password"
                className={FORM_INPUT_CLASS}
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
            hint={isAdmin ? 'Admins cannot elevate users' : 'Select permission tier'}
          >
            <div className={FORM_SHELL_CLASS}>
              <Shield size={14} className="text-slate-500 shrink-0" />
              <select
                value={selectedRole}
                onChange={set('role')}
                disabled={isAdmin}
                className="w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
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

        {/* Role Capabilities Summary Box */}
        {/* <div className={`p-4 rounded-xl border transition-all space-y-1.5`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs flex items-center gap-1.5">
              <Sparkles size={14} />
              <span>{currentRoleInfo.title}</span>
            </span>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-black/40 border border-current">
              {currentRoleInfo.badge}
            </span>
          </div>
          <p className="text-[11px] opacity-90 leading-relaxed">
            {currentRoleInfo.desc}
          </p>
        </div> */}

        {/* Account Status Switch (isActive) */}
        <div className="pt-3 border-t border-[#1a2234]">
          <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#090d16] border border-[#1c2538] cursor-pointer hover:border-slate-600 transition">
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
                  <span>{formData.isActive !== false ? 'Active (Login Allowed)' : 'Suspended (Access Blocked)'}</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {formData.isActive !== false
                  ? 'User is active and permitted to log in and control assigned channels.'
                  : 'Account is suspended. The user will be unable to log in.'}
              </span>
            </div>
            <input
              type="checkbox"
              checked={formData.isActive !== false}
              onChange={setCheckbox('isActive')}
              className="rounded w-4 h-4 text-cyan-500 bg-[#121929] border-[#222c42] focus:ring-0 cursor-pointer"
            />
          </label>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-[#1a2234] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className={FORM_BTN_CANCEL}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={FORM_BTN_PRIMARY}
          >
            <UserCheck size={14} />
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
}
