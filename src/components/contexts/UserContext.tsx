// src/components/contexts/UserContext.tsx
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
    useMemo,
    useRef,
} from "react";
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { doc, onSnapshot, DocumentData, Unsubscribe, updateDoc, Timestamp } from "firebase/firestore";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, functions } from "../../lib/firebase"; 
import { httpsCallable } from "firebase/functions";
import { useDialog } from "./DialogContext";
import { useServices } from "./ServicesContext";
import { useConnectivity } from "./ConnectivityContext";

// ============================================================================
// 1. TYPES & INTERFACES (Strict Typing 🛡️)
// ============================================================================

export interface User {
    id: string;
    
    // --- الأسماء (القديمة والجديدة) ---
    name?: string | null;
    name_ar?: string | null;
    name_en?: string | null;

    // ✅ الحقول الجديدة المطلوبة لتصحيح الأخطاء
    first_name_ar?: string | null;
    second_name_ar?: string | null;
    third_name_ar?: string | null;
    last_name_ar?: string | null;

    first_name_en?: string | null;
    second_name_en?: string | null;
    third_name_en?: string | null;
    last_name_en?: string | null;

    // --- البيانات الوظيفية ---
    employee_id?: string | null; // ✅ تم إضافته
    job_id?: number | null;
    company_id?: string | null;
    
    sector_id?: string | null;
    department_id?: string | null;
    section_id?: string | null;

    // --- بيانات الاتصال والمعلومات الشخصية ---
    email?: string | null;
    phone_number?: string | null; // ✅ تم إضافته
    gender?: string | null;       // ✅ تم إضافته
    country?: string | null;      // ✅ تم إضافته
    
    work_email?: string | null;         // ✅ تم إضافته
    work_phone?: string | null;         // ✅ تم إضافته
    landline_phone?: string | null;     // ✅ تم إضافته
    company_phone?: string | null;      // ✅ تم إضافته
    company_landline_phone?: string | null; // ✅ تم إضافته
    "alternative-phone"?: string | null;    // ✅ تم إضافته (لحل مشكلة التسمية بالواصلة)
    alternative_phone?: string | null;      // نسخة احتياطية بالتسمية القياسية

    avatar_url?: string | null;
    is_super_admin?: boolean;

    // --- الصلاحيات والحالة ---
    is_allowed?: boolean;
    is_frozen?: boolean;
    app_exception?: boolean;
    company_exception?: boolean;
    job_exception?: boolean;

    // --- العلاقات ---
    job?: { id: string; name_ar: string; name_en: string; } | null;
    company?: { id: string; name_ar: string; name_en: string; } | null;

    sector?: { id: string; name_ar: string; name_en: string; } | null;
    department?: { id: string; name_ar: string; name_en: string; } | null;
    section?: { id: string; name_ar: string; name_en: string; } | null;

    signature_url?: string | null;
    seal_url?: string | null;

    permissions_updated_at?: Timestamp;
    favorite_services?: number[] | string[];
    favorite_sub_services?: number[] | string[];
    
    // فهرس عام لأي حقول إضافية قد تأتي مستقبلاً
    [key: string]: any; 
}

// هذه الواجهة تمثل "النطاق" القادم من الدالة السحابية
interface ScopeRule {
    target_job_id?: string | null;
    scope_company_id?: string | null;
    scope_department_id?: string | null;
    scope_section_id?: string | null;
    restricted_to_company?: boolean;
    [key: string]: any;
}

export interface DelegationProfile {
    isSuperAdmin: boolean;
    accessRules: ScopeRule[];
    accessExceptions: string[];
    controlRules: ScopeRule[];
    controlExceptions: string[];
    allowed_resources: Set<string>;
    actor_company_id?: string;
}

// واجهة استجابة الدالة السحابية (Raw Data)
interface DelegationResponse {
    success: boolean;
    is_super_admin: boolean;
    accessRules: ScopeRule[];
    accessExceptions: string[];
    controlRules: ScopeRule[];
    controlExceptions: string[];
    allowed_resources: string[];
    actor_company_id?: string;
}

