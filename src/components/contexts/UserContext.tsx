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
  email?: string | null;
  avatar_url?: string | null;
  is_super_admin?: boolean;
  favorite_services?: number[];
}

export type Permissions = { [key: string]: boolean };

// --- ✅ تعديل: تعريف نوع مخصص لمفاتيح الأخطاء ---
export type AuthErrorKey = 'errorCredentials' | 'errorPermission' | 'errorProfileNotFound' | 'errorGeneric';

// --- الخصائص التي سيوفرها الـ Context ---
interface UserContextProps {
  user: User | null;
  // صلاحيات الخدمات لم تعد موجودة مؤقتاً
  permissions: Permissions; 
  isLoading: boolean;
  hasPermission: (key: string) => boolean;
  updateFavorites: (newFavorites: number[]) => Promise<void>;
  // --- ✅ تعديل: استخدام النوع الجديد في تعريف الدالة ---
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

  const manageSession = useCallback(async (supaUser: SupabaseUser | null, preloadedUserData?: User) => {
    if (supaUser) {
        const userData = preloadedUserData || await fetchFullUserData(supaUser);
        if (userData) {
            setUser(userData);
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
  }, []);

  const signInAndCheckPermissions = async (credentials: SignInWithPasswordCredentials): Promise<{ success: boolean; errorKey?: AuthErrorKey }> => {
    // 1. المصادقة
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword(credentials);
    if (signInError) return { success: false, errorKey: 'errorCredentials' };

    if (sessionData.user) {
      // 2. تم إزالة التحقق من الصلاحيات العامة مؤقتاً
      
      // 3. جلب ملف المستخدم
      const userData = await fetchFullUserData(sessionData.user);
      if (!userData) {
        await supabase.auth.signOut();
        return { success: false, errorKey: 'errorProfileNotFound' };
      }

      // 4. كل شيء ناجح
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      manageSession(session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      manageSession(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [manageSession]);

  const hasPermission = useCallback((key: string): boolean => {
      if (user?.is_super_admin) return true;
      // تم تعطيل فحص الصلاحيات مؤقتاً
      return true;
  }, [user]);
  
  const updateFavorites = async (newFavorites: number[]) => {
      if (!user) return;
      setUser(currentUser => currentUser ? { ...currentUser, favorite_services: newFavorites } : null);
      const { error } = await supabase
        .from('users')
        .update({ favorite_services: newFavorites })
        .eq('id', user.id);
      if (error) console.error("Error updating favorites:", error);
  };

  const value = { user, permissions: {}, isLoading, hasPermission, updateFavorites, signInAndCheckPermissions, signOut };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useAuth = (): UserContextProps => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a UserProvider");
  }
  return context;
};