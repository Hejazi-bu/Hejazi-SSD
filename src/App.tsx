import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./components/contexts/UserContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import HomePage from "./components/HomePage";
import { JobPermissionsPage } from "./pages/admin/JobPermissionsPage";
import GuardsRatingPage from "./components/GuardsRating/NewEvaluationPage";
import { EvaluationRecordsPage } from "./components/GuardsRating/EvaluationRecordsPage";

// 1. استيراد التصميم المشترك الجديد
import GuardsRatingLayout from "./components/GuardsRating/GuardsRatingLayout";

function App() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-white">جاري التحميل...</div>;
  }

  const guardsRatingTranslations = {
    ar: { new: "تقييم جديد", records: "سجل التقييمات" },
    en: { new: "New Evaluation", records: "Evaluation Records" }
  };
  
  // يمكنك الحصول على اللغة الحالية من context إذا كان متاحًا هنا، أو تمريرها كـ prop
  const currentLang = 'ar'; // كمثال، يمكنك تغييرها ديناميكيًا

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />

      {/* 2. استخدام التصميم المشترك لتغليف الصفحات وتمرير الخصائص المطلوبة */}
      <Route
        path="/guards-rating"
        element={
          <ProtectedRoute permissionKey="s:5">
            <GuardsRatingLayout 
              activeServiceId="new-evaluation"
              pageTitle={guardsRatingTranslations[currentLang].new}
            >
              <GuardsRatingPage />
            </GuardsRatingLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/evaluation-records"
        element={
          <ProtectedRoute permissionKey="s:5">
            <GuardsRatingLayout 
              activeServiceId="evaluation-records"
              pageTitle={guardsRatingTranslations[currentLang].records}
            >
              <EvaluationRecordsPage />
            </GuardsRatingLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/job-permissions"
        element={<ProtectedRoute permissionKey="ss:901"><JobPermissionsPage /></ProtectedRoute>}
      />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

export default App;
