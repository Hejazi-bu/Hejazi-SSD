// C:\Users\user\Music\hejazi-logic\src\components\Facility\Shared\SearchableSelect.tsx
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { MagnifyingGlassIcon, ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../../contexts/LanguageContext';

interface SearchableSelectProps {
    collectionName: string;
    parentFilter?: { field: string; value: string } | null;
    onSelect: (item: any) => void;
    label: string;
    placeholder: string;
    initialValue?: { name_ar: string; name_en: string; code?: string };
}

// ✅ تصحيح أمان الأعلام: التحقق من اسم المجموعة
const FlagIcon = ({ code, collectionName }: { code?: string, collectionName: string }) => {
    // لا تعرض الأعلام إلا للمجموعات الجغرافية العليا
    const isGeographic = ['countries', 'emirates', 'regions', 'ref_cities', 'ref_districts', 'ref_sectors'].includes(collectionName);
    
    if (!code || code.length !== 2 || !isGeographic) return null;

    return (
        <img
            src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
            srcSet={`https://flagcdn.com/w80/${code.toLowerCase()}.png 2x`}
            width="24"
            alt={code}
            className="rounded-sm object-cover shadow-sm"
            style={{ display: 'inline-block', marginRight: '8px', marginLeft: '8px' }}
        />
    );
};

export default function SearchableSelect({ collectionName, parentFilter, onSelect, label, placeholder, initialValue }: SearchableSelectProps) {
    const { language } = useLanguage();
    const [items, setItems] = useState<any[]>([]);
    const [filteredItems, setFilteredItems] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    
    const [selectedLabel, setSelectedLabel] = useState("");
    const [selectedCode, setSelectedCode] = useState<string | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState("");
    
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 🔑 FIX: تعيين القيمة الأولية فور توفرها (لحل مشكلة عدم العرض)
    useEffect(() => {
        if (initialValue && initialValue.name_ar) {
            setSelectedLabel(language === 'ar' ? initialValue.name_ar : initialValue.name_en);
            setSelectedCode(initialValue.code);
        } else {
             // 🔑 FIX: إذا اختفت initialValue (بسبب تغيير الأب)، امسح التحديد
            setSelectedLabel("");
            setSelectedCode(undefined);
        }
    }, [initialValue, language]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const colRef = collection(db, collectionName);
                let q;

                if (parentFilter && parentFilter.value) {
                    q = query(colRef, where(parentFilter.field, "==", parentFilter.value), where("is_active", "==", true));
                } else if (parentFilter && !parentFilter.value) {
                    // إذا كان الفلتر موجوداً لكن قيمته فارغة، فلا تجلب شيئاً
                    setItems([]);
                    setFilteredItems([]);
                    setLoading(false);
                    return;
                } else {
                    q = query(colRef, where("is_active", "==", true));
                }

                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setItems(data);
                setFilteredItems(data);
            } catch (error) {
                console.error("Error fetching reference data:", error);
            } finally {
                setLoading(false);
            }
        };

        // 🔑 FIX: لا تبدأ الجلب إلا إذا كان parentFilter موجوداً أو كانت المجموعة ليست جغرافية تابعة
        const isChildGeo = ['ref_cities', 'ref_districts', 'ref_sectors'].includes(collectionName);

        if (collectionName && (!isChildGeo || (parentFilter && parentFilter.value))) {
            fetchData();
        } else if (isChildGeo && !parentFilter?.value) {
            // إذا كنا نتوقع فلتر أب ولكنه مفقود (مثل الحي بدون مدينة)، فامسح القائمة
             setItems([]);
             setFilteredItems([]);
        }
    }, [collectionName, parentFilter]); // يتم إعادة تشغيل useEffect عند تغيير parentFilter

    // ... (بقية useEffects و handleSelect)

    useEffect(() => {
        if (!searchTerm) {
            setFilteredItems(items);
        } else {
            const lowerSearch = searchTerm.toLowerCase();
            setFilteredItems(items.filter(item => 
                (item.name_ar && item.name_ar.includes(searchTerm)) ||
                (item.name_en && item.name_en.toLowerCase().includes(lowerSearch)) ||
                (item.code && item.code.toLowerCase().includes(lowerSearch))
            ));
        }
    }, [searchTerm, items]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (item: any) => {
        onSelect(item);
        setSelectedLabel(language === 'ar' ? item.name_ar : item.name_en);
        setSelectedCode(item.code);
        setIsOpen(false);
        setSearchTerm("");
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
            
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2.5 text-right text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none flex items-center justify-between transition-colors hover:bg-gray-700"
            >
                <div className="flex items-center overflow-hidden">
                    {/* ✅ تمرير collectionName لتأمين العلم */}
                    <FlagIcon code={selectedCode} collectionName={collectionName} />
                    <span className={`truncate ${!selectedLabel ? "text-gray-400" : "text-white font-medium"}`}>
                        {selectedLabel || placeholder}
                    </span>
                </div>
                <ChevronUpDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-[#1a2b42] border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-auto scrollbar-thin scrollbar-thumb-[#FFD700]/30 animate-in fade-in zoom-in-95 duration-100">
                    <div className="sticky top-0 bg-[#1a2b42] p-2 border-b border-gray-700 z-10">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                className="w-full bg-gray-800 border border-gray-600 rounded text-sm text-white px-8 py-2 focus:outline-none focus:border-[#FFD700]"
                                placeholder={language === 'ar' ? "ابحث هنا..." : "Search here..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-4 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                            {language === 'ar' ? "جاري تحميل القائمة..." : "Loading..."}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">
                            {language === 'ar' ? "لا توجد نتائج مطابقة" : "No results found"}
                        </div>
                    ) : (
                        <ul>
                            {filteredItems.map((item) => (
                                <li
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className="px-4 py-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700/50 last:border-0 flex justify-between items-center group transition-colors"
                                >
                                    <div className="flex items-center">
                                        {/* ✅ تمرير collectionName لتأمين العلم */}
                                        <FlagIcon code={item.code} collectionName={collectionName} />
                                        
                                        <div>
                                            <p className="text-white text-sm font-medium group-hover:text-[#FFD700] transition-colors">
                                                {language === 'ar' ? item.name_ar : item.name_en}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {language === 'ar' ? item.name_en : item.name_ar} 
                                                {item.code && <span className="mx-2 px-1.5 bg-gray-800 rounded text-gray-400 font-mono">{item.code}</span>}
                                            </p>
                                        </div>
                                    </div>
                                    {selectedLabel === (language === 'ar' ? item.name_ar : item.name_en) && (
                                        <CheckIcon className="w-5 h-5 text-[#FFD700]" />
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}