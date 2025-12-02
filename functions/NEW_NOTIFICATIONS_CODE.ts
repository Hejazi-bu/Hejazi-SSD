// ============================================================================
// 📬 نظام الإشعارات اللحظية للصلاحيات
// ============================================================================
// هذا الملف يحتوي على الكود الجديد الذي يجب إضافته إلى index.ts
// ============================================================================

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const db = admin.firestore();

// ============================================================================
// دالة الإشعار الأساسية
// ============================================================================
// الموقع المقترح: بعد دالة updateUserDelegationCache في القسم 1
// ============================================================================

/**
 * دالة لإرسال إشعار للمستخدمين المتأثرين بتغيير الصلاحيات
 */
async function notifyPermissionChange(params: {
    affectedUserIds: string[],
    changeType: 'added' | 'removed' | 'modified',
    permissionType: 'direct' | 'access' | 'control',
    resourceKey?: string,
    jobId?: string,
    message_ar: string,
    message_en: string
}) {
    if (params.affectedUserIds.length === 0) {
        console.log('No users to notify');
        return;
    }

    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    console.log(`Preparing notifications for ${params.affectedUserIds.length} users`);

    for (const userId of params.affectedUserIds) {
        const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
        batch.set(notifRef, {
            type: 'permission_change',
            changeType: params.changeType,
            permissionType: params.permissionType,
            resourceKey: params.resourceKey,
            jobId: params.jobId,
            message_ar: params.message_ar,
            message_en: params.message_en,
            read: false,
            created_at: timestamp
        });

        // تحديث الكاش
        // ملاحظة: هذه دالة موجودة بالفعل في index.ts
        await updateUserDelegationCache(userId);
    }

    await batch.commit();
    console.log(`✅ Sent permission change notifications to ${params.affectedUserIds.length} users`);
}

// ============================================================================
// استخدام دالة الإشعار في manageJobPermissions
// ============================================================================
// أضف هذا الكود في نهاية دالة manageJobPermissions قبل return
// ============================================================================

/*
// بعد batch.commit() الناجح:

if (successfulChanges.length > 0) {
    // جلب المستخدمين المتأثرين
    const affectedUsers = await db.collection('users')
        .where('job_id', '==', targetJobId)
        .select('id')
        .get();

    const userIds = affectedUsers.docs.map(d => d.id);

    if (userIds.length > 0) {
        await notifyPermissionChange({
            affectedUserIds: userIds,
            changeType: 'modified',
            permissionType: 'direct',
            jobId: targetJobId,
            message_ar: `تم تعديل صلاحيات وظيفتك`,
            message_en: `Your job permissions have been modified`
        });
    }
}
*/

// ============================================================================
// Trigger 1: إشعار عند تغيير صلاحيات الوظيفة
// ============================================================================
// الموقع المقترح: في نهاية الملف قبل الأنظمة الأخرى
// ============================================================================

export const onJobPermissionChange = onDocumentWritten(
    "job_permissions/{docId}",
    async (event) => {
        try {
            const before = event.data?.before.data();
            const after = event.data?.after.data();

            // حالة الحذف
            if (!after) {
                console.log(`Job permission deleted: ${event.params.docId}`);
                return;
            }

            const jobId = after.job_id;
            if (!jobId) {
                console.log('No job_id found in permission document');
                return;
            }

            // جلب جميع المستخدمين في هذه الوظيفة
            const usersSnap = await db.collection('users')
                .where('job_id', '==', jobId)
                .get();

            const userIds = usersSnap.docs.map(d => d.id);

            if (userIds.length === 0) {
                console.log(`No users found for job_id: ${jobId}`);
                return;
            }

            // تحديد نوع التغيير
            const changeType = !before ? 'added' : 'modified';

            // تحديد المورد المتأثر
            let resourceKey: string | undefined;
            if (after.service_id) resourceKey = `s:${after.service_id}`;
            else if (after.sub_service_id) resourceKey = `ss:${after.sub_service_id}`;
            else if (after.sub_sub_service_id) resourceKey = `sss:${after.sub_sub_service_id}`;

            // إرسال الإشعارات
            await notifyPermissionChange({
                affectedUserIds: userIds,
                changeType,
                permissionType: 'direct',
                resourceKey,
                jobId: String(jobId),
                message_ar: `تم ${changeType === 'added' ? 'إضافة' : 'تعديل'} صلاحية في وظيفتك`,
                message_en: `A permission was ${changeType === 'added' ? 'added to' : 'modified in'} your job`
            });

            console.log(`✅ Job permission change notification sent for job_id: ${jobId}`);

        } catch (error) {
            console.error('Error in onJobPermissionChange:', error);
            // لا نرمي الخطأ لتجنب إعادة المحاولات غير الضرورية
        }
    }
);

// ============================================================================
// Trigger 2: إشعار عند تغيير نطاق الوصول
// ============================================================================

export const onAccessScopeChange = onDocumentWritten(
    "access_job_scopes/{docId}",
    async (event) => {
        try {
            const before = event.data?.before.data();
            const after = event.data?.after.data();

            if (!after) {
                console.log(`Access scope deleted: ${event.params.docId}`);
                return;
            }

            const jobId = after.job_id;
            if (!jobId) {
                console.log('No job_id found in access scope document');
                return;
            }

            const usersSnap = await db.collection('users')
                .where('job_id', '==', jobId)
                .get();

            const userIds = usersSnap.docs.map(d => d.id);

            if (userIds.length === 0) {
                console.log(`No users found for job_id: ${jobId}`);
                return;
            }

            const changeType = !before ? 'added' : 'modified';

            await notifyPermissionChange({
                affectedUserIds: userIds,
                changeType,
                permissionType: 'access',
                jobId: String(jobId),
                message_ar: `تم ${changeType === 'added' ? 'إضافة' : 'تعديل'} صلاحيات الوصول لوظيفتك`,
                message_en: `Access permissions for your job have been ${changeType === 'added' ? 'added' : 'modified'}`
            });

            console.log(`✅ Access scope change notification sent for job_id: ${jobId}`);

        } catch (error) {
            console.error('Error in onAccessScopeChange:', error);
        }
    }
);

