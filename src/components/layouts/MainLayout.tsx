import React, { useState, ReactNode, useEffect, useMemo, cloneElement, isValidElement, useRef } from "react"; // ✨ تأكد من وجود useRef هنا
import { motion, AnimatePresence } from "framer-motion";
import {
    directionalSlideVariants,
    interactiveItemVariants,
    pageTransitionVariants
} from "../../lib/animations";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/UserContext";
import { useUnsavedChanges } from "../contexts/UnsavedChangesContext";
import { useDialog } from "../contexts/DialogContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
    HomeIcon, LayoutGrid, Bell, ListTodo, UserRound, Menu, Ban,
    Check, X as XIcon, AlertTriangle
} from "lucide-react";
import DynamicIcon from '../home/DynamicIcon';
import { ServicesOverlay } from "../home/ServicesOverlay";
import { TasksOverlay } from "../Tasks/TasksOverlay";
import { UserProfileOverlay } from "../Users/UserProfileOverlay";
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { usePermissionStatus } from "../contexts/PermissionStatusContext";
import { useConnectivity } from "../contexts/ConnectivityContext";
import { useServices } from "../contexts/ServicesContext";
import PermissionOverlay from "../PermissionOverlay";
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

interface MainLayoutProps {
    children: ReactNode;
    pageTitle: string;
    pageIcon?: string | null;
    contextualActions?: ReactNode;
}

const DefaultAvatarIcon = ({ className }: { className?: string }) => (
    <div className="w-full h-full flex items-center justify-center bg-gray-700">
        <UserRound className={`text-gray-400 ${className}`} />
    </div>
);

