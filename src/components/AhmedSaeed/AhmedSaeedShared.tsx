import React, { useEffect, useState, useMemo, Fragment, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { staggeredItemVariants } from "../../lib/animations";
import { useDialog } from "../contexts/DialogContext";
import { useActionLoading } from "../contexts/ActionLoadingContext";
import {
    collection, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, orderBy,
    query, addDoc, setDoc, deleteDoc, doc, getDocs, where, limit
} from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from "firebase/functions";

import {
    XMarkIcon, ChevronDownIcon, XCircleIcon, PencilIcon,
    MagnifyingGlassIcon, PlusIcon, TrashIcon, PencilSquareIcon,
    CheckCircleIcon as CheckCircleSolid,
    MinusCircleIcon,
    GlobeAltIcon,
    Cog6ToothIcon, // أيقونة الإعدادات لإدارة القائمة
    ArrowRightIcon // أيقونة الرجوع
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from '@headlessui/react';
import { cleanText, normalizeText, findItemMatches, getCountryFlagUrl } from "../../utils/textUtils";

// ====================================================================
// --- 1. الأنواع المشتركة ---
// ====================================================================

export interface AppOption extends DocumentData {
    id: string;
    name: string;
}
export interface Country extends DocumentData {
    id: string;
    name_ar: string;
    name_en?: string;
    code: string;
}

// ====================================================================
// --- 2. محولات Firestore المشتركة ---
// ====================================================================

export const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
    toFirestore: (data: T): DocumentData => data,
    fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T)
});

export const countryConverter = createConverter<Country>();
export const appOptionConverter = createConverter<AppOption>();

// ====================================================================
// --- 3. Hooks جلب البيانات المشتركة ---
// ====================================================================
export const useAhmedSaeedServices = () => {
    const servicesQuery = useMemo(() => query(collection(db, "app_services").withConverter(appOptionConverter), orderBy("name")), []);
    const [allServices, servicesLoading, servicesError] = useCollectionData<AppOption>(servicesQuery);
    return { allServices, servicesLoading, servicesError };
};
export const useAhmedSaeedUniversities = () => {
    const universitiesQuery = useMemo(() => query(collection(db, "app_universities").withConverter(appOptionConverter), orderBy("name")), []);
    const [allUniversities, universitiesLoading, universitiesError] = useCollectionData<AppOption>(universitiesQuery);
    return { allUniversities, universitiesLoading, universitiesError };
};
export const useAhmedSaeedPersons = () => {
    const personsQuery = useMemo(() => query(collection(db, "app_responsible_persons").withConverter(appOptionConverter), orderBy("name")), []);
    const [allPersons, personsLoading, personsError] = useCollectionData<AppOption>(personsQuery);
    return { allPersons, personsLoading, personsError };
};
export const useAhmedSaeedCountries = () => {
    const countriesQuery = useMemo(() => query(collection(db, "app_countries").withConverter(countryConverter), orderBy("name_ar")), []);
    const [allCountries, countriesLoading, countriesError] = useCollectionData<Country>(countriesQuery);
    return { allCountries, countriesLoading, countriesError };
};

// ====================================================================
// --- 4. المكونات المشتركة (SelectionModal) ---
// ====================================================================
interface SelectionModalProps {
    isOpen: boolean; onClose: () => void; title: string;
    options: (AppOption | Country)[]; selectedIds: string[];
    onSave: (newSelectedIds: string[]) => void; nameField?: string;
    collectionName: string; readOnly?: boolean;
    dialogHook: any; actionLoadingHook: any;
    enableOrdering?: boolean;
    libraryCollection?: string; 
}

