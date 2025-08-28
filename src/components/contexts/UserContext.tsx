// src/components/contexts/UserContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { supabase } from "../../lib/supabaseClient";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// الواجهة الآن تحتوي فقط على البيانات الأساسية من جدول users
export interface User {
  id: string;
  name_ar?: string | null;
  name_en?: string | null;
  job_id?: number | null;
  company_id?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  is_super_admin?: boolean;
}

export type Permissions = { [key: string]: boolean };

interface UserContextProps {
  user: User | null;
  permissions: Permissions;
  isLoading: boolean;
  hasPermission: (key: string) => boolean;
}

const UserContext = createContext<UserContextProps>({
  user: null,
  permissions: {},
  isLoading: true,
  hasPermission: () => false,
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({});
  const [isLoading, setIsLoading] = useState(true);

  // الاستعلام بسيط ومباشر لضمان عدم فشله
  const fetchFullUserData = async (
    supabaseUser: SupabaseUser
  ): Promise<User | null> => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", supabaseUser.id)
      .single();

    if (error) {
      console.error("المستخدم غير موجود في جدول users، يتم تسجيل الخروج.", error);
      await supabase.auth.signOut();
      return null;
    }
    return data as User;
  };

  useEffect(() => {
    const manageSession = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const [userData, permissionsResult] = await Promise.all([
          fetchFullUserData(session.user),
          supabase.rpc('get_user_effective_permissions'),
        ]);

        if (userData) {
          setUser(userData);
          setPermissions(permissionsResult.data || {});
          if (permissionsResult.error) {
            console.error("خطأ في جلب الصلاحيات:", permissionsResult.error);
          }
        } else {
          setUser(null);
          setPermissions({});
        }
      } else {
        setUser(null);
        setPermissions({});
      }
      setIsLoading(false);
    };

    manageSession();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      manageSession();
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const hasPermission = useCallback(
    (key: string): boolean => {
      if (user?.is_super_admin) return true;
      if (isLoading || !permissions) return false;
      return permissions[key] === true;
    },
    [user, permissions, isLoading]
  );

  const value = { user, permissions, isLoading, hasPermission };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useAuth = (): UserContextProps => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a UserProvider");
  }
  return context;
};
