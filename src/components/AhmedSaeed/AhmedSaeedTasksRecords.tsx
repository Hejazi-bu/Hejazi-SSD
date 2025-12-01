import React, { useEffect, useState, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInVariants, staggeredContainerVariants, staggeredItemVariants, interactiveItemVariants } from "../../lib/animations";
import { usePageLoading } from "../contexts/LoadingContext";
import { useActionLoading } from "../contexts/ActionLoadingContext";
import { useDialog } from "../contexts/DialogContext";
import {
    collection, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, orderBy,
    query, where, or, and, QueryCompositeFilterConstraint,
    QueryFieldFilterConstraint,
    doc, updateDoc,
    writeBatch,
    deleteDoc,
    Timestamp // ✅ (الإصلاح): استيراد Timestamp الخاص بالواجهة الأمامية
} from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db, functions } from '../../lib/firebase'; // ✅ تأكد من استيراد functions
import { httpsCallable } from "firebase/functions"; // ✅ واستيراد httpsCallable
import {
    FunnelIcon, XMarkIcon, CalendarDaysIcon, UserIcon, GlobeAltIcon, AcademicCapIcon, Squares2X2Icon, CheckCircleIcon, NoSymbolIcon,
    XCircleIcon,
    DocumentTextIcon,
    EyeIcon, ClipboardDocumentListIcon, ArrowDownTrayIcon,
    EyeSlashIcon, ArchiveBoxArrowDownIcon, ArrowUturnUpIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
    PencilIcon,
    ChevronDoubleUpIcon,
    ArrowPathIcon,
    CheckIcon as CheckSolidIcon,
    HashtagIcon, // ✅ (الطلب 2)
    // --- ✅ (التعديلات الجديدة) ---
    ChevronDownIcon,       // لزر طي الفلتر
    ExclamationCircleIcon, // لحالة "غير منجز"
    InformationCircleIcon  // لأيقونة الفلتر
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from '@headlessui/react';
import { cleanText } from "../../utils/textUtils";

// --- ✅ استيراد الأجزاء المشتركة من الملف الصحيح ---
import {
    MultiSelectButton,
    SelectionModal,
    AppOption,
    Country,
    useAhmedSaeedServices,
    useAhmedSaeedUniversities,
    useAhmedSaeedCountries,
    useAhmedSaeedPersons
} from './AhmedSaeedShared';

// --- تعريف الأنواع (الخاصة بهذه الصفحة فقط) ---
type SubTask = {
    text: string;
    is_done: boolean;
};

interface AhmedSaeedTask extends DocumentData {
    id: string;
    title: string;
    sub_tasks: SubTask[];
    status: "منجز" | "غير منجز";
    created_at: any; // Timestamp
    // ✅ (الطلب 2): إضافة الرقم المتسلسل
    sequence_number?: number;

    // ✅ (الطلب 3): إضافة التواريخ
    start_at?: any; // Timestamp
    end_at?: any; // Timestamp
    // maps
    services_map: Record<string, boolean>;
    universities_map: Record<string, boolean>;
    countries_map: Record<string, boolean>;
    responsible_persons_map: Record<string, boolean>;
    // lists
    services_list: string[];
    universities_list: string[];
    countries_list: string[];
    responsible_persons_list: string[];
    is_hidden?: boolean;
}

// --- ✅ (الإصلاح 2): نقل الأنواع إلى هنا (أعلى الملف) ---
type StatusFilter = "all" | "منجز" | "غير منجز";

interface StatusTabsProps {
    tasks: AhmedSaeedTask[];
    activeFilter: StatusFilter;
    onFilterChange: (filter: StatusFilter) => void;
}
// ---------------------------------------------------


const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
    toFirestore: (data: T): DocumentData => data,
    fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T)
});
const taskConverter = createConverter<AhmedSaeedTask>();

// --- ✅ (الطلب 1): دالة مساعدة لتحويل مصفوفة ID إلى Map ---
const arrayToMap = (arr: string[]) => {
    return arr.reduce((acc, val) => {
        acc[val] = true;
        return acc;
    }, {} as Record<string, boolean>);
};

