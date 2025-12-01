import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { pageTransitionVariants, staggeredContainerVariants, staggeredItemVariants, fadeInVariants, interactiveItemVariants } from '../lib/animations'; 
import { useLanguage } from '../components/contexts/LanguageContext';
import { useDialog } from '../components/contexts/DialogContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { Eye, EyeOff, AlertTriangle, LoaderCircle, CircleCheck, Globe, Lock } from 'lucide-react'; // ✨ إضافة أيقونة القفل

// ... (FloatingLabelInput component remains the same) ...
const FloatingLabelInput = ({ id, label, value, type, error, language, onChange, controls, inputControls }: { id: string, label: string, value: string, type: string, error?: string, language: 'ar' | 'en', onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, controls: ReturnType<typeof useAnimation>, inputControls?: React.RefObject<HTMLInputElement> }) => {
    // ... (نفس الكود السابق)
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
                ref={inputControls}
            />

            <AnimatePresence>
                {error && (<motion.p layout transition={{ layout: { duration: 0.3, ease: 'easeOut' } }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`mt-1 text-xs text-red-400 ${isRTL ? 'text-right' : 'text-left'}`}>{error}</motion.p>)}
            </AnimatePresence>
        </motion.div>
    );
};

// ... (SuccessAnimation remains the same) ...
const SuccessAnimation = ({ text }: { text: string }) => (
    <motion.div key="success" {...fadeInVariants} className="flex flex-col items-center justify-center gap-4 h-48">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1, transition: { type: 'spring', stiffness: 200, damping: 15, delay: 0.2 } }}>
            <CircleCheck className="w-20 h-20 text-green-400" />
        </motion.div>
        <p className="text-lg text-green-300 font-semibold">{text}</p>
    </motion.div>
);

// ✨ مكون جديد لعرض حالة التجميد بشكل أنيق
const FrozenAccountMessage = ({ t }: { t: any }) => (
    <motion.div key="frozen" {...fadeInVariants} className="flex flex-col items-center justify-center gap-4 p-6 bg-red-900/20 border border-red-500/30 rounded-lg">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
            <Lock className="w-16 h-16 text-red-400" />
        </motion.div>
        <h3 className="text-xl text-red-400 font-bold">{t.accountFrozenTitle}</h3>
        <p className="text-center text-gray-300 text-sm leading-relaxed">
            {t["auth/account-frozen"]}
        </p>
    </motion.div>
);

const redeemPasswordResetToken = httpsCallable(functions, 'redeemPasswordResetToken');

