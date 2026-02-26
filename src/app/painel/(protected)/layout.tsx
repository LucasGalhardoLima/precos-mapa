import { requireSessionContext } from "@/features/auth/session";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PanelClientProviders } from "@/features/panel/panel-client-providers";
import { PanelShell } from "@/features/panel/components/panel-shell";
import { MarketSummary } from "@/features/shared/types";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function mapPlan(b2bPlan: string): MarketSummary["plan"] {
  if (b2bPlan === "premium" || b2bPlan === "premium_plus") return "Pro";
  if (b2bPlan === "enterprise") return "Enterprise";
  return "Free";
}

export default async function ProtectedPanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSessionContext();

  let stores;
  if (session.role === "super_admin") {
    const { data } = await supabaseAdmin
      .from("stores")
      .select("id, name, city, state, b2b_plan, is_active");
    stores = data ?? [];
  } else {
    const { data } = await supabaseAdmin
      .from("stores")
      .select("id, name, city, state, b2b_plan, is_active")
      .in("id", session.availableMarketIds.length > 0 ? session.availableMarketIds : ["__none__"]);
    stores = data ?? [];
  }

  const markets: MarketSummary[] = stores.map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    state: s.state,
    status: s.is_active ? "ativo" : "pendente",
    plan: mapPlan(s.b2b_plan),
    activeOffers: 0,
    monthlyViews: 0,
    monthlyClicks: 0,
    conversionRate: 0,
  }));

  return (
    <PanelClientProviders session={session}>
      <PanelShell session={session} markets={markets}>
        {children}
      </PanelShell>
    </PanelClientProviders>
  );
}
