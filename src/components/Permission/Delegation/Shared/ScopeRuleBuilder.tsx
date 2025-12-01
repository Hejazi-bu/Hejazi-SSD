// src/components/Permission/Delegation/Shared/ScopeRuleBuilder.tsx
import React, { useState } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { 
    BriefcaseIcon, BuildingOfficeIcon, BuildingLibraryIcon, 
    UserGroupIcon, PlusIcon
} from "@heroicons/react/24/outline";

interface BasicEntity { id: string; name_ar: string; name_en: string; [key: string]: unknown; }

interface ScopeRuleBuilderProps {
    jobs: BasicEntity[];
    companies: BasicEntity[];
    sections: BasicEntity[]; // ✅ فقط الشركات والأقسام
    onAddRule: (rule: any) => void;
    t: any;
}

export const ScopeRuleBuilder = ({ jobs, companies, sections, onAddRule, t }: ScopeRuleBuilderProps) => {
    const { language } = useLanguage();
    const isAr = language === 'ar';

    const [selectedJob, setSelectedJob] = useState<string>("");
    const [selectedCompany, setSelectedCompany] = useState<string>("");
    const [selectedSection, setSelectedSection] = useState<string>("");
    const [restrictedToCompany, setRestrictedToCompany] = useState(false);

    const handleAdd = () => {
        if (!selectedJob) return;

        const rule = {
            target_job_id: selectedJob,
            scope_company_id: selectedCompany || null,
            restricted_to_company: restrictedToCompany,
            scope_section_id: selectedSection || null
        };

        onAddRule(rule);
        // Reset
        setSelectedJob("");
        setSelectedCompany("");
        setSelectedSection("");
        setRestrictedToCompany(false);
    };

    return (
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-bold text-blue-400 mb-4 flex items-center gap-2">
                <PlusIcon className="w-4 h-4" /> إضافة قاعدة نطاق جديدة
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. الوظيفة */}
                <div className="space-y-1">
                    <label className="text-xs text-gray-400">الوظيفة المستهدفة <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <select
                            value={selectedJob}
                            onChange={(e) => setSelectedJob(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 pl-9 text-sm text-white focus:border-blue-500 appearance-none"
                        >
                            <option value="">اختر الوظيفة...</option>
                            <option value="ALL">-- كل الوظائف --</option>
                            {jobs.map(j => (
                                <option key={j.id} value={j.id}>{isAr ? j.name_ar : j.name_en}</option>
                            ))}
                        </select>
                        <BriefcaseIcon className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none" />
                    </div>
                </div>

                {/* 2. الشركة */}
                <div className="space-y-1">
                    <label className="text-xs text-gray-400">الشركة (النطاق)</label>
                    <div className="relative">
                        <select
                            value={selectedCompany}
                            onChange={(e) => { setSelectedCompany(e.target.value); if(e.target.value) setRestrictedToCompany(false); }}
                            disabled={restrictedToCompany}
                            className={`w-full bg-gray-900 border border-gray-600 rounded-lg p-2 pl-9 text-sm text-white focus:border-blue-500 appearance-none ${restrictedToCompany ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value="">-- كل الشركات --</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>{isAr ? c.name_ar : c.name_en}</option>
                            ))}
                        </select>
                        <BuildingOfficeIcon className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type="checkbox" id="restricted"
                            checked={restrictedToCompany}
                            onChange={(e) => { setRestrictedToCompany(e.target.checked); if(e.target.checked) setSelectedCompany(""); }}
                            className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-0"
                        />
                        <label htmlFor="restricted" className="text-[10px] text-gray-400 cursor-pointer select-none">قصر النطاق على شركة الموظف المانح فقط</label>
                    </div>
                </div>

                {/* 3. القسم */}
                <div className="space-y-1">
                    <label className="text-xs text-gray-400">القسم (النطاق)</label>
                    <div className="relative">
                        <select
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 pl-9 text-sm text-white focus:border-blue-500 appearance-none"
                        >
                            <option value="">-- كل الأقسام --</option>
                            {sections.map(s => (
                                <option key={s.id} value={s.id}>{isAr ? s.name_ar : s.name_en}</option>
                            ))}
                        </select>
                        <UserGroupIcon className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none" />
                    </div>
                </div>

                {/* زر الإضافة */}
                <div className="flex items-end">
                    <button
                        onClick={handleAdd}
                        disabled={!selectedJob}
                        className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${selectedJob ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                        <PlusIcon className="w-5 h-5" /> إضافة القاعدة
                    </button>
                </div>
            </div>
        </div>
    );
};