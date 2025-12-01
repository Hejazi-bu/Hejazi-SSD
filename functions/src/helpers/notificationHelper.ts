// ============================================================================
// Notification Helper for Cloud Functions
// مساعد التنبيهات للـ Cloud Functions
// ============================================================================

import * as admin from "firebase-admin";
import {
  PermissionChangeNotification,
  ChangeType,
  SystemType,
  ImpactLevel,
  UnifiedScope
} from "../types/permissions.types";

const db = admin.firestore();
const NOTIFICATIONS_COLLECTION = "permission_notifications";

// ============================================================================
// Main Notification Function
// ============================================================================

/**
 * إرسال تنبيه بتغيير في الصلاحيات
 */
export async function sendPermissionChangeNotification(params: {
  changeType: ChangeType;
  system: SystemType;
  affectedUserIds: string[];
  affectedJobId?: string;
  details?: {
    permission_id?: string;
    permission_name?: string;
    service_name?: string;
    scope?: UnifiedScope;
    old_value?: unknown;
    new_value?: unknown;
  };
  changedByUserId?: string;
}): Promise<void> {
  const {
    changeType,
    system,
    affectedUserIds,
    affectedJobId,
    details,
    changedByUserId
  } = params;

  // تحديد مستوى التأثير
  const impactLevel = determineImpactLevel(changeType, system);

  // توليد الرسالة
  const message = generateNotificationMessage(changeType, system, details);

  // الحصول على اسم المستخدم الذي قام بالتغيير
  let changedByName = "أحد المسؤولين";
  if (changedByUserId) {
    try {
      const userDoc = await db.collection("users").doc(changedByUserId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        changedByName = userData?.name_ar || userData?.name_en || changedByName;
      }
    } catch (error) {
      console.warn("Failed to fetch changed_by user name:", error);
    }
  }

  // إنشاء تنبيهات لجميع المستخدمين المتأثرين
  const batch = db.batch();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  for (const userId of affectedUserIds) {
    const notificationRef = db.collection(NOTIFICATIONS_COLLECTION).doc();

    const notification: PermissionChangeNotification = {
      change_type: changeType,
      system,
      impact_level: impactLevel,
      affected_user_id: userId,
      affected_job_id: affectedJobId,
      message,
      details,
      changed_by_user_id: changedByUserId,
      changed_by_name: changedByName,
      timestamp,
      is_read: false
    };

    batch.set(notificationRef, notification);
  }

  try {
    await batch.commit();
    console.log(
      `Sent ${affectedUserIds.length} notification(s) for ${system}:${changeType}`
    );
  } catch (error) {
    console.error("Error sending notifications:", error);
    // لا نرمي خطأ لأن التنبيهات ليست حرجة
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * تحديد مستوى التأثير بناءً على نوع التغيير
 */
function determineImpactLevel(
  changeType: ChangeType,
  system: SystemType
): ImpactLevel {
  // الصلاحيات المباشرة لها تأثير عالي دائماً
  if (system === "direct_permissions") {
    if (changeType === "permission_removed") return "high";
    if (changeType === "permission_added") return "medium";
    return "medium";
  }

  // تفويض التحكم له تأثير أعلى من تفويض الوصول
  if (system === "control_delegation") {
    if (changeType.includes("removed")) return "high";
    return "medium";
  }

  // تفويض الوصول له تأثير متوسط إلى منخفض
  if (changeType.includes("removed")) return "medium";
  return "low";
}

/**
 * توليد رسالة توضيحية للتنبيه
 */
function generateNotificationMessage(
  changeType: ChangeType,
  system: SystemType,
  details?: {
    permission_name?: string;
    service_name?: string;
  }
): string {
  switch (system) {
    case "direct_permissions":
      switch (changeType) {
        case "permission_added":
          return `تمت إضافة صلاحية "${details?.permission_name || "غير معروفة"}"`;
        case "permission_removed":
          return `تمت إزالة صلاحية "${details?.permission_name || "غير معروفة"}"`;
        case "permission_modified":
          return `تم تعديل صلاحية "${details?.permission_name || "غير معروفة"}"`;
        default:
          return "تم تغيير في الصلاحيات المباشرة";
      }

    case "access_delegation":
      switch (changeType) {
        case "scope_added":
          return "تمت إضافة نطاق وصول جديد";
        case "scope_removed":
          return "تمت إزالة نطاق وصول";
        case "resource_added":
          return `تمت إضافة مورد "${details?.service_name || "غير معروف"}" لنطاق الوصول`;
        case "resource_removed":
          return `تمت إزالة مورد "${details?.service_name || "غير معروف"}" من نطاق الوصول`;
        default:
          return "تم تغيير في تفويض الوصول";
      }

    case "control_delegation":
      switch (changeType) {
        case "scope_added":
          return "تمت إضافة نطاق تحكم جديد";
        case "scope_removed":
          return "تمت إزالة نطاق تحكم";
        case "resource_added":
          return `تمت إضافة مورد "${details?.service_name || "غير معروف"}" لنطاق التحكم`;
        case "resource_removed":
          return `تمت إزالة مورد "${details?.service_name || "غير معروف"}" من نطاق التحكم`;
        default:
          return "تم تغيير في تفويض التحكم";
      }

    default:
      return "تم تغيير في نظام الصلاحيات";
  }
}

// ============================================================================
// Get Affected Users
// ============================================================================

/**
 * الحصول على جميع المستخدمين المتأثرين بتغيير في وظيفة
 */
export async function getAffectedUsersByJobId(
  jobId: string
): Promise<string[]> {
  try {
    const usersSnapshot = await db
      .collection("users")
      .where("job_id", "==", jobId)
      .select("id")
      .get();

    return usersSnapshot.docs.map((doc) => doc.id);
  } catch (error) {
    console.error("Error fetching affected users:", error);
    return [];
  }
}

/**
 * الحصول على المستخدم المتأثر بتغيير شخصي
 */
export function getAffectedUserById(userId: string): string[] {
  return [userId];
}
