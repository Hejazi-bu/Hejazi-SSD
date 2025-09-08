import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./components/contexts/UserContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import HomePage from "./components/HomePage";
import AppSecurityPage from "./pages/admin/AppSecurityPage";
import NewEvaluationPage from "./components/GuardsRating/NewEvaluationPage";
import EvaluationRecordsPage from "./components/GuardsRating/EvaluationRecordsPage";
import JobPermissionsPage from "./pages/Permission/JobPermissionsPage";
// 👈 استيراد المكون الجديد هنا
import UserExceptionsPage from "./pages/Permission/UserExceptionsPage"; 
import LoadingScreen from "./components/LoadingScreen";

function App() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
      
      <Route
        path="/dashboard"
        element={<ProtectedRoute><HomePage /></ProtectedRoute>}
      />

      <Route
        path="/guards-rating"
        element={<ProtectedRoute permissionKey="s:5"><NewEvaluationPage /></ProtectedRoute>}
      />
      <Route
        path="/evaluation-records"
        element={<ProtectedRoute permissionKey="s:5"><EvaluationRecordsPage /></ProtectedRoute>}
      />

      <Route
          path="/admin/app-security"
          element={<ProtectedRoute permissionKey="ss:4"><AppSecurityPage /></ProtectedRoute>}
      />
      
      <Route
          path="/admin/job-permissions"
          element={
              <ProtectedRoute permissionKey="ss:8">
                  <JobPermissionsPage />
              </ProtectedRoute>
          }
      />
      
      {/* 👈 إضافة المسار الجديد هنا */}
      <Route
          path="/admin/user-exceptions"
          element={
              <ProtectedRoute permissionKey="ss:9">
                  <UserExceptionsPage />
              </ProtectedRoute>
          }
      />

      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

export default App;