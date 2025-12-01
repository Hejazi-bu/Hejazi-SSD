// src/components/Users/UserRequestDetails.tsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
    CheckCircleIcon, XCircleIcon, ArrowUturnLeftIcon, PencilSquareIcon,
    BuildingOfficeIcon,
    BriefcaseIcon, ChatBubbleLeftEllipsisIcon, UserIcon as UserOutlineIcon, PlusCircleIcon, CheckBadgeIcon, MagnifyingGlassIcon, XMarkIcon, EyeIcon, ArrowPathIcon,
    ArrowLeftIcon, ArrowRightIcon,
    ClockIcon, InformationCircleIcon, ArchiveBoxXMarkIcon, UserIcon, EnvelopeIcon, PhoneIcon, IdentificationIcon,
    HashtagIcon,
    LockClosedIcon, LockOpenIcon, PaperAirplaneIcon // ✅ أيقونات جديدة
} from "@heroicons/react/24/outline";
import { useDialog } from "../contexts/DialogContext";
import { useParams, useNavigate, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { UserProfileOverlay } from "./UserProfileOverlay";
import { getClientContext } from '../../lib/clientContext';
import { cleanText } from "../../utils/textUtils";

// --- الأنواع والمحولات ---
type RequestStatus = 'Needs Revision' | 'Awaiting Approval' | 'Approved' | 'Rejected';

interface CompanyDoc extends DocumentData { id: string; name_ar: string; name_en: string; }
interface UserOnboardingRequestDoc extends DocumentData {
    id: string;
    email: string;
    name_ar: string;
    name_en: string;
    phone_number: string;
    employee_id: string;
    company_id: string;
    job_id: number;
    status: RequestStatus;
    created_by: string;
    created_at: Timestamp;
    updated_at: Timestamp;
    sequence_number?: number;
}
interface TaskDoc extends DocumentData { id: string; task_id: string; parent_entity_id: string; }
interface ActionHistoryItem {
    id: string; user_name: string; user_avatar_url: string; job_title: string;
    action_key: string; timestamp: Date; notes?: string; actor: UserDoc | null;
    signature_url?: string;
    seal_url?: string;
}
// ✅ تحديث واجهة المستخدم لتشمل حقول التجميد
interface UserDoc extends DocumentData { 
    id: string; 
    name_ar?: string; 
    name_en?: string; 
    avatar_url?: string; 
    job_id?: string; 
    name?: string; 
    job?: { name_ar: string; name_en: string; }; 
    signature_url?: string; 
    stamp_url?: string;
    is_frozen?: boolean; // ✅ جديد
    last_onboarding_email_sent_at?: Timestamp; // ✅ جديد
    is_setup_complete?: boolean; // ✅ جديد
}
interface JobDoc extends DocumentData { id: string; name_ar: string; name_en: string; }

const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({ toFirestore: (data: T): DocumentData => data, fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T) });
const userOnboardingRequestConverter = createConverter<UserOnboardingRequestDoc>();
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
// ... (DefaultAvatarIcon, UsersListOverlay, InfoCard, InfoItem remain the same)
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