export type Permissions = { [key: string]: boolean };
export type AuthErrorKey = 'errorCredentials' | 'errorPermission' | 'errorProfileNotFound' | 'errorGeneric' | 'errorTooManyRequests' | 'errorAccountFrozen';
export type LockState = 'NONE' | 'GLOBAL' | 'PERMISSIONS' | 'FROZEN';

interface AuthError extends Error {
    code?: string;
}

// ============================================================================
// 2. CONTEXT INTERFACE
// ============================================================================

interface UserContextProps {
    user: User | null;
    permissions: Permissions;

    delegationProfile: DelegationProfile | null;
    isDelegationLoading: boolean;

    canGrantResource: (resourceId: string) => boolean;
    canManageScope: (
        type: 'access' | 'control', 
        target: { 
            companyId?: string, 
            jobId?: string, 
            userId?: string, 
            departmentId?: string,
            sectionId?: string 
        }
    ) => boolean;

    isLoading: boolean;
    lockState: LockState;
    hasPermission: (key: string) => boolean;

    updateFavorites: (newFavorites: number[] | string[], fieldName?: 'favorite_services' | 'favorite_sub_services') => Promise<void>;
    signInAndCheckPermissions: (credentials: { email: string, password: string }) => Promise<{ success: boolean; errorKey?: AuthErrorKey }>;
    signOut: () => Promise<void>;
    manageUserMedia: (type: 'signature' | 'seal' | 'avatar', base64Data: string | null) => Promise<{ success: boolean }>;

    refreshDelegationProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

// ============================================================================
// 3. HOOKS
// ============================================================================

export const usePermissionNotification = (watchedKeys: string[] = []) => {
    const { permissions } = useAuth();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { showDialog } = useDialog(); 
    const previousPermissionsRef = useRef<Permissions>();
    const isInitialRenderRef = useRef(true);

    useEffect(() => {
        const prev = previousPermissionsRef.current;
        if (isInitialRenderRef.current) {
            previousPermissionsRef.current = permissions;
            isInitialRenderRef.current = false;
            return;
        }

        if (prev && JSON.stringify(prev) !== JSON.stringify(permissions)) {
            const hasRelevantChange = watchedKeys.length > 0
                ? watchedKeys.some(key => prev[key] !== permissions[key])
                : true;

            if (hasRelevantChange) {
                // console.log("🔔 Permissions updated.");
            }
        }
        previousPermissionsRef.current = permissions;
    }, [permissions, watchedKeys, showDialog]);
};

// ============================================================================
// 4. PROVIDER COMPONENT
// ============================================================================

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [authUser, authLoading] = useAuthState(auth);
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permissions>({});

    const [delegationProfile, setDelegationProfile] = useState<DelegationProfile | null>(null);
    const [isDelegationLoading, setIsDelegationLoading] = useState(true);

    const [isInitialLoading, setInitialLoading] = useState(true);
    const [isAppGloballyAllowed, setAppGloballyAllowed] = useState(true);
    const [isCompanyAllowed, setIsCompanyAllowed] = useState(true);
    const [isJobAllowed, setIsJobAllowed] = useState(true);
    const [isUserDirectlyAllowed, setIsUserDirectlyAllowed] = useState(true);

    const { getParentServiceId, isServiceAllowed } = useServices();
    const { isOnline } = useConnectivity();

    const lastUserRef = useRef<User | null>(null);

    const manageUserMediaCallable = useRef(httpsCallable(functions, 'manageUserMedia'));
    const getDelegationProfileCallable = useRef(httpsCallable(functions, 'getMyDelegationProfile'));

