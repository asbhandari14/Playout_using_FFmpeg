import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios.js';

// Format seconds into HH:MM:SS or MM:SS
const formatTime = (seconds) => {
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
const recalculateTimings = (items) => {
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

export const fetchPlaylist = createAsyncThunk(
  'playlist/fetchPlaylist',
  async (channelId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/channels/${channelId}/playlist`);
      return res.data.playlist;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch playlist');
    }
  }
);

export const savePlaylistThunk = createAsyncThunk(
  'playlist/savePlaylist',
  async ({ channelId, items, loop }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/channels/${channelId}/playlist`, { items, loop });
      return res.data.playlist;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to save playlist');
    }
  }
);

export const clearPlaylistThunk = createAsyncThunk(
  'playlist/clearPlaylist',
  async (channelId, { rejectWithValue }) => {
    try {
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
      .addCase(fetchPlaylist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlaylist.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || [];
        state.totalDuration = action.payload.totalDuration || 0;
        state.totalDurationFormatted = action.payload.totalDurationFormatted || '00:00:00';
        state.loop = action.payload.loop !== undefined ? action.payload.loop : true;
        state.hasUnsavedChanges = false;
      })
      .addCase(fetchPlaylist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(savePlaylistThunk.fulfilled, (state, action) => {
        state.items = action.payload.items || [];
        state.totalDuration = action.payload.totalDuration || 0;
        state.totalDurationFormatted = action.payload.totalDurationFormatted || '00:00:00';
        state.hasUnsavedChanges = false;
        state.saveSuccess = true;
      })
      .addCase(clearPlaylistThunk.fulfilled, (state) => {
        state.items = [];
        state.totalDuration = 0;
        state.totalDurationFormatted = '00:00:00';
        state.hasUnsavedChanges = false;
      });
  }
});

export const {
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
