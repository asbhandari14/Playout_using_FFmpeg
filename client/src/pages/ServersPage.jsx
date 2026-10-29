import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchServers,
  createServer,
  updateServer,
  deleteServer,
  clearServerAlerts
} from '../store/slices/serverSlice.js';
import Navbar from '../components/Navbar.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx';
import { Server, Plus, Search, Edit2, Trash2, CheckCircle2, AlertCircle, Radio, Globe } from 'lucide-react';

export default function ServersPage() {
  const dispatch = useDispatch();
  const { list: servers, loading, error, successMessage } = useSelector((state) => state.servers);

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [serverToDelete, setServerToDelete] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [streamUrl, setStreamUrl] = useState('http://94.136.185.222:81');
  const [serverUsername, setServerUsername] = useState('');
  const [serverPassword, setServerPassword] = useState('');

  useEffect(() => {
    dispatch(fetchServers({ search }));
  }, [dispatch, search]);

  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => dispatch(clearServerAlerts()), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error, dispatch]);

  const handleOpenAdd = () => {
    setEditingServer(null);
    setName('');
    setCategory('General');
    setStreamUrl('http://94.136.185.222:81');
    setServerUsername('');
    setServerPassword('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (server) => {
    setEditingServer(server);
    setName(server.name);
    setCategory(server.category || 'General');
    setStreamUrl(server.streamUrl || server.hlsBaseUrl || 'http://94.136.185.222:81');
    setServerUsername(server.serverUsername || '');
    setServerPassword('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingServer) {
      const data = { name, category, streamUrl, serverUsername };
      if (serverPassword) data.serverPassword = serverPassword;
      await dispatch(updateServer({ id: editingServer._id, data }));
    } else {
      await dispatch(createServer({ name, category, streamUrl, serverUsername, serverPassword }));
    }
    setIsModalOpen(false);
  };


  const handleDelete = (s) => {
    setServerToDelete(s);
  };

  const handleConfirmDelete = async () => {
    if (serverToDelete?._id) {
      await dispatch(deleteServer(serverToDelete._id));
    }
    setServerToDelete(null);
  };

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
              <Server className="text-blue-500" size={22} />
              Streaming Servers
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Configure RTMP Ingest and HLS Output media servers (e.g. Flussonic).
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition shadow-lg shadow-blue-600/20"
          >
            <Plus size={16} />
            Add Server
          </button>
        </div>

        {/* Search */}
        <div className="bg-[#12161f] border border-[#222938] rounded-xl p-3.5">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by server name or URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Server Cards / Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && servers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500 text-xs">
              Loading server configurations...
            </div>
          ) : servers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500 text-xs">
              No servers configured. Click "Add Server" to configure Flussonic.
            </div>
          ) : (
            servers.map((s) => (
              <div
                key={s._id}
                className="bg-[#12161f] border border-[#222938] hover:border-[#2f394d] rounded-xl p-5 shadow-lg flex flex-col justify-between transition group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Server size={16} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-slate-100 group-hover:text-blue-400 transition m-0">
                          {s.name}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {s.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-[#1c2230] rounded-lg transition"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-[#1c2230] rounded-lg transition"
                        title="Delete Server"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-500 block mb-0.5 font-medium uppercase tracking-wider text-[9px]">
                        Stream URL
                      </span>
                      <code className="text-blue-400 bg-[#0a0d13] px-2 py-1 rounded block truncate font-mono text-[11px] border border-[#1f2635]">
                        {s.streamUrl || s.hlsBaseUrl}
                      </code>
                    </div>

                    <div>
                      <span className="text-slate-500 block mb-0.5 font-medium uppercase tracking-wider text-[9px]">
                        Auto-Derived RTMP Target
                      </span>
                      <code className="text-slate-300 bg-[#0a0d13] px-2 py-1 rounded block truncate font-mono text-[10px] border border-[#1f2635]">
                        {s.rtmpBaseUrl || 'rtmp://127.0.0.1/static'}
                      </code>
                    </div>

                    {s.serverUsername && (
                      <div className="text-[10px] text-slate-500 pt-1">
                        Auth User: <span className="text-slate-400">{s.serverUsername}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#1d2331] text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Created by {s.createdBy?.name || 'Admin'}</span>
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Add / Edit Modal - ONLY asks: Stream Name, Stream Category, Stream URL, Stream Username, Stream Password */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingServer ? 'Edit Media Server' : 'Add Flussonic Media Server'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Stream Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Flussonic Primary Cluster"
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Stream Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. General / Flussonic Media"
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Stream URL
            </label>
            <input
              type="text"
              required
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="http://94.136.185.222:81"
              className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-blue-400 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Example format: <code className="text-slate-400">http://94.136.185.222:81</code>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Stream Username (Optional)
              </label>
              <input
                type="text"
                value={serverUsername}
                onChange={(e) => setServerUsername(e.target.value)}
                placeholder="flussonic"
                className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Stream Password {editingServer && '(Encrypted)'}
              </label>
              <input
                type="password"
                value={serverPassword}
                onChange={(e) => setServerPassword(e.target.value)}
                placeholder={editingServer ? 'Leave blank to retain' : '••••••••'}
                className="w-full px-3 py-2 bg-[#0a0d13] border border-[#232a39] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
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
              {editingServer ? 'Save Changes' : 'Add Server'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!serverToDelete}
        onClose={() => setServerToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Media Server"
        itemName={serverToDelete?.name}
        message="Are you sure you want to delete this media server configuration? Channels configured with this server will be affected."
        confirmText="Delete Server"
      />
    </div>
  );
}

