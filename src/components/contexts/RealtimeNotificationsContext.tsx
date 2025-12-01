// src/components/contexts/RealtimeNotificationsContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    BellIcon, ShieldCheckIcon, UserMinusIcon, UserPlusIcon,
    XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon
} from '@heroicons/react/24/outline';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type NotificationType = 'permission_added' | 'permission_removed' | 'delegation_added' | 'delegation_removed' | 'concurrent_edit' | 'info' | 'warning';

export interface RealtimeNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: Date;
    autoClose?: number; // ms, 0 = no auto-close
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface RealtimeNotificationsContextValue {
    notifications: RealtimeNotification[];
    addNotification: (notification: Omit<RealtimeNotification, 'id' | 'timestamp'>) => void;
    removeNotification: (id: string) => void;
    clearAll: () => void;
}

// ============================================================================
// Context
// ============================================================================

const RealtimeNotificationsContext = createContext<RealtimeNotificationsContextValue | undefined>(undefined);

export const useRealtimeNotifications = () => {
    const context = useContext(RealtimeNotificationsContext);
    if (!context) {
        throw new Error('useRealtimeNotifications must be used within RealtimeNotificationsProvider');
    }
    return context;
};

// ============================================================================
// Provider Component
// ============================================================================

export const RealtimeNotificationsProvider = ({ children }: { children: ReactNode }) => {
    const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);

    const addNotification = useCallback((notification: Omit<RealtimeNotification, 'id' | 'timestamp'>) => {
        const newNotif: RealtimeNotification = {
            ...notification,
            id: `notif_${Date.now()}_${Math.random()}`,
            timestamp: new Date(),
            autoClose: notification.autoClose !== undefined ? notification.autoClose : 5000
        };

        setNotifications(prev => [newNotif, ...prev].slice(0, 5)); // Max 5 notifications

        // Auto-close
        if (newNotif.autoClose && newNotif.autoClose > 0) {
            setTimeout(() => {
                removeNotification(newNotif.id);
            }, newNotif.autoClose);
        }
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    return (
        <RealtimeNotificationsContext.Provider value={{ notifications, addNotification, removeNotification, clearAll }}>
            {children}
            <NotificationToastContainer notifications={notifications} onRemove={removeNotification} />
        </RealtimeNotificationsContext.Provider>
    );
};

// ============================================================================
// Toast Container Component
// ============================================================================

const NotificationToastContainer = ({
    notifications,
    onRemove
}: {
    notifications: RealtimeNotification[];
    onRemove: (id: string) => void;
}) => {
    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {notifications.map(notif => (
                    <NotificationToast key={notif.id} notification={notif} onClose={() => onRemove(notif.id)} />
                ))}
            </AnimatePresence>
        </div>
    );
};

// ============================================================================
// Toast Component
// ============================================================================

const NotificationToast = ({
    notification,
    onClose
}: {
    notification: RealtimeNotification;
    onClose: () => void;
}) => {
    const getIcon = () => {
        switch (notification.type) {
            case 'permission_added':
                return <ShieldCheckIcon className="w-5 h-5 text-green-400" />;
            case 'permission_removed':
                return <UserMinusIcon className="w-5 h-5 text-red-400" />;
            case 'delegation_added':
                return <UserPlusIcon className="w-5 h-5 text-blue-400" />;
            case 'delegation_removed':
                return <UserMinusIcon className="w-5 h-5 text-orange-400" />;
            case 'concurrent_edit':
                return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />;
            case 'warning':
                return <ExclamationTriangleIcon className="w-5 h-5 text-orange-400" />;
            case 'info':
                return <InformationCircleIcon className="w-5 h-5 text-blue-400" />;
            default:
                return <BellIcon className="w-5 h-5 text-gray-400" />;
        }
    };

    const getColorClasses = () => {
        switch (notification.type) {
            case 'permission_added':
            case 'delegation_added':
                return 'bg-green-500/10 border-green-500/30';
            case 'permission_removed':
                return 'bg-red-500/10 border-red-500/30';
            case 'delegation_removed':
                return 'bg-orange-500/10 border-orange-500/30';
            case 'concurrent_edit':
            case 'warning':
                return 'bg-yellow-500/10 border-yellow-500/30';
            case 'info':
                return 'bg-blue-500/10 border-blue-500/30';
            default:
                return 'bg-gray-700/50 border-gray-600/50';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className={`pointer-events-auto min-w-[320px] max-w-md rounded-xl border backdrop-blur-xl p-4 shadow-2xl ${getColorClasses()}`}
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white mb-1">{notification.title}</h4>
                    <p className="text-xs text-gray-300 leading-relaxed">{notification.message}</p>

                    {/* Action Button */}
                    {notification.action && (
                        <button
                            onClick={() => {
                                notification.action!.onClick();
                                onClose();
                            }}
                            className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            {notification.action.label} →
                        </button>
                    )}
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
            </div>
        </motion.div>
    );
};
