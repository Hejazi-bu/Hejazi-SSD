// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./components/contexts/UserContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import HomePage from "./components/HomePage";
import { JobPermissionsPage } from "./pages/admin/JobPermissionsPage";

function App() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-white">جاري التحميل...</div>;
  }

  return (
    <Routes>
      {/* --- Public Routes --- */}
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
      
      {/* --- Protected Routes --- */}
      <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />

      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        } 
      />
      
      {/* --- Admin Route --- */}
      {/* Example permission key: ss:901 */}
      <Route 
        path="/admin/job-permissions" 
        element={
          <ProtectedRoute permissionKey="ss:901">
            <JobPermissionsPage />
          </ProtectedRoute>
        } 
      />

      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

export default App;
