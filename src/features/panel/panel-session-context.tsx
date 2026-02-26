"use client";

import { createContext, useContext, useEffect } from "react";
import { create } from "zustand";
import { SessionContext } from "@/features/shared/types";

interface PanelSessionState {
  session: SessionContext | null;
  setSession: (session: SessionContext) => void;
}

const usePanelSessionStore = create<PanelSessionState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));

const PanelSessionContext = createContext<SessionContext | null>(null);

interface PanelSessionProviderProps {
  initialSession: SessionContext;
  children: React.ReactNode;
}

export function PanelSessionProvider({ initialSession, children }: PanelSessionProviderProps) {
  useEffect(() => {
    usePanelSessionStore.getState().setSession(initialSession);
  }, [initialSession]);

  return <PanelSessionContext.Provider value={initialSession}>{children}</PanelSessionContext.Provider>;
}

export function usePanelSession(): SessionContext {
  const session = usePanelSessionStore((state) => state.session);
  const contextSession = useContext(PanelSessionContext);
  if (contextSession) {
    return contextSession;
  }

  if (!session) {
    throw new Error("usePanelSession must be used after session hydration");
  }

  return session;
}
