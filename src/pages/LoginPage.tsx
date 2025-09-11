// src/pages/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LoginForm } from '../components/LogIn/LoginForm';

export const LoginPage = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Simulate loading data, then hide the splash screen
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000); // Show splash for 2 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-[#0D1B2A] overflow-hidden">
      <AnimatePresence>
        <LoginForm key="login" />
      </AnimatePresence>
    </div>
  );
};