// src/components/Permission/Delegation/Control/ControlUserScopes.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, User } from '../../../contexts/UserContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useActionLoading } from '../../../contexts/ActionLoadingContext';
import { useDialog } from '../../../contexts/DialogContext';
import { useUnsavedChanges } from "../../../contexts/UnsavedChangesContext";
import { useAccessManager, ScopePayload } from '../../../../hooks/useAccessManager';
import { ScopeRuleBuilder } from '../Shared/ScopeRuleBuilder';
import { ScopeList } from '../Shared/ScopeList';
import { motion, AnimatePresence } from 'framer-motion';
import { directionalSlideVariants } from '../../../../lib/animations';
import { 
    MagnifyingGlassIcon, UserIcon, ShieldCheckIcon, CheckCircleIcon, 
    ArrowPathIcon, FunnelIcon
} from "@heroicons/react/24/outline";
import { getFirestore, collection, getDocs, onSnapshot, query, where } from "firebase/firestore";

const firestore = getFirestore();

interface BasicEntity { id: string; name_ar: string; name_en: string; [key: string]: unknown; }

const translations = {
    ar: {
        pageTitle: "نظام تفويض التحكم (استثناءات المستخدمين)",
        pageDesc: "منح مستخدم محدد صلاحية 'التحكم' في نطاقات (شركات/إدارات) إضافية.",
        selectUserTitle: "اختر المستخدم",
        searchPlaceholder: "ابحث عن مستخدم...",
        noUsersFound: "لا يوجد مستخدمين متاحين في نطاق تحكمك.",
        save: "حفظ الاستثناءات",
        saving: "جاري الحفظ...",
        successTitle: "تم بنجاح",
        successMessage: "تم تحديث نطاق تحكم المستخدم.",
        errorTitle: "خطأ",
        errorMessage: "حدث خطأ أثناء الحفظ.",
        confirmSave: "هل أنت متأكد من حفظ القواعد؟",
        changeUser: "تغيير المستخدم",
        loadingData: "جاري تحميل البيانات...",
        currentRules: "قواعد الاستثناء الحالية",
        conflictTitle: "تحديث خارجي",
        conflictMessage: "تم تعديل القواعد من مصدر آخر. هل تريد تحميل الجديد؟",
        loadNew: "تحميل الجديد",
        ignore: "تجاهل"
    },
    en: {
        pageTitle: "Control Delegation (User Exceptions)",
        pageDesc: "Grant a specific user 'Control' over additional scopes (Companies/Departments).",
        selectUserTitle: "Select User",
        searchPlaceholder: "Search user...",
        noUsersFound: "No users found in your control scope.",
        save: "Save Exceptions",
        saving: "Saving...",
        successTitle: "Success",
        successMessage: "User control scope updated.",
        errorTitle: "Error",
        errorMessage: "Error saving changes.",
        confirmSave: "Save rules?",
        changeUser: "Change User",
        loadingData: "Loading data...",
        currentRules: "Current Exception Rules",
        conflictTitle: "External Update",
        conflictMessage: "Data updated externally. Load new data?",
        loadNew: "Load New",
        ignore: "Ignore"
    }
};

const UserCard = ({ user, onClick, language }: { user: User; onClick: () => void; language: string }) => (
    <motion.div 
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClick}
        className="bg-gray-800/50 border border-gray-700 hover:border-red-500/50 rounded-xl p-4 cursor-pointer transition-all group"
    >
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 group-hover:text-red-400 transition-colors overflow-hidden border border-gray-600">
                {user.avatar_url ? <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6" />}
            </div>
            <div>
                <h3 className="font-bold text-gray-100">{language === 'ar' ? user.name_ar : user.name_en}</h3>
                <p className="text-xs text-gray-500">{language === 'ar' ? user.job?.name_ar : user.job?.name_en}</p>
                <p className="text-[10px] text-gray-600 mt-1">{language === 'ar' ? user.company?.name_ar : user.company?.name_en}</p>
            </div>
        </div>
    </motion.div>
);

