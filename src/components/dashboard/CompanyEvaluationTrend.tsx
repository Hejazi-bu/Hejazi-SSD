import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { DashboardCard } from '../home/DashboardCard';
import {
    collection, query, DocumentData, FirestoreDataConverter,
    QueryDocumentSnapshot, SnapshotOptions, Timestamp, orderBy, limit
} from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { db } from '../../lib/firebase';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Title, Tooltip, Legend, ChartOptions, Filler,
    LegendItem
} from 'chart.js';
// ✨ 1. التأكد من استيراد الإضافة
import ChartDataLabels, { Context } from 'chartjs-plugin-datalabels'; 
import { motion, AnimatePresence } from 'framer-motion'; 
import { staggeredItemVariants, interactiveItemVariants } from '../../lib/animations';

// تسجيل مكونات الرسم البياني
ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, 
    Title, Tooltip, Legend, Filler,
    ChartDataLabels // ✨ 2. التأكد من تسجيل الإضافة
);

// --- الأنواع والمحولات (لا تغيير هنا) ---
interface MonthlyScoreDoc extends DocumentData { id: string; company_id: string; evaluation_year: number; evaluation_month: number; overall_score: number; evaluation_count: number; }
interface SimpleCompany { id: string; name_ar: string; name_en?: string; }
const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
    toFirestore: (data: T): DocumentData => data,
    fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T => ({ id: snapshot.id, ...snapshot.data(options) } as unknown as T)
});
const monthlyScoreConverter = createConverter<MonthlyScoreDoc>();
const companyConverter = createConverter<SimpleCompany>();
// ---

const companyColors = ['#FFD700', '#34D399']; // أصفر و أخضر

