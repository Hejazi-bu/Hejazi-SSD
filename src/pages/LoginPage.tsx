// src/pages/LoginPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth, AuthErrorKey } from '../components/contexts/UserContext';
import { useLanguage } from '../components/contexts/LanguageContext';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useDialog } from '../components/contexts/DialogContext';
import { useActionLoading } from '../components/contexts/ActionLoadingContext';
import { CircleCheck, Eye, EyeOff, Globe, LoaderCircle, X, Mail } from 'lucide-react';
import { usePageLoading } from '../components/contexts/LoadingContext';
import { pageTransitionVariants, staggeredContainerVariants, staggeredItemVariants, fadeInVariants } from '../lib/animations';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

const logoUrl = '/favicon/favicon.svg';

// ============================================================================
// 1. TRANSLATIONS & TEXTS
// ============================================================================

type ValidationKey = 'emailRequired' | 'emailInvalid' | 'passwordRequired';

// ✅ تم إضافة errorAccountFrozen لحل مشكلة TypeScript
const translations: { [key: string]: { [key in AuthErrorKey | ValidationKey | 'title' | 'emailLabel' | 'passwordLabel' | 'loginButton' | 'loadingButton' | 'forgotPassword' | 'loggingIn' | 'errorTitle' | 'tooManyAttempts' | 'attemptsWarning' | 'lockedTitle' | 'signingIn' | 'forgotPasswordDev' | 'forgotPasswordModalTitle' | 'forgotPasswordModalDesc' | 'forgotPasswordModalEmailLabel' | 'forgotPasswordModalSendButton' | 'forgotPasswordModalSendingButton' | 'forgotPasswordModalSuccessTitle' | 'forgotPasswordModalSuccessDesc' | 'forgotPasswordModalErrorTitle' | 'forgotPasswordModalErrorDesc' | 'forgotPasswordModalCloseButton' | 'auth/missing-email' | 'auth/email-service-down' | 'auth/email-send-failed']: string } } = {
    ar: {
        title: "تسجيل الدخول",
        emailLabel: "البريد الإلكتروني",
        passwordLabel: "كلمة المرور",
        loginButton: "دخول",
        loadingButton: "جاري الدخول...",
        forgotPassword: "نسيت كلمة المرور؟",
        
        // أخطاء تسجيل الدخول
        errorCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        errorPermission: "ليس لديك الصلاحية للدخول إلى هذا النظام.",
        errorProfileNotFound: "لم يتم العثور على ملف المستخدم. يرجى مراجعة المسؤول.",
        errorGeneric: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
        errorTooManyRequests: "محاولات كثيرة جداً. تم قفل الحساب مؤقتاً.",
        errorAccountFrozen: "عذراً، تم تجميد هذا الحساب. يرجى مراجعة إدارة النظام.", // ✅ تمت الإضافة

        loggingIn: "تم التحقق بنجاح",
        errorTitle: "خطأ في تسجيل الدخول",
        tooManyAttempts: "تم قفل الحساب مؤقتاً. يرجى المحاولة بعد بضع دقائق.",
        attemptsWarning: "تنبيه: محاولات الدخول الخاطئة قد تقفل حسابك مؤقتاً.",
        lockedTitle: "تم قفل الحساب مؤقتاً",
        signingIn: "جاري التحقق...",
        forgotPasswordDev: "هذه الميزة قيد التطوير حالياً.",
        
        // التحقق من صحة المدخلات
        emailRequired: "حقل البريد الإلكتروني مطلوب.",
        emailInvalid: "صيغة البريد الإلكتروني غير صحيحة.",
        passwordRequired: "حقل كلمة المرور مطلوب.",

        // نافذة نسيت كلمة المرور
        forgotPasswordModalTitle: "إعادة تعيين كلمة المرور",
        forgotPasswordModalDesc: "أدخل بريدك الإلكتروني المسجل. سنرسل لك رابطاً (صالحاً لمدة ساعة واحدة) لتعيين كلمة مرور جديدة.",
        forgotPasswordModalEmailLabel: "البريد الإلكتروني",
        forgotPasswordModalSendButton: "إرسال رابط الاستعادة",
        forgotPasswordModalSendingButton: "جاري الإرسال...",
        forgotPasswordModalSuccessTitle: "تم إرسال الرابط بنجاح",
        forgotPasswordModalSuccessDesc: "يرجى التحقق من بريدك الإلكتروني (بما في ذلك مجلد الرسائل غير المرغوب فيها) واتباع التعليمات.",
        forgotPasswordModalErrorTitle: "خطأ",
        forgotPasswordModalErrorDesc: "حدث خطأ أثناء إرسال البريد. يرجى المحاولة مرة أخرى لاحقاً.",
        forgotPasswordModalCloseButton: "إغلاق",
        "auth/missing-email": "يرجى إدخال بريد إلكتروني.",
        "auth/email-service-down": "خدمة البريد الإلكتروني متوقفة حالياً. يرجى المحاولة لاحقاً.",
        "auth/email-send-failed": "فشل إرسال البريد الإلكتروني.",
    },
    en: {
        title: "Login",
        emailLabel: "Email Address",
        passwordLabel: "Password",
        loginButton: "Login",
        loadingButton: "Logging in...",
        forgotPassword: "Forgot Password?",
        
        // Login Errors
        errorCredentials: "Invalid email or password.",
        errorPermission: "You do not have permission to access this system.",
        errorProfileNotFound: "User profile not found. Please contact an administrator.",
        errorGeneric: "An error occurred. Please try again.",
        errorTooManyRequests: "Too many requests. Account temporarily locked.",
        errorAccountFrozen: "Sorry, this account has been frozen. Please contact administration.", // ✅ Added

        loggingIn: "Verified Successfully",
        errorTitle: "Login Error",
        tooManyAttempts: "Account temporarily locked. Please try again in a few minutes.",
        attemptsWarning: "Warning: Repeated login attempts may temporarily lock your account.",
        lockedTitle: "Account Temporarily Locked",
        signingIn: "Verifying...",
        forgotPasswordDev: "This feature is currently under development.",
        
        // Validation
        emailRequired: "Email field is required.",
        emailInvalid: "Invalid email format.",
        passwordRequired: "Password field is required.",

        // Forgot Password Modal
        forgotPasswordModalTitle: "Reset Password",
        forgotPasswordModalDesc: "Enter your registered email address. We will send you a link (valid for 1 hour) to set a new password.",
        forgotPasswordModalEmailLabel: "Email Address",
        forgotPasswordModalSendButton: "Send Reset Link",
        forgotPasswordModalSendingButton: "Sending...",
        forgotPasswordModalSuccessTitle: "Link Sent Successfully",
        forgotPasswordModalSuccessDesc: "Please check your email (including spam folder) and follow the instructions.",
        forgotPasswordModalErrorTitle: "Error",
        forgotPasswordModalErrorDesc: "An error occurred while sending the email. Please try again later.",
        forgotPasswordModalCloseButton: "Close",
        "auth/missing-email": "Please enter an email address.",
        "auth/email-service-down": "Email service is currently unavailable. Please try again later.",
        "auth/email-send-failed": "Failed to send the email.",
    },
};

