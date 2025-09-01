import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { cleanText } from "../../utils/textUtils";
import { CalendarIcon, UsersIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { motion, Variants } from "framer-motion";
import { useAuth } from "../contexts/UserContext";
import { useLanguage } from "../contexts/LanguageContext";

// الأنواع تبقى كما هي
type Company = {
  id: string;
  name_ar: string;
  name_en?: string;
};

type Question = {
  id: number;
  text: string;
  textAr: string;
  textEn: string;
  ratingValue: number;
  note: string;
  invalid?: boolean;
};

type MonthOption = {
  value: string;
  label: string;
};

// المكونات الداخلية المستخدمة فقط في هذه الصفحة تبقى هنا
function StarRating({ rating, onChange, language }: { rating: number; onChange: (rating: number) => void; language: "ar" | "en" }) {
    const tooltips = {
        ar: ["", "تحتاج إلى تحسين", "مقبول", "جيد", "جيد جدا", "ممتاز"],
        en: ["", "Need improvement", "Acceptable", "Good", "Very Good", "Excellent"],
    };
    return (
        <div className="flex items-center gap-1 relative select-none">
            {[1, 2, 3, 4, 5].map((star) => (
                <div key={star} className="relative cursor-pointer" onClick={() => onChange(star)} title={tooltips[language][star]}>
                    <svg className={`w-6 h-6 ${star <= rating ? "text-yellow-400" : "text-gray-500"}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.388 2.46a1 1 0 00-.364 1.118l1.287 3.966c.3.92-.755 1.688-1.54 1.118l-3.388-2.46a1 1 0 00-1.176 0l-3.388 2.46c-.784.57-1.838-.197-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.045 9.393c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95.69l1.286-3.966z" />
                    </svg>
                </div>
            ))}
        </div>
    );
}

function FinalStarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-2 justify-center mb-4 select-none">
            {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className={`w-8 h-8 ${star <= Math.round(rating) ? "text-yellow-400" : "text-gray-500"}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.388 2.46a1 1 0 00-.364 1.118l1.287 3.966c.3.92-.755 1.688-1.54 1.118l-3.388-2.46a1 1 0 00-1.176 0l-3.388 2.46c-.784.57-1.838-.197-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.045 9.393c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95.69l1.286-3.966z" />
                </svg>
            ))}
            <span className="text-xl font-semibold text-white">{(rating * 20).toFixed(0)}%</span>
        </div>
    );
}

function getRatingDescription(rating: number, language: "ar" | "en") {
    const rounded = Math.round(rating);
    const tooltips = {
        ar: ["", "تحتاج إلى تحسين", "مقبول", "جيد", "جيد جداً", "ممتاز"],
        en: ["", "Need improvement", "Acceptable", "Good", "Very Good", "Excellent"],
    };
    return tooltips[language][rounded] || "";
}

export default function GuardsRatingPage() {
    const { user } = useAuth();
    const { language } = useLanguage();
    const isRTL = language === "ar";
    
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string>("");
    const [monthsOptions, setMonthsOptions] = useState<MonthOption[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [questionsInitialized, setQuestionsInitialized] = useState(false);
    const [notes, setNotes] = useState("");
    const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false);
    const [companyGuardCount, setCompanyGuardCount] = useState<number>(0);
    const [companyViolationsCount, setCompanyViolationsCount] = useState<number>(0);
    const [companyContractNo, setCompanyContractNo] = useState<string>("");
    
    const labels = {
        ar: { title: "تقييم جديد", month: "الشهر", company: "اسم المشغل (الشركة)", guardCount: "عدد الحراس", violationsCount: "عدد المخالفات", questions: "أسئلة التقييم", notes: "ملاحظات عامة", save: "حفظ التقييم" },
        en: { title: "New evaluation", month: "Month", company: "Operator (Company)", guardCount: "Number of Guards", violationsCount: "Number of Violations", questions: "Evaluation Questions", notes: "General Notes", save: "Save Evaluation" }
    };

    function getCurrentMonth(): string {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      return `${year}-${month.toString().padStart(2, "0")}`;
    }

    function getPreviousMonth(month: string): string {
        const d = new Date(month + "-01");
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    }

    function getNextMonth(month: string): string {
        const d = new Date(month + "-01");
        d.setMonth(d.getMonth() + 1);
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    }

    async function handleCompanySelection(id: string) {
      setSelectedCompany(id);
      setQuestionsInitialized(false);
      
      const { data: companyData, error: companyError } = await supabase.from("companies").select("guard_count, violations_count, contract_no").eq("id", id).single();

      if (!companyError && companyData) {
        setCompanyGuardCount(companyData.guard_count || 0);
        setCompanyViolationsCount(companyData.violations_count || 0);
        setCompanyContractNo(companyData.contract_no || "");
      } else {
        setCompanyGuardCount(0);
        setCompanyViolationsCount(0);
        setCompanyContractNo("");
      }

      const { data: lastEvalData, error } = await supabase.from("security_evaluations").select("year, month").eq("operator_id", id).order("year", { ascending: false }).order("month", { ascending: false }).limit(1).single();

      const monthLocale = language === "ar" ? "ar-EG-u-nu-latn" : "en-US";
      // --- FIX: Use 'as const' to ensure TypeScript infers the correct literal types ---
      const monthFormat = { month: "long", year: "numeric" } as const;

      if (error || !lastEvalData) {
        const prevMonth = getPreviousMonth(getCurrentMonth());
        setSelectedMonth(prevMonth);
        setMonthsOptions([{ value: prevMonth, label: new Date(prevMonth + "-01").toLocaleString(monthLocale, monthFormat) }]);
        return;
      }

      const lastMonthStr = `${lastEvalData.year}-${lastEvalData.month.toString().padStart(2, "0")}`;
      const nextMonth = getNextMonth(lastMonthStr);
      setSelectedMonth(nextMonth);
      setMonthsOptions([{ value: nextMonth, label: new Date(nextMonth + "-01").toLocaleString(monthLocale, monthFormat) }]);
    }

    const handleSubmit = async () => {
        if (!selectedCompany || !selectedMonth || questions.length === 0) return;
        if (!user) {
            alert(language === "ar" ? "يجب تسجيل الدخول أولاً" : "You must log in first.");
            return;
        }

        const unratedIndex = questions.findIndex((q) => q.ratingValue === 0);
        if (unratedIndex !== -1) {
            setQuestions((prev) => prev.map((q, index) => ({ ...q, invalid: index === unratedIndex })));
            document.getElementById(`question-${questions[unratedIndex].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            alert(language === "ar" ? "يرجى تقييم جميع الأسئلة قبل الحفظ." : "Please rate all questions before saving.");
            return;
        }

        setIsLoadingEvaluation(true);
        const [year, month] = selectedMonth.split("-").map(Number);
        const cleanedGeneralNotes = cleanText(notes);
        const cleanedQuestions = questions.map(q => ({ ...q, note: q.note ? cleanText(q.note) : null }));
        const overallScore = questions.length > 0 ? parseFloat((questions.reduce((sum, q) => sum + q.ratingValue, 0) / questions.length).toFixed(2)) : 0;

        try {
            const { data: insertEvalData, error: insertEvalError } = await supabase.from("security_evaluations").insert({ operator_id: selectedCompany, guard_count: companyGuardCount, violations_count: companyViolationsCount, contract_no: companyContractNo, notes: cleanedGeneralNotes, overall_score: overallScore, year, month, evaluation_date: new Date().toISOString(), evaluator_name: user.id, evaluator_job: user.job_id, client_name: "Abu Dhabi Municipality", location: "ADM" }).select("id").single();
            if (insertEvalError) throw insertEvalError;
            
            const evaluation_id = insertEvalData.id;
            const details = cleanedQuestions.map((q) => ({ evaluation_id, question_id: q.id, selected_rating: q.ratingValue, note: q.note }));
            const { error: detailsError } = await supabase.from("security_evaluation_details").insert(details);
            if (detailsError) throw detailsError;
            
            const { error: rpcError } = await supabase.rpc('update_company_overall_score', { company_id: selectedCompany });
            if (rpcError) console.warn("RPC Error:", rpcError);

            alert(language === "ar" ? "تم حفظ التقييم بنجاح." : "Evaluation saved successfully.");
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert(language === "ar" ? "حدث خطأ غير متوقع." : "An unexpected error occurred.");
        } finally {
            setIsLoadingEvaluation(false);
        }
    };
    
    useEffect(() => {
        async function fetchInitialData() {
            setIsLoadingEvaluation(true);
            const previousMonth = getPreviousMonth(getCurrentMonth());
            const [prevYear, prevMonth] = previousMonth.split("-").map(Number);
            
            const { data: allCompanies, error: companiesError } = await supabase.from("companies").select("id, name_ar, name_en");
            if (companiesError) { console.error(companiesError); setIsLoadingEvaluation(false); return; }

            const { data: evaluatedOperators, error: evalError } = await supabase.from("security_evaluations").select("operator_id").eq("year", prevYear).eq("month", prevMonth);
            if (evalError) { console.error(evalError); setIsLoadingEvaluation(false); return; }

            const evaluatedSet = new Set(evaluatedOperators?.map((item) => item.operator_id));
            const validCompanies = (allCompanies || []).filter((company) => !evaluatedSet.has(company.id));

            setCompanies(validCompanies);
            if (validCompanies.length > 0) {
              await handleCompanySelection(validCompanies[0].id);
            }
            setIsLoadingEvaluation(false);
        }
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!selectedMonth || questionsInitialized) return;
        async function fetchQuestions() {
            const { data, error } = await supabase.from("security_questions").select("id, question_text_ar, question_text_en");
            if (error) { console.error("Error loading questions:", error); return; }
            const initialQuestions = data.map((q) => ({ id: q.id, text: language === "ar" ? q.question_text_ar : q.question_text_en, textAr: q.question_text_ar, textEn: q.question_text_en, ratingValue: 0, note: "" }));
            setQuestions(initialQuestions);
            setQuestionsInitialized(true);
        }
        fetchQuestions();
    }, [selectedMonth, language, questionsInitialized]);

    useEffect(() => {
        if (questions.length === 0 && !questionsInitialized) return;
        setQuestions((prev) => prev.map((q) => ({ ...q, text: language === "ar" ? q.textAr : q.textEn })));
        setMonthsOptions((prev) => prev.map((m) => ({ ...m, label: new Date(m.value + "-01").toLocaleString(language === "ar" ? "ar-EG-u-nu-latn" : "en-US", { month: "long", year: "numeric" }) })));
    }, [language, questionsInitialized]);

    const containerVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
    const getItemVariants = (isRTL: boolean): Variants => ({ hidden: { opacity: 0, x: isRTL ? 50 : -50 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } } });

    const overallScore = questions.length > 0 ? parseFloat((questions.reduce((sum, q) => sum + q.ratingValue, 0) / questions.length).toFixed(2)) : 0;
    
    // تم حذف الهيدر والقائمة الجانبية من هنا
    return (
        <motion.div className="max-w-5xl mx-auto bg-gray-800/50 rounded-xl shadow-2xl space-y-6 p-4 sm:p-6 border border-gray-700" variants={containerVariants} initial="hidden" animate="visible">
            {companies.length > 0 ? (
                <motion.div variants={getItemVariants(isRTL)} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div>
                        <label className="block mb-1 font-semibold text-gray-300">{labels[language].company}</label>
                        <select className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-[#FFD700]" value={selectedCompany} onChange={(e) => handleCompanySelection(e.target.value)}>
                            {companies.map((c) => (<option key={c.id} value={c.id}>{language === "ar" ? c.name_ar : c.name_en || c.name_ar}</option>))}
                        </select>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3 shadow-md">
                        <CalendarIcon className="w-6 h-6 text-[#FFD700]" />
                        <div>
                            <div className="text-gray-400 font-semibold">{labels[language].month}</div>
                            <div className="text-white font-bold text-lg">{monthsOptions.find((m) => m.value === selectedMonth)?.label || "..."}</div>
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div variants={getItemVariants(isRTL)}>
                    <div className="flex flex-col items-center justify-center border border-yellow-400/50 bg-yellow-900/20 text-yellow-300 rounded-lg p-6 mt-4 shadow-lg">
                        <ExclamationTriangleIcon className="h-8 w-8 mb-3" />
                        <p className="text-center text-lg font-semibold">{language === "ar" ? "لا توجد شركات متاحة للتقييم." : "No companies available for evaluation."}</p>
                    </div>
                </motion.div>
            )}

            {selectedCompany && (
                <motion.div variants={getItemVariants(isRTL)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3 shadow-md">
                        <UsersIcon className="w-6 h-6 text-blue-400" />
                        <div>
                            <span className="text-gray-400 font-semibold">{labels[language].guardCount}</span>
                            <span className="block font-bold text-xl text-white">{companyGuardCount}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3 shadow-md">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
                        <div>
                            <span className="text-gray-400 font-semibold">{labels[language].violationsCount}</span>
                            <span className="block font-bold text-xl text-white">{companyViolationsCount}</span>
                        </div>
                    </div>
                </motion.div>
            )}
            
            {selectedCompany && selectedMonth && (
                <div className="space-y-6 pt-4 border-t border-gray-700">
                    {questions.map((q, index) => (
                        <motion.div key={q.id} variants={getItemVariants(isRTL)} initial="hidden" animate="visible" transition={{ delay: index * 0.05 }} className={`p-4 bg-gray-900/50 rounded-lg shadow-md border ${q.invalid ? "border-red-500" : "border-gray-700"}`}>
                            <p className="mb-3 font-semibold text-gray-200">{q.text}</p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <StarRating rating={q.ratingValue} onChange={(val) => setQuestions((prev) => prev.map((item, i) => (i === index ? { ...item, ratingValue: val, invalid: false } : item)))} language={language}/>
                                <textarea placeholder={language === "ar" ? "ملاحظات..." : "Notes..."} value={q.note} onChange={(e) => setQuestions((prev) => prev.map((item, i) => (i === index ? { ...item, note: e.target.value } : item)))} className="w-full flex-1 bg-gray-700 border border-gray-600 rounded-md p-2 mt-2 sm:mt-0 resize-y focus:outline-none focus:ring-2 focus:ring-[#FFD700]" rows={1}/>
                            </div>
                        </motion.div>
                    ))}
                    <motion.div variants={getItemVariants(isRTL)}>
                        <label className="block mb-1 font-semibold text-gray-300">{labels[language].notes}</label>
                        <textarea placeholder={language === "ar" ? "ملاحظات عامة..." : "General notes..."} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 resize-y focus:outline-none focus:ring-2 focus:ring-[#FFD700]" rows={4}/>
                    </motion.div>

                    {questions.length > 0 && (
                        <motion.div variants={getItemVariants(isRTL)}>
                            <div className="bg-gray-900/50 border border-yellow-400/50 rounded-lg p-6 mt-4 shadow-lg">
                                <h2 className="text-xl font-bold text-[#FFD700] mb-4 text-center">{labels[language].title}</h2>
                                <div className="flex flex-col items-center gap-2">
                                    <FinalStarRating rating={overallScore} />
                                    <span className="text-lg font-semibold text-gray-300">{getRatingDescription(overallScore, language)}</span>
                                    <button onClick={handleSubmit} className="bg-[#FFD700] text-black px-8 py-3 rounded-lg hover:bg-yellow-400 mt-4 font-bold transition-colors disabled:opacity-50" disabled={isLoadingEvaluation}>
                                        {labels[language].save}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}
        </motion.div>
    );
}

