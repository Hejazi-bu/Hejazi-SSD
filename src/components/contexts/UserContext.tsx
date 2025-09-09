import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
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
  email?: string;
  avatar_url?: string | null;
  is_super_admin?: boolean;
  favorite_services?: number[];
  app_metadata: SupabaseUser['app_metadata'];
  user_metadata: SupabaseUser['user_metadata'];
  aud: SupabaseUser['aud'];
  created_at: SupabaseUser['created_at'];
}

export type Permissions = { [key: string]: boolean };

export type AuthErrorKey = 'errorCredentials' | 'errorPermission' | 'errorProfileNotFound' | 'errorGeneric';

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
  
  const fetchPermissions = useCallback(async () => {
    const { data: permissionsResult, error: permissionsError } = await supabase.rpc('get_user_effective_permissions');
    if (permissionsError) {
      console.error("خطأ في جلب صلاحيات الخدمات:", permissionsError);
    }
    setPermissions(permissionsResult || {});
  }, []);

  const manageSession = useCallback(async (supaUser: SupabaseUser | null, preloadedUserData?: User) => {
    if (supaUser) {
      const userData = preloadedUserData || await fetchFullUserData(supaUser);
      if (userData) {
        setUser(userData);
        await fetchPermissions();
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
  }, [fetchPermissions]);

  const signInAndCheckPermissions = async (credentials: SignInWithPasswordCredentials): Promise<{ success: boolean; errorKey?: AuthErrorKey }> => {
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword(credentials);
    if (signInError) return { success: false, errorKey: 'errorCredentials' };

    if (sessionData.user) {
      const { data: hasAccess, error: permissionError } = await supabase.rpc('check_permission', { p_user_id: sessionData.user.id, p_permission_id: 'general_access' });
      if (permissionError) {
        console.error("خطأ في دالة check_permission:", permissionError);
        await supabase.auth.signOut();
        return { success: false, errorKey: 'errorGeneric' };
      }
      if (hasAccess !== true) {
        await supabase.auth.signOut();
        return { success: false, errorKey: 'errorPermission' };
      }
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
    const setupUserAndPermissions = async (supaUser: SupabaseUser | null) => {
      setIsLoading(true);
      if (supaUser) {
        const userData = await fetchFullUserData(supaUser);
        if (userData) {
          setUser(userData);
          await fetchPermissions();
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
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setupUserAndPermissions(session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setupUserAndPermissions(session?.user ?? null);
    });
    
    const realtimeChannel = supabase.channel('permission_changes_channel');
    const handleRealtimeUpdate = () => {
      console.log('Realtime update detected. Re-fetching permissions.');
      fetchPermissions();
    };

    realtimeChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_permissions' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_permissions' }, handleRealtimeUpdate)
      .subscribe();
    
    return () => {
      authListener.subscription.unsubscribe();
      realtimeChannel.unsubscribe();
    };
  }, [fetchPermissions]);
  
  const hasPermission = useCallback((key: string): boolean => {
    if (user?.is_super_admin) return true;
    if (isLoading || !permissions) return false;
    return permissions[key] === true;
  }, [user, permissions, isLoading]);
  
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