// src/components/Permission/Delegation/Access/AccessJobResources.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/UserContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useActionLoading } from '../../../contexts/ActionLoadingContext';
import { useDialog } from '../../../contexts/DialogContext';
import { useUnsavedChanges } from "../../../contexts/UnsavedChangesContext";
import { useAccessManager, ResourcePayload } from '../../../../hooks/useAccessManager';
import { ServiceTreeRow, ServiceNode } from '../Shared/DelegationTree';
import { ScopeConfigDialog } from '../Shared/ScopeConfigDialog'; // ✅ النافذة المشتركة

import { motion, AnimatePresence } from 'framer-motion';
import { directionalSlideVariants, staggeredContainerVariants } from '../../../../lib/animations';
import { 
    MagnifyingGlassIcon, BriefcaseIcon, ShieldCheckIcon, CheckCircleIcon, 
    ArrowPathIcon, AdjustmentsHorizontalIcon, BuildingOfficeIcon, GlobeAltIcon
} from "@heroicons/react/24/outline";
import { getFirestore, collection, getDocs, onSnapshot, query, where } from "firebase/firestore";

const firestore = getFirestore();

interface JobData { id: string; name_ar: string; name_en: string; [key: string]: unknown; }
interface BasicEntity { id: string; name_ar: string; name_en: string; [key: string]: unknown; }

const translations = {
    ar: {
        pageTitle: "نظام تفويض الوصول (موارد الوظائف)",
        pageDesc: "تحديد الخدمات والموارد التي تملك هذه الوظيفة حق الوصول إليها أو منحها.",
        selectJobTitle: "اختر الوظيفة",
        searchPlaceholder: "ابحث عن وظيفة...",
        filterTreePlaceholder: "بحث داخل الخدمات...",
        noJobsFound: "لا توجد وظائف متاحة.",
        save: "حفظ الموارد",
        saving: "جاري الحفظ...",
        successTitle: "تم بنجاح",
        successMessage: "تم تحديث موارد الوظيفة.",
        errorTitle: "خطأ",
        errorMessage: "حدث خطأ أثناء الحفظ.",
        confirmSave: "هل أنت متأكد من حفظ التغييرات؟",
        changeJob: "تغيير الوظيفة",
        levelService: "خدمة", levelPage: "صفحة", levelAction: "إجراء",
        loadingData: "جاري تحميل البيانات...",
        configureScope: "تخصيص النطاق",
        scopeGlobal: "عام (الكل)",
        companyLabel: "الشركة",
        sectionLabel: "القسم",
        distributionNotice: "تظهر هنا فقط الشركات والأقسام التي تم توزيع هذه الوظيفة عليها.",
        conflictTitle: "تحديث خارجي",
        conflictMessage: "تم تعديل البيانات من مصدر آخر. هل تريد تحميل الجديد؟",
        loadNew: "تحميل الجديد",
        ignore: "تجاهل"
    },
    en: {
        pageTitle: "Access Delegation (Job Resources)",
        pageDesc: "Define services and resources this job can access or delegate.",
        selectJobTitle: "Select Job",
        searchPlaceholder: "Search job...",
        filterTreePlaceholder: "Search services...",
        noJobsFound: "No jobs found.",
        save: "Save Resources",
        saving: "Saving...",
        successTitle: "Success",
        successMessage: "Job resources updated.",
        errorTitle: "Error",
        errorMessage: "Error saving changes.",
        confirmSave: "Save changes?",
        changeJob: "Change Job",
        levelService: "Service", levelPage: "Page", levelAction: "Action",
        loadingData: "Loading data...",
        configureScope: "Configure Scope",
        scopeGlobal: "Global (All)",
        companyLabel: "Company",
        sectionLabel: "Section",
        distributionNotice: "Only companies/sections where this job is distributed appear here.",
        conflictTitle: "External Update",
        conflictMessage: "Data updated externally. Load new data?",
        loadNew: "Load New",
        ignore: "Ignore"
    }
};

const JobCard = ({ job, onClick, language }: { job: JobData, onClick: () => void, language: string }) => (
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
                <p className="text-xs text-gray-500">ID: {job.id}</p>
            </div>
        </div>
    </motion.div>
);

