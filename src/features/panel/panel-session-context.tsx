"use client";

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

interface PanelSessionProviderProps {
  initialSession: SessionContext;
  children: React.ReactNode;
}

export function PanelSessionProvider({ initialSession, children }: PanelSessionProviderProps) {
  const currentSession = usePanelSessionStore.getState().session;
  if (
    !currentSession ||
    currentSession.role !== initialSession.role ||
    currentSession.currentMarketId !== initialSession.currentMarketId ||
    currentSession.userEmail !== initialSession.userEmail
  ) {
    usePanelSessionStore.getState().setSession(initialSession);
  }

  return <>{children}</>;
}

export function usePanelSession(): SessionContext {
  const session = usePanelSessionStore((state) => state.session);

  if (!session) {
    throw new Error("usePanelSession must be used after session hydration");
  }

  return session;
}
