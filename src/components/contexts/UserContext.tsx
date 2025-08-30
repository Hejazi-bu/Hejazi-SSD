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

// 1. تحديث الواجهة لتشمل المفضلات
export interface User {
  id: string;
  name_ar?: string | null;
  name_en?: string | null;
  job_id?: number | null;
  company_id?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  is_super_admin?: boolean;
  favorite_services?: number[]; // <-- إضافة جديدة
}

export type Permissions = { [key: string]: boolean };

// 2. تحديث خصائص الـ Context
interface UserContextProps {
  user: User | null;
  setUser: (user: User | null) => void; // ضروري للتحديث المتفائل
  permissions: Permissions;
  isLoading: boolean;
  hasPermission: (key: string) => boolean;
  updateFavorites: (newFavorites: number[]) => Promise<void>; // دالة تحديث المفضلات
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({});
  const [isLoading, setIsLoading] = useState(true);

  // 3. تحديث دالة جلب البيانات لتشمل المفضلات
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

  // 4. إضافة دالة لتحديث المفضلات في قاعدة البيانات
  const updateFavorites = async (newFavorites: number[]) => {
    if (!user) return;

    // تحديث متفائل للواجهة لتجربة سريعة
    setUser(currentUser => currentUser ? { ...currentUser, favorite_services: newFavorites } : null);

    // تحديث قاعدة البيانات في الخلفية
    const { error } = await supabase
      .from('users')
      .update({ favorite_services: newFavorites })
      .eq('id', user.id);

    if (error) {
      console.error("Error updating favorites:", error);
      // يمكنك هنا إعادة الحالة القديمة إذا فشل التحديث
    }
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

  const value = { user, setUser, permissions, isLoading, hasPermission, updateFavorites };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useAuth = (): UserContextProps => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a UserProvider");
  }
  return context;
};

