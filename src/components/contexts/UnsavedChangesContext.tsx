// C:\Users\user\Music\hejazi-logic\src\components\contexts\UnsavedChangesContext.tsx
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react'; // 💡 تم إضافة useEffect

interface UnsavedChangesContextType {
    isDirty: boolean;
    setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export const UnsavedChangesProvider = ({ children }: { children: ReactNode }) => {
    const [isDirty, setIsDirty] = useState(false);

    // 🌟🌟🌟 الكود المضاف هنا 🌟🌟🌟
    useEffect(() => {
        // دالة معالجة حدث قبل تفريغ الصفحة (إغلاق، تحديث، إلخ)
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (isDirty) {
                // منع الحدث وتعيين قيمة الإرجاع.
                // هذا الإجراء يفعّل رسالة التحذير الموحدة من المتصفح (الرسالة التي تريدها).
                event.preventDefault();
                event.returnValue = ''; // مطلوب لبعض المتصفحات
            }
        };

        if (isDirty) {
            // تفعيل المستمع فقط عندما يكون هناك تغييرات غير محفوظة
            window.addEventListener('beforeunload', handleBeforeUnload);
        } else {
            // إزالة المستمع عندما تكون الصفحة نظيفة (للسماح بالتنقل السلس)
            window.removeEventListener('beforeunload', handleBeforeUnload);
        }

        // دالة التنظيف: إزالة المستمع عند إزالة المكون أو عند إعادة تشغيل الـ Effect
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isDirty]); // 💡 يتم تشغيل هذا الـ Effect فقط عند تغيير isDirty
    // 🌟🌟🌟 نهاية الكود المضاف 🌟🌟🌟

    return (
        <UnsavedChangesContext.Provider value={{ isDirty, setIsDirty }}>
            {children}
        </UnsavedChangesContext.Provider>
    );
};

export const useUnsavedChanges = (): UnsavedChangesContextType => {
    const context = useContext(UnsavedChangesContext);
    if (!context) {
        throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
    }
    return context;
};