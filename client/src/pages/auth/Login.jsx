import React from 'react';
import useAuth from '../../hooks/useAuth';
import LoginBackground from '../../components/Background/LoginBackground';
import LoginHeader from '../../components/Header/LoginHeader';
import LoginForm from '../../components/Form/LoginForm';

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
      <LoginBackground />

      <div className="w-full max-w-md z-10">
        <LoginHeader />
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