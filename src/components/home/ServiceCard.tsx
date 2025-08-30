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
  rest: { y: 0 },
  hover: { y: -20 },
};

const openButtonVariants: Variants = {
  rest: { opacity: 0, y: 10, transition: { duration: 0.2, ease: 'easeOut' } },
  hover: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 250, damping: 20, delay: 0.1 } },
};

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, language, isFavorite, onToggleFavorite }) => {
  const label = language === 'ar' ? service.label_ar : service.label_en;
  const [ripple, setRipple] = useState<{ x: number; y: number; size: number } | null>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    event.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    event.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };
  
  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    setRipple({ x, y, size });
    
    // في تطبيق حقيقي، سيتم استدعاء دالة التنقل هنا
    // setTimeout(() => navigate(`/service/${service.id}`), 400);
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, scale: 0.7, filter: 'blur(10px)' },
        visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
      }}
      layout
      initial="rest"
      whileHover="hover"
      animate="rest"
      onClick={handleCardClick}
      onMouseMove={handleMouseMove}
      className="crystalline-card relative group rounded-xl p-4 flex flex-col items-center justify-center text-center aspect-square cursor-pointer overflow-hidden"
    >
      {/* الخلفية والإضاءة المحيطية */}
      <div className="crystalline-bg"></div>
      <div className="spotlight"></div>
      
      {/* تأثير التموج عند النقر */}
      <AnimatePresence>
        {ripple && (
          <motion.div
            className="ripple"
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ top: ripple.y, left: ripple.x, width: ripple.size, height: ripple.size }}
            onAnimationComplete={() => setRipple(null)}
          />
        )}
      </AnimatePresence>

      {/* زر المفضلة والأنيميشن الخاص به */}
      <motion.button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(service.id); }}
        className="absolute top-2 right-2 p-1 z-30"
        aria-label="Toggle Favorite"
        whileTap={{ scale: [1, 0.8, 1.3, 1], rotate: [0, 0, 180, 0], transition: { duration: 0.4 } }}
      >
        <motion.div whileHover={{ scale: 1.25, filter: 'drop-shadow(0 0 5px #FFD700)' }}>
          <Star
            className={`transition-all duration-300 ${isFavorite ? 'text-yellow-400 fill-current' : 'text-gray-500 group-hover:text-yellow-400'}`}
            size={20}
          />
        </motion.div>
      </motion.button>
      
      {/* المحتوى الرئيسي المتحرك */}
      <motion.div 
        variants={cardContentVariants}
        transition={{ type: 'spring', stiffness: 250, damping: 20 }}
        className="relative z-20 flex flex-col items-center justify-center h-full"
      >
        <DynamicIcon name={service.icon} className="w-12 h-12 mb-3 text-[#FFD700] icon-glow" />
        <p className="text-white text-base font-bold">{label}</p>
      </motion.div>
      
      {/* زر "تشغيل" */}
      <motion.div 
        variants={openButtonVariants}
        className="absolute bottom-6 left-0 right-0 z-20 text-center"
      >
        <div className="inline-flex items-center text-sm font-semibold text-yellow-400 bg-black/30 px-3 py-1 rounded-full">
          <span>{language === 'ar' ? 'تشغيل' : 'Launch'}</span>
          <ArrowRight size={16} className={`transition-transform duration-300 group-hover:translate-x-1 ${language === 'ar' ? 'mr-1' : 'ml-1'}`} />
        </div>
      </motion.div>
    </motion.div>
  );
};

