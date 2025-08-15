import React, { useState, useRef, useEffect } from "react";
import { User } from "../types/user";
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
  user: User;
  onNavigateTo: (page: PageType) => void; // ✅ هنا بدل string استخدم PageType
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
  user,
  onNavigateTo,
}) => {
  const t = language === "ar" ? ar : en;
  const isRTL = language === "ar";
  const avatarOptionsRef = useRef<HTMLDivElement>(null);

  const [userState, setUserState] = useState<User>(user);
  const [showServices, setShowServices] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"admin" | "safety" | "support">("admin");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // تحسين: استخدام state للتحكم في إظهار قائمة خيارات الصورة
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
    if (id === "guards-rating") {
      onNavigateTo("guards-rating");
    } else {
      alert(
        language === "ar"
          ? `الخدمة "${label}" قيد البرمجة 🚧`
          : `"${label}" service is under construction 🚧`
      );
    }
  };

  // دالة رفع الصورة مع حذف القديمة
  const uploadAvatar = async (
    file: File,
    userId: string,
    oldAvatarUrl?: string
  ) => {
    try {
      if (oldAvatarUrl && oldAvatarUrl !== "/default/avatar.png") {
        const oldFilePath = oldAvatarUrl.split("/avatars/")[1];
        if (oldFilePath) {
          const { error: deleteError } = await supabase.storage
            .from("avatars")
            .remove([oldFilePath]);
          if (deleteError) {
            console.warn("Failed to delete old Picture:", deleteError.message);
          }
        }
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        alert(`Upload error: ${uploadError.message}`);
        throw uploadError;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        avatarOptionsVisible &&
        avatarOptionsRef.current &&
        !avatarOptionsRef.current.contains(event.target as Node)
      ) {
        setAvatarOptionsVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [avatarOptionsVisible]);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(""); // سنحتاجه من Supabase

  useEffect(() => {
    const getUserEmail = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setEmail(user.email);
    };
    getUserEmail();
  }, []);

  const userMenuRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  const [errors, setErrors] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isRTL ? "rtl" : "ltr"
      } bg-gradient-to-br from-gray-50 to-blue-50`}
    >
      {/* Header */}
      <header
        className={`bg-white shadow flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 ${
          isRTL ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* الصورة + الاسم */}
        <div className="relative flex items-center gap-3 min-w-0">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className={`flex items-center gap-3 focus:outline-none ${
              isRTL ? "flex-row-reverse" : "flex-row"
            }`}
            aria-haspopup="true"
            aria-expanded={userMenuOpen}
          >
            <img
              src={userState.avatar_url || "/default/avatar.png"}
              alt="User Picture"
              className="w-12 h-12 rounded-full object-cover border border-gray-300"
            />
            <div className={`truncate ${isRTL ? "text-right" : "text-left"}`}>
              <p className="text-lg font-semibold text-gray-900 truncate">
                {isRTL ? userState.name_ar : userState.name_en}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {isRTL ? userState.job_title_ar : userState.job_title_en}
              </p>
            </div>
          </button>

          {/* قائمة المستخدم */}
          {userMenuOpen && (
            <ul
              ref={userMenuRef}
              dir={isRTL ? "rtl" : "ltr"}
              className={`absolute top-full mt-2 ${
                isRTL ? "right-0 text-right" : "left-0 text-left"
              } bg-white rounded shadow-md py-2 w-48 z-50`}
              role="menu"
              aria-label={isRTL ? "قائمة المستخدم" : "User menu"}
            >
              <li
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                onClick={() => {
                  setUserMenuOpen(false);
                  setShowProfile(true);
                }}
                role="menuitem"
              >
                <UserIcon className="w-5 h-5" />
                {isRTL ? "بياناتي" : "My Profile"}
              </li>
              <li
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                onClick={() => alert(language === "ar" ? "خدمة الإعدادات والتحكم قيد البرمجة 🚧" : "Settings & Control service is under construction 🚧")}
                role="menuitem"
              >
                <Settings className="w-5 h-5" />
                {isRTL ? "الإعدادات والتحكم" : "Settings & Control"}
              </li>
              <li
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 text-red-600 font-semibold"
                onClick={() => {
                  const confirmed = window.confirm(
                    language === "ar"
                      ? "هل أنت متأكد أنك تريد تسجيل الخروج؟"
                      : "Are you sure you want to log out?"
                  );
                  if (confirmed) {
                    onLogout();
                  }
                }}
                role="menuitem"
              >
                <LogOut className="w-5 h-5" />
                {isRTL ? "تسجيل الخروج" : "Logout"}
              </li>
            </ul>
          )}
        </div>

        {/* زر الخدمات وزر اللغة */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {isRTL ? (
            <>
              <button
                onClick={() => setShowServices(true)}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg transition"
              >
                <Menu className="w-5 h-5" />
                خدمات
              </button>

              <button
                onClick={() => onLanguageChange("en")}
                className="flex items-center gap-1 px-3 py-1 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <Globe className="w-5 h-5" />
                English
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onLanguageChange("ar")}
                className="flex items-center gap-1 px-3 py-1 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 transition flex-row-reverse"
              >
                <Globe className="w-5 h-5" />
                العربية
              </button>

              <button
                onClick={() => setShowServices(true)}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg transition flex-row-reverse"
              >
                <Menu className="w-5 h-5" />
                Services
              </button>
            </>
          )}
        </div>
      </header>

      {/* الصفحة الرئيسية تحت التطوير */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 py-20 text-center">
        <img
          src="/under-construction.svg"
          alt="Under Construction"
          className="w-40 h-40 mx-auto mb-6"
        />
        <h2 className="text-2xl font-semibold text-gray-700">
          {language === "ar"
            ? "الصفحة الرئيسية قيد التطوير"
            : "Dashboard Under Construction"}
        </h2>
        <p className="mt-2 text-gray-500 max-w-xl">
          {language === "ar"
            ? "نحن نعمل على تطوير هذه الصفحة لتقديم أفضل تجربة لك."
            : "We are working hard to improve this page for you."}
        </p>
      </main>

      {/* صفحة بيانات المستخدم */}
      {showProfile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-6"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl relative overflow-y-auto max-h-[90vh]">
            {/* زر الإغلاق */}
            <button
              onClick={() => setShowProfile(false)}
              className={`absolute top-4 ${isRTL ? "left-4" : "right-4"} text-gray-500 hover:text-gray-700`}
              aria-label={language === "ar" ? "إغلاق" : "Close"}
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-xl font-bold mb-4 text-gray-800">
              {language === "ar" ? "بيانات المستخدم" : "User Information"}
            </h2>

            <div className="flex items-center gap-4 mb-4">
              <img
                src={userState.avatar_url || "/default/avatar.png"}
                alt="User Picture"
                className="w-20 h-20 rounded-full object-cover border border-gray-300 cursor-pointer"
                onClick={() => {
                  const url = userState.avatar_url || "/default/avatar.png";
                  window.open(url, "_blank");
                }}
              />

              <div className="flex flex-col gap-2">
                <div className="flex flex-col items-center gap-2 relative">
                  {/* زر الكاميرا - يفتح القائمة */}
                  <button
                    className="text-gray-600 hover:text-purple-600"
                    onClick={() => setAvatarOptionsVisible((v) => !v)}
                    title={language === "ar" ? "تعديل الصورة" : "Edit Picture"}
                  >
                    <Edit className="w-6 h-6" />
                  </button>

                  {/* زر الحذف - أيقونة سلة + تأكيد */}
                  {userState.avatar_url && userState.avatar_url !== "/default/avatar.png" && (
                    <button
                      onClick={async () => {
                        if (!userState.avatar_url) {
                          alert(language === "ar" ? "لا توجد صورة لإزالتها" : "No Picture to remove");
                          return;
                        }

                        const confirmDelete = window.confirm(
                          language === "ar"
                            ? "هل أنت متأكد أنك تريد إزالة الصورة؟"
                            : "Are you sure you want to remove the Picture?"
                        );
                        if (!confirmDelete) return;

                        const url = userState.avatar_url;
                        const filePath = url.split("/avatars/")[1];
                        if (!filePath) {
                          alert(language === "ar" ? "رابط الصورة غير صالح" : "Invalid Picture URL");
                          return;
                        }

                        const { error } = await supabase.storage.from("avatars").remove([filePath]);
                        if (error) {
                          alert(language === "ar" ? "فشل حذف الصورة" : "Failed to delete Picture");
                          return;
                        }

                        const { error: updateError } = await supabase
                          .from("users")
                          .update({ avatar_url: null })
                          .eq("id", userState.id);

                        if (updateError) {
                          alert(language === "ar" ? "حدث خطأ أثناء تحديث البيانات" : "Error updating user data");
                        } else {
                          alert(language === "ar" ? "تم إزالة الصورة بنجاح" : "Picture removed successfully");
                          setUserState((prev: User) => ({ ...prev, avatar_url: undefined }));
                        }
                      }}
                      className="text-red-500 hover:text-red-700"
                      title={language === "ar" ? "إزالة الصورة" : "Remove Picture"}
                    >
                      <Trash className="w-5 h-5" />
                    </button>
                  )}

                  {/* قائمة الخيارات (كاميرا / جهاز) */}
                  {avatarOptionsVisible && (
                    <div
                      ref={avatarOptionsRef}
                      dir={isRTL ? "rtl" : "ltr"}
                      className="absolute mt-2 bg-white border rounded shadow-md z-50 inline-block whitespace-nowrap"
                      style={{
                        [isRTL ? "right" : "left"]: 0,
                        minWidth: "fit-content",
                      }}
                    >
                      <div className="flex justify-between items-center px-3 py-1 border-b">
                        <span className="font-semibold text-gray-700">
                          {language === "ar" ? "خيارات" : "Options"}
                        </span>
                        <button
                          onClick={() => setAvatarOptionsVisible(false)}
                          aria-label={language === "ar" ? "إغلاق" : "Close"}
                          className="text-gray-500 hover:text-gray-700 focus:outline-none"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <ul className="text-sm text-gray-700">
                        <li>
                          <button
                            className="flex items-center gap-2 px-4 py-2 w-full hover:bg-gray-100"
                            onClick={() => {
                              alert(language === "ar" ? "الكاميرا قيد البرمجة" : "Camera is under development");
                              setAvatarOptionsVisible(false);
                            }}
                          >
                            <Camera className="w-5 h-5" />
                            {language === "ar" ? "كاميرا" : "Camera"}
                          </button>
                        </li>
                        <li>
                          <label className="flex items-center gap-2 px-4 py-2 w-full hover:bg-gray-100 cursor-pointer">
                            <UploadIcon className="w-5 h-5" /> {/* استبدل UploadIcon بالايقونة المناسبة */}
                            {language === "ar" ? "جهاز" : "Device"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const publicUrl = await uploadAvatar(
                                    file,
                                    userState.id,
                                    userState.avatar_url ?? undefined
                                  );
                                  if (publicUrl) {
                                    const { error } = await supabase
                                      .from("users")
                                      .update({ avatar_url: publicUrl })
                                      .eq("id", userState.id);
                                    if (!error) {
                                      setUserState((prev) => ({ ...prev, avatar_url: publicUrl }));
                                    }
                                  }
                                }
                                setAvatarOptionsVisible(false);
                              }}
                            />
                          </label>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div dir={language === "ar" ? "rtl" : "ltr"} className="text-gray-700 text-sm space-y-6">

              {/* الاسم */}
              <div className="border border-gray-300 rounded-lg p-4 shadow-sm bg-white space-y-1">
                {language === "ar" ? (
                  <>
                    <div>
                      <strong>الاسم (عربي):</strong> {userState.name_ar}
                    </div>
                    <div>
                      <strong>الاسم (إنجليزي):</strong> {userState.name_en}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>Name (En):</strong> {userState.name_en}
                    </div>
                    <div>
                      <strong>Name (Ar):</strong> {userState.name_ar}
                    </div>
                  </>
                )}
              </div>

              {/* المسمى الوظيفي */}
              <div className="border border-gray-300 rounded-lg p-4 shadow-sm bg-white space-y-1">
                {language === "ar" ? (
                  <>
                    <div>
                      <strong>المسمى الوظيفي (عربي):</strong> {userState.job_title_ar}
                    </div>
                    <div>
                      <strong>المسمى الوظيفي (إنجليزي):</strong> {userState.job_title_en}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>Job Title (En):</strong> {userState.job_title_en}
                    </div>
                    <div>
                      <strong>Job Title (Ar):</strong> {userState.job_title_ar}
                    </div>
                  </>
                )}
              </div>

              {/* باقي الحقول */}
              <div className="space-y-3">
                <div>
                  <strong>{language === "ar" ? "رقم الهاتف" : "Phone"}:</strong> {userState.phone}
                </div>
                <div>
                  <strong>{language === "ar" ? "البريد الإلكتروني" : "Email"}:</strong> {userState.email}
                </div>
                <div>
                  <strong>{language === "ar" ? "الرقم الوظيفي" : "Job Number"}:</strong> {userState.job_number}
                </div>
                <div>
                  <strong>{language === "ar" ? "الحالة" : "Status"}:</strong> {userState.status}
                </div>
              </div>
            </div>

            <hr className="my-6" />

            <div className="text-center">
              <button
                onClick={() => setShowChangePassword(true)}
                className="text-blue-600 hover:underline font-medium"
              >
                {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangePassword && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-10"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-auto relative shadow-lg mx-auto"
            style={{ minWidth: "320px" }}
          >
            <button
              onClick={() => {
                setShowChangePassword(false);
                setOldPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setPasswordChangeError(null);
                setShowPassword(false);
                setErrors({ oldPassword: "", newPassword: "", confirmPassword: "" });
              }}
              className={`absolute top-4 ${isRTL ? "left-4" : "right-4"} text-gray-500 hover:text-gray-700`}
              aria-label={language === "ar" ? "إغلاق" : "Close"}
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-xl font-bold mb-6 text-gray-800">
              {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
            </h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPasswordChangeError(null);

                const newErrors = { oldPassword: "", newPassword: "", confirmPassword: "" };

                if (!oldPassword) newErrors.oldPassword = language === "ar" ? "يرجى إدخال كلمة المرور الحالية." : "Please enter your current password.";
                if (!newPassword) newErrors.newPassword = language === "ar" ? "يرجى إدخال كلمة المرور الجديدة." : "Please enter the new password.";
                else if (newPassword.length < 6) newErrors.newPassword = language === "ar" ? "يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل." : "New password must be at least 6 characters.";
                if (!confirmPassword) newErrors.confirmPassword = language === "ar" ? "يرجى تأكيد كلمة المرور الجديدة." : "Please confirm the new password.";
                else if (newPassword !== confirmPassword) newErrors.confirmPassword = language === "ar" ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.";

                if (newPassword === oldPassword && newPassword) newErrors.newPassword = language === "ar" ? "كلمة المرور الجديدة لا يجب أن تكون مثل القديمة." : "New password should not be the same as the old password.";

                if (newErrors.oldPassword || newErrors.newPassword || newErrors.confirmPassword) {
                  setErrors(newErrors);
                  return;
                }

                setPasswordChangeLoading(true);

                const { error: signInError } = await supabase.auth.signInWithPassword({
                  email,
                  password: oldPassword,
                });

                if (signInError) {
                  setPasswordChangeLoading(false);
                  setErrors({ ...newErrors, oldPassword: language === "ar" ? "كلمة المرور الحالية غير صحيحة." : "Current password is incorrect." });
                  return;
                }

                const { error } = await supabase.auth.updateUser({
                  password: newPassword,
                });

                setPasswordChangeLoading(false);

                if (error) {
                  setPasswordChangeError(
                    language === "ar"
                      ? `حدث خطأ: ${error.message}`
                      : `An error occurred: ${error.message}`
                  );
                } else {
                  alert(language === "ar" ? "تم تغيير كلمة المرور بنجاح." : "Password changed successfully.");
                  setShowChangePassword(false);
                  setOldPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setShowPassword(false);
                  setErrors({ oldPassword: "", newPassword: "", confirmPassword: "" });
                }
              }}
            >
              <div className="mb-5">
                <label className="block mb-1 font-semibold" htmlFor="old-password">
                  {language === "ar" ? "كلمة المرور الحالية" : "Current Password"}
                </label>
                <input
                  id="old-password"
                  type={showPassword ? "text" : "password"}
                  value={oldPassword}
                  onChange={(e) => {
                    setOldPassword(e.target.value);
                    if (errors.oldPassword) setErrors((prev) => ({ ...prev, oldPassword: "" }));
                  }}
                  className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 ${
                    errors.oldPassword
                      ? "border-red-600 focus:ring-red-500"
                      : "border-gray-300 focus:ring-purple-500"
                  }`}
                  aria-invalid={errors.oldPassword ? "true" : "false"}
                  aria-describedby="old-password-error"
                />
                {errors.oldPassword && (
                  <p id="old-password-error" className="mt-1 text-red-600 text-sm font-medium">
                    {errors.oldPassword}
                  </p>
                )}
              </div>

              <div className="mb-5">
                <label className="block mb-1 font-semibold" htmlFor="new-password">
                  {language === "ar" ? "كلمة المرور الجديدة" : "New Password"}
                </label>
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errors.newPassword) setErrors((prev) => ({ ...prev, newPassword: "" }));
                  }}
                  className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 ${
                    errors.newPassword
                      ? "border-red-600 focus:ring-red-500"
                      : "border-gray-300 focus:ring-purple-500"
                  }`}
                  aria-invalid={errors.newPassword ? "true" : "false"}
                  aria-describedby="new-password-error"
                />
                {errors.newPassword && (
                  <p id="new-password-error" className="mt-1 text-red-600 text-sm font-medium">
                    {errors.newPassword}
                  </p>
                )}
              </div>

              <div className="mb-5">
                <label className="block mb-1 font-semibold" htmlFor="confirm-password">
                  {language === "ar" ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                  }}
                  className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 ${
                    errors.confirmPassword
                      ? "border-red-600 focus:ring-red-500"
                      : "border-gray-300 focus:ring-purple-500"
                  }`}
                  aria-invalid={errors.confirmPassword ? "true" : "false"}
                  aria-describedby="confirm-password-error"
                />
                {errors.confirmPassword && (
                  <p id="confirm-password-error" className="mt-1 text-red-600 text-sm font-medium">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex items-center gap-2 mb-5 text-purple-600 hover:text-purple-800 font-semibold"
                aria-label={
                  showPassword
                    ? language === "ar"
                      ? "إخفاء كلمة المرور"
                      : "Hide password"
                    : language === "ar"
                    ? "إظهار كلمة المرور"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <>
                    <EyeOff className="w-5 h-5" /> {language === "ar" ? "إخفاء كلمة المرور" : "Hide Password"}
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5" /> {language === "ar" ? "إظهار كلمة المرور" : "Show Password"}
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={passwordChangeLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded transition disabled:opacity-50"
              >
                {passwordChangeLoading
                  ? language === "ar"
                    ? "جاري تغيير كلمة المرور..."
                    : "Changing password..."
                  : language === "ar"
                  ? "تغيير كلمة المرور"
                  : "Change Password"}
              </button>

              {passwordChangeError && (
                <div className="mt-4 text-red-600 font-semibold text-center" role="alert">
                  {passwordChangeError}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* شاشة الخدمات */}
      {showServices && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex flex-col z-50 p-6 overflow-auto"
          dir={isRTL ? "rtl" : "ltr"}
          aria-modal="true"
          role="dialog"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">
              {language === "ar" ? "قائمة الخدمات" : "Services List"}
            </h2>
            <button
              onClick={() => setShowServices(false)}
              aria-label={language === "ar" ? "إغلاق" : "Close"}
              className="text-white hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-6">
            <div
              className={`relative text-gray-600 ${
                language === "ar" ? "text-right" : "text-left"
              }`}
            >
              <input
                type="search"
                placeholder={language === "ar" ? "ابحث عن خدمة..." : "Search services..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full rounded-md px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                  language === "ar" ? "pr-4 pl-10" : "pl-4 pr-10"
                }`}
                autoFocus
              />
              <Search
                className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${
                  language === "ar" ? "left-3" : "right-3"
                }`}
              />
            </div>
          </div>

          <div className="flex gap-4 mb-6 border-b border-gray-400">
            {["admin", "safety", "support"].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat as any)}
                className={`py-2 px-4 rounded-t-lg font-semibold transition ${
                  activeTab === cat
                    ? "bg-white text-purple-700 shadow"
                    : "text-white hover:bg-purple-600"
                }`}
              >
                {cat === "admin"
                  ? language === "ar"
                    ? "الخدمات الإدارية"
                    : "Administrative"
                  : cat === "safety"
                  ? language === "ar"
                    ? "الأمن والسلامة"
                    : "Safety & Security"
                  : language === "ar"
                  ? "الدعم والمساعدة"
                  : "Support"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {favorites.length > 0 && (
              <>
                <h3 className="text-white text-lg font-semibold col-span-full">
                  {language === "ar" ? "المفضلات" : "Favorites"}
                </h3>
                {favorites
                  .map((favId) => {
                    const svc = services[activeTab].find((s) => s.id === favId);
                    if (!svc) return null;
                    if (!svc.label.toLowerCase().includes(searchTerm.toLowerCase()))
                      return null;
                    return (
                      <div
                        key={svc.id}
                        onClick={() => onServiceClick(svc.id, svc.label)}
                        className="bg-purple-100 text-purple-900 rounded-lg p-4 flex items-center gap-3 cursor-pointer shadow hover:shadow-md transition"
                      >
                        {svc.icon}
                        <span className="font-semibold">{svc.label}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(svc.id);
                          }}
                          aria-label={
                            language === "ar"
                              ? "إزالة من المفضلات"
                              : "Remove from favorites"
                          }
                          className="ml-auto text-yellow-400 hover:text-yellow-500"
                        >
                          <Star className="w-5 h-5 fill-current" />
                        </button>
                      </div>
                    );
                  })}
              </>
            )}

            {filteredServices(activeTab).map((service) => {
              if (favorites.includes(service.id)) return null;
              return (
                <div
                  key={service.id}
                  onClick={() => onServiceClick(service.id, service.label)}
                  className="bg-white rounded-lg p-5 flex items-center justify-between gap-4 cursor-pointer shadow hover:shadow-lg transition"
                >
                  <div className="flex flex-col items-center gap-2 relative">
                    <div className="text-purple-700">{service.icon}</div>
                    <div className="font-semibold text-gray-900">{service.label}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(service.id);
                    }}
                    aria-label={
                      language === "ar"
                        ? "إضافة إلى المفضلات"
                        : "Add to favorites"
                    }
                    className="text-gray-400 hover:text-yellow-500"
                  >
                    <StarOff className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;