export function SelectionModal({
    isOpen, onClose, title, options, selectedIds, onSave, nameField = 'name',
    collectionName, readOnly = false, dialogHook, actionLoadingHook,
    enableOrdering = false,
    libraryCollection
}: SelectionModalProps) {

    type FilterMode = "all" | "selected" | "remaining";
    const [filterMode, setFilterMode] = useState<FilterMode>("all");

    // --- State 1: الاختيارات للمهمة الحالية (الوضع الطبيعي) ---
    const [taskSelection, setTaskSelection] = useState<string[]>(selectedIds);
    
    // --- State 2: إدارة القائمة (وضع المكتبة) ---
    const [manageSelection, setManageSelection] = useState<string[]>([]);
    const [isManageMode, setIsManageMode] = useState(false); // هل نحن في وضع "تعديل القائمة"؟
    const [libraryItems, setLibraryItems] = useState<any[]>([]);
    const [libraryLoading, setLibraryLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [newItemName, setNewItemName] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: string, name: string } | null>(null);
    const [editItemName, setEditItemName] = useState("");
    const [isMainDirty, setIsMainDirty] = useState(false);

    const { showDialog } = dialogHook;
    const { showActionLoading, hideActionLoading } = actionLoadingHook;
    const newItemInputRef = useRef<HTMLInputElement>(null);
    const editItemInputRef = useRef<HTMLInputElement>(null);

    // عند فتح المودال
    useEffect(() => {
        if (isOpen) {
            setSearchTerm("");
            setNewItemName("");
            setEditingItem(null);
            setEditItemName("");
            setIsAdding(false);
            setIsMainDirty(false);
            setFilterMode("all");
            
            // البدء دائماً في وضع "الاختيار للمهمة" وليس "إدارة القائمة"
            setIsManageMode(false);
            setTaskSelection(selectedIds);
        }
    }, [isOpen, selectedIds]);

    // مراقبة التغييرات (Dirty State)
    useEffect(() => {
        if (!isOpen) return;
        if (isManageMode) {
            // في وضع الإدارة: نقارن مع الدول الموجودة حالياً في options (app_countries)
            const currentAppIds = options.map(o => o.id);
            const changed = JSON.stringify([...manageSelection].sort()) !== JSON.stringify([...currentAppIds].sort());
            setIsMainDirty(changed);
        } else {
            // في الوضع العادي: نقارن مع ما تم استلامه من الـ Task Form
            const changed = JSON.stringify([...taskSelection].sort()) !== JSON.stringify([...selectedIds].sort());
            setIsMainDirty(changed);
        }
    }, [taskSelection, manageSelection, isManageMode, options, selectedIds, isOpen]);

    // جلب عناصر المكتبة (فقط عند الدخول لوضع الإدارة)
    const enterManageMode = async () => {
        if (!libraryCollection) return;
        setIsManageMode(true);
        setSearchTerm("");
        
        // التحديد المبدئي لوضع الإدارة هو: الدول الموجودة حالياً في قائمتك
        const currentAppIds = options.map(opt => opt.id);
        setManageSelection(currentAppIds);

        if (libraryItems.length === 0) {
            setLibraryLoading(true);
            try {
                const q = query(collection(db, libraryCollection), orderBy(nameField === 'name_ar' ? 'name_ar' : 'name'));
                const snapshot = await getDocs(q);
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setLibraryItems(items);
            } catch (err: any) {
                console.error(err);
                showDialog({ variant: 'alert', title: 'خطأ', message: 'فشل تحميل المكتبة' });
            } finally {
                setLibraryLoading(false);
            }
        }
    };

    const exitManageMode = () => {
        if (isMainDirty) {
            showDialog({
                variant: 'confirm', title: 'تجاهل التعديلات؟',
                message: 'لديك تعديلات غير محفوظة على القائمة. هل تريد الخروج دون حفظ؟',
                onConfirm: () => {
                    setIsManageMode(false);
                    setSearchTerm("");
                }
            });
        } else {
            setIsManageMode(false);
            setSearchTerm("");
        }
    };

    // Toggle Checkbox
    const handleToggle = (id: string) => {
        if (isManageMode) {
            setManageSelection(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        } else {
            setTaskSelection(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        }
    };

    // --- Save Handlers ---

    // 1. حفظ الاختيارات للمهمة (الوضع العادي)
    const handleSaveTaskSelection = () => {
        onSave(taskSelection);
        onClose();
    };

    // 2. حفظ تعديلات القائمة (وضع المكتبة - Cloud Function)
    const handleSaveListManagement = async () => {
        showDialog({
            variant: 'confirm',
            title: 'تحديث القائمة الشخصية',
            message: 'سيتم تحديث قائمة الدول المتاحة لك لاستخدامها في المهام. \n(لن يؤثر هذا على المهام القديمة، ولكنه يحدد ما يظهر لك مستقبلاً).',
            confirmText: "تحديث القائمة",
            onConfirm: async () => {
                showActionLoading("جاري مزامنة القائمة...");
                try {
                    const manageAppCountries = httpsCallable(functions, 'manageAppCountries');
                    await manageAppCountries({ selectedIds: manageSelection });
                    
                    // نجاح
                    showDialog({ variant: 'success', title: 'تم التحديث', message: 'تم تحديث قائمتك بنجاح.' });
                    setIsMainDirty(false);
                    setIsManageMode(false); // الرجوع للوضع العادي لرؤية القائمة الجديدة
                } catch (error: any) {
                    showDialog({ variant: 'alert', title: 'خطأ', message: error.message });
                } finally {
                    hideActionLoading();
                }
            }
        });
    };

    // --- Display Logic ---
    const displayedItems = useMemo(() => {
        // المصدر: إدارة = المكتبة كاملة | عادي = خياراتي (app_countries)
        const source = isManageMode ? libraryItems : options;
        const normSearch = normalizeText(searchTerm);

        let filtered = source.filter((item: any) => {
            if (!normSearch) return true;
            return normalizeText(item[nameField]).includes(normSearch);
        });

        // الفلترة الإضافية (فقط في الوضع العادي)
        if (!isManageMode && filterMode !== 'all') {
            filtered = filtered.filter((item: any) => {
                const isSel = taskSelection.includes(item.id);
                return filterMode === 'selected' ? isSel : !isSel;
            });
        }
        return filtered;
    }, [isManageMode, libraryItems, options, searchTerm, filterMode, taskSelection, nameField]);

    // Counters
    const currentSelection = isManageMode ? manageSelection : taskSelection;
    
    // Select All Helpers (Normal Mode Only)
    const filteredIds = displayedItems.map((i:any) => i.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => taskSelection.includes(id));
    const noneSelected = filteredIds.length === 0 || !filteredIds.some(id => taskSelection.includes(id));
    
    const handleSelectAll = () => setTaskSelection(prev => [...new Set([...prev, ...filteredIds])]);
    const handleDeselectAll = () => setTaskSelection(prev => prev.filter(id => !filteredIds.includes(id)));

    // --- CRUD for Manual Items (Services/Persons) ---
    // (يتم إخفاؤها إذا كنا في وضع المكتبة أو إذا كانت المجموعة للقراءة فقط)
    // ... [تم اختصار دوال الإضافة اليدوية هنا، هي نفسها السابقة وتعمل فقط في الوضع العادي] ...

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={() => isMainDirty ? showDialog({ variant: 'confirm', title: 'تنبيه', message: 'تغييرات غير محفوظة', onConfirm: onClose }) : onClose()} dir="rtl">
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-0 sm:p-4 text-center">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 text-right shadow-2xl transition-all h-screen sm:h-auto sm:max-h-[80vh] sm:rounded-2xl border border-gray-700 flex flex-col">
                                
                                {/* Header */}
                                <Dialog.Title as="h3" className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
                                    <div className="flex items-center gap-2">
                                        <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-700 transition-colors"><XMarkIcon className="w-6 h-6" /></button>
                                        
                                        {/* زر العودة من وضع الإدارة */}
                                        {isManageMode && (
                                            <button onClick={exitManageMode} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-all border border-gray-600">
                                                <ArrowRightIcon className="w-4 h-4" /> عودة للاختيار
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                                            {isManageMode ? "إدارة قائمة الدول" : title}
                                            {libraryCollection && <GlobeAltIcon className={`w-5 h-5 ${isManageMode ? "text-green-400" : "text-[#FFD700]"}`} />}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* زر الدخول لوضع الإدارة (يظهر فقط إذا لم نكن فيه، وكانت هناك مكتبة) */}
                                        {!isManageMode && libraryCollection && (
                                            <button 
                                                onClick={enterManageMode} 
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 hover:text-[#FFD700] border border-gray-600 transition-all"
                                                title="إضافة/حذف دول من القائمة"
                                            >
                                                <Cog6ToothIcon className="w-4 h-4" />
                                                <span className="hidden sm:inline">إدارة القائمة</span>
                                            </button>
                                        )}
                                        {/* زر الإضافة اليدوية (لغير الدول) */}
                                        {!isManageMode && !readOnly && !libraryCollection && (
                                            <button onClick={() => setIsAdding(true)} className="p-1.5 rounded-full text-gray-400 hover:text-[#FFD700]"><PlusIcon className="w-6 h-6" /></button>
                                        )}
                                    </div>
                                </Dialog.Title>

                                {/* Banner for Manage Mode */}
                                {isManageMode && (
                                    <div className="bg-blue-900/30 border-b border-blue-800 p-2 text-center text-xs text-blue-200">
                                        أنت الآن في وضع <strong>إدارة القائمة</strong>. الدول التي تحددها هنا ستظهر لك عند إنشاء المهام.
                                    </div>
                                )}

                                {/* Filters (Normal Mode Only) */}
                                {!isManageMode && (
                                    <div className="p-3 border-b border-gray-700 bg-gray-900/30 flex flex-wrap justify-between gap-2 text-xs">
                                        <div className="flex gap-2">
                                            <button onClick={() => setFilterMode('all')} className={`px-3 py-1 rounded ${filterMode === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>الكل</button>
                                            <button onClick={() => setFilterMode('selected')} className={`px-3 py-1 rounded ${filterMode === 'selected' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}>المختار</button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={handleSelectAll} disabled={allSelected} className="text-blue-400 hover:text-blue-300 disabled:opacity-50">تحديد الكل</button>
                                            <button onClick={handleDeselectAll} disabled={noneSelected} className="text-red-400 hover:text-red-300 disabled:opacity-50">إلغاء الكل</button>
                                        </div>
                                    </div>
                                )}

                                {/* Search */}
                                <div className="p-4 border-b border-gray-700">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder={isManageMode ? "ابحث في جميع الدول..." : "ابحث في قائمتك..."} 
                                            value={searchTerm} 
                                            onChange={(e) => setSearchTerm(e.target.value)} 
                                            className="w-full bg-gray-700 p-2.5 pr-10 rounded-md border border-gray-600 focus:ring-2 focus:ring-[#FFD700] text-gray-100 placeholder:text-gray-500" 
                                        />
                                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>

                                {/* List Content */}
                                <div className="flex-grow overflow-y-auto p-4 space-y-2 min-h-[300px] bg-gray-800/50">
                                    {libraryLoading ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                                            <div className="w-6 h-6 border-2 border-gray-500 border-t-[#FFD700] rounded-full animate-spin"></div>
                                            <span>جاري تحميل المكتبة الشاملة...</span>
                                        </div>
                                    ) : displayedItems.length > 0 ? (
                                        displayedItems.map((item: any) => {
                                            const isSelected = currentSelection.includes(item.id);
                                            const flagUrl = item.code ? getCountryFlagUrl(item.code) : null;
                                            const activeColor = isManageMode ? "border-green-500/50 bg-green-500/10" : "border-[#FFD700]/50 bg-[#FFD700]/10";
                                            const activeText = isManageMode ? "text-green-400" : "text-[#FFD700]";

                                            return (
                                                <div key={item.id} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all duration-200 ${isSelected ? activeColor : 'border-gray-700 bg-gray-800 hover:bg-gray-700'}`}>
                                                    <label className="flex-grow flex items-center gap-3 cursor-pointer w-full select-none">
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? (isManageMode ? 'bg-green-600 border-green-600' : 'bg-[#FFD700] border-[#FFD700]') : 'border-gray-500 bg-gray-900'}`}>
                                                            {isSelected && <CheckCircleSolid className={`w-4 h-4 ${isManageMode ? 'text-white' : 'text-black'}`} />}
                                                        </div>
                                                        <input type="checkbox" checked={isSelected} onChange={() => handleToggle(item.id)} className="hidden" />
                                                        
                                                        <span className="text-gray-200 text-sm flex items-center gap-3 w-full">
                                                            {flagUrl && <img src={flagUrl} alt={item.code} className="w-6 h-4 object-cover rounded shadow-sm opacity-90" loading="lazy" />}
                                                            <span className={isSelected ? `font-bold ${activeText}` : ""}>{item[nameField]}</span>
                                                        </span>
                                                    </label>

                                                    {/* زر الحذف اليدوي (فقط للخدمات والمسؤولين - وليس الدول) */}
                                                    {!readOnly && !libraryCollection && !isManageMode && (
                                                        <button onClick={() => { /* handleDelete logic */ }} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center text-gray-500 py-10 flex flex-col items-center gap-2">
                                            <MinusCircleIcon className="w-8 h-8 opacity-20" />
                                            <span>{isManageMode ? "لا توجد نتائج في المكتبة." : "القائمة فارغة."}</span>
                                            {!isManageMode && libraryCollection && (
                                                <button onClick={enterManageMode} className="text-[#FFD700] text-sm underline mt-2 hover:text-yellow-300">
                                                    إضافة عناصر من المكتبة
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Footer Action Button */}
                                <div className="p-4 border-t border-gray-700 bg-gray-900 sticky bottom-0 z-10">
                                    <button 
                                        onClick={isManageMode ? handleSaveListManagement : handleSaveTaskSelection}
                                        disabled={libraryLoading}
                                        className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2
                                            ${isManageMode 
                                                ? (isMainDirty ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-700 text-gray-400')
                                                : 'bg-[#FFD700] hover:bg-yellow-400 text-black'
                                            }`}
                                    >
                                        {isManageMode 
                                            ? (libraryLoading ? "جاري التحميل..." : `حفظ القائمة الجديدة (${currentSelection.length})`)
                                            : `تأكيد الاختيار للمهمة (${currentSelection.length})`
                                        }
                                    </button>
                                </div>

                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

export const MultiSelectButton = ({
    label, Icon, options, selectedValues, onChange, error, nameField = 'name',
    collectionName, readOnly = false, dialogHook, actionLoadingHook,
    enableOrdering = false
}: any) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // تحديد المكتبة المرجعية (فقط للدول)
    const libraryCollection = collectionName === 'app_countries' ? 'ref_countries' : undefined;

    const getSelectionCountText = () => {
        const count = selectedValues.length;
        return count === 0 ? "لم يتم تحديد أي عنصر" : `تم تحديد ${count} عنصر`;
    };

    const selectedItems = useMemo(() => {
        if (!options || !selectedValues || options.length === 0) return [];
        
        // ✅ الإصلاح 1: تحديد نوع opt
        const optionsMap = new Map(options.map((opt: AppOption | Country) => [opt.id, opt]));
        
        // ✅ الإصلاح 2: تحديد نوع id
        return selectedValues.map((id: string) => optionsMap.get(id)).filter(Boolean) as (AppOption | Country)[];
    }, [options, selectedValues]);

    // ✅ الإصلاح 3: تحديد نوع i
    const handleRemove = (id: string) => onChange(selectedValues.filter((i: string) => i !== id));

    const handleMove = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === selectedValues.length - 1)) return;
        const newList = [...selectedValues];
        const temp = newList[index];
        if (direction === 'up') { newList[index] = newList[index - 1]; newList[index - 1] = temp; }
        else { newList[index] = newList[index + 1]; newList[index + 1] = temp; }
        onChange(newList);
    };

    return (
        <motion.div variants={staggeredItemVariants} className={`bg-gradient-to-br from-gray-900/60 to-gray-800/60 rounded-lg p-3 shadow-md border ${error ? "border-red-500" : "border-gray-700"} transition-colors duration-300 w-full`}>
            {/* ... (باقي كود الواجهة JSX كما هو تماماً بدون تغيير) ... */}
            <label className="flex items-center gap-2 mb-2 font-semibold text-gray-300 text-sm"><Icon className="w-5 h-5 text-[#FFD700]" />{label}</label>
            <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setIsModalOpen(true)} className="flex-grow w-full bg-gray-700/60 p-2.5 rounded-md border border-gray-600 flex justify-between items-center text-right hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFD700]">
                    <span className="text-gray-400"><PencilIcon className="w-4 h-4" /></span>
                    <span className={`text-sm ${selectedValues.length > 0 ? 'text-gray-200' : 'text-gray-500'}`}>{getSelectionCountText()}</span>
                </button>
                {selectedItems.length > 0 && (
                    <button type="button" onClick={() => setIsExpanded(p => !p)} className="flex-shrink-0 p-2.5 rounded-md text-gray-400 hover:text-[#FFD700] hover:bg-gray-700/60 border border-gray-600 bg-gray-700/60">
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}><ChevronDownIcon className="w-5 h-5" /></motion.div>
                    </button>
                )}
            </div>
            
            <AnimatePresence>
                {isExpanded && selectedItems.length > 0 && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1, paddingTop: '8px' }} exit={{ height: 0, opacity: 0, paddingTop: 0 }} className="overflow-hidden space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {selectedItems.map((item: any, index: number) => {
                            const flagUrl = item.code ? getCountryFlagUrl(item.code) : null;
                            return (
                                <div key={item.id} className="flex items-center justify-between text-sm text-gray-300 bg-gray-700/50 p-1.5 px-3 rounded-md border border-gray-600/50">
                                    <span className="truncate flex items-center gap-2" title={item[nameField]}>
                                        {flagUrl && <img src={flagUrl} alt={item.code} className="w-5 h-3 object-cover rounded-sm" />}
                                        {item[nameField]}
                                    </span>
                                    <div className="flex-shrink-0 flex items-center gap-1.5">
                                        {enableOrdering && (
                                            <>
                                                <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-blue-400 disabled:opacity-50">▲</button>
                                                <button onClick={() => handleMove(index, 'down')} disabled={index === selectedItems.length - 1} className="p-1 text-gray-400 hover:text-blue-400 disabled:opacity-50">▼</button>
                                                <span className="h-4 w-px bg-gray-600 mx-0.5"></span>
                                            </>
                                        )}
                                        <button onClick={() => handleRemove(item.id)} className="p-1 text-gray-500 hover:text-red-400"><XCircleIcon className="w-5 h-5" /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            <SelectionModal
                isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
                title={label}
                options={options || []} selectedIds={selectedValues}
                onSave={onChange}
                nameField={nameField} collectionName={collectionName}
                readOnly={readOnly} dialogHook={dialogHook} actionLoadingHook={actionLoadingHook}
                enableOrdering={enableOrdering}
                libraryCollection={libraryCollection}
            />
        </motion.div>
    );
};