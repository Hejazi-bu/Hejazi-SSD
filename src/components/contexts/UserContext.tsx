import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
    useRef,
} from "react";
import { supabase } from "../../lib/supabaseClient";
import type { User as SupabaseUser, SignInWithPasswordCredentials } from "@supabase/supabase-js";

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
    signInAndCheckPermissions: (credentials: SignInWithPasswordCredentials) => Promise<{ success: boolean; errorKey?: AuthErrorKey }>;
    signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permissions>({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchFullUserData = async (supabaseUser: SupabaseUser): Promise<User | null> => {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", supabaseUser.id)
            .single();
        if (error) {
            console.error("خطأ في جلب بيانات المستخدم:", error);
            return null;
        }
        return data as User;
    };
    
    const fetchUserPermissions = useCallback(async (jobId: number | null, userId: string) => {
        const combinedPermissions: Permissions = {};

        if (jobId) {
            const { data: jobPermissionsData, error: jobPermissionsError } = await supabase
                .from('job_permissions')
                .select('service_id, sub_service_id, sub_sub_service_id')
                .eq('job_id', jobId);

            if (!jobPermissionsError) {
                (jobPermissionsData || []).forEach(p => {
                    if (p.sub_sub_service_id) combinedPermissions[`sss:${p.sub_sub_service_id}`] = true;
                    else if (p.sub_service_id) combinedPermissions[`ss:${p.sub_service_id}`] = true;
                    else combinedPermissions[`s:${p.service_id}`] = true;
                });
            }
        }

        const { data: userPermissionsData, error: userPermissionsError } = await supabase
            .from('user_permissions')
            .select('service_id, sub_service_id, sub_sub_service_id, is_allowed')
            .eq('user_id', userId);

        if (!userPermissionsError) {
            (userPermissionsData || []).forEach(p => {
                if (p.sub_sub_service_id) combinedPermissions[`sss:${p.sub_sub_service_id}`] = p.is_allowed;
                else if (p.sub_service_id) combinedPermissions[`ss:${p.sub_service_id}`] = p.is_allowed;
                else combinedPermissions[`s:${p.service_id}`] = p.is_allowed;
            });
        }

        return combinedPermissions;
    }, []);

    const manageSession = useCallback(async (supaUser: SupabaseUser | null, preloadedUserData?: User) => {
        if (supaUser) {
            const userData = preloadedUserData || await fetchFullUserData(supaUser);
            if (userData) {
                setUser(userData);
                const userPermissions = await fetchUserPermissions(userData.job_id ?? null, userData.id);
                setPermissions(userPermissions);
            } else {
                await supabase.auth.signOut();
                setUser(null);
                setPermissions({});
            }
        } else {
            setUser(null);
            setPermissions({});
        }
        setIsLoading(false);
    }, [fetchUserPermissions]);

    const signInAndCheckPermissions = async (credentials: SignInWithPasswordCredentials): Promise<{ success: boolean; errorKey?: AuthErrorKey }> => {
        const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword(credentials);
        if (signInError) return { success: false, errorKey: 'errorCredentials' };

        if (sessionData.user) {
            const userData = await fetchFullUserData(sessionData.user);
            if (!userData) {
                await supabase.auth.signOut();
                return { success: false, errorKey: 'errorProfileNotFound' };
            }
            await manageSession(sessionData.user, userData);
            return { success: true };
        }
        return { success: false, errorKey: 'errorGeneric' };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setPermissions({});
    };

    useEffect(() => {
        setIsLoading(true);
        const getInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            await manageSession(session?.user ?? null);
        };
        getInitialSession();
        
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            manageSession(session?.user ?? null);
        });
        
        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [manageSession]);

    useEffect(() => {
        let userChannel: any;
        let jobChannel: any;

        const subscribeToPermissions = () => {
            if (!user) return;

            userChannel = supabase
                .channel(`user_permissions_${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'user_permissions',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        console.log('User permissions change received!', payload);
                        fetchUserPermissions(user.job_id ?? null, user.id).then(setPermissions);
                    }
                )
                .subscribe();
                
            if (user.job_id) {
                jobChannel = supabase
                    .channel(`job_permissions_${user.job_id}`)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'job_permissions',
                            filter: `job_id=eq.${user.job_id}`,
                        },
                        (payload) => {
                            console.log('Job permissions change received!', payload);
                            fetchUserPermissions(user.job_id ?? null, user.id).then(setPermissions);
                        }
                    )
                    .subscribe();
            }
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


    const hasPermission = useCallback((key: string): boolean => {
        if (user?.is_super_admin) return true;
        return !!permissions[key];
    }, [user, permissions]);
    
    const updateFavorites = async (newFavorites: number[]) => {
        if (!user) return;
        setUser(currentUser => currentUser ? { ...currentUser, favorite_services: newFavorites } : null);
        const { error } = await supabase
            .from('users')
            .update({ favorite_services: newFavorites })
            .eq('id', user.id);
        if (error) console.error("Error updating favorites:", error);
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