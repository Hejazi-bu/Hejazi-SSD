import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {
    staggeredContainerVariants,
    staggeredItemVariants,
    interactiveItemVariants,
    directionalSlideVariants
} from "../../lib/animations";
import { cleanText } from "../../utils/textUtils";
import { useAuth } from "../contexts/UserContext";
import { useLanguage } from "../contexts/LanguageContext";
import { usePageLoading } from "../contexts/LoadingContext";
import { useActionLoading } from "../contexts/ActionLoadingContext";
import { httpsCallable } from "firebase/functions";
import { functions } from '../../lib/firebase';
import {
    AcademicCapIcon, GlobeAltIcon, UserIcon, PencilIcon, Squares2X2Icon,
    PlusIcon, TrashIcon, ClipboardDocumentListIcon, CalendarDaysIcon
} from "@heroicons/react/24/outline";
import { useDialog } from "../contexts/DialogContext";
import { useUnsavedChanges } from "../contexts/UnsavedChangesContext";
import { useNavigate } from "react-router-dom";

// --- استيراد الأجزاء المشتركة ---
import {
    AppOption,
    Country,
    MultiSelectButton,
    useAhmedSaeedServices,
    useAhmedSaeedUniversities,
    useAhmedSaeedCountries,
    useAhmedSaeedPersons
} from './AhmedSaeedShared';

type SubTask = {
    text: string;
    is_done: boolean;
};

type TaskState = {
    services: string[];
    universities: string[];
    countries: string[];
    responsiblePersons: string[];
    title: string;
    sub_tasks: SubTask[];
    start_at?: string;
    end_at?: string;
};

type FormErrors = {
    services: boolean;
    title: boolean;
    sub_tasks: boolean;
};

const FormInput = ({ label, Icon, children, error }: any) => (
    <motion.div variants={staggeredItemVariants} className={`bg-gradient-to-br from-gray-900/60 to-gray-800/60 rounded-lg p-3 shadow-md border ${error ? "border-red-500" : "border-gray-700"} transition-colors duration-300`}>
        <label className="flex items-center gap-2 mb-1 font-semibold text-gray-300 text-sm">
            <Icon className="w-5 h-5 text-[#FFD700]" />
            {label}
        </label>
        {children}
    </motion.div>
);

interface SubTasksManagerProps {
    label: string;
    subTasks: SubTask[];
    onChange: (newSubTasks: SubTask[]) => void;
    error: boolean;
    placeholder: string;
}

function SubTasksManager({ label, subTasks, onChange, error, placeholder }: SubTasksManagerProps) {
    const [newSubTaskText, setNewSubTaskText] = useState("");

    const handleAddTask = () => {
        const text = cleanText(newSubTaskText);
        if (!text) return;
        const newTask: SubTask = { text, is_done: false };
        onChange([...subTasks, newTask]);
        setNewSubTaskText("");
    };

    const handleEditTask = (index: number, newText: string) => {
        const text = cleanText(newText);
        const updatedTasks = subTasks.map((task, i) =>
            i === index ? { ...task, text: text } : task
        );
        onChange(updatedTasks);
    };

    const handleDeleteTask = (index: number) => {
        const updatedTasks = subTasks.filter((_, i) => i !== index);
        onChange(updatedTasks);
    };

    return (
        <motion.div
            variants={staggeredItemVariants}
            className={`bg-gradient-to-br from-gray-900/60 to-gray-800/60 rounded-lg p-3 shadow-md border ${error ? "border-red-500" : "border-gray-700"} transition-colors duration-300`}
        >
            <label className="flex items-center gap-2 mb-2 font-semibold text-gray-300 text-sm">
                <ClipboardDocumentListIcon className="w-5 h-5 text-[#FFD700]" />
                {label}
            </label>
            <div className="space-y-2 mb-3">
                {subTasks.map((task, index) => (
                    <div key={index} className="flex items-start gap-2">
                        <textarea
                            value={task.text}
                            onChange={(e) => handleEditTask(index, e.target.value)}
                            rows={2}
                            className="flex-grow w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-sm text-gray-200"
                        />
                        <button
                            type="button"
                            onClick={() => handleDeleteTask(index)}
                            className="flex-shrink-0 p-2.5 text-gray-400 hover:text-red-400 transition-colors"
                            title="حذف المهمة"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                ))}
                {subTasks.length === 0 && (
                    <p className="text-sm text-gray-500 text-center p-2">لم تتم إضافة أي مهام فرعية.</p>
                )}
            </div>
            <div className="flex items-start gap-2 pt-3 border-t border-gray-700">
                <textarea
                    placeholder={placeholder}
                    value={newSubTaskText}
                    onChange={(e) => setNewSubTaskText(e.target.value)}
                    rows={3}
                    className="flex-grow w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-sm text-gray-200"
                />
                <button
                    type="button"
                    onClick={handleAddTask}
                    className="flex-shrink-0 bg-[#FFD700] text-black px-4 py-2.5 rounded-lg font-bold disabled:bg-gray-600 disabled:text-gray-400"
                    disabled={!newSubTaskText.trim()}
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>
        </motion.div>
    );
}

