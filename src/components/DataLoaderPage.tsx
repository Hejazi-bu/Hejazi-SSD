// src/components/DataLoaderPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { useData } from "./contexts/DataContext";

export const DataLoaderPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setData } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  // هنا يمكن أن نمرر أسماء الجداول المطلوبة عبر query params
  const params = new URLSearchParams(location.search);
  const tables = params.get("tables")?.split(",") || [];
  const targetPath = params.get("target") || "/";

  const fetchTables = async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all(
        tables.map(async (table) => {
          const { data: rows, error } = await supabase.from(table).select("*");
          if (error) throw new Error(`فشل جلب جدول ${table}`);
          setData(table, rows ?? []);
        })
      );
      setLoading(false);
      navigate(targetPath);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        جارٍ تحميل البيانات...
      </div>
    );

  if (error)
    return (
      <div className="text-center p-4">
        <p className="mb-4 text-red-600">حدث خطأ أثناء جلب البيانات: {error}</p>
        <button
          onClick={fetchTables}
          className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800"
        >
          إعادة المحاولة
        </button>
      </div>
    );

  return null;
};
