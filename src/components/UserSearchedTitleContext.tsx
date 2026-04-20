"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  userTitle: string | null;
  setUserTitle: (v: string | null) => void;
};

const UserSearchedTitleContext = createContext<Ctx | undefined>(undefined);

export function UserSearchedTitleProvider({ children }: { children: ReactNode }) {
  const [userTitle, setUserTitleState] = useState<string | null>(null);
  const setUserTitle = useCallback((v: string | null) => {
    setUserTitleState(v);
  }, []);
  const value = useMemo(() => ({ userTitle, setUserTitle }), [userTitle, setUserTitle]);
  return <UserSearchedTitleContext.Provider value={value}>{children}</UserSearchedTitleContext.Provider>;
}

/** 未設定のときは undefined（Provider 外では使わない想定） */
export function useUserSearchedTitle(): Ctx | undefined {
  return useContext(UserSearchedTitleContext);
}
