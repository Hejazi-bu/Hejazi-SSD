// src/components/Permissions/UserData.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronRight, FaChevronDown } from "react-icons/fa";
import { useUser, User } from "../contexts/UserContext";

type Props = {
  language: "ar" | "en";
  onLanguageChange?: (lang: "ar" | "en") => void;
  onNavigateTo?: (page: string) => void;
  onLogout?: () => Promise<void>;
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

const UserData: React.FC<Props> = ({ language, onLanguageChange, onNavigateTo }) => {
  const { user } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<PermissionNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedServices, setExpandedServices] = useState<Record<number, boolean>>({});

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

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

  useEffect(() => {
    if (!selectedUser) return;

    const fetchPermissionsAndServices = async () => {
      setLoading(true);
      try {
        const { data: servicesData, error: servicesError } = await supabase
          .from("services")
          .select("*")
          .order("id", { ascending: true });
        if (servicesError) throw servicesError;

        const { data: userPermsData } = await supabase
          .from("user_permissions")
          .select("*")
          .eq("user_id", selectedUser.id);

        const permsDict: Record<string, boolean> = {};
        if (userPermsData) {
          userPermsData.forEach((p: any) => {
            const key = `${p.service_id ?? 0}-${p.sub_service_id ?? 0}-${p.sub_sub_service_id ?? 0}`;
            permsDict[key] = p.is_allowed;
          });
        }

        const buildTree = async () => {
          return Promise.all(
            servicesData.map(async (service: any) => {
              const { data: subServices } = await supabase
                .from("sub_services")
                .select("*")
                .eq("service_id", service.id)
                .order("id", { ascending: true });

              const sub_services_with_sub_subs = await Promise.all(
                (subServices || []).map(async (sub: any) => {
                  const { data: subSubServices } = await supabase
                    .from("sub_sub_services")
                    .select("*")
                    .eq("sub_service_id", sub.id)
                    .order("id", { ascending: true });

                  return {
                    sub_service_id: sub.id,
                    label_ar: sub.label_ar,
                    label_en: sub.label_en,
                    is_allowed: permsDict[`0-${sub.id}-0`] ?? false, // المفتاح يجب أن يتوافق مع قاعدة البيانات
                    sub_services: [],
                    sub_sub_services: (subSubServices || []).map((ss: any) => ({
                      sub_sub_service_id: ss.id,
                      label_ar: ss.label_ar,
                      label_en: ss.label_en,
                      is_allowed: permsDict[`0-0-${ss.id}`] ?? false,
                      sub_services: [],
                      sub_sub_services: [],
                    })),
                  };
                })
              );

              return {
                service_id: service.id,
                label_ar: service.label_ar,
                label_en: service.label_en,
                is_allowed: permsDict[`${service.id}-0-0`] ?? false,
                sub_services: sub_services_with_sub_subs,
                sub_sub_services: [],
              };
            })
          );
        };

        const tree = await buildTree();
        setPermissions(tree);
      } catch (err) {
        console.error("Error fetching permissions or services:", err);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissionsAndServices();
  }, [selectedUser]);

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

  const toggleExpand = (serviceId: number) => {
    setExpandedServices((prev) => ({ ...prev, [serviceId]: !prev[serviceId] }));
  };

  const flattenPermissions = (nodes: PermissionNode[]): { key: string; node: PermissionNode }[] => {
    let result: { key: string; node: PermissionNode }[] = [];
    nodes.forEach((n) => {
      const key = `${n.service_id ?? 0}-${n.sub_service_id ?? 0}-${n.sub_sub_service_id ?? 0}`;
      result.push({ key, node: n });
      if (n.sub_services.length > 0) result = result.concat(flattenPermissions(n.sub_services));
      if (n.sub_sub_services.length > 0) result = result.concat(flattenPermissions(n.sub_sub_services));
    });
    return result;
  };

  const savePermissionsBatch = async () => {
    if (!selectedUser) return;
    setLoading(true);

    try {
      // جلب صلاحيات الوظيفة
      const { data: jobPermsData, error: jobError } = await supabase
        .from("job_permissions")
        .select("*")
        .eq("job_id", selectedUser.job_id);
      if (jobError) throw jobError;

      // جلب صلاحيات المستخدم
      const { data: userPermsData, error: userError } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", selectedUser.id);
      if (userError) throw userError;

      // تحويل البيانات إلى خرائط للوصول السريع
      const jobMap = new Map<string, boolean>();
      jobPermsData?.forEach((jp: any) => {
        const key = `${jp.service_id ?? 0}-${jp.sub_service_id ?? 0}-${jp.sub_sub_service_id ?? 0}`;
        jobMap.set(key, true);
      });

      const userMap = new Map<string, any>();
      userPermsData?.forEach((up: any) => {
        const key = `${up.service_id ?? 0}-${up.sub_service_id ?? 0}-${up.sub_sub_service_id ?? 0}`;
        userMap.set(key, up);
      });

      const flatPerms = flattenPermissions(permissions);

      const inserts: any[] = [];
      const updates: any[] = [];
      const deletes: any[] = [];

      for (const { key, node } of flatPerms) {
        const inJob = jobMap.has(key);
        const inUser = userMap.has(key);

        if (node.is_allowed) {
          if (inJob) {
            // true + موجود في job
            if (inUser) deletes.push({ service_id: node.service_id, sub_service_id: node.sub_service_id, sub_sub_service_id: node.sub_sub_service_id });
            // اذا غير موجود في user → تجاهل
          } else {
            // true + غير موجود في job
            if (inUser) {
              updates.push({
                user_id: selectedUser.id,
                service_id: node.service_id,
                sub_service_id: node.sub_service_id,
                sub_sub_service_id: node.sub_sub_service_id,
                is_allowed: true,
              });
            } else {
              inserts.push({
                user_id: selectedUser.id,
                service_id: node.service_id,
                sub_service_id: node.sub_service_id,
                sub_sub_service_id: node.sub_sub_service_id,
                is_allowed: true,
              });
            }
          }
        } else {
          if (inJob) {
            // false + موجودة في job → تحديث أو إضافة
            if (inUser) {
              updates.push({
                user_id: selectedUser.id,
                service_id: node.service_id,
                sub_service_id: node.sub_service_id,
                sub_sub_service_id: node.sub_sub_service_id,
                is_allowed: false,
              });
            } else {
              inserts.push({
                user_id: selectedUser.id,
                service_id: node.service_id,
                sub_service_id: node.sub_service_id,
                sub_sub_service_id: node.sub_sub_service_id,
                is_allowed: false,
              });
            }
          } else {
            // false + غير موجودة في job
            if (inUser) {
              deletes.push({ service_id: node.service_id, sub_service_id: node.sub_service_id, sub_sub_service_id: node.sub_sub_service_id });
            }
            // اذا غير موجودة في user → تجاهل
          }
        }
      }

      // تنفيذ الحذف
      for (const d of deletes) {
        let query = supabase.from("user_permissions").delete().eq("user_id", selectedUser.id);

        if (d.service_id != null) query = query.eq("service_id", d.service_id);
        else query = query.is("service_id", null);

        if (d.sub_service_id != null) query = query.eq("sub_service_id", d.sub_service_id);
        else query = query.is("sub_service_id", null);

        if (d.sub_sub_service_id != null) query = query.eq("sub_sub_service_id", d.sub_sub_service_id);
        else query = query.is("sub_sub_service_id", null);

        await query;
      }

      // تنفيذ الإضافة
      if (inserts.length > 0) await supabase.from("user_permissions").insert(inserts);

      // تنفيذ التحديث
      for (const u of updates) {
        let query = supabase.from("user_permissions").update({ is_allowed: u.is_allowed }).eq("user_id", u.user_id);

        if (u.service_id != null) query = query.eq("service_id", u.service_id);
        else query = query.is("service_id", null);

        if (u.sub_service_id != null) query = query.eq("sub_service_id", u.sub_service_id);
        else query = query.is("sub_service_id", null);

        if (u.sub_sub_service_id != null) query = query.eq("sub_sub_service_id", u.sub_sub_service_id);
        else query = query.is("sub_sub_service_id", null);

        await query;
      }

      alert(language === "ar" ? "تم حفظ الصلاحيات بنجاح" : "Permissions saved successfully");
    } catch (err) {
      console.error("خطأ أثناء حفظ الصلاحيات:", err);
      alert(language === "ar" ? "حدث خطأ أثناء الحفظ" : "Error saving permissions");
    } finally {
      setLoading(false);
    }
  };

  const renderServiceCard = (node: PermissionNode, level: number = 0, parentKey: string = "") => {
    const serviceId = node.service_id ?? node.sub_service_id ?? node.sub_sub_service_id ?? 0;
    const isExpanded = expandedServices[serviceId];
    const label = language === "ar" ? node.label_ar : node.label_en;

    const levelBg = level === 0 ? "bg-blue-100" : level === 1 ? "bg-blue-200" : "bg-blue-300";
    const levelBorder = level === 0 ? "border-blue-200" : level === 1 ? "border-blue-300" : "border-blue-400";

    const key = `${parentKey}-${serviceId}-${level}-${label}`;
    const hasChildren = node.sub_services.length + node.sub_sub_services.length > 0;

    return (
      <div key={key} className={`${levelBg} rounded-xl shadow-md p-4 mb-3 hover:shadow-lg transition`}>
        <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => toggleExpand(serviceId)}>
          <div className="flex items-center space-x-4 space-x-reverse">
            <button
              onClick={(e) => { e.stopPropagation(); togglePermissionNode(node); }}
              className={`w-14 h-7 rounded-full flex items-center p-1 transition-colors duration-200 ${node.is_allowed ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"}`}
            >
              <span className="bg-white w-6 h-6 rounded-full shadow-md transition-transform duration-200" />
            </button>
            <span className="font-semibold text-lg">{label}</span>
          </div>
          {hasChildren && (
            <span className="text-2xl text-gray-600">{isExpanded ? <FaChevronDown /> : <FaChevronRight />}</span>
          )}
        </div>

        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`ml-6 border-l-4 pl-4 mt-3 ${levelBorder}`}
            >
              {node.sub_services.map((sub) => renderServiceCard(sub, level + 1, key))}
              {node.sub_sub_services.map((subsub) => renderServiceCard(subsub, level + 2, key))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900">
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

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((u) => (
            <div key={u.id} className="flex items-center p-4 bg-white rounded-xl shadow hover:shadow-lg transition">
              <img src={u.avatar_url || "/default/avatar.png"} className="w-16 h-16 rounded-full mr-3" />
              <div className="flex-1">
                <div className="font-semibold">{language === "ar" ? u.name_ar : u.name_en}</div>
                <div className="text-sm text-gray-500">{language === "ar" ? `رقم الوظيفة: ${u.job_id}` : `Job ID: ${u.job_id}`}</div>
                <div className="text-sm text-gray-500">{u.email}</div>
                <div className="text-sm text-gray-500">{u.phone}</div>
              </div>
              <button onClick={() => { setSelectedUser(u); setShowPermissions(true); }} className="px-3 py-1 border rounded hover:bg-gray-100">
                {language === "ar" ? "عرض الصلاحيات" : "Permissions"}
              </button>
            </div>
          ))}
        </div>
      </div>

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
              <button onClick={savePermissionsBatch} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" disabled={loading}>
                {language === "ar" ? "حفظ" : "Save"}
              </button>
              <button onClick={() => setShowPermissions(false)} className="px-4 py-2 border rounded hover:bg-gray-100">
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserData;
