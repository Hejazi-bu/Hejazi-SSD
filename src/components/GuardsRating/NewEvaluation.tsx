import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
    staggeredContainerVariants,
    staggeredItemVariants,
    interactiveItemVariants,
    shakeVariants,
    fadeInVariants,
    directionalSlideVariants
} from "../../lib/animations";
import { cleanText } from "../../utils/textUtils";
import { useAuth } from "../contexts/UserContext";
import { useLanguage } from "../contexts/LanguageContext";
import { usePageLoading } from "../contexts/LoadingContext";
import { useActionLoading } from "../contexts/ActionLoadingContext";
import { collection, query, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, orderBy, where, onSnapshot, limit } from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db, functions } from '../../lib/firebase';
import { CalendarIcon, UsersIcon, ExclamationTriangleIcon, BriefcaseIcon, StarIcon, InformationCircleIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useDialog } from "../contexts/DialogContext";
import { useUnsavedChanges } from "../contexts/UnsavedChangesContext";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { getClientContext } from "../../lib/clientContext";

// --- الأنواع والمحولات والمكونات الداخلية ---
interface Company extends DocumentData { id: string; name_ar: string; name_en?: string; contract_no: string; guard_count: number; violations_count: number; }
interface QuestionDoc extends DocumentData { id: string; question_text_ar: string; question_text_en: string; }
interface Evaluation extends DocumentData {
    company_id: string;
    evaluation_year: number;
    evaluation_month: number;
    evaluator_id: string;
    created_at: any;
    status: 'Needs Revision' | 'Awaiting Approval' | 'Approved' | 'Rejected'; // <-- السطر الجديد
}
// [تعديل]: تم إضافة خاصية جديدة للتحكم بالاهتزاز بشكل منفصل
type QuestionState = { id: string; text: string; ratingValue: number; note: string; invalid?: boolean; shake?: boolean; };

const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
    toFirestore: (data: T): DocumentData => data,
    fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T)
});
const companyConverter = createConverter<Company>();
const questionConverter = createConverter<QuestionDoc>();
const evaluationConverter = createConverter<Evaluation>();

const formatNumberEn = (value: number | string, options?: Intl.NumberFormatOptions): string => {
    const defaultOptions: Intl.NumberFormatOptions = { useGrouping: false, ...options };
    try { return new Intl.NumberFormat('en-US', defaultOptions).format(Number(value)); } catch { return String(value); }
}

function StarRating({ rating, onChange, language }: { rating: number; onChange: (rating: number) => void; language: "ar" | "en" }) {
    const tooltips = {
        ar: ["", "تحتاج إلى تحسين", "مقبول", "جيد", "جيد جدا", "ممتاز"],
        en: ["", "Need improvement", "Acceptable", "Good", "Very Good", "Excellent"],
    };
    const stars = useMemo(() => language === 'ar' ? [1, 2, 3, 4, 5].reverse() : [1, 2, 3, 4, 5], [language]);
    return (
        <div className="flex items-center gap-1 relative select-none" dir="ltr">
            {stars.map((star) => (
                <motion.div key={star} className="relative cursor-pointer" onClick={() => onChange(star)} title={tooltips[language][star]} variants={interactiveItemVariants} whileHover="hover" whileTap="tap">
                    <StarIcon className={`w-8 h-8 transition-colors duration-200 ${star <= rating ? "text-yellow-400" : "text-gray-500 hover:text-gray-400"}`} />
                </motion.div>
            ))}
        </div>
    );
}

