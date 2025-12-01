// src/components/GuardsRating/EvaluationDetails.tsx
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {
    staggeredContainerVariants,
    staggeredItemVariants,
    interactiveItemVariants,
    fadeInVariants,
    slideUpOverlayVariants,
    directionalSlideVariants
} from "../../lib/animations";
import { useAuth, usePermissionNotification } from "../contexts/UserContext";
import { useLanguage } from "../contexts/LanguageContext";
import { usePageLoading } from "../contexts/LoadingContext";
import { useActionLoading } from "../contexts/ActionLoadingContext";
import MainLayout from "../layouts/MainLayout";
import { collection, query, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, where, onSnapshot, doc, getDoc, limit, Timestamp, orderBy, documentId, getDocs } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import {
    StarIcon, CheckCircleIcon, XCircleIcon, ArrowUturnLeftIcon, PencilSquareIcon,
    ArrowDownTrayIcon, PrinterIcon, ShareIcon, BuildingOfficeIcon, DocumentTextIcon,
    ShieldCheckIcon, UsersIcon, CalendarDaysIcon, ClockIcon, HashtagIcon, InformationCircleIcon,
    ArchiveBoxXMarkIcon, BriefcaseIcon, ChatBubbleLeftEllipsisIcon, UserIcon as UserOutlineIcon, PlusCircleIcon, CheckBadgeIcon, MagnifyingGlassIcon, XMarkIcon, EyeIcon, ArrowPathIcon,
    ArrowLeftIcon, ArrowRightIcon
} from "@heroicons/react/24/outline";
import { useDialog } from "../contexts/DialogContext";
import { useParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { UserProfileOverlay } from "../Users/UserProfileOverlay";
import { usePDF } from '@react-pdf/renderer';
import EvaluationPDF from './EvaluationPDF';
import { getClientContext } from '../../lib/clientContext';
import { cleanText } from "../../utils/textUtils";

// --- الأنواع والمحولات ---
type EvaluationStatus = 'Needs Revision' | 'Awaiting Approval' | 'Approved' | 'Rejected';
interface QuestionDetail { question_id: string; rating: number; note: string; question_text_ar: string; question_text_en: string; }
interface CompanyDoc extends DocumentData { id: string; name_ar: string; name_en: string; }
interface EvaluationDetailsDoc extends DocumentData { id: string; summary: string; overall_score: number; details: QuestionDetail[]; evaluator_id: string; evaluator_name?: string; evaluator_photo?: string; evaluation_year: number; evaluation_month: number; }
interface EvaluationDoc extends DocumentData {
    id: string; company_id: string; latest_version_id: string; status: EvaluationStatus;
    sequence_number: number; historical_contract_no?: string; historical_guard_count?: number;
    historical_violations_count?: number; created_at?: Timestamp; updated_at?: Timestamp;
    evaluation_year: number;
    evaluation_month: number;
}
interface TaskDoc extends DocumentData { id: string; task_id: string; parent_entity_id: string; }
interface ActionHistoryItem {
    id: string; user_name: string; user_avatar_url: string; job_title: string;
    action_key: string; timestamp: Date; notes?: string; actor: UserDoc | null;
    signature_url?: string; // <--- أضف هذا السطر
    seal_url?: string;      // <--- أضف هذا السطر
}
interface UserDoc extends DocumentData { id: string; name_ar?: string; name_en?: string; avatar_url?: string; job_id?: string; name?: string; job?: { name_ar: string; name_en: string; }; signature_url?: string; stamp_url?: string; }
interface JobDoc extends DocumentData { id: string; name_ar: string; name_en: string; }

const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({ toFirestore: (data: T): DocumentData => data, fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T) });
const evaluationConverter = createConverter<EvaluationDoc>();
const evaluationDetailsConverter = createConverter<EvaluationDetailsDoc>();
const taskConverter = createConverter<TaskDoc>();
const companyConverter = createConverter<CompanyDoc>();
const userConverter = createConverter<UserDoc>();
const jobConverter = createConverter<JobDoc>();

// --- المكونات الفرعية للعرض ---
const NoteDisplay = ({ text }: { text: string }) => {
    if (!text || text.trim() === '') return null;
    return (
        <div className="mt-2 flex items-start gap-2.5">
            <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-400 italic whitespace-pre-wrap">{text}</p>
        </div>
    );
};
const DefaultAvatarIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
    <div className={`flex items-center justify-center bg-gray-700 w-full h-full`}>
        <UserOutlineIcon className={`${className} text-gray-400`} />
    </div>
);
const UsersListOverlay = ({ isOpen, onClose, title, users, onUserClick, onRefresh }: { isOpen: boolean; onClose: () => void; title: string; users: UserDoc[]; onUserClick: (user: UserDoc) => void; onRefresh: () => void; }) => {
    const { language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    useEffect(() => { if (isOpen) setSearchTerm('') }, [isOpen]);
    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        const lowercasedTerm = searchTerm.toLowerCase();
        return users.filter(user =>
            (user.name_ar && user.name_ar.toLowerCase().includes(lowercasedTerm)) ||
            (user.name_en && user.name_en.toLowerCase().includes(lowercasedTerm)) ||
            (user.job?.name_ar && user.job.name_ar.toLowerCase().includes(lowercasedTerm)) ||
            (user.job?.name_en && user.job.name_en.toLowerCase().includes(lowercasedTerm))
        );
    }, [users, searchTerm]);
    const t = language === 'ar' ? { search: 'ابحث بالاسم أو المسمى الوظيفي...', noUsers: 'لم يتم العثور على مستخدمين.', refresh: 'تحديث' } : { search: 'Search by name or job title...', noUsers: 'No users found.', refresh: 'Refresh' };
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="fixed inset-0 bg-black/50 z-50" onClick={onClose}>
                    <motion.div variants={slideUpOverlayVariants} initial="initial" animate="animate" exit="exit" transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                        className="bg-black/20 backdrop-blur-sm border-t border-white/10 w-full h-full shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="relative flex items-center justify-between p-4 sm:p-6 flex-shrink-0 border-b border-gray-800">
                            <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" title={t.refresh} className="p-2 rounded-full text-gray-300 hover:bg-gray-700 hover:text-white transition-colors z-10" onClick={onRefresh}><ArrowPathIcon className="w-5 h-5" /></motion.button>
                            <h2 className="text-lg font-bold text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{title}</h2>
                            <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors z-10"><XMarkIcon className="text-white w-6 h-6" /></motion.button>
                        </div>
                        <div className="p-4 flex-shrink-0 border-b border-gray-800">
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 rtl:left-auto rtl:right-3 -translate-y-1/2" />
                                <input type="text" placeholder={t.search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-700 py-2 pl-10 pr-3 rtl:pr-10 rtl:pl-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] transition-colors" />
                            </div>
                        </div>
                        <div className="flex-grow min-h-0 overflow-y-auto">
                            <motion.div className="px-4 sm:px-6 py-6 space-y-3" variants={staggeredContainerVariants} initial="initial" animate="animate">
                                <AnimatePresence>
                                    {filteredUsers.length > 0 ? filteredUsers.map(u => (
                                        <motion.div key={u.id} layout variants={staggeredItemVariants} exit={{ opacity: 0, y: -10 }} className="bg-gray-900/50 p-3 rounded-lg flex items-center justify-between gap-4 border border-transparent">
                                            <div className="flex items-center gap-3">
                                                {u.avatar_url ? <img src={u.avatar_url} alt={u.name_ar || ''} className="w-10 h-10 rounded-full object-cover aspect-square shrink-0" /> : <div className="w-10 h-10 rounded-full shrink-0 aspect-square overflow-hidden"><DefaultAvatarIcon className="w-6 h-6" /></div>}
                                                <div>
                                                    <p className="font-semibold text-white">{language === 'ar' ? u.name_ar : u.name_en}</p>
                                                    <p className="text-xs text-gray-400">{language === 'ar' ? u.job?.name_ar : u.job?.name_en}</p>
                                                </div>
                                            </div>
                                            <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" onClick={() => onUserClick(u)} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white"><EyeIcon className="w-5 h-5" /></motion.button>
                                        </motion.div>
                                    )) : <p className="text-center text-gray-500">{t.noUsers}</p>}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
