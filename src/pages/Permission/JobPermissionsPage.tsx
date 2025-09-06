import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../components/contexts/UserContext';
import { useLanguage } from '../../components/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, LoaderCircle, ChevronRight, Check, X, Search, ChevronLeft, RotateCcw, Edit, Folder } from 'lucide-react';
import AdminSectionLayout from '../../layouts/AdminSectionLayout';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { usePrompt } from '../../hooks/usePrompt';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

type Job = { id: number; name_ar: string; name_en: string; };
type ServiceNode = {
    id: string;
    label: string;
    children: ServiceNode[];
    parentId?: string;
};
type PathItem = {
    id: string;
    label: string;
};

// وظيفة لعرض إشعار تأكيد مخصص
const confirmToast = (message: string, onConfirm: () => void, onCancel: () => void, t: any) => {
    toast((toastInstance) => (
        <div className="relative z-50 p-4 bg-gray-800 rounded-lg shadow-xl min-w-[280px]">
            <h3 className="text-lg font-bold text-[#FFD700] mb-2">{t.confirmTitle}</h3>
            <p className="text-sm font-semibold text-gray-200 mb-4">{message}</p>
            <div className="flex gap-2 w-full justify-end">
                <button
                    className="bg-gray-500 hover:bg-gray-600 text-white text-xs font-bold px-4 py-2 rounded-md transition-colors"
                    onClick={() => {
                        onCancel();
                        toast.dismiss(toastInstance.id);
                    }}
                >
                    {t.confirmCancel}
                </button>
                <button
                    className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-md transition-colors"
                    onClick={() => {
                        onConfirm();
                        toast.dismiss(toastInstance.id);
                    }}
                >
                    {t.confirmYes}
                </button>
            </div>
        </div>
    ), {
        duration: Infinity,
        style: {
            background: 'transparent',
            boxShadow: 'none',
            padding: 0,
        },
    });
};

const PermissionsList = React.memo(({
    nodes,
    onNavigate,
    onToggle,
    jobPermissions,
}: {
    nodes: ServiceNode[];
    onNavigate: (node: ServiceNode) => void;
    onToggle: (id: string, isChecked: boolean) => void;
    jobPermissions: Set<string>;
}) => {
    const { language } = useLanguage();
    const isRTL = language === 'ar';
    const t = translations[language];

    if (nodes.length === 0) {
        return (
            <div className="text-center text-gray-500 py-10">
                {t.noResults}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {nodes.map(node => {
                const isChecked = jobPermissions.has(node.id);
                const hasChildren = node.children && node.children.length > 0;

                const totalPermissionsCount = useMemo(() => {
                    let count = 0;
                    const traverse = (nodes: ServiceNode[]) => {
                        nodes.forEach(n => {
                            count++;
                            traverse(n.children);
                        });
                    };
                    traverse(node.children);
                    return count;
                }, [node.children]);

                const enabledPermissionsCount = useMemo(() => {
                    let count = 0;
                    const traverse = (nodes: ServiceNode[]) => {
                        nodes.forEach(n => {
                            if (jobPermissions.has(n.id)) {
                                count++;
                            }
                            traverse(n.children);
                        });
                    };
                    traverse(node.children);
                    return count;
                }, [node.children, jobPermissions]);
                const disabledPermissionsCount = totalPermissionsCount - enabledPermissionsCount;

                return (
                    <motion.div
                        key={node.id}
                        className="bg-gray-800/30 rounded-lg border border-transparent transition-colors"
                        whileHover={{ backgroundColor: 'rgba(55, 65, 81, 0.4)' }}
                        transition={{ duration: 0.15 }}
                    >
                        <div className="flex items-center justify-between p-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                    {hasChildren && (
                                        <motion.button
                                            onClick={() => onNavigate(node)}
                                            className="text-yellow-400 p-1 rounded-full hover:bg-gray-700/50 transition-all active:scale-90"
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            <Folder size={20} />
                                        </motion.button>
                                    )}
                                    <span
                                        className="font-bold text-white break-words flex-1 min-w-0"
                                        data-tooltip-id={`tooltip-${node.id}`}
                                        data-tooltip-content={node.label}
                                        data-tooltip-place="top"
                                    >
                                        {node.label}
                                    </span>
                                </div>
                                {hasChildren && (
                                    <div className="flex items-center gap-4 text-xs text-gray-400 mt-1 pl-6 rtl:pr-6">
                                        <span className="flex items-center gap-1">
                                            <Check size={12} className="text-green-400" />
                                            {enabledPermissionsCount}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <X size={12} className="text-red-400" />
                                            {disabledPermissionsCount}
                                        </span>
                                        <span className="font-semibold">{`(${node.children.length} ${language === 'ar' ? 'services' : 'services'})`}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex-shrink-0">
                                <motion.button
                                    onClick={(e) => { e.stopPropagation(); onToggle(node.id, !isChecked); }}
                                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-all ${isChecked ? 'bg-green-500' : 'bg-gray-600'} hover:scale-105 active:scale-95`}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-all ${isChecked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'}`} />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                );
            })}
            <Tooltip id="tooltip" className="bg-gray-700 text-white rounded-md p-2 shadow-lg z-50" />
        </div>
    );
});


