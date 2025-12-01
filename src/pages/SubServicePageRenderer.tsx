// src/pages/SubServicePageRenderer.tsx
import React, { useState, Suspense, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileQuestion, Menu } from 'lucide-react';
import MainLayout from '../components/layouts/MainLayout';
import LoadingScreen from '../components/LoadingScreen';
import { pageTransitionVariants } from '../lib/animations';
import { useLanguage } from '../components/contexts/LanguageContext';
import { SubServicesOverlay } from '../components/home/SubServicesOverlay';
import { useServices } from '../components/contexts/ServicesContext';

// =============================================================================
// 🚀 PERFORMANCE OPTIMIZATION: Code Splitting (Lazy Loading)
// بدلاً من استيراد كل الصفحات دفعة واحدة، نقوم باستيرادها فقط عند الحاجة.
// =============================================================================

const componentMap: { [key: string]: React.LazyExoticComponent<any> } = {
    // --- Guards Rating System ---
    NewEvaluation: React.lazy(() => import("../components/GuardsRating/NewEvaluation")),
    EvaluationHistory: React.lazy(() => import("../components/GuardsRating/EvaluationHistory")),
    EvaluationReports: React.lazy(() => import("../components/GuardsRating/EvaluationReports")),
    EvaluationDetails: React.lazy(() => import("../components/GuardsRating/EvaluationDetails")),
    EditEvaluation: React.lazy(() => import("../components/GuardsRating/EditEvaluation")),

    // --- Permissions System (Basic) ---
    JobPermissions: React.lazy(() => import("../components/Permission/JobPermissions")),
    UserExceptions: React.lazy(() => import("../components/Permission/UserExceptions")),

    // --- Delegation System (Access) ---
    AccessUserResources: React.lazy(() => import("../components/Permission/Delegation/Access/AccessUserResources")),
    AccessUserScopes: React.lazy(() => import("../components/Permission/Delegation/Access/AccessUserScopes")),
    AccessJobScopes: React.lazy(() => import("../components/Permission/Delegation/Access/AccessJobScopes")),
    AccessJobResources: React.lazy(() => import("../components/Permission/Delegation/Access/AccessJobResources")),

    // --- Delegation System (Control) ---
    ControlUserResources: React.lazy(() => import("../components/Permission/Delegation/Control/ControlUserResources")),
    ControlJobScopes: React.lazy(() => import("../components/Permission/Delegation/Control/ControlJobScopes")),
    ControlJobResources: React.lazy(() => import("../components/Permission/Delegation/Control/ControlJobResources")),
    ControlUserScopes: React.lazy(() => import("../components/Permission/Delegation/Control/ControlUserScopes")),

    // --- Configuration ---
    OrgStructureManager: React.lazy(() => import("../components/Administrative structure/OrgStructureManager")),
    JobDistributionManager: React.lazy(() => import("../components/Jobs/JobDistributionManager")),
    
    // --- Services ---
        ServicesManagement: React.lazy(() => import("../components/Services/ServicesManagement")),
    
    // --- Facility ---
    ManageFacility: React.lazy(() => import("../components/Facility/ManageFacility")),
    
    // --- Tasks ---
    PendingTasks: React.lazy(() => import("../components/Tasks/PendingTasks")),
    
    // --- Ahmed Saeed Custom Module ---
    AhmedSaeedTasks: React.lazy(() => import("../components/AhmedSaeed/AhmedSaeedTasks")),
    AhmedSaeedTasksRecords: React.lazy(() => import("../components/AhmedSaeed/AhmedSaeedTasksRecords")),

    // --- Users System ---
    MyProfile: React.lazy(() => import("../components/Users/MyProfile")),
    NewUser: React.lazy(() => import("../components/Users/NewUser")),
    UserRequestsHistory: React.lazy(() => import("../components/Users/UserRequestsHistory")),
    UserRequestDetails: React.lazy(() => import("../components/Users/UserRequestDetails")),
    EditUserRequest: React.lazy(() => import("../components/Users/EditUserRequest"))
};

// مكون عرض الخطأ (404)
const NotFoundComponent = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center text-gray-500">
        <FileQuestion className="w-24 h-24 mb-4" />
        <h2 className="text-2xl font-bold mb-2">عفواً!</h2>
        <p className="max-w-md">{message}</p>
    </div>
);

const SubServicePageRenderer = () => {
    // 1. استقبال معايير المسار
    const { groupPage, servicePage, subServicePage } = useParams<{ groupPage: string; servicePage: string; subServicePage: string }>();
    const { language } = useLanguage();
    const { findSubServiceByPath, isLoading } = useServices();
    const [isSubServicesOpen, setIsSubServicesOpen] = useState(false);

    // 2. البحث عن الصفحة المطابقة في الذاكرة
    const subServiceData = useMemo(() => {
        if (!groupPage || !servicePage || !subServicePage || isLoading) return null;
        return findSubServiceByPath(groupPage, servicePage, subServicePage);
    }, [groupPage, servicePage, subServicePage, findSubServiceByPath, isLoading]);

    // زر القائمة الجانبية العائم
    const subServicesButton = (
        <button 
            onClick={() => setIsSubServicesOpen(true)} 
            className="flex items-center justify-center font-semibold text-white hover:text-[#FFD700] focus:outline-none transition-colors p-2 rounded-full" 
            title={language === 'ar' ? 'عرض الخدمات الفرعية' : 'Show Sub-Services'}
        >
            <Menu />
        </button>
    );

    // حالة التحميل العامة (للخدمات)
    if (isLoading) { return <LoadingScreen />; }

    // 3. التحقق من وجود البيانات
    if (!subServiceData) {
        return (
            <MainLayout pageTitle={language === 'ar' ? 'غير موجود' : 'Not Found'}>
                <NotFoundComponent message={language === 'ar' ? 'الصفحة التي تبحث عنها غير موجودة أو تأكد من المسار الصحيح.' : 'The page you are looking for was not found. Check the URL.'} />
            </MainLayout>
        );
    }
    
    const componentName = subServiceData.component;

    if (!componentName) {
         return (
            <MainLayout pageTitle={language === 'ar' ? 'خطأ' : 'Error'}>
                <NotFoundComponent message={language === 'ar' ? 'خطأ في الإعدادات: اسم المكون غير محدد.' : 'Configuration error: Component name not specified.'} />
            </MainLayout>
        );
    }

    const ComponentToRender = componentMap[componentName];

    if (!ComponentToRender) {
       return (
            <MainLayout pageTitle={language === 'ar' ? 'خطأ' : 'Error'}>
                <NotFoundComponent message={language === 'ar' ? `خطأ للمطور: المكون "${componentName}" غير موجود.` : `Developer error: Component "${componentName}" not found.`} />
            </MainLayout>
        );
    }

    const pageTitle = language === 'ar' ? subServiceData.label_ar : subServiceData.label_en;
    const pageIcon = subServiceData.icon;

    return (
        <>
            <MainLayout pageTitle={pageTitle || ""} pageIcon={pageIcon} contextualActions={subServicesButton}>
                <motion.div
                    variants={pageTransitionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    {/* ✅ استخدام Suspense لعرض LoadingScreen أثناء جلب ملف الصفحة المطلوبة فقط */}
                    <Suspense fallback={<LoadingScreen />}>
                        <ComponentToRender />
                    </Suspense>
                </motion.div>
            </MainLayout>
            
            <SubServicesOverlay 
                isOpen={isSubServicesOpen}
                onClose={() => setIsSubServicesOpen(false)}
            />
        </>
    );
};

export default SubServicePageRenderer;