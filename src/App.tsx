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

  const [page, setPage] = useState<PageType>("login"); // استخدم PageType
  const [user, setUser] = useState<User | null>(null);
  const [currentServiceId, setCurrentServiceId] = useState<string>("new-evaluation");

  // ✅ تعيين الصفحة وحفظها في localStorage
  const setPageAndSave = (newPage: PageType) => {
    setPage(newPage);
    localStorage.setItem("lastPage", newPage);
  };

  // ✅ التحقق من الجلسة عند تحميل التطبيق
  useEffect(() => {
    const lastPage = localStorage.getItem("lastPage") as PageType | null;

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
        setPage(lastPage || "dashboard"); // ← آخر صفحة أو داشبورد
      }
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const sessionUser = session.user;
        setUser({
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
        });
        setPage(lastPage || "dashboard");
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
    setPageAndSave("dashboard");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPageAndSave("login");
  };

  const handleLanguageChange = (lang: "ar" | "en") => setLanguage(lang);
  const handleForgotPassword = () => setPageAndSave("forgot");
  const handleBackToLogin = () => setPageAndSave("login");
  const handleBackToHome = () => setPageAndSave("dashboard");

  console.log("Current page:", page);

  return (
    <>
      <Toaster position="bottom-center" />

      {page === "inspection" && (
        <InspectionNew
          language={language}
          onLanguageChange={handleLanguageChange}
          onBackToHome={handleBackToHome}
          onGoToReports={() => setPageAndSave("dashboard")}
          onGoToRecords={() => setPageAndSave("dashboard")}
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
            if (serviceId === "evaluation-records") setPageAndSave("evaluation-records");
            else setPageAndSave("guards-rating");
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
            if (serviceId === "new-evaluation") setPageAndSave("guards-rating");
            else setPageAndSave(serviceId as PageType);
          }}
        />
      )}

      {page === "dashboard" && user && (
        <Dashboard
          language={language}
          user={user}
          onLanguageChange={handleLanguageChange}
          onLogout={handleLogout}
          onNavigateTo={(newPage: PageType) => {
            // ✅ الاحتفاظ بالتحقق من الصفحات المسموح بها
            if (
              newPage === "inspection" ||
              newPage === "riskOrMaintenance" ||
              newPage === "login" ||
              newPage === "forgot" ||
              newPage === "dashboard" ||
              newPage === "reset" ||
              newPage === "register" ||
              newPage === "guards-rating"
            ) {
              setPageAndSave(newPage);
            }
          }}
        />
      )}
    </>
  );
}

export default App;
