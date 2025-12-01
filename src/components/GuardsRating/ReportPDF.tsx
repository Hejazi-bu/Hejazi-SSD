// src/components/GuardsRating/ReportPDF.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

// --- 1. تسجيل الخط العربي (باستخدام خط Amiri الموثوق به في مشروعك) ---
// 🚨 يجب التأكد من أن ملفات Amiri-Regular.ttf و Amiri-Bold.ttf موجودة في مسار /fonts/
Font.register({
  family: 'Amiri',
  fonts: [
    { src: '/fonts/Amiri-Regular.ttf' },
    { src: '/fonts/Amiri-Bold.ttf', fontWeight: 'bold' },
  ]
});
const ARABIC_FONT = 'Amiri'; 

// --- 2. تعريف الأنواع المستخدمة ---
interface AggregatedResult {
    id: string;
    entityName: string;
    averageScore: number;
    answerCount: number;
    evaluationCount?: number;
}
interface ReportProps {
    t: any;
    language: 'ar' | 'en';
    overallAverage: number;
    aggregatedResultsByCompany: AggregatedResult[];
    aggregatedResultsByQuestion: AggregatedResult[];
    isTrendChartVisible: boolean;
    companyBarChartBase64?: string; 
    questionBarChartBase64?: string;
    companyTrendChartBase64?: string;
    questionTrendChartBase64?: string;
}

// --- 3. تعريف الأنماط (تطبيق خط Amiri) ---
const styles = StyleSheet.create({
    // ✨ تعيين خط Amiri كخط افتراضي للصفحة
    page: {
        fontFamily: ARABIC_FONT, 
        flexDirection: 'column',
        backgroundColor: '#1F2937', 
        padding: 30,
    },
    header: {
        marginBottom: 25,
        borderBottomColor: '#FFD700',
        borderBottomWidth: 2,
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        color: '#FFD700',
        fontWeight: 'bold',
        // لا نحتاج لتعريف الخط هنا، سيأخذ Amiri من Page Style
    },
    subtitle: {
        fontSize: 14,
        color: '#D1D5DB',
    },
    section: {
        marginBottom: 20,
        padding: 15,
        backgroundColor: '#374151',
        borderRadius: 8,
    },
    h1: {
        fontSize: 16,
        color: '#FFD700',
        marginBottom: 10,
        fontWeight: 'bold',
    },
    h2: {
        fontSize: 14,
        color: '#34D399',
        marginBottom: 10,
        marginTop: 10,
        fontWeight: 'bold',
    },
    table: { 
        display: "flex", 
        width: "auto", 
        borderStyle: "solid", 
        borderWidth: 1, 
        borderColor: '#4B5563', 
        marginBottom: 10,
        marginTop: 10,
    }, 
    tableRow: { 
        margin: "auto", 
        flexDirection: "row",
        borderBottomColor: '#4B5563',
        borderBottomWidth: 1,
    }, 
    tableColHeader: { 
        borderStyle: "solid", 
        borderLeftWidth: 1, 
        borderLeftColor: '#4B5563',
        backgroundColor: '#4B5563',
        padding: 5,
    }, 
    tableCol: { 
        borderStyle: "solid", 
        borderLeftWidth: 1, 
        borderLeftColor: '#4B5563',
        padding: 5,
    }, 
    tableCellHeader: {
        fontSize: 10, 
        color: '#D1D5DB',
        fontWeight: 'bold',
    },
    tableCell: { 
        fontSize: 10, 
        color: 'white',
    },
    chartImage: {
        width: '100%',
        height: 300,
        marginTop: 10,
    },
    averageBox: {
        padding: 10,
        backgroundColor: '#60A5FA',
        borderRadius: 5,
        width: '35%',
        textAlign: 'center',
        marginBottom: 20,
    },
    averageText: {
        fontSize: 18,
        color: 'black',
        fontWeight: 'bold',
    }
});

