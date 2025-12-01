import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {
    staggeredContainerVariants,
    staggeredItemVariants,
    interactiveItemVariants,
    directionalSlideVariants,
    fadeInVariants
} from "../../lib/animations";
import { useAuth } from "../contexts/UserContext";
import { useDialog } from "../contexts/DialogContext";
import { useLanguage } from "../contexts/LanguageContext";
import { usePageLoading } from "../contexts/LoadingContext";
import { useServices } from "../contexts/ServicesContext"; // <-- لاستخدامه في التوجيه
import { collection, query, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, where, documentId, getDocs, orderBy, limit } from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db } from '../../lib/firebase';
import { 
    ExclamationTriangleIcon, 
    ListBulletIcon, 
    HashtagIcon, 
    UserIcon, 
    BuildingOfficeIcon, 
    ClockIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CheckCircleIcon,
    CheckBadgeIcon,
    EyeIcon
} from "@heroicons/react/24/outline";
import { useNavigate, Link } from "react-router-dom";

// --- 1. الأنواع والمحولات (Types & Converters) ---

interface TaskDoc extends DocumentData {
    id: string; // <-- هذا هو ID المستند
    task_id: string; // <-- هذا هو ID المهمة (منطقي)
    parent_entity_id: string;
    target_entity_id: string;
    target_entity_name_ar: string;
    target_entity_name_en: string;
    sequence_number: number | null;
    service_id: number;
    sa_id: number;
    status: string;
    assigned_to_user_ids: string[];
    created_at: any; // Timestamp
}

interface UserDoc extends DocumentData {
    id: string;
    name_ar: string;
    name_en: string;
    avatar_url?: string;
}

interface CompanyDoc extends DocumentData {
    id: string;
    name_ar: string;
    name_en: string;
}

const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
    toFirestore: (data: T): DocumentData => data,
    fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T)
});

const taskConverter = createConverter<TaskDoc>();
const userConverter = createConverter<UserDoc>();
const companyConverter = createConverter<CompanyDoc>();

// --- 2. المكونات الداخلية ---

