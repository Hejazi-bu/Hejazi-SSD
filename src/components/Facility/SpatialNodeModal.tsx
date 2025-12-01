// C:\Users\user\Music\hejazi-logic\src\components\Facility\SpatialNodeModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, CheckIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { scaleInModalVariants } from '../../lib/animations';
import { useLanguage } from '../contexts/LanguageContext';
import { SPATIAL_HIERARCHY, SpatialTarget } from './config/SpatialConfig';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import SearchableSelect from './Shared/SearchableSelect';

interface SpatialNodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    target: SpatialTarget;
    parentId: string | null;
    parentReferenceId?: string | null;
    initialData?: any;
    isSubmitting: boolean;

    isAddingOutdoorZone?: boolean; // Zone under Site
    isAddingOutdoorUnit?: boolean; // Unit under Zone
}

// ثوابت الهيكلية الجغرافية
const GEOGRAPHY_HIERARCHY: SpatialTarget[] = ['country', 'emirate', 'region', 'city', 'district', 'sector'];
const DEFAULT_REGION_ID = "ADM";
const DEFAULT_COUNTRY_ID = "UAE";
const DEFAULT_EMIRATE_ID = "AUH";

// دالة مساعدة لتنظيف البيانات قبل الإرسال
function cleanDataBeforeSubmit(obj: any): any {
    if (obj === undefined || obj === null || Number.isNaN(obj)) return null;
    if (typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(v => cleanDataBeforeSubmit(v)).filter(v => v !== null);
    }

    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
        const value = cleanDataBeforeSubmit(obj[key]);
        if (value !== null) {
            cleaned[key] = value;
        }
    });
    return cleaned;
}

