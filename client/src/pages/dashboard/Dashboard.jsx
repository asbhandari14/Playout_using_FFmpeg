import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  UploadCloud,
  Radio,
  Cloud,
  TrendingUp,
  IndianRupee,
  User as UserIcon,
  ListFilter,
  HardDrive,
  Cookie,
  ChevronRight,
  ChevronDown,
  Search,
  Sun,
  LogOut,
  Pencil,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  Mail,
  Lock,
  Shield,
  Gauge,
  Clock,
  Globe,
  Server as ServerIcon,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Hash,
  Activity,
  Layers,
  Calendar,
  Sparkles,
  Sliders,
  PanelLeftClose,
  PanelLeft,
  Film
} from 'lucide-react';

import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  clearUserAlerts
} from '../../store/slices/userSlice.js';
import {
  fetchChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  clearChannelAlerts
} from '../../store/slices/channelSlice.js';
import { fetchServers } from '../../store/slices/serverSlice.js';
import { logoutUser } from '../../store/slices/authSlice.js';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal.jsx';
import { io } from 'socket.io-client';

// Available permission modules matching the UI
const DEFAULT_PERMISSIONS = [
  'HLS',
  'RESTREAM',
  'Playlist Management',
  'Cg',
  'Youtube Playlist',
  'VOD Scheduling',
  'Show SRT Output',
  'Custom Import',
  'Public Iframe Page'
];

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state
  const { user: currentUser } = useSelector((state) => state.auth);
  const { list: users, loading: usersLoading, error: userError, successMessage: userSuccess } = useSelector((state) => state.users);
  const { list: channels, loading: channelsLoading, error: channelError, successMessage: channelSuccess } = useSelector((state) => state.channels);
  const { list: servers } = useSelector((state) => state.servers);

  // Navigation State
  // activeSection: 'users' | 'channels' | 'upload' | 'analytics' | 'plans' | 'logs' | 'storage' | 'cookies'
  const [activeSection, setActiveSection] = useState('users');
  // subView: 'list' | 'create' | 'edit'
  const [subView, setSubView] = useState('list');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isManageChannelsExpanded, setIsManageChannelsExpanded] = useState(true);
  const [isLiveAnalyticsExpanded, setIsLiveAnalyticsExpanded] = useState(false);
  const [activeChannelSubTab, setActiveChannelSubTab] = useState('Channel Dashboard');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Search filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    type: null, // 'user' | 'channel'
    item: null
  });

  // User Form State
  const [editingUserId, setEditingUserId] = useState(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user', // 'user' | 'admin' | 'super_admin'
    bandwidthAmount: '',
    bandwidthUnit: 'GB',
    storageAmount: '',
    storageUnit: 'GB',
    gracePeriodDays: 3,
    permissions: [
      'HLS',
      'RESTREAM',
      'Playlist Management',
      'Cg',
      'Youtube Playlist',
      'VOD Scheduling',
      'Show SRT Output',
      'Custom Import'
    ]
  });

  // Channel Form State
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [channelFormData, setChannelFormData] = useState({
    name: '',
    server: '',
    serverDomain: '',
    serverUsername: '',
    serverPassword: '',
    assignedUser: '',
    streamKey: '',
    resolution: '1280x720',
    fps: 25,
    videoBitrate: '2500k',
    audioBitrate: '128k'
  });

  // Copy URL state
  const [copiedUrl, setCopiedUrl] = useState('');

  // Fetch initial data + automatic recovery on network reconnect
  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchChannels());
    dispatch(fetchServers());

    const handleOnline = () => {
      console.log('[Dashboard] Internet connectivity restored. Re-fetching channels and servers...');
      dispatch(fetchChannels());
      dispatch(fetchUsers());
      dispatch(fetchServers());
    };
    window.addEventListener('online', handleOnline);

    const socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000
    });

    socket.on('connect', () => {
      dispatch(fetchChannels());
    });

    socket.on('stream_status', () => {
      dispatch(fetchChannels());
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      socket.disconnect();
    };
  }, [dispatch]);

  // Clear alerts after 4s
  useEffect(() => {
    if (userSuccess || userError) {
      const timer = setTimeout(() => dispatch(clearUserAlerts()), 4000);
      return () => clearTimeout(timer);
    }
  }, [userSuccess, userError, dispatch]);

  useEffect(() => {
    if (channelSuccess || channelError) {
      const timer = setTimeout(() => dispatch(clearChannelAlerts()), 4000);
      return () => clearTimeout(timer);
    }
  }, [channelSuccess, channelError, dispatch]);

  // Handle Copy to clipboard
  const handleCopyUrl = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2000);
  };

  // --- USER HANDLERS ---
  const handleOpenCreateUser = () => {
    setEditingUserId(null);
    setUserFormData({
      username: '',
      email: '',
      password: '',
      role: 'user',
      bandwidthAmount: '',
      bandwidthUnit: 'GB',
      storageAmount: '',
      storageUnit: 'GB',
      gracePeriodDays: 3,
      permissions: [
        'HLS',
        'RESTREAM',
        'Playlist Management',
        'Cg',
        'Youtube Playlist',
        'VOD Scheduling',
        'Show SRT Output',
        'Custom Import'
      ]
    });
    setActiveSection('users');
    setSubView('create');
  };

  const handleOpenEditUser = (u) => {
    setEditingUserId(u._id);
    setUserFormData({
      username: u.name || '',
      email: u.email || '',
      password: '', // leave empty to keep unchanged
      role: u.role || 'user',
      bandwidthAmount: u.bandwidthAmount || '',
      bandwidthUnit: u.bandwidthUnit || 'GB',
      storageAmount: u.storageAmount || '',
      storageUnit: u.storageUnit || 'GB',
      gracePeriodDays: u.gracePeriodDays ?? 3,
      permissions: u.permissions || [
        'HLS',
        'RESTREAM',
        'Playlist Management',
        'Cg',
        'Youtube Playlist',
        'VOD Scheduling',
        'Show SRT Output',
        'Custom Import'
      ]
    });
    setActiveSection('users');
    setSubView('edit');
  };

  const handleTogglePermission = (perm) => {
    setUserFormData((prev) => {
      const exists = prev.permissions.includes(perm);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm]
      };
    });
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    if (!userFormData.username || !userFormData.email) {
      alert('Please provide username and email');
      return;
    }

    if (editingUserId) {
      const payload = {
        name: userFormData.username,
        email: userFormData.email,
        role: userFormData.role,
        bandwidthAmount: userFormData.bandwidthAmount,
        bandwidthUnit: userFormData.bandwidthUnit,
        storageAmount: userFormData.storageAmount,
        storageUnit: userFormData.storageUnit,
        gracePeriodDays: userFormData.gracePeriodDays,
        permissions: userFormData.permissions
      };
      if (userFormData.password) {
        payload.password = userFormData.password;
      }
      await dispatch(updateUser({ id: editingUserId, data: payload }));
    } else {
      if (!userFormData.password) {
        alert('Password is required for new users');
        return;
      }
      await dispatch(
        createUser({
          name: userFormData.username,
          email: userFormData.email,
          password: userFormData.password,
          role: userFormData.role,
          bandwidthAmount: userFormData.bandwidthAmount,
          bandwidthUnit: userFormData.bandwidthUnit,
          storageAmount: userFormData.storageAmount,
          storageUnit: userFormData.storageUnit,
          gracePeriodDays: userFormData.gracePeriodDays,
          permissions: userFormData.permissions
        })
      );
    }
    setSubView('list');
  };

  // --- CHANNEL HANDLERS ---
  const handleOpenCreateChannel = () => {
    setEditingChannelId(null);
    const firstServer = servers[0];
    const firstUser = users[0];
    setChannelFormData({
      name: '',
      server: firstServer?._id || '',
      serverDomain: firstServer?.streamUrl || 'http://94.136.185.222:81',
      serverUsername: firstServer?.serverUsername || 'admin',
      serverPassword: '',
      assignedUser: firstUser?._id || currentUser?._id || '',
      streamKey: '',
      resolution: '1280x720',
      fps: 25,
      videoBitrate: '2500k',
      audioBitrate: '128k'
    });
    setActiveSection('channels');
    setActiveChannelSubTab('Channel Dashboard');
    setSubView('create');
  };

  const handleOpenEditChannel = (ch) => {
    setEditingChannelId(ch._id);
    const assignedId = ch.assignedUser?._id || ch.assignedUser || '';
    const serverObj = servers.find((s) => s._id === (ch.server?._id || ch.server)) || ch.server;

    setChannelFormData({
      name: ch.name || '',
      server: serverObj?._id || ch.server?._id || ch.server || '',
      serverDomain: serverObj?.streamUrl || ch.server?.streamUrl || 'http://94.136.185.222:81',
      serverUsername: serverObj?.serverUsername || '',
      serverPassword: '',
      assignedUser: assignedId,
      streamKey: ch.streamKey || '',
      resolution: ch.outputSettings?.resolution || '1280x720',
      fps: ch.outputSettings?.fps || 25,
      videoBitrate: ch.outputSettings?.videoBitrate || '2500k',
      audioBitrate: ch.outputSettings?.audioBitrate || '128k'
    });
    setActiveSection('channels');
    setActiveChannelSubTab('Channel Dashboard');
    setSubView('edit');
  };

  const handleSubmitChannel = async (e) => {
    e.preventDefault();
    if (!channelFormData.name) {
      alert('Channel name is required');
      return;
    }

    const payload = {
      name: channelFormData.name,
      server: channelFormData.server || servers[0]?._id,
      assignedUser: channelFormData.assignedUser || users[0]?._id || currentUser?._id,
      streamKey: channelFormData.streamKey || channelFormData.name.toLowerCase().replace(/\s+/g, '_'),
      outputSettings: {
        resolution: channelFormData.resolution,
        fps: Number(channelFormData.fps) || 25,
        videoBitrate: channelFormData.videoBitrate,
        audioBitrate: channelFormData.audioBitrate
      }
    };

    if (editingChannelId) {
      await dispatch(updateChannel({ id: editingChannelId, data: payload }));
    } else {
      await dispatch(createChannel(payload));
    }
    setSubView('list');
  };

  // --- DELETE CONFIRMATION ---
  const handlePromptDelete = (type, item) => {
    setDeleteModalState({
      isOpen: true,
      type,
      item
    });
  };

  const handleConfirmDelete = async () => {
    const { type, item } = deleteModalState;
    if (!item) return;

    if (type === 'user') {
      await dispatch(deleteUser(item._id));
    } else if (type === 'channel') {
      await dispatch(deleteChannel(item._id));
    }

    setDeleteModalState({ isOpen: false, type: null, item: null });
  };

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.name && u.name.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q));
  });

  const filteredChannels = channels.filter((ch) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return ch.name && ch.name.toLowerCase().includes(q);
  });

  // User initials for avatar
  const getInitials = (name) => {
    if (!name) return 'SA';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* ==================== TOP HEADER ==================== */}
      <header className="h-16 bg-[#080c14] border-b border-[#141b2b] px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0 shadow-md">
        {/* Left: Brand Logo & Collapse Icon */}
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setActiveSection('users'); setSubView('list'); }}>
            <span className="text-lg text-white">
              Playout <span className="text-slate-300">Lite</span>
            </span>
          </div>
        </div>

        {/* Right: Theme Toggle & User Account Dropdown */}
        <div className="flex items-center space-x-3">
          {/* User profile pill */}
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#0c121f] border border-[#1b253b] hover:border-slate-600 transition"
            >
              <div className="w-7 h-7 rounded-full bg-[#00bcd4] text-black font-extrabold text-xs flex items-center justify-center shadow-sm">
                {getInitials(currentUser?.name)}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-white leading-tight">
                  {currentUser?.name || 'Super Admin Account'}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  {currentUser?.email || 'example@mail.com'}
                </span>
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {/* Profile Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 top-12 w-52 bg-[#0e1422] border border-[#1f2b42] rounded-2xl shadow-2xl py-1.5 z-50 text-xs">
                <div className="px-3.5 py-2 border-b border-[#1b253b]">
                  <p className="font-bold text-white">{currentUser?.name || 'Super Admin'}</p>
                  <p className="text-[10px] text-slate-400">{currentUser?.email || 'admin@playout.com'}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {currentUser?.role || 'Super Admin'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    if (channels[0]?._id) {
                      navigate(`/channels/${channels[0]._id}`);
                    }
                  }}
                  className="w-full px-3.5 py-2 text-left text-slate-300 hover:text-white hover:bg-[#162136] flex items-center gap-2"
                >
                  <Radio size={14} className="text-cyan-400" />
                  <span>Open Control Room</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    dispatch(logoutUser());
                    navigate('/login');
                  }}
                  className="w-full px-3.5 py-2 text-left text-rose-400 hover:bg-rose-950/30 flex items-center gap-2 border-t border-[#1b253b]"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ==================== BODY WITH SIDEBAR & CONTENT ==================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ==================== LEFT SIDEBAR ==================== */}
        <aside
          className={`${isSidebarOpen ? 'w-60 xl:w-60' : 'w-0 -translate-x-full'
            } bg-[#090d16] border-r border-[#141b2b] flex flex-col shrink-0 transition-all duration-300 overflow-y-auto select-none`}
        >
          {/* Greeting */}
          <div className="px-5 pt-5 pb-2">
            <span className="text-sm text-slate-400 tracking-wide">
              Hi, {currentUser?.name || 'Super Admin Account'}
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 text-xs">
            {/* 1. Dashboard */}
            <button
              onClick={() => {
                setActiveSection('channels');
                setActiveChannelSubTab('Channel Dashboard');
                setSubView('list');
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base transition cursor-pointer ${activeSection === 'dashboard'
                ? 'bg-[#101726] text-white relative before:content-[\'\'] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-6 before:bg-[#00bcd4] before:rounded-r-full'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#111726]/60'
                }`}
            >
              <LayoutDashboard size={20} />
              <span>Channel</span>
            </button>

            {/* 2. User (Admin Panel) */}
            <button
              onClick={() => {
                setActiveSection('users');
                setSubView('list');
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base transition cursor-pointer ${activeSection === 'users'
                ? 'bg-[#101726] text-white relative before:content-[\'\'] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-6 before:bg-[#00bcd4] before:rounded-r-full'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#111726]/60'
                }`}
            >
              <UserIcon size={20} className={activeSection === 'users' ? 'text-[#00bcd4]' : ''} />
              <span>User</span>
            </button>
          </nav>
        </aside>

        {/* ==================== MAIN CONTENT AREA ==================== */}
        <main className="flex-1 overflow-y-auto bg-[#07090e] p-4 sm:p-6 lg:p-8">
          {/* Notification Alerts */}
          {(userSuccess || channelSuccess) && (
            <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{userSuccess || channelSuccess}</span>
            </div>
          )}

          {(userError || channelError) && (
            <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{userError || channelError}</span>
            </div>
          )}

          {/* ==================== 1. USER SECTION ==================== */}
          {activeSection === 'users' && (
            <>
              {/* --- VIEW 1: USER LIST (IMAGE 1) --- */}
              {subView === 'list' && (
                <div className="space-y-4">
                  {/* Title & Action Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl text-white tracking-wide">
                        Admin Panel
                      </h1>
                      <p className="text-xs text-slate-400">
                        Manage System Access & Permissions
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Search Input */}
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Find by name or email..."
                          className="w-56 sm:w-64 pl-9 pr-3.5 py-2 bg-[#0c101c] border border-[#1c2539] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
                        />
                      </div>

                      {/* + Create User Button */}
                      <button
                        onClick={handleOpenCreateUser}
                        className="px-4 py-2 rounded-xl bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                      >
                        <UserCheck size={14} />
                        <span>Create User</span>
                      </button>
                    </div>
                  </div>

                  {/* Showing X Users Counter */}
                  <div className="text-xs font-semibold text-slate-400 pt-1">
                    Showing {filteredUsers.length} Users
                  </div>

                  {/* Users Table Card */}
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
                          {filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="py-12 text-center text-slate-500 text-xs">
                                No users found matching your search.
                              </td>
                            </tr>
                          ) : (
                            filteredUsers.map((u) => (
                              <tr key={u._id} className="hover:bg-[#101524] transition">
                                {/* USER DETAILS */}
                                <td className="py-3.5 px-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[#121929] border border-[#222f49] flex items-center justify-center text-cyan-400 shrink-0">
                                      <UserIcon size={15} />
                                    </div>
                                    <div>
                                      <div className="font-bold text-white text-xs">
                                        {u.name}
                                      </div>
                                      <div className="text-[11px] text-slate-400">
                                        {u.email}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* ACCESS LEVEL */}
                                <td className="py-3.5 px-5">
                                  <span className="inline-block px-3 py-1 rounded-xl border border-[#222d44] bg-[#0d121f] text-slate-200 text-[11px] font-semibold capitalize">
                                    {u.role === 'super_admin'
                                      ? 'Super Admin'
                                      : u.role === 'admin'
                                        ? 'Admin'
                                        : 'User'}
                                  </span>
                                </td>

                                {/* MODULES */}
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

                                {/* ACTIONS */}
                                <td className="py-3.5 px-5 text-right">
                                  <div className="flex items-center justify-end gap-2.5">
                                    <button
                                      onClick={() => handleOpenEditUser(u)}
                                      className="p-1 rounded text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                                      title="Edit User"
                                    >
                                      <Pencil size={15} />
                                    </button>
                                    <button
                                      onClick={() => handlePromptDelete('user', u)}
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
              )}

              {/* --- VIEW 2 & 3: CREATE / UPDATE USER FORM (IMAGE 2) --- */}
              {(subView === 'create' || subView === 'edit') && (
                <div className="space-y-4 max-w-5xl">
                  {/* Back Link */}
                  <button
                    onClick={() => setSubView('list')}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Users</span>
                  </button>

                  {/* Header */}
                  <div>
                    <h1 className="text-xl font-extrabold text-white tracking-wide">
                      {subView === 'create' ? 'Create User' : 'Update User'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {subView === 'create'
                        ? 'Add a new system user with specific access permissions'
                        : 'Update system user details and specific access permissions'}
                    </p>
                  </div>

                  {/* Form Card */}
                  <form
                    onSubmit={handleSubmitUser}
                    className="bg-[#0b0e18] border border-[#161f33] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl"
                  >
                    {/* Grid of Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                      {/* Username */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Username
                        </label>
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <UserIcon size={15} className="text-slate-500 shrink-0" />
                          <input
                            type="text"
                            required
                            value={userFormData.username}
                            onChange={(e) =>
                              setUserFormData({ ...userFormData, username: e.target.value })
                            }
                            placeholder="Enter username"
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Email
                        </label>
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <Mail size={15} className="text-slate-500 shrink-0" />
                          <input
                            type="email"
                            required
                            value={userFormData.email}
                            onChange={(e) =>
                              setUserFormData({ ...userFormData, email: e.target.value })
                            }
                            placeholder="user@example.com"
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Password
                        </label>
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <Lock size={15} className="text-slate-500 shrink-0" />
                          <input
                            type="password"
                            required={subView === 'create'}
                            value={userFormData.password}
                            onChange={(e) =>
                              setUserFormData({ ...userFormData, password: e.target.value })
                            }
                            placeholder={
                              subView === 'create'
                                ? 'Enter password'
                                : 'Leave blank to keep current password'
                            }
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                          />
                        </div>
                      </div>

                      {/* Access Level */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Access Level
                        </label>
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <Shield size={15} className="text-slate-500 shrink-0" />
                          <select
                            value={userFormData.role}
                            onChange={(e) =>
                              setUserFormData({ ...userFormData, role: e.target.value })
                            }
                            className="w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer"
                          >
                            <option value="user" className="bg-[#0b0e18] text-slate-200">
                              User (Standard Access)
                            </option>
                            <option value="admin" className="bg-[#0b0e18] text-slate-200">
                              Admin (Channel Manager)
                            </option>
                            <option value="super_admin" className="bg-[#0b0e18] text-slate-200">
                              Super Admin (Full System Control)
                            </option>
                          </select>
                        </div>
                      </div>

                      {/* Allocated Bandwidth */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-slate-300 font-semibold">
                            Allocated Bandwidth
                          </label>
                          <span className="text-[10px] text-slate-500">
                            0 or blank = Unlimited
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <Gauge size={15} className="text-slate-500 shrink-0" />
                          <input
                            type="number"
                            min="0"
                            value={userFormData.bandwidthAmount}
                            onChange={(e) =>
                              setUserFormData({ ...userFormData, bandwidthAmount: e.target.value })
                            }
                            placeholder="Enter bandwidth amount"
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                          />
                          <select
                            value={userFormData.bandwidthUnit}
                            onChange={(e) =>
                              setUserFormData({ ...userFormData, bandwidthUnit: e.target.value })
                            }
                            className="bg-transparent text-slate-300 font-semibold focus:outline-none border-l border-slate-700 pl-2 text-xs"
                          >
                            <option value="GB" className="bg-[#0b0e18]">GB</option>
                            <option value="TB" className="bg-[#0b0e18]">TB</option>
                          </select>
                        </div>
                      </div>

                      {/* Allocated Storage */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-slate-300 font-semibold">
                            Allocated Storage
                          </label>
                          <span className="text-[10px] text-slate-500">
                            0 or blank = Unlimited
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <HardDrive size={15} className="text-slate-500 shrink-0" />
                          <input
                            type="number"
                            min="0"
                            value={userFormData.storageAmount}
                            onChange={(e) =>
                              setUserFormData({ ...userFormData, storageAmount: e.target.value })
                            }
                            placeholder="Enter storage amount"
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                          />
                          <select
                            value={userFormData.storageUnit}
                            onChange={(e) =>
                              setUserFormData({ ...userFormData, storageUnit: e.target.value })
                            }
                            className="bg-transparent text-slate-300 font-semibold focus:outline-none border-l border-slate-700 pl-2 text-xs"
                          >
                            <option value="GB" className="bg-[#0b0e18]">GB</option>
                            <option value="TB" className="bg-[#0b0e18]">TB</option>
                          </select>
                        </div>
                      </div>

                      {/* Bandwidth Grace Period (Days) */}
                      <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-slate-300 font-semibold">
                            Bandwidth Grace Period (Days)
                          </label>
                          <span className="text-[10px] text-slate-500">
                            Default: 3 Days (0 = No Grace)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition max-w-xs">
                          <Clock size={15} className="text-slate-500 shrink-0" />
                          <input
                            type="number"
                            min="0"
                            value={userFormData.gracePeriodDays}
                            onChange={(e) =>
                              setUserFormData({ ...userFormData, gracePeriodDays: Number(e.target.value) })
                            }
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Permissions Toggle Matrix */}
                    <div className="pt-2">
                      <label className="block text-slate-300 font-semibold mb-3 text-xs">
                        Permissions
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {DEFAULT_PERMISSIONS.map((perm) => {
                          const isActive = userFormData.permissions.includes(perm);
                          return (
                            <button
                              type="button"
                              key={perm}
                              onClick={() => handleTogglePermission(perm)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${isActive
                                ? 'border-[#00bcd4]/80 bg-[#00bcd4]/10 text-[#00bcd4] shadow-sm shadow-cyan-500/20'
                                : 'border-[#1f293d] bg-[#0c101b] text-slate-400 hover:border-slate-600'
                                }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#00bcd4]' : 'bg-slate-600'
                                  }`}
                              />
                              {perm}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-[#161f33] flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setSubView('list')}
                        className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#161f33] transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 rounded-xl text-xs font-extrabold bg-[#00bcd4] hover:bg-[#06b6d4] text-black shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-2"
                      >
                        <UserCheck size={14} />
                        <span>{subView === 'create' ? 'Create User' : 'Update User'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}

          {/* ==================== 2. CHANNELS SECTION ==================== */}
          {activeSection === 'channels' && (
            <>
              {/* --- VIEW 1: CHANNELS LIST / DASHBOARD (IMAGE 3) --- */}
              {subView === 'list' && (
                <div className="space-y-5">
                  {/* Title & Action Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl text-white tracking-wide">
                        Channels
                      </h1>
                      <p className="text-xs text-slate-400">
                        Manage live channels
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Search */}
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search channels..."
                          className="w-48 sm:w-56 pl-9 pr-3.5 py-2 bg-[#0c101c] border border-[#1c2539] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
                        />
                      </div>

                      {/* + Add Channel Button */}
                      <button
                        onClick={handleOpenCreateChannel}
                        className="px-4 py-2 rounded-md bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-medium text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                      >
                        <PlusCircle size={14} />
                        <span>Add Channel</span>
                      </button>
                    </div>
                  </div>

                  {/* Channels Table Card */}
                  <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#161f33] text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                            <th className="py-3.5 px-5">Channel</th>
                            <th className="py-3.5 px-5">URL</th>
                            <th className="py-3.5 px-5">Created By</th>
                            <th className="py-3.5 px-5">Assigned To</th>
                            <th className="py-3.5 px-5 text-center">Restreams</th>
                            <th className="py-3.5 px-5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#131b2e]">
                          {filteredChannels.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="py-12 text-center text-slate-500 text-xs">
                                No channels available. Click "+ Add Channel" to provision a stream.
                              </td>
                            </tr>
                          ) : (
                            filteredChannels.map((ch) => {
                              const rtmpDisplay = ch.rtmpUrl || `rtmp://94.136.185.222:1935/static/${ch.streamKey || ch.name}`;
                              const isCopied = copiedUrl === rtmpDisplay;
                              return (
                                <tr key={ch._id} className="hover:bg-[#101524] transition">
                                  {/* CHANNEL */}
                                  <td className="py-3.5 px-5">
                                    <div
                                      onClick={() => navigate(`/channels/${ch._id}`)}
                                      className="flex items-center gap-2.5 cursor-pointer group"
                                      title="Open Channel Studio"
                                    >
                                      <div className="w-7 h-7 rounded-lg bg-[#121929] border border-[#222f49] flex items-center justify-center text-[#00bcd4] shrink-0 group-hover:scale-105 transition">
                                        <Radio size={14} />
                                      </div>
                                      <span className="font-bold text-white group-hover:text-cyan-400 transition">
                                        {ch.name}
                                      </span>
                                    </div>
                                  </td>

                                  {/* URL */}
                                  <td className="py-3.5 px-5">
                                    <div className="flex items-center gap-2 max-w-xs sm:max-w-md">
                                      <button
                                        onClick={() => handleCopyUrl(rtmpDisplay)}
                                        className="p-1 rounded bg-[#121827] hover:bg-[#1c273e] text-cyan-400 hover:text-white transition shrink-0"
                                        title="Copy RTMP Stream URL"
                                      >
                                        {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                      </button>
                                      <span className="font-mono text-[11px] text-slate-300 truncate select-all">
                                        {rtmpDisplay}
                                      </span>
                                    </div>
                                  </td>

                                  {/* CREATED BY */}
                                  <td className="py-3.5 px-5 text-slate-300 font-medium">
                                    {ch.createdBy?.name || 'Super Admin Account'}
                                  </td>

                                  {/* ASSIGNED TO */}
                                  <td className="py-3.5 px-5 text-slate-300 font-medium">
                                    {ch.assignedUser?.name || 'Unassigned'}
                                  </td>

                                  {/* RESTREAMS */}
                                  <td className="py-3.5 px-5 text-center">
                                    <span className="inline-block px-2.5 py-0.5 rounded-lg border border-[#27354f] bg-[#101625] text-slate-200 text-xs font-semibold">
                                      10
                                    </span>
                                  </td>

                                  {/* ACTIONS */}
                                  <td className="py-3.5 px-5 text-right">
                                    <div className="flex items-center justify-end gap-2.5">
                                      {/* Edit */}
                                      <button
                                        onClick={() => handleOpenEditChannel(ch)}
                                        className="p-1 rounded text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                                        title="Edit Channel"
                                      >
                                        <Pencil size={15} />
                                      </button>

                                      {/* Control Room Link */}
                                      <button
                                        onClick={() => navigate(`/channels/${ch._id}`)}
                                        className="p-1 rounded text-cyan-400 hover:text-white transition cursor-pointer"
                                        title="Open Live Playout Studio"
                                      >
                                        <ExternalLink size={15} />
                                      </button>

                                      {/* Delete */}
                                      <button
                                        onClick={() => handlePromptDelete('channel', ch)}
                                        className="p-1 rounded text-rose-500 hover:text-rose-400 transition cursor-pointer"
                                        title="Delete Channel"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* --- VIEW 2 & 3: CREATE / UPDATE CHANNEL FORM (IMAGE 4) --- */}
              {(subView === 'create' || subView === 'edit') && (
                <div className="space-y-4 max-w-5xl">
                  {/* Back Link */}
                  <button
                    onClick={() => setSubView('list')}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Channels</span>
                  </button>

                  {/* Header */}
                  <div>
                    <h1 className="text-xl font-extrabold text-white tracking-wide">
                      {subView === 'create' ? 'Create Channel' : 'Update Channel'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {subView === 'create'
                        ? 'Add a new streaming channel'
                        : 'Update streaming channel configuration'}
                    </p>
                  </div>

                  {/* Form Card */}
                  <form
                    onSubmit={handleSubmitChannel}
                    className="bg-[#0b0e18] border border-[#161f33] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl"
                  >
                    {/* Grid of Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                      {/* Channel Name */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Channel Name
                        </label>
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <Globe size={15} className="text-slate-500 shrink-0" />
                          <input
                            type="text"
                            required
                            value={channelFormData.name}
                            onChange={(e) =>
                              setChannelFormData({ ...channelFormData, name: e.target.value })
                            }
                            placeholder="Enter channel name"
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                          />
                        </div>
                      </div>

                      {/* Server Domain */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Server Domain
                        </label>
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <ServerIcon size={15} className="text-slate-500 shrink-0" />
                          <select
                            value={channelFormData.server}
                            onChange={(e) => {
                              const srv = servers.find((s) => s._id === e.target.value);
                              setChannelFormData({
                                ...channelFormData,
                                server: e.target.value,
                                serverDomain: srv?.streamUrl || 'http://94.136.185.222:81'
                              });
                            }}
                            className="w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer"
                          >
                            {servers.length > 0 ? (
                              servers.map((s) => (
                                <option key={s._id} value={s._id} className="bg-[#0b0e18] text-slate-200">
                                  {s.name} ({s.streamUrl || 'http://127.0.0.1:81'})
                                </option>
                              ))
                            ) : (
                              <option value="" className="bg-[#0b0e18] text-slate-200">
                                Default Flussonic Server (http://94.136.185.222:81)
                              </option>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Server Username */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Server username
                        </label>
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <UserIcon size={15} className="text-slate-500 shrink-0" />
                          <input
                            type="text"
                            value={channelFormData.serverUsername}
                            onChange={(e) =>
                              setChannelFormData({ ...channelFormData, serverUsername: e.target.value })
                            }
                            placeholder="Enter username"
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                          />
                        </div>
                      </div>

                      {/* Server Password */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Server Password
                        </label>
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <Lock size={15} className="text-slate-500 shrink-0" />
                          <input
                            type="password"
                            value={channelFormData.serverPassword}
                            onChange={(e) =>
                              setChannelFormData({ ...channelFormData, serverPassword: e.target.value })
                            }
                            placeholder="Enter password"
                            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                          />
                        </div>
                      </div>

                      {/* Assign User */}
                      <div className="md:col-span-2">
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Assign User
                        </label>
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] focus-within:border-[#00bcd4] transition">
                          <UserCheck size={15} className="text-slate-500 shrink-0" />
                          <select
                            required
                            value={channelFormData.assignedUser}
                            onChange={(e) =>
                              setChannelFormData({ ...channelFormData, assignedUser: e.target.value })
                            }
                            className="w-full bg-transparent text-slate-100 focus:outline-none text-xs cursor-pointer"
                          >
                            <option value="" disabled className="bg-[#0b0e18]">
                              Select User
                            </option>
                            {users.map((u) => (
                              <option key={u._id} value={u._id} className="bg-[#0b0e18] text-slate-200">
                                {u.name} ({u.email})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Output Resolution & Bitrate */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Output Resolution & FPS
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={channelFormData.resolution}
                            onChange={(e) =>
                              setChannelFormData({ ...channelFormData, resolution: e.target.value })
                            }
                            className="px-3 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] text-slate-200 focus:outline-none text-xs"
                          >
                            <option value="1280x720" className="bg-[#0b0e18]">1280x720 (720p HD)</option>
                            <option value="1920x1080" className="bg-[#0b0e18]">1920x1080 (1080p Full HD)</option>
                          </select>
                          <select
                            value={channelFormData.fps}
                            onChange={(e) =>
                              setChannelFormData({ ...channelFormData, fps: Number(e.target.value) })
                            }
                            className="px-3 py-2.5 rounded-xl bg-[#090d16] border border-[#1a2337] text-slate-200 focus:outline-none text-xs"
                          >
                            <option value={25} className="bg-[#0b0e18]">25 FPS</option>
                            <option value={30} className="bg-[#0b0e18]">30 FPS</option>
                            <option value={60} className="bg-[#0b0e18]">60 FPS</option>
                          </select>
                        </div>
                      </div>

                      {/* Video Bitrate */}
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">
                          Target Bitrates
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={channelFormData.videoBitrate}
                            onChange={(e) =>
                              setChannelFormData({ ...channelFormData, videoBitrate: e.target.value })
                            }
                            placeholder="Video (2500k)"
                            className="px-3 py-2 rounded-xl bg-[#090d16] border border-[#1a2337] text-slate-200 focus:outline-none text-xs"
                          />
                          <input
                            type="text"
                            value={channelFormData.audioBitrate}
                            onChange={(e) =>
                              setChannelFormData({ ...channelFormData, audioBitrate: e.target.value })
                            }
                            placeholder="Audio (128k)"
                            className="px-3 py-2 rounded-xl bg-[#090d16] border border-[#1a2337] text-slate-200 focus:outline-none text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-[#161f33] flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setSubView('list')}
                        className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#161f33] transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 rounded-xl text-xs font-extrabold bg-[#00bcd4] hover:bg-[#06b6d4] text-black shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-2"
                      >
                        <Radio size={14} />
                        <span>{subView === 'create' ? 'Create Channel' : 'Update Channel'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}

          {/* ==================== 3. OTHER SUB-SECTIONS ==================== */}
          {activeSection !== 'users' && activeSection !== 'channels' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold text-white capitalize tracking-wide">
                    {activeSection}
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Broadcasting module configuration
                  </p>
                </div>
              </div>

              <div className="bg-[#0b0e18] border border-[#161f33] rounded-2xl p-12 text-center shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-[#101726] border border-[#1f2b44] mx-auto flex items-center justify-center text-cyan-400 mb-4">
                  {activeSection === 'upload' && <UploadCloud size={28} />}
                  {activeSection === 'public' && <Cloud size={28} />}
                  {activeSection === 'analytics' && <TrendingUp size={28} />}
                  {activeSection === 'plans' && <IndianRupee size={28} />}
                  {activeSection === 'logs' && <ListFilter size={28} />}
                  {activeSection === 'storage' && <HardDrive size={28} />}
                  {activeSection === 'cookies' && <Cookie size={28} />}
                </div>
                <h3 className="text-base font-bold text-white capitalize mb-1">
                  {activeSection} Management
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                  Manage your streaming assets, analytics, and channel outputs directly from the Tarangix Lite control deck.
                </p>

                {channels.length > 0 && (
                  <button
                    onClick={() => navigate(`/channels/${channels[0]._id}`)}
                    className="px-5 py-2.5 rounded-xl bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-extrabold text-xs inline-flex items-center gap-2 transition"
                  >
                    <Radio size={15} />
                    <span>Open Live Control Room ({channels[0].name})</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==================== CONFIRM DELETE MODAL ==================== */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, type: null, item: null })}
        onConfirm={handleConfirmDelete}
        title={deleteModalState.type === 'user' ? 'Confirm Delete User' : 'Confirm Delete Channel'}
        itemName={deleteModalState.item?.name || ''}
        message={
          deleteModalState.type === 'user'
            ? `Are you sure you want to delete user '${deleteModalState.item?.name}' (${deleteModalState.item?.email})? All assigned channels and access permissions will be revoked.`
            : `Are you sure you want to delete channel '${deleteModalState.item?.name}'? Active live broadcast streams, playout schedules, and HLS playlists will be permanently removed.`
        }
        confirmText="Confirm Delete"
      />
    </div>
  );
}
