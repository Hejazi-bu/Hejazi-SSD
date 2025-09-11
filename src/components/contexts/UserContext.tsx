import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
} from "react";

// لم نعد نستورد db لأننا لن نستخدمها هنا مباشرة
// import { db } from "../../lib/supabaseClient";

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
    password?: string;
}

export type Permissions = { [key: string]: boolean };

export type AuthErrorKey = 'errorCredentials' | 'errorPermission' | 'errorProfileNotFound' | 'errorGeneric';

// --- الخصائص التي سيوفرها الـ Context ---
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

    // تم حذف هذه الدالة لأنها ستكون الآن على الخادم
    // const fetchFullUserData = async (userId: string): Promise<User | null> => { ... };

    // تم حذف هذه الدالة لأنها ستكون الآن على الخادم
    // const fetchUserPermissions = useCallback(async (jobId: number | null, userId: string) => { ... }, []);

    // تم حذف هذه الدالة لأنها ستكون الآن على الخادم
    // const manageSession = useCallback(async (userId: string | null, preloadedUserData?: User) => { ... }, [fetchUserPermissions]);

    // --- دالة تسجيل الدخول المعدلة لاستخدام Cloud Function ---
    const signInAndCheckPermissions = async (credentials: any): Promise<{ success: boolean; errorKey?: AuthErrorKey }> => {
        try {
            // سنستخدم نفس نقطة النهاية للتحقق من بيانات الاعتماد
            const authResponse = await fetch('https://me-central1-project-87ba2b47-9fbd-4043-a00.cloudfunctions.net/gcp-auth-function', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            const authResult = await authResponse.json();

            if (authResult.success) {
                // بدلاً من جلب بيانات المستخدم هنا، سنرسل طلبًا جديدًا إلى الخادم
                // هذا الطلب الجديد سيجلب كل بيانات المستخدم بما في ذلك الأذونات
                const userResponse = await fetch(`http://localhost:3001/api/user/${authResult.user_id}`);
                const userData = await userResponse.json();

                if (userData.success) {
                    setUser(userData.user);
                    setPermissions(userData.permissions);
                    setIsLoading(false);
                    return { success: true };
                } else {
                    return { success: false, errorKey: 'errorProfileNotFound' };
                }
            } else {
                return { success: false, errorKey: 'errorCredentials' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, errorKey: 'errorGeneric' };
        }
    };

    const signOut = async () => {
        // يمكنك هنا إرسال طلب إلى الخادم لإنهاء الجلسة إذا كان ذلك ضروريًا
        // في الوقت الحالي، سنقوم فقط بمسح حالة المستخدم محليًا
        setUser(null);
        setPermissions({});
    };

    const updateFavorites = async (newFavorites: number[]) => {
        if (!user) return;
        setUser(currentUser => currentUser ? { ...currentUser, favorite_services: newFavorites } : null);
        try {
            // بدلاً من db.query، سنرسل طلبًا إلى الخادم لتحديث المفضلة
            await fetch(`http://localhost:3001/api/user/update-favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, favorites: newFavorites }),
            });
        } catch (error) {
            console.error("Error updating favorites:", error);
        }
    };

    const hasPermission = useCallback((key: string): boolean => {
        if (user?.is_super_admin) return true;
        return !!permissions[key];
    }, [user, permissions]);
    
    // تم تعديل useEffect ليعمل بشكل بسيط لأن المنطق أصبح على الخادم
    useEffect(() => {
        // يمكننا هنا التحقق من وجود جلسة مخزنة محليًا (مثل localStorage)
        // واستخدامها لجلب بيانات المستخدم من الخادم إذا كانت موجودة
        // ولكن للآن، سنتركها بسيطة
        setIsLoading(false);
    }, []);

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