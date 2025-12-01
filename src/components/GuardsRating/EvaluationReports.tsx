// src/components/GuardsRating/EvaluationReports.tsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {
    staggeredContainerVariants,
    staggeredItemVariants,
    interactiveItemVariants,
    directionalSlideVariants,
    fadeInVariants
} from "../../lib/animations";
import { useAuth } from "../contexts/UserContext";
import { useLanguage } from "../contexts/LanguageContext";
import { usePageLoading } from "../contexts/LoadingContext";
import { useActionLoading } from "../contexts/ActionLoadingContext";
import { useDialog } from "../contexts/DialogContext";
import { usePDF } from '@react-pdf/renderer'; 
import ReportPDF from './ReportPDF';

import {
    collection, query, DocumentData, FirestoreDataConverter,
    QueryDocumentSnapshot, SnapshotOptions, where, Query, Timestamp,
    getDocs, doc, documentId, orderBy
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
    ChartBarIcon, AdjustmentsHorizontalIcon, CalendarDaysIcon,
    ArrowDownTrayIcon, ChartPieIcon, PresentationChartLineIcon,
    EyeIcon, PrinterIcon, ArrowUpOnSquareIcon as ShareIcon
} from "@heroicons/react/24/outline";
import { DataTable, ColumnDef } from '../DataTable';

// 1. استيراد المكتبات البيانية
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartOptions,
    PointElement, LineElement, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import ChartDataLabels, { Context } from 'chartjs-plugin-datalabels';
import Select, { StylesConfig, GroupBase, MultiValue } from 'react-select';
import { cleanText } from "../../utils/textUtils"; 

// 2. تسجيل المكونات
ChartJS.register(
    CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels,
    PointElement, LineElement, Filler
);

// --- ألوان المؤشرات ---
const trendColors = ['#FFD700', '#34D399', '#60A5FA', '#F87171', '#A78BFA', '#F472B6'];

// --- الأنواع ---
interface SelectOption { value: string; label: string; }
interface AggregatedResult {
    id: string;
    entityName: string;
    averageScore: number;
    answerCount: number;
    evaluationCount?: number;
}
interface EvaluationHistoryDoc extends DocumentData {
    id: string;
    parent_evaluation_id: string;
    company_id: string;
    evaluation_year: number;
    evaluation_month: number;
    overall_score: number;
    status: string;
    created_at: Timestamp;
    updated_at?: Timestamp;
    details?: Array<{
        question_id?: string; questionId?: string; id?: string;
        answer?: number | string; score?: number | string; rating?: number | string; value?: number | string;
    }>;
}
interface SimpleCompany { id: string; name_ar: string; name_en?: string; }
interface SimpleQuestion { id: string; question_text_ar: string; question_text_en?: string; }

// --- المحولات ---
const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
    toFirestore: (data: T): DocumentData => data,
    fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T)
});
const evaluationHistoryConverter = createConverter<EvaluationHistoryDoc>();
const companyConverter = createConverter<SimpleCompany>();


// --- دالة تنسيق الأرقام ---
const formatNumberEn = (value: number | string, options?: Intl.NumberFormatOptions): string => {
    const defaultOptions: Intl.NumberFormatOptions = { useGrouping: false, ...options };
    try { return new Intl.NumberFormat('en-US', defaultOptions).format(Number(value)); } catch { return String(value); }
}