// --- 4. مكون جدول البيانات ---
const DataTablePDF: React.FC<{ data: AggregatedResult[], t: any, language: 'ar' | 'en' }> = ({ data, t, language }) => {
    const colWidths = [40, 20, 20, 20];
    const isCompanyTable = data[0]?.evaluationCount !== undefined;

    return (
        <View style={styles.table}>
            {/* الصف الرئيسي (الرؤوس) */}
            <View style={{ ...styles.tableRow, backgroundColor: '#4B5563' }}>
                <View style={{ width: `${colWidths[0]}%`, ...styles.tableColHeader, borderLeftWidth: language === 'ar' ? 0 : 1, borderRightWidth: language === 'ar' ? 1 : 0 }}>
                    <Text style={styles.tableCellHeader}>
                        {isCompanyTable ? t.col_entity_company : t.col_entity_question}
                    </Text>
                </View>
                <View style={{ width: `${colWidths[1]}%`, ...styles.tableColHeader, borderLeftWidth: 1 }}>
                    <Text style={styles.tableCellHeader}>{t.col_average}</Text>
                </View>
                {isCompanyTable && (
                    <View style={{ width: `${colWidths[2]}%`, ...styles.tableColHeader, borderLeftWidth: 1 }}>
                        <Text style={styles.tableCellHeader}>{t.col_evaluations}</Text>
                    </View>
                )}
                <View style={{ width: `${isCompanyTable ? colWidths[3] : 40}%`, ...styles.tableColHeader, borderLeftWidth: language === 'ar' ? 1 : 1, borderRightWidth: language === 'ar' ? 0 : 0 }}>
                    <Text style={styles.tableCellHeader}>{t.col_answers}</Text>
                </View>
            </View>

            {/* صفوف البيانات */}
            {data.slice(0, 15).map((item, index) => (
                <View key={item.id} style={{ ...styles.tableRow, backgroundColor: index % 2 === 0 ? '#1F2937' : '#374151' }}>
                    <View style={{ width: `${colWidths[0]}%`, ...styles.tableCol, borderLeftWidth: language === 'ar' ? 0 : 1, borderRightWidth: language === 'ar' ? 1 : 0 }}>
                        <Text style={styles.tableCell}>{item.entityName}</Text>
                    </View>
                    <View style={{ width: `${colWidths[1]}%`, ...styles.tableCol, borderLeftWidth: 1 }}>
                        <Text style={{ ...styles.tableCell, color: '#FFD700' }}>{item.averageScore.toFixed(2)}</Text>
                    </View>
                    {isCompanyTable && (
                        <View style={{ width: `${colWidths[2]}%`, ...styles.tableCol, borderLeftWidth: 1 }}>
                            <Text style={{ ...styles.tableCell, color: '#34D399' }}>{item.evaluationCount ?? '-'}</Text>
                        </View>
                    )}
                    <View style={{ width: `${isCompanyTable ? colWidths[3] : 40}%`, ...styles.tableCol, borderLeftWidth: language === 'ar' ? 1 : 1, borderRightWidth: language === 'ar' ? 0 : 0 }}>
                        <Text style={styles.tableCell}>{item.answerCount}</Text>
                    </View>
                </View>
            ))}
        </View>
    );
};


// --- 5. المكون الرئيسي (Default Export) ---
const ReportPDF: React.FC<ReportProps> = (props) => {
    const { t, language, overallAverage, aggregatedResultsByCompany, aggregatedResultsByQuestion, isTrendChartVisible } = props;

    const pageDirectionStyle = { direction: (language === 'ar' ? 'rtl' : 'ltr') as 'rtl' | 'ltr' };

    return (
        <Document>
            {/* ✨ تعيين الخط على مستوى الوثيقة لضمان تطبيقه */}
            <Page size="A4" style={styles.page}> 
                
                <View style={pageDirectionStyle}>
                    {/* الرأس */}
                    <View fixed style={styles.header}>
                        <Text style={styles.title}>{t.pageTitle}</Text>
                        <Text style={styles.subtitle}>{new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'long', numberingSystem: 'latn' })}</Text>
                    </View>

                    {/* المتوسط الإجمالي */}
                    <View style={styles.averageBox}>
                        <Text style={{ fontSize: 10, color: 'black', marginBottom: 5 }}>{t.overallAverage}</Text>
                        <Text style={styles.averageText}>{overallAverage.toFixed(2)}</Text>
                    </View>

                    {/* قسم أداء الشركات */}
                    {aggregatedResultsByCompany.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.h1}>{t.companyAggregatedTitle}</Text>
                            <DataTablePDF data={aggregatedResultsByCompany} t={t} language={language} />

                            {props.companyBarChartBase64 && (
                                <View style={{ marginTop: 20 }}>
                                    <Text style={styles.subtitle}>{t.companyBarChartTitle}</Text>
                                    <Image src={props.companyBarChartBase64} style={styles.chartImage} />
                                </View>
                            )}
                        </View>
                    )}
                    
                    {/* قسم أداء الأسئلة */}
                    {aggregatedResultsByQuestion.length > 0 && (
                        <View style={{...styles.section, marginTop: 20, borderColor: '#34D399', borderLeftWidth: 3}}>
                            <Text style={styles.h2}>{t.questionAggregatedTitle}</Text>
                            <DataTablePDF data={aggregatedResultsByQuestion} t={t} language={language} />

                            {props.questionBarChartBase64 && (
                                <View style={{ marginTop: 20 }}>
                                    <Text style={styles.subtitle}>{t.questionBarChartTitle}</Text>
                                    <Image src={props.questionBarChartBase64} style={styles.chartImage} />
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* قسم المؤشرات الزمنية */}
                {isTrendChartVisible && (
                    <>
                        <Page size="A4" style={styles.page} break></Page> 

                        <View style={pageDirectionStyle}>
                            <View style={styles.section}>
                                <Text style={styles.h1}>{t.companyTrendChartTitle}</Text>
                                {props.companyTrendChartBase64 && <Image src={props.companyTrendChartBase64} style={styles.chartImage} />}
                            </View>
                            
                            <View style={{...styles.section, marginTop: 20, borderColor: '#34D399', borderLeftWidth: 3}}>
                                <Text style={styles.h2}>{t.questionTrendChartTitle}</Text>
                                {props.questionTrendChartBase64 && <Image src={props.questionTrendChartBase64} style={styles.chartImage} />}
                            </View>
                        </View>
                    </>
                )}

            </Page>
        </Document>
    );
};

export default ReportPDF;