export const CompanyEvaluationTrend = () => {
    const { hasPermission } = useAuth();
    const { language } = useLanguage();
    
    const [hiddenDatasets, setHiddenDatasets] = useState<number[]>([]);

    const canView = hasPermission('ss:3'); 

    const [monthlyScores, scoresLoading] = useCollectionData(
        query(
            collection(db, "company_monthly_scores"),
            orderBy('evaluation_year', 'desc'),
            orderBy('evaluation_month', 'desc'),
            limit(12 * 2) 
        ).withConverter(monthlyScoreConverter)
    );
    
    const [companies, companiesLoading] = useCollectionData(
        collection(db, "companies").withConverter(companyConverter)
    );

    // (لا تغيير في chartData)
    const chartData = useMemo(() => {
        if (!monthlyScores || !companies || companies.length === 0 || monthlyScores.length === 0) {
            return null;
        }

        const labels: string[] = [];
        const monthNames = language === 'ar' 
            ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
            : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        const yearMonthKeys: string[] = []; 

        for (let i = 11; i >= 0; i--) {
            const date = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - i, 1);
            const month = date.getMonth();
            const year = date.getFullYear();
            let label = monthNames[month];
            if (i === 11 || month === 0) {
                 label = `${monthNames[month]} ${year}`; 
            }
            labels.push(label);
            yearMonthKeys.push(`${year}_${month + 1}`);
        }

        const datasets = companies.map((company, index) => {
            const data: (number | null)[] = Array(12).fill(null);
            yearMonthKeys.forEach((key, monthIndex) => {
                const [year, month] = key.split('_').map(Number);
                const scoreDoc = monthlyScores.find(s => s.company_id === company.id && s.evaluation_year === year && s.evaluation_month === month);
                if (scoreDoc) data[monthIndex] = scoreDoc.overall_score;
            });

            const color = companyColors[index % companyColors.length];
            return {
                label: language === 'ar' ? (company.name_ar || company.id) : (company.name_en || company.name_ar || company.id),
                data: data,
                borderColor: color,
                backgroundColor: `${color}33`, 
                fill: true,
                tension: 0.3, 
                pointBackgroundColor: color,
                spanGaps: true, 
                pointHoverRadius: 7, 
                pointHoverBorderWidth: 2, 
                pointHoverBackgroundColor: color, 
            };
        });

        return { labels, datasets };
    }, [monthlyScores, companies, language]);

    // (لا تغيير في filteredChartData)
    const filteredChartData = useMemo(() => {
        if (!chartData) return { labels: [], datasets: [] };
        
        const datasets = chartData.datasets.map((ds, index) => {
            if (hiddenDatasets.includes(index)) {
                return { ...ds, data: [] }; 
            }
            return ds;
        });
        
        return { ...chartData, datasets };
    }, [chartData, hiddenDatasets]);


    const chartOptions = useMemo((): ChartOptions<'line'> => {
        const isRTL = language === 'ar';
        return {
            responsive: true,
            maintainAspectRatio: false,
            
            // --- ✨ 3. التعديل الرئيسي: زيادة الهامش الأيمن والأيسر ---
            // لإعطاء مساحة للأرقام في البداية والنهاية
            layout: { padding: { left: 35, right: 35 } },

            onHover: (event, chartElements, chart) => {
                chart.canvas.style.cursor = chartElements.length > 0 ? 'pointer' : 'default';
            },
            interaction: { mode: 'nearest', intersect: true, axis: 'xy' },
            scales: {
                x: { 
                    ticks: { color: '#9CA3AF', maxRotation: 90, minRotation: 45, autoSkip: false }, 
                    grid: { color: '#4B5563' }, border: { color: '#9CA3AF' },
                    reverse: isRTL, 
                },
                y: { 
                    beginAtZero: true, max: 5, 
                    ticks: { color: '#9CA3AF', stepSize: 1 }, 
                    grid: { color: '#4B5563' }, border: { color: '#9CA3AF' },
                    position: isRTL ? 'right' : 'left',
                }
            },
            plugins: {
                legend: { 
                    display: false,
                },
                
                datalabels: {
                    display: true, 
                    color: (context: Context) => companyColors[context.datasetIndex % companyColors.length],
                    font: (context: Context) => {
                        const defaultFont = ChartJS.defaults.font;
                        if (context.active) return { size: 12, weight: 700, family: defaultFont.family || 'Arial' };
                        return { size: 10, weight: 500, family: defaultFont.family || 'Arial' };
                    },
                    
                    // --- ✨ 4. التعديل الرئيسي: إزالة منطق القلب ---
                    // وإعادة الاتجاه الافتراضي (خارج النقطة)
                    align: isRTL ? 'left' : 'right',
                    textAlign: isRTL ? 'left' : 'right', 
                    // --- نهاية التعديل ---

                    offset: 4, 
                    formatter: (value) => (typeof value === 'number' ? value.toFixed(2) : null),
                    
                    // (لا تغيير هنا في listeners)
                    listeners: {
                        enter: (context: Context) => {
                            const chart = context.chart;
                            chart.canvas.style.cursor = 'pointer';
                            if (chart.tooltip) {
                                chart.tooltip.setActiveElements([
                                    { datasetIndex: context.datasetIndex, index: context.dataIndex }
                                ], { x: 0, y: 0 });
                            }
                            chart.setActiveElements([
                                { datasetIndex: context.datasetIndex, index: context.dataIndex }
                            ]);
                        },
                        leave: (context: Context) => {
                            const chart = context.chart;
                            chart.canvas.style.cursor = 'default';
                            if (chart.tooltip) {
                                chart.tooltip.setActiveElements([], { x: 0, y: 0 });
                            }
                            chart.setActiveElements([]);
                        },
                    }
                },
                tooltip: { 
                    backgroundColor: '#1F2937', 
                    rtl: isRTL, 
                },
            },
        };
    }, [language]);

    const toggleDataset = (index: number) => {
        setHiddenDatasets(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index) 
                : [...prev, index] 
        );
    };

    if (!canView) return null; 

    const isLoading = scoresLoading || companiesLoading;
    const t = language === 'ar' ? {
        title: "مؤشر أداء الشركات (آخر 12 شهر)",
        loading: "جاري تحميل مؤشر الأداء...",
        noData: "لا توجد بيانات كافية لعرض المؤشر."
    } : {
        title: "Companies Performance Trend (Last 12 Months)",
        loading: "Loading performance trend...",
        noData: "Not enough data to display trend."
    };

    return (
        <motion.div variants={staggeredItemVariants} className="lg:col-span-2"> 
            <DashboardCard title={t.title} isInteractive={false}>
                
                {/* (لا تغيير هنا) */}
                <div className="flex items-center mb-4 justify-start">
                    {chartData?.datasets.map((dataset, index) => {
                        const isHidden = hiddenDatasets.includes(index);
                        return (
                            <motion.div
                                key={dataset.label}
                                className="relative flex items-center cursor-pointer mx-2"
                                variants={interactiveItemVariants}
                                whileHover="hover"
                                whileTap="tap"
                                onTap={() => toggleDataset(index)}
                                animate={{ opacity: isHidden ? 0.5 : 1 }}
                            >
                                <div 
                                    className="w-4 h-4 rounded-sm"
                                    style={{ 
                                        backgroundColor: dataset.borderColor as string,
                                        [language === 'ar' ? 'marginLeft' : 'marginRight']: '0.5rem'
                                    }}
                                />
                                <span className={`text-sm ${isHidden ? 'text-gray-500' : 'text-gray-300'}`}>
                                    {dataset.label}
                                </span>
                                
                                <AnimatePresence>
                                    {isHidden && (
                                        <motion.div
                                            className="absolute left-0 right-0 h-0.5 bg-gray-400"
                                            style={{ top: '50%' }}
                                            initial={{ width: 0, originX: language === 'ar' ? 1 : 0 }}
                                            animate={{ width: "100%", originX: language === 'ar' ? 1 : 0 }}
                                            exit={{ width: 0, originX: language === 'ar' ? 1 : 0 }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>

                {/* (لا تغيير هنا) */}
                <div className="h-[280px] md:h-[300px]">
                    {isLoading && <p className="text-gray-400">{t.loading}</p>}
                    
                    {!isLoading && !chartData && (
                         <p className="text-gray-400">{t.noData}</p>
                    )}

                    {!isLoading && chartData && (
                        <Line options={chartOptions} data={filteredChartData} />
                    )}
                </div>
            </DashboardCard>
        </motion.div>
    );
};