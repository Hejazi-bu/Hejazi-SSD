// src/components/contexts/ServicesContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
    useMemo
} from 'react';
import { collection, getDocs, doc, getDoc, DocumentData } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';

// --- Types ---
interface BaseServiceDoc extends DocumentData { id: string; is_allowed: boolean; page: string; }
interface GroupDoc extends BaseServiceDoc { }
interface ServiceDoc extends BaseServiceDoc { group_id: string | number; }
interface SubServiceDoc extends BaseServiceDoc { service_id: string | number; component?: string; label_ar?: string; label_en?: string; icon?: string; }
interface SubSubServiceDoc extends BaseServiceDoc { service_id: string | number; sub_service_id: string | number; }

interface ServicesContextProps {
    isServiceAllowed: (key: string) => boolean;
    getParentServiceId: (key: string) => string | null;
    getServiceByKey: (key: string) => BaseServiceDoc | undefined;
    getPermissionKeyByPage: (page: string, level: 'ss' | 'sss') => string | undefined;
    getFullPagePath: (key: string) => string | null;
    findSubServiceByPath: (groupSlug: string, serviceSlug: string, subServiceSlug: string) => SubServiceDoc | null;
    refreshServices: () => Promise<void>;
    isLoading: boolean;
}

const ServicesContext = createContext<ServicesContextProps | undefined>(undefined);

// مفاتيح التخزين المحلي
const STORAGE_KEY_DATA = 'app_services_data_v1';
const STORAGE_KEY_VERSION = 'app_services_version_v1';