function InfoCard({ children, ...props }: { children: React.ReactNode, title: string }) {
    return (
        <motion.div variants={{ ...staggeredItemVariants, ...interactiveItemVariants }} whileHover="hover" className="bg-gray-900/50 rounded-xl p-5 border border-gray-700/50">
            <h2 className="text-lg font-bold text-[#FFD700] border-b-2 border-gray-700 pb-2 mb-4">{props.title}</h2>
            <div className="grid gap-4 md:grid-cols-2">{children}</div>
        </motion.div>
    );
}
function InfoItem({ Icon, label, value }: { Icon: React.ElementType, label: string; value: React.ReactNode; }) {
    return (
        <div className="flex items-start gap-3">
            <div className="bg-gray-800 p-2 rounded-lg mt-1"><Icon className="w-5 h-5 text-gray-400" /></div>
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                <div className="text-base font-semibold text-gray-100 break-words">{value}</div>
            </div>
        </div>
    );
}
const EvaluationStepper = ({ status, onStepClick }: { status: EvaluationStatus, onStepClick: (index: number, title: string) => void }) => {
    const { language } = useLanguage();
    const isRevisionState = status === 'Needs Revision';
    const stepsConfig = useMemo(() => [
        { name: language === 'ar' ? 'الإنشاء' : 'Creation', title: language === 'ar' ? 'القائم بالإنشاء' : 'Creator', icon: PlusCircleIcon },
        { name: language === 'ar' ? 'الاعتماد' : 'Approval', title: language === 'ar' ? 'القائم بالاعتماد' : 'Approver', icon: CheckBadgeIcon },
    ], [language]);
    let currentStepIndex = 0;
    if (status === 'Awaiting Approval') currentStepIndex = 1;
    if (status === 'Approved') currentStepIndex = 2;
    if (status === 'Rejected') currentStepIndex = 1;
    if (status === 'Needs Revision') currentStepIndex = 0;
    return (
        <motion.div variants={staggeredItemVariants} className="w-full max-w-2xl mx-auto py-4">
            <div className="flex items-center">
                {stepsConfig.map((step, index) => {
                    const isresubmitted = currentStepIndex > index;
                    const isCurrent = currentStepIndex === index;
                    const isRejected = isCurrent && status === 'Rejected';
                    const isCurrentBecauseOfRevision = isCurrent && isRevisionState;
                    const isLastStep = index === stepsConfig.length - 1;
                    return (
                        <React.Fragment key={step.name}>
                            <motion.div className="flex flex-col items-center z-10" variants={interactiveItemVariants} whileHover="hover" whileTap="tap">
                                <button onClick={() => onStepClick(index, step.title)} className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isresubmitted ? 'bg-yellow-500 border-yellow-500' : ''} ${isCurrentBecauseOfRevision ? 'border-blue-400 bg-gray-800' : ''} ${isCurrent && !isRejected && !isCurrentBecauseOfRevision ? 'border-yellow-400 bg-gray-800' : ''} ${isRejected ? 'bg-red-500/20 border-red-500' : ''} ${!isresubmitted && !isCurrent ? 'bg-gray-800 border-gray-600' : ''}`}>
                                    <step.icon className={`w-6 h-6 transition-colors ${isresubmitted ? 'text-gray-900' : isCurrentBecauseOfRevision ? 'text-blue-400' : (isCurrent && !isRejected ? 'text-yellow-400' : (isRejected ? 'text-red-500' : 'text-gray-500'))}`} />
                                </button>
                                <p className={`mt-2 text-xs w-20 text-center font-semibold ${isCurrent || isresubmitted ? 'text-white' : 'text-gray-500'}`}>{step.name}</p>
                            </motion.div>
                            {!isLastStep && (
                                <div className="relative flex-1">
                                    <div className={`h-2 transition-colors duration-500 ${isRevisionState || currentStepIndex > index ? 'bg-yellow-500' : 'bg-gray-600'}`}></div>
                                    {isRevisionState && (<div className="absolute -top-2.5 left-0 w-full"><div className="h-1 bg-blue-500" />{language === 'ar' ? (<ArrowRightIcon className="w-5 h-5 text-blue-500 absolute -right-2 top-1/2 -translate-y-1/2 bg-gray-900 p-0.5 rounded-full" />) : (<ArrowLeftIcon className="w-5 h-5 text-blue-500 absolute -left-2 top-1/2 -translate-y-1/2 bg-gray-900 p-0.5 rounded-full" />)}</div>)}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </motion.div>
    );
};
function OverallResult({ score, summary, translations }: { score: number, summary: string, translations: any }) {
    const { language } = useLanguage();
    const t = translations[language];
    const ratingDescriptions = { ar: ["", "تحتاج إلى تحسين", "مقبول", "جيد", "جيد جداً", "ممتاز"], en: ["", "Need improvement", "Acceptable", "Good", "Very Good", "Excellent"], };
    const scoreColors: { [key: number]: string } = { 1: 'bg-red-500/20 text-red-400', 2: 'bg-orange-500/20 text-orange-400', 3: 'bg-yellow-500/20 text-yellow-400', 4: 'bg-teal-500/20 text-teal-300', 5: 'bg-green-500/20 text-green-400' };
    const roundedScore = Math.round(score);
    const scoreText = ratingDescriptions[language as 'ar' | 'en'][roundedScore] || "";
    const colorClasses = scoreColors[roundedScore] || 'bg-gray-500/20 text-gray-300';
    const scorePercentage = score * 20;
    const StarsComponent = <div className="flex items-center gap-1">{[1, 2, 3, 4, 5].map((star) => <StarIcon key={star} className={`w-8 h-8 ${star <= roundedScore ? "text-yellow-400" : "text-gray-600"}`} />)}</div>;
    const PercentageComponent = <p className="text-lg font-bold text-yellow-400">{scorePercentage.toFixed(0)}%</p>;
    const TextComponent = <p className={`px-3 py-1 text-sm font-bold rounded-full ${colorClasses}`}>{scoreText}</p>;
    return (
        <motion.div variants={{ ...staggeredItemVariants, ...interactiveItemVariants }} whileHover="hover" className="bg-yellow-900/20 rounded-xl p-5 border-2 border-yellow-500/40 shadow-lg">
            <h3 className="text-lg font-bold text-white mb-4">{t.common.overallResult}</h3>
            <div className="md-col-span-2 space-y-4">
                <div className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-start gap-x-4 gap-y-2">{StarsComponent}{PercentageComponent}{TextComponent}</div>
                <NoteDisplay text={summary} />
            </div>
        </motion.div>
    );
}
function ActionHistoryTimeline({ history, t, language, onUserClick }: { history: ActionHistoryItem[], t: any, language: 'ar' | 'en', onUserClick: (user: UserDoc) => void; }) {
    const actionIcons: { [key: string]: React.ElementType } = {
        created: PlusCircleIcon,
        approved: CheckBadgeIcon,
        Rejected: XCircleIcon,
        revision_requested: ArrowUturnLeftIcon,
        resubmitted: PencilSquareIcon,
    };
    
    const actionStyles: { [key: string]: { iconColor: string; bgColor: string; } } = {
        created: { iconColor: 'text-blue-400', bgColor: 'bg-blue-500/10' },
        approved: { iconColor: 'text-green-400', bgColor: 'bg-green-500/10' },
        Rejected: { iconColor: 'text-red-400', bgColor: 'bg-red-500/10' },
        revision_requested: { iconColor: 'text-orange-400', bgColor: 'bg-orange-500/10' },
        resubmitted: { iconColor: 'text-purple-400', bgColor: 'bg-purple-500/10' },
        default: { iconColor: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    };

    if (history.length === 0) { 
        return (
            <motion.div variants={staggeredItemVariants} className="text-center bg-gray-900/50 rounded-xl p-6 border border-dashed border-gray-700">
                <ArchiveBoxXMarkIcon className="w-10 h-10 mx-auto text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-300 mt-2">{t.noActionHistoryTitle}</h3>
                <p className="text-sm text-gray-400">{t.noActionHistoryMessage}</p>
            </motion.div>
        );
    }
    
    return (
        <motion.div variants={staggeredItemVariants} className="mt-8 pt-8 border-t border-gray-700">
            <h2 className="text-xl font-bold text-gray-200 mb-6">{t.actionHistory}</h2>
            <div className="relative">
                <div className="absolute left-6 rtl:left-auto rtl:right-6 top-0 w-0.5 h-full bg-gray-700" />
                
                <div className="space-y-10">
                    {history.map((item) => {
                        const ActionIcon = actionIcons[item.action_key] || InformationCircleIcon;
                        const styles = actionStyles[item.action_key] || actionStyles.default;
                        
                        return (
                            <div key={item.id} className="relative flex items-start gap-6">
                                <div className="z-10 absolute left-6 rtl:left-auto rtl:right-6 top-1 -translate-x-1/2 rtl:translate-x-1/2 flex items-center justify-center w-12 h-12 bg-gray-900 rounded-full">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.bgColor}`}>
                                        <ActionIcon className={`w-6 h-6 ${styles.iconColor}`} />
                                    </div>
                                </div>
                                
                                <div className="flex-grow pl-16 rtl:pl-0 rtl:pr-16">
                                    <div className="flex items-center gap-4">
                                        <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" onClick={() => item.actor && onUserClick(item.actor)} className="w-12 h-12 rounded-full overflow-hidden shrink-0 aspect-square">
                                            {item.user_avatar_url ? (<img className="w-full h-full object-cover" src={item.user_avatar_url} alt={item.user_name} />) : (<DefaultAvatarIcon />)}
                                        </motion.button>
                                        <div>
                                            <p className="font-bold text-gray-100">{item.user_name}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1"><BriefcaseIcon className="w-4 h-4" /><span>{item.job_title}</span></div>
                                        </div>
                                    </div>

                                    <div className="mt-3 pl-2 border-l-2 border-gray-700 ml-6 rtl:ml-0 rtl:mr-6 rtl:border-l-0 rtl:border-r-2">
                                       <div className="p-3">
                                            <div className="flex items-center gap-2">
                                                <p className={`text-md ${styles.iconColor} font-semibold`}>{t.actions[item.action_key] || item.action_key}</p>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                                <ClockIcon className="w-4 h-4" />
                                                <span>{item.timestamp.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'full', timeStyle: 'medium', numberingSystem: 'latn' })}</span>
                                            </div>
                                            <NoteDisplay text={item.notes || ''} />
                                       </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
}
const NewerEvaluationNotification = ({ newerEval, t }: { newerEval: EvaluationDoc, t: any }) => {
    const message = t.newEvaluationCreatedMessage.replace('{month}', new Date(newerEval.evaluation_year, newerEval.evaluation_month - 1).toLocaleString(t.locale, { month: 'long', year: 'numeric', numberingSystem: 'latn' }));
    return (
        <motion.div variants={staggeredItemVariants} className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/40 border-2 border-yellow-500/50 rounded-xl p-4 sm:p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-start">
            <div>
                <h3 className="text-lg font-bold text-yellow-300">{t.newEvaluationTitle}</h3>
                <p className="text-yellow-400/80 mt-1 max-w-2xl">{message}</p>
            </div>
            <motion.button 
                variants={interactiveItemVariants} 
                whileHover="hover" 
                whileTap="tap" 
                onClick={() => window.open(`/companies/evaluation/details/${newerEval.sequence_number}`, '_blank')}
                className="flex-shrink-0 flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-5 rounded-lg transition-colors shadow-md shadow-yellow-500/20"
            >
                <EyeIcon className="w-5 h-5"/>
                {t.viewNewerEvaluation}
            </motion.button>
        </motion.div>
    );
};

const StatusDisplay = ({ status, t }: { status: EvaluationStatus, t: any }) => {
    const config: Record<EvaluationStatus, { text: string; color: string; bgColor: string }> = {
        'Needs Revision': { text: t.needsRevision, color: "text-orange-400", bgColor: "bg-orange-900/50" },
        'Awaiting Approval': { text: t.awaitingApproval, color: "text-yellow-400", bgColor: "bg-yellow-900/50" },
        'Approved': { text: t.approved, color: "text-green-400", bgColor: "bg-green-900/50" },
        'Rejected': { text: t.Rejected, color: "text-red-400", bgColor: "bg-red-900/50" },
    };
    const statusConfig = config[status];
    if (!statusConfig) return <div className="font-bold text-gray-400">{status}</div>;
    return <div className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${statusConfig.color} ${statusConfig.bgColor}`}>{statusConfig.text}</div>;
};

const RelatedEvaluationsList = ({ title, evaluations, t, language }: { title: string; evaluations: EvaluationDoc[]; t: any; language: 'ar' | 'en' }) => {
    if (!evaluations || evaluations.length === 0) return null;

    return (
        <motion.div variants={staggeredItemVariants} className="mt-8 pt-8 border-t-4 border-double border-gray-700">
            <h2 className="text-xl font-bold text-gray-200 mb-6 text-center">{title}</h2>
            <motion.div className="space-y-4" variants={staggeredContainerVariants} initial="initial" animate="animate">
                {evaluations.map((ev) => (
                    <motion.div key={ev.id} variants={staggeredItemVariants} className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="w-full flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 text-center sm:text-start">
                           <InfoItem Icon={HashtagIcon} label={t.common.evaluationNumber} value={ev.sequence_number} />
                           <InfoItem Icon={InformationCircleIcon} label={t.common.status} value={<StatusDisplay status={ev.status} t={t} />} />
                           {/* --- تعديل: تغيير صيغة عرض التاريخ لتكون كاملة --- */}
                           <InfoItem Icon={ClockIcon} label={t.common.lastUpdate} value={ev.updated_at?.toDate().toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'full', timeStyle: 'medium', numberingSystem: 'latn' }) ?? 'N/A'} />
                        </div>
                        <motion.button
                            variants={interactiveItemVariants}
                            whileHover="hover"
                            whileTap="tap"
                            onClick={() => window.open(`/companies/evaluation/details/${ev.sequence_number}`, '_blank')}
                            className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-2 px-4 rounded-lg"
                        >
                            <EyeIcon className="w-5 h-5" />
                            <span>{t.viewEvaluation}</span>
                        </motion.button>
                    </motion.div>
                ))}
            </motion.div>
        </motion.div>
    );
};

// --- المكون الرئيسي للعرض ---
function EvaluationDetailsContent({
    evaluation, evaluationDetails, company, currentTask, actionHistory, translations, handleTaskAction, hasPermission, isProcessing, onStepClick, onHistoryUserClick, user, evaluator, handleEditClick, handlePdfAction,
    latestNewerEvaluation,
    allNewerEvaluations,
    allOlderEvaluations,
    userHasSignature
}: {
    evaluation: EvaluationDoc; evaluationDetails: EvaluationDetailsDoc; company: CompanyDoc | null;
    currentTask: TaskDoc | null; actionHistory: ActionHistoryItem[]; translations: any;
    handleTaskAction: (action: 'approve' | 'reject' | 'needs_revision') => void;
    hasPermission: (permission: string) => boolean; isProcessing: boolean;
    onStepClick: (index: number, title: string) => void;
    onHistoryUserClick: (user: UserDoc) => void;
    user: { id: string; is_super_admin?: boolean; } | null;
    evaluator: UserDoc | null;
    handleEditClick: (sequenceNumber: number) => void;
    handlePdfAction: (action: 'download' | 'print' | 'share' | 'open') => void;
    latestNewerEvaluation: EvaluationDoc | null;
    allNewerEvaluations: EvaluationDoc[];
    allOlderEvaluations: EvaluationDoc[];
    userHasSignature: boolean;
}) {
    const { language } = useLanguage();
    const t = translations[language];

    const formattedMonthYear = useMemo(() => {
        const date = new Date(evaluationDetails.evaluation_year, evaluationDetails.evaluation_month - 1);
        return date.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric', numberingSystem: 'latn' });
    }, [evaluationDetails, language]);
    
    const formattedCreationDate = useMemo(() => {
        if (!evaluation.created_at) return '...';
        return evaluation.created_at.toDate().toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
            dateStyle: 'full',
            timeStyle: 'medium',
            numberingSystem: 'latn'
        });
    }, [evaluation.created_at, language]);

    const showManagementActions = evaluation.status === 'Awaiting Approval' && hasPermission('sss:2') && !!currentTask;
    const showUserActions = evaluation.status === 'Needs Revision' && hasPermission('sss:3') && evaluationDetails.evaluator_id === user?.id;
    const showOutputActions = evaluation.status === 'Approved';

    return (
        <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" className="space-y-6 pb-12">
            
            {latestNewerEvaluation && <NewerEvaluationNotification newerEval={latestNewerEvaluation} t={t} />}
            
            <EvaluationStepper status={evaluation.status} onStepClick={onStepClick} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InfoCard title={t.companyInfo}>
                    <InfoItem Icon={BuildingOfficeIcon} label={t.common.company} value={company ? (language === 'ar' ? company.name_ar : company.name_en) : '...'} />
                    <InfoItem Icon={DocumentTextIcon} label={t.common.contractNo} value={evaluation.historical_contract_no ?? '0'} />
                    <InfoItem Icon={ShieldCheckIcon} label={`${t.common.violationsCount} (${formattedMonthYear})`} value={evaluation.historical_violations_count ?? 0} />
                    <InfoItem Icon={UsersIcon} label={t.common.guardsCount} value={evaluation.historical_guard_count ?? 0} />
                </InfoCard>

                <InfoCard title={t.evaluationInfo}>
                    <InfoItem Icon={HashtagIcon} label={t.common.evaluationNumber} value={evaluation.sequence_number} />
                    <InfoItem Icon={InformationCircleIcon} label={t.common.status} value={<StatusDisplay status={evaluation.status} t={t} />} />
                    <InfoItem Icon={CalendarDaysIcon} label={t.common.month} value={formattedMonthYear} />
                    <InfoItem Icon={ClockIcon} label={t.common.creationDate} value={formattedCreationDate} />
                </InfoCard>
            </div>
            
            <motion.div variants={staggeredItemVariants} className="pt-6 border-t border-gray-700">
                <h2 className="text-xl font-bold text-gray-200 mb-4">{t.common.questionDetails}</h2>
                <div className="space-y-6">
                    <OverallResult score={evaluationDetails.overall_score} summary={evaluationDetails.summary} translations={translations} />
                    {evaluationDetails.details.map((q) => (
                        <motion.div key={q.question_id} variants={{...staggeredItemVariants, ...interactiveItemVariants}} whileHover="hover" className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
                            <p className="mb-3 font-semibold text-gray-200">{language === 'ar' ? q.question_text_ar : q.question_text_en}</p>
                            <div className="flex flex-col items-start gap-3">
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => <StarIcon key={star} className={`w-6 h-6 ${star <= q.rating ? "text-yellow-400" : "text-gray-600"}`} />)}
                                </div>
                                <NoteDisplay text={q.note} />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
            
            <RelatedEvaluationsList
                title={t.olderEvaluationsTitle.replace('{month}', formattedMonthYear)}
                evaluations={allOlderEvaluations}
                t={t}
                language={language}
            />
            
            <ActionHistoryTimeline history={actionHistory} t={t} language={language} onUserClick={onHistoryUserClick} />
            
            <RelatedEvaluationsList
                title={t.newerEvaluationsTitle.replace('{month}', formattedMonthYear)}
                evaluations={allNewerEvaluations}
                t={t}
                language={language}
            />
            
            <AnimatePresence>
                {(showManagementActions || showUserActions || showOutputActions) && (
                    <motion.div variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="pt-6 border-t border-gray-700">
                        <h2 className="text-xl font-bold text-gray-200 mb-4">
                            {showManagementActions && t.managementActions}
                            {showUserActions && t.userActions}
                            {showOutputActions && t.outputActions}
                        </h2>
                        <div className="flex flex-wrap gap-4">
                            {showManagementActions && (
                                <>
                                    <div className="relative">
                                        <motion.button 
                                            variants={interactiveItemVariants} 
                                            whileHover="hover" 
                                            whileTap="tap" 
                                            disabled={isProcessing || !userHasSignature} 
                                            onClick={() => handleTaskAction('approve')} 
                                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
                                        >
                                            <CheckCircleIcon className="w-5 h-5"/>{t.approve}
                                        </motion.button>
                                        {/* ✅ الرسالة التوضيحية الجديدة */}
                                        {!userHasSignature && (
                                            <p className="absolute -bottom-5 ltr:left-0 rtl:right-0 text-xs text-red-400 w-max">{t.noSignatureMessage}</p>
                                        )}
                                    </div>
                                    <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" disabled={isProcessing} onClick={() => handleTaskAction('reject')} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"><XCircleIcon className="w-5 h-5"/>{t.reject}</motion.button>
                                    <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" disabled={isProcessing} onClick={() => handleTaskAction('needs_revision')} className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg disabled:bg-yellow-700 disabled:cursor-not-allowed"><ArrowUturnLeftIcon className="w-5 h-5"/>{t.returnForRevision}</motion.button>
                                </>
                            )}
                            {showUserActions && (
                                <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" onClick={() => handleEditClick(evaluation.sequence_number)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"><PencilSquareIcon className="w-5 h-5"/>{t.editEvaluation}</motion.button>
                            )}
                            {showOutputActions && (
                                <>  
                                    {hasPermission('sss:8') && (
                                        <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" title={t.open} onClick={() => handlePdfAction('open')} className="p-2 text-[#FFD700] hover:text-yellow-300 transition-colors">
                                            <EyeIcon className="w-6 h-6"/>
                                        </motion.button>
                                    )}
                                    {hasPermission('sss:5') && (
                                        <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" title={t.download} onClick={() => handlePdfAction('download')} className="p-2 text-[#FFD700] hover:text-yellow-300 transition-colors">
                                            <ArrowDownTrayIcon className="w-6 h-6"/>
                                        </motion.button>
                                    )}
                                    {hasPermission('sss:6') && (
                                        <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" title={t.print} onClick={() => handlePdfAction('print')} className="p-2 text-[#FFD700] hover:text-yellow-300 transition-colors">
                                            <PrinterIcon className="w-6 h-6"/>
                                        </motion.button>
                                    )}
                                    {hasPermission('sss:7') && (
                                        <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" title={t.share} onClick={() => handlePdfAction('share')} className="p-2 text-[#FFD700] hover:text-yellow-300 transition-colors">
                                            <ShareIcon className="w-6 h-6"/>
                                        </motion.button>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// --- المكون الرئيسي للصفحة ---
export default function EvaluationDetails() {
    const { language } = useLanguage();
    const { evaluationSequenceNumber } = useParams<{ evaluationSequenceNumber: string }>();
    const { user, hasPermission, isLoading: isAuthLoading } = useAuth();
    const { showDialog } = useDialog();
    const { setPageLoading } = usePageLoading();
    const { showActionLoading, hideActionLoading } = useActionLoading();

    const [evaluation, setEvaluation] = useState<EvaluationDoc | null>(null);
    const [evaluationDetails, setEvaluationDetails] = useState<EvaluationDetailsDoc | null>(null);
    const [company, setCompany] = useState<CompanyDoc | null>(null);
    const [currentTask, setCurrentTask] = useState<TaskDoc | null>(null);
    const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
    const [isInitialLoad, setInitialLoad] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [evaluator, setEvaluator] = useState<UserDoc | null>(null);
    const [latestNewerEvaluation, setLatestNewerEvaluation] = useState<EvaluationDoc | null>(null);
    const [allNewerEvaluations, setAllNewerEvaluations] = useState<EvaluationDoc[]>([]);
    const [allOlderEvaluations, setAllOlderEvaluations] = useState<EvaluationDoc[]>([]);

    const [isUsersOverlayOpen, setUsersOverlayOpen] = useState(false);
    const [overlayUsers, setOverlayUsers] = useState<UserDoc[]>([]);
    const [overlayTitle, setOverlayTitle] = useState('');
    const [overlayStepIndex, setOverlayStepIndex] = useState(0);
    const [isProfileOverlayOpen, setIsProfileOverlayOpen] = useState(false);
    const userHasSignature = !!user?.signature_url;

    const translations = useMemo(() => ({
        ar: {
            locale: "ar-EG",
            noSignatureTitle: "التوقيع مطلوب",
            noSignatureMessage: "يجب عليك رفع توقيعك في ملفك الشخصي أولاً قبل اعتماد التقييم.",
            pageTitle: "تفاصيل تقييم الشركة",
            evaluationNotFound: "لم يتم العثور على التقييم.",
            errorTitle: "خطأ",
            successTitle: "نجاح",
            actionSuccessMessage: "تم تنفيذ الإجراء بنجاح!",
            statusUpdateTitle: "تحديث الحالة",
            statusUpdateMessage: "لقد تغيرت حالة هذا التقييم.",
            statusMismatchMessage: "لقد تغيرت حالة التقييم من قبل مستخدم آخر. لا يمكن المتابعة.",
            permissionDeniedTitle: "تم رفض الإجراء",
            permissionDeniedMessage: "لم تعد تملك الصلاحية اللازمة لتنفيذ هذا الإجراء.",
            preparingEdit: "جاري تجهيز صفحة التعديل...",
            rejectReasonTitle: "سبب الرفض",
            rejectReasonMessage: "يرجى إدخال سبب رفض هذا التقييم.",
            revisionReasonTitle: "سبب طلب التعديل",
            revisionReasonMessage: "يرجى توضيح التعديلات المطلوبة.",
            mandatoryReasonMessage: "هذا الحقل إجباري.",
            optionalNotesMessage: "يمكنك إضافة ملاحظة اختيارية مع الاعتماد (اختياري):",
            confirmActionTitle: "تأكيد الإجراء",
            confirmApprove: "هل أنت متأكد من اعتماد هذا التقييم؟",
            confirmReject: "هل أنت متأكد من رفض هذا التقييم؟",
            confirmReturn: "هل أنت متأكد من إعادة التقييم للموظف؟",
            managementActions: "إجراءات رئيس القسم",
            userActions: "الإجراءات المتاحة",
            outputActions: "الإجراءات النهائية",
            approve: "اعتماد",
            reject: "رفض",
            returnForRevision: "إعادة للتعديل",
            editEvaluation: "تعديل التقييم",
            open: "فتح",
            download: "تحميل PDF",
            print: "طباعة",
            share: "مشاركة",
            needsRevision: "بحاجة لمراجعة",
            awaitingApproval: "بانتظار الموافقة",
            approved: "معتمد",
            Rejected: "مرفوض",
            companyInfo: "بيانات الشركة",
            evaluationInfo: "بيانات التقييم",
            actionHistory: "خريطة الإجراءات",
            noActionHistoryTitle: "لا يوجد سجل إجراءات",
            noActionHistoryMessage: "لم يتم تنفيذ أي إجراءات على هذا التقييم بعد.",
            loadingUsers: "جاري جلب المستخدمين...",
            noAccessToProfile: "تحتاج إلى صلاحية للوصول إلى بيانات هذا المستخدم.",
            shareError: "لم يتمكن المتصفح من مشاركة الملف.",
            shareNotSupported: "المشاركة غير مدعومة في هذا المتصفح.",
            preparingPDF: "جاري تجهيز الملف...",
            confirmOpenTitle: "تأكيد الفتح",
            confirmOpenMessage: "هل أنت متأكد أنك تريد فتح التقرير في تبويب جديد؟",
            confirmDownloadTitle: "تأكيد التحميل",
            confirmDownloadMessage: "هل أنت متأكد أنك تريد تحميل هذا التقرير كملف PDF؟",
            confirmPrintTitle: "تأكيد الطباعة",
            confirmPrintMessage: "تذكر أن بلدية مدينة أبوظبي ترفع شعار 'بلدية بلا ورق'. هل ما زلت ترغب في المتابعة والطباعة؟",
            confirmShareTitle: "تأكيد المشاركة",
            confirmShareMessage: "هل أنت متأكد أنك تريد مشاركة هذا التقرير؟",
            newEvaluationTitle: "تم إنشاء تقييم أحدث",
            newEvaluationCreatedMessage: "تم إنشاء تقييم أحدث لنفس الشركة لشهر {month}.",
            viewNewerEvaluation: "عرض التقييم الأحدث",
            viewEvaluation: "عرض التقييم",
            newerEvaluationsTitle: "تقييمات أحدث لنفس الشركة لشهر {month}",
            olderEvaluationsTitle: "تقييمات سابقة لنفس الشركة لشهر {month}",
            editingNotAllowedTitle: "غير مسموح بالتعديل",
            editingNotAllowedMessage: "يمكن تعديل التقييم فقط عندما تكون حالته 'بحاجة لمراجعة'.",
            genericErrorMessage: "حدث خطأ أثناء حفظ التقييم.",
            common: { company: "الشركة", month: "شهر التقييم", overallResult: "النتيجة الإجمالية", summary: "الملخص العام", questionDetails: "تفاصيل البنود", loading: "جاري التحميل...", contractNo: "رقم العقد", guardsCount: "عدد الحراس", violationsCount: "عدد المخالفات", creationDate: "تاريخ الإنشاء", evaluationNumber: "رقم التقييم", status: "الحالة", lastUpdate: "آخر تحديث" },
            processing: { approving: "جاري اعتماد التقييم", rejecting: "جاري رفض التقييم", revising: "جاري إعادة التقييم" },
            actions: { created: "أنشأ التقييم", approved: "اعتمد التقييم", Rejected: "رفض التقييم", revision_requested: "طلب تعديل", resubmitted: "اعاد إرسال التقييم بعد التعديل" }
        },
        en: {
            locale: "en-US",
            pageTitle: "Company Evaluation Details",
            noSignatureTitle: "Signature Required",
            noSignatureMessage: "You must upload your signature in your profile before approving the evaluation.",
            evaluationNotFound: "Evaluation not found.",
            errorTitle: "Error",
            successTitle: "Success",
            actionSuccessMessage: "Action completed successfully!",
            statusUpdateTitle: "Status Update",
            statusUpdateMessage: "This evaluation's status has changed.",
            statusMismatchMessage: "The evaluation status has been changed by another user. Cannot proceed.",
            permissionDeniedTitle: "Action Denied",
            permissionDeniedMessage: "You no longer have the required permission to perform this action.",
            preparingEdit: "Preparing edit page...",
            rejectReasonTitle: "Reason for Rejection",
            rejectReasonMessage: "Please provide a reason for rejecting this evaluation.",
            revisionReasonTitle: "Reason for Revision",
            revisionReasonMessage: "Please specify the required revisions.",
            mandatoryReasonMessage: "This field is required.",
            optionalNotesMessage: "You can add an optional note with this approval (optional):",
            confirmActionTitle: "Confirm Action",
            confirmApprove: "Are you sure you want to approve this evaluation?",
            confirmReject: "Are you sure you want to reject this evaluation?",
            confirmReturn: "Are you sure you want to return this evaluation to the employee?",
            managementActions: "Manager Actions",
            userActions: "Available Actions",
            outputActions: "Final Actions",
            approve: "Approve",
            reject: "Reject",
            returnForRevision: "Return for Modification",
            editEvaluation: "Edit Evaluation",
            open: "Open",
            download: "Download PDF",
            print: "Print",
            share: "Share",
            needsRevision: "Needs Revision",
            awaitingApproval: "Awaiting Approval",
            approved: "Approved",
            Rejected: "Rejected",
            companyInfo: "Company Information",
            evaluationInfo: "Evaluation Information",
            actionHistory: "Action History",
            noActionHistoryTitle: "No Action History",
            noActionHistoryMessage: "No actions have been performed on this evaluation yet.",
            loadingUsers: "Fetching users...",
            noAccessToProfile: "You need permission to access this user's data.",
            shareError: "The browser could not share the file.",
            shareNotSupported: "Sharing is not supported in this browser.",
            preparingPDF: "Preparing file...",
            confirmOpenTitle: "Confirm Open",
            confirmOpenMessage: "Are you sure you want to open the report in a new tab?",
            confirmDownloadTitle: "Confirm Download",
            confirmDownloadMessage: "Are you sure you want to download this report as a PDF file?",
            confirmPrintTitle: "Confirm Print",
            confirmPrintMessage: "Remember that Abu Dhabi City Municipality promotes a 'Paperless Municipality'. Do you still wish to proceed with printing?",
            confirmShareTitle: "Confirm Share",
            confirmShareMessage: "Are you sure you want to share this report?",
            newEvaluationTitle: "Newer Evaluation Created",
            newEvaluationCreatedMessage: "A newer evaluation for the same company has been created for {month}.",
            viewNewerEvaluation: "View Newer Evaluation",
            viewEvaluation: "View Evaluation",
            newerEvaluationsTitle: "Newer Evaluations for the Same Company for {month}",
            olderEvaluationsTitle: "Older Evaluations for the Same Company for {month}",
            editingNotAllowedTitle: "Editing Not Allowed",
            editingNotAllowedMessage: "An evaluation can only be edited when its status is 'Needs Revision'.",
            genericErrorMessage: "An error occurred while saving the evaluation.",
            common: { company: "Company", month: "Evaluation Month", overallResult: "Overall Result", summary: "General Summary", questionDetails: "Items Details", loading: "Loading...", contractNo: "Contract No.", guardsCount: "Guards Count", violationsCount: "Violations Count", creationDate: "Creation Date", evaluationNumber: "Evaluation No.", status: "Status", lastUpdate: "Last Update" },
            processing: { approving: "Approving evaluation", rejecting: "Rejecting evaluation", revising: "Returning evaluation" },
            actions: { created: "Created Evaluation", approved: "Approved Evaluation", Rejected: "Rejected Evaluation", revision_requested: "Requested Revision", resubmitted: "Resubmitted Evaluation after revision" }
        }
    }), [language]);
    
    const t = translations[language];  
    const [pdfAction, setPdfAction] = useState<'download' | 'print' | 'share' | 'open' | null>(null);
    const [instance, updateInstance] = usePDF();

    const pdfSignatories = useMemo(() => {
        const creatorHistory = actionHistory.find(h => h.action_key === 'created' || h.action_key === 'resubmitted');
        const approverHistory = actionHistory.find(h => h.action_key === 'approved');

        const creator = creatorHistory?.actor ? {
            name_en: creatorHistory.actor.name_en,
            name_ar: creatorHistory.actor.name_ar,
            job_title_en: creatorHistory.actor.job?.name_en,
            job_title_ar: creatorHistory.actor.job?.name_ar,
            signature_url: creatorHistory.signature_url,
            seal_url: creatorHistory.seal_url,
        } : null;

        const approver = approverHistory?.actor ? {
            name_en: approverHistory.actor.name_en,
            name_ar: approverHistory.actor.name_ar,
            job_title_en: approverHistory.actor.job?.name_en,
            job_title_ar: approverHistory.actor.job?.name_ar,
            signature_url: approverHistory.signature_url,
            seal_url: approverHistory.seal_url,
        } : null;

        return { creator, approver };
    }, [actionHistory]);

    const pdfDocument = useMemo(() => (
        <EvaluationPDF
            evaluation={evaluation}
            latestVersion={evaluationDetails}
            companyNameEn={company?.name_en}
            companyNameAr={company?.name_ar}
            creator={pdfSignatories.creator}
            approver={pdfSignatories.approver}
        />
    ), [evaluation, evaluationDetails, company, pdfSignatories, language]);

    useEffect(() => {
        if (pdfAction) {
            showActionLoading(t.preparingPDF);
            updateInstance(pdfDocument);
        }
    }, [pdfAction, updateInstance, pdfDocument, showActionLoading, t.preparingPDF]);

    useEffect(() => {
        if (pdfAction && !instance.loading && instance.url && evaluation && company) {
            
            if (pdfAction === 'download') {
                const link = document.createElement('a');
                link.href = instance.url;
                link.download = `Evaluation-${evaluation.sequence_number}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else if (pdfAction === 'print') {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = instance.url;
                document.body.appendChild(iframe);
                iframe.onload = () => {
                    if(iframe.contentWindow) { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
                    document.body.removeChild(iframe);
                };
            } else if (pdfAction === 'share') {
                const pdfFile = new File([instance.blob!], `Evaluation-${evaluation.sequence_number}.pdf`, { type: 'application/pdf' });
                const companyName = language === 'ar' ? company.name_ar : company.name_en;
                if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                    navigator.share({ files: [pdfFile], title: `${t.pageTitle} #${evaluation.sequence_number}`, text: `Check out the evaluation for ${companyName}.` })
                    .catch(error => console.error('Share error:', error));
                } else {
                    showDialog({ variant: 'alert', title: t.errorTitle, message: t.shareNotSupported });
                }
            } else if (pdfAction === 'open') {
                window.open(instance.url, '_blank');
            }
            hideActionLoading();
            setPdfAction(null);
        }
    }, [instance.loading, instance.url, instance.blob, pdfAction, evaluation, company, hideActionLoading, language, showDialog, t.errorTitle, t.pageTitle, t.shareNotSupported]);

    const handlePdfAction = (action: 'download' | 'print' | 'share' | 'open') => {
        const actionsConfig = {
            download: { permission: 'sss:5', title: t.confirmDownloadTitle, message: t.confirmDownloadMessage },
            print: { permission: 'sss:6', title: t.confirmPrintTitle, message: t.confirmPrintMessage },
            share: { permission: 'sss:7', title: t.confirmShareTitle, message: t.confirmShareMessage },
            open: { permission: 'sss:8', title: t.confirmOpenTitle, message: t.confirmOpenMessage }
        };

        const config = actionsConfig[action];

        showDialog({
            variant: 'confirm',
            title: config.title,
            message: config.message,
            onConfirm: () => {
                if (!hasPermission(config.permission)) {
                    showDialog({ variant: 'alert', title: t.permissionDeniedTitle, message: t.permissionDeniedMessage });
                    return;
                }
                setPdfAction(action);
            }
        });
    };
    
    const watchedKeys = useMemo(() => {
        if (!evaluation) return [];
        switch (evaluation.status) {
            case 'Awaiting Approval': return ['sss:2'];
            case 'Needs Revision': return ['sss:3'];
            case 'Approved': return ['sss:5', 'sss:6', 'sss:7', 'sss:8'];
            default: return [];
        }
    }, [evaluation]);

    usePermissionNotification(watchedKeys);

    const processTask = httpsCallable(functions, 'processEvaluationTask');

    const handleStepClick = async (index: number, title: string) => {
        let permissionId: string | undefined;
        let finalTitle = title;

        if (evaluation?.status === 'Needs Revision' && index === 0) {
            finalTitle = language === 'ar' ? 'القائم بالتعديل (صاحب التقييم)' : 'Modifier (Evaluation Owner)';
            if(evaluator) {
                setOverlayUsers([evaluator]);
                setOverlayTitle(finalTitle);
                setOverlayStepIndex(index);
                setUsersOverlayOpen(true);
            }
            return;
        }

        permissionId = index === 0 ? 'sss:1' : 'sss:2';
        if (!permissionId) return;

        showActionLoading(t.loadingUsers);
        try {
            const getUsersByPermission = httpsCallable(functions, 'getUsersByPermission');
            const result = await getUsersByPermission({ permissionId });
            
            let usersData = result.data as UserDoc[];
            const jobIds = new Set(usersData.map(u => u.job_id).filter(Boolean).map(id => String(id)));
            if (jobIds.size > 0) {
                const jobsQuery = query(collection(db, "jobs").withConverter(jobConverter), where(documentId(), "in", Array.from(jobIds)));
                const jobsSnap = await getDocs(jobsQuery);
                const jobsMap = new Map<string, JobDoc>();
                jobsSnap.forEach(jobDoc => jobsMap.set(jobDoc.id, jobDoc.data()));
                usersData = usersData.map(u => ({
                    ...u,
                    job: u.job_id ? jobsMap.get(String(u.job_id)) as any : undefined
                }));
            }
            
            setOverlayUsers(usersData);
            setOverlayTitle(finalTitle);
            setOverlayStepIndex(index);
            setUsersOverlayOpen(true);
        } catch (error) {
            console.error("Error fetching users for permission:", error);
            showDialog({ variant: 'alert', title: t.errorTitle, message: (error as Error).message });
        } finally {
            hideActionLoading();
        }
    };

    const handleUserClick = (clickedUser: UserDoc) => {
        if (clickedUser.id === user?.id) {
            setIsProfileOverlayOpen(true);
        } else {
            showDialog({
                variant: 'alert',
                title: 'وصول مرفوض',
                message: t.noAccessToProfile,
                color: 'yellow'
            });
        }
    };

