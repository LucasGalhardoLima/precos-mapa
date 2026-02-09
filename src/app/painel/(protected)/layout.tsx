import { requireSessionContext } from "@/features/auth/session";
import { PanelClientProviders } from "@/features/panel/panel-client-providers";
import { PanelShell } from "@/features/panel/components/panel-shell";
import { mockMarkets } from "@/features/shared/mock-data";

export default async function ProtectedPanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSessionContext();

  return (
    <PanelClientProviders session={session}>
      <PanelShell session={session} markets={mockMarkets}>
        {children}
      </PanelShell>
    </PanelClientProviders>
  );
}
