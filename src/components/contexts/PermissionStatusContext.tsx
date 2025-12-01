import React, { useContext, createContext } from 'react';

// 1. تعريف شكل البيانات التي سنمررها
interface PermissionStatus {
    isAllowed: boolean;
    deniedKey: string | null | undefined;
}

// 2. إنشاء السياق بقيمة افتراضية (مسموح بالوصول)
const PermissionStatusContext = createContext<PermissionStatus>({ isAllowed: true, deniedKey: null });

// 3. إنشاء hook مخصص ليسهل استخدامه
export const usePermissionStatus = () => useContext(PermissionStatusContext);

// 4. تصدير الـ Provider لنستخدمه في ProtectedRoute
export const PermissionStatusProvider = PermissionStatusContext.Provider;