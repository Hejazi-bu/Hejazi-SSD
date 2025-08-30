import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Star, ArrowRight } from 'lucide-react';
import DynamicIcon from './DynamicIcon';

export interface Service {
  id: number;
  label_ar: string;
  label_en: string;
  icon: string | null;
}

interface ServiceCardProps {
  service: Service;
  language: 'ar' | 'en';
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
}

const cardContentVariants: Variants = {
  rest: { y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } },
  hover: { y: -25, transition: { type: 'spring', stiffness: 200, damping: 20 } },
};

const openButtonVariants: Variants = {
  rest: { opacity: 0, y: 10, transition: { duration: 0.2 } },
  hover: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20, delay: 0.1 } },
};

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, language, isFavorite, onToggleFavorite }) => {
  const label = language === 'ar' ? service.label_ar : service.label_en;
  const [isActivating, setIsActivating] = useState(false);

  const handleCardClick = () => {
    setIsActivating(true);
    // في تطبيق حقيقي، سيتم استدعاء دالة التنقل هنا بعد انتهاء الأنيميشن
    // setTimeout(() => navigate(`/service/${service.id}`), 600);
  };

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1 } }}
      layout
      initial="rest"
      whileHover="hover"
      animate="rest"
      onClick={handleCardClick}
      whileTap={{ scale: 0.95, transition: { type: 'spring', stiffness: 400, damping: 17 } }}
      className="relative group rounded-xl p-4 flex flex-col items-center justify-center text-center aspect-square cursor-pointer overflow-hidden border border-white/10 bg-gray-900/40 backdrop-blur-sm"
    >
      {/* الإطار المتوهج عند التمرير */}
      <div className="absolute -inset-px rounded-xl border-2 border-transparent group-hover:border-yellow-400/50 transition-all duration-300 group-hover:shadow-[0_0_15px_rgba(255,215,0,0.4)]"></div>
      
      {/* زر المفضلة والأنيميشن الخاص به */}
      <motion.button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(service.id); }}
        className="absolute top-2 right-2 p-1 z-30"
        aria-label="Toggle Favorite"
        whileTap={{ scale: [1, 1.4, 0.9, 1.15, 1], rotate: [0, 15, -15, 15, 0], transition: { duration: 0.4 } }}
        animate={{ opacity: isActivating ? 0 : 1 }}
      >
        <motion.div whileHover={{ scale: 1.25, filter: 'drop-shadow(0 0 5px #FFD700)' }}>
          <Star
            className={`transition-all duration-300 ${isFavorite ? 'text-yellow-400 fill-current' : 'text-gray-500 group-hover:text-yellow-400'}`}
            size={20}
          />
        </motion.div>
      </motion.button>
      
      {/* أنيميشن التفعيل (نبضة الطاقة) */}
      <AnimatePresence>
        {isActivating && (
          <motion.div
            className="absolute inset-0 rounded-xl bg-yellow-400"
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            onAnimationComplete={() => setIsActivating(false)} // إعادة التعيين للعرض
          />
        )}
      </AnimatePresence>

      {/* المحتوى الرئيسي المتحرك */}
      <motion.div 
        variants={cardContentVariants}
        className="relative z-20 flex flex-col items-center justify-center h-full"
        animate={{ scale: isActivating ? 0 : 1, opacity: isActivating ? 0 : 1 }}
        transition={{ duration: 0.3 }}
      >
        <DynamicIcon name={service.icon} className="w-12 h-12 mb-3 text-[#FFD700]" />
        <p className="text-white text-base font-bold">{label}</p>
      </motion.div>
      
      {/* زر "تشغيل" */}
      <motion.div 
        variants={openButtonVariants}
        className="absolute bottom-6 left-0 right-0 z-20 text-center"
        animate={{ opacity: isActivating ? 0 : undefined }}
      >
        <div className="inline-flex items-center text-sm font-semibold text-yellow-400 bg-black/30 px-3 py-1 rounded-full">
          <span>{language === 'ar' ? 'تشغيل' : 'Launch'}</span>
          <ArrowRight size={16} className={`transition-transform duration-300 group-hover:translate-x-1 ${language === 'ar' ? 'mr-1' : 'ml-1'}`} />
        </div>
      </motion.div>
    </motion.div>
  );
};

