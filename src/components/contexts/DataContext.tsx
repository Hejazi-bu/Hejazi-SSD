// src/contexts/DataContext.tsx
import React, { createContext, useContext, ReactNode, useState } from "react";

interface DataContextType {
  data: Record<string, any[]>; // كل جدول كمصفوفة من الصفوف
  setData: (table: string, rows: any[]) => void; // إضافة أو تعديل جدول
  addTable: (table: string, rows?: any[]) => void; // إضافة جدول جديد
  updateTable: (table: string, rows: any[]) => void; // تعديل جدول موجود
  deleteTable: (table: string) => void; // حذف جدول
  clearData: () => void; // مسح كل الجداول
}

const DataContext = createContext<DataContextType>({
  data: {},
  setData: () => {},
  addTable: () => {},
  updateTable: () => {},
  deleteTable: () => {},
  clearData: () => {},
});

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [data, setDataState] = useState<Record<string, any[]>>({
    buildings: [],
    companies: [],
    jobs: [],
    sectors: [],
    security_evaluation_details: [],
    security_evaluations: [],
    security_questions: [],
    subbuildings: [],
    users: [],
    violation_sends: [],
    violation_types: [],
    violations: [],
  });

  const setData = (table: string, rows: any[]) => {
    setDataState((prev) => ({ ...prev, [table]: rows }));
  };

  const addTable = (table: string, rows: any[] = []) => {
    setDataState((prev) => {
      if (prev[table]) return prev; // الجدول موجود
      return { ...prev, [table]: rows };
    });
  };

  const updateTable = (table: string, rows: any[]) => {
    setDataState((prev) => {
      if (!prev[table]) {
        console.warn(`الجدول "${table}" غير موجود.`);
        return prev;
      }
      return { ...prev, [table]: rows };
    });
  };

  const deleteTable = (table: string) => {
    setDataState((prev) => {
      const newData = { ...prev };
      delete newData[table];
      return newData;
    });
  };

  const clearData = () => setDataState({});

  return (
    <DataContext.Provider
      value={{ data, setData, addTable, updateTable, deleteTable, clearData }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
