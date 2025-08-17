// src/components/contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// 🔹 نوع المستخدم النهائي
// src/components/contexts/UserContext.tsx
export interface User {
  id: string;              // من Supabase
  email?: string;          // من Supabase
  uuid?: string;
  created_at?: string;

  name_ar: string;
  name_en: string;
  job_id: number;
  job_number: string;
  role: string;
  phone?: string;
  status?: string;
  avatar_url?: string | null;
  last_login?: string;
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
    try {
      const { data, error } = await supabase
        .from("Users")
        .select("*")
        .eq("id", supabaseUser.id)
        .single();

      if (error || !data) throw error || new Error("تعذر جلب بيانات المستخدم");

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
    } catch (err) {
      console.error("خطأ في fetchFullUserData:", err);
      return mapSupabaseUserToLocalUser(supabaseUser); // بيانات بديلة
    }
  };

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const supabaseUser = data.session?.user;

        if (supabaseUser) {
          const fullUser = await fetchFullUserData(supabaseUser);
          setUser(fullUser);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("خطأ في جلب الجلسة:", err);
        setUser(null); // المستخدم غير موجود أو فشل الاتصال
      }
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchFullUserData(session.user).then(setUser);
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
};

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
    phone: "",
    status: "active",
    avatar_url: null,
    last_login: undefined,
  };
}

export const useUser = (): UserContextProps => useContext(UserContext);