export const ServicesProvider = ({ children }: { children: ReactNode }) => {
    const [servicesMap, setServicesMap] = useState<Map<string, BaseServiceDoc>>(new Map());
    const [serviceHierarchy, setServiceHierarchy] = useState<Map<string, string>>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    // دالة المعالجة (تحويل البيانات الخام إلى خرائط)
    const processData = (rawData: any) => {
        const newMap = new Map<string, BaseServiceDoc>(rawData.map);
        const newHierarchy = new Map<string, string>(rawData.hierarchy);
        setServicesMap(newMap);
        setServiceHierarchy(newHierarchy);
    };

    // ✅ الجلب الذكي (Smart Fetch)
    const fetchServicesSmart = useCallback(async (forceRefresh = false) => {
        setIsLoading(true);
        try {
            // 1. قراءة رقم الإصدار من السيرفر (تكلفة: 1 قراءة فقط)
            const settingsRef = doc(db, 'app', 'settings');
            const settingsSnap = await getDoc(settingsRef);
            const serverVersion = settingsSnap.exists() ? settingsSnap.data().services_version : 0;

            // 2. قراءة النسخة المحلية
            const localVersion = Number(localStorage.getItem(STORAGE_KEY_VERSION) || 0);
            const localDataString = localStorage.getItem(STORAGE_KEY_DATA);

            // 3. مقارنة الإصدارات
            // إذا كان الإصدار متطابقاً والبيانات موجودة، نستخدم المحلي (توفير البيانات)
            if (!forceRefresh && serverVersion === localVersion && localDataString) {
                console.log(`⚡ Using cached services (Version ${localVersion})`);
                const parsedData = JSON.parse(localDataString);
                processData(parsedData);
                setIsLoading(false);
                return;
            }

            // 4. إذا اختلف الإصدار، نجلب البيانات الكاملة من السيرفر
            console.log(`🔄 New version detected (Server: ${serverVersion}, Local: ${localVersion}). Fetching fresh data...`);
            
            const collectionsToFetch = [
                { name: 'service_groups', prefix: 'g' },
                { name: 'services', prefix: 's' },
                { name: 'sub_services', prefix: 'ss' },
                { name: 'sub_sub_services', prefix: 'sss' }
            ];

            // جلب متوازي
            const promises = collectionsToFetch.map(col => getDocs(collection(db, col.name)));
            const snapshots = await Promise.all(promises);

            const tempMapArray: [string, BaseServiceDoc][] = [];
            const tempHierarchyArray: [string, string][] = [];

            snapshots.forEach((snapshot, index) => {
                const { prefix } = collectionsToFetch[index];
                snapshot.docs.forEach(doc => {
                    const rawData = doc.data();
                    const data = { id: doc.id, ...rawData } as BaseServiceDoc;
                    const key = `${prefix}:${doc.id}`;
                    
                    tempMapArray.push([key, data]);

                    if (prefix === 'ss') {
                        const parentId = (data as SubServiceDoc).service_id;
                        if (parentId) tempHierarchyArray.push([key, `s:${parentId}`]);
                    } else if (prefix === 'sss') {
                        const parentId = (data as SubSubServiceDoc).service_id;
                        if (parentId) tempHierarchyArray.push([key, `s:${parentId}`]);
                    }
                });
            });

            // 5. تحديث الحالة وحفظ الكاش الجديد
            const cachePayload = {
                map: tempMapArray,
                hierarchy: tempHierarchyArray
            };

            localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(cachePayload));
            localStorage.setItem(STORAGE_KEY_VERSION, String(serverVersion));
            
            processData(cachePayload);

        } catch (error) {
            console.error("Error in smart fetch:", error);
            // في حال الفشل، نحاول التحميل من الكاش القديم كخطة طوارئ
            const localDataString = localStorage.getItem(STORAGE_KEY_DATA);
            if (localDataString) {
                console.warn("⚠️ Falling back to local cache due to error.");
                processData(JSON.parse(localDataString));
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    // عند تحميل التطبيق
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchServicesSmart();
            } else {
                // تنظيف عند تسجيل الخروج
                setServicesMap(new Map());
                setServiceHierarchy(new Map());
                // لا نمسح الكاش من localStorage لكي يكون جاهزاً لتسجيل الدخول القادم بسرعة
                setIsLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, [fetchServicesSmart]);

    // --- Helper Functions ---

    const isServiceAllowed = useCallback((key: string): boolean => {
        const service = servicesMap.get(key);
        return service?.is_allowed !== false;
    }, [servicesMap]);

    const getParentServiceId = useCallback((key: string): string | null => {
        return serviceHierarchy.get(key) || null;
    }, [serviceHierarchy]);

    const getServiceByKey = useCallback((key: string): BaseServiceDoc | undefined => {
        return servicesMap.get(key);
    }, [servicesMap]);

    const getPermissionKeyByPage = useCallback((page: string, level: 'ss' | 'sss'): string | undefined => {
        for (const [key, serviceDoc] of servicesMap.entries()) {
            if (key.startsWith(`${level}:`) && serviceDoc.page === page) {
                return key;
            }
        }
        return undefined;
    }, [servicesMap]);

    const getFullPagePath = useCallback((key: string): string | null => {
        const sssDoc = servicesMap.get(key) as SubSubServiceDoc | undefined;
        if (!sssDoc) return null;
        
        const ssKey = `ss:${sssDoc.sub_service_id}`;
        const ssDoc = servicesMap.get(ssKey);
        if (!ssDoc) return null;
        
        const sKey = `s:${sssDoc.service_id}`;
        const sDoc = servicesMap.get(sKey);
        if (!sDoc) return null;
        
        if (sDoc.page && ssDoc.page) {
             const groupKey = `g:${(sDoc as ServiceDoc).group_id}`;
             const groupDoc = servicesMap.get(groupKey);
             if(groupDoc) {
                 return `/${groupDoc.page}/${sDoc.page}/${ssDoc.page}`;
             }
        }
        return null;
    }, [servicesMap]);

    const findSubServiceByPath = useCallback((groupSlug: string, serviceSlug: string, subServiceSlug: string): SubServiceDoc | null => {
        let groupDoc: GroupDoc | undefined;
        for (const [key, doc] of servicesMap.entries()) {
            if (key.startsWith('g:') && doc.page === groupSlug) {
                groupDoc = doc as GroupDoc;
                break;
            }
        }
        if (!groupDoc) return null;

        let serviceDoc: ServiceDoc | undefined;
        for (const [key, doc] of servicesMap.entries()) {
            if (key.startsWith('s:') && doc.page === serviceSlug) {
                if (String((doc as ServiceDoc).group_id) === String(groupDoc.id)) {
                    serviceDoc = doc as ServiceDoc;
                    break;
                }
            }
        }
        if (!serviceDoc) return null;

        let subServiceDoc: SubServiceDoc | undefined;
        for (const [key, doc] of servicesMap.entries()) {
            if (key.startsWith('ss:') && doc.page === subServiceSlug) {
                if (String((doc as SubServiceDoc).service_id) === String(serviceDoc.id)) {
                    subServiceDoc = doc as SubServiceDoc;
                    break;
                }
            }
        }

        return subServiceDoc || null;

    }, [servicesMap]);

    const value = useMemo(() => ({
        isServiceAllowed,
        getParentServiceId,
        getServiceByKey,
        getPermissionKeyByPage,
        getFullPagePath,
        findSubServiceByPath,
        refreshServices: () => fetchServicesSmart(true), // زر التحديث اليدوي يجبر الجلب
        isLoading,
    }), [isServiceAllowed, getParentServiceId, getServiceByKey, getPermissionKeyByPage, getFullPagePath, findSubServiceByPath, fetchServicesSmart, isLoading]);

    return (
        <ServicesContext.Provider value={value}>
            {children}
        </ServicesContext.Provider>
    );
};

export const useServices = (): ServicesContextProps => {
    const context = useContext(ServicesContext);
    if (context === undefined) {
        throw new Error("useServices must be used within a ServicesProvider");
    }
    return context;
};