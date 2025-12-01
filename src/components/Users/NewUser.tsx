import React, { useEffect, useState, useMemo, useRef, useCallback, ChangeEvent, ReactElement, SVGProps, RefAttributes, ForwardRefExoticComponent } from "react";
import { motion, AnimatePresence } from 'framer-motion';
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
import { collection, query, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions, orderBy, where, FieldPath, documentId } from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db, functions } from '../../lib/firebase';
import {
    EnvelopeIcon,
    UserIcon,
    BriefcaseIcon,
    BuildingOfficeIcon,
    InformationCircleIcon,
    PhoneIcon,
    LockClosedIcon,
    GlobeAltIcon,
    AtSymbolIcon,
    BuildingStorefrontIcon,
    AcademicCapIcon,
    IdentificationIcon,
    XCircleIcon,
    CheckCircleIcon,
    FlagIcon,
    MagnifyingGlassIcon
} from "@heroicons/react/24/outline";
import { useDialog } from "../contexts/DialogContext";
import { useUnsavedChanges } from "../contexts/UnsavedChangesContext";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { getClientContext } from "../../lib/clientContext";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

// --- الدوال المساعدة للتنظيف والتحقق ---

/**
 * تنظيف رقم الهاتف لإزالة المسافات، الحروف غير الرقمية، الأصفار البادئة، ومفاتيح الاتصال الدولية.
 * @param phoneStr السلسلة النصية لرقم الهاتف.
 * @returns السلسلة النصية للرقم النقي.
 */
const sanitizePhoneNumber = (phoneStr: string): string => {
    if (!phoneStr) return '';

    // 1. إزالة جميع الرموز غير الرقمية (بما في ذلك + والمسافات)
    let cleaned = phoneStr.replace(/\D/g, '');

    // 2. إزالة صفر بادئ (إذا كان الرقم يبدأ بـ 0)
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // 3. إزالة مفتاح الإمارات '+971' أو '971' (يمكن توسيعها لدول أخرى شائعة)
    if (cleaned.startsWith('971')) {
        cleaned = cleaned.substring(3);
    }
    
    // 4. إزالة أي أصفار بادئة إضافية قد تكون متبقية
    while (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // لا نتحقق من الطول هنا، بل نرجع الرقم النقي للتحقق منه في handleSubmit
    return cleaned;
};

// --- الأنواع والمحولات والمكونات الداخلية المُحدثة ---

interface Company extends DocumentData { id: string; name_ar: string; name_en?: string; }
interface Job extends DocumentData { id: string; name_ar: string; name_en?: string; }
interface Country extends DocumentData {
    id: string;
    name_ar: string;
    name_en: string;
    dial_code: string;
    flag_emoji: string;
    is_allowed: boolean;
}

// ✨ الواجهة الجديدة لحالة طلب المستخدم ✨
interface NewUserRequestState {
    // 1. البيانات الشخصية
    first_name_ar: string; second_name_ar: string; third_name_ar: string; last_name_ar: string;
    first_name_en: string; second_name_en: string; third_name_en: string; last_name_en: string;
    name_ar: string; name_en: string;
    email: string;
    phone_number: string;
    gender: "male" | "female" | "";
    country: string; // الجنسية (مطلوبة)

    // 2. البيانات الوظيفية
    job_id: string;
    employee_id: string; // أصبح إلزاميًا الآن
    work_email: string;
    work_phone: string;
    landline_phone: string; // رقم التحويلة (4 أرقام)

    // 3. بيانات المؤسسة
    company_id: string;
    company_email: string;
    company_phone: string; // يطبق عليه المفتاح
    company_landline_phone: string;
    'reason-company-phone': string;
    'alternative-phone': string;

    // حالة هاتف المؤسسة (للمنطق الشرطي)
    entity_phone_status: "active" | "stopped";

    // حقول أكواد الاتصال (للحفاظ على كود البلد لكل حقل هاتف)
    personal_dial_code_id: string; // كود الدولة للهاتف الشخصي
    work_dial_code_id: string; // كود الدولة لهاتف العمل
    alternative_dial_code_id: string; // كود الدولة للهاتف البديل
    company_dial_code_id: string; // كود الدولة لهاتف المؤسسة
}

// تحديد الحقول الإلزامية الأساسية للتحقق
type InitialRequiredFields = 'first_name_ar' | 'second_name_ar' | 'third_name_ar' | 'last_name_ar' |
                           'first_name_en' | 'second_name_en' | 'third_name_en' | 'last_name_en' |
                           'email' | 'phone_number' | 'gender' | 'country' |
                           'job_id' | 'company_id' | 'employee_id';

// الحقول التي يتم التحقق منها بشكل خاص (سواء كانت إلزامية أو لا)
type SpecialValidationFields = 'work_email' | 'company_email' | 'landline_phone' | 'alternative-phone' | 'reason-company-phone' | 'employee_id' | 'company_phone' | 'work_phone';

// نوع الأخطاء في النموذج (سلسلة نصية لتخزين رسالة الخطأ المخصصة)
type FormErrors = Partial<Record<InitialRequiredFields | SpecialValidationFields, string>>;

// نوع المفاتيح التي يمكن أن تكون غير صالحة
type InvalidFormKey = InitialRequiredFields | SpecialValidationFields;

// حل مشكلة الخطأ 7053: تعريف نوع المفاتيح الصالحة لكائن الأخطاء
type FormErrorKey = InvalidFormKey; 


type FormRefs = Record<keyof NewUserRequestState, HTMLElement | null>;

const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
    toFirestore: (data: T): DocumentData => data,
    fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T)
});
const companyConverter = createConverter<Company>();
const jobConverter = createConverter<Job>();
const countryConverter = createConverter<Country>();


// ✅ التعديل: توسيع توقيع FormField لاستقبال inputMode و style
interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    name: keyof NewUserRequestState;
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    placeholder?: string;
    language: "ar" | "en";
    error?: string; // أصبح سلسلة نصية
    fieldRef: (el: HTMLElement | null) => void;
    type?: string;
    icon: React.ElementType;
    maxLength?: number;
    pattern?: string;
    disabled?: boolean;
    // إضافة inputMode لتمريره بشكل صحيح
    inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
}

// مكون داخلي لحقل الإدخال
function FormField({
    label, name, value, onChange, placeholder, language, error, fieldRef,
    type = "text", children = null, icon: IconComponent, maxLength, pattern, disabled = false, inputMode
}: FormFieldProps) { // ✅ استخدام الواجهة الموسعة

    const InputComponent = type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input';

    const inputDirection = useMemo(() => {
        const ltrFields: (keyof NewUserRequestState)[] = [
            'email', 'name_en', 'phone_number', 'employee_id', 'work_email', 'work_phone',
            'company_email', 'company_phone', 'company_landline_phone', 'landline_phone', 'alternative-phone',
            'first_name_en', 'second_name_en', 'third_name_en', 'last_name_en' // الأسماء الإنجليزية
        ];
        return ltrFields.includes(name) ? 'ltr' : 'rtl';
    }, [name]);

    return (
        <motion.div
            ref={fieldRef as any}
            // استخدام "error" للتحقق من وجود الرسالة وليس فقط القيمة
            className={`p-4 rounded-lg shadow-md border ${error ? "border-red-500" : (disabled ? "bg-gray-700/30 border-gray-700" : "bg-gray-900/50 border-gray-700")}`}
            variants={{ ...interactiveItemVariants, ...shakeVariants }}
            whileHover="hover"
            animate={error ? "animate" : "initial"}
        >
            <label htmlFor={name} className={`flex items-center mb-2 font-semibold ${disabled ? "text-gray-400" : "text-gray-200"}`}>
                <IconComponent className="w-5 h-5 me-2 text-[#FFD700]" />
                {label}
            </label>
            <InputComponent
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder || '...'}
                type={type === 'select' || type === 'textarea' ? undefined : type}
                className={`w-full p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] ${disabled ? "bg-gray-600/50 cursor-not-allowed" : "bg-gray-700"}
                ${(name === 'employee_id' || name === 'landline_phone') ? 'remove-arrow' : ''}`}
                dir={inputDirection}
                rows={type === 'textarea' ? 3 : undefined}
                maxLength={maxLength}
                pattern={pattern}
                disabled={disabled}
                inputMode={inputMode} // ✅ تمرير inputMode
            >
                {children}
            </InputComponent>
             {error && ( // ✅ عرض رسالة الخطأ أسفل الحقل
                <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-2 text-sm text-red-400 flex items-center"
                >
                    <XCircleIcon className="w-4 h-4 me-1 flex-shrink-0" />
                    {error}
                </motion.p>
            )}
             <style>{`
                .remove-arrow::-webkit-outer-spin-button,
                .remove-arrow::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                .remove-arrow {
                    -moz-appearance: textfield;
                }
            `}</style>
        </motion.div>
    );
}

