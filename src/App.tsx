// src/App.tsx
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

function App() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const [language, setLanguage] = React.useState<"ar" | "en">("ar");
  const [currentServiceId, setCurrentServiceId] =
    React.useState<string>("new-evaluation");

  const handleLogin = (userData: User) => {
    setUser(userData);
    navigate("/dashboard");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/login");
  };

  const handleLanguageChange = (lang: "ar" | "en") => setLanguage(lang);

  const handleNavigateTo = (page: string) => {
    navigate(page);
  };

  // 🟢 معالجة حالة التحميل
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
        {/* Login */}
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

        {/* Forgot Password */}
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

        {/* Reset Password */}
        <Route
          path="/reset"
          element={!user ? <ResetPassword /> : <Navigate to="/dashboard" />}
        />

        {/* Dashboard */}
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
              <Navigate to="/login" />
            )
          }
        />

        {/* Inspection */}
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

        {/* Violation */}
        <Route
          path="/violation-new"
          element={user ? <ViolationNew /> : <Navigate to="/login" />}
        />

        {/* Guards Rating */}
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
                  if (serviceId === "evaluation-records")
                    navigate("/evaluation-records");
                  else navigate("/guards-rating");
                }}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Evaluation Records */}
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

        {/* Redirect أي رابط غير معروف */}
        <Route
          path="*"
          element={<Navigate to={user ? "/dashboard" : "/login"} />}
        />
      </Routes>
    </>
  );
}

export default App;
