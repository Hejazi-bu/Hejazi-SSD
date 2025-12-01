// src/hooks/usePermissionChangeListener.ts
import { useEffect, useRef } from 'react';
import { getFirestore, collection, query, where, onSnapshot, DocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../components/contexts/UserContext';
import { useRealtimeNotifications } from '../components/contexts/RealtimeNotificationsContext';

const firestore = getFirestore();

/**
 * Hook لمراقبة التغييرات اللحظية في أنظمة الصلاحيات الثلاثة:
 * 1. نظام الصلاحيات المباشر (Job Permissions)
 * 2. نظام تفويض الوصول (Access Delegation)
 * 3. نظام تفويض التحكم (Control Delegation)
 *
 * يعرض تنبيهات ذكية عند حدوث تغييرات تؤثر على المستخدم الحالي
 */
export const usePermissionChangeListener = (
    options: {
        listenToJobPermissions?: boolean;
        listenToAccessDelegation?: boolean;
        listenToControlDelegation?: boolean;
        specificJobId?: string | null; // لمراقبة وظيفة محددة فقط
    } = {}
) => {
    const { user } = useAuth();
    const { addNotification } = useRealtimeNotifications();

    const {
        listenToJobPermissions = true,
        listenToAccessDelegation = true,
        listenToControlDelegation = true,
        specificJobId = null
    } = options;

    // Refs لتخزين البيانات السابقة للمقارنة
    const previousJobPermissions = useRef<Map<string, any>>(new Map());
    const previousAccessRules = useRef<Map<string, any>>(new Map());
    const previousControlRules = useRef<Map<string, any>>(new Map());
    const isFirstLoad = useRef({
        jobPermissions: true,
        accessRules: true,
        controlRules: true
    });

    // ========================================================================
    // 1. مراقبة صلاحيات الوظيفة (Job Permissions)
    // ========================================================================
    useEffect(() => {
        if (!user?.job_id || !listenToJobPermissions) return;

        const jobId = specificJobId || user.job_id;
        if (!jobId) return;

        const q = query(
            collection(firestore, 'job_permissions'),
            where('job_id', '==', jobId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return; // تجاهل التغييرات المحلية

            if (isFirstLoad.current.jobPermissions) {
                // التحميل الأول - حفظ البيانات فقط
                snapshot.docs.forEach(doc => {
                    previousJobPermissions.current.set(doc.id, doc.data());
                });
                isFirstLoad.current.jobPermissions = false;
                return;
            }

            // فحص التغييرات
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();
                const docId = change.doc.id;

                if (change.type === 'added' && !previousJobPermissions.current.has(docId)) {
                    // صلاحية جديدة تمت إضافتها
                    addNotification({
                        type: 'permission_added',
                        title: 'تمت إضافة صلاحية جديدة',
                        message: `تم منح وظيفتك صلاحية جديدة في النظام`,
                        autoClose: 7000
                    });
                }

                if (change.type === 'removed') {
                    // صلاحية تمت إزالتها
                    const oldData = previousJobPermissions.current.get(docId);
                    if (oldData) {
                        addNotification({
                            type: 'permission_removed',
                            title: 'تمت إزالة صلاحية',
                            message: `تم إلغاء إحدى صلاحيات وظيفتك`,
                            autoClose: 7000
                        });
                    }
                }

                if (change.type === 'modified') {
                    // صلاحية تم تعديلها
                    const oldData = previousJobPermissions.current.get(docId);
                    if (oldData && JSON.stringify(oldData) !== JSON.stringify(data)) {
                        addNotification({
                            type: 'info',
                            title: 'تم تحديث صلاحية',
                            message: `تم تعديل إحدى صلاحيات وظيفتك`,
                            autoClose: 6000
                        });
                    }
                }

                // تحديث الـ cache
                if (change.type === 'removed') {
                    previousJobPermissions.current.delete(docId);
                } else {
                    previousJobPermissions.current.set(docId, data);
                }
            });
        });

        return () => unsubscribe();
    }, [user?.job_id, specificJobId, listenToJobPermissions, addNotification]);

    // ========================================================================
    // 2. مراقبة تفويض الوصول (Access Delegation)
    // ========================================================================
    useEffect(() => {
        if (!user?.job_id || !listenToAccessDelegation) return;

        const jobId = specificJobId || user.job_id;
        if (!jobId) return;

        // مراقبة access_job_scopes
        const scopesQuery = query(
            collection(firestore, 'access_job_scopes'),
            where('job_id', '==', jobId)
        );

        const unsubscribeScopes = onSnapshot(scopesQuery, (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;

            if (isFirstLoad.current.accessRules) {
                snapshot.docs.forEach(doc => {
                    previousAccessRules.current.set(`scope_${doc.id}`, doc.data());
                });
                isFirstLoad.current.accessRules = false;
                return;
            }

            snapshot.docChanges().forEach(change => {
                const docId = `scope_${change.doc.id}`;

                if (change.type === 'added' && !previousAccessRules.current.has(docId)) {
                    addNotification({
                        type: 'delegation_added',
                        title: 'تم توسيع نطاق الوصول',
                        message: `تم منح وظيفتك حق الوصول إلى نطاقات جديدة`,
                        autoClose: 7000
                    });
                }

                if (change.type === 'removed') {
                    if (previousAccessRules.current.has(docId)) {
                        addNotification({
                            type: 'delegation_removed',
                            title: 'تم تقييد نطاق الوصول',
                            message: `تم إلغاء حق الوصول إلى أحد النطاقات`,
                            autoClose: 7000
                        });
                    }
                }

                // تحديث الـ cache
                if (change.type === 'removed') {
                    previousAccessRules.current.delete(docId);
                } else {
                    previousAccessRules.current.set(docId, change.doc.data());
                }
            });
        });

        // مراقبة access_job_resources
        const resourcesQuery = query(
            collection(firestore, 'access_job_resources'),
            where('job_id', '==', jobId)
        );

        const unsubscribeResources = onSnapshot(resourcesQuery, (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;

            if (isFirstLoad.current.accessRules) return;

            snapshot.docChanges().forEach(change => {
                const docId = `resource_${change.doc.id}`;

                if (change.type === 'added' && !previousAccessRules.current.has(docId)) {
                    addNotification({
                        type: 'delegation_added',
                        title: 'تم منح وصول لموارد جديدة',
                        message: `تم منح وظيفتك حق الوصول إلى خدمات أو صفحات جديدة`,
                        autoClose: 7000
                    });
                }

                if (change.type === 'removed') {
                    if (previousAccessRules.current.has(docId)) {
                        addNotification({
                            type: 'delegation_removed',
                            title: 'تم إلغاء وصول لموارد',
                            message: `تم إلغاء حق الوصول إلى بعض الخدمات أو الصفحات`,
                            autoClose: 7000
                        });
                    }
                }

                // تحديث الـ cache
                if (change.type === 'removed') {
                    previousAccessRules.current.delete(docId);
                } else {
                    previousAccessRules.current.set(docId, change.doc.data());
                }
            });
        });

        return () => {
            unsubscribeScopes();
            unsubscribeResources();
        };
    }, [user?.job_id, specificJobId, listenToAccessDelegation, addNotification]);

    // ========================================================================
    // 3. مراقبة تفويض التحكم (Control Delegation)
    // ========================================================================
    useEffect(() => {
        if (!user?.job_id || !listenToControlDelegation) return;

        const jobId = specificJobId || user.job_id;
        if (!jobId) return;

        // مراقبة control_job_scopes
        const scopesQuery = query(
            collection(firestore, 'control_job_scopes'),
            where('job_id', '==', jobId)
        );

        const unsubscribeScopes = onSnapshot(scopesQuery, (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;

            if (isFirstLoad.current.controlRules) {
                snapshot.docs.forEach(doc => {
                    previousControlRules.current.set(`scope_${doc.id}`, doc.data());
                });
                isFirstLoad.current.controlRules = false;
                return;
            }

            snapshot.docChanges().forEach(change => {
                const docId = `scope_${change.doc.id}`;

                if (change.type === 'added' && !previousControlRules.current.has(docId)) {
                    addNotification({
                        type: 'delegation_added',
                        title: 'تم منح صلاحية تحكم جديدة',
                        message: `أصبح بإمكانك الآن التحكم في نطاقات جديدة`,
                        autoClose: 7000
                    });
                }

                if (change.type === 'removed') {
                    if (previousControlRules.current.has(docId)) {
                        addNotification({
                            type: 'warning',
                            title: 'تم إلغاء صلاحية تحكم',
                            message: `تم إلغاء حق التحكم في أحد النطاقات`,
                            autoClose: 7000
                        });
                    }
                }

                // تحديث الـ cache
                if (change.type === 'removed') {
                    previousControlRules.current.delete(docId);
                } else {
                    previousControlRules.current.set(docId, change.doc.data());
                }
            });
        });

        // مراقبة control_job_resources
        const resourcesQuery = query(
            collection(firestore, 'control_job_resources'),
            where('job_id', '==', jobId)
        );

        const unsubscribeResources = onSnapshot(resourcesQuery, (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;

            if (isFirstLoad.current.controlRules) return;

            snapshot.docChanges().forEach(change => {
                const docId = `resource_${change.doc.id}`;

                if (change.type === 'added' && !previousControlRules.current.has(docId)) {
                    addNotification({
                        type: 'delegation_added',
                        title: 'تم منح صلاحية تحكم في موارد',
                        message: `أصبح بإمكانك الآن التحكم في خدمات أو صفحات جديدة`,
                        autoClose: 7000
                    });
                }

                if (change.type === 'removed') {
                    if (previousControlRules.current.has(docId)) {
                        addNotification({
                            type: 'warning',
                            title: 'تم إلغاء صلاحية تحكم في موارد',
                            message: `تم إلغاء حق التحكم في بعض الخدمات أو الصفحات`,
                            autoClose: 7000
                        });
                    }
                }

                // تحديث الـ cache
                if (change.type === 'removed') {
                    previousControlRules.current.delete(docId);
                } else {
                    previousControlRules.current.set(docId, change.doc.data());
                }
            });
        });

        return () => {
            unsubscribeScopes();
            unsubscribeResources();
        };
    }, [user?.job_id, specificJobId, listenToControlDelegation, addNotification]);
};

