import React from 'react';
import { Search, UserCheck } from 'lucide-react';
import UserTable from '../../components/table/UserTable';

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

      <div className="text-xs font-semibold text-slate-400 pt-1">
        Showing {users.length} Users
      </div>

      {/* User Table Component */}
      <UserTable users={users} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}