// ----------------------------------------------------------------------
// مكون عرض التسلسل الهرمي للقراءة فقط (Read-Only Hierarchy Display)
// ----------------------------------------------------------------------
function ReadonlyHierarchyDisplay({ itemData, language }: { itemData: any, language: 'ar' | 'en' }) {
    // 🔑 نستخدم أسماء الحقول الهرمية الموسعة (مثل city_name_ar) لضمان الوصف الكامل
    const geoPath = GEOGRAPHY_HIERARCHY.map(level => {
        const idKey = `${level}_id`;
        const nameKey = `${level}_name_ar`;
        if (itemData[idKey] && itemData[nameKey]) {
            return {
                label: SPATIAL_HIERARCHY[level].label_ar,
                name: itemData[nameKey],
                code: itemData[`${level}_code`]
            };
        }
        return null;
    }).filter(item => item !== null);

    // إضافة المستوى الأب المباشر
    const parentTargetKeys: SpatialTarget[] = ['site', 'building', 'zone', 'floor', 'unit'];
    parentTargetKeys.forEach(level => {
        const idKey = `${level}_id`;
        const nameKey = `${level}_name_ar`;
        if (itemData[idKey] && itemData[nameKey] && !geoPath.some(item => item && item.label === SPATIAL_HIERARCHY[level].label_ar)) {
            geoPath.push({
                label: SPATIAL_HIERARCHY[level].label_ar,
                name: itemData[nameKey],
                code: itemData[`${level}_code`]
            });
        }
    });

    if (geoPath.length === 0) return null;

    return (
        <div className="space-y-3 bg-gray-800/30 p-4 rounded-lg border border-gray-700">
            <h4 className="text-[#FFD700] text-sm font-bold flex items-center gap-2">
                <MapPinIcon className="w-4 h-4" />
                {language === 'ar' ? 'الموقع الجغرافي المسجل' : 'Registered Geographic Location'}
            </h4>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {geoPath.map((item, index) => (
                    <div key={index} className="flex flex-col">
                        <span className="text-gray-400 font-medium">{item!.label}:</span>
                        <span className="text-white font-semibold">{item!.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
// ----------------------------------------------------------------------

export default function SpatialNodeModal({
    isOpen, onClose, onSubmit, target, parentId, parentReferenceId, initialData, isSubmitting,
    isAddingOutdoorZone = false, isAddingOutdoorUnit = false
}: SpatialNodeModalProps) {
    const { language } = useLanguage();
    const config = SPATIAL_HIERARCHY[target];

    // States
    const [nameAr, setNameAr] = useState("");
    const [nameEn, setNameArEn] = useState("");
    const [code, setCode] = useState("");
    const [typeId, setTypeId] = useState("");
    const [referenceId, setReferenceId] = useState<string | null>(null);
    const [status, setStatus] = useState("operational");
    const [floorNumber, setFloorNumber] = useState<number>(0);
    const [typesList, setTypesList] = useState<any[]>([]);

    // States for Site Creation/Editing Wizard (الجغرافي)
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
    const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
    const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
    const [initialGeoNames, setInitialGeoNames] = useState<any>(null);
    const [parentGeoData, setParentGeoData] = useState<any>(null);
    
    // 🔑 حالات إدخال الإحداثيات - جديد
    const [lat, setLat] = useState<number | ''>('');
    const [lng, setLng] = useState<number | ''>('');
    const [x, setX] = useState<number | ''>('');
    const [y, setY] = useState<number | ''>('');
    const [z, setZ] = useState<number | ''>('');
    const [polygonJson, setPolygonJson] = useState<string>('');
    const [entrancesJson, setEntrancesJson] = useState<string>('');

    const isReferenceBased = !!config.referenceCollection;
    const isSiteCreation = target === 'site';
    const isFloorCreation = target === 'floor';
    const isOutdoorPath = isAddingOutdoorZone || isAddingOutdoorUnit;

    const statusOptions = [
        { value: "operational", label_ar: "يعمل / متاح", label_en: "Operational / Active" },
        { value: "maintenance", label_ar: "قيد الصيانة", label_en: "Under Maintenance" },
        { value: "construction", label_ar: "قيد الإنشاء", label_en: "Under Construction" },
        { value: "closed", label_ar: "مغلق / خارج الخدمة", label_en: "Closed / Inactive" }
    ];

    // 🔑 دالة جلب الأسماء المرجعية (تبقى كما هي)
    const fetchGeoNamesForEdit = useCallback(async (data: any) => {
        const geoFields = [
            { id: data.city_id, collection: 'ref_cities', nameKey: 'city' },
            { id: data.district_id, collection: 'ref_districts', nameKey: 'district' },
            { id: data.sector_id, collection: 'ref_sectors', nameKey: 'sector' },
        ];
        
        const names: any = {};
        const fetchPromises = geoFields.map(async (field) => {
            if (field.id) {
                try {
                    const docSnap = await getDoc(doc(db, field.collection, field.id));
                    if (docSnap.exists()) {
                        const itemData = docSnap.data();
                        names[`${field.nameKey}_name_ar`] = itemData.name_ar;
                        names[`${field.nameKey}_name_en`] = itemData.name_en;
                        names[`${field.nameKey}_code`] = itemData.code;
                        names[`${field.nameKey}_id`] = field.id;
                    }
                } catch (e) {
                    console.error(`Failed to fetch ${field.nameKey}:`, e);
                }
            }
        });

        await Promise.all(fetchPromises);
        setInitialGeoNames(names);
    }, []);

    // 🔑 دالة جلب بيانات الأب (تم تعديلها لضمان التوريث للعرض)
    const fetchParentGeoData = useCallback(async () => {
        if (isSiteCreation && !initialData) {
            setParentGeoData(null);
            return;
        }

        let actualParentTarget: SpatialTarget | undefined;
        let actualParentId: string | undefined;

        // 1. تحديد الأب الفعلي (Parent Target & ID)
        if (initialData) {
            // عند التعديل: البحث عن أول حقل أب موجود
            const possibleParents: [SpatialTarget, string | undefined][] = [
                ['unit', initialData.unit_id],
                ['floor', initialData.floor_id],
                ['zone', initialData.zone_id],
                ['building', initialData.building_id],
                ['site', initialData.site_id]
            ];

            for (const [pTarget, pId] of possibleParents) {
                if (pId) { actualParentTarget = pTarget; actualParentId = pId; break; }
            }

            if (!actualParentTarget && config.parent_target && initialData[`${config.parent_target}_id`]) {
                actualParentTarget = config.parent_target;
                actualParentId = initialData[`${config.parent_target}_id`];
            }

        } else if (parentId) {
            // عند الإنشاء: نعتمد على parentId المرسل
            if (isAddingOutdoorZone) { actualParentTarget = 'site'; actualParentId = parentId; }
            else if (isAddingOutdoorUnit) { actualParentTarget = 'zone'; actualParentId = parentId; }
            else if (config.parent_target) { actualParentTarget = config.parent_target; actualParentId = parentId; }
        }

        if (!actualParentTarget || !actualParentId) {
            setParentGeoData(null);
            return;
        }

        // 2. جلب بيانات الأب
        const parentConfig = SPATIAL_HIERARCHY[actualParentTarget];
        if (!parentConfig) return;

        const parentDocRef = doc(db, parentConfig.collection, actualParentId);
        try {
            const parentSnap = await getDoc(parentDocRef);
            if (parentSnap.exists()) {
                const data = parentSnap.data();

                // 🔑 التعديل الحاسم: ننسخ اسم المستوى الأب نفسه إلى حقل هرمي للعرض
                const parentDataWithCurrentLevel = {
                    ...data,
                    [`${actualParentTarget}_name_ar`]: data.name_ar,
                    [`${actualParentTarget}_name_en`]: data.name_en,
                    [`${actualParentTarget}_code`]: data.code,
                    [`${actualParentTarget}_id`]: data.id,
                };

                setParentGeoData(parentDataWithCurrentLevel);
            } else {
                setParentGeoData(null);
            }
        } catch (error) {
            console.error("Error fetching parent geo data:", error);
            setParentGeoData(null);
        }
    }, [config.parent_target, parentId, initialData, isAddingOutdoorZone, isAddingOutdoorUnit, isSiteCreation, target]);


    // جلب البيانات عند الفتح والتعديل
    useEffect(() => {
        if (isOpen) {
            setNameAr(initialData?.name_ar || "");
            setNameArEn(initialData?.name_en || "");
            setCode(initialData?.code || "");
            setTypeId(initialData?.type_id || "");
            setReferenceId(initialData?.reference_id || null);
            setStatus(initialData?.status || "operational");
            setFloorNumber(initialData?.floor_number !== undefined ? initialData.floor_number : 0);

            // 🔑 جلب وتعيين الإحداثيات
            const geoData = initialData?.geo_data || {};
            
            // Lat/Lng (للمركز)
            setLat(geoData.center?.lat || '');
            setLng(geoData.center?.lng || '');
            
            // X/Y/Z (للإحداثيات الداخلية)
            setX(geoData.coordinates?.x || '');
            setY(geoData.coordinates?.y || '');
            setZ(geoData.coordinates?.z || '');

            // JSON Fields
            setPolygonJson(geoData.polygon ? JSON.stringify(geoData.polygon, null, 2) : '');
            setEntrancesJson(geoData.entrances ? JSON.stringify(geoData.entrances, null, 2) : '');

            // ... (بقية منطق الموقع و fetchParentGeoData و fetchTypes يبقى كما هو)
            
            if (isSiteCreation && initialData) {
                setSelectedCityId(initialData.city_id || null);
                setSelectedDistrictId(initialData.district_id || null);
                setSelectedSectorId(initialData.sector_id || null);
                fetchGeoNamesForEdit(initialData);
            } else if (isSiteCreation && !initialData) {
                setSelectedCityId(null);
                setSelectedDistrictId(null);
                setSelectedSectorId(null);
                setInitialGeoNames(null);
            }
            
            if (parentId && target !== 'site' && !isReferenceBased) {
                fetchParentGeoData();
            } else {
                setParentGeoData(null);
            }

            if (config.hasType) {
                fetchTypes();
            }
        }
    }, [isOpen, initialData, target, parentId, fetchParentGeoData, fetchGeoNamesForEdit]);


    const fetchTypes = async () => {
        let collectionName = "";
        if (target === 'unit') collectionName = 'spatial_lookups/unit_types/values';
        else if (target === 'point') collectionName = 'spatial_lookups/point_types/values';
        else if (target === 'building') collectionName = 'spatial_lookups/building_types/values';
        else if (target === 'site') collectionName = 'spatial_lookups/site_types/values';
        else if (target === 'zone') collectionName = 'spatial_lookups/zone_types/values';

        if (collectionName) {
            const snap = await getDocs(query(collection(db, collectionName), where("is_active", "==", true)));
            setTypesList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
    };

    const handleReferenceSelect = (item: any) => {
        setNameAr(item.name_ar);
        setNameArEn(item.name_en);
        setCode(item.code || item.id);
        setReferenceId(item.id);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. بناء Geo Data بعناية فائقة
        const rawGeoData: any = {};

        // معالجة الإحداثيات الخارجية
        if (config.geoInputType === 'external_global') {
            if (lat !== '' && lng !== '') {
                rawGeoData.center = { lat: Number(lat), lng: Number(lng) };
            }
        } 
        
        // معالجة الإحداثيات الداخلية
        if (config.geoInputType === 'internal_floor' || config.geoInputType === 'internal_unit') {
            if (x !== '' && y !== '') {
                rawGeoData.coordinates = { x: Number(x), y: Number(y) };
                if (z !== '') rawGeoData.coordinates.z = Number(z);
            }
        }

        // 1. معالجة JSON (Polygon) - الحل لمشكلة Array of Arrays
        if (polygonJson) {
            try {
                const parsed = JSON.parse(polygonJson);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // 🔥 التحويل السحري: إذا كانت النقاط عبارة عن مصفوفات، حولها لكائنات
                    rawGeoData.polygon = parsed.map((point: any) => {
                        // إذا كانت النقطة [lat, lng]
                        if (Array.isArray(point) && point.length >= 2) {
                            return { lat: point[0], lng: point[1] }; 
                        }
                        // إذا كانت أصلاً {lat, lng} اتركها كما هي
                        return point;
                    });
                }
            } catch (e) {
                console.error("Ignored invalid polygon JSON");
            }
        }

        // 2. معالجة JSON (Entrances)
        if (entrancesJson) {
            try {
                const parsed = JSON.parse(entrancesJson);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // نفس التحويل للمداخل إذا لزم الأمر
                    rawGeoData.entrances = parsed.map((entry: any) => {
                        // التأكد من أن coordinates كائن وليس مصفوفة
                        if (entry.coordinates && Array.isArray(entry.coordinates)) {
                            return {
                                ...entry,
                                coordinates: { lat: entry.coordinates[0], lng: entry.coordinates[1] }
                            };
                        }
                        return entry;
                    });
                }
            } catch (e) {
                console.error("Ignored invalid entrances JSON");
            }
        }

        // 2. بناء الحمولة الأساسية
        let payload: any = {
            name_ar: nameAr,
            name_en: nameEn,
            code: code,
            type_id: typeId || null,
            reference_id: referenceId,
            status: status,
        };

        if (Object.keys(rawGeoData).length > 0) {
            payload.geo_data = rawGeoData;
        }

        if (isSiteCreation) {
            payload.country_id = DEFAULT_COUNTRY_ID;
            payload.emirate_id = DEFAULT_EMIRATE_ID;
            payload.region_id = DEFAULT_REGION_ID;
            payload.sector_id = selectedSectorId;
            payload.district_id = selectedDistrictId;
            payload.city_id = selectedCityId;
            
            // نسخ الأسماء بأمان
            if (initialGeoNames) {
                Object.assign(payload, initialGeoNames);
            } else if (initialData) {
                // نسخ من البيانات الأولية إذا كانت موجودة
                ['city', 'district', 'sector'].forEach(level => {
                    if (initialData[`${level}_name_ar`]) payload[`${level}_name_ar`] = initialData[`${level}_name_ar`];
                    if (initialData[`${level}_name_en`]) payload[`${level}_name_en`] = initialData[`${level}_name_en`];
                    if (initialData[`${level}_code`]) payload[`${level}_code`] = initialData[`${level}_code`];
                });
            }
        } else if (isAddingOutdoorZone && parentId) {
            payload.site_id = parentId;
        } else if (isAddingOutdoorUnit && parentId) {
            payload.zone_id = parentId;
        } else if (config.parent_target && parentId) {
            payload[`${config.parent_target}_id`] = parentId;
        }

        if (isFloorCreation) payload.floor_number = Number(floorNumber);

        // 🚀 التنظيف النهائي قبل الإرسال (الحل السحري)
        const finalPayload = cleanDataBeforeSubmit(payload);

        console.log("🚀 Submitting Payload:", finalPayload); // للتأكد في الكونسول
        await onSubmit(finalPayload);
    };

    // -----------------------------------------------------------
    // 🔑 FIX: تعريف وحساب المتغيرات المساعدة في نطاق المكون
    // -----------------------------------------------------------
    const currentCityId = selectedCityId || initialData?.city_id;
    const currentDistrictId = selectedDistrictId || initialData?.district_id;
    const currentSectorId = selectedSectorId || initialData?.sector_id;

    const combinedInitialData = {
        ...initialData,
        ...(initialGeoNames || {})
    };
    
    // 🔑 تم نقل تعريف وحساب parentFilter إلى هنا لحل مشكلة 'Cannot find name'
    let parentFilter: { field: string, value: string } | null = null;
    if (config.parent_target && !isSiteCreation && target !== 'country') {
        if (parentReferenceId) {
            parentFilter = { field: `${config.parent_target}_id`, value: parentReferenceId };
        } else if (parentId) {
            parentFilter = { field: `${config.parent_target}_id`, value: parentId };
        }
    }
    // -----------------------------------------------------------
    

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        variants={scaleInModalVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="w-full max-w-lg bg-[#0d1b2a] border border-gray-700 rounded-xl shadow-2xl overflow-visible max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50 sticky top-0 z-20 backdrop-blur-md">
                            <h3 className="text-lg font-bold text-white">
                                {initialData ? (language === 'ar' ? 'تعديل' : 'Edit') : (language === 'ar' ? 'إضافة' : 'Add')} {language === 'ar' ? config.label_ar : config.label_en}
                            </h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-white">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-6">

                            {/* 1. تحديد الموقع الجغرافي (يظهر عند إنشاء الموقع أو تعديله) */}
                            {isSiteCreation && (
                                <div className="space-y-4 bg-gray-800/30 p-4 rounded-lg border border-gray-700">
                                    <h4 className="text-[#FFD700] text-sm font-bold mb-2">
                                        {language === 'ar' ? '1. تحديد الموقع الجغرافي' : '1. Select Location'}
                                    </h4>

                                    {/* 1. اختر المدينة */}
                                    <SearchableSelect
                                        key={`city-${initialData?.id || 'new'}`}
                                        collectionName="ref_cities"
                                        parentFilter={{ field: 'region_id', value: DEFAULT_REGION_ID }}
                                        label={language === 'ar' ? "المدينة" : "City"}
                                        placeholder={language === 'ar' ? "اختر المدينة..." : "Select City..."}
                                        onSelect={(item) => {
                                            setSelectedCityId(item.id);
                                            setSelectedDistrictId(null);
                                            setSelectedSectorId(null);
                                            setInitialGeoNames((prev: any) => ({
                                                ...prev,
                                                city_name_ar: item.name_ar,
                                                city_name_en: item.name_en,
                                                city_code: item.code,
                                                city_id: item.id
                                            }));
                                        }}
                                        initialValue={combinedInitialData.city_id ? { name_ar: combinedInitialData.city_name_ar, name_en: combinedInitialData.city_name_en, code: combinedInitialData.city_code } : undefined}
                                    />

                                    {/* 2. اختر الحي */}
                                    {currentCityId && (
                                        <SearchableSelect
                                            key={`district-${currentCityId}`}
                                            collectionName="ref_districts"
                                            parentFilter={{ field: 'city_id', value: currentCityId }}
                                            label={language === 'ar' ? "المنطقة / الحي" : "District"}
                                            placeholder={language === 'ar' ? "اختر الحي..." : "Select District..."}
                                            onSelect={(item) => {
                                                setSelectedDistrictId(item.id);
                                                setSelectedSectorId(null);
                                                setInitialGeoNames((prev: any) => ({
                                                    ...prev,
                                                    district_name_ar: item.name_ar,
                                                    district_name_en: item.name_en,
                                                    district_code: item.code,
                                                    district_id: item.id
                                                }));
                                            }}
                                            initialValue={combinedInitialData.district_id ? { name_ar: combinedInitialData.district_name_ar, name_en: combinedInitialData.district_name_en, code: combinedInitialData.district_code } : undefined}
                                        />
                                    )}

                                    {/* 3. اختر القطاع */}
                                    {currentDistrictId && (
                                        <SearchableSelect
                                            key={`sector-${currentDistrictId}`}
                                            collectionName="ref_sectors"
                                            parentFilter={{ field: 'district_id', value: currentDistrictId }}
                                            label={language === 'ar' ? "القطاع / الحوض" : "Sector"}
                                            placeholder={language === 'ar' ? "اختر القطاع..." : "Select Sector..."}
                                            onSelect={(item) => {
                                                setSelectedSectorId(item.id);
                                                setInitialGeoNames((prev: any) => ({
                                                    ...prev,
                                                    sector_name_ar: item.name_ar,
                                                    sector_name_en: item.name_en,
                                                    sector_code: item.code,
                                                    sector_id: item.id
                                                }));
                                            }}
                                            initialValue={combinedInitialData.sector_id ? { name_ar: combinedInitialData.sector_name_ar, name_en: combinedInitialData.sector_name_en, code: combinedInitialData.sector_code } : undefined}
                                        />
                                    )}
                                </div>
                            )}

                            {/* 2. عرض بيانات الأب (للقراءة فقط) عند إضافة عنصر فرعي أو تعديله */}
                            {parentGeoData && !isSiteCreation && (
                                <ReadonlyHierarchyDisplay itemData={parentGeoData} language={language} />
                            )}


                            {/* 3. حقول القوائم المنسدلة المرجعية (للمستويات العليا غير Site) */}
                            {isReferenceBased && !isSiteCreation && !initialData && (
                                <div className="mb-4">
                                    <SearchableSelect
                                        collectionName={config.referenceCollection!}
                                        parentFilter={parentFilter}
                                        label={language === 'ar' ? `اختر ${config.label_ar}` : `Select ${config.label_en}`}
                                        placeholder={language === 'ar' ? 'ابحث للاختيار...' : 'Search to select...'}
                                        onSelect={handleReferenceSelect}
                                        initialValue={initialData ? { name_ar: initialData.name_ar, name_en: initialData.name_en, code: initialData.code } : undefined}
                                    />
                                </div>
                            )}

                            {/* 4. الحقول اليدوية (الاسم، الكود، وغيرها) */}
                            {(!isReferenceBased || isSiteCreation) && (
                                <div className={isSiteCreation && !initialData ? "pt-2 border-t border-gray-700" : ""}>

                                    {((isSiteCreation && !initialData) || isOutdoorPath) && <h4 className="text-[#FFD700] text-sm font-bold mb-4">{language === 'ar' ? 'تفاصيل العنصر' : 'Item Details'}</h4>}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'الاسم باللغة العربية' : 'Name (Arabic)'}</label>
                                            <input type="text" value={nameAr} onChange={e => setNameAr(e.target.value)} required className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'الاسم باللغة الإنجليزية' : 'Name (English)'}</label>
                                            <input type="text" value={nameEn} onChange={e => setNameArEn(e.target.value)} required className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" />
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'رمز التعريف (Code)' : 'Code'}</label>
                                        <input type="text" value={code} onChange={e => setCode(e.target.value)} className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" />
                                    </div>

                                    {isFloorCreation && (
                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                                {language === 'ar' ? 'رقم الطابق (للفهرسة)' : 'Floor Number (Index)'}
                                                <span className="text-xs text-gray-500 mx-2">(0=أرضي, -1=سرداب, 1=أول...)</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={floorNumber}
                                                onChange={e => setFloorNumber(Number(e.target.value))}
                                                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 5. حقل النوع (يظهر دائماً إذا كان مطلوباً) */}
                            {config.hasType && (
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'النوع' : 'Type'}</label>
                                    <select value={typeId} onChange={e => setTypeId(e.target.value)} className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none">
                                        <option value="">{language === 'ar' ? 'اختر النوع...' : 'Select Type...'}</option>
                                        {typesList.map((t: any) => (<option key={t.id} value={t.id}>{language === 'ar' ? t.name_ar : t.name_en}</option>))}
                                    </select>
                                </div>
                            )}

                            {/* 6. حقل الحالة (يظهر دائماً) */}
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'الحالة التشغيلية' : 'Status'}</label>
                                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none">
                                    {statusOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{language === 'ar' ? opt.label_ar : opt.label_en}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* 🔑 3. إحداثيات الموقع والملاحة (Geo-Data) - مدمج */}
                            {(config.geoInputType && config.geoInputType !== 'none') && (
                                <div className="space-y-4 bg-gray-800/30 p-4 rounded-lg border border-gray-700">
                                    <h4 className="text-[#FFD700] text-sm font-bold mb-2">
                                        {language === 'ar' ? '3. إحداثيات الموقع والملاحة' : '3. Geo & Navigation Coordinates'}
                                    </h4>

                                    {/* الإحداثيات الخارجية (Lat/Lng) - Site, Building, City */}
                                    {(config.geoInputType === 'external_global') && (
                                        <div className="space-y-4">
                                            <p className="text-gray-400 text-xs">
                                                {language === 'ar' ? 'إحداثيات المركز (خط الطول/العرض لتحديد النقطة على الخريطة الخارجية).' : 'Center Coordinates (Lat/Lng for external map positioning).'}
                                            </p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'خط العرض (Latitude)' : 'Latitude (Lat)'}</label>
                                                    <input type="number" step="any" value={lat} onChange={e => setLat(Number(e.target.value))} className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" placeholder="0.000000" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'خط الطول (Longitude)' : 'Longitude (Lng)'}</label>
                                                    <input type="number" step="any" value={lng} onChange={e => setLng(Number(e.target.value))} className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" placeholder="0.000000" />
                                                </div>
                                            </div>
                                            
                                            {/* Polygon Input (JSON for boundary) */}
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'مضلع الحدود الخارجية (Polygon - Lat/Lng Array JSON)' : 'External Boundary Polygon (JSON)'}</label>
                                                <textarea 
                                                    value={polygonJson} 
                                                    onChange={e => setPolygonJson(e.target.value)} 
                                                    rows={6}
                                                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" 
                                                    placeholder={language === 'ar' ? '[ [lat1, lng1], [lat2, lng2], ... ]' : '[ [lat1, lng1], [lat2, lng2], ... ]'}
                                                />
                                                <p className="text-red-400 text-xs mt-1">{language === 'ar' ? 'ملاحظة: يجب أن تكون القيمة بتنسيق JSON صحيح.' : 'Note: Value must be in valid JSON format.'}</p>
                                            </div>
                                            
                                            {/* Entrances (External) - لـ Site و Building */}
                                            {(target === 'site' || target === 'building') && (
                                                <div className="mt-4">
                                                    <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'مداخل/مخارج الموقع (Entrances - JSON)' : 'Site/Building Entrances (JSON)'}</label>
                                                    <textarea 
                                                        value={entrancesJson} 
                                                        onChange={e => setEntrancesJson(e.target.value)} 
                                                        rows={6}
                                                        className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" 
                                                        placeholder={language === 'ar' ? '[{name:"Main", type:"main", coordinates:{lat:0, lng:0}}, ...]' : '[{name:"Main", type:"main", coordinates:{lat:0, lng:0}}, ...]'}
                                                    />
                                                    <p className="text-red-400 text-xs mt-1">{language === 'ar' ? 'ملاحظة: يجب أن تكون القيمة بتنسيق JSON صحيح.' : 'Note: Value must be in valid JSON format.'}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* الإحداثيات الداخلية (X/Y/Z) - Floor, Unit, Point, Zone */}
                                    {(config.geoInputType === 'internal_floor' || config.geoInputType === 'internal_unit') && (
                                        <div className="space-y-4">
                                            <p className="text-gray-400 text-xs">
                                                {language === 'ar' ? 'الإحداثيات الداخلية (X/Y/Z لتحديد الموضع على مخطط الطابق).' : 'Internal Coordinates (X/Y/Z for position on the floor plan).'}
                                            </p>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'المحور X' : 'X-Axis'}</label>
                                                    <input type="number" step="any" value={x} onChange={e => setX(Number(e.target.value))} className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" placeholder="0" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'المحور Y' : 'Y-Axis'}</label>
                                                    <input type="number" step="any" value={y} onChange={e => setY(Number(e.target.value))} className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" placeholder="0" />
                                                </div>
                                                {/* Z مطلوب للطابق و نقطة الأصل */}
                                                {(config.geoInputType === 'internal_floor' || target === 'point') && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'المحور Z (الارتفاع)' : 'Z-Axis (Height)'}</label>
                                                        <input type="number" step="any" value={z} onChange={e => setZ(Number(e.target.value))} className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" placeholder="0" />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Entrances (Internal) - لـ Floor */}
                                            {(config.geoInputType === 'internal_floor') && (
                                                <div className="mt-4">
                                                    <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'المداخل الداخلية (سلالم/مصاعد - JSON)' : 'Internal Entrances (Stairs/Elevators - JSON)'}</label>
                                                    <textarea 
                                                        value={entrancesJson} 
                                                        onChange={e => setEntrancesJson(e.target.value)} 
                                                        rows={6}
                                                        className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" 
                                                        placeholder={language === 'ar' ? '[{name:"Elevator A", type:"main", coordinates:{x:100, y:50, z:0}}, ...]' : '[{name:"Elevator A", type:"main", coordinates:{x:100, y:50, z:0}}, ...]'}
                                                    />
                                                    <p className="text-red-400 text-xs mt-1">{language === 'ar' ? 'ملاحظة: يجب أن تكون القيمة بتنسيق JSON صحيح.' : 'Note: Value must be in valid JSON format.'}</p>
                                                </div>
                                            )}
                                            
                                            {/* Polygon Input for Zone/Unit */}
                                            {(target === 'zone' || target === 'unit') && (
                                                <div className="mt-4">
                                                    <label className="block text-sm font-medium text-gray-400 mb-1">{language === 'ar' ? 'مضلع حدود المنطقة/الوحدة (X/Y Array JSON)' : 'Zone/Unit Boundary Polygon (JSON)'}</label>
                                                    <textarea 
                                                        value={polygonJson} 
                                                        onChange={e => setPolygonJson(e.target.value)} 
                                                        rows={6}
                                                        className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none" 
                                                        placeholder={language === 'ar' ? '[ [x1, y1], [x2, y2], ... ]' : '[ [x1, y1], [x2, y2], ... ]'}
                                                    />
                                                    <p className="text-red-400 text-xs mt-1">{language === 'ar' ? 'ملاحظة: يجب أن تكون القيمة بتنسيق JSON صحيح.' : 'Note: Value must be in valid JSON format.'}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors">{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || (isSiteCreation && !currentSectorId && !initialData)}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#FFD700] text-black font-bold hover:bg-[#e6c200] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <><CheckIcon className="w-5 h-5" /> {language === 'ar' ? 'حفظ' : 'Save'}</>}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}