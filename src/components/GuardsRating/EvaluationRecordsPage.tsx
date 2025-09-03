import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { supabase } from '../../lib/supabaseClient'; // تأكد من صحة المسار
import { useLanguage } from '../contexts/LanguageContext'; // تأكد من صحة المسار

// --- أيقونات ومكتبات إضافية ---
import { motion } from 'framer-motion';
import { Search, X, Star, Download, ShieldCheck, FileClock, Pencil, CheckCircle, User, Building, Calendar, FileText, UserCheck, AlertOctagon } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';

// --- استيراد الهيكل العام ---
import GuardsRatingLayout from '../GuardsRating/GuardsRatingLayout'; // تأكد من صحة هذا المسار

// --- الأنواع والتراجم (بدون تغيير) ---
type Evaluation = { id: string; evaluation_year: number; evaluation_month: number; overall_score: number; created_at: string; status: 'Draft' | 'Awaiting Approval' | 'Approved' | 'Rejected' | 'Archived'; companies: { name_ar: string; name_en: string; } | null; users: { name_ar: string; name_en: string; } | null; };
type EvaluationFull = { id: string; created_at: string; status: 'Draft' | 'Awaiting Approval' | 'Approved' | 'Rejected' | 'Archived'; summary: string | null; historical_contract_no: string | null; evaluation_year: number; evaluation_month: number; overall_score: number; companies: { name_ar: string; name_en: string; } | null; users: { name_ar: string; name_en: string; } | null; jobs: { name_ar: string; name_en: string; } | null; };
type EvaluationDetail = { id: number; selected_rating: number; note: string | null; security_questions: { question_text_ar: string; question_text_en: string; } | null; };
type ApprovalHistory = { id: number; status: string; comments: string | null; actioned_at: string | null; created_at: string; users: { name_ar: string; name_en: string; } | null; };
const translations = { ar: { pageTitle: "سجل التقييمات", searchPlaceholder: "ابحث باسم الشركة...", evaluationPeriod: "فترة التقييم", evaluator: "منشئ التقييم", status: "الحالة", score: "النتيجة", company: "الشركة", noRecords: "لا توجد سجلات تقييم.", loading: "جاري التحميل...", evaluationDetails: "تفاصيل التقييم", questionnaire: "أسئلة الاستبيان", approvalHistory: "سجل الإجراءات", evaluationCreated: "تم إنشاء التقييم", actionBy: "بواسطة", approved: "تم الاعتماد", rejected: "تم الرفض", pdfNotReady: "التقرير غير معتمد بعد", downloadPDF: "تحميل PDF", summary: "الملخص التنفيذي", contractNo: "رقم العقد التاريخي", evaluatorJob: "المسمى الوظيفي", statuses: { 'Draft': 'قيد الإعداد', 'Awaiting Approval': 'غير معتمد', 'Approved': 'معتمد', 'Rejected': 'مرفوض', 'Archived': 'مؤرشف' } }, en: { pageTitle: "Evaluation Records", searchPlaceholder: "Search by company name...", evaluationPeriod: "Evaluation Period", evaluator: "Evaluation Creator", status: "Status", score: "Score", company: "Company", noRecords: "No evaluation records available.", loading: "Loading...", evaluationDetails: "Evaluation Details", questionnaire: "Questionnaire Items", approvalHistory: "Action History", evaluationCreated: "Evaluation Created", actionBy: "by", approved: "Approved", rejected: "Rejected", pdfNotReady: "Report Not Approved Yet", downloadPDF: "Download PDF", summary: "Executive Summary", contractNo: "Historical Contract No.", evaluatorJob: "Job Title", statuses: { 'Draft': 'Draft', 'Awaiting Approval': 'Awaiting Approval', 'Approved': 'Approved', 'Rejected': 'Rejected', 'Archived': 'Archived' } }, };


// --- المكونات الداخلية لمحتوى الصفحة ---

