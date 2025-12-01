// ============================================================================
// Permissions Real-time Notification Service
// خدمة التنبيهات الفورية لنظام الصلاحيات
// ============================================================================

import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  Unsubscribe,
  Timestamp,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  PermissionChangeNotification,
  SystemType,
  ChangeType,
  ImpactLevel
} from '../types/permissions.types';

// ============================================================================
// Constants
// ============================================================================

const NOTIFICATIONS_COLLECTION = 'permission_notifications';
const MAX_NOTIFICATIONS = 50; // عدد التنبيهات المحفوظة

// ============================================================================
// Notification Handler Type
// ============================================================================

export type NotificationHandler = (notification: PermissionChangeNotification) => void;

// ============================================================================
// Notification Service Class
// ============================================================================

class PermissionsNotificationService {
  private listeners: Map<string, Unsubscribe> = new Map();
  private handlers: Map<string, NotificationHandler> = new Map();

  /**
   * الاشتراك في تنبيهات مستخدم معين
   */
  subscribeToUserNotifications(
    userId: string,
    onNotification: NotificationHandler,
    options?: {
      systemFilter?: SystemType[];
      unreadOnly?: boolean;
    }
  ): () => void {
    const listenerId = `user_${userId}_${Date.now()}`;

    // بناء الاستعلام
    let q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('affected_user_id', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(MAX_NOTIFICATIONS)
    );

    // فلترة حسب النظام إذا طلب
    if (options?.systemFilter && options.systemFilter.length > 0) {
      q = query(q, where('system', 'in', options.systemFilter));
    }

    // فلترة التنبيهات غير المقروءة فقط
    if (options?.unreadOnly) {
      q = query(q, where('is_read', '==', false));
    }

    // الاستماع للتغييرات
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notification = {
              id: change.doc.id,
              ...change.doc.data(),
              timestamp: (change.doc.data().timestamp as Timestamp).toDate()
            } as PermissionChangeNotification;

            onNotification(notification);
          }
        });
      },
      (error) => {
        console.error('Error listening to notifications:', error);
      }
    );

    this.listeners.set(listenerId, unsubscribe);
    this.handlers.set(listenerId, onNotification);

    // إرجاع دالة إلغاء الاشتراك
    return () => this.unsubscribe(listenerId);
  }

  /**
   * الاشتراك في تنبيهات وظيفة معينة
   */
  subscribeToJobNotifications(
    jobId: string,
    onNotification: NotificationHandler,
    systemFilter?: SystemType[]
  ): () => void {
    const listenerId = `job_${jobId}_${Date.now()}`;

    let q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('affected_job_id', '==', jobId),
      orderBy('timestamp', 'desc'),
      limit(MAX_NOTIFICATIONS)
    );

    if (systemFilter && systemFilter.length > 0) {
      q = query(q, where('system', 'in', systemFilter));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notification = {
              id: change.doc.id,
              ...change.doc.data(),
              timestamp: (change.doc.data().timestamp as Timestamp).toDate()
            } as PermissionChangeNotification;

            onNotification(notification);
          }
        });
      },
      (error) => {
        console.error('Error listening to job notifications:', error);
      }
    );

    this.listeners.set(listenerId, unsubscribe);

    return () => this.unsubscribe(listenerId);
  }

  /**
   * الاشتراك في جميع التنبيهات لنظام معين
   */
  subscribeToSystemNotifications(
    system: SystemType,
    onNotification: NotificationHandler
  ): () => void {
    const listenerId = `system_${system}_${Date.now()}`;

    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('system', '==', system),
      orderBy('timestamp', 'desc'),
      limit(MAX_NOTIFICATIONS)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notification = {
              id: change.doc.id,
              ...change.doc.data(),
              timestamp: (change.doc.data().timestamp as Timestamp).toDate()
            } as PermissionChangeNotification;

            onNotification(notification);
          }
        });
      },
      (error) => {
        console.error('Error listening to system notifications:', error);
      }
    );

    this.listeners.set(listenerId, unsubscribe);

    return () => this.unsubscribe(listenerId);
  }

  /**
   * وضع علامة مقروء على تنبيه
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
      await updateDoc(notificationRef, {
        is_read: true,
        read_at: Timestamp.now()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * وضع علامة مقروء على جميع تنبيهات مستخدم
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      // هذه العملية يجب أن تتم عبر Cloud Function لتحسين الأداء
      // لكن للتبسيط، سنتركها هنا كـ placeholder
      console.warn('markAllAsRead should be implemented as a Cloud Function');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * إلغاء الاشتراك من listener معين
   */
  private unsubscribe(listenerId: string): void {
    const unsubscribe = this.listeners.get(listenerId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(listenerId);
      this.handlers.delete(listenerId);
    }
  }

  /**
   * إلغاء جميع الاشتراكات
   */
  unsubscribeAll(): void {
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners.clear();
    this.handlers.clear();
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const permissionsNotificationService = new PermissionsNotificationService();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * تحديد مستوى التأثير بناءً على نوع التغيير
 */
export function determineImpactLevel(
  changeType: ChangeType,
  system: SystemType
): ImpactLevel {
  // الصلاحيات المباشرة لها تأثير عالي دائماً
  if (system === 'direct_permissions') {
    if (changeType === 'permission_removed') return 'high';
    if (changeType === 'permission_added') return 'medium';
    return 'medium';
  }

  // تفويض التحكم له تأثير أعلى من تفويض الوصول
  if (system === 'control_delegation') {
    if (changeType.includes('removed')) return 'high';
    return 'medium';
  }

  // تفويض الوصول له تأثير متوسط إلى منخفض
  if (changeType.includes('removed')) return 'medium';
  return 'low';
}

/**
 * توليد رسالة توضيحية للتنبيه
 */
export function generateNotificationMessage(
  changeType: ChangeType,
  system: SystemType,
  details?: {
    permission_name?: string;
    service_name?: string;
    changed_by_name?: string;
  }
): string {
  const actor = details?.changed_by_name || 'أحد المسؤولين';

  switch (system) {
    case 'direct_permissions':
      switch (changeType) {
        case 'permission_added':
          return `تمت إضافة صلاحية "${details?.permission_name}" من قبل ${actor}`;
        case 'permission_removed':
          return `تمت إزالة صلاحية "${details?.permission_name}" من قبل ${actor}`;
        case 'permission_modified':
          return `تم تعديل صلاحية "${details?.permission_name}" من قبل ${actor}`;
        default:
          return `تم تغيير في الصلاحيات المباشرة من قبل ${actor}`;
      }

    case 'access_delegation':
      switch (changeType) {
        case 'scope_added':
          return `تمت إضافة نطاق وصول جديد من قبل ${actor}`;
        case 'scope_removed':
          return `تمت إزالة نطاق وصول من قبل ${actor}`;
        case 'resource_added':
          return `تمت إضافة مورد "${details?.service_name}" لنطاق الوصول من قبل ${actor}`;
        case 'resource_removed':
          return `تمت إزالة مورد "${details?.service_name}" من نطاق الوصول من قبل ${actor}`;
        default:
          return `تم تغيير في تفويض الوصول من قبل ${actor}`;
      }

    case 'control_delegation':
      switch (changeType) {
        case 'scope_added':
          return `تمت إضافة نطاق تحكم جديد من قبل ${actor}`;
        case 'scope_removed':
          return `تمت إزالة نطاق تحكم من قبل ${actor}`;
        case 'resource_added':
          return `تمت إضافة مورد "${details?.service_name}" لنطاق التحكم من قبل ${actor}`;
        case 'resource_removed':
          return `تمت إزالة مورد "${details?.service_name}" من نطاق التحكم من قبل ${actor}`;
        default:
          return `تم تغيير في تفويض التحكم من قبل ${actor}`;
      }

    default:
      return `تم تغيير في نظام الصلاحيات من قبل ${actor}`;
  }
}
