// src/components/home/ServiceCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react'; // أيقونة النجمة للمفضلات

// تعريف نوع البيانات للخدمة لضمان سلامة الأنواع
export interface Service {
  id: number;
  label_ar: string;
  label_en: string;
  icon?: string; // أيقونة اختيارية
}

interface ServiceCardProps {
  service: Service;
  language: 'ar' | 'en';
  isFavorite: boolean;
  onToggleFavorite: (serviceId: number) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, language, isFavorite, onToggleFavorite }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative bg-gray-800 rounded-lg p-4 flex flex-col items-center justify-center text-center aspect-square cursor-pointer hover:bg-gray-700 transition-colors duration-200"
    >
      {/* أيقونة الخدمة (يمكنك استخدام مكتبة أيقونات هنا) */}
      <div className="text-4xl mb-2 text-[#FFD700]">
        {/* Placeholder for icon, you can use a library like lucide-react */}
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
      </div>
      <h3 className="font-semibold text-white">
        {language === 'ar' ? service.label_ar : service.label_en}
      </h3>
      
      {/* زر إضافة/إزالة من المفضلات */}
      <button
        onClick={(e) => {
          e.stopPropagation(); // منع انتقال النقر إلى البطاقة نفسها
          onToggleFavorite(service.id);
        }}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-600 transition-colors"
        aria-label="Toggle Favorite"
      >
        <Star
          size={20}
          className={isFavorite ? 'text-yellow-400 fill-current' : 'text-gray-500'}
        />
      </button>
    </motion.div>
  );
};
