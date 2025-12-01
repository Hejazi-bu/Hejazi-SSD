import React, { useState } from 'react';
import { Lock, LogOut, LoaderCircle, Languages, UserX } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth, LockState } from './contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useDialog } from './contexts/DialogContext';
import { staggeredContainerVariants, staggeredItemVariants, fadeInVariants } from '../lib/animations';

const translations = {
    ar: {
        GLOBAL: {
            title: "النظام قيد الصيانة حاليًا",
            message: "نحن نعمل حاليًا على إجراء تحسينات وتحديثات لضمان أفضل أداء للنظام. شكرًا لتفهمكم وصبركم.",
            reassurance: "ملاحظة: في حال انتهاء أعمال الصيانة، سيتم تحديث الصفحة تلقائيًا للعودة إلى النظام.",
        },
        PERMISSIONS: {
            title: "تم تقييد الوصول",
            message: "تم تقييد وصولك إلى النظام حاليًا. يرجى التواصل مع مسؤول النظام أو الدعم الفني لمزيد من المعلومات.",
            reassurance: "ملاحظة: بمجرد إعادة صلاحية الوصول، سيتم تحديث هذه الصفحة تلقائيًا.",
        },
        common: {
            greeting: "نأسف، السيد",
            logoutButton: "تسجيل الخروج",
            signingOut: "جارٍ تسجيل الخروج...",
            languageButton: "English",
            confirmLogoutTitle: "تأكيد تسجيل الخروج",
            confirmLogoutMessage: "هل أنت متأكد من رغبتك في تسجيل الخروج؟",
        }
    },
    en: {
        GLOBAL: {
            title: "System Currently Under Maintenance",
            message: "We are currently performing enhancements and updates to ensure optimal system performance. Thank you for your understanding and patience.",
            reassurance: "Note: Should maintenance conclude, the page will automatically refresh to return you to the system.",
        },
        PERMISSIONS: {
            title: "Access Restricted",
            message: "Your access to the system is currently restricted. Please contact your system administrator or technical support for more information.",
            reassurance: "Note: Once your access is restored, this page will automatically update.",
        },
        common: {
            greeting: "We apologize, Mr.",
            logoutButton: "Sign Out",
            signingOut: "Signing Out...",
            languageButton: "العربية",
            confirmLogoutTitle: "Confirm Sign Out",
            confirmLogoutMessage: "Are you sure you want to sign out?",
        }
    }
};

const AppLockedScreen = ({ reason }: { reason: LockState }) => {
    const { language, setLanguage } = useLanguage();
    const { user, signOut } = useAuth();
    const { showDialog } = useDialog(); // ✅ استخدامك له مثالي
    const [isSigningOut, setIsSigningOut] = useState(false);
    
    const t = translations[language];
    const lockMessages = reason === 'GLOBAL' ? t.GLOBAL : t.PERMISSIONS;
    const t_common = t.common;

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try { await signOut(); } 
        catch (error) { setIsSigningOut(false); }
    };

    const handleConfirmSignOut = () => {
        showDialog({
            variant: 'confirm',
            title: t_common.confirmLogoutTitle,
            message: t_common.confirmLogoutMessage,
            onConfirm: () => { handleSignOut(); }, // ✅ التعديل هنا
        });
    };

    const handleLanguageToggle = () => setLanguage(prev => (prev === 'ar' ? 'en' : 'ar'));
    const userName = language === 'ar' ? user?.name_ar : user?.name_en;

    const Icon = reason === 'GLOBAL' ? Lock : UserX;
    const iconColor = reason === 'GLOBAL' ? 'text-yellow-400' : 'text-red-400';

    return (
        // ✨ 1. إضافة حركة ظهور تدريجي للصفحة بأكملها
        <motion.div
            variants={fadeInVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-[#0D1B2A] flex flex-col items-center justify-start sm:justify-center text-white z-[9999] p-4 py-16 sm:py-4 overflow-y-auto" 
            dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
            <div className="absolute top-4 sm:top-6 ltr:right-4 rtl:left-4 sm:ltr:right-6 sm:rtl:left-6">
                <motion.button onClick={handleLanguageToggle} whileTap={{ scale: 0.95 }} className="flex items-center gap-2 py-2 px-3 bg-gray-800/50 hover:bg-gray-700/70 border border-gray-700 rounded-lg transition-colors text-sm">
                    <Languages size={16} />
                    <AnimatePresence mode="wait"><motion.span key={language} variants={fadeInVariants} initial="initial" animate="animate" exit="exit">{t_common.languageButton}</motion.span></AnimatePresence>
                </motion.button>
            </div>

            <motion.div 
                variants={staggeredContainerVariants} 
                initial="initial" 
                animate="animate" 
                className="bg-gray-900/50 backdrop-blur-lg border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full text-center p-8 sm:p-10"
            >
                {/* ✨ 2. تم توحيد الأنيميشن لجميع العناصر لتكون متتالية */}
                <motion.div variants={staggeredItemVariants} className="mx-auto mb-6 w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/30">
                    <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                        <Icon size={32} className={iconColor} />
                    </motion.div>
                </motion.div>
                
                <motion.div variants={staggeredItemVariants}>
                    <AnimatePresence mode="wait"><motion.h1 key={`title-${language}`} variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="text-2xl sm:text-3xl font-bold mb-3 text-gray-100">{lockMessages.title}</motion.h1></AnimatePresence>
                </motion.div>

                {userName && (
                    <motion.div variants={staggeredItemVariants}>
                        <AnimatePresence mode="wait"><motion.p key={`greeting-${language}`} variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="text-lg text-gray-400 mb-4">{t_common.greeting} {userName}</motion.p></AnimatePresence>
                    </motion.div>
                )}

                <motion.div variants={staggeredItemVariants}>
                    <AnimatePresence mode="wait"><motion.p key={`message-${language}`} variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="text-base text-gray-300 leading-relaxed mb-6">{lockMessages.message}</motion.p></AnimatePresence>
                </motion.div>

                <motion.div variants={staggeredItemVariants} className="text-xs text-gray-500 mb-8 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <AnimatePresence mode="wait"><motion.p key={`reassurance-${language}`} variants={fadeInVariants} initial="initial" animate="animate" exit="exit">{lockMessages.reassurance}</motion.p></AnimatePresence>
                </motion.div>

                <motion.div variants={staggeredItemVariants}>
                    <motion.button whileTap={{ scale: 0.98 }} onClick={handleConfirmSignOut} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900">
                        {isSigningOut ? <LoaderCircle className="animate-spin" size={20} /> : <LogOut size={20} />}
                        <AnimatePresence mode="wait"><motion.span key={`btn-text-${language}`} variants={fadeInVariants} initial="initial" animate="animate" exit="exit">{isSigningOut ? t_common.signingOut : t_common.logoutButton}</motion.span></AnimatePresence>
                    </motion.button>
                </motion.div>
            </motion.div>
        </motion.div>
    );
};
export default AppLockedScreen;