// ====================================================================
// --- ✅ (الطلب 1): مكون الواجهة المنبثقة مُعدل بالكامل ---
// ====================================================================
function TaskDetailsModal({
    task,
    isOpen,
    onClose,
    dialogHook,
    actionLoadingHook,
    allServices,
    allUniversities,
    allCountries,
    allPersons
}: {
    task: AhmedSaeedTask,
    isOpen: boolean,
    onClose: () => void,
    dialogHook: any,
    actionLoadingHook: any,
    allServices: AppOption[] | undefined,
    allUniversities: AppOption[] | undefined,
    allCountries: Country[] | undefined,
    allPersons: AppOption[] | undefined
}) {
    const { showActionLoading, hideActionLoading } = actionLoadingHook;
    const { showDialog } = dialogHook;

    const [internalTitle, setInternalTitle] = useState(task.title);
    const [internalSubTasks, setInternalSubTasks] = useState<SubTask[]>(task.sub_tasks || []);

    const [isTitleEditing, setIsTitleEditing] = useState(false);
    const [tempTitle, setTempTitle] = useState(task.title);

    const [isSubTasksEditing, setIsSubTasksEditing] = useState(false);
    const [tempSubTasks, setTempSubTasks] = useState<SubTask[]>(task.sub_tasks || []);
    const [newSubTaskText, setNewSubTaskText] = useState("");

    // ✅ (الطلب 4): حالة لتعديل التواريخ
    const [isDatesEditing, setIsDatesEditing] = useState(false);

    // --- ✅ (الطلب 4): تغيير الحالة لتخزين مصفوفات IDs (للحفاظ على الترتيب) ---
    const [internalServices, setInternalServices] = useState<string[]>([]);
    const [internalUniversities, setInternalUniversities] = useState<string[]>([]);
    const [internalCountries, setInternalCountries] = useState<string[]>([]);
    const [internalPersons, setInternalPersons] = useState<string[]>([]);

    // --- ✅ (الطلب 3): إضافة حالة للتواريخ ---
    // (نستخدم صيغة YYYY-MM-DDTHH:MM المتوافقة مع <input type="datetime-local">)
    const [internalStartDate, setInternalStartDate] = useState(
        task.start_at ? new Date(task.start_at.toDate()).toISOString().slice(0, 16) : ""
    );
    const [internalEndDate, setInternalEndDate] = useState(
        task.end_at ? new Date(task.end_at.toDate()).toISOString().slice(0, 16) : ""
    );

    // --- (مطلوب للتحقق من التغييرات) ---
    const [originalState, setOriginalState] = useState({
        title: task.title,
        subTasks: task.sub_tasks || [],
        services: [] as string[],
        universities: [] as string[],
        countries: [] as string[],
        persons: [] as string[],
        startDate: task.start_at ? new Date(task.start_at.toDate()).toISOString().slice(0, 16) : "",
        endDate: task.end_at ? new Date(task.end_at.toDate()).toISOString().slice(0, 16) : "",
    });

    const [editingSection, setEditingSection] = useState<string | null>(null);

    const [isDirty, setIsDirty] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const [internalTask, setInternalTask] = useState(task);
    useEffect(() => {
        setInternalTask(task);
    }, [task]);

    useEffect(() => {
        if (isOpen) {
            // --- ✅ (الطلب 4): دالة مساعدة لتحويل قائمة الأسماء (المرتبة) إلى قائمة IDs (مرتبة)
            const getIdsFromNames = (names: string[], options: (AppOption | Country)[] | undefined, nameField: string): string[] => {
                if (!options || !names) return [];
                // 1. إنشاء خريطة (Map) للبحث عن الـ ID عن طريق الاسم
                const nameToIdMap = new Map(options.map(opt => [(opt as any)[nameField], opt.id]));
                // 2. المرور على مصفوفة الأسماء المرتبة (من الداتابيس) وإرجاع الـ ID المقابل
                return names.map(name => nameToIdMap.get(name)).filter(Boolean) as string[];
            };

            // --- ✅ تهيئة مصفوفات الـ IDs بالترتيب الصحيح
            const initialServices = getIdsFromNames(task.services_list || [], allServices, 'name');
            const initialUniversities = getIdsFromNames(task.universities_list || [], allUniversities, 'name');
            const initialCountries = getIdsFromNames(task.countries_list || [], allCountries, 'name_ar');
            const initialPersons = getIdsFromNames(task.responsible_persons_list || [], allPersons, 'name');

            // --- ✅ (الطلب 3): تهيئة التواريخ
            const initialStartDate = task.start_at ? new Date(task.start_at.toDate()).toISOString().slice(0, 16) : "";
            const initialEndDate = task.end_at ? new Date(task.end_at.toDate()).toISOString().slice(0, 16) : "";

            // --- تهيئة الحالة (State) ---
            setInternalTitle(task.title);
            setInternalSubTasks(task.sub_tasks || []);
            setInternalServices(initialServices);
            setInternalUniversities(initialUniversities);
            setInternalCountries(initialCountries);
            setInternalPersons(initialPersons);
            setInternalStartDate(initialStartDate);
            setInternalEndDate(initialEndDate);

            // --- تخزين الحالة الأصلية للمقارنة (isDirty) ---
            setOriginalState({
                title: task.title,
                subTasks: task.sub_tasks || [],
                services: initialServices,
                universities: initialUniversities,
                countries: initialCountries,
                persons: initialPersons,
                startDate: initialStartDate,
                endDate: initialEndDate,
            });

            // --- إعادة تعيين واجهة التعديل ---
            setIsTitleEditing(false);
            setTempTitle(task.title);
            setIsSubTasksEditing(false);
            setTempSubTasks(task.sub_tasks || []);
            setNewSubTaskText("");
            setIsDatesEditing(false); // ✅ (الطلب 4)

            setEditingSection(null);
            setIsDirty(false);
            setIsUpdating(false);
        }
    }, [isOpen, task, allServices, allUniversities, allCountries, allPersons]); // ✅ إضافة all...

    useEffect(() => {
        if (!isOpen) return;

        const titleChanged = internalTitle !== originalState.title;
        const subTasksChanged = JSON.stringify(internalSubTasks) !== JSON.stringify(originalState.subTasks);
        const servicesChanged = JSON.stringify(internalServices) !== JSON.stringify(originalState.services);
        const universitiesChanged = JSON.stringify(internalUniversities) !== JSON.stringify(originalState.universities);
        const countriesChanged = JSON.stringify(internalCountries) !== JSON.stringify(originalState.countries);
        const personsChanged = JSON.stringify(internalPersons) !== JSON.stringify(originalState.persons);
        const startDateChanged = internalStartDate !== originalState.startDate;
        const endDateChanged = internalEndDate !== originalState.endDate;

        setIsDirty(
            titleChanged || subTasksChanged || servicesChanged || universitiesChanged ||
            countriesChanged || personsChanged || startDateChanged || endDateChanged
        );

    }, [
        internalTitle, internalSubTasks, internalServices, internalUniversities,
        internalCountries, internalPersons, internalStartDate, internalEndDate,
        originalState, isOpen
    ]);

    const handleSaveTitle = () => {
        const cleanTitle = cleanText(tempTitle);
        if (cleanTitle) {
            setInternalTitle(cleanTitle);
            setIsTitleEditing(false);
        } else {
            showDialog({ variant: 'alert', title: 'خطأ', message: 'العنوان لا يمكن أن يكون فارغاً.' });
        }
    };
    const handleCancelTitleEdit = () => {
        setTempTitle(internalTitle);
        setIsTitleEditing(false);
    };

    const handleAddSubTask = () => {
        const text = cleanText(newSubTaskText);
        if (!text) return;
        setTempSubTasks(prev => [...prev, { text, is_done: false }]);
        setNewSubTaskText("");
    };
    const handleEditSubTaskText = (index: number, text: string) => {
        setTempSubTasks(prev => prev.map((task, i) => i === index ? { ...task, text } : task));
    };
    const handleDeleteSubTask = (index: number) => {
        setTempSubTasks(prev => prev.filter((_, i) => i !== index));
    };

    // ✅ (الطلب 4): تعديل دالة التشيك بوكس
    const handleToggleSubTaskDone = (index: number) => {
        // إذا كنا في وضع التعديل، عدل القائمة المؤقتة
        if (isSubTasksEditing) {
            setTempSubTasks(prev => prev.map((task, i) => i === index ? { ...task, is_done: !task.is_done } : task));
        } else {
            // إذا كنا في وضع العرض، عدل القائمة الرئيسية مباشرة
            setInternalSubTasks(prev => prev.map((task, i) => i === index ? { ...task, is_done: !task.is_done } : task));
        }
    };
    const handleSaveSubTasks = () => {
        setInternalSubTasks(tempSubTasks);
        setIsSubTasksEditing(false);
    };
    const handleCancelSubTasksEdit = () => {
        setTempSubTasks(internalSubTasks);
        setIsSubTasksEditing(false);
    };

    const renderEditableList = (title: string, Icon: any, list: string[], sectionKey: string) => {
        return (
            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
                        <Icon className="w-4 h-4 text-[#FFD700]" />
                        {title}
                    </h4>
                    <button
                        onClick={() => setEditingSection(sectionKey)}
                        className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        title={`تعديل ${title}`}
                    >
                        <PencilSquareIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {(list && list.length > 0) ? list.map((item, index) => ( // ✅ إضافة index
                        <span key={`${item}-${index}`} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full"> {/* ✅ استخدام index كجزء من key */}
                            {item}
                        </span>
                    )) : <span className="text-xs text-gray-500">لا يوجد</span>}
                </div>
            </div>
        );
    };

    // --- ✅ دالة الحفظ المعدلة (تستخدم الدالة السحابية) ---
    const handleSaveChanges = async () => {
        if (isUpdating || !isDirty) return;

        if (internalServices.length === 0) {
            showDialog({
                variant: 'alert',
                title: "بيانات ناقصة",
                message: "يجب اختيار خدمة واحدة على الأقل."
            });
            return;
        }

        setIsUpdating(true);
        showActionLoading("جاري حفظ التعديلات...");

        // (الطلب 4): بناء القوائم والـ Maps من مصفوفات الـ IDs المرتبة
        const newServicesList = internalServices.map(id => allServices?.find(s => s.id === id)?.name || id);
        const newUniList = internalUniversities.map(id => allUniversities?.find(u => u.id === id)?.name || id);
        const newCountryList = internalCountries.map(id => allCountries?.find(c => c.id === id)?.name_ar || id);
        const newPersonList = internalPersons.map(id => allPersons?.find(p => p.id === id)?.name || id);

        const newServicesMap = arrayToMap(internalServices);
        const newUniMap = arrayToMap(internalUniversities);
        const newCountryMap = arrayToMap(internalCountries);
        const newPersonMap = arrayToMap(internalPersons);

        // --- هذا الكائن سيتم إرساله إلى الدالة السحابية ---
        const taskData = {
            title: internalTitle,
            sub_tasks: internalSubTasks,
            // status: (الخادم سيحسبه)

            // (الخرائط المحدثة)
            services_map: newServicesMap,
            universities_map: newUniMap,
            countries_map: newCountryMap,
            responsible_persons_map: newPersonMap,

            // (القوائم المرتبة المحدثة)
            services_list: newServicesList,
            universities_list: newUniList,
            countries_list: newCountryList,
            responsible_persons_list: newPersonList,

            // (الطلب 3): إرسال التواريخ كـ ISO string أو null
            start_at: internalStartDate || null,
            end_at: internalEndDate || null,
        };

        // --- 🚀 استدعاء الدالة السحابية ---
        try {
            const updateTask = httpsCallable(functions, 'updateAhmedSaeedTask');

            await updateTask({
                taskId: task.id,
                taskData: taskData
            });

            // (النجاح)
            setIsDirty(false);
            // ✅ (الطلب 5): تحديث الحالة الأصلية بعد الحفظ لمنع "تعديلات غير محفوظة"
            setOriginalState({
                title: internalTitle,
                subTasks: internalSubTasks,
                services: internalServices,
                universities: internalUniversities,
                countries: internalCountries,
                persons: internalPersons,
                startDate: internalStartDate,
                endDate: internalEndDate,
            });

            showDialog({
                variant: 'success',
                title: "تم الحفظ",
                message: "تم حفظ التعديلات بنجاح."
            });
        } catch (error: any) {
            showDialog({
                variant: 'alert',
                title: "خطأ",
                message: `فشل حفظ التعديلات: ${error.message}`
            });
        } finally {
            setIsUpdating(false);
            hideActionLoading();
        }
    };

    const handleCloseButton = () => {
        if (isDirty) {
            showDialog({
                variant: 'confirm',
                title: 'تعديلات غير محفوظة',
                message: 'توجد تعديلات لم يتم حفظها. هل أنت متأكد من الخروج؟',
                onConfirm: onClose
            });
        } else {
            onClose();
        }
    };

    // ✅ (الطلب 5): تعديل دالة الإخفاء
    const handleToggleHidden = async () => {
        const isHidden = internalTask.is_hidden || false;
        const actionText = isHidden ? "استعادة" : "إخفاء";

        showDialog({
            variant: 'confirm',
            title: `تأكيد ${actionText}`,
            message: `هل أنت متأكد من ${actionText} هذه المهمة؟`,
            onConfirm: async () => {
                showActionLoading(`جاري ${actionText}...`);
                try {
                    const taskRef = doc(db, "AhmedSaeedTasks", task.id);
                    await updateDoc(taskRef, {
                        is_hidden: !isHidden
                    });
                    // ✅ (الطلب 5): تحديث الحالة الداخلية فقط
                    setInternalTask(prev => ({ ...prev, is_hidden: !isHidden }));
                } catch (error: any) {
                    showDialog({ variant: 'alert', title: "خطأ", message: error.message });
                } finally {
                    hideActionLoading();
                }
            }
        });
    };

    // ✅ (الطلب 6): تعديل دالة الحذف
    const handleDeleteTask = () => {
        showDialog({
            variant: 'confirm',
            customColor: 'red',
            title: 'تأكيد الحذف',
            message: `هل أنت متأكد من حذف هذه المهمة (${task.title}) بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.`,
            confirmText: "نعم، احذف",
            cancelText: "إلغاء",
            onConfirm: async () => {
                showActionLoading("جاري حذف السجل...");
                try {
                    const taskRef = doc(db, "AhmedSaeedTasks", task.id);
                    await deleteDoc(taskRef);

                    // ✅ (الطلب 6): إظهار رسالة النجاح
                    showDialog({
                        variant: 'success',
                        title: 'تم الحذف',
                        message: `تم حذف السجل "${task.title}" بنجاح.`
                    });

                    onClose(); // إغلاق النافذة المنبثقة بعد النجاح
                } catch (error: any) {
                    showDialog({ variant: 'alert', title: "خطأ", message: `فشل حذف السجل: ${error.message}` });
                } finally {
                    hideActionLoading();
                }
            }
        });
    };

    const getModalProps = () => {
        const baseTitle = ` - (${task.title})`;
        switch (editingSection) {
            case 'services':
                return {
                    title: "تعديل الخدمات" + baseTitle,
                    options: allServices || [],
                    selectedIds: internalServices, // ✅ (الطلب 4): تمرير مصفوفة الـ IDs
                    onSave: (newIds: string[]) => setInternalServices(newIds), // ✅ (الطلب 4): تحديث مصفوفة الـ IDs
                    collectionName: "app_services", readOnly: false, nameField: "name",
                    enableOrdering: true // ✅ (الطلب 4): تفعيل الترتيب
                };
            case 'universities':
                return {
                    title: "تعديل الجامعات" + baseTitle,
                    options: allUniversities || [],
                    selectedIds: internalUniversities, // ✅
                    onSave: (newIds: string[]) => setInternalUniversities(newIds), // ✅
                    collectionName: "app_universities", readOnly: false, nameField: "name",
                    enableOrdering: true // ✅
                };
            case 'countries':
                return {
                    title: "تعديل الدول" + baseTitle,
                    options: allCountries || [],
                    selectedIds: internalCountries,
                    onSave: (newIds: string[]) => setInternalCountries(newIds),
                    
                    // ✅ 1. الاسم صحيح (يربطه بالمكتبة)
                    collectionName: "app_countries", 
                    
                    // ❌ خطأ في كودك: readOnly: true
                    // ✅ الصحيح: يجب أن تكون false لتفعيل زر الإدارة/الإضافة
                    readOnly: false, 
                    
                    nameField: "name_ar",
                    enableOrdering: true
                };
            case 'persons':
                return {
                    title: "تعديل الأشخاص المسؤولين" + baseTitle,
                    options: allPersons || [],
                    selectedIds: internalPersons, // ✅
                    onSave: (newIds: string[]) => setInternalPersons(newIds), // ✅
                    collectionName: "app_responsible_persons", readOnly: false, nameField: "name",
                    enableOrdering: true // ✅
                };
            default:
                return null;
        }
    };

    const modalProps = getModalProps();

    return (
        <>
            <Transition appear show={isOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => { /* لا تفعل شيئاً */ }} dir="rtl">
                    <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-0 sm:p-4 text-center">
                            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 text-right shadow-2xl transition-all h-screen sm:h-auto sm:max-h-[80vh] sm:rounded-2xl border border-gray-700 flex flex-col">
                                    <Dialog.Title as="h3" className="flex items-center justify-between p-4 border-b border-gray-700">
                                        <button onClick={handleCloseButton} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
                                            <XMarkIcon className="w-6 h-6" />
                                        </button>
                                        <span className="text-lg font-semibold text-gray-200 truncate pr-4">تفاصيل المهمة</span>
                                    </Dialog.Title>

                                    {/* --- ✅ (الطلب 4): تعديل واجهة النافذة --- */}
                                    <div className="flex-grow overflow-y-auto p-4 space-y-4">

                                        {/* (الطلب 4): الرقم المتسلسل أولاً */}
                                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300 mb-2">
                                                <HashtagIcon className="w-4 h-4 text-[#FFD700]" />
                                                الرقم المتسلسل
                                            </h4>
                                            <p className="w-full p-2.5 text-gray-200">{task.sequence_number || "غير محدد"}</p>
                                        </div>

                                        {/* (الطلب 4): العنوان */}
                                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
                                                    <PencilIcon className="w-4 h-4 text-[#FFD700]" />
                                                    عنوان المهمة
                                                </h4>
                                                {!isTitleEditing ? (
                                                    <button onClick={() => setIsTitleEditing(true)} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" title="تعديل العنوان">
                                                        <PencilSquareIcon className="w-5 h-5" />
                                                    </button>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button onClick={handleCancelTitleEdit} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-red-400 transition-colors" title="إلغاء">
                                                            <XCircleIcon className="w-5 h-5" />
                                                        </button>
                                                        <button onClick={handleSaveTitle} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-green-400 transition-colors" title="حفظ العنوان">
                                                            <CheckSolidIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {isTitleEditing ? (
                                                <input
                                                    type="text"
                                                    value={tempTitle}
                                                    onChange={(e) => setTempTitle(e.target.value)}
                                                    className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-gray-100"
                                                    autoFocus
                                                />
                                            ) : (
                                                <p className="w-full p-2.5 text-gray-200">{internalTitle}</p>
                                            )}
                                        </div>

                                        {/* (الطلب 4): التواريخ */}
                                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
                                                    <CalendarDaysIcon className="w-4 h-4 text-[#FFD700]" />
                                                    التواريخ (اختياري)
                                                </h4>
                                                {!isDatesEditing ? (
                                                    <button onClick={() => setIsDatesEditing(true)} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" title="تعديل التواريخ">
                                                        <PencilSquareIcon className="w-5 h-5" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => setIsDatesEditing(false)} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-green-400 transition-colors" title="إغلاق التعديل">
                                                        <CheckSolidIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-400 mb-1 block">تاريخ البدء</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={internalStartDate}
                                                        onChange={(e) => setInternalStartDate(e.target.value)}
                                                        disabled={!isDatesEditing} // ✅ (الطلب 4)
                                                        className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] [color-scheme:dark] text-gray-200 disabled:bg-gray-800 disabled:text-gray-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-400 mb-1 block">تاريخ الانتهاء</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={internalEndDate}
                                                        onChange={(e) => setInternalEndDate(e.target.value)}
                                                        disabled={!isDatesEditing} // ✅ (الطلب 4)
                                                        className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] [color-scheme:dark] text-gray-200 disabled:bg-gray-800 disabled:text-gray-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* (الطلب 4): المهام الفرعية */}
                                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
                                                    <ClipboardDocumentListIcon className="w-4 h-4 text-[#FFD700]" />
                                                    المهام الفرعية
                                                </h4>
                                                {!isSubTasksEditing ? (
                                                    <button onClick={() => setIsSubTasksEditing(true)} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" title="تعديل المهام">
                                                        <PencilSquareIcon className="w-5 h-5" />
                                                    </button>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button onClick={handleCancelSubTasksEdit} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-red-400 transition-colors" title="إلغاء">
                                                            <XCircleIcon className="w-5 h-5" />
                                                        </button>
                                                        <button onClick={handleSaveSubTasks} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-green-400 transition-colors" title="حفظ المهام">
                                                            <CheckSolidIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                {isSubTasksEditing ? (
                                                    <>
                                                        {tempSubTasks.map((subTask, index) => (
                                                            <div key={index} className="flex items-start gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={subTask.is_done}
                                                                    onChange={() => handleToggleSubTaskDone(index)}
                                                                    className={`form-checkbox h-5 w-5 bg-gray-700 border-gray-600 ${subTask.is_done ? 'text-green-500' : 'text-[#FFD700]'} focus:ring-green-500 rounded mt-2 cursor-pointer`}
                                                                />
                                                                <textarea
                                                                    value={subTask.text}
                                                                    onChange={(e) => handleEditSubTaskText(index, e.target.value)}
                                                                    rows={2}
                                                                    className={`flex-grow w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-sm ${subTask.is_done ? 'text-gray-500' : 'text-gray-200'}`}
                                                                />
                                                                <button onClick={() => handleDeleteSubTask(index)} className="p-2.5 text-gray-400 hover:text-red-400 transition-colors mt-0.5" title="حذف المهمة">
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {tempSubTasks.length === 0 && <p className="text-sm text-gray-500 text-center p-2">لا توجد مهام فرعية.</p>}
                                                        <div className="flex items-start gap-2 pt-3 border-t border-gray-700 mt-3">
                                                            <textarea
                                                                placeholder="أضف مهمة فرعية جديدة..."
                                                                value={newSubTaskText}
                                                                onChange={(e) => setNewSubTaskText(e.target.value)}
                                                                rows={2}
                                                                className="flex-grow w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] text-sm text-gray-200"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={handleAddSubTask}
                                                                className="flex-shrink-0 bg-[#FFD700] text-black px-4 py-2.5 rounded-lg font-bold disabled:bg-gray-600 disabled:text-gray-400"
                                                                disabled={!newSubTaskText.trim()}
                                                                title="إضافة مهمة"
                                                            >
                                                                <PlusIcon className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {internalSubTasks.length > 0 ? internalSubTasks.map((subTask, index) => (
                                                            <label key={index} className="flex items-start gap-3 p-2.5 rounded-md cursor-pointer hover:bg-gray-700/50">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={subTask.is_done}
                                                                    onChange={() => handleToggleSubTaskDone(index)} // ✅ (الطلب 4)
                                                                    className={`form-checkbox h-5 w-5 bg-gray-700 border-gray-600 ${subTask.is_done ? 'text-green-500' : 'text-[#FFD700]'} focus:ring-green-500 rounded mt-0.5 cursor-pointer`} // ✅ (الطلب 4)
                                                                />
                                                                <span className={`text-sm ${subTask.is_done ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                                                    {subTask.text}
                                                                </span>
                                                            </label>
                                                        )) : (
                                                            <p className="text-sm text-gray-500 text-center p-2">لا توجد مهام فرعية.</p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* (الطلب 4): عرض القوائم */}
                                        {renderEditableList("الخدمات", Squares2X2Icon, internalServices.map(id => allServices?.find(s => s.id === id)?.name || id), "services")}
                                        {renderEditableList("الجامعات", AcademicCapIcon, internalUniversities.map(id => allUniversities?.find(u => u.id === id)?.name || id), "universities")}
                                        {renderEditableList("الدول", GlobeAltIcon, internalCountries.map(id => allCountries?.find(c => c.id === id)?.name_ar || id), "countries")}
                                        {renderEditableList("الأشخاص المسؤولون", UserIcon, internalPersons.map(id => allPersons?.find(p => p.id === id)?.name || id), "persons")}

                                    </div>

                                    <div className="p-4 border-t border-gray-700 bg-gray-900/30 flex justify-between items-center">

                                        <div className="flex items-center gap-3">
                                            {/* --- ✅ (الطلب 5): زر الإخفاء/الاستعادة --- */}
                                            <button
                                                onClick={handleToggleHidden}
                                                className={`flex items-center gap-1.5 text-xs transition-colors font-medium ${internalTask.is_hidden
                                                    ? 'text-blue-400 hover:text-blue-300'
                                                    : 'text-gray-500 hover:text-gray-400'
                                                    }`}
                                            >
                                                {internalTask.is_hidden ? <ArrowUturnUpIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                                                <span>{internalTask.is_hidden ? "استعادة" : "إخفاء"}</span>
                                            </button>

                                            {/* --- ✅ (الطلب 6): زر الحذف --- */}
                                            <button
                                                onClick={handleDeleteTask}
                                                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors font-medium"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                                <span>حذف السجل</span>
                                            </button>
                                        </div>

                                        {/* --- ✅ زر الحفظ (ظاهر دائماً) --- */}
                                        <motion.button
                                            variants={interactiveItemVariants}
                                            whileHover="hover" whileTap="tap"
                                            onClick={handleSaveChanges}
                                            disabled={!isDirty || isUpdating}
                                            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-semibold disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ArrowDownTrayIcon className="w-5 h-5" />
                                            <span>{isUpdating ? "جاري الحفظ..." : "حفظ التعديلات"}</span>
                                        </motion.button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* --- ✅ (الطلب 1 و 4): نافذة التعديل المنبثقة --- */}
            {modalProps && (
                <SelectionModal
                    isOpen={!!editingSection}
                    onClose={() => setEditingSection(null)}
                    title={modalProps.title}
                    options={modalProps.options}
                    selectedIds={modalProps.selectedIds}
                    onSave={modalProps.onSave}
                    nameField={modalProps.nameField}
                    collectionName={modalProps.collectionName}
                    readOnly={modalProps.readOnly}
                    dialogHook={dialogHook}
                    actionLoadingHook={actionLoadingHook}
                    // ✅ (الطلب 4): تفعيل الترتيب عند تعديل السجل
                    enableOrdering={modalProps.enableOrdering}
                />
            )}
        </>
    );
}

// ====================================================================
// --- ✅ (الطلب 2): مكون كرت المهمة مُعاد تصميمه بالكامل ---
// ====================================================================
const TaskCard = ({
    task,
    dialogHook,
    actionLoadingHook,
    allServices,
    allUniversities,
    allCountries,
    allPersons,
    showHidden,
    isSelected,
    onToggleSelection,
    displayIndex,
    totalTasks
}: {
    task: AhmedSaeedTask,
    dialogHook: any,
    actionLoadingHook: any,
    allServices: AppOption[] | undefined,
    allUniversities: AppOption[] | undefined,
    allCountries: Country[] | undefined,
    allPersons: AppOption[] | undefined,
    showHidden: boolean,
    isSelected: boolean,
    onToggleSelection: (id: string) => void,
    displayIndex: number,
    totalTasks: number
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { showDialog, showActionLoading, hideActionLoading } = { ...dialogHook, ...actionLoadingHook };

    // --- دالة تنسيق التاريخ (للوسط) ---
    const formatMiddleDate = (timestamp: any): string => {
        if (!timestamp) return '-';
        const date = timestamp.toDate();
        // صيغة مختصرة: 9/11/2025
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric', month: 'numeric', day: 'numeric',
        };
        return new Date(date).toLocaleString('ar-EG-u-nu-latn', options);
    };

    // --- (الطلب 3): دالة مساعدة للتواريخ الاختيارية ---
    const formatShortDate = (timestamp: any): string => {
        if (!timestamp) return '-';
        const date = timestamp.toDate();
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: '2-digit'
        };
        return new Date(date).toLocaleString('ar-EG-u-nu-latn', options);
    };

    // --- (الطلب 2): دوال الحذف والإخفاء السريع ---
    const handleQuickHide = async (e: React.MouseEvent) => {
        e.stopPropagation(); // منع فتح النافذة المنبثقة
        const isHidden = task.is_hidden || false;
        const actionText = isHidden ? "استعادة" : "إخفاء";

        dialogHook.showDialog({
            variant: 'confirm',
            title: `تأكيد ${actionText}`,
            message: `هل أنت متأكد من ${actionText} هذه المهمة؟`,
            onConfirm: async () => {
                showActionLoading(`جاري ${actionText}...`);
                try {
                    const taskRef = doc(db, "AhmedSaeedTasks", task.id);
                    await updateDoc(taskRef, { is_hidden: !isHidden });
                    // (لا نحتاج لتحديث الحالة هنا لأن useCollectionData سيفعل ذلك)
                } catch (error: any) {
                    dialogHook.showDialog({ variant: 'alert', title: "خطأ", message: error.message });
                } finally {
                    hideActionLoading();
                }
            }
        });
    };

    const handleQuickDelete = (e: React.MouseEvent) => {
        e.stopPropagation(); // منع فتح النافذة المنبثقة
        dialogHook.showDialog({
            variant: 'confirm',
            customColor: 'red',
            title: 'تأكيد الحذف',
            message: `هل أنت متأكد من حذف هذه المهمة (${task.title}) بشكل نهائي؟`,
            confirmText: "نعم، احذف",
            cancelText: "إلغاء",
            onConfirm: async () => {
                showActionLoading("جاري حذف السجل...");
                try {
                    const taskRef = doc(db, "AhmedSaeedTasks", task.id);
                    await deleteDoc(taskRef);
                    // ✅ (الطلب 6): إظهار رسالة النجاح
                    dialogHook.showDialog({
                        variant: 'success',
                        title: 'تم الحذف',
                        message: `تم حذف السجل "${task.title}" بنجاح.`
                    });
                } catch (error: any) {
                    dialogHook.showDialog({ variant: 'alert', title: "خطأ", message: `فشل حذف السجل: ${error.message}` });
                } finally {
                    hideActionLoading();
                }
            }
        });
    };

    return (
        <>
            <motion.div
                variants={staggeredItemVariants}
                className={`rounded-xl border shadow-lg flex flex-col transition-colors duration-200 ${isSelected ? "bg-gray-700 border-yellow-500" : "bg-gray-800/60 border-gray-700"}`}
            >
                {/* --- ✅ (الطلب 2): الصف الأول - العنوان فقط --- */}
                <div className="p-4 flex-grow">
                    <div className="flex justify-between items-start gap-2">
                        {showHidden ? (
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleSelection(task.id)}
                                className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-[#FFD700] focus:ring-[#FFD700] rounded mt-1 flex-shrink-0"
                            />
                        ) : (
                            // (الترتيب المعكوس)
                            <span className="text-sm font-bold text-gray-500 mt-1" title={`الترتيب: ${totalTasks - displayIndex} من ${totalTasks}`}>
                                {totalTasks - displayIndex}
                            </span>
                        )}
                        <h3 className="text-lg font-bold text-white mb-1 text-right flex-1 mx-2">{task.title}</h3>
                    </div>
                </div>

                {/* --- (الطلب 3): عرض التواريخ (إذا وجدت) --- */}
                {(task.start_at || task.end_at) && (
                    <div className="pt-2 pb-2 px-4 border-t border-gray-700/50 bg-gray-800/30 text-xs text-gray-400 grid grid-cols-2 gap-2" dir="rtl">
                        <div className="text-right">
                            <span className="font-semibold text-gray-500">يبدأ في:</span>
                            <span className="font-sans ml-1">{formatShortDate(task.start_at)}</span>
                        </div>
                        <div className="text-left">
                            <span className="font-semibold text-gray-500">ينتهي في:</span>
                            <span className="font-sans ml-1">{formatShortDate(task.end_at)}</span>
                        </div>
                    </div>
                )}

                {/* --- ✅ (الطلب 2): الصف الثاني - الأزرار والتاريخ --- */}
                <div className="pt-3 pb-3 px-4 border-t border-gray-700 bg-gray-900/20 rounded-b-xl flex justify-between items-center">

                    <div className="flex items-center gap-3">
                        {/* زر التفاصيل */}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="text-gray-400 hover:text-[#FFD700] transition-colors"
                            title="عرض التفاصيل والتعديل"
                        >
                            <EyeIcon className="w-5 h-5" />
                        </button>

                        {/* أيقونة الحالة */}
                        {task.status === 'منجز' ? (
                            <CheckCircleIcon className="w-5 h-5 text-green-500" title="منجز" />
                        ) : (
                            <ExclamationCircleIcon className="w-5 h-5 text-yellow-500" title="غير منجز" />
                        )}
                    </div>

                    {/* التاريخ (في الوسط) */}
                    <p className="text-xs text-gray-500 font-sans" title={formatMiddleDate(task.created_at)}>
                        {formatMiddleDate(task.created_at)}
                    </p>

                    <div className="flex items-center gap-3">
                        {/* زر الإخفاء / الاستعادة */}
                        <button
                            onClick={handleQuickHide}
                            className={`transition-colors ${task.is_hidden
                                ? 'text-blue-400 hover:text-blue-300'
                                : 'text-gray-500 hover:text-gray-400'
                                }`}
                            title={task.is_hidden ? "استعادة" : "إخفاء"}
                        >
                            {task.is_hidden ? <ArrowUturnUpIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                        </button>

                        {/* زر الحذف */}
                        <button
                            onClick={handleQuickDelete}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                            title="حذف السجل"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </motion.div>

            <TaskDetailsModal
                task={task}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                dialogHook={dialogHook}
                actionLoadingHook={actionLoadingHook}
                allServices={allServices}
                allUniversities={allUniversities}
                allCountries={allCountries}
                allPersons={allPersons}
            />
        </>
    );
};
// ====================================================================


const StatusTabs = ({ tasks, activeFilter, onFilterChange }: StatusTabsProps) => {
    const counts = useMemo(() => {
        return {
            all: tasks.length,
            done: tasks.filter(t => t.status === 'منجز').length,
            pending: tasks.filter(t => t.status === 'غير منجز').length,
        };
    }, [tasks]);

    const tabs: { label: string; filter: StatusFilter; count: number }[] = [
        { label: "الكل", filter: "all", count: counts.all },
        { label: "غير منجز", filter: "غير منجز", count: counts.pending },
        { label: "منجز", filter: "منجز", count: counts.done },
    ];

    return (
        <div className="flex items-center gap-2">
            {tabs.map(tab => (
                <button
                    key={tab.filter}
                    onClick={() => onFilterChange(tab.filter)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeFilter === tab.filter
                        ? 'bg-[#FFD700] text-black'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                        }`}
                >
                    {tab.label}
                    <span className={`mr-2 px-2 py-0.5 rounded-full text-xs ${activeFilter === tab.filter
                        ? 'bg-black/20'
                        : 'bg-gray-600/50'
                        }`}>
                        {tab.count}
                    </span>
                </button>
            ))}
        </div>
    );
};

export default function AhmedSaeedTasksRecords() {
    const { setPageLoading } = usePageLoading();
    const dialogHook = useDialog();
    const actionLoadingHook = useActionLoading();
    const { showActionLoading, hideActionLoading } = actionLoadingHook;

    const [showHidden, setShowHidden] = useState(false);

    // ✅ (الطلب 3): حالة لطي/توسيع الفلاتر
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const { allCountries, countriesLoading } = useAhmedSaeedCountries();
    const { allServices, servicesLoading } = useAhmedSaeedServices();
    const { allUniversities, universitiesLoading } = useAhmedSaeedUniversities();
    const { allPersons, personsLoading } = useAhmedSaeedPersons();

    const hiddenTasksQuery = useMemo(() =>
        query(collection(db, "AhmedSaeedTasks"), where("is_hidden", "==", true))
        , []);
    const [hiddenTasks] = useCollectionData(hiddenTasksQuery);
    const hiddenCount = hiddenTasks ? hiddenTasks.length : 0;

    const [filters, setFilters] = useState({
        services: [] as string[],
        universities: [] as string[],
        countries: [] as string[],
        responsiblePersons: [] as string[],
    });
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

    const tasksQuery = useMemo(() => {
        const collectionRef = collection(db, "AhmedSaeedTasks").withConverter(taskConverter);
        // ✅ تعديل: الفرز الآن حسب الرقم المتسلسل (إذا كان موجوداً) ثم تاريخ الإنشاء
        return query(collectionRef, orderBy("sequence_number", "desc"), orderBy("created_at", "desc"));
    }, []);

    const [tasks, tasksLoading, tasksError] = useCollectionData<AhmedSaeedTask>(tasksQuery);

    const sortedTasks = useMemo(() => {
        if (!tasks) return [];
        return tasks;
    }, [tasks]);

    useEffect(() => {
        setSelectedTaskIds([]);
    }, [showHidden]);

    const displayedTasks = useMemo(() => {
        return sortedTasks.filter(task => {

            const isTaskHidden = task.is_hidden === true;
            if (showHidden && !isTaskHidden) return false;
            if (!showHidden && isTaskHidden) return false;

            if (statusFilter !== 'all' && task.status !== statusFilter) {
                return false;
            }

            if (filters.services.length > 0) {
                const hasService = filters.services.every(serviceId => task.services_map && task.services_map[serviceId] === true);
                if (!hasService) return false;
            }
            if (filters.universities.length > 0) {
                const hasUniversity = filters.universities.every(uniId => task.universities_map && task.universities_map[uniId] === true);
                if (!hasUniversity) return false;
            }
            if (filters.countries.length > 0) {
                const hasCountry = filters.countries.every(countryId => task.countries_map && task.countries_map[countryId] === true);
                if (!hasCountry) return false;
            }
            if (filters.responsiblePersons.length > 0) {
                const hasPerson = filters.responsiblePersons.every(personId => task.responsible_persons_map && task.responsible_persons_map[personId] === true);
                if (!hasPerson) return false;
            }

            return true;
        });
    }, [sortedTasks, statusFilter, filters, showHidden]);

    useEffect(() => {
        const isLoading = countriesLoading || servicesLoading || universitiesLoading || personsLoading || tasksLoading;
        setPageLoading(isLoading);
    }, [countriesLoading, servicesLoading, universitiesLoading, personsLoading, tasksLoading, setPageLoading]);

    const onMultiSelectChange = (field: keyof typeof filters, values: string[]) => {
        setFilters(prev => ({ ...prev, [field]: values }));
    };

    const resetFilters = () => {
        setFilters({ services: [], universities: [], countries: [], responsiblePersons: [] });
        setStatusFilter("all");
    };

    const hasActiveFilters =
        filters.services.length > 0 ||
        filters.universities.length > 0 ||
        filters.countries.length > 0 ||
        filters.responsiblePersons.length > 0;

    const toggleTaskSelection = (id: string) => {
        setSelectedTaskIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleRestoreSelected = () => {
        if (selectedTaskIds.length === 0) return;

        dialogHook.showDialog({
            variant: 'confirm',
            title: `استعادة ${selectedTaskIds.length} سجلات`,
            message: "هل أنت متأكد من استعادة السجلات المحددة؟",
            onConfirm: async () => {
                showActionLoading("جاري استعادة السجلات...");
                try {
                    const batch = writeBatch(db);
                    selectedTaskIds.forEach(id => {
                        const taskRef = doc(db, "AhmedSaeedTasks", id);
                        batch.update(taskRef, { is_hidden: false });
                    });
                    await batch.commit();
                    setSelectedTaskIds([]);
                } catch (error: any) {
                    dialogHook.showDialog({ variant: 'alert', title: "خطأ", message: error.message });
                } finally {
                    hideActionLoading();
                }
            }
        });
    };

    const handleRestoreAll = () => {
        const hiddenIds = displayedTasks.map(t => t.id);
        if (hiddenIds.length === 0) return;

        dialogHook.showDialog({
            variant: 'confirm',
            title: `استعادة كل السجلات (${hiddenIds.length})`,
            message: "هل أنت متأكد من استعادة جميع السجلات المخفية؟",
            onConfirm: async () => {
                showActionLoading("جاري استعادة الكل...");
                try {
                    const batch = writeBatch(db);
                    hiddenIds.forEach(id => {
                        const taskRef = doc(db, "AhmedSaeedTasks", id);
                        batch.update(taskRef, { is_hidden: false });
                    });
                    await batch.commit();
                    setSelectedTaskIds([]);
                } catch (error: any) {
                    dialogHook.showDialog({ variant: 'alert', title: "خطأ", message: error.message });
                } finally {
                    hideActionLoading();
                }
            }
        });
    };

    return (
        <motion.div
            dir="rtl"
            variants={staggeredContainerVariants}
            initial="initial"
            animate="animate"
            className="space-y-6"
        >
            {/* --- ✅ (الطلب 3): قسم الفلاتر القابل للطي --- */}
            <motion.div variants={staggeredItemVariants} className="bg-gray-800/50 rounded-xl border border-gray-700">
                <div
                    className="flex flex-col sm:flex-row justify-between sm:items-center p-4 gap-4 cursor-pointer"
                    onClick={() => setIsFilterOpen(prev => !prev)}
                >
                    <h2 className="flex items-center gap-2 text-xl font-bold text-[#FFD700]">
                        <FunnelIcon className="w-6 h-6" />
                        فلترة السجلات
                        {hasActiveFilters && <InformationCircleIcon className="w-5 h-5 text-blue-400" title="يوجد فلترة نشطة" />}
                    </h2>

                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <motion.button
                                variants={fadeInVariants} initial="initial" animate="animate"
                                onClick={(e) => { e.stopPropagation(); resetFilters(); }}
                                className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5" />
                                إلغاء الفلاتر
                            </motion.button>
                        )}
                        <motion.div animate={{ rotate: isFilterOpen ? 180 : 0 }}>
                            <ChevronDownIcon className="w-6 h-6 text-gray-400" />
                        </motion.div>
                    </div>
                </div>

                {isFilterOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 pt-0 border-t border-gray-700/50">
                        <MultiSelectButton
                            label="الخدمات" Icon={Squares2X2Icon} options={allServices} selectedValues={filters.services}
                            onChange={(values: string[]) => onMultiSelectChange('services', values)}
                            collectionName="app_services" dialogHook={dialogHook} actionLoadingHook={actionLoadingHook}
                        />
                        <MultiSelectButton
                            label="الجامعات" Icon={AcademicCapIcon} options={allUniversities} selectedValues={filters.universities}
                            onChange={(values: string[]) => onMultiSelectChange('universities', values)}
                            collectionName="app_universities" dialogHook={dialogHook} actionLoadingHook={actionLoadingHook}
                        />
                        <MultiSelectButton
                            label="الدول" Icon={GlobeAltIcon} options={allCountries} selectedValues={filters.countries}
                            onChange={(values: string[]) => onMultiSelectChange('countries', values)}
                            collectionName="countries" readOnly={true} nameField="name_ar"
                            dialogHook={dialogHook} actionLoadingHook={actionLoadingHook}
                        />
                        <MultiSelectButton
                            label="الأشخاص المسؤولون" Icon={UserIcon} options={allPersons} selectedValues={filters.responsiblePersons}
                            onChange={(values: string[]) => onMultiSelectChange('responsiblePersons', values)}
                            collectionName="app_responsible_persons" dialogHook={dialogHook} actionLoadingHook={actionLoadingHook}
                        />
                    </div>
                )}
            </motion.div>

            <AnimatePresence>
                {showHidden && (
                    <motion.div
                        variants={fadeInVariants} initial="initial" animate="animate" exit="exit"
                        className="bg-blue-900/30 border border-blue-700 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-center gap-4"
                    >
                        <span className="text-sm font-semibold text-blue-300">أنت تعرض السجلات المخفية.</span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleRestoreAll}
                                disabled={displayedTasks.length === 0}
                                className="flex items-center gap-1.5 text-xs text-yellow-300 hover:text-yellow-200 disabled:text-gray-600 disabled:cursor-not-allowed"
                            >
                                <ArrowPathIcon className="w-4 h-4" />
                                <span>استعادة الكل ({displayedTasks.length})</span>
                            </button>
                            <button
                                onClick={handleRestoreSelected}
                                disabled={selectedTaskIds.length === 0}
                                className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                            >
                                <ChevronDoubleUpIcon className="w-4 h-4" />
                                <span>استعادة المحدد ({selectedTaskIds.length})</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- ✅ (الطلب 1 و 3): شريط الحالة والعنوان الجديد --- */}
            <motion.div variants={staggeredItemVariants} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">

                <h2 className="text-lg text-gray-200 font-semibold flex items-center gap-2">
                    <span>{showHidden ? "السجلات المخفية" : "السجلات النشطة"}</span>

                    {/* العدد الإجمالي (الذي يظهر قبل الفلترة) */}
                    <span className="text-lg font-bold text-white">
                        ({showHidden ? hiddenCount : (tasks ? tasks.filter(t => !t.is_hidden).length : 0)})
                    </span>

                    {/* أيقونة الفلتر (تظهر فقط إذا كانت الفلاتر نشطة) */}
                    {hasActiveFilters && (
                        <span className="flex items-center gap-1 text-blue-400" title="يتم عرض السجلات المفلترة فقط">
                            <InformationCircleIcon className="w-5 h-5" />
                            <span className="text-lg font-bold">({displayedTasks.length})</span>
                        </span>
                    )}
                </h2>

                {/* --- أزرار تبديل الحالة --- */}
                <div className="flex items-center gap-2 bg-gray-900/50 p-1 rounded-lg">
                    <button
                        onClick={() => setShowHidden(false)}
                        className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${!showHidden ? 'bg-yellow-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                            }`}
                    >
                        <EyeIcon className="w-5 h-5" />
                        <span>النشطة</span>
                    </button>
                    <button
                        onClick={() => setShowHidden(true)}
                        className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${showHidden ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                            }`}
                    >
                        <ArchiveBoxArrowDownIcon className="w-5 h-5" />
                        <span>المخفية ({hiddenCount})</span>
                    </button>
                </div>
            </motion.div>

            {/* --- شريط حالة الفلترة (منجز/غير منجز) --- */}
            <motion.div variants={staggeredItemVariants} className="flex justify-between items-center">
                <StatusTabs
                    tasks={displayedTasks}
                    activeFilter={statusFilter}
                    onFilterChange={setStatusFilter}
                />
            </motion.div>

            <motion.div
                variants={staggeredContainerVariants}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            >
                {!tasksLoading && displayedTasks && displayedTasks.length > 0 && (
                    // ✅ (الطلب الجديد): إضافة "index" إلى دالة map
                    displayedTasks.map((task, index) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            dialogHook={dialogHook}
                            actionLoadingHook={actionLoadingHook}
                            allServices={allServices}
                            allUniversities={allUniversities}
                            allCountries={allCountries}
                            allPersons={allPersons}
                            showHidden={showHidden}
                            isSelected={selectedTaskIds.includes(task.id)}
                            onToggleSelection={toggleTaskSelection}
                            // ✅ (الطلب الجديد): تمرير الفهرس والإجمالي
                            displayIndex={index}
                            totalTasks={displayedTasks.length}
                        />
                    ))
                )}
            </motion.div>

            <motion.div variants={staggeredItemVariants}>
                {tasksLoading && (
                    <div className="text-center p-10 text-gray-400">جاري تحميل السجلات...</div>
                )}
                {!tasksLoading && tasksError && (
                    <div className="text-center p-10 text-red-400">
                        <p>حدث خطأ أثناء جلب البيانات:</p>
                        <p className="text-xs text-red-500 mt-2" dir="ltr">{tasksError.message}</p>
                        <p className="mt-4 text-sm text-yellow-300">⚠️ **تذكير:** قد يتطلب الفرز (orderBy) فهرساً بسيطاً لـ `sequence_number` و `created_at`.</p>
                    </div>
                )}
                {!tasksLoading && !tasksError && (!displayedTasks || displayedTasks.length === 0) && (
                    <div className="text-center p-10 text-gray-500 bg-gray-800/50 rounded-xl border border-gray-700">
                        <NoSymbolIcon className="w-12 h-12 mx-auto mb-2" />
                        لا توجد سجلات تطابق شروط الفلترة الحالية.
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}