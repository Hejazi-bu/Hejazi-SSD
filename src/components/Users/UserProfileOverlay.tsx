// C:\Users\user\Music\hejazi-logic\src\components\Users\UserProfileOverlay.tsx
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInVariants, slideUpOverlayVariants } from '../../lib/animations';

// ✨ 1. استيراد المكون الموحد
import { UserProfileContent } from './../layouts/UserProfileContent';

interface UserProfileOverlayProps { 
    isOpen: boolean; 
    onClose: () => void; 
}

export const UserProfileOverlay: React.FC<UserProfileOverlayProps> = ({ isOpen, onClose }) => {

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                // ✨ 2. هذا هو الغلاف الخارجي (الخلفية المعتمة)
                <motion.div 
                    variants={fadeInVariants} 
                    initial="initial" 
                    animate="animate" 
                    exit="exit" 
                    className="fixed inset-0 bg-black/50 z-50" 
                    onClick={onClose}
                >
                    {/* ✨ 3. هذا هو غلاف اللوحة المنزلقة */}
                    <motion.div 
                        variants={slideUpOverlayVariants} 
                        initial="initial" 
                        animate="animate" 
                        exit="exit" 
                        transition={{ type: 'spring', stiffness: 120, damping: 20 }} 
                        className="bg-black/20 backdrop-blur-sm border-t border-white/10 w-full h-full shadow-lg flex flex-col" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ✨ 4. عرض المحتوى الموحد مع تحديد أنه نافذة منبثقة */}
                        <UserProfileContent isOverlay={true} onClose={onClose} />

                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};