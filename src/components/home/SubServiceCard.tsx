import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, Variants } from 'framer-motion';
import { Star, AppWindow } from 'lucide-react';
import DynamicIcon from './DynamicIcon';
import { Link, useParams } from 'react-router-dom';
import { useDialog } from '../contexts/DialogContext';
import { SubService } from './SubServicesPage';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/UserContext'; // ✅ استيراد useAuth

export interface SubServiceCardProps {
    subService: SubService;
    isFavorite: boolean;
    onToggleFavorite: (id: string) => void;
    onClick?: () => void;
    isActive?: boolean;
}

const starVariants: Variants = {
    initial: { scale: 1, rotate: 0 },
    favorite: { scale: [1, 1.3, 1], rotate: 360, transition: { duration: 0.4, ease: "easeOut" } }
};

export const SubServiceCard: React.FC<SubServiceCardProps> = ({ subService, isFavorite, onToggleFavorite, onClick, isActive }) => {
    const { groupPage, servicePage } = useParams();
    const { showDialog } = useDialog();
    const { language } = useLanguage();
    const { hasPermission } = useAuth(); // ✅ جلب hasPermission
    const label = language === 'ar' ? subService.label_ar : subService.label_en;
    const ref = useRef<HTMLAnchorElement>(null);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const rotateX = useTransform(mouseY, [-150, 150], [10, -10]);
    const rotateY = useTransform(mouseX, [-150, 150], [-10, 10]);
    const itemTranslateX = useTransform(mouseX, [-150, 150], [-5, 5]);
    const itemTranslateY = useTransform(mouseY, [-150, 150], [-5, 5]);

    const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        if (!ref.current) return;
        const { left, top, width, height } = ref.current.getBoundingClientRect();
        mouseX.set(e.clientX - (left + width / 2));
        mouseY.set(e.clientY - (top + height / 2));
    };

    const handleMouseLeave = () => { mouseX.set(0); mouseY.set(0); };

    const handleCardClick = (e: React.MouseEvent) => {
        if (onClick) {
            onClick();
            return;
        }
        
        // ✅ تحديث منطق التحقق من الصلاحية
        const canAccess = hasPermission(`ss:${subService.id}`);

        if (!canAccess || !subService.page) {
            e.preventDefault();
            const dialogTitle = !canAccess ? (language === 'ar' ? "وصول مرفوض" : "Access Denied") : (language === 'ar' ? "خدمة غير متاحة" : "Service Unavailable");
            const dialogMessage = !canAccess ? (language === 'ar' ? "ليس لديك الصلاحية للوصول لهذه الخدمة." : "You do not have permission to access this service.") : (language === 'ar' ? "هذه الخدمة قيد التطوير حاليًا." : "This service is currently under development.");
            showDialog({ variant: 'alert', title: dialogTitle, message: dialogMessage });
        }
    };
    
    return (
        <motion.div layout>
            <Link
                to={subService.page ? `/${groupPage}/${servicePage}/${subService.page}` : '#'}
                ref={ref}
                onClick={handleCardClick}
                className="crystalline-card-container block"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <motion.div 
                    className={`crystalline-card ${isActive ? 'active-service-glow' : ''}`}
                    style={{ rotateX, rotateY }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                >
                    <div className="card-face card-front">
                        <motion.div className="absolute inset-0 pointer-events-none" style={{ background: useTransform([mouseX, mouseY], (latest: number[]) => `radial-gradient(at ${latest[0] + 150}px ${latest[1] + 150}px, rgba(255, 215, 0, 0.25) 0px, transparent 60%)`), opacity: useTransform(mouseX, [-150, 150], [0, 1]) }} />
                        <motion.div className="absolute inset-0 opacity-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(255, 215, 0, 0.15) 0%, transparent 70%)' }} whileHover={{ opacity: 1 }} whileTap={{ opacity: 1, scale: 1.2 }} transition={{ duration: 0.4, ease: 'easeOut' }} />
                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(subService.id); }} className="absolute top-0 right-0 z-30 h-16 w-16 cursor-pointer">
                            <motion.div className="flex h-full w-full items-center justify-center" whileHover={{ scale: 1.2 }} whileTap={{ scale: [1, 0.7, 1.4, 1], rotate: [0, -15, 15, 0] }} variants={starVariants} animate={isFavorite ? "favorite" : "initial"} >
                                <Star size={28} className={`transition-colors duration-200 pointer-events-none ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'}`} style={{ filter: isFavorite ? 'drop-shadow(0 0 5px rgba(250, 204, 21, 0.7))' : 'none' }} />
                            </motion.div>
                        </div>
                        <motion.div className="relative z-10 flex flex-col items-center justify-center h-full p-2" style={{ x: itemTranslateX, y: itemTranslateY }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
                            <motion.div className="p-3 bg-black/20 rounded-full mb-3 shadow-lg" whileHover={{ scale: 1.1 }}>
                                {subService.icon ? (
                                    <DynamicIcon name={subService.icon} className="w-10 h-10 text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]" />
                                ) : (
                                    <AppWindow className="w-10 h-10 text-gray-500" />
                                )}
                            </motion.div>
                            <p className="text-white text-sm sm:text-base font-bold text-shadow text-center">{label}</p>
                        </motion.div>
                    </div>
                </motion.div>
            </Link>
        </motion.div>
    );
};