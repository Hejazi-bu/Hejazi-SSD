// src/components/Permission/Delegation/Shared/DelegationTree.tsx
import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronRightIcon, ChevronDownIcon, ShieldCheckIcon, 
    DocumentTextIcon, CogIcon, PencilIcon,
    BriefcaseIcon, CheckCircleIcon, XCircleIcon
} from "@heroicons/react/24/outline";

export type ServiceNode = { 
    id: string; 
    label: string; 
    children: ServiceNode[]; 
    parentId?: string; 
    type: 'service' | 'page' | 'action' 
};

interface TriStateSwitchProps {
    currentState: boolean | undefined;
    jobState?: boolean; 
    onChange: (val: boolean | undefined) => void;
    disabled?: boolean;
    type?: 'user' | 'job' | 'company';
}

export const TriStateSwitch = memo(({ currentState, jobState, onChange, disabled, type = 'user' }: TriStateSwitchProps) => {
    if (disabled) return <div className="opacity-30 cursor-not-allowed p-2"><XCircleIcon className="w-6 h-6 text-gray-500" /></div>;
    
    const handleStop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

    // 1. Job/Company Mode (Binary)
    if (type === 'job' || type === 'company') {
        const isGranted = currentState === true; 
        return (
            <div className="flex items-center bg-gray-900/80 rounded-lg p-1 border border-gray-700 shrink-0 z-10 relative gap-1 shadow-sm" onClick={handleStop}>
                <button onClick={(e) => { e.stopPropagation(); onChange(undefined); }} 
                    className={`w-7 h-7 flex items-center justify-center rounded transition-all ${!isGranted ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'text-gray-500 hover:bg-gray-800'}`}
                    title="سحب الصلاحية"
                >
                    <XCircleIcon className="w-5 h-5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onChange(true); }} 
                    className={`w-7 h-7 flex items-center justify-center rounded transition-all ${isGranted ? 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/50' : 'text-gray-500 hover:bg-gray-800'}`}
                    title="منح الصلاحية"
                >
                    <CheckCircleIcon className="w-5 h-5" />
                </button>
            </div>
        );
    }

    // 2. User Mode (Tristate)
    return (
        <div className="flex items-center bg-gray-900/80 rounded-lg p-1 border border-gray-700 shrink-0 z-10 relative gap-1 shadow-sm" onClick={handleStop}>
            <button onClick={(e) => { e.stopPropagation(); onChange(false); }} 
                className={`w-7 h-7 flex items-center justify-center rounded transition-all ${currentState === false ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'text-gray-500 hover:bg-gray-800'}`}
                title="حظر"
            >
                <XCircleIcon className="w-5 h-5" />
            </button>
            
            <button onClick={(e) => { e.stopPropagation(); onChange(undefined); }} 
                className={`w-7 h-7 flex items-center justify-center rounded transition-all relative ${currentState === undefined ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'text-gray-500 hover:bg-gray-800'}`}
                title="توريث من الوظيفة"
            >
                <BriefcaseIcon className="w-4 h-4" />
                {currentState === undefined && (
                    <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${jobState ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                )}
            </button>
            
            <button onClick={(e) => { e.stopPropagation(); onChange(true); }} 
                className={`w-7 h-7 flex items-center justify-center rounded transition-all ${currentState === true ? 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/50' : 'text-gray-500 hover:bg-gray-800'}`}
                title="منح استثناء"
            >
                <CheckCircleIcon className="w-5 h-5" />
            </button>
        </div>
    );
});

// --- Tree Row ---
interface ServiceTreeRowProps {
    node: ServiceNode;
    getState: (id: string) => boolean | undefined;
    getJobState?: (id: string) => boolean;
    getInitialState?: (id: string) => boolean | undefined;
    onToggle: (id: string, val: boolean | undefined) => void;
    canEdit: (id: string) => boolean;
    t: any;
    depth?: number;
    searchTerm?: string;
    rowType?: 'user' | 'job' | 'company';
    // ✅ إضافة خاصية دالة الرسم
    renderScopeButton?: (node: ServiceNode) => React.ReactNode; 
}

export const ServiceTreeRow = memo(({ 
    node, getState, getJobState, getInitialState, onToggle, 
    canEdit, t, depth = 0, searchTerm = "", rowType = 'user',
    renderScopeButton // ✅ استقبال الدالة
}: ServiceTreeRowProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const isService = node.type === 'service';
    const isPage = node.type === 'page';

    useEffect(() => { 
        if (searchTerm.length > 0) setIsExpanded(true); 
        else if (isService) setIsExpanded(false); 
    }, [searchTerm, isService]);

    const myState = getState(node.id);
    const myJobState = getJobState ? getJobState(node.id) : false;
    const myInitialState = getInitialState ? getInitialState(node.id) : undefined;
    const isDirty = (myState !== undefined || myInitialState !== undefined) && myState !== myInitialState;
    const hasChildren = node.children && node.children.length > 0;

    if (!canEdit(node.id)) return null;

    return (
        <div className="flex flex-col w-full mb-1">
            <div 
                className={`
                    relative flex items-center justify-between p-3 rounded-lg border transition-all w-full cursor-pointer group
                    ${isService 
                        ? 'bg-gray-800/80 border-gray-700 shadow-sm' 
                        : isPage 
                            ? 'bg-gray-800/40 border-gray-700/50' 
                            : 'bg-gray-900/40 border-gray-800'
                    }
                    hover:border-[#FFD700]/30 hover:bg-gray-800/60
                `}
                onClick={() => hasChildren && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    <div className={`w-6 h-6 flex items-center justify-center text-gray-500 transition-transform ${isExpanded ? 'rotate-0' : 'rtl:rotate-180'}`}>
                        {hasChildren && (isExpanded ? <ChevronDownIcon className="w-4 h-4 text-[#FFD700]" /> : <ChevronRightIcon className="w-4 h-4" />)}
                    </div>
                    
                    <div className={`shrink-0 ${isService ? 'text-[#FFD700]' : isPage ? 'text-blue-400' : 'text-green-400'}`}>
                        {isService ? <ShieldCheckIcon className="w-5 h-5" /> : isPage ? <DocumentTextIcon className="w-5 h-5" /> : <CogIcon className="w-5 h-5" />}
                    </div>

                    <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-bold truncate ${myState === true ? 'text-[#FFD700]' : (myState === false || (myState === undefined && rowType === 'job')) ? 'text-gray-400' : 'text-gray-300'}`}>
                            {node.label}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                             <span className="text-[10px] text-gray-500">{isService ? t.levelService : isPage ? t.levelPage : t.levelAction}</span>
                             {isDirty && <span className="text-blue-400 text-[10px] flex items-center gap-1 bg-blue-500/10 px-1 rounded"><PencilIcon className="w-3 h-3" /></span>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* ✅ استدعاء الدالة لرسم الزر إذا مررت */}
                    {renderScopeButton && renderScopeButton(node)}
                    
                    <TriStateSwitch 
                        currentState={myState} 
                        jobState={myJobState} 
                        onChange={(val) => onToggle(node.id, val)} 
                        disabled={false} 
                        type={rowType} 
                    />
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && hasChildren && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="flex flex-col w-full pl-4 rtl:pr-4 mt-1 border-l-2 border-gray-800/50 ml-3 rtl:mr-3 rtl:border-l-0 rtl:border-r-2"
                    >
                        {node.children.map((child) => (
                            <ServiceTreeRow 
                                key={child.id} node={child} 
                                getState={getState} getJobState={getJobState} getInitialState={getInitialState}
                                onToggle={onToggle} canEdit={canEdit} t={t} depth={depth + 1} searchTerm={searchTerm} rowType={rowType}
                                
                                // ✅ تمرير الدالة للأبناء (Recursion)
                                renderScopeButton={renderScopeButton}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});