// src/components/GuardsRating/EvaluationReportsPage.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LoadingScreen from "../LoadingScreen";
import { InformationCircleIcon, ArrowDownIcon, ArrowUpIcon, TrophyIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import { DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions } from "firebase/firestore";
import ReportCharts from '../ReportCharts';
import DetailedReportModal from './DetailedReportModal';
import { getRatingDescription } from "../../utils/textUtils";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from 'react-select';

// --- الأنواع | Types ---
interface Company extends DocumentData { id: string; name_ar: string; name_en?: string; }
interface Evaluation extends DocumentData { id: string; company_id: string; evaluation_year: number; evaluation_month: number; overall_score: number; created_at: any; summary: string; }
interface EvaluationDetails extends DocumentData { evaluation_id: string; question_id: string; selected_rating: number; note: string; }
interface QuestionDoc extends DocumentData { id: string; question_text_ar: string; question_text_en: string; }

// --- محولات البيانات ---
const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
  toFirestore: (data: T): DocumentData => data,
  fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T)
});

const companyConverter = createConverter<Company>();
const evaluationConverter = createConverter<Evaluation>();
const evaluationDetailsConverter = createConverter<EvaluationDetails>();
const questionConverter = createConverter<QuestionDoc>();

// --- ترجمة النصوص ---
const translations = {
  ar: {
    title: "التقارير",
    filters: "الفلاتر",
    year: "السنة",
    month: "الشهر",
    company: "الشركة",
    all: "الكل",
    export: "تصدير",
    noData: "لا توجد بيانات متاحة لهذا التحديد.",
    metrics: {
      overallAverage: "متوسط التقييم الإجمالي",
      bestPerformer: "الشركة الأفضل أداءً",
      worstPerformer: "الشركة الأقل أداءً",
      totalEvaluations: "إجمالي التقييمات",
    },
    tables: {
      companyPerformance: "أداء الشركات",
      companyName: "اسم الشركة",
      averageRating: "متوسط التقييم",
      totalEvaluations: "إجمالي التقييمات",
      lastEvaluation: "آخر تقييم",
      actions: "الإجراءات",
      viewDetails: "عرض التفاصيل",
    },
    charts: {
      monthlyReport: "تقرير الأداء الشهري",
      ratingDistribution: "توزيع التقييمات",
      monthlyAverage: "المتوسط الشهري",
    },
    modal: {
      title: "تقرير التقييم التفصيلي",
      overallScore: "النتيجة الإجمالية",
      evaluator: "المقيّم",
      summary: "الملخص",
      close: "إغلاق",
    },
    startDate: "تاريخ البدء",
    endDate: "تاريخ الانتهاء",
  },
  en: {
    title: "Reports",
    filters: "Filters",
    year: "Year",
    month: "Month",
    company: "Company",
    all: "All",
    export: "Export",
    noData: "No data available for this selection.",
    metrics: {
      overallAverage: "Overall Average Rating",
      bestPerformer: "Best Performing Company",
      worstPerformer: "Worst Performing Company",
      totalEvaluations: "Total Evaluations",
    },
    tables: {
      companyPerformance: "Company Performance",
      companyName: "Company Name",
      averageRating: "Average Rating",
      totalEvaluations: "Total Evaluations",
      lastEvaluation: "Last Evaluation",
      actions: "Actions",
      viewDetails: "View Details",
    },
    charts: {
      monthlyReport: "Monthly Performance Report",
      ratingDistribution: "Rating Distribution",
      monthlyAverage: "Monthly Average",
    },
    modal: {
      title: "Detailed Evaluation Report",
      overallScore: "Overall Score",
      evaluator: "Evaluator",
      summary: "Summary",
      close: "Close",
    },
    startDate: "Start Date",
    endDate: "End Date",
  }
};

// دالة تنسيق الأرقام
const formatNumberEn = (value: number | string, options?: Intl.NumberFormatOptions): string => {
  return new Intl.NumberFormat('en-US', { ...options, useGrouping: false }).format(Number(value));
}

// مكون InfoCard
const InfoCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-gray-800/50 p-4 rounded-lg shadow-md flex items-center space-x-4">
    {Icon && <Icon className={`h-8 w-8 ${color}`} />}
    <div className="flex-1">
      <h3 className="text-sm font-semibold text-gray-400">{title}</h3>
      <p className="text-xl font-bold text-white mt-1" dir="ltr">{value}</p>
    </div>
  </div>
);

