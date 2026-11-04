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
  const { user, isAuthenticated } = useSelector((state) => state.auth);

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

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/channels"
        element={
          <ProtectedRoute>
            <AllChannels />
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

      <Route
        path="/servers"
        element={
          <AdminRoute>
            <Dashboard initialSection="servers" />
          </AdminRoute>
        }
      />

      {/* <Route
        path="/users"
        element={
          <AdminRoute>
            <UsersPage />
          </AdminRoute>
        }
      /> */}

      {/* Default route redirect */}
      <Route path="/" element={<Navigate to="/channels" replace />} />
      <Route path="*" element={<Navigate to="/channels" replace />} />
    </Routes>
  );
}
