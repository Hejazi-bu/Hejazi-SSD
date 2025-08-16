// src/components/Dashboard.tsx
import React, { useState, useRef, useEffect } from "react";
import { useUser, User } from "./contexts/UserContext";
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
  HelpCircle,
  FileWarning,
  Headset,
  ShieldUser,
  Menu,
  Globe,
  Camera,
  Trash,
  Edit,
  UploadIcon,
  Eye,
  EyeOff,
} from "lucide-react";
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
};

const Dashboard: React.FC<Props> = ({
  language,
  onLanguageChange,
  onLogout,
  onNavigateTo,
}) => {
  const t = language === "ar" ? ar : en;
  const isRTL = language === "ar";

  const { user, setUser } = useUser();

  // ✅ إذا لم يكن هناك مستخدم، نعرض شاشة تحميل
  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-gray-500">{language === "ar" ? "جارٍ التحميل..." : "Loading..."}</span>
      </div>
    );
  }

  const avatarOptionsRef = useRef<HTMLDivElement>(null);

  const [showServices, setShowServices] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"admin" | "safety" | "support">("admin");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [avatarOptionsVisible, setAvatarOptionsVisible] = useState(false);

  const services: Record<string, Service[]> = {
    admin: [
      { id: "meetings", label: t.meetingSystem, icon: <CalendarDays className="w-5 h-5" /> },
      { id: "parking", label: t.parkingManagement, icon: <Car className="w-5 h-5" /> },
      { id: "materials", label: t.materialControl, icon: <Boxes className="w-5 h-5" /> },
      { id: "visitors", label: t.visitorControl, icon: <Users className="w-5 h-5" /> },
      { id: "guards-rating", label: t.guardsCompanyRating, icon: <Star className="w-5 h-5" /> },
      { id: "guards-management", label: t.guardsManagement, icon: <ShieldUser className="w-5 h-5" /> },
      { id: "violations-management", label: t.violationsManagement, icon: <AlertTriangle className="w-5 h-5" /> },
    ],
    safety: [
      { id: "inspection", label: t.inspectionSystemTitle, icon: <ShieldCheck className="w-5 h-5" /> },
      { id: "risk", label: t.riskSystem, icon: <AlertTriangle className="w-5 h-5" /> },
      { id: "reports", label: t.reportsSystem, icon: <Bell className="w-5 h-5" /> },
      { id: "firstaid", label: t.firstAidSystem, icon: <LifeBuoy className="w-5 h-5" /> },
      { id: "fireext", label: t.fireExtSystem, icon: <Flame className="w-5 h-5" /> },
    ],
    support: [
      { id: "complaints", label: t.complaintSystem, icon: <FileWarning className="w-5 h-5" /> },
      { id: "support", label: t.supportSystem, icon: <Headset className="w-5 h-5" /> },
    ],
  };

  const filteredServices = (category: string) =>
    services[category].filter((s) =>
      s.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id]
    );
  };

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

  const uploadAvatar = async (file: File, userId: string, oldAvatarUrl?: string) => {
    try {
      if (oldAvatarUrl && oldAvatarUrl !== "/default/avatar.png") {
        const oldFilePath = oldAvatarUrl.split("/avatars/")[1];
        if (oldFilePath) {
          const { error: deleteError } = await supabase.storage.from("avatars").remove([oldFilePath]);
          if (deleteError) console.warn("Failed to delete old Picture:", deleteError.message);
        }
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (avatarOptionsVisible && avatarOptionsRef.current && !avatarOptionsRef.current.contains(event.target as Node)) {
        setAvatarOptionsVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarOptionsVisible]);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const email = user.email;

  const userMenuRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const [errors, setErrors] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // --------------------------
  // JSX الكامل للواجهة
  // --------------------------
  return (
    <div className="w-full h-full relative">
      {/* صفحة الملف الشخصي */}
      {showProfile && (
        <div className="p-6" dir={isRTL ? "rtl" : "ltr"}>
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

      {/* شاشة تغيير كلمة المرور */}
      {showChangePassword && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" dir={isRTL ? "rtl" : "ltr"}>
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
              <button disabled={passwordChangeLoading} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                {language === "ar" ? "حفظ" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* خدمات المستخدم */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <input type="text" placeholder={language === "ar" ? "بحث..." : "Search..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border p-2 rounded-lg w-full max-w-xs" />
        </div>

        <div className="flex space-x-4 space-x-reverse">
          {(["admin", "safety", "support"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg ${activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
              {t[tab as keyof typeof t]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          {filteredServices(activeTab).map((service) => (
            <div key={service.id} className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-100" onClick={() => onServiceClick(service.id, service.label)}>
              {service.icon}
              <span className="flex-1">{service.label}</span>
              <button onClick={() => toggleFavorite(service.id)}>
                {favorites.includes(service.id) ? <Star className="text-yellow-400" /> : <StarOff />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
