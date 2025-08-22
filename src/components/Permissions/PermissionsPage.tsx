// src/components/Permissions/PermissionsPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronRight, FaChevronDown } from "react-icons/fa";

type Props = {
  language: "ar" | "en";
  onLanguageChange?: (lang: "ar" | "en") => void;
  onLogout?: () => void | Promise<void>;  // ← أضف هذا السطر
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

type PermissionNode = {
  service_id?: number;
  sub_service_id?: number;
  sub_sub_service_id?: number;
  label_ar: string;
  label_en: string;
  is_allowed: boolean;
  sub_services: PermissionNode[];
  sub_sub_services: PermissionNode[];
};

const PermissionsPage: React.FC<Props> = ({ language, onLanguageChange, onNavigateTo }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<PermissionNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedServices, setExpandedServices] = useState<Record<number, boolean>>({});

  // RTL/LTR
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

  // جلب الصلاحيات عند اختيار المستخدم
  useEffect(() => {
    if (!selectedUser) return;
    const fetchPermissions = async () => {
      setLoading(true);
      const { data: servicesData } = await supabase.from("services").select("*").eq("status", "active").order("order", { ascending: true });
      const { data: subServicesData } = await supabase.from("sub_services").select("*").eq("status", "active").order("order", { ascending: true });
      const { data: subSubServicesData } = await supabase.from("sub_sub_services").select("*").eq("status", "active").order("order", { ascending: true });
      const { data: userPermsData } = await supabase.from("user_permissions").select("*").eq("user_id", selectedUser.id);

      const userPermMap = new Map<number, boolean>();
      userPermsData?.forEach((p: any) => userPermMap.set(p.permission_id, p.is_allowed));

      const tree: PermissionNode[] = servicesData?.map((s: any) => {
        const sub_services = (subServicesData ?? [])
          .filter((ss: any) => ss.service_id === s.id)
          .map((ss: any) => {
            const sub_sub_services = (subSubServicesData ?? [])
              .filter((sss: any) => sss.sub_service_id === ss.id)
              .map((sss: any) => ({
                sub_sub_service_id: sss.id,
                label_ar: sss.label_ar,
                label_en: sss.label_en,
                is_allowed: userPermMap.get(sss.id) ?? false,
                sub_services: [],
                sub_sub_services: [],
              }));
            return {
              sub_service_id: ss.id,
              label_ar: ss.label_ar,
              label_en: ss.label_en,
              is_allowed: userPermMap.get(ss.id) ?? false,
              sub_services: [],
              sub_sub_services,
            };
          });
        return {
          service_id: s.id,
          label_ar: s.label_ar,
          label_en: s.label_en,
          is_allowed: userPermMap.get(s.id) ?? false,
          sub_services,
          sub_sub_services: [],
        };
      }) || [];

      setPermissions(tree);
      setLoading(false);
    };
    fetchPermissions();
  }, [selectedUser]);

  // toggle صلاحية
  const togglePermissionNode = (node: PermissionNode) => {
    const recursiveToggle = (arr: PermissionNode[]): PermissionNode[] => {
      return arr.map((n) => {
        if (n === node) return { ...n, is_allowed: !n.is_allowed };
        return {
          ...n,
          sub_services: recursiveToggle(n.sub_services),
          sub_sub_services: recursiveToggle(n.sub_sub_services),
        };
      });
    };
    setPermissions((prev) => recursiveToggle(prev));
  };

  // expand/ collapse
  const toggleExpand = (serviceId: number) => {
    setExpandedServices((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }));
  };

  // حفظ الصلاحيات
  const savePermissions = async () => {
    if (!selectedUser) return;
    setLoading(true);

    const flattenPermissions = (nodes: PermissionNode[]): { permission_id?: number; is_allowed: boolean }[] => {
      let result: { permission_id?: number; is_allowed: boolean }[] = [];
      nodes.forEach((n) => {
        if (n.service_id) result.push({ permission_id: n.service_id, is_allowed: n.is_allowed });
        if (n.sub_service_id) result.push({ permission_id: n.sub_service_id, is_allowed: n.is_allowed });
        if (n.sub_sub_service_id) result.push({ permission_id: n.sub_sub_service_id, is_allowed: n.is_allowed });
        if (n.sub_services) result = result.concat(flattenPermissions(n.sub_services));
        if (n.sub_sub_services) result = result.concat(flattenPermissions(n.sub_sub_services));
      });
      return result;
    };

    const flatPerms = flattenPermissions(permissions);

    for (const perm of flatPerms) {
      const permission_id = perm.permission_id;
      const { data: existing } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", selectedUser.id)
        .eq("permission_id", permission_id)
        .single();

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

  // render خدمة/خدمة فرعية/فرعية الفرعية
const renderServiceCard = (node: PermissionNode, level: number = 0) => {
  const serviceId = node.service_id ?? node.sub_service_id ?? node.sub_sub_service_id ?? 0;
  const isExpanded = expandedServices[serviceId];
  const label = language === "ar" ? node.label_ar : node.label_en;

  // ألوان حسب المستوى
  const levelBg = level === 0 ? "bg-blue-100" : level === 1 ? "bg-blue-200" : "bg-blue-300";
  const levelBorder = level === 0 ? "border-blue-200" : level === 1 ? "border-blue-300" : "border-blue-400";

  return (
    <div key={serviceId} className={`${levelBg} rounded-xl shadow-md p-4 mb-3 hover:shadow-lg transition`}>
      <div
        className="flex justify-between items-center cursor-pointer select-none"
        onClick={() => toggleExpand(serviceId)}
      >
        <div className="flex items-center space-x-4 space-x-reverse">
          {/* Toggle touch-friendly */}
            <button
            onClick={(e) => { e.stopPropagation(); togglePermissionNode(node); }}
            className={`w-14 h-7 rounded-full flex items-center p-1 transition-colors duration-200 ${
                node.is_allowed ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"
            }`}
            >
            <span
                className="bg-white w-6 h-6 rounded-full shadow-md transition-transform duration-200"
            />
            </button>
          {/* اسم الخدمة */}
          <span className="font-semibold text-lg">{label}</span>
        </div>

        {/* سهم expand */}
        {node.sub_services.length > 0 || node.sub_sub_services.length > 0 ? (
          <span className="text-2xl text-gray-600">
            {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
          </span>
        ) : null}
      </div>

      {/* المحتوى الفرعي */}
      <AnimatePresence>
        {isExpanded && (node.sub_services.length > 0 || node.sub_sub_services.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`ml-6 border-l-4 pl-4 mt-3 ${levelBorder}`}
          >
            {node.sub_services.map((sub) => renderServiceCard(sub, level + 1))}
            {node.sub_sub_services.map((subsub) => renderServiceCard(subsub, level + 2))}
          </motion.div>
        )}
      </AnimatePresence>
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

      {/* Users */}
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
                {language === "ar" ? "عرض الصلاحيات" : "Permissions"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions Modal */}
      {showPermissions && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start p-4 sm:p-10 z-50 overflow-auto">
          <div className="bg-white p-6 rounded-lg w-full max-w-3xl shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{language === "ar" ? `صلاحيات ${selectedUser.name_ar}` : `Permissions ${selectedUser.name_en}`}</h2>
              <button onClick={() => setShowPermissions(false)} className="px-3 py-1 border rounded">X</button>
            </div>

            <div className="overflow-y-auto max-h-[60vh]">
              {loading ? <div>{language === "ar" ? "جاري التحميل..." : "Loading..."}</div> : permissions.map((node) => renderServiceCard(node))}
            </div>

            <div className="mt-4 flex justify-end space-x-2 space-x-reverse">
              <button
                onClick={savePermissions}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={loading}
              >
                {language === "ar" ? "حفظ" : "Save"}
              </button>
              <button
                onClick={() => setShowPermissions(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionsPage;
