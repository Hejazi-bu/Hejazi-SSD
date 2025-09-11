// src/pages/Permission/UserExceptionsPage.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// تم حذف db
// import { db } from '../../lib/supabaseClient';
import { useAuth } from '../../components/contexts/UserContext';
import { useLanguage } from '../../components/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, LoaderCircle, ChevronRight, Check, X, Search, ChevronLeft, RotateCcw, Edit, Folder, FolderOpen } from 'lucide-react';
import AdminSectionLayout from '../../layouts/AdminSectionLayout';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { usePrompt } from '../../hooks/usePrompt';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '../../components/LoadingScreen';

// تعريف أنواع البيانات
type User = { id: string; name_ar: string; name_en: string; job_id: number | null; };
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
type PermissionChangeItem = {
    user_id: string;
    service_id: number | null;
    sub_service_id: number | null;
    sub_sub_service_id: number | null;
    is_allowed: boolean;
};

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
    userPermissions,
    jobPermissions,
}: {
    nodes: ServiceNode[];
    onNavigate: (node: ServiceNode) => void;
    onToggle: (id: string, isChecked: boolean) => void;
    userPermissions: Map<string, boolean>;
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
                const isAllowed = userPermissions.has(node.id) ? userPermissions.get(node.id) : jobPermissions.has(node.id);
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
                            const childIsAllowed = userPermissions.has(n.id) ? userPermissions.get(n.id) : jobPermissions.has(n.id);
                            if (childIsAllowed) {
                                count++;
                            }
                            traverse(n.children);
                        });
                    };
                    traverse(node.children);
                    return count;
                }, [node.children, userPermissions, jobPermissions]);
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
                                    onClick={(e) => { e.stopPropagation(); onToggle(node.id, !isAllowed); }}
                                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-all ${isAllowed ? 'bg-green-500' : 'bg-gray-600'} hover:scale-105 active:scale-95`}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-all ${isAllowed ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'}`} />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
});


