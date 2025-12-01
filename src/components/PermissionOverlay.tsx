import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { fadeInVariants, scaleInModalVariants } from '../lib/animations';

interface PermissionOverlayProps {
    isOpen: boolean;
    serviceName?: string | null;
    serviceType?: 'service' | 'page' | null;
}

const PermissionOverlay: React.FC<PermissionOverlayProps> = ({ isOpen, serviceName, serviceType }) => {
    const { language } = useLanguage();

    const translations = {
        ar: {
            title: "تم تقييد الوصول",
            messageService: `لقد تم إلغاء صلاحيتك للوصول إلى خدمة "${serviceName}".`,
            messagePage: `لقد تم إلغاء صلاحيتك للوصول إلى صفحة "${serviceName}".`,
            defaultMessage: "لقد تم إلغاء صلاحيتك للوصول إلى هذه الصفحة.",
            reassurance: "ستختفي هذه الرسالة عند استعادة الصلاحية."
        },
        en: {
            title: "Access Restricted",
            messageService: `Your permission to access the "${serviceName}" service has been revoked.`,
            messagePage: `Your permission to access the "${serviceName}" page has been revoked.`,
            defaultMessage: "Your permission to access this page has been revoked.",
            reassurance: "This message will disappear once permission is restored."
        }
    };

    const t = translations[language];

    const message = useMemo(() => {
        if (!serviceName) return t.defaultMessage;
        if (serviceType === 'service') return t.messageService;
        if (serviceType === 'page') return t.messagePage;
        return t.defaultMessage;
    }, [serviceName, serviceType, t]);
    
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    variants={fadeInVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
                >
                    <motion.div
                        variants={scaleInModalVariants}
                        className="bg-gray-800/50 border border-gray-700 rounded-xl shadow-lg p-8 max-w-md w-full text-center"
                    >
                        <ShieldAlert className="mx-auto h-16 w-16 text-red-500 mb-4" />
                        <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
                        <p className="text-gray-300">{message}</p>
                        <p className="text-gray-500 text-sm mt-4">{t.reassurance}</p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PermissionOverlay;