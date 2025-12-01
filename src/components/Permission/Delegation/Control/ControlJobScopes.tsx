// src/components/Permission/Delegation/Control/ControlJobScopes.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/UserContext';
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
    MagnifyingGlassIcon, BriefcaseIcon, ShieldCheckIcon, CheckCircleIcon, 
    ArrowPathIcon, FunnelIcon
} from "@heroicons/react/24/outline";
import { getFirestore, collection, getDocs, onSnapshot, query, where } from "firebase/firestore";

const firestore = getFirestore();

interface BasicEntity { id: string; name_ar: string; name_en: string; [key: string]: unknown; }

// ... (Translations remain same) ...
const translations = {
    ar: {
        pageTitle: "نظام تفويض التحكم (نطاق الوظائف)",
        pageDesc: "تحديد النطاقات (الشركات/الإدارات) التي تملك هذه الوظيفة حق 'التحكم' فيها.",
        selectJobTitle: "اختر الوظيفة المانحة",
        searchPlaceholder: "ابحث عن وظيفة...",
        noJobsFound: "لا توجد وظائف متاحة.",
        save: "حفظ التغييرات",
        saving: "جاري الحفظ...",
        successTitle: "تم بنجاح",
        successMessage: "تم تحديث نطاق التحكم للوظيفة.",
        errorTitle: "خطأ",
        errorMessage: "حدث خطأ أثناء الحفظ.",
        confirmSave: "هل أنت متأكد من حفظ قواعد النطاق؟",
        changeJob: "تغيير الوظيفة",
        loadingData: "جاري تحميل بيانات الهيكل التنظيمي...",
        currentRules: "قواعد نطاق التحكم الحالية",
        conflictTitle: "تحديث خارجي",
        conflictMessage: "تم تعديل القواعد من مصدر آخر. هل تريد تحميل الجديد؟",
        loadNew: "تحميل الجديد",
        ignore: "تجاهل"
    },
    en: {
        pageTitle: "Control Delegation (Job Scopes)",
        pageDesc: "Define scopes (Companies/Departments) this job has 'Control' authority over.",
        selectJobTitle: "Select Granting Job",
        searchPlaceholder: "Search job...",
        noJobsFound: "No jobs found.",
        save: "Save Changes",
        saving: "Saving...",
        successTitle: "Success",
        successMessage: "Job control scope updated.",
        errorTitle: "Error",
        errorMessage: "Error saving changes.",
        confirmSave: "Save scope rules?",
        changeJob: "Change Job",
        loadingData: "Loading organizational structure...",
        currentRules: "Current Control Scopes",
        conflictTitle: "External Update",
        conflictMessage: "Data updated externally. Load new data?",
        loadNew: "Load New",
        ignore: "Ignore"
    }
};

const JobCard = ({ job, onClick, language }: { job: BasicEntity, onClick: () => void, language: string }) => (
    <motion.div 
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClick}
        className="bg-gray-800/50 border border-gray-700 hover:border-red-500/50 rounded-xl p-4 cursor-pointer transition-all group"
    >
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 group-hover:text-red-400 transition-colors border border-gray-600">
                <BriefcaseIcon className="w-6 h-6" />
            </div>
            <div>
                <h3 className="font-bold text-gray-100">{language === 'ar' ? job.name_ar : job.name_en}</h3>
                <p className="text-xs text-gray-500">ID: {job.id}</p>
            </div>
        </div>
    </motion.div>
);

