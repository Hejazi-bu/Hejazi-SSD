// src/components/home/ServiceCard.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Star, LoaderCircle } from 'lucide-react';
import DynamicIcon from './DynamicIcon';
import { useNavigate } from 'react-router-dom';
// تم حذف db
// import { db } from '../../lib/supabaseClient';
import { useAuth } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';

export interface Service {
    id: number;
    label_ar: string;
    label_en: string;
    icon: string | null;
    is_allowed: boolean; // خاصية مهمة لفحص الخدمة الرئيسية
}

interface ServiceCardProps {
    service: Service;
    language: 'ar' | 'en';
    isFavorite: boolean;
    onToggleFavorite: (id: number) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, language, isFavorite, onToggleFavorite }) => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const label = language === 'ar' ? service.label_ar : service.label_en;
    const t = {
        ar: {
            opening: "جاري الفحص...",
            service_disabled: "هذه الخدمة متوقفة حالياً.",
            no_permission_service: "ليس لديك صلاحية الوصول لهذه الخدمة.",
            no_sub_services: "لا توجد خدمات فرعية متاحة حالياً.",
            all_sub_services_disabled: "جميع الخدمات الفرعية لهذه الفئة متوقفة.",
            no_permission_sub_service: "لا توجد لديك صلاحية للوصول إلى أي من الخدمات هنا.",
            error_fetching: "حدث خطأ أثناء جلب البيانات."
        },
        en: {
            opening: "Checking...",
            service_disabled: "This service is currently disabled.",
            no_permission_service: "You do not have permission to access this service.",
            no_sub_services: "No sub-services are available at the moment.",
            all_sub_services_disabled: "All sub-services in this category are currently disabled.",
            no_permission_sub_service: "You do not have permission to access any services here.",
            error_fetching: "An error occurred while fetching data."
        },
    }[language];

    const handleCardClick = async () => {
        setIsLoading(true);

        // 1. فحص الخدمة الرئيسية
        if (!service.is_allowed) {
            alert(t.service_disabled);
            setIsLoading(false);
            return;
        }

        // 2. فحص صلاحية المستخدم على الخدمة الرئيسية
        if (!hasPermission(`s:${service.id}`)) {
            alert(t.no_permission_service);
            setIsLoading(false);
            return;
        }

        try {
            // ✅ استبدال الاستعلام المباشر باستدعاء نقطة النهاية في الخادم
            const response = await fetch(`http://localhost:3001/api/services/${service.id}/sub-services`);
            const data = await response.json();

            if (!data.success) {
                alert(t.error_fetching);
                setIsLoading(false);
                return;
            }

            const subServices = data.subServices;

            if (!subServices || subServices.length === 0) {
                alert(t.no_sub_services);
                setIsLoading(false);
                return;
            }

            const activeSubServices = subServices.filter((ss: any) => ss.is_allowed);
            if (activeSubServices.length === 0) {
                alert(t.all_sub_services_disabled);
                setIsLoading(false);
                return;
            }

            const permittedSubServices = activeSubServices.filter((ss: any) => hasPermission(`ss:${ss.id}`));
            if (permittedSubServices.length === 0) {
                alert(t.no_permission_sub_service);
                setIsLoading(false);
                return;
            }

            // 5. التوجيه لأول صفحة متاحة
            const firstPermittedPage = permittedSubServices[0].page;
            if (firstPermittedPage) {
                setTimeout(() => navigate(firstPermittedPage), 800);
            } else {
                console.error("Permitted sub-service has no page link:", permittedSubServices[0]);
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Error fetching sub-services:", error);
            alert(t.error_fetching);
        } finally {
            setIsLoading(false);
        }
    };

    const cardVariants: Variants = {
        hidden: { opacity: 0, scale: 0.8 },
        visible: { opacity: 1, scale: 1 },
    };

    return (
        <motion.div variants={cardVariants} layout className="crystalline-card-container" onClick={handleCardClick}>
            <motion.div className="crystalline-card" whileHover={{ y: -10, scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <AnimatePresence>
                    {!isLoading ? (
                        <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="card-face card-front">
                            <div className="aurora-bg"></div>
                            <motion.button onClick={(e) => { e.stopPropagation(); onToggleFavorite(service.id); }} className="absolute top-2 right-2 p-1 z-30" whileTap={{ scale: [1, 0.7, 1.4, 1], rotate: [0, -15, 15, 0] }} whileHover={{ scale: 1.2 }}>
                                <Star className={`transition-all duration-300 ${isFavorite ? 'text-yellow-400 fill-current' : 'text-gray-500'}`} size={20} />
                            </motion.button>
                            <div className="relative z-10 flex flex-col items-center justify-center h-full">
                                <motion.div className="p-3 bg-black/20 rounded-full mb-3 shadow-lg" whileHover={{ scale: 1.1 }}>
                                    <DynamicIcon name={service.icon} className="w-10 h-10 text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]" />
                                </motion.div>
                                <p className="text-white text-base font-bold text-shadow text-center">{label}</p>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card-face card-back">
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