const EvaluationListItem = ({ evaluation, onSelect }: { evaluation: Evaluation; onSelect: (ev: Evaluation) => void; }) => {
    // ... (هذا المكون بدون تغيير)
    const { language } = useLanguage();
    const t = translations[language];
    const companyName = language === 'ar' ? evaluation.companies?.name_ar : evaluation.companies?.name_en;
    const evaluatorName = language === 'ar' ? evaluation.users?.name_ar : evaluation.users?.name_en;
    const scorePercentage = (evaluation.overall_score * 20).toFixed(0);
    const monthLabel = new Date(evaluation.evaluation_year, evaluation.evaluation_month - 1).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
    const statusInfo = { 'Approved': { icon: ShieldCheck, color: 'text-green-400' }, 'Awaiting Approval': { icon: FileClock, color: 'text-yellow-400' }, 'Draft': { icon: Pencil, color: 'text-blue-400' }, 'Rejected': { icon: X, color: 'text-red-400' }, 'Archived': { icon: X, color: 'text-gray-500' } };
    const currentStatus = statusInfo[evaluation.status] || statusInfo['Archived'];
    const StatusIcon = currentStatus.icon;

    return (
        <div onClick={() => onSelect(evaluation)} className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-6 py-4 items-center cursor-pointer hover:bg-gray-700/50 transition-colors duration-200">
            <div className="col-span-2"><p className="font-bold text-white">{companyName}</p><p className="text-xs text-gray-400">{translations[language].evaluator}: {evaluatorName || '...'}</p></div>
            <div className='max-sm:col-start-1'><p className="text-sm text-gray-300">{monthLabel}</p></div>
            <div className="text-center sm:text-center"><p className="font-bold text-lg text-[#FFD700]">{scorePercentage}%</p></div>
            <div className={`flex items-center gap-2 justify-start sm:justify-center`}><StatusIcon className={currentStatus.color} size={18} /><span className={`text-xs font-bold ${currentStatus.color}`}>{t.statuses[evaluation.status]}</span></div>
        </div>
    );
};

