// src/hooks/useAccessManager.ts
import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useDialog } from '../components/contexts/DialogContext';
import {
    UnifiedScope,
    FlexibleScope,
    DirectPermission,
    ResourceDefinition,
    DelegationScopePayload,
    JobDistribution,
    CloudFunctionResponse
} from '../types/permissions.types';

// ============================================================================
// Re-export types for backward compatibility
// ============================================================================

/** @deprecated استخدم UnifiedScope بدلاً منه */
export type ScopeDefinition = FlexibleScope;

/** @deprecated استخدم DelegationScopePayload بدلاً منه */
export type ScopePayload = DelegationScopePayload;

/** @deprecated استخدم ResourceDefinition بدلاً منه */
export type ResourcePayload = ResourceDefinition;

/** @deprecated استخدم DirectPermission بدلاً منه */
export type JobPermissionInput = DirectPermission;

/** @deprecated استخدم JobDistribution بدلاً منه */
export type JobDistributionPayload = JobDistribution;

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
    // ✅ يدعم إرسال النطاق مع كل صلاحية (company + department فقط)
    const updateJobPermissions = useCallback(async (
        targetJobId: string,
        permissionsToAdd: DirectPermission[],
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
    // ✅ يدعم scope موحد (company + department فقط)
    const updateJobAccessResources = useCallback(async (
        targetJobId: string,
        resourceData: ResourceDefinition,
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
    // ✅ النطاق الموحد: company + department فقط
    const updateJobAccessScope = useCallback(async (
        targetJobId: string,
        scopeData: DelegationScopePayload,
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
    // ✅ يدعم scope موحد (company + department فقط)
    const updateUserAccessResources = useCallback(async (
        targetUserId: string,
        resourceData: ResourceDefinition,
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
    // ✅ النطاق الموحد: company + department فقط
    const updateUserAccessScope = useCallback(async (
        targetUserId: string,
        scopeData: DelegationScopePayload,
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
    // ✅ النطاق الموحد: company + department فقط
    const grantControlDelegation = useCallback(async (
        targetUserId: string,
        scopeToAdd: DelegationScopePayload
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
    // ✅ يدعم scope موحد (company + department فقط)
    const updateJobControlResources = useCallback(async (
        targetJobId: string,
        resourceData: ResourceDefinition,
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
    // ✅ النطاق الموحد: company + department فقط
    const updateJobControlScope = useCallback(async (
        targetJobId: string,
        scopeData: DelegationScopePayload,
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
    // ✅ يدعم scope موحد (company + department فقط)
    const updateUserControlResources = useCallback(async (
        targetUserId: string,
        resourceData: ResourceDefinition,
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
    // ✅ النطاق الموحد: company + department فقط
    const updateUserControlScope = useCallback(async (
        targetUserId: string,
        scopeData: DelegationScopePayload,
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
    // ✅ تم التحديث: company + department فقط (بدون sector, section)

    const manageJobDistribution = useCallback(async (
        action: 'add' | 'delete',
        payload: Partial<JobDistribution> | undefined,
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