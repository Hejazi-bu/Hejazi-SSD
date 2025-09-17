// src/components/home/ServicesOverlay.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/UserContext';
import { ServiceCard, Service } from './ServiceCard';
import { X, Search } from 'lucide-react';

// 🆕 إضافة الاستيرادات اللازمة من Firestore
import { getDocs, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase'; // تأكد من المسار الصحيح

interface ServiceGroup {
    id: string; // 🆕 تم تعديل النوع إلى string
    name_ar: string;
    name_en: string;
    services: Service[];
}

const translations = {
    ar: {
        services: "الخدمات", searchPlaceholder: "ابحث عن خدمة...", favorites: "المفضلة", all: "الكل", loading: "جاري تحميل الخدمات...", noResults: "لم يتم العثور على خدمات مطابقة.", noFavorites: "ليس لديك خدمات مفضلة بعد.", noPermissions: "لا توجد لديك صلاحيات على أي خدمة حاليًا.",
    },
    en: {
        services: "Services", searchPlaceholder: "Search for a service...", favorites: "Favorites", all: "All", loading: "Loading services...", noResults: "No matching services found.", noFavorites: "You have no favorite services yet.", noPermissions: "You currently have no permissions for any service.",
    },
};

interface ServicesOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

export const ServicesOverlay: React.FC<ServicesOverlayProps> = ({ isOpen, onClose }) => {
    const { language } = useLanguage();
    const { user, updateFavorites, hasPermission } = useAuth();
    const [groupedServices, setGroupedServices] = useState<ServiceGroup[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
    const t = translations[language];

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setIsLoading(true);

            const fetchAndStructureServices = async () => {
                try {
                    // 🆕 جلب مجموعات الخدمات من Firestore
                    const groupsSnapshot = await getDocs(query(collection(db, "service_groups"), orderBy("order")));
                    const allGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // 🆕 جلب جميع الخدمات من Firestore
                    const servicesSnapshot = await getDocs(query(collection(db, "services"), orderBy("order")));
                    const allServices = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // بناء الهيكل للعرض
                    const structuredData = allGroups.map((group: any) => ({
                        ...group,
                        services: allServices.filter((service: any) =>
                            String(service.group_id) === String(group.id) && hasPermission(`s:${service.id}`) // 🆕 التأكد من تطابق الأنواع
                        )
                    })).filter((group: any) => group.services.length > 0);

                    setGroupedServices(structuredData);
                } catch (error) {
                    console.error("Error fetching data:", error);
                } finally {
                    setIsLoading(false);
                }
            };

            fetchAndStructureServices();
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen, hasPermission])

    const handleToggleFavorite = (serviceId: string) => { // 🆕 تم تعديل نوع serviceId إلى string
        if (!user || !user.favorite_services) return;
        const currentFavorites = user.favorite_services;
        const serviceIdAsNumber = Number(serviceId); // 🆕 تحويل الـ ID إلى رقم
        const newFavorites = currentFavorites.includes(serviceIdAsNumber)
            ? currentFavorites.filter(id => id !== serviceIdAsNumber)
            : [...currentFavorites, serviceIdAsNumber];
        updateFavorites(newFavorites);
    };

    const filteredData = useMemo(() => {
        if (!groupedServices) return [];
        const favorites = user?.favorite_services || [];
        let servicesToShow = groupedServices.flatMap(g => g.services).filter(service =>
            (service.label_ar?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (service.label_en?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );
        if (activeTab === 'favorites') {
            servicesToShow = servicesToShow.filter(s => favorites.includes(Number(s.id))); // 🆕 تحويل الـ ID إلى رقم
        }
        return groupedServices.map(group => ({
            ...group,
            services: group.services.filter(s => servicesToShow.some(fs => fs.id === s.id))
        })).filter(group => group.services.length > 0);
    }, [groupedServices, searchTerm, user?.favorite_services, activeTab]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }}
                    initial="hidden" animate="visible" exit="exit"
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    onClick={onClose}
                >
                    <motion.div
                        variants={{ hidden: { y: "100%" }, visible: { y: "0%" }, exit: { y: "100%" } }}
                        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                        className="bg-gray-900/50 backdrop-blur-xl border-t border-gray-700 w-full h-full shadow-lg flex flex-col p-4 sm:p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4 flex-shrink-0">
                            <h2 className="text-2xl font-bold text-white">{t.services}</h2>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><X className="text-white" /></button>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 flex-shrink-0">
                            <div className="relative w-full sm:flex-1">
                                <input type="text" placeholder={t.searchPlaceholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-800/70 text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FFD700] border border-transparent focus:border-[#FFD700]" />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            </div>
                            <div className="flex items-center bg-gray-800/70 rounded-full p-1">
                                <TabButton name={t.all} active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
                                <TabButton name={t.favorites} active={activeTab === 'favorites'} onClick={() => setActiveTab('favorites')} />
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                            {isLoading ? (<div className="flex justify-center items-center h-full text-white">{t.loading}</div>) : (
                                <AnimatePresence mode="wait">
                                    <motion.div key={activeTab + searchTerm} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                                        {filteredData.length > 0 ? (
                                            filteredData.map(group => (
                                                <div key={group.id} className="mb-6">
                                                    <h3 className="text-lg font-semibold text-gray-400 mb-2">{language === 'ar' ? group.name_ar : group.name_en}</h3>
                                                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                        {group.services.map(service => (
                                                            <ServiceCard key={service.id} service={service} language={language} isFavorite={(user?.favorite_services || []).includes(Number(service.id))} onToggleFavorite={handleToggleFavorite} />
                                                        ))}
                                                    </motion.div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex justify-center items-center h-full text-gray-500">{groupedServices.length === 0 ? t.noPermissions : (activeTab === 'favorites' ? t.noFavorites : t.noResults)}</div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const TabButton = ({ name, active, onClick }: { name: string, active: boolean, onClick: () => void }) => (
    <button onClick={onClick} className="relative px-4 py-1.5 text-sm font-semibold rounded-full focus:outline-none">
        <span className={`relative z-10 transition-colors duration-300 ${active ? 'text-black' : 'text-white'}`}>{name}</span>
        {active && (<motion.div layoutId="activeTabIndicator" className="absolute inset-0 bg-[#FFD700] rounded-full" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />)}
    </button>
);