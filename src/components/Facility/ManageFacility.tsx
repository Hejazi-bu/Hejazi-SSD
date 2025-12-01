// C:\Users\user\Music\hejazi-logic\src\components\Facility\ManageFacility.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    ChevronRightIcon, ChevronLeftIcon, PlusIcon, TrashIcon, 
    PencilSquareIcon, FolderOpenIcon, ArrowUturnRightIcon,
    SunIcon 
} from '@heroicons/react/24/outline';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';
import { useActionLoading } from '../contexts/ActionLoadingContext';
import { staggeredContainerVariants, interactiveItemVariants, fadeInVariants } from '../../lib/animations';
import { SPATIAL_HIERARCHY, SpatialTarget } from './config/SpatialConfig';
import SpatialNodeModal from './SpatialNodeModal';

interface SpatialItem {
    id: string;
    name_ar: string;
    name_en: string;
    code?: string;
    type_id?: string;
    is_outdoor?: boolean;
    _type?: SpatialTarget; // لتخزين النوع الفعلي عند دمج المجموعات
    [key: string]: any;
}

interface BreadcrumbItem {
    target: SpatialTarget;
    id: string;
    name: string;
}

export default function ManageFacility() {
    const { language } = useLanguage();
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();

    const [currentTarget, setCurrentTarget] = useState<SpatialTarget>("site");
    const [parentId, setParentId] = useState<string | null>(null);
    const [items, setItems] = useState<SpatialItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<SpatialItem | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isAddingOutdoorZone, setIsAddingOutdoorZone] = useState(false); 
    const [isAddingOutdoorUnit, setIsAddingOutdoorUnit] = useState(false); 

    const currentConfig = SPATIAL_HIERARCHY[currentTarget];

