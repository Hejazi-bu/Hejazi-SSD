// src/App.tsx
import React from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
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

function App() {
  const { user, setUser } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const initialLang = (localStorage.getItem("lang") as "ar" | "en") || "ar";
  const [language, setLanguage] = React.useState<"ar" | "en">(initialLang);

  const [currentServiceId, setCurrentServiceId] = React.useState<string>("new-evaluation");

  const handleLogin = (userData: User) => {
    setUser(userData);
    const from = (location.state as any)?.from || "/dashboard";
    navigate(from, { replace: true });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/login");
  };

  const handleLanguageChange = (lang: "ar" | "en") => {
    setLanguage(lang);
    localStorage.setItem("lang", lang);
  };

  const handleNavigateTo = (page: string) => navigate(page);

  if (user === undefined) {
    return <div className="flex items-center justify-center min-h-screen">جار التحميل...</div>;
  }

  if (user === null) {
    return (
      <Routes>
        <Route
          path="/login"
          element={
            <LoginForm
              language={language}
              onLanguageChange={handleLanguageChange}
              onForgotPassword={() => navigate("/forgot")}
              onLogin={handleLogin}
            />
          }
        />
        <Route
          path="/forgot"
          element={
            <ForgotPasswordForm
              language={language}
              onLanguageChange={handleLanguageChange}
              onBackToLogin={() => navigate("/login")}
            />
          }
        />
        <Route path="/reset" element={<ResetPassword />} />
        {/* أي محاولة الوصول لأي صفحة بدون تسجيل دخول */}
        <Route path="*" element={<Navigate to="/login" state={{ from: window.location.pathname }} replace />} />
      </Routes>
    );
  }

  return (
    <>
      <Toaster position="bottom-center" />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

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
              <Navigate to="/dashboard" replace />
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
              <Navigate to="/dashboard" replace />
            )
          }
        />

        <Route path="/reset" element={!user ? <ResetPassword /> : <Navigate to="/dashboard" replace />} />

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
              <Navigate to="/login" state={{ from: window.location.pathname }} replace />
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
              <Navigate to="/login" state={{ from: window.location.pathname }} replace />
            )
          }
        />

        <Route path="/violation-new" element={user ? <ViolationNew /> : <Navigate to="/login" state={{ from: window.location.pathname }} replace />} />

        <Route
          path="/guards-rating"
          element={
            user ? (
              <GuardsRatingPage
                language={language}
                onLanguageChange={handleLanguageChange}
                currentServiceId={currentServiceId}
                onNavigateTo={(serviceId) => {
                  setCurrentServiceId(serviceId);
                  if (serviceId === "evaluation-records") navigate("/evaluation-records");
                  else navigate("/guards-rating");
                }}
              />
            ) : (
              <Navigate to="/login" state={{ from: window.location.pathname }} replace />
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
              <Navigate to="/login" state={{ from: window.location.pathname }} replace />
            )
          }
        />

        {/* أي صفحة غير معروفة تذهب للـ dashboard بشكل آمن */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default App;
