import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";
import { formatCurrency } from "@/features/shared/format";
import { ModerationActions } from "./moderation-actions";

export default async function SuperModerationPage() {
  await requirePermission("moderation:manage");
  const supabase = await createClient();

  const { data: flagged } = await supabase
    .from("promotions")
    .select(
      "id, promo_price, original_price, status, created_at, store:stores(name), product:products(name)",
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  const items = (flagged ?? []).map((p) => {
    const product = Array.isArray(p.product) ? p.product[0] : p.product;
    const store = Array.isArray(p.store) ? p.store[0] : p.store;
    const discount =
      p.original_price > 0
        ? Math.round(((p.original_price - p.promo_price) / p.original_price) * 100)
        : 0;

    let reason = "Revisao manual";
    if (discount > 80) reason = `Desconto muito alto (${discount}%)`;
    else if (p.promo_price < 0.5) reason = `Preco muito baixo (${formatCurrency(p.promo_price)})`;

    return {
      id: p.id,
      productName: product?.name ?? "Produto",
      storeName: store?.name ?? "Loja",
      originalPrice: p.original_price,
      promoPrice: p.promo_price,
      discount,
      reason,
      createdAt: p.created_at,
    };
  });

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Fila de moderacao"
        subtitle="Revisao de ofertas com inconsistencias detectadas pela validacao automatica."
      />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--color-muted)]">Nenhuma oferta pendente de revisao.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{item.productName}</p>
                  <p className="text-sm text-[var(--color-muted)]">{item.storeName}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                  Em revisao
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-[var(--color-muted)]">Original: </span>
                  <span className="font-medium">{formatCurrency(item.originalPrice)}</span>
                </div>
                <div>
                  <span className="text-[var(--color-muted)]">Promo: </span>
                  <span className="font-semibold text-[var(--color-primary-deep)]">
                    {formatCurrency(item.promoPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-muted)]">Desconto: </span>
                  <span className="font-medium">{item.discount}%</span>
                </div>
              </div>

              <p className="mt-2 text-sm text-rose-600">Motivo: {item.reason}</p>

              <ModerationActions promotionId={item.id} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
