// لا توجد تعديلات مطلوبة هنا - The file remains unchanged
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useParams, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { fadeInVariants, slideUpOverlayVariants } from '../../lib/animations';
import { SubServicesContent } from './SubServicesContent';
import { SubService } from './SubServicesPage';

export const SubServicesOverlay = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const { groupPage, servicePage } = useParams<{ groupPage: string, servicePage: string }>();
    const navigate = useNavigate();
    const { language } = useLanguage();
    
    const [mainServiceTitle, setMainServiceTitle] = useState('');

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !servicePage) return;
        
        const mainServiceQuery = query(collection(db, "services"), where("page", "==", servicePage), limit(1));
        const unsubMainService = onSnapshot(mainServiceQuery, (mainServiceSnapshot) => {
            if (!mainServiceSnapshot.empty) {
                const mainServiceData = mainServiceSnapshot.docs[0].data();
                setMainServiceTitle(language === 'ar' ? mainServiceData.label_ar : mainServiceData.label_en);
            }
        });

        return () => {
            unsubMainService();
        };
    }, [isOpen, servicePage, language]);
    
    const handleCardClick = (subService: SubService) => {
        onClose();
        if (subService.page && groupPage && servicePage) {
            navigate(`/${groupPage}/${servicePage}/${subService.page}`);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose}>
                    <motion.div 
                        variants={slideUpOverlayVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 120, damping: 20 }} 
                        className="bg-black/20 backdrop-blur-sm border-t border-white/10 w-full h-full shadow-lg flex flex-col p-4 sm:p-6" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4 flex-shrink-0">
                            <h2 className="text-2xl font-bold text-white">{mainServiceTitle || '...'}</h2>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><X className="text-white" /></button>
                        </div>
                        <div className="flex-grow min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                            {servicePage && <SubServicesContent servicePage={servicePage} onCardClick={handleCardClick} />}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};