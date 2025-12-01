// C:\Users\user\Music\hejazi-logic\src\components\GuardsRating\EvaluationHistory.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {
    staggeredContainerVariants,
    staggeredItemVariants,
    interactiveItemVariants,
    fadeInVariants,
    directionalSlideVariants
} from "../../lib/animations";
import { useAuth } from "../contexts/UserContext";
import { useLanguage } from "../contexts/LanguageContext";
import { usePageLoading } from "../contexts/LoadingContext";
import { collection, query, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
    EyeIcon, 
    PencilSquareIcon, 
    ExclamationTriangleIcon, 
    CalendarIcon, 
    BuildingOfficeIcon, 
    StarIcon, 
    CheckBadgeIcon,
    MagnifyingGlassIcon,
    ClockIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    ChevronDownIcon
} from "@heroicons/react/24/outline";
import { useDialog } from "../contexts/DialogContext";
import { useActionLoading } from "../contexts/ActionLoadingContext"; // ✨ 1. استيراد جديد

// --- الأنواع ---
interface EvaluationRecord extends DocumentData {
    id: string;
    sequence_number: number;
    company_name: string;
    overall_score: number;
    evaluation_year: number;
    evaluation_month: number;
    evaluation_date: Date;
    status: string;
    created_at: Timestamp;
}

// ... (جميع المكونات المساعدة مثل InfoItem, getRatingDescription, MultiSelectFilter تبقى كما هي بدون تغيير)
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

function getRatingDescription(rating: number, language: "ar" | "en") {
    const rounded = Math.round(rating);
    const descriptions = {
        ar: ["", "تحتاج إلى تحسين", "مقبول", "جيد", "جيد جداً", "ممتاز"],
        en: ["", "Need improvement", "Acceptable", "Good", "Very Good", "Excellent"],
    };
    return descriptions[language][rounded] || "";
}

const formatNumberEn = (value: number | string): string => {
    try {
        return new Intl.NumberFormat('en-US', { useGrouping: false }).format(Number(value));
    } catch {
        return String(value);
    }
};

