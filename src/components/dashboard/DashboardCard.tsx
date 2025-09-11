// src/components/dashboard/DashboardCard.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  delay?: number; // لتأخير ظهور البطاقات بشكل متتالي
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ title, children, className = '', delay = 0 }) => {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay } },
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`bg-gray-800/50 border border-gray-700 rounded-xl shadow-lg p-4 sm:p-6 ${className}`}
    >
      <h3 className="text-lg font-semibold text-gray-300 mb-4">{title}</h3>
      <div>{children}</div>
    </motion.div>
  );
};