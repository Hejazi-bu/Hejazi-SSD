// src/components/Users/EditUserRequest.tsx
import React, { useEffect, useState, useMemo, useRef, ChangeEvent, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import {
    staggeredContainerVariants,
    staggeredItemVariants,
    interactiveItemVariants,
    shakeVariants,
    fadeInVariants
} from "../../lib/animations";
import { cleanText } from "../../utils/textUtils";
import { useAuth } from "../contexts/UserContext";
import { useLanguage } from "../contexts/LanguageContext";
import { usePageLoading } from "../contexts/LoadingContext";
import { useActionLoading } from "../contexts/ActionLoadingContext";
import { 
    collection, query, DocumentData, FirestoreDataConverter, 
    QueryDocumentSnapshot, SnapshotOptions, orderBy, where, 
    documentId, getDocs, limit, doc, updateDoc, Timestamp 
} from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db, functions } from '../../lib/firebase';
import {
    EnvelopeIcon, UserIcon, BriefcaseIcon, BuildingOfficeIcon,
    InformationCircleIcon, PhoneIcon, AtSymbolIcon,
    BuildingStorefrontIcon, AcademicCapIcon, IdentificationIcon,
    XCircleIcon, CheckCircleIcon, FlagIcon, MagnifyingGlassIcon,
    ArrowUturnLeftIcon, ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { useDialog } from "../contexts/DialogContext";
import { useParams, useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { getClientContext } from "../../lib/clientContext";
import MainLayout from "../layouts/MainLayout";

// --- الدوال المساعدة ---
const sanitizePhoneNumber = (phoneStr: string): string => {
    if (!phoneStr) return '';
    let cleaned = phoneStr.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (cleaned.startsWith('971')) cleaned = cleaned.substring(3);
    while (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    return cleaned;
};

// --- الأنواع ---
interface Company extends DocumentData { id: string; name_ar: string; name_en?: string; }
interface Job extends DocumentData { id: string; name_ar: string; name_en?: string; }
interface Country extends DocumentData {
    id: string; name_ar: string; name_en: string; dial_code: string; flag_emoji: string;
}
interface TaskDoc { id: string; }

interface NewUserRequestState {
    first_name_ar: string; second_name_ar: string; third_name_ar: string; last_name_ar: string;
    first_name_en: string; second_name_en: string; third_name_en: string; last_name_en: string;
    name_ar: string; name_en: string;
    email: string;
    phone_number: string;
    gender: "male" | "female" | "";
    country: string;
    job_id: string;
    employee_id: string;
    work_email: string;
    work_phone: string;
    landline_phone: string;
    company_id: string;
    company_email: string;
    company_phone: string;
    company_landline_phone: string;
    'reason-company-phone': string;
    'alternative-phone': string;
    entity_phone_status: "active" | "stopped";
    personal_dial_code_id: string;
    work_dial_code_id: string;
    alternative_dial_code_id: string;
    company_dial_code_id: string;
}

type FormErrors = Partial<Record<keyof NewUserRequestState, string>>;
type FormRefs = Record<keyof NewUserRequestState, HTMLElement | null>;

const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
    toFirestore: (data: T): DocumentData => data,
    fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T)
});
const companyConverter = createConverter<Company>();
const jobConverter = createConverter<Job>();
const countryConverter = createConverter<Country>();

// --- المكونات الداخلية ---

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string; name: keyof NewUserRequestState; value: string;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    placeholder?: string; language: "ar" | "en"; error?: string;
    fieldRef: (el: HTMLElement | null) => void; type?: string; icon: React.ElementType;
    inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
}

