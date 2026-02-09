import { ImporterWorkbench } from "@/features/market-importer/importer-workbench";
import { SectionHeader } from "@/features/panel/components/section-header";
import { PanelClientProviders } from "@/features/panel/panel-client-providers";
import { mockMarkets } from "@/features/shared/mock-data";
import { SessionContext } from "@/features/shared/types";

export default function PublicDemoPage() {
  const market = mockMarkets[0];

  const demoSession: SessionContext = {
    role: "admin_mercado",
    currentMarketId: market.id,
    availableMarketIds: [market.id],
    userName: "Demo Mercado",
    userEmail: "demo@precomapa.app",
  };

  return (
    <PanelClientProviders session={demoSession}>
      <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 md:px-6">
        <SectionHeader
          title="Demo Importador IA"
          subtitle="Versão pública da demonstração com dados de mercado mockados. Não requer login."
        />
        <ImporterWorkbench />
      </div>
    </PanelClientProviders>
  );
}