const translations = {
    ar: {
        pageTitle: "استثناءات المستخدمين",
        selectUser: "اختر مستخدماً:",
        permissionsTree: "شجرة الصلاحيات",
        noUserSelected: "يرجى اختيار مستخدم لبدء إدارة الاستثناءات.",
        loading: "جاري التحميل...",
        saveChanges: "حفظ التغييرات",
        saving: "جاري الحفظ...",
        saveSuccess: "تم حفظ الاستثناءات بنجاح.",
        saveError: "حدث خطأ أثناء حفظ الاستثناءات.",
        noPermission: "ليس لديك صلاحية.",
        selectAll: "تفعيل الكل",
        deselectAll: "تعطيل الكل",
        resetVisible: "إعادة",
        controlElementsTitle: "عناصر التحكم",
        visibleActionsDescription: "تتحكم هذه الأزرار في الصلاحيات المعروضة في القائمة الحالية فقط. وهي صلاحيات مستخدمين.",
        searchPermissions: "بحث في الصلاحيات...",
        noSearchResults: "لا توجد نتائج بحث مطابقة.",
        enabledPermissions: "صلاحيات مفعلة",
        disabledPermissions: "صلاحيات غير مفعلة",
        searchUserPlaceholder: "ابحث عن مستخدم...",
        changeUser: "تغيير المستخدم",
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
        pageTitle: "User Exceptions Management",
        selectUser: "Select a User:",
        permissionsTree: "Permissions Tree",
        noUserSelected: "Please select a user to start managing exceptions.",
        loading: "Loading...",
        saveChanges: "Save Changes",
        saving: "Saving...",
        saveSuccess: "Exceptions saved successfully.",
        saveError: "An error occurred while saving exceptions.",
        noPermission: "No permission.",
        selectAll: "Select All",
        deselectAll: "Deselect All",
        resetVisible: "Reset",
        controlElementsTitle: "Control Elements",
        visibleActionsDescription: "These buttons control the permissions in the current visible list only. These are user permissions.",
        searchPermissions: "Search permissions...",
        noSearchResults: "No matching search results.",
        enabledPermissions: "Enabled permissions",
        disabledPermissions: "Disabled permissions",
        searchUserPlaceholder: "Search for a user...",
        changeUser: "Change User",
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

interface BreadcrumbProps {
    path: PathItem[];
    setPath: React.Dispatch<React.SetStateAction<PathItem[]>>;
    language: string;
    translations: { [key: string]: any };
    isRTL: boolean;
}

const MemoizedBreadcrumb = React.memo(({ path, setPath, language, translations, isRTL }: BreadcrumbProps) => {
    const t = translations[language];
    return (
        <motion.div
            key={`breadcrumb-${path.length}-${language}`}
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center text-sm font-semibold text-gray-400 gap-1 overflow-x-auto custom-scrollbar whitespace-nowrap p-2 rounded-lg bg-gray-900 shadow-inner shadow-gray-700/20"
        >
            <motion.button
                onClick={() => setPath([])}
                className="flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer text-[#FFD700] bg-gray-800 hover:bg-gray-700 active:scale-95 transform whitespace-nowrap"
                aria-label={t.root}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
            >
                <Folder size={18} className="text-[#FFD700]" />
                <span className="hidden sm:inline-block font-bold">{t.root}</span>
            </motion.button>

            {path.map((item, index) => (
                <React.Fragment key={item.id}>
                    <ChevronRight size={18} className={`mx-1 text-gray-500 ${isRTL ? 'rotate-180' : ''}`} />
                    <motion.button
                        onClick={() => setPath(path.slice(0, index + 1))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                            index === path.length - 1
                                ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        } active:scale-95 transform whitespace-nowrap`}
                        aria-label={item.label}
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.05 }}
                    >
                        {index === path.length - 1 ? (
                            <FolderOpen size={18} className="text-[#FFD700]" />
                        ) : (
                            <Folder size={18} />
                        )}
                        <span className="font-bold">{item.label}</span>
                    </motion.button>
                </React.Fragment>
            ))}
        </motion.div>
    );
});

const UserExceptionsPage = () => {
    const { language } = useLanguage();
    const { hasPermission, user } = useAuth();
    const isRTL = language === 'ar';
    const navigate = useNavigate();

    const headerRef = useRef<HTMLElement>(null);
    const [mainHeaderHeight, setMainHeaderHeight] = useState(0);

    const [users, setUsers] = useState<User[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState<string>('');
    const [servicesTree, setServicesTree] = useState<ServiceNode[]>([]);
    const [userPermissions, setUserPermissions] = useState<Map<string, boolean>>(new Map());
    const [jobPermissions, setJobPermissions] = useState<Set<string>>(new Set());
    const [initialUserPermissions, setInitialUserPermissions] = useState<Map<string, boolean>>(new Map());
    const [initialVisiblePermissions, setInitialVisiblePermissions] = useState<Map<string, boolean>>(new Map());

    const [userSearchFilter, setUserSearchFilter] = useState('');

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

    const getInitialVisiblePermissions = useCallback((nodes: ServiceNode[], allInitialPermissions: Map<string, boolean>): Map<string, boolean> => {
        const initialPerms = new Map<string, boolean>();
        const traverseAndCheck = (currentNodes: ServiceNode[]) => {
            currentNodes.forEach(node => {
                const isAllowed = allInitialPermissions.get(node.id);
                if (isAllowed !== undefined) {
                    initialPerms.set(node.id, isAllowed);
                }
                traverseAndCheck(node.children);
            });
        };
        traverseAndCheck(nodes);
        return initialPerms;
    }, []);

    const getVisibleNodeIds = useCallback((nodes: ServiceNode[]): Set<string> => {
        const visibleIds = new Set<string>();
        const traverse = (currentNodes: ServiceNode[]) => {
            currentNodes.forEach(node => {
                visibleIds.add(node.id);
                traverse(node.children);
            });
        };
        traverse(nodes);
        return visibleIds;
    }, []);

    const allVisibleNodesSelected = useMemo(() => {
        if (filteredNodes.length === 0) return false;
        return filteredNodes.every(node => {
            const isAllowed = userPermissions.has(node.id) ? userPermissions.get(node.id) : jobPermissions.has(node.id);
            return isAllowed;
        });
    }, [filteredNodes, userPermissions, jobPermissions]);

    const noVisibleNodesSelected = useMemo(() => {
        if (filteredNodes.length === 0) return true;
        return filteredNodes.every(node => {
            const isAllowed = userPermissions.has(node.id) ? userPermissions.get(node.id) : jobPermissions.has(node.id);
            return !isAllowed;
        });
    }, [filteredNodes, userPermissions, jobPermissions]);

    const hasVisibleChanges = useMemo(() => {
        const currentVisiblePerms = new Map<string, boolean>();
        const traverseAndCheck = (nodes: ServiceNode[]) => {
            nodes.forEach(node => {
                const isAllowed = userPermissions.get(node.id);
                if (isAllowed !== undefined) {
                    currentVisiblePerms.set(node.id, isAllowed);
                }
                traverseAndCheck(node.children);
            });
        };
        traverseAndCheck(filteredNodes);

        if (initialVisiblePermissions.size !== currentVisiblePerms.size) return true;
        for (const [key, value] of initialVisiblePermissions) {
            if (currentVisiblePerms.get(key) !== value) return true;
        }
        return false;
    }, [filteredNodes, userPermissions, initialVisiblePermissions]);

    const filteredUsers = useMemo(() => {
        if (!userSearchFilter) return users;
        const lowercasedFilter = userSearchFilter.toLowerCase();
        return users.filter(user =>
            (user.name_ar && user.name_ar.toLowerCase().includes(lowercasedFilter)) ||
            (user.name_en && user.name_en.toLowerCase().includes(lowercasedFilter))
        );
    }, [users, userSearchFilter]);

    const enabledPermissionsCount = useMemo(() => {
        let count = 0;
        const traverse = (nodes: ServiceNode[]) => {
            nodes.forEach(n => {
                const isAllowed = userPermissions.has(n.id) ? userPermissions.get(n.id) : jobPermissions.has(n.id);
                if (isAllowed) {
                    count++;
                }
                traverse(n.children);
            });
        };
        traverse(servicesTree);
        return count;
    }, [servicesTree, userPermissions, jobPermissions]);

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

    const disabledPermissionsCount = totalPermissionsCount - enabledPermissionsCount;


    const hasChanges = useMemo(() => {
        if (initialUserPermissions.size !== userPermissions.size) return true;
        for (const [key, value] of initialUserPermissions) {
            if (userPermissions.get(key) !== value) return true;
        }
        return false;
    }, [userPermissions, initialUserPermissions]);

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

    useEffect(() => {
        const updatePathLabels = () => {
            setPath(prevPath => {
                if (prevPath.length === 0) return prevPath;

                return prevPath.map(item => {
                    const node = findNode(servicesTree, item.id);
                    if (node) {
                        return { ...item, label: node.label };
                    }
                    return item;
                });
            });
        };

        updatePathLabels();
    }, [language, servicesTree, findNode]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // ✅ استبدال استعلامات Supabase بـ fetch إلى الخادم
                const response = await fetch(`http://localhost:3001/api/user-permissions/initial-data`);
                const data = await response.json();
                
                if(data.success){
                    setUsers(data.users || []);
                    setJobs(data.jobs || []);
    
                    const tree = (data.servicesRes || []).map((s: any) => {
                        const subServices = (data.subServicesRes || [])
                            .filter((ss: any) => ss.service_id === s.id)
                            .map((ss: any) => {
                                const subSubServices = (data.subSubServicesRes || [])
                                    .filter((sss: any) => sss.sub_service_id === ss.id)
                                    .map((sss: any) => ({
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
                } else {
                    console.error("Error fetching initial data:", data.message);
                }
            } catch (error) {
                console.error("Error fetching initial data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        if (hasPermission('ss:10')) fetchInitialData(); else setIsLoading(false);
    }, [language, hasPermission]);

    const fetchUserAndJobPermissions = useCallback(async (userId: string) => {
        try {
            // ✅ استبدال استعلامات Supabase بـ fetch إلى الخادم
            const response = await fetch(`http://localhost:3001/api/user-permissions/${userId}`);
            const data = await response.json();

            if (data.success) {
                const userPermsMap = new Map<string, boolean>();
                (data.userPermissions || []).forEach((p: any) => {
                    if (p.sub_sub_service_id) userPermsMap.set(`sss:${p.sub_sub_service_id}`, p.is_allowed);
                    else if (p.sub_service_id) userPermsMap.set(`ss:${p.sub_service_id}`, p.is_allowed);
                    else userPermsMap.set(`s:${p.service_id}`, p.is_allowed);
                });
                setUserPermissions(userPermsMap);
                setInitialUserPermissions(new Map(userPermsMap));

                const jobPermsSet = new Set<string>();
                (data.jobPermissions || []).forEach((p: any) => {
                    if (p.sub_sub_service_id) jobPermsSet.add(`sss:${p.sub_sub_service_id}`);
                    else if (p.sub_service_id) jobPermsSet.add(`ss:${p.sub_service_id}`);
                    else jobPermsSet.add(`s:${p.service_id}`);
                });
                setJobPermissions(jobPermsSet);

                const initialVisiblePerms = getInitialVisiblePermissions(servicesTree, userPermsMap);
                setInitialVisiblePermissions(initialVisiblePerms);
                setPath([]);
            } else {
                console.error("Error fetching user and job permissions:", data.message);
            }

        } catch (error) {
            console.error("Error fetching user and job permissions:", error);
        }
    }, [servicesTree, getInitialVisiblePermissions]);

    useEffect(() => {
        if (selectedUserId !== null) {
            const user = users.find(u => u.id === selectedUserId);
            if (user) {
                setSelectedUserName(language === 'ar' ? user.name_ar : user.name_en);
                fetchUserAndJobPermissions(selectedUserId);
            }
        }
    }, [language, selectedUserId, users, fetchUserAndJobPermissions]);

    const handleSelectUser = useCallback(async (user: User) => {
        if (hasChanges) {
            confirmToast(t.unsavedChangesWarning, async () => {
                setSelectedUserId(user.id);
                setSelectedUserName(language === 'ar' ? user.name_ar : user.name_en);
                setUserSearchFilter('');
                fetchUserAndJobPermissions(user.id);
            }, () => {
                // do nothing on cancel
            }, t);
            return;
        }
        setSelectedUserId(user.id);
        setSelectedUserName(language === 'ar' ? user.name_ar : user.name_en);
        setUserSearchFilter('');
    }, [language, hasChanges, t, fetchUserAndJobPermissions]);

    const handleChangeUser = () => {
        if (hasChanges) {
            setIsConfirming(true);
            confirmToast(t.unsavedChangesWarning,
                () => {
                    setSelectedUserId(null);
                    setSelectedUserName('');
                    setUserPermissions(new Map());
                    setInitialUserPermissions(new Map());
                    setJobPermissions(new Set());
                    setPath([]);
                    setUserSearchFilter('');
                    setIsConfirming(false);
                },
                () => {
                    setIsConfirming(false);
                },
                t
            );
        } else {
            setSelectedUserId(null);
            setSelectedUserName('');
            setUserPermissions(new Map());
            setInitialUserPermissions(new Map());
            setJobPermissions(new Set());
            setPath([]);
            setUserSearchFilter('');
        }
    };

    const handlePermissionToggle = useCallback((nodeId: string, isChecked: boolean) => {
        setUserPermissions(prev => {
            const newPerms = new Map(prev);
            const isJobAllowed = jobPermissions.has(nodeId);

            const toggleChildren = (nodes: ServiceNode[], check: boolean) => {
                nodes.forEach(child => {
                    const childIsJobAllowed = jobPermissions.has(child.id);
                    if (check === childIsJobAllowed) {
                        newPerms.delete(child.id);
                    } else {
                        newPerms.set(child.id, check);
                    }
                    toggleChildren(child.children, check);
                });
            };
            
            const findAndToggle = (nodes: ServiceNode[]) => {
                for (const node of nodes) {
                    if (node.id === nodeId) {
                        if (isChecked === isJobAllowed) {
                            newPerms.delete(nodeId);
                        } else {
                            newPerms.set(nodeId, isChecked);
                        }
                        toggleChildren(node.children, isChecked);
                        return true;
                    }
                    if (findAndToggle(node.children)) return true;
                }
                return false;
            };

            findAndToggle(servicesTree);
            return newPerms;
        });
    }, [servicesTree, jobPermissions]);
    
    const handleSave = async () => {
        if (!selectedUserId || !user) {
            toast.error(t.saveError);
            return;
        }
        setIsSaving(true);
        try {
            const changesToInsert: any[] = [];
            const changesToDelete: any[] = [];
            
            userPermissions.forEach((isAllowed, permId) => {
                const initialIsAllowed = initialUserPermissions.get(permId);
                const isJobPermitted = jobPermissions.has(permId);
                
                if (initialIsAllowed === undefined && isAllowed !== isJobPermitted) {
                    // إضافة استثناء جديد
                    const [type, id] = permId.split(':');
                    let service_id = null;
                    let sub_service_id = null;
                    let sub_sub_service_id = null;
                    if (type === 's') service_id = Number(id);
                    else if (type === 'ss') sub_service_id = Number(id);
                    else if (type === 'sss') sub_sub_service_id = Number(id);
                    
                    changesToInsert.push({
                        user_id: selectedUserId,
                        service_id, sub_service_id, sub_sub_service_id,
                        is_allowed: isAllowed,
                        actor_id: user.id
                    });
                } else if (initialIsAllowed !== undefined && initialIsAllowed !== isAllowed) {
                    // تعديل استثناء موجود
                    const [type, id] = permId.split(':');
                    let service_id = null;
                    let sub_service_id = null;
                    let sub_sub_service_id = null;
                    if (type === 's') service_id = Number(id);
                    else if (type === 'ss') sub_service_id = Number(id);
                    else if (type === 'sss') sub_sub_service_id = Number(id);
    
                    // سنقوم بحذفه ثم إضافته مجدداً
                    changesToDelete.push({user_id: selectedUserId, service_id, sub_service_id, sub_sub_service_id});
                    changesToInsert.push({user_id: selectedUserId, service_id, sub_service_id, sub_sub_service_id, is_allowed: isAllowed , actor_id: user.id});
                }
            });

            initialUserPermissions.forEach((isAllowed, permId) => {
                if (!userPermissions.has(permId) && isAllowed !== jobPermissions.has(permId)) {
                    // حذف استثناء (إعادته إلى صلاحية الوظيفة)
                    const [type, id] = permId.split(':');
                    let service_id = null;
                    let sub_service_id = null;
                    let sub_sub_service_id = null;
                    if (type === 's') service_id = Number(id);
                    else if (type === 'ss') sub_service_id = Number(id);
                    else if (type === 'sss') sub_sub_service_id = Number(id);
    
                    changesToDelete.push({user_id: selectedUserId, service_id, sub_service_id, sub_sub_service_id});
                }
            });

            const payload = {
                userId: selectedUserId,
                changesToInsert,
                changesToDelete
            }
            
            const response = await fetch('http://localhost:3001/api/user-exceptions/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            const result = await response.json();

            if (result.success) {
                toast.success(t.saveSuccess);
                setInitialUserPermissions(new Map(userPermissions));
                const newVisiblePerms = getInitialVisiblePermissions(filteredNodes, userPermissions);
                setInitialVisiblePermissions(newVisiblePerms);
            } else {
                toast.error(t.saveError);
            }

        } catch (error) {
            console.error("Error saving user exceptions:", error);
            toast.error(t.saveError);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleResetVisible = useCallback(() => {
        setUserPermissions(prev => {
            const newPerms = new Map(prev);
            const visibleNodesIds = getVisibleNodeIds(filteredNodes);

            visibleNodesIds.forEach(permId => {
                if (initialVisiblePermissions.has(permId)) {
                    newPerms.set(permId, initialVisiblePermissions.get(permId)!);
                } else {
                    newPerms.delete(permId);
                }
            });
            return newPerms;
        });
    }, [initialVisiblePermissions, filteredNodes, getVisibleNodeIds]);

    const handleSelectAllVisible = useCallback((select: boolean) => {
        setUserPermissions(prev => {
            const newPerms = new Map(prev);
            const visibleNodesIds = getVisibleNodeIds(filteredNodes);
    
            visibleNodesIds.forEach(nodeId => {
                const isJobAllowed = jobPermissions.has(nodeId);
                if (select === isJobAllowed) {
                    newPerms.delete(nodeId);
                } else {
                    newPerms.set(nodeId, select);
                }
            });
            return newPerms;
        });
    }, [filteredNodes, getVisibleNodeIds, jobPermissions]);
    
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
            const initialPermsForView = getInitialVisiblePermissions(node.children, userPermissions);
            setInitialVisiblePermissions(initialPermsForView);
            setPath(prevPath => [...prevPath, { id: node.id, label: node.label }]);
        }
    }, [userPermissions, getInitialVisiblePermissions]);
    
    const handleGoBack = useCallback(() => {
        setPath(prevPath => {
            const newPath = prevPath.slice(0, -1);
            let targetNode = { children: servicesTree };
            if (newPath.length > 0) {
                let current = { children: servicesTree };
                for (const item of newPath) {
                    const found = current.children.find(node => node.id === item.id);
                    if (found) {
                        current = found;
                    }
                }
                targetNode = current;
            }

            const initialPermsForView = getInitialVisiblePermissions(targetNode.children, initialUserPermissions);
            setInitialVisiblePermissions(initialPermsForView);
            
            return newPath;
        });
    }, [initialUserPermissions, servicesTree, getInitialVisiblePermissions]);

    const containerKey = path.map(p => p.id).join('-');

    useEffect(() => {
        const mainHeader = document.querySelector('header.sticky');
        if (mainHeader instanceof HTMLElement) {
            setMainHeaderHeight(mainHeader.offsetHeight);
        }
    }, [language]);

    if (!hasPermission('ss:10')) {
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
                <LoadingScreen />
            </AdminSectionLayout>
        );
    }
    
    const userTitleElement = (
        <div className="flex flex-col gap-2 p-2">
            {selectedUserId ? (
                <motion.div
                    key={`user-selected-${selectedUserId}-${language}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col gap-2"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-lg text-[#FFD700] break-words">
                            {selectedUserName}
                        </span>
                        <button
                            onClick={handleChangeUser}
                            className={`flex items-center justify-center gap-1 px-2 py-1 font-semibold bg-gray-700 rounded-md text-gray-300 transition-all hover:scale-105 active:scale-95 text-xs`}
                        >
                            <Edit size={16} />
                            <span className="hidden sm:inline">{t.changeUser}</span>
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
                    key={`user-not-selected-${language}`}
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
                            placeholder={t.searchUserPlaceholder}
                            value={userSearchFilter}
                            onChange={(e) => setUserSearchFilter(e.target.value)}
                            className="block w-full ps-8 pe-2 py-1 text-sm text-white bg-gray-900 border border-gray-700 rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-96 overflow-y-auto custom-scrollbar">
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map(user => (
                                <motion.div
                                    key={user.id}
                                    className="p-2 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-600/50 transition-colors"
                                    onClick={() => handleSelectUser(user)}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <span className="font-semibold text-white text-sm">{language === 'ar' ? user.name_ar : user.name_en}</span>
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
                    {userTitleElement}
                    {selectedUserId && path.length > 0 && (
                        <MemoizedBreadcrumb
                            path={path}
                            setPath={setPath}
                            language={language}
                            translations={translations}
                            isRTL={isRTL}
                        />
                    )}
                </motion.div>
                
                {selectedUserId && (
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
                                    userPermissions={userPermissions}
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

export default UserExceptionsPage;