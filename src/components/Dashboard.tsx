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

type Props = {
  language: "ar" | "en";
  onLanguageChange: (lang: "ar" | "en") => void;
  onLogout: () => void;
  onNavigateTo: (page: PageType) => void;
};

type Service = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  group: string;
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

  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-gray-500">{language === "ar" ? "جارٍ التحميل..." : "Loading..."}</span>
      </div>
    );
  }

  const avatarOptionsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLUListElement>(null);

  const [showServices, setShowServices] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
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

  // --------------------------
  // تعريف الخدمات مع المجموعات
  // --------------------------
  const services: Service[] = [
    // 1️⃣ خدمات إدارية
    { id: "meetings", label: t.meetingSystem, icon: <CalendarDays className="w-5 h-5" />, group: language === "ar" ? "خدمات إدارية" : "Administrative" },
    { id: "parking", label: t.parkingManagement, icon: <Car className="w-5 h-5" />, group: language === "ar" ? "خدمات إدارية" : "Administrative" },
    { id: "materials", label: t.materialControl, icon: <Boxes className="w-5 h-5" />, group: language === "ar" ? "خدمات إدارية" : "Administrative" },
    { id: "visitors", label: t.visitorControl, icon: <Users className="w-5 h-5" />, group: language === "ar" ? "خدمات إدارية" : "Administrative" },

    // 2️⃣ الشركات
    { id: "guards-rating", label: t.guardsCompanyRating, icon: <Star className="w-5 h-5" />, group: language === "ar" ? "الشركات" : "Companies" },
    { id: "company-violations", label: language === "ar" ? "مخالفات الشركات" : "Company Violations", icon: <AlertTriangle className="w-5 h-5" />, group: language === "ar" ? "الشركات" : "Companies" },

    // 3️⃣ مخالفات الحراس
    { id: "guards-management", label: t.guardsManagement, icon: <ShieldUser className="w-5 h-5" />, group: language === "ar" ? "مخالفات الحراس" : "Guards Violations" },
    { id: "violations-management", label: t.violationsManagement, icon: <AlertTriangle className="w-5 h-5" />, group: language === "ar" ? "مخالفات الحراس" : "Guards Violations" },

    // 4️⃣ السلامة
    { id: "inspection", label: t.inspectionSystemTitle, icon: <ShieldCheck className="w-5 h-5" />, group: language === "ar" ? "السلامة" : "Safety" },
    { id: "risk", label: t.riskSystem, icon: <AlertTriangle className="w-5 h-5" />, group: language === "ar" ? "السلامة" : "Safety" },
    { id: "reports", label: t.reportsSystem, icon: <Bell className="w-5 h-5" />, group: language === "ar" ? "السلامة" : "Safety" },
    { id: "firstaid", label: t.firstAidSystem, icon: <LifeBuoy className="w-5 h-5" />, group: language === "ar" ? "السلامة" : "Safety" },
    { id: "fireext", label: t.fireExtSystem, icon: <Flame className="w-5 h-5" />, group: language === "ar" ? "السلامة" : "Safety" },

    // 5️⃣ الدعم
    { id: "complaints", label: t.complaintSystem, icon: <AlertTriangle className="w-5 h-5" />, group: language === "ar" ? "الدعم" : "Support" },
    { id: "support", label: t.supportSystem, icon: <Headset className="w-5 h-5" />, group: language === "ar" ? "الدعم" : "Support" },
  ];

  // --------------------------
  // دوال المفضلة والبحث
  // --------------------------
  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id]
    );
  };

  const filteredServices = services.filter((s) =>
    s.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedServices = filteredServices.reduce<Record<string, Service[]>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
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

  // --------------------------
  // إغلاق القوائم عند النقر خارجها
  // --------------------------
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

  // --------------------------
  // JSX الكامل للواجهة
  // --------------------------
  return (
    <div className="w-full h-full relative" dir={isRTL ? "rtl" : "ltr"}>
      
      {/* ----------------- الهيدر ----------------- */}
{/* ----------------- الهيدر ----------------- */}
<motion.header
  className="flex items-center justify-between p-4 bg-gray-50/95 rounded-b-2xl shadow-xl backdrop-blur-sm border-b border-gray-200"
  initial={{ y: -30, opacity: 0, scale: 0.98 }}
  animate={{ y: 0, opacity: 1, scale: 1 }}
  transition={{ type: "spring", stiffness: 280, damping: 28 }}
>
  <div className="flex items-center space-x-3 space-x-reverse">
    <button onClick={() => setShowServices((prev) => !prev)}>
      <Menu className="w-6 h-6" />
    </button>
    <div className="flex flex-col">
      <span className="font-semibold">{user.name_ar || user.name_en}</span>
      <span className="text-sm text-gray-500">{language === "ar" ? `رقم الوظيفة: ${user.job_id}` : `Job ID: ${user.job_id}`}</span>
    </div>
  </div>

  <div className="flex items-center space-x-3 space-x-reverse relative">
    <button onClick={() => onLanguageChange(language === "ar" ? "en" : "ar")} className="px-3 py-1 border rounded-lg">
      {language === "ar" ? "EN" : "ع"}
    </button>
    <img
      src={user.avatar || "/default/avatar.png"}
      alt="avatar"
      className="w-10 h-10 rounded-full cursor-pointer"
      onClick={() => setUserMenuOpen((prev) => !prev)}
    />
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

      {/* ----------------- البحث + الخدمات ----------------- */}
      <AnimatePresence>
        {showServices && (
          <>
            {/* الخلفية مع Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="fixed inset-0 bg-black backdrop-blur-sm z-30 pointer-events-none"
            />

            {/* قائمة الخدمات */}
            <motion.div
              initial={{ x: isRTL ? "100%" : "-100%", scale: 0.95, opacity: 0 }}
              animate={{ x: 0, scale: 1, opacity: 1 }}
              exit={{ x: isRTL ? "100%" : "-100%", scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 250, damping: 25, mass: 0.7 }}
              className="fixed inset-0 z-40 flex flex-col bg-gray-50 overflow-hidden"
            >
              {/* الهيدر الاحترافي */}
              <motion.div
                className="flex justify-between items-center p-4 rounded-b-2xl shadow-xl bg-gray-50/95 backdrop-blur-sm overflow-hidden border-b border-gray-200"
                initial={{ y: -30, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
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

              {/* المحتوى */}
              <motion.div
                className="p-6 overflow-y-auto flex-1 space-y-6"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
              >
                {/* مربع البحث الاحترافي */}
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
                {Object.entries(groupedServices).map(([group, items], index) => (
                  <motion.div
                    key={group}
                    className="bg-gray-100 rounded-2xl shadow-lg p-6 overflow-hidden border border-gray-200"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, delay: index * 0.2, ease: "easeOut" }}
                  >
                    <h3 className="text-lg font-semibold mb-4 text-blue-600">{group}</h3>
                    <motion.div
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
                    >
                      <AnimatePresence>
                        {items.map((service) => (
                          <motion.div
                            key={service.id}
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
                            <div className="flex items-center space-x-3 space-x-reverse">
                              <div className="p-2 bg-blue-600 rounded-full text-white shadow">
                                {service.icon}
                              </div>
                              <span className="font-medium text-gray-900">{service.label}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(service.id);
                              }}
                            >
                              {favorites.includes(service.id) ? (
                                <Star className="text-yellow-400 w-5 h-5" />
                              ) : (
                                <StarOff className="w-5 h-5 text-gray-500" />
                              )}
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ----------------- صفحة الملف الشخصي ----------------- */}
      {showProfile && (
        <div className="p-6 bg-gray-50 absolute inset-0 overflow-auto">
          <div className="text-gray-700 text-sm space-y-6">
            <div className="border border-gray-300 rounded-lg p-4 shadow-sm bg-white space-y-1">
              {language === "ar" ? (
                <>
                  <div><strong>الاسم (عربي):</strong> {user.name_ar}</div>
                  <div><strong>الاسم (إنجليزي):</strong> {user.name_en}</div>
                </>
              ) : (
                <>
                  <div><strong>Name (En):</strong> {user.name_en}</div>
                  <div><strong>Name (Ar):</strong> {user.name_ar}</div>
                </>
              )}
            </div>

            <div className="border border-gray-300 rounded-lg p-4 shadow-sm bg-white space-y-1">
              {language === "ar" ? (
                <div><strong>المسمى الوظيفي:</strong> {user.job_id ? `رقم الوظيفة: ${user.job_id}` : "-"}</div>
              ) : (
                <div><strong>Job Title:</strong> {user.job_id ? `Job ID: ${user.job_id}` : "-"}</div>
              )}
            </div>

            <div className="space-y-3">
              <div><strong>{language === "ar" ? "رقم الهاتف" : "Phone"}:</strong> {user.phone}</div>
              <div><strong>{language === "ar" ? "البريد الإلكتروني" : "Email"}:</strong> {user.email}</div>
              <div><strong>{language === "ar" ? "الرقم الوظيفي" : "Job Number"}:</strong> {user.job_number}</div>
              <div><strong>{language === "ar" ? "الحالة" : "Status"}:</strong> {user.status}</div>
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

      {/* ----------------- شاشة تغيير كلمة المرور ----------------- */}
      {showChangePassword && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md space-y-4 relative">
            <button onClick={() => setShowChangePassword(false)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"><X /></button>

            <h2 className="text-lg font-semibold">{language === "ar" ? "تغيير كلمة المرور" : "Change Password"}</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium">{language === "ar" ? "كلمة المرور القديمة" : "Old Password"}</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="mt-1 block w-full border rounded-lg p-2" />
                  <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute top-1/2 right-2 transform -translate-y-1/2 text-gray-500">
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {errors.oldPassword && <p className="text-red-500 text-sm">{errors.oldPassword}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium">{language === "ar" ? "كلمة المرور الجديدة" : "New Password"}</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 block w-full border rounded-lg p-2" />
                {errors.newPassword && <p className="text-red-500 text-sm">{errors.newPassword}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium">{language === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 block w-full border rounded-lg p-2" />
                {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword}</p>}
              </div>
            </div>

            {passwordChangeError && <p className="text-red-600 text-sm">{passwordChangeError}</p>}

            <div className="text-right">
              <button disabled={passwordChangeLoading} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">{language === "ar" ? "حفظ" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
