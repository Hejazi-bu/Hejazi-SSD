// src/components/AlertDialog.tsx
import React, { Fragment, useState, useEffect, ElementType } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ShieldAlert, CircleCheck, AlertTriangle, BellRing, SquarePen, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from './contexts/LanguageContext';
import { DialogVariant } from './contexts/DialogContext';

interface AlertDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    variant: DialogVariant;
    onConfirm?: (notes?: string) => void;
    onCancel?: () => void;
    autoCloseDuration?: number;
    customIcon?: ElementType;
    customColor?: 'red' | 'yellow' | 'orange' | 'blue' | 'green';
    // --- تعديل 3: استقبال الخصائص الجديدة ---
    isDismissable?: boolean;
    validation?: (value: string) => string | null;
    confirmText?: string;
    cancelText?: string;
}

const variantConfig = {
    alert: { Icon: ShieldAlert, color: 'text-yellow-400', buttonColor: 'bg-yellow-600 hover:bg-yellow-700' },
    success: { Icon: CircleCheck, color: 'text-green-400', buttonColor: 'bg-green-600 hover:bg-green-700' },
    info: { Icon: Info, color: 'text-blue-400', buttonColor: 'bg-blue-600 hover:bg-blue-700' },
    error: { Icon: X, color: 'text-red-400', buttonColor: 'bg-red-600 hover:bg-red-700' },
    confirm: { Icon: AlertTriangle, color: 'text-orange-400', buttonColor: 'bg-orange-600 hover:bg-orange-700' },
    prompt: { Icon: SquarePen, color: 'text-blue-400', buttonColor: 'bg-blue-600 hover:bg-blue-700' },
    toast: { Icon: BellRing, color: 'text-blue-400', buttonColor: '' },
};

const colorMap = {
    red: { color: 'text-red-400', buttonColor: 'bg-red-600 hover:bg-red-700' },
    yellow: { color: 'text-yellow-400', buttonColor: 'bg-yellow-500 hover:bg-yellow-600' },
    orange: { color: 'text-orange-400', buttonColor: 'bg-orange-600 hover:bg-orange-700' },
    blue: { color: 'text-blue-400', buttonColor: 'bg-blue-600 hover:bg-blue-700' },
    green: { color: 'text-green-400', buttonColor: 'bg-green-600 hover:bg-green-700' },
};

const AlertDialog: React.FC<AlertDialogProps> = ({
    isOpen, onClose, title, message, variant, onConfirm, onCancel, autoCloseDuration, customIcon, customColor,
    isDismissable = true,
    validation,
    confirmText, // ✅ أضف هذا السطر
    cancelText,  // ✅ أضف هذا السطر
}) => {
    const { language } = useLanguage();
    const isRTL = language === 'ar';
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isShaking, setShaking] = useState(false);

    const t = language === 'ar' ? 
        { ok: 'موافق', confirm: 'تأكيد', cancel: 'إلغاء', send: 'إرسال', notesPlaceholder: 'أضف ملاحظاتك هنا...' } : 
        { ok: 'OK', confirm: 'Confirm', cancel: 'Cancel', send: 'Send', notesPlaceholder: 'Add your notes here...' };

    const defaultConfig = variantConfig[variant];
    const customConfig = customColor ? colorMap[customColor] : {};
    const config = { ...defaultConfig, ...customConfig };
    // إذا تم توفير أيقونة مخصصة، استخدمها، وإلا استخدم الأيقونة الافتراضية للـ variant
    const IconComponent = customIcon || config.Icon;

    useEffect(() => {
        if (autoCloseDuration) {
            const timer = setTimeout(() => onClose(), autoCloseDuration);
            return () => clearTimeout(timer);
        }
    }, [autoCloseDuration, onClose]);

    // --- تعديل 3: منطق جديد للتأكيد مع التحقق المدمج ---
    const handleConfirm = () => {
        if (variant === 'prompt' && validation) {
            const validationError = validation(notes);
            if (validationError) {
                setError(validationError);
                setShaking(true);
                setTimeout(() => setShaking(false), 500); // إيقاف الاهتزاز بعد انتهاء الأنيميشن
                return; // منع الإغلاق
            }
        }
        if (onConfirm) {
            onConfirm(variant === 'prompt' ? notes : undefined);
        }
        onClose(); // إغلاق فقط في حالة النجاح
    };

    const handleCancel = () => {
        if (onCancel) onCancel();
        onClose();
    };

    // --- تعديل 3: التحكم في الإغلاق بناءً على isDismissable ---
    const handleClose = () => {
        if (isDismissable) {
            onClose();
        }
    };
    
    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNotes(e.target.value);
        if (error) setError(null); // إزالة الخطأ عند بدء المستخدم بالكتابة
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[10000]" onClose={handleClose} dir={isRTL ? 'rtl' : 'ltr'}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className={`w-full max-w-sm transform overflow-hidden rounded-2xl bg-[#0D1B2A] border border-gray-700 p-6 text-center align-middle shadow-xl transition-all`}>
                                {/* --- تعديل 3: تحسين حجم الأيقونة --- */}
                                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${config.color}/10 mb-4`}>
                                    <IconComponent className={`h-8 w-8 ${config.color}`} />
                                </div>
                                <Dialog.Title as="h3" className={`text-lg font-bold leading-6 ${config.color}`}>
                                    {title}
                                </Dialog.Title>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{message}</p>
                                    {variant === 'prompt' && (
                                        <div className='relative mt-4 text-start'>
                                            <textarea
                                                value={notes}
                                                onChange={handleNotesChange}
                                                rows={4}
                                                className={`w-full p-2 rounded-md bg-gray-700 text-gray-100 border transition-all
                                                    ${isShaking ? 'shake' : ''}
                                                    ${error ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-600 focus:border-yellow-500 focus:ring-yellow-500'}
                                                    focus:outline-none focus:ring-1`}
                                                placeholder={t.notesPlaceholder}
                                            />
                                            <AnimatePresence>
                                                {error && (
                                                    <motion.p 
                                                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                                        className="mt-1 text-xs text-red-400"
                                                    >
                                                        {error}
                                                    </motion.p>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>
                                {variant !== 'toast' && (
                                    <div className="mt-6 flex justify-center gap-4">
                                        {(variant === 'confirm' || variant === 'prompt') ? (
                                            <>
                                                <button type="button" className="inline-flex justify-center rounded-md border border-gray-600 px-6 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700" onClick={handleCancel}>
                                                    {cancelText || t.cancel} {/* ✅ تعديل هنا */}
                                                </button>
                                                <button type="button" className={`inline-flex justify-center rounded-md border border-transparent ${config.buttonColor} px-6 py-2 text-sm font-medium text-white`} onClick={handleConfirm}>
                                                    {confirmText || (variant === 'confirm' ? t.confirm : t.send)} {/* ✅ تعديل هنا */}
                                                </button>
                                            </>
                                        ) : (
                                            <button type="button" className={`inline-flex justify-center rounded-md border border-transparent ${config.buttonColor} px-8 py-2 text-sm font-medium text-white`} onClick={onClose}>
                                                {t.ok}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default AlertDialog;