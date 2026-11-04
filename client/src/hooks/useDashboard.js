import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  clearUserAlerts
} from '../store/slices/userSlice.js';
import {
  fetchChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  clearChannelAlerts
} from '../store/slices/channelSlice.js';
import {
  fetchServers,
  createServer,
  updateServer,
  deleteServer,
  clearServerAlerts
} from '../store/slices/serverSlice.js';
import { logoutUser } from '../store/slices/authSlice.js';
import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_SERVER_URL,
  getEmptyUserForm,
  getEmptyChannelForm,
  getEmptyServerForm
} from '../constants/dashboard.js';

export default function useDashboard(initialSection = 'channels') {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // ---------- Redux state ----------
  const { user: currentUser } = useSelector((state) => state.auth);
  const { list: users, error: userError, successMessage: userSuccess } = useSelector((state) => state.users);
  const { list: channels, error: channelError, successMessage: channelSuccess } = useSelector((state) => state.channels);
  const { list: servers, error: serverError, successMessage: serverSuccess } = useSelector((state) => state.servers);

  // ---------- Navigation state ----------
  // activeSection: 'channels' | 'servers' | 'users' | 'upload' | 'analytics' | ...
  const [activeSection, setActiveSection] = useState(initialSection);
  // subView: 'list' | 'create' | 'edit'
  const [subView, setSubView] = useState('list');
  const [isSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // ---------- Misc UI state ----------
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    type: null, // 'user' | 'channel' | 'server'
    item: null
  });

  // ---------- Form state ----------
  const [editingUserId, setEditingUserId] = useState(null);
  const [userFormData, setUserFormData] = useState(getEmptyUserForm());
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [channelFormData, setChannelFormData] = useState(getEmptyChannelForm());
  const [editingServerId, setEditingServerId] = useState(null);
  const [serverFormData, setServerFormData] = useState(getEmptyServerForm());

  // ---------- Initial fetch + reconnect recovery + socket ----------
  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchChannels());
    dispatch(fetchServers());

    const handleOnline = () => {
      console.log('[Dashboard] Internet connectivity restored. Re-fetching channels, users, and servers...');
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

  // ---------- Auto-clear alerts after 4s ----------
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

  useEffect(() => {
    if (serverSuccess || serverError) {
      const timer = setTimeout(() => dispatch(clearServerAlerts()), 4000);
      return () => clearTimeout(timer);
    }
  }, [serverSuccess, serverError, dispatch]);

  // ---------- Filtered lists ----------
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  const filteredChannels = useMemo(() => {
    if (!searchQuery) return channels;
    const q = searchQuery.toLowerCase();
    return channels.filter((ch) => ch.name && ch.name.toLowerCase().includes(q));
  }, [channels, searchQuery]);

  const filteredServers = useMemo(() => {
    if (!searchQuery) return servers;
    const q = searchQuery.toLowerCase();
    return servers.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.streamUrl && s.streamUrl.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q))
    );
  }, [servers, searchQuery]);

  // ---------- Navigation / header actions ----------
  const goToSection = (section) => {
    setActiveSection(section);
    setSubView('list');
    setSearchQuery('');
  };

  const toggleProfileMenu = () => setIsProfileMenuOpen((prev) => !prev);

  const openChannelStudio = (channelId) => navigate(`/channels/${channelId}`);

  const openControlRoom = () => {
    setIsProfileMenuOpen(false);
    if (channels[0]?._id) {
      navigate(`/channels/${channels[0]._id}`);
    }
  };

  const logout = () => {
    setIsProfileMenuOpen(false);
    dispatch(logoutUser());
    navigate('/login');
  };

  const copyUrl = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2000);
  };

  // ---------- User handlers ----------
  const openCreateUser = () => {
    setEditingUserId(null);
    setUserFormData(getEmptyUserForm());
    setActiveSection('users');
    setSubView('create');
  };

  const openEditUser = (u) => {
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
      permissions: u.permissions || [...DEFAULT_USER_PERMISSIONS]
    });
    setActiveSection('users');
    setSubView('edit');
  };

  const togglePermission = (perm) => {
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

  const submitUser = async (e) => {
    e.preventDefault();
    const f = userFormData;

    if (!f.username || !f.email) {
      alert('Please provide username and email');
      return;
    }

    const payload = {
      name: f.username,
      email: f.email,
      role: f.role,
      bandwidthAmount: f.bandwidthAmount,
      bandwidthUnit: f.bandwidthUnit,
      storageAmount: f.storageAmount,
      storageUnit: f.storageUnit,
      gracePeriodDays: f.gracePeriodDays,
      permissions: f.permissions
    };

    if (editingUserId) {
      if (f.password) payload.password = f.password;
      await dispatch(updateUser({ id: editingUserId, data: payload }));
    } else {
      if (!f.password) {
        alert('Password is required for new users');
        return;
      }
      await dispatch(createUser({ ...payload, password: f.password }));
    }
    setSubView('list');
  };

  // ---------- Channel handlers ----------
  const openCreateChannel = () => {
    const firstServer = servers[0];
    const firstUser = users[0];
    setEditingChannelId(null);
    setChannelFormData({
      ...getEmptyChannelForm(),
      server: firstServer?._id || '',
      serverDomain: firstServer?.streamUrl || DEFAULT_SERVER_URL,
      serverUsername: firstServer?.serverUsername || 'admin',
      assignedUser: firstUser?._id || currentUser?._id || ''
    });
    setActiveSection('channels');
    setSubView('create');
  };

  const openEditChannel = (ch) => {
    setEditingChannelId(ch._id);
    const assignedId = ch.assignedUser?._id || ch.assignedUser || '';
    const serverObj = servers.find((s) => s._id === (ch.server?._id || ch.server)) || ch.server;

    setChannelFormData({
      name: ch.name || '',
      server: serverObj?._id || ch.server?._id || ch.server || '',
      serverDomain: serverObj?.streamUrl || ch.server?.streamUrl || DEFAULT_SERVER_URL,
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
    setSubView('edit');
  };

  const submitChannel = async (e) => {
    e.preventDefault();
    const f = channelFormData;

    if (!f.name) {
      alert('Channel name is required');
      return;
    }

    const payload = {
      name: f.name,
      server: f.server || servers[0]?._id,
      assignedUser: f.assignedUser || users[0]?._id || currentUser?._id,
      streamKey: f.streamKey || f.name.toLowerCase().replace(/\s+/g, '_'),
      outputSettings: {
        resolution: f.resolution,
        fps: Number(f.fps) || 25,
        videoBitrate: f.videoBitrate,
        audioBitrate: f.audioBitrate
      }
    };

    if (editingChannelId) {
      await dispatch(updateChannel({ id: editingChannelId, data: payload }));
    } else {
      await dispatch(createChannel(payload));
    }
    setSubView('list');
  };

  // ---------- Server handlers ----------
  const openCreateServer = () => {
    setEditingServerId(null);
    setServerFormData(getEmptyServerForm());
    setActiveSection('servers');
    setSubView('create');
  };

  const openEditServer = (srv) => {
    setEditingServerId(srv._id);
    setServerFormData({
      name: srv.name || '',
      category: srv.category || 'General',
      streamUrl: srv.streamUrl || srv.hlsBaseUrl || DEFAULT_SERVER_URL,
      serverUsername: srv.serverUsername || '',
      serverPassword: '' // leave blank to keep unchanged
    });
    setActiveSection('servers');
    setSubView('edit');
  };

  const submitServer = async (e) => {
    e.preventDefault();
    const f = serverFormData;

    if (!f.name || !f.streamUrl) {
      alert('Stream name and stream URL are required');
      return;
    }

    const payload = {
      name: f.name,
      category: f.category || 'General',
      streamUrl: f.streamUrl,
      serverUsername: f.serverUsername || ''
    };

    if (editingServerId) {
      if (f.serverPassword) payload.serverPassword = f.serverPassword;
      await dispatch(updateServer({ id: editingServerId, data: payload }));
    } else {
      if (f.serverPassword) payload.serverPassword = f.serverPassword;
      await dispatch(createServer(payload));
    }
    setSubView('list');
  };

  // ---------- Delete confirmation ----------
  const promptDelete = (type, item) => {
    setDeleteModalState({ isOpen: true, type, item });
  };

  const closeDeleteModal = () => {
    setDeleteModalState({ isOpen: false, type: null, item: null });
  };

  const confirmDelete = async () => {
    const { type, item } = deleteModalState;
    if (!item) return;

    if (type === 'user') {
      await dispatch(deleteUser(item._id));
    } else if (type === 'channel') {
      await dispatch(deleteChannel(item._id));
    } else if (type === 'server') {
      await dispatch(deleteServer(item._id));
    }
    closeDeleteModal();
  };

  return {
    // data
    currentUser,
    users,
    channels,
    servers,
    filteredUsers,
    filteredChannels,
    filteredServers,

    // navigation
    nav: {
      activeSection,
      subView,
      setSubView,
      isSidebarOpen,
      isProfileMenuOpen,
      toggleProfileMenu,
      goToSection
    },

    // alerts
    alerts: {
      success: userSuccess || channelSuccess || serverSuccess,
      error: userError || channelError || serverError
    },

    // search
    searchQuery,
    setSearchQuery,

    // copy url
    copiedUrl,
    copyUrl,

    // forms
    userForm: {
      data: userFormData,
      setData: setUserFormData,
      togglePermission,
      openCreate: openCreateUser,
      openEdit: openEditUser,
      submit: submitUser
    },
    channelForm: {
      data: channelFormData,
      setData: setChannelFormData,
      openCreate: openCreateChannel,
      openEdit: openEditChannel,
      submit: submitChannel
    },
    serverForm: {
      data: serverFormData,
      setData: setServerFormData,
      openCreate: openCreateServer,
      openEdit: openEditServer,
      submit: submitServer
    },

    // delete modal
    deleteModal: {
      state: deleteModalState,
      prompt: promptDelete,
      confirm: confirmDelete,
      close: closeDeleteModal
    },

    // header / misc actions
    actions: { openControlRoom, openChannelStudio, logout }
  };
}
