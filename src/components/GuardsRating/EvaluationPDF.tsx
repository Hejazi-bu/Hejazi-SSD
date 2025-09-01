import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// --- 1. Register the Sakkal Majalla font ---
// We are now pointing to the new majalla.ttf and majallab.ttf files.
Font.register({
  family: 'Sakkal Majalla',
  fonts: [
    { src: '/fonts/majalla.ttf' },
    { src: '/fonts/majallab.ttf', fontWeight: 'bold' },
  ]
});

// --- Styles ---
const styles = StyleSheet.create({
  page: {
    paddingTop: 35,
    paddingBottom: 65,
    paddingHorizontal: 35,
    // --- 2. Update the font family name in the styles ---
    fontFamily: 'Sakkal Majalla', 
    fontSize: 10,
    color: '#333',
  },
  header: {
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
    color: 'grey',
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 10,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'grey',
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    // --- And here as well ---
    fontFamily: 'Sakkal Majalla',
    fontWeight: 'bold',
    marginBottom: 15,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    padding: 5,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 5,
  },
  detailLabel: {
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    border: '1px solid #e0e0e0',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottom: '1px solid #999',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e0e0e0',
  },
  colHeader: {
    padding: 6,
    fontWeight: 'bold',
    fontSize: 11,
  },
  tableColQuestion: {
    width: '50%',
    borderRight: '1px solid #e0e0e0',
  },
  tableColRating: {
    width: '20%',
    borderRight: '1px solid #e0e0e0',
    textAlign: 'center',
  },
  tableColNotes: {
    width: '30%',
  },
  cell: {
    padding: 6,
  },
  rtlDirection: {
    direction: 'rtl',
  },
  rtlAlign: {
    textAlign: 'right',
  }
});

// --- Types (No changes here) ---
type Evaluation = {
    id: string;
    evaluation_date: string;
    overall_score: number;
    companies: { name_ar: string; name_en: string; } | null;
};
type EvaluationDetail = {
    selected_rating: number;
    note: string | null;
    security_questions: { question_text_ar: string; question_text_en: string; } | null;
};
interface EvaluationPDFProps {
    evaluation: Evaluation;
    details: EvaluationDetail[];
    language: 'ar' | 'en';
}

// --- PDF Document Component (No changes to logic) ---
export const EvaluationPDF: React.FC<EvaluationPDFProps> = ({ evaluation, details, language }) => {
    const isRTL = language === 'ar';
    const companyName = isRTL ? evaluation.companies?.name_ar : evaluation.companies?.name_en;
    const scorePercentage = (evaluation.overall_score * 20).toFixed(0);
    const evaluationDate = new Date(evaluation.evaluation_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US');
    const generationDate = new Date().toLocaleString(isRTL ? 'ar-EG' : 'en-US');
    const rtlStyles = isRTL ? [styles.rtlDirection, styles.rtlAlign] : [];

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.header} fixed>
                    {isRTL ? 'وثيقة رسمية - بلدية مدينة أبوظبي' : 'Official Document - Abu Dhabi City Municipality'}
                </Text>

                <Text style={[styles.title, ...rtlStyles]}>
                    {isRTL ? 'تقرير تقييم أمني' : 'Security Evaluation Report'}
                </Text>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, ...rtlStyles]}>{isRTL ? 'معلومات التقييم' : 'Evaluation Information'}</Text>
                    <View style={isRTL ? { ...styles.detailRow, flexDirection: 'row-reverse' } : styles.detailRow}>
                        <Text style={styles.detailLabel}>{isRTL ? 'اسم الشركة' : 'Company Name'}:</Text>
                        <Text>{companyName}</Text>
                    </View>
                    <View style={isRTL ? { ...styles.detailRow, flexDirection: 'row-reverse' } : styles.detailRow}>
                         <Text style={styles.detailLabel}>{isRTL ? 'تاريخ التقييم' : 'Evaluation Date'}:</Text>
                         <Text>{evaluationDate}</Text>
                    </View>
                    <View style={isRTL ? { ...styles.detailRow, flexDirection: 'row-reverse' } : styles.detailRow}>
                         <Text style={styles.detailLabel}>{isRTL ? 'النتيجة النهائية' : 'Final Score'}:</Text>
                         <Text>{scorePercentage}%</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, ...rtlStyles]}>{isRTL ? 'تفاصيل التقييم' : 'Evaluation Details'}</Text>
                    <View style={styles.table}>
                        <View style={[styles.tableHeader, isRTL ? styles.rtlDirection : {}]} fixed>
                            <View style={[styles.tableColQuestion, styles.colHeader]}><Text>{isRTL ? 'السؤال' : 'Question'}</Text></View>
                            <View style={[styles.tableColRating, styles.colHeader]}><Text>{isRTL ? 'التقييم' : 'Rating'}</Text></View>
                            <View style={[styles.tableColNotes, styles.colHeader]}><Text>{isRTL ? 'الملاحظات' : 'Notes'}</Text></View>
                        </View>
                        {details.map((detail, index) => {
                            const questionText = isRTL ? detail.security_questions?.question_text_ar : detail.security_questions?.question_text_en;
                            return (
                                <View key={index} style={[styles.tableRow, isRTL ? styles.rtlDirection : {}]} wrap={false}>
                                    <View style={[styles.tableColQuestion, styles.cell, isRTL ? styles.rtlAlign : {}]}><Text>{questionText || ''}</Text></View>
                                    <View style={[styles.tableColRating, styles.cell]}><Text>{detail.selected_rating} / 5</Text></View>
                                    <View style={[styles.tableColNotes, styles.cell, isRTL ? styles.rtlAlign : {}]}><Text>{detail.note || (isRTL ? 'لا يوجد' : 'N/A')}</Text></View>
                                </View>
                            );
                        })}
                    </View>
                </View>
                
                <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
                    `${isRTL ? 'تاريخ الطباعة' : 'Generated on'}: ${generationDate} | ${isRTL ? `صفحة ${pageNumber} من ${totalPages}` : `Page ${pageNumber} / ${totalPages}`}`
                )} fixed />
            </Page>
        </Document>
    );
};