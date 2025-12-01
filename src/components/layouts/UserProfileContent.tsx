// C:\Users\user\Music\hejazi-logic\src\components\layouts\UserProfileContent.tsx
import React, { useState, useEffect, ReactNode, memo, useRef, forwardRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import SignatureCanvas from 'react-signature-canvas';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/UserContext';
import { useDialog } from '../contexts/DialogContext';
import { useActionLoading } from '../contexts/ActionLoadingContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import {
    X as XIcon, LogOut, Settings, User as UserIcon,
    ShieldCheck, Phone, Hash, Mars, Venus, UserRound,
    Mail, Building, Briefcase, KeyRound, Eye, EyeOff,
    UploadCloud, Trash2, PencilLine, Stamp, Image as ImageIcon,
    RotateCcw, Camera, Pencil, Info as InfoIcon, ChevronDown,
    ChevronUp, Globe, ShieldOff, Download
} from 'lucide-react';
import { fadeInVariants, scaleInModalVariants } from '../../lib/animations';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from '../../lib/firebase';
import { SmartSignaturePad } from '../common/SmartSignaturePad';

// ✨ ملاحظة: جميع الـ Modals والـ Helpers موجودة الآن في هذا الملف الموحد

// #region --- Password Change Modal ---
const PasswordInput = memo(forwardRef<HTMLInputElement, any>(({ label, isError, value, onChange, type, onToggleVisibility, language }, ref) => {
    const isRTL = language === 'ar';
    return (
        <div>
            <label className="text-sm text-gray-400 mb-1 block">{label}</label>
            <div className="relative">
                <input
                    ref={ref}
                    type={type}
                    value={value}
                    onChange={onChange}
                    className={`transition-colors w-full bg-gray-800 text-white rounded-lg p-2 focus:outline-none focus:ring-2 ${isError ? 'ring-red-500' : 'ring-transparent focus:ring-[#FFD700]'} ${isRTL ? 'pl-10' : 'pr-10'}`}
                />
                <button type="button" onClick={onToggleVisibility} className={`absolute inset-y-0 flex items-center px-3 text-gray-400 hover:text-white ${isRTL ? 'left-0' : 'right-0'}`}>
                    {type === 'text' ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>
        </div>
    );
}));

function ChangePasswordModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { hasPermission } = useAuth();
    const { language } = useLanguage();
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({ current: '', new: '', confirm: '' });
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [isCurrentVisible, setIsCurrentVisible] = useState(false);
    const [isNewVisible, setIsNewVisible] = useState(false);
    const [isConfirmVisible, setIsConfirmVisible] = useState(false);
    const currentPassRef = useRef<HTMLInputElement>(null);
    const newPassRef = useRef<HTMLInputElement>(null);
    const confirmPassRef = useRef<HTMLInputElement>(null);
    const controls = useAnimation();
    const shakeVariants = { shake: { x: [0, -8, 8, -8, 8, 0], transition: { duration: 0.4 } } };

    useEffect(() => {
        if (!isOpen) {
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
            setErrors({ current: '', new: '', confirm: '' });
            setIsCurrentVisible(false); setIsNewVisible(false); setIsConfirmVisible(false);
        }
    }, [isOpen]);

    const t = language === 'ar' ? {
        title: "تغيير كلمة المرور", current: "كلمة المرور الحالية", new: "كلمة المرور الجديدة", confirm: "تأكيد كلمة المرور الجديدة", save: "حفظ التغييرات", cancel: "إلغاء", emptyFields: "هذا الحقل مطلوب.", wrongCurrent: "كلمة المرور الحالية غير صحيحة.", mismatch: "كلمتا المرور غير متطابقتين.", successTitle: "نجاح", successMsg: "تم تغيير كلمة المرور بنجاح.", errorTitle: "خطأ", errorMsg: "حدث خطأ ما. يرجى المحاولة مرة أخرى.", weakPassword: 'كلمة المرور الجديدة ضعيفة جدًا (6 أحرف على الأقل).',
        tooManyRequests: 'محاولات فاشلة كثيرة. لحمايتك، تم حظر الوصول مؤقتًا. يرجى الانتظار بضع دقائق والمحاولة مرة أخرى.',
        warningLockout: 'لأمانك، سيتم قفل الحساب مؤقتًا بعد عدة محاولات أخرى.',
        saving: 'جاري حفظ كلمة المرور',
        permissionDenied: 'ليس لديك صلاحية تغيير كلمة المرور.',
    } : {
        title: "Change Password", current: "Current Password", new: "New Password", confirm: "Confirm New Password", save: "Save Changes", cancel: "Cancel", emptyFields: "This field is required.", wrongCurrent: "The current password is incorrect.", mismatch: "The new passwords do not match.", successTitle: "Success", successMsg: "Password changed successfully.", errorTitle: "Error", errorMsg: "An error occurred. Please try again.", weakPassword: 'The new password is too weak (at least 6 characters).',
        tooManyRequests: 'Too many failed attempts. For your security, access has been temporarily blocked. Please wait a few minutes and try again.',
        warningLockout: 'For your security, the account will be temporarily locked after several more attempts.',
        saving: 'Saving new password',
        permissionDenied: 'You do not have permission to change the password.',
    };

    useEffect(() => {
        if (isOpen && !hasPermission('sss:20')) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDenied });
            onClose();
        }
    }, [isOpen, hasPermission, onClose, showDialog, t.errorTitle, t.permissionDenied]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasPermission('sss:20')) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDenied });
            return;
        }
        let validationErrors = { current: '', new: '', confirm: '' };
        let firstErrorRef: React.RefObject<HTMLInputElement> | null = null;
        if (!currentPassword) { validationErrors.current = t.emptyFields; firstErrorRef = firstErrorRef || currentPassRef; }
        if (!newPassword) { validationErrors.new = t.emptyFields; firstErrorRef = firstErrorRef || newPassRef; }
        if (!confirmPassword) { validationErrors.confirm = t.emptyFields; firstErrorRef = firstErrorRef || confirmPassRef; }
        if (newPassword && confirmPassword && newPassword !== confirmPassword) { validationErrors.confirm = t.mismatch; firstErrorRef = firstErrorRef || confirmPassRef; }
        if (Object.values(validationErrors).some(err => err)) {
            setErrors(validationErrors);
            controls.start("shake");
            firstErrorRef?.current?.focus();
            return;
        }
        setIsLoading(true);
        showActionLoading(t.saving);
        try {
            const user = auth.currentUser;
            if (user && user.email) {
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, newPassword);
                showDialog({ variant: 'alert', title: t.successTitle, message: t.successMsg });
                onClose();
            } else { throw new Error("User not found."); }
        } catch (error: any) {
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                const newAttemptCount = failedAttempts + 1;
                setFailedAttempts(newAttemptCount);
                let errorMessage = t.wrongCurrent;
                if (newAttemptCount >= 2) {
                    errorMessage += ` ${t.warningLockout}`;
                }
                setErrors(prev => ({ ...prev, current: errorMessage }));
                currentPassRef.current?.focus();
                controls.start("shake");
            } else if (error.code === 'auth/weak-password') {
                setErrors(prev => ({ ...prev, new: t.weakPassword }));
                newPassRef.current?.focus();
                controls.start("shake");
            } else if (error.code === 'auth/too-many-requests') {
                showDialog({ variant: 'alert', title: t.errorTitle, message: t.tooManyRequests });
            }
            else {
                showDialog({ variant: 'alert', title: t.errorTitle, message: error.message || t.errorMsg });
            }
        } finally {
            hideActionLoading();
            setIsLoading(false);
        }
    };

    const ErrorMessage = ({ msg }: { msg: string }) => (
        <AnimatePresence>
            {msg && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-500 text-xs mt-1">{msg}</motion.p>}
        </AnimatePresence>
    );
    if (!isOpen || !hasPermission('sss:20')) return null;
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="fixed inset-0 bg-black/70 z-[60] p-4 overflow-y-auto flex" onClick={onClose}>
                    <motion.div variants={scaleInModalVariants} className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl m-auto" onClick={e => e.stopPropagation()}>
                        <form onSubmit={handleSubmit} noValidate>
                            <motion.div variants={shakeVariants} animate={controls} className="p-6">
                                <h3 className="text-xl font-bold text-white mb-4">{t.title}</h3>
                                <div className="space-y-4">
                                    <div>
                                        <PasswordInput ref={currentPassRef} label={t.current} value={currentPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setCurrentPassword(e.target.value); setErrors(prev => ({ ...prev, current: '' })); }} type={isCurrentVisible ? 'text' : 'password'} onToggleVisibility={() => setIsCurrentVisible(!isCurrentVisible)} language={language} isError={!!errors.current} />
                                        <ErrorMessage msg={errors.current} />
                                    </div>
                                    <div>
                                        <PasswordInput ref={newPassRef} label={t.new} value={newPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setNewPassword(e.target.value); setErrors(prev => ({ ...prev, new: '', confirm: '' })); }} type={isNewVisible ? 'text' : 'password'} onToggleVisibility={() => setIsNewVisible(!isNewVisible)} language={language} isError={!!errors.new} />
                                        <ErrorMessage msg={errors.new} />
                                    </div>
                                    <div>
                                        <PasswordInput ref={confirmPassRef} label={t.confirm} value={confirmPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirm: '' })); }} type={isConfirmVisible ? 'text' : 'password'} onToggleVisibility={() => setIsConfirmVisible(!isConfirmVisible)} language={language} isError={!!errors.confirm} />
                                        <ErrorMessage msg={errors.confirm} />
                                    </div>
                                </div>
                            </motion.div>
                            <div className="bg-gray-800/50 px-6 py-3 flex justify-end gap-3 rounded-b-2xl">
                                <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg text-white hover:bg-gray-700 transition-colors">{t.cancel}</button>
                                <button type="submit" disabled={isLoading} className="py-2 px-4 rounded-lg bg-[#FFD700] text-black font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isLoading ? '...' : t.save}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
