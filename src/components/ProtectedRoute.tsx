// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/UserContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  permissionKey?: string;
}

export const ProtectedRoute = ({ children, permissionKey }: ProtectedRouteProps) => {
  const { isLoading, user, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-white">جار التحميل...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permissionKey && !hasPermission(permissionKey)) {
    // --- THE FIX IS HERE ---
    // Changed user.uuid back to user.id to match the final User interface
    console.warn(`Access denied for user ${user.id} to permission key: ${permissionKey}`);
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};