import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Star, LoaderCircle } from 'lucide-react';
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

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, language, isFavorite, onToggleFavorite }) => {
  const [isFlipping, setIsFlipping] = useState(false);
  const label = language === 'ar' ? service.label_ar : service.label_en;
  const t = {
    ar: { opening: "جاري الفتح..." },
    en: { opening: "Opening..." },
  }[language];

  const handleCardClick = () => {
    setIsFlipping(true);
    // في تطبيق حقيقي، سيتم استدعاء دالة التنقل هنا بعد انتهاء الأنيميشن
    // setTimeout(() => navigate(`/service/${service.id}`), 1500);
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
  };

  return (
    <motion.div
      variants={cardVariants}
      layout
      className="crystalline-card-container"
      onClick={handleCardClick}
    >
      <motion.div
        className="crystalline-card"
        animate={{ rotateY: isFlipping ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 15 }}
        whileHover={{ y: -10, scale: 1.03, transition: { type: 'spring', stiffness: 200, damping: 15 } }}
        whileTap={{ scale: 0.98 }}
      >
        {/* الوجه الأمامي للبطاقة */}
        <AnimatePresence>
          {!isFlipping && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="card-face card-front"
            >
              <div className="aurora-bg"></div>
              <motion.button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(service.id); }}
                className="absolute top-2 right-2 p-1 z-30"
                aria-label="Toggle Favorite"
                whileTap={{ scale: [1, 0.7, 1.4, 1], rotate: [0, -15, 15, 0], transition: { duration: 0.5, ease: "circOut" } }}
                whileHover={{ scale: 1.2, transition: { type: 'spring', stiffness: 300 } }}
              >
                  <Star
                    className={`transition-all duration-300 ${isFavorite ? 'text-yellow-400 fill-current' : 'text-gray-500 group-hover:text-yellow-400'}`}
                    size={20}
                  />
              </motion.button>
              
              <div className="relative z-10 flex flex-col items-center justify-center h-full">
                <motion.div 
                    className="p-3 bg-black/20 rounded-full mb-3 shadow-lg"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                >
                  <DynamicIcon name={service.icon} className="w-10 h-10 text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]" />
                </motion.div>
                <p className="text-white text-base font-bold text-shadow">{label}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* الوجه الخلفي للبطاقة (جاري الفتح) */}
        <AnimatePresence>
          {isFlipping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="card-face card-back"
            >
              <div className="aurora-bg"></div>
              <div className="relative z-10 flex flex-col items-center justify-center h-full text-white">
                <LoaderCircle className="animate-spin mb-3" size={40} />
                <p className="font-semibold">{t.opening}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

