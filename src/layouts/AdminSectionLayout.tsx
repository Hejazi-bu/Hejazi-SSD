import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../components/contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../components/contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ChevronDown, Languages } from 'lucide-react';

// 🆕 إضافة الاستيرادات اللازمة من Firestore
import { getDoc, doc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase'; // تأكد من المسار الصحيح

// --- تعريف أنواع البيانات ---
type SubService = {
  id: number;
  label_ar: string;
  label_en: string;
  page: string | null;
};

interface AdminSectionLayoutProps {
  children: React.ReactNode;
  mainServiceId: number;
  hasUnsavedChanges?: boolean;
  onNavigateWithPrompt?: () => void;
}

const AdminSectionLayout: React.FC<AdminSectionLayoutProps> = ({
  children,
  mainServiceId,
  hasUnsavedChanges,
  onNavigateWithPrompt,
}) => {
  const { language, toggleLanguage } = useLanguage();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mainServiceTitle, setMainServiceTitle] = useState('');
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isRTL = language === 'ar';

  const t = {
    ar: { backToDash: "لوحة التحكم" },
    en: { backToDash: "Dashboard" },
  }[language];

  const handleHomeNavigation = () => {
    if (hasUnsavedChanges && onNavigateWithPrompt) {
      onNavigateWithPrompt();
    } else {
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    const fetchHeaderData = async () => {
      try {
        // 🆕 جلب بيانات الخدمة الرئيسية من Firestore
        const mainServiceDocRef = doc(db, "services", String(mainServiceId));
        const mainServiceSnap = await getDoc(mainServiceDocRef);

        if (mainServiceSnap.exists()) {
          const mainServiceData = mainServiceSnap.data();
          setMainServiceTitle(language === 'ar' ? mainServiceData.label_ar : mainServiceData.label_en);
        } else {
          console.error("Main service not found in Firestore!");
          setMainServiceTitle(language === 'ar' ? "خدمة غير معروفة" : "Unknown Service");
          setSubServices([]);
          return;
        }

        // 🆕 جلب الخدمات الفرعية من Firestore
        const subServicesQuery = query(collection(db, "sub_services"), where("service_id", "==", mainServiceId));
        const subServicesSnapshot = await getDocs(subServicesQuery);
        
        const fetchedSubServices: SubService[] = subServicesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: data.id,
                label_ar: data.label_ar,
                label_en: data.label_en,
                page: data.page
            };
        });

        const permittedSubServices = fetchedSubServices.filter(ss => hasPermission(`ss:${ss.id}`));
        setSubServices(permittedSubServices);

      } catch (error) {
        console.error("Error fetching header data from Firestore:", error);
        setMainServiceTitle(language === 'ar' ? "خطأ" : "Error");
        setSubServices([]);
      }
    };

    fetchHeaderData();
  }, [mainServiceId, language, hasPermission]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="bg-[#0D1B2A] min-h-screen text-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-sm shadow-lg">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleHomeNavigation}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/50"
            >
              <Home size={20} />
              <span className="hidden sm:inline font-semibold">{t.backToDash}</span>
            </button>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-md hover:bg-gray-700/50 transition-colors"
            >
              <span className="font-bold text-lg text-[#FFD700]">{mainServiceTitle}</span>
              <ChevronDown className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} size={20} />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`absolute mt-2 w-64 bg-gray-800 border border-gray-700 rounded-md shadow-lg ${isRTL ? 'left-0' : 'right-0'} origin-top`}
                >
                  <ul className="p-2">
                    {subServices.map(sub => (
                      <li key={sub.id}>
                        <a
                          href={sub.page || '#'}
                          onClick={(e) => { e.preventDefault(); if(sub.page) navigate(sub.page); setIsMenuOpen(false); }}
                          className={`block w-full px-3 py-2 rounded-md transition-colors ${location.pathname === sub.page ? 'bg-[#FFD700] text-black font-bold' : 'hover:bg-gray-700'} ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                          {language === 'ar' ? sub.label_ar : sub.label_en}
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleLanguage} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/50">
              <Languages size={20} />
              <span className="hidden sm:inline font-semibold">{language === 'ar' ? 'EN' : 'AR'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
};

export default AdminSectionLayout;