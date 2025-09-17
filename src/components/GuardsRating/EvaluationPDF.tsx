// src/components/GuardsRating/EvaluationPDF.tsx
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// --- تسجيل الخطوط ---
Font.register({
    family: 'Sakkal Majalla',
    fonts: [{ src: '/fonts/majalla.ttf' }, { src: '/fonts/majallab.ttf', fontWeight: 'bold' }]
});

// --- الأنواع المحدثة ---
type EvaluationFull = {
    id: string; 
    created_at: string; 
    summary: string | null; 
    historical_contract_no: string | null; 
    evaluation_year: number; 
    evaluation_month: number; 
    overall_score: number;
    companies: { name_ar: string; name_en: string; } | null; 
    users: { name_ar: string; name_en: string; } | null; 
    jobs: { name_ar: string; name_en: string; } | null;
};
// 🆕 تم تعديل id ليكون من نوع string
type EvaluationDetail = { 
    id: string; 
    selected_rating: number; 
    note: string | null; 
    security_questions: { question_text_ar: string; question_text_en: string; } | null; 
};

interface EvaluationPDFProps {
    evaluation: EvaluationFull;
    details: EvaluationDetail[];
    language: 'ar' | 'en';
}

// --- الأنماط ---
const styles = StyleSheet.create({
    page: { paddingTop: 35, paddingBottom: 120, paddingHorizontal: 35, fontFamily: 'Sakkal Majalla', fontSize: 10, color: '#333' },
    header: { fontSize: 12, marginBottom: 20, textAlign: 'center', color: 'grey' },
    pageNumber: { position: 'absolute', fontSize: 10, bottom: 30, left: 0, right: 0, textAlign: 'center', color: 'grey' },
    title: { fontSize: 20, textAlign: 'center', fontFamily: 'Sakkal Majalla', fontWeight: 'bold', marginBottom: 15 },
    section: { marginBottom: 15 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', backgroundColor: '#f0f0f0', padding: 5, marginBottom: 10 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 5, fontSize: 11 },
    detailLabel: { fontWeight: 'bold' },
    table: { width: '100%', border: '1px solid #e0e0e0', marginBottom: 10 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderBottom: '1px solid #999' },
    tableRow: { flexDirection: 'row', borderBottom: '1px solid #e0e0e0' },
    colHeader: { padding: 6, fontWeight: 'bold', fontSize: 11 },
    tableColQuestion: { width: '50%' }, tableColRating: { width: '25%', textAlign: 'center' }, tableColNotes: { width: '25%' },
    cell: { padding: 6 },
    borderRight: { borderRight: '1px solid #e0e0e0' }, borderLeft: { borderLeft: '1px solid #e0e0e0' },
    rtl: { flexDirection: 'row-reverse' }, rtlAlign: { textAlign: 'right' },
    signatureSection: { position: 'absolute', bottom: 60, left: 35, right: 35, fontSize: 11 },
    signatureBlock: { width: '40%' },
    signaturePlaceholder: { marginTop: 20, borderBottom: '1px dotted #666', height: 30 }
});

// --- المكون ---
export const EvaluationPDF: React.FC<EvaluationPDFProps> = ({ evaluation, details, language }) => {
    const isRTL = language === 'ar';
    const evaluationPeriod = new Date(evaluation.evaluation_year, evaluation.evaluation_month - 1)
        .toLocaleString(isRTL ? 'ar-EG-u-nu-latn' : 'en-US', { month: 'long', year: 'numeric' });
        
    const companyName = isRTL ? evaluation.companies?.name_ar : evaluation.companies?.name_en;
    const evaluatorName = isRTL ? evaluation.users?.name_ar : evaluation.users?.name_en;
    const jobTitle = isRTL ? evaluation.jobs?.name_ar : evaluation.jobs?.name_en;
    const scorePercentage = (evaluation.overall_score * 20).toFixed(0);
    const generationDate = new Date().toLocaleString(isRTL ? 'ar-EG-u-nu-latn' : 'en-US');
    
    const getRatingDescription = (score: number) => { 
        const tooltips = {
            ar: ["", "يحتاج إلى تحسين", "مقبول", "جيد", "جيد جداً", "ممتاز"],
            en: ["", "Need improvement", "Acceptable", "Good", "Very Good", "Excellent"],
        };
        return tooltips[language][Math.round(score)] || "";
    };

    const InfoRow = ({ labelAr, labelEn, value }: { labelAr: string, labelEn: string, value: string | number | null | undefined }) => (
        <View style={[styles.detailRow, isRTL ? styles.rtl : {}]}><Text style={styles.detailLabel}>{isRTL ? `:${labelAr}` : `${labelEn}:`}</Text><Text>{value || (isRTL ? 'غير متوفر' : 'N/A')}</Text></View>
    );

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.header} fixed>{isRTL ? 'وثيقة رسمية - بلدية مدينة أبوظبي' : 'Official Document - Abu Dhabi City Municipality'}</Text>
                <Text style={[styles.title, isRTL ? styles.rtlAlign : {}]}>{isRTL ? 'تقرير تقييم أمني' : 'Security Evaluation Report'}</Text>
                
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isRTL ? styles.rtlAlign : {}]}>{isRTL ? 'معلومات التقييم' : 'Evaluation Information'}</Text>
                    <InfoRow labelAr="العميل" labelEn="Client" value="ABU DHABI MUNICIPALITY" />
                    <InfoRow labelAr="الموقع" labelEn="Location" value="ADM" />
                    <InfoRow labelAr="فترة التقييم" labelEn="Evaluation Period" value={evaluationPeriod} />
                    <InfoRow labelAr="اسم الشركة" labelEn="Company Name" value={companyName} />
                    <InfoRow labelAr="رقم العقد" labelEn="Contract Number" value={evaluation.historical_contract_no} />
                    <View style={[styles.detailRow, isRTL ? styles.rtl : {}]}><Text style={styles.detailLabel}>{isRTL ? ':النتيجة النهائية' : 'Final Score:'}</Text><Text>{`${scorePercentage}% (${getRatingDescription(evaluation.overall_score)})`}</Text></View>
                </View>
                
                {evaluation.summary && (
                    <View style={styles.section}>
                           <Text style={[styles.sectionTitle, isRTL ? styles.rtlAlign : {}]}>{isRTL ? 'ملخص التقييم' : 'Evaluation Summary'}</Text>
                           <Text style={[{paddingHorizontal: 5}, isRTL ? styles.rtlAlign : {}]}>{evaluation.summary}</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isRTL ? styles.rtlAlign : {}]}>{isRTL ? 'تفاصيل التقييم' : 'Evaluation Details'}</Text>
                    <View style={styles.table}>
                      <View style={[styles.tableHeader, isRTL ? styles.rtl : {}]} fixed>
                            <View style={[styles.tableColQuestion, styles.colHeader, isRTL ? styles.borderLeft : styles.borderRight]}><Text>{isRTL ? 'السؤال' : 'Question'}</Text></View>
                            <View style={[styles.tableColRating, styles.colHeader, isRTL ? styles.borderLeft : styles.borderRight]}><Text>{isRTL ? 'التقييم' : 'Rating'}</Text></View>
                            <View style={[styles.tableColNotes, styles.colHeader]}><Text>{isRTL ? 'الملاحظات' : 'Notes'}</Text></View>
                        </View>
                      {details.map((detail) => (
                            <View key={detail.id} style={[styles.tableRow, isRTL ? styles.rtl : {}]} wrap={false}>
                                <View style={[styles.tableColQuestion, styles.cell, isRTL ? styles.borderLeft : styles.borderRight, isRTL ? styles.rtlAlign : {}]}>
                                    <Text>{isRTL ? detail.security_questions?.question_text_ar : detail.security_questions?.question_text_en || ''}</Text>
                                </View>
                                <View style={[styles.tableColRating, styles.cell, isRTL ? styles.borderLeft : styles.borderRight]}>
                                    <Text>{`${detail.selected_rating} / 5 (${getRatingDescription(detail.selected_rating)})`}</Text>
                                </View>
                                <View style={[styles.tableColNotes, styles.cell, isRTL ? styles.rtlAlign : {}]}>
                                    <Text>{detail.note || (isRTL ? 'لا يوجد' : 'N/A')}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.signatureSection} fixed>
                  <View style={[isRTL ? {flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%'} : {flexDirection: 'row', justifyContent: 'space-between', width: '100%'}]}>
                      <View style={styles.signatureBlock}><Text>{isRTL ? 'تم التقييم بواسطة' : 'Evaluated By'}</Text><Text>{evaluatorName || 'N/A'}</Text><Text>{jobTitle || 'N/A'}</Text><View style={styles.signaturePlaceholder}></View><Text>{isRTL ? 'التوقيع' : 'Signature'}</Text></View>
                      <View style={styles.signatureBlock}><Text>{isRTL ? 'الختم الرسمي' : 'Official Stamp'}</Text><View style={{...styles.signaturePlaceholder, height: 60}}></View></View>
                  </View>
                </View>
                
                <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`${isRTL ? 'تاريخ الطباعة' : 'Generated on'}: ${generationDate} | ${isRTL ? `صفحة ${pageNumber} من ${totalPages}` : `Page ${pageNumber} of ${totalPages}`}`)} fixed />
            </Page>
        </Document>
    );
};