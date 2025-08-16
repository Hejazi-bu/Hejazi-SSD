// src/components/contexts/UserContext.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";
import type { User as UserType } from "../../types/user";

export interface User extends UserType {
  uuid?: string;        // إذا كانت موجودة من Supabase
  created_at?: string;  // إذا كانت موجودة من Supabase
}

interface UserContextProps {
  user: User | null;
  setUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextProps>({
  user: null,
  setUser: () => {}, // وظيفة افتراضية لتجنب undefined
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null); // يبدأ بـ null

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextProps => useContext(UserContext);
