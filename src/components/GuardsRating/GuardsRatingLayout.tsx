import React, { useState, useLayoutEffect, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useNavigate, useLocation } from "react-router-dom"; // 👈 1. استيراد useLocation
import { Menu, Globe, HomeIcon } from "lucide-react";

// 👇 2. تم حذف parentServiceId، لم نعد بحاجة إليه
interface GuardsRatingLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
}

// مكون الهيدر يبقى كما هو
function Header({ onBackToServicesClick, language, toggleLanguage, isRTL, pageTitle }: { onBackToServicesClick: () => void; language: "ar" | "en"; toggleLanguage: () => void; isRTL: boolean; pageTitle: string }) {
    const navigate = useNavigate();
    const baseButtonClass = "flex items-center font-semibold text-white hover:text-[#FFD700] focus:outline-none transition-colors p-2 rounded-full";
    const homeLabel = language === 'ar' ? 'الرئيسية' : 'Home';
    
    const goHome = () => navigate("/dashboard");

    return (
        <header id="app-header" className={`sticky top-0 left-0 w-full bg-gray-900/80 backdrop-blur-sm shadow-lg flex items-center justify-between px-4 py-3 z-30 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
            <button onClick={goHome} className={`${baseButtonClass} gap-2`}>
                <HomeIcon className="w-6 h-6" />
                <span className="hidden sm:inline">{homeLabel}</span>
            </button>
            <h1 className="text-lg font-bold text-[#FFD700] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{pageTitle}</h1>
            <div className="flex items-center gap-2">
                <button onClick={toggleLanguage} className={`${baseButtonClass} gap-2`}>
                    <Globe className="w-5 h-5" />
                    <span className="hidden sm:inline">{language === 'ar' ? 'EN' : 'AR'}</span>
                </button>
                <div className="h-6 border-l border-gray-600"></div>
                <button onClick={onBackToServicesClick} className={`${baseButtonClass}`} title={language === 'ar' ? 'العودة للخدمات' : 'Back to Services'}>
                    <Menu className="w-7 h-7" />
                </button>
            </div>
        </header>
    );
}

export default function GuardsRatingLayout({ children, pageTitle }: GuardsRatingLayoutProps) {
    const { language, toggleLanguage } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation(); // 👈 3. استخدام Hook للحصول على المسار الحالي
    const isRTL = language === "ar";
    const [headerHeight, setHeaderHeight] = useState<number>(80);
    
    // 🗑️ لم نعد بحاجة للتحقق من parentServiceId
    // useEffect(() => { ... });

    // 👇 4. تعديل دالة العودة لتكون ديناميكية
    const goBackToServices = () => {
        const currentPath = location.pathname; // مثال: /guards/evaluations/new-evaluation
        // يقوم بحذف الجزء الأخير من الرابط للعودة إلى المسار الأصل
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')); //  النتيجة: /guards/evaluations

        if (parentPath) {
            navigate(parentPath);
        } else {
            // إجراء وقائي في حال حدوث خطأ
            navigate('/dashboard');
        }
    };

    useLayoutEffect(() => {
        const measure = () => {
            const el = document.getElementById("app-header");
            setHeaderHeight(el?.getBoundingClientRect().height ?? 80);
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [language]);

    return (
        <div
            className="bg-[#0D1B2A] text-white"
            style={{ minHeight: "100vh" }}
            dir={isRTL ? "rtl" : "ltr"}
        >
            <Header
                onBackToServicesClick={goBackToServices}
                language={language}
                toggleLanguage={toggleLanguage}
                isRTL={isRTL}
                pageTitle={pageTitle}
            />
            <main style={{ paddingTop: headerHeight }} className="p-4 sm:p-6">
                {children}
            </main>
        </div>
    );
}