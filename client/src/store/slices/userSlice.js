import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios.js';

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await api.get('/users/all', { params });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch users');
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (userData, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/register', userData);
      return res.data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.response?.data?.errors?.[0] || 'Failed to create user');
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/users/${id}`, data);
      return res.data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.response?.data?.errors?.[0] || 'Failed to update user');
    }
  }
);

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/users/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete user');
    }
  }
);

const userSlice = createSlice({
  name: 'users',
  initialState: {
    list: [],
    total: 0,
    loading: false,
    error: null,
    successMessage: null
  },
  reducers: {
    clearUserAlerts: (state) => {
      state.error = null;
      state.successMessage = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.users;
        state.total = action.payload.total;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create
      .addCase(createUser.fulfilled, (state, action) => {
        state.list.unshift(action.payload);
        state.total += 1;
        state.successMessage = 'User created successfully';
      })
      .addCase(createUser.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Update
      .addCase(updateUser.fulfilled, (state, action) => {
        const index = state.list.findIndex((u) => u._id === action.payload._id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        state.successMessage = 'User updated successfully';
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Delete
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.list = state.list.filter((u) => u._id !== action.payload);
        state.total -= 1;
        state.successMessage = 'User removed successfully';
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.error = action.payload;
      });
  }
});

export const { clearUserAlerts } = userSlice.actions;
export default userSlice.reducer;
