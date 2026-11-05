import { toast } from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginUser, clearError } from '../store/slices/authSlice.js';

export default function useAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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