function FinalStarRating({ rating, language }: { rating: number; language: "ar" | "en" }) {
    const starsArray = useMemo(() => language === 'ar' ? [1, 2, 3, 4, 5].reverse() : [1, 2, 3, 4, 5], [language]);
    const StarsComponent = <>{starsArray.map((star) => <StarIcon key={star} className={`w-8 h-8 ${star <= Math.round(rating) ? "text-yellow-400" : "text-gray-500"}`} />)}</>;
    const PercentageComponent = <span className="text-xl font-semibold text-white">{formatNumberEn(rating * 20, { maximumFractionDigits: 0 })}%</span>;
    return (
        <div className="flex items-center gap-2 justify-center mb-4 select-none" dir="ltr">
            {language === 'ar' ? <>{PercentageComponent}{StarsComponent}</> : <>{StarsComponent}{PercentageComponent}</>}
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

function InfoCard({ Icon, label, subLabel, value, color, disableFormatting = false, actionButton }: { Icon: React.ElementType, label: string; subLabel?: React.ReactNode; value: string | number; color: string, disableFormatting?: boolean, actionButton?: React.ReactNode }) {
    return (
        <motion.div variants={interactiveItemVariants} whileHover="hover" className="group relative flex items-center gap-3 bg-gradient-to-br from-gray-900/60 to-gray-800/60 rounded-lg p-3 shadow-md border border-gray-700 hover:border-[#FFD700]/30 transition-colors duration-300">
            <Icon className={`w-6 h-6 ${color}`} />
            <div className="flex flex-col items-start">
                <span className="text-gray-400 font-semibold text-sm">{label}</span>
                {subLabel && <span className="text-gray-500 text-xs mt-0.5">{subLabel}</span>}
                <span className="block font-bold text-xl text-white" dir="ltr">{disableFormatting ? value : formatNumberEn(value || 0)}</span>
            </div>
            {actionButton && <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2">{actionButton}</div>}
        </motion.div>
    );
}

function NewEvaluationContent({
    companiesForEval, selectedCompany, onCompanyChange, questions,
    onQuestionChange, summary, onSummaryChange, onSubmit, isSubmitting,
    targetYear, targetMonth, translations, questionsRefs,
    showDialog, canPerformSaveAction, userHasSignature
}: any) {
    const { language } = useLanguage();
    const t = { ...translations[language], ...translations[language].common };
    const overallScore = useMemo(() => questions.length > 0 ? (questions.reduce((sum: number, q: QuestionState) => sum + q.ratingValue, 0) / questions.length) : 0, [questions]);

    const formattedMonthYear = useMemo(() => {
        if (targetYear === null || targetMonth === null) return "";
        const date = new Date(targetYear, targetMonth - 1);
        const monthName = date.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' });
        const year = formatNumberEn(targetYear);
        return language === 'ar' ? `${monthName} ${year}` : `${monthName} ${year}`;
    }, [targetYear, targetMonth, language]);
    
    const monthName = useMemo(() => {
        if (targetMonth === null || targetYear === null) return "";
        const date = new Date(targetYear, targetMonth - 1);
        return date.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' });
    }, [targetMonth, targetYear, language]);

    const cardGroupVariants: Variants = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
        exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: 'easeIn' } }
    };
    
    const infoButton = (
        <motion.button className="focus:outline-none" variants={interactiveItemVariants} whileHover={{ scale: 1.1, y: -1 }} whileTap="tap"
            onClick={() => showDialog({
                variant: 'alert',
                title: language === 'ar' ? 'للعلم' : 'Information',
                message: language === 'ar' ? 'هذه الميزة قيد البرمجة حالياً.' : 'This feature is currently under development.'
            })}
        >
            <InformationCircleIcon className="w-5 h-5 text-gray-500 hover:text-white transition-colors" />
        </motion.button>
    );

    return (
        <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" exit="exit" className="flex-grow bg-gray-800/50 rounded-xl shadow-2xl space-y-6 p-4 sm:p-6 border border-gray-700">
            {companiesForEval.length > 0 && selectedCompany ? (
                <>
                    <AnimatePresence mode="wait">
                        <motion.div key={selectedCompany.id} variants={cardGroupVariants} initial="initial" animate="animate" exit="exit">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                                <motion.div className="bg-gradient-to-br from-gray-900/60 to-gray-800/60 rounded-lg p-3 shadow-md border border-gray-700 hover:border-[#FFD700]/30 transition-colors duration-300 flex flex-col justify-center" variants={interactiveItemVariants} whileHover="hover">
                                    <label className="block mb-1 font-semibold text-gray-300 text-sm">{t.company}</label>
                                    <select value={selectedCompany.id} onChange={(e) => onCompanyChange(companiesForEval.find((c: Company) => c.id === e.target.value) || null)} className="w-full bg-gray-700 p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700]">
                                        {companiesForEval.map((c: Company) => <option key={c.id} value={c.id}>{language === "ar" ? c.name_ar : c.name_en || c.name_ar}</option>)}
                                    </select>
                                </motion.div>
                                <motion.div className="flex items-center gap-3 bg-gradient-to-br from-gray-900/60 to-gray-800/60 rounded-lg p-3 shadow-md border border-gray-700 hover:border-[#FFD700]/30 transition-colors duration-300" variants={interactiveItemVariants} whileHover="hover">
                                    <CalendarIcon className="w-6 h-6 text-[#FFD700]" />
                                    <div>
                                        <div className="text-gray-400 font-semibold text-sm">{t.month}</div>
                                        <div className="text-white font-bold text-xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>{formattedMonthYear}</div>
                                    </div>
                                </motion.div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                <InfoCard Icon={UsersIcon} label={t.guardCount} value={selectedCompany.guard_count} color="text-blue-400" actionButton={infoButton} />
                                <InfoCard Icon={ExclamationTriangleIcon} label={t.violationsCount} subLabel={language === 'ar' ? `لشهر ${monthName}` : `for ${monthName}`} value={selectedCompany.violations_count} color="text-red-400" actionButton={infoButton} />
                                <InfoCard Icon={BriefcaseIcon} label={t.contractNo} value={selectedCompany.contract_no} color="text-green-400" disableFormatting={true} />
                            </div>
                        </motion.div>
                    </AnimatePresence>
                    <motion.div variants={staggeredItemVariants} className="space-y-6 pt-4 border-t border-gray-700">
                        {questions.map((q: QuestionState, index: number) => (
                            // [تعديل]: تم فصل التحكم باللون عن التحكم بالاهتزاز
                            <motion.div key={q.id} ref={el => questionsRefs.current[index] = el} className={`p-4 bg-gray-900/50 rounded-lg shadow-md border ${q.invalid ? "border-red-500" : "border-gray-700"}`} variants={{ ...interactiveItemVariants, ...shakeVariants }} whileHover="hover" animate={q.shake ? "animate" : "initial"}>
                                <p className="mb-3 font-semibold text-gray-200">{q.text}</p>
                                <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`flex flex-col md:flex-row gap-4 w-full`}>
                                    <div className="flex items-center">
                                        <StarRating rating={q.ratingValue} onChange={(val) => onQuestionChange(index, 'ratingValue', val)} language={language} />
                                    </div>
                                    <div className="flex-1">
                                        <textarea placeholder={language === "ar" ? "ملاحظات (اختياري)..." : "Notes (optional)..."} value={q.note} onChange={(e) => onQuestionChange(index, 'note', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 resize-y" rows={1} />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                    <motion.div variants={staggeredItemVariants}>
                        <label className="block mb-1 font-semibold text-gray-300">{t.summary}</label>
                        <textarea value={summary} onChange={(e) => onSummaryChange(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md border border-gray-600" rows={4} placeholder={language === "ar" ? "أضف ملخصًا أو ملاحظات عامة (اختياري)..." : "Add a summary or general notes (optional)..."} />
                    </motion.div>
                    
                    <motion.div variants={staggeredItemVariants}>
                        <div className="bg-gray-900/50 border border-yellow-400/50 rounded-lg p-6 mt-4">
                            <h2 className="text-xl font-bold text-[#FFD700] mb-4 text-center">{language === "ar" ? "النتيجة الإجمالية" : "Overall Score"}</h2>
                            <div className="flex flex-col items-center">
                                <FinalStarRating rating={overallScore} language={language} />
                                <span className="text-lg text-gray-300">{getRatingDescription(overallScore, language)}</span>
                                
                                <div className="relative mt-4 flex flex-col items-center">
                                    <motion.button
                                        onClick={() => onSubmit(selectedCompany)}
                                        className="bg-[#FFD700] text-black px-8 py-3 rounded-lg font-bold disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                        disabled={isSubmitting || !canPerformSaveAction || !userHasSignature}
                                        variants={interactiveItemVariants}
                                        whileHover="hover"
                                        whileTap="tap"
                                    >
                                        {isSubmitting ? (language === "ar" ? "جاري الحفظ..." : "Saving...") : t.save}
                                    </motion.button>
                                    
                                    <AnimatePresence>
                                        {!canPerformSaveAction && (
                                            <motion.div
                                                variants={fadeInVariants}
                                                initial="initial"
                                                animate="animate"
                                                exit="exit"
                                                className="mt-3 flex items-center gap-2 text-sm text-red-400"
                                            >
                                                <LockClosedIcon className="w-4 h-4" />
                                                <span>{translations[language].permissionNeededForAction}</span>
                                            </motion.div>
                                        )}
                                        {!userHasSignature && (
                                            <motion.div
                                                variants={fadeInVariants} initial="initial" animate="animate" exit="exit"
                                                className="mt-3 flex items-center gap-2 text-sm text-red-400"
                                            >
                                                <LockClosedIcon className="w-4 h-4" />
                                                <span>{t.noSignatureMessage}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            ) : (
                <motion.div variants={fadeInVariants} className="text-center py-10">
                    <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-yellow-400" />
                    <p className="mt-4 text-lg font-semibold text-yellow-300">{t.noEvaluations}</p>
                </motion.div>
            )}
        </motion.div>
    );
}

// --- المكون الرئيسي للصفحة ---
export default function NewEvaluation() {
    const { language } = useLanguage();
    const { user, hasPermission, isLoading: isAuthLoading } = useAuth();
    const { showDialog } = useDialog();
    const { setPageLoading } = usePageLoading();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const navigate = useNavigate();
    const { isDirty, setIsDirty } = useUnsavedChanges();

    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [questions, setQuestions] = useState<QuestionState[]>([]);
    const [summary, setSummary] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const questionsRefs = useRef<(HTMLDivElement | null)[]>([]);

    const [targetMonth, setTargetMonth] = useState<number | null>(null);
    const [targetYear, setTargetYear] = useState<number | null>(null);
    const [isReady, setIsReady] = useState(false);

    const canPerformSaveAction = hasPermission('sss:1');
    const userHasSignature = !!user?.signature_url;

    const translations = useMemo(() => ({
        ar: {
            pageTitle: "تقييم جديد",
            noSignatureTitle: "التوقيع مطلوب",
            noSignatureMessage: "يجب عليك رفع توقيعك في ملفك الشخصي أولاً قبل إنشاء تقييم جديد.",
            confirmSaveTitle: "تأكيد الحفظ",
            confirmSaveMessage: "هل أنت متأكد من حفظ هذا التقييم وإرساله للاعتماد؟",
            validationErrorTitle: "بيانات غير مكتملة",
            validationErrorMessage: "يرجى تقييم كل الأسئلة قبل المتابعة.",
            successTitle: "نجاح",
            successMessage: "تم حفظ التقييم بنجاح.",
            errorTitle: "خطأ",
            genericErrorMessage: "حدث خطأ أثناء حفظ التقييم.",
            savingMessage: "جاري حفظ التقييم وإنشاء المهمة",
            companyEvaluatedTitle: "تم التقييم بالفعل",
            companyEvaluatedMessage: "لقد تم تقييم هذه الشركة من قبل مستخدم آخر، سيتم تحديث القائمة.",
            permissionNeededForAction: "لا تملك صلاحية حفظ وإرسال التقييم.",
            permissionDeniedOnSubmitTitle: "تم رفض الإجراء",
            permissionDeniedOnSubmitMessage: "لقد تغيرت صلاحياتك ولم يعد بإمكانك تنفيذ هذا الإجراء. سيتم تحديث الصفحة.",
            common: {
                company: "الشركة",
                month: "الشهر",
                guardCount: "عدد الحراس",
                violationsCount: "عدد المخالفات",
                contractNo: "رقم العقد",
                summary: "الملخص العام",
                save: "حفظ وإرسال للاعتماد",
                noEvaluations: "تم تقييم جميع الشركات للشهر السابق."
            }
        },
        en: {
            pageTitle: "New Evaluation",
            noSignatureTitle: "Signature Required",
            noSignatureMessage: "You must upload your signature in your profile before creating a new evaluation.",
            confirmSaveTitle: "Confirm Save",
            confirmSaveMessage: "Are you sure you want to save this evaluation and submit it for approval?",
            validationErrorTitle: "Incomplete Data",
            validationErrorMessage: "Please rate all questions before proceeding.",
            successTitle: "Success",
            successMessage: "Evaluation saved successfully.",
            errorTitle: "Error",
            genericErrorMessage: "An error occurred while saving the evaluation.",
            savingMessage: "Saving evaluation and creating task",
            companyEvaluatedTitle: "Already Evaluated",
            companyEvaluatedMessage: "This company has been evaluated by another user. The list will be updated.",
            permissionNeededForAction: "You do not have permission to save and submit the evaluation.",
            permissionDeniedOnSubmitTitle: "Action Denied",
            permissionDeniedOnSubmitMessage: "Your permissions have changed, and you can no longer perform this action. The page will be updated.",
            common: {
                company: "Company",
                month: "Month",
                guardCount: "Guards Count",
                violationsCount: "Violations Count",
                contractNo: "Contract No.",
                summary: "General Summary",
                save: "Save & Submit for Approval",
                noEvaluations: "All companies have been evaluated for the previous month."
            }
        }
    }), [language]);
    
    const t = translations[language];
    
    // [تعديل]: إضافة شرط where لجلب الشركات التي نوعها 'security' فقط.
    const [allCompanies, companiesLoading] = useCollectionData<Company>(
        useMemo(() => query(
            collection(db, "companies").withConverter(companyConverter),
            where('type', '==', 'security') // 👈 هذا هو السطر الجديد الذي تمت إضافته
        ), [])
    );
    const [allQuestions, questionsLoading] = useCollectionData<QuestionDoc>(collection(db, "security_questions").withConverter(questionConverter));
    const [allEvaluations, evaluationsLoading] = useCollectionData<Evaluation>(useMemo(() => query(collection(db, "security_evaluations").withConverter(evaluationConverter), orderBy("created_at", "desc")), []));

    const latestEvaluationsMap = useMemo(() => {
        if (!allEvaluations) return new Map<string, Evaluation>();
        const map = new Map<string, Evaluation>();
        allEvaluations.forEach(evalDoc => {
            if (!map.has(evalDoc.company_id)) map.set(evalDoc.company_id, evalDoc);
        });
        return map;
    }, [allEvaluations]);

const companiesForEval = useMemo(() => {
        // نعتمد الآن على القائمة الكاملة للتقييمات
        if (!allCompanies || !allEvaluations) return [];

        // تحديد الشهر والسنة المستهدفة للتقييم (الشهر الماضي)
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() - 1);
        const targetMonth = targetDate.getMonth() + 1;
        const targetYear = targetDate.getFullYear();

        return allCompanies.filter(company => {
            // الخطوة 1: البحث عن كل تقييمات هذه الشركة في الفترة المستهدفة فقط
            const evalsForTargetPeriod = allEvaluations.filter(ev => 
                ev.company_id === company.id &&
                ev.evaluation_year === targetYear &&
                ev.evaluation_month === targetMonth
            );

            // الخطوة 2: إذا لم توجد أي تقييمات لهذه الفترة، يجب تقييم الشركة
            if (evalsForTargetPeriod.length === 0) {
                return true; // إظهار
            }

            // الخطوة 3: إذا وجدت تقييمات، تحقق هل يوجد بينها تقييم "غير مرفوض"
            // "some" تبحث عن وجود عنصر واحد على الأقل يحقق الشرط
            const hasNonRejectedEval = evalsForTargetPeriod.some(
                ev => ev.status !== 'Rejected'
            );

            // إذا وجد تقييم قيد الاعتماد أو معتمد، فهذا يعني أن التقييم قد تم.
            if (hasNonRejectedEval) {
                return false; // إخفاء
            }

            // إذا وصلنا إلى هنا، فهذا يعني أن كل التقييمات الموجودة هي "مرفوضة".
            // لذا، يجب إعادة تقييم الشركة.
            return true; // إظهار
        });
    }, [allCompanies, allEvaluations]); // <-- تم تغيير الاعتمادية هنا إلى allEvaluations

    const initialQuestionsState = useMemo(() => {
        if (!allQuestions) return [];
        return allQuestions.map(q => ({
            id: q.id,
            text: q.question_text_ar,
            ratingValue: 0,
            note: ""
        }));
    }, [allQuestions]);

    const resetQuestionsAndSummary = useCallback(() => {
        setSummary("");
        setQuestions(initialQuestionsState);
        setIsDirty(false); // <-- إعادة تعيين الحالة عند تغيير الشركة أو الحفظ
    }, [initialQuestionsState, setIsDirty]);

    useEffect(() => {
        // التحقق مما إذا كان هناك أي تقييم (نجمة) تم اختياره
        const hasRatings = questions.some(q => q.ratingValue > 0);
        // التحقق مما إذا كان هناك أي ملاحظة غير فارغة (بعد تنظيفها)
        const hasNotes = questions.some(q => cleanText(q.note).length > 0);
        // التحقق مما إذا كان الملخص غير فارغ (بعد تنظيفه)
        const hasSummary = cleanText(summary).length > 0;

        const dirty = hasRatings || hasNotes || hasSummary;
        setIsDirty(dirty);

        // عند مغادرة المكون، تأكد من إعادة الحالة إلى false
        return () => {
            setIsDirty(false);
        };
    }, [questions, summary, setIsDirty]);

// ... الكود المسؤول عن حساب وتعيين isDirty يبقى كما هو

// هذا الـ hook يتعامل مع تحديث الصفحة وإغلاق التبويب
useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        if (isDirty) {
            event.preventDefault();
            event.returnValue = ''; // مطلوب لبعض المتصفحات
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
}, [isDirty]); // الاعتمادية تضمن أن الدالة لديها دائمًا أحدث بيانات

    const handleCompanyChange = useCallback((company: Company | null) => {
        if (!company) {
            setSelectedCompany(null);
            return;
        };

        // الخطوة 1: ابحث عن أحدث تقييم لهذه الشركة حالته "ليست مرفوضة"
        // allEvaluations مرتبة مسبقًا تنازليًا حسب التاريخ، لذا أول نتيجة هي الأحدث
        const latestNonRejectedEval = allEvaluations?.find(ev =>
            ev.company_id === company.id && ev.status !== 'Rejected'
        );
        
        const targetDate = new Date();

        // الخطوة 2: تحديد الشهر بناءً على النتيجة
        if (latestNonRejectedEval) {
            // إذا وجدنا تقييمًا صالحًا، نستخدم تاريخه
            // إصلاح: الأشهر في setFullYear تبدأ من 0، وبياناتك تبدأ من 1، لذا نطرح 1
            targetDate.setFullYear(latestNonRejectedEval.evaluation_year, latestNonRejectedEval.evaluation_month - 1, 1);
        } else {
            // إذا كانت كل التقييمات مرفوضة أو لا يوجد، نستخدم الشهر الماضي كافتراضي
            targetDate.setMonth(targetDate.getMonth() - 1);
        }
        
        // getMonth() تعيد قيمة من 0-11، لذا نضيف 1 لتتوافق مع بياناتك (1-12)
        setTargetMonth(targetDate.getMonth() + 1);
        setTargetYear(targetDate.getFullYear());
        setSelectedCompany(company);

    }, [allEvaluations]); // <-- تأكد من تغيير الاعتمادية هنا إلى allEvaluations

    // ✅ الكود الجديد الذي يجهز كل شيء قبل عرض الصفحة ✅
    useEffect(() => {
        // لا تفعل شيئًا إذا كانت البيانات لا تزال قيد التحميل، أو إذا كانت الصفحة جاهزة بالفعل
        if (isAuthLoading || companiesLoading || questionsLoading || evaluationsLoading || isReady) {
            return;
        }

        // الآن لدينا كل البيانات، لنقم بتجهيز الحالة الأولية
        if (allQuestions) {
            setQuestions(initialQuestionsState);
        }

        if (companiesForEval.length > 0) {
            // اختر الشركة الأولى وجهز بياناتها
            handleCompanyChange(companiesForEval[0]);
        }

        // الآن كل شيء جاهز للعرض، أخبر النظام بذلك
        setIsReady(true);

    }, [
        isAuthLoading, companiesLoading, questionsLoading, evaluationsLoading, isReady,
        allQuestions, companiesForEval, initialQuestionsState, handleCompanyChange
    ]);
    
    useEffect(() => {
        if (questions.length > 0 && allQuestions) {
            setQuestions(currentQuestions => {
                return currentQuestions.map(q => {
                    const originalQuestion = allQuestions.find(aq => aq.id === q.id);
                    if (originalQuestion) {
                        return {
                            ...q,
                            text: language === "ar" ? originalQuestion.question_text_ar : originalQuestion.question_text_en,
                        };
                    }
                    return q;
                });
            });
        }
    }, [language, allQuestions]);
    
    useEffect(() => {
        if (!companiesLoading && !evaluationsLoading && selectedCompany && !isSubmitting) {
            const isCompanyStillAvailable = companiesForEval.some(c => c.id === selectedCompany.id);

            if (!isCompanyStillAvailable) {
                showDialog({
                    variant: 'alert',
                    title: translations[language].companyEvaluatedTitle,
                    message: translations[language].companyEvaluatedMessage,
                    onConfirm: () => {
                        if (companiesForEval.length > 0) {
                            handleCompanyChange(companiesForEval[0]);
                            resetQuestionsAndSummary();
                        } else {
                            setSelectedCompany(null);
                        }
                    }
                });
            }
        }
    }, [companiesForEval, selectedCompany, companiesLoading, evaluationsLoading, handleCompanyChange, showDialog, language, translations, resetQuestionsAndSummary, isSubmitting]);

    const handleQuestionChange = (index: number, field: 'ratingValue' | 'note', value: any) => {
        // [تعديل]: عند تغيير المستخدم للتقييم، يتم إعادة تعيين حالتي اللون والاهتزاز
        setQuestions(qs => qs.map((item, i) => (i === index ? { ...item, [field]: value, invalid: false, shake: false } : item)));
    };

    // ==================================================================
    // START: [التعديل هنا] - The modification is here
    // ==================================================================
    const handleSubmit = async (companyToSave: Company) => {
        // ✅ التحقق من وجود التوقيع أولاً
        if (!user?.signature_url) {
            showDialog({
                variant: 'alert',
                title: t.noSignatureTitle,
                message: t.noSignatureMessage,
            });
            return; // إيقاف التنفيذ فوراً
        }
        if (!hasPermission('sss:1')) {
            showDialog({
                variant: 'alert',
                title: t.permissionDeniedOnSubmitTitle,
                message: t.permissionDeniedOnSubmitMessage,
            });
            return;
        }

        if (!companyToSave || !user || targetYear === null || targetMonth === null) return;
        
        const latestEval = latestEvaluationsMap.get(companyToSave.id);
        const previousDate = new Date();
        previousDate.setMonth(previousDate.getMonth() - 1);
        const previousMonth = previousDate.getMonth() + 1;
        const previousYear = previousDate.getFullYear();

        // [السطر المعدل]: تم إضافة الشرط `latestEval.status !== 'Rejected'`
        // This line was modified to add the `latestEval.status !== 'Rejected'` check
        if (latestEval && latestEval.evaluation_year === previousYear && latestEval.evaluation_month === previousMonth && latestEval.status !== 'Rejected') {
            showDialog({
                variant: 'alert',
                title: translations[language].companyEvaluatedTitle,
                message: translations[language].companyEvaluatedMessage,
                onConfirm: () => {
                    if (companiesForEval.length > 0) {
                        handleCompanyChange(companiesForEval[0]);
                        resetQuestionsAndSummary();
                    } else {
                        setSelectedCompany(null);
                    }
                }
            });
            return;
        }

        // [تعديل جذري]: تم إعادة كتابة هذا الجزء بالكامل لتطبيق التسلسل الحركي المطلوب
        const invalidIndexes = questions.reduce<number[]>((acc, q, index) => {
            if (q.ratingValue === 0) {
                acc.push(index);
            }
            return acc;
        }, []);

        if (invalidIndexes.length > 0) {
            setQuestions(qs => qs.map(q => ({ ...q, invalid: false, shake: false })));
            setTimeout(() => {
                const firstInvalidIndex = invalidIndexes[0];
                const firstInvalidQuestionRef = questionsRefs.current[firstInvalidIndex];
                if (firstInvalidQuestionRef) {
                    firstInvalidQuestionRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                setTimeout(() => {
                    setQuestions(qs => qs.map((q, index) => ({ ...q, invalid: invalidIndexes.includes(index) })));
                    setTimeout(() => {
                        setQuestions(qs => qs.map((q, index) => ({ ...q, shake: invalidIndexes.includes(index) })));
                    }, 300);
                }, 400);
            }, 50);
            return;
        }

        // عرض نافذة التأكيد للمستخدم
        const performSubmit = async () => {
            setIsSubmitting(true);
            setIsDirty(false);
            showActionLoading(t.savingMessage);
            try {
                const clientContext = await getClientContext();
                
                const overallScore = parseFloat((questions.reduce((sum, q) => sum + q.ratingValue, 0) / questions.length).toFixed(2));

                if (!allQuestions) throw new Error("Question data not loaded.");

                const evaluationDetails = questions.map(q => ({
                    question_id: q.id,
                    rating: q.ratingValue,
                    note: cleanText(q.note),
                    question_text_ar: allQuestions.find(aq => aq.id === q.id)?.question_text_ar || '',
                    question_text_en: allQuestions.find(aq => aq.id === q.id)?.question_text_en || ''
                }));
                
                const evaluationData = {
                    company_id: companyToSave.id,
                    evaluation_year: targetYear,
                    evaluation_month: targetMonth,
                    historical_contract_no: companyToSave.contract_no,
                    historical_guard_count: companyToSave.guard_count,
                    historical_violations_count: companyToSave.violations_count,
                    summary: cleanText(summary),
                    overall_score: overallScore,
                    details: evaluationDetails,
                };

                const createEval = httpsCallable(functions, 'createEvaluationAndTask');
                
                await createEval({
                    evaluationData,
                    clientContext 
                });
                
                const nextCompaniesList = companiesForEval.filter(c => c.id !== companyToSave.id);
                if (nextCompaniesList.length > 0) {
                    handleCompanyChange(nextCompaniesList[0]);
                } else {
                    handleCompanyChange(null);
                }
                resetQuestionsAndSummary();

                showDialog({
                    variant: 'success', title: t.successTitle, message: t.successMessage,
                    onConfirm: () => { 
                        navigate('/tasks'); 
                    }
                });

            } catch (error: any) {
                showDialog({ variant: 'alert', title: t.errorTitle, message: error.message || t.genericErrorMessage });
            } finally {
                hideActionLoading();
                setIsSubmitting(false);
            }
        };

        // ثانياً: قم بتعديل استدعاء showDialog ليصبح بسيطاً هكذا
        showDialog({
            variant: 'confirm',
            title: t.confirmSaveTitle,
            message: t.confirmSaveMessage,
            onConfirm: () => { performSubmit(); } // ✅ التعديل هنا
        });
    };
    // ==================================================================
    // END: [التعديل هنا] - End of modification
    // ==================================================================

    const dataIsLoading = isAuthLoading || companiesLoading || questionsLoading || evaluationsLoading;
    
    useEffect(() => {
        // اعرض شاشة التحميل طالما أن الصفحة ليست جاهزة
        setPageLoading(!isReady);
    }, [isReady, setPageLoading]);
    
    const allCompaniesEvaluated = !dataIsLoading && companiesForEval.length === 0;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={language}
                custom={language}
                variants={directionalSlideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
            >
                {allCompaniesEvaluated ? (
                    <div className="flex-grow bg-gray-800/50 rounded-xl shadow-2xl p-6 border border-gray-700">
                        <div className="text-center py-10">
                            <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-yellow-400" />
                            <p className="mt-4 text-lg font-semibold text-yellow-300">{t.common.noEvaluations}</p>
                        </div>
                    </div>
                ) : (
                    <NewEvaluationContent
                        companiesForEval={companiesForEval}
                        selectedCompany={selectedCompany}
                        onCompanyChange={handleCompanyChange}
                        questions={questions}
                        onQuestionChange={handleQuestionChange}
                        summary={summary}
                        onSummaryChange={setSummary}
                        onSubmit={handleSubmit}
                        isSubmitting={isSubmitting}
                        targetYear={targetYear}
                        targetMonth={targetMonth}
                        translations={translations}
                        questionsRefs={questionsRefs}
                        showDialog={showDialog}
                        userHasSignature={userHasSignature}
                        canPerformSaveAction={canPerformSaveAction}
                    />
                )}
            </motion.div>
        </AnimatePresence>
    );
}