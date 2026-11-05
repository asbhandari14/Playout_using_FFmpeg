import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { checkAuth } from './store/slices/authSlice.js';

import Login from './pages/auth/Login.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import ControlRoomPage from './pages/control_room/ControlRoomPage.jsx';
import AllChannels from './pages/channel/AllChannels.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useSelector((state) => state.auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-slate-400 text-xs">
        Verifying session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useSelector((state) => state.auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-slate-400 text-xs">
        Verifying session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'super_admin' && user?.role !== 'admin') {
    return <Navigate to="/channels" replace />;
  }

  return children;
}

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Main Dashboard / Channels Management */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="channels" />
          </ProtectedRoute>
        }
      />

      {/* Channels List & Studio View */}
      <Route
        path="/channels"
        element={
          <ProtectedRoute>
            <AllChannels />
          </ProtectedRoute>
        }
      />

      <Route
        path="/channels/manage"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="channels" />
          </ProtectedRoute>
        }
      />

      {/* Channel Forms */}
      <Route
        path="/channels/create"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="channels" initialSubView="create" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/channels/edit/:id"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="channels" initialSubView="edit" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/channels/:channelId"
        element={
          <ProtectedRoute>
            <ControlRoomPage />
          </ProtectedRoute>
        }
      />

      {/* Servers Management & Forms */}
      <Route
        path="/servers"
        element={
          <AdminRoute>
            <Dashboard initialSection="servers" />
          </AdminRoute>
        }
      />
      <Route
        path="/servers/create"
        element={
          <AdminRoute>
            <Dashboard initialSection="servers" initialSubView="create" />
          </AdminRoute>
        }
      />
      <Route
        path="/servers/edit/:id"
        element={
          <AdminRoute>
            <Dashboard initialSection="servers" initialSubView="edit" />
          </AdminRoute>
        }
      />

      {/* Users Management & Forms */}
      <Route
        path="/users"
        element={
          <AdminRoute>
            <Dashboard initialSection="users" />
          </AdminRoute>
        }
      />
      <Route
        path="/users/create"
        element={
          <AdminRoute>
            <Dashboard initialSection="users" initialSubView="create" />
          </AdminRoute>
        }
      />
      <Route
        path="/users/edit/:id"
        element={
          <AdminRoute>
            <Dashboard initialSection="users" initialSubView="edit" />
          </AdminRoute>
        }
      />

      {/* Five Playlist Schedule Sections */}
      <Route
        path="/playlists/emergency"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="emergency_playlist" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/playlists/emergency/create"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="emergency_playlist" initialSubView="create" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/playlists/advertisement"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="advertisement_playlist" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/playlists/live-schedule"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="live_schedule" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/playlists/scheduling"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="scheduling_playlist" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/playlists/default"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="default_playlist" />
          </ProtectedRoute>
        }
      />

      {/* Playlist Forms */}
      <Route
        path="/playlists/create"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="playlists" initialSubView="create" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/playlists/edit/:id"
        element={
          <ProtectedRoute>
            <Dashboard initialSection="playlists" initialSubView="edit" />
          </ProtectedRoute>
        }
      />

      {/* Default route redirect */}
      <Route path="/" element={<Navigate to="/channels" replace />} />
      <Route path="*" element={<Navigate to="/channels" replace />} />
    </Routes>
  );
}