    // --- A. Fetch Delegation Profile ---
    const fetchDelegationProfile = useCallback(async () => {
        if (!auth.currentUser) return;
        setIsDelegationLoading(true);
        try {
            const result = await getDelegationProfileCallable.current();
            const data = result.data as DelegationResponse;

            if (data.success) {
                const resourcesSet = new Set<string>(data.allowed_resources || []);

                setDelegationProfile({
                    isSuperAdmin: data.is_super_admin,
                    accessRules: data.accessRules || [],
                    accessExceptions: data.accessExceptions || [],
                    controlRules: data.controlRules || [],
                    controlExceptions: data.controlExceptions || [],
                    allowed_resources: resourcesSet,
                    actor_company_id: data.actor_company_id
                });
            }
        } catch (error) {
            console.error("Failed to fetch delegation profile", error);
        } finally {
            setIsDelegationLoading(false);
        }
    }, []);

    // --- B. Listeners Setup ---
    useEffect(() => {
        if (authLoading) return;

        if (!authUser) {
            setUser(null);
            setPermissions({});
            setDelegationProfile(null);
            setInitialLoading(false);
            setIsDelegationLoading(false);
            lastUserRef.current = null;
            return;
        }

        let isMounted = true;
        const listeners: { [key: string]: Unsubscribe | null } = {
            user: null, company: null, job: null, effectivePerms: null, app: null,
            sector: null, department: null, section: null
        };

        // 1. User Listener
        const userDocRef = doc(db, "users", authUser.uid);
        listeners.user = onSnapshot(userDocRef, async (userDocSnap) => {
            if (!isMounted) return;

            if (!userDocSnap.exists()) {
                const isFromCache = userDocSnap.metadata.fromCache;
                if (!isFromCache && isOnline) await firebaseSignOut(auth);
                return;
            }

            const userDataFromSnap = userDocSnap.data() as DocumentData;
            // التحويل هنا سيستفيد الآن من الواجهة المحدثة
            const newUserData: User = { id: userDocSnap.id, ...userDataFromSnap } as User;

            if (newUserData.is_frozen) {
                if (isOnline) await firebaseSignOut(auth);
                return;
            }

            const prevUser = lastUserRef.current;

            if (!prevUser ||
                prevUser.permissions_updated_at?.toMillis() !== newUserData.permissions_updated_at?.toMillis() ||
                prevUser.job_id !== newUserData.job_id ||
                prevUser.is_super_admin !== newUserData.is_super_admin
            ) {
                fetchDelegationProfile();
            }

            if (prevUser?.company_id !== newUserData.company_id && listeners.company) { listeners.company(); listeners.company = null; }
            if (prevUser?.job_id !== newUserData.job_id && listeners.job) { listeners.job(); listeners.job = null; }
            if (prevUser?.sector_id !== newUserData.sector_id && listeners.sector) { listeners.sector(); listeners.sector = null; }
            if (prevUser?.department_id !== newUserData.department_id && listeners.department) { listeners.department(); listeners.department = null; }
            if (prevUser?.section_id !== newUserData.section_id && listeners.section) { listeners.section(); listeners.section = null; }

            if (newUserData.company_id && !listeners.company) {
                listeners.company = onSnapshot(doc(db, "companies", newUserData.company_id), (d) => {
                    if (isMounted) setIsCompanyAllowed(d.exists() ? d.data()?.is_allowed === true : true);
                });
            }
            if (newUserData.job_id && !listeners.job) {
                listeners.job = onSnapshot(doc(db, "jobs", String(newUserData.job_id)), (d) => {
                    if (isMounted) setIsJobAllowed(d.exists() ? d.data()?.is_allowed === true : true);
                });
            }

            if (newUserData.sector_id && !listeners.sector) {
                listeners.sector = onSnapshot(doc(db, "sectors", newUserData.sector_id), (d) => {
                    if (isMounted && d.exists()) {
                        const data = d.data()!;
                        setUser(u => u ? { ...u, sector: { id: d.id, name_ar: data.name_ar, name_en: data.name_en } } : null);
                    }
                });
            }
            if (newUserData.department_id && !listeners.department) {
                listeners.department = onSnapshot(doc(db, "departments", newUserData.department_id), (d) => {
                    if (isMounted && d.exists()) {
                        const data = d.data()!;
                        setUser(u => u ? { ...u, department: { id: d.id, name_ar: data.name_ar, name_en: data.name_en } } : null);
                    }
                });
            }
            if (newUserData.section_id && !listeners.section) {
                listeners.section = onSnapshot(doc(db, "sections", newUserData.section_id), (d) => {
                    if (isMounted && d.exists()) {
                        const data = d.data()!;
                        setUser(u => u ? { ...u, section: { id: d.id, name_ar: data.name_ar, name_en: data.name_en } } : null);
                    }
                });
            }

            setUser(newUserData);
            lastUserRef.current = newUserData;
            setIsUserDirectlyAllowed(newUserData.is_allowed === true);

            // 2. Effective Permissions Listener
            if (!listeners.effectivePerms) {
                if (newUserData.id === authUser.uid) {
                    const permsRef = doc(db, `users/${newUserData.id}/private_data/effective_permissions`);
                    listeners.effectivePerms = onSnapshot(permsRef, { includeMetadataChanges: true }, (docSnap) => {
                        if (isMounted) {
                            if (docSnap.exists()) {
                                setPermissions(docSnap.data().permissions as Permissions);
                            } else {
                                setPermissions({ general_access: true });
                            }
                            setInitialLoading(false);
                        }
                    }, (error) => {
                        console.warn("Permission read denied:", error.message);
                        setInitialLoading(false);
                    });
                }
            }
        });

        // 3. Global App Settings
        listeners.app = onSnapshot(doc(db, "app", "settings"), (docSnap) => {
            if (isMounted) setAppGloballyAllowed(docSnap.exists() ? docSnap.data()?.is_allowed === true : true);
        });

        return () => {
            isMounted = false;
            Object.values(listeners).forEach(unsubscribe => unsubscribe && unsubscribe());
        };
    }, [authLoading, authUser, isOnline, fetchDelegationProfile]);

