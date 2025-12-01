import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './contexts/UserContext';
import { useServices } from './contexts/ServicesContext';
import LoadingScreen from './LoadingScreen';
import { PermissionStatusProvider } from './contexts/PermissionStatusContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  permissionKey?: string;
  dynamic?: boolean;
  level?: 'ss' | 'sss';
}

export const ProtectedRoute = ({ children, permissionKey: staticPermissionKey, dynamic = false, level }: ProtectedRouteProps) => {
  const { user, hasPermission, isLoading: authLoading } = useAuth();
  const { getPermissionKeyByPage, isLoading: servicesLoading, getParentServiceId } = useServices();
  const location = useLocation();
  const params = useParams<{ subServicePage?: string }>();

  if (authLoading || servicesLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  let finalPermissionKey = staticPermissionKey;
  let keyFound = true;

  // ✨ 1. متغير جديد لتخزين مفتاح الخدمة الرئيسية إذا كان المنع منها
  let deniedReasonKey: string | null = null;

  if (dynamic) {
    const pageSlug = params.subServicePage;
    if (pageSlug && level) {
      finalPermissionKey = getPermissionKeyByPage(pageSlug, level);
      if (finalPermissionKey === undefined) {
        keyFound = false;
      }
    }
  }

  const isAllowedByPage = keyFound && (!finalPermissionKey || hasPermission(finalPermissionKey));

  // ✨ 2. التحقق من صلاحية الخدمة الرئيسية بشكل منفصل
  if (finalPermissionKey) {
    const parentServiceId = getParentServiceId(finalPermissionKey);
    if (parentServiceId && !hasPermission(parentServiceId)) {
      deniedReasonKey = parentServiceId; // السبب هو منع الخدمة الرئيسية
    }
  }

  const isAllowed = isAllowedByPage && !deniedReasonKey;

  return (
    <PermissionStatusProvider value={{ isAllowed, deniedKey: deniedReasonKey || (!isAllowedByPage ? finalPermissionKey : null) }}>
      {children}
    </PermissionStatusProvider>
  );
};