import React from 'react';
import { icons } from 'lucide-react';

// واجهة لتحديد خصائص المكون
interface DynamicIconProps {
  name: string | null; // اسم الأيقونة
  className?: string;
}

const DynamicIcon: React.FC<DynamicIconProps> = ({ name, className }) => {
  // إذا لم يكن هناك اسم أيقونة، لا تعرض شيئًا
  if (!name) {
    return null;
  }

  // ابحث عن مكون الأيقونة المطابق للاسم داخل مكتبة lucide-react
  // @ts-ignore - نتجاهل خطأ TypeScript هنا لأنه لا يمكنه معرفة كل أسماء الأيقونات مسبقًا
  const LucideIcon = icons[name];

  // إذا لم يتم العثور على الأيقونة، اعرض أيقونة افتراضية أو لا شيء
  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in lucide-react.`);
    return null; 
  }

  // اعرض مكون الأيقونة الذي تم العثور عليه
  return <LucideIcon className={className} />;
};

export default DynamicIcon;

