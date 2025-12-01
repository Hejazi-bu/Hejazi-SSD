// src/components/NavigationBlocker.tsx
import React, { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useUnsavedChanges } from './contexts/UnsavedChangesContext';
import { useDialog } from './contexts/DialogContext';
import { useLanguage } from './contexts/LanguageContext';

const translations = {
  ar: {
    title: "تغييرات غير محفوظة",
    message: "لديك تغييرات غير محفوظة. هل أنت متأكد من أنك تريد مغادرة هذه الصفحة؟ سيتم فقدان التغييرات.",
    confirmButton: "مغادرة",
    cancelButton: "البقاء"
  },
  en: {
    title: "Unsaved Changes",
    message: "You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.",
    confirmButton: "Leave",
    cancelButton: "Stay"
  }
};

export function NavigationBlocker() {
  const { isDirty } = useUnsavedChanges();
  const { showDialog } = useDialog();
  const { language } = useLanguage();
  const t = translations[language];

  // هذا الـ hook سيمنع التنقل إذا كان الشرط صحيحاً
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    // عندما يتم تفعيل المنع، تتغير حالة الـ blocker إلى 'blocked'
    if (blocker.state === 'blocked') {
      showDialog({
        variant: 'confirm',
        title: t.title,
        message: t.message,
        confirmText: t.confirmButton, // نص زر التأكيد
        cancelText: t.cancelButton,   // نص زر الإلغاء
        onConfirm: () => blocker.proceed(), // إذا وافق المستخدم، استكمل التنقل
        onCancel: () => blocker.reset(),    // إذا رفض المستخدم، ألغِ التنقل
      });
    }
  }, [blocker, showDialog, t]);

  // هذا المكون لا يعرض أي شيء على الشاشة
  return null;
}