const translations = {
    ar: {
        pageTitle: "صلاحيات المسميات الوظيفية",
        selectJob: "اختر مسمى وظيفي:",
        permissionsTree: "شجرة الصلاحيات",
        noJobSelected: "يرجى اختيار مسمى وظيفي لبدء إدارة الصلاحيات.",
        loading: "جاري التحميل...",
        saveChanges: "حفظ التغييرات",
        saving: "جاري الحفظ...",
        saveSuccess: "تم حفظ الصلاحيات بنجاح.",
        saveError: "حدث خطأ أثناء حفظ الصلاحيات.",
        noPermission: "ليس لديك صلاحية.",
        selectAll: "تفعيل الكل",
        deselectAll: "تعطيل الكل",
        resetVisible: "إعادة",
        controlElementsTitle: "عناصر التحكم",
        visibleActionsDescription: "تتحكم هذه الأزرار في الصلاحيات المعروضة في القائمة الحالية فقط.",
        searchPermissions: "بحث في الصلاحيات...",
        noSearchResults: "لا توجد نتائج بحث مطابقة.",
        enabledPermissions: "صلاحيات مفعلة",
        disabledPermissions: "صلاحيات غير مفعلة",
        searchJobPlaceholder: "ابحث عن مسمى وظيفي...",
        changeJob: "تغيير المسمى",
        unsavedChangesWarning: "لديك تعديلات غير محفوظة. هل أنت متأكد من أنك تريد المتابعة؟",
        confirmTitle: "تنبيه!",
        confirmYes: "نعم، متابعة",
        confirmCancel: "إلغاء",
        globalActions: "إجراءات شاملة",
        noResults: "لا توجد نتائج.",
        confirmSelectAll: "سيتم تفعيل جميع الصلاحيات المعروضة الآن. هل تريد المتابعة؟",
        confirmDeselectAll: "سيتم تعطيل جميع الصلاحيات المعروضة الآن. هل تريد المتابعة؟",
        confirmReset: "سيتم إعادة تهيئة الصلاحيات المعروضة الآن إلى حالتها الأصلية. هل تريد المتابعة؟",
        confirmSave: "سيتم حفظ جميع التغييرات التي قمت بها. هل تريد المتابعة؟",
        root: "الرئيسية"
    },
    en: {
        pageTitle: "Job Permissions Management",
        selectJob: "Select a Job Title:",
        permissionsTree: "Permissions Tree",
        noJobSelected: "Please select a job title to start managing permissions.",
        loading: "Loading...",
        saveChanges: "Save Changes",
        saving: "Saving...",
        saveSuccess: "Permissions saved successfully.",
        saveError: "An error occurred while saving permissions.",
        noPermission: "No permission.",
        selectAll: "Select All",
        deselectAll: "Deselect All",
        resetVisible: "Reset",
        controlElementsTitle: "Control Elements",
        visibleActionsDescription: "These buttons control the permissions in the current visible list only.",
        searchPermissions: "Search permissions...",
        noSearchResults: "No matching search results.",
        enabledPermissions: "Enabled permissions",
        disabledPermissions: "Disabled permissions",
        searchJobPlaceholder: "Search for a job title...",
        changeJob: "Change Job",
        unsavedChangesWarning: "You have unsaved changes. Are you sure you want to proceed?",
        confirmTitle: "Warning!",
        confirmYes: "Yes, proceed",
        confirmCancel: "Cancel",
        globalActions: "Global Actions",
        noResults: "No results.",
        confirmSelectAll: "This will enable all currently displayed permissions. Do you want to proceed?",
        confirmDeselectAll: "This will disable all currently displayed permissions. Do you want to proceed?",
        confirmReset: "This will reset all currently displayed permissions to their original state. Do you want to proceed?",
        confirmSave: "This will save all your changes. Do you want to proceed?",
        root: "Home"
    }
};

