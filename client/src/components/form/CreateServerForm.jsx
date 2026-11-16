import React from 'react';
import {
  ArrowLeft,
  Server as ServerIcon,
  Globe,
  Tag,
  User as UserIcon,
  Lock
} from 'lucide-react';
import {
  FORM_CARD_CLASS,
  FORM_SHELL_CLASS,
  FORM_INPUT_CLASS,
  FORM_BTN_CANCEL,
  FORM_BTN_PRIMARY,
  FormField as Field
} from './FormPrimitives.jsx';

export default function CreateServerForm({
  formData,
  setFormData,
  onSubmit,
  onCancel
}) {
  const set = (field) => (e) =>
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value
    }));

  return (
    <div className="space-y-3.5 select-none">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Servers</span>
      </button>

      <div>
        <h1 className="text-base sm:text-lg 2xl:text-xl text-white tracking-tight">
          Add Media Server
        </h1>
        <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
          Configure a new RTMP ingest and HLS playback server cluster
        </p>
      </div>

      <div className={FORM_CARD_CLASS}>
        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Server Name */}
            <Field label="Stream Name" required>
              <div className={FORM_SHELL_CLASS}>
                <ServerIcon size={14} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={set('name')}
                  placeholder="e.g. Flussonic Primary Cluster"
                  className={FORM_INPUT_CLASS}
                />
              </div>
            </Field>

            {/* Category */}
            <Field label="Category" hint="Optional grouping">
              <div className={FORM_SHELL_CLASS}>
                <Tag size={14} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={formData.category || 'General'}
                  onChange={set('category')}
                  placeholder="e.g. General, Cloud Transcoder, Backup"
                  className={FORM_INPUT_CLASS}
                />
              </div>
            </Field>
          </div>

          {/* Stream URL */}
          <Field label="Stream URL" required hint="Format: http://ip_or_domain:port">
            <div className={FORM_SHELL_CLASS}>
              <Globe size={14} className="text-slate-500 shrink-0" />
              <input
                type="text"
                required
                value={formData.streamUrl || ''}
                onChange={set('streamUrl')}
                placeholder="http://123.456.788.90:81"
                className={`${FORM_INPUT_CLASS} font-mono text-[#00bcd4]`}
              />
            </div>
          </Field>

          {/* Username & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Stream Username" hint="Optional API/Relay auth">
              <div className={FORM_SHELL_CLASS}>
                <UserIcon size={14} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={formData.serverUsername || ''}
                  onChange={set('serverUsername')}
                  placeholder="admin"
                  className={FORM_INPUT_CLASS}
                />
              </div>
            </Field>

            <Field label="Stream Password" hint="Optional auth">
              <div className={FORM_SHELL_CLASS}>
                <Lock size={14} className="text-slate-500 shrink-0" />
                <input
                  type="password"
                  value={formData.serverPassword || ''}
                  onChange={set('serverPassword')}
                  placeholder="••••••••••••"
                  className={FORM_INPUT_CLASS}
                />
              </div>
            </Field>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1a2234]">
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
              <ServerIcon size={14} />
              <span>Create Server</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

