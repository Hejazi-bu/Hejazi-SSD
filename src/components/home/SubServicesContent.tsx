// src/components/home/SubServicesContent.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/UserContext';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Search } from 'lucide-react';
import { SubServiceCard } from './SubServiceCard';
import { SubService } from './SubServicesPage';
import { fadeInVariants, staggeredContainerVariants, staggeredItemVariants } from '../../lib/animations';
import { useParams } from 'react-router-dom';
import { usePageLoading } from '../contexts/LoadingContext';

const TabButton = ({ name, count, active, onClick }: { name: string, count: number, active: boolean, onClick: () => void }) => (
    <button onClick={onClick} className="relative px-4 py-1.5 text-sm font-semibold rounded-full focus:outline-none flex items-center gap-2">
        <span className={`relative z-10 transition-colors duration-300 ${active ? 'text-black' : 'text-white'}`}>{name}</span>
        <motion.div layout className={`relative z-10 flex items-center justify-center text-xs font-bold rounded-full px-2 py-0.5 transition-colors duration-300 ${active ? 'bg-black/10 text-black' : 'bg-white/10 text-white'}`}>
            <AnimatePresence mode="wait"><motion.span key={count} initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 5, opacity: 0 }} transition={{ duration: 0.2 }}>{count}</motion.span></AnimatePresence>
        </motion.div>
        {active && (<motion.div layoutId="activeTabIndicator" className="absolute inset-0 bg-[#FFD700] rounded-full" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />)}
    </button>
);

interface SubServicesContentProps {
    servicePage: string;
    onCardClick?: (subService: SubService) => void;
}

export const SubServicesContent = ({ servicePage, onCardClick }: SubServicesContentProps) => {
    const { subServicePage } = useParams<{ subServicePage: string }>();
    const { language } = useLanguage();
    const { user, updateFavorites, hasPermission } = useAuth();
    const { setPageLoading } = usePageLoading();
    const [subServices, setSubServices] = useState<SubService[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
    
    const translations = useMemo(() => ({ 
        ar: { searchPlaceholder: "ابحث عن خدمة فرعية...", favorites: "المفضلة", all: "الكل", noResults: "لم يتم العثور على نتائج.", noFavorites: "ليس لديك خدمات مفضلة بعد.", noSubServices: "لا توجد خدمات فرعية متاحة حاليًا.", noPermission: "ليس لديك صلاحية الوصول لأي خدمة هنا." }, 
        en: { searchPlaceholder: "Search for a sub-service...", favorites: "Favorites", all: "All", noResults: "No matching results found.", noFavorites: "You have no favorite services yet.", noSubServices: "No sub-services are available.", noPermission: "You have no permission to access any service here." } 
    }), []);
    const t = translations[language];

    useEffect(() => {
        if (!servicePage) { setPageLoading(false); return; }
        setPageLoading(true);
        const mainServiceQuery = query(collection(db, "services"), where("page", "==", servicePage), limit(1));
        
        const unsubMain = onSnapshot(mainServiceQuery, (snapshot) => {
            if (snapshot.empty) { 
                setPageLoading(false); 
                setSubServices([]); 
                return; 
            }
            const mainServiceId = snapshot.docs[0].id;
            // لاحظ أننا نستخدم Number(mainServiceId) لأن service_id في sub_services هو رقم
            const subServicesQuery = query(collection(db, "sub_services"), where("service_id", "==", Number(mainServiceId)), orderBy("order", "asc"));
            const unsubSubs = onSnapshot(subServicesQuery, (subSnapshot) => {
                setSubServices(subSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubService)));
                setPageLoading(false);
            });
            return () => unsubSubs();
        });

        return () => { unsubMain(); setPageLoading(false); }
    }, [servicePage, setPageLoading]);
    
    const favoritesCount = useMemo(() => user?.favorite_sub_services?.length || 0, [user?.favorite_sub_services]);
    useEffect(() => { if (favoritesCount === 0) setActiveTab('all'); }, [favoritesCount]);

    // ✅ إصلاح 1: تحديد النوع (string[]) صراحةً
    const handleToggleFavorite = (subServiceId: string) => {
        if (!user || !updateFavorites) return;
        
        const currentFavorites = (user.favorite_sub_services || []) as string[];
        
        const newFavorites = currentFavorites.includes(subServiceId) 
            ? currentFavorites.filter((id) => id !== subServiceId) 
            : [...currentFavorites, subServiceId];
            
        updateFavorites(newFavorites, 'favorite_sub_services');
    };
    
    const permittedSubServices = useMemo(() => {
        if (!subServices) return [];
        return subServices.filter(ss => hasPermission(`ss:${ss.id}`));
    }, [subServices, hasPermission]);

    const filteredSubServices = useMemo(() => {
        let services = permittedSubServices;
        // ✅ إصلاح 2: تحويل النوع عند الفلترة
        if (activeTab === 'favorites') {
            services = services.filter(ss => ((user?.favorite_sub_services || []) as string[]).includes(ss.id));
        }
        
        if (searchTerm.trim() !== '') services = services.filter(ss => (ss.label_ar?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (ss.label_en?.toLowerCase() || '').includes(searchTerm.toLowerCase()));
        return services;
    }, [permittedSubServices, activeTab, searchTerm, user?.favorite_sub_services]);

    const getEmptyStateMessage = () => {
        if (permittedSubServices.length === 0) return !subServices || subServices.length === 0 ? t.noSubServices : t.noPermission;
        if (activeTab === 'favorites') return t.noFavorites;
        return t.noResults;
    };
    
    return (
        <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" className="mt-4">
            <motion.div variants={staggeredItemVariants} className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                <motion.div layout className="relative w-full sm:flex-1">
                    <input type="text" placeholder={t.searchPlaceholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full bg-gray-800/70 text-white rounded-full py-2 focus:outline-none focus:ring-2 focus:ring-[#FFD700] border border-transparent ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'}`} />
                    <Search className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${language === 'ar' ? 'right-3' : 'left-3'}`} size={20} />
                </motion.div>
                <AnimatePresence mode="popLayout">
                    {favoritesCount > 0 && (
                        <motion.div key="tabs-container" className="w-full sm:w-auto overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} >
                            <div className="mt-4 sm:mt-0"><div className="flex items-center bg-gray-800/70 rounded-full p-1 flex-shrink-0">
                                <TabButton name={t.all} count={permittedSubServices.length} active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
                                <TabButton name={t.favorites} count={favoritesCount} active={activeTab === 'favorites'} onClick={() => setActiveTab('favorites')} />
                            </div></div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
            <motion.div variants={staggeredItemVariants}>
                <AnimatePresence mode="wait">
                    <motion.div key={activeTab + searchTerm} variants={fadeInVariants} initial="initial" animate="animate" exit="exit">
                        {filteredSubServices.length > 0 ? (
                            <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {filteredSubServices.map(ss => ( 
                                    <motion.div key={ss.id} variants={staggeredItemVariants}>
                                        <SubServiceCard 
                                            subService={ss} 
                                            // ✅ إصلاح 3: تحويل النوع عند التمرير
                                            isFavorite={((user?.favorite_sub_services || []) as string[]).includes(ss.id)}
                                            onToggleFavorite={() => handleToggleFavorite(ss.id)}
                                            onClick={onCardClick ? () => onCardClick(ss) : undefined}
                                            isActive={ss.page === subServicePage}
                                        />
                                    </motion.div> 
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div className="flex items-center justify-center h-64 text-gray-500 text-center">
                                <p>{getEmptyStateMessage()}</p>
                            </motion.div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};