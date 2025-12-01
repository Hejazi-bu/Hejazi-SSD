import React, { useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { collection, query, where, limit, DocumentData } from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db } from '../../lib/firebase';
import { motion } from 'framer-motion';
import LoadingScreen from '../LoadingScreen';
import MainLayout from '../layouts/MainLayout';
import { pageTransitionVariants } from '../../lib/animations';
import { SubServicesContent } from '../home/SubServicesContent'; // Adjusted import path

export interface SubService {
    id: string;
    label_ar: string;
    label_en: string;
    is_allowed: boolean;
    page: string | null;
    icon: string | null;
    service_id: number;
    order: number;
}

const SubServicesPage = () => {
    const { servicePage } = useParams<{ servicePage: string }>();
    const { language } = useLanguage();
    const { isLoading: isAuthLoading } = useAuth(); 
    
    const mainServiceQuery = useMemo(() => {
        if (!servicePage) return null;
        return query(collection(db, 'services'), where("page", "==", servicePage), limit(1));
    }, [servicePage]);
    
    const [mainServices, mainServiceLoading] = useCollectionData(mainServiceQuery);
    const mainService = useMemo(() => mainServices?.[0] as DocumentData & { id: string } | undefined, [mainServices]);
    
    // ✨ 1. حذف isAccessRevoked والـ useEffect المرتبط به
    // const [isAccessRevoked, setAccessRevoked] = useState(false);
    // useEffect(() => { ... });

    if (mainServiceLoading || isAuthLoading) {
        return <LoadingScreen />;
    }
    
    const pageTitle = (language === 'ar' ? mainService?.label_ar : mainService?.label_en) || '...';

    // ✨ 2. تبسيط الـ return النهائي
    return (
        <MainLayout pageTitle={pageTitle}>
            <motion.div variants={pageTransitionVariants} initial="initial" animate="animate" exit="exit">
                {servicePage && <SubServicesContent servicePage={servicePage} />}
            </motion.div>
        </MainLayout>
    );
};

export default SubServicesPage;