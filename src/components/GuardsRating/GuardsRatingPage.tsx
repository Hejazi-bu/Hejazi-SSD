  import React, { useEffect, useState, useRef, useCallback } from "react";
  import { supabase } from "../../lib/supabaseClient";
  import { cleanText } from "../../utils/textUtils";
  import { FaRegFileAlt, FaHistory, FaChartBar } from "react-icons/fa";
  import { CalendarIcon, UsersIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
  import { motion, AnimatePresence, Variants, useAnimation } from "framer-motion";
  import { useUser, User } from "../contexts/UserContext";
  import { useData } from "../contexts/DataContext";
  import { useNavigate } from "react-router-dom";
  import {
    Menu,
    Globe,
    HomeIcon,
  } from "lucide-react";
  
  type GuardsRatingPageProps = {
    language: "ar" | "en";
    onLanguageChange: (lang: "ar" | "en") => void;
    onNavigateTo: (page: string) => void;
    currentServiceId: string;
  };

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

  type HeaderProps = GuardsRatingPageProps & { currentServiceId: string };
  
  function StarRating({
    rating,
    onChange,
    language,
  }: {
    rating: number;
    onChange: (rating: number) => void;
    language: "ar" | "en";
  }) {
    const tooltips = {
      ar: ["", "تحتاج إلى تحسين", "مقبول", "جيد", "جيد جدا", "ممتاز"],
      en: ["", "Need improvement", "Acceptable", "Good", "Very Good", "Excellent"],
    };

    return (
      <div className="flex items-center gap-1 relative select-none">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= rating;
          return (
            <div
              key={star}
              className="relative cursor-pointer"
              onClick={() => onChange(star)}
              title={tooltips[language][star]}
            >
              <svg
                className={`w-6 h-6 ${isFilled ? "text-yellow-400" : "text-gray-300"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.388 2.46a1 1 0 00-.364 1.118l1.287 3.966c.3.92-.755 1.688-1.54 1.118l-3.388-2.46a1 1 0 00-1.176 0l-3.388 2.46c-.784.57-1.838-.197-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.045 9.393c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95-.69l1.286-3.966z" />
              </svg>
            </div>
          );
        })}
      </div>
    );
  }
  
  function FinalStarRating({ rating }: { rating: number }) {
    return (
      <div className="flex items-center gap-2 justify-center mb-4 select-none">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= Math.round(rating);
          return (
            <svg
              key={star}
              className={`w-8 h-8 ${isFilled ? "text-yellow-400" : "text-gray-300"}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.388 2.46a1 1 0 00-.364 1.118l1.287 3.966c.3.92-.755 1.688-1.54 1.118l-3.388-2.46a1 1 0 00-1.176 0l-3.388 2.46c-.784.57-1.838-.197-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.045 9.393c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95-.69l1.286-3.966z" />
            </svg>
          );
        })}
        <span className="text-xl font-semibold">{(rating * 20).toFixed(0)}%</span>
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

  export default function GuardsRatingPage({
    language,
    onLanguageChange,
    onNavigateTo,
  }: GuardsRatingPageProps) {
    const { data } = useData();
    const navigate = useNavigate();
    const [checkingData, setCheckingData] = useState(true);
    const [alreadyNavigated, setAlreadyNavigated] = useState(false); // لمنع إعادة التوجيه

    useEffect(() => {
      if (alreadyNavigated) return; // ✅ إذا تم التوجيه سابقًا، لا نفعل أي شيء

      const requiredTables = [
        "users",
        "companies",
        "security_questions",
        "security_evaluations",
        "security_evaluation_details",
        "violations",
        "violation_types",
        "violation_sends",
      ];

      const missing = requiredTables.some((table) => {
        const value = data[table];
        // بعض الجداول عبارة عن أرقام (companyGuardCount, companyViolationsCount)
        if (typeof value === "number") return value === 0;
        return !value || value.length === 0;
      });

      if (missing) {
        const tablesQuery = requiredTables.join(",");
        setAlreadyNavigated(true); // ✅ منع إعادة التوجيه
        navigate(`/data-loader?tables=${tablesQuery}&target=/dashboard`);
      } else {
        setCheckingData(false); // ✅ البيانات سليمة
      }
    }, [data, navigate, alreadyNavigated]);

    // ✅ شاشة انتظار أثناء التحقق من البيانات
    if (checkingData) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-gray-500">
            {language === "ar" ? "جارٍ التحقق من البيانات..." : "Checking data..."}
          </span>
        </div>
      );
    }

    const isRTL = language === "ar";
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLUListElement>(null);
    const [currentServiceId, setCurrentServiceId] = useState<string>("new-evaluation");

    const handleNavigate = (pageId: string) => {
      if (
        pageId === "new-evaluation" ||
        pageId === "evaluation-records" ||
        pageId === "evaluation-reports"
      ) {
        setCurrentServiceId(pageId);
      } else {
        onNavigateTo(pageId);
      }
    };

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
          setUserMenuOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    const containerVariants: Variants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: 0.15 },
      },
    };

    const getItemVariants = (isRTL: boolean): Variants => ({
      hidden: { opacity: 0, x: isRTL ? 50 : -50 },
      visible: {
        opacity: 1,
        x: 0,
        transition: { type: "spring" as const, stiffness: 500, damping: 30 },
      },
      exit: {
        opacity: 0,
        x: isRTL ? -50 : 50,
        transition: { duration: 0.3 },
      },
    });

    const labels = {
      ar: {
        title: "تقييم جديد",
        month: "الشهر",
        company: "اسم المشغل (الشركة)",
        guardCount: "عدد الحراس",
        violationsCount: "عدد المخالفات",
        questions: "أسئلة التقييم",
        notes: "ملاحظات عامة",
        save: "حفظ التقييم",
      },
      en: {
        title: "New evaluation",
        month: "Month",
        company: "Operator (Company)",
        guardCount: "Number of Guards",
        violationsCount: "Number of Violations",
        questions: "Evaluation Questions",
        notes: "General Notes",
        save: "Save Evaluation",
      },
    };

    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string>("");

    const [monthsOptions, setMonthsOptions] = useState<MonthOption[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>("");

    const [questions, setQuestions] = useState<Question[]>([]);
    const [questionsInitialized, setQuestionsInitialized] = useState(false);

    const [notes, setNotes] = useState("");
    const [guardCount, setGuardCount] = useState(220);
    const [violationsCount, setViolationsCount] = useState<number>(0);

    const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false);
    const [evaluationDone, setEvaluationDone] = useState(false);

    const [companyGuardCount, setCompanyGuardCount] = useState<number>(0);
    const [companyViolationsCount, setCompanyViolationsCount] = useState<number>(0);
    const [companyContractNo, setCompanyContractNo] = useState<string>("");

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

      // جلب بيانات الشركة: عدد الحراس، عدد المخالفات، رقم العقد
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("guard_count, violations_count, contract_no")
        .eq("id", id)
        .single();

      if (!companyError && companyData) {
        setCompanyGuardCount(companyData.guard_count || 0);
        setCompanyViolationsCount(companyData.violations_count || 0);
        setCompanyContractNo(companyData.contract_no || "");
        setGuardCount(companyData.guard_count || 0);
        setViolationsCount(companyData.violations_count || 0);
      } else {
        setCompanyGuardCount(0);
        setCompanyViolationsCount(0);
        setCompanyContractNo("");
        setGuardCount(0);
        setViolationsCount(0);
      }

      // جلب آخر تقييم لتحديد الشهر القادم كما في كودك الأصلي
      const { data: lastEvalData, error } = await supabase
        .from("security_evaluations")
        .select("year, month")
        .eq("operator_id", id)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(1)
        .single();

      if (error || !lastEvalData) {
        const prevMonth = getPreviousMonth(getCurrentMonth());
        setSelectedMonth(prevMonth);
        setMonthsOptions([
          {
            value: prevMonth,
            label: new Date(prevMonth + "-01").toLocaleString(
              language === "ar" ? "ar-EG-u-nu-latn" : "en-US",
              { month: "long", year: "numeric" }
            ),
          },
        ]);
        setEvaluationDone(false);
        return;
      }

      const lastMonthStr = `${lastEvalData.year}-${lastEvalData.month.toString().padStart(2, "0")}`;
      const nextMonth = getNextMonth(lastMonthStr);
      setSelectedMonth(nextMonth);
      setMonthsOptions([
        {
          value: nextMonth,
          label: new Date(nextMonth + "-01").toLocaleString(
            language === "ar" ? "ar-EG-u-nu-latn" : "en-US",
            { month: "long", year: "numeric" }
          ),
        },
      ]);
      setEvaluationDone(false);
    }

    useEffect(() => {
      async function fetchCompanies() {
        setIsLoadingEvaluation(true);

        const currentMonth = getCurrentMonth();
        const previousMonth = getPreviousMonth(currentMonth);

        const { data: allCompanies, error: companiesError } = await supabase
          .from("companies")
          .select("id, name_ar, name_en");

        if (companiesError) {
          console.error("Error loading companies:", companiesError);
          setIsLoadingEvaluation(false);
          return;
        }

        const [prevYearStr, prevMonthStr] = previousMonth.split("-");
        const prevYear = Number(prevYearStr);
        const prevMonth = Number(prevMonthStr);

        const { data: evaluatedOperators, error: evalError } = await supabase
          .from("security_evaluations")
          .select("operator_id")
          .eq("year", prevYear)
          .eq("month", prevMonth);

        if (evalError) {
          console.error("Error loading previous evaluations:", evalError);
          setIsLoadingEvaluation(false);
          return;
        }

        const evaluatedSet = new Set(evaluatedOperators?.map((item) => item.operator_id));
        const validCompanies = (allCompanies || []).filter(
          (company) => !evaluatedSet.has(company.id)
        );

        setCompanies(validCompanies);

        if (validCompanies.length > 0) {
          await handleCompanySelection(validCompanies[0].id);
        } else {
          setSelectedCompany("");
          setSelectedMonth("");
          setMonthsOptions([]);
          setEvaluationDone(false);
        }

        setIsLoadingEvaluation(false);
      }

      fetchCompanies();
    }, []);

    useEffect(() => {
      if (!selectedMonth || questionsInitialized) return;

      async function fetchQuestions() {
        const { data, error } = await supabase
          .from("security_questions")
          .select("id, question_text_ar, question_text_en");

        if (error) {
          console.error("Error loading questions:", error);
          return;
        }

        const initialQuestions = data.map((q) => ({
          id: q.id,
          text: language === "ar" ? q.question_text_ar : q.question_text_en,
          textAr: q.question_text_ar,
          textEn: q.question_text_en,
          ratingValue: 0,
          note: "",
        }));

        setQuestions(initialQuestions);
        setQuestionsInitialized(true);
      }

      fetchQuestions();
    }, [selectedMonth, language, questionsInitialized]);

    useEffect(() => {
      if (questions.length === 0) return;

      setQuestions((prev) =>
        prev.map((q) => ({
          ...q,
          text: language === "ar" ? q.textAr : q.textEn,
        }))
      );

      setMonthsOptions((prev) =>
        prev.map((m) => ({
          value: m.value,
          label: new Date(m.value + "-01").toLocaleString(
            language === "ar" ? "ar-EG-u-nu-latn" : "en-US",
            { month: "long", year: "numeric" }
          ),
        }))
      );
    }, [language]);

  const overallScore =
    questions.length > 0
      ? parseFloat(
          (questions.reduce((sum, q) => sum + q.ratingValue, 0) / questions.length).toFixed(2)
        )
      : 0;

      const { user, setUser } = useUser();

      const handleSubmit = async () => {
        if (!selectedCompany || !selectedMonth || questions.length === 0) return;

        if (!user) {
          alert(language === "ar" ? "يجب تسجيل الدخول أولاً" : "You must log in first.");
          return;
        }

        // تحقق من وجود أسئلة غير مقيمة
        const unratedIndex = questions.findIndex((q) => q.ratingValue === 0);
        if (unratedIndex !== -1) {
          setQuestions((prev) =>
            prev.map((q) => ({
              ...q,
              invalid: q.ratingValue === 0,
            }))
          );

          const element = document.getElementById(`question-${questions[unratedIndex].id}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          alert(language === "ar" ? "يرجى تقييم جميع الأسئلة قبل الحفظ." : "Please rate all questions before saving.");
          return;
        }

        const [yearStr, monthStr] = selectedMonth.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);

        const totalRating = questions.reduce((sum, q) => sum + q.ratingValue, 0);
        const overallScore = parseFloat((totalRating / questions.length).toFixed(2));

        setIsLoadingEvaluation(true);

        const cleanedGeneralNotes = cleanText(notes);
        const cleanedQuestions = questions.map(q => ({
          ...q,
          note: q.note ? cleanText(q.note) : null,
        }));

        try {
          // حفظ التقييم العام
          const { data: insertEvalData, error: insertEvalError } = await supabase
            .from("security_evaluations")
            .insert({
              operator_id: selectedCompany,
              guard_count: companyGuardCount,
              violations_count: companyViolationsCount,
              contract_no: companyContractNo,
              notes: cleanedGeneralNotes,
              overall_score: overallScore,
              year,
              month,
              evaluation_date: new Date().toISOString(),
              evaluator_name: user.id,    // استخدام user.id
              evaluator_job: user.job_id, // استخدام job_id
              client_name: "Abu Dhabi Municipality",
              location: "ADM",
            })
            .select("id")
            .single();

          if (insertEvalError || !insertEvalData) {
            alert(language === "ar" ? "فشل حفظ التقييم العام." : "Failed to save evaluation.");
            console.error(insertEvalError);
            setIsLoadingEvaluation(false);
            return;
          }

          const evaluation_id = insertEvalData.id;

          // حفظ تفاصيل التقييم
          const details = cleanedQuestions.map((q) => ({
            evaluation_id,
            question_id: q.id,
            selected_rating: q.ratingValue,
            note: q.note,
          }));

          const { error: detailsError } = await supabase
            .from("security_evaluation_details")
            .insert(details);

          if (detailsError) {
            alert(language === "ar" ? "تم الحفظ جزئياً. (الأسئلة لم تُحفظ)." : "Partially saved. (Details failed)");
            console.error(detailsError);
            setIsLoadingEvaluation(false);
            return;
          }

          // تحديث تقييم الشركة
          const { error: companyUpdateError } = await supabase.rpc('update_company_overall_score', {
            company_id: selectedCompany
          });

          if (companyUpdateError) {
            console.warn("فشل تحديث تقييم الشركة التراكمي:", companyUpdateError);
          }

          alert(language === "ar" ? "تم حفظ التقييم بنجاح." : "Evaluation saved successfully.");
          window.location.reload();

        } catch (error) {
          console.error(error);
          alert(language === "ar" ? "حدث خطأ غير متوقع." : "An unexpected error occurred.");
        } finally {
          setIsLoadingEvaluation(false);
        }
      };

    function Sidebar({
      isOpen,
      onClose,
      language,
      onNavigateTo,
      currentServiceId,
    }: {
      isOpen: boolean;
      onClose: () => void;
      language: "ar" | "en";
      onNavigateTo: (page: string) => void;
      currentServiceId: string;
    }) {
      const isRTL = language === "ar";
      const sidebarRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
          if (
            isOpen &&
            sidebarRef.current &&
            !sidebarRef.current.contains(event.target as Node)
          ) {
            onClose();
          }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
      }, [isOpen, onClose]);

      const services = [
        { id: "new-evaluation", labelAr: "تقييم جديد", labelEn: "New Evaluation", icon: <FaRegFileAlt className="w-5 h-5" /> },
        { id: "evaluation-records", labelAr: "سجل التقييمات", labelEn: "Evaluation Records", icon: <FaHistory className="w-5 h-5" /> },
        { id: "evaluation-reports", labelAr: "تقارير التقييمات", labelEn: "Evaluation Reports", icon: <FaChartBar className="w-5 h-5" /> },
      ];

      const handleClick = (id: string) => {
        onNavigateTo(id);
        onClose();
      };

      return (
        <>
          {/* الخلفية المعتمة مع ظهور وانخفاض سلس */}
          <div
            className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${
              isOpen ? "opacity-100 pointer-events-auto visible" : "opacity-0 pointer-events-none invisible"
            }`}
            onClick={onClose}
            aria-hidden="true"
          ></div>

          {/* الشريط الجانبي مع انزلاق سلس */}
          <aside
            ref={sidebarRef}
            className={`
              fixed top-0 bottom-0 z-50 w-64 bg-white shadow-lg
              transform transition-transform duration-300 ease-in-out
              ${isRTL ? "right-0" : "left-0"}
              ${isOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full"}
              flex flex-col
            `}
            role="menu"
            aria-label={language === "ar" ? "قائمة الخدمات" : "Services menu"}
          >
            <div className="p-4 border-b border-gray-300 flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {language === "ar" ? "قائمة الخدمات" : "Services"}
              </h2>
              <button
                onClick={onClose}
                aria-label={language === "ar" ? "إغلاق القائمة" : "Close menu"}
                className="text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col p-4 space-y-2 flex-grow">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleClick(service.id)}
                  className={`text-start p-2 rounded hover:bg-blue-100 focus:outline-none flex items-center gap-2 ${
                    service.id === currentServiceId
                      ? "bg-blue-200 font-bold text-blue-700"
                      : "text-gray-800"
                  }`}
                  role="menuitem"
                >
                  {service.icon}
                  <span>{language === "ar" ? service.labelAr : service.labelEn}</span>
                </button>
              ))}
            </nav>
          </aside>
        </>
      );
    }

    function Header({
      language,
      onLanguageChange,
      onNavigateTo,
      currentServiceId,
    }: HeaderProps) {
      const isRTL = language === "ar";
      const baseButtonClass =
        "flex items-center font-semibold text-gray-900 hover:text-blue-600 focus:outline-none";
      const [sidebarOpen, setSidebarOpen] = useState(false);

      // تحكم يدوي بالأنيميشن + حماية من الضغط المتكرر
      const controls = useAnimation();
      const [isLangAnimating, setIsLangAnimating] = useState(false);

      // تثبيت variants
      const containerVariants = React.useMemo<Variants>(
        () => ({
          hidden: {
            opacity: 0,
            transition: { duration: 0.18, when: "afterChildren" },
          },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.12, delayChildren: 0.02 },
          },
        }),
        []
      );

      const itemVariants = React.useMemo<Variants>(
        () => ({
          hidden: {
            opacity: 0,
            x: isRTL ? 50 : -50,
            transition: { duration: 0.18 },
          },
          visible: {
            opacity: 1,
            x: 0,
            transition: { type: "spring", stiffness: 500, damping: 30 },
          },
          exit: {
            opacity: 0,
            x: isRTL ? -50 : 50,
            transition: { duration: 0.2 },
          },
        }),
        [isRTL]
      );

      // إظهار بدون حركة عند أول تحميل
      useEffect(() => {
        controls.set("visible");
      }, [controls]);

      const navigateWithConfirm = useCallback(
        (page: string) => {
          const confirmMsg =
            language === "ar"
              ? "هل تريد الخروج من صفحة التقييم؟ أي تغييرات غير محفوظة قد تضيع."
              : "Do you want to leave the evaluation page? Any unsaved changes will be lost.";
          if (window.confirm(confirmMsg)) {
            if (page === currentServiceId) {
              window.location.reload();
            } else {
              onNavigateTo(page);
            }
            setSidebarOpen(false);
          }
        },
        [language, currentServiceId, onNavigateTo]
      );

      // تشغيل الأنيميشن فقط عند الضغط على زر اللغة: نطفي ثم نغير اللغة ثم نشغل
      const handleLanguageClick = async (lang: "ar" | "en") => {
        if (isLangAnimating) return;
        setIsLangAnimating(true);
        try {
          await controls.start("hidden");       // خروج
          onLanguageChange(lang);               // تغيير اللغة أثناء الإخفاء
          // نضمن frame جديد قبل الدخول
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          await controls.start("visible");      // دخول
        } finally {
          setIsLangAnimating(false);
        }
      };

      return (
        <header
          className={`fixed top-0 left-0 w-full bg-white shadow flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 z-50 ${
            isRTL ? "flex-row-reverse" : "flex-row"
          }`}
          style={{ gap: "1rem" }}
        >
          <motion.div
            className={`flex w-full justify-between items-center ${
              isRTL ? "flex-row-reverse" : "flex-row"
            }`}
            variants={containerVariants}
            initial={false}     // لا تشغل حركة تلقائياً على rerender
            animate={controls}  // تحكم يدوي فقط
          >
            {isRTL ? (
              <>
                <motion.button
                  variants={itemVariants}
                  onClick={() => navigateWithConfirm("dashboard")}
                  className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row-reverse lg:gap-2`}
                >
                  <HomeIcon className="w-6 h-6" />
                  <span>الرئيسية</span>
                </motion.button>

                <motion.div
                  variants={itemVariants}
                  className="text-lg font-bold text-gray-800 flex flex-col items-center"
                >
                  <span className="text-blue-600">تقييم جديد</span>
                </motion.div>

                <motion.div variants={itemVariants} className="flex items-center gap-2">
                  <button
                    className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row-reverse lg:gap-2`}
                    onClick={() => setSidebarOpen((open) => !open)}
                  >
                    <Menu className="w-7 h-7" />
                  </button>

                  <div className="h-6 border-l border-gray-300 mx-2"></div>

                  <button
                    onClick={() => handleLanguageClick("en")}
                    disabled={isLangAnimating}
                    className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row-reverse lg:gap-2 ${
                      isLangAnimating ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    title={isLangAnimating ? "جاري التبديل..." : "English"}
                  >
                    <Globe className="w-5 h-5" />
                    <span>English</span>
                  </button>
                </motion.div>
              </>
            ) : (
              <>
                <motion.div variants={itemVariants} className="flex items-center gap-2">
                  <button
                    className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row lg:gap-2`}
                    onClick={() => setSidebarOpen((open) => !open)}
                  >
                    <Menu className="w-7 h-7" />
                  </button>

                  <div className="h-6 border-l border-gray-300 mx-2"></div>

                  <button
                    onClick={() => handleLanguageClick("ar")}
                    disabled={isLangAnimating}
                    className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row lg:gap-2 ${
                      isLangAnimating ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    title={isLangAnimating ? "جاري التبديل..." : "العربية"}
                  >
                    <span>العربية</span>
                    <Globe className="w-5 h-5" />
                  </button>
                </motion.div>

                <motion.div
                  variants={itemVariants}
                  className="text-lg font-bold text-gray-800 flex flex-col items-center"
                >
                  <span className="text-blue-600">New Evaluation</span>
                </motion.div>

                <motion.button
                  variants={itemVariants}
                  onClick={() => onNavigateTo("dashboard")}
                  className={`${baseButtonClass} flex-col gap-1 items-center lg:flex-row lg:gap-2`}
                >
                  <span>Home</span>
                  <HomeIcon className="w-6 h-6" />
                </motion.button>

              </>
            )}
          </motion.div>

          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            language={language}
            onNavigateTo={navigateWithConfirm}
            currentServiceId={currentServiceId}
          />
        </header>
      );
    }

    const [showEvaluation, setShowEvaluation] = useState(false);

    const controls = useAnimation();

    // إظهار العناصر بعد اختيار الشركة أو تغيير اللغة
    React.useEffect(() => {
      if (selectedCompany) {
        controls
          .start("hidden")
          .then(() => controls.start("visible"))
          .then(() => setShowEvaluation(true));
      }
    }, [selectedCompany]);

    React.useEffect(() => {
      controls
        .start("hidden")
        .then(() => controls.start("visible"))
        .then(() => setShowEvaluation(true));
    }, [language]);

    return (
      <div
        className="min-h-screen bg-gray-700 p-6"
        dir={isRTL ? "rtl" : "ltr"}
        style={{ textAlign: isRTL ? "right" : "left" }}
      >
        <Header
          language={language}
          onLanguageChange={onLanguageChange}
          onNavigateTo={onNavigateTo}
          currentServiceId={currentServiceId}
        />

        <motion.div
          className="mx-4 mt-20 mb-6 p-6 bg-white rounded shadow space-y-6 w-auto max-w-full"
          variants={containerVariants}
          initial="hidden"
          animate={controls}
        >
          {/* اختيار الشركة */}
          {companies.length > 0 ? (
            <motion.div variants={getItemVariants(isRTL)}>
              <div className="flex flex-col gap-1">
                <label className="font-semibold">{labels[language].company}</label>
                <select
                  className="w-full border rounded p-2"
                  value={selectedCompany}
                  onChange={(e) => handleCompanySelection(e.target.value)}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {language === "ar" ? c.name_ar : c.name_en || c.name_ar}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          ) : (
            <motion.div variants={getItemVariants(isRTL)}>
              <div className="flex flex-col items-center justify-center border border-gray-300 bg-yellow-50 text-yellow-800 rounded-lg p-6 mt-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M12 12v.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
                  />
                </svg>
                <p className="text-center text-lg font-semibold">
                  {language === "ar"
                    ? "لا توجد شركات متاحة للتقييم في الوقت الحالي."
                    : "No companies available for evaluation at the moment."}
                </p>
              </div>
            </motion.div>
          )}

          {/* عرض الشهر وعدد الحراس وعدد المخالفات */}
          {selectedCompany && (
            <motion.div variants={getItemVariants(isRTL)}>
              <div className="flex flex-wrap gap-6 mt-4 justify-start">
                {/* الشهر */}
                <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-4 shadow-sm min-w-[220px]">
                  <CalendarIcon className="w-6 h-6 text-blue-600" />
                  <div>
                    <div className="text-gray-600 font-semibold">{labels[language].month}</div>
                    <div className="text-gray-800 font-bold text-lg">
                      {monthsOptions.find((m) => m.value === selectedMonth)?.label || ""}
                    </div>
                  </div>
                </div>

                {/* عدد الحراس */}
                <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-4 shadow-sm min-w-[220px] relative">
                  <UsersIcon className="w-6 h-6 text-blue-700" />
                  <div className="flex flex-col">
                    <span className="text-blue-700 font-semibold">{labels[language].guardCount}</span>
                    <span className="font-bold text-xl text-blue-900">{companyGuardCount}</span>
                  </div>
                  <button
                    onClick={() =>
                      alert(language === "ar" ? "تفاصيل عدد الحراس لاحقاً" : "Guards details coming soon")
                    }
                    className="ml-auto bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-colors"
                  >
                    !
                  </button>
                </div>

                {/* عدد المخالفات */}
                <div className="flex items-center gap-3 bg-red-50 rounded-lg p-4 shadow-sm min-w-[220px] relative">
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-700" />
                  <div className="flex flex-col">
                    <span className="text-red-700 font-semibold">{labels[language].violationsCount}</span>
                    <span className="font-bold text-xl text-red-900">{companyViolationsCount}</span>
                  </div>
                  <button
                    onClick={() =>
                      alert(language === "ar" ? "تفاصيل عدد المخالفات لاحقاً" : "Violations details coming soon")
                    }
                    className="ml-auto bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-colors"
                  >
                    !
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* أسئلة التقييم والملاحظات */}
          {selectedCompany && selectedMonth && !evaluationDone && (
            <motion.div
              className="space-y-6"
              variants={containerVariants}             // استخدام نفس container للأنيميشن المتسلسل
              initial={selectedCompany && selectedMonth ? "visible" : "hidden"} // عرض مباشر عند تحميل الصفحة
              animate={controls}                       // التحكم بالأنيميشن عند تغيير اللغة أو الشركة
            >
              {questions.map((q) => (
                <motion.div
                  key={q.id}
                  variants={getItemVariants(isRTL)}
                  className={`p-4 bg-white rounded-lg shadow-md border ${
                    q.invalid ? "border-red-500 bg-red-50" : "border-gray-200 hover:shadow-lg"
                  }`}
                >
                  <p className="mb-2 font-semibold text-gray-800">{q.text}</p>
                  <StarRating
                    rating={q.ratingValue}
                    onChange={(val) =>
                      setQuestions((prev) =>
                        prev.map((item) =>
                          item.id === q.id ? { ...item, ratingValue: val, invalid: false } : item
                        )
                      )
                    }
                    language={language}
                  />
                  <textarea
                    placeholder={language === "ar" ? "اكتب ملاحظات خاصة بالسؤال هنا..." : "Write note here..."}
                    value={q.note}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((item) => (item.id === q.id ? { ...item, note: e.target.value } : item))
                      )
                    }
                    className="w-full border border-gray-300 rounded-md p-2 mt-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
                    rows={3}
                  />
                </motion.div>
              ))}

              {/* الملاحظات العامة */}
              <motion.div variants={getItemVariants(isRTL)}>
                <label className="block mb-1 font-semibold">{labels[language].notes}</label>
                <textarea
                  placeholder={language === "ar" ? "ملاحظات عامة..." : "General notes..."}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded p-2 resize-y"
                  rows={3}
                />
              </motion.div>

              {/* التقييم النهائي */}
              {questions.length > 0 && (
                <motion.div variants={getItemVariants(isRTL)}>
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-6 mt-4 shadow-md">
                    <h2 className="text-lg font-bold text-yellow-800 mb-4 text-center">
                      {language === "ar" ? "التقييم النهائي" : "Final Evaluation"}
                    </h2>
                    <div className="flex flex-col items-center gap-2">
                      <FinalStarRating rating={overallScore} />
                      <span className="text-lg font-semibold text-gray-700">
                        {getRatingDescription(overallScore, language)}
                      </span>
                      <button
                        onClick={handleSubmit}
                        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 mt-4"
                        disabled={isLoadingEvaluation}
                        style={{ minWidth: "150px" }}
                      >
                        {labels[language].save}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }