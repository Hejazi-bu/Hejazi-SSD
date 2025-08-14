import React, { useState, useRef, useEffect } from "react";
import { FaRegFileAlt, FaHistory, FaChartBar } from "react-icons/fa";
import { Menu, Globe, HomeIcon } from "lucide-react";

type GuardsRatingPageProps = {
  language: "ar" | "en";
  onLanguageChange: (lang: "ar" | "en") => void;
  onNavigateTo: (page: string) => void;
};

function Sidebar({
  isOpen,
  onClose,
  language,
  onNavigateTo,
  currentServiceId,
}: {
  isOpen: boolean;
  onClose: () => void;
  language: "ar" | "en";
  onNavigateTo: (page: string) => void;
  currentServiceId: string;
}) {
  const isRTL = language === "ar";
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const services = [
    { id: "new-evaluation", labelAr: "تقييم جديد", labelEn: "New Evaluation", icon: <FaRegFileAlt className="w-5 h-5" /> },
    { id: "evaluation-records", labelAr: "سجل التقييمات", labelEn: "Evaluation Records", icon: <FaHistory className="w-5 h-5" /> },
    { id: "evaluation-reports", labelAr: "تقارير التقييمات", labelEn: "Evaluation Reports", icon: <FaChartBar className="w-5 h-5" /> },
  ];

  const handleClick = (id: string) => {
    onNavigateTo(id);
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto visible" : "opacity-0 pointer-events-none invisible"
        }`}
        onClick={onClose}
        aria-hidden="true"
      ></div>

      <aside
        ref={sidebarRef}
        className={`
          fixed top-0 bottom-0 z-50 w-64 bg-white shadow-lg
          transform transition-transform duration-300 ease-in-out
          ${isRTL ? "right-0" : "left-0"}
          ${isOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full"}
          flex flex-col
        `}
        role="menu"
        aria-label={language === "ar" ? "قائمة الخدمات" : "Services menu"}
      >
        <div className="p-4 border-b border-gray-300 flex justify-between items-center">
          <h2 className="text-lg font-bold">
            {language === "ar" ? "قائمة الخدمات" : "Services"}
          </h2>
          <button
            onClick={onClose}
            aria-label={language === "ar" ? "إغلاق القائمة" : "Close menu"}
            className="text-gray-600 hover:text-gray-900 focus:outline-none"
          >
            ✕
          </button>
        </div>

        <nav className="flex flex-col p-4 space-y-2 flex-grow">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => handleClick(service.id)}
              className={`text-start p-2 rounded hover:bg-blue-100 focus:outline-none flex items-center gap-2 ${
                service.id === currentServiceId
                  ? "bg-blue-200 font-bold text-blue-700"
                  : "text-gray-800"
              }`}
              role="menuitem"
            >
              {service.icon}
              <span>{language === "ar" ? service.labelAr : service.labelEn}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

function Header({ language, onLanguageChange, onNavigateTo }: GuardsRatingPageProps) {
  const isRTL = language === "ar";
  const baseButtonClass =
    "flex items-center font-semibold text-gray-900 hover:text-blue-600 focus:outline-none";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentServiceId = "evaluation-records";

  const navigateWithConfirm = (page: string) => {
    onNavigateTo(page);
    setSidebarOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 w-full bg-white shadow flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 z-50 ${
        isRTL ? "flex-row-reverse" : "flex-row"
      }`}
      style={{ gap: "1rem" }}
    >
      {isRTL ? (
        <>
          <button
            onClick={() => {
              onNavigateTo("dashboard");
              setSidebarOpen(false);
            }}
            className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row-reverse lg:gap-2`}
            aria-label="الرئيسية"
          >
            <HomeIcon className="w-6 h-6" />
            <span>الرئيسية</span>
          </button>

          <div className="text-lg font-bold text-gray-800 flex flex-col items-center">
            <span className="text-blue-600">سجل التقييمات</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row-reverse lg:gap-2`}
              aria-label="فتح القائمة"
              aria-expanded={sidebarOpen}
              aria-controls="sidebar-menu"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <Menu className="w-7 h-7" />
            </button>

            <div className="h-6 border-l border-gray-300 mx-2"></div>

            <button
              onClick={() => onLanguageChange("en")}
              className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row-reverse lg:gap-2`}
              aria-label="تغيير اللغة إلى الإنجليزية"
            >
              <Globe className="w-5 h-5" />
              <span>English</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row lg:gap-2`}
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              aria-controls="sidebar-menu"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <Menu className="w-7 h-7" />
            </button>

            <div className="h-6 border-l border-gray-300 mx-2"></div>

            <button
              onClick={() => onLanguageChange("ar")}
              className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row lg:gap-2`}
              aria-label="Change language to Arabic"
            >
              <span>العربية</span>
              <Globe className="w-5 h-5" />
            </button>
          </div>

          <div className="text-lg font-bold text-gray-800 flex flex-col items-center">
            <span className="text-blue-600">Evaluation Records</span>
          </div>

          <button
            onClick={() => {
              onNavigateTo("dashboard");
              setSidebarOpen(false);
            }}
            className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row lg:gap-2`}
            aria-label="Home"
          >
            <span>Home</span>
            <HomeIcon className="w-6 h-6" />
          </button>
        </>
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        language={language}
        onNavigateTo={navigateWithConfirm}
        currentServiceId={currentServiceId}
      />
    </header>
  );
}

export default function EvaluationRecordsPage({
  language,
  onLanguageChange,
  onNavigateTo,
}: GuardsRatingPageProps) {
  const isRTL = language === "ar";

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ textAlign: isRTL ? "right" : "left", minHeight: "100vh" }}>
      <Header
        language={language}
        onLanguageChange={onLanguageChange}
        onNavigateTo={onNavigateTo}
      />
      {/* فارغة الآن، سنضيف المحتوى لاحقًا */}
      <main className="mt-20 p-4">
        {/* المحتوى الفارغ */}
      </main>
    </div>
  );
}
