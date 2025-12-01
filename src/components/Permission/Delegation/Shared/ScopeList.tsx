// src/components/Permission/Delegation/Shared/ScopeList.tsx
import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    TrashIcon, BriefcaseIcon, BuildingOfficeIcon, 
    BuildingLibraryIcon, UserGroupIcon, LockClosedIcon
} from "@heroicons/react/24/outline";

interface ScopeListProps {
    rules: any[];
    onRemove: (index: number) => void;
    jobs: any[];
    companies: any[];
    sectors: any[];
    departments: any[];
    sections: any[]; // ✅
    t: any;
}

export const ScopeList = ({ 
    rules, onRemove, jobs, companies, sectors, departments, sections, t 
}: ScopeListProps) => {
    const { language } = useLanguage();
    const isAr = language === 'ar';

    const getName = (list: any[], id: string | null, defaultText: string) => {
        if (!id) return defaultText;
        const item = list.find(i => String(i.id) === String(id));
        return item ? (isAr ? item.name_ar : item.name_en) : id;
    };

    if (!rules || rules.length === 0) {
        return (
            <div className="text-center py-10 border-2 border-dashed border-gray-700/50 rounded-xl bg-gray-800/20">
                <p className="text-gray-500 text-sm">لا توجد قواعد نطاق مضافة حالياً.</p>
                <p className="text-gray-600 text-xs mt-1">استخدم النموذج أعلاه لإضافة قاعدة جديدة.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <AnimatePresence mode='popLayout'>
                {rules.map((rule, index) => (
                    <motion.div 
                        key={`${index}-${rule.target_job_id}`}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.90, transition: { duration: 0.2 } }}
                        layout
                        className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-start justify-between group hover:border-blue-500/30 hover:bg-gray-800/80 transition-all shadow-sm"
                    >
                        <div className="flex flex-col gap-2 w-full">
                            {/* الوظيفة */}
                            <div className="flex items-center gap-2 mb-1">
                                <div className="bg-blue-500/10 p-1.5 rounded-md border border-blue-500/20">
                                    <BriefcaseIcon className="w-4 h-4 text-blue-400" />
                                </div>
                                <span className="text-gray-400 text-xs">يتحكم في وظيفة:</span>
                                <span className="text-white font-bold text-sm">
                                    {rule.target_job_id === 'ALL' ? 'كل الوظائف' : getName(jobs, rule.target_job_id, 'وظيفة غير معروفة')}
                                </span>
                            </div>

                            {/* تفاصيل النطاق */}
                            <div className="flex flex-wrap items-center gap-y-2 text-xs bg-gray-900/50 p-2 rounded-md border border-gray-700/50 w-fit max-w-full">
                                <span className="text-gray-500 pl-2 rtl:border-l border-gray-700 ml-2">النطاق:</span>

                                {/* الشركة */}
                                <div className="flex items-center gap-1 text-gray-300">
                                    {rule.restricted_to_company ? (
                                        <span className="flex items-center gap-1 text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded text-[10px] border border-orange-400/20">
                                            <LockClosedIcon className="w-3 h-3" /> نفس شركة الموظف
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1">
                                            <BuildingOfficeIcon className="w-3 h-3 text-gray-500" />
                                            {getName(companies, rule.scope_company_id, 'كل الشركات')}
                                        </span>
                                    )}
                                </div>

                                {/* القطاع */}
                                {rule.scope_sector_id && (
                                    <>
                                        <span className="text-gray-600 mx-1">/</span>
                                        <span className="flex items-center gap-1 text-gray-300">
                                            <BuildingLibraryIcon className="w-3 h-3 text-gray-500" />
                                            {getName(sectors, rule.scope_sector_id, '')}
                                        </span>
                                    </>
                                )}

                                {/* الإدارة */}
                                {rule.scope_department_id && (
                                    <>
                                        <span className="text-gray-600 mx-1">/</span>
                                        <span className="flex items-center gap-1 text-gray-300">
                                            <UserGroupIcon className="w-3 h-3 text-gray-500" />
                                            {getName(departments, rule.scope_department_id, '')}
                                        </span>
                                    </>
                                )}

                                {/* القسم (Section) ✅ */}
                                {rule.scope_section_id && (
                                    <>
                                        <span className="text-gray-600 mx-1">/</span>
                                        <span className="flex items-center gap-1 text-gray-300">
                                            <span className="text-gray-500 text-[10px] border border-gray-600 px-1 rounded">قسم</span>
                                            {getName(sections, rule.scope_section_id, '')}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <button onClick={() => onRemove(index)} className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors self-center ml-2">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};