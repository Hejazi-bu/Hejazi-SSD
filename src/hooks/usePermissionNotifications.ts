// ============================================================================
// usePermissionNotifications Hook
// Hook للاستماع للتنبيهات في الوقت الفعلي
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../components/contexts/AuthContext';
import { useDialog } from '../components/contexts/DialogContext';
import {
  permissionsNotificationService,
  generateNotificationMessage,
  determineImpactLevel
} from '../services/permissionsNotificationService';
import {
  PermissionChangeNotification,
  SystemType,
  ImpactLevel
} from '../types/permissions.types';

// ============================================================================
// Hook Options
// ============================================================================

export interface UsePermissionNotificationsOptions {
  /** هل نريد عرض تنبيه فوري عند التغيير؟ */
  showDialogOnChange?: boolean;

  /** هل نريد فقط التنبيهات غير المقروءة؟ */
  unreadOnly?: boolean;

  /** فلترة حسب الأنظمة */
  systemFilter?: SystemType[];

  /** فلترة حسب مستوى التأثير */
  impactLevelFilter?: ImpactLevel[];

  /** دالة مخصصة للتعامل مع التنبيهات */
  onNotification?: (notification: PermissionChangeNotification) => void;

  /** عرض صوت عند التنبيه */
  playSound?: boolean;
}

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UsePermissionNotificationsReturn {
  /** قائمة التنبيهات */
  notifications: PermissionChangeNotification[];

  /** عدد التنبيهات غير المقروءة */
  unreadCount: number;

  /** هل يتم التحميل؟ */
  isLoading: boolean;

  /** وضع علامة مقروء على تنبيه */
  markAsRead: (notificationId: string) => Promise<void>;

  /** وضع علامة مقروء على جميع التنبيهات */
  markAllAsRead: () => Promise<void>;

  /** مسح جميع التنبيهات من الذاكرة */
  clearNotifications: () => void;
}

// ============================================================================
// Main Hook
// ============================================================================

export function usePermissionNotifications(
  options: UsePermissionNotificationsOptions = {}
): UsePermissionNotificationsReturn {
  const { currentUser } = useAuth();
  const { showDialog } = useDialog();

  const [notifications, setNotifications] = useState<PermissionChangeNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // استخدام ref للحفاظ على المعلومات عبر re-renders
  const notificationIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // تحميل الصوت إذا كان مطلوباً
  useEffect(() => {
    if (options.playSound) {
      audioRef.current = new Audio('/notification-sound.mp3');
    }
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, [options.playSound]);

  // دالة للتعامل مع التنبيه الجديد
  const handleNewNotification = useCallback(
    (notification: PermissionChangeNotification) => {
      // تجنب التكرار
      if (notificationIdsRef.current.has(notification.id)) {
        return;
      }

      notificationIdsRef.current.add(notification.id);

      // فلترة حسب مستوى التأثير إذا طُلب
      if (
        options.impactLevelFilter &&
        !options.impactLevelFilter.includes(notification.impact_level)
      ) {
        return;
      }

      // إضافة التنبيه للقائمة
      setNotifications((prev) => [notification, ...prev].slice(0, 50));

      // تشغيل الصوت إذا كان مطلوباً
      if (options.playSound && audioRef.current) {
        audioRef.current.play().catch((err) => {
          console.warn('Failed to play notification sound:', err);
        });
      }

      // استدعاء الدالة المخصصة إذا وجدت
      if (options.onNotification) {
        options.onNotification(notification);
      }

      // عرض Dialog إذا كان مطلوباً ومستوى التأثير عالي أو متوسط
      if (
        options.showDialogOnChange &&
        (notification.impact_level === 'high' || notification.impact_level === 'medium')
      ) {
        const variant =
          notification.impact_level === 'high'
            ? 'warning'
            : 'info';

        showDialog({
          title: 'تغيير في الصلاحيات',
          message: notification.message,
          variant
        });
      }
    },
    [options, showDialog]
  );

  // الاشتراك في التنبيهات عند تسجيل الدخول
  useEffect(() => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = permissionsNotificationService.subscribeToUserNotifications(
      currentUser.id,
      handleNewNotification,
      {
        systemFilter: options.systemFilter,
        unreadOnly: options.unreadOnly
      }
    );

    setIsLoading(false);

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, options.systemFilter, options.unreadOnly, handleNewNotification]);

  // حساب عدد التنبيهات غير المقروءة
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // وضع علامة مقروء على تنبيه
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await permissionsNotificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // وضع علامة مقروء على جميع التنبيهات
  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      await permissionsNotificationService.markAllAsRead(currentUser.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [currentUser?.id]);

  // مسح التنبيهات من الذاكرة
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    notificationIdsRef.current.clear();
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    clearNotifications
  };
}

// ============================================================================
// Specialized Hooks
// ============================================================================

/**
 * Hook للاستماع فقط للتنبيهات عالية التأثير
 */
export function useHighPriorityNotifications() {
  return usePermissionNotifications({
    showDialogOnChange: true,
    impactLevelFilter: ['high'],
    playSound: true,
    unreadOnly: true
  });
}

/**
 * Hook للاستماع لتنبيهات نظام معين
 */
export function useSystemNotifications(system: SystemType) {
  return usePermissionNotifications({
    systemFilter: [system],
    showDialogOnChange: false
  });
}
