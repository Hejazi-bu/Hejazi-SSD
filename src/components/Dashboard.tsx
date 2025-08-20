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
  id: string;
  label: string;
  icon?: string; // حفظ اسم الأيقونة كسلسلة
  group: string;
  page?: string;
};

// ========== FavoriteStar Component ==========
type StarButtonProps = {
  isFavorite: boolean;
  onClick: () => void;
  size?: number;
};

const StarButton: React.FC<StarButtonProps> = ({ isFavorite, onClick, size = 24 }) => {
  return (
    <motion.div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="cursor-pointer rounded-full p-1 flex items-center justify-center"
      whileHover={{ scale: 1.2, rotate: 5 }}
      whileTap={{ scale: 0.9, rotate: -5 }}
      animate={{ scale: isFavorite ? 1.3 : 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
    >
      {isFavorite ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
        >
          <Star
            className="text-yellow-400 drop-shadow-lg"
            fill="currentColor"
            stroke="none"
            width={size}
            height={size}
          />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0.8 }}
          whileHover={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          <StarOff
            className="text-gray-400"
            fill="none"
            strokeWidth={2}
            width={size}
            height={size}
          />
        </motion.div>
      )}
    </motion.div>
  );
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

  // ✅ حالة مؤقتة لإظهار جارِ الحفظ عند تبديل اللغة (اختياري لكن مفيد)
  const [isChangingLang, setIsChangingLang] = useState(false);

  // حالات الخدمات والمفضلات من القاعدة
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const isLoading = loadingServices || !user;

  const [pageReady, setPageReady] = useState(false); // ⬅️ صفحة جاهزة أم لا

  useEffect(() => {
    const fetchServices = async () => {
      if (!user) {
        setServices([]);
        setFavorites([]);
        setLoadingServices(false);
        setPageReady(true); // ⬅️ الصفحة جاهزة حتى لو لا يوجد مستخدم
        return;
      }

      setLoadingServices(true);

      try {
        const { data, error } = await supabase
          .from("services")
          .select(`id, label_ar, label_en, icon, page, group_id, service_groups(name_ar, name_en)`)
          .eq("status", "active")
          .order("order", { ascending: true });

        if (error) throw error;

        const formattedServices: Service[] = data.map((s: any) => ({
          id: s.id.toString(),
          label: language === "ar" ? s.label_ar : s.label_en,
          group: language === "ar" ? s.service_groups.name_ar : s.service_groups.name_en,
          icon: s.icon,
          page: s.page,
        }));

        setServices(formattedServices);

        const { data: favs } = await supabase
          .from("favorites")
          .select("service_id")
          .eq("user_id", user.id);

        setFavorites(favs ? favs.map((f: any) => f.service_id.toString()) : []);
      } catch (err) {
        console.error("Error fetching services:", err);
      } finally {
        setLoadingServices(false);
        setPageReady(true); // ⬅️ الصفحة أصبحت جاهزة
      }
    };

    fetchServices();
  }, [user, language]);

  // دوال المفضلة والبحث
  const toggleFavorite = async (serviceId: string) => {
    if (!user) return;

    if (favorites.includes(serviceId)) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("service_id", serviceId);
      setFavorites((prev) => prev.filter((f) => f !== serviceId));
    } else {
      await supabase.from("favorites").insert({
        user_id: user.id,
        service_id: serviceId,
      });
      setFavorites((prev) => [...prev, serviceId]);
    }
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
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-gray-900 to-blue-800 text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* ---------- الشعار المركزي ---------- */}
              <div className="text-center">
                <div className="text-6xl font-extrabold tracking-wide">Hejazi</div>
                <div className="text-2xl font-semibold mt-2 opacity-90">SSD</div>
              </div>

              {/* ---------- نقاط التحميل (رسمية + بسيطة) ---------- */}
              <div className="flex space-x-3 mt-10">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="w-4 h-4 rounded-full bg-white"
                    animate={{ y: [0, -12, 0], opacity: [0.6, 1, 0.6] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay,
                    }}
                  />
                ))}
              </div>

              {/* ---------- النص السفلي ---------- */}
              <motion.div
                className="text-lg font-medium mt-6 tracking-wide"
                animate={{ opacity: [0.7, 1, 0.7] }}
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
            <span className="font-semibold">{t === ar ? user?.name_ar : user?.name_en}</span>
            <span className="text-sm text-gray-500">{t === ar ? `رقم الوظيفة: ${user?.job_id}` : `Job ID: ${user?.job_id}`}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 space-x-reverse relative">
          {/* ✅ الزر يستدعي onLanguageChange عبر دالة موحّدة */}
          <button
            onClick={handleToggleLanguage}
            disabled={isChangingLang}
            className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title={isChangingLang ? (language === "ar" ? "جارِ الحفظ..." : "Saving...") : ""}
          >
            {language === "ar" ? "EN" : "ع"}
          </button>

          <img
            src={user?.avatar || "/default/avatar.png"}
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

                {/* ---------- مجموعة المفضلات ---------- */}
                {favorites.length > 0 && filteredServices.filter((s) => favorites.includes(s.id)).length > 0 && (
                  <motion.div
                    className="bg-yellow-50 rounded-2xl shadow-lg p-6 border border-yellow-200"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <h3 className="text-lg font-semibold mb-4 text-yellow-600">
                      {language === "ar" ? "المفضلات" : "Favorites"}
                    </h3>
                    <motion.div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                      <AnimatePresence>
                        {filteredServices
                          .filter((s) => favorites.includes(s.id))
                          .map((service) => {
                            const Icon = getIconComponent(service.icon || "");
                            return (
                              <motion.div
                                key={service.id}
                                layout
                                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                                whileHover={{ 
                                  scale: 1.03, 
                                  boxShadow: "0px 12px 25px rgba(0,0,0,0.25)", 
                                  backgroundColor: "#fef9c3" 
                                }}
                                transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.5 }}
                                className="flex items-center justify-between p-4 rounded-xl cursor-pointer bg-white border border-gray-100 shadow-md transition-colors duration-300"
                                onClick={() => onServiceClick(service.id, service.label)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-600 rounded-full text-white shadow">
                                    <Icon className="w-5 h-5" />
                                  </div>
                                  <span className="font-medium text-gray-900">{service.label}</span>
                                </div>
                                <StarButton
                                  isFavorite={favorites.includes(service.id)}
                                  onClick={() => toggleFavorite(service.id)}
                                  size={28}
                                />
                              </motion.div>
                            );
                          })}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                )}
                  
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
                        {items.map((service) => {
                          const Icon = getIconComponent(service.icon || "");
                          return (
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
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-full text-white shadow">
                                  <Icon className="w-5 h-5" />
                                </div>
                                <span className="font-medium text-gray-900">{service.label}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(service.id);
                                }}
                              >
                                <StarButton
                                  isFavorite={favorites.includes(service.id)}
                                  onClick={() => toggleFavorite(service.id)}
                                  size={28}
                                />
                              </button>
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
                  <div><strong>الاسم (عربي):</strong> {user?.name_ar}</div>
                  <div><strong>الاسم (إنجليزي):</strong> {user?.name_en}</div>
                </>
              ) : (
                <>
                  <div><strong>Name (En):</strong> {user?.name_en}</div>
                  <div><strong>Name (Ar):</strong> {user?.name_ar}</div>
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
