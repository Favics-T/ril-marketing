"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const DraftSession = createContext<{ dirty: boolean; setDirty: (dirty: boolean) => void }>({ dirty: false, setDirty: () => undefined });
export function DraftSessionProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const value = useMemo(() => ({ dirty, setDirty }), [dirty]);
  return <DraftSession.Provider value={value}>{children}</DraftSession.Provider>;
}
export const useDraftSession = () => useContext(DraftSession);
