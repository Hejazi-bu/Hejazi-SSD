import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { motion } from 'framer-motion';
import { Search, X, Star } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { EvaluationPDF } from './EvaluationPDF';

// --- Types ---
type Evaluation = {
  id: string;
  evaluation_date: string;
  overall_score: number;
  companies: { name_ar: string; name_en: string; } | null;
};
type EvaluationDetail = {
  selected_rating: number;
  note: string | null;
  security_questions: { question_text_ar: string; question_text_en: string; } | null;
};

// --- Translations ---
const translations = {
  ar: {
    title: "سجلات التقييم",
    searchPlaceholder: "ابحث باسم الشركة...",
    company: "الشركة",
    evaluationDate: "تاريخ التقييم",
    score: "النتيجة",
    evaluationDetails: "تفاصيل التقييم",
    question: "السؤال",
    rating: "التقييم",
    notes: "الملاحظات",
    close: "إغلاق",
    loading: "جاري التحميل...",
    noRecords: "لا توجد سجلات تقييم متاحة.",
    downloadPDF: "تحميل PDF",
  },
  en: {
    title: "Evaluation Records",
    searchPlaceholder: "Search by company name...",
    company: "Company",
    evaluationDate: "Evaluation Date",
    score: "Score",
    evaluationDetails: "Evaluation Details",
    question: "Question",
    rating: "Rating",
    notes: "Notes",
    close: "Close",
    loading: "Loading...",
    noRecords: "No evaluation records available.",
    downloadPDF: "Download PDF",
  },
};

// --- Main Page Component ---
export const EvaluationRecordsPage = () => {
    const { language } = useLanguage();
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
    const t = translations[language];

    useEffect(() => {
        const fetchEvaluations = async () => {
          setIsLoading(true);
          const { data, error } = await supabase
            .from('security_evaluations')
            .select(`id, evaluation_date, overall_score, companies ( name_ar, name_en )`)
            .order('evaluation_date', { ascending: false });

          if (error) {
            console.error("!!! SUPABASE ERROR:", error);
          } else if (data) {
              const validData = data.filter(d => d.companies && typeof d.companies === 'object' && !Array.isArray(d.companies));
              setEvaluations(validData as unknown as Evaluation[]);
          } else {
              setEvaluations([]);
          }
          setIsLoading(false);
        };
        fetchEvaluations();
      }, []);

    const filteredEvaluations = useMemo(() => {
        return evaluations.filter(ev => {
            const companyName = language === 'ar' ? ev.companies?.name_ar : ev.companies?.name_en;
            return companyName?.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [evaluations, searchTerm, language]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-7xl mx-auto"
        >
            <div className="flex flex-col sm:flex-row justify-end items-center mb-6">
                <div className="relative mt-4 sm:mt-0 w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder={t.searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-64 bg-gray-800 text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>
            </div>
            
            {isLoading ? (
                <div className="text-center py-10">{t.loading}</div>
            ) : filteredEvaluations.length === 0 ? (
                <div className="text-center py-10 text-gray-500">{t.noRecords}</div>
            ) : (
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                    initial="hidden"
                    animate="visible"
                >
                    {filteredEvaluations.map(ev => (
                        <EvaluationCard key={ev.id} evaluation={ev} onSelect={setSelectedEvaluation} />
                    ))}
                </motion.div>
            )}

            <EvaluationDetailModal evaluation={selectedEvaluation} onClose={() => setSelectedEvaluation(null)} />
        </motion.div>
    );
};

// --- Evaluation Card Component ---
const EvaluationCard = ({ evaluation, onSelect }: { evaluation: Evaluation; onSelect: (ev: Evaluation) => void; }) => {
    const { language } = useLanguage();
    const t = translations[language];
    const companyName = language === 'ar' ? evaluation.companies?.name_ar : evaluation.companies?.name_en;
    const scorePercentage = (evaluation.overall_score * 20).toFixed(0);
  
    return (
      <motion.div
        variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
        whileHover={{ y: -5, transition: { type: 'spring', stiffness: 300 } }}
        className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-5 cursor-pointer"
        onClick={() => onSelect(evaluation)}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-400">{t.company}</p>
            <h3 className="text-xl font-bold text-white">{companyName}</h3>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">{t.score}</p>
            <p className="text-2xl font-bold text-[#FFD700]">{scorePercentage}%</p>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-4 pt-4 flex justify-between items-center text-gray-400 text-sm">
          <span>{t.evaluationDate}</span>
          <span>{new Date(evaluation.evaluation_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</span>
        </div>
      </motion.div>
    );
};
  
// --- Evaluation Detail Modal Component ---
const EvaluationDetailModal = ({ evaluation, onClose }: { evaluation: Evaluation | null; onClose: () => void; }) => {
    const { language } = useLanguage();
    const [details, setDetails] = useState<EvaluationDetail[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const t = translations[language];

    useEffect(() => {
      if (evaluation) {
        setIsLoading(true);
        setError(null);
        const fetchDetails = async () => {
          const { data, error: fetchError } = await supabase
            .from('security_evaluation_details')
            .select(`selected_rating, note, security_questions ( question_text_ar, question_text_en )`)
            .eq('evaluation_id', evaluation.id);

          if (fetchError) {
            console.error("Error fetching details:", fetchError);
            setError(fetchError.message);
            setDetails([]);
          } else if (data) {
            setDetails(data as unknown as EvaluationDetail[]);
          }
          setIsLoading(false);
        };
        fetchDetails();
      }
    }, [evaluation]);
    
    return (
      <Transition appear show={!!evaluation} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-[#0D1B2A] border border-gray-700 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-white flex justify-between items-center">
                    {t.evaluationDetails}
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700"><X size={20}/></button>
                  </Dialog.Title>

                  <div className="mt-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                    {error && (
                        <div className="my-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-center">
                          <p className="font-bold mb-1">An error occurred:</p>
                          <p className="text-sm">{error}</p>
                        </div>
                    )}
                    {isLoading ? (
                      <p className="text-center text-gray-400">{t.loading}</p>
                    ) : !error && details.length > 0 ? (
                      details.map((detail, index) => (
                        <div key={index} className="mb-4 border-b border-gray-800 pb-4">
                            <p className="font-semibold text-gray-300">{language === 'ar' ? detail.security_questions?.question_text_ar : detail.security_questions?.question_text_en}</p>
                            <div className="flex items-center gap-2 mt-2">
                            <Star className="text-yellow-400" size={16} />
                            <span className="font-bold text-white">{detail.selected_rating} / 5</span>
                            </div>
                            {detail.note && <p className="text-sm text-gray-400 mt-1 pl-6">{detail.note}</p>}
                        </div>
                      ))
                    ) : (
                      !isLoading && !error && <p className="text-center text-gray-500">{t.noRecords}</p>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end">
                    {evaluation && !isLoading && !error && details.length > 0 ? (
                      <PDFDownloadLink
                        document={<EvaluationPDF evaluation={evaluation} details={details} language={language} />}
                        fileName={`evaluation-report-${evaluation.companies?.name_en || evaluation.id}.pdf`}
                      >
                        {({ loading }) => (
                          <div className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                            {loading ? t.loading : t.downloadPDF}
                          </div>
                        )}
                      </PDFDownloadLink>
                    ) : (
                      <button
                        disabled
                        className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg cursor-not-allowed"
                      >
                        {isLoading ? t.loading : t.downloadPDF}
                      </button>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    )
};