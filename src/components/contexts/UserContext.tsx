// src/components/contexts/UserContext.tsx (كامل ومحدث)
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
} from "react";
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; 

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
    is_allowed?: boolean;
    job?: { 
        id: number;
        name_ar: string;
        name_en: string;
    } | null;
    // 🆕 إضافة حقل جديد لبيانات الشركة
    company?: {
        id: string;
        name_ar: string;
        name_en: string;
    } | null;
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
    signInAndCheckPermissions: (credentials: { email: string, password: string }) => Promise<{ success: boolean; errorKey?: AuthErrorKey }>;
    signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permissions>({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchFullUserData = async (userId: string): Promise<User | null> => {
        try {
            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data() as Omit<User, 'id'>;
                return { id: userDocSnap.id, ...userData };
            }
            console.log("No such user profile in Firestore!");
            return null;
        } catch (error) {
            console.error("Error fetching user data from Firestore:", error);
            return null;
        }
    };

    const fetchJobData = async (jobId: number | null): Promise<any> => {
        if (!jobId) return null;
        try {
            const jobDocRef = doc(db, "jobs", String(jobId));
            const jobDocSnap = await getDoc(jobDocRef);
            if (jobDocSnap.exists()) {
                return { id: jobDocSnap.id, ...jobDocSnap.data() };
            }
            console.log("No such job profile in Firestore!");
            return null;
        } catch (error) {
            console.error("Error fetching job data:", error);
            return null;
        }
    };
    
    // 🆕 دالة جديدة لجلب بيانات الشركة
    const fetchCompanyData = async (companyId: string | null): Promise<any> => {
        if (!companyId) return null;
        try {
            const companyDocRef = doc(db, "companies", companyId);
            const companyDocSnap = await getDoc(companyDocRef);
            if (companyDocSnap.exists()) {
                return { id: companyDocSnap.id, ...companyDocSnap.data() };
            }
            console.log("No such company profile in Firestore!");
            return null;
        } catch (error) {
            console.error("Error fetching company data:", error);
            return null;
        }
    };

    const fetchUserPermissions = useCallback(async (jobId: number | null, userId: string): Promise<Permissions> => {
        if (!jobId) return {};
        const permissions: Permissions = {};
        try {
            console.log(`Fetching permissions for jobId: ${jobId}`);
        } catch (error) {
            console.error("Error fetching permissions:", error);
        }
        return permissions;
    }, []);

    const signInAndCheckPermissions = async (credentials: { email: string, password: string }): Promise<{ success: boolean; errorKey?: AuthErrorKey }> => {
        setIsLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
            const firebaseUser = userCredential.user;

            const userData = await fetchFullUserData(firebaseUser.uid);
            if (!userData) {
                await firebaseSignOut(auth);
                return { success: false, errorKey: 'errorProfileNotFound' };
            }

            if (!userData.is_allowed) {
                await firebaseSignOut(auth);
                return { success: false, errorKey: 'errorPermission' };
            }
            
            // 🆕 جلب بيانات الوظيفة والشركة بعد الحصول على بيانات المستخدم
            const jobData = await fetchJobData(userData.job_id || null);
            const companyData = await fetchCompanyData(userData.company_id || null);
            const userPermissions = await fetchUserPermissions(userData.job_id || null, userData.id);

            setUser({ ...userData, job: jobData, company: companyData });
            setPermissions(userPermissions);
            
            setIsLoading(false);
            return { success: true };
        } catch (error: any) {
            setIsLoading(false);
            console.error('Login error:', error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                return { success: false, errorKey: 'errorCredentials' };
            }
            return { success: false, errorKey: 'errorGeneric' };
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUser(null);
            setPermissions({});
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const updateFavorites = async (newFavorites: number[]) => {
        if (!user) return;
        const updatedUser = { ...user, favorite_services: newFavorites };
        setUser(updatedUser);
        try {
            console.log("Favorites updated locally. Firebase update logic pending.");
        } catch (error) {
            console.error("Error updating favorites:", error);
        }
    };

    const hasPermission = useCallback((key: string): boolean => {
        if (user?.is_super_admin) return true;
        return !!permissions[key];
    }, [user, permissions]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setIsLoading(true);
                const userData = await fetchFullUserData(firebaseUser.uid);
                if (userData && userData.is_allowed) {
                    const jobData = await fetchJobData(userData.job_id || null);
                    const companyData = await fetchCompanyData(userData.company_id || null);
                    const userPermissions = await fetchUserPermissions(userData.job_id || null, userData.id);
                    setUser({ ...userData, job: jobData, company: companyData });
                    setPermissions(userPermissions);
                } else {
                    await firebaseSignOut(auth);
                    setUser(null);
                    setPermissions({});
                }
            } else {
                setUser(null);
                setPermissions({});
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [fetchUserPermissions]);

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