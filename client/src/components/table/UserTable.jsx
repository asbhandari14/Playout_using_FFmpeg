import React from 'react';
import { User as UserIcon, Pencil, Trash2 } from 'lucide-react';
import { DEFAULT_PERMISSIONS } from '../../constants/dashboard.js';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  user: 'User'
};

const USER_GRID_COLS = 'grid grid-cols-[260px_150px_minmax(280px,1fr)_100px] items-center gap-4';

export default function UserTable({ users = [], onEdit, onDelete }) {
  return (
    <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl overflow-hidden shadow-2xl">
      {/* Horizontal Scaling & Scrolling Container */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#1e2738] scrollbar-track-transparent">
        <div className="min-w-[850px]">
          {/* Grid Header */}
          <div className={`px-5 py-3.5 bg-[#0e1320] border-b border-[#161f33] text-[10px] uppercase font-extrabold text-slate-400 tracking-wider ${USER_GRID_COLS}`}>
            <div>User Details</div>
            <div>Access Level</div>
            <div>Permissions / Modules</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Grid Body */}
          <div className="divide-y divide-[#131b2e]">
            {users.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No users found matching your search.
              </div>
            ) : (
              users.map((u) => (
                <div
                  key={u._id}
                  className={`px-5 py-3.5 hover:bg-[#101524] transition text-xs ${USER_GRID_COLS}`}
                >
                  {/* User Details */}
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#121929] border border-[#222f49] flex items-center justify-center text-cyan-400 shrink-0">
                        <UserIcon size={15} />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-white text-xs truncate">{u.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Access Level */}
                  <div>
                    <span className="inline-block px-3 py-1 rounded-xl border border-[#222d44] bg-[#0d121f] text-slate-200 text-[11px] font-semibold capitalize truncate max-w-full">
                      {ROLE_LABELS[u.role] || 'User'}
                    </span>
                  </div>

                  {/* Modules */}
                  <div>
                    <div className="flex flex-wrap gap-1.5 max-w-full">
                      {(u.permissions && u.permissions.length > 0
                        ? u.permissions
                        : DEFAULT_PERMISSIONS.slice(0, 8)
                      ).map((perm, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#3b1d38] bg-[#1a0f21] text-[#f472b6] text-[10px] font-medium"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#f472b6]" />
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        onClick={() => onEdit?.(u)}
                        className="p-1 rounded text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                        title="Edit User"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => onDelete?.('user', u)}
                        className="p-1 rounded text-rose-500 hover:text-rose-400 transition cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
