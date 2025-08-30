import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/UserContext';
import { ServiceCard, Service } from './ServiceCard';
import { X, Search } from 'lucide-react';

// واجهة لتمثيل المجموعات مع خدماتها
interface ServiceGroup {
  id: number;
  name_ar: string;
  name_en: string;
  services: Service[];
}

const translations = {
  ar: {
    services: "الخدمات",
    searchPlaceholder: "ابحث عن خدمة...",
    favorites: "المفضلة",
    all: "الكل",
    loading: "جاري تحميل الخدمات...",
    noResults: "لم يتم العثور على خدمات مطابقة.",
    noFavorites: "ليس لديك خدمات مفضلة بعد.",
  },
  en: {
    services: "Services",
    searchPlaceholder: "Search for a service...",
    favorites: "Favorites",
    all: "All",
    loading: "Loading services...",
    noResults: "No matching services found.",
    noFavorites: "You have no favorite services yet.",
  },
};

interface ServicesOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
    },
  },
};

export const ServicesOverlay: React.FC<ServicesOverlayProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const { user, updateFavorites } = useAuth();
  const [groupedServices, setGroupedServices] = useState<ServiceGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all'); // حالة للتحكم في التبويب
  const t = translations[language];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoading(true);
      const fetchGroupedServices = async () => {
        const { data: servicesData, error: servicesError } = await supabase.from('services')
          .select('id, group_id, label_ar, label_en, icon')
          .order('order');
        
        const { data: groupsData, error: groupsError } = await supabase.from('service_groups')
          .select('id, name_ar, name_en')
          .order('order');

        if (servicesError || groupsError) {
          console.error("Error fetching services/groups:", servicesError || groupsError);
          setIsLoading(false);
          return;
        }

        const structuredData = (groupsData || []).map(group => ({
          ...group,
          services: (servicesData || []).filter(service => service.group_id === group.id)
        })).filter(group => group.services.length > 0);

        setGroupedServices(structuredData);
        setIsLoading(false);
      };
      fetchGroupedServices();
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const handleToggleFavorite = (serviceId: number) => {
    if (!user) return;
    const currentFavorites = user.favorite_services || [];
    const newFavorites = currentFavorites.includes(serviceId)
      ? currentFavorites.filter(id => id !== serviceId)
      : [...currentFavorites, serviceId];
    updateFavorites(newFavorites);
  };

  const filteredData = useMemo(() => {
    const favorites = user?.favorite_services || [];
    
    const servicesMatchingSearch = groupedServices.flatMap(g => g.services).filter(service =>
      service.label_ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.label_en.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const servicesToShow = activeTab === 'favorites'
      ? servicesMatchingSearch.filter(s => favorites.includes(s.id))
      : servicesMatchingSearch;

    const groupedResults = groupedServices.map(group => ({
      ...group,
      services: group.services.filter(s => servicesToShow.some(fs => fs.id === s.id))
    })).filter(group => group.services.length > 0);
    
    return { groupedResults };
  }, [groupedServices, searchTerm, user?.favorite_services, activeTab]);

  const overlayVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.3 } },
  };

  const contentVariants: Variants = {
    hidden: { y: "100%" },
    visible: { y: "0%", transition: { type: 'spring', stiffness: 120, damping: 20 } },
    exit: { y: "100%", transition: { duration: 0.3 } },
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          onClick={onClose}
        >
          <motion.div
            variants={contentVariants}
            className="bg-gray-900/50 backdrop-blur-xl border-t border-gray-700 w-full h-full shadow-lg flex flex-col p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-2xl font-bold text-white">{t.services}</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">
                <X className="text-white" />
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 flex-shrink-0">
              <div className="relative w-full sm:flex-1">
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800/70 text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FFD700] border border-transparent focus:border-[#FFD700]"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              </div>
              <div className="flex items-center bg-gray-800/70 rounded-full p-1">
                <TabButton name={t.all} active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
                <TabButton name={t.favorites} active={activeTab === 'favorites'} onClick={() => setActiveTab('favorites')} />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-white">{t.loading}</div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {filteredData.groupedResults.length > 0 ? (
                      filteredData.groupedResults.map(group => (
                        <div key={group.id} className="mb-6">
                          <h3 className="text-lg font-semibold text-gray-400 mb-2">{language === 'ar' ? group.name_ar : group.name_en}</h3>
                          <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                          >
                            {group.services.map(service => (
                              <ServiceCard 
                                key={service.id} 
                                service={service}
                                language={language}
                                isFavorite={(user?.favorite_services || []).includes(service.id)}
                                onToggleFavorite={handleToggleFavorite}
                              />
                            ))}
                          </motion.div>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-center items-center h-full text-gray-500">
                        {activeTab === 'favorites' ? t.noFavorites : t.noResults}
                      </div>
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
    <span className={`relative z-10 transition-colors duration-300 ${active ? 'text-black' : 'text-white'}`}>
      {name}
    </span>
    {active && (
      <motion.div
        layoutId="activeTabIndicator"
        className="absolute inset-0 bg-[#FFD700] rounded-full"
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      />
    )}
  </button>
);