// #endregion

function LiveSignatureModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user, manageUserMedia, hasPermission } = useAuth();
    const { language } = useLanguage();
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const [isProcessing, setIsProcessing] = useState(false);

    const t = language === 'ar' ? {
        title: "إدارة التوقيع", current: "التوقيع الحالي", new: "توقيع جديد",
        clear: "مسح", save: "اعتماد التوقيع", cancel: "إلغاء", saving: "جاري معالجة وحفظ التوقيع...",
        successTitle: "نجاح", successSave: "تم حفظ التوقيع بنجاح.", errorTitle: "خطأ",
        errorMsg: "فشل حفظ التوقيع. يرجى المحاولة مرة أخرى.",
        delete: "حذف التوقيع",
        deleting: "جاري حذف التوقيع...",
        successDelete: "تم حذف التوقيع بنجاح.",
        confirmDeleteTitle: "تأكيد الحذف",
        confirmDeleteMsg: "هل أنت متأكد أنك تريد حذف توقيعك الحالي؟",
        permissionDeniedView: "ليس لديك صلاحية عرض هذا القسم.",
        permissionDeniedModify: "ليس لديك صلاحية تعديل التوقيع.",
        permissionDeniedDelete: "ليس لديك صلاحية حذف التوقيع.",
        download: "تنزيل",
    } : {
        title: "Manage Signature", current: "Current Signature", new: "New Signature",
        clear: "Clear", save: "Save Signature", cancel: "Cancel", saving: "Processing and saving signature...",
        successTitle: "Success", successSave: "Signature saved successfully.", errorTitle: "Error",
        errorMsg: "Failed to save signature. Please try again.",
        delete: "Delete Signature",
        deleting: "Deleting signature...",
        successDelete: "Signature deleted successfully.",
        confirmDeleteTitle: "Confirm Deletion",
        confirmDeleteMsg: "Are you sure you want to delete your current signature?",
        permissionDeniedView: "You do not have permission to view this section.",
        permissionDeniedModify: "You do not have permission to modify the signature.",
        permissionDeniedDelete: "You do not have permission to delete the signature.",
        download: "Download",
    };

    useEffect(() => {
        if (isOpen && !hasPermission('sss:21')) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedView });
            onClose();
        }
    }, [isOpen, hasPermission, onClose, showDialog, t.errorTitle, t.permissionDeniedView]);

    // دالة الحفظ الجديدة التي تستقبل الصورة الجاهزة من SmartSignaturePad
    const handleSaveSignature = async (processedSignatureUrl: string) => {
        if (!hasPermission('sss:22')) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedModify });
            return;
        }
        
        setIsProcessing(true);
        showActionLoading(t.saving);
        
        const result = await manageUserMedia('signature', processedSignatureUrl);
        
        hideActionLoading();
        setIsProcessing(false);
        
        if (result.success) {
            showDialog({ variant: 'alert', title: t.successTitle, message: t.successSave });
            onClose();
        } else {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.errorMsg });
        }
    };

    const handleDelete = () => {
        if (!hasPermission('sss:23')) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedDelete });
            return;
        }
        showDialog({
            variant: 'confirm',
            title: t.confirmDeleteTitle,
            message: t.confirmDeleteMsg,
            onConfirm: async () => {
                if (!hasPermission('sss:23')) {
                    showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedDelete });
                    return;
                }
                setIsProcessing(true);
                showActionLoading(t.deleting);
                const result = await manageUserMedia('signature', null);
                hideActionLoading();
                setIsProcessing(false);
                if (result.success) {
                    showDialog({ variant: 'alert', title: t.successTitle, message: t.successDelete });
                    onClose();
                } else {
                    showDialog({ variant: 'alert', title: t.errorTitle, message: t.errorMsg });
                }
            }
        });
    };

    if (!isOpen || !hasPermission('sss:21')) return null;
    
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="fixed inset-0 bg-black/70 z-[60] p-4 flex" onClick={onClose}>
                    <motion.div variants={scaleInModalVariants} className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl m-auto overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-800 pb-4">{t.title}</h3>
                            
                            <div className="space-y-6">
                                {/* عرض التوقيع الحالي إن وجد */}
                                {user?.signature_url && (
                                    <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{t.current}</h4>
                                            
                                            <div className="flex items-center gap-2">
                                                {/* ✨ زر التنزيل الجديد - صلاحية sss:27 */}
                                                {hasPermission('sss:27') && (
                                                    <button 
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            try {
                                                                const response = await fetch(user.signature_url!);
                                                                const blob = await response.blob();
                                                                const url = window.URL.createObjectURL(blob);
                                                                const a = document.createElement('a');
                                                                a.style.display = 'none';
                                                                a.href = url;
                                                                a.download = `signature_${user.employee_id || user.id}.png`; // اسم الملف عند التنزيل
                                                                document.body.appendChild(a);
                                                                a.click();
                                                                window.URL.revokeObjectURL(url);
                                                                document.body.removeChild(a);
                                                            } catch (error) {
                                                                console.error('Download failed:', error);
                                                                // في حال الفشل، نفتح الصورة في تبويب جديد كخيار بديل
                                                                window.open(user.signature_url || '', '_blank');
                                                            }
                                                        }}
                                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
                                                        title={t.download}
                                                    >
                                                        <Download size={12} />
                                                        {t.download}
                                                    </button>
                                                )}
                                                {hasPermission('sss:23') && (
                                                    <button 
                                                        onClick={handleDelete} 
                                                        disabled={isProcessing}
                                                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors disabled:opacity-50"
                                                    >
                                                        <Trash2 size={12} />
                                                        {t.delete}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="h-20 flex items-center justify-center bg-white/5 rounded-lg">
                                             <img src={user.signature_url} alt="Current Signature" className="max-h-full max-w-full object-contain" />
                                        </div>
                                    </div>
                                )}

                                {/* منطقة التوقيع الجديد */}
                                <div>
                                    <h4 className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-semibold">{t.new}</h4>
                                    <SmartSignaturePad 
                                        onSave={handleSaveSignature}
                                        isProcessing={isProcessing}
                                        initialUrl={user?.signature_url}
                                        labels={{
                                            clear: t.clear,
                                            save: t.save,
                                            title: language === 'ar' ? 'لوحة الرسم' : 'Drawing Pad'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800/50 px-6 py-3 flex justify-end border-t border-gray-800">
                            <button type="button" onClick={onClose} disabled={isProcessing} className="text-sm text-gray-400 hover:text-white transition-colors py-2 px-4">
                                {t.cancel}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// #region --- Media Upload Modal (Seal & Avatar) ---
function MediaUploadModal({ isOpen, onClose, type }: { isOpen: boolean, onClose: () => void, type: 'seal' | 'avatar' }) {
    const { user, manageUserMedia, hasPermission } = useAuth();
    const { language } = useLanguage();
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isSeal = type === 'seal';
    const currentImageUrl = isSeal ? user?.seal_url : user?.avatar_url;

    const viewPermissionKey = isSeal ? 'sss:24' : 'sss:18';
    const savePermissionKey = isSeal ? 'sss:25' : 'sss:18';
    const deletePermissionKey = isSeal ? 'sss:26' : 'sss:19';

    useEffect(() => {
        if (!isOpen) {
            setNewImagePreview(null);
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [isOpen]);

    const modalTitles = language === 'ar' ? {
        avatar: "إدارة الصورة الشخصية",
        seal: "إدارة الختم",
    } : {
        avatar: "Manage Profile Picture",
        seal: "Manage Seal",
    };

    const t = language === 'ar' ? {
        current: "الحالي", new: "الجديد", uploadPrompt: "اسحب وأفلت صورة هنا، أو انقر للتحديد",
        change: "تغيير...", delete: "حذف", save: "حفظ", cancel: "إلغاء",
        saving: isSeal ? "جاري حفظ الختم..." : "جاري حفظ الصورة...",
        deleting: isSeal ? "جاري حذف الختم..." : "جاري حذف الصورة...",
        successTitle: "نجاح",
        successSave: isSeal ? "تم حفظ الختم بنجاح." : "تم حفظ الصورة بنجاح.",
        successDelete: isSeal ? "تم حذف الختم بنجاح." : "تم حذف الصورة بنجاح.",
        errorTitle: "خطأ",
        errorMsg: isSeal ? "فشل حفظ الختم." : "فشل حفظ الصورة.",
        confirmDeleteTitle: "تأكيد الحذف",
        confirmDeleteMsg: isSeal ? "هل أنت متأكد أنك تريد حذف ختمك الحالي؟" : "هل أنت متأكد أنك تريد حذف صورتك الحالية؟",
        permissionDeniedView: isSeal ? "ليس لديك صلاحية عرض الختم." : "ليس لديك صلاحية عرض الصورة.",
        permissionDeniedSave: isSeal ? "ليس لديك صلاحية تعديل الختم." : "ليس لديك صلاحية تغيير الصورة.",
        permissionDeniedDelete: isSeal ? "ليس لديك صلاحية حذف الختم." : "ليس لديك صلاحية حذف الصورة.",
        download: "تنزيل",
    } : {
        current: "Current", new: "New", uploadPrompt: "Drag & drop an image here, or click to select",
        change: "Change...", delete: "Delete", save: "Save", cancel: "Cancel",
        saving: isSeal ? "Saving seal..." : "Saving picture...",
        deleting: isSeal ? "Deleting seal..." : "Deleting picture...",
        successTitle: "Success",
        successSave: isSeal ? "Seal saved successfully." : "Picture saved successfully.",
        successDelete: isSeal ? "Seal deleted successfully." : "Picture deleted successfully.",
        errorTitle: "Error",
        errorMsg: isSeal ? "Failed to save seal." : "Failed to save picture.",
        confirmDeleteTitle: "Confirm Deletion",
        confirmDeleteMsg: isSeal ? "Are you sure you want to delete your current seal?" : "Are you sure you want to delete your current picture?",
        permissionDeniedView: isSeal ? "You do not have permission to view the seal." : "You do not have permission to view the picture.",
        permissionDeniedSave: isSeal ? "You do not have permission to change the seal." : "You do not have permission to change the picture.",
        permissionDeniedDelete: isSeal ? "You do not have permission to delete the seal." : "You do not have permission to delete the picture.",
        download: "Download",
    };

    useEffect(() => {
        if (isOpen && !hasPermission(viewPermissionKey)) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedView });
            onClose();
        }
    }, [isOpen, hasPermission, onClose, showDialog, viewPermissionKey, t.errorTitle, t.permissionDeniedView]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!hasPermission(savePermissionKey)) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedSave });
            return;
        }
        const file = e.target.files?.[0];
        if (file && (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg" || file.type === "image/svg+xml")) {
            const reader = new FileReader();
            reader.onloadend = () => setNewImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!hasPermission(savePermissionKey)) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedSave });
            return;
        }
        if (!newImagePreview) return;
        setIsProcessing(true);
        showActionLoading(t.saving);
        const result = await manageUserMedia(type, newImagePreview);
        hideActionLoading();
        setIsProcessing(false);
        if (result.success) {
            showDialog({ variant: 'alert', title: t.successTitle, message: t.successSave });
            onClose();
        } else {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.errorMsg });
        }
    };

    const handleDelete = () => {
        if (!hasPermission(deletePermissionKey)) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedDelete });
            return;
        }
        showDialog({
            variant: 'confirm',
            title: t.confirmDeleteTitle,
            message: t.confirmDeleteMsg,
            onConfirm: async () => {
                if (!hasPermission(deletePermissionKey)) {
                    showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedDelete });
                    return;
                }
                setIsProcessing(true);
                showActionLoading(t.deleting);
                const result = await manageUserMedia(type, null);
                hideActionLoading();
                setIsProcessing(false);
                if (result.success) {
                    showDialog({ variant: 'alert', title: t.successTitle, message: t.successDelete });
                    onClose();
                } else {
                    showDialog({ variant: 'alert', title: t.errorTitle, message: t.errorMsg });
                }
            }
        });
    };

    const ImageBox = ({ src, title, children }: { src?: string | null, title: string, children?: ReactNode }) => (
        <div className="w-1/2 flex flex-col items-center">
            <h4 className="text-gray-400 mb-2">{title}</h4>
            <div className="w-full h-32 bg-gray-800/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-700 overflow-hidden p-2">
                {src ? <img src={src} alt={title} className="max-w-full max-h-full object-contain" /> : children || <ImageIcon size={40} className="text-gray-600" />}
            </div>
        </div>
    );

    if (!isOpen || !hasPermission(viewPermissionKey)) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="fixed inset-0 bg-black/70 z-[60] p-4 flex" onClick={onClose}>
                    <motion.div variants={scaleInModalVariants} className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl m-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-4">{modalTitles[type]}</h3>
                            <div className="flex gap-4 mb-4">
                                <ImageBox src={currentImageUrl} title={t.current} />
                                <ImageBox src={newImagePreview} title={t.new}>
                                    <div className="text-center text-gray-500">
                                        <UploadCloud size={30} className="mx-auto mb-1" />
                                        <p className="text-xs">{t.uploadPrompt}</p>
                                    </div>
                                </ImageBox>
                            </div>
                            {/* حقل الإدخال المخفي (لم يتغير) */}
                            <input ref={fileInputRef} type="file" accept="image/png, image/jpeg, image/jpg, image/svg+xml" onChange={handleFileChange} className="hidden" />

                            {/* زر تغيير الصورة (قمنا فقط بتقليل الهامش السفلي mb-3 بدلاً من mb-4) */}
                            {hasPermission(savePermissionKey) && (
                                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full text-center py-2 px-4 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors mb-3">{t.change}</button>
                            )}

                            {/* حاوية جديدة لوضع زر التنزيل وزر الحذف بجانب بعضهما */}
                            <div className="flex gap-3">
                                
                                {/* ✨ زر التنزيل الجديد (يظهر فقط إذا كان ختماً + يوجد صورة + صلاحية sss:28) */}
                                {currentImageUrl && isSeal && hasPermission('sss:28') && (
                                    <button 
                                        onClick={async () => {
                                            try {
                                                const response = await fetch(currentImageUrl);
                                                const blob = await response.blob();
                                                const url = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.style.display = 'none';
                                                a.href = url;
                                                a.download = `seal_${user?.employee_id || user?.id}.png`; // اسم الملف
                                                document.body.appendChild(a);
                                                a.click();
                                                window.URL.revokeObjectURL(url);
                                                document.body.removeChild(a);
                                            } catch (error) {
                                                console.error('Download failed:', error);
                                                window.open(currentImageUrl, '_blank');
                                            }
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-800/50 text-blue-400 hover:bg-blue-800/80 hover:text-blue-300 transition-colors"
                                    >
                                        <Download size={16} />
                                        {t.download}
                                    </button>
                                )}

                                {/* زر الحذف (تمت إضافة flex-1 ليأخذ نصف المساحة) */}
                                {currentImageUrl && hasPermission(deletePermissionKey) && (
                                    <button 
                                        onClick={handleDelete} 
                                        disabled={isProcessing} 
                                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-red-800/50 text-red-400 hover:bg-red-800/80 hover:text-red-300 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                        {t.delete}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-800/50 px-6 py-3 flex justify-end gap-3 rounded-b-2xl">
                            <button type="button" onClick={onClose} disabled={isProcessing} className="py-2 px-4 rounded-lg text-white hover:bg-gray-700 transition-colors">{t.cancel}</button>
                            {hasPermission(savePermissionKey) && (
                                <button type="button" onClick={handleSave} disabled={isProcessing || !newImagePreview} className="py-2 px-4 rounded-lg bg-[#FFD700] text-black font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isProcessing ? '...' : t.save}</button>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
// #endregion

// #region --- Helper Components ---
const getInfoValue = (value: any) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    return value;
};

const InfoRow = ({ icon, label, value, actionButton }: { icon: ReactNode, label: string, value?: any, actionButton?: ReactNode }) => {
    const displayValue = getInfoValue(value);
    if (displayValue === undefined && !actionButton) return null;
    return (
        <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-800 last:border-b-0">
            <div className="flex-1 flex items-start gap-4">
                <div className="flex-shrink-0 text-[#FFD700] pt-1">{icon}</div>
                <div className="flex-1">
                    <div className="text-sm text-gray-400">{label}</div>
                    <div className="font-semibold text-white break-words">{displayValue !== undefined ? displayValue : '---'}</div>
                </div>
            </div>
            {actionButton && <div className="flex-shrink-0 pt-1">{actionButton}</div>}
        </div>
    );
};

const PermissionDeniedMessage = ({ title, message }: { title: string, message: string }) => (
    <div className="flex-grow flex items-center justify-center p-6 text-center">
        <div className="bg-gray-900/50 rounded-2xl border border-gray-700 p-8 max-w-md mx-auto">
            <ShieldOff size={48} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-gray-400">{message}</p>
        </div>
    </div>
);

const DefaultAvatarIcon = ({ className }: { className?: string }) => (<div className="w-full h-full flex items-center justify-center bg-gray-700"> <UserRound className={`text-gray-400 ${className}`} /> </div>);

const getFlagEmoji = (countryCode: string) => {
    if (!countryCode || countryCode.length !== 2) return null;
    try {
        return countryCode
            .toUpperCase()
            .split('')
            .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
            .join('');
    } catch (e) {
        return null;
    }
};
// #endregion


// --- ✨ المكون الرئيسي الموحد ✨ ---
interface UserProfileContentProps {
    isOverlay: boolean; // هل هو في نافذة منبثقة؟
    onClose?: () => void; // دالة الإغلاق (للاستخدام في النافذة المنبثقة)
}

export const UserProfileContent: React.FC<UserProfileContentProps> = ({ isOverlay, onClose }) => {
    const { user, signOut, manageUserMedia, hasPermission } = useAuth();
    const { language } = useLanguage();
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const { isOnline } = useConnectivity();
    const [activeTab, setActiveTab] = useState<'personal' | 'settings'>('personal');
    const [activeModal, setActiveModal] = useState<'password' | 'liveSignature' | 'seal' | 'avatar' | null>(null);
    const [isImageViewerOpen, setImageViewerOpen] = useState(false);
    const [isEditAvatarOpen, setEditAvatarOpen] = useState(false);
    const [showNamePartsAr, setShowNamePartsAr] = useState(false);
    const [showNamePartsEn, setShowNamePartsEn] = useState(false);

    const canViewProfile = hasPermission('sss:17');

    useEffect(() => {
        // إعادة تعيين الحالات عند فتح المحتوى (سواء كان صفحة أو نافذة)
        // لا نحتاج للتحكم في overflow هنا، لأن الغلاف هو من سيتحكم به
        setActiveTab('personal');
        setEditAvatarOpen(false);
        setShowNamePartsAr(false);
        setShowNamePartsEn(false);
    }, []); // ✨ يعمل مرة واحدة عند التحميل

    const handleSignOut = () => {
        const t = language === 'ar' ?
            { title: "تأكيد تسجيل الخروج", msg: "هل أنت متأكد؟", signingOut: "جاري تسجيل الخروج" } :
            { title: "Confirm Sign Out", msg: "Are you sure?", signingOut: "Signing out" };

        showDialog({
            variant: 'confirm',
            title: t.title,
            message: t.msg,
            onConfirm: async () => {
                showActionLoading(t.signingOut);
                try {
                    if (onClose) onClose(); // ✨ إغلاق النافذة المنبثقة إذا كانت موجودة
                    await signOut();
                } finally {
                    hideActionLoading();
                }
            },
        });
    };

    const handleDeleteAvatar = () => {
        const t = language === 'ar' ? {
            title: "تأكيد الحذف",
            msg: "هل أنت متأكد أنك تريد حذف صورتك الشخصية؟",
            deleting: "جاري حذف الصورة...",
            success: "تم حذف الصورة بنجاح.",
            errorTitle: "خطأ",
            permissionDeniedDelete: "ليس لديك صلاحية حذف الصورة."
        } : {
            title: "Confirm Deletion",
            msg: "Are you sure you want to delete your profile picture?",
            deleting: "Deleting picture...",
            success: "Picture deleted successfully.",
            errorTitle: "Error",
            permissionDeniedDelete: "You do not have permission to delete this picture."
        };

        if (!hasPermission('sss:19')) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedDelete });
            return;
        }

        showDialog({
            variant: 'confirm',
            title: t.title,
            message: t.msg,
            onConfirm: async () => {
                if (!hasPermission('sss:19')) {
                    showDialog({ variant: 'alert', title: t.errorTitle, message: t.permissionDeniedDelete });
                    return;
                }
                showActionLoading(t.deleting);
                const result = await manageUserMedia('avatar', null);
                hideActionLoading();
                if (result.success) {
                    showDialog({ variant: 'alert', title: 'Success', message: t.success });
                } else {
                    showDialog({ variant: 'alert', title: t.errorTitle, message: 'Failed to delete picture.' });
                }
            }
        });
    };

    const getGenderDetails = (gender?: string | null) => {
        let translatedValue = gender;
        let icon = <UserIcon size={18} />;
        if (gender === 'male' || gender === 'Male') { translatedValue = language === 'ar' ? 'ذكر' : 'Male'; icon = <Mars size={18} />; }
        else if (gender === 'female' || gender === 'Female') { translatedValue = language === 'ar' ? 'أنثى' : 'Female'; icon = <Venus size={18} />; }
        return { translatedValue, icon };
    };

    const genderDetails = getGenderDetails(user?.gender);
    const country = user?.country;
    const countryName = country ? (language === 'ar' ? country.name_ar : country.name_en) : undefined;
    const countryFlag = country?.id ? getFlagEmoji(country.id) : null;

    const t = language === 'ar' ? {
        profileTitle: "الملف الشخصي", fullInfo: "المعلومات الكاملة", settings: "الإعدادات", signOut: "خروج", superAdmin: "مسؤول عام (Super Admin)", employeeId: "الرقم الوظيفي", nameAr: "الاسم (عربي)", nameEn: "الاسم (إنجليزي)", email: "البريد الإلكتروني", phone: "رقم الهاتف", gender: "الجنس", company: "الشركة", jobTitle: "المسمى الوظيفي",
        changePassword: 'تغيير كلمة المرور',
        manageSignature: 'إدارة التوقيع',
        manageSeal: 'إدارة الختم',
        editAvatar: 'تعديل الصورة',
        deleteAvatar: 'حذف الصورة',
        uploadAvatar: 'تحميل من الجهاز',
        upload: 'تحميل',
        useCamera: 'استخدام الكاميرا (قريباً)',
        camera: 'كاميرا',
        comingSoonTitle: 'قريباً',
        comingSoonMsg: 'ميزة استخدام الكاميرا لالتقاط صورة جديدة ستكون متاحة قريباً.',
        errorTitle: "خطأ",
        permissionDeniedDelete: "ليس لديك صلاحية حذف الصورة.",
        firstNameAr: "الاسم الأول (عربي)",
        secondNameAr: "الاسم الثاني (عربي)",
        thirdNameAr: "الاسم الثالث (عربي)",
        lastNameAr: "اسم العائلة (عربي)",
        firstNameEn: "الاسم الأول (إنجليزي)",
        secondNameEn: "الاسم الثاني (إنجليزي)",
        thirdNameEn: "الاسم الثالث (إنجليزي)",
        lastNameEn: "اسم العائلة (إنجليزي)",
        nationality: "الجنسية",
        personalEmail: "البريد الإلكتروني الشخصي",
        personalPhone: "رقم الهاتف الشخصي",
        workEmail: "بريد العمل",
        workPhone: "هاتف العمل",
        extensionNumber: "رقم التحويلة",
        entityEmail: "بريد المؤسسة",
        entityPhone: "هاتف المؤسسة",
        entityExtension: "تحويلة المؤسسة",
        altPhone: "رقم هاتف بديل",
        nameDetails: "تفاصيل الاسم",
        permissionDeniedViewProfileTitle: "الوصول مرفوض",
        permissionDeniedViewProfileMsg: "ليس لديك الصلاحية المطلوبة لعرض تفاصيل ملفك الشخصي. يرجى التواصل مع المسؤول.",
    } : {
        profileTitle: "My Profile", fullInfo: "Full Information", settings: "Settings", signOut: "Sign Out", superAdmin: "Super Admin", employeeId: "Employee ID", nameAr: "Name (Arabic)", nameEn: "Name (English)", email: "Email", phone: "Phone Number", gender: "Gender", company: "Company", jobTitle: "Job Title",
        changePassword: 'Change Password',
        manageSignature: 'Manage Signature',
        manageSeal: 'Manage Seal',
        editAvatar: 'Edit Picture',
        deleteAvatar: 'Delete Picture',
        uploadAvatar: 'Upload from device',
        upload: 'Upload',
        useCamera: 'Use Camera (Coming Soon)',
        camera: 'Camera',
        comingSoonTitle: 'Coming Soon',
        comingSoonMsg: 'The feature to use the camera for a new picture will be available soon.',
        errorTitle: "Error",
        permissionDeniedDelete: "You do not have permission to delete this picture.",
        firstNameAr: "First Name (Arabic)",
        secondNameAr: "Second Name (Arabic)",
        thirdNameAr: "Third Name (Arabic)",
        lastNameAr: "Last Name (Arabic)",
        firstNameEn: "First Name (English)",
        secondNameEn: "Second Name (English)",
        thirdNameEn: "Third Name (English)",
        lastNameEn: "Last Name (English)",
        nationality: "Nationality",
        personalEmail: "Personal Email",
        personalPhone: "Personal Phone Number",
        workEmail: "Work Email",
        workPhone: "Work Phone",
        extensionNumber: "Extension Number",
        entityEmail: "Entity Email",
        entityPhone: "Entity Phone",
        entityExtension: "Entity Extension",
        altPhone: "Alternative Phone Number",
        nameDetails: "Name Details",
        permissionDeniedViewProfileTitle: "Access Denied",
        permissionDeniedViewProfileMsg: "You do not have the required permission to view your profile details. Please contact the administrator.",
    };

    return (
        <>
            {/* ✨ هذا الهيدر يظهر فقط في وضع النافذة المنبثقة */}
            {isOverlay && (
                <div className="relative flex items-center justify-between p-4 sm:p-6 flex-shrink-0 border-b border-gray-800">
                    <button
                        onClick={handleSignOut}
                        disabled={!isOnline}
                        className="flex items-center gap-2 text-red-500 hover:text-red-400 text-sm font-semibold transition-colors z-10 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                        <LogOut size={18} />
                        <span>{t.signOut}</span>
                    </button>
                    <h2 className="text-lg font-bold text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{t.profileTitle}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors z-10"><XIcon className="text-white" /></button>
                </div>
            )}

            {!canViewProfile ? (
                <PermissionDeniedMessage
                    title={t.permissionDeniedViewProfileTitle}
                    message={t.permissionDeniedViewProfileMsg}
                />
            ) : (
                <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
                        {/* ✨ إذا كانت صفحة، أضف عنوان الصفحة هنا */}
                        {!isOverlay && (
                            <h1 className="text-3xl font-bold text-white mb-6">{t.profileTitle}</h1>
                        )}

                        <div className="p-6 text-center relative bg-gray-900/50 rounded-2xl border border-gray-700 mb-6">
                            <div className="relative w-24 h-24 mx-auto">
                                <div
                                    className="w-24 h-24 rounded-full border-4 border-[#FFD700] overflow-hidden cursor-pointer"
                                    onClick={() => user?.avatar_url && setImageViewerOpen(true)}
                                >
                                    {user?.avatar_url ? (<img src={user.avatar_url} alt="User Avatar" className="w-full h-full object-cover" />) : (<DefaultAvatarIcon className="w-16 h-16" />)}
                                </div>
                            </div>

                            <div className="flex justify-center items-center gap-3 mt-4">
                                {hasPermission('sss:18') && (
                                    <button
                                        onClick={() => setEditAvatarOpen(!isEditAvatarOpen)}
                                        className={`p-2 rounded-full transition-colors ${isEditAvatarOpen ? 'bg-yellow-400/20 text-yellow-400' : 'text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700'}`}
                                        title={t.editAvatar}
                                    >
                                        <PencilLine size={18} />
                                    </button>
                                )}
                                {user?.avatar_url && hasPermission('sss:19') && (
                                    <button
                                        onClick={handleDeleteAvatar}
                                        className="p-2 rounded-full text-gray-400 hover:text-red-500 bg-gray-800 hover:bg-gray-700 transition-colors"
                                        title={t.deleteAvatar}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>

                            <AnimatePresence>
                                {isEditAvatarOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex justify-center items-center gap-3 mt-3 bg-gray-800/50 p-3 rounded-lg overflow-hidden"
                                    >
                                        <button
                                            onClick={() => {
                                                setActiveModal('avatar');
                                                setEditAvatarOpen(false);
                                            }}
                                            className="flex flex-col items-center gap-1 text-gray-300 hover:text-white transition-colors px-2"
                                            title={t.uploadAvatar}
                                        >
                                            <UploadCloud size={20} />
                                            <span className="text-xs">{t.upload}</span>
                                        </button>
                                        <div className="w-px h-10 bg-gray-700"></div>
                                        <button
                                            onClick={() => {
                                                showDialog({
                                                    variant: 'alert',
                                                    title: t.comingSoonTitle,
                                                    message: t.comingSoonMsg
                                                });
                                            }}
                                            className="flex flex-col items-center gap-1 text-gray-500 cursor-not-allowed px-2"
                                            title={t.useCamera}
                                        >
                                            <Camera size={20} />
                                            <span className="text-xs">{t.camera}</span>
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <h2 className="text-2xl font-bold text-white mt-4">{language === 'ar' ? user?.name_ar : user?.name_en}</h2>
                            <p className="text-gray-400 text-sm">{user?.job ? (language === 'ar' ? user.job.name_ar : user.job.name_en) : '...'}</p>
                        </div>

                        <div className="flex border-b border-gray-700 mb-6">
                            <button onClick={() => setActiveTab('personal')} className={`flex-1 p-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'personal' ? 'text-[#FFD700] border-b-2 border-[#FFD700]' : 'text-gray-400 hover:text-white'}`}><UserIcon size={16} />{t.fullInfo}</button>
                            <button onClick={() => setActiveTab('settings')} className={`flex-1 p-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'settings' ? 'text-[#FFD700] border-b-2 border-[#FFD700]' : 'text-gray-400 hover:text-white'}`}><Settings size={16} />{t.settings}</button>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                                {activeTab === 'personal' && (
                                    <div className="bg-gray-900/50 rounded-2xl border border-gray-700 p-4 space-y-1">
                                        {user?.is_super_admin && (<div className="flex items-center gap-3 p-3 mb-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"><ShieldCheck size={20} className="text-yellow-400 flex-shrink-0" /><span className="font-bold text-yellow-400">{t.superAdmin}</span></div>)}
                                        <h3 className={`text-lg font-semibold text-white pt-2 pb-1 ${user?.is_super_admin ? 'border-t border-gray-800' : ''}`}>{language === 'ar' ? 'الاسم' : 'Name'}</h3>
                                        <InfoRow
                                            icon={<UserIcon size={18} />}
                                            label={t.nameAr}
                                            value={user?.name_ar}
                                            actionButton={
                                                (user?.first_name_ar || user?.last_name_ar) ? (
                                                    <motion.button
                                                        onClick={() => setShowNamePartsAr(prev => !prev)}
                                                        className="p-1 rounded-full text-gray-400 hover:text-[#FFD700] hover:bg-gray-800 transition-colors"
                                                        title={t.nameDetails}
                                                        whileTap={{ scale: 0.9 }}
                                                    >
                                                        {showNamePartsAr ? <ChevronUp size={18} /> : <InfoIcon size={18} />}
                                                    </motion.button>
                                                ) : null
                                            }
                                        />
                                        <AnimatePresence>
                                            {showNamePartsAr && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="pl-4 ml-8 border-l border-gray-800 space-y-1 overflow-hidden"
                                                >
                                                    <InfoRow icon={<UserIcon size={18} />} label={t.firstNameAr} value={getInfoValue(user?.first_name_ar)} />
                                                    <InfoRow icon={<UserIcon size={18} />} label={t.secondNameAr} value={getInfoValue(user?.second_name_ar)} />
                                                    <InfoRow icon={<UserIcon size={18} />} label={t.thirdNameAr} value={getInfoValue(user?.third_name_ar)} />
                                                    <InfoRow icon={<UserIcon size={18} />} label={t.lastNameAr} value={getInfoValue(user?.last_name_ar)} />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <InfoRow
                                            icon={<UserIcon size={18} />}
                                            label={t.nameEn}
                                            value={getInfoValue(user?.name_en)}
                                            actionButton={
                                                (user?.first_name_en || user?.last_name_en) ? (
                                                    <motion.button
                                                        onClick={() => setShowNamePartsEn(prev => !prev)}
                                                        className="p-1 rounded-full text-gray-400 hover:text-[#FFD700] hover:bg-gray-800 transition-colors"
                                                        title={t.nameDetails}
                                                        whileTap={{ scale: 0.9 }}
                                                    >
                                                        {showNamePartsEn ? <ChevronUp size={18} /> : <InfoIcon size={18} />}
                                                    </motion.button>
                                                ) : null
                                            }
                                        />
                                        <AnimatePresence>
                                            {showNamePartsEn && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="pl-4 ml-8 border-l border-gray-800 space-y-1 overflow-hidden"
                                                >
                                                    <InfoRow icon={<UserIcon size={18} />} label={t.firstNameEn} value={getInfoValue(user?.first_name_en)} />
                                                    <InfoRow icon={<UserIcon size={18} />} label={t.secondNameEn} value={getInfoValue(user?.second_name_en)} />
                                                    <InfoRow icon={<UserIcon size={18} />} label={t.thirdNameEn} value={getInfoValue(user?.third_name_en)} />
                                                    <InfoRow icon={<UserIcon size={18} />} label={t.lastNameEn} value={getInfoValue(user?.last_name_en)} />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <h3 className="text-lg font-semibold text-white pt-4 pb-1 border-t border-gray-800">{language === 'ar' ? 'البيانات الشخصية والوظيفية' : 'Personal & Job Data'}</h3>
                                        <InfoRow icon={<Mail size={18} />} label={t.personalEmail} value={getInfoValue(user?.email)} />
                                        <InfoRow icon={<Phone size={18} />} label={t.personalPhone} value={getInfoValue(user?.phone_number)} />
                                        <InfoRow icon={genderDetails.icon} label={t.gender} value={getInfoValue(genderDetails.translatedValue)} />
                                        {user?.country && (
                                            <InfoRow
                                                icon={<Globe size={18} />}
                                                label={t.nationality}
                                                value={
                                                    <span className="flex items-center gap-2">
                                                        {countryFlag && <span className="text-lg">{countryFlag}</span>}
                                                        <span>{countryName}</span>
                                                    </span>
                                                }
                                            />
                                        )}
                                        <InfoRow icon={<Briefcase size={18} />} label={t.jobTitle} value={user?.job ? (language === 'ar' ? user.job.name_ar : user.job.name_en) : undefined} />
                                        <InfoRow icon={<Hash size={18} />} label={t.employeeId} value={getInfoValue(user?.employee_id)} />
                                        <InfoRow icon={<Mail size={18} />} label={t.workEmail} value={getInfoValue(user?.work_email)} />
                                        <InfoRow icon={<Phone size={18} />} label={t.workPhone} value={getInfoValue(user?.work_phone)} />
                                        <InfoRow icon={<Phone size={18} />} label={t.extensionNumber} value={getInfoValue(user?.landline_phone)} />

                                        <h3 className="text-lg font-semibold text-white pt-4 pb-1 border-t border-gray-800">{language === 'ar' ? 'بيانات المؤسسة' : 'Organization Data'}</h3>
                                        <InfoRow icon={<Building size={18} />} label={t.company} value={user?.company ? (language === 'ar' ? user.company.name_ar : user.company.name_en) : undefined} />
                                        <InfoRow icon={<Mail size={18} />} label={t.entityEmail} value={getInfoValue(user?.company_email)} />
                                        <InfoRow icon={<Phone size={18} />} label={t.entityPhone} value={getInfoValue(user?.company_phone)} />
                                        <InfoRow icon={<Phone size={18} />} label={t.entityExtension} value={getInfoValue(user?.company_landline_phone)} />
                                        <InfoRow icon={<Phone size={18} />} label={t.altPhone} value={getInfoValue(user?.['alternative-phone'])} />
                                    </div>
                                )}
                                {activeTab === 'settings' && (
                                    <div className="bg-gray-900/50 rounded-2xl border border-gray-700 p-4 space-y-2">
                                        {hasPermission('sss:20') && (
                                            <button onClick={() => setActiveModal('password')} className="w-full flex items-center gap-3 p-3 text-left text-white hover:bg-gray-800 rounded-lg transition-colors"><KeyRound size={20} className="text-[#FFD700]" /><span className="font-semibold">{t.changePassword}</span></button>
                                        )}
                                        {hasPermission('sss:20') && (hasPermission('sss:21') || hasPermission('sss:24')) && (
                                            <div className="border-t border-gray-800 !my-2"></div>
                                        )}
                                        {hasPermission('sss:21') && (
                                            <button onClick={() => setActiveModal('liveSignature')} className="w-full flex items-center gap-3 p-3 text-left text-white hover:bg-gray-800 rounded-lg transition-colors"><PencilLine size={20} className="text-[#FFD700]" /><span className="font-semibold">{t.manageSignature}</span></button>
                                        )}
                                        {hasPermission('sss:24') && (
                                            <button onClick={() => setActiveModal('seal')} className="w-full flex items-center gap-3 p-3 text-left text-white hover:bg-gray-800 rounded-lg transition-colors"><Stamp size={20} className="text-[#FFD700]" /><span className="font-semibold">{t.manageSeal}</span></button>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* --- Modals & Image Viewer --- */}
            <AnimatePresence>
                {isImageViewerOpen && user?.avatar_url && (
                    <motion.div variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="fixed inset-0 bg-black/80 z-[70] p-4 flex items-center justify-center" onClick={() => setImageViewerOpen(false)}>
                        <motion.img
                            variants={scaleInModalVariants}
                            src={user.avatar_url}
                            alt="Profile Avatar"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <ChangePasswordModal isOpen={activeModal === 'password'} onClose={() => setActiveModal(null)} />
            <LiveSignatureModal isOpen={activeModal === 'liveSignature'} onClose={() => setActiveModal(null)} />
            <MediaUploadModal isOpen={activeModal === 'seal'} onClose={() => setActiveModal(null)} type="seal" />
            <MediaUploadModal isOpen={activeModal === 'avatar'} onClose={() => setActiveModal(null)} type="avatar" />
        </>
    );
};