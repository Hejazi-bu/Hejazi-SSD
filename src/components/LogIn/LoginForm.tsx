import { useState, FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import ar from "../../locales/ar";
import en from "../../locales/en";
import { toast } from "sonner";
import type { User } from "../../types/user";

interface Props {
  language: "ar" | "en";
  onLanguageChange: (lang: "ar" | "en") => void;
  onLogin: (user: User) => void;
  onForgotPassword: () => void;
}

export function LoginForm({ language, onLanguageChange, onLogin, onForgotPassword }: Props) {
  const t = language === "ar" ? ar : en;

  const [identifier, setIdentifier] = useState(""); // البريد أو الرقم الوظيفي أو الهاتف
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    console.log("Login attempt started");
    console.log("Identifier:", identifier);
    console.log("Password length:", password.length);

    if (!identifier || !password) {
      setError(t.emailOrId);
      console.log("Missing identifier or password");
      return;
    }

    setLoading(true);

    try {


let userRecord = null;

const isEmail = identifier.includes("@");
const isPhone = /^[0-9]{9,15}$/.test(identifier); // 9+ أرقام
const isJobNumber = !isEmail && !isPhone; // إذا ما كان إيميل ولا رقم → نفترض رقم وظيفي

if (isEmail) {
  console.log("Searching user by email...");
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", identifier)
    .eq("status", "active")
    .limit(1)
    .single();
  if (data) {
    userRecord = data;
  }
} else if (isJobNumber) {
  console.log("Searching user by job number...");
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("job_number", identifier)
    .eq("status", "active")
    .limit(1)
    .single();
  if (data) {
    userRecord = data;
  }
} else if (isPhone) {
  console.log("Searching user by phone...");
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("phone", identifier)
    .eq("status", "active")
    .limit(1)
    .single();
  if (data) {
    userRecord = data;
  }
}

      if (!userRecord) {
        setError(language === "ar" ? "المستخدم غير موجود أو غير مفعل." : "User not found or inactive.");
        console.log("User not found or inactive.");
        setLoading(false);
        return;
      }

      const userEmail = userRecord.email;
      console.log("Attempting signInWithPassword for email:", userEmail);

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (signInError || !signInData.user) {
        setError(t.loginFailed);
        toast.error(t.loginFailed);
        console.log("Sign in failed:", signInError);
        setLoading(false);
        return;
      }

      console.log("Sign in successful:", signInData.user);

// تحديث حقل last_login في قاعدة البيانات
await supabase
  .from("users")
  .update({ last_login: new Date().toISOString() })
  .eq("id", userRecord.id);

// تشكيل الكائن User الكامل
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
      console.log("Error during login:", err);
      setLoading(false);
    }
  };

  const toggleLanguage = () => onLanguageChange(language === "ar" ? "en" : "ar");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-purple-600 mb-1">Hejazi SSD</h1>
          <p className="text-sm text-gray-500">{language === "ar" ? "شركة برمجيات" : "Software Company"}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">{language === "ar" ? "البريد أو الرقم الوظيفي أو رقم الهاتف" : "Email, Job Number or Phone"}</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={language === "ar" ? "أدخل البريد أو الرقم الوظيفي أو رقم الهاتف" : "Enter email, job number or phone"}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
              autoComplete="username"
            />
            {error && !identifier && <p className="text-red-500 text-xs mt-1">{t.invalidFields}</p>}
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">{t.password}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.password}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
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
              className="text-purple-600 hover:underline"
            >
              {t.forgotPassword}
            </button>

            <button
              onClick={toggleLanguage}
              type="button"
              className="text-gray-500 hover:text-purple-600"
            >
              {language === "ar" ? "English" : "العربية"}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
          >
            {loading ? (language === "ar" ? "جاري الدخول..." : "Signing in...") : t.login}
          </button>
        </form>
      </div>
    </div>
  );
}
