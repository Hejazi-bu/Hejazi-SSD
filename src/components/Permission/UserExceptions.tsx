// src/components/Permission/UserExceptions.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, User } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useActionLoading } from '../contexts/ActionLoadingContext';
import { useDialog } from '../contexts/DialogContext';
import { useUnsavedChanges } from "../contexts/UnsavedChangesContext";
import { useAccessManager } from '../../hooks/useAccessManager';
import { ServiceTreeRow, ServiceNode } from './Delegation/Shared/DelegationTree';

import { motion, AnimatePresence } from 'framer-motion';
import { directionalSlideVariants, staggeredContainerVariants } from '../../lib/animations';
import { MagnifyingGlassIcon, UserIcon, ShieldCheckIcon, CheckCircleIcon, ArrowPathIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { getFirestore, collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
// ✅ إضافة استيراد الدوال السحابية
import { getFunctions, httpsCallable } from "firebase/functions";

const firestore = getFirestore();
const functions = getFunctions();

const translations = {
    ar: {
        pageTitle: "إدارة صلاحيات المستخدمين (الاستثناءات)",
        selectUserTitle: "اختيار المستخدم",
        searchPlaceholder: "ابحث عن مستخدم...",
        filterTreePlaceholder: "بحث داخل الخدمات...",
        noUsersFound: "لم يتم العثور على مستخدمين ضمن نطاق إدارتك.",
        save: "حفظ الاستثناءات",
        saving: "جاري الحفظ...",
        successTitle: "تم بنجاح",
        successMessage: "تم تحديث استثناءات المستخدم.",
        errorTitle: "خطأ",
        errorMessage: "حدث خطأ أثناء الحفظ.",
        confirmSave: "هل أنت متأكد من حفظ التغييرات؟",
        changeUser: "تغيير المستخدم",
        levelService: "خدمة", levelPage: "صفحة", levelAction: "إجراء",
        loadingUsers: "جاري جلب قائمة الموظفين...",
        conflictTitle: "تحديث خارجي",
        conflictMessage: "قام مستخدم آخر بتعديل استثناءات هذا المستخدم. هل تريد تحميل البيانات الجديدة (ستفقد تعديلاتك)؟",
        loadNew: "تحميل الجديد",
        ignore: "تجاهل"
    },
    en: {
        pageTitle: "Manage User Permissions (Exceptions)",
        selectUserTitle: "Select User",
        searchPlaceholder: "Search user...",
        filterTreePlaceholder: "Search services...",
        noUsersFound: "No users found in your scope.",
        save: "Save Exceptions",
        saving: "Saving...",
        successTitle: "Success",
        successMessage: "User exceptions updated.",
        errorTitle: "Error",
        errorMessage: "Error saving changes.",
        confirmSave: "Save changes?",
        changeUser: "Change User",
        levelService: "Service", levelPage: "Page", levelAction: "Action",
        loadingUsers: "Fetching users...",
        conflictTitle: "External Update",
        conflictMessage: "Another user updated these exceptions. Load new data (you will lose current changes)?",
        loadNew: "Load New",
        ignore: "Ignore"
    }
};

const UserCard = ({ user, onClick, language }: any) => (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClick} className="bg-gray-800/50 border border-gray-700 hover:border-[#FFD700]/50 rounded-xl p-4 cursor-pointer transition-all group">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 group-hover:text-[#FFD700] transition-colors overflow-hidden border border-gray-600">
                {user.avatar_url ? <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6" />}
            </div>
            <div>
                <h3 className="font-bold text-gray-100">{language === 'ar' ? user.name_ar : user.name_en}</h3>
                <p className="text-xs text-gray-500">{language === 'ar' ? user.job?.name_ar : user.job?.name_en}</p>
            </div>
        </div>
    </motion.div>
);

export default function UserExceptions() {
    const { language } = useLanguage();
    const t = translations[language as keyof typeof translations];
    const { canManageScope, canGrantResource } = useAuth();
    const { updateUserPermissions } = useAccessManager(); 
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const { setIsDirty } = useUnsavedChanges();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [searchParams, setSearchParams] = useSearchParams();

    const [users, setUsers] = useState<User[]>([]);
    const [servicesTree, setServicesTree] = useState<ServiceNode[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserObj, setSelectedUserObj] = useState<User | null>(null);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [treeSearchTerm, setTreeSearchTerm] = useState('');

    const [jobPermissions, setJobPermissions] = useState<Set<string>>(new Set());
    const [userPermissions, setUserPermissions] = useState<Map<string, boolean | undefined>>(new Map());
    const [initialUserPermissions, setInitialUserPermissions] = useState<Map<string, boolean | undefined>>(new Map());

    const [isUsersLoading, setIsUsersLoading] = useState(true);

    // 1. Fetch Data (Users via Cloud Function + Services)
    useEffect(() => {
        const fetchData = async () => {
            setIsUsersLoading(true);
            try {
                // ✅ استخدام الدالة السحابية لجلب المستخدمين بدلاً من Collection
                const getUsersFn = httpsCallable(functions, 'getMyManagedUsers');
                const result = await getUsersFn();
                const usersData = result.data as User[];
                setUsers(usersData);

                const [servicesSnap, subServicesSnap, subSubServicesSnap] = await Promise.all([
                    getDocs(collection(firestore, 'services')),
                    getDocs(collection(firestore, 'sub_services')),
                    getDocs(collection(firestore, 'sub_sub_services'))
                ]);
                const labelField = language === 'ar' ? 'label_ar' : 'label_en';
                const rawServices = servicesSnap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id }));
                const rawSubs = subServicesSnap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id }));
                const rawSubSubs = subSubServicesSnap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id }));

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tree = rawServices.map((s: any) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const pages = rawSubs.filter((ss: any) => String(ss.service_id) === String(s.id)).map((ss: any) => ({
                        id: `ss:${ss.id}`, label: ss[labelField], parentId: `s:${s.id}`, type: 'page', children: []
                    }));
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const actions = rawSubSubs.filter((sss: any) => String(sss.service_id) === String(s.id)).map((sss: any) => ({
                        id: `sss:${sss.id}`, label: sss[labelField], parentId: `s:${s.id}`, type: 'action', children: []
                    }));
                    return {
                        id: `s:${s.id}`, label: s[labelField], type: 'service',
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        children: [...pages, ...actions].sort((a: any, b: any) => a.type === 'page' ? -1 : 1)
                    };
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }).sort((a: any, b: any) => a.id.toString().localeCompare(b.id.toString(), undefined, { numeric: true })) as ServiceNode[];

                setServicesTree(tree);
            } catch (error) { 
                console.error("Error fetching users:", error); 
                showDialog({ title: t.errorTitle, message: "فشل في تحميل قائمة الموظفين.", variant: 'error' });
            } finally {
                setIsUsersLoading(false);
            }
        };
        fetchData();
    }, [language, t.errorTitle, showDialog]); // canManageScope removed as dependency to avoid loop (logic moved to cloud)

    const hasChanges = useMemo(() => {
        if (userPermissions.size !== initialUserPermissions.size) return true;
        for (const [key, val] of userPermissions) {
            if (initialUserPermissions.get(key) !== val) return true;
        }
        return false;
    }, [userPermissions, initialUserPermissions]);

    useEffect(() => setIsDirty(hasChanges), [hasChanges, setIsDirty]);

    const isDirtyRef = useRef(hasChanges);
    useEffect(() => { isDirtyRef.current = hasChanges; }, [hasChanges]);

    // 2. Listen Permissions
    useEffect(() => {
        if (!selectedUserId || !selectedUserObj) return;

        let unsubJob = () => {};
        if (selectedUserObj.job_id) {
            const qJob = query(collection(firestore, 'job_permissions'), where('job_id', '==', Number(selectedUserObj.job_id) || selectedUserObj.job_id));
            unsubJob = onSnapshot(qJob, (snap) => {
                const newSet = new Set<string>();
                snap.forEach(doc => {
                    const p = doc.data();
                    if (p.sub_sub_service_id) newSet.add(`sss:${p.sub_sub_service_id}`);
                    else if (p.sub_service_id) newSet.add(`ss:${p.sub_service_id}`);
                    else if (p.service_id) newSet.add(`s:${p.service_id}`);
                });
                setJobPermissions(newSet);
            });
        } else { setJobPermissions(new Set()); }

        const qUser = query(collection(firestore, 'user_permissions'), where('user_id', '==', selectedUserId));
        const unsubUser = onSnapshot(qUser, (snap) => {
            if (snap.metadata.hasPendingWrites) return;

            const newMap = new Map<string, boolean | undefined>();
            snap.forEach(doc => {
                const p = doc.data();
                const key = p.sub_sub_service_id ? `sss:${p.sub_sub_service_id}` : p.sub_service_id ? `ss:${p.sub_service_id}` : `s:${p.service_id}`;
                newMap.set(key, p.is_allowed);
            });
            
            if (isDirtyRef.current) {
                const currentInitialStr = JSON.stringify(Array.from(initialUserPermissions.entries()).sort());
                const newIncomingStr = JSON.stringify(Array.from(newMap.entries()).sort());
                
                if (currentInitialStr !== newIncomingStr) {
                    showDialog({
                        variant: 'alert',
                        title: t.conflictTitle,
                        message: t.conflictMessage,
                        confirmText: t.loadNew,
                        cancelText: t.ignore,
                        onConfirm: () => {
                            setUserPermissions(newMap);
                            setInitialUserPermissions(new Map(newMap));
                        }
                    });
                }
            } else {
                setUserPermissions(newMap);
                setInitialUserPermissions(new Map(newMap));
            }
        });

        return () => { unsubJob(); unsubUser(); };
    }, [selectedUserId, selectedUserObj, initialUserPermissions, t, showDialog]);

    const loadUser = (u: User) => {
        setSelectedUserId(u.id); setSelectedUserObj(u);
        setTreeSearchTerm(''); setIsDirty(false);
        setSearchParams({ userId: u.id });
    };

    const getStateCallback = useCallback((id: string) => userPermissions.get(id), [userPermissions]);
    const getJobStateCallback = useCallback((id: string) => jobPermissions.has(id), [jobPermissions]);
    const getInitialStateCallback = useCallback((id: string) => initialUserPermissions.get(id), [initialUserPermissions]);

    const handleToggle = useCallback((id: string, newValue: boolean | undefined) => {
        setUserPermissions(prev => {
            const next = new Map(prev);
            if (newValue === undefined) next.delete(id); else next.set(id, newValue);
            return next;
        });
    }, []);

    const handleSave = async () => {
        if (!selectedUserId || !hasChanges) return;
        const changes: { id: string, state: boolean }[] = [];
        userPermissions.forEach((val, key) => {
            const initial = initialUserPermissions.get(key);
            if (val !== initial && val !== undefined) {
                changes.push({ id: key, state: val });
            }
        });

        if (changes.length === 0) return;

        showActionLoading(t.saving);
        try {
            await updateUserPermissions(selectedUserId, changes);
            showDialog({ variant: 'success', title: t.successTitle, message: t.successMessage });
        } catch (error) { showDialog({ variant: 'alert', title: t.errorTitle, message: t.errorMessage }); } 
        finally { hideActionLoading(); }
    };

    const filteredUsers = users.filter(u => (u.name_ar?.includes(userSearchTerm) || u.name_en?.includes(userSearchTerm)));
    
    const displayedTree = useMemo(() => {
        const filter = (nodes: ServiceNode[]): ServiceNode[] => {
            return nodes.reduce((acc: ServiceNode[], node) => {
                if (!canGrantResource(node.id)) return acc;
                const children = filter(node.children);
                if (node.label.toLowerCase().includes(treeSearchTerm.toLowerCase()) || children.length > 0) {
                    acc.push({ ...node, children });
                }
                return acc;
            }, []);
        };
        return filter(servicesTree);
    }, [servicesTree, treeSearchTerm, canGrantResource]);

    if (isUsersLoading) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loadingUsers}</div>;

    return (
        <div className="w-full flex flex-col min-h-screen">
            <AnimatePresence mode="wait">
                {!selectedUserId ? (
                    <motion.div key="select" variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-6 text-[#FFD700]"><ShieldCheckIcon className="w-6 h-6" /><h2 className="text-xl font-bold">{t.selectUserTitle}</h2></div>
                            <div className="relative mb-6"><input type="text" placeholder={t.searchPlaceholder} value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg py-3 px-4 pl-10 focus:border-[#FFD700] transition-colors text-white" /><MagnifyingGlassIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" /></div>
                            {filteredUsers.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredUsers.map(u => <UserCard key={u.id} user={u} language={language} onClick={() => loadUser(u)} />)}</div>
                            ) : <div className="text-center py-12 text-gray-500"><p>{t.noUsersFound}</p></div>}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="editor" variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-4 mb-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center border-2 border-blue-500">
                                        {selectedUserObj?.avatar_url ? <img src={selectedUserObj.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 text-gray-400" />}
                                    </div>
                                    <div><h2 className="text-lg font-bold text-white">{language === 'ar' ? selectedUserObj?.name_ar : selectedUserObj?.name_en}</h2><p className="text-xs text-gray-400">{t.pageTitle}</p></div>
                                </div>
                                <button onClick={() => { setSelectedUserId(null); setIsDirty(false); setSearchParams({}); }} className="text-sm text-blue-400 hover:underline flex items-center gap-1"><ArrowPathIcon className="w-4 h-4" /> {t.changeUser}</button>
                            </div>
                            <div className="relative"><input type="text" placeholder={t.filterTreePlaceholder} value={treeSearchTerm} onChange={(e) => setTreeSearchTerm(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 px-4 pl-10 focus:border-blue-500 text-sm text-white" /><AdjustmentsHorizontalIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" /></div>
                        </div>

                        <div className="bg-gray-900/30 border border-gray-700 rounded-xl p-2 mb-8">
                            <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate">
                                {displayedTree.map(node => (
                                    <ServiceTreeRow key={node.id} node={node} 
                                        getState={getStateCallback}
                                        getJobState={getJobStateCallback}
                                        getInitialState={getInitialStateCallback}
                                        onToggle={handleToggle} canEdit={canGrantResource} t={t} searchTerm={treeSearchTerm} rowType="user" 
                                    />
                                ))}
                            </motion.div>
                        </div>
                        
                        <div className="flex justify-center pb-10 mt-auto">
                            <button disabled={!hasChanges} onClick={() => showDialog({ variant: 'confirm', title: t.confirmSave, message: t.confirmSave, onConfirm: handleSave })} className={`w-full max-w-md font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all ${hasChanges ? 'bg-[#FFD700] text-black hover:scale-105' : 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'}`}>
                                <CheckCircleIcon className="w-6 h-6" /> {t.save}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}