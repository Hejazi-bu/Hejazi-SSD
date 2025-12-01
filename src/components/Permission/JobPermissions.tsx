// src/components/Permission/JobPermissions.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useActionLoading } from '../contexts/ActionLoadingContext';
import { useDialog } from '../contexts/DialogContext';
import { useUnsavedChanges } from "../contexts/UnsavedChangesContext";
import { useAccessManager, JobPermissionInput } from '../../hooks/useAccessManager';
import { usePermissionChangeListener, useConcurrentEditListener } from '../../hooks/usePermissionChangeListener'; 
import { ServiceTreeRow, ServiceNode } from './Delegation/Shared/DelegationTree'; 
import { ScopeConfigDialog } from './Delegation/Shared/ScopeConfigDialog'; // ✅ استيراد النافذة المشتركة

import { motion, AnimatePresence } from 'framer-motion';
import { directionalSlideVariants, staggeredContainerVariants } from '../../lib/animations';
import { 
    MagnifyingGlassIcon, BriefcaseIcon, ShieldCheckIcon, CheckCircleIcon, 
    ArrowPathIcon, BuildingOfficeIcon, GlobeAltIcon, AdjustmentsHorizontalIcon
} from "@heroicons/react/24/outline";
import { getFirestore, collection, getDocs, onSnapshot, query, where } from "firebase/firestore";

const firestore = getFirestore();

interface BasicEntity { id: string; name_ar: string; name_en: string; [key: string]: unknown; }

const translations = {
    ar: {
        pageTitle: "إدارة صلاحيات الوظائف",
        selectJobTitle: "اختيار الوظيفة",
        searchPlaceholder: "ابحث عن وظيفة...",
        filterTreePlaceholder: "بحث داخل الخدمات...",
        noJobsFound: "لم يتم العثور على وظائف.",
        save: "حفظ الصلاحيات",
        saving: "جاري الحفظ...",
        successTitle: "تم بنجاح",
        successMessage: "تم تحديث صلاحيات الوظيفة.",
        errorTitle: "خطأ",
        errorMessage: "حدث خطأ أثناء الحفظ.",
        confirmSave: "هل أنت متأكد من حفظ التغييرات؟",
        changeJob: "تغيير الوظيفة",
        levelService: "خدمة", levelPage: "صفحة", levelAction: "إجراء",
        scopeGlobal: "عام (الكل)",
        scopeRestricted: "مقيد بنطاق محدد",
        configureScope: "تخصيص النطاق",
        conflictTitle: "تحديث خارجي",
        conflictMessage: "بيانات خارجية تغيرت. هل تريد التحديث؟",
        loadNew: "تحميل",
        ignore: "تجاهل",
        cancel: "إلغاء",
        companyLabel: "الشركة",
        sectionLabel: "القسم",
        distributionNotice: "تظهر هنا فقط الشركات والأقسام التي تم توزيع هذه الوظيفة عليها."
    },
    en: {
        pageTitle: "Manage Job Permissions",
        selectJobTitle: "Select Job",
        searchPlaceholder: "Search job...",
        filterTreePlaceholder: "Search services...",
        noJobsFound: "No jobs found.",
        save: "Save Permissions",
        saving: "Saving...",
        successTitle: "Success",
        successMessage: "Job permissions updated.",
        errorTitle: "Error",
        errorMessage: "Error saving changes.",
        confirmSave: "Save changes?",
        changeJob: "Change Job",
        levelService: "Service", levelPage: "Page", levelAction: "Action",
        scopeGlobal: "Global (All)",
        scopeRestricted: "Restricted Scope",
        configureScope: "Configure Scope",
        conflictTitle: "External Update",
        conflictMessage: "External data changed. Update?",
        loadNew: "Load",
        ignore: "Ignore",
        cancel: "Cancel",
        companyLabel: "Company",
        sectionLabel: "Section",
        distributionNotice: "Only companies/sections where this job is distributed appear here."
    }
};

