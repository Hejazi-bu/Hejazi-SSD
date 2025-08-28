// src/components/home/ServicesOverlay.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { ServiceCard, Service } from './ServiceCard';
import { X, Search } from 'lucide-react';

// واجهة جديدة لتمثيل المجموعات مع خدماتها
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
    loading: "جاري تحميل الخدمات...",
    noResults: "لم يتم العثور على خدمات مطابقة.",
  },
  en: {
    services: "Services",
    searchPlaceholder: "Search for a service...",
    favorites: "Favorites",
    loading: "Loading services...",
    noResults: "No matching services found.",
  },
};

interface ServicesOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServicesOverlay: React.FC<ServicesOverlayProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const [groupedServices, setGroupedServices] = useState<ServiceGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState<number[]>(() => {
    const savedFavorites = localStorage.getItem('favoriteServices');
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const t = translations[language];

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const fetchGroupedServices = async () => {
        const [groupsRes, servicesRes] = await Promise.all([
          supabase.from('service_groups').select('id, name_ar, name_en').order('order'),
          supabase.from('services').select('id, group_id, label_ar, label_en, icon').order('order')
        ]);

        if (groupsRes.error || servicesRes.error) {
          console.error("Error fetching services/groups:", groupsRes.error || servicesRes.error);
          setIsLoading(false);
          return;
        }

        const structuredData = (groupsRes.data || []).map(group => ({
          ...group,
          services: (servicesRes.data || []).filter(service => service.group_id === group.id)
        })).filter(group => group.services.length > 0);

        setGroupedServices(structuredData);
        setIsLoading(false);
      };
      fetchGroupedServices();
    }
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('favoriteServices', JSON.stringify(favorites));
  }, [favorites]);

  const handleToggleFavorite = (serviceId: number) => {
    setFavorites(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  // --- التعديل هنا: تم تحديث منطق الفلترة ---
  const filteredData = useMemo(() => {
    // 1. فلترة جميع الخدمات بناءً على البحث أولاً
    const allServicesMatchingSearch = groupedServices.flatMap(g => g.services).filter(service =>
      service.label_ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.label_en.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. من نتائج البحث، حدد الخدمات المفضلة
    const favoriteServices = allServicesMatchingSearch.filter(s => favorites.includes(s.id));
    
    // 3. أعد بناء المجموعات، بحيث تحتوي فقط على الخدمات التي تطابق البحث
    const groupedResults = groupedServices.map(group => ({
      ...group,
      services: group.services.filter(s => 
        allServicesMatchingSearch.some(fs => fs.id === s.id)
      )
    })).filter(group => group.services.length > 0);

    return { favoriteServices, groupedResults };

  }, [groupedServices, searchTerm, favorites]);

  const overlayVariants: Variants = {
    hidden: { y: "100%", opacity: 0.8 },
    visible: { y: "0%", opacity: 1, transition: { type: 'spring', stiffness: 120, damping: 20 } },
    exit: { y: "100%", opacity: 0.8, transition: { duration: 0.3 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-70 z-50"
          onClick={onClose}
        >
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-[#0D1B2A] w-full h-full shadow-lg flex flex-col p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-2xl font-bold text-white">{t.services}</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">
                <X className="text-white" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4 flex-shrink-0">
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>

            {/* Services Grid */}
            <div className="flex-grow overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-white">{t.loading}</div>
              ) : (
                <>
                  {/* قسم المفضلات */}
                  {filteredData.favoriteServices.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-400 mb-2">{t.favorites}</h3>
                      <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredData.favoriteServices.map(service => (
                          <ServiceCard key={`fav-${service.id}`} service={service} language={language} isFavorite={true} onToggleFavorite={handleToggleFavorite} />
                        ))}
                      </motion.div>
                    </div>
                  )}

                  {/* قسم المجموعات */}
                  {filteredData.groupedResults.map(group => (
                    <div key={group.id} className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-400 mb-2">
                        {language === 'ar' ? group.name_ar : group.name_en}
                      </h3>
                      <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {group.services.map(service => (
                          <ServiceCard 
                            key={service.id} 
                            service={service} 
                            language={language} 
                            isFavorite={favorites.includes(service.id)} // <-- التعديل هنا
                            onToggleFavorite={handleToggleFavorite} 
                          />
                        ))}
                      </motion.div>
                    </div>
                  ))}

                  {filteredData.favoriteServices.length === 0 && filteredData.groupedResults.length === 0 && (
                     <div className="flex justify-center items-center h-full text-gray-500">{t.noResults}</div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