const handleEditClick = async (sequenceNumber: number) => {
        
        // 1. فحص مبدئي للحالة قبل بدء التحميل
        if (!evaluation || evaluation.status !== 'Needs Revision') {
            showDialog({ variant: 'alert', title: t.editingNotAllowedTitle, message: t.statusMismatchMessage });
            return;
        }

        showActionLoading(t.preparingEdit); // ✅ ابدأ شاشة الانتظار الخفيفة

        try {
            // 2. التحقق من الصلاحيات والملكية قبل الجلب من الخادم
            if (!hasPermission('sss:3') || evaluationDetails?.evaluator_id !== user?.id) {
                // إذا لم تكن هناك صلاحية، لا تضيع وقت المستخدم في انتظار جلب المستند
                throw new Error(t.permissionDeniedMessage);
            }
            
            // 3. التحقق من حالة المستند في الوقت الفعلي (للتأكد من عدم تغييرها من قبل مستخدم آخر)
            const evalRef = doc(db, "security_evaluations", evaluation.id);
            const latestEvalDoc = await getDoc(evalRef);

            if (!latestEvalDoc.exists() || latestEvalDoc.data().status !== 'Needs Revision') {
                throw new Error(t.statusMismatchMessage); // رسالة تناقض الحالة
            }

            // 4. إذا مر كل شيء بنجاح، افتح الصفحة وابدأ التحميل فيها
            window.open(`/companies/evaluation/edit/${sequenceNumber}`, '_blank');
            
        } catch(error: any) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: error.message || t.genericErrorMessage });
        } finally {
            hideActionLoading(); // ✅ أخفِ شاشة الانتظار دائمًا
        }
    };

    const handleTaskAction = (action: 'approve' | 'reject' | 'needs_revision') => {
            // ✅ التحقق من وجود التوقيع قبل المتابعة في حالة الاعتماد فقط
        if (action === 'approve' && !user?.signature_url) {
            showDialog({
                variant: 'alert',
                title: t.noSignatureTitle,
                message: t.noSignatureMessage,
            });
            return; // إيقاف التنفيذ
        }
        if (!currentTask || !evaluation || isProcessing) return;

        const performAction = async (reason = "", optionalReason = "") => {
            setIsProcessing(true);
            const messageMap = { approve: t.processing.approving, reject: t.processing.rejecting, needs_revision: t.processing.revising };
            showActionLoading(messageMap[action]);
            
            try {
                const clientContext = await getClientContext();
                const evalRef = doc(db, "security_evaluations", evaluation.id);
                const latestEvalDoc = await getDoc(evalRef);
                
                if (!latestEvalDoc.exists() || latestEvalDoc.data().status !== 'Awaiting Approval') {
                    throw new Error(t.statusMismatchMessage);
                }
                if (!hasPermission('sss:2')) {
                    throw new Error(t.permissionDeniedMessage);
                }

                await processTask({ 
                    taskId: currentTask.id, 
                    action, 
                    reason,
                    optionalReason, // ✅ الإضافة
                    clientContext
                });

                showDialog({ variant: 'success', title: t.successTitle, message: t.actionSuccessMessage });

            } catch (error: any) {
                showDialog({ variant: 'alert', title: t.errorTitle, message: error.message });
            } finally {
                hideActionLoading();
                setIsProcessing(false);
            }
        };

        if (action === 'approve') {
            showDialog({
                variant: 'prompt',
                title: t.confirmActionTitle, // ✅ تم التعديل: استخدام عنوان التأكيد
                message: t.optionalNotesMessage, // ✅ تم التعديل: رسالة الملاحظة الاختيارية
                icon: CheckCircleIcon,
                color: 'green',
                validation: () => null, // ✅ تم التعديل: لا يوجد تحقق (اختياري)
                onConfirm: (notes) => {
                    // ✅ تم التعديل: إرسال الملاحظات كملاحظة اختيارية
                    performAction("", cleanText(notes || '')); 
                }
            });
        } else {
            const isReject = action === 'reject';
            showDialog({
                variant: 'prompt',
                title: isReject ? t.rejectReasonTitle : t.revisionReasonTitle,
                message: isReject ? t.rejectReasonMessage : t.revisionReasonMessage,
                icon: isReject ? XCircleIcon : ArrowUturnLeftIcon,
                color: isReject ? 'red' : 'yellow',
                isDismissable: false, 
                validation: (notes) => { 
                    if (!cleanText(notes || '')) {
                        return t.mandatoryReasonMessage;
                    }
                    return null;
                },
                onConfirm: (notes) => {
                    const cleanedNotes = cleanText(notes || '');
                    performAction(cleanedNotes);
                }
            });
        }
    };

    useEffect(() => {
        // 1. لا تفعل شيئًا على الإطلاق إذا لم يكن المستخدم أو الرقم موجودًا بعد
        if (isAuthLoading || !user || !evaluationSequenceNumber) {
            return;
        }

        setInitialLoad(true); // نبدأ التحميل الآن بعد التأكد من وجود المستخدم
        setNotFound(false); // إعادة تعيين حالة "غير موجود"

        let unsubscribeTask: () => void = () => {};
        let unsubscribeEval: () => void = () => {};
        let unsubscribeHistory: () => void = () => {};

        // 2. إنشاء دالة async واحدة لجلب كل البيانات الأولية
        const fetchData = async () => {
            const seqNum = Number(evaluationSequenceNumber);
            if (isNaN(seqNum)) {
                setNotFound(true);
                return;
            }

            // 3. جلب التقييم الأساسي مرة واحدة باستخدام getDocs (أكثر موثوقية هنا)
            const evalQuery = query(collection(db, "security_evaluations").withConverter(evaluationConverter), where("sequence_number", "==", seqNum), limit(1));
            const evalSnapshot = await getDocs(evalQuery);

            if (evalSnapshot.empty) {
                setNotFound(true);
                return;
            }

            const evalData = evalSnapshot.docs[0].data();

            // 4. جلب كل البيانات الأخرى بشكل متوازٍ لتحسين السرعة
            const [detailsSnap, companySnap, newerEvalSnapshot, olderEvalSnapshot] = await Promise.all([
                getDoc(doc(db, "evaluation_history", evalData.latest_version_id).withConverter(evaluationDetailsConverter)),
                getDoc(doc(db, "companies", evalData.company_id).withConverter(companyConverter)),
                getDocs(query(collection(db, "security_evaluations").withConverter(evaluationConverter), where("company_id", "==", evalData.company_id), where("evaluation_year", "==", evalData.evaluation_year), where("evaluation_month", "==", evalData.evaluation_month), where("sequence_number", ">", evalData.sequence_number), orderBy("sequence_number", "asc"))),
                getDocs(query(collection(db, "security_evaluations").withConverter(evaluationConverter), where("company_id", "==", evalData.company_id), where("evaluation_year", "==", evalData.evaluation_year), where("evaluation_month", "==", evalData.evaluation_month), where("sequence_number", "<", evalData.sequence_number), orderBy("sequence_number", "desc")))
            ]);

            // معالجة تفاصيل التقييم والمُقيّم
            if (detailsSnap.exists()) {
                const detailsData = detailsSnap.data();
                setEvaluationDetails(detailsData);

                if (detailsData.evaluator_id) {
                    const evaluatorSnap = await getDoc(doc(db, "users", detailsData.evaluator_id).withConverter(userConverter));
                    if (evaluatorSnap.exists()) {
                        const evaluatorData = evaluatorSnap.data();
                        if (evaluatorData.job_id) {
                            const jobSnap = await getDoc(doc(db, "jobs", String(evaluatorData.job_id)).withConverter(jobConverter));
                            if (jobSnap.exists()) evaluatorData.job = jobSnap.data();
                        }
                        setEvaluator(evaluatorData);
                    } else setEvaluator(null);
                }
            } else setEvaluationDetails(null);

            // معالجة باقي البيانات
            setCompany(companySnap.exists() ? companySnap.data() : null);
            const allNewerData = newerEvalSnapshot.docs.map(d => d.data());
            setAllNewerEvaluations(allNewerData);
            setLatestNewerEvaluation(allNewerData.length > 0 ? allNewerData[allNewerData.length - 1] : null);
            setAllOlderEvaluations(olderEvalSnapshot.docs.map(d => d.data()));
            
            // 5. الآن بعد جلب البيانات الأساسية بنجاح، نبدأ المستمعين (Listeners)
            // ✅ التعديل (النقطة 2): مستمع التقييم (للحالة)
            const evalRef = evalSnapshot.docs[0].ref;
            unsubscribeEval = onSnapshot(evalRef, (doc) => {
                if (!doc.exists()) {
                    setNotFound(true);
                    return;
                }
                const updatedEvalData = doc.data();
                
                // التحقق من التغيير بعد التحميل الأولي
                // نستخدم state 'evaluation' للمقارنة
                if (!isInitialLoad && evaluation && updatedEvalData.status !== evaluation.status) {
                    showDialog({ 
                        variant: 'info', 
                        title: t.statusUpdateTitle, 
                        message: t.statusUpdateMessage 
                    });
                }
                // هذا السطر سيقوم بتحديث الحالة عند التحميل الأولي وفي كل تحديث
                setEvaluation(updatedEvalData);
            });
            
            // 5. الآن بعد جلب البيانات الأساسية بنجاح، نبدأ المستمعين (Listeners)
            // مستمع المهمة
            const taskQuery = user.is_super_admin
                ? query(collection(db, "tasks_queue").withConverter(taskConverter), where("parent_entity_id", "==", evalData.id), limit(1))
                : query(collection(db, "tasks_queue").withConverter(taskConverter), where("parent_entity_id", "==", evalData.id), where("assigned_to_user_ids", "array-contains", user.id));
            unsubscribeTask = onSnapshot(taskQuery, (taskSnapshot) => setCurrentTask(taskSnapshot.empty ? null : taskSnapshot.docs[0].data()));

            // مستمع سجل الإجراءات
            const historyQuery = query(collection(db, "tasks_history"), where("parent_entity_id", "==", evalData.id), orderBy("created_at", "asc"));
            unsubscribeHistory = onSnapshot(historyQuery, async (historySnapshot) => {
                const userIds = new Set(historySnapshot.docs.map(d => d.data().actor_user_id).filter(Boolean).map(id => id.trim()));
                const usersMap = new Map<string, UserDoc>();
                if (userIds.size > 0) {
                    const usersSnap = await getDocs(query(collection(db, "users").withConverter(userConverter), where(documentId(), "in", Array.from(userIds))));
                    usersSnap.forEach(userDoc => usersMap.set(userDoc.id, userDoc.data()));
                }

                const jobIds = new Set(Array.from(usersMap.values()).map(u => u.job_id).filter(Boolean).map(id => String(id)));
                const jobsMap = new Map<string, JobDoc>();
                if (jobIds.size > 0) {
                    const jobsSnap = await getDocs(query(collection(db, "jobs").withConverter(jobConverter), where(documentId(), "in", Array.from(jobIds))));
                    jobsSnap.forEach(jobDoc => jobsMap.set(jobDoc.id, jobDoc.data()));
                }

                const historyItems = historySnapshot.docs.map(hDoc => {
                    const data = hDoc.data();
                    const actor = usersMap.get(data.actor_user_id?.trim());
                    const job = actor?.job_id ? jobsMap.get(String(actor.job_id)) : null;
                    if (actor && job) actor.job = job;
                    const jobTitle = job ? (language === 'ar' ? job.name_ar : job.name_en) : 'N/A';
                    const userName = (language === 'ar' ? actor?.name_ar : actor?.name_en) || actor?.name_ar || actor?.name_en || "System";
                    
                    return {
                        id: hDoc.id,
                        user_name: userName,
                        user_avatar_url: actor?.avatar_url || '',
                        job_title: jobTitle,
                        action_key: data.status,
                        timestamp: data.created_at.toDate(),
                        notes: data.details?.revision_reason || data.details?.reason || null,
                        actor: actor || null,
                        signature_url: data.actor_signature_url || null,
                        seal_url: data.actor_seal_url || null,
                    };
                });
                setActionHistory(historyItems);
            });
        };

        fetchData().catch(error => {
            console.error("Failed to fetch evaluation details:", error);
            setNotFound(true);
        }).finally(() => {
            // 6. نضمن دائمًا إيقاف التحميل، سواء نجحت العملية أو فشلت
            setInitialLoad(false);
        });

        // 7. دالة التنظيف لإلغاء المستمعين عند مغادرة الصفحة
        return () => {
            unsubscribeEval();
            unsubscribeTask();
            unsubscribeHistory();
        };
    }, [evaluationSequenceNumber, user, isAuthLoading, language]);
        
    useEffect(() => { setPageLoading(isAuthLoading || isInitialLoad); }, [isAuthLoading, isInitialLoad, setPageLoading]);
    
    const content = () => {
        if (isAuthLoading || isInitialLoad) {
            return <div className="text-center py-10"><p>{t.common.loading}</p></div>;
        }
        if (notFound || !evaluation || !evaluationDetails || !company) {
            return <div className="text-center py-10"><p>{t.evaluationNotFound}</p></div>;
        }
        return (
            <EvaluationDetailsContent
                evaluation={evaluation}
                evaluationDetails={evaluationDetails}
                company={company}
                currentTask={currentTask}
                actionHistory={actionHistory}
                translations={translations}
                handleTaskAction={handleTaskAction}
                hasPermission={hasPermission}
                isProcessing={isProcessing}
                onStepClick={handleStepClick}
                onHistoryUserClick={handleUserClick}
                user={user}
                evaluator={evaluator}
                handleEditClick={handleEditClick}
                handlePdfAction={handlePdfAction}
                latestNewerEvaluation={latestNewerEvaluation}
                allNewerEvaluations={allNewerEvaluations}
                userHasSignature={userHasSignature}
                allOlderEvaluations={allOlderEvaluations}
            />
        );
    };

    return (
        <MainLayout pageTitle={`${t.pageTitle} ${evaluation?.sequence_number || '...'}`}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={evaluationSequenceNumber}
                    custom={language}
                    variants={directionalSlideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    {content()}
                </motion.div>
            </AnimatePresence>
            <UsersListOverlay
                isOpen={isUsersOverlayOpen}
                onClose={() => setUsersOverlayOpen(false)}
                title={overlayTitle}
                users={overlayUsers}
                onUserClick={handleUserClick}
                onRefresh={() => handleStepClick(overlayStepIndex, overlayTitle)}
            />
            <UserProfileOverlay
                isOpen={isProfileOverlayOpen}
                onClose={() => setIsProfileOverlayOpen(false)}
            />
        </MainLayout>
    );
}