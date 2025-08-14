// File: src/App.tsx
import React, { useState, useEffect } from "react";
import InspectionNew from "./components/Inspection/InspectionNew";
import { LoginForm } from "./components/LogIn/LoginForm";
import { ForgotPasswordForm } from "./components/LogIn/ForgotPasswordForm";
import { ResetPassword } from "./components/LogIn/ResetPassword";
import Dashboard from "./components/Dashboard";
import GuardsRatingPage from "./components/GuardsRating/GuardsRatingPage";
import EvaluationRecordsPage from "./components/GuardsRating/EvaluationRecordsPage";
import ViolationNew from "./components/Violation/ViolationNew";
import type { User } from "./types/user";
import type { PageType } from "./types/pages";
import { Toaster } from "sonner";

function App() {
  const [language, setLanguage] = useState<"ar" | "en">("ar");

  const [page, setPage] = useState<
    | "inspection"
    | "riskOrMaintenance"
    | "login"
    | "forgot"
    | "dashboard"
    | "reset"
    | "register"
    | "otp"
    | "guards-rating"
    | "evaluation-records"
    | "violation-new"
  >("login");

  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (userData: User) => {
    setUser(userData);
    setPage("dashboard");
  };

  const handleLogout = () => {
    setUser(null);
    setPage("login");
  };

  const handleLanguageChange = (lang: "ar" | "en") => {
    setLanguage(lang);
  };

  const handleForgotPassword = () => setPage("forgot");
  const handleBackToLogin = () => setPage("login");
  const handleRegisterPage = () => setPage("register");
  const handleBackToHome = () => setPage("dashboard");

  const [currentServiceId, setCurrentServiceId] = useState<string>("new-evaluation");
  console.log("Current page:", page);

  return (
    <>
      <Toaster position="bottom-center" />

      {page === "inspection" && (
        <InspectionNew
          language={language}
          onLanguageChange={handleLanguageChange}
          onBackToHome={handleBackToHome}
          onGoToReports={() => setPage("dashboard")}
          onGoToRecords={() => setPage("dashboard")}
        />
      )}

      {page === "violation-new" && (
        <ViolationNew
          // مرر أي props تحتاجها، مثلا بيانات المستخدم الثابتة لاحقًا
        />
      )}

      {page === "login" && (
        <LoginForm
          language={language}
          onLanguageChange={handleLanguageChange}
          onLogin={handleLogin}
          onForgotPassword={handleForgotPassword}
        />
      )}

      {page === "forgot" && (
        <ForgotPasswordForm
          language={language}
          onLanguageChange={handleLanguageChange}
          onBackToLogin={handleBackToLogin}
        />
      )}

      {page === "reset" && <ResetPassword />}

      {page === "guards-rating" && (
        <GuardsRatingPage
          language={language}
          onLanguageChange={setLanguage}
          onNavigateTo={(serviceId) => {
            setCurrentServiceId(serviceId);
            // إذا كان الانتقال لـ "evaluation-records" نذهب لصفحة evaluation-records
            if (serviceId === "evaluation-records") {
              setPage("evaluation-records");
            } else {
              setPage("guards-rating"); // دائماً ضمن guards-rating لباقي الخدمات مثل new-evaluation
            }
          }}
          currentServiceId={currentServiceId}
        />
      )}

      {page === "evaluation-records" && (
        <EvaluationRecordsPage
          language={language}
          onLanguageChange={setLanguage}
          onNavigateTo={(serviceId) => {
            setCurrentServiceId(serviceId);
            // إذا كان الانتقال لـ "new-evaluation" نذهب لصفحة guards-rating
            if (serviceId === "new-evaluation") {
              setPage("guards-rating");
            } else {
              setPage(serviceId as PageType); // على سبيل المثال "evaluation-records" أو "evaluation-reports"
            }
          }}
        />
      )}

{page === "dashboard" && user && (
        <Dashboard
          language={language}
          user={user}
          onLanguageChange={handleLanguageChange}
          onLogout={handleLogout}
          onNavigateTo={(page: string) => {
            if (
              page === "inspection" ||
              page === "riskOrMaintenance" ||
              page === "login" ||
              page === "forgot" ||
              page === "dashboard" ||
              page === "reset" ||
              page === "register" ||
              page === "guards-rating" // ✅ السماح بالتنقل للصفحة الجديدة
            ) {
              setPage(page);
            }
          }}
        />
      )}
    </>
  );
}

export default App;