// (مكون لعرض مهمة واحدة)
const TaskCard = ({ 
    task, 
    taskTitle, 
    reference, 
    targetName, // <-- Prop جديد
    targetIcon, // <-- Prop جديد
    language, 
    href       // <-- Prop جديد
}: { 
    task: TaskDoc, 
    taskTitle: string, 
    reference: string, 
    targetName: string, 
    targetIcon: React.ElementType,
    language: 'ar' | 'en', 
    href: string 
}) => {
    
    const TargetIcon = targetIcon; // لإرضاء TypeScript

    return (
        <motion.div // <-- 1. تغيير من button إلى div
            variants={{ ...staggeredItemVariants, ...interactiveItemVariants }}
            whileHover="hover"
            // 2. إزالة onClick
            className="w-full text-start bg-gradient-to-br from-gray-900/60 to-gray-800/60 rounded-lg p-3 sm:p-4 shadow-md border border-gray-700 hover:border-[#FFD700]/30 transition-colors duration-300"
        >
            <div className="flex justify-between items-start">
                <div className="flex-grow flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 bg-gray-800 p-2 sm:p-3 rounded-lg mt-1">
                        <ListBulletIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#FFD700]" />
                    </div>
                    <div className="flex-grow">
                        <h3 className="text-md sm:text-lg font-bold text-white">{taskTitle}</h3>
                        <div className="mt-2 text-xs sm:text-sm text-gray-400 space-y-1">
                            {/* الرقم المرجعي */}
                            <div className="flex items-center gap-2">
                                <HashtagIcon className="w-4 h-4" />
                                <span>{reference}</span>
                            </div>

                            {/* ✅ --- الإضافة الجديدة: اسم الهدف --- */}
                            <div className="flex items-center gap-2 font-semibold text-gray-300">
                                <TargetIcon className="w-4 h-4" />
                                <span>{targetName}</span>
                            </div>
                            {/* --- نهاية الإضافة --- */}

                            {/* تاريخ الإنشاء */}
                            <div className="flex items-center gap-2">
                                <ClockIcon className="w-4 h-4" />
                                <span>
                                    {task.created_at?.toDate().toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric', numberingSystem: 'latn' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* ✅ --- 3. تعديل: زر الفتح (يستخدم <Link>) --- */}
                <motion.div
                    variants={interactiveItemVariants}
                    whileHover={{ ...interactiveItemVariants.hover }}
                    whileTap={{ ...interactiveItemVariants.tap }}
                >
                    <Link
                        to={href} // <-- 1. المسار من react-router
                        title={language === 'ar' ? 'فتح المهمة' : 'Open Task'}
                        // 2. هذا هو الزر/الأيقونة
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-[#FFD700] rounded-full"
                    >
                        <EyeIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </Link>
                </motion.div>
            </div>
        </motion.div>
    );
};

// --- ✅ 2. تعديل: مكون "لا يوجد مهام" أصبح احترافياً ---
const NoTasksComponent = ({ hasCompletedTasks, translations, loading }: { hasCompletedTasks: boolean | null, translations: any, loading: boolean }) => {
    
    // 1. تحديد الرسالة والأيقونة بناءً على سجل المستخدم
    const { IconComponent, title, message, color } = useMemo(() => {
        if (hasCompletedTasks === true) {
            // (الحالة 1: المستخدم أنجز مهاماً)
            return {
                IconComponent: CheckBadgeIcon, // <-- أيقونة الإنجاز
                title: translations.allTasksCompletedTitle,
                message: translations.allTasksCompletedMessage,
                color: "text-green-400" // لون الإنجاز
            };
        } else {
            // (الحالة 2: المستخدم ليس لديه مهام معلقة ولا تاريخ)
            return {
                IconComponent: CheckCircleIcon, // <-- أيقونة محايدة
                title: translations.noTasksTitle,
                message: translations.noTasksMessage,
                color: "text-gray-400" // لون محايد
            };
        }
    }, [hasCompletedTasks, translations]);

    // (عرض حالة تحميل بسيطة أثناء فحص التاريخ)
    if (loading || hasCompletedTasks === null) {
        return (
            <motion.div variants={fadeInVariants} className="flex-grow bg-gray-800/50 rounded-xl shadow-2xl p-6 border border-gray-700">
                <div className="text-center py-10">
                    <p className="text-gray-400">{translations.loading}</p>
                </div>
            </motion.div>
        );
    }

    // (العرض الرئيسي)
    return (
        <motion.div variants={fadeInVariants} className="flex-grow bg-gray-800/50 rounded-xl shadow-2xl p-6 border border-gray-700">
            <div className="text-center py-10 flex flex-col items-center">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}>
                    <IconComponent className={`h-16 w-16 mx-auto ${color}`} />
                </motion.div>
                <h3 className="mt-4 text-xl font-bold text-white">{title}</h3>
                <p className="mt-2 text-md text-gray-400 max-w-sm">{message}</p>
            </div>
        </motion.div>
    );
};


// --- 3. المكون الرئيسي للصفحة ---

export default function PendingTasks() {
    const { language } = useLanguage();
    const { user, hasPermission, isLoading: isAuthLoading } = useAuth();
    const { setPageLoading } = usePageLoading();
    const { getFullPagePath, getServiceByKey } = useServices(); // <-- دوال التوجيه
    const navigate = useNavigate();
    const { showDialog } = useDialog();
    const prevTasksRef = useRef<TaskDoc[] | undefined>();

    // --- 4. نصوص الواجهة (Translations) ---
    const translations = useMemo(() => ({
        ar: {
            pageTitle: "المهام المعلقة",
            loading: "جاري تحميل المهام...",
            // ✅ --- التعديل: رسائل احترافية ---
            noTasksTitle: "لا توجد مهام",
            noTasksMessage: "ليس لديك أي مهام معلقة في الوقت الحالي.",
            allTasksCompletedTitle: "أحسنت!",
            allTasksCompletedMessage: "لقد أنجزت جميع مهامك المعلقة. صفحتك نظيفة الآن.",
            // ---
            referenceLabel: "المرجع:",
            targetLabel: "الهدف:",
            newTaskTitle: "مهمة جديدة",
            newTaskMessage: "تم إسناد مهمة جديدة لك:",
            taskCompletedTitle: "مهمة مُنجزة",
            taskCompletedMessage: "تم إنجاز المهمة التالية:",
            taskTitles: {
                "sss:1": "إنشاء تقييم جديد",
                "sss:2": "اعتماد تقييم",
                "sss:3": "تعديل تقييم",
                "sss:13": "إنشاء مستخدم جديد",
                "sss:14": "اعتماد مستخدم جديد",
                "sss:15": "تعديل طلب مستخدم",
            }
        },
        en: {
            pageTitle: "Pending Tasks",
            loading: "Loading tasks...",
            // ✅ --- MODIFICATION: Professional messages ---
            noTasksTitle: "No Tasks",
            noTasksMessage: "You do not have any pending tasks at this time.",
            allTasksCompletedTitle: "All Done!",
            allTasksCompletedMessage: "You have completed all your pending tasks. Your list is clear.",
            // ---
            referenceLabel: "Ref:",
            targetLabel: "Target:",
            newTaskTitle: "New Task",
            newTaskMessage: "A new task has been assigned to you:",
            taskCompletedTitle: "Task Completed",
            taskCompletedMessage: "The following task has been completed:",
            taskTitles: {
                "sss:1": "Create New Evaluation",
                "sss:2": "Approve Evaluation",
                "sss:3": "Revise Evaluation",
                "sss:13": "Create New User Request",
                "sss:14": "Approve New User",
                "sss:15": "Revise User Request",
            }
        }
    }), [language]);

    const t = translations[language];

    // --- 5. جلب البيانات (Data Fetching) ---

    // ✅ --- 1. تعريف جميع حالات التحميل أولاً ---
    const [isAugmenting, setIsAugmenting] = useState(true);
    const [historyCheckLoading, setHistoryCheckLoading] = useState(true);
    const [hasCompletedTasks, setHasCompletedTasks] = useState<boolean | null>(null);

    // (الاستعلام الأساسي للمهام)
// ✅ --- الإضافة: إعادة تعريف حالة البيانات الداعمة ---
    const [dataMaps, setDataMaps] = useState({
        users: new Map<string, UserDoc>(),
        companies: new Map<string, CompanyDoc>()
    });
    const tasksQuery = useMemo(() => {
        if (!user) return null;
        
        const qBase = collection(db, "tasks_queue").withConverter(taskConverter);
        
        if (user.is_super_admin) {
            // 1. المدير الخارق يرى كل المهام المعلقة
            return query(
                qBase, 
                where("status", "==", "pending"), 
                orderBy("created_at", "desc")
            );
        } else {
            // 2. المستخدم العادي يرى فقط المهام المخصصة له
            return query(
                qBase,
                where("assigned_to_user_ids", "array-contains", user.id),
                where("status", "==", "pending"),
                orderBy("created_at", "desc")
            );
        }
    }, [user]); // الاعتمادية على كائن المستخدم فقط

    // ✅ --- 2. جلب المهام ---
    const [fetchedTasks, tasksLoading, tasksError] = useCollectionData(tasksQuery);

    // ✅ --- 3. فحص سجل المهام (الآن التعريفات موجودة) ---
    useEffect(() => {
        if (!user) return; // انتظر حتى يتوفر المستخدم

        const checkHistory = async () => {
            setHistoryCheckLoading(true); // <-- هذا السطر آمن الآن
            try {
                // استعلام سريع جداً يجلب مستند واحد فقط إن وجد
                const historyQuery = query(
                    collection(db, "tasks_history"),
                    where("actor_user_id", "==", user.id), // مهام قام بها المستخدم
                    limit(1) // نحتاج فقط معرفة ما إذا كان السجل موجوداً أم لا
                );
                const historySnapshot = await getDocs(historyQuery);
                
                if (!historySnapshot.empty) {
                    setHasCompletedTasks(true); // المستخدم لديه تاريخ
                } else {
                    setHasCompletedTasks(false); // المستخدم ليس لديه تاريخ
                }
            } catch (error) {
                console.error("Error checking task history:", error);
                setHasCompletedTasks(false); // افتراض عدم وجود تاريخ في حالة الخطأ
            } finally {
                setHistoryCheckLoading(false);
            }
        };

        checkHistory();
    }, [user]); // يعمل مرة واحدة عند توفر المستخدم

    // (جلب البيانات الداعمة عند تغير المهام)
    useEffect(() => {
        // ✅ --- التعديل: إصلاح منطق التحميل ---
        
        // 1. لا تفعل شيئاً طالما أن قائمة المهام الرئيسية لا تزال قيد التحميل
        if (tasksLoading) {
            return;
        }

        // 2. إذا انتهى تحميل المهام، ولكن لا توجد مهام (فارغة أو خطأ)
        // (fetchedTasks إما أن تكون مصفوفة فارغة [] أو undefined في حالة الخطأ)
        if (!fetchedTasks || fetchedTasks.length === 0) {
            setDataMaps({ users: new Map(), companies: new Map() }); // مسح البيانات
            setIsAugmenting(false); // <-- 🚀 أهم سطر: أخبر النظام بأننا انتهينا
            return; // توقف هنا
        }

        // 3. إذا وصلنا إلى هنا، فهذا يعني أن tasksLoading = false ولدينا مهام
        const augmentData = async () => {
            // (لسنا بحاجة لـ setIsAugmenting(true) لأنها الافتراضية)
            
            const userIds = new Set<string>();
            const companyIds = new Set<string>();

            fetchedTasks.forEach(task => {
                // (اجمع ID الشركات من مهام التقييم)
                if (task.service_id === 5) { // (بافتراض أن 5 هي خدمة التقييم)
                    companyIds.add(task.target_entity_id);
                }
                // (اجمع ID المستخدمين من مهام المستخدمين)
                if (task.service_id === 2) { // (بافتراض أن 2 هي خدمة المستخدمين)
                    // (لا نحتاج لشيء هنا لأن الاسم موجود في target_entity_name)
                }
            });

            const usersMap = new Map<string, UserDoc>();
            const companiesMap = new Map<string, CompanyDoc>();

            // (جلب الشركات)
            if (companyIds.size > 0) {
                const companiesQuery = query(collection(db, "companies").withConverter(companyConverter), where(documentId(), "in", [...companyIds]));
                const companiesSnap = await getDocs(companiesQuery);
                companiesSnap.forEach(doc => companiesMap.set(doc.id, doc.data()));
            }

            setDataMaps({ users: usersMap, companies: companiesMap });
            setIsAugmenting(false); // <-- 🚀 أهم سطر: أخبر النظام بأننا انتهينا
        };

        augmentData();

    }, [fetchedTasks, tasksLoading]); // <-- ✅ التعديل: المراقبة بناءً على المهام وحالة تحميلها

// --- 6. دالة التوجيه الذكية (Smart Navigation) ---

    // ✅ --- 1. (جديد): دالة لجلب المسار كرابط ---
    const getTaskPath = useCallback((task: TaskDoc): string => {
        const permissionKey = `sss:${task.sa_id}`;

        // (المسارات الثابتة)
        if (permissionKey === 'sss:2' || permissionKey === 'sss:3') {
            if (task.sequence_number) {
                return `/companies/evaluation/details/${task.sequence_number}`;
            }
            console.error("Task Path Error: Task (sss:2/3) is missing sequence_number");
            return "#"; // مسار احتياطي
        }
        if (permissionKey === 'sss:14' || permissionKey === 'sss:15') {
            if (task.parent_entity_id) {
                return `/system/users/details/${task.parent_entity_id}`;
            }
            console.error("Task Path Error: Task (sss:14/15) is missing parent_entity_id");
            return "#";
        }

        // (المسارات الديناميكية)
        const dynamicPath = getFullPagePath(permissionKey);
        if (dynamicPath) {
            return dynamicPath;
        }
        
        // (مسار احتياطي)
        const serviceDoc = getServiceByKey(permissionKey);
        if(serviceDoc && serviceDoc.page) {
            console.warn(`Could not build full path for ${permissionKey}, returning direct page: ${serviceDoc.page}`);
            return serviceDoc.page; 
        }
        
        console.error(`Task Path Error: No dynamic path found for key ${permissionKey}`);
        return "#";

    }, [getFullPagePath, getServiceByKey]); // <-- الاعتماديات

    // ✅ --- 2. (تعديل): دالة للانتقال عند الضغط (تُستخدم الآن عند الحاجة فقط) ---
    const handleTaskNavigation = useCallback((task: TaskDoc) => {
        const path = getTaskPath(task);
        if (path && path !== "#") {
            navigate(path);
        }
    }, [getTaskPath, navigate]);

    // --- 7. منطق العرض (Render Logic) ---

    const dataLoading = tasksLoading || isAugmenting || historyCheckLoading; // ✅ تم إضافة فحص التاريخ
    
    useEffect(() => {
        setPageLoading(isAuthLoading || dataLoading);
    }, [isAuthLoading, dataLoading, setPageLoading]);

    // (دالة مساعدة لترجمة عنوان المهمة)
    const getTaskTitle = (task: TaskDoc): string => {
        const key = `sss:${task.sa_id}`;
        // @ts-ignore
        const titleFromMap = t.taskTitles[key];
        
        if (titleFromMap) {
            return titleFromMap;
        }
        
        // (عنوان احتياطي إذا لم يوجد في ملف الترجمة)
        const service = getServiceByKey(key);
        if (service) {
            // @ts-ignore
            return language === 'ar' ? service.label_ar : service.label_en;
        }
        
return `Task (SA_ID: ${task.sa_id})`;
    };

    // ✅ --- الإضافة الجديدة: useEffect لمراقبة التغييرات وإظهار الإشعارات ---
    useEffect(() => {
        // لا تفعل شيئاً إذا كانت البيانات تُحمّل أو لم تصل بعد
        if (tasksLoading || !fetchedTasks) {
            return;
        }

        const prevTasks = prevTasksRef.current;
        
        // إذا كانت هذه هي المرة الأولى للتحميل (prevTasks غير موجود)
        // فقط قم بتخزين الحالة الحالية ولا تظهر أي إشعار
        if (prevTasks === undefined) {
            prevTasksRef.current = fetchedTasks;
            return;
        }

        // --- المقارنة لاكتشاف التغييرات ---
        const prevTaskIds = new Set(prevTasks.map(t => t.id));
        const currentTaskIds = new Set(fetchedTasks.map(t => t.id));

        // 1. البحث عن المهام المضافة (موجودة في currentTaskIds وليست في prevTaskIds)
        for (const task of fetchedTasks) {
            if (!prevTaskIds.has(task.id)) {
                // هذه مهمة جديدة
                const taskTitle = getTaskTitle(task);
                showDialog({
                    variant: 'info',
                    title: t.newTaskTitle,
                    message: `${t.newTaskMessage}\n"${taskTitle}"`,
                    icon: ListBulletIcon
                });
            }
        }

        // 2. البحث عن المهام المحذوفة (موجودة في prevTaskIds وليست في currentTaskIds)
        for (const task of prevTasks) {
            if (!currentTaskIds.has(task.id)) {
                // هذه مهمة أُنجزت أو حُذفت
                const taskTitle = getTaskTitle(task);
                showDialog({
                    variant: 'success',
                    title: t.taskCompletedTitle,
                    message: `${t.taskCompletedMessage}\n"${taskTitle}"`,
                    icon: CheckCircleIcon
                });
            }
        }

        // 3. تحديث "الحالة السابقة" لتكون جاهزة للمقارنة القادمة
        prevTasksRef.current = fetchedTasks;

    }, [fetchedTasks, tasksLoading, showDialog, t, getTaskTitle]); // <-- الاعتماديات

    // (دالة مساعدة لترجمة المرجع)
    const getTaskReference = (task: TaskDoc): string => {
        if (task.sequence_number) {
            return `${t.referenceLabel} ${task.sequence_number}`;
        }
        
        const targetName = language === 'ar' ? task.target_entity_name_ar : task.target_entity_name_en;
        return `${t.targetLabel} ${targetName}`;
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={language} // (مستنسخ من NewEvaluation)
                custom={language}
                variants={directionalSlideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
            >
                {/* ✅ --- التعديل: منطق العرض الجديد --- */}
                
                {/* الحالة 1: لا يزال التحميل جارياً */}
                {dataLoading && (
                    <motion.div 
                        variants={staggeredContainerVariants} 
                        initial="initial" 
                        animate="animate" 
                        className="flex-grow bg-gray-800/50 rounded-xl shadow-2xl space-y-4 p-4 sm:p-6 border border-gray-700"
                    >
                        <p className="text-center text-gray-400">{t.loading}</p>
                    </motion.div>
                )}
    
                {/* الحالة 2: انتهى التحميل، ولا توجد مهام معلقة */}
                {!dataLoading && (!fetchedTasks || fetchedTasks.length === 0) && (
                    <NoTasksComponent 
                        hasCompletedTasks={hasCompletedTasks} 
                        translations={t}
                        loading={historyCheckLoading} // تمرير حالة التحميل للمكون الداخلي
                    />
                )}
    
                {/* الحالة 3: انتهى التحميل، ويوجد مهام معلقة */}
{!dataLoading && fetchedTasks && fetchedTasks.length > 0 && (
                    <motion.div 
                        variants={staggeredContainerVariants} 
                        initial="initial" 
                        animate="animate" 
                        className="flex-grow bg-gray-800/50 rounded-xl shadow-2xl space-y-4 p-4 sm:p-6 border border-gray-700"
                    >
                        {fetchedTasks.map(task => {
                            // --- ✅ الإضافات الجديدة هنا ---
                            const taskTitle = getTaskTitle(task);
                            const reference = getTaskReference(task);
                            const targetName = language === 'ar' ? task.target_entity_name_ar : task.target_entity_name_en;
                            const taskPath = getTaskPath(task);
                            // (نحدد الأيقونة المناسبة)
                            const TargetIcon = task.service_id === 5 ? BuildingOfficeIcon : UserIcon; 

                            return (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    taskTitle={taskTitle}
                                    reference={reference}
                                    targetName={targetName}
                                    targetIcon={TargetIcon}
                                    language={language}
                                    href={taskPath}
                                />
                            );
                        })}
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}