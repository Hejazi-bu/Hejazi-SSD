import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
} from "react";
// استيراد db من ملفنا الجديد
import { db } from "../../lib/supabaseClient";

// إزالة أنواع SupabaseUser و RealtimeChannel
// --- واجهات الأنواع (Types) ---
export interface User {
    id: string;
    name_ar?: string | null;
    name_en?: string | null;
    job_id?: number | null;
    company_id?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    is_super_admin?: boolean;
    favorite_services?: number[];
    // إضافة حقل كلمة المرور للتحقق منه (لأغراض العرض فقط، ليس آمناً)
    password?: string;
}

export type Permissions = { [key: string]: boolean };

export type AuthErrorKey = 'errorCredentials' | 'errorPermission' | 'errorProfileNotFound' | 'errorGeneric';

// --- الخصائص التي سيوفرها الـ Context ---
// تغيير نوع بيانات اعتماد تسجيل الدخول إلى 'any' لأننا لا نستخدم نوع Supabase المحدد
interface UserContextProps {
    user: User | null;
    permissions: Permissions;
    isLoading: boolean;
    hasPermission: (key: string) => boolean;
    updateFavorites: (newFavorites: number[]) => Promise<void>;
    signInAndCheckPermissions: (credentials: any) => Promise<{ success: boolean; errorKey?: AuthErrorKey }>;
    signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permissions>({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchFullUserData = async (userId: string): Promise<User | null> => {
        try {
            const res = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
            if (res.rows.length > 0) {
                return res.rows[0] as User;
            }
            return null;
        } catch (error) {
            console.error("خطأ في جلب بيانات المستخدم:", error);
            return null;
        }
    };
    
    const fetchUserPermissions = useCallback(async (jobId: number | null, userId: string) => {
        const combinedPermissions: Permissions = {};

        // جلب أذونات المسمى الوظيفي
        if (jobId) {
            const query1 = 'SELECT service_id, sub_service_id, sub_sub_service_id FROM job_permissions WHERE job_id = $1';
            const res1 = await db.query(query1, [jobId]);

            (res1.rows || []).forEach(p => {
                if (p.sub_sub_service_id) combinedPermissions[`sss:${p.sub_sub_service_id}`] = true;
                else if (p.sub_service_id) combinedPermissions[`ss:${p.sub_service_id}`] = true;
                else combinedPermissions[`s:${p.service_id}`] = true;
            });
        }

        // جلب أذونات المستخدم الفردية وتحديث الأذونات السابقة
        const query2 = 'SELECT service_id, sub_service_id, sub_sub_service_id, is_allowed FROM user_permissions WHERE user_id = $1';
        const res2 = await db.query(query2, [userId]);

        (res2.rows || []).forEach(p => {
            let key;
            if (p.sub_sub_service_id) key = `sss:${p.sub_sub_service_id}`;
            else if (p.sub_service_id) key = `ss:${p.sub_service_id}`;
            else key = `s:${p.service_id}`;
            
            if (p.is_allowed === false) {
                delete combinedPermissions[key];
            } else {
                combinedPermissions[key] = p.is_allowed;
            }
        });

        return combinedPermissions;
    }, []);

    const manageSession = useCallback(async (userId: string | null, preloadedUserData?: User) => {
        if (userId) {
            const userData = preloadedUserData || await fetchFullUserData(userId);
            if (userData) {
                setUser(userData);
                const userPermissions = await fetchUserPermissions(userData.job_id ?? null, userData.id);
                setPermissions(userPermissions);
            } else {
                setUser(null);
                setPermissions({});
            }
        } else {
            setUser(null);
            setPermissions({});
        }
        setIsLoading(false);
    }, [fetchUserPermissions]);
    
    // --- دالة تسجيل الدخول المعدلة ---
    const signInAndCheckPermissions = async (credentials: any): Promise<{ success: boolean; errorKey?: AuthErrorKey }> => {
        try {
            // ملاحظة: هذا الكود غير آمن في بيئة إنتاج. يجب تشفير كلمات المرور.
            const res = await db.query('SELECT * FROM users WHERE email = $1', [credentials.email]);
            const userData = res.rows[0];

            if (!userData || userData.password !== credentials.password) {
                return { success: false, errorKey: 'errorCredentials' };
            }

            if (!userData) {
                return { success: false, errorKey: 'errorProfileNotFound' };
            }

            await manageSession(userData.id, userData);
            return { success: true };
        } catch (error) {
            return { success: false, errorKey: 'errorGeneric' };
        }
    };

    const signOut = async () => {
        // ليس لدينا جلسات لإنهائها، لذا سنقوم فقط بمسح حالة المستخدم
        setUser(null);
        setPermissions({});
    };

    // إزالة useEffect الذي كان يعتمد على supabase.auth
    useEffect(() => {
        setIsLoading(false);
    }, []);

    // إزالة useEffect الذي كان يعتمد على Realtime Channel
    // الكود التالي محذوف بالكامل:
    /*
    useEffect(() => {
        let userChannel: RealtimeChannel | null;
        let jobChannel: RealtimeChannel | null;
        
        const handlePermissionChange = async (eventType: string) => {
            console.log(`Realtime Event Fired: ${eventType}. Re-fetching permissions...`);
            if (user) {
                const userPermissions = await fetchUserPermissions(user.job_id ?? null, user.id);
                setPermissions(userPermissions);
            }
        };

        const subscribeToPermissions = () => {
            if (!user) return;
            // ... بقية الكود ...
        };

        const unsubscribeFromPermissions = () => {
            if (userChannel) supabase.removeChannel(userChannel);
            if (jobChannel) supabase.removeChannel(jobChannel);
        };
        subscribeToPermissions();
        return () => {
            unsubscribeFromPermissions();
        };
    }, [user, fetchUserPermissions]);
    */

    const hasPermission = useCallback((key: string): boolean => {
        if (user?.is_super_admin) return true;
        return !!permissions[key];
    }, [user, permissions]);
    
    const updateFavorites = async (newFavorites: number[]) => {
        if (!user) return;
        setUser(currentUser => currentUser ? { ...currentUser, favorite_services: newFavorites } : null);
        try {
            const query = 'UPDATE users SET favorite_services = $1 WHERE id = $2';
            await db.query(query, [newFavorites, user.id]);
        } catch (error) {
            console.error("Error updating favorites:", error);
        }
    };
    
    const value = { user, permissions, isLoading, hasPermission, updateFavorites, signInAndCheckPermissions, signOut };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useAuth = (): UserContextProps => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within a UserProvider");
    }
    return context;
};