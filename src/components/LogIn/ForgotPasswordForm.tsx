import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { toast } from "sonner";

interface Props {
  language: "ar" | "en";
  onLanguageChange: (lang: "ar" | "en") => void;
  onBackToLogin: () => void;
}

export function ForgotPasswordForm({ language, onLanguageChange, onBackToLogin }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const t = language === "ar"
    ? { title: "استعادة كلمة المرور", send: "إرسال", success: "تم إرسال رابط إلى بريدك", fail: "فشل في الإرسال", back: "رجوع لتسجيل الدخول", placeholder: "أدخل بريدك الإلكتروني" }
    : { title: "Forgot Password", send: "Send", success: "Reset link sent", fail: "Sending failed", back: "Back to login", placeholder: "Enter your email" };

  const handleSend = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset=true`,
    });

    if (error) {
      toast.error(t.fail);
    } else {
      toast.success(t.success);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded-lg shadow w-full max-w-md" dir={language === "ar" ? "rtl" : "ltr"}>
        <h2 className="text-xl font-semibold mb-4 text-center">{t.title}</h2>

        <input
          type="email"
          placeholder={t.placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded px-4 py-2 mb-4"
        />

        <button
          onClick={handleSend}
          disabled={loading}
          className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
        >
          {loading ? "..." : t.send}
        </button>

        <button onClick={onBackToLogin} className="text-sm text-purple-600 mt-4 block mx-auto hover:underline">
          {t.back}
        </button>
      </div>
    </div>
  );
}
