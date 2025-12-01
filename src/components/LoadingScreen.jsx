import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // ✨ تم إزالة Variants من هنا
import { useLanguage } from './contexts/LanguageContext';
import { useConnectivity } from './contexts/ConnectivityContext';
import { WifiOff, LoaderCircle } from 'lucide-react';

// ===================================================================
// 1. ✨ أنيميشن الشعار الاحترافي (تم إزالة Variants)
// ===================================================================
const LogoAnimator = () => {
    // ✨ تم إزالة Variants من هنا
    const breathingVariants = {
        animate: {
            scale: [1, 1.04, 1],
            transition: { duration: 4, ease: "easeInOut", repeat: Infinity },
        },
    };
    const softGlowVariants = {
        animate: {
            scale: [1, 1.1, 1],
            opacity: [0.6, 0.8, 0.6],
            transition: { duration: 4, ease: "easeInOut", repeat: Infinity },
        },
    };
    const scanlineVariants = {
        animate: {
            y: ['-10%', '110%'],
            transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
        },
    };

    return (
        <motion.div className="relative w-48 h-48 flex items-center justify-center">
            <motion.div
                className="absolute inset-0 blur-2xl"
                style={{ background: 'radial-gradient(circle, rgba(255, 215, 0, 0.4) 10%, transparent 70%)' }}
                variants={softGlowVariants}
                animate="animate"
            />
            <motion.img
                src="/favicon/favicon.svg"
                alt="شعار نظام Hejazi SSD"
                className="w-40 h-auto z-10 filter drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]"
                variants={breathingVariants}
                animate="animate"
            />
            <div className="absolute inset-0 w-40 h-40 m-auto overflow-hidden"
                 style={{ maskImage: 'url(/favicon/favicon.svg)', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}>
                <motion.div
                    className="absolute w-full h-1.5"
                    style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.7), transparent)',
                        boxShadow: '0 0 10px #FFD700, 0 0 15px #FFD700',
                    }}
                    variants={scanlineVariants}
                    animate="animate"
                />
            </div>
        </motion.div>
    );
};

// ===================================================================
// 2. ✨ مؤشر نواة النظام (بدون تغيير)
// ===================================================================
const SystemIndicator = () => {
    return (
        <div className="w-24 h-24 relative" style={{ transformStyle: 'preserve-3d', perspective: '800px' }}>
            <motion.div
                className="absolute inset-0 border-2 border-yellow-400/80 rounded-full"
                animate={{ rotateY: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
                className="absolute inset-2 border-2 border-blue-300/70 rounded-full"
                animate={{ rotateX: 360 }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
                className="absolute inset-4 border-2 border-yellow-500/60 rounded-full"
                animate={{ rotateY: -360, rotateX: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
        </div>
    );
};

// ===================================================================
// 3. ✨ نص حالة التحميل الديناميكي (بدون تغيير)
// ===================================================================
const statusMessages = {
    ar: [ "تأمين الاتصال بالخادم...", "تحميل صلاحيات المستخدم...", "تهيئة وحدات الخدمات...", "التحقق من سلامة البيانات...", "تصيير الواجهة الرسومية...", ],
    en: [ "Securing server connection...", "Loading user permissions...", "Initializing service modules...", "Verifying data integrity...", "Rendering graphical interface...", ]
};

const DynamicStatusText = () => {
    const { language } = useLanguage();
    const initialMessage = language === 'ar' ? "بدء تسلسل التجهيز..." : "Initiating setup sequence...";
    const [currentMessage, setCurrentMessage] = useState(initialMessage);

    useEffect(() => {
        const messages = statusMessages[language];
        setCurrentMessage(language === 'ar' ? "بدء تسلسل التجهيز..." : "Initiating setup sequence...");
        let index = 0;
        const interval = setInterval(() => {
            index = (index + 1) % messages.length;
            setCurrentMessage(messages[index]);
        }, 2500);
        return () => clearInterval(interval);
    }, [language]);

    return (
        <motion.p
            key={currentMessage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.5 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="text-lg text-gray-300 tracking-wider"
        >
            {currentMessage}
        </motion.p>
    );
};

// ===================================================================
// 4. ✨ شاشة التحميل النهائية (تم إزالة Variants)
// ===================================================================
const LoadingScreen = ({ show = true }) => {
    const { isOnline, isChecking } = useConnectivity();
    const { language } = useLanguage();

    // ✨ تم إزالة Variants من هنا
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.3, when: "beforeChildren", staggerChildren: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.3 } }
    };

    // ✨ تم إزالة Variants من هنا
    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
        exit: { opacity: 0, y: -15 },
    };

    let statusContent;
    if (isOnline) {
        statusContent = <DynamicStatusText />;
    } else if (isChecking) {
        statusContent = (
            <div className="flex items-center gap-2 text-yellow-400">
                <LoaderCircle size={20} className="animate-spin" />
                <span className="text-lg font-bold tracking-wider">
                    {language === 'ar' ? 'جاري التحقق من الاتصال...' : 'Checking Connection...'}
                </span>
            </div>
        );
    } else { // Offline
        statusContent = (
            <div className="flex items-center gap-2 text-red-400">
                <WifiOff size={20} />
                <span className="text-lg font-bold tracking-wider">
                    {language === 'ar' ? 'لا يوجد اتصال بالإنترنت. جاري المحاولة...' : 'No Internet Connection. Retrying...'}
                </span>
            </div>
        );
    }

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key="loading-screen"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={containerVariants}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1b2a] font-sans"
                >
                    <div className="flex flex-col items-center gap-6">

                        <motion.div variants={itemVariants}>
                            <LogoAnimator />
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <SystemIndicator />
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={isOnline ? 'online' : (isChecking ? 'checking' : 'offline')}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1, transition: { duration: 0.5 } }}
                                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                                >
                                    {statusContent}
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LoadingScreen;