// ============================================================================
// 2. HELPER COMPONENTS
// ============================================================================

const FloatingLabelInput = ({ id, label, value, type, error, language, onChange, controls, inputControls, onFocus, onBlur }: { id: string, label: string, value: string, type: string, error?: string, language: 'ar' | 'en', onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, controls: ReturnType<typeof useAnimation>, inputControls?: React.RefObject<HTMLInputElement>, onFocus?: () => void, onBlur?: () => void }) => {
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
                onFocus={() => { setIsFocused(true); onFocus?.(); }} 
                onBlur={() => { setIsFocused(false); onBlur?.(); }}
                required
                className={`w-full px-3 pb-2 pt-5 bg-transparent border-b-2 focus:outline-none transition-colors caret-white ${error ? 'border-red-500' : 'border-gray-600 focus:border-[#FFD700]'} ${isRTL ? 'text-right' : 'text-left'}`}
                ref={inputControls}
            />

            <AnimatePresence>
                {error && (<motion.p layout transition={{ layout: { duration: 0.3, ease: 'easeOut' } }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`mt-1 text-xs text-red-400 ${isRTL ? 'text-right' : 'text-left'}`}>{error}</motion.p>)}
            </AnimatePresence>
        </motion.div>
    );
}

const SuccessAnimation = ({ text }: { text: string }) => (
    <motion.div key="success" {...fadeInVariants} className="flex flex-col items-center justify-center gap-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1, transition: { type: 'spring', stiffness: 200, damping: 15, delay: 0.2 } }}>
            <CircleCheck className="w-20 h-20 text-green-400" />
        </motion.div>
        <p className="text-lg text-green-300 font-semibold">{text}</p>
    </motion.div>
);

