import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
// ✨ 1. تعديل الاستيرادات لتطابق LoginPage
import { pageTransitionVariants, staggeredContainerVariants, staggeredItemVariants, fadeInVariants, interactiveItemVariants } from '../lib/animations'; 
import { useLanguage } from '../components/contexts/LanguageContext';
// (إزالة useActionLoading)
import { useDialog } from '../components/contexts/DialogContext';

// ✨ 1. إضافة استيرادات جديدة
import { auth } from '../lib/firebase'; // تأكد من أن المسار صحيح
import { useAuthState } from 'react-firebase-hooks/auth'; // استيراد الهوك
// ------------------------------

import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { Eye, EyeOff, AlertTriangle, LoaderCircle, CircleCheck } from 'lucide-react'; // ✨ إضافة CircleCheck

// ===================================================================
// 2. ✨ نسخ مكون الحقل العائم من "LoginPage.tsx"
// ===================================================================
const FloatingLabelInput = ({ id, label, value, type, error, language, onChange, controls, inputControls }: { id: string, label: string, value: string, type: string, error?: string, language: 'ar' | 'en', onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, controls: ReturnType<typeof useAnimation>, inputControls?: ReturnType<typeof useAnimation> }) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = value.trim().length > 0;
    const isLabelUp = isFocused || hasValue;
    const isRTL = language === 'ar';

    return (
        <motion.div className="relative" animate={controls} transition={{ duration: 0.5, ease: "easeInOut" }}>
            <motion.label
                layout
                htmlFor={id}
                className={`absolute pointer-events-none z-10 ${isRTL ? 'right-3' : 'left-3'}`}
                animate={{
                    y: isLabelUp ? -24 : 0, scale: isLabelUp ? 0.85 : 1,
                    color: isFocused && !error ? '#FFD700' : (error ? '#F87171' : '#9CA3AF'),
                }}
                transition={{ layout: { duration: 0.3, ease: 'easeOut' }, type: 'spring', stiffness: 300, damping: 20 }}
                style={{ transformOrigin: isRTL ? 'top right' : 'top left', top: '1rem' }}
            >
                {label}
            </motion.label>
            
            <motion.input
                id={id} type={type} value={value} onChange={onChange}
                onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
                required
                className={`w-full px-3 pb-2 pt-5 bg-transparent border-b-2 focus:outline-none transition-colors caret-white ${error ? 'border-red-500' : 'border-gray-600 focus:border-[#FFD700]'} ${isRTL ? 'text-right' : 'text-left'}`}
                animate={inputControls}
            />

            <AnimatePresence>
                {error && (<motion.p layout transition={{ layout: { duration: 0.3, ease: 'easeOut' } }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`mt-1 text-xs text-red-400 ${isRTL ? 'text-right' : 'text-left'}`}>{error}</motion.p>)}
            </AnimatePresence>
        </motion.div>
    );
}

// ===================================================================
// 3. ✨ نسخ مكون أنيميشن النجاح من "LoginPage.tsx"
// ===================================================================
const SuccessAnimation = ({ text }: { text: string }) => (
    <motion.div key="success" {...fadeInVariants} className="flex flex-col items-center justify-center gap-4 h-48">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1, transition: { type: 'spring', stiffness: 200, damping: 15, delay: 0.2 } }}>
            <CircleCheck className="w-20 h-20 text-green-400" />
        </motion.div>
        <p className="text-lg text-green-300 font-semibold">{text}</p>
    </motion.div>
);