export default function EvaluationReportsPage() {
  const { language } = useLanguage();
  const t = translations[language];

  // 1. STATE HOOKS (ALWAYS FIRST)
  const [selectedYears, setSelectedYears] = useState<string[]>(['all']);
  const [selectedMonths, setSelectedMonths] = useState<string[]>(['all']);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(['all']);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  // 2. DATA FETCHING HOOKS (ALWAYS NEXT)
  const [companies, companiesLoading] = useCollectionData<Company>(collection(db, "companies").withConverter(companyConverter));
  const [evaluations, evaluationsLoading] = useCollectionData<Evaluation>(collection(db, "security_evaluations").withConverter(evaluationConverter));
  const [questions, questionsLoading] = useCollectionData<QuestionDoc>(collection(db, "security_questions").withConverter(questionConverter));

  // 3. DERIVED DATA HOOKS (useMemo)
  const availableYears = useMemo(() => {
    if (!evaluations) return [];
    const years = [...new Set(evaluations.map(e => e.evaluation_year))].filter(y => y !== null).sort((a, b) => b - a);
    return ['all', ...years.map(y => y.toString())];
  }, [evaluations]);

  const availableMonths = useMemo(() => {
    if (!evaluations || selectedYears.includes('all')) return [];
    const yearsToFilterBy = selectedYears.filter(y => y !== 'all').map(Number);
    const months = [...new Set(evaluations.filter(e => yearsToFilterBy.includes(e.evaluation_year)).map(e => e.evaluation_month))].sort((a, b) => a - b);
    return ['all', ...months.map(m => m.toString())];
  }, [evaluations, selectedYears]);
  
  const companiesOptions = useMemo(() => {
    if (!companies) return [];
    return companies.map(c => ({
        value: c.id,
        label: language === 'ar' ? c.name_ar : c.name_en || c.name_ar
    }));
  }, [companies, language]);

  const companiesMap = useMemo(() => new Map(companies?.map(c => [c.id, language === 'ar' ? c.name_ar : c.name_en || c.name_ar])), [companies, language]);

  const filteredEvaluations = useMemo(() => {
    if (!evaluations) return [];
    return evaluations.filter(e => {
        const yearMatch = selectedYears.includes('all') || selectedYears.includes(e.evaluation_year.toString());
        const monthMatch = selectedMonths.includes('all') || selectedMonths.includes(e.evaluation_month.toString());
        const companyMatch = selectedCompanies.includes('all') || selectedCompanies.includes(e.company_id);
        
        // التحقق من صلاحية التاريخ قبل المقارنة
        const evaluationDate = e.created_at?.toDate();
        const dateMatch = (!startDate || (evaluationDate && evaluationDate >= startDate)) && (!endDate || (evaluationDate && evaluationDate <= endDate));
        
        return yearMatch && monthMatch && companyMatch && dateMatch;
    });
  }, [evaluations, selectedYears, selectedMonths, selectedCompanies, startDate, endDate]);

  const companyPerformanceData = useMemo(() => {
    const data: any = {};
    filteredEvaluations.forEach(evalu => {
        if (!data[evalu.company_id]) {
            data[evalu.company_id] = {
                companyId: evalu.company_id,
                companyName: companiesMap.get(evalu.company_id) || "N/A",
                totalScore: 0,
                count: 0,
                lastEvaluationDate: new Date(0),
            };
        }
        data[evalu.company_id].totalScore += evalu.overall_score;
        data[evalu.company_id].count += 1;
        if (evalu.created_at && evalu.created_at.toDate() > data[evalu.company_id].lastEvaluationDate) {
            data[evalu.company_id].lastEvaluationDate = evalu.created_at.toDate();
        }
    });
    return Object.values(data).map((item: any) => ({
        ...item,
        averageRating: (item.totalScore / item.count).toFixed(2)
    }));
  }, [filteredEvaluations, companiesMap]);

  const metricsData = useMemo(() => {
    const totalEvaluations = filteredEvaluations.length;
    const overallAverage = totalEvaluations > 0 ? (filteredEvaluations.reduce((sum, e) => sum + e.overall_score, 0) / totalEvaluations).toFixed(2) : '0.00';
    const sortedByRating = [...companyPerformanceData].sort((a: any, b: any) => b.averageRating - a.averageRating);
    const bestPerformer = sortedByRating.length > 0 ? sortedByRating[0] : null;
    const worstPerformer = sortedByRating.length > 0 ? sortedByRating[sortedByRating.length - 1] : null;
    return {
      totalEvaluations: formatNumberEn(totalEvaluations),
      overallAverage: formatNumberEn(overallAverage),
      bestPerformer: bestPerformer ? `${bestPerformer.companyName} (${formatNumberEn(bestPerformer.averageRating)})` : t.all,
      worstPerformer: worstPerformer ? `${worstPerformer.companyName} (${formatNumberEn(worstPerformer.averageRating)})` : t.all,
    };
  }, [filteredEvaluations, companyPerformanceData, t]);

  // 4. CALLBACKS (useCallback)
  const handleViewDetails = useCallback((evaluation: Evaluation | undefined) => {
    if (evaluation) {
      setSelectedEvaluation(evaluation);
      setIsModalOpen(true);
    }
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedEvaluation(null);
  }, []);

  // 5. CONDITIONAL RENDER CHECK (placed after all hooks)
  if (companiesLoading || evaluationsLoading || questionsLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col min-h-[calc(100vh-6rem)]">
      <h1 className="text-3xl font-bold text-gray-100 mb-6">{t.title}</h1>
      <div className="bg-gray-800/50 p-4 rounded-xl shadow-2xl space-y-4 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* فلتر السنة */}
          <div>
            <label htmlFor="year-select" className="block text-sm font-medium text-gray-400">{t.year}</label>
            <Select
                isMulti
                options={availableYears.map(y => ({ value: y, label: y === 'all' ? t.all : formatNumberEn(y) }))}
                value={selectedYears.map(y => ({ value: y, label: y === 'all' ? t.all : formatNumberEn(y) }))}
                onChange={(selectedOptions) => setSelectedYears(selectedOptions.map(o => o.value))}
                className="mt-1"
                classNamePrefix="react-select"
                placeholder={t.year}
            />
          </div>
          {/* فلتر الشهر */}
          <div>
            <label htmlFor="month-select" className="block text-sm font-medium text-gray-400">{t.month}</label>
            <Select
                isMulti
                options={availableMonths.map(m => ({ value: m, label: m === 'all' ? t.all : new Date(2000, Number(m) - 1).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' }) }))}
                value={selectedMonths.map(m => ({ value: m, label: m === 'all' ? t.all : new Date(2000, Number(m) - 1).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' }) }))}
                onChange={(selectedOptions) => setSelectedMonths(selectedOptions.map(o => o.value))}
                className="mt-1"
                classNamePrefix="react-select"
                placeholder={t.month}
            />
          </div>
          {/* فلتر الشركات (اختيار متعدد) */}
          <div>
            <label htmlFor="company-select" className="block text-sm font-medium text-gray-400">{t.company}</label>
            <Select
                isMulti
                options={companiesOptions}
                value={companiesOptions.filter(o => selectedCompanies.includes(o.value))}
                onChange={(selectedOptions) => setSelectedCompanies(selectedOptions.map(o => o.value))}
                className="mt-1"
                classNamePrefix="react-select"
                placeholder={t.company}
            />
          </div>
          {/* فلتر التاريخ */}
          <div className="flex flex-col md:flex-row gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-400">{t.startDate}</label>
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                className="w-full bg-gray-700 text-gray-200 border-gray-600 rounded-md shadow-sm py-2 px-3 sm:text-sm"
                dateFormat="yyyy-MM-dd"
                placeholderText={t.startDate}
                isClearable
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">{t.endDate}</label>
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                className="w-full bg-gray-700 text-gray-200 border-gray-600 rounded-md shadow-sm py-2 px-3 sm:text-sm"
                dateFormat="yyyy-MM-dd"
                placeholderText={t.endDate}
                isClearable
              />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 mt-6 text-right">
          <button className="w-full md:w-auto bg-[#FFD700] text-black px-4 py-2.5 rounded-md font-semibold">
            {t.export}
          </button>
        </div>
      </div>
      
      <div className="flex-1 mt-6">
        {filteredEvaluations.length === 0 ? (
          <div className="text-center py-20 bg-gray-800/50 rounded-xl border border-gray-700">
            <InformationCircleIcon className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-4 text-lg font-semibold text-gray-400">{t.noData}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key Metrics Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoCard title={t.metrics.overallAverage} value={`${metricsData.overallAverage} / 5`} icon={InformationCircleIcon} color="text-yellow-400" />
              <InfoCard title={t.metrics.bestPerformer} value={metricsData.bestPerformer} icon={TrophyIcon} color="text-green-400" />
              <InfoCard title={t.metrics.worstPerformer} value={metricsData.worstPerformer} icon={ArrowDownIcon} color="text-red-400" />
              <InfoCard title={t.metrics.totalEvaluations} value={metricsData.totalEvaluations} icon={ArrowRightIcon} color="text-blue-400" />
            </div>
            
            {/* Report Charts Section */}
            <ReportCharts evaluations={filteredEvaluations} translations={translations} />

            {/* Company Performance Table */}
            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <h2 className="text-xl font-bold text-gray-200 mb-4">{t.tables.companyPerformance}</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t.tables.companyName}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t.tables.averageRating}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t.tables.totalEvaluations}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t.tables.lastEvaluation}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t.tables.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-900/50 divide-y divide-gray-700">
                    {companyPerformanceData.length > 0 ? (
                      companyPerformanceData.map((item: any) => (
                        <tr key={item.companyId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-200">{item.companyName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300" dir="ltr">{formatNumberEn(item.averageRating)} / 5</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300" dir="ltr">{formatNumberEn(item.count)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {item.lastEvaluationDate && item.lastEvaluationDate.getTime() > 0 
                              ? item.lastEvaluationDate.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') 
                              : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-200">
                            <button 
                              onClick={() => handleViewDetails(filteredEvaluations.find(e => e.company_id === item.companyId))}
                              className="text-yellow-400 hover:text-yellow-500 font-semibold"
                            >
                              {t.tables.viewDetails}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-400">{t.noData}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && selectedEvaluation && (
        <DetailedReportModal
          evaluation={selectedEvaluation}
          onClose={closeModal}
          translations={translations}
        />
      )}
    </div>
  );
}