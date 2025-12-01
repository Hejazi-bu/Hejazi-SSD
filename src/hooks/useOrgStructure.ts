import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useDialog } from '../components/contexts/DialogContext';

interface OrgPayload {
    type: 'sector' | 'department' | 'section';
    action: 'create' | 'update' | 'delete' | 'move';
    docId?: string;
    name_ar?: string;
    name_en?: string;
    manager_id?: string;
    parent_id?: string;
    new_parent_id?: string;
}

export const useOrgStructure = () => {
    const functions = getFunctions();
    const { showDialog } = useDialog();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const manageOrg = useCallback(async (payload: OrgPayload) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageOrgStructure');
            const result = await fn(payload);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = result.data as any;
            
            if (data.success) {
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Org Structure Error:", error);
            showDialog({ 
                title: 'خطأ في الهيكل الإداري', 
                message: error.message || 'حدث خطأ غير متوقع', 
                variant: 'error' 
            });
            return false;
        } finally {
            setIsSubmitting(false);
        }
    }, [functions, showDialog]);

    return { manageOrg, isSubmitting };
};