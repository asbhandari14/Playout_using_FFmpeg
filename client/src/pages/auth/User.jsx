import React from 'react';
import { Search, UserCheck } from 'lucide-react';
import UserTable from '../../components/table/UserTable';

export default function User({ users, searchQuery, onSearchChange, onCreate, onEdit, onDelete }) {
  return (
    <div className="space-y-3.5 2xl:space-y-4">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-base sm:text-lg 2xl:text-xl text-white tracking-tight">
            Users
          </h1>
          <p className="text-[11px] 2xl:text-xs text-slate-400">
            Manage system access & permissions ({users.length} users)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Find by name or email..."
              className="w-44 sm:w-56 2xl:w-64 pl-8 pr-3 py-1.5 2xl:py-2 bg-[#0f131c] border border-[#1f2738] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
            />
          </div>

          <button
            onClick={onCreate}
            className="px-3 py-1.5 2xl:px-3.5 2xl:py-2 rounded-lg bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition cursor-pointer shrink-0"
          >
            <UserCheck size={14} />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* User Table Component */}
      <UserTable users={users} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}
