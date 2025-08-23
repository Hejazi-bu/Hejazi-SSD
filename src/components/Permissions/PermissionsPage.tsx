// src/components/Permissions/PermissionsPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";

type Permission = {
  id: number;
  service_id?: number | null;
  sub_service_id?: number | null;
  sub_sub_service_id?: number | null;
  action?: string;
  label_ar: string;
  label_en: string;
  allowed?: boolean;
};

type SubSubService = {
  id: number;
  label_ar: string;
  label_en: string;
  permissions: Permission[];
};

type SubService = {
  id: number;
  label_ar: string;
  label_en: string;
  permissions: Permission[];
  sub_sub_services: SubSubService[];
};

type Service = {
  id: number;
  label_ar: string;
  label_en: string;
  permissions: Permission[];
  sub_services: SubService[];
};

type Props = {
  language: "ar" | "en";
  onLanguageChange: (lang: "ar" | "en") => void;
  onLogout: () => void;
  onNavigateTo: (page: string) => void;
};

const PermissionsPage: React.FC<Props> = ({ language, onLanguageChange, onLogout, onNavigateTo }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_permissions_hierarchy");
      if (error) throw error;

      const raw = data[0]?.permissions_json;
      let json: Service[] = [];
      if (raw) {
        json = typeof raw === "string" ? JSON.parse(raw) : raw;
      }

const normalizeService = (s: any): Service => {
  return {
    id: s.service_id,
    label_ar: s.label_ar,
    label_en: s.label_en,
    permissions: s.permissions || [],
    sub_services: (s.sub_services || []).map((sub: any) => {
      return {
        id: sub.sub_service_id,
        label_ar: sub.label_ar,
        label_en: sub.label_en,
        permissions: sub.permissions || [],
        sub_sub_services: (sub.sub_sub_services || []).map((subsub: any) => {
          return {
            id: subsub.sub_sub_service_id,
            label_ar: subsub.label_ar,
            label_en: subsub.label_en,
            permissions: subsub.permissions || []
          };
        })
      };
    })
  };
};


      setServices(json.map(normalizeService));
      console.log("Fetched and normalized permissions:", json);
    } catch (err) {
      console.error("Error fetching permissions:", err);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const toggle = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderPermissions = (permissions: Permission[]) => (
    <div className="flex flex-wrap gap-2 my-1">
      {permissions.map(p => (
        <div key={p.id} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
          <input type="checkbox" checked={p.allowed || false} readOnly />
          {p[`label_${language}`]}
          <button className="px-1"><Pencil className="w-4 h-4" /></button>
          <button className="px-1"><Trash2 className="w-4 h-4 text-red-500" /></button>
        </div>
      ))}
    </div>
  );

  const renderSubSubServices = (sub_sub_services: SubSubService[], parentKey: string) =>
    sub_sub_services.map(subsub => {
      const key = `${parentKey}-${subsub.id}`;
      const isOpen = !!expanded[key];
      return (
        <div key={subsub.id} className="ml-6 border-l-2 border-gray-300 pl-4">
          <div
            className="flex items-center justify-between cursor-pointer bg-gray-50 p-1 rounded my-1"
            onClick={() => toggle(key)}
          >
            <div className="flex items-center gap-1">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span>{subsub[`label_${language}`]}</span>
            </div>
            <button className="px-2 py-1 bg-green-500 text-white rounded">
              <Plus className="w-4 h-4 inline-block mr-1" /> {language === "ar" ? "إضافة" : "Add"}
            </button>
          </div>
          {isOpen && renderPermissions(subsub.permissions)}
        </div>
      );
    });

  const renderSubServices = (sub_services: SubService[], parentKey: string) =>
    sub_services.map(sub => {
      const key = `${parentKey}-${sub.id}`;
      const isOpen = !!expanded[key];
      return (
        <div key={sub.id} className="ml-4">
          <div
            className="flex items-center justify-between cursor-pointer bg-gray-100 p-1 rounded my-1"
            onClick={() => toggle(key)}
          >
            <div className="flex items-center gap-1">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-medium">{sub[`label_${language}`]}</span>
            </div>
            <button className="px-2 py-1 bg-green-500 text-white rounded">
              <Plus className="w-4 h-4 inline-block mr-1" /> {language === "ar" ? "إضافة" : "Add"}
            </button>
          </div>
          {isOpen && (
            <>
              {renderPermissions(sub.permissions)}
              {renderSubSubServices(sub.sub_sub_services, key)}
            </>
          )}
        </div>
      );
    });

  if (loading) return <div className="flex justify-center items-center min-h-screen text-lg">جار التحميل...</div>;

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "إدارة الصلاحيات" : "Permissions Management"}
        </h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 bg-blue-500 text-white rounded"
            onClick={() => onLanguageChange(language === "ar" ? "en" : "ar")}
          >
            {language === "ar" ? "English" : "عربي"}
          </button>
          <button
            className="px-3 py-1 bg-red-500 text-white rounded"
            onClick={onLogout}
          >
            {language === "ar" ? "تسجيل الخروج" : "Logout"}
          </button>
        </div>
      </div>

      {/* Services Tree */}
      {services.map(service => {
        const key = `service-${service.id}`;
        const isOpen = !!expanded[key];
        return (
          <div key={service.id} className="bg-white p-2 rounded shadow mb-4">
            <div
              className="flex items-center justify-between cursor-pointer bg-gray-200 p-2 rounded"
              onClick={() => toggle(key)}
            >
              <div className="flex items-center gap-1">
                {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                <span className="font-semibold text-lg">{service[`label_${language}`]}</span>
              </div>
              <button className="px-2 py-1 bg-green-500 text-white rounded">
                <Plus className="w-4 h-4 inline-block mr-1" /> {language === "ar" ? "إضافة" : "Add"}
              </button>
            </div>
            {isOpen && (
              <>
                {renderPermissions(service.permissions)}
                {renderSubServices(service.sub_services, key)}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PermissionsPage;
