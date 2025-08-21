// src/components/Permissions/PermissionsPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  language: "ar" | "en";
  onLanguageChange?: (lang: "ar" | "en") => void;
  onLogout?: () => void | Promise<void>; 
  onNavigateTo?: (page: string) => void;
};

type User = {
  id: string;
  name_ar?: string;
  name_en?: string;
  job_id?: number;
  email?: string;
  phone?: string;
  avatar?: string;
};

type Permission = {
  service_id: number;
  service_label_ar: string;
  service_label_en: string;
  sub_service_id?: number;
  sub_service_label_ar?: string;
  sub_service_label_en?: string;
  sub_sub_service_id?: number;
  sub_sub_service_label_ar?: string;
  sub_sub_service_label_en?: string;
  is_allowed: boolean;
};

const PermissionsPage: React.FC<Props> = ({ language, onLanguageChange, onNavigateTo }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // اتجاه الصفحة
  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  // جلب المستخدمين
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase.from("users").select("*");
      if (!error) {
        setUsers(data || []);
        setFilteredUsers(data || []);
      }
    };
    fetchUsers();
  }, []);

  // فلترة المستخدمين
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredUsers(
      users.filter((u) => {
        const name = language === "ar" ? u.name_ar : u.name_en;
        return (
          name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q) ||
          (u.job_id?.toString().includes(q) ?? false)
        );
      })
    );
  }, [searchQuery, users, language]);

  // جلب الصلاحيات
  useEffect(() => {
    if (!selectedUser) return;
    const fetchPermissions = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_user_permissions", { p_user_id: selectedUser.id });
      if (!error) setPermissions(data || []);
      setLoading(false);
    };
    fetchPermissions();
  }, [selectedUser]);

  const togglePermission = (perm: Permission) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.service_id === perm.service_id &&
        p.sub_service_id === perm.sub_service_id &&
        p.sub_sub_service_id === perm.sub_sub_service_id
          ? { ...p, is_allowed: !p.is_allowed }
          : p
      )
    );
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setLoading(true);
    for (const perm of permissions) {
      const permission_id = perm.sub_sub_service_id || perm.sub_service_id || perm.service_id;
      const { data: existing, error: fetchError } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", selectedUser.id)
        .eq("permission_id", permission_id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") continue;

      if (existing) {
        await supabase
          .from("user_permissions")
          .update({ is_allowed: perm.is_allowed })
          .eq("user_id", selectedUser.id)
          .eq("permission_id", permission_id);
      } else {
        await supabase.from("user_permissions").insert({
          user_id: selectedUser.id,
          permission_id,
          is_allowed: perm.is_allowed,
        });
      }
    }
    setLoading(false);
    alert(language === "ar" ? "تم حفظ الصلاحيات بنجاح" : "Permissions saved successfully");
  };

  const renderPermission = (perm: Permission, idx: number) => {
    const label = language === "ar"
      ? perm.sub_sub_service_label_ar || perm.sub_service_label_ar || perm.service_label_ar
      : perm.sub_sub_service_label_en || perm.sub_service_label_en || perm.service_label_en;

    const margin = perm.sub_sub_service_id ? "ml-8" : perm.sub_service_id ? "ml-4" : "";

    return (
      <div key={idx} className={`${margin} mb-2`}>
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={perm.is_allowed} onChange={() => togglePermission(perm)} />
          <span>{label}</span>
        </label>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-gray-50 shadow border-b border-gray-200">
        <div className="flex items-center space-x-3 space-x-reverse">
          <button onClick={() => onLanguageChange?.(language === "ar" ? "en" : "ar")} className="px-3 py-1 border rounded">
            {language === "ar" ? "EN" : "ع"}
          </button>
          <button onClick={() => onNavigateTo?.("/dashboard")} className="px-3 py-1 border rounded hover:bg-gray-100">
            {language === "ar" ? "العودة" : "Back"}
          </button>
        </div>
        <input
          type="text"
          placeholder={language === "ar" ? "بحث عن المستخدم..." : "Search user..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1 border rounded-lg w-64"
        />
      </header>

      {/* User Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((u) => (
            <div key={u.id} className="flex items-center p-4 bg-white rounded-xl shadow hover:shadow-lg transition">
              <img src={u.avatar || "/default/avatar.png"} className="w-16 h-16 rounded-full mr-3" />
              <div className="flex-1">
                <div className="font-semibold">{language === "ar" ? u.name_ar : u.name_en}</div>
                <div className="text-sm text-gray-500">{language === "ar" ? `رقم الوظيفة: ${u.job_id}` : `Job ID: ${u.job_id}`}</div>
                <div className="text-sm text-gray-500">{u.email}</div>
                <div className="text-sm text-gray-500">{u.phone}</div>
              </div>
              <button
                onClick={() => { setSelectedUser(u); setShowPermissions(true); }}
                className="px-3 py-1 border rounded hover:bg-gray-100"
              >
                {language === "ar" ? "عرض الصلاحيات" : "View Permissions"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Permissions */}
      <AnimatePresence>
        {showPermissions && selectedUser && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/30 p-4"
          >
            <motion.div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold">
                  {language === "ar" ? "صلاحيات المستخدم" : "User Permissions"}: {language === "ar" ? selectedUser.name_ar : selectedUser.name_en}
                </h2>
                <button onClick={() => setShowPermissions(false)} className="px-3 py-1 border rounded hover:bg-gray-100">
                  {language === "ar" ? "إغلاق" : "Close"}
                </button>
              </div>
              {loading ? (
                <div>{language === "ar" ? "جار التحميل..." : "Loading..."}</div>
              ) : (
                <>
                  {permissions.map(renderPermission)}
                  <button
                    onClick={savePermissions}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {language === "ar" ? "حفظ الصلاحيات" : "Save Permissions"}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PermissionsPage;