// مكون اختيار الدولة برمز الهاتف والعلم
function CountrySelectField({
    label, name, value, onChange, error, fieldRef, language, allCountries
}: {
    label: string, name: keyof NewUserRequestState, value: string,
    onChange: (e: ChangeEvent<HTMLSelectElement>) => void,
    error?: string, fieldRef: (el: HTMLElement | null) => void, // ✅ تم التعديل إلى string
    language: "ar" | "en", allCountries: Country[]
}) {

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isRTL = language === 'ar';

    const selectedCountry = (allCountries || []).find((c: Country) => c.id === value);

    // فلترة الدول بناءً على البحث
    const filteredCountries = useMemo(() => {
        const term = cleanText(searchTerm).toLowerCase();
        if (!term) return allCountries;

        // ✅ تحسين البحث ليشمل الفروقات العربية وتوحيد البحث
        return allCountries.filter(c => {
             // ⚠️ ملاحظة: يجب أن تقوم دالة cleanText بتوحيد الهمزات (ا, أ, إ, آ) إلى (ا)
             const arMatch = cleanText(c.name_ar).toLowerCase().includes(term);
             const enMatch = cleanText(c.name_en).toLowerCase().includes(term);
             return arMatch || enMatch;
        });
    }, [allCountries, searchTerm]);

    // معالج اختيار الدولة من القائمة
    const handleCountrySelect = (countryId: string) => {
        onChange({ target: { value: countryId, name: name } } as ChangeEvent<HTMLSelectElement>);
        setIsDropdownOpen(false);
        setSearchTerm('');
    };

    // إغلاق القائمة عند النقر خارجها
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // التركيز على حقل البحث عند فتح القائمة
    useEffect(() => {
        if (isDropdownOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isDropdownOpen]);

    return (
        <motion.div
            ref={fieldRef as any}
            className={`p-4 rounded-lg shadow-md border ${error ? "border-red-500" : "bg-gray-900/50 border-gray-700"}`}
            variants={{ ...interactiveItemVariants, ...shakeVariants }}
            whileHover="hover"
            animate={error ? "animate" : "initial"}
        >
            <label htmlFor={name} className={`flex items-center mb-2 font-semibold text-gray-200`}>
                <FlagIcon className="w-5 h-5 me-2 text-[#FFD700]" />
                {label}
            </label>
             {/* ✅ استبدال select بـ dropdown مخصص (للسماح بالبحث وعرض الإيموجي بشكل سليم) */}
            <div className="relative" ref={dropdownRef}>
                 <button
                    type="button"
                    onClick={() => setIsDropdownOpen(prev => !prev)} // ✅ استخدام واحد فقط
                    className={`w-full flex items-center justify-between p-2.5 bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FFD700] rounded-md text-left text-gray-200`}
                    style={{ minHeight: '40px' }}
                >
                    <span className="flex items-center">
                        {value && selectedCountry?.flag_emoji && <span className="mr-2">{selectedCountry.flag_emoji}{'\u00a0\u00a0'}</span>}
                        {value ? (language === "ar" ? selectedCountry?.name_ar : selectedCountry?.name_en) : (language === "ar" ? "اختر الجنسية..." : "Select Nationality...")}
                    </span>
                    <ChevronDownIcon className="w-4 h-4" />
                </button>
                 {/* القائمة المنسدلة الديناميكية */}
                <AnimatePresence>
                    {isDropdownOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`absolute z-20 w-full max-h-80 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-lg mt-1 ${isRTL ? 'right-0' : 'left-0'}`}
                        >
                            <div className="p-2 border-b border-gray-700 sticky top-0 bg-gray-800">
                                <div className="relative">
                                    <MagnifyingGlassIcon className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400`} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder={language === 'ar' ? 'ابحث بالاسم...' : 'Search name...'}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={`w-full py-2 bg-gray-700 rounded-md text-sm text-gray-200 focus:outline-none ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
                                        dir={language === 'ar' ? 'rtl' : 'ltr'}
                                    />
                                </div>
                            </div>

                            {(filteredCountries.length > 0 ? filteredCountries : allCountries).map((country) => (
                                <div
                                    key={country.id}
                                    className="flex items-center p-2 cursor-pointer hover:bg-gray-700 transition duration-150 text-gray-200 text-sm"
                                    onClick={() => handleCountrySelect(country.id)}
                                >
                                    {/* ✅ توحيد عرض العلم والإيموجي */}
                                    <span className="mr-2">{country.flag_emoji}{'\u00a0\u00a0'}</span>
                                    <span className="flex-grow truncate" dir={language === 'ar' ? 'rtl' : 'ltr'}>{language === 'ar' ? country.name_ar : country.name_en}</span>
                                </div>
                            ))}
                             {filteredCountries.length === 0 && searchTerm && (
                                <p className="p-2 text-center text-sm text-gray-400">{language === 'ar' ? 'لا توجد نتائج' : 'No results found'}</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {error && ( // ✅ عرض رسالة الخطأ أسفل الحقل
                <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-2 text-sm text-red-400 flex items-center"
                >
                    <XCircleIcon className="w-4 h-4 me-1 flex-shrink-0" />
                    {error}
                </motion.p>
            )}
        </motion.div>
    );
}

// ✨ المكون الجديد: حقل إدخال الهاتف مع قائمة منسدلة بحث ديناميكية ✨
function PhoneSearchInputField({
    label, name, value, onChange, error, fieldRef, language, allCountries, currentCountryId, onCodeChange, disabled = false
}: {
    label: string, name: keyof NewUserRequestState, value: string,
    onChange: (e: ChangeEvent<HTMLInputElement>) => void,
    error?: string, fieldRef: (el: HTMLElement | null) => void, // ✅ تم التعديل إلى string
    language: "ar" | "en", allCountries: Country[], currentCountryId: string,
    onCodeChange: (newCountryId: string) => void,
    disabled?: boolean
}): ReactElement {

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // ✅ تعريف isRTL هنا
    const isRTL = language === 'ar';

    const selectedCountry = (allCountries || []).find((c: Country) => c.id === currentCountryId);
    const dialCode = selectedCountry?.dial_code || (currentCountryId === 'AE' ? '+971' : '+...');

    // دالة للحصول على أول رقم متوقع للـ placeholder
    const getCountryPrefix = (countryId: string | undefined): string => {
        // افتراض: دولة الإمارات تبدأ بـ 5. لتمثيل جميع الأرقام المتوقعة
        if (countryId === 'AE') return '5';
        // لـ أي دولة أخرى، يمكن استخدام أي رقم (أو إضافة منطق خاص لدول أخرى)
        return 'X';
    };

    // ✅ التعديل (2 و 3): تعيين التوجيه بناءً على الدولة المختارة
    const firstDigit = currentCountryId ? getCountryPrefix(currentCountryId) : 'X';
    const phonePlaceholder = `${firstDigit}xxxxxxxx`;


    // فلترة الدول بناءً على البحث
    const filteredCountries = useMemo(() => {
        const term = cleanText(searchTerm).toLowerCase();
        if (!term) return allCountries;

        return allCountries.filter(c =>
            cleanText(c.name_ar).toLowerCase().includes(term) ||
            cleanText(c.name_en).toLowerCase().includes(term) ||
            cleanText(c.dial_code).toLowerCase().includes(term)
        );
    }, [allCountries, searchTerm]);

    // معالج اختيار الدولة من القائمة
    const handleCountrySelect = (country: Country) => {
        onCodeChange(country.id);
        setIsDropdownOpen(false);
        setSearchTerm('');
    };

    // إغلاق القائمة عند النقر خارجها
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // التركيز على حقل البحث عند فتح القائمة
    useEffect(() => {
        if (isDropdownOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isDropdownOpen]);

    return (
        <motion.div variants={interactiveItemVariants} whileHover="hover" className={`p-4 rounded-lg shadow-md border ${error ? "border-red-500" : (disabled ? "bg-gray-700/30 border-gray-700" : "bg-gray-900/50 border-gray-700")}`} ref={dropdownRef}>
            <label htmlFor={name} className={`flex items-center mb-2 font-semibold ${disabled ? "text-gray-400" : "text-gray-200"}`}>
                <PhoneIcon className="w-5 h-5 me-2 text-[#FFD700]" /> {label}
            </label>
            <div className="flex w-full relative" dir="ltr">
                {/* زر اختيار كود الدولة (على اليسار دائماً) */}
                <button
                    type="button"
                    onClick={() => { if (!disabled) setIsDropdownOpen(prev => !prev); }}
                    className={`flex-shrink-0 flex items-center justify-between p-2.5 border border-gray-600 transition focus:outline-none focus:ring-2 focus:ring-[#FFD700] rounded-l-md text-gray-200 text-sm`}
                    style={{ width: '150px' }}
                    disabled={disabled}
                >
                    <span className="truncate">{selectedCountry?.flag_emoji || '🌐'} {dialCode}</span>
                    <ChevronDownIcon className="w-4 h-4 ml-1" />
                </button>

                {/* حقل الرقم الفعلي */}
                <input
                    id={name}
                    name={name}
                    type="text"
                    inputMode="numeric"
                    value={value}
                    onChange={onChange}
                    // ✅ التعديل (2 و 3): استخدام الـ placeholder الجديد
                    placeholder={value ? '' : phonePlaceholder}
                    className={`w-full p-2.5 border border-gray-600 border-l-0 focus:outline-none focus:ring-2 focus:ring-[#FFD700] rounded-r-md remove-arrow ${disabled ? 'bg-gray-600/50 cursor-not-allowed' : 'bg-gray-700'}`}
                    dir="ltr"
                    ref={fieldRef as any}
                    pattern="\d+"
                    disabled={disabled}
                />

                {/* القائمة المنسدلة الديناميكية */}
                <AnimatePresence>
                    {isDropdownOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`absolute z-20 w-72 max-h-80 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-lg mt-14 ${isRTL ? 'right-0' : 'left-0'}`}
                        >
                            <div className="p-2 border-b border-gray-700 sticky top-0 bg-gray-800">
                                <div className="relative">
                                    <MagnifyingGlassIcon className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400`} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder={language === 'ar' ? 'ابحث بالاسم أو الكود' : 'Search name or code'}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={`w-full py-2 bg-gray-700 rounded-md text-sm text-gray-200 focus:outline-none ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'}`}
                                        dir={language === 'ar' ? 'rtl' : 'ltr'}
                                    />
                                </div>
                            </div>

                            {(filteredCountries.length > 0 ? filteredCountries : allCountries).map((country) => (
                                <div
                                    key={country.id}
                                    className="flex items-center p-2 cursor-pointer hover:bg-gray-700 transition duration-150 text-gray-200 text-sm"
                                    onClick={() => handleCountrySelect(country)}
                                >
                                    <span className="mr-2">{country.flag_emoji}{'\u00a0\u00a0'}</span>
                                    <span className="flex-grow truncate" dir={language === 'ar' ? 'rtl' : 'ltr'}>{language === 'ar' ? country.name_ar : country.name_en}</span>
                                    <span className="ml-2 font-semibold text-gray-400 flex-shrink-0">{country.dial_code}</span>
                                </div>
                            ))}
                             {filteredCountries.length === 0 && searchTerm && (
                                <p className="p-2 text-center text-sm text-gray-400">{language === 'ar' ? 'لا توجد نتائج' : 'No results found'}</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {error && ( // ✅ عرض رسالة الخطأ أسفل الحقل
                <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-2 text-sm text-red-400 flex items-center"
                >
                    <XCircleIcon className="w-4 h-4 me-1 flex-shrink-0" />
                    {error}
                </motion.p>
            )}
        </motion.div>
    );
}

// مكون المحتوى الرئيسي المُحدث
function NewUserContent({
    formData, onFormChange, onNameChange, allCompanies, allJobs, allCountries,
    onSubmit, isSubmitting, translations, formRefs, formErrors,
    canPerformSaveAction, userHasSignature, entityPhoneStatus, onPhoneStatusChange, onCountrySelectChange,
    onPhoneCodeChange
}: any) {
    const { language } = useLanguage();
    const { user, hasPermission, isLoading: isAuthLoading } = useAuth();
    const t = translations[language].common;
    const commonTranslations = translations[language];

    // المنطق الشرطي للمؤسسة
    const isSpecialCompany = formData.company_id === '1';

    // ✅ التعديل: إخفاء كل شيء في حاوية المؤسسة إذا لم يتم اختيار أي مؤسسة
    const isCompanySelected = !!formData.company_id;
    const showEntityFields = isCompanySelected;

    // عرض حقول المؤسسة الأخرى فقط إذا لم يتم اختيار المؤسسة ذات الـ ID 1
    const showEntityOptionalFields = !isSpecialCompany;

    // عرض حقول الهاتف البديل وسبب التوقف فقط إذا كان هاتف المؤسسة "Stopped"
    const showStoppedPhoneFields = entityPhoneStatus === 'stopped' && showEntityOptionalFields;


    return (
        <motion.div variants={staggeredContainerVariants} initial="initial" animate="animate" exit="exit" className="flex-grow bg-gray-800/50 rounded-xl shadow-2xl space-y-8 p-4 sm:p-6 border border-gray-700">

            {/* 1. البيانات الشخصية */}
            <motion.div variants={staggeredItemVariants} className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-100 border-b border-gray-700 pb-2">{commonTranslations.personalData} <UserIcon className="inline-block w-6 h-6 text-[#FFD700]" /></h2>

                {/* حقول الاسم (العربية) */}
                <div dir="rtl" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 border border-gray-700 rounded-lg bg-gray-800/80">
                    <h3 className="lg:col-span-4 text-lg font-semibold text-gray-200">{t.arabicName}</h3>
                    <FormField label={t.firstName} name="first_name_ar" value={formData.first_name_ar} onChange={onNameChange} placeholder="..." language={language} error={formErrors.first_name_ar} fieldRef={(el: any) => formRefs.current['first_name_ar'] = el} icon={UserIcon} pattern="[\u0600-\u06FF\s]+" />
                    <FormField label={t.secondName} name="second_name_ar" value={formData.second_name_ar} onChange={onNameChange} placeholder="..." language={language} error={formErrors.second_name_ar} fieldRef={(el: any) => formRefs.current['second_name_ar'] = el} icon={UserIcon} pattern="[\u0600-\u06FF\s]+" />
                    <FormField label={t.thirdName} name="third_name_ar" value={formData.third_name_ar} onChange={onNameChange} placeholder="..." language={language} error={formErrors.third_name_ar} fieldRef={(el: any) => formRefs.current['third_name_ar'] = el} icon={UserIcon} pattern="[\u0600-\u06FF\s]+" />
                    <FormField label={t.lastName} name="last_name_ar" value={formData.last_name_ar} onChange={onNameChange} placeholder="..." language={language} error={formErrors.last_name_ar} fieldRef={(el: any) => formRefs.current['last_name_ar'] = el} icon={UserIcon} pattern="[\u0600-\u06FF\s]+" />
                </div>

                   {/* حقول الاسم (الإنجليزية) */}
                <div dir="ltr" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 border border-gray-700 rounded-lg bg-gray-800/80">
                    <h3 className="lg:col-span-4 text-lg font-semibold text-gray-200">{t.englishName}</h3>
                    <FormField label={t.firstName} name="first_name_en" value={formData.first_name_en} onChange={onNameChange} placeholder="..." language={language} error={formErrors.first_name_en} fieldRef={(el: any) => formRefs.current['first_name_en'] = el} icon={UserIcon} pattern="[a-zA-Z\s]+" />
                    <FormField label={t.secondName} name="second_name_en" value={formData.second_name_en} onChange={onNameChange} placeholder="..." language={language} error={formErrors.second_name_en} fieldRef={(el: any) => formRefs.current['second_name_en'] = el} icon={UserIcon} pattern="[a-zA-Z\s]+" />
                    <FormField label={t.thirdName} name="third_name_en" value={formData.third_name_en} onChange={onNameChange} placeholder="..." language={language} error={formErrors.third_name_en} fieldRef={(el: any) => formRefs.current['third_name_en'] = el} icon={UserIcon} pattern="[a-zA-Z\s]+" />
                    <FormField label={t.lastName} name="last_name_en" value={formData.last_name_en} onChange={onNameChange} placeholder="..." language={language} error={formErrors.last_name_en} fieldRef={(el: any) => formRefs.current['last_name_en'] = el} icon={UserIcon} pattern="[a-zA-Z\s]+" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField
                        label={t.personalEmail} name="email" type="text" value={formData.email} onChange={onFormChange}
                        placeholder={t.emailPlaceholder} language={language} error={formErrors.email} fieldRef={(el: any) => formRefs.current['email'] = el}
                        icon={EnvelopeIcon} pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
                    />

                    {/* ✅ التعديل: استخدام المكون الجديد للهاتف الشخصي */}
                    <PhoneSearchInputField
                        label={t.personalPhone} name="phone_number" value={formData.phone_number} onChange={onFormChange as any}
                        error={formErrors.phone_number} fieldRef={(el: any) => formRefs.current['phone_number'] = el}
                        language={language} allCountries={allCountries} currentCountryId={formData.personal_dial_code_id} onCodeChange={(id) => onPhoneCodeChange('personal_dial_code_id', id)}
                    />

                    <FormField
                        label={t.gender} name="gender" type="select" value={formData.gender} onChange={onFormChange}
                        language={language} error={formErrors.gender} fieldRef={(el: any) => formRefs.current['gender'] = el}
                        icon={UserIcon}
                    >
                        <option value="">{t.selectGender}</option>
                        <option value="male">{t.male}</option>
                        <option value="female">{t.female}</option>
                    </FormField>

                    <CountrySelectField
                        label={t.nationality} name="country" value={formData.country} onChange={onCountrySelectChange}
                        language={language} error={formErrors.country} fieldRef={(el: any) => formRefs.current['country'] = el}
                        allCountries={allCountries}
                    />
                </div>
            </motion.div>

            {/* 2. البيانات الوظيفية */}
            <motion.div variants={staggeredItemVariants} className="space-y-6 pt-6 border-t border-gray-700">
                <h2 className="text-2xl font-bold text-gray-100 border-b border-gray-700 pb-2">{commonTranslations.jobData} <BriefcaseIcon className="inline-block w-6 h-6 text-[#FFD700]" /></h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField
                        label={t.job_id} name="job_id" type="select" value={formData.job_id} onChange={onFormChange}
                        language={language} error={formErrors.job_id} fieldRef={(el: any) => formRefs.current['job_id'] = el}
                        icon={AcademicCapIcon}
                    >
                        <option value="">{t.selectJob}</option>
                        {allJobs.map((j: Job) => <option key={j.id} value={j.id}>{language === "ar" ? j.name_ar : j.name_en || j.name_ar}</option>)}
                    </FormField>
                    <FormField
                        label={t.employee_id} name="employee_id" type="text" inputMode="numeric" value={formData.employee_id} onChange={onFormChange}
                        placeholder={t.employee_idPlaceholder} language={language} error={formErrors.employee_id} fieldRef={(el: any) => formRefs.current['employee_id'] = el}
                        icon={IdentificationIcon} maxLength={10} pattern="\d{1,10}"
                    />
                    <FormField
                        label={t.workEmail} name="work_email" type="text" value={formData.work_email} onChange={onFormChange}
                        placeholder={t.workEmailPlaceholder} language={language} error={formErrors.work_email} fieldRef={(el: any) => formRefs.current['work_email'] = el}
                        icon={AtSymbolIcon} pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
                    />

                    {/* ✅ التعديل: استخدام المكون الجديد لهاتف العمل */}
                     <PhoneSearchInputField
                        label={t.workPhone} name="work_phone" value={formData.work_phone} onChange={onFormChange as any}
                        error={formErrors.work_phone} fieldRef={(el: any) => formRefs.current['work_phone'] = el}
                        language={language} allCountries={allCountries} currentCountryId={formData.work_dial_code_id} onCodeChange={(id) => onPhoneCodeChange('work_dial_code_id', id)}
                    />

                    <FormField
                        label={t.extensionNumber} name="landline_phone" type="text" inputMode="numeric" value={formData.landline_phone} onChange={onFormChange}
                        placeholder="1234" language={language} error={formErrors.landline_phone} fieldRef={(el: any) => formRefs.current['landline_phone'] = el}
                        icon={PhoneIcon} maxLength={4} pattern="\d{4}"
                    />
                </div>
            </motion.div>

            {/* 3. بيانات المؤسسة */}
            <motion.div variants={staggeredItemVariants} className="space-y-6 pt-6 border-t border-gray-700">
                <h2 className="text-2xl font-bold text-gray-100 border-b border-gray-700 pb-2">{commonTranslations.organizationData} <BuildingStorefrontIcon className="inline-block w-6 h-6 text-[#FFD700]" /></h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField
                        label={t.organization} name="company_id" type="select" value={formData.company_id} onChange={onFormChange}
                        language={language} error={formErrors.company_id} fieldRef={(el: any) => formRefs.current['company_id'] = el}
                        icon={BuildingOfficeIcon}
                    >
                        <option value="">{t.selectOrganization}</option>
                        {allCompanies.map((c: Company) => <option key={c.id} value={c.id}>{language === "ar" ? c.name_ar : c.name_en || c.name_ar}</option>)}
                    </FormField>
                </div>

            <AnimatePresence>
            {showEntityFields && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                >
                <AnimatePresence>
                    {showEntityOptionalFields && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                        >
                            <h3 className="text-lg font-semibold text-gray-300 mt-4">{t.entityContactDetails}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <FormField
                                    label={t.entityEmail} name="company_email" type="text" value={formData.company_email} onChange={onFormChange}
                                    placeholder={t.entityEmailPlaceholder} language={language} error={formErrors.company_email} icon={AtSymbolIcon} disabled={!showEntityOptionalFields}
                                    fieldRef={(el: any) => formRefs.current['company_email'] = el} pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
                                />
                                {/* ✅ التعديل: استخدام PhoneSearchInputField لهاتف المؤسسة */}
                                <PhoneSearchInputField
                                    label={t.entityPhone} name="company_phone" value={formData.company_phone} onChange={onFormChange as any}
                                    error={formErrors.company_phone} fieldRef={(el: any) => formRefs.current['company_phone'] = el}
                                    language={language} allCountries={allCountries} currentCountryId={formData.company_dial_code_id} onCodeChange={(id) => onPhoneCodeChange('company_dial_code_id', id)}
                                    disabled={!showEntityOptionalFields}
                                />
                                <FormField
                                    label={t.entityExtension} name="company_landline_phone" type="text" inputMode="numeric" value={formData.company_landline_phone} onChange={onFormChange}
                                    placeholder="04xxxxxxxx" language={language} error={formErrors.company_landline_phone} icon={PhoneIcon} disabled={!showEntityOptionalFields}
                                    fieldRef={(el: any) => formRefs.current['company_landline_phone'] = el} pattern="\d+"
                                />
                            </div>

                            {/* حالة هاتف المؤسسة (نشط/معطل) */}
                            <div className="p-4 bg-gray-900/50 rounded-lg shadow-md border border-gray-700">
                                <label className="flex items-center mb-2 font-semibold text-gray-200">
                                    <PhoneIcon className="w-5 h-5 me-2 text-[#FFD700]" /> {t.entityPhoneStatus}
                                </label>
                                <div className="flex space-x-4 space-x-reverse">
                                    <label className="flex items-center text-gray-300">
                                        <input
                                            type="radio" name="entity_phone_status" value="active"
                                            checked={entityPhoneStatus === 'active'} onChange={onPhoneStatusChange}
                                            className="form-radio text-green-500"
                                            disabled={!showEntityOptionalFields}
                                        />
                                        <CheckCircleIcon className="w-5 h-5 mx-1 text-green-500" /> {t.active}
                                    </label>
                                    <label className="flex items-center text-gray-300">
                                        <input
                                            type="radio" name="entity_phone_status" value="stopped"
                                            checked={entityPhoneStatus === 'stopped'} onChange={onPhoneStatusChange}
                                            className="form-radio text-red-500"
                                            disabled={!showEntityOptionalFields}
                                        />
                                        <XCircleIcon className="w-5 h-5 mx-1 text-red-500" /> {t.stopped}
                                    </label>
                                </div>
                            </div>

                            <AnimatePresence>
                                {showStoppedPhoneFields && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="space-y-6 mt-4"
                                    >
                                        <h3 className="text-lg font-semibold text-red-400">{t.stoppedPhoneDetails}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* ✅ التعديل: استخدام المكون الجديد للهاتف البديل */}
                                            <PhoneSearchInputField
                                                label={t.alternative_phone} name="alternative-phone" value={formData['alternative-phone']} onChange={onFormChange as any}
                                                error={formErrors['alternative-phone']} fieldRef={(el: any) => formRefs.current['alternative-phone'] = el}
                                                language={language} allCountries={allCountries} currentCountryId={formData.alternative_dial_code_id} onCodeChange={(id) => onPhoneCodeChange('alternative_dial_code_id', id)}
                                            />

                                            <div className="md:col-span-2">
                                                <FormField
                                                    label={t.reason_company_phone} name="reason-company-phone" type="textarea" value={formData['reason-company-phone']} onChange={onFormChange}
                                                    placeholder={t.reason_company_phonePlaceholder} language={language} error={formErrors['reason-company-phone']} icon={InformationCircleIcon}
                                                    fieldRef={(el: any) => formRefs.current['reason-company-phone'] = el}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
                </motion.div>
            )}
            </AnimatePresence>
            </motion.div>

            {/* قسم زر الحفظ (باقي كما هو) */}
            <motion.div variants={staggeredItemVariants}>
                <div className="bg-gray-900/50 border border-yellow-400/50 rounded-lg p-6 mt-4">
                    <h2 className="text-xl font-bold text-[#FFD700] mb-4 text-center">{t.confirmBoxTitle}</h2>
                    <div className="flex flex-col items-center">
                        <div className="relative mt-4 flex flex-col items-center">
                            <motion.button
                                onClick={onSubmit}
                                className="bg-[#FFD700] text-black px-8 py-3 rounded-lg font-bold disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                disabled={isSubmitting || !canPerformSaveAction || !userHasSignature}
                                variants={interactiveItemVariants}
                                whileHover="hover"
                                whileTap="tap"
                            >
                                {isSubmitting ? (language === "ar" ? "جاري الإرسال..." : "Submitting...") : t.save}
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
                                        <span>{commonTranslations.permissionNeededForAction}</span>
                                    </motion.div>
                                )}
                                {!userHasSignature && (
                                    <motion.div
                                        variants={fadeInVariants} initial="initial" animate="animate" exit="exit"
                                        className="mt-3 flex items-center gap-2 text-sm text-red-400"
                                    >
                                        <LockClosedIcon className="w-4 h-4" />
                                        <span>{commonTranslations.noSignatureMessage}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// --- المكون الرئيسي للصفحة المُحدث ---
export default function NewUser() {
    const { language } = useLanguage();
    const { user, hasPermission, isLoading: isAuthLoading } = useAuth();
    const { showDialog } = useDialog();
    const { setPageLoading } = usePageLoading();
    const { showActionLoading, hideActionLoading } = useActionLoading();
    const navigate = useNavigate();
    const { isDirty, setIsDirty } = useUnsavedChanges();

    // حالة هاتف المؤسسة
    const [entityPhoneStatus, setEntityPhoneStatus] = useState<"active" | "stopped">('active');

    // ✨ حالة النموذج الأولي المُحدثة ✨
    const [formData, setFormData] = useState<NewUserRequestState>({
        first_name_ar: "", second_name_ar: "", third_name_ar: "", last_name_ar: "",
        first_name_en: "", second_name_en: "", third_name_en: "", last_name_en: "",
        name_ar: "",
        name_en: "",
        email: "",
        phone_number: "",
        gender: "",
        country: "", // القيمة الافتراضية للجنسية فارغة
        job_id: "",
        employee_id: "",
        work_email: "",
        work_phone: "",
        landline_phone: "",
        company_id: "",
        company_email: "",
        company_phone: "",
        company_landline_phone: "",
        'reason-company-phone': "",
        'alternative-phone': "",
        entity_phone_status: 'active',
        personal_dial_code_id: 'AE',
        work_dial_code_id: 'AE',
        alternative_dial_code_id: 'AE',
        company_dial_code_id: 'AE', // إضافة كود الدولة لهاتف المؤسسة
    });

    // ✅ التعديل: أصبح FormErrors يستخدم سلسلة نصية
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRefs = useRef<FormRefs>({} as FormRefs);
    const [isReady, setIsReady] = useState(false);
    const canPerformSaveAction = hasPermission('sss:13');
    const userHasSignature = !!user?.signature_url;

    // جلب البيانات: الشركات والوظائف والدول
    const [allCompanies, companiesLoading] = useCollectionData<Company>(
        useMemo(() => query(collection(db, "companies").withConverter(companyConverter), orderBy("name_ar")), [])
    );
    const [allJobs, jobsLoading] = useCollectionData<Job>(
        useMemo(() => query(
            collection(db, "jobs").withConverter(jobConverter),
            // ❌ الخطأ السابق: where(FieldPath.documentId(), "==", "3")
            // ✅ الحل الصحيح: استخدام documentId مباشرة
            where(documentId(), "==", "3") 
        ), [])
    );
    const [allCountries, countriesLoading] = useCollectionData<Country>(
        useMemo(() => query(collection(db, "countries").withConverter(countryConverter), orderBy("name_ar")), [])
    );

    // ✨ الترجمة المحدثة لرسائل الأخطاء المخصصة والملاحظات الإضافية ✨
    const translations = useMemo(() => ({
        ar: {
            pageTitle: "طلب مستخدم جديد",
            permissionNeededForAction: "لا تملك صلاحية طلب إنشاء مستخدم جديد.",
            permissionDeniedOnSubmitTitle: "تم رفض الإجراء",
            permissionDeniedOnSubmitMessage: "لقد تغيرت صلاحياتك ولم يعد بإمكانك تنفيذ هذا الإجراء. سيتم تحديث الصفحة.",
            noSignatureTitle: "التوقيع مطلوب",
            noSignatureMessage: "يجب عليك رفع توقيعك في ملفك الشخصي أولاً قبل إرسال طلب.",

            personalData: "1. البيانات الشخصية",
            jobData: "2. البيانات الوظيفية",
            organizationData: "3. بيانات المؤسسة",

            common: {
                confirmSaveTitle: "تأكيد الإرسال",
                confirmSaveMessage: "هل أنت متأكد من إرسال طلب إنشاء هذا المستخدم للموافقة؟",
                validationErrorTitle: "خطأ في الإدخال", 
                validationErrorMessage: "يرجى تصحيح الأخطاء المشار إليها باللون الأحمر.", 
                
                // ✅ إضافة رسائل الملاحظات الاختيارية
                optionalNotesTitle: "ملاحظات إضافية (اختياري)",
                optionalNotesMessage: "أضف أي ملاحظات إضافية ضرورية لعملية إنشاء المستخدم.",

                // رسائل التحقق المخصصة
                requiredField: "هذا الحقل إلزامي.",
                validationErrorPhoneLength: "يجب أن يتكون رقم الهاتف من 9 أرقام (بدون المفتاح أو الصفر البادئ).",
                validationErrorExtension: "يجب أن يكون رقم التحويلة 4 أرقام.",
                validationErrorEmployeeID: "يجب أن يتكون الرقم الوظيفي من أرقام فقط (حد أقصى 10).",
                validationErrorArabicFormat: "يجب كتابة الحقل باللغة العربية فقط.",
                validationErrorEnglishFormat: "يجب كتابة الحقل باللغة الإنجليزية فقط.",
                validationErrorEmailFormat: "صيغة البريد الإلكتروني غير صحيحة.",

                // رسائل أخطاء التكرار (تأتي من الباك إند - مثال)
                duplicateEmail: "هذا البريد الإلكتروني مسجل مسبقاً في النظام.",
                duplicatePersonalPhone: "رقم الهاتف الشخصي هذا مسجل مسبقاً.",
                duplicateEmployeeID: "الرقم الوظيفي هذا مسجل مسبقاً.",

                // ... (باقي الترجمات)
                successTitle: "نجاح",
                successMessage: "تم إرسال طلب إنشاء المستخدم بنجاح.",
                errorTitle: "خطأ",
                genericErrorMessage: "حدث خطأ أثناء إرسال الطلب.",
                savingMessage: "جاري إرسال الطلب وإنشاء المهمة...",
                arabicName: "الاسم (بالعربية)",
                englishName: "الاسم (بالإنجليزية)",
                firstName: "الاسم الأول",
                secondName: "الاسم الثاني",
                thirdName: "الاسم الثالث",
                lastName: "اسم العائلة",
                personalEmail: "البريد الإلكتروني الشخصي",
                personalPhone: "رقم الهاتف الشخصي",
                emailPlaceholder: "example@domain.com",
                phonePlaceholder: "5xxxxxxxx",
                gender: "الجنس",
                selectGender: "اختر الجنس...",
                male: "ذكر",
                female: "أنثى",
                nationality: "الجنسية",
                selectCountry: "اختر الجنسية...",
                job_id: "المسمى الوظيفي",
                selectJob: "اختر المسمى الوظيفي...",
                employee_id: "الرقم الوظيفي",
                employee_idPlaceholder: "12345",
                workEmail: "بريد العمل",
                workEmailPlaceholder: "work.email@domain.com",
                workPhone: "هاتف العمل",
                extensionNumber: "رقم التحويلة",
                organization: "المؤسسة/المنشأة",
                selectOrganization: "اختر المؤسسة...",
                entityContactDetails: "بيانات الاتصال بالمؤسسة (بريد/هاتف)",
                entityEmail: "بريد المؤسسة",
                entityEmailPlaceholder: "entity.email@organization.com",
                entityPhone: "هاتف المؤسسة",
                entityExtension: "تحويلة المؤسسة",
                entityPhoneStatus: "حالة هاتف المؤسسة",
                active: "نشط",
                stopped: "معطل",
                stoppedPhoneDetails: "تفاصيل الهاتف المعطل",
                reason_company_phone: "سبب توقف هاتف المؤسسة",
                reason_company_phonePlaceholder: "سبب عدم توافر أو عمل هاتف المؤسسة...",
                alternative_phone: "رقم هاتف بديل",
                save: "إرسال الطلب"
            }
        },
        en: {
            pageTitle: "New User Request",
            permissionNeededForAction: "You do not have permission to request a new user.",
            permissionDeniedOnSubmitTitle: "Action Denied",
            permissionDeniedOnSubmitMessage: "Your permissions have changed, and you can no longer perform this action. The page will be updated.",
            noSignatureTitle: "Signature Required",
            noSignatureMessage: "You must upload your signature in your profile before submitting a request.",

            personalData: "1. Personal Data",
            jobData: "2. Job Data",
            organizationData: "3. Organization Data",

            common: {
                 confirmSaveTitle: "Confirm Submission",
                 confirmSaveMessage: "Are you sure you want to submit this new user request for approval?",
                 validationErrorTitle: "Input Error", 
                 validationErrorMessage: "Please correct the errors indicated in red.", 

                 // ✅ إضافة رسائل الملاحظات الاختيارية
                 optionalNotesTitle: "Additional Notes (Optional)",
                 optionalNotesMessage: "Add any additional notes necessary for the user creation process.",

                 // رسائل التحقق المخصصة
                requiredField: "This field is required.",
                validationErrorPhoneLength: "The phone number must be 9 digits (excluding dial code or leading zero).",
                validationErrorExtension: "Extension number must be 4 digits.",
                validationErrorEmployeeID: "Employee ID must be numbers only (max 10 digits).",
                validationErrorArabicFormat: "Field must be in Arabic only.",
                validationErrorEnglishFormat: "Field must be in English only.",
                validationErrorEmailFormat: "Invalid email format.",

                // رسائل أخطاء التكرار
                duplicateEmail: "This email address is already registered.",
                duplicatePersonalPhone: "This personal phone number is already registered.",
                duplicateEmployeeID: "This Employee ID is already registered.",

                // ... (باقي الترجمات)
                 successTitle: "Success",
                 successMessage: "User request submitted successfully.",
                 errorTitle: "Error",
                 genericErrorMessage: "An error occurred while submitting the request.",
                 savingMessage: "Submitting request and creating task...",
                arabicName: "Name (Arabic)",
                englishName: "Name (English)",
                firstName: "First Name",
                secondName: "Second Name",
                thirdName: "Third Name",
                lastName: "Last Name",
                personalEmail: "Personal Email",
                personalPhone: "Personal Phone Number",
                emailPlaceholder: "example@domain.com",
                phonePlaceholder: "5xxxxxxxx",
                gender: "Gender",
                selectGender: "Select gender...",
                male: "Male",
                female: "Female",
                nationality: "Nationality",
                selectCountry: "Select Nationality...",
                job_id: "Job Title",
                selectJob: "Select job title...",
                employee_id: "Employee ID",
                employee_idPlaceholder: "12345",
                workEmail: "Work Email",
                workEmailPlaceholder: "work.email@domain.com",
                workPhone: "Work Phone",
                extensionNumber: "Extension Number",
                organization: "Organization/Entity",
                selectOrganization: "Select Organization...",
                entityContactDetails: "Entity Contact Details (Email/Phone)",
                entityEmail: "Entity Email",
                entityEmailPlaceholder: "entity.email@organization.com",
                entityPhone: "Entity Phone",
                entityExtension: "Entity Extension",
                entityPhoneStatus: "Entity Phone Status",
                active: "Active",
                stopped: "Stopped",
                stoppedPhoneDetails: "Stopped Phone Details",
                reason_company_phone: "Reason for Entity Phone Stoppage",
                reason_company_phonePlaceholder: "Reason the entity phone is unavailable or not working...",
                alternative_phone: "Alternative Phone Number",
                save: "Submit Request"
            }
        }
    }), [language]);

    const t = translations[language].common;
    const commonTranslations = translations[language];

    // دالة لتغيير حقول الاسم الأربعة وتجميعها
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newForm = { ...prev, [name]: value } as NewUserRequestState;

            // تجميع الاسم العربي
            if (name.endsWith('_ar')) {
                const parts = [newForm.first_name_ar, newForm.second_name_ar, newForm.third_name_ar, newForm.last_name_ar];
                newForm.name_ar = parts.filter(p => cleanText(p)).join(' ');
            }
            // تجميع الاسم الإنجليزي
            if (name.endsWith('_en')) {
                const parts = [newForm.first_name_en, newForm.second_name_en, newForm.third_name_en, newForm.last_name_en];
                newForm.name_en = parts.filter(p => cleanText(p)).join(' ');
            }
            return newForm;
        });
        // إزالة الخطأ عند بدء الكتابة
        if (formErrors[name as FormErrorKey]) {
            setFormErrors(prev => ({ ...prev, [name as FormErrorKey]: undefined })); 
        }
    };

    // معالج تغيير المدخلات العامة (لغير حقول الاسم)
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
               const newForm = { ...prev, [name]: value } as NewUserRequestState;

               // ✨ المنطق الشرطي للمؤسسة ✨
               if (name === 'company_id') {
                   // عند اختيار المؤسسة ID: 1، تصفير حقول المؤسسة الإضافية
                   if (value === '1') {
                       newForm.company_email = '';
                       newForm.company_phone = '';
                       newForm.company_landline_phone = '';
                       newForm['reason-company-phone'] = '';
                       newForm['alternative-phone'] = '';
                       newForm.entity_phone_status = 'active';
                       setEntityPhoneStatus('active');
                   }
               }

               return newForm;
        });
        // إزالة الخطأ عند بدء الكتابة
        if (formErrors[name as FormErrorKey]) {
            setFormErrors(prev => ({ ...prev, [name as FormErrorKey]: undefined })); 
        }
    };

    // ✅ دالة مخصصة لتحديث حقل كود الدولة (للهاتف الشخصي/العمل/البديل/المؤسسة)
    const handlePhoneCodeChange = useCallback((field: 'personal_dial_code_id' | 'work_dial_code_id' | 'alternative_dial_code_id' | 'company_dial_code_id', newCountryId: string) => {
        setFormData(prev => {
            const updatedState = { ...prev, [field]: newCountryId };
            // مسح الرقم الشخصي أو هاتف المؤسسة عند تغيير الكود لتفادي مشاكل الأرقام
            if (field === 'personal_dial_code_id') {
                updatedState.phone_number = '';
                if (formErrors.phone_number) {
                    setFormErrors(prev => ({ ...prev, phone_number: undefined }));
                }
            } else if (field === 'company_dial_code_id') { // ✅ التعديل: مسح رقم المؤسسة
                updatedState.company_phone = '';
                if (formErrors.company_phone) {
                    setFormErrors(prev => ({ ...prev, company_phone: undefined }));
                }
            }
            return updatedState;
        });
    }, [formErrors.phone_number, formErrors.company_phone]);

    // معالج تغيير حقل اختيار الجنسية
    const handleCountrySelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const countryId = e.target.value;
        setFormData(prev => ({ ...prev, country: countryId }));
          // إزالة الخطأ عند بدء الكتابة
        if (formErrors.country) {
            setFormErrors(prev => ({ ...prev, country: undefined }));
        }
    };


    // معالج تغيير حالة هاتف المؤسسة
    const handlePhoneStatusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const status = e.target.value as "active" | "stopped";
        setEntityPhoneStatus(status);
        setFormData(prev => {
            const newForm = { ...prev, entity_phone_status: status } as NewUserRequestState;
            if (status === 'active') {
                // يتم حفظ حقول التوقف كفارغة إذا كانت الحالة نشطة
                newForm['reason-company-phone'] = '';
                newForm['alternative-phone'] = '';
            }
            return newForm;
        });
    };

    // ... (بقية الـ useEffects لـ isDirty و BeforeUnload تبقى كما هي)

    const dataIsLoading = isAuthLoading || companiesLoading || jobsLoading || countriesLoading;

    useEffect(() => {
        if (dataIsLoading || isReady) {
            return;
        }
        setIsReady(true);
    }, [dataIsLoading, isReady]);

    useEffect(() => {
        setPageLoading(!isReady);
    }, [isReady, setPageLoading]);


    // ✅ تصحيح: تعريف resetForm في نطاق NewUser الرئيسي
    const resetForm = useCallback(() => {
        setFormData({
            first_name_ar: "", second_name_ar: "", third_name_ar: "", last_name_ar: "",
            first_name_en: "", second_name_en: "", third_name_en: "", last_name_en: "",
            name_ar: "",
            name_en: "",
            email: "",
            phone_number: "",
            gender: "",
            country: "", // القيمة الافتراضية للجنسية فارغة
            job_id: "",
            employee_id: "",
            work_email: "",
            work_phone: "",
            landline_phone: "",
            company_id: "",
            company_email: "",
            company_phone: "",
            company_landline_phone: "",
            'reason-company-phone': "",
            'alternative-phone': "",
            entity_phone_status: 'active',
            personal_dial_code_id: 'AE',
            work_dial_code_id: 'AE',
            alternative_dial_code_id: 'AE',
            company_dial_code_id: 'AE',
        });
        setFormErrors({});
        setIsDirty(false);
    }, [setIsDirty]);


    // ✨ منطق التحقق والإرسال المُحدث ✨
    const handleSubmit = async () => {
        // 1. التحقق من الصلاحية والتوقيع (باقي كما هو)
        if (!userHasSignature) {
            showDialog({ variant: 'alert', title: translations[language].noSignatureTitle, message: translations[language].noSignatureMessage });
            return;
        }
        if (!canPerformSaveAction) {
            showDialog({ variant: 'alert', title: translations[language].permissionDeniedOnSubmitTitle, message: translations[language].permissionDeniedOnSubmitMessage });
            return;
        }

        // 2. التحقق من صحة البيانات
        const errors: FormErrors = {};
        const requiredFields: InitialRequiredFields[] = [
            'first_name_ar', 'second_name_ar', 'third_name_ar', 'last_name_ar',
            'first_name_en', 'second_name_en', 'third_name_en', 'last_name_en',
            'email', 'phone_number', 'gender', 'country',
            'job_id', 'company_id', 'employee_id' // الرقم الوظيفي أصبح إلزاميًا
        ];

        let firstInvalidKey: InvalidFormKey | null = null;

        // التحقق من الصيغ الخاصة (Regex)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const arabicRegex = /^[\u0600-\u06FF\s]+$/;
        const englishRegex = /^[a-zA-Z\s]+$/;
        const PHONE_LENGTH = 9; // الطول الثابت المتوقع للرقم النقي (مثل 5xxxxxxxx)

        // دالة مساعدة لتحديد رسالة الخطأ للحقل الإلزامي
        const setRequiredError = (key: InvalidFormKey) => {
            errors[key] = t.requiredField; // ✅ استخدام رسالة مخصصة
            if (!firstInvalidKey) firstInvalidKey = key;
        };
        // دالة مساعدة لتحديد رسالة الخطأ لعدم المطابقة
        const setFormatError = (key: InvalidFormKey, message: string) => {
            errors[key] = message; // ✅ استخدام رسالة مخصصة
            if (!firstInvalidKey) firstInvalidKey = key;
        };

        // 1. التحقق من الإلزامية
        for (const key of requiredFields) {
            const value = formData[key];
            if (!value || cleanText(value).length === 0) {
                setRequiredError(key);
            }
        }


        // 2. التحقق من الصيغ الخاصة
        // حقول الاسم العربية
        const arabicNameFields: (keyof NewUserRequestState)[] = ['first_name_ar', 'second_name_ar', 'third_name_ar', 'last_name_ar'];
        arabicNameFields.forEach(key => {
              if (formData[key] && !arabicRegex.test(formData[key])) {
                setFormatError(key as InvalidFormKey, t.validationErrorArabicFormat);
            }
        });
        // حقول الاسم الإنجليزية
        const englishNameFields: (keyof NewUserRequestState)[] = ['first_name_en', 'second_name_en', 'third_name_en', 'last_name_en'];
        englishNameFields.forEach(key => {
            if (formData[key] && !englishRegex.test(formData[key])) {
                setFormatError(key as InvalidFormKey, t.validationErrorEnglishFormat);
            }
        });

        // البريد الشخصي
        if (formData.email && !emailRegex.test(formData.email)) { setFormatError('email', t.validationErrorEmailFormat); }
        // البريد العملي (اختياري)
        if (formData.work_email && cleanText(formData.work_email).length > 0 && !emailRegex.test(formData.work_email)) { setFormatError('work_email', t.validationErrorEmailFormat); }
        // بريد المؤسسة (اختياري)
        if (formData.company_email && cleanText(formData.company_email).length > 0 && !emailRegex.test(formData.company_email)) { setFormatError('company_email', t.validationErrorEmailFormat); }

        // الرقم الوظيفي
        if (formData.employee_id && cleanText(formData.employee_id).length > 0 && !/^\d{1,10}$/.test(formData.employee_id)) { setFormatError('employee_id', t.validationErrorEmployeeID); }
        // رقم التحويلة
        if (formData.landline_phone && cleanText(formData.landline_phone).length > 0 && !/^\d{4}$/.test(formData.landline_phone)) { setFormatError('landline_phone', t.validationErrorExtension); }

        // التحقق من طول الرقم الهاتفي (لـ 9 أرقام بعد التنظيف)
        const validatePhoneNumberStrict = (rawPhone: string, key: InvalidFormKey) => {
            if (rawPhone && !errors[key]) { // التحقق فقط إذا لم يكن هناك خطأ إلزامي أو سابق
                const cleaned = sanitizePhoneNumber(rawPhone);
                if (cleaned.length !== PHONE_LENGTH) {
                    setFormatError(key, t.validationErrorPhoneLength);
                }
            }
        };

        validatePhoneNumberStrict(formData.phone_number, 'phone_number');
        if (formData.work_phone && cleanText(formData.work_phone).length > 0) {
            validatePhoneNumberStrict(formData.work_phone, 'work_phone');
        }
        // 7. هاتف المؤسسة إلزامي لغير ID: 1
        if (formData.company_id !== '1' && (!formData.company_phone || cleanText(formData.company_phone).length === 0)) {
            setRequiredError('company_phone');
        } else if (formData.company_id !== '1' && formData.company_phone) {
            validatePhoneNumberStrict(formData.company_phone, 'company_phone');
        }


        // منطق التحقق الإضافي لـ "معطل"
        if (formData.company_id !== '1' && entityPhoneStatus === 'stopped') {
            const alternativePhoneField = 'alternative-phone' as InvalidFormKey;
            const reasonField = 'reason-company-phone' as InvalidFormKey;

            // التحقق من إلزامية الهاتف البديل
            if (!formData[alternativePhoneField] || cleanText(formData[alternativePhoneField]).length === 0) {
                  setRequiredError(alternativePhoneField);
            } else {
                 // التحقق من طول الهاتف البديل
                validatePhoneNumberStrict(formData[alternativePhoneField], alternativePhoneField);
            }

            // التحقق من إلزامية السبب
            if (!formData[reasonField] || cleanText(formData[reasonField]).length === 0) {
                  setRequiredError(reasonField);
            }
        }


        if (firstInvalidKey || Object.keys(errors).length > 0) {
            setFormErrors({});
            setTimeout(() => {
                
                // ✅ الحل لمشكلة الخطأ 7053: استخدام FormErrorKey لتأكيد نوع المفاتيح
                const errorKeys = Object.keys(errors) as FormErrorKey[];
                
                const firstErrorKey = (requiredFields as FormErrorKey[]).find(key => errors[key]) || 
                                      errorKeys.find(key => errors[key]);
                
                // التأكد من أن المفتاح موجود وقابل للاستخدام في formRefs
                const finalErrorKey = firstErrorKey as InvalidFormKey; 

                const firstInvalidRef = formRefs.current[finalErrorKey]; // ✅ استخدام المفتاح المؤكد
                if (firstInvalidRef) {
                    firstInvalidRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                setTimeout(() => {
                    const finalErrors = { ...errors };
                    setFormErrors(finalErrors);
                    showDialog({ variant: 'alert', title: translations[language].common.validationErrorTitle, message: translations[language].common.validationErrorMessage });
                }, 400);
            }, 50);
            return;
        }

        // 3. نافذة التأكيد (السابقة) يتم استبدالها بنافذة مطالبة اختيارية
        
        // ✨ خطوة جديدة: نافذة الملاحظات الاختيارية (Prompt) ✨
        showDialog({
            variant: 'prompt',
            title: t.optionalNotesTitle,
            message: t.optionalNotesMessage,
            icon: InformationCircleIcon,
            color: 'blue',
            isDismissable: true,
            validation: (notes) => { return null; }, // ✅ الملاحظات اختيارية (دائماً نرجع null)
            onConfirm: (notes) => {
                const cleanedNotes = cleanText(notes || '');
                performSubmit(cleanedNotes); // استدعاء دالة الإرسال مع الملاحظات
            }
        });
    };
    
    // ✨ دالة الإرسال الفعلية التي تستقبل الملاحظات ✨
    const performSubmit = async (notes: string) => {
        setIsSubmitting(true);
        setIsDirty(false);
        showActionLoading(t.savingMessage);
        try {
            const clientContext = await getClientContext();

            // 4. بناء الـ Payload النهائي
            const allCountriesData = (allCountries || []);

            const getDialCode = (countryId: string | undefined): string => {
                const country = allCountriesData.find(c => c.id === countryId);
                return country?.dial_code || '+971';
            };

            const isCompany1 = formData.company_id === '1';

            const baseData: Record<string, unknown> = {
                // الحقول الإلزامية التي ستُحفظ في الواجهة الخلفية
                name_ar: formData.name_ar, name_en: formData.name_en,
                email: formData.email,
                phone_number: getDialCode(formData.personal_dial_code_id) + sanitizePhoneNumber(formData.phone_number),
                gender: formData.gender, country: formData.country,
                job_id: Number(formData.job_id), employee_id: formData.employee_id, company_id: formData.company_id,

                // حقول الاسم الأربعة الجديدة (للحفظ)
                first_name_ar: formData.first_name_ar, second_name_ar: formData.second_name_ar, third_name_ar: formData.third_name_ar, last_name_ar: formData.last_name_ar,
                first_name_en: formData.first_name_en, second_name_en: formData.second_name_en, third_name_en: formData.third_name_en, last_name_en: formData.last_name_en,

                // حقول العمل
                work_email: formData.work_email,
                work_phone: formData.work_phone ? (getDialCode(formData.work_dial_code_id) + sanitizePhoneNumber(formData.work_phone)) : '',
                landline_phone: formData.landline_phone, // رقم التحويلة (4 أرقام)
                
                // ✅ إضافة الملاحظات الاختيارية إلى الحمولة
                notes: notes,
            };

            let optionalData: Record<string, unknown> = {};

            if (!isCompany1) {
                // المنطق الشرطي لحقول المؤسسة (يتم تضمينها فقط إذا لم يتم اختيار ID: 1)
                optionalData = {
                    company_email: formData.company_email,
                    company_phone: formData.company_phone ? (getDialCode(formData.company_dial_code_id) + sanitizePhoneNumber(formData.company_phone)) : '',
                    company_landline_phone: formData.company_landline_phone,
                };

                if (entityPhoneStatus === 'stopped') {
                    optionalData['reason-company-phone'] = formData['reason-company-phone'];
                    optionalData['alternative-phone'] = formData['alternative-phone'] ? (getDialCode(formData.alternative_dial_code_id) + sanitizePhoneNumber(formData['alternative-phone'])) : '';
                } else {
                    // يتم حفظ حقول التوقف كفارغة إذا كانت الحالة نشطة
                    optionalData['reason-company-phone'] = '';
                    optionalData['alternative-phone'] = '';
                }
            } else {
                // إذا كانت المؤسسة ID: 1، يتم حفظ جميع الحقول الخاصة بالمؤسسة كفارغة (للتأكد من أنها لا ترسل شيئًا)
                optionalData = {
                    company_email: '',
                    company_phone: '',
                    company_landline_phone: '',
                    'reason-company-phone': '',
                    'alternative-phone': '',
                };
            }

            const requestDataToSend = { ...baseData, ...optionalData };

            // تنظيف الكائن من القيم الفارغة قبل الإرسال (work_phone و company_phone الفارغين سيتم حذفهما)
            Object.keys(requestDataToSend).forEach(key => {
                const value = requestDataToSend[key];
                // يتم حذف القيم Null، السلاسل الفارغة بعد التنظيف، والسلاسل الفارغة
                if (value === null || (typeof value === 'string' && cleanText(value).length === 0) || value === "") {
                    delete requestDataToSend[key];
                }
            });


            const requestUser = httpsCallable(functions, 'requestNewUser');

            await requestUser({
                requestData: requestDataToSend,
                clientContext
            });

            // نجاح
            resetForm();
            showDialog({
                variant: 'success', title: translations[language].common.successTitle, message: translations[language].common.successMessage,
                onConfirm: () => {
                    navigate('/tasks');
                }
            });

        } catch (error: any) {
            // ✅ منطق معالجة أخطاء الباك إند المخصصة
            const errorCode = error.code || '';
            const fieldErrorMap: { [key: string]: { field: InvalidFormKey, message: string } } = {
                'exists/email': { field: 'email', message: t.duplicateEmail },
                'exists/phone_number': { field: 'phone_number', message: t.duplicatePersonalPhone },
                'exists/employee_id': { field: 'employee_id', message: t.duplicateEmployeeID },
            };

            if (fieldErrorMap[errorCode]) {
                const { field, message } = fieldErrorMap[errorCode];
                setFormErrors({ [field]: message }); // إظهار رسالة الخطأ أسفل الحقل المحدد
                showDialog({ variant: 'alert', title: t.errorTitle, message: message }); // إظهار رسالة الخطأ في دايلوج أيضاً
                const errorRef = formRefs.current[field];
                if (errorRef) errorRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                showDialog({ variant: 'alert', title: translations[language].common.errorTitle, message: error.message || translations[language].common.genericErrorMessage });
            }
            setIsDirty(true);
        } finally {
            hideActionLoading();
            setIsSubmitting(false);
        }
    };


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
                <NewUserContent
                    formData={formData}
                    onFormChange={handleFormChange}
                    onNameChange={handleNameChange}
                    onCountrySelectChange={handleCountrySelectChange}
                    onPhoneCodeChange={handlePhoneCodeChange}
                    entityPhoneStatus={entityPhoneStatus}
                    onPhoneStatusChange={handlePhoneStatusChange}
                    allCompanies={allCompanies || []}
                    allJobs={allJobs || []}
                    allCountries={allCountries || []}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    translations={translations}
                    formRefs={formRefs}
                    formErrors={formErrors}
                    showDialog={showDialog}
                    userHasSignature={userHasSignature}
                    canPerformSaveAction={canPerformSaveAction}
                />
            </motion.div>
        </AnimatePresence>
    );
}