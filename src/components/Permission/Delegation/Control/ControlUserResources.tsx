// src/components/Permission/Delegation/Control/ControlUserResources.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, User } from '../../../contexts/UserContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useActionLoading } from '../../../contexts/ActionLoadingContext';
import { useDialog } from '../../../contexts/DialogContext';
import { useUnsavedChanges } from "../../../contexts/UnsavedChangesContext";
import { useAccessManager, ResourcePayload } from '../../../../hooks/useAccessManager';
import { ServiceTreeRow, ServiceNode } from '../Shared/DelegationTree';

import { motion, AnimatePresence } from 'framer-motion';
import { directionalSlideVariants, staggeredContainerVariants } from '../../../../lib/animations';
import { 
    MagnifyingGlassIcon, UserIcon, ShieldCheckIcon, CheckCircleIcon, 
    ArrowPathIcon, AdjustmentsHorizontalIcon
} from "@heroicons/react/24/outline";
import { getFirestore, collection, getDocs, onSnapshot, query, where } from "firebase/firestore";

const firestore = getFirestore();

const translations = {
    ar: {
        pageTitle: "نظام تفويض التحكم (موارد المستخدمين)",
        pageDesc: "منح مستخدم محدد صلاحية 'التحكم' في موارد إضافية كاستثناء.",
        selectUserTitle: "اختر المستخدم",
        searchPlaceholder: "ابحث عن مستخدم...",
        filterTreePlaceholder: "بحث داخل الخدمات...",
        noUsersFound: "لا يوجد مستخدمين متاحين في نطاق تحكمك.",
        save: "حفظ الاستثناءات",
        saving: "جاري الحفظ...",
        successTitle: "تم بنجاح",
        successMessage: "تم تحديث موارد التحكم للمستخدم.",
        errorTitle: "خطأ",
        errorMessage: "حدث خطأ أثناء الحفظ.",
        confirmSave: "هل أنت متأكد من حفظ التغييرات؟",
        changeUser: "تغيير المستخدم",
        levelService: "خدمة", levelPage: "صفحة", levelAction: "إجراء",
        loadingData: "جاري تحميل البيانات...",
        conflictTitle: "تحديث خارجي",
        conflictMessage: "تم تعديل البيانات من مصدر آخر. هل تريد تحميل الجديد؟",
        loadNew: "تحميل الجديد",
        ignore: "تجاهل"
    },
    en: {
        pageTitle: "Control Delegation (User Resources)",
        pageDesc: "Grant a specific user 'Control' over extra resources as an exception.",
        selectUserTitle: "Select User",
        searchPlaceholder: "Search user...",
        filterTreePlaceholder: "Search services...",
        noUsersFound: "No users found in your control scope.",
        save: "Save Exceptions",
        saving: "Saving...",
        successTitle: "Success",
        successMessage: "User control resources updated.",
        errorTitle: "Error",
        errorMessage: "Error saving changes.",
        confirmSave: "Save changes?",
        changeUser: "Change User",
        levelService: "Service", levelPage: "Page", levelAction: "Action",
        loadingData: "Loading data...",
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
            </div>
        </div>
    </motion.div>
);

export default function ControlUserResources() {
    const { language } = useLanguage();
    const t = translations[language as keyof typeof translations];
    const { canManageScope, canGrantResource } = useAuth();
    const { updateUserControlResources } = useAccessManager(); // ✅ دالة التحكم
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

    const [userResources, setUserResources] = useState<Map<string, string>>(new Map()); 
    const [initialUserResources, setInitialUserResources] = useState<Map<string, string>>(new Map());
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
                return () => unsubUsers();
            } catch (error) { console.error(error); } finally { setIsLoadingData(false); }
        };
        fetchData();
    }, [language, canManageScope]);

    const hasChanges = useMemo(() => {
        if (userResources.size !== initialUserResources.size) return true;
        for (const key of userResources.keys()) {
            if (!initialUserResources.has(key)) return true;
        }
        return false;
    }, [userResources, initialUserResources]);

    useEffect(() => setIsDirty(hasChanges), [hasChanges, setIsDirty]);

    const isDirtyRef = useRef(hasChanges);
    useEffect(() => { isDirtyRef.current = hasChanges; }, [hasChanges]);

    // 2. Listen to Resources (Control User Collection)
    useEffect(() => {
        if (!selectedUserId) return;
        // ✅ الاستماع لجدول control_user_resources
        const q = query(collection(firestore, 'control_user_resources'), where('user_id', '==', selectedUserId));
        
        const unsub = onSnapshot(q, (snap) => {
            if (snap.metadata.hasPendingWrites) return;

            const newMap = new Map<string, string>();
            snap.forEach(doc => {
                const p = doc.data();
                const key = p.sub_sub_service_id ? `sss:${p.sub_sub_service_id}` : p.sub_service_id ? `ss:${p.sub_service_id}` : `s:${p.service_id}`;
                newMap.set(key, doc.id); 
            });

            if (isDirtyRef.current) {
                const currentInitialKeys = JSON.stringify(Array.from(initialUserResources.keys()).sort());
                const newIncomingKeys = JSON.stringify(Array.from(newMap.keys()).sort());
                
                if (currentInitialKeys !== newIncomingKeys) {
                    showDialog({
                        variant: 'alert',
                        title: t.conflictTitle,
                        message: t.conflictMessage,
                        confirmText: t.loadNew,
                        cancelText: t.ignore,
                        onConfirm: () => {
                            setUserResources(newMap);
                            setInitialUserResources(new Map(newMap));
                        }
                    });
                }
            } else {
                setUserResources(newMap);
                setInitialUserResources(new Map(newMap));
                setIsDirty(false);
            }
        });
        return () => unsub();
    }, [selectedUserId, setIsDirty, t, initialUserResources, showDialog]);

    const loadUser = (user: User) => {
        setSelectedUserId(user.id);
        setSelectedUserObj(user);
        setSearchParams({ userId: user.id });
    };

    const getStateCallback = useCallback((id: string) => userResources.has(id) ? true : undefined, [userResources]);
    const getInitialStateCallback = useCallback((id: string) => initialUserResources.has(id) ? true : undefined, [initialUserResources]);

    const handleToggle = useCallback((id: string, newValue: boolean | undefined) => {
        setUserResources(prev => {
            const next = new Map(prev);
            if (newValue === true) next.set(id, "PENDING");
            else next.delete(id);
            return next;
        });
    }, []);

    const handleSave = async () => {
        if (!selectedUserId || !hasChanges) return;

        showActionLoading(t.saving);
        try {
            const toRemovePromises: Promise<boolean>[] = [];
            initialUserResources.forEach((docId, key) => {
                if (!userResources.has(key)) {
                    toRemovePromises.push(updateUserControlResources(selectedUserId, {}, 'remove', docId));
                }
            });

            const toAddPromises: Promise<boolean>[] = [];
            userResources.forEach((val, key) => {
                if (!initialUserResources.has(key)) {
                    const [type, id] = key.split(':');
                    const payload: ResourcePayload = {
                        service_id: type === 's' ? id : undefined,
                        sub_service_id: type === 'ss' ? id : undefined,
                        sub_sub_service_id: type === 'sss' ? id : undefined,
                    };
                    toAddPromises.push(updateUserControlResources(selectedUserId, payload, 'add'));
                }
            });

            await Promise.all([...toRemovePromises, ...toAddPromises]);
            showDialog({ variant: 'success', title: t.successTitle, message: t.successMessage });
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            showDialog({ variant: 'alert', title: t.errorTitle, message: (error as any).message || t.errorMessage });
        } finally {
            hideActionLoading();
        }
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
                            ) : <div className="text-center py-12 text-gray-500"><p>{t.noUsersFound}</p></div>}
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

                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4">
                             <div className="relative"><input type="text" placeholder={t.filterTreePlaceholder} value={treeSearchTerm} onChange={(e) => setTreeSearchTerm(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 px-4 pl-10 focus:border-red-500 text-sm text-white" /><AdjustmentsHorizontalIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" /></div>
                        </div>

                        <div className="bg-gray-900/30 border border-gray-700 rounded-xl p-2 mb-8">
                            <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate">
                                {displayedTree.length > 0 ? displayedTree.map(node => (
                                    <ServiceTreeRow key={node.id} node={node} 
                                        getState={getStateCallback} 
                                        getJobState={() => false}
                                        getInitialState={getInitialStateCallback}
                                        onToggle={handleToggle} canEdit={canGrantResource} t={t} searchTerm={treeSearchTerm} rowType="user" 
                                    />
                                )) : <div className="text-center py-8 text-gray-500">لا توجد نتائج</div>}
                            </motion.div>
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