import { DocumentData, Timestamp } from "firebase/firestore";

export interface Company extends DocumentData {
    id: string;
    name_ar: string;
    name_en?: string;
    contract_no: string;
    guard_count: number;
    violations_count: number;
}

export interface Evaluation extends DocumentData {
    id: string;
    company_id: string;
    evaluator_id: string;
    evaluation_year: number;
    evaluation_month: number;
    overall_score: number;
    created_at: Timestamp;
    summary: string;
    status: 'Awaiting Approval' | 'Approved' | 'Rejected' | 'Pending Revision';
}
export interface EvaluationDetails extends DocumentData {
    evaluation_id: string;
    question_id: string;
    selected_rating: number;
    note: string;
}
export interface QuestionDoc extends DocumentData {
    id: string;
    question_text_ar: string;
    question_text_en: string;
}
export interface EvaluationLog extends DocumentData {
    id: string;
    evaluation_id: string;
    user_id: string;
    action_type: 'Approved' | 'Rejected' | 'Pending Revision' | 'Initial Evaluation';
    notes?: string;
    created_at: Timestamp;
}

// 👈 هذه الدالة ليست جزءاً من الـ interfaces، لذا يجب أن تكون خارجها
export const formatNumberEn = (value: number | string, options?: Intl.NumberFormatOptions): string => {
    return new Intl.NumberFormat('en-US', { ...options, useGrouping: false }).format(Number(value));
};