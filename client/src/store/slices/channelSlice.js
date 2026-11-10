import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios.js';

export const fetchChannels = createAsyncThunk(
  'channels/fetchChannels',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await api.get('/channels', { params });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch channels');
    }
  }
);

export const fetchChannelById = createAsyncThunk(
  'channels/fetchChannelById',
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/channels/${id}`);
      return res.data.channel;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch channel');
    }
  }
);

export const createChannel = createAsyncThunk(
  'channels/createChannel',
  async (channelData, { rejectWithValue }) => {
    try {
      const res = await api.post('/channels', channelData);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.response?.data?.errors?.[0] || 'Failed to create channel');
    }
  }
);

export const updateChannel = createAsyncThunk(
  'channels/updateChannel',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/channels/${id}`, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.response?.data?.errors?.[0] || 'Failed to update channel');
    }
  }
);

export const deleteChannel = createAsyncThunk(
  'channels/deleteChannel',
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/channels/${id}`);
      return { id, message: res.data?.message };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete channel');
    }
  }
);

const channelSlice = createSlice({
  name: 'channels',
  initialState: {
    list: [],
    currentChannel: null,
    loading: false,
    error: null,
    successMessage: null
  },
  reducers: {
    setCurrentChannel: (state, action) => {
      state.currentChannel = action.payload;
    },
    updateCurrentChannelBranding: (state, action) => {
      if (state.currentChannel) {
        const prevBranding = state.currentChannel.branding || {};
        const nextBranding = { ...prevBranding };
        Object.entries(action.payload || {}).forEach(([key, val]) => {
          if (
            val &&
            typeof val === 'object' &&
            !Array.isArray(val) &&
            prevBranding[key] &&
            typeof prevBranding[key] === 'object'
          ) {
            nextBranding[key] = { ...prevBranding[key], ...val };
          } else {
            nextBranding[key] = val;
          }
        });
        state.currentChannel.branding = nextBranding;
      }
    },
    updateChannelStatus: (state, action) => {
      const { channelId, status } = action.payload;
      if (state.currentChannel && state.currentChannel._id === channelId) {
        state.currentChannel.status = status;
      }
      const item = state.list.find((c) => c._id === channelId);
      if (item) {
        item.status = status;
      }
    },
    clearChannelAlerts: (state) => {
      state.error = null;
      state.successMessage = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch list
      .addCase(fetchChannels.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChannels.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.channels;
      })
      .addCase(fetchChannels.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch single
      .addCase(fetchChannelById.fulfilled, (state, action) => {
        state.currentChannel = action.payload;
      })
      // Create
      .addCase(createChannel.fulfilled, (state, action) => {
        const newChannel = action.payload?.channel || action.payload;
        state.list.unshift(newChannel);
        state.successMessage = action.payload?.message || 'Channel created and provisioned on Flussonic successfully';
      })
      .addCase(createChannel.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Update
      .addCase(updateChannel.fulfilled, (state, action) => {
        const updated = action.payload?.channel || action.payload;
        const index = state.list.findIndex((c) => c._id === updated._id);
        if (index !== -1) {
          state.list[index] = updated;
        }
        if (state.currentChannel?._id === updated._id) {
          state.currentChannel = updated;
        }
        state.successMessage = action.payload?.message || 'Channel settings updated';
      })
      .addCase(updateChannel.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Delete
      .addCase(deleteChannel.fulfilled, (state, action) => {
        const id = action.payload?.id || action.payload;
        state.list = state.list.filter((c) => c._id !== id);
        state.successMessage = action.payload?.message || 'Channel deleted';
      })
      .addCase(deleteChannel.rejected, (state, action) => {
        state.error = action.payload;
      });
  }
});

export const { setCurrentChannel, updateCurrentChannelBranding, updateChannelStatus, clearChannelAlerts } = channelSlice.actions;
export default channelSlice.reducer;