// ============================================================================
// Trigger 3: إشعار عند تغيير نطاق التحكم
// ============================================================================

export const onControlScopeChange = onDocumentWritten(
    "control_job_scopes/{docId}",
    async (event) => {
        try {
            const before = event.data?.before.data();
            const after = event.data?.after.data();

            if (!after) {
                console.log(`Control scope deleted: ${event.params.docId}`);
                return;
            }

            const jobId = after.job_id;
            if (!jobId) {
                console.log('No job_id found in control scope document');
                return;
            }

            const usersSnap = await db.collection('users')
                .where('job_id', '==', jobId)
                .get();

            const userIds = usersSnap.docs.map(d => d.id);

            if (userIds.length === 0) {
                console.log(`No users found for job_id: ${jobId}`);
                return;
            }

            const changeType = !before ? 'added' : 'modified';

            await notifyPermissionChange({
                affectedUserIds: userIds,
                changeType,
                permissionType: 'control',
                jobId: String(jobId),
                message_ar: `تم ${changeType === 'added' ? 'إضافة' : 'تعديل'} صلاحيات التحكم لوظيفتك`,
                message_en: `Control permissions for your job have been ${changeType === 'added' ? 'added' : 'modified'}`
            });

            console.log(`✅ Control scope change notification sent for job_id: ${jobId}`);

        } catch (error) {
            console.error('Error in onControlScopeChange:', error);
        }
    }
);

// ============================================================================
// Trigger 4: إشعار عند تغيير موارد الوصول
// ============================================================================

export const onAccessResourceChange = onDocumentWritten(
    "access_job_resources/{docId}",
    async (event) => {
        try {
            const before = event.data?.before.data();
            const after = event.data?.after.data();

            if (!after) return;

            const jobId = after.job_id;
            if (!jobId) return;

            const usersSnap = await db.collection('users')
                .where('job_id', '==', jobId)
                .get();

            const userIds = usersSnap.docs.map(d => d.id);
            if (userIds.length === 0) return;

            const changeType = !before ? 'added' : 'modified';

            let resourceKey: string | undefined;
            if (after.service_id) resourceKey = `s:${after.service_id}`;
            else if (after.sub_service_id) resourceKey = `ss:${after.sub_service_id}`;
            else if (after.sub_sub_service_id) resourceKey = `sss:${after.sub_sub_service_id}`;

            await notifyPermissionChange({
                affectedUserIds: userIds,
                changeType,
                permissionType: 'access',
                resourceKey,
                jobId: String(jobId),
                message_ar: `تم ${changeType === 'added' ? 'إضافة' : 'تعديل'} موارد الوصول لوظيفتك`,
                message_en: `Access resources for your job have been ${changeType === 'added' ? 'added' : 'modified'}`
            });

            console.log(`✅ Access resource change notification sent for job_id: ${jobId}`);

        } catch (error) {
            console.error('Error in onAccessResourceChange:', error);
        }
    }
);

// ============================================================================
// Trigger 5: إشعار عند تغيير موارد التحكم
// ============================================================================

export const onControlResourceChange = onDocumentWritten(
    "control_job_resources/{docId}",
    async (event) => {
        try {
            const before = event.data?.before.data();
            const after = event.data?.after.data();

            if (!after) return;

            const jobId = after.job_id;
            if (!jobId) return;

            const usersSnap = await db.collection('users')
                .where('job_id', '==', jobId)
                .get();

            const userIds = usersSnap.docs.map(d => d.id);
            if (userIds.length === 0) return;

            const changeType = !before ? 'added' : 'modified';

            let resourceKey: string | undefined;
            if (after.service_id) resourceKey = `s:${after.service_id}`;
            else if (after.sub_service_id) resourceKey = `ss:${after.sub_service_id}`;
            else if (after.sub_sub_service_id) resourceKey = `sss:${after.sub_sub_service_id}`;

            await notifyPermissionChange({
                affectedUserIds: userIds,
                changeType,
                permissionType: 'control',
                resourceKey,
                jobId: String(jobId),
                message_ar: `تم ${changeType === 'added' ? 'إضافة' : 'تعديل'} موارد التحكم لوظيفتك`,
                message_en: `Control resources for your job have been ${changeType === 'added' ? 'added' : 'modified'}`
            });

            console.log(`✅ Control resource change notification sent for job_id: ${jobId}`);

        } catch (error) {
            console.error('Error in onControlResourceChange:', error);
        }
    }
);

// ============================================================================
// ملاحظات التطبيق:
// ============================================================================
// 1. أضف دالة notifyPermissionChange بعد updateUserDelegationCache
// 2. أضف الـ Triggers في نهاية الملف
// 3. تأكد من أن updateUserDelegationCache مُصدَّرة أو قابلة للاستدعاء
// 4. اختبر الإشعارات بعد التطبيق
// 5. راقب سجلات Cloud Functions للتأكد من عملها
// ============================================================================

// ============================================================================
// واجهة الإشعار (للواجهة الأمامية)
// ============================================================================
/*
interface PermissionNotification {
    id: string;
    type: 'permission_change';
    changeType: 'added' | 'removed' | 'modified';
    permissionType: 'direct' | 'access' | 'control';
    resourceKey?: string;
    jobId?: string;
    message_ar: string;
    message_en: string;
    read: boolean;
    created_at: Timestamp;
}
*/
