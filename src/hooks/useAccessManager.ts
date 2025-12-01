// src/hooks/useAccessManager.ts
import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useDialog } from '../components/contexts/DialogContext';

// ============================================================================
// 1. Interfaces & Types (Updated for "Option 2" Granularity)
// ============================================================================

interface CloudFunctionResponse {
    success: boolean;
    message?: string;
}

// 1. واجهة النطاق (Scope Definition)
// تستخدم داخل الصلاحيات والموارد لتحديد "أين" تطبق القاعدة
// ✅ تم التوحيد: فقط الشركة والقسم
export interface ScopeDefinition {
    companies?: string[];    // مصفوفة معرفات الشركات
    sections?: string[];     // مصفوفة معرفات الأقسام
}

// 2. واجهة النطاق العام (Scope Payload for Delegation Scopes)
// تستخدم عند تحديد "من" يمكنه التحكم فيهم (Users/Jobs)
// ✅ تم التوحيد: فقط الشركة والقسم
export interface ScopePayload {
    target_company_id?: string | null;
    target_job_id?: string | null;
    target_user_id?: string | null;

    // النطاق الممنوح (الشركة والقسم فقط)
    scope_company_id?: string | null;
    scope_section_id?: string | null;

    restricted_to_company?: boolean;
    [key: string]: unknown;
}

// 3. واجهة الموارد (Resources Payload)
// ✅ تم التحديث: أضفنا "scope" هنا لدعم الخيار الثاني في أنظمة التفويض (Access/Control)
// مثال: تفويض "خدمة الحضور" (resource) مقيدة بـ "فرع الشمال" (scope)
export interface ResourcePayload {
    service_id?: string;
    sub_service_id?: string;
    sub_sub_service_id?: string;
    scope?: ScopeDefinition; // 🔥 الإضافة الجديدة لدعم النطاق لكل مورد
}

// 4. واجهة مدخلات صلاحيات الوظيفة (Direct Job Permissions)
// ✅ تدعم الخيار الثاني: صلاحية + نطاق
export interface JobPermissionInput {
    id: string; 
    is_allowed: boolean; 
    scope?: ScopeDefinition; // 🔥 النطاق الخاص بهذه الصلاحية
}

// 5. واجهة هيكل الوظيفة (Job Distribution)
export interface JobDistributionPayload {
    job_id: string;
    company_id: string;
    sector_id?: string | null;
    department_id?: string | null;
    section_id?: string | null;
}

// ============================================================================
// 2. The Hook
// ============================================================================

