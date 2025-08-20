// src/components/contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// src/types/user.ts
export interface User {
  id: string;
  uuid?: string;
  created_at?: string;

  name_ar?: string | null;
  name_en?: string | null;
  job_id?: number | null;
  job_number?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  avatar_url?: string | null;
  last_login?: string;

  isFallback?: boolean;
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

  const fetchFullUserData = async (supabaseUser: SupabaseUser): Promise<User> => {
    try {
      const { data, error } = await supabase
        .from("Users")
        .select("*")
        .eq("id", supabaseUser.id)
        .single();

      if (error || !data) {
        console.warn("تعذر جلب بيانات كاملة، استخدام البيانات الأساسية من Supabase");
        return mapSupabaseUserToLocalUser(supabaseUser);
      }

      return {
        id: supabaseUser.id,
        email: data.email ?? supabaseUser.email ?? null,
        uuid: supabaseUser.id,
        created_at: supabaseUser.created_at,
        name_ar: data.name_ar ?? null,
        name_en: data.name_en ?? null,
        job_id: data.job_id ?? null,
        job_number: data.job_number ?? null,
        role: data.role ?? "user",
        phone: data.phone ?? null,
        status: data.status ?? "active",
        avatar_url: data.avatar_url ?? null,
        last_login: new Date().toISOString(),
      };
    } catch (err) {
      console.error("خطأ في fetchFullUserData:", err);
      return mapSupabaseUserToLocalUser(supabaseUser);
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
        setUser(null);
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
    email: supabaseUser.email ?? null,
    uuid: supabaseUser.id,
    created_at: supabaseUser.created_at,
    name_ar: null,
    name_en: null,
    job_id: null,
    job_number: null,
    role: "user",
    phone: null,
    status: "active",
    avatar_url: null,
    last_login: undefined,
  };
}

export const useUser = (): UserContextProps => useContext(UserContext);
