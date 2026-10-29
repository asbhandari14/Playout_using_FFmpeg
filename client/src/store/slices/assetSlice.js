import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios.js';

export const fetchAssets = createAsyncThunk(
  'assets/fetchAssets',
  async ({ channelId, category, search }, { rejectWithValue }) => {
    try {
      const res = await api.get('/assets', {
        params: { channelId, category, search }
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch assets');
    }
  }
);

export const deleteAsset = createAsyncThunk(
  'assets/deleteAsset',
  async (assetId, { rejectWithValue }) => {
    try {
      await api.delete(`/assets/${assetId}`);
      return assetId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete asset');
    }
  }
);

export const uploadAssetChunked = createAsyncThunk(
  'assets/uploadAssetChunked',
  async ({ channelId, category, file, onProgress }, { rejectWithValue, dispatch }) => {
    try {
      const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunk
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      let lastResponse = null;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(chunkIndex));
        formData.append('totalChunks', String(totalChunks));
        formData.append('fileName', file.name);
        formData.append('fileSize', String(file.size));
        formData.append('channelId', channelId);
        formData.append('category', category || 'General');
        formData.append('chunk', chunk);

        const res = await api.post('/assets/upload/chunk', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        lastResponse = res.data;
        const progressPercent = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        if (onProgress) {
          onProgress(progressPercent);
        }
      }

      // If last response contains the created asset
      if (lastResponse?.asset) {
        dispatch(assetSlice.actions.addUploadedAsset(lastResponse.asset));
      }

      return lastResponse;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Chunked upload failed');
    }
  }
);

const assetSlice = createSlice({
  name: 'assets',
  initialState: {
    list: [],
    storage: {
      totalUsedGB: '0.00',
      quotaGB: '10.0',
      totalCount: 0
    },
    selectedAsset: null, // asset loaded in LOCAL PREVIEW
    categoryFilter: 'All categories',
    searchQuery: '',
    loading: false,
    error: null,
    uploadProgressMap: {} // { [uploadId]: percent }
  },
  reducers: {
    setSelectedAsset: (state, action) => {
      state.selectedAsset = action.payload;
    },
    setCategoryFilter: (state, action) => {
      state.categoryFilter = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    addUploadedAsset: (state, action) => {
      const exists = state.list.some((a) => a._id === action.payload._id);
      if (!exists) {
        state.list.unshift(action.payload);
        state.storage.totalCount += 1;
      }
    },
    updateAssetProgress: (state, action) => {
      const { assetId, status, progress } = action.payload;
      const asset = state.list.find((a) => a._id === assetId);
      if (asset) {
        asset.status = status;
        asset.progress = progress;
      }
    },
    updateAssetReady: (state, action) => {
      const { assetId, asset } = action.payload;
      const index = state.list.findIndex((a) => a._id === assetId);
      if (index !== -1) {
        state.list[index] = asset;
      } else {
        state.list.unshift(asset);
      }
      if (state.selectedAsset?._id === assetId) {
        state.selectedAsset = asset;
      }
    },
    updateAssetFailed: (state, action) => {
      const { assetId } = action.payload;
      const asset = state.list.find((a) => a._id === assetId);
      if (asset) {
        asset.status = 'failed';
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch assets
      .addCase(fetchAssets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAssets.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.assets;
        if (action.payload.storage) {
          state.storage = action.payload.storage;
        }
        // Auto select first ready asset for local preview if none selected
        if (!state.selectedAsset && action.payload.assets.length > 0) {
          state.selectedAsset = action.payload.assets[0];
        }
      })
      .addCase(fetchAssets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Delete asset
      .addCase(deleteAsset.fulfilled, (state, action) => {
        state.list = state.list.filter((a) => a._id !== action.payload);
        state.storage.totalCount = Math.max(0, state.storage.totalCount - 1);
        if (state.selectedAsset?._id === action.payload) {
          state.selectedAsset = state.list[0] || null;
        }
      });
  }
});

export const {
  setSelectedAsset,
  setCategoryFilter,
  setSearchQuery,
  addUploadedAsset,
  updateAssetProgress,
  updateAssetReady,
  updateAssetFailed
} = assetSlice.actions;

export default assetSlice.reducer;
