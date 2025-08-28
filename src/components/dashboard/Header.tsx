// src/components/dashboard/Header.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../../lib/supabaseClient';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, User as UserIcon, Menu, Edit2, Settings } from 'lucide-react';

const translations = {
  ar: {
    myProfile: "ملفي الشخصي",
    settings: "الإعدادات والتحكم",
    logout: "تسجيل الخروج",
  },
  en: {
    myProfile: "My Profile",
    settings: "Settings & Control",
    logout: "Logout",
  },
};

// --- بطاقة المستخدم المحدثة ---
const UserMenu = ({ onLogout }: { onLogout: () => void }) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = translations[language];

  // --- إضافة جديدة: حالة لتخزين المسمى الوظيفي ---
  const [jobTitle, setJobTitle] = useState<string | null>(null);

  useEffect(() => {
    // دالة لجلب المسمى الوظيفي بشكل مستقل
    const fetchJobTitle = async () => {
      if (!user?.job_id) {
        setJobTitle(language === 'ar' ? 'غير محدد' : 'Not Assigned');
        return;
      }

      // --- الإصلاح هنا: نطلب كلا العمودين دائمًا ---
      const { data, error } = await supabase
        .from('jobs')
        .select('name_ar, name_en') // <-- طلب كلا العمودين
        .eq('id', user.job_id)
        .single();
      
      if (data) {
        // ثم نختار العمود المناسب هنا
        setJobTitle(data[language === 'ar' ? 'name_ar' : 'name_en']);
      } else {
        console.error("Error fetching job title:", error);
      }
    };

    if (user) {
        fetchJobTitle();
    }
  }, [user, language]); // يتم تشغيلها عند توفر المستخدم أو تغير اللغة

  const getInitials = (nameAr?: string | null, nameEn?: string | null, email?: string | null) => {
    if (language === 'ar' && nameAr) return nameAr.charAt(0);
    if (language === 'en' && nameEn) return nameEn.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return 'G';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="absolute top-14 left-0 rtl:left-auto rtl:right-0 bg-gray-800 rounded-xl shadow-2xl w-80 border border-gray-700 z-50"
    >
      <div className="flex items-center gap-4 p-4 border-b border-gray-700">
        <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="صورة المستخدم" className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-2xl text-[#FFD700]">{getInitials(user?.name_ar, user?.name_en, user?.email)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white truncate">{language === 'ar' ? user?.name_ar : user?.name_en}</h4>
          <p className="text-sm text-gray-400 truncate">{jobTitle || '...'}</p>
        </div>
      </div>
      <ul className="p-2 text-white">
        <li className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-700 cursor-pointer">
          <Edit2 size={16} className="text-gray-400" />
          <span>{t.myProfile}</span>
        </li>
        <li className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-700 cursor-pointer">
          <Settings size={16} className="text-gray-400" />
          <span>{t.settings}</span>
        </li>
      </ul>
      <div className="p-2 border-t border-gray-700">
        <li onClick={onLogout} className="flex items-center gap-3 p-2 rounded-md hover:bg-red-900/50 cursor-pointer text-red-400">
          <LogOut size={16} />
          <span>{t.logout}</span>
        </li>
      </div>
    </motion.div>
  );
};

// مكون الترويسة الرئيسي (بدون تغيير)
export const Header = ({ onToggleServices }: { onToggleServices: () => void }) => {
  const { user } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  
  const getInitials = (nameAr?: string | null, nameEn?: string | null, email?: string | null) => {
    if (language === 'ar' && nameAr) return nameAr.charAt(0);
    if (language === 'en' && nameEn) return nameEn.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return 'G';
  };

  return (
    <header className="sticky top-0 z-40 bg-gray-900/70 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-between shadow-lg border-b border-gray-800">
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative z-50">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="صورة المستخدم" className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-lg text-[#FFD700]">{getInitials(user?.name_ar, user?.name_en, user?.email)}</span>
            )}
          </button>
          <AnimatePresence>
            {isMenuOpen && <UserMenu onLogout={handleLogout} />}
          </AnimatePresence>
        </div>
        <button onClick={toggleLanguage} className="p-2 rounded-full hover:bg-gray-700 text-sm font-semibold w-10 h-10">
          {language === 'ar' ? 'EN' : 'AR'}
        </button>
      </div>
      <button onClick={onToggleServices} className="p-2 rounded-full hover:bg-gray-700">
        <Menu className="text-white" />
      </button>
    </header>
  );
};
