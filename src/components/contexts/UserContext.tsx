// src/components/contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// 🔹 نوع المستخدم النهائي
export interface User {
  id: string; // من Supabase
  email?: string; // من Supabase
  uuid?: string;
  created_at?: string;
  // الحقول المخصصة
  name_ar: string;
  name_en: string;
  job_id: number;
  job_number: string;
  role: string;
}

interface UserContextProps {
  user: User | null | undefined; // undefined = جاري التحميل
  setUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextProps>({
  user: undefined,
  setUser: () => {},
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  // 🔹 جلب بيانات المستخدم الكاملة من Supabase
  const fetchFullUserData = async (supabaseUser: SupabaseUser): Promise<User> => {
    const { data, error } = await supabase
      .from("Users") // تأكد من اسم جدول المستخدمين لديك
      .select("*")
      .eq("id", supabaseUser.id)
      .single();

    if (error || !data) return mapSupabaseUserToLocalUser(supabaseUser);

    return {
      id: supabaseUser.id,
      email: supabaseUser.email ?? undefined,
      uuid: supabaseUser.id,
      created_at: supabaseUser.created_at,
      name_ar: data.name_ar,
      name_en: data.name_en,
      job_id: data.job_id,
      job_number: data.job_number,
      role: data.role,
    };
  };

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      const supabaseUser = data.session?.user;

      if (supabaseUser) {
        const fullUser = await fetchFullUserData(supabaseUser);
        setUser(fullUser);
      } else {
        setUser(null);
      }
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const fullUser = await fetchFullUserData(session.user);
        setUser(fullUser);
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
};

// 🔹 تحويل SupabaseUser → User النهائي (افتراضي)
function mapSupabaseUserToLocalUser(supabaseUser: SupabaseUser): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? undefined,
    uuid: supabaseUser.id,
    created_at: supabaseUser.created_at,
    name_ar: "",
    name_en: "",
    job_id: 0,
    job_number: "",
    role: "",
  };
}

export const useUser = (): UserContextProps => useContext(UserContext);