    // --- C. Computed State (Permissions Logic) ---

    const lockState = useMemo((): LockState => {
        if (user?.is_super_admin === true) return 'NONE';
        if (user?.is_frozen) return 'FROZEN';
        if (!isAppGloballyAllowed && !(user?.app_exception)) return 'GLOBAL';
        if (!isUserDirectlyAllowed) return 'PERMISSIONS';
        if (!isCompanyAllowed && !(user?.company_exception)) return 'PERMISSIONS';
        if (!isJobAllowed && !(user?.job_exception)) return 'PERMISSIONS';
        return 'NONE';
    }, [user, isAppGloballyAllowed, isCompanyAllowed, isJobAllowed, isUserDirectlyAllowed]);

    const hasPermission = useCallback((key: string): boolean => {
        if (!key) return true;
        if (user?.is_super_admin === true) return true;
        if (lockState !== 'NONE') return false;

        const hasDirectPermission = !!permissions[key];
        if (!hasDirectPermission) return false;

        if (!isServiceAllowed(key)) return false;

        if (key.startsWith("ss:") || key.startsWith("sss:")) {
            const parentServiceId = getParentServiceId(key);
            if (parentServiceId && (!permissions[parentServiceId] || !isServiceAllowed(parentServiceId))) {
                return false;
            }
        }
        return true;
    }, [user, permissions, getParentServiceId, isServiceAllowed, lockState]);

    // --- D. Helper Functions (Frontend Validation) ---

    const canGrantResource = useCallback((resourceId: string): boolean => {
        if (user?.is_super_admin === true) return true;
        if (!delegationProfile) return false;
        if (delegationProfile.isSuperAdmin) return true;
        return delegationProfile.allowed_resources.has(resourceId);
    }, [delegationProfile, user]);