export default function ControlJobScopes() {
    const { language } = useLanguage();
    const t = translations[language as keyof typeof translations];
    const { canManageScope } = useAuth();
    const { updateJobControlScope } = useAccessManager();
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const { setIsDirty } = useUnsavedChanges();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [searchParams, setSearchParams] = useSearchParams();

    const [jobs, setJobs] = useState<BasicEntity[]>([]);
    const [companies, setCompanies] = useState<BasicEntity[]>([]);
    const [sections, setSections] = useState<BasicEntity[]>([]);

    const [validCompanies, setValidCompanies] = useState<BasicEntity[]>([]);
    const [validSections, setValidSections] = useState<BasicEntity[]>([]);

    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [selectedJobObj, setSelectedJobObj] = useState<BasicEntity | null>(null);
    const [jobSearchTerm, setJobSearchTerm] = useState('');
    
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
                const [jobsSnap, companiesSnap, sectionsSnap] = await Promise.all([
                    getDocs(collection(firestore, 'jobs')),
                    getDocs(query(collection(firestore, 'companies'), where('is_allowed', '==', true))),
                    getDocs(collection(firestore, 'sections'))
                ]);

                const allJobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BasicEntity));
                setJobs(allJobs.filter(j => canManageScope('control', { jobId: j.id })));

                setCompanies(companiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as BasicEntity)));
                setSections(sectionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BasicEntity)));

            } catch (error) {
                console.error("Error fetching structure data:", error);
                showDialog({ title: t.errorTitle, message: "فشل تحميل بيانات الهيكل التنظيمي", variant: 'error' });
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, [canManageScope, t.errorTitle, showDialog]);

    // 2. ✅ Fetch Distribution Logic (نفس المنطق)
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
                    const filteredComps = companies.filter(c => compIds.has(c.id));
                    setValidCompanies(filteredComps);
                } else {
                    setValidCompanies([]);
                }

                if (sectIds.size > 0) {
                    const filteredSects = sections.filter(s => sectIds.has(s.id));
                    setValidSections(filteredSects);
                } else {
                    setValidSections([]);
                }

            } catch (error) {
                console.error("Error fetching job distribution:", error);
            }
        };

        fetchDistribution();
    }, [selectedJobId, companies, sections]);

    // --- Dirty State ---
    const hasChanges = useMemo(() => {
        return JSON.stringify(localRules) !== JSON.stringify(existingRules);
    }, [localRules, existingRules]);

    useEffect(() => setIsDirty(hasChanges), [hasChanges, setIsDirty]);

    const isDirtyRef = useRef(hasChanges);
    useEffect(() => { isDirtyRef.current = hasChanges; }, [hasChanges]);

    // 3. Listen to Rules
    useEffect(() => {
        if (!selectedJobId) return;
        const q = query(collection(firestore, 'control_job_scopes'), where('job_id', '==', selectedJobId));
        
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
    }, [selectedJobId, setIsDirty, t, existingRules, showDialog]);

    const loadJob = (job: BasicEntity) => {
        setSelectedJobId(job.id);
        setSelectedJobObj(job);
        setSearchParams({ jobId: job.id });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAddRule = (newRule: any) => {
        setLocalRules(prev => [...prev, { ...newRule, isNew: true }]);
    };

    const handleRemoveRule = (index: number) => {
        setLocalRules(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!selectedJobId || !hasChanges) return;
        showActionLoading(t.saving);
        try {
            const rulesToDelete = existingRules.filter(ex => !localRules.some(loc => loc.docId === ex.docId));
            const rulesToAdd = localRules.filter(loc => !loc.docId);

            const deletePromises = rulesToDelete.map(rule => updateJobControlScope(selectedJobId, {}, 'remove', rule.docId));
            const addPromises = rulesToAdd.map(rule => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { isNew, docId, ...cleanRule } = rule;
                const payload: ScopePayload = cleanRule; 
                return updateJobControlScope(selectedJobId, payload, 'add');
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

    const filteredJobs = jobs.filter(j => (j.name_ar?.includes(jobSearchTerm) || j.name_en?.includes(jobSearchTerm)));

    if (isLoadingData) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loadingData}</div>;

    return (
        <div className="w-full flex flex-col min-h-screen">
            <AnimatePresence mode="wait">
                {!selectedJobId ? (
                    <motion.div key="select" variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-2 text-red-400"><ShieldCheckIcon className="w-8 h-8" /><div><h2 className="text-xl font-bold">{t.pageTitle}</h2><p className="text-xs text-gray-400 mt-1">{t.pageDesc}</p></div></div>
                            <div className="my-6 border-t border-gray-700/50"></div>
                            <div className="relative mb-6"><input type="text" placeholder={t.searchPlaceholder} value={jobSearchTerm} onChange={(e) => setJobSearchTerm(e.target.value)} className="w-full bg-gray-900/50 border border-gray-600 rounded-lg py-3 px-4 pl-10 focus:border-red-500 transition-colors text-white" /><MagnifyingGlassIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" /></div>
                            {filteredJobs.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredJobs.map(j => <JobCard key={j.id} job={j} language={language as any} onClick={() => loadJob(j)} />)}</div>
                            ) : <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-700 rounded-xl"><p>{t.noJobsFound}</p></div>}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="editor" variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1">
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6 flex justify-between items-center shadow-lg">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]"><BriefcaseIcon className="w-6 h-6 text-gray-100" /></div>
                                <div><h2 className="text-lg font-bold text-white">{language === 'ar' ? selectedJobObj?.name_ar : selectedJobObj?.name_en}</h2><p className="text-xs text-red-400 font-medium">{t.pageTitle}</p></div>
                            </div>
                            <button onClick={() => { setSelectedJobId(null); setIsDirty(false); setSearchParams({}); }} className="text-sm text-gray-400 hover:text-white hover:bg-gray-700 px-3 py-2 rounded-lg transition-all flex items-center gap-2"><ArrowPathIcon className="w-4 h-4" /> {t.changeJob}</button>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="xl:col-span-3 space-y-6">
                                {/* ✅ نمرر القوائم المفلترة (validCompanies, validSections) */}
                                <ScopeRuleBuilder
                                    jobs={jobs}
                                    companies={validCompanies}
                                    sections={validSections}
                                    onAddRule={handleAddRule}
                                    t={t}
                                />
                                <div className="flex items-center gap-3 my-4"><div className="h-px bg-gray-700 flex-1"></div><span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><FunnelIcon className="w-3 h-3" /> {t.currentRules}</span><div className="h-px bg-gray-700 flex-1"></div></div>
                                <ScopeList rules={localRules} onRemove={handleRemoveRule} jobs={jobs} companies={companies} sections={sections} t={t} />
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