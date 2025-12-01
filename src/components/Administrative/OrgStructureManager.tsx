import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    BuildingOfficeIcon, UserGroupIcon, Squares2X2Icon, 
    PlusIcon, PencilIcon, TrashIcon, ArrowsRightLeftIcon, 
    ChevronDownIcon, ChevronRightIcon, XMarkIcon
} from "@heroicons/react/24/outline";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';
import { useActionLoading } from '../contexts/ActionLoadingContext';
import { useOrgStructure } from '../../hooks/useOrgStructure';

// --- Interfaces ---
interface OrgEntity {
    id: string;
    name_ar: string;
    name_en: string;
    manager_id?: string;
    sector_id?: string;      // For Dept & Section
    department_id?: string; // For Section
    // ... any other fields
}

// --- Tree Node Component (الصف الواحد في الشجرة) ---
const OrgNode = ({ 
    node, type, level, children, 
    onEdit, onDelete, onMove, onAddChild, language 
}: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = children && children.length > 0;

    // تحديد الألوان والأيقونات حسب المستوى
    let icon = <Squares2X2Icon className="w-5 h-5" />; // قطاع
    let colorClass = "text-yellow-500 border-yellow-500/30 bg-yellow-500/5";
    let title = language === 'ar' ? "قطاع" : "Sector";

    if (type === 'department') {
        icon = <BuildingOfficeIcon className="w-5 h-5" />;
        colorClass = "text-blue-400 border-blue-500/30 bg-blue-500/5";
        title = language === 'ar' ? "إدارة" : "Department";
    } else if (type === 'section') {
        icon = <UserGroupIcon className="w-5 h-5" />;
        colorClass = "text-green-400 border-green-500/30 bg-green-500/5";
        title = language === 'ar' ? "قسم" : "Section";
    }

    return (
        <div className="w-full mb-2">
            <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${colorClass} hover:bg-opacity-10 group`}>
                
                {/* Left: Info & Expand */}
                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                    <div className={`transition-transform ${isOpen ? 'rotate-0' : 'rtl:rotate-180'}`}>
                        {hasChildren ? <ChevronDownIcon className="w-4 h-4 opacity-50" /> : <div className="w-4 h-4" />}
                    </div>
                    <div className="flex items-center gap-2">
                        {icon}
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-100">{language === 'ar' ? node.name_ar : node.name_en}</span>
                            <span className="text-[10px] opacity-60 uppercase tracking-wider">{title}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* إضافة ابن (يظهر فقط للقطاع والإدارة) */}
                    {type !== 'section' && (
                        <button onClick={() => onAddChild(node, type)} className="p-1.5 hover:bg-white/10 rounded-md text-gray-300" title="إضافة فرع">
                            <PlusIcon className="w-4 h-4" />
                        </button>
                    )}
                    
                    {/* تعديل */}
                    <button onClick={() => onEdit(node, type)} className="p-1.5 hover:bg-blue-500/20 rounded-md text-blue-400" title="تعديل">
                        <PencilIcon className="w-4 h-4" />
                    </button>

                    {/* ترحيل (نقل) - لا يظهر للقطاعات */}
                    {type !== 'sector' && (
                        <button onClick={() => onMove(node, type)} className="p-1.5 hover:bg-orange-500/20 rounded-md text-orange-400" title="نقل (ترحيل ذكي)">
                            <ArrowsRightLeftIcon className="w-4 h-4" />
                        </button>
                    )}

                    {/* حذف */}
                    <button onClick={() => onDelete(node, type)} className="p-1.5 hover:bg-red-500/20 rounded-md text-red-400" title="حذف">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Children Rendering (Recursion) */}
            <AnimatePresence>
                {isOpen && hasChildren && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="pl-6 rtl:pr-6 border-l-2 border-gray-700/30 ml-4 rtl:mr-4 rtl:border-l-0 rtl:border-r-2 mt-1"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Main Component ---
export default function OrgStructureManager() {
    const { language } = useLanguage();
    const { manageOrg } = useOrgStructure();
    const { showDialog } = useDialog();
    const { showActionLoading, hideActionLoading } = useActionLoading();

    // Data State
    const [sectors, setSectors] = useState<OrgEntity[]>([]);
    const [departments, setDepartments] = useState<OrgEntity[]>([]);
    const [sections, setSections] = useState<OrgEntity[]>([]);

    // Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [targetNode, setTargetNode] = useState<any>(null);
    const [targetType, setTargetType] = useState<'sector' | 'department' | 'section'>('sector');
    const [ActionMode, setActionMode] = useState<'create' | 'update'>('create');
    const [parentIdForCreate, setParentIdForCreate] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({ name_ar: '', name_en: '', manager_id: '', new_parent_id: '' });

    // 1. Real-time Listeners
    useEffect(() => {
        const unsub1 = onSnapshot(query(collection(db, 'sectors'), orderBy('created_at')), snap => setSectors(snap.docs.map(d => d.data() as OrgEntity)));
        const unsub2 = onSnapshot(query(collection(db, 'departments'), orderBy('created_at')), snap => setDepartments(snap.docs.map(d => d.data() as OrgEntity)));
        const unsub3 = onSnapshot(query(collection(db, 'sections'), orderBy('created_at')), snap => setSections(snap.docs.map(d => d.data() as OrgEntity)));
        return () => { unsub1(); unsub2(); unsub3(); };
    }, []);

    // Handlers
    const handleAddRoot = () => {
        setTargetType('sector');
        setActionMode('create');
        setFormData({ name_ar: '', name_en: '', manager_id: '', new_parent_id: '' });
        setParentIdForCreate(null);
        setIsEditModalOpen(true);
    };

    const handleAddChild = (parentNode: OrgEntity, parentType: string) => {
        if (parentType === 'sector') setTargetType('department');
        else if (parentType === 'department') setTargetType('section');
        
        setActionMode('create');
        setParentIdForCreate(parentNode.id);
        setFormData({ name_ar: '', name_en: '', manager_id: '', new_parent_id: '' });
        setIsEditModalOpen(true);
    };

    const handleEdit = (node: OrgEntity, type: any) => {
        setTargetNode(node);
        setTargetType(type);
        setActionMode('update');
        setFormData({ 
            name_ar: node.name_ar, 
            name_en: node.name_en, 
            manager_id: node.manager_id || '', 
            new_parent_id: '' 
        });
        setIsEditModalOpen(true);
    };

    const handleMove = (node: OrgEntity, type: any) => {
        setTargetNode(node);
        setTargetType(type);
        setFormData({ name_ar: '', name_en: '', manager_id: '', new_parent_id: '' });
        setIsMoveModalOpen(true);
    };

    const handleDelete = (node: OrgEntity, type: any) => {
        showDialog({
            variant: 'confirm',
            title: language === 'ar' ? 'حذف العنصر' : 'Delete Item',
            message: language === 'ar' ? `هل أنت متأكد من حذف "${node.name_ar}"؟ لا يمكن التراجع.` : `Delete "${node.name_en}"? This cannot be undone.`,
            onConfirm: async () => {
                showActionLoading("Deleting...");
                await manageOrg({ type, action: 'delete', docId: node.id });
                hideActionLoading();
            }
        });
    };

    const submitEditForm = async () => {
        if (!formData.name_ar || !formData.name_en) return;
        showActionLoading("Saving...");
        const payload: any = {
            type: targetType,
            action: ActionMode,
            name_ar: formData.name_ar,
            name_en: formData.name_en,
            manager_id: formData.manager_id || null
        };

        if (ActionMode === 'update') payload.docId = targetNode.id;
        if (ActionMode === 'create' && parentIdForCreate) payload.parent_id = parentIdForCreate;

        const success = await manageOrg(payload);
        hideActionLoading();
        if (success) setIsEditModalOpen(false);
    };

    const submitMoveForm = async () => {
        if (!formData.new_parent_id) return;
        showActionLoading("Moving...");
        const success = await manageOrg({
            type: targetType,
            action: 'move',
            docId: targetNode.id,
            new_parent_id: formData.new_parent_id
        });
        hideActionLoading();
        if (success) setIsMoveModalOpen(false);
    };

    // --- Render Tree Structure ---
    const renderTree = useMemo(() => {
        return sectors.map(sector => (
            <OrgNode 
                key={sector.id} node={sector} type="sector" language={language}
                onEdit={handleEdit} onDelete={handleDelete} onMove={handleMove} onAddChild={handleAddChild}
            >
                {departments.filter(d => d.sector_id === sector.id).map(dept => (
                    <OrgNode 
                        key={dept.id} node={dept} type="department" language={language}
                        onEdit={handleEdit} onDelete={handleDelete} onMove={handleMove} onAddChild={handleAddChild}
                    >
                        {sections.filter(s => s.department_id === dept.id).map(sec => (
                            <OrgNode 
                                key={sec.id} node={sec} type="section" language={language}
                                onEdit={handleEdit} onDelete={handleDelete} onMove={handleMove} onAddChild={handleAddChild}
                            />
                        ))}
                    </OrgNode>
                ))}
            </OrgNode>
        ));
    }, [sectors, departments, sections, language]);

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">{language === 'ar' ? 'إدارة الهيكل الإداري' : 'Org. Structure Manager'}</h1>
                    <p className="text-gray-400 text-sm">{language === 'ar' ? 'إدارة القطاعات، الإدارات، والأقسام' : 'Manage Sectors, Departments, and Sections'}</p>
                </div>
                <button onClick={handleAddRoot} className="bg-[#FFD700] text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-yellow-400 transition-colors">
                    <PlusIcon className="w-5 h-5" /> {language === 'ar' ? 'إضافة قطاع' : 'Add Sector'}
                </button>
            </div>

            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 min-h-[500px]">
                {renderTree}
                {sectors.length === 0 && <div className="text-center py-20 text-gray-500">No structure defined yet.</div>}
            </div>

            {/* --- Create/Update Modal --- */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}} className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">
                                {ActionMode === 'create' ? (language === 'ar' ? 'إضافة جديد' : 'Add New') : (language === 'ar' ? 'تعديل' : 'Edit')}
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)}><XMarkIcon className="w-6 h-6 text-gray-500" /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">الاسم (عربي)</label>
                                <input type="text" value={formData.name_ar} onChange={e => setFormData({...formData, name_ar: e.target.value})} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Name (English)</label>
                                <input type="text" value={formData.name_en} onChange={e => setFormData({...formData, name_en: e.target.value})} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white" />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 px-4 py-2">Cancel</button>
                            <button onClick={submitEditForm} className="bg-blue-500 text-white px-6 py-2 rounded-lg font-bold">Save</button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* --- Move Modal (Smart Migration) --- */}
            {isMoveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <motion.div initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}} className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between mb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <ArrowsRightLeftIcon className="w-5 h-5 text-orange-400" />
                                {language === 'ar' ? 'ترحيل ذكي' : 'Smart Migration'}
                            </h3>
                            <button onClick={() => setIsMoveModalOpen(false)}><XMarkIcon className="w-6 h-6 text-gray-500" /></button>
                        </div>
                        
                        <p className="text-sm text-gray-300 mb-4 bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg">
                            {language === 'ar' 
                                ? `سيتم نقل "${targetNode.name_ar}" وجميع العناصر والموظفين التابعين له إلى الوجهة الجديدة تلقائياً.` 
                                : `Moving "${targetNode.name_en}" will automatically migrate all linked items and users to the new destination.`}
                        </p>

                        <div className="space-y-4">
                            <label className="text-xs text-gray-400 block mb-1">
                                {targetType === 'department' ? (language === 'ar' ? 'انقل إلى قطاع:' : 'Move to Sector:') : (language === 'ar' ? 'انقل إلى إدارة:' : 'Move to Department:')}
                            </label>
                            
                            <select 
                                value={formData.new_parent_id} 
                                onChange={e => setFormData({...formData, new_parent_id: e.target.value})}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white"
                            >
                                <option value="">-- {language === 'ar' ? 'اختر الوجهة' : 'Select Destination'} --</option>
                                {/* إذا كنا ننقل إدارة، نعرض القطاعات. إذا كنا ننقل قسم، نعرض الإدارات */}
                                {targetType === 'department' 
                                    ? sectors.map(s => <option key={s.id} value={s.id}>{language === 'ar' ? s.name_ar : s.name_en}</option>)
                                    : departments.map(d => <option key={d.id} value={d.id}>{language === 'ar' ? d.name_ar : d.name_en}</option>)
                                }
                            </select>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setIsMoveModalOpen(false)} className="text-gray-400 px-4 py-2">Cancel</button>
                            <button onClick={submitMoveForm} className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold">Confirm Move</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
