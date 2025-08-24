// src/components/Dashboard.tsx
import React, { useState, useRef, useEffect } from "react";
import { useUser } from "./contexts/UserContext";
import type { PageType } from "../types/pages";
import { supabase } from "../lib/supabaseClient";
import {
  LogOut,
  X,
  Search,
  Star,
  StarOff,
  Settings,
  User as UserIcon,
  CalendarDays,
  Car,
  Boxes,
  Users,
  ShieldCheck,
  AlertTriangle,
  LifeBuoy,
  Flame,
  Bell,
  Headset,
  ShieldUser,
  Menu,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ar from "../locales/ar";
import en from "../locales/en";
import * as Icons from "lucide-react";
import { useNavigate } from "react-router-dom";

// =================== تعديل دالة الأيقونات ===================
const getIconComponent = (iconName: string): React.FC<React.SVGProps<SVGSVGElement>> => {
  return (Icons[iconName as keyof typeof Icons] as React.FC<React.SVGProps<SVGSVGElement>>) || Star;
};

type OnLanguageChange = (lang: "ar" | "en") => void;

type Props = {
  language: "ar" | "en";
  onLanguageChange: OnLanguageChange; // ⬅️ هنا التعديل
  onLogout: () => void;
  onNavigateTo: (page: PageType) => void;
};

type Service = {
  group_id: string;
  id: string;
  label_ar: string;
  label_en: string;
  label: string; // للعرض حسب اللغة
  icon?: string;
  group_ar: string;
  group_en: string;
  group: string; // للعرض حسب اللغة
  page?: string;
  is_allowed: boolean;
};

const Dashboard: React.FC<Props> = ({
  language,
  onLanguageChange,
  onLogout,
  onNavigateTo,
}) => {
  const t = language === "ar" ? ar : en;
  const isRTL = language === "ar";

  const { user } = useUser();

  const avatarOptionsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLUListElement>(null);

  const [showServices, setShowServices] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [avatarOptionsVisible, setAvatarOptionsVisible] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  const navigate = useNavigate();
  // ✅ حالة مؤقتة لإظهار جارِ الحفظ عند تبديل اللغة (اختياري لكن مفيد)
  const [isChangingLang, setIsChangingLang] = useState(false);

  // حالات الخدمات والمفضلات من القاعدة
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const isLoading = loadingServices || !user;
  const [userPermissions, setUserPermissions] = useState<string[]>([]); // ⬅️ هذا لتخزين IDs للخدمات المسموح بها

  const [pageReady, setPageReady] = useState(false); // ⬅️ صفحة جاهزة أم لا

  useEffect(() => {
    const fetchServices = async () => {
      if (!user) {
        setServices([]);
        setLoadingServices(false);
        setPageReady(true); // ✅ تأكد من وضعه هنا
        return;
      }

      setLoadingServices(true);

      try {
        const { data, error } = await supabase.rpc('get_user_permissions', { p_user_id: user.id });
        if (error) throw error;

        const allowedServices = (data as any[])
          .filter((s: any) => s.is_allowed)
          .map((s: any) => ({
            id: s.id,
            group_id: s.group_id, // ⬅️ هنا
            label_ar: s.label_ar,
            label_en: s.label_en,
            label: language === "ar" ? s.label_ar : s.label_en,
            icon: s.icon,
            group_ar: s.group_ar,
            group_en: s.group_en,
            group: language === "ar" ? s.group_ar : s.group_en,
            page: s.page,
            is_allowed: s.is_allowed,
          }));

        setServices(allowedServices);

      } catch (err) {
        console.error("Error fetching services:", err);
      } finally {
        setLoadingServices(false);
        setPageReady(true); // ✅ تأكد من أنه هنا أيضاً
      }
    };

    fetchServices();
  }, [user, language]);

  const filteredServices = services.filter((s: any) =>
    (language === "ar" ? s.label_ar : s.label_en)
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const groupedServices = filteredServices.reduce<Record<string, Service[]>>((acc, s) => {
    const groupName = language === "ar" ? s.group_ar : s.group_en;
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(s);
    return acc;
  }, {});

    const onServiceClick = (id: string, label: string) => {
      switch (id) {
        case "guards-rating":
          onNavigateTo("guards-rating");
          break;
        default:
          alert(
            language === "ar"
              ? `الخدمة "${label}" قيد البرمجة 🚧`
              : `"${label}" service is under construction 🚧`
          );
          break;
      }
    };

    // إغلاق القوائم عند النقر خارجها
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (avatarOptionsVisible && avatarOptionsRef.current && !avatarOptionsRef.current.contains(event.target as Node)) {
          setAvatarOptionsVisible(false);
        }
        if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
          setUserMenuOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [avatarOptionsVisible, userMenuOpen]);

    const handleToggleLanguage = () => {
      setIsChangingLang(true);
      const next = language === "ar" ? "en" : "ar";
      
      // حفظ اللغة في localStorage فقط
      localStorage.setItem("lang", next);
      onLanguageChange(next); // يُحدث واجهة المستخدم فورًا
      setIsChangingLang(false);
  };

  // JSX الكامل للواجهة
  return (
    <div className="w-full h-full relative" dir={isRTL ? "rtl" : "ltr"}>
      {/* ---------- شاشة التحميل المحسّنة ---------- */}
      <AnimatePresence>
        {!pageReady && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-800 text-white overflow-hidden perspective-1500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* ---------- خلفية ديناميكية سينمائية ---------- */}
            <motion.div
              className="absolute inset-0 bg-gradient-radial from-white/5 via-transparent to-black/50"
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            />

            {/* ---------- الكرة الزجاجية ثلاثية الأبعاد مع إضاءة ---------- */}
            <motion.div
              className="relative z-10 flex items-center justify-center w-52 h-52 rounded-full shadow-2xl"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              {/* الكرة الكريستالية */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-700/25 via-purple-700/25 to-blue-700/25 border border-white/20 shadow-xl backdrop-blur-lg"
                animate={{ rotateY: 360, rotateX: 15 }}
                transition={{ repeat: Infinity, duration: 14, ease: "linear" }}
              />

              {/* انعكاسات ضوء متغيرة */}
              <motion.div
                className="absolute inset-0 rounded-full blur-3xl"
                animate={{
                  background: [
                    'radial-gradient(circle, rgba(255,255,255,0.3), rgba(0,0,0,0))',
                    'radial-gradient(circle, rgba(255,220,180,0.35), rgba(0,0,0,0))',
                    'radial-gradient(circle, rgba(0,200,255,0.35), rgba(0,0,0,0))',
                    'radial-gradient(circle, rgba(255,255,255,0.3), rgba(0,0,0,0))'
                  ]
                }}
                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              />

              {/* شرارات وذرات ديناميكية */}
              {[...Array(50)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-white/70 shadow-md"
                  initial={{ x: 0, y: 0, opacity: 0.6 }}
                  animate={{
                    x: [0, Math.random() * 180 - 90, 0],
                    y: [0, Math.random() * 180 - 90, 0],
                    opacity: [0.6, 1, 0.6],
                    scale: [0.3, 1, 0.3]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 3 + Math.random() * 2,
                    ease: "easeInOut",
                    delay: Math.random() * 2
                  }}
                />
              ))}

              {/* نص اللوقو محفور على الكرة */}
              <div className="relative z-20 text-center">
                <div className="text-6xl font-extrabold tracking-wider text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.7)]">
                  Hejazi
                  <motion.div
                    className="absolute inset-0 text-white/20 blur-md mix-blend-overlay"
                    animate={{ y: [0, -8, 0], opacity: [0.2, 0.6, 0.2] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  >
                    Hejazi
                  </motion.div>
                </div>
                <div className="text-3xl font-semibold mt-1 opacity-90 drop-shadow-md">
                  SSD
                  <motion.div
                    className="absolute inset-0 text-white/20 blur-sm mix-blend-overlay"
                    animate={{ y: [0, -5, 0], opacity: [0.2, 0.6, 0.2] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  >
                    SSD
                  </motion.div>
                </div>
              </div>

              {/* حلقات تحميل شفافة ديناميكية */}
              <div className="absolute inset-0">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 border-4 border-white/25 rounded-full border-t-transparent border-b-transparent"
                    initial={{ scale: 0.75, rotate: 0 }}
                    animate={{ rotate: 360, scale: 1 }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.5 + i * 0.5,
                      ease: "linear",
                      delay: i * 0.3,
                    }}
                    style={{ opacity: 0.6 - i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>

            {/* نص التحميل السفلي */}
            <motion.div
              className="text-xl font-medium mt-10 tracking-wide z-10 text-center drop-shadow-md"
              animate={{ opacity: [0.7, 1, 0.7], y: [0, -6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              {language === "ar" ? "جاري تجهيز لوحة التحكم..." : "Preparing Dashboard..."}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================== الهيدر ================== */}
      <motion.header
        className="flex items-center justify-between p-4 bg-gray-50/95 rounded-b-2xl shadow-xl backdrop-blur-sm border-b border-gray-200"
        initial={{ y: -30, opacity: 0, scale: 0.98 }}
        animate={isLoading ? {} : { y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.2 }}
      >
        <div className="flex items-center space-x-3 space-x-reverse">
          <button onClick={() => setShowServices((prev) => !prev)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex flex-col">
            <span className="font-semibold">{t === ar ? user!.name_ar : user!.name_en}</span>
            <span className="text-sm text-gray-500">
              {t === ar ? `رقم الوظيفة: ${user!.job_id}` : `Job ID: ${user!.job_id}`}
            </span>
          </div>
        </div>

      <div className="flex items-center space-x-3 space-x-reverse relative">
        {/* ✅ زر تغيير اللغة */}
        <button
          onClick={handleToggleLanguage}
          disabled={isChangingLang}
          className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title={isChangingLang ? (language === "ar" ? "جارِ الحفظ..." : "Saving...") : ""}
        >
          {language === "ar" ? "EN" : "ع"}
        </button>

        {/* ✅ زر إدارة الصلاحيات */}
        <button
          onClick={() => navigate("/Users/Data")}
          className="px-3 py-1 border rounded-lg hover:bg-gray-100"
          title={language === "ar" ? "إدارة الصلاحيات" : "Manage Permissions"}
        >
          {language === "ar" ? "صلاحيات" : "Permissions"}
        </button>

        {/* ✅ صورة المستخدم */}
        <img
          src={user!.avatar_url || "/default/avatar.png"}
          alt="avatar"
          className="w-10 h-10 rounded-full cursor-pointer"
          onClick={() => setUserMenuOpen((prev) => !prev)}
        />

        {/* ✅ قائمة الملف الشخصي */}
        {userMenuOpen && (
          <motion.ul
            ref={userMenuRef}
            className="absolute top-14 right-0 bg-white border shadow-md rounded-lg py-2 w-40 space-y-1 z-50"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <li>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
                onClick={() => setShowProfile(true)}
              >
                {language === "ar" ? "الملف الشخصي" : "Profile"}
              </button>
            </li>
            <li>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
                onClick={onLogout}
              >
                {language === "ar" ? "تسجيل الخروج" : "Log Out"}
              </button>
            </li>
          </motion.ul>
        )}
      </div>
      </motion.header>

      {/* ================== البحث + الخدمات ================== */}
      <AnimatePresence>
        {showServices && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="fixed inset-0 bg-black backdrop-blur-sm z-30 pointer-events-none"
            />

            <motion.div
              initial={{ x: isRTL ? "100%" : "-100%", scale: 0.95, opacity: 0 }}
              animate={{ x: 0, scale: 1, opacity: 1 }}
              exit={{ x: isRTL ? "100%" : "-100%", scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 250, damping: 25, mass: 0.7 }}
              className="fixed inset-0 z-40 flex flex-col bg-gray-50 overflow-hidden"
            >
              <motion.div
                className="flex justify-between items-center p-4 rounded-b-2xl shadow-xl bg-gray-50/95 backdrop-blur-sm overflow-hidden border-b border-gray-200"
                initial={{ y: -30, opacity: 0, scale: 0.98 }}
                animate={isLoading ? {} : { y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -30, opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
              >
                <h2 className="text-xl font-bold text-gray-900">
                  {language === "ar" ? "الخدمات" : "Services"}
                </h2>
                <button
                  onClick={() => setShowServices(false)}
                  className="p-2 rounded-full hover:bg-gray-200 transition text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </motion.div>

              <motion.div
                className="p-6 overflow-y-auto flex-1 space-y-6"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
              >
                <motion.div
                  className="flex justify-center mb-6"
                  initial={{ opacity: 0, scale: 0.9, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  transition={{ type: "spring", stiffness: 250, damping: 20 }}
                >
                  <div className="relative w-full max-w-md">
                    <motion.input
                      type="text"
                      placeholder={language === "ar" ? "بحث..." : "Search..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full p-4 pl-12 rounded-3xl 
                                bg-white text-gray-900 placeholder-gray-500 
                                shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-400 
                                focus:shadow-lg transition-all duration-300"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500 animate-pulse" />
                  </div>
                </motion.div>
           
                {/* عرض الخدمات بالمجموعات */}
                {Object.entries(groupedServices).map(([groupName, items], groupIndex) => (
                  <motion.div
                    key={`${items[0]?.group_id || groupName}-${groupIndex}`} // استخدام index للمفتاح الفريد عند الحاجة
                    className="bg-gray-100 rounded-2xl shadow-lg p-6 overflow-hidden border border-gray-200"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <h3 className="text-lg font-semibold mb-4 text-blue-600">{groupName}</h3>
                    <motion.div
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
                    >
                      <AnimatePresence>
                        {items.map((service, serviceIndex) => {
                          const Icon = getIconComponent(service.icon || "");
                          return (
                            <motion.div
                              key={service.id || `${groupName}-service-${serviceIndex}`} // الآن index معرف
                              layout
                              initial={{ opacity: 0, y: 20, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -20, scale: 0.9 }}
                              whileHover={{
                                scale: 1.03,
                                boxShadow: "0px 12px 25px rgba(0,0,0,0.25)",
                                backgroundColor: "#e2e8f0",
                              }}
                              transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.5 }}
                              className="flex items-center justify-between p-4 rounded-xl cursor-pointer 
                                        bg-gray-50 border border-gray-50 shadow-md transition-colors duration-300"
                              onClick={() => onServiceClick(service.id, service.label)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-full text-white shadow">
                                  <Icon className="w-5 h-5" />
                                </div>
                                <span className="font-medium text-gray-900">{service.label}</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ---------- الملف الشخصي ---------- */}
      {showProfile && (
        <div className="p-6 bg-gray-50 absolute inset-0 overflow-auto">
          <div className="text-gray-700 text-sm space-y-6">
            <div className="border border-gray-300 rounded-lg p-4 shadow-sm bg-white space-y-1">
              {language === "ar" ? (
                <>
                  <div><strong>الاسم (عربي):</strong> {user!.name_ar}</div>
                  <div><strong>الاسم (إنجليزي):</strong> {user!.name_en}</div>
                </>
              ) : (
                <>
                  <div><strong>Name (En):</strong> {user!.name_en}</div>
                  <div><strong>Name (Ar):</strong> {user!.name_ar}</div>
                </>
              )}
            </div>

            <div className="border border-gray-300 rounded-lg p-4 shadow-sm bg-white space-y-1">
              {language === "ar" ? (
                <div><strong>المسمى الوظيفي:</strong> {user?.job_id ? `رقم الوظيفة: ${user?.job_id}` : "-"}</div>
              ) : (
                <div><strong>Job Title:</strong> {user?.job_id ? `Job ID: ${user?.job_id}` : "-"}</div>
              )}
            </div>

            <div className="space-y-3">
              <div><strong>{language === "ar" ? "رقم الهاتف" : "Phone"}:</strong> {user?.phone}</div>
              <div><strong>{language === "ar" ? "البريد الإلكتروني" : "Email"}:</strong> {user?.email}</div>
              <div><strong>{language === "ar" ? "الرقم الوظيفي" : "Job Number"}:</strong> {user?.job_number}</div>
              <div><strong>{language === "ar" ? "الحالة" : "Status"}:</strong> {user?.status}</div>
            </div>
          </div>

          <hr className="my-6" />

          <div className="text-center">
            <button onClick={() => setShowChangePassword(true)} className="text-blue-600 hover:underline font-medium">
              {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
            </button>
          </div>
        </div>
      )}

      {/* ---------- تغيير كلمة المرور ---------- */}
      {showChangePassword && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md space-y-4 relative">
            <button onClick={() => setShowChangePassword(false)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"><X /></button>
            <h2 className="text-lg font-semibold">{language === "ar" ? "تغيير كلمة المرور" : "Change Password"}</h2>
            <div className="space-y-3">
              <input type={showPassword ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder={language === "ar" ? "كلمة المرور القديمة" : "Old Password"} className="w-full p-3 border rounded-lg" />
              <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={language === "ar" ? "كلمة المرور الجديدة" : "New Password"} className="w-full p-3 border rounded-lg" />
              <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={language === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"} className="w-full p-3 border rounded-lg" />
              <div className="flex items-center space-x-2 space-x-reverse">
                <input type="checkbox" checked={showPassword} onChange={() => setShowPassword((prev) => !prev)} id="showPass" />
                <label htmlFor="showPass" className="text-sm">{language === "ar" ? "إظهار كلمة المرور" : "Show Password"}</label>
              </div>
            </div>
            <div className="text-right">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">{language === "ar" ? "حفظ" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;