function MultiSelectFilter({ options, selected, onChange, title, translations }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleCheckboxChange = (value: string) => {
        const newSelected = selected.includes(value)
            ? selected.filter((item: string) => item !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const buttonText = selected.length === 0 
        ? translations.all 
        : `${selected.length} ${translations.selected}`;

    return (
        <div className="relative" ref={wrapperRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 bg-gray-700 p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]">
                <span>{title}: {buttonText}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-10 mt-2 w-56 bg-gray-800 border border-gray-600 rounded-md shadow-lg p-2 top-full rtl:right-0"
                    >
                        {options.map((option: any) => (
                            <label key={option.value} className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded-md cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-[#FFD700] focus:ring-[#FFD700]"
                                    checked={selected.includes(option.value)}
                                    onChange={() => handleCheckboxChange(option.value)}
                                />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- المكون الرئيسي للصفحة ---
export default function EvaluationHistory() {
    const { language } = useLanguage();
    const { hasPermission, isLoading: isAuthLoading } = useAuth();
    const { setPageLoading } = usePageLoading();
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading(); // ✨ 2. استدعاء الهوك

    const [records, setRecords] = useState<EvaluationRecord[]>([]);
    const [isReady, setIsReady] = useState(false); // ✨ 3. حالة جديدة للتحكم بالجاهزية
    const [error, setError] = useState<string | null>(null);
    
    // ... (باقي حالات الفلترة والفرز تبقى كما هي)
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({
        key: 'created_at',
        direction: 'descending'
    });
    
    const translations = useMemo(() => ({
        ar: {
            searchPlaceholder: "ابحث برقم التسلسل أو اسم الشركة...",
            noRecords: "لم يتم العثور على تقييمات مطابقة.",
            errorLoading: "حدث خطأ أثناء تحميل البيانات.",
            seqNo: "رقم التسلسل",
            company: "الشركة",
            evalDate: "تاريخ التقييم",
            createdDate: "تاريخ الإنشاء",
            score: "النتيجة",
            status: "الحالة",
            viewDetails: "عرض التفاصيل",
            edit: "تعديل",
            editingNotAllowedTitle: "غير مسموح بالتعديل",
            editingNotAllowedMessage: "يمكن تعديل التقييم فقط عندما تكون حالته 'بحاجة لمراجعة'.",
            permissionMissingTitle: "صلاحية غير كافية",
            permissionMissingViewMessage: "لا تملك الصلاحية اللازمة لعرض تفاصيل التقييم.",
            permissionMissingEditMessage: "لا تملك الصلاحية اللازمة لتعديل هذا التقييم.",
            filterByStatus: "فلترة حسب الحالة",
            all: "الكل",
            needsRevision: "بحاجة لمراجعة",
            awaitingApproval: "بانتظار الاعتماد",
            approved: "معتمد",
            Rejected: "مرفوض",
            sortBy: "فرز حسب",
            sortDirection: "اتجاه الفرز",
            selected: "محدد",
            companyName: "اسم الشركة",
            preparingPage: "جاري تجهيز الصفحة...", // ✨ 4. ترجمة جديدة
        },
        en: {
            searchPlaceholder: "Search by sequence no. or company name...",
            noRecords: "No matching evaluations found.",
            errorLoading: "An error occurred while loading data.",
            seqNo: "Seq. No.",
            company: "Company",
            evalDate: "Evaluation Date",
            createdDate: "Creation Date",
            score: "Score",
            status: "Status",
            viewDetails: "View Details",
            edit: "Edit",
            editingNotAllowedTitle: "Editing Not Allowed",
            editingNotAllowedMessage: "An evaluation can only be edited when its status is 'Needs Revision'.",
            permissionMissingTitle: "Insufficient Permission",
            permissionMissingViewMessage: "You do not have the required permission to view evaluation details.",
            permissionMissingEditMessage: "You do not have the required permission to edit this evaluation.",
            filterByStatus: "Filter by Status",
            all: "All",
            needsRevision: "Needs Revision",
            awaitingApproval: "Awaiting Approval",
            approved: "Approved",
            Rejected: "Rejected",
            sortBy: "Sort by",
            sortDirection: "Sort Direction",
            selected: "selected",
            companyName: "Company Name",
            preparingPage: "Preparing page...", // ✨ 4. ترجمة جديدة
        }
    }), [language]);

    const t = language === 'ar' ? translations.ar : translations.en;
    
    const canEditRecords = hasPermission('sss:3');
    const canViewDetails = hasPermission('sss:4');

    // ✨ 5. تعديل useEffect الخاص بالتحميل
    useEffect(() => {
        setPageLoading(isAuthLoading || !isReady);
    }, [isAuthLoading, isReady, setPageLoading]);

    // ✨ 6. تعديل useEffect الخاص بجلب البيانات
    useEffect(() => {
        if (isAuthLoading) return;

        const fetchData = async () => {
            try {
                // جلب كل البيانات اللازمة بشكل متوازٍ
                const [evaluationsSnap, companiesSnap, historySnap] = await Promise.all([
                    getDocs(query(collection(db, "security_evaluations"))),
                    getDocs(collection(db, "companies")),
                    getDocs(collection(db, "evaluation_history"))
                ]);

                const companiesMap = new Map(companiesSnap.docs.map(doc => [doc.id, doc.data()]));
                const historyMap = new Map(historySnap.docs.map(doc => [doc.id, doc.data()]));

                const fetchedRecords: EvaluationRecord[] = evaluationsSnap.docs.map(docSnap => {
                    const evalData = docSnap.data();
                    const companyData = companiesMap.get(evalData.company_id);
                    const historyData = historyMap.get(evalData.latest_version_id);

                    return {
                        id: docSnap.id,
                        sequence_number: evalData.sequence_number || 0,
                        company_name: language === 'ar' ? companyData?.name_ar : companyData?.name_en || companyData?.name_ar || 'Unknown',
                        evaluation_year: evalData.evaluation_year,
                        evaluation_month: evalData.evaluation_month,
                        evaluation_date: new Date(evalData.evaluation_year, evalData.evaluation_month - 1),
                        status: evalData.status,
                        overall_score: historyData?.overall_score || 0,
                        created_at: evalData.created_at,
                    } as EvaluationRecord;
                });

                setRecords(fetchedRecords);
                setError(null);
            } catch (err) {
                console.error("Error fetching evaluation history:", err);
                setError(t.errorLoading);
            } finally {
                setIsReady(true); // الإشارة بأن الصفحة جاهزة للعرض
            }
        };

        fetchData();
    }, [isAuthLoading, language, t.errorLoading]);

    // ✨ 7. تعديل أزرار التنقل
    const handleNavigation = useCallback((url: string, permissionCheck: boolean, permissionMessage: string) => {
        if (!permissionCheck) {
            showDialog({ variant: 'alert', title: t.permissionMissingTitle, message: permissionMessage });
            return;
        }
        
        showActionLoading(t.preparingPage);
        
        // فتح الرابط في لسان جديد
        const newTab = window.open(url, '_blank');
        
        // إخفاء التحميل بعد فترة قصيرة للسماح بفتح اللسان الجديد
        setTimeout(() => {
            hideActionLoading();
            if (!newTab) {
                // في حال منع المتصفح النوافذ المنبثقة
                showDialog({ variant: 'alert', title: t.errorLoading, message: 'Please allow pop-ups for this site.' });
            }
        }, 1500);

    }, [showDialog, showActionLoading, hideActionLoading, t]);
    
    const handleViewDetails = (sequenceNumber: number) => {
        handleNavigation(`/companies/evaluation/details/${sequenceNumber}`, canViewDetails, t.permissionMissingViewMessage);
    };

    const handleEditEvaluation = (sequenceNumber: number, status: string) => {
        if (status !== 'Needs Revision') {
            showDialog({ variant: 'alert', title: t.editingNotAllowedTitle, message: t.editingNotAllowedMessage });
            return;
        }
        handleNavigation(`/companies/evaluation/edit/${sequenceNumber}`, canEditRecords, t.permissionMissingEditMessage);
    };

    const getStatusTextAndColor = useCallback((status: string) => {
        switch (status) {
            case 'Needs Revision': return { text: t.needsRevision, color: 'text-orange-400' };
            case 'Awaiting Approval': return { text: t.awaitingApproval, color: 'text-yellow-400' };
            case 'Approved': return { text: t.approved, color: 'text-green-400' };
            case 'Rejected': return { text: t.Rejected, color: 'text-red-400' };
            default: return { text: status, color: 'text-gray-400' };
        }
    }, [t]);

    const processedRecords = useMemo(() => {
        let filtered = [...records];

        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            filtered = filtered.filter(record => 
                record.company_name.toLowerCase().includes(lowercasedFilter) ||
                record.sequence_number.toString().includes(lowercasedFilter)
            );
        }

        if (filterStatuses.length > 0) {
            filtered = filtered.filter(record => filterStatuses.includes(record.status));
        }

        filtered.sort((a, b) => {
            const valA = a[sortConfig.key as keyof EvaluationRecord];
            const valB = b[sortConfig.key as keyof EvaluationRecord];
            let comparison = 0;

            if (valA instanceof Timestamp && valB instanceof Timestamp) {
                comparison = valA.toMillis() - valB.toMillis();
            } else if (valA instanceof Date && valB instanceof Date) {
                comparison = valA.getTime() - valB.getTime();
            } else if (typeof valA === 'string' && typeof valB === 'string') {
                comparison = valA.localeCompare(valB);
            } else if (typeof valA === 'number' && typeof valB === 'number') {
                comparison = valA - valB;
            }

            return sortConfig.direction === 'ascending' ? comparison : -comparison;
        });

        return filtered;
    }, [records, searchTerm, filterStatuses, sortConfig]);
    
    const toggleSortDirection = () => {
        setSortConfig(prev => ({ ...prev, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const statusOptions = [
        { value: "Approved", label: t.approved },
        { value: "Rejected", label: t.Rejected },
        { value: "Needs Revision", label: t.needsRevision },
        { value: "Awaiting Approval", label: t.awaitingApproval },
    ];
    
    // ✨ 8. تعديل هيكل العرض
    return (
        <AnimatePresence mode="wait">
            <motion.div key={language} custom={language} variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit">
                {!isReady ? (
                    <div className="space-y-4 pt-20">
                         {Array.from({ length: 5 }).map((_, i) => (
                            <motion.div key={i} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 h-28 animate-pulse"></motion.div>
                         ))}
                    </div>
                ) : (
                    <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" className="space-y-6">
                        <motion.div variants={staggeredItemVariants} className="bg-gray-800/50 rounded-xl shadow-2xl p-4 border border-gray-700 space-y-4">
                            <div className="flex justify-end rtl:justify-start">
                                <div className="w-full sm:w-auto relative">
                                    <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2 rtl:left-auto rtl:right-3"/>
                                    <input
                                        type="text"
                                        placeholder={t.searchPlaceholder}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full sm:w-72 bg-gray-700 py-2 pl-10 pr-3 rtl:pr-10 rtl:pl-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] transition-colors"
                                    />
                                </div>
                            </div>
                            <hr className="border-gray-700"/>
                            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
                                <MultiSelectFilter
                                    options={statusOptions}
                                    selected={filterStatuses}
                                    onChange={setFilterStatuses}
                                    title={t.filterByStatus}
                                    translations={t}
                                />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-300">{t.sortBy}:</span>
                                    <select value={sortConfig.key} onChange={e => setSortConfig(prev => ({ ...prev, key: e.target.value }))} className="bg-gray-700 p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]">
                                        <option value="created_at">{t.createdDate}</option>
                                        <option value="evaluation_date">{t.evalDate}</option>
                                        <option value="company_name">{t.companyName}</option>
                                        <option value="overall_score">{t.score}</option>
                                        <option value="sequence_number">{t.seqNo}</option>
                                    </select>
                                    <button onClick={toggleSortDirection} title={t.sortDirection} className="p-2 bg-gray-700 rounded-md border border-gray-600 hover:bg-gray-600 transition-colors">
                                        {sortConfig.direction === 'ascending' ? <ArrowUpIcon className="w-5 h-5"/> : <ArrowDownIcon className="w-5 h-5"/>}
                                    </button>
                                </div>
                            </div>
                        </motion.div>

                        <div className="space-y-4">
                            {error ? (
                                <motion.div variants={fadeInVariants} className="bg-red-900/50 border border-red-700 rounded-lg p-6 text-center">
                                    <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-red-400" />
                                    <p className="mt-4 text-lg font-semibold text-red-300">{error}</p>
                                </motion.div>
                            ) : processedRecords.length === 0 ? (
                                <motion.div variants={fadeInVariants} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 text-center">
                                    <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-yellow-400" />
                                    <p className="mt-4 text-lg font-semibold text-yellow-300">{t.noRecords}</p>
                                </motion.div>
                            ) : (
                                processedRecords.map(record => {
                                    const { text: statusText, color: statusColor } = getStatusTextAndColor(record.status);
                                    const dateOptions: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric', numberingSystem: 'latn' };
                                    const dateTimeOptions: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short', numberingSystem: 'latn' };
                                    const recordDate = record.evaluation_date.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', dateOptions);
                                    const ratingDescription = getRatingDescription(record.overall_score, language);
                                    
                                    return (
                                        <motion.div key={record.id} layout variants={staggeredItemVariants} className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-lg p-4 sm:p-5 shadow-lg border border-gray-700 hover:border-[#FFD700]/30 transition-all duration-300">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                <div className="flex-grow grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4 w-full">
                                                    <InfoItem Icon={CheckBadgeIcon} label={t.seqNo} value={formatNumberEn(record.sequence_number)} colorClass="text-white"/>
                                                    <InfoItem Icon={BuildingOfficeIcon} label={t.company} value={record.company_name} colorClass="text-white"/>
                                                    <InfoItem Icon={CalendarIcon} label={t.evalDate} value={recordDate} />
                                                    <InfoItem Icon={ClockIcon} label={t.createdDate} value={record.created_at?.toDate().toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', dateTimeOptions) || 'N/A'} />
                                                    
                                                    <InfoItem Icon={StarIcon} label={t.score} value={
                                                            <div className="flex items-baseline gap-2 rtl:flex-row-reverse rtl:justify-end">
                                                                <span className="font-bold text-yellow-400">{`${formatNumberEn((record.overall_score * 20).toFixed(0))}%`}</span>
                                                                <span className="text-gray-400 text-sm font-normal">({ratingDescription})</span>
                                                            </div>
                                                        } 
                                                        colorClass="text-yellow-400" 
                                                    />
                                                </div>
                                                <div className="w-full sm:w-px sm:h-12 bg-gray-700 self-stretch"></div>
                                                <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-3 w-full sm:w-auto sm:min-w-[150px]">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-xs text-gray-400 font-semibold mb-1">{t.status}</span>
                                                        <span className={`font-bold text-base text-center ${statusColor}`}>{statusText}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" onClick={() => handleViewDetails(record.sequence_number)} title={canViewDetails ? t.viewDetails : t.permissionMissingTitle} className="p-2 text-blue-400 hover:text-blue-300 disabled:text-gray-600/50 disabled:cursor-not-allowed transition-colors">
                                                            <EyeIcon className="w-5 h-5" />
                                                        </motion.button>
                                                        {record.status === 'Needs Revision' && (
                                                            <motion.button variants={interactiveItemVariants} whileHover="hover" whileTap="tap" onClick={() => handleEditEvaluation(record.sequence_number, record.status)} title={canEditRecords ? t.edit : t.permissionMissingTitle} className="p-2 text-yellow-500 hover:text-yellow-400 disabled:text-gray-600/50 disabled:cursor-not-allowed transition-colors">
                                                                <PencilSquareIcon className="w-5 h-5" />
                                                            </motion.button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}