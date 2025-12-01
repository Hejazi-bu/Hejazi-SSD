import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { 
    staggeredContainerVariants, 
    interactiveItemVariants, 
    directionalSlideVariants,
    fadeInVariants
} from "../../lib/animations";
import { useAuth } from "../contexts/UserContext";
import { useLanguage } from "../contexts/LanguageContext";
import { usePageLoading } from "../contexts/LoadingContext";
import { useActionLoading } from "../contexts/ActionLoadingContext";
import MainLayout from "../layouts/MainLayout";
import { 
    collection, query, where, getDocs, limit, doc, getDoc, DocumentData 
} from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import { 
    PaperAirplaneIcon, XMarkIcon, UserIcon, BriefcaseIcon, BuildingOfficeIcon, 
    GlobeAltIcon, PhoneIcon, EnvelopeIcon, IdentificationIcon 
} from "@heroicons/react/24/outline";
import { useDialog } from "../contexts/DialogContext";
import { useParams, useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { getClientContext } from '../../lib/clientContext';

// --- مكونات الإدخال القابلة لإعادة الاستخدام (للتصميم الموحد) ---
const InputGroup = ({ label, children, icon: Icon }: { label: string, children: React.ReactNode, icon?: any }) => (
    <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-400 flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-[#FFD700]" />}
            {label}
        </label>
        {children}
    </div>
);

const StyledInput = ({ ...props }) => (
    <input 
        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        {...props}
    />
);

const StyledSelect = ({ options, ...props }: { options: { value: string | number, label: string }[], [key: string]: any }) => (
    <div className="relative">
        <select 
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] transition-all appearance-none cursor-pointer disabled:opacity-50"
            {...props}
        >
            <option value="">{props.placeholder || "Select..."}</option>
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
        <div className="absolute top-1/2 right-3 rtl:right-auto rtl:left-3 -translate-y-1/2 pointer-events-none text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
    </div>
);

// --- الواجهات ---
interface FormData {
    first_name_ar: string; second_name_ar: string; third_name_ar: string; last_name_ar: string;
    first_name_en: string; second_name_en: string; third_name_en: string; last_name_en: string;
    email: string; phone_number: string; employee_id: string;
    gender: string; country: string; job_id: number | string; company_id: string;
}

export default function EditUserRequest() {
    const { language } = useLanguage();
    const { requestId } = useParams<{ requestId: string }>(); // هذا هو sequence_number
    const { user, isLoading: isAuthLoading } = useAuth();
    const { showDialog } = useDialog();
    const { setPageLoading } = usePageLoading();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const navigate = useNavigate();

    // State
    const [formData, setFormData] = useState<FormData>({
        first_name_ar: '', second_name_ar: '', third_name_ar: '', last_name_ar: '',
        first_name_en: '', second_name_en: '', third_name_en: '', last_name_en: '',
        email: '', phone_number: '', employee_id: '',
        gender: '', country: '', job_id: '', company_id: ''
    });
    
    const [loadingData, setLoadingData] = useState(true);
    const [jobs, setJobs] = useState<{value: number, label: string}[]>([]);
    const [companies, setCompanies] = useState<{value: string, label: string}[]>([]);
    const [taskId, setTaskId] = useState<string | null>(null); // نحتاجه للدالة السحابية
    const [originalRequestStatus, setOriginalRequestStatus] = useState<string>("");

    // Translations
    const t = useMemo(() => ({
        ar: {
            pageTitle: "تعديل طلب مستخدم",
            personalInfo: "البيانات الشخصية",
            jobInfo: "بيانات الوظيفة",
            contactInfo: "بيانات الاتصال",
            save: "إعادة تقديم الطلب",
            cancel: "إلغاء",
            loading: "جاري تحميل البيانات...",
            notFound: "الطلب غير موجود أو لا تملك صلاحية تعديله.",
            success: "تم تعديل الطلب وإعادة إرساله بنجاح!",
            error: "حدث خطأ",
            fields: {
                nameAr: "الاسم (عربي)", nameEn: "الاسم (إنجليزي)",
                first: "الأول", second: "الثاني", third: "الثالث", last: "اللقب",
                email: "البريد الإلكتروني", phone: "رقم الهاتف", empId: "الرقم الوظيفي",
                gender: "الجنس", country: "الدولة", job: "المسمى الوظيفي", company: "الشركة",
                male: "ذكر", female: "أنثى"
            },
            validation: "يرجى تعبئة جميع الحقول المطلوبة.",
            processing: "جاري إرسال التعديلات..."
        },
        en: {
            pageTitle: "Edit User Request",
            personalInfo: "Personal Information",
            jobInfo: "Job Information",
            contactInfo: "Contact Information",
            save: "Resubmit Request",
            cancel: "Cancel",
            loading: "Loading data...",
            notFound: "Request not found or you don't have permission.",
            success: "Request updated and resubmitted successfully!",
            error: "Error",
            fields: {
                nameAr: "Name (Arabic)", nameEn: "Name (English)",
                first: "First", second: "Second", third: "Third", last: "Last",
                email: "Email", phone: "Phone", empId: "Employee ID",
                gender: "Gender", country: "Country", job: "Job Title", company: "Company",
                male: "Male", female: "Female"
            },
            validation: "Please fill in all required fields.",
            processing: "Submitting changes..."
        }
    })[language], [language]);

    // 1. Fetch Data (Jobs, Companies, and The Request)
    useEffect(() => {
        if (isAuthLoading || !user || !requestId) return;

        const fetchData = async () => {
            try {
                setLoadingData(true);

                // A. Fetch Dropdowns
                const [jobsSnap, companiesSnap] = await Promise.all([
                    getDocs(collection(db, "jobs")),
                    getDocs(collection(db, "companies"))
                ]);

                setJobs(jobsSnap.docs.map(d => ({ 
                    value: Number(d.id), 
                    label: language === 'ar' ? d.data().name_ar : d.data().name_en 
                })));
                setCompanies(companiesSnap.docs.map(d => ({ 
                    value: d.id, 
                    label: language === 'ar' ? d.data().name_ar : d.data().name_en 
                })));

                // B. Fetch Request by Sequence Number
                const requestsRef = collection(db, "user_onboarding_requests");
                const q = query(requestsRef, where("sequence_number", "==", Number(requestId)), limit(1));
                const requestSnap = await getDocs(q);

                if (requestSnap.empty) throw new Error("Request not found");

                const reqData = requestSnap.docs[0].data();
                const reqId = requestSnap.docs[0].id;

                // Check status (Can only edit if Needs Revision)
                if (reqData.status !== 'Needs Revision') {
                    showDialog({ 
                        variant: 'alert', title: t.error, 
                        message: language === 'ar' ? "لا يمكن تعديل هذا الطلب لأنه ليس في حالة 'بحاجة لمراجعة'." : "Cannot edit this request because it is not in 'Needs Revision' status." 
                    });
                    navigate('/dashboard');
                    return;
                }

                setOriginalRequestStatus(reqData.status);

                // C. Find the pending task associated with this request to get taskId
                // نبحث عن المهمة المعلقة المرتبطة بهذا الطلب والتي تحمل SA_ID خاص بالمراجعة (عادة 15 أو 13 حسب التصميم)
                const tasksRef = collection(db, "tasks_queue");
                const taskQ = query(
                    tasksRef, 
                    where("parent_entity_id", "==", reqId),
                    where("status", "==", "pending")
                );
                const taskSnap = await getDocs(taskQ);

                if (taskSnap.empty) {
                    throw new Error("Active task for this request not found.");
                }
                setTaskId(taskSnap.docs[0].id);

                // D. Populate Form
                setFormData({
                    first_name_ar: reqData.first_name_ar || '',
                    second_name_ar: reqData.second_name_ar || '',
                    third_name_ar: reqData.third_name_ar || '',
                    last_name_ar: reqData.last_name_ar || '',
                    first_name_en: reqData.first_name_en || '',
                    second_name_en: reqData.second_name_en || '',
                    third_name_en: reqData.third_name_en || '',
                    last_name_en: reqData.last_name_en || '',
                    email: reqData.email || '',
                    phone_number: reqData.phone_number || '',
                    employee_id: reqData.employee_id || '',
                    gender: reqData.gender || '',
                    country: reqData.country || '',
                    job_id: reqData.job_id || '',
                    company_id: reqData.company_id || ''
                });

            } catch (error: any) {
                console.error("Error fetching data:", error);
                showDialog({ variant: 'alert', title: t.error, message: error.message || t.notFound });
                navigate(-1);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
    }, [requestId, user, isAuthLoading, language, navigate, t, showDialog]);

    // Update page loading state
    useEffect(() => { setPageLoading(loadingData); }, [loadingData, setPageLoading]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic Validation
        const requiredFields = ['first_name_ar', 'last_name_ar', 'first_name_en', 'last_name_en', 'email', 'phone_number', 'job_id', 'company_id', 'gender', 'country'];
        const isValid = requiredFields.every(field => formData[field as keyof FormData]);

        if (!isValid) {
            showDialog({ variant: 'alert', title: t.error, message: t.validation });
            return;
        }

        if (!taskId) return;

        showActionLoading(t.processing);

        try {
            const clientContext = await getClientContext();
            
            // Prepare updated data
            const name_ar = `${formData.first_name_ar} ${formData.second_name_ar} ${formData.third_name_ar} ${formData.last_name_ar}`.replace(/\s+/g, ' ').trim();
            const name_en = `${formData.first_name_en} ${formData.second_name_en} ${formData.third_name_en} ${formData.last_name_en}`.replace(/\s+/g, ' ').trim();

            const updatedData = {
                ...formData,
                name_ar,
                name_en,
                job_id: Number(formData.job_id)
            };

            const resubmitUserOnboarding = httpsCallable(functions, 'resubmitUserOnboarding');
            
            await resubmitUserOnboarding({
                taskId: taskId,
                updatedData: updatedData,
                clientContext
            });

            showDialog({ variant: 'success', title: t.success, message: t.success });
            navigate(`/system/users/details/${requestId}`); // العودة لصفحة التفاصيل

        } catch (error: any) {
            console.error("Error resubmitting:", error);
            showDialog({ variant: 'alert', title: t.error, message: error.message });
        } finally {
            hideActionLoading();
        }
    };

    if (loadingData) return null; // PageLoading context handles the spinner

    return (
        <MainLayout pageTitle={`${t.pageTitle} #${requestId}`}>
            <AnimatePresence mode="wait">
                <motion.div 
                    variants={directionalSlideVariants}
                    initial="initial" animate="animate" exit="exit"
                    className="max-w-4xl mx-auto pb-12"
                >
                    <form onSubmit={handleSubmit} className="space-y-8">
                        
                        {/* Personal Info */}
                        <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" className="bg-gray-900/50 rounded-xl p-6 border border-gray-700/50 space-y-6">
                            <h3 className="text-lg font-bold text-[#FFD700] flex items-center gap-2 border-b border-gray-700 pb-2">
                                <UserIcon className="w-5 h-5" /> {t.personalInfo}
                            </h3>
                            
                            {/* Arabic Name */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <InputGroup label={`${t.fields.nameAr} - ${t.fields.first}`}>
                                    <StyledInput name="first_name_ar" value={formData.first_name_ar} onChange={handleChange} placeholder={t.fields.first} required />
                                </InputGroup>
                                <InputGroup label={t.fields.second}>
                                    <StyledInput name="second_name_ar" value={formData.second_name_ar} onChange={handleChange} placeholder={t.fields.second} />
                                </InputGroup>
                                <InputGroup label={t.fields.third}>
                                    <StyledInput name="third_name_ar" value={formData.third_name_ar} onChange={handleChange} placeholder={t.fields.third} />
                                </InputGroup>
                                <InputGroup label={t.fields.last}>
                                    <StyledInput name="last_name_ar" value={formData.last_name_ar} onChange={handleChange} placeholder={t.fields.last} required />
                                </InputGroup>
                            </div>

                            {/* English Name */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4" dir="ltr">
                                <InputGroup label={`${t.fields.nameEn} - ${t.fields.first}`}>
                                    <StyledInput name="first_name_en" value={formData.first_name_en} onChange={handleChange} placeholder={t.fields.first} required />
                                </InputGroup>
                                <InputGroup label={t.fields.second}>
                                    <StyledInput name="second_name_en" value={formData.second_name_en} onChange={handleChange} placeholder={t.fields.second} />
                                </InputGroup>
                                <InputGroup label={t.fields.third}>
                                    <StyledInput name="third_name_en" value={formData.third_name_en} onChange={handleChange} placeholder={t.fields.third} />
                                </InputGroup>
                                <InputGroup label={t.fields.last}>
                                    <StyledInput name="last_name_en" value={formData.last_name_en} onChange={handleChange} placeholder={t.fields.last} required />
                                </InputGroup>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputGroup label={t.fields.gender} icon={UserIcon}>
                                    <StyledSelect name="gender" value={formData.gender} onChange={handleChange} options={[
                                        { value: 'male', label: t.fields.male },
                                        { value: 'female', label: t.fields.female }
                                    ]} required />
                                </InputGroup>
                                <InputGroup label={t.fields.country} icon={GlobeAltIcon}>
                                    <StyledSelect name="country" value={formData.country} onChange={handleChange} options={[
                                        { value: 'Saudi Arabia', label: language === 'ar' ? 'المملكة العربية السعودية' : 'Saudi Arabia' },
                                        // Add more countries as needed
                                    ]} required />
                                </InputGroup>
                            </div>
                        </motion.div>

                        {/* Contact Info */}
                        <motion.div variants={fadeInVariants} className="bg-gray-900/50 rounded-xl p-6 border border-gray-700/50 space-y-6">
                            <h3 className="text-lg font-bold text-[#FFD700] flex items-center gap-2 border-b border-gray-700 pb-2">
                                <PhoneIcon className="w-5 h-5" /> {t.contactInfo}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputGroup label={t.fields.email} icon={EnvelopeIcon}>
                                    <StyledInput type="email" name="email" value={formData.email} onChange={handleChange} required dir="ltr" />
                                </InputGroup>
                                <InputGroup label={t.fields.phone} icon={PhoneIcon}>
                                    <StyledInput type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} required dir="ltr" />
                                </InputGroup>
                            </div>
                        </motion.div>

                        {/* Job Info */}
                        <motion.div variants={fadeInVariants} className="bg-gray-900/50 rounded-xl p-6 border border-gray-700/50 space-y-6">
                            <h3 className="text-lg font-bold text-[#FFD700] flex items-center gap-2 border-b border-gray-700 pb-2">
                                <BriefcaseIcon className="w-5 h-5" /> {t.jobInfo}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <InputGroup label={t.fields.company} icon={BuildingOfficeIcon}>
                                    <StyledSelect name="company_id" value={formData.company_id} onChange={handleChange} options={companies} required />
                                </InputGroup>
                                <InputGroup label={t.fields.job} icon={BriefcaseIcon}>
                                    <StyledSelect name="job_id" value={formData.job_id} onChange={handleChange} options={jobs} required />
                                </InputGroup>
                                <InputGroup label={t.fields.empId} icon={IdentificationIcon}>
                                    <StyledInput name="employee_id" value={formData.employee_id} onChange={handleChange} />
                                </InputGroup>
                            </div>
                        </motion.div>

                        {/* Actions */}
                        <motion.div variants={interactiveItemVariants} className="flex items-center justify-end gap-4 pt-4">
                            <button 
                                type="button" 
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 px-6 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors font-bold"
                            >
                                <XMarkIcon className="w-5 h-5" /> {t.cancel}
                            </button>
                            <button 
                                type="submit" 
                                className="flex items-center gap-2 bg-[#FFD700] hover:bg-[#e6c200] text-black px-8 py-3 rounded-lg font-bold transition-colors shadow-lg shadow-yellow-900/20"
                            >
                                <PaperAirplaneIcon className="w-5 h-5" /> {t.save}
                            </button>
                        </motion.div>

                    </form>
                </motion.div>
            </AnimatePresence>
        </MainLayout>
    );
}