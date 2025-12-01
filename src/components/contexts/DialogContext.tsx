// src/components/contexts/DialogContext.tsx
import React, { createContext, useContext, useState, ReactNode, useCallback, ElementType } from 'react';
import AlertDialog from '../AlertDialog';

export type DialogVariant = 'alert' | 'success' | 'info' | 'error' | 'confirm' | 'prompt' | 'toast';

export interface DialogOptions {
    title: string;
    message: string;
    variant: DialogVariant;
    onConfirm?: (notes?: string) => void;
    onCancel?: () => void;
    duration?: number;
    icon?: ElementType; 
    color?: 'red' | 'yellow' | 'orange' | 'blue' | 'green';
    // --- تعديل 3: إضافة خاصية لمنع الإغلاق ---
    // هذه الخاصية تمنع إغلاق مربع الحوار عند النقر على الخلفية أو الضغط على زر الهروب.
    isDismissable?: boolean; 
    // --- تعديل 3: إضافة دالة للتحقق من الإدخال ---
    // هذه الدالة تستقبل النص المُدخل وتعيد رسالة خطأ كنص إذا كان الإدخال غير صالح، أو `null` إذا كان صالحًا.
    validation?: (value: string) => string | null;
    confirmText?: string;
    cancelText?: string;
}

interface DialogContextProps {
    showDialog: (options: DialogOptions) => void;
    hideDialog: () => void;
}

const DialogContext = createContext<DialogContextProps | undefined>(undefined);

export const DialogProvider = ({ children }: { children: ReactNode }) => {
    // استخدمنا state فريد مع مفتاح id لضمان إعادة تفعيل الأنيميشن عند ظهور نفس نوع الحوار مرة أخرى
    const [dialogState, setDialogState] = useState<(DialogOptions & { id: number }) | null>(null);

    const showDialog = useCallback((options: DialogOptions) => {
        setDialogState({ ...options, id: Date.now() });
    }, []);

    const hideDialog = useCallback(() => {
        setDialogState(null);
    }, []);

    const renderAlertDialog = () => {
        if (!dialogState) return null;

        return (
            <AlertDialog
                key={dialogState.id} // استخدام المفتاح لإعادة إنشاء المكون
                isOpen={true}
                onClose={hideDialog}
                title={dialogState.title}
                message={dialogState.message}
                variant={dialogState.variant}
                onConfirm={dialogState.onConfirm}
                onCancel={dialogState.onCancel}
                autoCloseDuration={dialogState.duration}
                customIcon={dialogState.icon}
                customColor={dialogState.color}
                // --- تعديل 3: تمرير الخصائص الجديدة إلى المكون ---
                isDismissable={dialogState.isDismissable}
                validation={dialogState.validation}
                confirmText={dialogState.confirmText}
                cancelText={dialogState.cancelText}
            />
        );
    };

    return (
        <DialogContext.Provider value={{ showDialog, hideDialog }}>
            {children}
            {renderAlertDialog()}
        </DialogContext.Provider>
    );
};

export const useDialog = (): DialogContextProps => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
};