const EvaluationDetailModal = ({ evaluation, onClose }: { evaluation: Evaluation | null; onClose: () => void; }) => {
    // ... (منطق المكون بدون تغيير)
    const { language } = useLanguage();
    const t = translations[language];
    const [fullData, setFullData] = useState<EvaluationFull | null>(null);
    const [details, setDetails] = useState<EvaluationDetail[]>([]);
    const [history, setHistory] = useState<ApprovalHistory[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!evaluation) return;
        const fetchAllDetails = async () => {
            setIsLoading(true);
            const { data: mainData } = await supabase.from('security_evaluations').select(`*, companies(*), users!evaluator_id(*), jobs!historical_job_id(*)`).eq('id', evaluation.id).single();
            const { data: detailsData } = await supabase.from('security_evaluation_details').select(`*, security_questions(*)`).eq('evaluation_id', evaluation.id).order('id', { ascending: true });
            console.log("بيانات تفاصيل الأسئلة المستلمة من Supabase:", detailsData);
            const { data: historyData } = await supabase.from('evaluation_approvals').select(`*, users!approver_id(name_ar, name_en)`).eq('evaluation_id', evaluation.id).order('created_at');
            setFullData(mainData as any);
            setDetails(detailsData as any || []);
            setHistory(historyData as any || []);
            setIsLoading(false);
        };
        fetchAllDetails();
    }, [evaluation]);

    const statusStyles: { [key: string]: { icon: React.ElementType, bgColor: string, textColor: string, borderColor: string } } = {
        'Approved': { icon: ShieldCheck, bgColor: 'bg-green-500/10', textColor: 'text-green-300', borderColor: 'border-green-500/30' },
        'Awaiting Approval': { icon: FileClock, bgColor: 'bg-yellow-500/10', textColor: 'text-yellow-300', borderColor: 'border-yellow-500/30' },
        'Rejected': { icon: AlertOctagon, bgColor: 'bg-red-500/10', textColor: 'text-red-300', borderColor: 'border-red-500/30' },
        'Archived': { icon: X, bgColor: 'bg-gray-500/10', textColor: 'text-gray-300', borderColor: 'border-gray-500/30' },
        'Draft': { icon: Pencil, bgColor: 'bg-blue-500/10', textColor: 'text-blue-300', borderColor: 'border-blue-500/30' }
    };
    const currentStatusStyle = fullData ? statusStyles[fullData.status] : null;
    const StatusIcon = currentStatusStyle?.icon;

    return (
        <Transition appear show={!!evaluation} as={Fragment}>
            <Dialog as="div" className="relative z-[60]" onClose={onClose} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-black/70 backdrop-blur-sm" /></Transition.Child>
                <div className="fixed inset-0 overflow-y-auto"><div className="flex min-h-full items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-[#0D1B2A] border border-gray-700 p-6 align-middle shadow-xl transition-all">
                        <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-white flex justify-between items-center mb-4">{t.evaluationDetails}<button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700"><X size={20} /></button></Dialog.Title>
                        
                        <div className="max-h-[80vh] overflow-y-auto custom-scrollbar pr-2 space-y-6">
                            {isLoading ? <p className='text-center py-8'>{t.loading}</p> : fullData && (
                                <>
                                    {currentStatusStyle && StatusIcon && (
                                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${currentStatusStyle.bgColor} ${currentStatusStyle.borderColor}`}>
                                            <StatusIcon size={24} className={currentStatusStyle.textColor} />
                                            <div>
                                                <div className="text-sm text-gray-400">{t.status}</div>
                                                <div className={`font-bold text-lg ${currentStatusStyle.textColor}`}>{t.statuses[fullData.status]}</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-4 bg-gray-900/50 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                                        <div className="flex items-start gap-3"><Building size={18} className="text-[#FFD700] mt-1 flex-shrink-0" /><div><div className="text-gray-400">{t.company}</div><div className="font-bold text-white">{language === 'ar' ? fullData.companies?.name_ar : fullData.companies?.name_en}</div></div></div>
                                        <div className="flex items-start gap-3"><Calendar size={18} className="text-[#FFD700] mt-1 flex-shrink-0" /><div><div className="text-gray-400">{t.evaluationPeriod}</div><div className="font-bold text-white">{new Date(fullData.evaluation_year, fullData.evaluation_month - 1).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}</div></div></div>
                                        <div className="flex items-start gap-3"><FileText size={18} className="text-[#FFD700] mt-1 flex-shrink-0" /><div><div className="text-gray-400">{t.contractNo}</div><div className="font-bold text-white">{fullData.historical_contract_no || 'N/A'}</div></div></div>
                                        <div className="flex items-start gap-3"><Star size={18} className="text-[#FFD700] mt-1 flex-shrink-0" /><div><div className="text-gray-400">{t.score}</div><div className="font-bold text-white">{(fullData.overall_score * 20).toFixed(0)}%</div></div></div>
                                    </div>

                                    {fullData.summary && (
                                        <div className="p-4 bg-gray-900/50 rounded-lg">
                                            <h3 className="text-lg font-bold text-white mb-2">{t.summary}</h3>
                                            <p className="text-gray-300 text-sm whitespace-pre-wrap">{fullData.summary}</p>
                                        </div>
                                    )}

                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-2">{t.questionnaire}</h3>
                                        <div className="space-y-4 rounded-lg bg-gray-900/50 p-4">
                                            {details.length > 0 ? details.map(d => (
                                                <div key={d.id} className="text-sm border-b border-gray-700 pb-3 last:border-b-0 last:pb-0">
                                                    <p className="font-semibold text-gray-200">{language === 'ar' ? d.security_questions?.question_text_ar : d.security_questions?.question_text_en}</p>
                                                    <div className="flex items-center gap-4 mt-2">
                                                        <div className="flex items-center gap-2">
                                                            {[1, 2, 3, 4, 5].map(star => (<Star key={star} size={16} className={star <= d.selected_rating ? "text-yellow-400" : "text-gray-600"} />))}
                                                            <span className="font-bold text-white">{d.selected_rating}/5</span>
                                                        </div>
                                                        {d.note && <p className={`text-gray-400 text-xs italic ${language === 'ar' ? 'pr-3 mr-3 border-r' : 'pl-3 ml-3 border-l'} border-gray-600`}>"{d.note}"</p>}
                                                    </div>
                                                </div>
                                            )) : <p className="text-gray-500 text-center py-4">{language === 'ar' ? 'لا توجد تفاصيل أسئلة لهذا التقييم.' : 'No question details found for this evaluation.'}</p>}
                                        </div>
                                    </div>
                                    
                                    <div className="border-t border-gray-700 pt-4">
                                        <h3 className="text-lg font-bold text-white mb-4">{t.approvalHistory}</h3>
                                        <div className="space-y-6">
                                            {/* ==== تعديل: المقيّم كأول حدث في السجل ==== */}
                                            <div className="flex items-start gap-4">
                                                <div className="bg-blue-500/20 rounded-full p-2 mt-1"><Pencil size={18} className="text-blue-400" /></div>
                                                <div>
                                                    <p className="font-bold text-gray-200">{t.evaluationCreated}</p>
                                                    <p className="text-sm text-gray-400">
                                                        {t.actionBy} {language === 'ar' ? fullData.users?.name_ar : fullData.users?.name_en}
                                                        <span className="text-gray-500"> ({language === 'ar' ? fullData.jobs?.name_ar : fullData.jobs?.name_en || 'N/A'})</span>
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">{new Date(fullData.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                                </div>
                                            </div>

                                            {history.map(item => (
                                                <div key={item.id} className="flex items-start gap-4">
                                                    <div className={`${item.status === 'Approved' ? 'bg-green-500/20' : 'bg-red-500/20'} rounded-full p-2 mt-1`}>{item.status === 'Approved' ? <CheckCircle size={18} className="text-green-400" /> : <X size={18} className="text-red-400" />}</div>
                                                    <div>
                                                        <p className="font-bold text-gray-200">{item.status === 'Approved' ? t.approved : t.rejected}</p>
                                                        <p className="text-sm text-gray-400">{t.actionBy} {language === 'ar' ? item.users?.name_ar : item.users?.name_en}</p>
                                                        {item.comments && <p className={`text-sm text-gray-300 mt-2 italic ${language === 'ar' ? 'border-r-2 pr-2' : 'border-l-2 pl-2'} border-gray-600`}>"{item.comments}"</p>}
                                                        <p className="text-xs text-gray-500 mt-1">{new Date(item.actioned_at || item.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </Dialog.Panel>
                </div></div>
            </Dialog>
        </Transition>
    );
};

// --- محتوى الصفحة الفعلي ---
function EvaluationRecordsContent() {
    // ... (هذا المكون بدون تغيير)
    const { language } = useLanguage();
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
    const t = translations[language];

    useEffect(() => {
        const fetchEvaluations = async () => {
            setIsLoading(true);
            const { data, error } = await supabase.from('security_evaluations')
                .select(`id, evaluation_year, evaluation_month, overall_score, status, created_at, companies(id, name_ar, name_en), users!evaluator_id(id, name_ar, name_en)`)
                .order('evaluation_year', { ascending: false }).order('evaluation_month', { ascending: false });
            if (error) console.error("!!! SUPABASE ERROR:", error);
            else if (data) setEvaluations(data as any);
            setIsLoading(false);
        };
        fetchEvaluations();
    }, []);

    const filteredEvaluations = useMemo(() => {
        return evaluations.filter(ev => {
            const companyName = language === 'ar' ? ev.companies?.name_ar.toLowerCase() : ev.companies?.name_en?.toLowerCase();
            return companyName?.includes(searchTerm.toLowerCase());
        });
    }, [evaluations, searchTerm, language]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto">
            <div className="flex justify-start mb-4">
                <div className="relative w-full sm:w-auto">
                    <input type="text" placeholder={t.searchPlaceholder} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full sm:w-64 bg-gray-800 text-white rounded-full py-2 focus:outline-none focus:ring-2 focus:ring-[#FFD700] ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'}`} />
                    <Search className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${language === 'ar' ? 'right-3' : 'left-3'}`} size={20} />
                </div>
            </div>
            {isLoading ? <div className="text-center py-10">{t.loading}</div> :
                filteredEvaluations.length === 0 ? <div className="text-center py-10 text-gray-500">{t.noRecords}</div> :
                    (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg overflow-x-auto">
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-6 py-3 text-xs font-bold text-gray-400 uppercase border-b border-gray-700 min-w-[700px]">
                                <div className="col-span-2">{t.company}</div><div className='max-sm:col-start-1'>{t.evaluationPeriod}</div><div className="text-center">{t.score}</div><div className="text-center">{t.status}</div>
                            </div>
                            <div className="divide-y divide-gray-700 min-w-[700px]">
                                {filteredEvaluations.map(ev => <EvaluationListItem key={ev.id} evaluation={ev} onSelect={setSelectedEvaluation} />)}
                            </div>
                        </div>
                    )}
            <EvaluationDetailModal evaluation={selectedEvaluation} onClose={() => setSelectedEvaluation(null)} />
        </motion.div>
    );
}

// --- المكون النهائي الذي يجمع الهيكل والمحتوى ---
export default function EvaluationRecordsPage() {
    const { language } = useLanguage();
    const pageTitle = translations[language].pageTitle;
    const activeServiceId = "evaluation-records";
    return (
        <GuardsRatingLayout activeServiceId={activeServiceId} pageTitle={pageTitle}>
            <EvaluationRecordsContent />
        </GuardsRatingLayout>
    );
}