import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios.js';

// Format seconds into HH:MM:SS or MM:SS
export const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Recompute cumulative start times for a list of items
export const recalculateTimings = (items) => {
  let cumulative = 0;
  return items.map((item, index) => {
    const duration = item.asset?.duration || 0;
    const offset = cumulative;
    cumulative += duration;
    return {
      ...item,
      order: index + 1,
      startOffset: offset,
      startOffsetFormatted: formatTime(offset)
    };
  });
};

export const fetchPlaylists = createAsyncThunk(
  'playlist/fetchPlaylists',
  async (channelId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/channels/${channelId}/playlists`);
      return res.data.playlists;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch playlists');
    }
  }
);

export const fetchActivePlaylist = createAsyncThunk(
  'playlist/fetchActivePlaylist',
  async (channelId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/channels/${channelId}/playlist/active`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch active playlist');
    }
  }
);

export const fetchPlaylist = createAsyncThunk(
  'playlist/fetchPlaylist',
  async (args, { rejectWithValue }) => {
    try {
      const channelId = typeof args === 'string' ? args : args.channelId;
      const params = {};
      if (typeof args === 'object') {
        if (args.playlistId) params.playlistId = args.playlistId;
        if (args.type) params.type = args.type;
      }
      const res = await api.get(`/channels/${channelId}/playlist`, { params });
      return res.data.playlist;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch playlist');
    }
  }
);

export const createPlaylistThunk = createAsyncThunk(
  'playlist/createPlaylist',
  async ({ channelId, ...data }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/channels/${channelId}/playlists`, data);
      return res.data.playlist;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create playlist');
    }
  }
);

export const updatePlaylistThunk = createAsyncThunk(
  'playlist/updatePlaylist',
  async ({ channelId, playlistId, ...data }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/channels/${channelId}/playlists/${playlistId}`, data);
      return res.data.playlist;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update playlist');
    }
  }
);

export const deletePlaylistThunk = createAsyncThunk(
  'playlist/deletePlaylist',
  async ({ channelId, playlistId }, { rejectWithValue }) => {
    try {
      await api.delete(`/channels/${channelId}/playlists/${playlistId}`);
      return playlistId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete playlist');
    }
  }
);

export const savePlaylistThunk = createAsyncThunk(
  'playlist/savePlaylist',
  async ({ channelId, playlistId, items, loop, type }, { rejectWithValue }) => {
    try {
      let res;
      if (playlistId) {
        res = await api.put(`/channels/${channelId}/playlists/${playlistId}`, { items, loop, type });
      } else {
        res = await api.put(`/channels/${channelId}/playlist`, { items, loop, type });
      }
      return res.data.playlist;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to save playlist');
    }
  }
);

export const clearPlaylistThunk = createAsyncThunk(
  'playlist/clearPlaylist',
  async (args, { rejectWithValue }) => {
    try {
      const channelId = typeof args === 'string' ? args : args.channelId;
      const playlistId = typeof args === 'object' ? args.playlistId : null;
      if (playlistId) {
        const res = await api.put(`/channels/${channelId}/playlists/${playlistId}`, { items: [] });
        return res.data.playlist;
      }
      const res = await api.delete(`/channels/${channelId}/playlist`);
      return res.data.playlist;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to clear playlist');
    }
  }
);

