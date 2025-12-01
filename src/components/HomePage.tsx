// C:\Users\user\Music\hejazi-logic\src\components\HomePage.tsx
import React from 'react';
import { useAuth } from '../components/contexts/UserContext';
import { useLanguage } from '../components/contexts/LanguageContext';
import { motion } from 'framer-motion';
import MainLayout from '../components/layouts/MainLayout';
import { 
    pageTransitionVariants, 
    staggeredContainerVariants, 
    staggeredItemVariants 
} from '../lib/animations';

// ✨ 1. استيراد الويدجت الجديد
import { CompanyEvaluationTrend } from './dashboard/CompanyEvaluationTrend';
// import { PendingTasksWidget } from './dashboard/PendingTasksWidget'; // مثال لويدجت آخر

const HomePage = () => {
    const { user } = useAuth();
    const { language } = useLanguage();
    
    const companyName = language === 'ar' ? user?.company?.name_ar : user?.company?.name_en;
    const welcomeName = language === 'ar' ? user?.name_ar : user?.name_en;

    const translations = {
        ar: {
            welcome: `أهلاً بعودتك، ${welcomeName || ''}`,
            company: `شركة: ${companyName || 'غير محدد'}`,
            dashboardTitle: "الرئيسية"
        },
        en: {
            welcome: `Welcome back, ${welcomeName || ''}`,
            company: `Company: ${companyName || 'Not Assigned'}`,
            dashboardTitle: "Dashboard"
        },
    };

    const t = translations[language as 'ar' | 'en'];

    return (
        <MainLayout pageTitle={t.dashboardTitle} pageIcon="Home">
            <motion.div
                key={language} 
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
            >
                {/* رسالة الترحيب */}
                <motion.div 
                    variants={staggeredContainerVariants}
                    initial="initial"
                    animate="animate"
                    className="mb-8"
                >
                    <motion.h2 variants={staggeredItemVariants} className="text-2xl sm:text-3xl font-bold text-gray-200">{t.welcome}</motion.h2>
                    <motion.p variants={staggeredItemVariants} className="text-md text-gray-400">{t.company}</motion.p>
                </motion.div>

                {/* ✨ 2. عرض الويدجت الجديد */}
                <motion.div 
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                    variants={staggeredContainerVariants}
                    initial="initial"
                    animate="animate"
                >
                    
                    {/* استدعاء الويدجت الجديد */}
                    <CompanyEvaluationTrend />
                    
                    {/* <motion.div variants={staggeredItemVariants}>
                        <PendingTasksWidget />
                    </motion.div> */}
                    
                </motion.div>
            </motion.div>
        </MainLayout>
    );
};

export default HomePage;