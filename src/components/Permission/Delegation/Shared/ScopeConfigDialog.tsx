// src/components/Permission/Delegation/Shared/ScopeConfigDialog.tsx
import React, { useState, useEffect } from 'react';
import { 
    BuildingOfficeIcon, XMarkIcon
} from "@heroicons/react/24/outline";

interface BasicEntity { id: string; name_ar: string; name_en: string; [key: string]: unknown; }

interface ScopeConfigDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (scope: { scope_company_id: string | null, scope_section_id: string | null }) => void;
    validCompanies: BasicEntity[];
    validSections: BasicEntity[];
    initialScope: { scope_company_id?: string | null, scope_section_id?: string | null } | null;
    t: any;
    language: string;
}

export const ScopeConfigDialog = ({ 
    isOpen, onClose, onSave, 
    validCompanies, validSections, initialScope, 
    t, language 
}: ScopeConfigDialogProps) => {
    const [selectedCompany, setSelectedCompany] = useState<string>("");
    const [selectedSection, setSelectedSection] = useState<string>("");

    useEffect(() => {
        if (isOpen) {
            setSelectedCompany(initialScope?.scope_company_id || "");
            setSelectedSection(initialScope?.scope_section_id || "");
        }
    }, [isOpen, initialScope]);

    if (!isOpen) return null;

    const isAr = language === 'ar';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <BuildingOfficeIcon className="w-5 h-5 text-blue-400" />
                        {t.configureScope || "تخصيص النطاق"}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-full transition-colors">
                        <XMarkIcon className="w-5 h-5 text-gray-500 hover:text-white" />
                    </button>
                </div>
                
                {/* ملاحظة التوزيع */}
                {t.distributionNotice && (
                    <p className="text-xs text-yellow-500/80 mb-4 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                        {t.distributionNotice}
                    </p>
                )}

                <div className="space-y-4">
                    {/* الشركة */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">{t.companyLabel || "الشركة"}</label>
                        <div className="relative">
                            <select 
                                value={selectedCompany} 
                                onChange={(e) => setSelectedCompany(e.target.value)} 
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none appearance-none"
                            >
                                <option value="">{t.scopeGlobal || "عام (الكل)"}</option>
                                {validCompanies.map((c) => ( 
                                    <option key={c.id} value={c.id}>{isAr ? c.name_ar : c.name_en}</option> 
                                ))}
                            </select>
                            {/* سهم القائمة المنسدلة */}
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-gray-500">
                                <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>
                    </div>

                    {/* القسم */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">{t.sectionLabel || "القسم"}</label>
                        <div className="relative">
                            <select 
                                value={selectedSection} 
                                onChange={(e) => setSelectedSection(e.target.value)} 
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none appearance-none"
                            >
                                <option value="">{t.scopeGlobal || "عام (الكل)"}</option>
                                {validSections.map((s) => ( 
                                    <option key={s.id} value={s.id}>{isAr ? s.name_ar : s.name_en}</option> 
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-gray-500">
                                <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-gray-700 pt-4">
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-sm font-medium px-3 py-2 transition-colors">
                        {t.cancel || "إلغاء"}
                    </button>
                    <button 
                        onClick={() => onSave({ 
                            scope_company_id: selectedCompany || null,
                            scope_section_id: selectedSection || null
                        })} 
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                        {t.save || "حفظ"}
                    </button>
                </div>
            </div>
        </div>
    );
};