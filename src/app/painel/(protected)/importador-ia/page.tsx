import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/features/auth/session";
import { SectionHeader } from "@/features/panel/components/section-header";
import { ImporterWorkbench } from "@/features/market-importer/importer-workbench";

// Service-role client bypasses RLS (avoids profiles recursion)
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function ImportadorIaPage() {
  const session = await requirePermission("importer:use");

  const isSuperAdmin = session.role === "super_admin";

  let query = supabaseAdmin
    .from("stores")
    .select("id, name, city, state")
    .order("name");

  if (!isSuperAdmin) {
    query = query.in("id", session.availableMarketIds);
  }

  const { data: stores } = await query;

  const markets = (stores ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    city: s.city as string,
    state: s.state as string,
  }));

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Importador IA"
        subtitle="Pipeline de extração com URL/PDF, revisão humana e publicação simulada nas ofertas do mercado ativo."
      />
      <ImporterWorkbench markets={markets} defaultMarketId={session.currentMarketId} />
    </div>
  );
}
