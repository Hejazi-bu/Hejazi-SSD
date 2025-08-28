// src/components/LogIn/SplashScreen.tsx
import React from 'react';
import { motion } from 'framer-motion';

// --- التعديل هنا ---
// قمنا بتحديث المسار ليشير إلى شعارك الجديد
const logoUrl = '/assets/Hejazi.png'; 

export const SplashScreen = () => {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-[#0D1B2A]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.img
        src={logoUrl}
        alt="شعار شركة حجازي"
        className="w-32 h-32 md:w-40 md:h-40" // يمكنك تعديل الحجم حسب أبعاد شعارك
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.2, type: 'spring' }}
      />
    </motion.div>
  );
};