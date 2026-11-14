import React from 'react';
import useAuth from '../../hooks/useAuth';
import LoginBackground from '../../components/background/LoginBackground';
import LoginHeader from '../../components/header/LoginHeader';
import LoginForm from '../../components/form/LoginForm';

export default function Login() {
  const {
    email,
    password,
    setEmail,
    setPassword,
    loading,
    error,
    handleSubmit,
  } = useAuth();

  return (
    <div className="min-h-screen bg-[#090b0e] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Login Background Theme */}
      <LoginBackground />

      <div className="w-full max-w-sm z-10">
        {/* Login Header */}
        <LoginHeader />

        {/* Login Form */}
        <LoginForm
          email={email}
          password={password}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
}