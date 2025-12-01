import React from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // لا حاجة لاستيراد Variants
import { useActionLoading } from './contexts/ActionLoadingContext';
import { useConnectivity } from './contexts/ConnectivityContext';
import { useLanguage } from './contexts/LanguageContext';
import { WifiOff, LoaderCircle } from 'lucide-react';

// ===============================================================
// المكونات البصرية (تم إضافة as const)
// ===============================================================

const LogoAnimator = () => {
    const breathingVariants = {
        animate: {
            scale: [1, 1.04, 1],
            // ✨ استخدام as const
            transition: { duration: 4, ease: "easeInOut" as const, repeat: Infinity },
        },
    };
    const softGlowVariants = {
         animate: {
            scale: [1, 1.1, 1],
            opacity: [0.6, 0.8, 0.6],
            // ✨ استخدام as const
            transition: { duration: 4, ease: "easeInOut" as const, repeat: Infinity },
        },
     };
    const scanlineVariants = {
         animate: {
            y: ['-10%', '110%'],
             // ✨ استخدام as const
            transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' as const, delay: 0.5 },
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

const SystemIndicator = () => {
    return (
        <div className="w-24 h-24 relative" style={{ transformStyle: 'preserve-3d', perspective: '800px' }}>
             <motion.div
                className="absolute inset-0 border-2 border-yellow-400/80 rounded-full"
                animate={{ rotateY: 360 }}
                // ✨ استخدام as const
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' as const }}
            />
            <motion.div
                className="absolute inset-2 border-2 border-blue-300/70 rounded-full"
                animate={{ rotateX: 360 }}
                 // ✨ استخدام as const
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' as const }}
            />
            <motion.div
                className="absolute inset-4 border-2 border-yellow-500/60 rounded-full"
                animate={{ rotateY: -360, rotateX: 360 }}
                 // ✨ استخدام as const
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' as const }}
            />
        </div>
    );
};


// ===============================================================
// المكون الرئيسي المُحدّث (تم إضافة as const)
// ===============================================================
const ActionLoadingOverlay = () => {
    const { isActionLoading, actionMessage } = useActionLoading();
    const { isOnline, isChecking } = useConnectivity();
    const { language } = useLanguage();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.3, when: "beforeChildren" as const, staggerChildren: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.3 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        // ✨ استخدام as const
        visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } },
        exit: { opacity: 0, y: -15 },
    };

    let statusContent;
    if (isOnline) {
        statusContent = ( <p className="text-lg text-gray-200 tracking-wider"> {actionMessage}... </p> );
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
                    {language === 'ar' ? 'لا يوجد اتصال بالإنترنت. تعذر إكمال الإجراء.' : 'No Internet Connection. Action failed.'}
                </span>
            </div>
        );
    }


    return (
        <AnimatePresence>
            {isActionLoading && (
                <motion.div
                    key="action-loading-overlay"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={containerVariants}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm font-sans"
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
                                    key={isOnline ? 'online-action' : (isChecking ? 'checking-action' : 'offline-action')}
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

export default ActionLoadingOverlay;