export default function ControlUserScopes() {
    const { language } = useLanguage();
    const t = translations[language as keyof typeof translations];
    
    const { canManageScope } = useAuth();
    const { updateUserControlScope } = useAccessManager(); // ✅ استخدام دالة التحكم
    
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const { setIsDirty } = useUnsavedChanges();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [searchParams, setSearchParams] = useSearchParams();

    // --- Data State ---
    const [users, setUsers] = useState<User[]>([]);
    const [jobs, setJobs] = useState<BasicEntity[]>([]); 
    const [companies, setCompanies] = useState<BasicEntity[]>([]);
    const [sectors, setSectors] = useState<BasicEntity[]>([]);
    const [departments, setDepartments] = useState<BasicEntity[]>([]);
    const [sections, setSections] = useState<BasicEntity[]>([]); // ✅ إضافة حالة الأقسام

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserObj, setSelectedUserObj] = useState<User | null>(null);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    
    // --- Rules State ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [existingRules, setExistingRules] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [localRules, setLocalRules] = useState<any[]>([]);

    const [isLoadingData, setIsLoadingData] = useState(true);

    // 1. Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                const unsubUsers = onSnapshot(collection(firestore, 'users'), (snap) => {
                    const usersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
                    const allowedUsers = usersData.filter(u => 
                        canManageScope('control', { userId: u.id, companyId: u.company_id as string, jobId: String(u.job_id) })
                    );
                    setUsers(allowedUsers);
                });

                const [jobsSnap, companiesSnap, sectorsSnap, deptsSnap, sectionsSnap] = await Promise.all([
                    getDocs(collection(firestore, 'jobs')),
                    getDocs(query(collection(firestore, 'companies'), where('is_allowed', '==', true))),
                    getDocs(collection(firestore, 'sectors')),
                    getDocs(collection(firestore, 'departments')),
                    getDocs(collection(firestore, 'sections')) // ✅ جلب الأقسام
                ]);

                setJobs(jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BasicEntity)));
                setCompanies(companiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as BasicEntity)));
                setSectors(sectorsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BasicEntity)));
                setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BasicEntity)));
                setSections(sectionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BasicEntity))); // ✅ تخزين الأقسام

                setIsLoadingData(false);
                return () => unsubUsers();
            } catch (error) {
                console.error("Error fetching data:", error);
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, [canManageScope]);

    // --- Dirty State Tracking ---
    const hasChanges = useMemo(() => {
        return JSON.stringify(localRules) !== JSON.stringify(existingRules);
    }, [localRules, existingRules]);

    useEffect(() => setIsDirty(hasChanges), [hasChanges, setIsDirty]);

    const isDirtyRef = useRef(hasChanges);
    useEffect(() => { isDirtyRef.current = hasChanges; }, [hasChanges]);

    // 2. Listen to Rules
    useEffect(() => {
        if (!selectedUserId) return;

        // ✅ الاستماع لجدول control_user_scopes
        const q = query(collection(firestore, 'control_user_scopes'), where('user_id', '==', selectedUserId));
        
        const unsub = onSnapshot(q, (snap) => {
            if (snap.metadata.hasPendingWrites) return;

            const rules = snap.docs.map(doc => ({
                docId: doc.id,
                ...doc.data()
            }));

            if (isDirtyRef.current) {
                const currentContent = JSON.stringify(rules);
                const oldContent = JSON.stringify(existingRules);

                if (currentContent !== oldContent) {
                    showDialog({
                        variant: 'alert',
                        title: t.conflictTitle,
                        message: t.conflictMessage,
                        confirmText: t.loadNew,
                        cancelText: t.ignore,
                        onConfirm: () => {
                            setExistingRules(rules);
                            setLocalRules(rules);
                        }
                    });
                }
            } else {
                setExistingRules(rules);
                setLocalRules(rules);
                setIsDirty(false);
            }
        });

        return () => unsub();
    }, [selectedUserId, setIsDirty, t, existingRules, showDialog]);

    // --- Handlers ---

    const loadUser = (user: User) => {
        setSelectedUserId(user.id);
        setSelectedUserObj(user);
        setSearchParams({ userId: user.id });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAddRule = (newRule: any) => {
        setLocalRules(prev => [...prev, { ...newRule, isNew: true }]);
    };

    const handleRemoveRule = (index: number) => {
        setLocalRules(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!selectedUserId || !hasChanges) return;

        showActionLoading(t.saving);
        try {
            const rulesToDelete = existingRules.filter(ex => !localRules.some(loc => loc.docId === ex.docId));
            const rulesToAdd = localRules.filter(loc => !loc.docId);

            // ✅ استخدام updateUserControlScope
            const deletePromises = rulesToDelete.map(rule => 
                updateUserControlScope(selectedUserId, {}, 'remove', rule.docId)
            );

            const addPromises = rulesToAdd.map(rule => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { isNew, docId, ...cleanRule } = rule;
                const payload: ScopePayload = cleanRule;
                return updateUserControlScope(selectedUserId, payload, 'add');
            });

            await Promise.all([...deletePromises, ...addPromises]);

            showDialog({ variant: 'success', title: t.successTitle, message: t.successMessage });
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            showDialog({ variant: 'alert', title: t.errorTitle, message: (error as any).message || t.errorMessage });
        } finally {
            hideActionLoading();
        }
    };

    const filteredUsers = users.filter(u => (u.name_ar?.includes(userSearchTerm) || u.name_en?.includes(userSearchTerm)));

    if (isLoadingData) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loadingData}</div>;

    return (
        <div className="w-full flex flex-col min-h-screen">
            <AnimatePresence mode="wait">
                {!selectedUserId ? (
                    <motion.div key="select" variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-6 text-red-400"><ShieldCheckIcon className="w-6 h-6" /><h2 className="text-xl font-bold">{t.selectUserTitle}</h2></div>
                            <div className="relative mb-6"><input type="text" placeholder={t.searchPlaceholder} value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg py-3 px-4 pl-10 focus:border-red-500 transition-colors text-white" /><MagnifyingGlassIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" /></div>
                            {filteredUsers.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredUsers.map(u => <UserCard key={u.id} user={u} language={language as any} onClick={() => loadUser(u)} />)}</div>
                            ) : <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-700 rounded-xl"><p>{t.noUsersFound}</p></div>}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="editor" variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6 flex justify-between items-center shadow-lg">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] overflow-hidden">
                                    {selectedUserObj?.avatar_url ? <img src={selectedUserObj.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 text-gray-100" />}
                                </div>
                                <div><h2 className="text-lg font-bold text-white">{language === 'ar' ? selectedUserObj?.name_ar : selectedUserObj?.name_en}</h2><p className="text-xs text-red-400 font-medium">{t.pageTitle}</p></div>
                            </div>
                            <button onClick={() => { setSelectedUserId(null); setIsDirty(false); setSearchParams({}); }} className="text-sm text-gray-400 hover:text-white hover:bg-gray-700 px-3 py-2 rounded-lg transition-all flex items-center gap-2"><ArrowPathIcon className="w-4 h-4" /> {t.changeUser}</button>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="xl:col-span-3 space-y-6">
                                {/* ✅ تمرير الأقسام إلى ScopeRuleBuilder و ScopeList */}
                                <ScopeRuleBuilder 
                                    jobs={jobs} 
                                    companies={companies} 
                                    sectors={sectors} 
                                    departments={departments} 
                                    sections={sections} // ✅
                                    onAddRule={handleAddRule} 
                                    t={t} 
                                />
                                <div className="flex items-center gap-3 my-4"><div className="h-px bg-gray-700 flex-1"></div><span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><FunnelIcon className="w-3 h-3" /> {t.currentRules}</span><div className="h-px bg-gray-700 flex-1"></div></div>
                                <ScopeList rules={localRules} onRemove={handleRemoveRule} jobs={jobs} companies={companies} sectors={sectors} departments={departments} sections={sections} t={t} />
                            </div>
                        </div>
                        
                        <div className="flex justify-center pb-10 mt-12">
                            <button disabled={!hasChanges} onClick={() => showDialog({ variant: 'confirm', title: t.confirmSave, message: t.confirmSave, onConfirm: handleSave })} className={`w-full max-w-md font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all ${hasChanges ? 'bg-red-500 text-white hover:scale-105 hover:bg-red-600' : 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'}`}>
                                <CheckCircleIcon className="w-6 h-6" /> {t.save}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}