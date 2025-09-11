// src/components/GuardsRating/NewEvaluationPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { db } from "../../lib/supabaseClient"; // تعديل: استبدال supabase بـ db
import { cleanText } from "../../utils/textUtils";
import { useAuth } from "../contexts/UserContext";
import { useLanguage } from "../contexts/LanguageContext";
import LoadingScreen from "../LoadingScreen";

// --- أيقونات ومكتبات إضافية ---
import { CalendarIcon, UsersIcon, ExclamationTriangleIcon, BriefcaseIcon } from "@heroicons/react/24/solid";
import { motion, Variants } from "framer-motion";

// --- استيراد الهيكل العام ---
import GuardsRatingLayout from '../GuardsRating/GuardsRatingLayout';

// --- الأنواع | Types ---
type CompanyForEvaluation = {
  id: string;
  name_ar: string;
  name_en?: string;
  contract_no: string;
  guard_count: number;
  violations_count: number;
  nextEvalYear: number;
  nextEvalMonth: number;
  isDone?: boolean;
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

// --- المكونات الداخلية لمحتوى الصفحة ---
function StarRating({ rating, onChange, language }: { rating: number; onChange: (rating: number) => void; language: "ar" | "en" }) {
    const tooltips = {
        ar: ["", "تحتاج إلى تحسين", "مقبول", "جيد", "جيد جدا", "ممتاز"],
        en: ["", "Need improvement", "Acceptable", "Good", "Very Good", "Excellent"],
    };
    return (
        <div className="flex items-center gap-1 relative select-none">
            {[1, 2, 3, 4, 5].map((star) => (
                <div key={star} className="relative cursor-pointer" onClick={() => onChange(star)} title={tooltips[language][star]}>
                    <svg className={`w-6 h-6 ${star <= rating ? "text-yellow-400" : "text-gray-500"}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.388 2.46a1 1 0 00-.364 1.118l1.287 3.966c.3.92-.755 1.688-1.54 1.118l-3.388-2.46a1 1 0 00-1.176 0l-3.388 2.46c-.784.57-1.838-.197-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.045 9.393c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95.69l1.286-3.966z" /></svg>
                </div>
            ))}
        </div>
    );
}

function FinalStarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-2 justify-center mb-4 select-none">
            {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className={`w-8 h-8 ${star <= Math.round(rating) ? "text-yellow-400" : "text-gray-500"}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.388 2.46a1 1 0 00-.364 1.118l1.287 3.966c.3.92-.755 1.688-1.54 1.118l-3.388-2.46a1 1 0 00-1.176 0l-3.388 2.46c-.784.57-1.838-.197-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.045 9.393c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95.69l1.286-3.966z" /></svg>
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

function InfoCard({ Icon, label, value, color }: { Icon: React.ElementType, label: string, value: string | number, color: string }) {
    return (
        <div className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3 shadow-md">
            <Icon className={`w-6 h-6 ${color}`} />
            <div>
                <span className="text-gray-400 font-semibold text-sm">{label}</span>
                <span className="block font-bold text-xl text-white">{value || 0}</span>
            </div>
        </div>
    );
}


// --- محتوى الصفحة الفعلي ---
function NewEvaluationContent() {
    const { user } = useAuth();
    const { language } = useLanguage();
    
    const [companiesForEval, setCompaniesForEval] = useState<CompanyForEvaluation[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<CompanyForEvaluation | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [summary, setSummary] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const labels = useMemo(() => ({
        ar: { title: "تقييم أداء جديد", month: "شهر التقييم", company: "اسم الشركة", questions: "أسئلة التقييم", summary: "ملخص التقييم / ملاحظات عامة", save: "حفظ وإرسال للاعتماد", contractNo: "رقم العقد", guardCount: "عدد الحراس", violationsCount: "عدد المخالفات", loading: "جاري تحليل السجلات..." },
        en: { title: "New Performance Evaluation", month: "Evaluation Month", company: "Company Name", questions: "Evaluation Questions", summary: "Evaluation Summary / General Notes", save: "Save and Submit for Approval", contractNo: "Contract No.", guardCount: "Number of Guards", violationsCount: "Number of Violations", loading: "Analyzing records..." }
    }), [language]);

    // تعديل: استبدال supabase.from().insert بـ db.query('INSERT ...')
    const handleSubmit = async () => {
        if (!selectedCompany || !user || questions.some(q => q.ratingValue === 0)) {
            alert(language === "ar" ? "يرجى إكمال جميع الحقول وتقييم كل الأسئلة." : "Please complete all fields and rate all questions.");
            return;
        }
        setIsSubmitting(true);
        const overallScore = parseFloat((questions.reduce((sum, q) => sum + q.ratingValue, 0) / questions.length).toFixed(2));

        const newEvaluation = {
            evaluation_year: selectedCompany.nextEvalYear,
            evaluation_month: selectedCompany.nextEvalMonth,
            company_id: selectedCompany.id,
            evaluator_id: user.id,
            historical_job_id: user.job_id,
            status: 'Awaiting Approval',
            historical_contract_no: selectedCompany.contract_no,
            summary: cleanText(summary),
            overall_score: overallScore,
        };

        try {
            const evalQuery = 'INSERT INTO security_evaluations (evaluation_year, evaluation_month, company_id, evaluator_id, historical_job_id, status, historical_contract_no, summary, overall_score) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id';
            const evalRes = await db.query(evalQuery, [
                newEvaluation.evaluation_year,
                newEvaluation.evaluation_month,
                newEvaluation.company_id,
                newEvaluation.evaluator_id,
                newEvaluation.historical_job_id,
                newEvaluation.status,
                newEvaluation.historical_contract_no,
                newEvaluation.summary,
                newEvaluation.overall_score,
            ]);
            
            const evaluation_id = evalRes.rows[0].id;
            const detailsToInsert = questions.map(q => ({ evaluation_id, question_id: q.id, selected_rating: q.ratingValue, note: q.note ? cleanText(q.note) : null }));
            
            const detailsQuery = 'INSERT INTO security_evaluation_details (evaluation_id, question_id, selected_rating, note) VALUES ' + detailsToInsert.map((_, i) => `($${i*4 + 1}, $${i*4 + 2}, $${i*4 + 3}, $${i*4 + 4})`).join(', ');
            const detailsValues = detailsToInsert.flatMap(d => [d.evaluation_id, d.question_id, d.selected_rating, d.note]);

            if (detailsValues.length > 0) {
              await db.query(detailsQuery, detailsValues);
            }
            
            alert(language === "ar" ? "تم حفظ التقييم وإرساله للاعتماد بنجاح." : "Evaluation saved and submitted for approval successfully.");
            window.location.reload();
        } catch (error: any) {
            console.error("Error saving evaluation:", error);
            alert(language === "ar" ? `حدث خطأ: ${error.message}` : `An error occurred: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // تعديل: استبدال استعلامات Supabase و RPC بـ db.query
    useEffect(() => {
        const fetchAndProcessData = async () => {
            setIsLoading(true);
            
            try {
                // جلب الشركات
                const companiesQuery = 'SELECT id, name_ar, name_en, contract_no, guard_count, violations_count FROM companies';
                const companiesRes = await db.query(companiesQuery);
                const allCompanies = companiesRes.rows;

                // جلب الأسئلة
                const questionsQuery = 'SELECT * FROM security_questions ORDER BY id ASC';
                const questionsRes = await db.query(questionsQuery);
                const questionsData = questionsRes.rows;

                if (questionsData) {
                    const initialQuestions = questionsData.map(q => ({ id: q.id, text: language === "ar" ? q.question_text_ar : q.question_text_en, textAr: q.question_text_ar, textEn: q.question_text_en, ratingValue: 0, note: "" }));
                    setQuestions(initialQuestions);
                }

                if (!allCompanies) { setIsLoading(false); return; }
                
                // استبدال rpc باستعلام مباشر
                const latestEvalQuery = 'SELECT company_id, evaluation_year, evaluation_month FROM security_evaluations WHERE (company_id, created_at) IN (SELECT company_id, MAX(created_at) FROM security_evaluations GROUP BY company_id)';
                const latestEvalRes = await db.query(latestEvalQuery);
                
                type LastEval = { company_id: string; evaluation_year: number; evaluation_month: number; };
                const lastEvals: LastEval[] = latestEvalRes.rows || [];
                const lastEvalsMap = new Map(lastEvals.map(e => [e.company_id, { year: e.evaluation_year, month: e.evaluation_month }]));
                
                const today = new Date();
                const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastMonth = lastMonthDate.getMonth() + 1;
                const lastMonthYear = lastMonthDate.getFullYear();

                const companiesToEvaluate = allCompanies.map(company => {
                    const lastEval = lastEvalsMap.get(company.id);
                    let nextEvalYear: number, nextEvalMonth: number;
                    let isDoneForThisCycle = false;
                    
                    if (!lastEval) {
                        nextEvalYear = lastMonthYear;
                        nextEvalMonth = lastMonth;
                    } else {
                        const lastEvalDate = new Date(lastEval.year, lastEval.month - 1, 1);
                        const nextEvalDate = new Date(lastEvalDate.setMonth(lastEvalDate.getMonth() + 1));
                        nextEvalYear = nextEvalDate.getFullYear();
                        nextEvalMonth = nextEvalDate.getMonth() + 1;
                        isDoneForThisCycle = lastEval.year === lastMonthYear && lastEval.month === lastMonth;
                    }
                    
                    return { ...company, nextEvalYear, nextEvalMonth, isDone: isDoneForThisCycle };
                }).filter(c => !c.isDone);

                setCompaniesForEval(companiesToEvaluate);
                if (companiesToEvaluate.length > 0) {
                    setSelectedCompany(companiesToEvaluate[0]);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndProcessData();
    }, [language]);

    const containerVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
    const itemVariants: Variants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
    const overallScore = useMemo(() => questions.length > 0 ? (questions.reduce((sum, q) => sum + q.ratingValue, 0) / questions.length) : 0, [questions]);
    
    // 👈 هنا قمنا باستبدال عنصر التحميل بـ <LoadingScreen />
    if (isLoading) {
        return <LoadingScreen />;
    }
    
    return (
        <motion.div className="max-w-5xl mx-auto bg-gray-800/50 rounded-xl shadow-2xl space-y-6 p-4 sm:p-6 border border-gray-700" variants={containerVariants} initial="hidden" animate="visible">
            {companiesForEval.length > 0 && selectedCompany ? (
                <>
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{labels[language].company}</label>
                            <select 
                                value={selectedCompany.id} 
                                onChange={(e) => setSelectedCompany(companiesForEval.find(c => c.id === e.target.value) || null)} 
                                className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                            >
                                {companiesForEval.map(c => <option key={c.id} value={c.id}>{language === "ar" ? c.name_ar : c.name_en || c.name_ar}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3 shadow-md h-full">
                            <CalendarIcon className="w-6 h-6 text-[#FFD700]" />
                            <div>
                                <div className="text-gray-400 font-semibold">{labels[language].month}</div>
                                <div className="text-white font-bold text-lg">
                                    {new Date(selectedCompany.nextEvalYear, selectedCompany.nextEvalMonth - 1).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <InfoCard Icon={UsersIcon} label={labels[language].guardCount} value={selectedCompany.guard_count} color="text-blue-400" />
                        <InfoCard Icon={ExclamationTriangleIcon} label={labels[language].violationsCount} value={selectedCompany.violations_count} color="text-red-400" />
                        <InfoCard Icon={BriefcaseIcon} label={labels[language].contractNo} value={selectedCompany.contract_no} color="text-green-400" />
                    </motion.div>
                    
                    <div className="space-y-6 pt-4 border-t border-gray-700">
                        {questions.map((q, index) => (
                            <motion.div key={q.id} variants={itemVariants} className={`p-4 bg-gray-900/50 rounded-lg shadow-md border ${q.invalid ? "border-red-500" : "border-gray-700"}`}>
                                <p className="mb-3 font-semibold text-gray-200">{q.text}</p>
                                <div className="flex flex-col sm:flex-row gap-4 items-center">
                                    <StarRating rating={q.ratingValue} onChange={(val) => setQuestions(qs => qs.map((item, i) => (i === index ? { ...item, ratingValue: val, invalid: false } : item)))} language={language}/>
                                    <textarea placeholder={language === "ar" ? "ملاحظات (اختياري)..." : "Notes (optional)..."} value={q.note} onChange={(e) => setQuestions(qs => qs.map((item, i) => (i === index ? { ...item, note: e.target.value } : item)))} className="w-full flex-1 bg-gray-700 border border-gray-600 rounded-md p-2 resize-y" rows={1}/>
                                </div>
                            </motion.div>
                        ))}
                        <motion.div variants={itemVariants}>
                            <label className="block mb-1 font-semibold text-gray-300">{labels[language].summary}</label>
                            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md border border-gray-600" rows={4} placeholder={language === "ar" ? "أضف ملخصًا أو ملاحظات عامة (اختياري)..." : "Add a summary or general notes (optional)..."}/>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <div className="bg-gray-900/50 border border-yellow-400/50 rounded-lg p-6 mt-4">
                                <h2 className="text-xl font-bold text-[#FFD700] mb-4 text-center">
                                    {language === "ar" ? "النتيجة الإجمالية" : "Overall Score"}
                                </h2>
                                <div className="flex flex-col items-center">
                                    <FinalStarRating rating={overallScore} />
                                    <span className="text-lg text-gray-300">{getRatingDescription(overallScore, language)}</span>
                                    <button onClick={handleSubmit} className="bg-[#FFD700] text-black px-8 py-3 rounded-lg mt-4 font-bold disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={isSubmitting}>
                                        {isSubmitting ? (language === "ar" ? "جاري الحفظ..." : "Saving...") : labels[language].save}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            ) : (
                <motion.div variants={itemVariants} className="text-center py-10">
                    <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-yellow-400" />
                    <p className="mt-4 text-lg font-semibold text-yellow-300">
                        {language === "ar" ? "جميع الشركات تم تقييمها لهذا الشهر." : "All companies have been evaluated for this month."}
                    </p>
                </motion.div>
            )}
        </motion.div>
    );
}


// --- المكون النهائي الذي يجمع الهيكل والمحتوى ---
export default function NewEvaluationPage() {
    const { language } = useLanguage();
    
    const pageTitle = language === 'ar' ? 'تقييم أداء جديد' : 'New Performance Evaluation';
    const activeServiceId = "new-evaluation";

    return (
        <GuardsRatingLayout activeServiceId={activeServiceId} pageTitle={pageTitle}>
            <NewEvaluationContent />
        </GuardsRatingLayout>
    );
}