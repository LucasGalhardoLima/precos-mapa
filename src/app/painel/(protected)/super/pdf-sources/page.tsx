import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";
import { PdfSourcesClient } from "./pdf-sources-client";

export default async function PdfSourcesPage() {
  await requirePermission("moderation:manage");
  const supabase = await createClient();

  // Fetch all stores for the dropdown
  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .order("name");

  // Fetch all PDF sources with store names
  const { data: sources } = await supabase
    .from("store_pdf_sources")
    .select("id, store_id, url, label, is_active, last_checked_at, last_hash, stores:store_id(name)")
    .order("created_at", { ascending: false });

  const mappedStores = (stores ?? []).map((s: { id: string; name: string }) => ({
    id: s.id,
    name: s.name,
  }));

  const mappedSources = (sources ?? []).map(
    (s: {
      id: string;
      store_id: string;
      url: string;
      label: string | null;
      is_active: boolean;
      last_checked_at: string | null;
      last_hash: string | null;
      stores: { name: string } | null;
    }) => ({
      id: s.id,
      storeId: s.store_id,
      storeName: s.stores?.name ?? "Loja",
      url: s.url,
      label: s.label,
      isActive: s.is_active,
      lastCheckedAt: s.last_checked_at,
      lastHash: s.last_hash,
    }),
  );

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Fontes PDF"
        subtitle="Gerencie URLs de encartes para importacao automatica via cron."
      />
      <PdfSourcesClient stores={mappedStores} sources={mappedSources} />
    </div>
  );
}
