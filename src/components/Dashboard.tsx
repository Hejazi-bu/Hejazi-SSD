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
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <div className="flex items-center space-x-3 space-x-reverse">
          <button onClick={() => setShowServices((prev) => !prev)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex flex-col">
            <span className="font-semibold">{user.name_ar || user.name_en}</span>
            <span className="text-sm text-gray-500">{language === "ar" ? `رقم الوظيفة: ${user.job_id}` : `Job ID: ${user.job_id}`}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
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
            <ul ref={userMenuRef} className="absolute top-16 right-4 bg-white border shadow-md rounded-lg py-2 w-40 space-y-1 z-50">
              <li><button className="w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => setShowProfile(true)}>{language === "ar" ? "الملف الشخصي" : "Profile"}</button></li>
              <li><button className="w-full text-left px-4 py-2 hover:bg-gray-100" onClick={onLogout}>{language === "ar" ? "تسجيل الخروج" : "Log Out"}</button></li>
            </ul>
          )}
        </div>
      </header>

      {/* ----------------- البحث + الخدمات ----------------- */}
      <AnimatePresence>
        {showServices && (
          <motion.div
            initial={{ x: isRTL ? "100%" : "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isRTL ? "100%" : "-100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 bg-gray-50 z-40 flex flex-col"
          >
            {/* زر الإغلاق */}
            <div className="flex justify-between items-center p-4 border-b shadow bg-white">
              <h2 className="text-xl font-bold">
                {language === "ar" ? "الخدمات" : "Services"}
              </h2>
              <button
                onClick={() => setShowServices(false)}
                className="p-2 rounded-full hover:bg-gray-200 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* مربع البحث */}
              <div className="flex justify-center mb-6">
                <input
                  type="text"
                  placeholder={language === "ar" ? "بحث..." : "Search..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border p-3 rounded-lg w-full max-w-md shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>

              {/* عرض الخدمات بالمجموعات */}
              {Object.entries(groupedServices).map(([group, items]) => (
                <div key={group} className="bg-white shadow-lg rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-blue-600">{group}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {items.map((service) => (
                      <motion.div
                        key={service.id}
                        whileHover={{ scale: 1.03, y: -2 }}
                        className="flex items-center justify-between p-4 rounded-xl cursor-pointer shadow-md bg-gradient-to-br from-gray-50 to-gray-100 hover:from-white hover:to-gray-50 transition"
                        onClick={() => onServiceClick(service.id, service.label)}
                      >
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <div className="p-2 bg-blue-50 rounded-full text-blue-500">
                            {service.icon}
                          </div>
                          <span className="font-medium">{service.label}</span>
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
                            <StarOff className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
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
