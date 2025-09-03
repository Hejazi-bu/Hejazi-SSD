import React, { useState } from 'react';
import { useAuth, AuthErrorKey } from '../contexts/UserContext'; // استيراد النوع الجديد
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';

const logoUrl = '/assets/Hejazi.png';

// --- ✅ تعديل: استخدام مفتاح محدد للترجمات ---
// هذا يخبر TypeScript أن هذا الكائن يستخدم مفاتيح محددة
const translations: { [key: string]: { [key in AuthErrorKey | 'title' | 'emailLabel' | 'passwordLabel' | 'loginButton' | 'loadingButton' | 'forgotPassword' | 'loggingIn']: string } } = {
  ar: {
    title: "تسجيل الدخول",
    emailLabel: "البريد الإلكتروني",
    passwordLabel: "كلمة المرور",
    loginButton: "دخول",
    loadingButton: "جاري الدخول...",
    forgotPassword: "نسيت كلمة المرور؟",
    errorCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    errorPermission: "ليس لديك الصلاحية للدخول إلى هذا النظام.",
    errorProfileNotFound: "لم يتم العثور على ملف المستخدم. يرجى مراجعة المسؤول.",
    errorGeneric: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    loggingIn: "جاري التحقق...",
  },
  en: {
    title: "Login",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    loginButton: "Login",
    loadingButton: "Logging in...",
    forgotPassword: "Forgot Password?",
    errorCredentials: "Invalid email or password.",
    errorPermission: "You do not have permission to access this system.",
    errorProfileNotFound: "User profile not found. Please contact an administrator.",
    errorGeneric: "An error occurred. Please try again.",
    loggingIn: "Verifying...",
  },
};

export const LoginForm = () => {
  const { language, toggleLanguage } = useLanguage();
  const { signInAndCheckPermissions } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const t = translations[language];

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await signInAndCheckPermissions({ email, password });

    if (result.success) {
      setIsSuccess(true);
    } else {
      // الآن هذا السطر سيعمل بدون مشاكل
      setError(t[result.errorKey || 'errorGeneric']);
      setIsLoading(false);
    }
  };

  const formVariants: Variants = { /* ... لم يتغير ... */ };
  const successVariants: Variants = { /* ... لم يتغير ... */ };

  return (
    // ... محتوى الـ JSX لم يتغير ...
    <motion.div
      className="flex items-center justify-center min-h-screen text-white px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="form"
              variants={formVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="text-center mb-6">
                <img src={logoUrl} alt="Hejazi Logo" className="w-24 h-24 mx-auto mb-2" />
                <h1 className="text-2xl font-bold text-[#FFD700]">Hejazi SSD</h1>
                <p className="text-gray-400">Safety & Security Development</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-400">{t.emailLabel}</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required 
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-400">{t.passwordLabel}</label>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required 
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                  />
                </div>

                {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                <button type="submit" disabled={isLoading} 
                  className="w-full px-4 py-3 font-bold text-black bg-[#FFD700] rounded-md hover:bg-yellow-400 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-yellow-300"
                >
                  {isLoading ? t.loadingButton : t.loginButton}
                </button>
                
                <div className="flex items-center justify-between text-sm pt-2">
                    <button type="button" onClick={() => navigate('/forgot')} className="font-medium text-blue-500 hover:underline">
                      {t.forgotPassword}
                    </button>
                    <button type="button" onClick={toggleLanguage} className="font-medium text-gray-400 hover:underline">
                      {language === 'ar' ? 'English' : 'العربية'}
                    </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              variants={successVariants}
              initial="hidden"
              animate="visible"
              className="text-center"
            >
              <img src={logoUrl} alt="Hejazi Logo" className="w-28 h-28 mx-auto mb-4 animate-pulse" />
              <p className="text-lg text-[#FFD700]">{t.loggingIn}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};