function SetPasswordForm({
    t,
    isLoading,
    isSuccess,
    isFrozen, // ✨ prop جديد
    error,
    handleSubmit,
    language,
    toggleLanguage,
}: {
    t: any;
    isLoading: boolean;
    isSuccess: boolean;
    isFrozen: boolean; // ✨ prop جديد
    error: string | null;
    handleSubmit: (password: string) => void;
    language: 'ar' | 'en';
    toggleLanguage: () => void;
}) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [showPassword, setShowPassword] = useState(false);
    const [passwordInputType, setPasswordInputType] = useState('password');
    
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [confirmPasswordInputType, setConfirmPasswordInputType] = useState('password');

    const [passwordsMismatch, setPasswordsMismatch] = useState(true);
    
    const passwordControls = useAnimation();
    const confirmPasswordControls = useAnimation();
    
    const isRTL = language === 'ar';

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordsMismatch(true); 
        if (password !== confirmPassword) {
            setPasswordsMismatch(false);
            confirmPasswordControls.start({ x: [0, -8, 8, -8, 8, 0] }); 
            return;
        }
        if (!password) return;
        handleSubmit(password);
    };

    const handleTogglePassword = () => {
        setShowPassword(prev => !prev);
        setPasswordInputType(prev => prev === 'password' ? 'text' : 'password');
    }

    const handleToggleConfirmPassword = () => {
        setShowConfirmPassword(prev => !prev);
        setConfirmPasswordInputType(prev => prev === 'password' ? 'text' : 'password');
    }
    
    return (
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
                    <motion.div className="text-center mb-8" variants={staggeredContainerVariants} initial="initial" animate="animate">
                        <motion.img 
                            variants={staggeredItemVariants} 
                            src="/favicon/favicon.svg"
                            alt="H-SSD" 
                            className="w-24 h-24 mx-auto mb-2" 
                            animate={{ filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.4))' }}
                            transition={{ type: 'spring', stiffness: 300 }} 
                        />
                        <motion.h1 variants={staggeredItemVariants} className="text-2xl font-bold text-[#FFD700]">H-SSD</motion.h1>
                        <motion.p variants={staggeredItemVariants} className="text-gray-400">Safety & Security Development</motion.p>
                    </motion.div>
                    
                    <AnimatePresence mode="wait">
                        {isSuccess ? (
                            <SuccessAnimation text={t.successTitle} />
                        ) : isFrozen ? ( // ✨ عرض رسالة التجميد إذا كان الحساب مجمداً
                            <FrozenAccountMessage t={t} />
                        ) : (
                            <motion.form
                                key="form"
                                onSubmit={onSubmit}
                                initial={{ opacity: 0, y: 20 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0 }} 
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="space-y-6 w-full"
                            >
                                <div className="relative">
                                    <FloatingLabelInput 
                                        id="password" 
                                        label={t.newPassword} 
                                        value={password} 
                                        type={passwordInputType} 
                                        language={language} 
                                        onChange={e => {setPassword(e.target.value); setPasswordsMismatch(true);}}
                                        controls={passwordControls}
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

                                <div className="relative">
                                    <FloatingLabelInput 
                                        id="confirmPassword" 
                                        label={t.confirmPassword} 
                                        value={confirmPassword} 
                                        type={confirmPasswordInputType}
                                        language={language} 
                                        onChange={e => {setConfirmPassword(e.target.value); setPasswordsMismatch(true);}}
                                        error={!passwordsMismatch ? t.passwordsMismatch : undefined} 
                                        controls={confirmPasswordControls}
                                    />
                                    <motion.button 
                                        layout
                                        type="button" 
                                        onClick={handleToggleConfirmPassword}
                                        className={`absolute inset-y-0 flex items-center text-gray-400 hover:text-white top-[-10px] ${isRTL ? 'left-0 pl-3' : 'right-0 pr-3'}`} 
                                        transition={{ layout: { duration: 0.3, ease: 'easeOut' }, type: 'spring', stiffness: 500, damping: 30 }} 
                                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    >
                                        <AnimatePresence mode="wait" initial={false}>
                                            <motion.div key={showConfirmPassword ? 'eye-off' : 'eye'} initial={{ opacity: 0, rotate: -45, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 45, scale: 0.5 }} transition={{ duration: 0.2 }}>
                                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </motion.div>
                                        </AnimatePresence>
                                    </motion.button>
                                </div>

                                <AnimatePresence>
                                    {error && (
                                        <motion.p layout {...fadeInVariants} className={`text-red-400 text-sm text-center !mt-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                                            <div className="flex items-center justify-center gap-2">
                                                <AlertTriangle size={16} />
                                                <span>{t[error] || error}</span>
                                            </div>
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                                
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

                                <div className="flex items-center justify-center text-sm pt-2">
                                    <motion.div layout transition={{ layout: { duration: 0.3, ease: 'easeOut' } }}>
                                        <motion.button type="button" onClick={toggleLanguage} className="flex items-center gap-2 font-medium text-gray-400 hover:text-[#FFD700]" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                            <Globe size={20} />
                                            <span>{language === 'ar' ? 'English' : 'العربية'}</span>
                                        </motion.button>
                                    </motion.div>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

export default function SetPasswordPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { language, toggleLanguage } = useLanguage();
    const { showDialog } = useDialog();

    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFrozen, setIsFrozen] = useState(false); // ✨ حالة التجميد

    const translations = useMemo(() => ({
        ar: {
            // ... (الترجمات السابقة)
            newPassword: "كلمة المرور الجديدة",
            confirmPassword: "تأكيد كلمة المرور",
            saveButton: "حفظ كلمة المرور",
            saving: "جاري الحفظ...",
            passwordsMismatch: "كلمتا المرور غير متطابقتين.",
            errorTitle: "خطأ",
            invalidLink: "الرابط غير صالح أو انتهت صلاحيته.",
            successTitle: "تم تعيين كلمة المرور بنجاح",
            successMessage: "تم تعيين كلمة المرور بنجاح. سيتم تحويلك لصفحة تسجيل الدخول.",
            "auth/weak-password": "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.",
            "auth/invalid-token": "الرابط غير صالح أو انتهت صلاحيته. (T_NF)",
            "auth/token-expired": "انتهت صلاحية الرابط. يرجى طلب رابط جديد. (T_EXP)",
            "auth/internal-error": "حدث خطأ داخلي. يرجى المحاولة مرة أخرى. (T_INT)",
            genericError: "حدث خطأ غير متوقع. حاول مرة أخرى.",

            // ✨ الترجمات الجديدة لحالة التجميد
            accountFrozenTitle: "الحساب مجمد مؤقتاً",
            "auth/account-frozen": "عذراً، تم تجميد هذا الحساب مؤقتاً من قبل الإدارة. لا يمكنك تعيين كلمة المرور أو تفعيل الحساب حالياً. يرجى التواصل مع المسؤول للنظر في حالتك.",
        },
        en: {
            // ... (Previous translations)
            newPassword: "New Password",
            confirmPassword: "Confirm Password",
            saveButton: "Save Password",
            saving: "Saving...",
            passwordsMismatch: "Passwords do not match.",
            errorTitle: "Error",
            invalidLink: "The link is invalid or has expired.",
            successTitle: "Password Set Successfully",
            successMessage: "Password has been set successfully. Redirecting to login...",
            "auth/weak-password": "Password must be at least 6 characters long.",
            "auth/invalid-token": "The link is invalid or has expired. (T_NF)",
            "auth/token-expired": "The link has expired. Please request a new one. (T_EXP)",
            "auth/internal-error": "An internal error occurred. Please try again. (T_INT)",
            genericError: "An unexpected error occurred. Please try again.",

            // ✨ New Translations for Frozen Status
            accountFrozenTitle: "Account Temporarily Frozen",
            "auth/account-frozen": "Sorry, this account has been temporarily frozen by the administration. You cannot set a password or activate the account at this time. Please contact the administrator.",
        }
    }), [language]);

    const t = translations[language];

    useEffect(() => {
        const tokenParam = searchParams.get('token');

        if (tokenParam) {
            setToken(tokenParam);
            setError(null);
        } else {
            setError(t.invalidLink);
        }
    }, [searchParams, t]);

    const handleSubmit = (password: string) => {
        if (!token || isLoading || isSuccess) return;

        setIsLoading(true);
        setError(null);
        setIsFrozen(false); // ريست لحالة التجميد
        
        redeemPasswordResetToken({ token: token, password: password })
            .then((result) => {
                setIsLoading(false);
                setIsSuccess(true); 
                
                const userEmail = (result.data as any)?.email;

                setTimeout(() => {
                    navigate('/login', { state: { email: userEmail } });
                }, 2000); 
            })
            .catch((err: any) => {
                console.error("Error redeeming token:", err);
                setIsLoading(false);
                
                let errorMessage = err.message || t.genericError;
                
                // 🔥 معالجة خطأ التجميد
                if (errorMessage.includes("(ACC_FRZ)")) {
                    setIsFrozen(true); // تفعيل وضع التجميد
                    errorMessage = "auth/account-frozen"; // لا نحتاج لعرض رسالة خطأ نصية عادية لأننا سنعرض المكون الكامل
                } else if (errorMessage.includes("(T_NF)")) {
                    errorMessage = "auth/invalid-token";
                } else if (errorMessage.includes("(T_EXP)")) {
                    errorMessage = "auth/token-expired";
                } else if (errorMessage.includes("(T_INT)")) {
                    errorMessage = "auth/internal-error";
                }
                
                // إذا كان مجمداً لا نعرض رسالة الخطأ الصغيرة أسفل الزر، بل المكون الكبير
                if (!errorMessage.includes("account-frozen")) {
                    setError(errorMessage);
                }
            });
    };

    return (
        <SetPasswordForm
            t={t}
            language={language}
            toggleLanguage={toggleLanguage}
            isLoading={isLoading}
            isSuccess={isSuccess}
            isFrozen={isFrozen} // ✨ تمرير الحالة
            error={error} 
            handleSubmit={handleSubmit}
        />
    );
}