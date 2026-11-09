import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios.js';

export const fetchServers = createAsyncThunk(
  'servers/fetchServers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await api.get('/servers/all', { params });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch servers');
    }
  }
);

export const createServer = createAsyncThunk(
  'servers/createServer',
  async (serverData, { rejectWithValue }) => {
    try {
      const res = await api.post('/servers/create', serverData);
      return res.data.server;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.response?.data?.errors?.[0] || 'Failed to create server');
    }
  }
);

export const updateServer = createAsyncThunk(
  'servers/updateServer',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/servers/update/${id}`, data);
      return res.data.server;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.response?.data?.errors?.[0] || 'Failed to update server');
    }
  }
);

export const deleteServer = createAsyncThunk(
  'servers/deleteServer',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/servers/delete/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete server');
    }
  }
);

const serverSlice = createSlice({
  name: 'servers',
  initialState: {
    list: [],
    loading: false,
    error: null,
    successMessage: null
  },
  reducers: {
    clearServerAlerts: (state) => {
      state.error = null;
      state.successMessage = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchServers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchServers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload?.servers || (Array.isArray(action.payload) ? action.payload : []);
      })
      .addCase(fetchServers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create
      .addCase(createServer.fulfilled, (state, action) => {
        state.list.unshift(action.payload);
        state.successMessage = 'Server configured successfully';
      })
      .addCase(createServer.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Update
      .addCase(updateServer.fulfilled, (state, action) => {
        const index = state.list.findIndex((s) => s._id === action.payload._id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        state.successMessage = 'Server updated successfully';
      })
      .addCase(updateServer.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Delete
      .addCase(deleteServer.fulfilled, (state, action) => {
        state.list = state.list.filter((s) => s._id !== action.payload);
        state.successMessage = 'Server removed';
      })
      .addCase(deleteServer.rejected, (state, action) => {
        state.error = action.payload;
      });
  }
});

export const { clearServerAlerts } = serverSlice.actions;
export default serverSlice.reducer;
