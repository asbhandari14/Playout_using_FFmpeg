import React from 'react';
import { Search, UserCheck, User as UserIcon, Pencil, Trash2 } from 'lucide-react';
import { DEFAULT_PERMISSIONS } from '../../constants/dashboard.js';

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin' };

export default function User({ users, searchQuery, onSearchChange, onCreate, onEdit, onDelete }) {
  return (
    <div className="space-y-4">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl text-white tracking-wide">Admin Panel</h1>
          <p className="text-xs text-slate-400">Manage System Access & Permissions</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Find by name or email..."
              className="w-56 sm:w-64 pl-9 pr-3.5 py-2 bg-[#0c101c] border border-[#1c2539] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
            />
          </div>

          <button
            onClick={onCreate}
            className="px-4 py-2 rounded-xl bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <UserCheck size={14} />
            <span>Create User</span>
          </button>
        </div>
      </div>

      <div className="text-xs font-semibold text-slate-400 pt-1">Showing {users.length} Users</div>

      {/* Table */}
      <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#161f33] text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                <th className="py-3.5 px-5">User Details</th>
                <th className="py-3.5 px-5">Access Level</th>
                <th className="py-3.5 px-5">Modules</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131b2e]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-500 text-xs">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="hover:bg-[#101524] transition">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#121929] border border-[#222f49] flex items-center justify-center text-cyan-400 shrink-0">
                          <UserIcon size={15} />
                        </div>
                        <div>
                          <div className="font-bold text-white text-xs">{u.name}</div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <span className="inline-block px-3 py-1 rounded-xl border border-[#222d44] bg-[#0d121f] text-slate-200 text-[11px] font-semibold capitalize">
                        {ROLE_LABELS[u.role] || 'User'}
                      </span>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex flex-wrap gap-1.5 max-w-xl">
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
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => onEdit(u)}
                          className="p-1 rounded text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                          title="Edit User"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => onDelete('user', u)}
                          className="p-1 rounded text-rose-500 hover:text-rose-400 transition cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}