const RequestStepper = ({ status, onStepClick }: { status: RequestStatus, onStepClick: (index: number, title: string) => void }) => {
    const { language } = useLanguage();
    const isRevisionState = status === 'Needs Revision';
    const stepsConfig = useMemo(() => [
        { name: language === 'ar' ? 'الطلب' : 'Request', title: language === 'ar' ? 'القائم بالطلب' : 'Requester', icon: PlusCircleIcon },
        { name: language === 'ar' ? 'الموافقة' : 'Approval', title: language === 'ar' ? 'القائم بالموافقة' : 'Approver', icon: CheckBadgeIcon },
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
                    const isRejected = currentStepIndex === 1 && status === 'Rejected';
                    const isCurrentBecauseOfRevision = isCurrent && isRevisionState;
                    const isLastStep = index === stepsConfig.length - 1;
                    return (
                        <React.Fragment key={step.name}>
                            <motion.div className="flex flex-col items-center z-10" variants={interactiveItemVariants} whileHover="hover" whileTap="tap">
                                <button onClick={() => onStepClick(index, step.title)} className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isresubmitted ? 'bg-yellow-500 border-yellow-500' : ''} ${isCurrentBecauseOfRevision ? 'border-blue-400 bg-gray-800' : ''} ${isCurrent && !isRejected && !isCurrentBecauseOfRevision ? 'border-yellow-400 bg-gray-800' : ''} ${isRejected ? 'bg-red-500/20 border-red-500' : ''} ${!isresubmitted && !isCurrent && !isRejected ? 'bg-gray-800 border-gray-600' : ''}`}>
                                    <step.icon className={`w-6 h-6 transition-colors ${isresubmitted ? 'text-gray-900' : isCurrentBecauseOfRevision ? 'text-blue-400' : (isCurrent && !isRejected ? 'text-yellow-400' : (isRejected ? 'text-red-500' : 'text-gray-500'))}`} />
                                </button>
                                <p className={`mt-2 text-xs w-20 text-center font-semibold ${isCurrent || isresubmitted || isRejected ? 'text-white' : 'text-gray-500'}`}>{step.name}</p>
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

// ... (ActionHistoryTimeline, StatusDisplay remain the same)
function ActionHistoryTimeline({ history, t, language, onUserClick }: { history: ActionHistoryItem[], t: any, language: 'ar' | 'en', onUserClick: (user: UserDoc) => void; }) {
    const actionIcons: { [key: string]: React.ElementType } = {
        created: PlusCircleIcon,
        approved: CheckBadgeIcon,
        Rejected: XCircleIcon,
        revision_requested: ArrowUturnLeftIcon,
        resubmitted: PencilSquareIcon,
        cancelled_obsolete: ArchiveBoxXMarkIcon,
        ACCOUNT_FROZEN: LockClosedIcon, // ✅ إضافة
        ACCOUNT_UNFROZEN: LockOpenIcon // ✅ إضافة
    };
    
    const actionStyles: { [key: string]: { iconColor: string; bgColor: string; } } = {
        created: { iconColor: 'text-blue-400', bgColor: 'bg-blue-500/10' },
        approved: { iconColor: 'text-green-400', bgColor: 'bg-green-500/10' },
        Rejected: { iconColor: 'text-red-400', bgColor: 'bg-red-500/10' },
        revision_requested: { iconColor: 'text-orange-400', bgColor: 'bg-orange-500/10' },
        resubmitted: { iconColor: 'text-purple-400', bgColor: 'bg-purple-500/10' },
        cancelled_obsolete: { iconColor: 'text-gray-500', bgColor: 'bg-gray-800/50' },
        ACCOUNT_FROZEN: { iconColor: 'text-red-400', bgColor: 'bg-red-900/20' }, // ✅ إضافة
        ACCOUNT_UNFROZEN: { iconColor: 'text-green-400', bgColor: 'bg-green-900/20' }, // ✅ إضافة
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
const StatusDisplay = ({ status, t }: { status: RequestStatus, t: any }) => {
    const config: Record<RequestStatus, { text: string; color: string; bgColor: string }> = {
        'Needs Revision': { text: t.needsRevision, color: "text-orange-400", bgColor: "bg-orange-900/50" },
        'Awaiting Approval': { text: t.awaitingApproval, color: "text-yellow-400", bgColor: "bg-yellow-900/50" },
        'Approved': { text: t.approved, color: "text-green-400", bgColor: "bg-green-900/50" },
        'Rejected': { text: t.Rejected, color: "text-red-400", bgColor: "bg-red-900/50" },
    };
    const statusConfig = config[status];
    if (!statusConfig) return <div className="font-bold text-gray-400">{status}</div>;
    return <div className={`inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${statusConfig.color} ${statusConfig.bgColor}`}>{statusConfig.text}</div>;
};

// --- المكون الرئيسي للعرض ---
function UserRequestDetailsContent({
    requestDoc, company, job, creator,
    currentTask, actionHistory, translations, handleTaskAction, hasPermission, 
    isProcessing, onStepClick, onHistoryUserClick, user, userHasSignature,
    handleFreezeAction, handleResendEmailAction, createdUserDoc // ✅ إضافة Props جديدة
}: {
    requestDoc: UserOnboardingRequestDoc; 
    company: CompanyDoc | null;
    job: JobDoc | null;
    creator: UserDoc | null;
    currentTask: TaskDoc | null; 
    actionHistory: ActionHistoryItem[]; 
    translations: any;
    handleTaskAction: (action: 'approve' | 'reject' | 'needs_revision') => void;
    hasPermission: (permission: string) => boolean; 
    isProcessing: boolean;
    onStepClick: (index: number, title: string) => void;
    onHistoryUserClick: (user: UserDoc) => void;
    user: { id: string; is_super_admin?: boolean; } | null;
    handleEditClick: (requestId: string) => void;
    userHasSignature: boolean;
    handleFreezeAction: (freeze: boolean) => void; // ✅
    handleResendEmailAction: () => void; // ✅
    createdUserDoc: UserDoc | null; // ✅
}) {
    const { language } = useLanguage();
    const t = translations[language];
    
    const formattedCreationDate = useMemo(() => {
        if (!requestDoc.created_at) return '...';
        return requestDoc.created_at.toDate().toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
            dateStyle: 'full',
            timeStyle: 'medium',
            numberingSystem: 'latn'
        });
    }, [requestDoc.created_at, language]);

    const showManagementActions = requestDoc.status === 'Awaiting Approval' && hasPermission('sss:14') && !!currentTask;
    const showUserActions = requestDoc.status === 'Needs Revision' && hasPermission('sss:15');

    // ✅ شروط عرض أزرار التجميد وإعادة الإرسال
    const showApprovedUserActions = requestDoc.status === 'Approved' && createdUserDoc && hasPermission('sss:14'); // نفترض صلاحية الاعتماد هي نفسها لإدارة المستخدم

    // ✅ حساب وقت الانتظار المتبقي
    const emailCooldownMinutes = 10;
    const remainingCooldown = useMemo(() => {
        if (!createdUserDoc?.last_onboarding_email_sent_at) return 0;
        const diffMs = new Date().getTime() - createdUserDoc.last_onboarding_email_sent_at.toDate().getTime();
        const diffMins = diffMs / 60000;
        return diffMins < emailCooldownMinutes ? Math.ceil(emailCooldownMinutes - diffMins) : 0;
    }, [createdUserDoc?.last_onboarding_email_sent_at]);

    return (
        <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" className="space-y-6 pb-12">
            
            <RequestStepper status={requestDoc.status} onStepClick={onStepClick} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InfoCard title={t.orgInfo}>
                    <InfoItem Icon={BuildingOfficeIcon} label={t.common.company} value={company ? (language === 'ar' ? company.name_ar : company.name_en) : '...'} />
                    <InfoItem Icon={BriefcaseIcon} label={t.common.jobTitle} value={job ? (language === 'ar' ? job.name_ar : job.name_en) : '...'} />
                    <InfoItem Icon={UserOutlineIcon} label={t.common.creator} value={creator ? (language === 'ar' ? creator.name_ar : creator.name_en) : '...'} />
                    <InfoItem Icon={IdentificationIcon} label={t.common.employeeId} value={requestDoc.employee_id || t.common.notProvided} />
                </InfoCard>

                <InfoCard title={t.requestInfo}>
                    <InfoItem Icon={InformationCircleIcon} label={t.common.status} value={<StatusDisplay status={requestDoc.status} t={t} />} />
                    <InfoItem Icon={ClockIcon} label={t.common.creationDate} value={formattedCreationDate} />
                    <InfoItem Icon={HashtagIcon} label={t.common.sequenceNumber} value={requestDoc.sequence_number || t.common.notProvided} />
                    
                    {/* ✅ عرض حالة التجميد إن وجدت */}
                    {createdUserDoc && (
                        <InfoItem 
                            Icon={createdUserDoc.is_frozen ? LockClosedIcon : LockOpenIcon} 
                            label={t.common.accountStatus} 
                            value={
                                <span className={`font-bold ${createdUserDoc.is_frozen ? 'text-red-400' : 'text-green-400'}`}>
                                    {createdUserDoc.is_frozen ? t.frozen : t.active}
                                </span>
                            } 
                        />
                    )}
                </InfoCard>
            </div>
            
            <motion.div variants={staggeredItemVariants} className="pt-6 border-t border-gray-700">
                <InfoCard title={t.requestedUserDetails}>
                    <InfoItem Icon={UserIcon} label={t.common.nameAr} value={requestDoc.name_ar} />
                    <InfoItem Icon={UserIcon} label={t.common.nameEn} value={requestDoc.name_en} />
                    <InfoItem Icon={EnvelopeIcon} label={t.common.email} value={requestDoc.email} />
                    <InfoItem Icon={PhoneIcon} label={t.common.phone} value={requestDoc.phone_number} />
                </InfoCard>
            </motion.div>
            
            <ActionHistoryTimeline history={actionHistory} t={t} language={language} onUserClick={onHistoryUserClick} />
            
            <AnimatePresence>
                {(showManagementActions || showUserActions || showApprovedUserActions) && (
                    <motion.div variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="pt-6 border-t border-gray-700">
                        <h2 className="text-xl font-bold text-gray-200 mb-4">
                            {showManagementActions && t.managementActions}
                            {showUserActions && t.userActions}
                            {showApprovedUserActions && t.approvedUserActions}
                        </h2>
                        <div className="flex flex-wrap gap-4">
                            {showManagementActions && (
                                <>
                                    <div className="relative">
                                        <motion.button 
                                            variants={interactiveItemVariants} whileHover="hover" whileTap="tap" 
                                            disabled={isProcessing || !userHasSignature} 
                                            onClick={() => handleTaskAction('approve')} 
                                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
                                        >
                                            <CheckCircleIcon className="w-5 h-5"/>{t.approve}
                                        </motion.button>
                                        {!userHasSignature && (
                                            <p className="absolute -bottom-5 ltr:left-0 rtl:right-0 text-xs text-red-400 w-max">{t.noSignatureMessage}</p>
                                        )}
                                    </div>
                                    <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" disabled={isProcessing} onClick={() => handleTaskAction('reject')} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"><XCircleIcon className="w-5 h-5"/>{t.reject}</motion.button>
                                    <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" disabled={isProcessing} onClick={() => handleTaskAction('needs_revision')} className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg disabled:bg-yellow-700 disabled:cursor-not-allowed"><ArrowUturnLeftIcon className="w-5 h-5"/>{t.returnForRevision}</motion.button>
                                </>
                            )}
                            {showUserActions && (
                                <Link to={`/system/users/edit/${requestDoc.sequence_number}`}>
                                    <motion.div variants={interactiveItemVariants} whileHover="hover" whileTap="tap" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg cursor-pointer">
                                        <PencilSquareIcon className="w-5 h-5"/>{t.editRequest}
                                    </motion.div>
                                </Link>
                            )}
                            {/* ✅ أزرار المستخدم المعتمد الجديدة */}
                            {showApprovedUserActions && (
                                <>
                                    {createdUserDoc?.is_frozen ? (
                                        <motion.button 
                                            variants={interactiveItemVariants} whileHover="hover" whileTap="tap" 
                                            disabled={isProcessing} 
                                            onClick={() => handleFreezeAction(false)} 
                                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500"
                                        >
                                            <LockOpenIcon className="w-5 h-5"/>{t.unfreezeAccount}
                                        </motion.button>
                                    ) : (
                                        <motion.button 
                                            variants={interactiveItemVariants} whileHover="hover" whileTap="tap" 
                                            disabled={isProcessing} 
                                            onClick={() => handleFreezeAction(true)} 
                                            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500"
                                        >
                                            <LockClosedIcon className="w-5 h-5"/>{t.freezeAccount}
                                        </motion.button>
                                    )}

                                    <motion.button 
                                        variants={interactiveItemVariants} whileHover="hover" whileTap="tap" 
                                        disabled={isProcessing || createdUserDoc?.is_frozen || remainingCooldown > 0 || createdUserDoc?.is_setup_complete} 
                                        onClick={handleResendEmailAction} 
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    >
                                        <PaperAirplaneIcon className="w-5 h-5"/>
                                        {remainingCooldown > 0 
                                            ? `${t.resendEmail} (${remainingCooldown} ${t.minutes})` 
                                            : createdUserDoc?.is_setup_complete ? t.accountActivated : t.resendEmail
                                        }
                                    </motion.button>
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
export default function UserRequestDetails() {
    const { language } = useLanguage();
    const { requestId } = useParams<{ requestId: string }>(); 
    const { user, hasPermission, isLoading: isAuthLoading } = useAuth();
    const { showDialog } = useDialog();
    const { setPageLoading } = usePageLoading();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const navigate = useNavigate(); 

    const [requestDoc, setRequestDoc] = useState<UserOnboardingRequestDoc | null>(null);
    const [createdUserDoc, setCreatedUserDoc] = useState<UserDoc | null>(null); // ✅
    const [company, setCompany] = useState<CompanyDoc | null>(null);
    const [job, setJob] = useState<JobDoc | null>(null);
    const [creator, setCreator] = useState<UserDoc | null>(null);
    const [currentTask, setCurrentTask] = useState<TaskDoc | null>(null);
    const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
    
    const [isInitialLoad, setInitialLoad] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const prevStatusRef = useRef<string | null>(null);
    
    const [isUsersOverlayOpen, setUsersOverlayOpen] = useState(false);
    const [overlayUsers, setOverlayUsers] = useState<UserDoc[]>([]);
    const [overlayTitle, setOverlayTitle] = useState('');
    const [overlayStepIndex, setOverlayStepIndex] = useState(0);
    const [isProfileOverlayOpen, setIsProfileOverlayOpen] = useState(false);
    const userHasSignature = !!user?.signature_url;

    const translations = useMemo(() => ({
        ar: {
            // ... (الترجمات السابقة)
            locale: "ar-EG",
            noSignatureTitle: "التوقيع مطلوب",
            noSignatureMessage: "يجب عليك رفع توقيعك في ملفك الشخصي أولاً قبل الموافقة.",
            pageTitle: "تفاصيل طلب المستخدم",
            requestNotFound: "لم يتم العثور على طلب المستخدم.",
            errorTitle: "خطأ",
            successTitle: "نجاح",
            actionSuccessMessage: "تم تنفيذ الإجراء بنجاح!",
            statusUpdateTitle: "تحديث الحالة",
            statusUpdateMessage: "لقد تغيرت حالة هذا الطلب.",
            statusMismatchMessage: "لقد تغيرت حالة الطلب من قبل مستخدم آخر. لا يمكن المتابعة.",
            permissionDeniedTitle: "تم رفض الإجراء",
            permissionDeniedMessage: "لم تعد تملك الصلاحية اللازمة لتنفيذ هذا الإجراء.",
            preparingEdit: "جاري تجهيز صفحة التعديل...",
            rejectReasonTitle: "سبب الرفض",
            rejectReasonMessage: "يرجى إدخال سبب رفض هذا الطلب.",
            revisionReasonTitle: "سبب طلب التعديل",
            revisionReasonMessage: "يرجى توضيح التعديلات المطلوبة.",
            mandatoryReasonMessage: "هذا الحقل إجباري.",
            confirmActionTitle: "تأكيد الإجراء",
            confirmApprove: "هل أنت متأكد من الموافقة على إنشاء هذا المستخدم؟",
            approveNotesTitle: "ملاحظات الاعتماد (اختياري)", 
            approveNotesMessage: "أضف أي ملاحظات إضافية بخصوص عملية الاعتماد.", 
            confirmReject: "هل أنت متأكد من رفض هذا الطلب؟",
            confirmReturn: "هل أنت متأكد من إعادة الطلب للموظف؟",
            managementActions: "إجراءات المسؤول",
            userActions: "الإجراءات المتاحة",
            approvedUserActions: "إجراءات المستخدم المعتمد", // ✅
            approve: "موافقة وإنشاء",
            reject: "رفض",
            returnForRevision: "إعادة للتعديل",
            editRequest: "تعديل الطلب",
            needsRevision: "بحاجة لمراجعة",
            awaitingApproval: "بانتظار الموافقة",
            approved: "معتمد (تم إنشاء المستخدم)",
            Rejected: "مرفوض",
            orgInfo: "البيانات التنظيمية",
            requestInfo: "بيانات الطلب",
            requestedUserDetails: "بيانات المستخدم المطلوبة",
            actionHistory: "خريطة الإجراءات",
            noActionHistoryTitle: "لا يوجد سجل إجراءات",
            noActionHistoryMessage: "لم يتم تنفيذ أي إجراءات على هذا الطلب بعد.",
            loadingUsers: "جاري جلب المستخدمين...",
            noAccessToProfile: "تحتاج إلى صلاحية للوصول إلى بيانات هذا المستخدم.",
            editingNotAllowedTitle: "غير مسموح بالتعديل",
            editingNotAllowedMessage: "يمكن تعديل الطلب فقط عندما تكون حالته 'بحاجة لمراجعة'.",
            genericErrorMessage: "حدث خطأ أثناء حفظ الطلب.",
            freezeAccount: "تجميد الحساب", // ✅
            unfreezeAccount: "فك تجميد الحساب", // ✅
            resendEmail: "إعادة إرسال التفعيل", // ✅
            accountActivated: "الحساب مفعل", // ✅
            minutes: "دقيقة", // ✅
            frozen: "مجمد", // ✅
            active: "نشط", // ✅
            freezeReasonTitle: "سبب التجميد", // ✅
            freezeReasonMessage: "يرجى ذكر سبب تجميد الحساب.", // ✅
            common: { 
                company: "الشركة", 
                jobTitle: "المسمى الوظيفي",
                creator: "مقدم الطلب",
                employeeId: "الرقم الوظيفي",
                notProvided: "لم يحدد",
                creationDate: "تاريخ الطلب", 
                status: "الحالة", 
                loading: "جاري التحميل...",
                nameAr: "الاسم (بالعربية)",
                nameEn: "الاسم (بالإنجليزية)",
                email: "البريد الإلكتروني",
                phone: "رقم الهاتف",
                sequenceNumber: "رقم العملية",
                optionalNotesLabel: "ملاحظات إضافية",
                accountStatus: "حالة الحساب" // ✅
            },
            processing: { approving: "جاري الموافقة وإنشاء المستخدم...", rejecting: "جاري رفض الطلب...", revising: "جاري إعادة الطلب...", freezing: "جاري تحديث حالة الحساب...", emailing: "جاري إرسال البريد..." },
            actions: { created: "قدم طلب إنشاء المستخدم", approved: "وافق على الطلب (تم إنشاء المستخدم)", Rejected: "رفض الطلب", revision_requested: "طلب تعديل", resubmitted: "اعاد إرسال الطلب بعد التعديل", ACCOUNT_FROZEN: "قام بتجميد الحساب", ACCOUNT_UNFROZEN: "قام بفك تجميد الحساب" } // ✅
        },
        en: {
            // ... (Previous translations)
            locale: "en-US",
            noSignatureTitle: "Signature Required",
            noSignatureMessage: "You must upload your signature in your profile before approving the request.",
            pageTitle: "User Request Details",
            requestNotFound: "User request not found.",
            errorTitle: "Error",
            successTitle: "Success",
            actionSuccessMessage: "Action completed successfully!",
            statusUpdateTitle: "Status Update",
            statusUpdateMessage: "This request's status has changed.",
            statusMismatchMessage: "The request status has been changed by another user. Cannot proceed.",
            permissionDeniedTitle: "Action Denied",
            permissionDeniedMessage: "You no longer have the required permission to perform this action.",
            preparingEdit: "Preparing edit page...",
            rejectReasonTitle: "Reason for Rejection",
            rejectReasonMessage: "Please provide a reason for rejecting this request.",
            revisionReasonTitle: "Reason for Revision",
            revisionReasonMessage: "Please specify the required revisions.",
            mandatoryReasonMessage: "This field is required.",
            confirmActionTitle: "Confirm Action",
            confirmApprove: "Are you sure you want to approve and create this user?",
            approveNotesTitle: "Approval Notes (Optional)", 
            approveNotesMessage: "Add any additional notes regarding the approval process.", 
            confirmReject: "Are you sure you want to reject this request?",
            confirmReturn: "Are you sure you want to return this request to the employee?",
            managementActions: "Manager Actions",
            userActions: "Available Actions",
            approvedUserActions: "Approved User Actions", // ✅
            approve: "Approve & Create",
            reject: "Reject",
            returnForRevision: "Return for Modification",
            editRequest: "Edit Request",
            needsRevision: "Needs Revision",
            awaitingApproval: "Awaiting Approval",
            approved: "Approved (User Created)",
            Rejected: "Rejected",
            orgInfo: "Organizational Information",
            requestInfo: "Request Information",
            requestedUserDetails: "Requested User Details",
            actionHistory: "Action History",
            noActionHistoryTitle: "No Action History",
            noActionHistoryMessage: "No actions have been performed on this request yet.",
            loadingUsers: "Fetching users...",
            noAccessToProfile: "You need permission to access this user's data.",
            editingNotAllowedTitle: "Editing Not Allowed",
            editingNotAllowedMessage: "A request can only be edited when its status is 'Needs Revision'.",
            genericErrorMessage: "An error occurred while saving the request.",
            freezeAccount: "Freeze Account", // ✅
            unfreezeAccount: "Unfreeze Account", // ✅
            resendEmail: "Resend Activation", // ✅
            accountActivated: "Account Activated", // ✅
            minutes: "mins", // ✅
            frozen: "Frozen", // ✅
            active: "Active", // ✅
            freezeReasonTitle: "Freeze Reason", // ✅
            freezeReasonMessage: "Please state the reason for freezing the account.", // ✅
            common: { 
                company: "Company", 
                jobTitle: "Job Title",
                creator: "Requested By",
                employeeId: "Employee ID",
                notProvided: "N/A",
                creationDate: "Request Date", 
                status: "Status", 
                loading: "Loading...",
                nameAr: "Name (Arabic)",
                nameEn: "Name (English)",
                email: "Email Address",
                phone: "Phone Number",
                sequenceNumber: "Sequence No.",
                optionalNotesLabel: "Additional Notes",
                accountStatus: "Account Status" // ✅
            },
            processing: { approving: "Approving and creating user...", rejecting: "Rejecting request...", revising: "Returning request...", freezing: "Updating account status...", emailing: "Sending email..." },
            actions: { created: "Submitted user request", approved: "Approved request (User created)", Rejected: "Rejected request", revision_requested: "Requested revision", resubmitted: "Resubmitted request after revision", ACCOUNT_FROZEN: "Froze the account", ACCOUNT_UNFROZEN: "Unfroze the account" } // ✅
        }
    }), [language]);
    
    const t = translations[language]; 
    
    const watchedKeys = useMemo(() => {
        if (!requestDoc) return [];
        switch (requestDoc.status) {
            case 'Awaiting Approval': return ['sss:14'];
            case 'Needs Revision': return ['sss:15'];
            default: return [];
        }
    }, [requestDoc]);

    usePermissionNotification(watchedKeys);

    const processTask = httpsCallable(functions, 'processUserOnboardingTask');
    const toggleUserFreezeStatus = httpsCallable(functions, 'toggleUserFreezeStatus'); // ✅
    const resendUserOnboardingEmail = httpsCallable(functions, 'resendUserOnboardingEmail'); // ✅

    const handleStepClick = async (index: number, title: string) => {
        let permissionId: string | undefined;
        let finalTitle = title;

        // ✅ تعديل المنطق ليتوافق مع المجموعة (sss:13) بدلاً من المنشئ فقط
        if (requestDoc?.status === 'Needs Revision' && index === 0) {
            finalTitle = language === 'ar' ? 'القائمون بالتعديل' : 'Modifiers';
            permissionId = 'sss:13'; // ✅ نستخدم الصلاحية لجلب المجموعة
        } else {
             permissionId = index === 0 ? 'sss:13' : 'sss:14';
        }

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
                jobsSnap.forEach(jobDoc => jobsMap.set(doc(db, "jobs", jobDoc.id).id, jobDoc.data())); 
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

    const handleEditClick = async (reqId: string) => {
    };

    // ✅ معالج عمليات التجميد
    const handleFreezeAction = (freeze: boolean) => {
        if (!createdUserDoc || isProcessing) return;

        const action = async (reason = "") => {
            setIsProcessing(true);
            showActionLoading(t.processing.freezing);
            try {
                await toggleUserFreezeStatus({ targetUserId: createdUserDoc.id, reason, freeze });
                showDialog({ variant: 'success', title: t.successTitle, message: t.actionSuccessMessage });
            } catch (error: any) {
                showDialog({ variant: 'alert', title: t.errorTitle, message: error.message });
            } finally {
                hideActionLoading();
                setIsProcessing(false);
            }
        };

        if (freeze) {
             showDialog({
                variant: 'prompt',
                title: t.freezeReasonTitle,
                message: t.freezeReasonMessage,
                icon: LockClosedIcon,
                color: 'red',
                isDismissable: false,
                validation: (val) => !cleanText(val || '') ? t.mandatoryReasonMessage : null,
                onConfirm: (val) => action(cleanText(val || ''))
             });
        } else {
            // فك التجميد لا يحتاج سبب إلزامي قوي لكن يمكن إضافته
            action("Admin Unfreeze");
        }
    };

    // ✅ معالج إعادة إرسال البريد
    const handleResendEmailAction = async () => {
        if (!createdUserDoc || isProcessing) return;
        setIsProcessing(true);
        showActionLoading(t.processing.emailing);
        try {
            await resendUserOnboardingEmail({ targetUserId: createdUserDoc.id });
            showDialog({ variant: 'success', title: t.successTitle, message: t.actionSuccessMessage });
        } catch (error: any) {
            showDialog({ variant: 'alert', title: t.errorTitle, message: error.message });
        } finally {
            hideActionLoading();
            setIsProcessing(false);
        }
    };
    
    const handleTaskAction = (action: 'approve' | 'reject' | 'needs_revision') => {
        if (action === 'approve' && !user?.signature_url) {
            showDialog({ variant: 'alert', title: t.noSignatureTitle, message: t.noSignatureMessage });
            return;
        }
        if (!currentTask || !requestDoc || isProcessing) return;

        const performAction = async (reason = "", optionalReason = "") => {
            setIsProcessing(true);
            const messageMap = { approve: t.processing.approving, reject: t.processing.rejecting, needs_revision: t.processing.revising };
            showActionLoading(messageMap[action]);
            
            try {
                const clientContext = await getClientContext();
                const reqRef = doc(db, "user_onboarding_requests", requestDoc.id);
                const latestReqDoc = await getDoc(reqRef);
                
                if (!latestReqDoc.exists() || latestReqDoc.data().status !== 'Awaiting Approval') {
                    throw new Error(t.statusMismatchMessage);
                }
                if (!hasPermission('sss:14')) {
                    throw new Error(t.permissionDeniedMessage);
                }

                await processTask({      
                    taskId: currentTask.id,      
                    action,      
                    reason,
                    optionalReason, 
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
                title: t.approveNotesTitle,
                message: t.approveNotesMessage,
                icon: CheckCircleIcon,
                color: 'green',
                isDismissable: true,
                validation: (notes) => { return null; }, 
                onConfirm: (notes) => { 
                    const cleanedNotes = cleanText(notes || '');
                    performAction("", cleanedNotes); 
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
                    performAction(cleanedNotes, ""); 
                }
            });
        }
    };

    useEffect(() => {
        if (isAuthLoading || !user || !requestId) {
            return;
        }

        setInitialLoad(true);
        setNotFound(false);

        let unsubscribeRequest: () => void = () => {}; 
        let unsubscribeTask: () => void = () => {};
        let unsubscribeHistory: () => void = () => {};
        let unsubscribeCreatedUser: () => void = () => {}; // ✅ اشتراك جديد

        const initializeListeners = async () => {
            try {
                const requestsRef = collection(db, "user_onboarding_requests");
                const q = query(requestsRef, where("sequence_number", "==", Number(requestId)), limit(1));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setNotFound(true);
                    setInitialLoad(false);
                    return;
                }

                const docId = querySnapshot.docs[0].id;
                const requestRef = doc(db, "user_onboarding_requests", docId);

                unsubscribeRequest = onSnapshot(requestRef.withConverter(userOnboardingRequestConverter), async (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const latestReqData = docSnapshot.data();
                        
                        setRequestDoc(prevReq => {
                            if (JSON.stringify(prevReq) !== JSON.stringify(latestReqData)) {
                                return latestReqData;
                            }
                            return prevReq;
                        });

                        // ✅ جلب بيانات المستخدم المنشأ إذا كانت الحالة معتمدة
                        if (latestReqData.status === 'Approved') {
                            // البحث عن المستخدم عبر البريد الإلكتروني
                            const usersRef = collection(db, "users");
                            const uQuery = query(usersRef, where("email", "==", latestReqData.email), limit(1));
                            // نستخدم onSnapshot هنا لمراقبة حالة التجميد في الوقت الفعلي
                            unsubscribeCreatedUser = onSnapshot(uQuery.withConverter(userConverter), (uSnap) => {
                                if (!uSnap.empty) {
                                    setCreatedUserDoc(uSnap.docs[0].data());
                                }
                            });
                        }

                        try {
                            const [companySnap, jobSnap, creatorSnap] = await Promise.all([
                                getDoc(doc(db, "companies", latestReqData.company_id).withConverter(companyConverter)),
                                getDoc(doc(db, "jobs", String(latestReqData.job_id)).withConverter(jobConverter)),
                                getDoc(doc(db, "users", latestReqData.created_by).withConverter(userConverter))
                            ]);
                            
                            setCompany(companySnap.exists() ? companySnap.data() : null);
                            setJob(jobSnap.exists() ? jobSnap.data() : null);
                            
                            if (creatorSnap.exists()) {
                                const creatorData = creatorSnap.data();
                                if (creatorData.job_id) {
                                    const creatorJobSnap = await getDoc(doc(db, "jobs", String(creatorData.job_id)).withConverter(jobConverter));
                                    if (creatorJobSnap.exists()) creatorData.job = creatorJobSnap.data();
                                }
                                setCreator(creatorData);
                            } else {
                                setCreator(null);
                            }
                        } catch (err) {
                            console.error("Error fetching related data inside snapshot:", err);
                        }

                    } else {
                        setNotFound(true);
                    }
                });

                const taskQuery = user.is_super_admin
                    ? query(collection(db, "tasks_queue").withConverter(taskConverter), where("parent_entity_id", "==", docId), limit(1))
                    : query(collection(db, "tasks_queue").withConverter(taskConverter), where("parent_entity_id", "==", docId), where("assigned_to_user_ids", "array-contains", user.id));
                
                unsubscribeTask = onSnapshot(taskQuery, (taskSnapshot) => setCurrentTask(taskSnapshot.empty ? null : taskSnapshot.docs[0].data()));

                const historyQuery = query(collection(db, "tasks_history"), where("parent_entity_id", "==", docId), orderBy("created_at", "asc"));
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
                        jobsSnap.forEach(jobDoc => jobsMap.set(doc(db, "jobs", jobDoc.id).id, jobDoc.data()));
                    }

                    const historyItems = historySnapshot.docs.map(hDoc => {
                        const data = hDoc.data();
                        const actor = usersMap.get(data.actor_user_id?.trim());
                        const job = actor?.job_id ? jobsMap.get(String(actor.job_id)) : null;
                        if (actor && job) actor.job = job;
                        const jobTitle = job ? (language === 'ar' ? job.name_ar : job.name_en) : 'N/A';
                        const userName = (language === 'ar' ? actor?.name_ar : actor?.name_en) || actor?.name_ar || actor?.name_en || "System";
                        
                        const reasonNotes = data.details?.reason || data.details?.revision_reason || data.details?.notes; 
                        const optionalNotes = data.details?.optional_notes;
                        let combinedNotes = reasonNotes ? reasonNotes : '';
                        if (optionalNotes && cleanText(optionalNotes)) {
                                combinedNotes += `\n\n--- ${t.common.optionalNotesLabel} ---\n${optionalNotes}`;
                        } else if (optionalNotes && cleanText(optionalNotes)) {
                                combinedNotes = optionalNotes;
                        }

                        return {
                            id: hDoc.id,
                            user_name: userName,
                            user_avatar_url: actor?.avatar_url || '',
                            job_title: jobTitle,
                            action_key: data.status,
                            timestamp: data.created_at.toDate(),
                            notes: combinedNotes || null,
                            actor: actor || null,
                            signature_url: data.actor_signature_url || null,
                            seal_url: data.actor_seal_url || null,
                        };
                    });
                    setActionHistory(historyItems);
                });

            } catch (error) {
                console.error("Failed to initialize listeners:", error);
                setNotFound(true);
            } finally {
                setInitialLoad(false);
            }
        };

        initializeListeners();

        return () => {
            unsubscribeRequest();
            unsubscribeTask();
            unsubscribeHistory();
            unsubscribeCreatedUser(); // ✅
        };

    }, [requestId, user, isAuthLoading, language, t]);
        
    useEffect(() => { setPageLoading(isAuthLoading || isInitialLoad); }, [isAuthLoading, isInitialLoad, setPageLoading]);
    
    useEffect(() => {
        if (!requestDoc) return;

        if (prevStatusRef.current && prevStatusRef.current !== requestDoc.status) {
            if (requestDoc.status !== 'Awaiting Approval' && user?.id !== requestDoc.created_by) {
                showDialog({ 
                    variant: 'alert', 
                    title: t.statusUpdateTitle, 
                    message: `${t.statusUpdateMessage} (${requestDoc.status})`,
                    color: 'yellow'
                });
            }
        }
        prevStatusRef.current = requestDoc.status;

    }, [requestDoc, user?.id, t, showDialog])

    const content = () => {
        if (isAuthLoading || isInitialLoad) {
            return <div className="text-center py-10"><p>{t.common.loading}</p></div>;
        }
        if (notFound || !requestDoc || !company || !job) {
            return <div className="text-center py-10"><p>{t.requestNotFound}</p></div>;
        }
        return (
            <UserRequestDetailsContent
                requestDoc={requestDoc}
                createdUserDoc={createdUserDoc} // ✅
                company={company}
                job={job}
                creator={creator}
                currentTask={currentTask}
                actionHistory={actionHistory}
                translations={translations}
                handleTaskAction={handleTaskAction}
                hasPermission={hasPermission}
                isProcessing={isProcessing}
                onStepClick={handleStepClick}
                onHistoryUserClick={handleUserClick}
                user={user}
                handleEditClick={handleEditClick}
                userHasSignature={userHasSignature}
                handleFreezeAction={handleFreezeAction} // ✅
                handleResendEmailAction={handleResendEmailAction} // ✅
            />
        );
    };

    return (
        <MainLayout pageTitle={`${t.pageTitle} (${requestDoc?.sequence_number || '...'})`}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={requestId}
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