    const canManageScope = useCallback((
        type: 'access' | 'control', 
        target: { companyId?: string, jobId?: string, userId?: string, departmentId?: string, sectionId?: string }
    ): boolean => {
        if (user?.is_super_admin === true) return true;
        if (!delegationProfile) return false;
        if (delegationProfile.isSuperAdmin) return true;

        const modesToCheck = type === 'access' ? ['access', 'control'] : ['control'];

        for (const mode of modesToCheck) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const profile = delegationProfile as any;
            const exceptions = profile[`${mode}Exceptions`] as string[];
            const rules = profile[`${mode}Rules`] as ScopeRule[];

            if (target.userId && exceptions.includes(target.userId)) return true;

            const hasMatchingRule = rules.some(rule => {
                if (rule.target_job_id && String(rule.target_job_id) !== String(target.jobId)) return false;
                if (rule.scope_company_id && String(rule.scope_company_id) !== String(target.companyId)) return false;

                if (rule.restricted_to_company && delegationProfile.actor_company_id) {
                    if (String(delegationProfile.actor_company_id) !== String(target.companyId)) return false;
                }

                if (rule.scope_department_id) {
                    if (!target.departmentId || String(rule.scope_department_id) !== String(target.departmentId)) return false;
                }

                if (rule.scope_section_id) {
                    if (!target.sectionId || String(rule.scope_section_id) !== String(target.sectionId)) return false;
                }

                return true;
            });

            if (hasMatchingRule) return true;
        }
        return false;
    }, [delegationProfile, user]);

    // --- E. Auth Actions ---

    const signInAndCheckPermissions = async (credentials: { email: string, password: string }) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
            const tokenResult = await userCredential.user.getIdTokenResult();
            if (tokenResult.claims.disabled) {
                await firebaseSignOut(auth);
                return { success: false, errorKey: 'errorAccountFrozen' as AuthErrorKey };
            }
            return { success: true };
        } catch (error: unknown) {
            const authError = error as AuthError;
            if (authError.code === 'auth/user-disabled') return { success: false, errorKey: 'errorAccountFrozen' as AuthErrorKey };
            if (authError.code === 'auth/too-many-requests') return { success: false, errorKey: 'errorTooManyRequests' as AuthErrorKey };
            if (authError.code === 'auth/wrong-password' || authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') return { success: false, errorKey: 'errorCredentials' as AuthErrorKey };
            return { success: false, errorKey: 'errorGeneric' as AuthErrorKey };
        }
    };

    const signOut = useCallback(async () => {
        if (!isOnline) return;
        await firebaseSignOut(auth);
        setUser(null);
        setDelegationProfile(null);
        lastUserRef.current = null;
    }, [isOnline]);

    const updateFavorites = useCallback(async (newFavorites: number[] | string[], fieldName: 'favorite_services' | 'favorite_sub_services' = 'favorite_services') => {
        if (!user) return;
        try {
            const userDocRef = doc(db, "users", user.id);
            await updateDoc(userDocRef, { [fieldName]: newFavorites });
        } catch (error) { console.error("Error updating favorites", error); }
    }, [user]);

    const manageUserMedia = useCallback(async (type: 'signature' | 'seal' | 'avatar', base64Data: string | null) => {
        try {
            await manageUserMediaCallable.current({ type, base64Data });
            return { success: true };
        } catch (error) {
            console.error("Media management failed", error);
            return { success: false };
        }
    }, []);

    const finalIsLoading = isInitialLoading || authLoading;

    const value = {
        user,
        permissions,
        delegationProfile,
        isDelegationLoading,
        refreshDelegationProfile: fetchDelegationProfile,
        canGrantResource,
        canManageScope,
        isLoading: finalIsLoading,
        lockState,
        hasPermission,
        updateFavorites,
        signInAndCheckPermissions,
        signOut,
        manageUserMedia
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useAuth = (): UserContextProps => {
    const context = useContext(UserContext);
    if (context === undefined) throw new Error("useAuth must be used within a UserProvider");
    return context;
};