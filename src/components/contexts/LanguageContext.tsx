// src/components/contexts/LanguageContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
    // 👈 1. استيراد الأنواع المطلوبة من React
    Dispatch,
    SetStateAction
} from 'react';

// تحديد أنواع البيانات التي سيوفرها الـ Context
interface LanguageContextProps {
    language: 'ar' | 'en';
    // 👈 2. استخدام النوع الصحيح لدالة تغيير الحالة
    setLanguage: Dispatch<SetStateAction<'ar' | 'en'>>;
    toggleLanguage: () => void;
}

// إنشاء الـ Context
const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

// المكون المزود (Provider)
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [language, setLanguage] = useState<'ar' | 'en'>(() => {
        const savedLang = localStorage.getItem('language');
        return (savedLang === 'ar' || savedLang === 'en') ? savedLang : 'ar';
    });

    useEffect(() => {
        localStorage.setItem('language', language);
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    }, [language]);

    const toggleLanguage = useCallback(() => {
        setLanguage(prevLang => (prevLang === 'ar' ? 'en' : 'ar'));
    }, []);

    const value = { language, setLanguage, toggleLanguage };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

// Hook مخصص لتسهيل استخدام الـ Context
export const useLanguage = (): LanguageContextProps => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
};