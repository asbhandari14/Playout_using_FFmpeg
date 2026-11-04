import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginUser, clearError } from '../store/slices/authSlice.js';

const DEFAULT_EMAIL = 'superadmin@playout.com';
const DEFAULT_PASSWORD = 'Password@123';

export default function useAuth() {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/channels');
    }
    return () => {
      dispatch(clearError());
    };
  }, [isAuthenticated, navigate, dispatch]);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!email || !password) return;
      dispatch(loginUser({ email, password }));
    },
    [email, password, dispatch]
  );

  const handleQuickLogin = useCallback(
    (quickEmail) => {
      setEmail(quickEmail);
      setPassword(DEFAULT_PASSWORD);
      dispatch(loginUser({ email: quickEmail, password: DEFAULT_PASSWORD }));
    },
    [dispatch]
  );

  return {
    email,
    password,
    setEmail,
    setPassword,
    loading,
    error,
    handleSubmit,
    handleQuickLogin,
  };
}