import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../components/contexts/UserContext';
import { useLanguage } from '../../components/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, LoaderCircle, ChevronRight, Check, X, Search } from 'lucide-react';
import AdminSectionLayout from '../../layouts/AdminSectionLayout';

// --- تعريف أنواع البيانات ---
type Job = { id: number; name_ar: string; name_en: string; };
type ServiceNode = {
  id: string;
  label: string;
  children: ServiceNode[];
  parentId?: string; // إضافة معرف الأب
};

// --- المكون المساعد: بطاقة الأكورديون ---
const PermissionNode = React.memo(({ node, onToggle, jobPermissions, expandedNodes, onExpand }: { 
    node: ServiceNode, 
    onToggle: (id: string, checked: boolean) => void, 
    jobPermissions: Set<string>, 
    expandedNodes: Set<string>, 
    onExpand: (id: string) => void 
}) => {
    const { language } = useLanguage();
    const hasChildren = node.children.length > 0;
    const isChecked = jobPermissions.has(node.id);
    const isExpanded = expandedNodes.has(node.id);

    // حساب عدد الصلاحيات الفرعية
    const childrenIds = useMemo(() => {
        const ids: string[] = [];
        const traverse = (nodes: ServiceNode[]) => {
            nodes.forEach(n => {
                ids.push(n.id);
                traverse(n.children);
            });
        };
        traverse(node.children);
        return ids;
    }, [node.children]);

    const enabledChildrenCount = childrenIds.filter(id => jobPermissions.has(id)).length;
    const disabledChildrenCount = childrenIds.length - enabledChildrenCount;
    const paddingDirection = language === 'ar' ? 'paddingRight' : 'paddingLeft';

    return (
        <div 
            className={`bg-gray-800/30 rounded-lg mb-2 border border-transparent transition-colors ${isExpanded ? '!border-gray-700' : 'hover:border-gray-700/50'}`}
        >
            <div 
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => hasChildren && onExpand(node.id)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {hasChildren && <ChevronRight size={18} className={`transition-transform duration-200 text-gray-400 ${isExpanded ? 'rotate-90' : ''}`} />}
                    <span className="font-bold text-white truncate">{node.label}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                    {hasChildren && (
                        <div className="hidden sm:flex items-center gap-3 text-xs">
                           <span className="flex items-center gap-1 text-green-400 font-medium"><Check size={14}/> {enabledChildrenCount}</span>
                           <span className="flex items-center gap-1 text-red-400 font-medium"><X size={14}/> {disabledChildrenCount}</span>
                        </div>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggle(node.id, !isChecked); }} 
                        className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${isChecked ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isChecked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'}`} />
                    </button>
                </div>
            </div>
            <AnimatePresence>
                {isExpanded && hasChildren && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }} 
                        className="overflow-hidden border-t border-gray-700/50 mx-4"
                    >
                        <div className="p-4 space-y-2">
                            {node.children.map(child => 
                                <PermissionNode 
                                    key={child.id} 
                                    node={child} 
                                    onToggle={onToggle} 
                                    onExpand={onExpand} 
                                    jobPermissions={jobPermissions} 
                                    expandedNodes={expandedNodes} 
                                />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

const translations = {
    ar: { pageTitle: "صلاحيات المسميات الوظيفية", selectJob: "اختر مسمى وظيفي:", permissionsTree: "شجرة الصلاحيات", noJobSelected: "يرجى اختيار مسمى وظيفي لبدء إدارة الصلاحيات.", loading: "جاري التحميل...", saveChanges: "حفظ التغييرات", saving: "جاري الحفظ...", saveSuccess: "تم حفظ الصلاحيات بنجاح.", saveError: "حدث خطأ أثناء حفظ الصلاحيات.", noPermission: "ليس لديك صلاحية.", selectAll: "تحديد الكل (المعروض)", deselectAll: "إلغاء تحديد الكل (المعروض)", searchPermissions: "بحث في الصلاحيات..." },
    en: { pageTitle: "Job Permissions Management", selectJob: "Select a Job Title:", permissionsTree: "Permissions Tree", noJobSelected: "Please select a job title to start managing permissions.", loading: "Loading...", saveChanges: "Save Changes", saving: "Saving...", saveSuccess: "Permissions saved successfully.", saveError: "An error occurred while saving permissions.", noPermission: "No permission.", selectAll: "Select All (Visible)", deselectAll: "Deselect All (Visible)", searchPermissions: "Search permissions..." }
};

const JobPermissionsPage = () => {
    const { language } = useLanguage();
    const { hasPermission, user } = useAuth(); // إضافة user

    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJob, setSelectedJob] = useState<number | null>(null);
    const [servicesTree, setServicesTree] = useState<ServiceNode[]>([]);
    const [jobPermissions, setJobPermissions] = useState<Set<string>>(new Set());
    const [initialJobPermissions, setInitialJobPermissions] = useState<Set<string>>(new Set());
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [searchFilter, setSearchFilter] = useState('');
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const t = translations[language];

    // دالة مساعدة للبحث عن العقدة في الشجرة وتحديد نوع الإرجاع
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

    useEffect(() => {
        const fetchInitialData = async () => {
            const [jobsRes, servicesRes, subServicesRes, subSubServicesRes] = await Promise.all([
                supabase.from('jobs').select('id, name_ar, name_en').order('id'),
                supabase.from('services').select('id, label_ar, label_en').order('order'),
                // تعديل الاستعلام لجلب معرف الأب
                supabase.from('sub_services').select('id, service_id, label_ar, label_en').order('order'),
                supabase.from('sub_sub_services').select('id, sub_service_id, label_ar, label_en').order('order')
            ]);

            setJobs(jobsRes.data || []);
            // تعديل بناء الشجرة
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
                                parentId: `ss:${ss.id}` // إضافة معرف الأب
                            }));
                        return {
                            id: `ss:${ss.id}`,
                            label: language === 'ar' ? ss.label_ar : ss.label_en,
                            children: subSubServices,
                            parentId: `s:${s.id}` // إضافة معرف الأب
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
    }, [language, hasPermission, findNode]);

    useEffect(() => {
        if (!selectedJob) {
            setJobPermissions(new Set());
            setInitialJobPermissions(new Set());
            return;
        }
        const fetchJobPermissions = async () => {
            const { data } = await supabase.from('job_permissions').select('*').eq('job_id', selectedJob);
            const perms = new Set((data || []).map(p => {
                if (p.sub_sub_service_id) return `sss:${p.sub_sub_service_id}`;
                if (p.sub_service_id) return `ss:${p.sub_service_id}`;
                return `s:${p.service_id}`;
            }));
            setJobPermissions(perms);
            setInitialJobPermissions(new Set(perms));
        };
        fetchJobPermissions();
    }, [selectedJob]);
    
    // تعديل دالة التفعيل لضمان تفعيل الأبوين
    const handlePermissionToggle = useCallback((nodeId: string, isChecked: boolean) => {
        setJobPermissions(prev => {
            const newPerms = new Set(prev);
            
            // Toggle the current node
            if (isChecked) {
                newPerms.add(nodeId);
            } else {
                newPerms.delete(nodeId);
            }

            // Ensure parent nodes are also checked if a child is checked
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
    
    const onExpandNode = (nodeId: string) => {
        setExpandedNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(nodeId)) newSet.delete(nodeId);
            else newSet.add(nodeId);
            return newSet;
        });
    };

    const handleSave = async () => {
        if (!selectedJob || !user) return;
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
                    job_id: selectedJob,
                    service_id: serviceId,
                    sub_service_id: subServiceId,
                    sub_sub_service_id: subSubServiceId,
                };
            });

            const { error } = await supabase.rpc('update_job_permissions_and_cleanup_users', {
                p_job_id: selectedJob,
                p_permissions: permissionsToInsert,
                p_changed_by_user_id: user.id
            });

            if (error) throw error;
            alert(t.saveSuccess);
            setInitialJobPermissions(new Set(jobPermissions));
        } catch (error) {
            console.error("Error saving permissions:", error);
            alert(t.saveError);
        } finally {
            setIsSaving(false);
        }
    };
    
    const hasChanges = useMemo(() => {
        const initialIdsString = Array.from(initialJobPermissions).sort().join(',');
        const currentIdsString = Array.from(jobPermissions).sort().join(',');
        return initialIdsString !== currentIdsString;
    }, [jobPermissions, initialJobPermissions]);

    const filteredTree = useMemo(() => {
        if (!searchFilter) return servicesTree;
        const lowerCaseFilter = searchFilter.toLowerCase();
        const filterNodes = (nodes: ServiceNode[]): ServiceNode[] => {
            return nodes.reduce((acc, node) => {
                const children = filterNodes(node.children);
                if (node.label.toLowerCase().includes(lowerCaseFilter) || children.length > 0) {
                    acc.push({ ...node, children });
                }
                return acc;
            }, [] as ServiceNode[]);
        };
        return filterNodes(servicesTree);
    }, [servicesTree, searchFilter]);

    const handleSelectAllVisible = useCallback((select: boolean) => {
        const newPerms = new Set(jobPermissions);
        const traverseAndToggle = (nodes: ServiceNode[]) => {
            nodes.forEach(node => {
                if (select) {
                    newPerms.add(node.id);
                } else {
                    newPerms.delete(node.id);
                }
                traverseAndToggle(node.children);
            });
        };
        traverseAndToggle(filteredTree);
        setJobPermissions(newPerms);
    }, [filteredTree, jobPermissions]);
    
    if (!hasPermission('ss:9')) {
        return <AdminSectionLayout mainServiceId={17}><div className="text-center text-red-500 p-10">{t.noPermission}</div></AdminSectionLayout>;
    }

    if (isLoading) {
        return <AdminSectionLayout mainServiceId={17}><div className="flex justify-center items-center h-64"><LoaderCircle className="animate-spin text-[#FFD700]" size={48} /></div></AdminSectionLayout>;
    }
    
    return (
      <AdminSectionLayout mainServiceId={17}>
        <div className="space-y-4">
          {/* حاوية اختيار المسمى الوظيفي */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <label className="block mb-2 font-semibold text-gray-300">{t.selectJob}</label>
            <select
              onChange={(e) => setSelectedJob(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-gray-800 rounded-md py-2 px-3 focus:ring-yellow-500 border-gray-700"
            >
              <option value="">{t.noJobSelected.split(' ').slice(0, 4).join(' ')}</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>
                  {language === 'ar' ? job.name_ar : job.name_en}
                </option>
              ))}
            </select>
          </div>

          {/* حاوية الصلاحيات الرئيسية */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            {selectedJob ? (
              <>
                {/* شريط البحث وأزرار التحديد */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                  <div className="relative w-full md:flex-grow">
                    <Search className="absolute rtl:right-3 ltr:left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder={t.searchPermissions}
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      className="w-full bg-gray-800 rounded-md py-2 rtl:pr-10 ltr:pl-10 px-4 focus:ring-yellow-500 border-gray-700"
                    />
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button
                      onClick={() => handleSelectAllVisible(true)}
                      className="text-xs flex-1 flex items-center justify-center gap-1 bg-green-500/20 text-green-300 px-2 py-1 rounded-md hover:bg-green-500/40"
                    >
                      <Check size={14} /> {t.selectAll}
                    </button>
                    <button
                      onClick={() => handleSelectAllVisible(false)}
                      className="text-xs flex-1 flex items-center justify-center gap-1 bg-red-500/20 text-red-300 px-2 py-1 rounded-md hover:bg-red-500/40"
                    >
                      <X size={14} /> {t.deselectAll}
                    </button>
                  </div>
                </div>
                {/* قائمة الصلاحيات */}
                <div>
                  {filteredTree.map(node => (
                    <PermissionNode
                      key={node.id}
                      node={node}
                      onToggle={handlePermissionToggle}
                      onExpand={onExpandNode}
                      jobPermissions={jobPermissions}
                      expandedNodes={expandedNodes} 
                    />
                  ))}
                </div>
                {/* زر الحفظ في نهاية القائمة */}
                <AnimatePresence>
                  {hasChanges && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="mt-6 flex justify-end"
                    >
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-3 font-bold bg-[#FFD700] text-black rounded-lg hover:bg-yellow-400 disabled:bg-gray-500 transition-all shadow-lg shadow-black/50"
                      >
                        {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
                        {isSaving ? t.saving : t.saveChanges}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="text-center py-20 text-gray-500">{t.noJobSelected}</div>
            )}
          </div>
        </div>
      </AdminSectionLayout>
    );
};

export default JobPermissionsPage;