const requestPasswordReset = httpsCallable(functions, 'requestPasswordReset');

// ============================================================================
// 3. FORGOT PASSWORD MODAL
// ============================================================================

const ForgotPasswordModal = ({ isOpen, onClose, t, language }: { isOpen: boolean, onClose: () => void, t: any, language: 'ar' | 'en' }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const emailControls = useAnimation();
    const isRTL = language === 'ar';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await requestPasswordReset({ email: email });
            setIsSuccess(true);
        } catch (err: any) {
            console.error("Error requesting password reset:", err);
            const errorCode = err.message || 'forgotPasswordModalErrorDesc';
            setError(t[errorCode] || t.forgotPasswordModalErrorDesc);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
        setTimeout(() => {
            setEmail('');
            setError(null);
            setIsSuccess(false);
            setIsLoading(false);
        }, 300);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="bg-[#1B2B3A] rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <AnimatePresence mode="wait">
                            {isSuccess ? (
                                <motion.div
                                    key="success-view"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex flex-col items-center text-center"
                                >
                                    <CircleCheck className="w-16 h-16 text-green-400 mb-4" />
                                    <h2 className="text-2xl font-bold text-white mb-2">{t.forgotPasswordModalSuccessTitle}</h2>
                                    <p className="text-gray-300 mb-6">{t.forgotPasswordModalSuccessDesc}</p>
                                    <motion.button
                                        onClick={handleClose}
                                        className="w-full bg-[#FFD700] text-black px-6 py-3 rounded-lg font-bold"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {t.forgotPasswordModalCloseButton}
                                    </motion.button>
                                </motion.div>
                            ) : (
                                <motion.form
                                    key="form-view"
                                    onSubmit={handleSubmit}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-2xl font-bold text-white">{t.forgotPasswordModalTitle}</h2>
                                        <button type="button" onClick={handleClose} className="text-gray-500 hover:text-white">
                                            <X size={24} />
                                        </button>
                                    </div>
                                    <p className="text-gray-300 mb-6">{t.forgotPasswordModalDesc}</p>
                                    
                                    <div className="relative">
                                        <FloatingLabelInput
                                            id="forgot-email"
                                            label={t.forgotPasswordModalEmailLabel}
                                            value={email}
                                            type="email"
                                            language={language}
                                            onChange={e => { setEmail(e.target.value); setError(null); }}
                                            error={error ? error : undefined}
                                            controls={emailControls}
                                        />
                                        <div className={`absolute inset-y-0 flex items-center text-gray-400 top-[-10px] ${isRTL ? 'left-0 pl-3' : 'right-0 pr-3'}`}>
                                            <Mail size={20} />
                                        </div>
                                    </div>

                                    <motion.button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-[#FFD700] text-black px-6 py-3 rounded-lg font-bold mt-6 disabled:bg-gray-600"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <LoaderCircle size={20} className="animate-spin" />
                                                <span>{t.forgotPasswordModalSendingButton}</span>
                                            </div>
                                        ) : t.forgotPasswordModalSendButton}
                                    </motion.button>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ============================================================================
// 4. MAIN LOGIN FORM
// ============================================================================

const LoginForm = () => {
    const { language, toggleLanguage } = useLanguage();
    const { signInAndCheckPermissions } = useAuth();
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [apiErrorKey, setApiErrorKey] = useState<AuthErrorKey | null>(null);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordInputType, setPasswordInputType] = useState('password');
    const [formErrors, setFormErrors] = useState<{ email?: ValidationKey; password?: ValidationKey }>({});
    const [showFormFields, setShowFormFields] = useState(false);
    
    const [showForgotModal, setShowForgotModal] = useState(false);

    const location = useLocation();
    const passwordInputRef = useRef<HTMLInputElement>(null);

    const emailControls = useAnimation();
    const passwordControls = useAnimation();
    
    const t = translations[language];
    const isRTL = language === 'ar';
    const MAX_FAILED_ATTEMPTS = 3;

    useEffect(() => {
        const timer = setTimeout(() => { setShowFormFields(true); }, 1500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const prefilledEmail = location.state?.email;
        if (prefilledEmail) {
            setEmail(prefilledEmail);
            setTimeout(() => {
                passwordInputRef.current?.focus();
            }, 100);
        }
    }, [location.state]);

    const validateForm = () => {
        const errors: { email?: ValidationKey; password?: ValidationKey } = {};
        if (!email.trim()) errors.email = 'emailRequired';
        else if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'emailInvalid';
        if (!password) errors.password = 'passwordRequired';
        setFormErrors(errors);
        if (errors.email) emailControls.start({ x: [0, -8, 8, -8, 8, 0] });
        if (errors.password) passwordControls.start({ x: [0, -8, 8, -8, 8, 0] });
        return Object.keys(errors).length === 0;
    };

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setApiErrorKey(null);
        if (!validateForm()) return;
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            showDialog({ variant: 'alert', title: t.lockedTitle, message: t.tooManyAttempts });
            return;
        }
        setIsLoading(true); showActionLoading(t.signingIn);
        const result = await signInAndCheckPermissions({ email, password });
        hideActionLoading();
        if (result.success) {
            setIsSuccess(true); setApiErrorKey(null); setFailedAttempts(0);
        } else {
            setIsLoading(false);
            const errorKey = (result.errorKey || 'errorGeneric') as AuthErrorKey;
            setApiErrorKey(errorKey);
            if (errorKey === 'errorCredentials') {
                setFailedAttempts(prev => prev + 1);
                if (failedAttempts + 1 >= MAX_FAILED_ATTEMPTS) {
                    showDialog({ variant: 'alert', title: t.lockedTitle, message: t.tooManyAttempts });
                }
            }
        }
    };

    const handleTogglePassword = () => {
        setShowPassword(prev => !prev);
        setPasswordInputType(prev => prev === 'password' ? 'text' : 'password');
    }

    return (
        <>
            <ForgotPasswordModal 
                isOpen={showForgotModal} 
                onClose={() => setShowForgotModal(false)} 
                t={t} 
                language={language} 
            />

            <motion.div key="form" {...fadeInVariants}>
                <AnimatePresence mode="wait">
                    {isSuccess ? (<SuccessAnimation text={t.loggingIn} />) : (
                        <motion.div key="login-form-wrapper">
                            <motion.div className="text-center mb-8" variants={staggeredContainerVariants} initial="initial" animate="animate">
                                <motion.img 
                                    variants={staggeredItemVariants} src={logoUrl} alt="H-SSD" className="w-24 h-24 mx-auto mb-2 cursor-pointer" 
                                    animate={{ filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.4))' }}
                                    whileHover={{ scale: 1.05, filter: 'drop-shadow(0 0 12px rgba(255, 215, 0, 0.6))' }} 
                                    transition={{ type: 'spring', stiffness: 300 }} 
                                />
                                <motion.h1 variants={staggeredItemVariants} className="text-2xl font-bold text-[#FFD700]">H-SSD</motion.h1>
                                <motion.p variants={staggeredItemVariants} className="text-gray-400">Safety & Security Development</motion.p>
                            </motion.div>
                            <AnimatePresence>
                                {showFormFields && (
                                    <motion.form noValidate onSubmit={handleLogin} className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                                        <div>
                                            <FloatingLabelInput 
                                                id="email" 
                                                label={t.emailLabel} 
                                                value={email} 
                                                type="email" 
                                                language={language} 
                                                onChange={e => {setEmail(e.target.value); setFormErrors(p => ({ ...p, email: undefined })); setApiErrorKey(null);}} 
                                                error={formErrors.email ? t[formErrors.email] : undefined} 
                                                controls={emailControls} 
                                            />
                                        </div>
                                        <div className="relative">
                                            <FloatingLabelInput 
                                                id="password" 
                                                label={t.passwordLabel} 
                                                value={password} 
                                                type={passwordInputType} 
                                                language={language} 
                                                onChange={e => {setPassword(e.target.value); setFormErrors(p => ({ ...p, password: undefined })); setApiErrorKey(null);}}
                                                error={formErrors.password ? t[formErrors.password] : undefined} 
                                                controls={passwordControls}
                                                inputControls={passwordInputRef}
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
                                        <AnimatePresence>
                                            {apiErrorKey && <motion.p layout key="api-error" {...fadeInVariants} className={`text-red-400 text-sm text-center !mt-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t[apiErrorKey]}</motion.p>}
                                            {failedAttempts > 0 && failedAttempts < MAX_FAILED_ATTEMPTS && <motion.p layout key="warning" {...fadeInVariants} className={`text-yellow-400 text-sm text-center !mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t.attemptsWarning}</motion.p>}
                                        </AnimatePresence>
                                        <div className="!mt-8">
                                            <motion.button type="submit" disabled={isLoading} className="w-full px-4 py-3 font-bold text-black bg-[#FFD700] rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-yellow-300" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>{isLoading ? t.loadingButton : t.loginButton}</motion.button>
                                        </div>
                                        <div className="flex items-center justify-between text-sm pt-2">
                                            <motion.div layout transition={{ layout: { duration: 0.3, ease: 'easeOut' } }}>
                                                <motion.button type="button" onClick={() => setShowForgotModal(true)} className="font-medium text-blue-500 hover:underline" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{t.forgotPassword}</motion.button>
                                            </motion.div>
                                            <motion.div layout transition={{ layout: { duration: 0.3, ease: 'easeOut' } }}>
                                                <motion.button type="button" onClick={toggleLanguage} className="flex items-center gap-2 font-medium text-gray-400 hover:text-[#FFD700]" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><Globe size={20} /><span>{language === 'ar' ? 'English' : 'العربية'}</span></motion.button>
                                            </motion.div>
                                        </div>
                                    </motion.form>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </>
    );
};

const LoginPage = () => {
    const { language } = useLanguage();

    return (
        <>
            <style>{`input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active{-webkit-box-shadow:0 0 0 30px #0D1B2A inset !important;-webkit-text-fill-color:#ffffff !important;caret-color:#ffffff !important;}`}</style>
            
            <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="bg-[#0D1B2A] text-white min-h-screen">
                <motion.div
                    variants={pageTransitionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex items-start md:items-center justify-center min-h-screen w-full px-4 py-16"
                >
                    <div className="w-full max-w-sm">
                        <LoginForm />
                    </div>
                </motion.div>
            </div>
        </>
    );
};

export default LoginPage;