const playlistSlice = createSlice({
  name: 'playlist',
  initialState: {
    playlists: [],
    currentPlaylist: null,
    activeOnAirPlaylist: null,
    allActiveCandidates: [],
    items: [],
    totalDuration: 0,
    totalDurationFormatted: '00:00:00',
    loop: true,
    hasUnsavedChanges: false,
    loading: false,
    error: null,
    saveSuccess: false
  },
  reducers: {
    setCurrentPlaylist: (state, action) => {
      const playlist = action.payload;
      state.currentPlaylist = playlist;
      if (playlist) {
        state.items = playlist.items || [];
        state.totalDuration = playlist.totalDuration || 0;
        state.totalDurationFormatted = playlist.totalDurationFormatted || '00:00:00';
        state.loop = playlist.loop !== undefined ? playlist.loop : true;
        state.hasUnsavedChanges = false;
      }
    },
    addItem: (state, action) => {
      const asset = action.payload;
      const newItem = {
        _id: 'temp_' + Date.now() + Math.random().toString(36).substring(2, 6),
        asset,
        order: state.items.length + 1,
        startOffset: state.totalDuration,
        startOffsetFormatted: formatTime(state.totalDuration),
        status: 'queued'
      };
      const updated = [...state.items, newItem];
      state.items = recalculateTimings(updated);
      state.totalDuration += asset.duration || 0;
      state.totalDurationFormatted = formatTime(state.totalDuration);
      state.hasUnsavedChanges = true;
    },
    removeItem: (state, action) => {
      const index = action.payload;
      const updated = state.items.filter((_, idx) => idx !== index);
      state.items = recalculateTimings(updated);
      state.totalDuration = state.items.reduce((acc, curr) => acc + (curr.asset?.duration || 0), 0);
      state.totalDurationFormatted = formatTime(state.totalDuration);
      state.hasUnsavedChanges = true;
    },
    moveItem: (state, action) => {
      const { fromIndex, toIndex } = action.payload;
      if (toIndex < 0 || toIndex >= state.items.length || fromIndex === toIndex) return;
      const reordered = Array.from(state.items);
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      state.items = recalculateTimings(reordered);
      state.hasUnsavedChanges = true;
    },
    duplicateItem: (state, action) => {
      const index = action.payload;
      const source = state.items[index];
      if (!source) return;
      const copy = {
        ...source,
        _id: 'temp_' + Date.now() + Math.random().toString(36).substring(2, 6),
        status: 'queued'
      };
      const updated = [...state.items];
      updated.splice(index + 1, 0, copy);
      state.items = recalculateTimings(updated);
      state.totalDuration = state.items.reduce((acc, curr) => acc + (curr.asset?.duration || 0), 0);
      state.totalDurationFormatted = formatTime(state.totalDuration);
      state.hasUnsavedChanges = true;
    },
    reorderItems: (state, action) => {
      const newItems = action.payload;
      state.items = recalculateTimings(newItems);
      state.hasUnsavedChanges = true;
    },
    updateItemStatus: (state, action) => {
      const { index, status } = action.payload;
      if (state.items[index]) {
        state.items[index].status = status;
      }
    },
    setPlaylistState: (state, action) => {
      if (action.payload) {
        state.currentPlaylist = action.payload;
        state.items = action.payload.items || [];
        state.totalDuration = action.payload.totalDuration || 0;
        state.totalDurationFormatted = action.payload.totalDurationFormatted || '00:00:00';
        state.loop = action.payload.loop !== undefined ? action.payload.loop : true;
        state.hasUnsavedChanges = false;
      }
    },
    clearSaveAlert: (state) => {
      state.saveSuccess = false;
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchPlaylists
      .addCase(fetchPlaylists.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlaylists.fulfilled, (state, action) => {
        state.loading = false;
        state.playlists = action.payload || [];
        // If current playlist is not set or not in list, fall back to the default playlist
        const fresh = state.currentPlaylist
          ? state.playlists.find((p) => p._id === state.currentPlaylist._id)
          : null;

        if (fresh) {
          state.currentPlaylist = fresh;
          if (!state.hasUnsavedChanges) {
            state.items = fresh.items || [];
            state.totalDuration = fresh.totalDuration || 0;
            state.totalDurationFormatted = fresh.totalDurationFormatted || '00:00:00';
            state.loop = fresh.loop !== undefined ? fresh.loop : true;
          }
        } else if (state.playlists.length > 0) {
          const defaultPlaylist =
            state.playlists.find((p) => p.type === 'default') || state.playlists[0];
          state.currentPlaylist = defaultPlaylist;
          state.items = defaultPlaylist.items || [];
          state.totalDuration = defaultPlaylist.totalDuration || 0;
          state.totalDurationFormatted = defaultPlaylist.totalDurationFormatted || '00:00:00';
          state.loop = defaultPlaylist.loop !== undefined ? defaultPlaylist.loop : true;
          state.hasUnsavedChanges = false;
        } else {
          state.currentPlaylist = null;
          state.items = [];
          state.totalDuration = 0;
          state.totalDurationFormatted = '00:00:00';
        }
      })
      .addCase(fetchPlaylists.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // fetchActivePlaylist
      .addCase(fetchActivePlaylist.fulfilled, (state, action) => {
        state.activeOnAirPlaylist = action.payload?.activePlaylist || null;
        state.allActiveCandidates = action.payload?.allActiveCandidates || [];
      })

      // fetchPlaylist
      .addCase(fetchPlaylist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlaylist.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPlaylist = action.payload;
        state.items = action.payload?.items || [];
        state.totalDuration = action.payload?.totalDuration || 0;
        state.totalDurationFormatted = action.payload?.totalDurationFormatted || '00:00:00';
        state.loop = action.payload?.loop !== undefined ? action.payload?.loop : true;
        state.hasUnsavedChanges = false;
      })
      .addCase(fetchPlaylist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // createPlaylistThunk
      .addCase(createPlaylistThunk.fulfilled, (state, action) => {
        state.playlists.push(action.payload);
        state.currentPlaylist = action.payload;
        state.items = action.payload?.items || [];
        state.totalDuration = action.payload?.totalDuration || 0;
        state.totalDurationFormatted = action.payload?.totalDurationFormatted || '00:00:00';
        state.loop = action.payload?.loop !== undefined ? action.payload?.loop : true;
        state.hasUnsavedChanges = false;
        state.saveSuccess = true;
      })

      // updatePlaylistThunk
      .addCase(updatePlaylistThunk.fulfilled, (state, action) => {
        state.currentPlaylist = action.payload;
        const index = state.playlists.findIndex((p) => p._id === action.payload._id);
        if (index !== -1) {
          state.playlists[index] = action.payload;
        }
        state.items = action.payload?.items || [];
        state.totalDuration = action.payload?.totalDuration || 0;
        state.totalDurationFormatted = action.payload?.totalDurationFormatted || '00:00:00';
        state.loop = action.payload?.loop !== undefined ? action.payload?.loop : true;
        state.hasUnsavedChanges = false;
        state.saveSuccess = true;
      })

      // deletePlaylistThunk
      .addCase(deletePlaylistThunk.fulfilled, (state, action) => {
        const deletedId = action.payload;
        state.playlists = state.playlists.filter((p) => p._id !== deletedId);
        if (state.currentPlaylist?._id === deletedId) {
          const fallback =
            state.playlists.find((p) => p.type === 'default') || state.playlists[0] || null;
          state.currentPlaylist = fallback;
          state.items = fallback?.items || [];
          state.totalDuration = fallback?.totalDuration || 0;
          state.totalDurationFormatted = fallback?.totalDurationFormatted || '00:00:00';
          state.loop = fallback?.loop !== undefined ? fallback.loop : true;
        }
      })

      // savePlaylistThunk
      .addCase(savePlaylistThunk.fulfilled, (state, action) => {
        state.currentPlaylist = action.payload;
        const index = state.playlists.findIndex((p) => p._id === action.payload._id);
        if (index !== -1) {
          state.playlists[index] = action.payload;
        }
        state.items = action.payload.items || [];
        state.totalDuration = action.payload.totalDuration || 0;
        state.totalDurationFormatted = action.payload.totalDurationFormatted || '00:00:00';
        state.hasUnsavedChanges = false;
        state.saveSuccess = true;
      })

      // clearPlaylistThunk
      .addCase(clearPlaylistThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.currentPlaylist = action.payload;
          const index = state.playlists.findIndex((p) => p._id === action.payload._id);
          if (index !== -1) {
            state.playlists[index] = action.payload;
          }
        }
        state.items = [];
        state.totalDuration = 0;
        state.totalDurationFormatted = '00:00:00';
        state.hasUnsavedChanges = false;
      });
  }
});

export const {
  setCurrentPlaylist,
  addItem,
  removeItem,
  moveItem,
  duplicateItem,
  reorderItems,
  updateItemStatus,
  setPlaylistState,
  clearSaveAlert
} = playlistSlice.actions;

export default playlistSlice.reducer;