// ===================================================================
// 4. ✨ المكون البصري المطور (يستخدم المكونات الجديدة)
// ===================================================================
function AuthActionForm({
    mode,
    t,
    isLoading,
    isVerifying,
    isSuccess, // ✨ إضافة حالة النجاح
    error,
    handleSubmit,
    language,
}: {
    mode: 'resetPassword' | null;
    t: any;
    isLoading: boolean;
    isVerifying: boolean;
    isSuccess: boolean; // ✨ إضافة حالة النجاح
    error: string | null;
    handleSubmit: (password: string) => void;
    language: 'ar' | 'en';
}) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordInputType, setPasswordInputType] = useState('password');
    const [passwordsMatch, setPasswordsMatch] = useState(true);
    
    // عناصر تحكم للأنيميشن (مثل LoginPage)
    const passwordControls = useAnimation();
    const confirmPasswordControls = useAnimation();
    const passwordInputControls = useAnimation();
    const isRTL = language === 'ar';

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordsMatch(true); // إعادة تعيين
        if (password !== confirmPassword) {
            setPasswordsMatch(false);
            confirmPasswordControls.start({ x: [0, -8, 8, -8, 8, 0] }); // تطبيق الاهتزاز
            return;
        }
        if (!password) return;
        handleSubmit(password);
    };

    // دالة إظهار/إخفاء كلمة المرور (مثل LoginPage)
    const handleTogglePassword = async () => {
        await passwordInputControls.start({ opacity: 0, transition: { duration: 0.15 } });
        setShowPassword(prev => !prev);
        setPasswordInputType(prev => prev === 'password' ? 'text' : 'password');
        passwordInputControls.start({ opacity: 1, transition: { duration: 0.15 } });
    }

    const contentToDisplay = () => {
        if (isVerifying) {
            return (
                <motion.div
                    key="verifying"
                    variants={staggeredItemVariants}
                    className="flex flex-col items-center gap-4 h-48 justify-center"
                >
                    <LoaderCircle className="w-12 h-12 text-yellow-400 animate-spin" />
                    <p className="text-lg text-gray-300 tracking-wider">
                        {t.verifying}
                    </p>
                </motion.div>
            );
        }

        if (isSuccess) { // ✨ عرض أنيميشن النجاح
            return <SuccessAnimation text={t.successTitle} />
        }

        if (error) {
            return (
                <motion.div
                    key="error"
                    variants={staggeredItemVariants}
                    className="flex flex-col items-center gap-4 text-center h-48 justify-center"
                >
                    <AlertTriangle className="w-12 h-12 text-red-500" />
                    <p className="mt-2 text-lg text-red-400 font-semibold">{t.errorTitle}</p>
                    <p className="text-gray-300 max-w-xs">{error}</p>
                </motion.div>
            );
        }

        if (mode === 'resetPassword') {
            return (
                <motion.form
                    key="form"
                    onSubmit={onSubmit}
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0 }} 
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="space-y-6 w-full"
                >
                    {/* --- ✨ حقل كلمة المرور الجديد --- */}
                    <div className="relative">
                        <FloatingLabelInput 
                            id="password" 
                            label={t.newPassword} 
                            value={password} 
                            type={passwordInputType} 
                            language={language} 
                            onChange={e => {setPassword(e.target.value); setPasswordsMatch(true);}} 
                            controls={passwordControls}
                            inputControls={passwordInputControls}
                        />
                        <motion.button 
                            layout
                            type="button" 
                            onClick={handleTogglePassword}
                            className={`absolute inset-y-0 flex items-center text-gray-400 hover:text-white top-[-10px] ${isRTL ? 'left-0 pl-3' : 'right-0 pr-3'}`} 
                            transition={{ layout: { duration: 0.3, ease: 'easeOut' }, type: 'spring', stiffness: 500, damping: 30 }} 
                            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div key={showPassword ? 'eye-off' : 'eye'} initial={{ opacity: 0, rotate: -45, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 45, scale: 0.5 }} transition={{ duration: 0.2 }}>
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </motion.div>
                            </AnimatePresence>
                        </motion.button>
                    </div>

                    {/* --- ✨ حقل تأكيد كلمة المرور الجديد --- */}
                    <div>
                        <FloatingLabelInput 
                            id="confirmPassword" 
                            label={t.confirmPassword} 
                            value={confirmPassword} 
                            type="password" // هذا دائماً مخفي
                            language={language} 
                            onChange={e => {setConfirmPassword(e.target.value); setPasswordsMatch(true);}} 
                            error={!passwordsMatch ? t.passwordsMismatch : undefined} 
                            controls={confirmPasswordControls} // (الاهتزاز هنا)
                        />
                    </div>
                    
                    <motion.button
                        type="submit"
                        disabled={isLoading}
                        variants={interactiveItemVariants}
                        whileHover="hover"
                        whileTap="tap"
                        className="w-full bg-[#FFD700] text-black px-6 py-3 rounded-lg font-bold disabled:bg-gray-600 disabled:text-gray-400"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                                <LoaderCircle size={20} className="animate-spin" />
                                <span>{t.saving}</span>
                            </div>
                        ) : t.saveButton}
                    </motion.button>
                </motion.form>
            );
        }

        // حالة غير معروفة
        return (
            <motion.div
                key="unknown-error"
                variants={staggeredItemVariants}
                className="flex flex-col items-center gap-4 text-center h-48 justify-center"
            >
                <AlertTriangle className="w-12 h-12 text-red-500" />
                <p className="mt-2 text-lg text-red-400 font-semibold">{t.errorTitle}</p>
                <p className="text-gray-300 max-w-xs">{t.invalidLink}</p>
            </motion.div>
        );
    };

    return (
        // ✨ استخدام نفس تصميم شاشة تسجيل الدخول (ملء الشاشة)
        <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="bg-[#0D1B2A] text-white min-h-screen">
            <style>{`input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active{-webkit-box-shadow:0 0 0 30px #0D1B2A inset !important;-webkit-text-fill-color:#ffffff !important;caret-color:#ffffff !important;}`}</style>
            
            <motion.div
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex items-start md:items-center justify-center min-h-screen w-full px-4 py-16"
            >
                <div className="w-full max-w-sm">
                    {/* --- ✨ استخدام رأس الصفحة من LoginPage --- */}
                    <motion.div className="text-center mb-8" variants={staggeredContainerVariants} initial="initial" animate="animate">
                        <motion.img 
                            variants={staggeredItemVariants} 
                            src="/favicon/favicon.svg" // استخدام الشعار الصحيح
                            alt="H-SSD" 
                            className="w-24 h-24 mx-auto mb-2" 
                            animate={{ filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.4))' }}
                            transition={{ type: 'spring', stiffness: 300 }} 
                        />
                        <motion.h1 variants={staggeredItemVariants} className="text-2xl font-bold text-[#FFD700]">H-SSD</motion.h1>
                        <motion.p variants={staggeredItemVariants} className="text-gray-400">Safety & Security Development</motion.p>
                    </motion.div>
                    
                    <AnimatePresence mode="wait">
                        {contentToDisplay()}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

// ===================================================================
// 5. ✨ المكون المنطقي (هنا التعديل الرئيسي)
// ===================================================================
export default function HandleAuthAction() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { language } = useLanguage();
    const { showDialog } = useDialog();

    // ✨ 2. استخدام useAuthState للحصول على حالة تحميل المصادقة
    // هذا الهوك سيخبرنا متى تكون خدمة 'auth' جاهزة للاستخدام
    const [authUser, authLoading] = useAuthState(auth); 

    const [mode, setMode] = useState<'resetPassword' | null>(null);
    const [oobCode, setOobCode] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false); // ✨ إضافة حالة النجاح
    const [error, setError] = useState<string | null>(null);

    const translations = useMemo(() => ({
        ar: {
            pageTitle: "إدارة الحساب",
            newPassword: "كلمة المرور الجديدة",
            confirmPassword: "تأكيد كلمة المرور",
            saveButton: "حفظ كلمة المرور",
            saving: "جاري الحفظ...",
            passwordsMismatch: "كلمتا المرور غير متطابقتين.",
            verifying: "جاري التحقق من الرابط...",
            errorTitle: "خطأ",
            invalidLink: "الرابط غير صالح أو انتهت صلاحيته.",
            successTitle: "تم تعيين كلمة المرور بنجاح", // ✨ تعديل النص
            successMessage: "تم تعيين كلمة المرور بنجاح. سيتم تحويلك لصفحة تسجيل الدخول.",
            genericError: "حدث خطأ غير متوقع. حاول مرة أخرى."
        },
        en: {
            pageTitle: "Account Management",
            newPassword: "New Password",
            confirmPassword: "Confirm Password",
            saveButton: "Save Password",
            saving: "Saving...",
            passwordsMismatch: "Passwords do not match.",
            verifying: "Verifying link...",
            errorTitle: "Error",
            invalidLink: "The link is invalid or has expired.",
            successTitle: "Password Set Successfully", // ✨ تعديل النص
            successMessage: "Password has been set successfully. Redirecting to login...",
            genericError: "An unexpected error occurred. Please try again."
        }
    }), [language]);

    const t = translations[language];

    // 1. قراءة البارامترات والتحقق من الرابط
    useEffect(() => {
        // ✨ 3. إضافة شرط حماية:
        // لا تفعل شيئاً طالما المصادقة قيد التحميل
        if (authLoading) {
            setIsVerifying(true); // أبقِ "جاري التحقق" ظاهراً
            return; 
        }

        // ✨ 4. الآن المصادقة جاهزة، يمكن المتابعة
        const modeParam = searchParams.get('mode') as 'resetPassword' | null;
        const codeParam = searchParams.get('oobCode');

        if (modeParam && codeParam) {
            setMode(modeParam);
            setOobCode(codeParam);

            if (modeParam === 'resetPassword') {
                // (إزالة التأخير، التحقق الفوري أفضل)
                verifyPasswordResetCode(auth, codeParam)
                    .then(() => {
                        setError(null);
                        setIsVerifying(false); // ✅ إظهار النموذج
                    })
                    .catch((err) => {
                        console.error("Firebase verify code error:", err);
                        setError(t.invalidLink);
                        setIsVerifying(false); // ❌ إظهار الخطأ
                    });
            } else {
                setError(t.invalidLink);
                setIsVerifying(false);
            }
        } else {
            setError(t.invalidLink);
            setIsVerifying(false);
        }
    // ✨ 5. تغيير الاعتمادية من 'auth' إلى 'authLoading'
    }, [searchParams, t, authLoading]); // 🚨 التغيير هنا

    // 2. معالج حفظ كلمة المرور
    const handleSubmit = (password: string) => {
        if (!oobCode || isLoading || isVerifying || error || isSuccess) return;

        setIsLoading(true);
        
        confirmPasswordReset(auth, oobCode, password)
            .then(() => {
                setIsLoading(false);
                setIsSuccess(true); // ✨ 1. إظهار أنيميشن النجاح
                
                // ✨ 2. الانتظار ثانيتين ثم التحويل
                setTimeout(() => {
                    navigate('/login');
                }, 2000); 
            })
            .catch((err) => {
                console.error("Firebase confirm password error:", err);
                setIsLoading(false);
                showDialog({ // (إبقاء النافذة للخطأ)
                    variant: 'alert',
                    title: t.errorTitle,
                    message: t.genericError
                });
            });
    };

    return (
        <AuthActionForm
            mode={mode}
            t={t}
            language={language}
            isLoading={isLoading}
            isVerifying={isVerifying}
            isSuccess={isSuccess}
            error={error}
            handleSubmit={handleSubmit}
        />
    );
}