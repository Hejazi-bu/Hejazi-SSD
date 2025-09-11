import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { useAuth } from '../../components/contexts/UserContext';
import { useLanguage } from '../../components/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Power, LoaderCircle, User, Save, Search, Filter, Users } from 'lucide-react';
import AdminSectionLayout from '../../layouts/AdminSectionLayout';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { usePrompt } from '../../hooks/usePrompt';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../../components/LoadingScreen';

// --- ✅ تم تصحيح أنواع البيانات هنا ---
type UserForExceptions = {
    id: string;
    name_ar: string | null;
    name_en: string | null;
    job_id: number | null;
    app_exception: boolean;
};

type Job = {
    id: number;
    name_ar: string;
    name_en: string;
};

// --- المكونات المساعدة ---
const AdminPageLayout = ({ children, title }: { children: React.ReactNode, title: string }) => (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 text-white">
        <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold mb-8 text-[#FFD700]"
        >
            {title}
        </motion.h1>
        {children}
    </div>
);

const UserCard = ({ user, isException, onToggle, language, jobs }: { user: UserForExceptions, isException: boolean, onToggle: (id: string) => void, language: 'ar' | 'en', jobs: Job[] }) => {
    const name = language === 'ar' ? user.name_ar : user.name_en;
    const job = jobs.find(j => j.id === user.job_id);
    const jobName = job ? (language === 'ar' ? job.name_ar : job.name_en) : 'No Job Assigned';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-lg flex items-center justify-between transition-colors duration-300 ${isException ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-800/50 border border-gray-700'}`}
        >
            <div>
                <p className="font-bold text-white">{name}</p>
                <p className="text-xs text-gray-400">{jobName}</p>
            </div>
            <button
                onClick={() => onToggle(user.id)}
                className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${isException ? 'bg-green-500' : 'bg-gray-600'}`}
            >
                <motion.span layout className={`inline-block w-4 h-4 transform bg-white rounded-full ${isException ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </motion.div>
    );
};

const translations = {
    ar: {
        pageTitle: "إدارة أمان النظام", mainSwitchLabel: "حالة النظام العامة", mainSwitchDesc: "عند الإيقاف، لن يتمكن أحد من الدخول باستثناء الحسابات المستثناة.", statusActive: "النظام يعمل", statusInactive: "النظام متوقف", saving: "جاري الحفظ...", saveSuccess: "تم حفظ التغييرات بنجاح.", saveError: "فشل حفظ التغييرات.", noPermission: "ليس لديك صلاحية للوصول إلى هذه الصفحة.", exceptionsManagement: "إدارة استثناءات التطبيق", exceptionsDesc: "حدد المستخدمين المسموح لهم بالدخول أثناء إيقاف النظام.", noUsers: "لا يوجد مستخدمون لعرضهم.", saveChanges: "حفظ التغييرات", searchByName: "بحث بالاسم...", filterByJob: "فلترة حسب الوظيفة", allJobs: "جميع الوظائف", selectAll: "تحديد الكل (المعروض)", deselectAll: "إلغاء تحديد الكل (المعروض)",
    },
    en: {
        pageTitle: "System Security Management", mainSwitchLabel: "Overall System Status", mainSwitchDesc: "When inactive, only excepted accounts can log in.", statusActive: "System Active", statusInactive: "System Inactive", saving: "Saving...", saveSuccess: "Changes saved successfully.", saveError: "Failed to save changes.", noPermission: "You do not have permission to access this page.", exceptionsManagement: "App Exception Management", exceptionsDesc: "Select users permitted to log in while the system is inactive.", noUsers: "No users to display.", saveChanges: "Save Changes", searchByName: "Search by name...", filterByJob: "Filter by Job", allJobs: "All Jobs", selectAll: "Select All (Visible)", deselectAll: "Deselect All (Visible)",
    }
};

const AppSecurityPage = () => {
    const { language } = useLanguage();
    const { hasPermission, user } = useAuth();

    const [initialSystemStatus, setInitialSystemStatus] = useState(true);
    const [isSystemActive, setIsSystemActive] = useState(true);
    const [allUsers, setAllUsers] = useState<UserForExceptions[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [initialExceptionIds, setInitialExceptionIds] = useState<Set<string>>(new Set());
    const [exceptionUserIds, setExceptionUserIds] = useState<Set<string>>(new Set());

    const [searchFilter, setSearchFilter] = useState('');
    const [jobFilter, setJobFilter] = useState<number | 'all'>('all');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const t = translations[language];

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`http://localhost:3001/api/admin/app-security`);
                const data = await response.json();

                if (data.success) {
                    setInitialSystemStatus(data.appStatus.is_allowed);
                    setIsSystemActive(data.appStatus.is_allowed);
                    setAllUsers(data.users);
                    setJobs(data.jobs);

                    // ✅ هنا تم تصحيح الأخطاء باستخدام `as string` لضمان النوع
                    const exceptions = new Set<string>(data.users.filter((u: any) => u.app_exception).map((u: any) => u.id as string));
                    setInitialExceptionIds(exceptions);
                    setExceptionUserIds(exceptions);
                } else {
                    console.error("Error fetching data:", data.message);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        if (hasPermission('sss:90101')) fetchData(); else setIsLoading(false);
    }, [hasPermission, user?.id]);

    const filteredUsers = useMemo(() => {
        return allUsers.filter(u => {
            const name = (language === 'ar' ? u.name_ar : u.name_en) || '';
            const matchesSearch = name.toLowerCase().includes(searchFilter.toLowerCase());
            const matchesJob = jobFilter === 'all' || u.job_id === jobFilter;
            return matchesSearch && matchesJob;
        });
    }, [allUsers, searchFilter, jobFilter, language]);

    const handleExceptionToggle = (userId: string) => {
        setExceptionUserIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) newSet.delete(userId);
            else newSet.add(userId);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const filteredIds = new Set<string>(filteredUsers.map(u => u.id as string));
        setExceptionUserIds(prev => new Set([...prev, ...filteredIds]));
    };
    const handleDeselectAll = () => {
        const filteredIds = new Set<string>(filteredUsers.map(u => u.id as string));
        setExceptionUserIds(prev => new Set([...prev].filter(id => !filteredIds.has(id))));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const usersToEnableException = Array.from(exceptionUserIds).filter(id => !initialExceptionIds.has(id));
            const usersToDisableException = Array.from(initialExceptionIds).filter(id => !exceptionUserIds.has(id));

            const payload = {
                isSystemActive,
                usersToEnableException,
                usersToDisableException
            };

            const response = await fetch('http://localhost:3001/api/admin/app-security/save-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.success) {
                alert(t.saveSuccess);
                setInitialSystemStatus(isSystemActive);
                setInitialExceptionIds(new Set(exceptionUserIds));
            } else {
                alert(t.saveError);
            }
        } catch (error) {
            console.error("Error saving changes:", error);
            alert(t.saveError);
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = useMemo(() => {
        if (initialSystemStatus !== isSystemActive) return true;
        const initialIdsString = Array.from(initialExceptionIds).sort().join(',');
        const currentIdsString = Array.from(exceptionUserIds).sort().join(',');
        return initialIdsString !== currentIdsString;
    }, [isSystemActive, exceptionUserIds, initialSystemStatus, initialExceptionIds]);

    if (!hasPermission('sss:90101')) {
        return <div className="text-center text-red-500 p-10">{t.noPermission}</div>;
    }

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><LoaderCircle className="animate-spin text-[#FFD700]" size={48} /></div>;
    }

    return (
        <AdminPageLayout title={t.pageTitle}>
            <div className="space-y-6">
                <AnimatePresence>
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-3"><Shield size={24} className={isSystemActive ? "text-green-400" : "text-red-400"} />{t.mainSwitchLabel}</h2>
                                <p className="text-gray-400 text-sm mt-2">{t.mainSwitchDesc}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`font-bold text-lg ${isSystemActive ? "text-green-400" : "text-red-400"}`}>{isSystemActive ? t.statusActive : t.statusInactive}</span>
                                <button onClick={() => setIsSystemActive(!isSystemActive)} className={`relative inline-flex items-center h-8 w-16 rounded-full transition-colors ${isSystemActive ? 'bg-green-500' : 'bg-gray-600'}`}>
                                    <motion.span layout className={`inline-block w-6 h-6 transform bg-white rounded-full ${isSystemActive ? 'translate-x-9' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {!isSystemActive && (
                        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-1 bg-gray-800/50 border border-gray-700 rounded-lg p-4 h-fit">
                                    <h3 className="font-bold mb-4 flex items-center gap-2"><Filter size={18} /> {t.filterByJob}</h3>
                                    <select value={jobFilter} onChange={e => setJobFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="w-full bg-gray-800 rounded-md py-2 px-3 appearance-none focus:ring-yellow-500 border-gray-700">
                                        <option value="all">{t.allJobs}</option>
                                        {jobs.map(job => (<option key={job.id} value={job.id}>{language === 'ar' ? job.name_ar : job.name_en}</option>))}
                                    </select>
                                    <div className="relative mt-4">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="text" placeholder={t.searchByName} value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="w-full bg-gray-800 rounded-md py-2 pl-10 pr-4 focus:ring-yellow-500 border-gray-700" />
                                    </div>
                                    <div className="flex gap-2 mt-4"><button onClick={handleSelectAll} className="text-xs flex-1 bg-blue-600/50 px-3 py-2 rounded-md hover:bg-blue-500/50">{t.selectAll}</button><button onClick={handleDeselectAll} className="text-xs flex-1 bg-red-600/50 px-3 py-2 rounded-md hover:bg-red-500/50">{t.deselectAll}</button></div>
                                </div>

                                <div className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                    <h3 className="font-bold mb-4 flex items-center gap-2"><Users size={18} /> {t.exceptionsManagement}</h3>
                                    <div className="max-h-96 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                        {filteredUsers.length > 0 ? (
                                            filteredUsers.map(u => (<UserCard key={u.id} user={u} isException={exceptionUserIds.has(u.id)} onToggle={handleExceptionToggle} language={language} jobs={jobs} />))
                                        ) : <p className="text-gray-500 text-center py-8">{t.noUsers}</p>}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {hasChanges && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="sticky bottom-6">
                            <div className="max-w-7xl mx-auto flex justify-end">
                                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-3 font-bold bg-[#FFD700] text-black rounded-lg hover:bg-yellow-400 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all shadow-lg shadow-black/50">
                                    {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
                                    {isSaving ? t.saving : t.saveChanges}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AdminPageLayout>
    );
};

export default AppSecurityPage;