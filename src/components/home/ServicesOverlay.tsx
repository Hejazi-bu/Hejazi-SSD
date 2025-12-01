// src/components/home/ServicesOverlay.tsx
import React, { useState, useEffect, useMemo, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/UserContext';
import { ServiceCard, Service } from './ServiceCard';
import { X, Search } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
    fadeInVariants,
    staggeredContainerVariants,
    staggeredItemVariants,
    slideUpOverlayVariants
} from '../../lib/animations';
import { useServices } from '../contexts/ServicesContext';

interface ServiceGroup {
    id: string;
    name_ar: string;
    name_en: string;
    page: string;
    services: Service[];
}

const translations = {
    ar: { services: "الخدمات", searchPlaceholder: "ابحث عن خدمة...", favorites: "المفضلة", all: "الكل", loading: "جاري تحميل الخدمات...", noResults: "لم يتم العثور على خدمات مطابقة.", noFavorites: "ليس لديك خدمات مفضلة بعد.", noPermissions: "لا توجد لديك صلاحيات على أي خدمة حاليًا." },
    en: { services: "Services", searchPlaceholder: "Search for a service...", favorites: "Favorites", all: "All", loading: "Loading services...", noResults: "No matching services found.", noFavorites: "You have no favorite services yet.", noPermissions: "You currently have no permissions for any service." },
};

interface ServicesOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

const TabButton = ({ name, count, active, onClick }: { name: string, count: number, active: boolean, onClick: () => void }) => (
    <button onClick={onClick} className="relative px-4 py-1.5 text-sm font-semibold rounded-full focus:outline-none flex items-center gap-2">
        <span className={`relative z-10 transition-colors duration-300 ${active ? 'text-black' : 'text-white'}`}>{name}</span>
        <motion.div layout className={`relative z-10 flex items-center justify-center text-xs font-bold rounded-full px-2 py-0.5 transition-colors duration-300 ${active ? 'bg-black/10 text-black' : 'bg-white/10 text-white'}`}>
            <AnimatePresence mode="wait">
                <motion.span key={count} initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 5, opacity: 0 }} transition={{ duration: 0.2 }}>
                    {count}
                </motion.span>
            </AnimatePresence>
        </motion.div>
        {active && (<motion.div layoutId="activeTabIndicator" className="absolute inset-0 bg-[#FFD700] rounded-full" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />)}
    </button>
);