export const useAccessManager = () => {
    const functions = getFunctions();
    const { showDialog } = useDialog();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleError = (error: unknown, title: string) => {
        console.error(`${title}:`, error);
        let message = "حدث خطأ غير متوقع.";
        if (error instanceof Error) {
            message = error.message;
        }
        message = message.replace('INTERNAL', '').trim();
        showDialog({ title, message, variant: 'error' });
        return false;
    };

    // ========================================================================
    // A. النظام الأول: الصلاحيات المباشرة (Direct Permissions)
    // ========================================================================

    // 1. إدارة صلاحيات المستخدمين (User Permissions - Exceptions)
    const updateUserPermissions = useCallback(async (
        targetUserId: string, 
        permissions: { id: string, state: boolean }[] // (ملاحظة: الاستثناءات الشخصية غالباً لا تحتاج نطاق لأنها للشخص، لكن يمكن إضافتها مستقبلاً)
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageUserPermissionsSecure');
            const result = await fn({ targetUserId, permissions });
            const data = result.data as CloudFunctionResponse;
            return data.success;
        } catch (error) {
            return handleError(error, 'خطأ في تحديث استثناءات المستخدم');
        } finally {
            setIsSubmitting(false);
        }
    }, [functions, showDialog]);

    // 2. إدارة صلاحيات الوظائف (Job Permissions)
    // ✅ يدعم إرسال النطاق مع كل صلاحية
    const updateJobPermissions = useCallback(async (
        targetJobId: string,
        permissionsToAdd: JobPermissionInput[],
        permissionsToRemove: string[]
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageJobPermissions');
            const result = await fn({ 
                p_job_id: targetJobId, 
                p_permissions_to_add: permissionsToAdd,
                p_permissions_to_remove: permissionsToRemove
            });
            const data = result.data as CloudFunctionResponse;
            return data.success;
        } catch (error) {
            return handleError(error, 'خطأ في تحديث صلاحيات الوظيفة');
        } finally {
            setIsSubmitting(false);
        }
    }, [functions, showDialog]);


    // ========================================================================
    // B. النظام الثاني: تفويض الوصول (Access Delegation)
    // ========================================================================

    // 3. موارد الوظائف (Job Access Resources)
    // ✅ الآن resourceData يمكن أن يحتوي على scope
    const updateJobAccessResources = useCallback(async (
        targetJobId: string, 
        resourceData: ResourcePayload,
        action: 'add' | 'remove',
        docId?: string
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageJobAccessResourcesSecure');
            const result = await fn({ targetJobId, resourceData, action, docId });
            return (result.data as CloudFunctionResponse).success;
        } catch (error) { return handleError(error, 'خطأ في موارد الوظيفة (وصول)'); } 
        finally { setIsSubmitting(false); }
    }, [functions]);

    // 4. نطاق الوظائف (Job Access Scope - WHO)
    const updateJobAccessScope = useCallback(async (
        targetJobId: string,
        scopeData: ScopePayload,
        action: 'add' | 'remove',
        docId?: string
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageJobAccessScopeSecure');
            const result = await fn({ targetJobId, scopeData, action, docId });
            return (result.data as CloudFunctionResponse).success;
        } catch (error) { return handleError(error, 'خطأ في نطاق الوظيفة (وصول)'); } 
        finally { setIsSubmitting(false); }
    }, [functions]);

    // 5. موارد المستخدمين (User Access Resources)
    const updateUserAccessResources = useCallback(async (
        targetUserId: string,
        resourceData: ResourcePayload,
        action: 'add' | 'remove',
        docId?: string
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageUserAccessResourcesSecure');
            const result = await fn({ targetUserId, resourceData, action, docId });
            return (result.data as CloudFunctionResponse).success;
        } catch (error) { return handleError(error, 'خطأ في موارد المستخدم (وصول)'); } 
        finally { setIsSubmitting(false); }
    }, [functions]);

    // 6. نطاق المستخدمين (User Access Scope - WHO)
    const updateUserAccessScope = useCallback(async (
        targetUserId: string,
        scopeData: ScopePayload,
        action: 'add' | 'remove',
        docId?: string
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageUserAccessScopeSecure');
            const result = await fn({ targetUserId, scopeData, action, docId });
            return (result.data as CloudFunctionResponse).success;
        } catch (error) { return handleError(error, 'خطأ في نطاق المستخدم (وصول)'); } 
        finally { setIsSubmitting(false); }
    }, [functions]);


    // ========================================================================
    // C. النظام الثالث: تفويض التحكم (Control Delegation)
    // ========================================================================

    // 7. منح تفويض التحكم المباشر
    const grantControlDelegation = useCallback(async (
        targetUserId: string,
        scopeToAdd: ScopePayload
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageControlDelegationSecure');
            const result = await fn({ targetUserId, scopeToAdd });
            const data = result.data as CloudFunctionResponse;
            if (data.success) {
                showDialog({ title: 'تم بنجاح', message: 'تم منح صلاحية التحكم.', variant: 'success' });
                return true;
            }
            return false;
        } catch (error) { return handleError(error, 'فشل تفويض التحكم'); } 
        finally { setIsSubmitting(false); }
    }, [functions, showDialog]);

    // 8. موارد التحكم للوظائف (Job Control Resources)
    // ✅ يدعم النطاق لكل مورد
    const updateJobControlResources = useCallback(async (
        targetJobId: string,
        resourceData: ResourcePayload,
        action: 'add' | 'remove',
        docId?: string
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageJobControlResourcesSecure');
            const result = await fn({ targetJobId, resourceData, action, docId });
            return (result.data as CloudFunctionResponse).success;
        } catch (error) { return handleError(error, 'خطأ في موارد التحكم للوظيفة'); } 
        finally { setIsSubmitting(false); }
    }, [functions]);

    // 9. نطاق التحكم للوظائف (Control Job Scopes)
    const updateJobControlScope = useCallback(async (
        targetJobId: string,
        scopeData: ScopePayload,
        action: 'add' | 'remove',
        docId?: string
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageJobControlScopeSecure'); // تأكد من وجود الدالة في الباك اند
            const result = await fn({ targetJobId, scopeData, action, docId });
            return (result.data as CloudFunctionResponse).success;
        } catch (error) { return handleError(error, 'خطأ في نطاق التحكم للوظيفة'); } 
        finally { setIsSubmitting(false); }
    }, [functions]);

    // 10. موارد التحكم للمستخدمين
    const updateUserControlResources = useCallback(async (
        targetUserId: string,
        resourceData: ResourcePayload,
        action: 'add' | 'remove',
        docId?: string
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageUserControlResourcesSecure');
            const result = await fn({ targetUserId, resourceData, action, docId });
            return (result.data as CloudFunctionResponse).success;
        } catch (error) { return handleError(error, 'خطأ في موارد التحكم للمستخدم'); } 
        finally { setIsSubmitting(false); }
    }, [functions]);

    // 11. نطاق التحكم للمستخدمين
    const updateUserControlScope = useCallback(async (
        targetUserId: string,
        scopeData: ScopePayload,
        action: 'add' | 'remove',
        docId?: string
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageUserControlScopeSecure'); // تأكد من وجود الدالة
            const result = await fn({ targetUserId, scopeData, action, docId });
            return (result.data as CloudFunctionResponse).success;
        } catch (error) { return handleError(error, 'خطأ في نطاق التحكم للمستخدم'); } 
        finally { setIsSubmitting(false); }
    }, [functions]);

    // ========================================================================
    // D. إدارة الهيكل (Job Distribution)
    // ========================================================================
    
    const manageJobDistribution = useCallback(async (
        action: 'add' | 'delete',
        payload: Partial<JobDistributionPayload> | undefined, 
        docId?: string
    ) => {
        setIsSubmitting(true);
        try {
            const fn = httpsCallable(functions, 'manageJobDistribution');
            const finalPayload = payload || {}; 
            const result = await fn({ action, payload: finalPayload, docId });
            const data = result.data as CloudFunctionResponse;
            return data.success;
        } catch (error) { return handleError(error, 'خطأ في إدارة توزيع الوظيفة'); } 
        finally { setIsSubmitting(false); }
    }, [functions]);

    return { 
        isSubmitting,
        // System 1
        updateUserPermissions, 
        updateJobPermissions,
        // System 2
        updateJobAccessResources, 
        updateJobAccessScope,
        updateUserAccessResources,
        updateUserAccessScope,
        // System 3
        grantControlDelegation, 
        updateJobControlResources,
        updateJobControlScope,
        updateUserControlResources,
        updateUserControlScope,
        // Helper
        manageJobDistribution,
    };
};