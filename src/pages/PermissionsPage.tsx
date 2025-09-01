import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './../components/contexts/UserContext';
import { useLanguage } from './../components/contexts/LanguageContext';
import { Header } from './../components/dashboard/Header';
import { SlidersHorizontal, Users, Shield } from 'lucide-react';
// ملاحظة: سنقوم بإنشاء هذه المكونات في الخطوات التالية
// import { GlobalControlsTab } from '../../components/admin/GlobalControlsTab';
// import { JobPermissionsTab } from '../../components/admin/JobPermissionsTab';
// import { UserPermissionsTab } from '../../components/admin/UserPermissionsTab';

const translations = {
  ar: {
    title: "إدارة الصلاحيات",
    globalControls: "التحكم العام",
    jobPermissions: "صلاحيات المسميات الوظيفية",
    userPermissions: "استثناءات المستخدمين",
    accessDenied: "ليس لديك الصلاحية للوصول إلى هذه الصفحة.",
    comingSoon: "قريبًا...",
  },
  en: {
    title: "Permissions Management",
    globalControls: "Global Controls",
    jobPermissions: "Job Role Permissions",
    userPermissions: "User Exceptions",
    accessDenied: "You do not have permission to access this page.",
    comingSoon: "Coming Soon...",
  },
};

const tabs = [
  { id: 'global', labelKey: 'globalControls', icon: SlidersHorizontal, permission: 'ss:9011' },
  { id: 'job', labelKey: 'jobPermissions', icon: Shield, permission: 'ss:9012' },
  { id: 'user', labelKey: 'userPermissions', icon: Users, permission: 'ss:9013' },
];

export const PermissionsPage = () => {
  const { language } = useLanguage();
  const { hasPermission } = useAuth();
  const t = translations[language];

  // فلترة التبويبات بناءً على صلاحيات المستخدم
  const availableTabs = tabs.filter(tab => hasPermission(tab.permission));
  const [activeTab, setActiveTab] = React.useState(availableTabs[0]?.id || null);

  // إذا لم يكن لدى المستخدم صلاحية لأي تبويب، اعرض رسالة "وصول مرفوض"
  if (!activeTab) {
    return (
      <div className="bg-[#0D1B2A] min-h-screen text-white flex flex-col items-center justify-center">
        <Header onToggleServices={() => {}} />
        <main className="flex-grow flex items-center justify-center">
          <h1 className="text-2xl font-bold text-red-500">{t.accessDenied}</h1>
        </main>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      // case 'global': return <GlobalControlsTab />;
      // case 'job': return <JobPermissionsTab />;
      // case 'user': return <UserPermissionsTab />;
      default: return (
        <div className="p-6 bg-gray-800/50 rounded-lg text-center text-gray-400">
          {t.comingSoon}
        </div>
      );
    }
  };

  return (
    <div className="bg-[#0D1B2A] min-h-screen text-white flex flex-col">
      <Header onToggleServices={() => { /* يمكنك هنا فتح قائمة الخدمات */ }} />
      <main className="flex-grow p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold mb-6">{t.title}</h1>
          
          {/* شريط التبويبات */}
          <div className="flex border-b border-gray-700 mb-6">
            {availableTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors focus:outline-none relative ${
                    activeTab === tab.id
                      ? 'text-yellow-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  <span>{t[tab.labelKey as keyof typeof t]}</span>
                  {activeTab === tab.id && (
                    <motion.div 
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400"
                      layoutId="activeTabIndicator"
                    />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* محتوى التبويب النشط */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

