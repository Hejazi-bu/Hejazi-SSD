import { useState, FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import ar from "../../locales/ar";
import en from "../../locales/en";
import { toast } from "sonner";
import type { User } from "../../types/user";

// إضافة هذا في ملف index.html أو _document.tsx داخل <head>:
// <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

interface Props {
  language: "ar" | "en";
  onLanguageChange: (lang: "ar" | "en") => void;
  onLogin: (user: User) => void;
  onForgotPassword: () => void;
}

export function LoginForm({ language, onLanguageChange, onLogin, onForgotPassword }: Props) {
  const t = language === "ar" ? ar : en;

  const [identifier, setIdentifier] = useState(""); 
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier || !password) {
      setError(t.emailOrId);
      return;
    }
    setLoading(true);
    setProgress(0);

    try {
      let userRecord = null;

      const isEmail = identifier.includes("@");
      const isPhone = /^[0-9]{9,15}$/.test(identifier);
      const isJobNumber = !isEmail && !isPhone;

      if (isEmail) {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("email", identifier)
          .eq("status", "active")
          .limit(1)
          .single();
        if (data) userRecord = data;
      } else if (isJobNumber) {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("job_number", identifier)
          .eq("status", "active")
          .limit(1)
          .single();
        if (data) userRecord = data;
      } else if (isPhone) {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("phone", identifier)
          .eq("status", "active")
          .limit(1)
          .single();
        if (data) userRecord = data;
      }

      if (!userRecord) {
        setError(language === "ar" ? "المستخدم غير موجود أو غير مفعل." : "User not found or inactive.");
        setLoading(false);
        return;
      }

      const userEmail = userRecord.email;

      // محاكاة تقدم التحميل
      let fakeProgress = 0;
      const progressInterval = setInterval(() => {
        fakeProgress += 10;
        if (fakeProgress > 90) fakeProgress = 90; 
        setProgress(fakeProgress);
      }, 100);

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (signInError || !signInData.user) {
        setError(t.loginFailed);
        toast.error(t.loginFailed);
        setLoading(false);
        setProgress(0);
        return;
      }

      await supabase
        .from("users")
        .update({ last_login: new Date().toISOString() })
        .eq("id", userRecord.id);

      const user: User = {
        id: signInData.user.id,
        email: signInData.user.email || userEmail,
        name_ar: userRecord.name_ar,
        name_en: userRecord.name_en,
        job_title_ar: userRecord.job_title_ar,
        job_title_en: userRecord.job_title_en,
        phone: userRecord.phone,
        job_number: userRecord.job_number,
        status: userRecord.status,
        avatar_url: userRecord.avatar_url || undefined,
        role: userRecord.role || "user",
        last_login: new Date().toISOString(),
      };

      setLoading(false);
      toast.success(language === "ar" ? "تم تسجيل الدخول بنجاح" : "Signed in successfully");
      onLogin(user);
    } catch (err: any) {
      setError(err.message || t.loginFailed);
      setLoading(false);
      setProgress(0);
    }
  };

  const toggleLanguage = () => onLanguageChange(language === "ar" ? "en" : "ar");

  const LoadingOverlay = () => {
    const glow = 10 + (progress / 100) * 40; 
    const scale = 1 + Math.sin(Date.now() / 300) * 0.05;

    return (
      <div className="fixed inset-0 bg-white/90 flex flex-col items-center justify-center z-50">
        <h1
          className="text-5xl font-extrabold mb-6 drop-shadow-lg"
          style={{
            color: `rgba(30, 58, 138, 1)`,
            textShadow: `0 0 ${glow}px rgba(59, 130, 246, 0.7), 0 0 ${glow/2}px rgba(59, 130, 246, 0.5)`,
            transform: `scale(${scale})`,
            transition: "transform 0.1s",
          }}
        >
          Hejazi SSD
        </h1>
        <p className="text-gray-800 text-xl animate-bounce">
          {language === "ar" ? "جارٍ تسجيل الدخول..." : "Signing in..."}
        </p>
        <div className="relative mt-8 w-16 h-16">
          <svg className="w-16 h-16" viewBox="0 0 36 36">
            <circle
              className="text-blue-200"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              cx="18"
              cy="18"
              r="16"
            />
            <circle
              className="text-blue-700"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              cx="18"
              cy="18"
              r="16"
              strokeDasharray="100"
              strokeDashoffset={100 - progress}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 px-2 sm:px-4 overflow-x-hidden">
      {loading && <LoadingOverlay />}
      <div
        className="w-full max-w-[calc(100vw-1rem)] sm:max-w-md bg-white shadow-md rounded-2xl px-4 sm:px-8 py-6 sm:py-8 space-y-6 flex flex-col justify-center"
        dir={language === "ar" ? "rtl" : "ltr"}
        style={{ overflowX: "hidden" }}
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-800 mb-1">Hejazi SSD</h1>
          <p className="text-sm text-gray-800">{language === "ar" ? "شركة برمجيات" : "Software Company"}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-800 mb-1">{language === "ar" ? "البريد أو الرقم الوظيفي أو رقم الهاتف" : "Email, Job Number or Phone"}</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={language === "ar" ? "أدخل البريد أو الرقم الوظيفي أو رقم الهاتف" : "Enter email, job number or phone"}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              autoComplete="username"
            />
            {error && !identifier && <p className="text-red-500 text-xs mt-1">{t.invalidFields}</p>}
          </div>

          <div>
            <label className="block text-sm text-gray-800 mb-1">{t.password}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.password}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className={`absolute inset-y-0 ${language === "ar" ? "left-0 pl-3" : "right-0 pr-3"} flex items-center text-gray-500`}
                aria-label={showPassword ? (language === "ar" ? "إخفاء كلمة المرور" : "Hide password") : (language === "ar" ? "إظهار كلمة المرور" : "Show password")}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && !password && <p className="text-red-500 text-xs mt-1">{t.invalidFields}</p>}
          </div>

          {error && identifier && password && <p className="text-red-500 text-xs text-center">{error}</p>}

          <div className="flex justify-between items-center text-sm">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-blue-700 hover:underline"
            >
              {t.forgotPassword}
            </button>

            <button
              onClick={toggleLanguage}
              type="button"
              className="text-gray-700 hover:text-blue-700"
            >
              {language === "ar" ? "English" : "العربية"}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition font-medium"
          >
            {t.login}
          </button>
        </form>
      </div>
    </div>
  );
}
