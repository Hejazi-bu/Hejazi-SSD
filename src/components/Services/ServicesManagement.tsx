// C:\Users\user\Music\hejazi-logic\src\components\Services\ServicesManagement.tsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
    staggeredContainerVariants,
    staggeredItemVariants,
    interactiveItemVariants,
    fadeInVariants,
    directionalSlideVariants
} from "../../lib/animations";
import { useAuth } from "../contexts/UserContext";
import { useLanguage } from "../contexts/LanguageContext";
import { usePageLoading } from "../contexts/LoadingContext";
import { useActionLoading } from "../contexts/ActionLoadingContext";
import { collection, query, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, orderBy, where } from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db, functions } from '../../lib/firebase';
import {
    CogIcon,
    PlusIcon,
    PencilIcon,
    TrashIcon,
    LockClosedIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    XMarkIcon
} from "@heroicons/react/24/outline";
import { useDialog } from "../contexts/DialogContext";
import { httpsCallable } from "firebase/functions";
import DynamicIcon from "../home/DynamicIcon";
import { icons } from 'lucide-react';

// قائمة بجميع أسماء الأيقونات المتاحة للبحث والاختيار
const allIconNames = Object.keys(icons).sort();

// --- الأنواع والمحولات ---

interface ServiceGroupDoc {
    name_ar: string;
    name_en: string;
    order: number;
    page: string;
    icon?: string | null;
}
interface ServiceDoc {
    group_id: number;
    label_ar: string;
    label_en: string;
    icon: string | null;
    is_allowed: boolean;
    order: number;
    page: string;
}
interface SubServiceDoc {
    service_id: number;
    label_ar: string;
    label_en: string;
    icon: string | null;
    is_allowed: boolean;
    order: number;
    page: string;
    component: string;
}
interface SubSubServiceDoc {
    service_id: number;
    label_ar: string;
    label_en: string;
    is_allowed: boolean;
    icon?: string | null;
}

const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
    toFirestore: (data: T): DocumentData => data,
    fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T)
});

type ServiceGroup = ServiceGroupDoc & { id: string };
type Service = ServiceDoc & { id: string };
type SubService = SubServiceDoc & { id: string };
type SubSubService = SubSubServiceDoc & { id: string };

type ModalType = 'service_group' | 'service' | 'sub_service' | 'sub_sub_service';
type ModalState = {
    isOpen: true;
    mode: 'create' | 'edit';
    type: ModalType;
    data: any;
    originalData: any; // <-- لحالة البيانات الأصلية
} | { isOpen: false };


// --- مكون حقل الإدخال النصي ---
const InputField = ({ label, name, value, onChange, type = 'text', required = false }: any) => (
    <div>
        <label className="block mb-1 font-semibold text-gray-300 text-sm">{label} {required && <span className="text-red-500">*</span>}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-white"
        />
    </div>
);

// --- مكون حقل الأيقونة الجديد (IconField) ---
const IconField = ({ label, name, value, onOpenPicker, required = false, translations, language }: any) => {
    const t = translations[language];
    return (
        <div>
            <label className="block mb-1 font-semibold text-gray-300 text-sm">{label} {required && <span className="text-red-500">*</span>}</label>
            <div className="flex items-center gap-2">
                <div className="flex-1 p-2.5 rounded-md border border-gray-600 bg-gray-700 flex items-center gap-3">
                    <DynamicIcon name={value} className="w-5 h-5 text-[#FFD700] flex-shrink-0" />
                    <span className="text-white truncate" dir="ltr">{value || t.common.selectIconPrompt}</span>
                </div>
                <motion.button
                    type="button"
                    onClick={() => onOpenPicker(value, name)}
                    variants={interactiveItemVariants} whileHover="hover" whileTap="tap"
                    className="p-2.5 rounded-md bg-[#FFD700] text-black font-bold hover:bg-yellow-400 transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                    <PencilIcon className="w-5 h-5" />
                </motion.button>
            </div>
        </div>
    );
};

const CheckboxField = ({ label, name, checked, onChange }: any) => (
    <div className="flex items-center gap-2">
        <input
            type="checkbox"
            name={name}
            checked={checked}
            onChange={onChange}
            className="w-5 h-5 bg-gray-700 border-gray-600 rounded text-[#FFD700] focus:ring-[#FFD700]/50"
        />
        <label className="font-semibold text-gray-300 text-sm">{label}</label>
    </div>
);


