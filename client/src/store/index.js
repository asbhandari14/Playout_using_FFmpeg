import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice.js';
import userReducer from './slices/userSlice.js';
import serverReducer from './slices/serverSlice.js';
import channelReducer from './slices/channelSlice.js';
import assetReducer from './slices/assetSlice.js';
import playlistReducer from './slices/playlistSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: userReducer,
    servers: serverReducer,
    channels: channelReducer,
    assets: assetReducer,
    playlist: playlistReducer
  }
});
