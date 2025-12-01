import React, { useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useLanguage } from './contexts/LanguageContext'; // تأكد من صحة هذا المسار
import { staggeredContainerVariants } from '../lib/animations'; // تأكد من صحة هذا المسار

// --- تعريف نوع العمود (Column) ---
export interface ColumnDef<T> {
    accessorKey?: keyof T | string; // ✨ أصبح اختيارياً
    header: string;
    id?: string; // ✨ أضفنا هذا للتعامل مع الأعمدة بدون accessorKey
    cell?: (value: any, row: T) => React.ReactNode;
    width?: string;
}

// --- واجهة الخصائص للمكون ---
interface DataTableProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    isLoading?: boolean;
    getRowId: (row: T) => string | number; // دالة للحصول على مفتاح فريد لكل صف
    noDataMessage?: string;
}

// --- دالة مساعدة للحصول على القيمة (تدعم الكائنات المتداخلة) ---
const getNestedValue = (obj: any, path: string) => {
    // التأكد من أن المسار هو سلسلة نصية قبل التقسيم
    if (typeof path !== 'string') return undefined;
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), obj);
};

// --- متغيرات الحركة (Animations) ---
const tableVariants: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut", staggerChildren: 0.05 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: "easeIn" } }
};

const tableHeaderVariants: Variants = {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const tableRowVariants: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, x: -50, transition: { duration: 0.2, ease: "easeIn" } }
};

// --- المكون الرئيسي DataTable ---
export function DataTable<T>({
    data,
    columns,
    isLoading = false,
    getRowId,
    noDataMessage = "No data available" // رسالة افتراضية
}: DataTableProps<T>) {

    const { language } = useLanguage();

    // تنسيق بسيط للقيمة الافتراضية للخلية
    const defaultCellRenderer = (value: any) => {
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'string') return value;
        if (value === null || value === undefined) return '-';
        return JSON.stringify(value);
    };

    // تجنب عرض "جاري التحميل" و "لا توجد بيانات" في نفس الوقت
    const showLoading = isLoading;
    const showNoData = !isLoading && data.length === 0;

    // توليد مفتاح فريد لكل عمود (مهم للحركات والأداء)
    const getColumnKey = (column: ColumnDef<T>) => column.id ?? String(column.accessorKey ?? column.header);

    return (
        <motion.div
            className="overflow-hidden rounded-lg border border-gray-700"
            variants={tableVariants}
            initial="initial"
            animate="animate"
            exit="exit"
        >
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700 bg-gray-900/50">
                    {/* رأس الجدول */}
                    <motion.thead
                        className="bg-gray-800/60"
                        variants={tableHeaderVariants} // حركة لرأس الجدول
                    >
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={getColumnKey(column)} // ✨ استخدام المفتاح الفريد للعمود
                                    scope="col"
                                    style={{ width: column.width || 'auto' }}
                                    className={`px-4 py-3.5 text-sm font-semibold text-gray-300 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </motion.thead>
                    {/* جسم الجدول */}
                    <motion.tbody
                        className="divide-y divide-gray-700/50"
                        // لا نستخدم staggerChildren هنا مباشرة، ستتم الحركة عبر الصفوف
                    >
                        {/* حالة التحميل */}
                        {showLoading && (
                            <tr>
                                <td colSpan={columns.length} className="p-8 text-center text-gray-400">
                                    {/* يمكنك إضافة Spinner هنا */}
                                    Loading...
                                </td>
                            </tr>
                        )}
                        {/* حالة عدم وجود بيانات */}
                        {showNoData && (
                            <tr>
                                <td colSpan={columns.length} className="p-8 text-center text-yellow-400">
                                    {noDataMessage}
                                </td>
                            </tr>
                        )}
                        {/* عرض الصفوف */}
                        <AnimatePresence>
                            {!showLoading && !showNoData && data.map((row) => (
                                <motion.tr
                                    key={getRowId(row)} // استخدام ID الصف الفريد
                                    layout // تمكين الحركة عند إعادة الترتيب/الحذف
                                    variants={tableRowVariants}
                                    initial="initial" // الحركة المبدئية لكل صف
                                    animate="animate"
                                    exit="exit" // حركة عند الحذف
                                    className="hover:bg-gray-800/40 transition-colors duration-150"
                                >
                                    {columns.map((column) => {
                                        // ✨ استدعِ getNestedValue فقط إذا كان accessorKey موجودًا
                                        const value = column.accessorKey ? getNestedValue(row, column.accessorKey as string) : undefined;
                                        return (
                                            <td
                                                key={`${getRowId(row)}-${getColumnKey(column)}`} // ✨ استخدام المفتاح الفريد للعمود
                                                className={`whitespace-normal px-4 py-3 text-sm text-gray-200 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                                            >
                                                {/* استخدام دالة cell المخصصة أو الافتراضية */}
                                                {column.cell ? column.cell(value, row) : defaultCellRenderer(value)}
                                            </td>
                                        );
                                    })}
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </motion.tbody>
                </table>
            </div>
        </motion.div>
    );
}