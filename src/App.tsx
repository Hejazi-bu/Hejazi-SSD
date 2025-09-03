import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./components/contexts/UserContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import HomePage from "./components/HomePage";
import { PermissionsPage } from "./pages/PermissionsPage";
import AppSecurityPage from "./pages/admin/AppSecurityPage";
import NewEvaluationPage from "./components/GuardsRating/NewEvaluationPage";
import EvaluationRecordsPage from "./components/GuardsRating/EvaluationRecordsPage";

function App() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-white bg-gray-900">جاري تحميل الجلسة...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guards-rating"
        element={
          <ProtectedRoute permissionKey="s:5">
            <NewEvaluationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/evaluation-records"
        element={
          <ProtectedRoute permissionKey="s:5"> 
            <EvaluationRecordsPage />
          </ProtectedRoute>
        }
      />
      <Route
          path="/admin/app-security"
          element={
              <ProtectedRoute permissionKey="sss:90101">
                  <AppSecurityPage />
              </ProtectedRoute>
          }
      />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

export default App;