export const ServicesOverlay = forwardRef<HTMLDivElement, ServicesOverlayProps>(({ isOpen, onClose }, ref) => {
    const { isLoading: servicesLoading } = useServices();
    const { language } = useLanguage();
    const { user, updateFavorites, hasPermission } = useAuth();
    const [allServices, setAllServices] = useState<Service[]>([]);
    const [allGroups, setAllGroups] = useState<Omit<ServiceGroup, 'services'>[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
    const t = translations[language];

    useEffect(() => {
        if (!isOpen) {
            document.body.style.overflow = 'auto';
            return;
        }
        document.body.style.overflow = 'hidden';

        const servicesQuery = query(collection(db, "services"), orderBy("order", "asc"));
        const groupsQuery = query(collection(db, "service_groups"), orderBy("order", "asc"));

        const unsubServices: Unsubscribe = onSnapshot(servicesQuery, (snapshot) => setAllServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[]));
        const unsubGroups: Unsubscribe = onSnapshot(groupsQuery, (snapshot) => {
            setAllGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Omit<ServiceGroup, 'services'>[]);
        });

        return () => { unsubServices(); unsubGroups(); document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    const permittedServices = useMemo(() => 
        allServices.filter(service => hasPermission(`s:${service.id}`)), 
        [allServices, hasPermission]
    );

    const favoritesCount = useMemo(() => user?.favorite_services?.length || 0, [user?.favorite_services]);

    useEffect(() => { if (favoritesCount === 0) setActiveTab('all'); }, [favoritesCount]);

    const groupedServices = useMemo(() => allGroups.map(group => ({ ...group, services: permittedServices.filter(service => String((service as any).group_id) === String(group.id)) })).filter(group => group.services.length > 0), [allGroups, permittedServices]);

    // ✅ إصلاح 1: تحديد النوع بشكل صريح داخل الدالة
    const handleToggleFavorite = (serviceId: string) => {
        if (!user || !updateFavorites) return;
        
        // نخبر Typescript أننا نتعامل مع مصفوفة أرقام هنا
        const currentFavorites = (user.favorite_services || []) as number[];
        const idAsNumber = Number(serviceId);
        
        const isCurrentlyFavorite = currentFavorites.includes(idAsNumber);
        
        let newFavorites: number[];
        if (isCurrentlyFavorite) {
            newFavorites = currentFavorites.filter(id => id !== idAsNumber);
        } else {
            newFavorites = [...currentFavorites, idAsNumber];
        }
        
        updateFavorites(newFavorites, 'favorite_services');
    };

    const filteredData = useMemo(() => {
        let sourceData = groupedServices;
        if (activeTab === 'favorites') {
            sourceData = sourceData.map(g => ({ 
                ...g, 
                // ✅ إصلاح 2: تحويل النوع عند الفلترة
                services: g.services.filter(s => ((user?.favorite_services || []) as number[]).includes(Number(s.id))) 
            })).filter(g => g.services.length > 0);
        }
        
        if (searchTerm.trim() === '') return sourceData;
        
        return sourceData.map(g => ({ 
            ...g, 
            services: g.services.filter(s => (s.label_ar?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (s.label_en?.toLowerCase() || '').includes(searchTerm.toLowerCase())) 
        })).filter(g => g.services.length > 0);
    }, [groupedServices, searchTerm, user?.favorite_services, activeTab]);

    return (
        <motion.div ref={ref} variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="fixed inset-0 bg-black/50 z-50" onClick={onClose}>
            <motion.div
                variants={slideUpOverlayVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                className="bg-black/20 backdrop-blur-sm border-t border-white/10 w-full h-full shadow-lg flex flex-col p-4 sm:p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-white">{t.services}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><X className="text-white" /></button>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 flex-shrink-0">
                    <motion.div layout transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="relative w-full sm:flex-1">
                        <input type="text" placeholder={t.searchPlaceholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-800/70 text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FFD700] border border-transparent focus:border-[#FFD700]" />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    </motion.div>
                    <AnimatePresence mode="popLayout">
                        {favoritesCount > 0 && (
                            <motion.div key="tabs-container" className="w-full sm:w-auto overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.3 } }}>
                                <div className="mt-4 sm:mt-0">
                                    <div className="flex items-center bg-gray-800/70 rounded-full p-1 flex-shrink-0">
                                        <TabButton name={t.all} count={permittedServices.length} active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
                                        <TabButton name={t.favorites} count={favoritesCount} active={activeTab === 'favorites'} onClick={() => setActiveTab('favorites')} />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex-grow min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                    {servicesLoading ? (
                        <div className="flex justify-center items-center h-full text-gray-400">
                            <p>{t.loading}</p>
                        </div>
                    ) : (
                        <>
                            {permittedServices.length > 0 && filteredData.length > 0 ? (
                                <AnimatePresence mode="wait">
                                    <motion.div key={activeTab + searchTerm} variants={fadeInVariants} initial="initial" animate="animate" exit="exit">
                                        {filteredData.map(group => (
                                            <div key={group.id} className="mb-6">
                                                <h3 className="text-lg font-semibold text-gray-400 mb-2">{language === 'ar' ? group.name_ar : group.name_en}</h3>
                                                <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                    {group.services.map(service => (
                                                        <motion.div key={service.id} variants={staggeredItemVariants}>
                                                            <ServiceCard 
                                                                service={service} 
                                                                groupPage={group.page} 
                                                                language={language} 
                                                                // ✅ إصلاح 3: تحويل النوع عند التمرير للـ Card
                                                                isFavorite={((user?.favorite_services || []) as number[]).includes(Number(service.id))} 
                                                                onToggleFavorite={handleToggleFavorite} 
                                                                onClose={onClose} 
                                                            />
                                                        </motion.div>
                                                    ))}
                                                </motion.div>
                                            </div>
                                        ))}
                                    </motion.div>
                                </AnimatePresence>
                            ) : (
                                <div className="flex justify-center items-center h-full text-gray-500">
                                    {permittedServices.length === 0 ? t.noPermissions : (activeTab === 'favorites' ? t.noFavorites : t.noResults)}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
});