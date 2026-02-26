import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";
import { MercadosClient } from "./mercados-client";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  premium: "Premium",
  premium_plus: "Premium+",
  enterprise: "Enterprise",
};

export interface MarketRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  plan: string;
  b2b_plan: string;
  activeOffers: number;
  status: "ativo" | "inativo";
  is_active: boolean;
}

export default async function SuperMarketsPage() {
  await requirePermission("market:manage");
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [{ data: stores }, { data: activePromos }] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name, address, city, state, latitude, longitude, b2b_plan, is_active")
      .order("name"),
    supabase
      .from("promotions")
      .select("store_id")
      .eq("status", "active")
      .gt("end_date", now),
  ]);

  // Count active promotions per store
  const promoCounts = new Map<string, number>();
  for (const p of activePromos ?? []) {
    promoCounts.set(p.store_id, (promoCounts.get(p.store_id) ?? 0) + 1);
  }

  const markets: MarketRow[] = (stores ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    address: (s.address as string) ?? "",
    city: s.city as string,
    state: s.state as string,
    latitude: s.latitude as number,
    longitude: s.longitude as number,
    plan: PLAN_LABELS[s.b2b_plan as string] ?? (s.b2b_plan as string),
    b2b_plan: s.b2b_plan as string,
    activeOffers: promoCounts.get(s.id as string) ?? 0,
    status: (s.is_active ? "ativo" : "inativo") as "ativo" | "inativo",
    is_active: s.is_active as boolean,
  }));

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Mercados"
        subtitle="Gestao de contas dos supermercados com status, plano e ofertas ativas."
      />
      <MercadosClient markets={markets} />
    </div>
  );
}