// ✨ لا يوجد تغييرات داخل SharedHeader
function SharedHeader({ onAvatarClick }: { onAvatarClick: () => void }) {
    const { user, isLoading: isAuthLoading } = useAuth();
    const { language, toggleLanguage } = useLanguage();
    const { isOnline, checkConnectionNow } = useConnectivity(); // ✨ تم إضافة checkConnectionNow هنا
    const { showDialog } = useDialog();                       // ✨ تم إضافة showDialog هنا
    const navigate = useNavigate();
    const location = useLocation();
    const isDashboard = location.pathname === '/dashboard';
    const [isServicesOpen, setIsServicesOpen] = useState(false);
    const [isTasksOpen, setIsTasksOpen] = useState(false);
    const [pendingTasksCount, setPendingTasksCount] = useState(0);

    const baseButtonClass = "flex items-center justify-center h-10 w-10 font-semibold text-gray-300 hover:text-white hover:bg-gray-700/50 focus:outline-none transition-all rounded-full";

    const { deniedKey } = usePermissionStatus();

    const { isDirty, setIsDirty } = useUnsavedChanges();


    useEffect(() => {
        if (!user || isAuthLoading) {
            setPendingTasksCount(0);
            return;
        }
        const tasksQuery = query(collection(db, "tasks_queue"), where("assigned_to_user_ids", "array-contains", user.id));
        const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
            setPendingTasksCount(snapshot.size);
        });
        return () => unsubscribe();
    }, [user, isAuthLoading]);

    const headerClass = "w-full bg-transparent backdrop-blur-sm shadow-lg";

    const tasksDenied = deniedKey === 'ss:pending-tasks';

    // ✨ دالة مساعدة لتغليف التحقق من الاتصال قبل الإجراء
    const handleActionWithCheck = async (action: () => void) => {
        const connected = await checkConnectionNow();
        if (connected) {
            action();
        } else {
            showDialog({ variant: 'alert', title: language === 'ar' ? 'خطأ في الاتصال' : 'Connection Error', message: language === 'ar' ? 'لا يوجد اتصال بالإنترنت.' : 'No internet connection.' });
        }
    };


    return (
        <>
            <header id="app-header" className={headerClass}>
                <div className="w-full px-4 sm:px-6 relative" style={{ minHeight: '52px' }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={language}
                            custom={language}
                            variants={directionalSlideVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="absolute top-0 left-0 w-full px-4 sm:px-6"
                        >
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <motion.button
                                        onClick={onAvatarClick}
                                        className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-[#FFD700]"
                                        variants={interactiveItemVariants} whileHover="hover" whileTap="tap"
                                    >
                                        <div className="w-10 h-10 rounded-full border-2 border-[#FFD700] overflow-hidden">
                                            {user?.avatar_url ? (
                                                <img src={user.avatar_url} alt="User Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <DefaultAvatarIcon className="w-6 h-6"/>
                                            )}
                                        </div>
                                    </motion.button>
                                    <div className="hidden sm:flex flex-col justify-center min-w-0">
                                        <p className="font-bold text-white text-sm truncate">{language === 'ar' ? user?.name_ar : user?.name_en}</p>
                                        <p className="text-xs text-gray-400 truncate">{user?.job ? (language === 'ar' ? user.job.name_ar : user.job.name_en) : '...'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 flex-row-reverse">
                                    {/* ✨ تم تعديل onClick */}
                                    <motion.button
                                        onClick={() => handleActionWithCheck(() => navigate("/dashboard"))}
                                        className={`${baseButtonClass} ${isDashboard ? 'bg-gray-700/80 text-[#FFD700]' : ''}`}
                                        title={language === 'ar' ? 'الرئيسية' : 'Home'}
                                        variants={interactiveItemVariants} whileHover="hover" whileTap="tap"
                                    >
                                        <HomeIcon className="w-5 h-5" />
                                    </motion.button>
                                    {/* ✨ تم تعديل onClick */}
                                    <motion.button
                                        onClick={() => handleActionWithCheck(() => setIsServicesOpen(true))}
                                        className={baseButtonClass}
                                        title={language === 'ar' ? 'الخدمات الرئيسية' : 'Main Services'}
                                        variants={interactiveItemVariants} whileHover="hover" whileTap="tap"
                                    >
                                        <LayoutGrid className="w-5 h-5" />
                                    </motion.button>
                                    <div className="h-6 w-px bg-gray-700 mx-1"></div>
                                    <motion.button
                                        onClick={() => {}} // لا يوجد إجراء يتطلب اتصال هنا حالياً
                                        className={baseButtonClass}
                                        title={language === 'ar' ? 'الإشعارات' : 'Notifications'}
                                        variants={interactiveItemVariants} whileHover="hover" whileTap="tap"
                                    >
                                        <Bell className="w-5 h-5" />
                                    </motion.button>
                                     {/* ✨ تم تعديل onClick */}
                                    <motion.button
                                        onClick={() => {
                                             if (tasksDenied) return; // منع الفتح إذا كان معطلاً
                                             handleActionWithCheck(() => setIsTasksOpen(true));
                                        }}
                                        className={`${baseButtonClass} relative ${tasksDenied ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={language === 'ar' ? 'المهام' : 'Tasks'}
                                        disabled={tasksDenied}
                                        variants={interactiveItemVariants}
                                        whileHover="hover"
                                        whileTap="tap"
                                    >
                                        <ListTodo className="w-5 h-5" />
                                        {pendingTasksCount > 0 && !tasksDenied && (
                                            <motion.span
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                                            >
                                                {pendingTasksCount > 9 ? '9+' : pendingTasksCount}
                                            </motion.span>
                                        )}
                                        {tasksDenied && (
                                            <div className="absolute inset-0 rounded-full w-full h-full flex items-center justify-center scale-150">
                                                <Ban className="w-6 h-6 text-red-500" />
                                            </div>
                                        )}
                                    </motion.button>

                                    <motion.button onClick={toggleLanguage} className={`${baseButtonClass} text-xs`} variants={interactiveItemVariants} whileHover="hover" whileTap="tap">
                                        {language === 'ar' ? 'EN' : 'AR'}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </header>
            <AnimatePresence>
                {isServicesOpen && <ServicesOverlay isOpen={isServicesOpen} onClose={() => setIsServicesOpen(false)} />}
                {isTasksOpen && <TasksOverlay isOpen={isTasksOpen} onClose={() => setIsTasksOpen(false)} />}
            </AnimatePresence>
        </>
    );
}

// ✨ لا يوجد تغييرات داخل SubPageHeader
function SubPageHeader({ pageTitle, pageIcon, contextualActions }: Omit<MainLayoutProps, 'children'>) {
    const { language } = useLanguage();
    const { deniedKey } = usePermissionStatus();

    const isMainServiceDenied = deniedKey?.startsWith('s:');

    const headerClass = "w-full bg-transparent backdrop-blur-sm shadow-lg";

    let finalContextualActions = contextualActions;
    if (contextualActions && isMainServiceDenied) {
        finalContextualActions = React.Children.map(contextualActions, (child) => {
            if (isValidElement(child) && child.props.title?.includes(language === 'ar' ? 'الخدمات الفرعية' : 'Sub-Services')) {
                return (
                    <motion.button
                        disabled={true}
                        className={`${child.props.className || ''} relative opacity-50 cursor-not-allowed`}
                        title={child.props.title}
                        variants={interactiveItemVariants}
                        whileHover="hover"
                        whileTap="tap"
                    >
                        <Menu className="w-5 h-5" />
                        <div className="absolute inset-0 rounded-full w-full h-full flex items-center justify-center scale-150">
                            <Ban className="w-6 h-6 text-red-500" />
                        </div>
                    </motion.button>
                );
            }
            return child;
        });
    }

    return (
        <div id="sub-app-header" className={headerClass}>
            <div className="w-full px-4 sm:px-6 relative" style={{minHeight: '57px'}}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={language}
                        custom={language}
                        variants={directionalSlideVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="absolute top-0 left-0 w-full px-4 sm:px-6"
                    >
                        <div className="flex items-center justify-between h-14 border-b border-white/10">
                            <div className="flex items-center gap-3 min-w-0">
                                {pageIcon && (
                                    <div className="p-1.5 bg-black/20 rounded-full flex-shrink-0">
                                        <DynamicIcon name={pageIcon} className="w-5 h-5 text-[#FFD700]" />
                                    </div>
                                )}
                                <h1 className="text-xl font-bold text-[#FFD700] truncate">{pageTitle}</h1>
                            </div>
                            <div className="flex-shrink-0 [&_svg]:w-6 [&_svg]:h-6">
                                {finalContextualActions}
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function MainLayout({ children, pageTitle, pageIcon, contextualActions }: MainLayoutProps) {
    const { language } = useLanguage();
    const { isOnline, status } = useConnectivity(); // ✨ تم استخدام status أيضاً
    const [showReconnectMessage, setShowReconnectMessage] = useState(false);
    const previousStatusRef = useRef(status); // ✨ تم تصحيح useRef ليعتمد على status
    const isRTL = language === "ar";
    const location = useLocation();
    const isDashboard = location.pathname === '/dashboard';

    const [isProfileOverlayOpen, setIsProfileOverlayOpen] = useState(false);

    const { isAllowed, deniedKey } = usePermissionStatus();
    const { getServiceByKey } = useServices();

    const deniedService = deniedKey ? getServiceByKey(deniedKey) : null;
    const deniedServiceName = deniedService ? (language === 'ar' ? deniedService.label_ar : deniedService.label_en) : null;

    const deniedServiceType = useMemo(() => {
        if (!deniedKey) return null;
        if (deniedKey.startsWith('s:')) return 'service';
        return 'page';
    }, [deniedKey]);

    useEffect(() => {
        if (!isAllowed) {
            document.body.style.overflow = 'hidden';
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Tab' || e.key === ' ' || e.key === 'Enter' || e.key.startsWith('Arrow')) {
                    e.preventDefault();
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            return () => {
                document.body.style.overflow = 'auto';
                document.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [isAllowed]);

    // ✨ useEffect لمراقبة عودة الاتصال (تم التصحيح ليعتمد على status)
    useEffect(() => {
        // التحقق إذا كانت الحالة السابقة offline والحالية online أو poor
        if (previousStatusRef.current === 'offline' && (status === 'online' || status === 'poor')) {
            setShowReconnectMessage(true); // أظهر رسالة إعادة الاتصال
        }
        // تحديث قيمة ref للقيمة الحالية للدورة القادمة
        previousStatusRef.current = status;
    }, [status]); // نراقب التغير في status


    let finalContextualActions = contextualActions;
    let deniedReasonTooltip = '';

    if (!isAllowed) {
        if (deniedServiceType === 'service') {
            deniedReasonTooltip = language === 'ar' ? 'تم تعطيل الخدمة الرئيسية، ولا يمكن الوصول للخدمات الفرعية.' : 'Main service is disabled, sub-services are inaccessible.';
        } else {
            deniedReasonTooltip = language === 'ar' ? 'لا توجد صلاحية للوصول إلى هذه الصفحة.' : 'You do not have permission to access this page.';
        }
    }

    if (deniedServiceType === 'service' && contextualActions && React.isValidElement(contextualActions)) {
        finalContextualActions = React.cloneElement(contextualActions as React.ReactElement<any>, {
            disabled: true,
            'data-tooltip-id': 'contextual-action-tooltip',
            'data-tooltip-content': deniedReasonTooltip,
            className: `${(contextualActions as React.ReactElement).props.className || ''} disabled:opacity-50 disabled:cursor-not-allowed`
        });
    }

    // ✨ حساب قيمة top للشريط الفرعي بناءً على حالة شريط الاتصال
    const subHeaderTopOffset = useMemo(() => {
        if (status === 'offline' || showReconnectMessage) {
            // إذا كان شريط الاتصال ظاهراً، نزيح الشريط الفرعي للأسفل أكثر
             // القيمة 7 تأتي من py-1.5 (0.375rem * 2) + ارتفاع الخط التقريبي
            return `calc(52px + theme(spacing.7))`;
        }
        // إذا كان شريط الاتصال مخفياً، نستخدم الإزاحة الأصلية
        return '52px';
    }, [status, showReconnectMessage]);


    return (
        <motion.div
            className="bg-[#0D1B2A] text-white flex flex-col h-screen"
            dir={isRTL ? "rtl" : "ltr"}
            variants={pageTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
        >
            <header className="sticky top-0 left-0 w-full z-50 flex-shrink-0">
                <SharedHeader
                    onAvatarClick={() => setIsProfileOverlayOpen(true)}
                />
            </header>

            {/* --- شريط حالة الاتصال --- */}
            <AnimatePresence>
                {status === 'offline' ? ( // ✨ يعتمد الآن على status مباشرة
                    // --- حالة عدم الاتصال ---
                    <motion.div
                        key="offline-banner"
                        initial={{ height: 0, opacity: 0 }} // تعديل الأنيميشن
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }} // إضافة مدة
                        className="sticky top-[52px] left-0 w-full z-40 flex-shrink-0 bg-red-600 text-white text-sm px-4 overflow-hidden shadow-lg" // إزالة py-1.5 مؤقتًا للأنيميشن
                    >
                       <div className="py-1.5 flex items-center justify-between"> {/* إضافة padding هنا */}
                           <div className="flex items-center gap-2">
                               <AlertTriangle size={16} />
                               <span>{language === 'ar' ? 'الاتصال مقطوع' : 'Connection Lost'}</span>
                           </div>
                       </div>
                    </motion.div>
                ) : showReconnectMessage ? (
                    // --- حالة عودة الاتصال ---
                    <motion.div
                        key="reconnect-banner"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="sticky top-[52px] left-0 w-full z-40 flex-shrink-0 bg-green-600 text-white text-sm px-4 overflow-hidden shadow-lg"
                    >
                        <div className="py-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Check size={16} />
                                <span>{language === 'ar' ? 'تمت إعادة الاتصال بالإنترنت' : 'Internet Connection Restored'}</span>
                            </div>
                            <button onClick={() => setShowReconnectMessage(false)} className="p-1 rounded-full hover:bg-white/20">
                                <XIcon size={16} />
                            </button>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            {!isDashboard && (
                 // ✨ استخدام الإزاحة المحسوبة ديناميكيًا
                <div style={{ top: subHeaderTopOffset }} className={`sticky left-0 w-full z-30 flex-shrink-0 transition-all duration-300`}>
                    <SubPageHeader
                        pageTitle={pageTitle}
                        pageIcon={pageIcon}
                        contextualActions={finalContextualActions}
                    />
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        custom={language}
                        variants={directionalSlideVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        <main className="relative p-4 sm:p-6">
                            <PermissionOverlay isOpen={!isAllowed} serviceName={deniedServiceName} serviceType={deniedServiceType} />
                            <div className={`transition-all duration-300 ${!isAllowed ? 'blur-md pointer-events-none opacity-50' : ''}`}>
                                {children}
                            </div>
                        </main>
                    </motion.div>
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {isProfileOverlayOpen && (
                    <UserProfileOverlay
                        isOpen={isProfileOverlayOpen}
                        onClose={() => setIsProfileOverlayOpen(false)}
                    />
                )}
            </AnimatePresence>

            <Tooltip id="contextual-action-tooltip" place="top" className="z-50" />
        </motion.div>
    );
}