function AhmedSaeedTasksContent({
    formData,
    formErrors,
    onFieldChange,
    onMultiSelectChange,
    onSubTasksChange,
    allCountries,
    allServices,
    allUniversities,
    allPersons,
    onSubmit,
    isSubmitting,
    translations,
    dialogHook,
    actionLoadingHook
}: any) {
    const t = translations["ar"];

    return (
        <motion.div
            variants={staggeredContainerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-grow bg-gray-800/50 rounded-xl shadow-2xl space-y-6 p-4 sm:p-6 border border-gray-700"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* الخدمات */}
                <MultiSelectButton label={t.services} Icon={Squares2X2Icon} options={allServices} selectedValues={formData.services} onChange={(values: string[]) => onMultiSelectChange('services', values)} error={formErrors.services} collectionName="app_services" readOnly={false} nameField="name" dialogHook={dialogHook} actionLoadingHook={actionLoadingHook} enableOrdering={true} />
                
                {/* الجامعات */}
                <MultiSelectButton label={t.universities} Icon={AcademicCapIcon} options={allUniversities} selectedValues={formData.universities} onChange={(values: string[]) => onMultiSelectChange('universities', values)} error={false} collectionName="app_universities" readOnly={false} nameField="name" dialogHook={dialogHook} actionLoadingHook={actionLoadingHook} enableOrdering={true} />
                
                {/* الدول */}
                <MultiSelectButton 
                    label={t.countries} 
                    Icon={GlobeAltIcon} 
                    options={allCountries} 
                    selectedValues={formData.countries} 
                    onChange={(values: string[]) => onMultiSelectChange('countries', values)} 
                    error={false} 
                    collectionName="app_countries"
                    readOnly={false}
                    nameField="name_ar" 
                    dialogHook={dialogHook} 
                    actionLoadingHook={actionLoadingHook} 
                    enableOrdering={true} 
                />
                
                {/* المسؤولين */}
                <MultiSelectButton label={t.responsiblePerson} Icon={UserIcon} options={allPersons} selectedValues={formData.responsiblePersons} onChange={(values: string[]) => onMultiSelectChange('responsiblePersons', values)} error={false} collectionName="app_responsible_persons" readOnly={false} nameField="name" dialogHook={dialogHook} actionLoadingHook={actionLoadingHook} enableOrdering={true} />
            </div>

            <motion.div variants={staggeredItemVariants} className="space-y-6 pt-4 border-t border-gray-700">
                <FormInput label={t.taskTitle} Icon={PencilIcon} error={formErrors.title}>
                    <input
                        type="text"
                        placeholder={t.taskTitlePlaceholder}
                        value={formData.title}
                        onChange={(e) => onFieldChange('title', e.target.value)}
                        className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                    />
                </FormInput>
                <SubTasksManager
                    label={t.taskSubTasks}
                    subTasks={formData.sub_tasks}
                    onChange={onSubTasksChange}
                    error={formErrors.sub_tasks}
                    placeholder={t.taskSubTasksPlaceholder}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput label={t.startDate} Icon={CalendarDaysIcon}>
                        <input
                            type="datetime-local"
                            value={formData.start_at}
                            onChange={(e) => onFieldChange('start_at', e.target.value)}
                            className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] [color-scheme:dark]"
                        />
                    </FormInput>
                    <FormInput label={t.endDate} Icon={CalendarDaysIcon}>
                        <input
                            type="datetime-local"
                            value={formData.end_at}
                            onChange={(e) => onFieldChange('end_at', e.target.value)}
                            className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] [color-scheme:dark]"
                        />
                    </FormInput>
                </div>
            </motion.div>

            <motion.div variants={staggeredItemVariants}>
                <div className="bg-gray-900/50 border border-yellow-400/50 rounded-lg p-6 mt-4">
                    <h2 className="text-xl font-bold text-[#FFD700] mb-4 text-center">{t.confirmAction}</h2>
                    <div className="flex flex-col items-center">
                        <div className="relative mt-4 flex flex-col items-center">
                            <motion.button
                                onClick={onSubmit}
                                className="bg-[#FFD700] text-black px-8 py-3 rounded-lg font-bold disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                disabled={isSubmitting}
                                variants={interactiveItemVariants}
                                whileHover="hover"
                                whileTap="tap"
                            >
                                {isSubmitting ? t.saving : t.save}
                            </motion.button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// --- المكون الرئيسي للصفحة ---
export default function AhmedSaeedTasks() {
    const { user, isLoading: isAuthLoading } = useAuth();
    const { showDialog } = useDialog();
    const { setPageLoading } = usePageLoading();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const navigate = useNavigate();
    
    // ✅ التعديل هنا: استخراج isDirty بشكل صحيح
    const { isDirty, setIsDirty } = useUnsavedChanges();

    const { allCountries, countriesLoading } = useAhmedSaeedCountries();
    const { allServices, servicesLoading } = useAhmedSaeedServices();
    const { allUniversities, universitiesLoading } = useAhmedSaeedUniversities();
    const { allPersons, personsLoading } = useAhmedSaeedPersons();

    const initialState: TaskState = {
        services: [],
        universities: [],
        countries: [],
        responsiblePersons: [],
        title: "",
        sub_tasks: [],
        start_at: "",
        end_at: "",
    };

    const initialErrors: FormErrors = {
        services: false,
        title: false,
        sub_tasks: false,
    };

    const [formData, setFormData] = useState<TaskState>(initialState);
    const [formErrors, setFormErrors] = useState<FormErrors>(initialErrors);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const translations = useMemo(() => {
        const ar = {
            pageTitle: "مهمة جديدة (أحمد سعيد)",
            services: "الخدمات",
            universities: "الجامعات",
            countries: "الدول",
            responsiblePerson: "الأشخاص المسؤولون",
            taskTitle: "عنوان المهمة (إجباري)",
            taskTitlePlaceholder: "أدخل عنوان المهمة...",
            taskSubTasks: "المهام الفرعية / الوصف (إجباري)",
            taskSubTasksPlaceholder: "اكتب وصف المهمة الفرعية هنا...",
            confirmAction: "تأكيد الإجراء",
            startDate: "تاريخ ووقت البدء (اختياري)",
            endDate: "تاريخ ووقت الانتهاء (اختياري)",
            noSignatureTitle: "التوقيع مطلوب",
            noSignatureMessage: "يجب عليك رفع توقيعك في ملفك الشخصي أولاً قبل إنشاء مهمة جديدة.",
            confirmSaveTitle: "تأكيد الحفظ",
            confirmSaveMessage: "هل أنت متأكد من حفظ هذه المهمة؟",
            validationErrorTitle: "بيانات غير مكتملة",
            validationErrorMessage: "يرجى ملء جميع الحقول الإلزامية (الخدمات، العنوان، ومهمة فرعية واحدة على الأقل).",
            successTitle: "نجاح",
            successMessage: "تم حفظ المهمة بنجاح.",
            errorTitle: "خطأ",
            genericErrorMessage: "حدث خطأ أثناء حفظ المهمة.",
            saving: "جاري الحفظ...",
            save: "حفظ المهمة",
        };
        return { ar, en: ar };
    }, []);

    const t = translations["ar"];

    const handleFieldChange = (field: keyof TaskState, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (field in formErrors) {
            setFormErrors(prev => ({ ...prev, [field]: false }));
        }
    };

    const onMultiSelectChange = (field: keyof TaskState, values: string[]) => {
        setFormData(prev => ({ ...prev, [field]: values }));
        if (field in formErrors) {
            setFormErrors(prev => ({ ...prev, [field]: false }));
        }
    };

    const handleSubTasksChange = (newSubTasks: SubTask[]) => {
        setFormData(prev => ({ ...prev, sub_tasks: newSubTasks }));
        if (formErrors.sub_tasks && newSubTasks.length > 0) {
            setFormErrors(prev => ({ ...prev, sub_tasks: false }));
        }
    };

    useEffect(() => {
        const hasData = cleanText(formData.title).length > 0 ||
            formData.sub_tasks.length > 0 ||
            formData.services.length > 0 ||
            formData.universities.length > 0 ||
            formData.countries.length > 0 ||
            formData.responsiblePersons.length > 0 ||
            !!(formData.start_at && formData.start_at.length > 0) ||
            !!(formData.end_at && formData.end_at.length > 0);
        setIsDirty(hasData);
        return () => { setIsDirty(false); };
    }, [formData, setIsDirty]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (isDirty) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isDirty]);

    useEffect(() => {
        const allDataLoaded = !isAuthLoading && !countriesLoading && !servicesLoading && !universitiesLoading && !personsLoading;
        if (allDataLoaded && !isReady) {
            setIsReady(true);
            setPageLoading(false);
        }
    }, [isAuthLoading, countriesLoading, servicesLoading, universitiesLoading, personsLoading, isReady, setPageLoading]);

    const handleSubmit = async () => {
        const errors = {
            services: formData.services.length === 0,
            title: !cleanText(formData.title),
            sub_tasks: formData.sub_tasks.length === 0,
        };
        setFormErrors(errors);

        if (Object.values(errors).some(Boolean)) {
            showDialog({ variant: 'alert', title: t.validationErrorTitle, message: t.validationErrorMessage });
            return;
        }

        const performSubmit = async () => {
            setIsSubmitting(true);
            setIsDirty(false);
            showActionLoading(t.saving);

            try {
                if (!user) { throw new Error("User data is not available."); }

                const arrayToMap = (arr: string[]) => {
                    return arr.reduce((acc, val) => {
                        acc[val] = true;
                        return acc;
                    }, {} as Record<string, boolean>);
                };

                const selectedCountryNames = formData.countries.map(id => {
                    return allCountries?.find((c: Country) => c.id === id)?.name_ar || id;
                });
                const selectedPersonNames = formData.responsiblePersons.map(id => {
                    return allPersons?.find((p: AppOption) => p.id === id)?.name || id;
                });
                const selectedUniversityNames = formData.universities.map(id => {
                    return allUniversities?.find((u: AppOption) => u.id === id)?.name || id;
                });
                const selectedServiceNames = formData.services.map(id => {
                    return allServices?.find((s: AppOption) => s.id === id)?.name || id;
                });

                const taskData = {
                    title: cleanText(formData.title),
                    sub_tasks: formData.sub_tasks,
                    creator_id: user.id,
                    services_map: arrayToMap(formData.services),
                    universities_map: arrayToMap(formData.universities),
                    countries_map: arrayToMap(formData.countries),
                    responsible_persons_map: arrayToMap(formData.responsiblePersons),
                    services_list: selectedServiceNames,
                    universities_list: selectedUniversityNames,
                    countries_list: selectedCountryNames,
                    responsible_persons_list: selectedPersonNames,
                    start_at: formData.start_at || null,
                    end_at: formData.end_at || null,
                };

                const createNewTask = httpsCallable(functions, 'createNewTask');

                await createNewTask({
                    taskData
                });

                setFormData(initialState);
                setFormErrors(initialErrors);

                showDialog({
                    variant: 'success', title: t.successTitle, message: t.successMessage,
                    onConfirm: () => { navigate('/tasks'); }
                });

            } catch (error: any) {
                showDialog({ variant: 'alert', title: t.errorTitle, message: error.message || t.genericErrorMessage });
            } finally {
                hideActionLoading();
                setIsSubmitting(false);
            }
        };

        showDialog({
            variant: 'confirm',
            title: t.confirmSaveTitle,
            message: t.confirmSaveMessage,
            onConfirm: performSubmit
        });
    };

    useEffect(() => {
        setPageLoading(!isReady);
    }, [isReady, setPageLoading]);

    return (
        <AnimatePresence mode="wait">
            <motion.div
                dir="rtl"
                variants={directionalSlideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
            >
                <AhmedSaeedTasksContent
                    formData={formData}
                    formErrors={formErrors}
                    onFieldChange={handleFieldChange}
                    onMultiSelectChange={onMultiSelectChange}
                    onSubTasksChange={handleSubTasksChange}
                    allCountries={allCountries}
                    allServices={allServices}
                    allUniversities={allUniversities}
                    allPersons={allPersons}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    translations={translations}
                    dialogHook={{ showDialog }}
                    actionLoadingHook={{ showActionLoading, hideActionLoading }}
                />
            </motion.div>
        </AnimatePresence>
    );
}