import React from 'react';
import { User as UserIcon, Pencil, Trash2, Shield, Calendar, CheckCircle2, XCircle } from 'lucide-react';

const ROLE_CONFIG = {
  super_admin: {
    label: 'Super Admin',
    badge: 'Master',
    classes: 'border-purple-500/40 bg-purple-500/15 text-purple-300'
  },
  admin: {
    label: 'Admin',
    badge: 'Manager',
    classes: 'border-blue-500/40 bg-blue-500/15 text-blue-300'
  },
  user: {
    label: 'Operator',
    badge: 'Operator',
    classes: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
  }
};

const USER_GRID_COLS =
  'grid grid-cols-[minmax(240px,1.6fr)_140px_130px_minmax(180px,1.2fr)_100px] items-center gap-4';

export default function UserTable({ users = [], onEdit, onDelete }) {
  return (
    <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl overflow-hidden shadow-2xl">
      {/* Horizontal Scaling & Scrolling Container */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#1e2738] scrollbar-track-transparent">
        <div className="min-w-[880px]">
          {/* Grid Header */}
          <div
            className={`px-5 py-3.5 bg-[#0e1320] border-b border-[#161f33] text-[10px] uppercase font-extrabold text-slate-400 tracking-wider ${USER_GRID_COLS}`}
          >
            <div>User Details</div>
            <div>Access Level</div>
            <div>Status</div>
            <div>Manager & Created</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-[#131b2e]">
            {users.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No users found matching your search.
              </div>
            ) : (
              users.map((u) => {
                const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.user;
                const isActive = u.isActive !== false;
                const createdDate = u.createdAt
                  ? new Date(u.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                  : '';

                return (
                  <div
                    key={u._id}
                    className={`px-5 py-3.5 hover:bg-[#101524] transition text-xs ${USER_GRID_COLS}`}
                  >
                    {/* User Details */}
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#121929] border border-[#222f49] flex items-center justify-center text-cyan-400 shrink-0 font-bold text-xs">
                          {u.name?.charAt(0)?.toUpperCase() || <UserIcon size={15} />}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-white text-xs truncate">{u.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                        </div>
                      </div>
                    </div>

                    {/* Access Level */}
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold capitalize tracking-wide ${roleConfig.classes}`}
                      >
                        <Shield size={12} className="shrink-0" />
                        <span>{roleConfig.label}</span>
                      </span>
                    </div>

                    {/* Status */}
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                          }`}
                        />
                        <span>{isActive ? 'Active' : 'Suspended'}</span>
                      </span>
                    </div>

                    {/* Manager & Created */}
                    <div className="text-[11px] text-slate-400 truncate space-y-0.5">
                      <div className="truncate font-medium text-slate-300">
                        {u.createdBy?.name ? (
                          <span>Managed by {u.createdBy.name}</span>
                        ) : (
                          <span className="text-slate-500 italic">System / Super Admin</span>
                        )}
                      </div>
                      {createdDate && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Calendar size={11} className="shrink-0" />
                          <span>Joined {createdDate}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => onEdit?.(u)}
                          className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 transition cursor-pointer"
                          title="Edit User"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => onDelete?.('user', u)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
