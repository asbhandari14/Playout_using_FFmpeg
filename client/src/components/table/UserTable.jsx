import React from 'react';
import { User as UserIcon, Pencil, Trash2, Shield, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import TableScrollContainer from './TableScrollContainer.jsx';

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
  'grid grid-cols-[minmax(180px,1.5fr)_115px_100px_minmax(145px,1.1fr)_76px] items-center gap-2.5';

export default function UserTable({ users = [], onEdit, onDelete }) {
  return (
    <div className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl overflow-hidden shadow-xl">
      {/* Horizontal Scaling & Scrolling Container */}
      <TableScrollContainer>
        <div className="w-full min-w-[690px]">
          {/* Grid Header */}
          <div
            className={`px-4 py-2.5 2xl:px-5 2xl:py-3 bg-[#131926] border-b border-[#1e2638] text-[10px] 2xl:text-[10.5px] uppercase font-bold text-slate-400 tracking-wider ${USER_GRID_COLS}`}
          >
            <div>User Details</div>
            <div>Access Level</div>
            <div>Status</div>
            <div>Manager & Created</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-[#171f31]">
            {users.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
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
                    className={`px-4 py-2.5 2xl:px-5 2xl:py-3 hover:bg-[#141b29] transition text-xs ${USER_GRID_COLS}`}
                  >
                    {/* User Details */}
                    <div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#151d2e] border border-[#232f48] flex items-center justify-center text-cyan-400 shrink-0 font-bold text-[11px]">
                          {u.name?.charAt(0)?.toUpperCase() || <UserIcon size={14} />}
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-white text-xs truncate">{u.name}</div>
                          <div className="text-[10.5px] text-slate-400 truncate">{u.email}</div>
                        </div>
                      </div>
                    </div>

                    {/* Access Level */}
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10.5px] font-semibold capitalize ${roleConfig.classes}`}
                      >
                        <Shield size={11} className="shrink-0" />
                        <span>{roleConfig.label}</span>
                      </span>
                    </div>

                    {/* Status */}
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                          <Calendar size={10} className="shrink-0" />
                          <span>Joined {createdDate}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onEdit?.(u)}
                          className="p-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 transition cursor-pointer"
                          title="Edit User"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete?.('user', u)}
                          className="p-1 rounded-md text-rose-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </TableScrollContainer>
    </div>
  );
}