const JobCard = ({ job, onClick, language }: any) => (
    <motion.div 
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClick} 
        className="bg-gray-800/50 border border-gray-700 hover:border-blue-500/50 rounded-xl p-4 cursor-pointer transition-all group"
    >
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 group-hover:text-blue-400 transition-colors border border-gray-600">
                <BriefcaseIcon className="w-6 h-6" />
            </div>
            <div>
                <h3 className="font-bold text-gray-100">{language === 'ar' ? job.name_ar : job.name_en}</h3>
            </div>
        </div>
    </motion.div>
);

export default function JobPermissions() {
    const { language } = useLanguage();
    const t = translations[language as keyof typeof translations];
    const { canManageScope, canGrantResource } = useAuth();
    const { updateJobPermissions } = useAccessManager();
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const { setIsDirty } = useUnsavedChanges();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [searchParams, setSearchParams] = useSearchParams();

    // ✅ نظام الاستماع اللحظي للتغييرات
    usePermissionChangeListener({
        listenToJobPermissions: true,
        listenToAccessDelegation: true,
        listenToControlDelegation: true,
        specificJobId: null // سيستمع لوظيفة المستخدم الحالي
    });

    // ✅ مراقبة التعديلات المتزامنة عند اختيار وظيفة
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    useConcurrentEditListener('job_permissions', selectedJobId, (message) => {
        console.warn('Concurrent edit detected:', message);
    });

    const [jobs, setJobs] = useState<BasicEntity[]>([]);
    const [servicesTree, setServicesTree] = useState<ServiceNode[]>([]);
    
    // قوائم التوزيع المتاحة لهذه الوظيفة
    const [validCompanies, setValidCompanies] = useState<BasicEntity[]>([]);
    const [validSections, setValidSections] = useState<BasicEntity[]>([]);

    const [selectedJobObj, setSelectedJobObj] = useState<BasicEntity | null>(null);
    
    const [jobSearchTerm, setJobSearchTerm] = useState('');
    const [treeSearchTerm, setTreeSearchTerm] = useState('');

    // تخزين الصلاحيات: المفتاح هو الـ ID، القيمة هي كائن النطاق أو undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [jobPermissions, setJobPermissions] = useState<Map<string, any>>(new Map());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [initialJobPermissions, setInitialJobPermissions] = useState<Map<string, any>>(new Map());

    const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
    const [activePermissionId, setActivePermissionId] = useState<string | null>(null);

    // 1. Fetch Basic Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [jobsSnap, servicesSnap, subServicesSnap, subSubServicesSnap] = await Promise.all([
                    getDocs(collection(firestore, 'jobs')),
                    getDocs(collection(firestore, 'services')),
                    getDocs(collection(firestore, 'sub_services')),
                    getDocs(collection(firestore, 'sub_sub_services'))
                ]);

                const allJobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BasicEntity));
                setJobs(allJobs.filter(j => canManageScope('access', { jobId: j.id })));

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
            } catch (error) { console.error(error); }
        };
        fetchData();
    }, [language, canManageScope]);

    // 2. Fetch Distribution Logic
    useEffect(() => {
        if (!selectedJobId) {
            setValidCompanies([]);
            setValidSections([]);
            return;
        }

        const fetchDistribution = async () => {
            try {
                const distQuery = query(collection(firestore, 'job_distribution'), where('job_id', '==', String(selectedJobId)));
                const distSnap = await getDocs(distQuery);

                const compIds = new Set<string>();
                const sectIds = new Set<string>();

                distSnap.forEach(doc => {
                    const d = doc.data();
                    if (d.company_id) compIds.add(d.company_id);
                    if (d.section_id) sectIds.add(d.section_id);
                });

                if (compIds.size > 0) {
                    const companiesSnap = await getDocs(query(collection(firestore, 'companies'), where('is_allowed', '==', true)));
                    const filteredComps = companiesSnap.docs
                        .map(d => ({ id: d.id, ...d.data() } as BasicEntity))
                        .filter((c: BasicEntity) => compIds.has(c.id));
                    setValidCompanies(filteredComps);
                } else {
                    setValidCompanies([]);
                }

                if (sectIds.size > 0) {
                    const sectionsSnap = await getDocs(query(collection(firestore, 'sections'), where('is_active', '==', true)));
                    const filteredSects = sectionsSnap.docs
                        .map(d => ({ id: d.id, ...d.data() } as BasicEntity))
                        .filter((s: BasicEntity) => sectIds.has(s.id));
                    setValidSections(filteredSects);
                } else {
                    setValidSections([]);
                }

            } catch (error) {
                console.error("Error fetching job distribution:", error);
            }
        };

        fetchDistribution();
    }, [selectedJobId]);

    const hasChanges = useMemo(() => {
        if (jobPermissions.size !== initialJobPermissions.size) return true;
        for (const [key, val] of jobPermissions) {
            const initial = initialJobPermissions.get(key);
            if (!initial || JSON.stringify(val) !== JSON.stringify(initial)) return true;
        }
        return false;
    }, [jobPermissions, initialJobPermissions]);

    useEffect(() => setIsDirty(hasChanges), [hasChanges, setIsDirty]);

    const isDirtyRef = useRef(hasChanges);
    useEffect(() => { isDirtyRef.current = hasChanges; }, [hasChanges]);

    // 3. Listen to Permissions
    useEffect(() => {
        if (!selectedJobId) return;
        
        const qJob = query(collection(firestore, 'job_permissions'), where('job_id', '==', String(selectedJobId)));
        
        const unsub = onSnapshot(qJob, (snap) => {
            if (snap.metadata.hasPendingWrites) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newMap = new Map<string, any>();
            snap.forEach(doc => {
                const p = doc.data();
                const key = p.sub_sub_service_id ? `sss:${p.sub_sub_service_id}` : p.sub_service_id ? `ss:${p.sub_service_id}` : `s:${p.service_id}`;
                
                const companyId = (p.scope_companies && p.scope_companies.length > 0) ? p.scope_companies[0] : (p.scope_company_id || null);
                const sectionId = (p.scope_sections && p.scope_sections.length > 0) ? p.scope_sections[0] : (p.scope_section_id || null);

                newMap.set(key, { 
                    scope_company_id: companyId,
                    scope_section_id: sectionId 
                });
            });

            if (isDirtyRef.current) {
                setJobPermissions(newMap);
                setInitialJobPermissions(new Map(newMap));
            } else {
                setJobPermissions(newMap);
                setInitialJobPermissions(new Map(newMap));
            }
        });
        return () => unsub();
    }, [selectedJobId]);

    const loadJob = (job: BasicEntity) => {
        setSelectedJobId(job.id); setSelectedJobObj(job);
        setTreeSearchTerm(''); setIsDirty(false);
        setSearchParams({ jobId: job.id });
    };

    const getStateCallback = useCallback((id: string) => jobPermissions.has(id), [jobPermissions]);
    
    const handleToggle = useCallback((id: string, newValue: boolean | undefined) => {
        if (newValue === true) {
            setJobPermissions(prev => new Map(prev).set(id, { scope_company_id: null, scope_section_id: null }));
        } else {
            setJobPermissions(prev => { const next = new Map(prev); next.delete(id); return next; });
        }
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleScopeSave = (newScope: any) => {
        if (activePermissionId) {
            setJobPermissions(prev => new Map(prev).set(activePermissionId, newScope));
            setScopeDialogOpen(false);
            setActivePermissionId(null);
        }
    };

    const handleSave = async () => {
        if (!selectedJobId || !hasChanges) return;
        
        const toAdd: JobPermissionInput[] = [];
        const toRemove: string[] = [];
        
        jobPermissions.forEach((scope, key) => {
            const initial = initialJobPermissions.get(key);
            if (!initial || JSON.stringify(initial) !== JSON.stringify(scope)) {
                
                // Construct Scope for Backend (Arrays)
                const backendScope = {
                    companies: scope.scope_company_id ? [scope.scope_company_id] : [], 
                    sections: scope.scope_section_id ? [scope.scope_section_id] : [],
                    departments: [] 
                };

                toAdd.push({ 
                    id: key, 
                    is_allowed: true, 
                    scope: backendScope 
                });
            }
        });

        initialJobPermissions.forEach((_, key) => { 
            if (!jobPermissions.has(key)) toRemove.push(key); 
        });

        showActionLoading(t.saving);
        try {
            await updateJobPermissions(selectedJobId, toAdd, toRemove);
            setInitialJobPermissions(new Map(jobPermissions));
            setIsDirty(false);
            showDialog({ variant: 'success', title: t.successTitle, message: t.successMessage });
        } catch (error) { 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            showDialog({ variant: 'alert', title: t.errorTitle, message: (error as any).message || t.errorMessage }); 
        } finally { 
            hideActionLoading(); 
        }
    };

    const filteredJobs = jobs.filter(j => (j.name_ar?.includes(jobSearchTerm) || j.name_en?.includes(jobSearchTerm)));
    
    // ✅ دالة رسم زر النطاق (Render Prop)
    const renderScopeButton = useCallback((node: ServiceNode) => {
        const hasPerm = jobPermissions.has(node.id);
        
        if (!hasPerm) return null;

        const scope = jobPermissions.get(node.id);
        const isScoped = scope?.scope_company_id || scope?.scope_section_id;

        return (
            <button 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    setActivePermissionId(node.id); 
                    setScopeDialogOpen(true); 
                }}
                className={`p-1.5 rounded-md hover:bg-gray-700 transition-colors ${isScoped ? 'text-orange-400 bg-orange-500/10' : 'text-gray-600'}`}
                title={t.configureScope}
            >
                {isScoped ? <BuildingOfficeIcon className="w-4 h-4" /> : <GlobeAltIcon className="w-4 h-4" />}
            </button>
        );
    }, [jobPermissions, t]);

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

    return (
        <div className="w-full flex flex-col min-h-screen">
            <ScopeConfigDialog 
                isOpen={scopeDialogOpen} 
                onClose={() => setScopeDialogOpen(false)} 
                onSave={handleScopeSave} 
                validCompanies={validCompanies} 
                validSections={validSections} 
                initialScope={activePermissionId ? jobPermissions.get(activePermissionId) : null} 
                t={t} 
                language={language} 
            />

            <AnimatePresence mode="wait">
                {!selectedJobId ? (
                    <motion.div key="select" variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                         <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-6 text-blue-400"><ShieldCheckIcon className="w-6 h-6" /><h2 className="text-xl font-bold">{t.selectJobTitle}</h2></div>
                            <div className="relative mb-6"><input type="text" placeholder={t.searchPlaceholder} value={jobSearchTerm} onChange={(e) => setJobSearchTerm(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg py-3 px-4 pl-10 focus:border-blue-500 transition-colors text-white" /><MagnifyingGlassIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" /></div>
                            {filteredJobs.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredJobs.map(j => <JobCard key={j.id} job={j} language={language} onClick={() => loadJob(j)} />)}</div>
                            ) : <div className="text-center py-12 text-gray-500"><p>{t.noJobsFound}</p></div>}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="editor" variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-4 mb-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center border-2 border-blue-500"><BriefcaseIcon className="w-6 h-6 text-gray-100" /></div>
                                    <div><h2 className="text-lg font-bold text-white">{language === 'ar' ? selectedJobObj?.name_ar : selectedJobObj?.name_en}</h2><p className="text-xs text-gray-400">{t.pageTitle}</p></div>
                                </div>
                                <button onClick={() => { setSelectedJobId(null); setIsDirty(false); setSearchParams({}); }} className="text-sm text-blue-400 hover:underline flex items-center gap-1"><ArrowPathIcon className="w-4 h-4" /> {t.changeJob}</button>
                            </div>
                            <div className="relative"><input type="text" placeholder={t.filterTreePlaceholder} value={treeSearchTerm} onChange={(e) => setTreeSearchTerm(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 px-4 pl-10 focus:border-blue-500 text-sm text-white" /><AdjustmentsHorizontalIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" /></div>
                        </div>

                        <div className="bg-gray-900/30 border border-gray-700 rounded-xl p-2 mb-8">
                            <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate">
                                {displayedTree.map(node => (
                                    <ServiceTreeRow 
                                        key={node.id} node={node} 
                                        getState={getStateCallback} 
                                        onToggle={handleToggle} canEdit={canGrantResource} t={t} searchTerm={treeSearchTerm} rowType="job"
                                        renderScopeButton={renderScopeButton} // ✅ تمرير دالة الرسم
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