// --- المكون الرئيسي للصفحة ---
export default function EvaluationReports() {
    const { language } = useLanguage();
    const { user, hasPermission, isLoading: isAuthLoading } = useAuth();
    const { setPageLoading } = usePageLoading();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const { showDialog } = useDialog();

    // ✨ الحالات الجديدة لـ PDF
    const [pdfAction, setPdfAction] = useState<'view' | 'download' | 'print' | 'share' | null>(null);
    const [instance, updateInstance] = usePDF();

    // ✨ المراجع (Refs) للمخططات لالتقاط الصورة
    const companyBarRef = useRef<ChartJS<'bar', number[], string>>(null);
    const questionBarRef = useRef<ChartJS<'bar', number[], string>>(null);
    const companyTrendRef = useRef<ChartJS<'line', (number | null)[], string>>(null);
    const questionTrendRef = useRef<ChartJS<'line', (number | null)[], string>>(null);

    // ✨ الحالات الجديدة لصور المخططات Base64
    const [companyBarBase64, setCompanyBarBase64] = useState<string | undefined>(undefined);
    const [questionBarBase64, setQuestionBarBase64] = useState<string | undefined>(undefined);
    const [companyTrendBase64, setCompanyTrendBase64] = useState<string | undefined>(undefined);
    const [questionTrendBase64, setQuestionTrendBase64] = useState<string | undefined>(undefined);


    // --- حالة الفلاتر ---
    const [dateFilterType, setDateFilterType] = useState<'monthly' | 'range'>('monthly');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [startDate, setStartDate] = useState<Date | null>(() => { const date = new Date(); date.setDate(1); date.setHours(0, 0, 0, 0); return date; });
    const [endDate, setEndDate] = useState<Date | null>(() => { const date = new Date(); date.setMonth(date.getMonth() + 1); date.setDate(0); date.setHours(23, 59, 59, 999); return date; });
    const [selectedCompanyOptions, setSelectedCompanyOptions] = useState<MultiValue<SelectOption>>([]);
    const [selectedQuestionOptions, setSelectedQuestionOptions] = useState<MultiValue<SelectOption>>([]);

    // --- حالة إخفاء/إظهار خطوط المؤشر ---
    const [hiddenCompanyTrendDatasets, setHiddenCompanyTrendDatasets] = useState<number[]>([]);
    const [hiddenQuestionTrendDatasets, setHiddenQuestionTrendDatasets] = useState<number[]>([]);

    // --- حالة تحميل البيانات ---
    const [isReady, setIsReady] = useState(false);
    const [companiesMap, setCompaniesMap] = useState<Map<string, SimpleCompany>>(new Map());
    const [questionsMap, setQuestionsMap] = useState<Map<string, SimpleQuestion>>(new Map());
    const [isLoadingAuxData, setIsLoadingAuxData] = useState(true);
    const [rawHistoryData, setRawHistoryData] = useState<EvaluationHistoryDoc[]>([]);
    const [filteredHistoryData, setFilteredHistoryData] = useState<EvaluationHistoryDoc[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<Error | null>(null);

    // --- الترجمات ---
    const translations = useMemo(() => ({
        ar: {
            locale: "ar-EG", pageTitle: "تقارير التقييم", permissionDenied: "لا تملك الصلاحية لعرض هذه الصفحة.", filters: "الفلاتر",
            dateFilter: "فلترة التاريخ", monthly: "شهر محدد", range: "نطاق زمني", year: "السنة", month: "الشهر",
            startDate: "من شهر/سنة", endDate: "إلى شهر/سنة",
            dataDisplay: "عرض البيانات", overallAverage: "المتوسط الإجمالي", outputs: "المخرجات",
            noDataFound: "لا توجد بيانات مطابقة للفلاتر المحددة.", loadingData: "جاري تحميل البيانات...", errorTitle: "خطأ",
            months: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
            col_entity_company: "الشركة", col_entity_question: "السؤال", col_average: "المتوسط",
            col_evaluations: "عدد التقييمات", col_answers: "عدد الإجابات",
            chart_score: "المتوسط", chart_name: "الاسم",
            filterCompanies: "فلترة حسب الشركات", selectCompanies: "الكل (أو اختر شركة فأكثر...)",
            filterQuestions: "فلترة حسب الأسئلة", selectQuestions: "الكل (أو اختر سؤال فأكثر...)",
            companyTrendChartTitle: "مؤشر أداء الشركات الزمني (حسب النطاق المحدد)",
            questionTrendChartTitle: "مؤشر أداء الأسئلة الزمني (حسب النطاق المحدد)",
            companyAggregatedTitle: "أداء الشركات (تجميعي)",
            questionAggregatedTitle: "أداء الأسئلة (تجميعي)",
            companyBarChartTitle: "الرسم البياني (تجميعي للشركات)",
            questionBarChartTitle: "الرسم البياني (تجميعي للأسئلة)",
            action_view: "فتح", action_download: "تحميل", action_print: "طباعة", action_share: "مشاركة",
            shareError: "لم يتمكن المتصفح من مشاركة الملف.", 
            shareNotReady: "جاري تحضير الملف للمشاركة...",
            shareNotSupported: "المشاركة غير مدعومة في هذا المتصفح.", 
            preparingPDF: "جاري تجهيز الملف...",
            permissionDeniedTitle: "تم رفض الإجراء",
            permissionDeniedMessage: "لا تملك الصلاحية اللازمة لتنفيذ هذا الإجراء.",
            confirmActionTitle: "تأكيد الإجراء",
            confirmOpenTitle: "تأكيد الفتح", confirmOpenMessage: "هل أنت متأكد أنك تريد فتح التقرير في تبويب جديد؟",
            confirmDownloadTitle: "تأكيد التحميل", confirmDownloadMessage: "هل أنت متأكد أنك تريد تحميل هذا التقرير كملف PDF؟",
            confirmPrintTitle: "تأكيد الطباعة", confirmPrintMessage: "تذكر أن بلدية مدينة أبوظبي ترفع شعار 'بلدية بلا ورق'. هل ما زلت ترغب في المتابعة والطباعة؟",
            confirmShareTitle: "تأكيد المشاركة", confirmShareMessage: "هل أنت متأكد أنك تريد مشاركة هذا التقرير؟",
        },
        en: {
            locale: "en-US", pageTitle: "Evaluation Reports", permissionDenied: "You do not have permission to view this page.", filters: "Filters",
            dateFilter: "Date Filter", monthly: "Specific Month", range: "Date Range", year: "Year", month: "Month",
            startDate: "From Month/Year", endDate: "To Month/Year",
            dataDisplay: "Data Display", overallAverage: "Overall Average", outputs: "Outputs",
            noDataFound: "No data found matching the selected filters.", loadingData: "Loading data...", errorTitle: "Error",
            months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
            col_entity_company: "Company", col_entity_question: "Question", col_average: "Average",
            col_evaluations: "Evaluations", col_answers: "Answers",
            chart_score: "Average", chart_name: "Name",
            filterCompanies: "Filter by Companies", selectCompanies: "All (or select one or more...)",
            filterQuestions: "Filter by Questions", selectQuestions: "All (or select one or more...)",
            companyTrendChartTitle: "Companies Performance Trend (by Selected Range)",
            questionTrendChartTitle: "Questions Performance Trend (by Selected Range)",
            companyAggregatedTitle: "Company Performance (Aggregated)",
            questionAggregatedTitle: "Question Performance (Aggregated)",
            companyBarChartTitle: "Aggregated Bar Chart (Companies)",
            questionBarChartTitle: "Aggregated Bar Chart (Questions)",
            action_view: "View", action_download: "Download", action_print: "Print", action_share: "Share",
            shareError: "The browser could not share the file.", 
            shareNotReady: "Preparing file for sharing...",
            shareNotSupported: "Sharing is not supported in this browser.", 
            preparingPDF: "Preparing file...",
            permissionDeniedTitle: "Action Denied",
            permissionDeniedMessage: "You do not have the required permission to perform this action.",
            confirmActionTitle: "Confirm Action",
            confirmOpenTitle: "Confirm Open", confirmOpenMessage: "Are you sure you want to open the report in a new tab?",
            confirmDownloadTitle: "Confirm Download", confirmDownloadMessage: "Are you sure you want to download this report as a PDF file?",
            confirmPrintTitle: "Confirm Print", confirmPrintMessage: "Remember that Abu Dhabi City Municipality promotes a 'Paperless Municipality'. Do you still wish to proceed with printing?",
            confirmShareTitle: "Confirm Share", confirmShareMessage: "Are you sure you want to share this report?",
        }
    }), [language]);

    const t = translations[language];

    // ✨ دالة لالتقاط صورة المخطط كـ Base64
    const captureChartAsBase64 = (chartRef: React.RefObject<ChartJS<any, any, any>>): string | undefined => {
        const chartInstance = chartRef.current;
        if (chartInstance) {
            chartInstance.resize();
            chartInstance.update();
            return chartInstance.toBase64Image('image/png', 1.0);
        }
        return undefined;
    };

    // --- إعدادات السنوات والأشهر ---
    const availableYears = useMemo(() => { const currentYear = new Date().getFullYear(); return Array.from({ length: 5 }, (_, i) => currentYear - i); }, []);
    const availableMonths = useMemo(() => { return Array.from({ length: 12 }, (_, i) => ({ value: (i + 1), label: t.months[i] })); }, [t.months]);

    // --- جلب البيانات المساعدة (الأسماء) ---
    useEffect(() => {
        const fetchAuxData = async () => {
            setIsLoadingAuxData(true);
            try {
                const [companiesSnap, questionsSnap] = await Promise.all([
                    getDocs(collection(db, "companies").withConverter(companyConverter)),
                    getDocs(collection(db, "security_questions"))
                ]);
                setCompaniesMap(new Map(companiesSnap.docs.map(doc => [doc.id, doc.data()])));
                const qMapById = new Map<string, SimpleQuestion>();
                questionsSnap.forEach(doc => {
                    const data = doc.data();
                    const questionId = data.id || doc.id;
                    if (questionId) {
                         const textAr = data.question_text_ar || '';
                         const textEn = data.question_text_en || '';
                         const question: SimpleQuestion = { id: questionId, question_text_ar: textAr, question_text_en: textEn };
                         qMapById.set(question.id, question);
                    } else { console.warn("Question document missing 'id' field or doc ID invalid:", doc.id); }
                });
                setQuestionsMap(qMapById);
            } catch (error) { console.error("Error fetching auxiliary data:", error); }
            finally { setIsLoadingAuxData(false); }
        };
        fetchAuxData();
    }, []);


    // --- تجهيز خيارات الفلاتر الجديدة ---
    const companyOptions = useMemo(() => { return Array.from(companiesMap.values()).map(company => ({ value: company.id, label: (language === 'ar' ? company.name_ar : (company.name_en || company.name_ar)) || company.id })).sort((a, b) => a.label.localeCompare(b.label)); }, [companiesMap, language]);
    const questionOptions = useMemo(() => { return Array.from(questionsMap.values()).map(question => ({ value: question.id, label: (language === 'ar' ? question.question_text_ar : (question.question_text_en || question.question_text_ar)) || question.id })).sort((a, b) => a.label.localeCompare(b.label)); }, [questionsMap, language]);

    // --- جلب بيانات evaluation_history الخام ---
    useEffect(() => {
        let startYear: number, endYear: number;
        if (dateFilterType === 'monthly') { startYear = endYear = selectedYear; }
        else if (startDate && endDate) { startYear = startDate.getFullYear(); endYear = endDate.getFullYear(); }
        else { setRawHistoryData([]); return; }
        setIsLoadingHistory(true); setHistoryError(null);
        
        const historyQuery = query(
            collection(db, "evaluation_history").withConverter(evaluationHistoryConverter),
            where('status', '==', 'Approved'),
            where('evaluation_year', '>=', startYear),
            where('evaluation_year', '<=', endYear)
        );
        getDocs(historyQuery)
            .then(snapshot => {
                const dataWithDetails = snapshot.docs
                    .map(doc => doc.data())
                    .filter(doc => doc.details && Array.isArray(doc.details) && doc.details.length > 0);
                setRawHistoryData(dataWithDetails);
            })
            .catch(error => { console.error("Error fetching history data:", error); setHistoryError(error); })
            .finally(() => setIsLoadingHistory(false));
    }, [dateFilterType, selectedYear, startDate, endDate]);


    // --- فلترة البيانات الخام حسب الشهر/النطاق المحدد ---
    useEffect(() => {
        let startYearMonth: number, endYearMonth: number;
        if (dateFilterType === 'monthly') { startYearMonth = endYearMonth = selectedYear * 100 + selectedMonth; }
        else if (startDate && endDate) { startYearMonth = startDate.getFullYear() * 100 + (startDate.getMonth() + 1); endYearMonth = endDate.getFullYear() * 100 + (endDate.getMonth() + 1); }
        else { setFilteredHistoryData([]); return; }
        const filtered = rawHistoryData.filter(doc => { const docYearMonth = doc.evaluation_year * 100 + Number(doc.evaluation_month); return docYearMonth >= startYearMonth && docYearMonth <= endYearMonth; });
        setFilteredHistoryData(filtered);
    }, [rawHistoryData, dateFilterType, selectedYear, selectedMonth, startDate, endDate]);


    // --- دالة تجميع عامة ---
    const getAggregatedData = (
        aggregationType: 'byCompany' | 'byQuestion'
    ): AggregatedResult[] => {
        if (isLoadingAuxData || isLoadingHistory || !filteredHistoryData) return [];
        const defaultName = language === 'ar' ? '[بيانات غير مسماة]' : '[Unnamed Data]';
        const selectedCompanyIds = selectedCompanyOptions.length > 0 ? new Set(selectedCompanyOptions.map(opt => opt.value)) : null;
        const selectedQuestionIds = selectedQuestionOptions.length > 0 ? new Set(selectedQuestionOptions.map(opt => opt.value)) : null;
        const aggregationMap = new Map<string, { totalScore: number; answerCount: number; evaluationIds: Set<string> }>();

        for (const doc of filteredHistoryData) {
            if (!doc.details || !Array.isArray(doc.details) || doc.details.length === 0) continue;
            if (selectedCompanyIds && !selectedCompanyIds.has(doc.company_id)) continue;


            for (const detail of doc.details) {
                const questionId = (detail.question_id || detail.questionId || detail.id) as string;
                if (!questionId) continue;
                if (selectedQuestionIds && !selectedQuestionIds.has(questionId)) continue;

                let score: number = NaN;
                if (detail.answer !== undefined && detail.answer !== null) score = Number(detail.answer);
                else if (detail.score !== undefined && detail.score !== null) score = Number(detail.score);
                else if (detail.rating !== undefined && detail.rating !== null) score = Number(detail.rating);
                else if (detail.value !== undefined && detail.value !== null) score = Number(detail.value);

                if (isNaN(score)) continue;

                const aggregationKey = aggregationType === 'byCompany' ? doc.company_id : questionId;
                const current = aggregationMap.get(aggregationKey) || { totalScore: 0, answerCount: 0, evaluationIds: new Set() };

                current.totalScore += score;
                current.answerCount += 1;
                current.evaluationIds.add(doc.id);
                aggregationMap.set(aggregationKey, current);
            }
        }

        return Array.from(aggregationMap.entries()).map(([key, stats]) => {
            let entityName: string;
            if (aggregationType === 'byCompany') {
                const company = companiesMap.get(key);
                entityName = (language === 'ar' ? company?.name_ar : (company?.name_en || company?.name_ar)) || key || defaultName;
            } else {
                const question = questionsMap.get(key);
                entityName = question ? (language === 'ar' ? question.question_text_ar : (question.question_text_en || question.question_text_ar)) : (key || defaultName);
            }
            const average = stats.answerCount > 0 ? stats.totalScore / stats.answerCount : 0;
            return { id: key, entityName: entityName, averageScore: average, answerCount: stats.answerCount, evaluationCount: stats.evaluationIds.size };
        });
    };


    // --- تجميع البيانات النهائية (مقسمة) ---
    const aggregatedResultsByCompany = useMemo(
        () => getAggregatedData('byCompany'),
        [filteredHistoryData, selectedCompanyOptions, selectedQuestionOptions, companiesMap, language, isLoadingAuxData, isLoadingHistory]
    );
    const aggregatedResultsByQuestion = useMemo(
        () => getAggregatedData('byQuestion'),
        [filteredHistoryData, selectedCompanyOptions, selectedQuestionOptions, questionsMap, language, isLoadingAuxData, isLoadingHistory]
    );


    // --- حساب المتوسط الإجمالي ---
    const overallAverage = useMemo(() => {
        if (!aggregatedResultsByCompany || aggregatedResultsByCompany.length === 0) return 0;
        const totalSum = aggregatedResultsByCompany.reduce((acc, item) => acc + (item.averageScore * item.answerCount), 0);
        const totalCount = aggregatedResultsByCompany.reduce((acc, item) => acc + item.answerCount, 0);
        return totalCount > 0 ? totalSum / totalCount : 0;
    }, [aggregatedResultsByCompany]);

    // --- إدارة التحميل العام ---
    useEffect(() => { if (!isAuthLoading && !isReady) setIsReady(true); }, [isAuthLoading, isReady]);
    useEffect(() => { setPageLoading(!isReady || isLoadingAuxData || isLoadingHistory); }, [isReady, isLoadingAuxData, isLoadingHistory, setPageLoading]);

    // --- أعمدة الجدول (مقسمة) ---
    const tableColumnsByCompany = useMemo((): ColumnDef<AggregatedResult>[] => {
        return [
            { accessorKey: 'entityName', header: t.col_entity_company, width: "300px", cell: (value) => <span className="font-semibold">{String(value)}</span> },
            { accessorKey: 'averageScore', header: t.col_average, width: "120px", cell: (value) => <span className="font-bold text-yellow-400 text-base">{Number(value).toFixed(2)}</span> },
            { accessorKey: 'evaluationCount', header: t.col_evaluations, width: "120px", cell: (value: any) => <span className="text-green-400 font-semibold">{value ?? '-'}</span> },
            { accessorKey: 'answerCount', header: t.col_answers, width: "120px", cell: (value) => <span className="text-blue-400 font-semibold">{Number(value)}</span> },
        ];
    }, [t]);

    const tableColumnsByQuestion = useMemo((): ColumnDef<AggregatedResult>[] => {
         return [
            { accessorKey: 'entityName', header: t.col_entity_question, width: "300px", cell: (value) => <span className="font-semibold">{String(value)}</span> },
            { accessorKey: 'averageScore', header: t.col_average, width: "120px", cell: (value) => <span className="font-bold text-yellow-400 text-base">{Number(value).toFixed(2)}</span> },
            { accessorKey: 'answerCount', header: t.col_answers, width: "120px", cell: (value) => <span className="text-blue-400 font-semibold">{Number(value)}</span> },
        ];
    }, [t]);

    // --- بيانات الرسم البياني (مقسمة) ---
    const chartDataByCompany = useMemo(() => {
        const dataSlice = [...aggregatedResultsByCompany].sort((a, b) => a.averageScore - b.averageScore).slice(-15);
        return {
            labels: dataSlice.map(item => item.entityName),
            datasets: [{ label: t.chart_score, data: dataSlice.map(item => item.averageScore), backgroundColor: '#FFD700', borderColor: '#FFD700', borderWidth: 1, }],
        };
    }, [aggregatedResultsByCompany, t.chart_score]);

    const chartDataByQuestion = useMemo(() => {
        const dataSlice = [...aggregatedResultsByQuestion].sort((a, b) => a.averageScore - b.averageScore).slice(-15);
        return {
            labels: dataSlice.map(item => item.entityName),
            datasets: [{ label: t.chart_score, data: dataSlice.map(item => item.averageScore), backgroundColor: '#34D399', borderColor: '#34D399', borderWidth: 1, }],
        };
    }, [aggregatedResultsByQuestion, t.chart_score]);


    // ✨ تحديث: ضبط خيارات الاتجاه لـ Bar Chart
    const isRTL = language === 'ar';
    const chartOptions = useMemo((): ChartOptions<'bar'> => {
        const options = {
            indexAxis: 'y' as const, 
            responsive: true, 
            maintainAspectRatio: false,
            // ✨ تفعيل RTL على مستوى المخطط
            rtl: isRTL,
            scales: {
                x: { 
                    beginAtZero: true, 
                    max: 5, 
                    ticks: { color: '#9CA3AF', stepSize: 1, mirror: isRTL }, // mirror لعرض الأرقام باليمين في RTL
                    grid: { color: '#4B5563' }, 
                    border: { color: '#9CA3AF' } 
                },
                y: { 
                    ticks: { color: '#9CA3AF', mirror: isRTL }, 
                    grid: { display: false }, 
                    border: { color: '#9CA3AF' },
                    // ✨ عكس ترتيب التصنيفات (Labels) في الاتجاه العربي
                    reverse: isRTL
                }
            },
            plugins: {
                legend: { position: 'top' as const, labels: { color: '#9CA3AF' } },
                tooltip: { backgroundColor: '#1F2937', titleColor: '#F9FAFB', bodyColor: '#D1D5DB', borderColor: '#4B5563', borderWidth: 1, rtl: isRTL },
                datalabels: { display: true, color: '#1F2937', align: 'end', anchor: 'end', offset: -8, font: { weight: 'bold' }, formatter: (value: number) => Number(value).toFixed(2) }
            },
        };
        
        // ✨ الحل: فرض النوع لتجاوز خطأ 'rtl'
        return options as ChartOptions<'bar'>;
    }, [language, isRTL]);


    // --- منطق المؤشرات الزمنية (لا تغيير) ---
    const [isTrendChartVisible, trendMonthLabels, trendYearMonthKeys] = useMemo(() => {
        if (dateFilterType !== 'range' || !startDate || !endDate) { return [false, [], []]; }
        const startKey = startDate.getFullYear() * 12 + startDate.getMonth();
        const endKey = endDate.getFullYear() * 12 + endDate.getMonth();
        const monthDiff = endKey - startKey;
        if (monthDiff <= 0) { return [false, [], []]; }
        const labels: string[] = []; const yearMonthKeys: string[] = []; const monthNames = t.months;
        const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const finalDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        let firstMonth = true;
        while (currentDate.getTime() <= finalDate.getTime()) {
            const month = currentDate.getMonth(); const year = currentDate.getFullYear();
            let label = monthNames[month];
            if (firstMonth || month === 0) { label = `${monthNames[month]} ${formatNumberEn(year)}`; firstMonth = false; }
            labels.push(label); yearMonthKeys.push(`${year}_${month + 1}`);
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        return [true, labels, yearMonthKeys];
    }, [dateFilterType, startDate, endDate, t.months]);
    
    const companyTrendChartData = useMemo(() => {
        if (!isTrendChartVisible || !filteredHistoryData || !companiesMap || companiesMap.size === 0) { return null; }
        const selectedCompanyIds = selectedCompanyOptions.length > 0 ? new Set(selectedCompanyOptions.map(opt => opt.value)) : null;
        const aggregationMap = new Map<string, Map<string, { totalScore: number, count: number }>>();
        for (const doc of filteredHistoryData) {
            const companyId = doc.company_id;
            if (selectedCompanyIds && !selectedCompanyIds.has(companyId)) { continue; }
            const score = doc.overall_score;
            if (typeof score !== 'number' || isNaN(score)) { continue; }
            const yearMonthKey = `${doc.evaluation_year}_${doc.evaluation_month}`;
            const companyMap = aggregationMap.get(companyId) || new Map<string, { totalScore: number, count: number }>();
            const monthStats = companyMap.get(yearMonthKey) || { totalScore: 0, count: 0 };
            monthStats.totalScore += score;
            monthStats.count += 1;
            companyMap.set(yearMonthKey, monthStats);
            aggregationMap.set(companyId, companyMap);
        }
        const datasets = Array.from(aggregationMap.keys()).map((companyId, index) => {
            const companyData = aggregationMap.get(companyId)!;
            const company = companiesMap.get(companyId);
            const data: (number | null)[] = Array(trendYearMonthKeys.length).fill(null);
            trendYearMonthKeys.forEach((key, monthIndex) => {
                const stats = companyData.get(key);
                if (stats && stats.count > 0) { data[monthIndex] = stats.totalScore / stats.count; }
            });
            const color = trendColors[index % trendColors.length];
            return {
                label: language === 'ar' ? (company?.name_ar || companyId) : (company?.name_en || company?.name_ar || companyId),
                data: data, borderColor: color, backgroundColor: `${color}33`, fill: true, tension: 0.3,
                pointBackgroundColor: color, spanGaps: true, pointHoverRadius: 7, pointHoverBorderWidth: 2, pointHoverBackgroundColor: color,
            };
        });
        return { labels: trendMonthLabels, datasets };
    }, [isTrendChartVisible, filteredHistoryData, trendMonthLabels, trendYearMonthKeys, companiesMap, language, selectedCompanyOptions]);
    const filteredCompanyTrendChartData = useMemo(() => {
        if (!companyTrendChartData) return { labels: [], datasets: [] };
        const datasets = companyTrendChartData.datasets.map((ds, index) => {
            if (hiddenCompanyTrendDatasets.includes(index)) { return { ...ds, data: [] }; } return ds;
        }); return { ...companyTrendChartData, datasets };
    }, [companyTrendChartData, hiddenCompanyTrendDatasets]);
    const toggleCompanyTrendDataset = (index: number) => { setHiddenCompanyTrendDatasets(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index] ); };
    const questionTrendChartData = useMemo(() => {
        if (!isTrendChartVisible || !filteredHistoryData || !questionsMap || questionsMap.size === 0) { return null; }
        const selectedQuestionIds = selectedQuestionOptions.length > 0 ? new Set(selectedQuestionOptions.map(opt => opt.value)) : null;
        const aggregationMap = new Map<string, Map<string, { totalScore: number, count: number }>>();
        for (const doc of filteredHistoryData) {
            const yearMonthKey = `${doc.evaluation_year}_${doc.evaluation_month}`;
            if (!doc.details || doc.details.length === 0) continue;
            for (const detail of doc.details) {
                const questionId = (detail.question_id || detail.questionId || detail.id) as string;
                if (!questionId) continue;
                if (selectedQuestionIds && !selectedQuestionIds.has(questionId)) { continue; }
                let score: number = NaN;
                if (detail.answer !== undefined && detail.answer !== null) score = Number(detail.answer);
                else if (detail.score !== undefined && detail.score !== null) score = Number(detail.score);
                else if (detail.rating !== undefined && detail.rating !== null) score = Number(detail.rating);
                else if (detail.value !== undefined && detail.value !== null) score = Number(detail.value);
                if (isNaN(score)) continue;
                const questionMap = aggregationMap.get(questionId) || new Map<string, { totalScore: number, count: number }>();
                const monthStats = questionMap.get(yearMonthKey) || { totalScore: 0, count: 0 };
                monthStats.totalScore += score; monthStats.count += 1;
                questionMap.set(yearMonthKey, monthStats); aggregationMap.set(questionId, questionMap);
            }
        }
        const datasets = Array.from(aggregationMap.keys()).map((questionId, index) => {
            const questionData = aggregationMap.get(questionId)!;
            const question = questionsMap.get(questionId);
            const data: (number | null)[] = Array(trendYearMonthKeys.length).fill(null);
            trendYearMonthKeys.forEach((key, monthIndex) => {
                const stats = questionData.get(key);
                if (stats && stats.count > 0) { data[monthIndex] = stats.totalScore / stats.count; }
            });
            const color = trendColors[index % trendColors.length];
            return {
                label: question ? (language === 'ar' ? question.question_text_ar : (question.question_text_en || question.question_text_ar)) : (questionId || 'Unknown'),
                data: data, borderColor: color, backgroundColor: `${color}33`, fill: true, tension: 0.3,
                pointBackgroundColor: color, spanGaps: true, pointHoverRadius: 7, pointHoverBorderWidth: 2, pointHoverBackgroundColor: color,
            };
        });
        return { labels: trendMonthLabels, datasets };
    }, [isTrendChartVisible, filteredHistoryData, trendMonthLabels, trendYearMonthKeys, questionsMap, language, selectedQuestionOptions]);
    const filteredQuestionTrendChartData = useMemo(() => {
        if (!questionTrendChartData) return { labels: [], datasets: [] };
        const datasets = questionTrendChartData.datasets.map((ds, index) => {
            if (hiddenQuestionTrendDatasets.includes(index)) { return { ...ds, data: [] }; } return ds;
        }); return { ...questionTrendChartData, datasets };
    }, [questionTrendChartData, hiddenQuestionTrendDatasets]);
    const toggleQuestionTrendDataset = (index: number) => { setHiddenQuestionTrendDatasets(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index] ); };
    const trendChartOptions = useMemo((): ChartOptions<'line'> => {
        const isRTL = language === 'ar';
        return {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { left: 35, right: 35 } },
            onHover: (event, chartElements, chart) => { chart.canvas.style.cursor = chartElements.length > 0 ? 'pointer' : 'default'; },
            interaction: { mode: 'nearest', intersect: true, axis: 'xy' },
            scales: {
                x: { ticks: { color: '#9CA3AF', maxRotation: 90, minRotation: 45, autoSkip: false }, grid: { color: '#4B5563' }, border: { color: '#9CA3AF' }, reverse: isRTL, },
                y: { beginAtZero: true, max: 5, ticks: { color: '#9CA3AF', stepSize: 1 }, grid: { color: '#4B5563' }, border: { color: '#9CA3AF' }, position: isRTL ? 'right' : 'left', }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: true, color: (context: Context) => trendColors[context.datasetIndex % trendColors.length],
                    font: (context: Context) => { const df = ChartJS.defaults.font; if (context.active) return { size: 12, weight: 700, family: df.family || 'Arial' }; return { size: 10, weight: 500, family: df.family || 'Arial' }; },
                    align: isRTL ? 'left' : 'right', textAlign: isRTL ? 'left' : 'right', offset: 4, formatter: (value) => (typeof value === 'number' ? value.toFixed(2) : null),
                    listeners: { /* ... نفس الكود ... */ }
                },
                tooltip: { backgroundColor: '#1F2937', rtl: isRTL, },
            },
        };
    }, [language]);
    // --- نهاية منطق المؤشرات الزمنية ---


    // ✨ EFFECT: التقاط صور المخططات عند تغيير البيانات
    useEffect(() => {
        const timer = setTimeout(() => {
            setCompanyBarBase64(captureChartAsBase64(companyBarRef));
            setQuestionBarBase64(captureChartAsBase64(questionBarRef));
            setCompanyTrendBase64(captureChartAsBase64(companyTrendRef));
            setQuestionTrendBase64(captureChartAsBase64(questionTrendRef));
        }, 500);

        return () => clearTimeout(timer);
    }, [
        aggregatedResultsByCompany, aggregatedResultsByQuestion, 
        isTrendChartVisible, companyTrendChartData, questionTrendChartData
    ]);

    // --- تجميع الـ Props للـ PDF (تم نقله إلى هنا بعد تعريف المتغيرات) ---
    const printableReportProps = useMemo(() => ({
        t, language, overallAverage, aggregatedResultsByCompany, tableColumnsByCompany,
        chartDataByCompany, aggregatedResultsByQuestion, tableColumnsByQuestion, 
        chartDataByQuestion, isTrendChartVisible, companyTrendChartData, 
        questionTrendChartData, trendChartOptions, chartOptions,
        // ✨ تصحيح أسماء المتغيرات هنا
        companyBarChartBase64: companyBarBase64,
        questionBarChartBase64: questionBarBase64,
        companyTrendChartBase64: companyTrendBase64,
        questionTrendChartBase64: questionTrendBase64,
    }), [
        t, language, overallAverage, aggregatedResultsByCompany, tableColumnsByCompany,
        chartDataByCompany, aggregatedResultsByQuestion, tableColumnsByQuestion, 
        chartDataByQuestion, isTrendChartVisible, companyTrendChartData, 
        questionTrendChartData, trendChartOptions, chartOptions,
        companyBarBase64, questionBarBase64, companyTrendBase64, questionTrendBase64
    ]);
    
    // ✨ إنشاء وثيقة PDF (Component)
    const pdfDocument = useMemo(() => (
        <ReportPDF {...printableReportProps} />
    ), [printableReportProps]);

    // --- EFFECT: لبدء عملية توليد PDF ---
    useEffect(() => {
        if (pdfAction) {
            showActionLoading(t.preparingPDF);
            updateInstance(pdfDocument);
        }
    }, [pdfAction, updateInstance, pdfDocument, showActionLoading, t.preparingPDF]);

    // --- EFFECT: لمعالجة الإجراء بعد الانتهاء من توليد PDF ---
    useEffect(() => {
        if (pdfAction && !instance.loading && instance.url && instance.blob) {
            
            if (pdfAction === 'download') {
                const link = document.createElement('a');
                link.href = instance.url;
                link.download = `Evaluation-Report-${new Date().toISOString()}.pdf`;
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
            } else if (pdfAction === 'view') {
                window.open(instance.url, '_blank');
            } else if (pdfAction === 'share') {
                const pdfFile = new File([instance.blob], `Evaluation-Report-${new Date().toISOString()}.pdf`, { type: 'application/pdf' });
                if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                    navigator.share({ files: [pdfFile], title: t.pageTitle, text: t.pageTitle })
                    .catch(error => showDialog({ variant: 'alert', title: t.errorTitle, message: t.shareError }));
                } else {
                    showDialog({ variant: 'alert', title: t.errorTitle, message: t.shareNotSupported });
                }
            }
            
            hideActionLoading();
            setPdfAction(null);
        }
    }, [instance.loading, instance.url, instance.blob, pdfAction, hideActionLoading, t, showDialog]);


    // --- دالة إجراءات التقرير المُبسَّطة ---
    const handleReportAction = (action: 'view' | 'download' | 'print' | 'share') => {
        
        if (!(aggregatedResultsByCompany.length > 0 || aggregatedResultsByQuestion.length > 0)) {
            console.error("No data to export");
            showDialog({ variant: 'alert', title: t.errorTitle, message: t.noDataFound });
            return;
        }

        const actionsConfig = {
            view: { permission: 'sss:9', title: t.confirmOpenTitle, message: t.confirmOpenMessage },
            download: { permission: 'sss:10', title: t.confirmDownloadTitle, message: t.confirmDownloadMessage },
            print: { permission: 'sss:11', title: t.confirmPrintTitle, message: t.confirmPrintMessage },
            share: { permission: 'sss:12', title: t.confirmShareTitle, message: t.confirmShareMessage }
        };
        const config = actionsConfig[action]; 

        showDialog({
            variant: 'confirm',
            title: config.title,
            message: config.message,
            onConfirm: () => {
                if (typeof hasPermission !== 'function' || !hasPermission(config.permission)) {
                    showDialog({ variant: 'alert', title: t.permissionDeniedTitle, message: t.permissionDeniedMessage });
                    return;
                }
                setPdfAction(action);
            }
        });
    };


    // --- تنسيق الفلتر ---
    const selectStyles: StylesConfig<SelectOption, true, GroupBase<SelectOption>> = {
        control: (base) => ({ ...base, backgroundColor: '#374151', borderColor: '#4B5563', color: 'white', borderRadius: '0.375rem', minHeight: '42px', }),
        menu: (base) => ({ ...base, backgroundColor: '#1F2937', borderRadius: '0.375rem', }),
        option: (base, { isFocused, isSelected }) => ({ ...base, backgroundColor: isSelected ? '#FFD700' : isFocused ? '#374151' : '#1F2937', color: isSelected ? '#1F2937' : 'white', ':active': { ...base[':active'], backgroundColor: '#FFD700', }, }),
        multiValue: (base) => ({ ...base, backgroundColor: '#4B5563', }),
        multiValueLabel: (base) => ({ ...base, color: 'white', }),
        multiValueRemove: (base) => ({ ...base, color: '#D1D5DB', ':hover': { backgroundColor: '#FFD700', color: '#1F2937', }, }),
        input: (base) => ({ ...base, color: 'white', }),
        placeholder: (base) => ({ ...base, color: '#9CA3AF', }),
        menuList: (base) => ({ ...base, padding: 0, }),
    };

    // --- العرض (Render) ---
    return (
        <AnimatePresence mode="wait">
            <motion.div key={language} custom={language} variants={directionalSlideVariants} initial="initial" animate="animate" exit="exit">
                <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" exit="exit" className="flex-grow bg-gray-800/50 rounded-xl shadow-2xl space-y-6 p-4 sm:p-6 border border-gray-700">
                    {/* 1. الفلاتر */}
                    <motion.div variants={staggeredItemVariants} className="space-y-4">
                        <h2 className="text-xl font-bold text-[#FFD700] flex items-center gap-2"> <AdjustmentsHorizontalIcon className="w-6 h-6" /> {t.filters} </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                             {/* نوع فلتر التاريخ */}
                             <motion.div variants={interactiveItemVariants} whileHover="hover" className="lg:col-span-1">
                                <label className="block mb-1 font-semibold text-gray-300 text-sm">{t.dateFilter}</label>
                                <select value={dateFilterType} onChange={(e) => setDateFilterType(e.target.value as any)} className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD7A0]"> <option value="monthly">{t.monthly}</option> <option value="range">{t.range}</option> </select>
                            </motion.div>
                             {/* فلتر الشهر المحدد */}
                             <AnimatePresence> {dateFilterType === 'monthly' && (
                                <>
                                    <motion.div layout variants={interactiveItemVariants} whileHover="hover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:col-span-1">
                                        <label className="block mb-1 font-semibold text-gray-300 text-sm">{t.year}</label>
                                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"> {availableYears.map(year => (<option key={year} value={year}>{formatNumberEn(year)}</option>))} </select>
                                    </motion.div>
                                    <motion.div layout variants={interactiveItemVariants} whileHover="hover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:col-span-1">
                                        <label className="block mb-1 font-semibold text-gray-300 text-sm">{t.month}</label>
                                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"> {availableMonths.map(month => (<option key={month.value} value={month.value}>{month.label}</option>))} </select>
                                    </motion.div>
                                    <div className="lg:col-span-1"></div>
                                </>
                            )} </AnimatePresence>
                             {/* فلتر النطاق الزمني */}
                             <AnimatePresence> {dateFilterType === 'range' && (
                                <>
                                    <motion.div layout variants={interactiveItemVariants} whileHover="hover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:col-span-1">
                                        <label className="block mb-1 font-semibold text-gray-300 text-sm">{t.startDate}</label>
                                        <div className="flex gap-2">
                                            <select value={startDate ? startDate.getMonth() + 1 : selectedMonth} onChange={(e) => { const newMonth = Number(e.target.value); const currentYear = startDate ? startDate.getFullYear() : selectedYear; const newStartDate = new Date(currentYear, newMonth - 1, 1); newStartDate.setHours(0, 0, 0, 0); setStartDate(newStartDate); if (endDate && newStartDate.getTime() > endDate.getTime()) { const newEndDate = new Date(newStartDate.getFullYear(), newStartDate.getMonth() + 1, 0); newEndDate.setHours(23, 59, 59, 999); setEndDate(newEndDate); } }} className="w-2/3 bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]" > {availableMonths.map(month => ( <option key={month.value} value={month.value}>{month.label}</option>))} </select>
                                            <select value={startDate ? startDate.getFullYear() : selectedYear} onChange={(e) => { const newYear = Number(e.target.value); const currentMonth = startDate ? startDate.getMonth() + 1 : selectedMonth; const newStartDate = new Date(newYear, currentMonth - 1, 1); newStartDate.setHours(0, 0, 0, 0); setStartDate(newStartDate); if (endDate && newStartDate.getTime() > endDate.getTime()) { const newEndDate = new Date(newStartDate.getFullYear(), newStartDate.getMonth() + 1, 0); newEndDate.setHours(23, 59, 59, 999); setEndDate(newEndDate); } }} className="w-1/3 bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]" > {availableYears.map(year => ( <option key={year} value={year}>{formatNumberEn(year)}</option> ))} </select>
                                        </div>
                                    </motion.div>
                                    <motion.div layout variants={interactiveItemVariants} whileHover="hover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:col-span-1">
                                        <label className="block mb-1 font-semibold text-gray-300 text-sm">{t.endDate}</label>
                                        <div className="flex gap-2">
                                            <select value={endDate ? endDate.getMonth() + 1 : selectedMonth} onChange={(e) => { const newMonth = Number(e.target.value); const currentYear = endDate ? endDate.getFullYear() : selectedYear; const newEndDate = new Date(currentYear, newMonth, 1); newEndDate.setDate(0); newEndDate.setHours(23, 59, 59, 999); setEndDate(newEndDate); if (startDate && newEndDate.getTime() < startDate.getTime()) { const newStartDate = new Date(newEndDate.getFullYear(), newEndDate.getMonth(), 1); newStartDate.setHours(0, 0, 0, 0); setStartDate(newStartDate); } }} className="w-2/3 bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]" > {availableMonths.map(month => ( <option key={month.value} value={month.value}>{month.label}</option>))} </select>
                                            <select value={endDate ? endDate.getFullYear() : selectedYear} onChange={(e) => { const newYear = Number(e.target.value); const currentMonth = endDate ? endDate.getMonth() + 1 : selectedMonth; const newEndDate = new Date(newYear, currentMonth, 1); newEndDate.setDate(0); newEndDate.setHours(23, 59, 59, 999); setEndDate(newEndDate); if (startDate && newEndDate.getTime() < startDate.getTime()) { const newStartDate = new Date(newEndDate.getFullYear(), newEndDate.getMonth(), 1); newStartDate.setHours(0, 0, 0, 0); setStartDate(newStartDate); } }} className="w-1/3 bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]" > {availableYears.map(year => ( <option key={year} value={year}>{formatNumberEn(year)}</option> ))} </select>
                                        </div>
                                    </motion.div>
                                </>
                            )} </AnimatePresence>
                             {/* فلتر الشركات */}
                             <motion.div layout variants={interactiveItemVariants} className="md:col-span-2 lg:col-span-4">
                                <label className="block mb-1 font-semibold text-gray-300 text-sm">{t.filterCompanies}</label>
                                <Select isMulti options={companyOptions} value={selectedCompanyOptions} onChange={(options) => setSelectedCompanyOptions(options)} styles={selectStyles} placeholder={t.selectCompanies} isLoading={isLoadingAuxData} isRtl={language === 'ar'} />
                            </motion.div>
                            {/* فلتر الأسئلة */}
                            <motion.div layout variants={interactiveItemVariants} className="md:col-span-2 lg:col-span-4">
                                <label className="block mb-1 font-semibold text-gray-300 text-sm">{t.filterQuestions}</label>
                                <Select isMulti options={questionOptions} value={selectedQuestionOptions} onChange={(options) => setSelectedQuestionOptions(options)} styles={selectStyles} placeholder={t.selectQuestions} isLoading={isLoadingAuxData} isRtl={language === 'ar'} />
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* 2. عرض البيانات */}
                    <motion.div variants={staggeredItemVariants} id="full-report-container" className="pt-4 border-t border-gray-700 space-y-6 bg-gray-800/50 p-4 rounded-b-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-[#FFD700] flex items-center gap-2">
                                <ChartPieIcon className="w-6 h-6" /> {t.dataDisplay}
                            </h2>
                        </div>

                        {/* بطاقة المتوسط */}
                        {!isLoadingHistory && !isLoadingAuxData && !historyError && (aggregatedResultsByCompany.length > 0 || aggregatedResultsByQuestion.length > 0) && (
                            <motion.div variants={fadeInVariants} className="bg-gray-900/50 p-4 rounded-lg shadow-lg max-w-xs border border-gray-700 mb-6" >
                                <h4 className="text-sm font-semibold text-gray-400 mb-1"> {t.overallAverage} </h4>
                                <p className="text-3xl font-bold text-[#FFD700]"> {overallAverage.toFixed(2)} </p>
                            </motion.div>
                        )}

                        {/* رسالة الخطأ */}
                        {!isLoadingHistory && historyError && (
                            <div className="text-center text-red-400 py-4"><p>{t.errorTitle}: {historyError.message}</p></div>
                        )}

                        {/* رسالة التحميل أو لا توجد بيانات */}
                        {(isLoadingHistory || isLoadingAuxData) && <p className="text-gray-400">{t.loadingData}</p>}
                        {!isLoadingHistory && !isLoadingAuxData && !historyError && aggregatedResultsByCompany.length === 0 && aggregatedResultsByQuestion.length === 0 && (
                             <p className="text-center text-gray-400 py-4">{t.noDataFound}</p>
                        )}


                        {/* --- حاوية البيانات التجميعية --- */}
                        <AnimatePresence>
                        {!isLoadingHistory && !isLoadingAuxData && !historyError && (aggregatedResultsByCompany.length > 0 || aggregatedResultsByQuestion.length > 0) && (
                            <motion.div variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">
                                {/* --- 1. قسم الشركات التجميعي --- */}
                                {aggregatedResultsByCompany.length > 0 && (
                                     <div className="space-y-6">
                                         <h3 className="text-xl font-bold text-[#FFD700] flex items-center gap-2 mt-4">
                                             {t.companyAggregatedTitle}
                                         </h3>
                                         <DataTable
                                             data={aggregatedResultsByCompany}
                                             columns={tableColumnsByCompany}
                                             isLoading={false}
                                             getRowId={(row) => row.id}
                                             noDataMessage={t.noDataFound}
                                         />
                                         {chartDataByCompany.labels.length > 0 && (
                                             <motion.div variants={fadeInVariants} className="pt-4 border-t border-gray-700 mt-6">
                                                 <h4 className="text-lg font-semibold text-gray-300 mb-4">{t.companyBarChartTitle}</h4>
                                                 <div style={{ position: 'relative', height: '400px', width: '100%' }}>
                                                     <Bar ref={companyBarRef} options={chartOptions} data={chartDataByCompany} />
                                                 </div>
                                             </motion.div>
                                         )}
                                     </div>
                                )}
                                {/* --- 2. قسم الأسئلة التجميعي --- */}
                                {aggregatedResultsByQuestion.length > 0 && (
                                    <div className="space-y-6 pt-6 border-t border-gray-700 mt-8">
                                         <h3 className="text-xl font-bold text-green-400 flex items-center gap-2">
                                             {t.questionAggregatedTitle}
                                         </h3>
                                         <DataTable
                                             data={aggregatedResultsByQuestion}
                                             columns={tableColumnsByQuestion}
                                             isLoading={false}
                                             getRowId={(row) => row.id}
                                             noDataMessage={t.noDataFound}
                                         />
                                         {chartDataByQuestion.labels.length > 0 && (
                                             <motion.div variants={fadeInVariants} className="pt-4 border-t border-gray-700 mt-6">
                                                 <h4 className="text-lg font-semibold text-gray-300 mb-4">{t.questionBarChartTitle}</h4>
                                                 <div style={{ position: 'relative', height: '400px', width: '100%' }}>
                                                     <Bar ref={questionBarRef} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, datalabels: { ...chartOptions.plugins?.datalabels, color: '#1F2937' } } }} data={chartDataByQuestion} />
                                                 </div>
                                             </motion.div>
                                         )}
                                     </div>
                                )}
                            </motion.div>
                        )}
                        </AnimatePresence>

                        {/* --- حاوية المؤشرات الزمنية --- */}
                        <AnimatePresence>
                            {isTrendChartVisible && (
                                <motion.div variants={fadeInVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">
                                    {/* 1. مؤشر الشركات الزمني */}
                                    {companyTrendChartData && companyTrendChartData.datasets.length > 0 && (
                                         <div className="pt-6 border-t border-gray-700 mt-6">
                                             <h3 className="text-xl font-bold text-[#FFD700] flex items-center gap-2 mb-4">
                                                 <PresentationChartLineIcon className="w-6 h-6" /> {t.companyTrendChartTitle}
                                             </h3>
                                             <div className="flex items-center mb-4 justify-start flex-wrap gap-x-4 gap-y-2" data-html2canvas-ignore="true">
                                                 {companyTrendChartData.datasets.map((dataset, index) => {
                                                     const isHidden = hiddenCompanyTrendDatasets.includes(index);
                                                     return (
                                                         <motion.div key={dataset.label} className="relative flex items-center cursor-pointer" variants={interactiveItemVariants} whileHover="hover" whileTap="tap" onTap={() => toggleCompanyTrendDataset(index)} animate={{ opacity: isHidden ? 0.5 : 1 }} >
                                                             <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: dataset.borderColor as string, [language === 'ar' ? 'marginLeft' : 'marginRight']: '0.5rem' }} />
                                                             <span className={`text-sm ${isHidden ? 'text-gray-500' : 'text-gray-300'}`}>{dataset.label}</span>
                                                             <AnimatePresence> {isHidden && ( <motion.div className="absolute left-0 right-0 h-0.5 bg-gray-400" style={{ top: '50%' }} initial={{ width: 0, originX: language === 'ar' ? 1 : 0 }} animate={{ width: "100%", originX: language === 'ar' ? 1 : 0 }} exit={{ width: 0, originX: language === 'ar' ? 1 : 0 }} transition={{ duration: 0.3 }} /> )} </AnimatePresence>
                                                         </motion.div>
                                                     );
                                                 })}
                                             </div>
                                             <div className="h-[280px] md:h-[300px]"> <Line ref={companyTrendRef} options={trendChartOptions} data={filteredCompanyTrendChartData} /> </div>
                                         </div>
                                    )}
                                    {/* 2. مؤشر الأسئلة الزمني */}
                                    {questionTrendChartData && questionTrendChartData.datasets.length > 0 && (
                                         <div className="pt-6 border-t border-gray-700 mt-6">
                                             <h3 className="text-xl font-bold text-green-400 flex items-center gap-2 mb-4">
                                                 <PresentationChartLineIcon className="w-6 h-6" /> {t.questionTrendChartTitle}
                                             </h3>
                                             <div className="flex items-center mb-4 justify-start flex-wrap gap-x-4 gap-y-2" data-html2canvas-ignore="true">
                                                 {questionTrendChartData.datasets.map((dataset, index) => {
                                                     const isHidden = hiddenQuestionTrendDatasets.includes(index);
                                                     return (
                                                          <motion.div key={dataset.label} className="relative flex items-center cursor-pointer" variants={interactiveItemVariants} whileHover="hover" whileTap="tap" onTap={() => toggleQuestionTrendDataset(index)} animate={{ opacity: isHidden ? 0.5 : 1 }} >
                                                             <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: dataset.borderColor as string, [language === 'ar' ? 'marginLeft' : 'marginRight']: '0.5rem' }} />
                                                             <span className={`text-sm ${isHidden ? 'text-gray-500' : 'text-gray-300'}`}>{dataset.label}</span>
                                                             <AnimatePresence> {isHidden && ( <motion.div className="absolute left-0 right-0 h-0.5 bg-gray-400" style={{ top: '50%' }} initial={{ width: 0, originX: language === 'ar' ? 1 : 0 }} animate={{ width: "100%", originX: language === 'ar' ? 1 : 0 }} exit={{ width: 0, originX: language === 'ar' ? 1 : 0 }} transition={{ duration: 0.3 }} /> )} </AnimatePresence>
                                                         </motion.div>
                                                     );
                                                 })}
                                             </div>
                                             <div className="h-[280px] md:h-[300px]"> <Line ref={questionTrendRef} options={trendChartOptions} data={filteredQuestionTrendChartData} /> </div>
                                         </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                         {/* قسم المخرجات والأيقونات */}
                         {!isLoadingHistory && !isLoadingAuxData && !historyError && (aggregatedResultsByCompany.length > 0 || aggregatedResultsByQuestion.length > 0) && (
                            <motion.div variants={fadeInVariants} className="pt-6 border-t border-gray-700 mt-8">
                                <h2 className="text-xl font-bold text-[#FFD700] mb-4">{t.outputs}</h2>
                                <div className="flex items-center gap-3" data-html2canvas-ignore="true">
                                    {hasPermission('sss:9') && (
                                        <motion.button title={t.action_view} onClick={() => handleReportAction('view')} variants={interactiveItemVariants} whileHover="hover" className="p-2 text-[#FFD700] rounded-md hover:bg-gray-700/50 transition-colors duration-150" >
                                            <EyeIcon className="w-6 h-6" />
                                        </motion.button>
                                    )}
                                    {hasPermission('sss:10') && (
                                        <motion.button title={t.action_download} onClick={() => handleReportAction('download')} variants={interactiveItemVariants} whileHover="hover" className="p-2 text-[#FFD700] rounded-md hover:bg-gray-700/50 transition-colors duration-150" >
                                            <ArrowDownTrayIcon className="w-6 h-6" />
                                        </motion.button>
                                    )}
                                    {hasPermission('sss:11') && (
                                        <motion.button title={t.action_print} onClick={() => handleReportAction('print')} variants={interactiveItemVariants} whileHover="hover" className="p-2 text-[#FFD700] rounded-md hover:bg-gray-700/50 transition-colors duration-150" >
                                            <PrinterIcon className="w-6 h-6" />
                                        </motion.button>
                                    )}
                                    {hasPermission('sss:12') && (
                                        <motion.button title={t.action_share} onClick={() => handleReportAction('share')} variants={interactiveItemVariants} whileHover="hover" className="p-2 text-[#FFD700] rounded-md hover:bg-gray-700/50 transition-colors duration-150" >
                                            <ShareIcon className="w-6 h-6" />
                                        </motion.button>
                                    )}
                                </div>
                            </motion.div>
                         )}
                    </motion.div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}