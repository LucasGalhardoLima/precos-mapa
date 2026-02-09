"use client";

import { OffersStoreProvider } from "@/features/offers/offers-store";
import { PanelSessionProvider } from "@/features/panel/panel-session-context";
import { SessionContext } from "@/features/shared/types";

interface PanelClientProvidersProps {
  session: SessionContext;
  children: React.ReactNode;
}

export function PanelClientProviders({ session, children }: PanelClientProvidersProps) {
  return (
    <PanelSessionProvider initialSession={session}>
      <OffersStoreProvider>{children}</OffersStoreProvider>
    </PanelSessionProvider>
  );
}
