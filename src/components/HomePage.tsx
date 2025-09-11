import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/UserContext';
import { useLanguage } from './contexts/LanguageContext';
import { ServicesOverlay } from './home/ServicesOverlay';
import { Header } from './dashboard/Header';
import { DashboardCard } from './dashboard/DashboardCard';
import { AnimatePresence, motion, Variants } from 'framer-motion';
// تم حذف db
// import { db } from '../lib/supabaseClient'; 
import { Navigate } from 'react-router-dom';

const PlaceholderChart = ({ color = '#FFD700' }) => (
    <div className="h-48 bg-gray-700 rounded-md flex items-center justify-center text-gray-500">
        <svg width="80%" height="80%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline fill="none" stroke={color} strokeWidth="2" points="0,50 10,60 20,40 30,70 40,30 50,80 60,20 70,90 80,10 90,95 100,50" />
        </svg>
    </div>
);

const HomePage = () => {
    const { user, hasPermission, permissions, signOut } = useAuth();
    const { language } = useLanguage();
    const [isServicesOpen, setIsServicesOpen] = useState(false);
    const [companyName, setCompanyName] = useState<string | null>(null);
    const [isLoadingCompany, setIsLoadingCompany] = useState(true);

    if (permissions.general_access === false) {
        console.warn("User lacks general_access permission. Signing out and redirecting.");
        signOut();
        return <Navigate to="/login" replace />;
    }

    useEffect(() => {
        const fetchCompanyName = async () => {
            if (!user?.company_id) {
                setIsLoadingCompany(false);
                return;
            }
            setIsLoadingCompany(true);

            try {
                // ✅ استبدال استعلام قاعدة البيانات المباشر باستدعاء نقطة النهاية في الخادم
                const response = await fetch(`http://localhost:3001/api/company/${user.company_id}`);
                const data = await response.json();

                if (data.success) {
                    setCompanyName(language === 'ar' ? data.name_ar : data.name_en);
                } else {
                    console.error("لم يتم العثور على اسم الشركة:", data.message);
                    setCompanyName(null);
                }
            } catch (error) {
                console.error("خطأ في جلب اسم الشركة:", error);
                setCompanyName(null);
            } finally {
                setIsLoadingCompany(false);
            }
        };

        if (user) {
            fetchCompanyName();
        }
    }, [user, language]);

    const welcomeName = language === 'ar' ? user?.name_ar : user?.name_en;

    const translations = {
        ar: {
            welcome: `أهلاً بعودتك، ${welcomeName || ''}`,
            company: `شركة: ${isLoadingCompany ? '...' : companyName || 'غير محدد'}`,
            overview: "نظرة عامة",
            overviewDesc: "ملخص سريع لأهم الإحصائيات.",
            violationsReport: "تقرير المخالفات",
            guardsRating: "تقييم الحراس",
        },
        en: {
            welcome: `Welcome back, ${welcomeName || ''}`,
            company: `Company: ${isLoadingCompany ? '...' : companyName || 'Not Assigned'}`,
            overview: "Overview",
            overviewDesc: "A quick summary of the most important stats.",
            violationsReport: "Violations Report",
            guardsRating: "Guards Rating",
        },
    };

    const t = translations[language];
    const mainContentVariants: Variants = {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeInOut' } },
        exit: { opacity: 0, y: -10, transition: { duration: 0.3, ease: 'easeInOut' } },
    };

    return (
        <div className="bg-[#0D1B2A] min-h-screen text-white flex flex-col">
            <Header onToggleServices={() => setIsServicesOpen(true)} />
            <main className="flex-grow p-4 sm:p-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={language}
                        variants={mainContentVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        <div className="mb-6">
                            <h2 className="text-2xl sm:text-3xl font-bold">{t.welcome}</h2>
                            <p className="text-md text-gray-400">{t.company}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                            <DashboardCard title={t.overview} delay={0.1}>
                                <p className="text-gray-400">{t.overviewDesc}</p>
                            </DashboardCard>
                            {hasPermission('s:5') && (
                                <DashboardCard title={t.violationsReport} delay={0.2}>
                                    <PlaceholderChart color="#F472B6" />
                                </DashboardCard>
                            )}
                            {hasPermission('s:6') && (
                                <DashboardCard title={t.guardsRating} delay={0.3} className="md:col-span-2">
                                    <PlaceholderChart color="#34D399" />
                                </DashboardCard>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </main>
            <ServicesOverlay isOpen={isServicesOpen} onClose={() => setIsServicesOpen(false)} />
        </div>
    );
};

export default HomePage;