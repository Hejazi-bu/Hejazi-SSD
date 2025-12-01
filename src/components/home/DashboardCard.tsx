// C:\Users\user\Music\hejazi-logic\src\components\home\DashboardCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { interactiveItemVariants } from '../../lib/animations'; 

interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  isInteractive?: boolean; // ✨ 1. إضافة الخاصية الجديدة
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ 
  title, 
  children, 
  className = '', 
  isInteractive = true // ✨ 2. القيمة الافتراضية هي "تفاعلي"
}) => {
  return (
    <motion.div
      // ✨ 3. تطبيق الأنيميشن فقط إذا كانت الخاصية "true"
      variants={isInteractive ? interactiveItemVariants : undefined}
      whileHover={isInteractive ? "hover" : undefined}
      whileTap={isInteractive ? "tap" : undefined}
      className={`bg-gray-800/50 border border-gray-700 rounded-xl shadow-lg p-4 sm:p-6 h-full ${className}`}
    >
      <h3 className="text-lg font-semibold text-gray-300 mb-4">{title}</h3>
      <div>{children}</div>
    </motion.div>
  );
};