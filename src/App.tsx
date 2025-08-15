import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
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
  const [currentServiceId, setCurrentServiceId] = useState<string>("new-evaluation");

  // ✅ التحقق من الجلسة عند تحميل التطبيق
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && data.session.user) {
        const sessionUser = data.session.user;
        const userData: User = {
          id: sessionUser.id,
          email: sessionUser.email || "",
          name_ar: "",
          name_en: "",
          job_title_ar: "",
          job_title_en: "",
          phone: "",
          job_number: "",
          status: "active",
          avatar_url: undefined,
          role: "user",
          last_login: new Date().toISOString(),
        };
        setUser(userData);
        setPage("dashboard");
      }
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name_ar: "",
          name_en: "",
          job_title_ar: "",
          job_title_en: "",
          phone: "",
          job_number: "",
          status: "active",
          avatar_url: undefined,
          role: "user",
          last_login: new Date().toISOString(),
        });
        setPage("dashboard");
      } else {
        setUser(null);
        setPage("login");
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    setPage("dashboard");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPage("login");
  };

  const handleLanguageChange = (lang: "ar" | "en") => setLanguage(lang);
  const handleForgotPassword = () => setPage("forgot");
  const handleBackToLogin = () => setPage("login");
  const handleBackToHome = () => setPage("dashboard");

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

      {page === "violation-new" && <ViolationNew />}

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
            if (serviceId === "evaluation-records") setPage("evaluation-records");
            else setPage("guards-rating");
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
            if (serviceId === "new-evaluation") setPage("guards-rating");
            else setPage(serviceId as PageType);
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
            // ✅ الاحتفاظ بالتحقق من الصفحات المسموح بها كما كان
            if (
              page === "inspection" ||
              page === "riskOrMaintenance" ||
              page === "login" ||
              page === "forgot" ||
              page === "dashboard" ||
              page === "reset" ||
              page === "register" ||
              page === "guards-rating"
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