function FormField({ label, name, value, onChange, placeholder, language, error, fieldRef, type = "text", children = null, icon: IconComponent, maxLength, pattern, disabled = false, inputMode }: FormFieldProps) {
    const InputComponent = type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input';
    const inputDirection = useMemo(() => {
        const ltrFields: (keyof NewUserRequestState)[] = ['email', 'name_en', 'phone_number', 'employee_id', 'work_email', 'work_phone', 'company_email', 'company_phone', 'company_landline_phone', 'landline_phone', 'alternative-phone', 'first_name_en', 'second_name_en', 'third_name_en', 'last_name_en'];
        return ltrFields.includes(name) ? 'ltr' : 'rtl';
    }, [name]);

    return (
        <motion.div ref={fieldRef as any} className={`p-4 rounded-lg shadow-md border ${error ? "border-red-500" : (disabled ? "bg-gray-700/30 border-gray-700" : "bg-gray-900/50 border-gray-700")}`} variants={{ ...interactiveItemVariants, ...shakeVariants }} whileHover="hover" animate={error ? "animate" : "initial"}>
            <label htmlFor={name} className={`flex items-center mb-2 font-semibold ${disabled ? "text-gray-400" : "text-gray-200"}`}>
                <IconComponent className="w-5 h-5 me-2 text-[#FFD700]" />{label}
            </label>
            <InputComponent id={name} name={name} value={value} onChange={onChange} placeholder={placeholder || '...'} type={type === 'select' || type === 'textarea' ? undefined : type} className={`w-full p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] ${disabled ? "bg-gray-600/50 cursor-not-allowed" : "bg-gray-700"} ${(name === 'employee_id' || name === 'landline_phone') ? 'remove-arrow' : ''}`} dir={inputDirection} rows={type === 'textarea' ? 3 : undefined} maxLength={maxLength} pattern={pattern} disabled={disabled} inputMode={inputMode}>
                {children}
            </InputComponent>
            {error && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-sm text-red-400 flex items-center"><XCircleIcon className="w-4 h-4 me-1" />{error}</motion.p>}
            <style>{`.remove-arrow::-webkit-outer-spin-button, .remove-arrow::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } .remove-arrow { -moz-appearance: textfield; }`}</style>
        </motion.div>
    );
}

function CountrySelectField({ label, name, value, onChange, error, fieldRef, language, allCountries }: any) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isRTL = language === 'ar';
    const selectedCountry = (allCountries || []).find((c: Country) => c.id === value);
    const filteredCountries = useMemo(() => {
        const term = cleanText(searchTerm).toLowerCase();
        if (!term) return allCountries;
        return allCountries.filter((c: Country) => cleanText(c.name_ar).toLowerCase().includes(term) || cleanText(c.name_en).toLowerCase().includes(term));
    }, [allCountries, searchTerm]);
    const handleCountrySelect = (countryId: string) => { onChange({ target: { value: countryId, name: name } } as ChangeEvent<HTMLSelectElement>); setIsDropdownOpen(false); setSearchTerm(''); };
    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false); }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
    useEffect(() => { if (isDropdownOpen && searchInputRef.current) searchInputRef.current.focus(); }, [isDropdownOpen]);

    return (
        <motion.div ref={fieldRef as any} className={`p-4 rounded-lg shadow-md border ${error ? "border-red-500" : "bg-gray-900/50 border-gray-700"}`} variants={{ ...interactiveItemVariants, ...shakeVariants }} whileHover="hover" animate={error ? "animate" : "initial"}>
            <label htmlFor={name} className={`flex items-center mb-2 font-semibold text-gray-200`}><FlagIcon className="w-5 h-5 me-2 text-[#FFD700]" />{label}</label>
            <div className="relative" ref={dropdownRef}>
                <button type="button" onClick={() => setIsDropdownOpen(prev => !prev)} className={`w-full flex items-center justify-between p-2.5 bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] rounded-md text-left text-gray-200`} style={{ minHeight: '40px' }}>
                    <span className="flex items-center">{value && selectedCountry?.flag_emoji && <span className="mr-2">{selectedCountry.flag_emoji}{'\u00a0\u00a0'}</span>}{value ? (language === "ar" ? selectedCountry?.name_ar : selectedCountry?.name_en) : (language === "ar" ? "اختر الجنسية..." : "Select Nationality...")}</span><ChevronDownIcon className="w-4 h-4" />
                </button>
                <AnimatePresence>
                    {isDropdownOpen && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`absolute z-20 w-full max-h-80 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-lg mt-1 ${isRTL ? 'right-0' : 'left-0'}`}>
                            <div className="p-2 border-b border-gray-700 sticky top-0 bg-gray-800">
                                <div className="relative"><MagnifyingGlassIcon className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400`} /><input ref={searchInputRef} type="text" placeholder={language === 'ar' ? 'ابحث بالاسم...' : 'Search name...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full py-2 bg-gray-700 rounded-md text-sm text-gray-200 focus:outline-none ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'}`} dir={language === 'ar' ? 'rtl' : 'ltr'} /></div>
                            </div>
                            {(filteredCountries.length > 0 ? filteredCountries : allCountries).map((country: Country) => (
                                <div key={country.id} className="flex items-center p-2 cursor-pointer hover:bg-gray-700 transition duration-150 text-gray-200 text-sm" onClick={() => handleCountrySelect(country.id)}>
                                    <span className="mr-2">{country.flag_emoji}{'\u00a0\u00a0'}</span><span className="flex-grow truncate" dir={language === 'ar' ? 'rtl' : 'ltr'}>{language === 'ar' ? country.name_ar : country.name_en}</span>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {error && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-sm text-red-400 flex items-center"><XCircleIcon className="w-4 h-4 me-1" />{error}</motion.p>}
        </motion.div>
    );
}

function PhoneSearchInputField({ label, name, value, onChange, error, fieldRef, language, allCountries, currentCountryId, onCodeChange, disabled = false }: any) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isRTL = language === 'ar';
    const selectedCountry = (allCountries || []).find((c: Country) => c.id === currentCountryId);
    const dialCode = selectedCountry?.dial_code || (currentCountryId === 'AE' ? '+971' : '+...');
    const phonePlaceholder = currentCountryId === 'AE' ? '5xxxxxxxx' : 'Xxxxxxxxx';

    const filteredCountries = useMemo(() => {
        const term = cleanText(searchTerm).toLowerCase();
        if (!term) return allCountries;
        return allCountries.filter((c: Country) => cleanText(c.name_ar).toLowerCase().includes(term) || cleanText(c.name_en).toLowerCase().includes(term) || cleanText(c.dial_code).toLowerCase().includes(term));
    }, [allCountries, searchTerm]);

    const handleCountrySelect = (country: Country) => { onCodeChange(country.id); setIsDropdownOpen(false); setSearchTerm(''); };
    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false); }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
    useEffect(() => { if (isDropdownOpen && searchInputRef.current) searchInputRef.current.focus(); }, [isDropdownOpen]);

    return (
        <motion.div variants={interactiveItemVariants} whileHover="hover" className={`p-4 rounded-lg shadow-md border ${error ? "border-red-500" : (disabled ? "bg-gray-700/30 border-gray-700" : "bg-gray-900/50 border-gray-700")}`} ref={dropdownRef}>
            <label htmlFor={name} className={`flex items-center mb-2 font-semibold ${disabled ? "text-gray-400" : "text-gray-200"}`}><PhoneIcon className="w-5 h-5 me-2 text-[#FFD700]" /> {label}</label>
            <div className="flex w-full relative" dir="ltr">
                <button type="button" onClick={() => { if (!disabled) setIsDropdownOpen(prev => !prev); }} className={`flex-shrink-0 flex items-center justify-between p-2.5 border border-gray-600 transition focus:outline-none focus:ring-2 focus:ring-[#FFD700] rounded-l-md text-gray-200 text-sm`} style={{ width: '150px' }} disabled={disabled}>
                    <span className="truncate">{selectedCountry?.flag_emoji || '🌐'} {dialCode}</span><ChevronDownIcon className="w-4 h-4 ml-1" />
                </button>
                <input id={name} name={name} type="text" inputMode="numeric" value={value} onChange={onChange} placeholder={value ? '' : phonePlaceholder} className={`w-full p-2.5 border border-gray-600 border-l-0 focus:outline-none focus:ring-2 focus:ring-[#FFD700] rounded-r-md remove-arrow ${disabled ? 'bg-gray-600/50 cursor-not-allowed' : 'bg-gray-700'}`} dir="ltr" ref={fieldRef as any} pattern="\d+" disabled={disabled} />
                <AnimatePresence>
                    {isDropdownOpen && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`absolute z-20 w-72 max-h-80 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-lg mt-14 ${isRTL ? 'right-0' : 'left-0'}`}>
                            <div className="p-2 border-b border-gray-700 sticky top-0 bg-gray-800">
                                <div className="relative"><MagnifyingGlassIcon className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400`} /><input ref={searchInputRef} type="text" placeholder={language === 'ar' ? 'ابحث بالاسم أو الكود' : 'Search name or code'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full py-2 bg-gray-700 rounded-md text-sm text-gray-200 focus:outline-none ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'}`} dir={language === 'ar' ? 'rtl' : 'ltr'} /></div>
                            </div>
                            {(filteredCountries.length > 0 ? filteredCountries : allCountries).map((country: Country) => (
                                <div key={country.id} className="flex items-center p-2 cursor-pointer hover:bg-gray-700 transition duration-150 text-gray-200 text-sm" onClick={() => handleCountrySelect(country)}>
                                    <span className="mr-2">{country.flag_emoji}{'\u00a0\u00a0'}</span><span className="flex-grow truncate" dir={language === 'ar' ? 'rtl' : 'ltr'}>{language === 'ar' ? country.name_ar : country.name_en}</span><span className="ml-2 font-semibold text-gray-400 flex-shrink-0">{country.dial_code}</span>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {error && <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-sm text-red-400 flex items-center"><XCircleIcon className="w-4 h-4 me-1" />{error}</motion.p>}
        </motion.div>
    );
}

// --- المكون الرئيسي ---
export default function EditUserRequest() {
    const { language } = useLanguage();
    
    // التقاط الباراميتر بمرونة
    const params = useParams();
    const sequenceNumber = params.sequenceNumber || params.requestId || params.id;

    const { user, hasPermission, isLoading: isAuthLoading } = useAuth();
    const { showDialog } = useDialog();
    const { setPageLoading } = usePageLoading();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const navigate = useNavigate();
    const formRefs = useRef<FormRefs>({} as FormRefs);

    // State
    const [formData, setFormData] = useState<NewUserRequestState>({
        first_name_ar: "", second_name_ar: "", third_name_ar: "", last_name_ar: "",
        first_name_en: "", second_name_en: "", third_name_en: "", last_name_en: "",
        name_ar: "", name_en: "", email: "", phone_number: "", gender: "", country: "",
        job_id: "", employee_id: "", work_email: "", work_phone: "", landline_phone: "",
        company_id: "", company_email: "", company_phone: "", company_landline_phone: "",
        'reason-company-phone': "", 'alternative-phone': "", entity_phone_status: 'active',
        personal_dial_code_id: 'AE', work_dial_code_id: 'AE', alternative_dial_code_id: 'AE', company_dial_code_id: 'AE'
    });
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [currentTask, setCurrentTask] = useState<TaskDoc | null>(null);
    const [requestDocId, setRequestDocId] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [entityPhoneStatus, setEntityPhoneStatus] = useState<"active" | "stopped">('active');
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Data Hooks
    const [allCompanies, companiesLoading] = useCollectionData<Company>(useMemo(() => query(collection(db, "companies").withConverter(companyConverter), orderBy("name_ar")), []));
    const [allJobs, jobsLoading] = useCollectionData<Job>(useMemo(() => query(collection(db, "jobs").withConverter(jobConverter), where(documentId(), "==", "3")), []));
    const [allCountries, countriesLoading] = useCollectionData<Country>(useMemo(() => query(collection(db, "countries").withConverter(countryConverter), orderBy("name_ar")), []));

    const t = useMemo(() => ({
        ar: {
            pageTitle: "تعديل طلب المستخدم", accessDenied: "وصول مرفوض", accessDeniedMsg: "ليس لديك الصلاحية (sss:15) لتعديل هذا الطلب.",
            notFound: "الطلب غير موجود.", saveChanges: "حفظ وإعادة الإرسال", cancel: "إلغاء", loading: "جاري جلب البيانات...", successTitle: "تم التعديل",
            successMsg: "تم تحديث البيانات وإعادة إرسال الطلب للموافقة.", errorTitle: "خطأ",
            personalData: "1. البيانات الشخصية", jobData: "2. البيانات الوظيفية", organizationData: "3. بيانات المؤسسة",
            requiredField: "هذا الحقل إلزامي.", validationErrorPhoneLength: "يجب أن يتكون رقم الهاتف من 9 أرقام (بدون المفتاح).",
            validationErrorExtension: "يجب أن يكون رقم التحويلة 4 أرقام.", validationErrorEmployeeID: "أرقام فقط (حد أقصى 10).",
            validationErrorArabicFormat: "يجب كتابة الحقل باللغة العربية فقط.", validationErrorEnglishFormat: "يجب كتابة الحقل باللغة الإنجليزية فقط.",
            validationErrorEmailFormat: "صيغة البريد الإلكتروني غير صحيحة.",
            fields: {
                firstName: "الاسم الأول", secondName: "الاسم الثاني", thirdName: "الاسم الثالث", lastName: "اسم العائلة",
                arabicName: "الاسم (بالعربية)", englishName: "الاسم (بالإنجليزية)",
                email: "البريد الإلكتروني", phone: "رقم الهاتف", gender: "الجنس", nationality: "الجنسية",
                company: "المؤسسة/المنشأة", jobTitle: "المسمى الوظيفي", employeeId: "الرقم الوظيفي",
                workEmail: "بريد العمل", workPhone: "هاتف العمل", extension: "التحويلة",
                entityEmail: "بريد المؤسسة", entityPhone: "هاتف المؤسسة", entityExtension: "تحويلة المؤسسة",
                active: "نشط", stopped: "معطل", stoppedDetails: "تفاصيل الهاتف المعطل", reason: "سبب التوقف", altPhone: "هاتف بديل"
            }
        },
        en: {
            pageTitle: "Edit User Request", accessDenied: "Access Denied", accessDeniedMsg: "You do not have permission (sss:15) to edit this request.",
            notFound: "Request not found.", saveChanges: "Save & Resubmit", cancel: "Cancel", loading: "Fetching data...", successTitle: "Updated",
            successMsg: "Data updated and request resubmitted.", errorTitle: "Error",
            personalData: "1. Personal Data", jobData: "2. Job Data", organizationData: "3. Organization Data",
            requiredField: "This field is required.", validationErrorPhoneLength: "Phone must be 9 digits.",
            validationErrorExtension: "Extension must be 4 digits.", validationErrorEmployeeID: "Digits only (max 10).",
            validationErrorArabicFormat: "Arabic only.", validationErrorEnglishFormat: "English only.", validationErrorEmailFormat: "Invalid email.",
            fields: {
                firstName: "First Name", secondName: "Second Name", thirdName: "Third Name", lastName: "Last Name",
                arabicName: "Name (Arabic)", englishName: "Name (English)",
                email: "Email", phone: "Phone", gender: "Gender", nationality: "Nationality",
                company: "Organization", jobTitle: "Job Title", employeeId: "Employee ID",
                workEmail: "Work Email", workPhone: "Work Phone", extension: "Extension",
                entityEmail: "Entity Email", entityPhone: "Entity Phone", entityExtension: "Entity Extension",
                active: "Active", stopped: "Stopped", stoppedDetails: "Stopped Phone Details", reason: "Reason", altPhone: "Alt Phone"
            }
        }
    }), []);
    const currentLang = t[language];

    // --- تحليل البيانات عند التحميل ---
    const parsePhone = useCallback((fullPhone: string, countries: Country[]): { code: string, number: string } => {
        if (!fullPhone || !countries.length) return { code: 'AE', number: '' };
        const matched = countries
            .filter(c => fullPhone.startsWith(c.dial_code))
            .sort((a, b) => b.dial_code.length - a.dial_code.length)[0];
        
        if (matched) {
            return { code: matched.id, number: sanitizePhoneNumber(fullPhone.replace(matched.dial_code, '')) };
        }
        return { code: 'AE', number: sanitizePhoneNumber(fullPhone.replace('+971', '')) };
    }, []);

    // --- تحميل البيانات ---
    useEffect(() => {
        if (isAuthLoading || companiesLoading || jobsLoading || countriesLoading) return;
        
        if (!hasPermission('sss:15')) {
            setIsLoadingData(false);
            return;
        }

        if (!sequenceNumber) {
             // اذا لم نجد الرقم، نتوقف ولا نعرض خطأ فوراً بل ننتظر قليلاً أو نعرض رسالة
             console.error("No sequenceNumber found in URL");
             setNotFound(true);
             setIsLoadingData(false);
             return;
        }

        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                // البحث بالرقم
                let q = query(
                    collection(db, "user_onboarding_requests"), 
                    where("sequence_number", "==", Number(sequenceNumber)), 
                    limit(1)
                );
                let querySnapshot = await getDocs(q);

                // البحث بالنص
                if (querySnapshot.empty) {
                    q = query(
                        collection(db, "user_onboarding_requests"), 
                        where("sequence_number", "==", String(sequenceNumber)), 
                        limit(1)
                    );
                    querySnapshot = await getDocs(q);
                }

                if (querySnapshot.empty) {
                    setNotFound(true);
                } else {
                    const docSnap = querySnapshot.docs[0];
                    const data = docSnap.data();
                    setRequestDocId(docSnap.id);

                    const personal = parsePhone(data.phone_number, allCountries || []);
                    const work = parsePhone(data.work_phone, allCountries || []);
                    const company = parsePhone(data.company_phone, allCountries || []);
                    const alt = parsePhone(data['alternative-phone'], allCountries || []);

                    const phoneStatus = data['reason-company-phone'] ? 'stopped' : 'active';
                    setEntityPhoneStatus(phoneStatus);

                    setFormData(prev => ({
                        ...prev,
                        ...data,
                        phone_number: personal.number, personal_dial_code_id: personal.code,
                        work_phone: work.number, work_dial_code_id: work.code,
                        company_phone: company.number, company_dial_code_id: company.code,
                        'alternative-phone': alt.number, alternative_dial_code_id: alt.code,
                        entity_phone_status: phoneStatus,
                        job_id: String(data.job_id || ''),
                        company_id: String(data.company_id || '')
                    } as NewUserRequestState));

                    const taskQuery = query(collection(db, "tasks_queue"), where("parent_entity_id", "==", docSnap.id), limit(1));
                    const taskSnap = await getDocs(taskQuery);
                    if (!taskSnap.empty) setCurrentTask({ id: taskSnap.docs[0].id });
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoadingData(false);
                setPageLoading(false);
            }
        };
        fetchData();
    }, [isAuthLoading, hasPermission, sequenceNumber, allCountries, companiesLoading, jobsLoading, countriesLoading, parsePhone, setPageLoading]);


    // --- المعالجات ---
    const handleFormChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newForm = { ...prev, [name]: value };
            if (name === 'company_id' && value === '1') {
                newForm.company_email = ''; newForm.company_phone = ''; newForm.company_landline_phone = '';
                newForm['reason-company-phone'] = ''; newForm['alternative-phone'] = '';
                newForm.entity_phone_status = 'active'; setEntityPhoneStatus('active');
            }
            return newForm;
        });
        if (formErrors[name as keyof NewUserRequestState]) setFormErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const handleNameChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newForm = { ...prev, [name]: value };
            if (name.endsWith('_ar')) newForm.name_ar = [newForm.first_name_ar, newForm.second_name_ar, newForm.third_name_ar, newForm.last_name_ar].filter(p => cleanText(p)).join(' ');
            if (name.endsWith('_en')) newForm.name_en = [newForm.first_name_en, newForm.second_name_en, newForm.third_name_en, newForm.last_name_en].filter(p => cleanText(p)).join(' ');
            return newForm;
        });
        if (formErrors[name as keyof NewUserRequestState]) setFormErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const handlePhoneStatusChange = (e: any) => {
        setEntityPhoneStatus(e.target.value);
        setFormData(prev => ({ ...prev, entity_phone_status: e.target.value }));
    };

    const handleCodeChange = (field: string, code: string) => {
        setFormData(prev => ({ ...prev, [field]: code }));
    };

    const handleSubmit = async () => {
        if (!requestDocId || !currentTask) return;

        const errors: FormErrors = {};
        const required: (keyof NewUserRequestState)[] = ['first_name_ar', 'last_name_ar', 'first_name_en', 'last_name_en', 'email', 'phone_number', 'gender', 'country', 'job_id', 'employee_id', 'company_id'];
        
        required.forEach(key => { if (!formData[key]) errors[key] = currentLang.requiredField; });
        if (formData.phone_number && sanitizePhoneNumber(formData.phone_number).length !== 9) errors.phone_number = currentLang.validationErrorPhoneLength;
        if (formData.work_phone && sanitizePhoneNumber(formData.work_phone).length !== 9) errors.work_phone = currentLang.validationErrorPhoneLength;
        if (formData.company_id !== '1') {
            if (!formData.company_phone) errors.company_phone = currentLang.requiredField;
            else if (sanitizePhoneNumber(formData.company_phone).length !== 9) errors.company_phone = currentLang.validationErrorPhoneLength;
        }
        
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            const firstRef = formRefs.current[Object.keys(errors)[0] as keyof NewUserRequestState];
            if (firstRef) firstRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        showActionLoading(currentLang.loading);
        try {
            const getDial = (id: string) => (allCountries || []).find(c => c.id === id)?.dial_code || '+971';
            
            const updateData: any = {
                ...formData,
                phone_number: getDial(formData.personal_dial_code_id) + sanitizePhoneNumber(formData.phone_number),
                work_phone: formData.work_phone ? getDial(formData.work_dial_code_id) + sanitizePhoneNumber(formData.work_phone) : '',
                company_phone: formData.company_phone ? getDial(formData.company_dial_code_id) + sanitizePhoneNumber(formData.company_phone) : '',
                'alternative-phone': formData['alternative-phone'] ? getDial(formData.alternative_dial_code_id) + sanitizePhoneNumber(formData['alternative-phone']) : '',
                updated_at: Timestamp.now(),
                job_id: Number(formData.job_id)
            };

            if (formData.company_id === '1') {
                updateData.company_email = ''; updateData.company_phone = ''; updateData.company_landline_phone = '';
                updateData['reason-company-phone'] = ''; updateData['alternative-phone'] = '';
            }

            await updateDoc(doc(db, "user_onboarding_requests", requestDocId), updateData);

            const processTask = httpsCallable(functions, 'processUserOnboardingTask');
            await processTask({
                taskId: currentTask.id,
                action: 'resubmitted',
                reason: 'Edited by user',
                clientContext: await getClientContext()
            });

            hideActionLoading();
            showDialog({ 
                variant: 'success', title: currentLang.successTitle, message: currentLang.successMsg,
                onConfirm: () => navigate(`/system/users/details/${sequenceNumber}`)
            });

        } catch (e: any) {
            hideActionLoading();
            showDialog({ variant: 'alert', title: currentLang.errorTitle, message: e.message });
        }
    };

    // --- العرض (UI) ---
    
    if (!isAuthLoading && !hasPermission('sss:15')) {
        return (
            <MainLayout pageTitle={currentLang.accessDenied}>
                <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
                    <div className="bg-red-500/10 p-6 rounded-full mb-4"><ExclamationTriangleIcon className="w-16 h-16 text-red-500" /></div>
                    <h2 className="text-2xl font-bold text-white mb-2">{currentLang.accessDenied}</h2>
                    <p className="text-gray-400">{currentLang.accessDeniedMsg}</p>
                    <button onClick={() => navigate(-1)} className="mt-6 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg">{currentLang.cancel}</button>
                </div>
            </MainLayout>
        );
    }

    if (isLoadingData) {
        return (
            <MainLayout pageTitle={currentLang.loading}>
                <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-400">{currentLang.loading}</p>
                </div>
            </MainLayout>
        );
    }

    if (notFound) {
        return (
            <MainLayout pageTitle={currentLang.errorTitle}>
                <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                    <div className="bg-yellow-500/10 p-4 rounded-full">
                        <InformationCircleIcon className="w-12 h-12 text-yellow-500" />
                    </div>
                    <div className="text-center text-gray-300 text-lg">{currentLang.notFound}</div>
                    <button onClick={() => navigate(-1)} className="text-blue-400 hover:text-blue-300 underline">
                        {language === 'ar' ? 'العودة للخلف' : 'Go Back'}
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout pageTitle={`${currentLang.pageTitle} #${sequenceNumber}`}>
            <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" className="max-w-5xl mx-auto pb-12 space-y-8">
                
                {/* 1. البيانات الشخصية */}
                <motion.div variants={staggeredItemVariants} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 space-y-6">
                    <h2 className="text-2xl font-bold text-gray-100 border-b border-gray-700 pb-2">{currentLang.personalData} <UserIcon className="inline-block w-6 h-6 text-[#FFD700]" /></h2>
                    
                    <div dir="rtl" className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-900/30 p-4 rounded-lg">
                        <h3 className="md:col-span-4 text-gray-400 mb-2">{currentLang.fields.arabicName}</h3>
                        <FormField label={currentLang.fields.firstName} name="first_name_ar" value={formData.first_name_ar} onChange={handleNameChange} language={language} error={formErrors.first_name_ar} fieldRef={(el) => formRefs.current.first_name_ar = el} icon={UserIcon} pattern="[\u0600-\u06FF\s]+" />
                        <FormField label={currentLang.fields.secondName} name="second_name_ar" value={formData.second_name_ar} onChange={handleNameChange} language={language} error={formErrors.second_name_ar} fieldRef={(el) => formRefs.current.second_name_ar = el} icon={UserIcon} pattern="[\u0600-\u06FF\s]+" />
                        <FormField label={currentLang.fields.thirdName} name="third_name_ar" value={formData.third_name_ar} onChange={handleNameChange} language={language} error={formErrors.third_name_ar} fieldRef={(el) => formRefs.current.third_name_ar = el} icon={UserIcon} pattern="[\u0600-\u06FF\s]+" />
                        <FormField label={currentLang.fields.lastName} name="last_name_ar" value={formData.last_name_ar} onChange={handleNameChange} language={language} error={formErrors.last_name_ar} fieldRef={(el) => formRefs.current.last_name_ar = el} icon={UserIcon} pattern="[\u0600-\u06FF\s]+" />
                    </div>

                    <div dir="ltr" className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-900/30 p-4 rounded-lg">
                         <h3 className="md:col-span-4 text-gray-400 mb-2">{currentLang.fields.englishName}</h3>
                        <FormField label={currentLang.fields.firstName} name="first_name_en" value={formData.first_name_en} onChange={handleNameChange} language={language} error={formErrors.first_name_en} fieldRef={(el) => formRefs.current.first_name_en = el} icon={UserIcon} pattern="[a-zA-Z\s]+" />
                        <FormField label={currentLang.fields.secondName} name="second_name_en" value={formData.second_name_en} onChange={handleNameChange} language={language} error={formErrors.second_name_en} fieldRef={(el) => formRefs.current.second_name_en = el} icon={UserIcon} pattern="[a-zA-Z\s]+" />
                        <FormField label={currentLang.fields.thirdName} name="third_name_en" value={formData.third_name_en} onChange={handleNameChange} language={language} error={formErrors.third_name_en} fieldRef={(el) => formRefs.current.third_name_en = el} icon={UserIcon} pattern="[a-zA-Z\s]+" />
                        <FormField label={currentLang.fields.lastName} name="last_name_en" value={formData.last_name_en} onChange={handleNameChange} language={language} error={formErrors.last_name_en} fieldRef={(el) => formRefs.current.last_name_en = el} icon={UserIcon} pattern="[a-zA-Z\s]+" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField label={currentLang.fields.email} name="email" value={formData.email} onChange={handleFormChange} language={language} error={formErrors.email} fieldRef={(el) => formRefs.current.email = el} icon={EnvelopeIcon} />
                        <PhoneSearchInputField label={currentLang.fields.phone} name="phone_number" value={formData.phone_number} onChange={handleFormChange} error={formErrors.phone_number} fieldRef={(el: any) => formRefs.current.phone_number = el} language={language} allCountries={allCountries || []} currentCountryId={formData.personal_dial_code_id} onCodeChange={(id: string) => handleCodeChange('personal_dial_code_id', id)} />
                        <FormField label={currentLang.fields.gender} name="gender" type="select" value={formData.gender} onChange={handleFormChange} language={language} error={formErrors.gender} fieldRef={(el) => formRefs.current.gender = el} icon={UserIcon}>
                            <option value="">...</option><option value="male">{language === 'ar' ? 'ذكر' : 'Male'}</option><option value="female">{language === 'ar' ? 'أنثى' : 'Female'}</option>
                        </FormField>
                        <CountrySelectField label={currentLang.fields.nationality} name="country" value={formData.country} onChange={handleFormChange} language={language} error={formErrors.country} fieldRef={(el: any) => formRefs.current.country = el} allCountries={allCountries || []} />
                    </div>
                </motion.div>

                {/* 2. البيانات الوظيفية */}
                <motion.div variants={staggeredItemVariants} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 space-y-6">
                     <h2 className="text-2xl font-bold text-gray-100 border-b border-gray-700 pb-2">{currentLang.jobData} <BriefcaseIcon className="inline-block w-6 h-6 text-[#FFD700]" /></h2>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField label={currentLang.fields.jobTitle} name="job_id" type="select" value={formData.job_id} onChange={handleFormChange} language={language} error={formErrors.job_id} fieldRef={(el) => formRefs.current.job_id = el} icon={AcademicCapIcon}>
                             <option value="">...</option>
                             {allJobs && allJobs.map(j => <option key={j.id} value={j.id}>{language === 'ar' ? j.name_ar : j.name_en}</option>)}
                        </FormField>
                        <FormField label={currentLang.fields.employeeId} name="employee_id" value={formData.employee_id} onChange={handleFormChange} language={language} error={formErrors.employee_id} fieldRef={(el) => formRefs.current.employee_id = el} icon={IdentificationIcon} />
                        <FormField label={currentLang.fields.workEmail} name="work_email" value={formData.work_email} onChange={handleFormChange} language={language} error={formErrors.work_email} fieldRef={(el) => formRefs.current.work_email = el} icon={AtSymbolIcon} />
                        <PhoneSearchInputField label={currentLang.fields.workPhone} name="work_phone" value={formData.work_phone} onChange={handleFormChange} error={formErrors.work_phone} fieldRef={(el: any) => formRefs.current.work_phone = el} language={language} allCountries={allCountries || []} currentCountryId={formData.work_dial_code_id} onCodeChange={(id: string) => handleCodeChange('work_dial_code_id', id)} />
                        <FormField label={currentLang.fields.extension} name="landline_phone" value={formData.landline_phone} onChange={handleFormChange} language={language} error={formErrors.landline_phone} fieldRef={(el) => formRefs.current.landline_phone = el} icon={PhoneIcon} maxLength={4} />
                     </div>
                </motion.div>

                {/* 3. بيانات المؤسسة */}
                <motion.div variants={staggeredItemVariants} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 space-y-6">
                    <h2 className="text-2xl font-bold text-gray-100 border-b border-gray-700 pb-2">{currentLang.organizationData} <BuildingStorefrontIcon className="inline-block w-6 h-6 text-[#FFD700]" /></h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField label={currentLang.fields.company} name="company_id" type="select" value={formData.company_id} onChange={handleFormChange} language={language} error={formErrors.company_id} fieldRef={(el) => formRefs.current.company_id = el} icon={BuildingOfficeIcon}>
                             <option value="">...</option>
                             {allCompanies && allCompanies.map(c => <option key={c.id} value={c.id}>{language === 'ar' ? c.name_ar : c.name_en}</option>)}
                        </FormField>
                    </div>

                    <AnimatePresence>
                        {formData.company_id && formData.company_id !== '1' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-6 overflow-hidden">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <FormField label={currentLang.fields.entityEmail} name="company_email" value={formData.company_email} onChange={handleFormChange} language={language} error={formErrors.company_email} fieldRef={(el) => formRefs.current.company_email = el} icon={AtSymbolIcon} />
                                    <PhoneSearchInputField label={currentLang.fields.entityPhone} name="company_phone" value={formData.company_phone} onChange={handleFormChange} error={formErrors.company_phone} fieldRef={(el: any) => formRefs.current.company_phone = el} language={language} allCountries={allCountries || []} currentCountryId={formData.company_dial_code_id} onCodeChange={(id: string) => handleCodeChange('company_dial_code_id', id)} />
                                    <FormField label={currentLang.fields.entityExtension} name="company_landline_phone" value={formData.company_landline_phone} onChange={handleFormChange} language={language} error={formErrors.company_landline_phone} fieldRef={(el) => formRefs.current.company_landline_phone = el} icon={PhoneIcon} />
                                </div>

                                <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 flex gap-6 items-center">
                                    <label className="font-semibold text-gray-200"><PhoneIcon className="w-5 h-5 inline text-[#FFD700]" /> {language === 'ar' ? 'حالة الهاتف' : 'Phone Status'}</label>
                                    <label className="flex items-center text-gray-300"><input type="radio" value="active" checked={entityPhoneStatus === 'active'} onChange={handlePhoneStatusChange} className="mx-2 text-green-500" /> {currentLang.fields.active}</label>
                                    <label className="flex items-center text-gray-300"><input type="radio" value="stopped" checked={entityPhoneStatus === 'stopped'} onChange={handlePhoneStatusChange} className="mx-2 text-red-500" /> {currentLang.fields.stopped}</label>
                                </div>

                                {entityPhoneStatus === 'stopped' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-red-900/30 bg-red-900/10 rounded-lg">
                                        <PhoneSearchInputField label={currentLang.fields.altPhone} name="alternative-phone" value={formData['alternative-phone']} onChange={handleFormChange} error={formErrors['alternative-phone']} fieldRef={(el: any) => formRefs.current['alternative-phone'] = el} language={language} allCountries={allCountries || []} currentCountryId={formData.alternative_dial_code_id} onCodeChange={(id: string) => handleCodeChange('alternative_dial_code_id', id)} />
                                        <FormField label={currentLang.fields.reason} name="reason-company-phone" type="textarea" value={formData['reason-company-phone']} onChange={handleFormChange} language={language} error={formErrors['reason-company-phone']} fieldRef={(el) => formRefs.current['reason-company-phone'] = el} icon={InformationCircleIcon} />
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* أزرار التحكم */}
                <div className="flex items-center justify-end gap-4">
                    <motion.button onClick={() => navigate(-1)} variants={interactiveItemVariants} whileHover="hover" whileTap="tap" className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"><ArrowUturnLeftIcon className="w-5 h-5" />{currentLang.cancel}</motion.button>
                    <motion.button onClick={handleSubmit} variants={interactiveItemVariants} whileHover="hover" whileTap="tap" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg"><CheckCircleIcon className="w-5 h-5" />{currentLang.saveChanges}</motion.button>
                </div>
            </motion.div>
        </MainLayout>
    );
}