const JobPermissionsPage = () => {
    const { language } = useLanguage();
    const { hasPermission, user } = useAuth();
    const isRTL = language === 'ar';
    const navigate = useNavigate(); 
    
    // تعريف ref للهيدر للحصول على ارتفاعه
    const headerRef = useRef<HTMLElement>(null);
    const [mainHeaderHeight, setMainHeaderHeight] = useState(0);

    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [selectedJobName, setSelectedJobName] = useState<string>('');
    const [servicesTree, setServicesTree] = useState<ServiceNode[]>([]);
    const [jobPermissions, setJobPermissions] = useState<Set<string>>(new Set());
    const [initialJobPermissions, setInitialJobPermissions] = useState<Set<string>>(new Set());
    const [initialVisiblePermissions, setInitialVisiblePermissions] = useState<Set<string>>(new Set());
    
    const [jobSearchFilter, setJobSearchFilter] = useState('');
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const [path, setPath] = useState<PathItem[]>([]);
    const currentNode = useMemo(() => {
        if (path.length === 0) {
            return { id: 'root', label: 'Root', children: servicesTree };
        }
        let current = { id: 'root', label: 'Root', children: servicesTree };
        for (const item of path) {
                const found = current.children.find(node => node.id === item.id);
                if (found) {
                    current = found;
                } else {
                    return { id: 'root', label: 'Root', children: servicesTree };
                }
        }
        return current;
    }, [path, servicesTree]);
    
    const t = translations[language];

    const findNode = useCallback((nodes: ServiceNode[], id: string): ServiceNode | null => {
        for (const node of nodes) {
            if (node.id === id) {
                return node;
            }
            if (node.children) {
                const foundChild = findNode(node.children, id);
                if (foundChild) {
                    return foundChild;
                }
            }
        }
        return null;
    }, []);

    const filteredNodes = useMemo(() => {
      const currentNodes = currentNode.children;
      return currentNodes;
    }, [currentNode]);
    
    const getInitialVisiblePermissions = useCallback((nodes: ServiceNode[], allInitialPermissions: Set<string>): Set<string> => {
        const initialPerms = new Set<string>();
        const traverseAndCheck = (currentNodes: ServiceNode[]) => {
            currentNodes.forEach(node => {
                if (allInitialPermissions.has(node.id)) {
                    initialPerms.add(node.id);
                }
                traverseAndCheck(node.children);
            });
        };
        traverseAndCheck(nodes);
        return initialPerms;
    }, []);

    const getAllPermissionIds = useCallback((nodes: ServiceNode[]): Set<string> => {
      const allIds = new Set<string>();
      const traverse = (currentNodes: ServiceNode[]) => {
        currentNodes.forEach(node => {
          allIds.add(node.id);
          traverse(node.children);
        });
      };
      traverse(nodes);
      return allIds;
    }, []);

    const allVisibleNodesSelected = useMemo(() => {
        if (filteredNodes.length === 0) return false;
        return filteredNodes.every(node => jobPermissions.has(node.id));
    }, [filteredNodes, jobPermissions]);

    const noVisibleNodesSelected = useMemo(() => {
        if (filteredNodes.length === 0) return true;
        return filteredNodes.every(node => !jobPermissions.has(node.id));
    }, [filteredNodes, jobPermissions]);
    
    const hasVisibleChanges = useMemo(() => {
      const currentVisiblePerms = new Set<string>();
      const traverseAndCheck = (nodes: ServiceNode[]) => {
            nodes.forEach(node => {
                if (jobPermissions.has(node.id)) {
                    currentVisiblePerms.add(node.id);
                }
                traverseAndCheck(node.children);
            });
      };
      traverseAndCheck(filteredNodes);
      
      const initialIdsString = Array.from(initialVisiblePermissions).sort().join(',');
      const currentIdsString = Array.from(currentVisiblePerms).sort().join(',');

      return initialIdsString !== currentIdsString;
    }, [filteredNodes, jobPermissions, initialVisiblePermissions]);

    const filteredJobs = useMemo(() => {
        if (!jobSearchFilter) return jobs;
        const lowercasedFilter = jobSearchFilter.toLowerCase();
        return jobs.filter(job =>
            (job.name_ar && job.name_ar.toLowerCase().includes(lowercasedFilter)) ||
            (job.name_en && job.name_en.toLowerCase().includes(lowercasedFilter))
        );
    }, [jobs, jobSearchFilter]);

    const totalPermissionsCount = useMemo(() => {
        let count = 0;
        const traverse = (nodes: ServiceNode[]) => {
            nodes.forEach(n => {
                count++;
                traverse(n.children);
            });
        };
        traverse(servicesTree);
        return count;
    }, [servicesTree]);

    const enabledPermissionsCount = useMemo(() => jobPermissions.size, [jobPermissions]);
    const disabledPermissionsCount = totalPermissionsCount - enabledPermissionsCount;

    const hasChanges = useMemo(() => {
        const initialIdsString = Array.from(initialJobPermissions).sort().join(',');
        const currentIdsString = Array.from(jobPermissions).sort().join(',');
        return initialIdsString !== currentIdsString;
    }, [jobPermissions, initialJobPermissions]);
    
    const handleNavigationWithPrompt = useCallback(() => {
        if (hasChanges) {
            setIsConfirming(true);
            confirmToast(t.unsavedChangesWarning,
                () => {
                    navigate('/dashboard');
                    setIsConfirming(false);
                },
                () => {
                    setIsConfirming(false);
                },
                t
            );
        } else {
            navigate('/dashboard');
        }
    }, [hasChanges, t, navigate]);

    usePrompt(t.unsavedChangesWarning, hasChanges);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [hasChanges]);
    
    // useEffect جديد لتحديث المسار عند تغيير اللغة
    useEffect(() => {
      // هذه الدالة تعيد بناء المسار بناءً على اللغة الجديدة
      const updatePathLabels = () => {
          setPath(prevPath => {
              // إذا كان المسار فارغًا، لا حاجة للتحديث
              if (prevPath.length === 0) return prevPath;
  
              return prevPath.map(item => {
                  const node = findNode(servicesTree, item.id);
                  // إذا تم العثور على العقدة، قم بتحديث التسمية (label)
                  if (node) {
                      return { ...item, label: node.label };
                  }
                  return item; // وإلا، أعد العنصر كما هو
              });
          });
      };
  
      updatePathLabels();
    }, [language, servicesTree, findNode]); // الاعتماد على اللغة وشجرة الخدمات لضمان التحديث الصحيح

    useEffect(() => {
        const fetchInitialData = async () => {
            const [jobsRes, servicesRes, subServicesRes, subSubServicesRes] = await Promise.all([
                supabase.from('jobs').select('id, name_ar, name_en').order('id'),
                supabase.from('services').select('id, label_ar, label_en').order('order'),
                supabase.from('sub_services').select('id, service_id, label_ar, label_en').order('order'),
                supabase.from('sub_sub_services').select('id, sub_service_id, label_ar, label_en').order('order')
            ]);

            setJobs(jobsRes.data || []);
            const tree = (servicesRes.data || []).map(s => {
                const subServices = (subServicesRes.data || [])
                    .filter(ss => ss.service_id === s.id)
                    .map(ss => {
                        const subSubServices = (subSubServicesRes.data || [])
                            .filter(sss => sss.sub_service_id === ss.id)
                            .map(sss => ({
                                id: `sss:${sss.id}`,
                                label: language === 'ar' ? sss.label_ar : sss.label_en,
                                children: [],
                                parentId: `ss:${ss.id}`
                            }));
                        return {
                            id: `ss:${ss.id}`,
                            label: language === 'ar' ? ss.label_ar : ss.label_en,
                            children: subSubServices,
                            parentId: `s:${s.id}`
                        };
                    });
                return {
                    id: `s:${s.id}`,
                    label: language === 'ar' ? s.label_ar : s.label_en,
                    children: subServices,
                };
            });
            setServicesTree(tree);
            setIsLoading(false);
        };
        if(hasPermission('ss:9')) fetchInitialData(); else setIsLoading(false);
    }, [language, hasPermission]);
    
    useEffect(() => {
        if (selectedJobId !== null) {
            const job = jobs.find(j => j.id === selectedJobId);
            if (job) {
                setSelectedJobName(language === 'ar' ? job.name_ar : job.name_en);
            }
        }
    }, [language, selectedJobId, jobs]);

    const handleSelectJob = useCallback(async (job: Job) => {
        setSelectedJobId(job.id);
        setSelectedJobName(language === 'ar' ? job.name_ar : job.name_en);
        setJobSearchFilter('');

        const { data } = await supabase.from('job_permissions').select('*').eq('job_id', job.id);
        const perms = new Set((data || []).map(p => {
            if (p.sub_sub_service_id) return `sss:${p.sub_sub_service_id}`;
            if (p.sub_service_id) return `ss:${p.sub_service_id}`;
            return `s:${p.service_id}`;
        }));
        setJobPermissions(perms);
        setInitialJobPermissions(new Set(perms));
        setPath([]);
        const initialPermsForView = getInitialVisiblePermissions(servicesTree, perms);
        setInitialVisiblePermissions(initialPermsForView);
    }, [language, servicesTree, getInitialVisiblePermissions]);

    const handleChangeJob = () => {
        if (hasChanges) {
            setIsConfirming(true);
            confirmToast(t.unsavedChangesWarning,
                () => {
                    setSelectedJobId(null);
                    setSelectedJobName('');
                    setJobPermissions(new Set());
                    setInitialJobPermissions(new Set());
                    setPath([]);
                    setJobSearchFilter('');
                    setIsConfirming(false);
                },
                () => {
                    setIsConfirming(false);
                },
                t
            );
        } else {
            setSelectedJobId(null);
            setSelectedJobName('');
            setJobPermissions(new Set());
            setInitialJobPermissions(new Set());
            setPath([]);
            setJobSearchFilter('');
        }
    };

    const handlePermissionToggle = useCallback((nodeId: string, isChecked: boolean) => {
        setJobPermissions(prev => {
            const newPerms = new Set(prev);
            
            if (isChecked) {
                newPerms.add(nodeId);
            } else {
                newPerms.delete(nodeId);
            }

            if (isChecked) {
                const node = findNode(servicesTree, nodeId);
                let parentId = node?.parentId;
                while (parentId) {
                    newPerms.add(parentId);
                    const parentNode = findNode(servicesTree, parentId);
                    parentId = parentNode?.parentId;
                }
            }
            return newPerms;
        });
    }, [servicesTree, findNode]);
    
    // دالة الحفظ التي تحتوي على المنطق
    const handleSave = async () => {
        if (!selectedJobId || !user) return;
        setIsSaving(true);
        try {
            const permissionsToInsert = Array.from(jobPermissions).map(perm => {
                const [type, id] = perm.split(':');
                let serviceId = null;
                let subServiceId = null;
                let subSubServiceId = null;

                if (type === 's') {
                    serviceId = Number(id);
                } else if (type === 'ss') {
                    const node = findNode(servicesTree, perm);
                    serviceId = Number(node?.parentId?.split(':')[1]);
                    subServiceId = Number(id);
                } else if (type === 'sss') {
                    const node = findNode(servicesTree, perm);
                    const parentNode = findNode(servicesTree, node?.parentId || '');
                    serviceId = parentNode ? Number(parentNode.parentId?.split(':')[1]) : null;
                    subServiceId = Number(node?.parentId?.split(':')[1]);
                    subSubServiceId = Number(id);
                }

                return {
                    job_id: selectedJobId,
                    service_id: serviceId,
                    sub_service_id: subServiceId,
                    sub_sub_service_id: subSubServiceId,
                };
            });

            const { error } = await supabase.rpc('update_job_permissions_and_cleanup_users', {
                p_job_id: selectedJobId,
                p_permissions: permissionsToInsert,
                p_changed_by_user_id: user.id
            });

            if (error) throw error;
            toast.success(t.saveSuccess);
            setInitialJobPermissions(new Set(jobPermissions));
            const newVisiblePerms = getInitialVisiblePermissions(filteredNodes, jobPermissions);
            setInitialVisiblePermissions(newVisiblePerms);
        } catch (error) {
            console.error("Error saving permissions:", error);
            toast.error(t.saveError);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleResetVisible = useCallback(() => {
        setJobPermissions(prev => {
            const newPerms = new Set(prev);
            const visibleNodesIds = new Set(filteredNodes.map(node => node.id));

            prev.forEach(permId => {
                if (visibleNodesIds.has(permId) && !initialVisiblePermissions.has(permId)) {
                    newPerms.delete(permId);
                }
            });
            initialVisiblePermissions.forEach(permId => {
                newPerms.add(permId);
            });
            return newPerms;
        });
    }, [initialVisiblePermissions, filteredNodes]);

    const handleSelectAllVisible = useCallback((select: boolean) => {
        setJobPermissions(prev => {
            const newPerms = new Set(prev);
            const visibleNodesIds = new Set(filteredNodes.map(node => node.id));

            visibleNodesIds.forEach(id => {
                if (select) {
                    newPerms.add(id);
                } else {
                    newPerms.delete(id);
                }
            });
            return newPerms;
        });
    }, [filteredNodes]);
    
    // دوال التأكيد الجديدة
    const handleConfirmSelectAll = useCallback(() => {
        setIsConfirming(true);
        confirmToast(t.confirmSelectAll,
            () => {
                handleSelectAllVisible(true);
                setIsConfirming(false);
            },
            () => {
                setIsConfirming(false);
            },
            t
        );
    }, [t, handleSelectAllVisible]);

    const handleConfirmDeselectAll = useCallback(() => {
        setIsConfirming(true);
        confirmToast(t.confirmDeselectAll,
            () => {
                handleSelectAllVisible(false);
                setIsConfirming(false);
            },
            () => {
                setIsConfirming(false);
            },
            t
        );
    }, [t, handleSelectAllVisible]);
    
    const handleConfirmResetVisible = useCallback(() => {
        setIsConfirming(true);
        confirmToast(t.confirmReset,
            () => {
                handleResetVisible();
                setIsConfirming(false);
            },
            () => {
                setIsConfirming(false);
            },
            t
        );
    }, [t, handleResetVisible]);

    const handleConfirmSave = useCallback(() => {
        setIsConfirming(true);
        confirmToast(
            t.confirmSave,
            () => {
                handleSave();
                setIsConfirming(false);
            },
            () => {
                setIsConfirming(false);
            },
            t
        );
    }, [t, handleSave]);


    const handleNavigate = useCallback((node: ServiceNode) => {
        if (node.children && node.children.length > 0) {
            const initialPermsForView = getInitialVisiblePermissions(node.children, initialJobPermissions);
            setInitialVisiblePermissions(initialPermsForView);
            setPath(prevPath => [...prevPath, { id: node.id, label: node.label }]);
        }
    }, [initialJobPermissions, getInitialVisiblePermissions]);
    
    const handleGoBack = useCallback(() => {
        setPath(prevPath => {
            if (prevPath.length === 0) {
                // إذا كان المسار فارغًا، لا تفعل شيئًا لمنع العودة إلى صفحة غير مرغوبة
                return prevPath;
            }
            const newPath = prevPath.slice(0, -1);
            let targetNode;
            if (newPath.length === 0) {
                targetNode = { children: servicesTree };
            } else {
                let current = { children: servicesTree };
                for (const item of newPath) {
                    const found = current.children.find(node => node.id === item.id);
                    if (found) {
                        current = found;
                    } else {
                        targetNode = { children: servicesTree };
                        break;
                    }
                }
                if (!targetNode) {
                    targetNode = current;
                }
            }

            const initialPermsForView = getInitialVisiblePermissions(targetNode.children, initialJobPermissions);
            setInitialVisiblePermissions(initialPermsForView);
            
            return newPath;
        });
    }, [initialJobPermissions, servicesTree, getInitialVisiblePermissions]);

    const containerKey = path.map(p => p.id).join('-');

    useEffect(() => {
        const mainHeader = document.querySelector('header.sticky');
        if (mainHeader instanceof HTMLElement) {
            setMainHeaderHeight(mainHeader.offsetHeight);
        }
    }, [language]);

    // **التغيير الجديد: التعامل مع زر الرجوع في المتصفح**
    useEffect(() => {
        if (selectedJobId !== null) {
            // إضافة مسار إلى history Stack عند تغيير المسار في الشجرة
            const state = { path: path };
            history.pushState(state, '');
        }

        const handlePopState = (e: PopStateEvent) => {
            // تحقق من وجود مسار في حالة history
            if (e.state && e.state.path && Array.isArray(e.state.path)) {
                setPath(e.state.path);
            } else {
                // إذا لم يكن هناك مسار في الـ history، عد إلى المستوى الأعلى
                handleGoBack();
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [path, selectedJobId, handleGoBack]);

    if (!hasPermission('ss:9')) {
        return (
            <AdminSectionLayout mainServiceId={17}>
                <motion.div
                    key="no-permission"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center text-red-500 p-10"
                >
                    {t.noPermission}
                </motion.div>
            </AdminSectionLayout>
        );
    }

    if (isLoading) {
        return (
            <AdminSectionLayout mainServiceId={17}>
                <motion.div
                    key="loading"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-center items-center h-64"
                >
                    <LoaderCircle className="animate-spin text-[#FFD700]" size={48} />
                </motion.div>
            </AdminSectionLayout>
        );
    }
    
    const jobTitleElement = (
    <div className="flex flex-col gap-2 p-2">
        {selectedJobId ? (
            <motion.div
                key={`job-selected-${selectedJobId}-${language}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-2"
            >
            <div className="flex items-center justify-between gap-2">
                <span
                className={`font-extrabold text-lg text-[#FFD700] break-words`}
                >
                {selectedJobName}
                </span>
                <button
                onClick={handleChangeJob}
                className={`flex items-center justify-center gap-1 px-2 py-1 font-semibold bg-gray-700 rounded-md text-gray-300 transition-all hover:scale-105 active:scale-95 text-xs`}
                >
                <Edit size={16} />
                <span className="hidden sm:inline">
                    {t.changeJob}
                </span>
                </button>
            </div>
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2 text-xs text-gray-400 overflow-hidden flex-wrap"
                >
                    <span className="flex items-center gap-1">
                    <Check size={12} className="text-green-400" />
                    {enabledPermissionsCount}
                    </span>
                    <span className="flex items-center gap-1">
                    <X size={12} className="text-red-400" />
                    {disabledPermissionsCount}
                    </span>
                </motion.div>
            </AnimatePresence>
            </motion.div>
        ) : (
            <motion.div
                key={`job-not-selected-${language}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
            <div className="relative mb-2">
                <div className="absolute inset-y-0 start-0 flex items-center ps-2 pointer-events-none">
                <Search className="w-3 h-3 text-gray-400" />
                </div>
                <input
                type="text"
                placeholder={t.searchJobPlaceholder}
                value={jobSearchFilter}
                onChange={(e) => setJobSearchFilter(e.target.value)}
                className="block w-full ps-8 pe-2 py-1 text-sm text-white bg-gray-900 border border-gray-700 rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-96 overflow-y-auto custom-scrollbar">
                {filteredJobs.length > 0 ? (
                filteredJobs.map(job => (
                    <motion.div
                    key={job.id}
                    className="p-2 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-600/50 transition-colors"
                    onClick={() => handleSelectJob(job)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    >
                    <span className="font-semibold text-white text-sm">{language === 'ar' ? job.name_ar : job.name_en}</span>
                    </motion.div>
                ))
                ) : (
                <div className="col-span-full text-center text-gray-500 py-6">
                    {t.noSearchResults}
                </div>
                )}
            </div>
            </motion.div>
        )}
    </div>
    );

    const Breadcrumb = () => (
        <motion.div
            key={`breadcrumb-${path.length}-${language}`}
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center text-sm font-semibold text-gray-400 gap-1 overflow-x-auto custom-scrollbar whitespace-nowrap p-2"
        >
            <span
                className="cursor-pointer text-gray-400 hover:text-white transition-colors"
                onClick={() => setPath([])}
            >
                {t.root}
            </span>
            {path.map((item, index) => (
                <React.Fragment key={item.id}>
                    <ChevronRight size={16} className={`mx-1 text-gray-500 ${isRTL ? 'rotate-180' : ''}`} />
                    <span
                        className={`cursor-pointer ${index === path.length - 1 ? 'text-white' : 'text-gray-400 hover:text-white transition-colors'}`}
                        onClick={() => setPath(path.slice(0, index + 1))}
                    >
                        {item.label}
                    </span>
                </React.Fragment>
            ))}
        </motion.div>
    );

    return (
      <AdminSectionLayout
        mainServiceId={17}
        hasUnsavedChanges={hasChanges}
        onNavigateWithPrompt={handleNavigationWithPrompt}
      >
        <div className="space-y-4">
          <AnimatePresence>
            {isConfirming && (
              <motion.div
                className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </AnimatePresence>
          
          <motion.div
            key={`sticky-header-${language}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-sm shadow-lg rounded-lg"
            style={{ top: `${mainHeaderHeight}px`, transition: 'top 0.3s ease-in-out' }}
          >
              {jobTitleElement}
              {selectedJobId && path.length > 0 && <Breadcrumb />}
          </motion.div>
          
          {selectedJobId && (
            <motion.div
                key={`permissions-content-${language}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 overflow-hidden relative"
            >
              
              <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">{t.controlElementsTitle}</h3>
                <p className="text-xs text-gray-500 mb-4">{t.visibleActionsDescription}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleConfirmSelectAll}
                    disabled={allVisibleNodesSelected}
                    className={`flex items-center gap-1 justify-center h-8 text-xs px-2 rounded-md text-white bg-gradient-to-r from-green-500 to-green-600 transition-all hover:scale-105 active:scale-95 disabled:from-gray-700 disabled:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100`}
                  >
                    <Check size={16} /> {t.selectAll}
                  </button>
                  <button
                    onClick={handleConfirmDeselectAll}
                    disabled={noVisibleNodesSelected}
                    className={`flex items-center gap-1 justify-center h-8 text-xs px-2 rounded-md text-white bg-gradient-to-r from-red-500 to-red-600 transition-all hover:scale-105 active:scale-95 disabled:from-gray-700 disabled:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100`}
                  >
                    { <X size={16} /> } {t.deselectAll}
                  </button>
                  <button
                    onClick={handleConfirmResetVisible}
                    disabled={!hasVisibleChanges}
                    className={`flex items-center gap-1 justify-center h-8 text-xs px-2 rounded-md text-white bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all hover:scale-105 active:scale-95 disabled:from-gray-700 disabled:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100`}
                  >
                    <RotateCcw size={16} /> {t.resetVisible}
                  </button>
                </div>
              </div>
              
              <AnimatePresence mode="wait">
                  <motion.div
                    key={containerKey}
                    initial={{ x: isRTL ? '100%' : '-100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: isRTL ? '-100%' : '100%', opacity: 0 }}
                    transition={{ type: "tween", duration: 0.3 }}
                  >
                    <PermissionsList
                        nodes={filteredNodes}
                        onNavigate={handleNavigate}
                        onToggle={handlePermissionToggle}
                        jobPermissions={jobPermissions}
                    />
                  </motion.div>
              </AnimatePresence>
              
              <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mt-6 flex flex-col md:flex-row md:justify-end gap-4"
                  >
                    <button
                        onClick={handleConfirmSave}
                        disabled={isSaving || !hasChanges}
                        className={`flex items-center gap-2 px-6 py-3 font-bold bg-[#FFD700] text-black rounded-lg transition-all hover:scale-105 active:scale-95 disabled:bg-gray-700 disabled:text-gray-400 disabled:opacity-50 disabled:hover:bg-gray-700 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100`}
                    >
                        {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
                        {isSaving ? t.saving : t.saveChanges}
                    </button>
                  </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </div>
        <Toaster />
      </AdminSectionLayout>
    );
};

export default JobPermissionsPage;