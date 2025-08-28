// src/pages/admin/JobPermissionsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../components/contexts/UserContext';
import { useLanguage } from '../../components/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Save, Loader2, ArrowLeft } from 'lucide-react';

// تعريف أنواع البيانات لتنظيم الكود
interface Job {
  id: number;
  name_ar: string;
  name_en: string;
}

interface ServiceTreeNode {
  id: number;
  type: 'service' | 'sub_service' | 'sub_sub_service';
  label: string;
  children: ServiceTreeNode[];
}

export const JobPermissionsPage = () => {
  const { language } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [serviceTree, setServiceTree] = useState<ServiceTreeNode[]>([]);
  const [jobPermissions, setJobPermissions] = useState<Set<string>>(new Set());
  const [initialPermissions, setInitialPermissions] = useState<Set<string>>(new Set());
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // جلب قائمة المسميات الوظيفية عند تحميل المكون
  useEffect(() => {
    supabase
      .from('jobs')
      .select('id, name_ar, name_en')
      .order('id')
      .then(({ data, error }) => {
        if (data) setJobs(data);
        setIsLoadingJobs(false);
      });
  }, []);

  // جلب شجرة الخدمات الكاملة مرة واحدة
  useEffect(() => {
    const fetchServiceTree = async () => {
      const { data: services, error: s_err } = await supabase.from('services').select('id, label_ar, label_en');
      const { data: subServices, error: ss_err } = await supabase.from('sub_services').select('id, service_id, label_ar, label_en');
      // يمكنك إضافة sub_sub_services هنا بنفس الطريقة إذا احتجت

      if (services) {
        const tree: ServiceTreeNode[] = services.map(s => ({
          id: s.id,
          type: 'service',
          label: language === 'ar' ? s.label_ar : s.label_en,
          children: (subServices || [])
            .filter(ss => ss.service_id === s.id)
            .map(ss => ({
              id: ss.id,
              type: 'sub_service',
              label: language === 'ar' ? ss.label_ar : ss.label_en,
              children: [], // أضف المستوى الثالث هنا
            })),
        }));
        setServiceTree(tree);
      }
    };
    fetchServiceTree();
  }, [language]);

  // جلب صلاحيات المسمى الوظيفي المحدد
  const fetchJobPermissions = useCallback(async (jobId: number) => {
    setIsLoadingPermissions(true);
    const { data, error } = await supabase
      .from('job_permissions')
      .select('service_id, sub_service_id, sub_sub_service_id')
      .eq('job_id', jobId);
    
    if (data) {
      const perms = new Set(data.map(p => {
        if (p.sub_sub_service_id) return `sss:${p.sub_sub_service_id}`;
        if (p.sub_service_id) return `ss:${p.sub_service_id}`;
        return `s:${p.service_id}`;
      }));
      setJobPermissions(perms);
      setInitialPermissions(perms); // حفظ الحالة الأولية للمقارنة
    }
    setIsLoadingPermissions(false);
  }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchJobPermissions(selectedJob.id);
    } else {
      setJobPermissions(new Set());
      setInitialPermissions(new Set());
    }
  }, [selectedJob, fetchJobPermissions]);

  const handlePermissionChange = (key: string) => {
    setJobPermissions(prev => {
      const newPerms = new Set(prev);
      if (newPerms.has(key)) {
        newPerms.delete(key);
      } else {
        newPerms.add(key);
      }
      return newPerms;
    });
  };

  const handleSaveChanges = async () => {
    if (!selectedJob) return;
    setIsSaving(true);
    
    // حذف جميع الصلاحيات القديمة لهذا المسمى الوظيفي
    await supabase.from('job_permissions').delete().eq('job_id', selectedJob.id);

    // إضافة الصلاحيات الجديدة المحددة
    const newPermsToInsert = Array.from(jobPermissions).map(key => {
      const [type, id] = key.split(':');
      return {
        job_id: selectedJob.id,
        service_id: type === 's' ? Number(id) : null,
        sub_service_id: type === 'ss' ? Number(id) : null,
        sub_sub_service_id: type === 'sss' ? Number(id) : null,
      };
    });

    if (newPermsToInsert.length > 0) {
      await supabase.from('job_permissions').insert(newPermsToInsert);
    }

    setInitialPermissions(jobPermissions); // تحديث الحالة الأولية بعد الحفظ
    setIsSaving(false);
  };
  
  const hasChanges = initialPermissions.size !== jobPermissions.size || 
                     ![...initialPermissions].every(p => jobPermissions.has(p));

  // عرض شجرة الصلاحيات
  const renderTree = (nodes: ServiceTreeNode[]) => (
    <div className="space-y-2">
      {nodes.map(node => <PermissionNode key={`${node.type}:${node.id}`} node={node} />)}
    </div>
  );

  const PermissionNode = ({ node }: { node: ServiceTreeNode }) => {
    const [isOpen, setIsOpen] = useState(true);
    const key = `${node.type.substring(0, node.type.indexOf('_') > -1 ? 2 : 1)}:${node.id}`;
    const isChecked = jobPermissions.has(key);

    return (
      <div className="pl-4 border-l border-gray-700">
        <div className="flex items-center">
          {node.children.length > 0 && (
            <button onClick={() => setIsOpen(!isOpen)} className="p-1">
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          <input
            type="checkbox"
            id={key}
            checked={isChecked}
            onChange={() => handlePermissionChange(key)}
            className="w-4 h-4 text-[#FFD700] bg-gray-600 border-gray-500 rounded focus:ring-[#FFD700]"
          />
          <label htmlFor={key} className="ml-2 text-white cursor-pointer">{node.label}</label>
        </div>
        {isOpen && node.children.length > 0 && (
          <div className="mt-2">
            {renderTree(node.children)}
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="bg-[#0D1B2A] min-h-screen text-white flex flex-col md:flex-row">
      {/* الشريط الجانبي للمسميات الوظيفية (يختفي على الموبايل عند اختيار مسمى) */}
      <aside className={`w-full md:w-1/3 lg:w-1/4 bg-gray-900/50 p-4 border-r border-gray-800 flex flex-col ${selectedJob ? 'hidden md:flex' : 'flex'}`}>
        <h2 className="text-xl font-bold mb-4">المسميات الوظيفية</h2>
        {isLoadingJobs ? (
          <div>جاري التحميل...</div>
        ) : (
          <ul className="space-y-2 overflow-y-auto">
            {jobs.map(job => (
              <li key={job.id}>
                <button
                  onClick={() => setSelectedJob(job)}
                  className={`w-full text-right p-3 rounded-md transition-colors ${selectedJob?.id === job.id ? 'bg-[#FFD700] text-black' : 'hover:bg-gray-800'}`}
                >
                  {language === 'ar' ? job.name_ar : job.name_en}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* لوحة تعديل الصلاحيات الرئيسية */}
      <main className={`flex-1 p-4 sm:p-6 flex flex-col ${!selectedJob ? 'hidden md:flex' : 'flex'}`}>
        <AnimatePresence mode="wait">
          {selectedJob ? (
            <motion.div key={selectedJob.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
              <div className="flex items-center mb-4">
                <button onClick={() => setSelectedJob(null)} className="md:hidden p-2 mr-2 rounded-full hover:bg-gray-700">
                  <ArrowLeft />
                </button>
                <h2 className="text-2xl font-bold">
                  صلاحيات: <span className="text-[#FFD700]">{language === 'ar' ? selectedJob.name_ar : selectedJob.name_en}</span>
                </h2>
              </div>
              
              <div className="flex-grow bg-gray-800/50 rounded-lg p-4 overflow-y-auto">
                {isLoadingPermissions ? (
                  <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
                ) : (
                  renderTree(serviceTree)
                )}
              </div>
              
              <div className="mt-4">
                <button
                  onClick={handleSaveChanges}
                  disabled={!hasChanges || isSaving}
                  className="w-full flex items-center justify-center gap-2 bg-[#FFD700] text-black font-bold py-3 px-8 rounded-md text-lg shadow-lg hover:bg-yellow-400 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                  {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {language === 'ar' ? 'الرجاء اختيار مسمى وظيفي لعرض صلاحياته' : 'Please select a job title to view its permissions'}
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
