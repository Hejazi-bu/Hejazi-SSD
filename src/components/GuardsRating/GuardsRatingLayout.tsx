import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext"; // تأكد من صحة هذا المسار
import { useNavigate } from "react-router-dom";
import { FaRegFileAlt, FaHistory, FaChartBar } from "react-icons/fa";
import { Menu, Globe, HomeIcon } from "lucide-react";

// واجهة الخصائص لمكون التصميم
interface GuardsRatingLayoutProps {
  children: React.ReactNode;
  activeServiceId: 'new-evaluation' | 'evaluation-records' | 'evaluation-reports';
  pageTitle: string;
}

// مكون القائمة الجانبية
function Sidebar({ isOpen, onClose, activeServiceId, handleNavigate, language, isRTL }: { isOpen: boolean; onClose: () => void; activeServiceId: string; handleNavigate: (id: string) => void; language: "ar" | "en"; isRTL: boolean; }) {
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const services = [
    { id: "new-evaluation", labelAr: "تقييم جديد", labelEn: "New Evaluation", icon: <FaRegFileAlt /> },
    { id: "evaluation-records", labelAr: "سجل التقييمات", labelEn: "Evaluation Records", icon: <FaHistory /> },
    { id: "evaluation-reports", labelAr: "تقارير التقييمات", labelEn: "Evaluation Reports", icon: <FaChartBar /> },
  ];

  const handleClick = (id: string) => {
    handleNavigate(id);
    onClose();
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black bg-opacity-70 z-40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={onClose} aria-hidden="true"></div>
      <aside ref={sidebarRef} className={`fixed top-0 bottom-0 z-50 w-64 bg-gray-900 shadow-lg transform transition-transform duration-300 ease-in-out ${isRTL ? "right-0" : "left-0"} ${isOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full"}`} role="menu">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">{language === "ar" ? "قائمة الخدمات" : "Services"}</h2>
          <button onClick={onClose} aria-label={language === "ar" ? "إغلاق القائمة" : "Close menu"} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <nav className="flex flex-col p-4 space-y-2 flex-grow">
          {services.map((service) => (
            <button key={service.id} onClick={() => handleClick(service.id)} className={`text-start p-3 rounded-lg hover:bg-gray-700 flex items-center gap-3 transition-colors ${service.id === activeServiceId ? "bg-[#FFD700] font-bold text-black" : "text-gray-300"}`} role="menuitem">
              {React.cloneElement(service.icon, { className: `w-5 h-5 ${service.id === activeServiceId ? 'text-black' : 'text-gray-400'}` })}
              <span>{language === "ar" ? service.labelAr : service.labelEn}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

// مكون الهيدر
function Header({ onMenuClick, language, toggleLanguage, isRTL, pageTitle }: { onMenuClick: () => void; language: "ar" | "en"; toggleLanguage: () => void; isRTL: boolean; pageTitle: string }) {
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
                <button onClick={onMenuClick} className={`${baseButtonClass}`}>
                    <Menu className="w-7 h-7" />
                </button>
            </div>
        </header>
    );
}

// مكون التصميم المشترك الرئيسي
export default function GuardsRatingLayout({ children, activeServiceId, pageTitle }: GuardsRatingLayoutProps) {
    const { language, toggleLanguage } = useLanguage();
    const navigate = useNavigate();
    const isRTL = language === "ar";
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [headerHeight, setHeaderHeight] = useState<number>(80);

    const handleNavigate = (pageId: string) => {
        if (pageId === "new-evaluation") {
            navigate('/guards-rating');
        } else if (pageId === "evaluation-records") {
            navigate('/evaluation-records');
        } else if (pageId === "evaluation-reports") {
            alert("صفحة التقارير قيد الإنشاء!");
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
                onMenuClick={() => setSidebarOpen(true)}
                language={language}
                toggleLanguage={toggleLanguage}
                isRTL={isRTL}
                pageTitle={pageTitle}
            />
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                activeServiceId={activeServiceId}
                handleNavigate={handleNavigate}
                language={language}
                isRTL={isRTL}
            />
            <main style={{ paddingTop: headerHeight }} className="p-4 sm:p-6">
                {children}
            </main>
        </div>
    );
}