// --- مكون اختيار الأيقونة المنبثق ---
function IconPickerModal({ isOpen, onClose, onSelectIcon, language, translations, initialIcon }: any) {
    const t = translations[language];
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const iconsPerPage = 30;

    const filteredIcons = useMemo(() => {
        if (!searchTerm) return allIconNames;
        return allIconNames.filter(name =>
            name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

    const totalPages = Math.ceil(filteredIcons.length / iconsPerPage);
    const currentIcons = useMemo(() => {
        const startIndex = (currentPage - 1) * iconsPerPage;
        return filteredIcons.slice(startIndex, startIndex + iconsPerPage);
    }, [filteredIcons, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleSelect = (name: string) => {
        onSelectIcon(name);
    }

    // 🚨 إضافة هذه الدالة للتبديل بين الاتجاهات (لتحسين تجاوب الهاتف)
    const DirChevron = language === 'ar' ? ChevronLeftIcon : ChevronRightIcon;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="icon-picker-modal-unique-key" 
                    variants={fadeInVariants} initial="initial" animate="animate" exit="exit"
                    className="fixed inset-0 bg-black/70 z-[70] p-4 sm:p-6 overflow-y-auto flex items-center justify-center"
                    // 🚨 التعديل: إزالة onClick={onClose}
                >
                    <motion.div
                        variants={interactiveItemVariants} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm sm:max-w-2xl shadow-2xl m-auto h-[85vh] flex flex-col" // 🚨 تعديل التجاوب
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-6 flex-shrink-0 border-b border-gray-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white">{t.modalTitles.selectIcon}</h3>
                                <button type="button" onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder={t.common.searchIcon}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-white"
                            />
                            {/* 🚨 عرض الأيقونة الحالية واسمها */}
                            {initialIcon && (
                                <div className="mt-3 text-sm text-gray-400 flex items-center gap-2">
                                    <span>{t.common.currentIcon}:</span>
                                    <DynamicIcon name={initialIcon} className="w-4 h-4 text-[#FFD700]" />
                                    <span className="text-white font-semibold truncate" dir="ltr">{initialIcon}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-4">
                            {currentIcons.map(name => (
                                <motion.div
                                    key={name}
                                    variants={staggeredItemVariants}
                                    whileHover="hover"
                                    whileTap="tap"
                                    onClick={() => handleSelect(name)}
                                    className={`p-3 flex flex-col items-center justify-center rounded-lg border transition-colors cursor-pointer group ${name === initialIcon ? 'border-[#FFD700] bg-yellow-400/20' : 'border-gray-700 bg-gray-800 hover:bg-yellow-400/20'}`}
                                >
                                    <DynamicIcon name={name} className="w-6 h-6 text-white group-hover:text-[#FFD700] transition-colors" />
                                    <span className="text-xs text-center text-gray-400 mt-1 truncate w-full group-hover:text-gray-200 transition-colors" dir="ltr">{name}</span>
                                </motion.div>
                            ))}
                            {currentIcons.length === 0 && (
                                <p className="text-gray-400 col-span-full text-center p-8">{t.common.noIconsFound}</p>
                            )}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 p-4 border-t border-gray-700 flex-shrink-0">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-full text-gray-400 hover:text-white disabled:opacity-50"
                                >
                                    <DirChevron className="w-5 h-5" />
                                </button>
                                <span className="text-sm text-gray-300">
                                    {t.common.page} {currentPage} {t.common.of} {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-full text-gray-400 hover:text-white disabled:opacity-50"
                                >
                                    {language === 'ar' ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// --- نافذة الإضافة والتعديل المنبثقة ---
function ManagementModal({
    modalState,
    onClose,
    onSave,
    translations,
    language,
    onOpenIconPicker
}: {
    modalState: ModalState,
    onClose: () => void,
    onSave: (formData: any) => void,
    translations: any,
    language: 'ar' | 'en',
    onOpenIconPicker: (currentIcon: string, fieldName: string) => void
}) {

    const t = translations[language];
    const [formData, setFormData] = useState<any>({});
    const [isLoading, setIsLoading] = useState(false);

    const titles = {
        'service_group': t.modalTitles.service_group,
        'service': t.modalTitles.service,
        'sub_service': t.modalTitles.sub_service,
        'sub_sub_service': t.modalTitles.sub_sub_service,
    };
    const title = modalState.isOpen ? `${modalState.mode === 'create' ? t.modalTitles.create : t.modalTitles.edit} ${titles[modalState.type]}` : '';

    // مزامنة البيانات عند فتح النافذة
    useEffect(() => {
        if (modalState.isOpen) {
            setFormData(modalState.data);
        }
    }, [modalState]);

    // 🚨 دالة لمقارنة البيانات مع تجاهل المسافات
    const isDataChanged = useMemo(() => {
        if (!modalState.isOpen || modalState.mode === 'create') return true;

        const original = modalState.originalData;
        const current = formData;

        // قائمة بجميع الحقول التي يتم تعديلها في الـ Modal
        const fields = Object.keys(current).filter(key => key !== 'id');

        for (const key of fields) {
            const originalValue = original[key] ?? (typeof current[key] === 'string' ? '' : null);
            const currentValue = current[key] ?? (typeof original[key] === 'string' ? '' : null);

            // التعامل مع الأرقام والقيم المنطقية مباشرة
            if (typeof originalValue !== 'string') {
                if (originalValue !== currentValue) {
                    return true;
                }
            } else {
                // التعامل مع السلاسل النصية: تنظيف المسافات قبل المقارنة
                const cleanOriginal = String(originalValue).replace(/\s/g, '');
                const cleanCurrent = String(currentValue).replace(/\s/g, '');
                if (cleanOriginal !== cleanCurrent) {
                    return true;
                }
            }
        }
        return false;
    }, [formData, modalState]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        let processedValue: any = value;
        if (type === 'number') {
            processedValue = value === '' ? null : Number(value);
        }
        if (e.target.type === 'checkbox') {
            processedValue = (e.target as HTMLInputElement).checked;
        }

        // 🚨 التعديل: تنظيف حقول المسارات والترجمة
        if (name === 'page' || name === 'component') {
            processedValue = processedValue.replace(/\s/g, ''); // إزالة جميع المسافات
        }

        setFormData((prev: any) => ({ ...prev, [name]: processedValue }));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 🚨 تنظيف البيانات النهائية قبل الإرسال (للتأكد من نظافة الحقول النصية)
        const cleanedFormData = { ...formData };
        for (const key in cleanedFormData) {
            if (typeof cleanedFormData[key] === 'string') {
                if (key.includes('label') || key.includes('name')) {
                    cleanedFormData[key] = cleanedFormData[key].trim();
                }
                if (key === 'page' || key === 'component') {
                    cleanedFormData[key] = cleanedFormData[key].replace(/\s/g, '');
                }
            }
        }

        setIsLoading(true);
        await onSave(cleanedFormData);
        setIsLoading(false);
    };

    const renderFields = () => {
        if (!modalState.isOpen) return null;
        
        switch (modalState.type) {
            case 'service_group':
                return (
                    <>
                        <InputField name="name_ar" label={t.fields.name_ar} value={formData.name_ar || ''} onChange={handleChange} required />
                        <InputField name="name_en" label={t.fields.name_en} value={formData.name_en || ''} onChange={handleChange} required />
                        <InputField name="page" label={t.fields.page} value={formData.page || ''} onChange={handleChange} required />
                        <IconField
                            name="icon"
                            label={t.fields.icon}
                            value={formData.icon || ''}
                            onOpenPicker={onOpenIconPicker}
                            translations={translations} language={language}
                        />
                        <InputField name="order" label={t.fields.order} type="number" value={formData.order ?? 1} onChange={handleChange} required />
                    </>
                );
            case 'service':
                return (
                    <>
                        <InputField name="label_ar" label={t.fields.label_ar} value={formData.label_ar || ''} onChange={handleChange} required />
                        <InputField name="label_en" label={t.fields.label_en} value={formData.label_en || ''} onChange={handleChange} required />
                        <InputField name="page" label={t.fields.page} value={formData.page || ''} onChange={handleChange} required />
                        <IconField
                            name="icon"
                            label={t.fields.icon}
                            value={formData.icon || ''}
                            onOpenPicker={onOpenIconPicker}
                            required
                            translations={translations} language={language}
                        />
                        <InputField name="order" label={t.fields.order} type="number" value={formData.order ?? 1} onChange={handleChange} required />
                        <CheckboxField name="is_allowed" label={t.fields.is_allowed} checked={formData.is_allowed || false} onChange={handleChange} />
                    </>
                );
            case 'sub_service':
                return (
                    <>
                        <InputField name="label_ar" label={t.fields.label_ar} value={formData.label_ar || ''} onChange={handleChange} required />
                        <InputField name="label_en" label={t.fields.label_en} value={formData.label_en || ''} onChange={handleChange} required />
                        <InputField name="page" label={t.fields.page} value={formData.page || ''} onChange={handleChange} required />
                        <InputField name="component" label={t.fields.component} value={formData.component || ''} onChange={handleChange} required />
                        <IconField
                            name="icon"
                            label={t.fields.icon}
                            value={formData.icon || ''}
                            onOpenPicker={onOpenIconPicker}
                            required
                            translations={translations} language={language}
                        />
                        <InputField name="order" label={t.fields.order} type="number" value={formData.order ?? 1} onChange={handleChange} required />
                        <CheckboxField name="is_allowed" label={t.fields.is_allowed} checked={formData.is_allowed || false} onChange={handleChange} />
                    </>
                );
            case 'sub_sub_service':
                return (
                    <>
                        <InputField name="label_ar" label={t.fields.label_ar} value={formData.label_ar || ''} onChange={handleChange} required />
                        <InputField name="label_en" label={t.fields.label_en} value={formData.label_en || ''} onChange={handleChange} required />
                        <IconField
                            name="icon"
                            label={t.fields.icon}
                            value={formData.icon || ''}
                            onOpenPicker={onOpenIconPicker}
                            translations={translations} language={language}
                        />
                        <CheckboxField name="is_allowed" label={t.fields.is_allowed} checked={formData.is_allowed || false} onChange={handleChange} />
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <AnimatePresence>
            {modalState.isOpen && (
                <motion.div
                    key="management-modal-overlay"
                    variants={fadeInVariants} initial="initial" animate="animate" exit="exit"
                    className="fixed inset-0 bg-black/70 z-[60] p-4 sm:p-6 overflow-y-auto flex items-center justify-center" // 🚨 تعديل التجاوب
                    // 🚨 التعديل: إزالة onClick={onClose}
                >
                    <motion.div
                        key="management-modal-content"
                        variants={interactiveItemVariants} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm sm:max-w-lg shadow-2xl m-auto" // 🚨 تعديل التجاوب
                        onClick={e => e.stopPropagation()}
                    >
                        <form onSubmit={handleFormSubmit}>
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-white">{title}</h3>
                                    <button type="button" onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                                        <XMarkIcon className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {renderFields()}
                                </div>
                            </div>
                            <div className="bg-gray-800/50 px-6 py-3 flex justify-end gap-3 rounded-b-2xl">
                                <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg text-white hover:bg-gray-700 transition-colors">{t.common.cancel}</button>
                                <button
                                    type="submit"
                                    disabled={isLoading || !isDataChanged} // 🚨 زر الحفظ المشروط
                                    className="py-2 px-4 rounded-lg bg-[#FFD700] text-black font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? t.common.saving : t.common.save}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// --- المكون الرئيسي للصفحة ---
export default function ServicesManagement() {
    const { language } = useLanguage();
    const { user, hasPermission, isLoading: isAuthLoading } = useAuth();
    const { showDialog } = useDialog();
    const { setPageLoading } = usePageLoading();
    const { showActionLoading, hideActionLoading } = useActionLoading();

    // --- الصلاحيات ---
    const canManageGroups = hasPermission('s:1');
    const canManageServices = hasPermission('ss9');

    // --- الحالة ---
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [selectedSubServiceId, setSelectedSubServiceId] = useState<string | null>(null);
    const [modalState, setModalState] = useState<ModalState>({ isOpen: false });

    // --- حالات Icon Picker الجديدة للتحكم من الأب ---
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
    const [iconFieldData, setIconFieldData] = useState<{ fieldName: string, icon: string } | null>(null);

    // --- مرجع الدوال السحابية ---
    const manageServiceConfig = useRef(httpsCallable(functions, 'manageServiceConfiguration'));

    // --- الترجمات ---
    const translations = useMemo(() => ({
        ar: {
            pageTitle: "إدارة الخدمات والصلاحيات",
            permissionDenied: "ليس لديك الصلاحية لإدارة هذا القسم.",
            columnTitles: {
                groups: "مجموعات الخدمات",
                services: "الخدمات الرئيسية",
                subServices: "الصفحات",
                subSubServices: "الاجراءات"
            },
            modalTitles: {
                create: "إنشاء",
                edit: "تعديل",
                service_group: "مجموعة خدمات",
                service: "خدمة رئيسية",
                sub_service: "صفحة",
                sub_sub_service: "اجراء",
                selectIcon: "اختيار الأيقونة",
            },
            fields: {
                name_ar: "الاسم (عربي)",
                name_en: "الاسم (إنجليزي)",
                label_ar: "العنوان (عربي)",
                label_en: "العنوان (إنجليزي)",
                order: "الترتيب",
                page: "رابط الصفحة (Page)",
                icon: "الأيقونة (Icon Name)",
                is_allowed: "مسموح به",
                component: "المكون (Component Name)"
            },
            common: {
                save: "حفظ",
                saving: "جاري الحفظ...",
                cancel: "إلغاء",
                delete: "حذف",
                edit: "تعديل",
                selectGroup: "اختر مجموعة لعرض خدماتها",
                selectService: "اختر خدمة لعرض توابعها",
                noData: "لا توجد بيانات",
                confirmDeleteTitle: "تأكيد الحذف",
                confirmDeleteMessage: "هل أنت متأكد أنك تريد حذف هذا العنصر؟ لا يمكن التراجع عن هذا الإجراء.",
                successTitle: "نجاح",
                successSave: "تم حفظ التغييرات بنجاح.",
                successDelete: "تم حذف العنصر بنجاح.",
                errorTitle: "خطأ",
                errorSave: "فشل حفظ التغييرات.",
                errorDelete: "فشل حذف العنصر.",
                searchIcon: "البحث عن أيقونة...",
                noIconsFound: "لم يتم العثور على أي أيقونة مطابقة للبحث.",
                page: "صفحة",
                of: "من",
                selectIconPrompt: "اضغط للاختيار",
                currentIcon: "الأيقونة الحالية"
            }
        },
        en: {
            pageTitle: "Services & Permissions Management",
            permissionDenied: "You do not have permission to manage this section.",
            columnTitles: {
                groups: "Service Groups",
                services: "Main Services",
                subServices: "Pages",
                subSubServices: "Actions"
            },
            modalTitles: {
                create: "Create",
                edit: "Edit",
                service_group: "Service Group",
                service: "Main Service",
                sub_service: "Page",
                sub_sub_service: "Action",
                selectIcon: "Select Icon",
            },
            fields: {
                name_ar: "Name (Arabic)",
                name_en: "Name (English)",
                label_ar: "Label (Arabic)",
                label_en: "Label (English)",
                order: "Order",
                page: "Page Path",
                icon: "Icon Name",
                is_allowed: "Is Allowed",
                component: "Component Name"
            },
            common: {
                save: "Save",
                saving: "Saving...",
                cancel: "Cancel",
                delete: "Delete",
                edit: "Edit",
                selectGroup: "Select a group to view its services",
                selectService: "Select a service to view its items",
                noData: "No data found",
                confirmDeleteTitle: "Confirm Deletion",
                confirmDeleteMessage: "Are you sure you want to delete this item? This action cannot be undone.",
                successTitle: "Success",
                successSave: "Changes saved successfully.",
                successDelete: "Item deleted successfully.",
                errorTitle: "Error",
                errorSave: "Failed to save changes.",
                errorDelete: "Failed to delete item.",
                searchIcon: "Search icon...",
                noIconsFound: "No matching icon found.",
                page: "Page",
                of: "of",
                selectIconPrompt: "Click to select",
                currentIcon: "Current Icon"
            }
        }
    }), [language]);

    const t = translations[language];

    // --- دالة فتح منتقي الأيقونات (تُمرر إلى ManagementModal) ---
    const handleOpenIconPicker = (currentIcon: string, fieldName: string) => {
        setIconFieldData({ fieldName, icon: currentIcon });
        setIsIconPickerOpen(true);
    };

    // --- دالة معالجة اختيار الأيقونة (تُمرر إلى IconPickerModal) ---
    const handleIconSelect = (iconName: string) => {
        if (modalState.isOpen && iconFieldData) {
            // 🚨 تحديث modalState مباشرة ليعكس التغيير في ManagementModal
            setModalState((prev: any) => ({
                ...prev,
                data: { ...prev.data, [iconFieldData.fieldName]: iconName }
            }));
        }
        setIsIconPickerOpen(false);
        setIconFieldData(null);
    };


    // --- معالجات CRUD (الاتصال بالدوال السحابية) ---
    const handleSave = async (formData: any) => {
        if (!modalState.isOpen) return;

        showActionLoading(t.common.saving);
        try {
            const { id, ...payload } = formData; 
            
            let docIdentifier = null;
            
            const modalDataId = modalState.data && modalState.data.id ? String(modalState.data.id) : null;
            const formDataId = id ? String(id) : null;

            if (modalState.mode === 'edit') {
                docIdentifier = modalDataId || formDataId;
            }

            if (modalState.mode === 'edit' && (!docIdentifier || docIdentifier.length === 0)) { 
                throw new Error("Cannot save item in edit mode: Document ID is missing.");
            }

            await manageServiceConfig.current({
                type: modalState.type,
                action: modalState.mode,
                docId: docIdentifier,
                payload: payload
            });

            hideActionLoading();
            showDialog({ variant: 'success', title: t.common.successTitle, message: t.common.successSave });
            handleCloseModal();
        } catch (error: any) {
            hideActionLoading();
            
            const defaultError = modalState.mode === 'edit' && !modalState.data?.id
                                 ? "فشل حفظ: الـ ID الخاص بالعنصر مفقود."
                                 : t.common.errorSave;

            const errorMessage = error.message.includes("Document ID is missing") 
                                 ? "فشل حفظ: الـ ID الخاص بالعنصر مفقود (الرجاء التأكد من أن العنصر المحدد يحتوي على ID)." 
                                 : error.message || defaultError;

            showDialog({ variant: 'alert', title: t.common.errorTitle, message: errorMessage });
        }
    };
    
    const handleDelete = (type: ModalType, docId: string) => {
        showDialog({
            variant: 'confirm',
            title: t.common.confirmDeleteTitle,
            message: t.common.confirmDeleteMessage,
            onConfirm: async () => {
                showActionLoading(t.common.saving);
                try {
                    await manageServiceConfig.current({
                        type: type,
                        action: 'delete',
                        docId: docId,
                    });
                    hideActionLoading();
                    showDialog({ variant: 'success', title: t.common.successTitle, message: t.common.successDelete });
                } catch (error: any) {
                    hideActionLoading();
                    showDialog({ variant: 'alert', title: t.common.errorTitle, message: error.message || t.common.errorDelete });
                }
            }
        });
    };
    
    // --- جلب البيانات ---
    const [groups, groupsLoading, groupsError] = useCollectionData<ServiceGroup>(
        useMemo(() => canManageGroups ?
            query(collection(db, "service_groups").withConverter(createConverter<ServiceGroup>()), orderBy("order")) :
            null,
            [canManageGroups])
    );

    const [services, servicesLoading, servicesError] = useCollectionData<Service>(
        useMemo(() => (canManageServices && selectedGroupId) ?
            query(collection(db, "services").withConverter(createConverter<Service>()), where("group_id", "==", Number(selectedGroupId)), orderBy("order")) :
            null,
            [canManageServices, selectedGroupId])
    );

    const [subServices, subServicesLoading, subServicesError] = useCollectionData<SubService>(
        useMemo(() => (canManageServices && selectedServiceId) ?
            query(collection(db, "sub_services").withConverter(createConverter<SubService>()), where("service_id", "==", Number(selectedServiceId)), orderBy("order")) :
            null,
            [canManageServices, selectedServiceId])
    );

    const [subSubServices, subSubServicesLoading, subSubServicesError] = useCollectionData<SubSubService>(
        useMemo(() => (canManageServices && selectedServiceId) ?
            query(collection(db, "sub_sub_services").withConverter(createConverter<SubSubService>()), where("service_id", "==", Number(selectedServiceId))) :
            null,
            [canManageServices, selectedServiceId])
    );

    useEffect(() => {
        if (servicesError) console.error("Services Error:", servicesError);
        if (subServicesError) console.error("SubServices Error:", subServicesError);
    }, [servicesError, subServicesError]);

    // --- معالجات الحالة ---
    const handleSelectGroup = (id: string) => {
        setSelectedGroupId(id);
        setSelectedServiceId(null);
        setSelectedSubServiceId(null);
    };

    const handleSelectService = (id: string) => {
        setSelectedServiceId(id);
        setSelectedSubServiceId(null);
    };

    const handleSelectSubService = (id: string) => {
        setSelectedSubServiceId(id);
    };

    // 🚨 تعديل: حفظ البيانات الأصلية عند فتح الـ Modal
    const handleOpenModal = (mode: 'create' | 'edit', type: ModalType, item: any = {}) => {
        let data = item;
        let originalData = item;

        if (mode === 'create') {
            if (type === 'service') {
                data = { group_id: Number(selectedGroupId), is_allowed: true, order: 1 };
            } else if (type === 'sub_service') {
                data = { service_id: Number(selectedServiceId), is_allowed: true, order: 1 };
            } else if (type === 'sub_sub_service') {
                data = { service_id: Number(selectedServiceId), is_allowed: true };
            } else {
                data = { order: 1 };
            }
            originalData = {}; // البيانات الأصلية فارغة في حالة الإنشاء
        }
        
        setModalState({ isOpen: true, mode, type, data, originalData });
    };

    const handleCloseModal = () => {
        setModalState({ isOpen: false });
    };

    useEffect(() => {
        setPageLoading(isAuthLoading);
    }, [isAuthLoading, setPageLoading]);

    const DirChevron = language === 'ar' ? ChevronLeftIcon : ChevronRightIcon;

    // --- مكون العمود (ManagementColumn) ---
    const ManagementColumn = ({ title, data, selectedId, onSelect, onAdd, onEdit, onDelete, type, permission, loading, addLabel }: any) => {
        if (!permission) {
            return (
                <div className="flex-1 min-w-[250px] h-full flex flex-col p-2">
                    <div className="flex items-center justify-center h-full text-center text-gray-500 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div className="p-4">
                            <LockClosedIcon className="w-10 h-10 mx-auto mb-2" />
                            <span className="text-sm font-semibold">{t.permissionDenied}</span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex-1 min-w-[280px] h-full flex flex-col bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                <div className="flex justify-between items-center p-3 border-b border-gray-700 bg-gray-900/80">
                    <h3 className="font-bold text-white truncate">{title}</h3>
                    {onAdd && (
                        <motion.button
                            onClick={onAdd}
                            variants={interactiveItemVariants} whileHover="hover" whileTap="tap"
                            className="p-1.5 text-[#FFD700] rounded-full hover:bg-yellow-400/10 transition-colors"
                            title={addLabel}
                        >
                            <PlusIcon className="w-5 h-5" />
                        </motion.button>
                    )}
                </div>

                {loading && <div className="p-4 text-center text-gray-400">{t.common.saving}</div>}
                {!loading && !data && <div className="p-4 text-center text-gray-400">{type === 'group' ? t.common.noData : t.common.selectGroup}</div>}
                {!loading && data && data.length === 0 && <div className="p-4 text-center text-gray-400">{t.common.noData}</div>}

                <div className="flex-grow overflow-y-auto custom-scrollbar">
                    {data && data.map((item: any) => (
                        <motion.div
                            key={item.id}
                            onClick={() => onSelect && onSelect(item.id)}
                            className={`flex justify-between items-center p-3 cursor-pointer border-b border-gray-800 last:border-b-0 transition-colors ${selectedId === item.id ? 'bg-yellow-400/10' : 'hover:bg-gray-800/60'}`}
                            variants={staggeredItemVariants}
                        >
                            <div className="flex-1 flex items-center gap-2 truncate">
                                <DynamicIcon name={item.icon} className={`w-4 h-4 flex-shrink-0 ${selectedId === item.id ? 'text-[#FFD700]' : 'text-gray-400'}`} />
                                <div className="truncate">
                                    <span className={`font-semibold ${selectedId === item.id ? 'text-[#FFD700]' : 'text-gray-200'}`}>
                                        {item.name_ar || item.label_ar}
                                    </span>
                                    <span className="block text-xs text-gray-400 truncate" dir="ltr">
                                        {item.name_en || item.label_en || `(ID: ${item.id})`}
                                    </span>
                                </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1.5 ltr:ml-2 rtl:mr-2">
                                <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} title={t.common.edit} className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors"><PencilIcon className="w-4 h-4" /></button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} title={t.common.delete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-700 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                {onSelect && <DirChevron className={`w-5 h-5 ${selectedId === item.id ? 'text-[#FFD700]' : 'text-gray-600'}`} />}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <>
            <AnimatePresence mode="wait">
                <motion.div
                    key="services-management-page" // 🚨 مفتاح ثابت لحل مشكلة اهتزاز الصفحة
                    custom={language}
                    variants={directionalSlideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" exit="exit" className="flex-grow bg-gray-800/50 rounded-xl shadow-2xl p-4 sm:p-6 border border-gray-700 flex flex-col h-full">
                        <motion.h1 variants={staggeredItemVariants} className="text-xl font-bold text-[#FFD700] flex items-center gap-2 mb-4">
                            <CogIcon className="w-6 h-6" />
                            {t.pageTitle}
                        </motion.h1>

                        {/* 4-Column Layout */}
                        <motion.div
                            variants={staggeredItemVariants}
                            className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden h-[calc(100vh-250px)]"
                        >
                            {/* Column 1: Service Groups */}
                            <ManagementColumn
                                title={t.columnTitles.groups}
                                data={groups}
                                selectedId={selectedGroupId}
                                onSelect={handleSelectGroup}
                                onAdd={() => handleOpenModal('create', 'service_group')}
                                onEdit={(item: ServiceGroup) => handleOpenModal('edit', 'service_group', item)}
                                onDelete={(id: string) => handleDelete('service_group', id)}
                                type="group"
                                permission={canManageGroups}
                                loading={groupsLoading}
                                addLabel={t.modalTitles.create + ' ' + t.modalTitles.service_group}
                            />

                            {/* Column 2: Services */}
                            <ManagementColumn
                                title={t.columnTitles.services}
                                data={services}
                                selectedId={selectedServiceId}
                                onSelect={handleSelectService}
                                onAdd={selectedGroupId ? () => handleOpenModal('create', 'service') : null}
                                onEdit={(item: Service) => handleOpenModal('edit', 'service', item)}
                                onDelete={(id: string) => handleDelete('service', id)}
                                type="service"
                                permission={canManageServices}
                                loading={servicesLoading}
                                addLabel={t.modalTitles.create + ' ' + t.modalTitles.service}
                            />

                            {/* Column 3: Sub-Services (Pages) */}
                            <ManagementColumn
                                title={t.columnTitles.subServices}
                                data={subServices}
                                selectedId={selectedSubServiceId}
                                onSelect={handleSelectSubService}
                                onAdd={selectedServiceId ? () => handleOpenModal('create', 'sub_service') : null}
                                onEdit={(item: SubService) => handleOpenModal('edit', 'sub_service', item)}
                                onDelete={(id: string) => handleDelete('sub_service', id)}
                                type="sub_service"
                                permission={canManageServices}
                                loading={subServicesLoading}
                                addLabel={t.modalTitles.create + ' ' + t.modalTitles.sub_service}
                            />

                            {/* Column 4: Sub-Sub-Services (Actions) */}
                            <ManagementColumn
                                title={t.columnTitles.subSubServices}
                                data={subSubServices}
                                selectedId={null}
                                onSelect={null}
                                onAdd={selectedServiceId ? () => handleOpenModal('create', 'sub_sub_service') : null}
                                onEdit={(item: SubSubService) => handleOpenModal('edit', 'sub_sub_service', item)}
                                onDelete={(id: string) => handleDelete('sub_sub_service', id)}
                                type="sub_sub_service"
                                permission={canManageServices}
                                loading={subSubServicesLoading}
                                addLabel={t.modalTitles.create + ' ' + t.modalTitles.sub_sub_service}
                            />

                        </motion.div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            {/* Modal الرئيسي */}
            <ManagementModal
                key="service-management-modal"
                modalState={modalState}
                onClose={handleCloseModal}
                onSave={handleSave}
                translations={translations}
                language={language}
                onOpenIconPicker={handleOpenIconPicker}
            />
            
            {/* منتقي الأيقونات */}
            <IconPickerModal
                isOpen={isIconPickerOpen}
                onClose={() => setIsIconPickerOpen(false)}
                onSelectIcon={handleIconSelect}
                language={language}
                translations={translations}
                initialIcon={iconFieldData?.icon || null}
            />
        </>
    );
}