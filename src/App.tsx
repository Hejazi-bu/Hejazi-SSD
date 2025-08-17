import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";

import InspectionNew from "./components/Inspection/InspectionNew";
import { LoginForm } from "./components/LogIn/LoginForm";
import { ForgotPasswordForm } from "./components/LogIn/ForgotPasswordForm";
import { ResetPassword } from "./components/LogIn/ResetPassword";
import Dashboard from "./components/Dashboard";
import GuardsRatingPage from "./components/GuardsRating/GuardsRatingPage";
import EvaluationRecordsPage from "./components/GuardsRating/EvaluationRecordsPage";
import ViolationNew from "./components/Violation/ViolationNew";
import { Toaster } from "sonner";
import { useUser, User } from "./components/contexts/UserContext";

import { useLocation } from "react-router-dom";

function App() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation(); // 🔹 احتفظ بموقع المستخدم الحالي
  const [language, setLanguage] = React.useState<"ar" | "en">("ar");
  const [currentServiceId, setCurrentServiceId] = React.useState<string>("new-evaluation");

  const handleLogin = (userData: User, redirectTo?: string) => {
    setUser(userData);
    if (redirectTo) navigate(redirectTo); // 🔹 إعادة التوجيه للصفحة المطلوبة
    else navigate("/dashboard");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/login"); // روابط نظيفة
  };

  const handleLanguageChange = (lang: "ar" | "en") => setLanguage(lang);
  const handleNavigateTo = (page: string) => navigate(page);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>جار التحميل...</p>
      </div>
    );
  }

  return (
    <>
      <Toaster position="bottom-center" />
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />

        <Route
          path="/login"
          element={
            !user ? (
              <LoginForm
                language={language}
                onLanguageChange={handleLanguageChange}
                onForgotPassword={() => navigate("/forgot")}
                onLogin={handleLogin}
              />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />

        <Route
          path="/forgot"
          element={
            !user ? (
              <ForgotPasswordForm
                language={language}
                onLanguageChange={handleLanguageChange}
                onBackToLogin={() => navigate("/login")}
              />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />

        <Route path="/reset" element={!user ? <ResetPassword /> : <Navigate to="/dashboard" />} />

        <Route
          path="/dashboard"
          element={
            user ? (
              <Dashboard
                language={language}
                onLanguageChange={handleLanguageChange}
                onLogout={handleLogout}
                onNavigateTo={handleNavigateTo}
              />
            ) : (
              <Navigate to="/login" state={{ from: location }} />
            )
          }
        />

        <Route
          path="/inspection"
          element={
            user ? (
              <InspectionNew
                language={language}
                onLanguageChange={handleLanguageChange}
                onBackToHome={() => navigate("/dashboard")}
                onGoToReports={() => navigate("/dashboard")}
                onGoToRecords={() => navigate("/dashboard")}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route path="/violation-new" element={user ? <ViolationNew /> : <Navigate to="/login" />} />

        <Route
          path="/guards-rating"
          element={
            user ? (
              <GuardsRatingPage
                language={language}
                onLanguageChange={setLanguage}
                currentServiceId={currentServiceId}
                onNavigateTo={(serviceId) => {
                  setCurrentServiceId(serviceId);
                  if (serviceId === "evaluation-records") navigate("/evaluation-records");
                  else navigate("/guards-rating");
                }}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/evaluation-records"
          element={
            user ? (
              <EvaluationRecordsPage
                language={language}
                onLanguageChange={setLanguage}
                onNavigateTo={(serviceId) => {
                  setCurrentServiceId(serviceId);
                  if (serviceId === "new-evaluation") navigate("/guards-rating");
                  else navigate(serviceId);
                }}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* أي صفحة غير معروفة تذهب مباشرة للـ login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </>
  );
}

export default App;