export default function AccessJobResources() {
    const { language } = useLanguage();
    const t = translations[language as keyof typeof translations];
    const { canManageScope, canGrantResource } = useAuth();
    const { updateJobAccessResources } = useAccessManager(); // ✅ دالة تفويض الوصول
    
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const { setIsDirty } = useUnsavedChanges();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [searchParams, setSearchParams] = useSearchParams();

    const [jobs, setJobs] = useState<JobData[]>([]);
    const [servicesTree, setServicesTree] = useState<ServiceNode[]>([]);
    
    // ✅ قوائم التوزيع (لتحديد النطاق المتاح للوظيفة)
    const [validCompanies, setValidCompanies] = useState<BasicEntity[]>([]);
    const [validSections, setValidSections] = useState<BasicEntity[]>([]);

    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [selectedJobObj, setSelectedJobObj] = useState<JobData | null>(null);
    
    const [jobSearchTerm, setJobSearchTerm] = useState('');
    const [treeSearchTerm, setTreeSearchTerm] = useState('');

    // ✅ Map لتخزين الموارد مع النطاق
    // المفتاح: ID الخدمة، القيمة: { docId: string | null, scope: { ... } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [jobResources, setJobResources] = useState<Map<string, any>>(new Map()); 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [initialJobResources, setInitialJobResources] = useState<Map<string, any>>(new Map());

    const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
    const [activePermissionId, setActivePermissionId] = useState<string | null>(null);

    const [isLoadingData, setIsLoadingData] = useState(true);

    // 1. Fetch Basic Data
    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                const jobsSnap = await getDocs(collection(firestore, 'jobs'));
                const allJobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as JobData));
                
                // فلترة الوظائف التي أملك صلاحية "التحكم" عليها
                setJobs(allJobs.filter(j => canManageScope('control', { jobId: j.id })));

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
            } catch (error) { console.error(error); } finally { setIsLoadingData(false); }
        };
        fetchData();
    }, [language, canManageScope]);

    // 2. ✅ Fetch Distribution Logic (فلترة النطاقات بناءً على توزيع الوظيفة)
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

    // 3. Dirty State
    const hasChanges = useMemo(() => {
        if (jobResources.size !== initialJobResources.size) return true;
        for (const [key, val] of jobResources) {
            const initial = initialJobResources.get(key);
            // المقارنة العميقة للنطاق
            if (!initial || JSON.stringify(val.scope) !== JSON.stringify(initial.scope)) return true;
        }
        return false;
    }, [jobResources, initialJobResources]);

    useEffect(() => setIsDirty(hasChanges), [hasChanges, setIsDirty]);

    const isDirtyRef = useRef(hasChanges);
    useEffect(() => { isDirtyRef.current = hasChanges; }, [hasChanges]);

    // 4. Listen to Resources (Access Job Resources Collection)
    useEffect(() => {
        if (!selectedJobId) return;
        const q = query(collection(firestore, 'access_job_resources'), where('job_id', '==', selectedJobId));
        
        const unsub = onSnapshot(q, (snap) => {
            if (snap.metadata.hasPendingWrites) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newMap = new Map<string, any>();
            snap.forEach(doc => {
                const p = doc.data();
                const key = p.sub_sub_service_id ? `sss:${p.sub_sub_service_id}` : p.sub_service_id ? `ss:${p.sub_service_id}` : `s:${p.service_id}`;
                
                const scope = p.scope || {};
                newMap.set(key, { 
                    docId: doc.id,
                    scope: {
                        scope_company_id: scope.companies?.[0] || null,
                        scope_section_id: scope.sections?.[0] || null
                    }
                }); 
            });

            if (isDirtyRef.current) {
                // Simplified Conflict Handling
                setJobResources(newMap);
                setInitialJobResources(new Map(newMap));
            } else {
                setJobResources(newMap);
                setInitialJobResources(new Map(newMap));
                setIsDirty(false);
            }
        });
        return () => unsub();
    }, [selectedJobId, setIsDirty]);

    const loadJob = (job: JobData) => {
        setSelectedJobId(job.id);
        setSelectedJobObj(job);
        setSearchParams({ jobId: job.id });
    };

    const getStateCallback = useCallback((id: string) => jobResources.has(id) ? true : undefined, [jobResources]);
    
    const handleToggle = useCallback((id: string, newValue: boolean | undefined) => {
        if (newValue === true) {
            // إضافة افتراضية (نطاق عام)
            setJobResources(prev => new Map(prev).set(id, { docId: null, scope: { scope_company_id: null, scope_section_id: null } }));
        } else {
            // إزالة
            setJobResources(prev => { const next = new Map(prev); next.delete(id); return next; });
        }
    }, []);

    // ✅ دالة حفظ النطاق (Scope)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleScopeSave = (newScope: any) => {
        if (activePermissionId) {
            setJobResources(prev => {
                const next = new Map(prev);
                const current = next.get(activePermissionId) || { docId: null };
                next.set(activePermissionId, { ...current, scope: newScope });
                return next;
            });
            setScopeDialogOpen(false);
            setActivePermissionId(null);
        }
    };

    const handleSave = async () => {
        if (!selectedJobId || !hasChanges) return;

        showActionLoading(t.saving);
        try {
            // أ) حذف الموارد القديمة
            const toRemovePromises: Promise<boolean>[] = [];
            initialJobResources.forEach((val, key) => {
                if (!jobResources.has(key) && val.docId) {
                    toRemovePromises.push(updateJobAccessResources(selectedJobId, {}, 'remove', val.docId));
                }
            });

            // ب) إضافة/تحديث الموارد
            const toAddPromises: Promise<boolean>[] = [];
            jobResources.forEach((val, key) => {
                const initial = initialJobResources.get(key);
                
                // إذا كان جديداً أو تغير النطاق
                if (!initial || JSON.stringify(initial.scope) !== JSON.stringify(val.scope)) {
                    const [type, id] = key.split(':');
                    
                    // تحويل النطاق إلى مصفوفات (Backend Format)
                    const backendScope = {
                        companies: val.scope.scope_company_id ? [val.scope.scope_company_id] : [],
                        sections: val.scope.scope_section_id ? [val.scope.scope_section_id] : [],
                        departments: []
                    };

                    const payload: ResourcePayload = {
                        service_id: type === 's' ? id : undefined,
                        sub_service_id: type === 'ss' ? id : undefined,
                        sub_sub_service_id: type === 'sss' ? id : undefined,
                        scope: backendScope // ✅ إرسال النطاق
                    };

                    // إذا كان تعديل لنطاق موجود، نحذف القديم (بسبب طريقة عمل Firestore Set مع Doc ID جديد)
                    if (val.docId) {
                        toRemovePromises.push(updateJobAccessResources(selectedJobId, {}, 'remove', val.docId));
                    }
                    toAddPromises.push(updateJobAccessResources(selectedJobId, payload, 'add'));
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

    const filteredJobs = jobs.filter(j => (j.name_ar?.includes(jobSearchTerm) || j.name_en?.includes(jobSearchTerm)));

    // ✅ دالة رسم زر النطاق (Render Prop)
    const renderScopeButton = useCallback((node: ServiceNode) => {
        const hasPerm = jobResources.has(node.id);
        if (!hasPerm) return null;

        const resource = jobResources.get(node.id);
        const scope = resource?.scope;
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
    }, [jobResources, t]);

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
            {/* ✅ نافذة تخصيص النطاق */}
            <ScopeConfigDialog 
                isOpen={scopeDialogOpen} 
                onClose={() => setScopeDialogOpen(false)} 
                onSave={handleScopeSave} 
                validCompanies={validCompanies} 
                validSections={validSections} 
                initialScope={activePermissionId ? jobResources.get(activePermissionId)?.scope : null} 
                t={t} 
                language={language} 
            />

            <AnimatePresence mode="wait">
                {!selectedJobId ? (
                    <motion.div key="select" variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-2 text-blue-400">
                                <ShieldCheckIcon className="w-8 h-8" />
                                <div><h2 className="text-xl font-bold">{t.pageTitle}</h2><p className="text-xs text-gray-400 mt-1">{t.pageDesc}</p></div>
                            </div>
                            <div className="my-6 border-t border-gray-700/50"></div>
                            <div className="relative mb-6">
                                <input type="text" placeholder={t.searchPlaceholder} value={jobSearchTerm} onChange={(e) => setJobSearchTerm(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg py-3 px-4 pl-10 focus:border-blue-500 transition-colors text-white" />
                                <MagnifyingGlassIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                            {filteredJobs.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredJobs.map(j => <JobCard key={j.id} job={j} language={language as any} onClick={() => loadJob(j)} />)}</div>
                            ) : (<div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-700 rounded-xl"><p>{t.noJobsFound}</p></div>)}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="editor" variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6 flex justify-between items-center shadow-lg">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                                    <BriefcaseIcon className="w-6 h-6 text-gray-100" />
                                </div>
                                <div><h2 className="text-lg font-bold text-white">{language === 'ar' ? selectedJobObj?.name_ar : selectedJobObj?.name_en}</h2><p className="text-xs text-blue-400 font-medium">{t.pageTitle}</p></div>
                            </div>
                            <button onClick={() => { setSelectedJobId(null); setIsDirty(false); setSearchParams({}); }} className="text-sm text-gray-400 hover:text-white hover:bg-gray-700 px-3 py-2 rounded-lg transition-all flex items-center gap-2">
                                <ArrowPathIcon className="w-4 h-4" /> {t.changeJob}
                            </button>
                        </div>

                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4">
                             <div className="relative">
                                <input type="text" placeholder={t.filterTreePlaceholder} value={treeSearchTerm} onChange={(e) => setTreeSearchTerm(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 px-4 pl-10 focus:border-blue-500 text-sm text-white" />
                                <AdjustmentsHorizontalIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        <div className="bg-gray-900/30 border border-gray-700 rounded-xl p-2 mb-8">
                            <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate">
                                {displayedTree.length > 0 ? displayedTree.map(node => (
                                    <ServiceTreeRow key={node.id} node={node} 
                                        getState={getStateCallback} 
                                        getJobState={() => false}
                                        getInitialState={() => initialJobResources.has(node.id)}
                                        onToggle={handleToggle} canEdit={canGrantResource} t={t} searchTerm={treeSearchTerm} rowType="job" 
                                        renderScopeButton={renderScopeButton} // ✅ تمرير دالة الرسم
                                    />
                                )) : <div className="text-center py-8 text-gray-500">لا توجد نتائج</div>}
                            </motion.div>
                        </div>
                        
                        <div className="flex justify-center pb-10 mt-12">
                            <button disabled={!hasChanges} onClick={() => showDialog({ variant: 'confirm', title: t.confirmSave, message: t.confirmSave, onConfirm: handleSave })} className={`w-full max-w-md font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all ${hasChanges ? 'bg-blue-500 text-white hover:scale-105 hover:bg-blue-600' : 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'}`}>
                                <CheckCircleIcon className="w-6 h-6" /> {t.save}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}