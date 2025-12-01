import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';

// --- Fonts Registration ---
Font.register({
  family: 'Amiri',
  fonts: [
    { src: '/fonts/Amiri-Regular.ttf' },
    { src: '/fonts/Amiri-Bold.ttf', fontWeight: 'bold' },
  ]
});

// --- Colors ---
const colors = {
    primary: '#0D2D50',
    secondary: '#4A4A4A',
    accent: '#B89E48',
    text: '#1F1F1F',
    background: '#F4F6F8',
    border: '#E1E5E8',
};

// --- Styles (Final Compact Version) ---
const styles = StyleSheet.create({
    page: {
        fontFamily: 'Amiri',
        fontSize: 11,
        paddingTop: 35,
        paddingBottom: 65,
        paddingHorizontal: 40,
        color: colors.text,
        // ✅ تقليل ارتفاع السطر العام لتوفير مساحة كبيرة
        lineHeight: 1.4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottom: `2px solid ${colors.accent}`,
        paddingBottom: 10, 
        marginBottom: 20, // تقليل المسافة
    },
    headerTitleContainer: {
        flexDirection: 'column',
        alignItems: 'center',
    },
    headerTitleEn: {
        fontSize: 20, 
        fontWeight: 'bold',
        color: colors.primary,
        fontFamily: 'Helvetica-Bold',
    },
    headerTitleAr: {
        fontSize: 18, 
        color: colors.primary,
        marginTop: 5,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 9,
        color: colors.secondary,
        borderTop: `1px solid ${colors.border}`,
        paddingTop: 8,
        fontFamily: 'Helvetica',
    },
    section: {
        // ✅ تقليل المسافة بين الأقسام
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.primary,
        backgroundColor: colors.background,
        borderBottom: `2px solid ${colors.accent}`,
        paddingVertical: 5, // تقليل الحشوة
        paddingHorizontal: 10,
        marginBottom: 8, // تقليل المسافة
        textAlign: 'center',
    },
    twoColumnLayout: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 20,
    },
    column: {
        flex: 1,
    },
    bilingualField: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottom: `1px solid ${colors.border}`,
        // ✅ تقليل الحشوة العمودية
        paddingVertical: 4,
    },
    bilingualLabelLeft: {
        flex: 1.2,
        textAlign: 'left',
        fontSize: 10,
        color: colors.secondary,
        fontFamily: 'Helvetica',
        paddingTop: 2, 
    },
    bilingualLabelRight: {
        flex: 1,
        textAlign: 'right',
        fontSize: 11,
        color: colors.secondary,
    },
    bilingualValueCenter: {
        flex: 1.5,
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 11, 
    },
    companyNameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline', 
        borderBottom: `1px solid ${colors.border}`,
        paddingVertical: 5, // تقليل الحشوة
    },
    companyNameItem: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    companyNameValue: {
        fontWeight: 'bold',
        fontSize: 11,
    },
    mergedScoreRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${colors.border}`,
        paddingVertical: 5, // تقليل الحشوة
    },
    ratingText: {
        flex: 1,
        fontSize: 11,
        fontWeight: 'bold',
        color: colors.primary,
    },
    scoreText: {
        flex: 1,
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 11,
    },
    questionBlock: {
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        // ✅ تقليص الحشوة الداخلية والهامش السفلي
        padding: 8,
        marginBottom: 6,
    },
    questionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3, // تقليل الحشوة
    },
    questionText: {
        flex: 1,
        fontSize: 10,
        fontFamily: 'Helvetica',
        color: colors.secondary,
    },
    itemRatingText: {
        flex: 1,
        fontSize: 10, 
        fontWeight: 'bold',
        color: colors.primary,
    },
    itemScoreText: {
        flex: 1,
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 10,
    },
    notesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 5,
        marginTop: 3,
        borderTop: `1px dotted ${colors.border}`,
    },
    noteText: {
        flex: 1,
        fontSize: 10,
        color: colors.secondary,
    },
    approvalsContainer: {
        marginTop: 15, // هامش علوي بسيط يفصله عن آخر بند
    },
    signatoryBlock: {
        marginBottom: 10,
    },
    signatorySectionTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: colors.primary,
        borderBottom: `1px solid ${colors.border}`,
        paddingBottom: 4,
        marginBottom: 8,
        textAlign: 'center',
    },
    signatoryContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
    },
    signatoryTextColumn: {
        flex: 1.5,
        flexDirection: 'column',
    },
    signatoryImageColumn: {
        flex: 1,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    signatureImage: {
        maxWidth: 120,
        maxHeight: 50,
        objectFit: 'contain',
    },
    sealImage: {
        position: 'absolute',
        width: 60,
        height: 60,
        objectFit: 'contain',
        opacity: 0.7,
    },
    signatoryNameEn: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 11,
        color: colors.primary,
        textAlign: 'left',
    },
    signatoryJobEn: {
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: colors.secondary,
        textAlign: 'left',
        marginTop: 2,
    },
    signatoryNameAr: {
        fontSize: 11,
        fontWeight: 'bold',
        color: colors.primary,
        textAlign: 'right',
    },
    signatoryJobAr: {
        fontSize: 9,
        color: colors.secondary,
        textAlign: 'right',
        marginTop: 2,
    },
});

// --- Type Definitions ---
interface Signatory {
    name_en?: string;
    name_ar?: string;
    job_title_en?: string;
    job_title_ar?: string;
    signature_url?: string | null;
    seal_url?: string | null;
}

interface EvaluationPDFProps {
    evaluation: any;
    latestVersion: any;
    companyNameEn?: string;
    companyNameAr?: string;
    creator: Signatory | null;
    approver: Signatory | null;
}

// --- Reusable Components ---
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
    </View>
);

const SignatorySection: React.FC<{ title: string; signatory: Signatory | null }> = ({ title, signatory }) => {
    const cleanUrl = (url: string | null | undefined): string | null => {
        if (!url) return null;
        return url.split('?')[0];
    };
    const signatureUrl = cleanUrl(signatory?.signature_url);
    const sealUrl = cleanUrl(signatory?.seal_url);

    return (
        <View style={styles.signatoryBlock}>
            <Text style={styles.signatorySectionTitle}>{title}</Text>
            <View style={styles.signatoryContent}>
                <View style={styles.signatoryTextColumn}>
                    <Text style={styles.signatoryNameEn}>{signatory?.name_en || ' '}</Text>
                    <Text style={styles.signatoryJobEn}>{signatory?.job_title_en || ' '}</Text>
                </View>
                <View style={styles.signatoryImageColumn}>
                    {sealUrl && <Image style={styles.sealImage} src={{ uri: sealUrl, method: 'GET', headers: {} }} />}
                    {signatureUrl && <Image style={styles.signatureImage} src={{ uri: signatureUrl, method: 'GET', headers: {} }} />}
                </View>
                <View style={styles.signatoryTextColumn}>
                    <Text style={styles.signatoryNameAr}>{signatory?.name_ar || ' '}</Text>
                    <Text style={styles.signatoryJobAr}>{signatory?.job_title_ar || ' '}</Text>
                </View>
            </View>
        </View>
    );
};

const BilingualField = ({ labelEn, labelAr, value }: { labelEn: string, labelAr: string, value?: string | number | null }) => (
    <View style={styles.bilingualField}>
        <Text style={styles.bilingualLabelLeft}>{labelEn}:</Text>
        <Text style={styles.bilingualValueCenter}>
            {value !== null && value !== undefined ? String(value) : 'N/A'}
        </Text>
        <Text style={styles.bilingualLabelRight}>:{labelAr}</Text>
    </View>
);

const getRatingDescription = (score: number) => {
    const descriptions = {
      en: ["Need Improvement", "Acceptable", "Good", "Very Good", "Excellent"],
      ar: ["تحتاج إلى تحسين", "مقبول", "جيد", "جيد جدا", "ممتاز"],
    };
    if (score < 1.5) return { en: descriptions.en[0], ar: descriptions.ar[0] };
    if (score < 2.5) return { en: descriptions.en[1], ar: descriptions.ar[1] };
    if (score < 3.5) return { en: descriptions.en[2], ar: descriptions.ar[2] };
    if (score < 4.5) return { en: descriptions.en[3], ar: descriptions.ar[3] };
    return { en: descriptions.en[4], ar: descriptions.ar[4] };
};

// --- Main PDF Document Component ---
const EvaluationPDF: React.FC<EvaluationPDFProps> = ({ evaluation, latestVersion, companyNameEn, companyNameAr, creator, approver }) => {
    
    const evaluationDate = latestVersion ? new Date(latestVersion.evaluation_year, latestVersion.evaluation_month - 1) : null;
    const formattedDate = evaluationDate ? `${evaluationDate.toLocaleString('en-US', { month: 'long' })} ${latestVersion.evaluation_year}` : 'N/A';
    const ratingDescription = latestVersion ? getRatingDescription(latestVersion.overall_score) : null;

    return (
        <Document author="Hejazi Logic" title={`Evaluation Report #${evaluation?.sequence_number}`}>
            <Page size="A4" style={styles.page}>
                <View style={styles.header} fixed>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitleEn}>Security Services Evaluation Report</Text>
                        <Text style={styles.headerTitleAr}>تقرير تقييم الخدمات الأمنية</Text>
                    </View>
                </View>
                
                <View>
                    <View style={{ marginBottom: 15 }}>
                        <View style={styles.companyNameRow}>
                            <View style={styles.companyNameItem}>
                                <Text style={{fontSize: 10, color: colors.secondary, fontFamily: 'Helvetica', paddingTop: 2}}>Company Name:</Text>
                                <Text style={styles.companyNameValue}>{companyNameEn || 'N/A'}</Text>
                            </View>
                            <View style={[styles.companyNameItem, { justifyContent: 'flex-end' }]}>
                                <Text style={[styles.companyNameValue, { textAlign: 'right' }]}>{companyNameAr || 'N/A'}</Text>
                                <Text style={{fontSize: 11, color: colors.secondary}}>:اسم الشركة</Text>
                            </View>
                        </View>
                        <View style={styles.twoColumnLayout}>
                            <View style={styles.column}>
                                <BilingualField labelEn="Contract No." labelAr="رقم العقد" value={evaluation?.historical_contract_no} />
                                <BilingualField labelEn="Guards Count" labelAr="عدد الحراس" value={evaluation?.historical_guard_count} />
                            </View>
                            <View style={styles.column}>
                                <BilingualField labelEn="Month / Year" labelAr="الشهر / السنة" value={formattedDate} />
                                <BilingualField labelEn="Violations Count" labelAr="عدد المخالفات" value={evaluation?.historical_violations_count} />
                            </View>
                        </View>
                    </View>

                    <Section title="Evaluation Result / نتيجة التقييم">
                            {latestVersion && ratingDescription ? (
                                <View style={styles.mergedScoreRow}>
                                    <Text style={[styles.ratingText, { textAlign: 'left' }]}>{`${ratingDescription.en}`}</Text>
                                    <Text style={styles.scoreText}>{`${latestVersion.overall_score.toFixed(2)} / 5.00`}</Text>
                                    <Text style={[styles.ratingText, { textAlign: 'right' }]}>{`${ratingDescription.ar}`}</Text>
                                </View>
                            ) : (
                                <BilingualField labelEn="Overall Score" labelAr="النتيجة الإجمالية" value={'N/A'} />
                            )}
                            <BilingualField labelEn="General Summary" labelAr="الملخص العام" value={latestVersion?.summary || '—'} />
                    </Section>

                    <Section title="Evaluation Items / تفاصيل البنود">
                        {(latestVersion?.details || []).map((detail: any, index: number) => (
                            <View key={detail.question_id || index} style={styles.questionBlock} wrap={false}>
                                <View style={[styles.questionRow, { borderBottom: `1px solid ${colors.border}`, paddingBottom: 4 }]}>
                                    <Text style={[styles.questionText, { textAlign: 'left', paddingTop: 2 }]}>{detail.question_text_en}</Text>
                                    <Text style={[styles.questionText, { textAlign: 'right', fontFamily: 'Amiri', fontSize: 11 }]}>{detail.question_text_ar}</Text>
                                </View>
                                <View style={[styles.questionRow, { paddingTop: 4 }]}>
                                    <Text style={[styles.itemRatingText, { textAlign: 'left' }]}>{getRatingDescription(detail.rating || 0).en}</Text>
                                    <Text style={styles.itemScoreText}>{`${detail.rating || 0} / 5`}</Text>
                                    <Text style={[styles.itemRatingText, { textAlign: 'right' }]}>{getRatingDescription(detail.rating || 0).ar}</Text>
                                </View>
                                {detail.note ? (
                                    <View style={styles.notesRow}>
                                        <Text style={[styles.noteText, { textAlign: 'left', fontFamily: 'Helvetica' }]}>{`Note: ${detail.note}`}</Text>
                                        <Text style={[styles.noteText, { textAlign: 'right' }]}>{`ملاحظة: ${detail.note_ar || detail.note}`}</Text>
                                    </View>
                                ) : null}
                            </View>
                        ))}
                    </Section>
                </View>
                
                <View style={styles.approvalsContainer} wrap={false}>
                    <SignatorySection title="Prepared by / تم الإعداد بواسطة" signatory={creator} />
                    <SignatorySection title="Approved by / تم الاعتماد بواسطة" signatory={approver} />
                </View>
                
                <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages} | Abu Dhabi City Municipality`)} />
            </Page>
        </Document>
    )
};

export default EvaluationPDF;