// --- 1. Fetch Data (تم التعديل لضمان جلب المناطق الخارجية) ---
    const fetchItems = async () => {
        setLoading(true);
        try {
            const colRef = collection(db, currentConfig.collection);
            let q;
            
            if (currentTarget === 'building' && parentId) { 
                // الحالة الخاصة: جلب المباني والمناطق الخارجية التابعة للموقع (Site)
                
                // 1. جلب المباني التابعة للموقع
                const buildingsQ = query(collection(db, "buildings"), where("site_id", "==", parentId), where("is_active", "==", true));
                const buildingsSnap = await getDocs(buildingsQ);
                const buildings = buildingsSnap.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    _type: 'building'
                } as SpatialItem));

                // 2. جلب المناطق (Zones) التابعة للموقع مباشرة (المسار الخارجي)
                // ⚠️ FIX: جلب جميع المناطق التابعة لهذا الموقع (للتصفية المحلية)
                const allSiteZonesQ = query(collection(db, "zones"), where("site_id", "==", parentId), where("is_active", "==", true));
                const allSiteZonesSnap = await getDocs(allSiteZonesQ);
                
                // 3. التصفية محلياً: المناطق الخارجية هي التي ليس لديها building_id (أو قيمته undefined/غير موجود)
                const outdoorZones = allSiteZonesSnap.docs
                    .filter(doc => !doc.data().building_id) // 🔑 التصفية للعناصر التي لا تحتوي على building_id
                    .map(doc => ({ 
                        id: doc.id, 
                        ...doc.data(), 
                        _type: 'zone',
                        is_outdoor: true
                    } as SpatialItem));

                const combined = [...buildings, ...outdoorZones];
                combined.sort((a, b) => (a.name_ar || "").localeCompare(b.name_ar || ""));
                setItems(combined);
                
            } else if (currentTarget === 'zone' && parentId) {
                // الحالة الخاصة: دمج المناطق الداخلية (Zone) والطوابق (Floor)
                
                // 1. جلب المناطق (Zones) التابعة للمبنى
                const zonesQ = query(collection(db, "zones"), where("building_id", "==", parentId), where("is_active", "==", true));
                const zonesSnap = await getDocs(zonesQ);
                const zones = zonesSnap.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    _type: 'zone' 
                } as SpatialItem));
                
                // 2. جلب الطوابق (Floors) التابعة للمنطقة (Zone)
                const floorsQ = query(collection(db, "floors"), where("zone_id", "==", parentId), where("is_active", "==", true));
                const floorsSnap = await getDocs(floorsQ);
                const floors = floorsSnap.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    _type: 'floor' 
                } as SpatialItem));
                
                const combined = [...zones, ...floors];
                combined.sort((a, b) => (a.name_ar || "").localeCompare(b.name_ar || ""));
                setItems(combined);

            } else {
                // الجلب العادي لباقي المستويات (مثل Site, Floor, Unit, Point)
                if (currentConfig.parent_target && parentId) {
                    const parentField = `${currentConfig.parent_target}_id`;
                    q = query(colRef, where(parentField, "==", parentId), where("is_active", "==", true));
                } else {
                    q = query(colRef, where("is_active", "==", true));
                }
                const snapshot = await getDocs(q!);
                const data = snapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    _type: currentTarget 
                } as SpatialItem));
                
                data.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
                setItems(data);
            }
        } catch (error) {
            console.error("Error fetching items:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [currentTarget, parentId]);

// --- 2. Navigation Logic ---
    const handleItemClick = (item: SpatialItem) => {
        // حالة: الانتقال من منطقة خارجية إلى وحداتها
        if (item._type === 'zone' && item.is_outdoor) {
            setBreadcrumbs(prev => [...prev, { target: currentTarget, id: item.id, name: language === 'ar' ? item.name_ar : item.name_en }]);
            setParentId(item.id);
            setCurrentTarget('unit'); // الانتقال مباشرة إلى الوحدات
            return;
        }

        if (item.is_outdoor) return;

        const targetType = item._type || currentTarget;
        const nextConfig = SPATIAL_HIERARCHY[targetType];

        if (nextConfig.child_target) {
            setBreadcrumbs(prev => [...prev, { target: targetType, id: item.id, name: language === 'ar' ? item.name_ar : item.name_en }]);
            setParentId(item.id);
            setCurrentTarget(nextConfig.child_target);
        }
    };

    const handleBreadcrumbClick = (index: number) => {
        if (index === -1) {
            setBreadcrumbs([]);
            setParentId(null);
            setCurrentTarget("site");
            return;
        }
        const targetCrumb = breadcrumbs[index];
        const nextConfig = SPATIAL_HIERARCHY[targetCrumb.target];
        
        if (nextConfig.child_target) {
            setBreadcrumbs(breadcrumbs.slice(0, index + 1));
            setParentId(targetCrumb.id);
            setCurrentTarget(nextConfig.child_target);
        }
    };

    const goBack = () => {
        if (breadcrumbs.length === 0) return;
        handleBreadcrumbClick(breadcrumbs.length - 2);
    };

// --- 3. Save Logic ---
    const handleSave = async (formData: any) => {
        setIsSubmitting(true);
        try {
            const manageSpatialStructure = httpsCallable(functions, 'manageSpatialStructure');
            const payloadData = { ...formData };
            let effectiveTarget: SpatialTarget = currentTarget;
            
            if (isAddingOutdoorZone) {
                effectiveTarget = 'zone';
                payloadData['site_id'] = parentId;
            } else if (isAddingOutdoorUnit) {
                effectiveTarget = 'unit';
                payloadData['zone_id'] = parentId;
            } else {
                effectiveTarget = currentTarget;
            }

            // إذا كان يتم التعديل (Update)، لا نرسل حقول الأب
            if (modalData) {
                delete payloadData.site_id;
                delete payloadData.zone_id;
            }

            await manageSpatialStructure({
                target: effectiveTarget,
                action: modalData ? 'update' : 'create',
                docId: modalData?.id,
                data: payloadData
            });

            setIsModalOpen(false);
            setIsAddingOutdoorZone(false);
            setIsAddingOutdoorUnit(false);
            fetchItems();
            setModalData(undefined);
        } catch (error: any) {
            showDialog({ variant: 'alert', title: 'خطأ', message: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (item: SpatialItem, e: React.MouseEvent) => {
        e.stopPropagation();
        const targetToDelete: SpatialTarget = item._type || currentTarget;

        showDialog({
            variant: 'confirm',
            title: language === 'ar' ? 'حذف العنصر' : 'Delete Item',
            message: language === 'ar' ? 'سيتم حذف العنصر وجميع محتوياته. هل أنت متأكد؟' : 'This will delete the item and all contents. Are you sure?',
            onConfirm: async () => {
                showActionLoading(language === 'ar' ? 'جاري الحذف...' : 'Deleting...');
                try {
                    const manageSpatialStructure = httpsCallable(functions, 'manageSpatialStructure');
                    await manageSpatialStructure({
                        target: targetToDelete,
                        action: 'delete',
                        docId: item.id
                    });
                    await fetchItems();
                } catch (error: any) {
                    showDialog({ variant: 'alert', title: 'خطأ', message: error.message });
                } finally {
                    hideActionLoading();
                }
            }
        });
    };

// --- 4. Modal Open Logic ---

    // فتح المودال للإضافة العادية
    const openAddModal = () => {
        setModalData(undefined);
        setIsAddingOutdoorZone(false);
        setIsAddingOutdoorUnit(false);
        setIsModalOpen(true);
    };

    // دالة جديدة: فتح مودال إضافة المنطقة الخارجية (Zone)
    const openAddOutdoorZoneModal = () => {
        setModalData(undefined);
        setIsAddingOutdoorZone(true);
        setIsAddingOutdoorUnit(false);
        setIsModalOpen(true);
    };

    // دالة جديدة: فتح مودال إضافة الوحدة الخارجية (Unit)
    const openAddOutdoorUnitModal = () => {
        setModalData(undefined);
        setIsAddingOutdoorZone(false);
        setIsAddingOutdoorUnit(true);
        setIsModalOpen(true);
    };

    // فتح المودال للتعديل
    const openEditModal = (item: SpatialItem) => {
        setModalData(item);
        // التحقق من نوع العنصر لتحديد وضع التعديل
        // إذا كان zone تحت site وليس تحت building
        setIsAddingOutdoorZone(item._type === 'zone' && !!item.site_id && !item.building_id); 
        // إذا كانت وحدة تحت zone وليس تحت floor
        setIsAddingOutdoorUnit(item._type === 'unit' && !!item.zone_id && !item.floor_id); 
        setIsModalOpen(true);
    };

// --- 5. JSX Rendering ---

    return (
        <div className="flex flex-col h-full space-y-4 p-4 sm:p-6 dir-rtl">
            
            {/* Header */}
            <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-xl p-4 shadow-lg sticky top-0 z-10">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                            <currentConfig.icon className="w-6 h-6 text-[#FFD700]" />
                            {language === 'ar' ? currentConfig.label_ar : currentConfig.label_en}
                        </h1>

                        <div className="flex items-center gap-3">
                            {/* زر إضافة منطقة خارجية (Zone) - يظهر عندما يكون CurrentTarget هو Building (والأب Site) */}
                            {currentTarget === 'building' && parentId && (
                                <button 
                                    onClick={openAddOutdoorZoneModal}
                                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors text-sm sm:text-base shadow-md"
                                >
                                    <SunIcon className="w-5 h-5" />
                                    <span className="hidden sm:inline">{language === 'ar' ? 'إضافة منطقة خارجية' : 'Add Outdoor Zone'}</span>
                                </button>
                            )}

                            {/* زر إضافة وحدة خارجية (Unit) - يظهر عندما يكون CurrentTarget هو Zone (التابعة لـ Site) */}
                            {currentTarget === 'zone' && parentId && items.some(item => item.is_outdoor) && (
                                <button 
                                    onClick={openAddOutdoorUnitModal}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors text-sm sm:text-base shadow-md"
                                >
                                    <SunIcon className="w-5 h-5" />
                                    <span className="hidden sm:inline">{language === 'ar' ? 'إضافة وحدة خارجية' : 'Add Outdoor Unit'}</span>
                                </button>
                            )}

                            {/* زر الإضافة الرئيسي (للحالة العادية - مبنى، طابق، إلخ) */}
                            <button 
                                onClick={openAddModal}
                                className="flex items-center gap-2 bg-[#FFD700] text-black px-4 py-2 rounded-lg font-bold hover:bg-[#e6c200] transition-colors text-sm sm:text-base shadow-md shadow-yellow-900/20"
                            >
                                <PlusIcon className="w-5 h-5" />
                                <span className="hidden sm:inline">
                                    {language === 'ar' ? `إضافة ${currentConfig.label_ar}` : `Add ${currentConfig.label_en}`}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600">
                        {breadcrumbs.length > 0 && (
                            <button onClick={goBack} className="p-1.5 bg-gray-700 rounded-full text-gray-300 hover:text-white hover:bg-gray-600 transition-colors flex-shrink-0">
                                {language === 'ar' ? <ArrowUturnRightIcon className="w-4 h-4" /> : <ArrowUturnRightIcon className="w-4 h-4 transform scale-x-[-1]" />}
                            </button>
                        )}
                        <button 
                            onClick={() => handleBreadcrumbClick(-1)}
                            className={`whitespace-nowrap px-3 py-1 rounded-full text-sm transition-colors ${breadcrumbs.length === 0 ? 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/50' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                        >
                            {language === 'ar' ? 'المواقع' : 'Sites'}
                        </button>
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={crumb.id}>
                                {language === 'ar' ? <ChevronLeftIcon className="w-4 h-4 text-gray-600 flex-shrink-0" /> : <ChevronRightIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />}
                                <button
                                    onClick={() => handleBreadcrumbClick(index)}
                                    className={`whitespace-nowrap px-3 py-1 rounded-full text-sm transition-colors flex items-center gap-1 ${index === breadcrumbs.length - 1 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                >
                                    {crumb.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <motion.div 
                variants={staggeredContainerVariants}
                initial="initial"
                animate="animate"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
                {loading ? (
                    [...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-800/30 rounded-xl animate-pulse border border-gray-700" />)
                ) : items.length === 0 ? (
                    <motion.div variants={fadeInVariants} className="col-span-full flex flex-col items-center justify-center py-20 text-gray-500">
                        <FolderOpenIcon className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg">{language === 'ar' ? 'لا توجد بيانات هنا' : 'No items found here'}</p>
                    </motion.div>
                ) : (
                    items.map((item) => (
                        <motion.div
                            key={item.id}
                            variants={interactiveItemVariants}
                            whileHover="hover"
                            whileTap="tap"
                            onClick={() => handleItemClick(item)}
                            className={`group relative backdrop-blur-sm border rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg ${item.is_outdoor ? 'bg-blue-900/20 border-blue-700/50 hover:border-blue-500' : 'bg-gray-800/40 border-gray-700 hover:border-[#FFD700]/50'}`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className={`p-2 rounded-lg transition-colors ${item.is_outdoor ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-700/50 text-gray-400 group-hover:bg-[#FFD700]/20 group-hover:text-[#FFD700]'}`}>
                                    {item.is_outdoor && item._type === 'zone' ? <SunIcon className="w-6 h-6" /> : <currentConfig.icon className="w-6 h-6" />}
                                </div>
                                {item.code && (
                                    <span className="text-xs font-mono bg-black/30 text-gray-400 px-2 py-1 rounded border border-gray-700">
                                        {item.code}
                                    </span>
                                )}
                            </div>

                            <h3 className="text-white font-bold text-lg truncate mb-1">
                                {language === 'ar' ? item.name_ar : item.name_en}
                            </h3>
                            <p className="text-gray-500 text-xs truncate">
                                {language === 'ar' ? item.name_en : item.name_ar}
                            </p>
                            
                            {/* شارة للمناطق الخارجية */}
                            {item.is_outdoor && item._type === 'zone' && (
                                <span className="inline-block mt-2 text-[10px] bg-blue-600/30 text-blue-200 px-2 py-0.5 rounded-full border border-blue-500/30">
                                    {language === 'ar' ? 'منطقة خارجية' : 'Outdoor Zone'}
                                </span>
                            )}

                            <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                                    className="p-1.5 bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white rounded-lg transition-colors shadow-sm"
                                >
                                    <PencilSquareIcon className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={(e) => handleDelete(item, e)}
                                    className="p-1.5 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg transition-colors shadow-sm"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))
                )}
            </motion.div>

            <SpatialNodeModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSave}
                target={isAddingOutdoorZone ? 'zone' : isAddingOutdoorUnit ? 'unit' : currentTarget}
                parentId={parentId}
                initialData={modalData}
                isSubmitting={isSubmitting}
                isAddingOutdoorZone={isAddingOutdoorZone}
                isAddingOutdoorUnit={isAddingOutdoorUnit}
            />
        </div>
    );
}