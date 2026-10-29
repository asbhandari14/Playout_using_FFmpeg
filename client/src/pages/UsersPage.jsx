import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  clearUserAlerts
} from '../store/slices/userSlice.js';
import Navbar from '../components/Navbar.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx';
import { Users, UserPlus, Search, Edit2, Trash2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function UsersPage() {
  const dispatch = useDispatch();
  const { list: users, total, loading, error, successMessage } = useSelector((state) => state.users);
  const { user: currentUser } = useSelector((state) => state.auth);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    dispatch(fetchUsers({ search, role: roleFilter }));
  }, [dispatch, search, roleFilter]);

  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => dispatch(clearUserAlerts()), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error, dispatch]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('user');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setRole(user.role);
    setIsActive(user.isActive);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingUser) {
      const data = { name, email, role, isActive };
      if (password) data.password = password;
      await dispatch(updateUser({ id: editingUser._id, data }));
    } else {
      await dispatch(createUser({ name, email, password, role, isActive }));
    }
    setIsModalOpen(false);
  };

  const handleDelete = (u) => {
    setUserToDelete(u);
  };

  const handleConfirmDelete = async () => {
    if (userToDelete?._id) {
      await dispatch(deleteUser(userToDelete._id));
    }
    setUserToDelete(null);
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className="min-h-screen bg-[#0c0e12] text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Alerts */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}
        {error && (
          <div className="p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 m-0">
              <Users className="text-blue-500" size={22} />
              User Management
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manage operators and administrators with role-based access control.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition shadow-lg shadow-blue-600/20"
          >
            <UserPlus size={16} />
            Create User
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[#12161f] border border-[#222938] rounded-xl p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs text-slate-400 whitespace-nowrap">Filter Role:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-[#0a0d13] border border-[#232a39] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Roles</option>
              {isSuperAdmin && <option value="admin">Admins</option>}
              <option value="user">Users (Operators)</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[#12161f] border border-[#222938] rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161b26] border-b border-[#222938] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Name / Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2433]">
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-slate-500">
                      No users found. Click "Create User" to add one.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u._id} className="hover:bg-[#151a24] transition">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">{u.name}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${
                            u.role === 'super_admin'
                              ? 'bg-purple-950/60 text-purple-300 border-purple-800'
                              : u.role === 'admin'
                              ? 'bg-blue-950/60 text-blue-300 border-blue-800'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {u.role?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {u.createdBy ? (
                          <span>{u.createdBy.name}</span>
                        ) : (
                          <span className="text-slate-600 italic">System Initializer</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            u.isActive
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.isActive ? 'bg-emerald-400' : 'bg-red-400'
                            }`}
                          ></span>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-[#1c2230] rounded-lg transition"
                            title="Edit User"
                          >
                            <Edit2 size={14} />
                          </button>
                          {currentUser?._id !== u._id && (
                            <button
                              onClick={() => handleDelete(u)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-[#1c2230] rounded-lg transition"
                              title="Delete User"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Edit User Credentials' : 'Create New User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Operator"
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@playout.com"
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Password {editingUser && '(Leave blank to keep existing)'}
            </label>
            <input
              type="password"
              {...(!editingUser && { required: true })}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Assign Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="user">User (Live Deck Operator)</option>
              {isSuperAdmin && <option value="admin">Admin (Channel & User Manager)</option>}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-[#0a0d13] border-[#232a39] text-blue-600 focus:ring-0"
            />
            <label htmlFor="isActive" className="text-xs text-slate-300 select-none">
              Account Active
            </label>
          </div>

          <div className="pt-3 border-t border-[#232a38] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-2 rounded-lg bg-[#1a202c] hover:bg-[#222b3b] text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-md shadow-blue-600/20"
            >
              {editingUser ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete User Account"
        itemName={userToDelete ? `${userToDelete.name} (${userToDelete.email})` : ''}
        message="Are you sure you want to delete this user account? They will permanently lose access to all managed channels and settings."
        confirmText="Delete User"
      />
    </div>
  );
}
