// src/components/contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User as LocalUser } from "../../types/user";

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

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      const supabaseUser = data.session?.user;

      if (supabaseUser) {
        setUser(mapSupabaseUserToLocalUser(supabaseUser));
      } else {
        setUser(null);
      }
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(mapSupabaseUserToLocalUser(session.user));
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
};

// 🔹 تحويل SupabaseUser → User النهائي
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