/**
 * Hook لمراقبة تعديلات متزامنة من مستخدمين آخرين على نفس المورد
 * مفيد عند التعديل على صفحات الصلاحيات
 */
export const useConcurrentEditListener = (
    resourceType: 'job_permissions' | 'access_job_scopes' | 'control_job_scopes',
    resourceId: string | null,
    onConcurrentEdit?: (message: string) => void
) => {
    const { addNotification } = useRealtimeNotifications();
    const lastModifiedRef = useRef<Date | null>(null);
    const isFirstLoadRef = useRef(true);

    useEffect(() => {
        if (!resourceId) return;

        const q = query(
            collection(firestore, resourceType),
            where('job_id', '==', resourceId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return;

            if (isFirstLoadRef.current) {
                isFirstLoadRef.current = false;
                return;
            }

            snapshot.docChanges().forEach(change => {
                if (change.type === 'modified') {
                    const message = `قام مستخدم آخر بتعديل هذه البيانات للتو`;

                    addNotification({
                        type: 'concurrent_edit',
                        title: 'تحذير: تعديل متزامن',
                        message,
                        autoClose: 10000,
                        action: {
                            label: 'إعادة التحميل',
                            onClick: () => window.location.reload()
                        }
                    });

                    if (onConcurrentEdit) {
                        onConcurrentEdit(message);
                    }
                }
            });
        });

        return () => unsubscribe();
    }, [resourceId, resourceType, addNotification, onConcurrentEdit]);
};
