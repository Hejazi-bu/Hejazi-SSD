import React, { useState, useEffect, useMemo, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/UserContext';
import { Search } from 'lucide-react';
import { collection, query, onSnapshot, DocumentData, Timestamp, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
    fadeInVariants,
    staggeredContainerVariants,
    staggeredItemVariants,
    slideUpOverlayVariants,
    interactiveItemVariants
} from '../../lib/animations';
import { Link } from 'react-router-dom';
import { 
    EyeIcon, 
    ExclamationTriangleIcon, 
    CheckBadgeIcon,
    ClockIcon,
    ListBulletIcon,
    XMarkIcon
} from "@heroicons/react/24/outline";

// --- الأنواع ---
interface TaskDoc extends DocumentData {
    id: string;
    task_id: string;
    service_id: number;
    sa_id: number;
    parent_entity_id: string;
    created_at: Timestamp;
}
interface EnrichedTask extends DocumentData {
    id: string;
    sa_id: number;
    sequence_number: number;
    service_name: string;
    action_name: string;
    created_at: Timestamp;
}
interface SimpleService { label_ar?: string; label_en?: string; }
interface SimpleSubAction { label_ar?: string; label_en?: string; }
interface SimpleEvaluation { sequence_number?: number; }


// --- المكونات المساعدة ---
const formatNumberEn = (value: number | string): string => {
    try {
        return new Intl.NumberFormat('en-US', { useGrouping: false }).format(Number(value));
    } catch {
        return String(value);
    }
};

function InfoItem({ Icon, label, value, colorClass = "text-gray-300" }: { Icon: React.ElementType, label: string, value: React.ReactNode, colorClass?: string }) {
    return (
        <div className="flex flex-col text-start">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold mb-1">
                <Icon className="w-4 h-4" />
                <span>{label}</span>
            </div>
            <span className={`font-bold text-base break-words ${colorClass}`}>{value}</span>
        </div>
    );
}

const translations = {
    ar: { 
        tasks: "المهام المعلقة", 
        searchPlaceholder: "ابحث عن مهمة...", 
        loading: "جاري تحميل المهام...", 
        noResults: "لم يتم العثور على مهام مطابقة.",
        noTasks: "لا توجد مهام معلقة لديك حالياً.",
        viewAll: "عرض كل المهام",
        seqNo: "رقم المرجع",
        service: "الخدمة",
        actionRequired: "الإجراء المطلوب",
        assignedDate: "تاريخ الإحالة",
        viewDetails: "عرض تفاصيل المهمة",
    },
    en: { 
        tasks: "Pending Tasks", 
        searchPlaceholder: "Search for a task...", 
        loading: "Loading tasks...", 
        noResults: "No matching tasks found.",
        noTasks: "You have no pending tasks.",
        viewAll: "View All Tasks",
        seqNo: "Ref. No.",
        service: "Service",
        actionRequired: "Action Required",
        assignedDate: "Assigned Date",
        viewDetails: "View Task Details",
    },
};

interface TasksOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TasksOverlay = forwardRef<HTMLDivElement, TasksOverlayProps>(({ isOpen, onClose }, ref) => {
    const { language } = useLanguage();
    const { user } = useAuth();
    const [records, setRecords] = useState<EnrichedTask[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const t = translations[language];

    useEffect(() => {
        if (!isOpen) {
            document.body.style.overflow = 'auto';
            return;
        }
        document.body.style.overflow = 'hidden';

        if (!user) {
            setIsLoadingData(false);
            return;
        }

        const tasksQuery = query(
            collection(db, "tasks_queue"),
            where("assigned_to_user_ids", "array-contains", user.id),
            orderBy("created_at", "desc") 
        );

        const unsubscribe = onSnapshot(tasksQuery, async (snapshot) => {
            setIsLoadingData(true);
            try {
                const [servicesSnap, subActionsSnap, evaluationsSnap] = await Promise.all([
                    getDocs(collection(db, "services")),
                    getDocs(collection(db, "sub_sub_services")),
                    getDocs(collection(db, "security_evaluations"))
                ]);
                
                const servicesMap = new Map(servicesSnap.docs.map(doc => [doc.id, doc.data() as SimpleService]));
                const subActionsMap = new Map(subActionsSnap.docs.map(doc => [doc.id, doc.data() as SimpleSubAction]));
                const evaluationsMap = new Map(evaluationsSnap.docs.map(doc => [doc.id, doc.data() as SimpleEvaluation]));

                const enrichedTasks: EnrichedTask[] = snapshot.docs.map(docSnap => {
                    const task = docSnap.data() as TaskDoc;
                    const service = servicesMap.get(String(task.service_id));
                    const subAction = subActionsMap.get(String(task.sa_id));
                    const evaluation = evaluationsMap.get(task.parent_entity_id);

                    return {
                        id: task.id,
                        sa_id: task.sa_id,
                        sequence_number: evaluation?.sequence_number || 0,
                        service_name: (language === 'ar' ? service?.label_ar : service?.label_en) || 'Unknown Service',
                        action_name: (language === 'ar' ? subAction?.label_ar : subAction?.label_en) || 'Unknown Action',
                        created_at: task.created_at,
                    };
                });
                setRecords(enrichedTasks);
            } catch (err) {
                console.error("Error processing tasks in overlay:", err);
            } finally {
                setIsLoadingData(false);
            }
        });

        return () => { unsubscribe(); document.body.style.overflow = 'auto'; };
    }, [isOpen, user, language]);

    const handleViewTask = useCallback((task: EnrichedTask) => {
        const newEvaluationPath = '/companies/evaluation/new'; 
        let path = '/';
        switch(task.sa_id) {
            case 1: path = newEvaluationPath; break;
            case 2: path = `/companies/evaluation/details/${task.sequence_number}`; break;
            case 3: path = `/companies/evaluation/edit/${task.sequence_number}`; break;
            default: path = `/companies/evaluation/details/${task.sequence_number}`; break;
        }
        window.open(path, '_blank');
        onClose(); // إغلاق اللوحة بعد فتح الرابط
    }, [onClose]);

    const filteredRecords = useMemo(() => {
        if (searchTerm.trim() === '') return records;
        const lowercasedFilter = searchTerm.toLowerCase();
        return records.filter(record => 
            record.service_name.toLowerCase().includes(lowercasedFilter) ||
            record.action_name.toLowerCase().includes(lowercasedFilter) ||
            record.sequence_number.toString().includes(lowercasedFilter)
        );
    }, [records, searchTerm]);

    return (
        <motion.div ref={ref} variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="fixed inset-0 bg-black/50 z-50" onClick={onClose}>
            <motion.div
                variants={slideUpOverlayVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                className="bg-black/20 backdrop-blur-sm border-t border-white/10 w-full h-full shadow-lg flex flex-col p-4 sm:p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ListBulletIcon className="text-[#FFD700] w-6 h-6" />
                        {t.tasks}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><XMarkIcon className="text-white w-6 h-6" /></button>
                </div>
                <div className="relative w-full mb-4 flex-shrink-0">
                    <input type="text" placeholder={t.searchPlaceholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-800/70 text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FFD700] border border-transparent focus:border-[#FFD700]" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>

                <div className="flex-grow min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                    {isLoadingData ? (
                        <div className="flex justify-center items-center h-full text-gray-400"><p>{t.loading}</p></div>
                    ) : (
                        <>
                            {filteredRecords.length > 0 ? (
                                <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" className="space-y-3">
                                    {filteredRecords.map(record => {
                                        const dateTimeOptions: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'medium', numberingSystem: 'latn' };
                                        return (
                                            <motion.div key={record.id} layout variants={staggeredItemVariants}>
                                                <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-lg p-4 shadow-md border border-gray-700 flex flex-col gap-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-white">{record.action_name}</span>
                                                            <span className="text-sm text-gray-400">{record.service_name}</span>
                                                        </div>
                                                        <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" onClick={() => handleViewTask(record)} title={t.viewDetails} className="p-2 text-blue-400 hover:text-blue-300 transition-colors">
                                                            <EyeIcon className="w-5 h-5" />
                                                        </motion.button>
                                                    </div>
                                                    <div className="border-t border-gray-700 pt-3 grid grid-cols-2 gap-4">
                                                        <InfoItem Icon={CheckBadgeIcon} label={t.seqNo} value={formatNumberEn(record.sequence_number || 'N/A')} />
                                                        <InfoItem Icon={ClockIcon} label={t.assignedDate} value={record.created_at?.toDate().toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', dateTimeOptions) || 'N/A'} />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>
                            ) : (
                                <div className="flex justify-center items-center h-full text-gray-500">
                                    <p>{searchTerm ? t.noResults : t.noTasks}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="pt-4 mt-auto flex-shrink-0 border-t border-white/10">
                    <Link to="/tasks/pending" onClick={onClose} className="block w-full text-center bg-[#FFD700] text-black px-6 py-2.5 rounded-lg font-bold transition-transform hover:scale-105">
                        {t.viewAll}
                    </Link>
                </div>
            </motion.div>
        </motion.div>
    );
});

