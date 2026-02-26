import { redirect } from "next/navigation";
import { requireSessionContext } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";
import { PlanActions } from "./plan-actions";

const PLAN_TIERS = [
  {
    id: "free",
    name: "Gratuito",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      "5 ofertas/mes",
      "Perfil basico da loja",
      "Visibilidade no mapa",
    ],
    limits: "5 ofertas/mes, 1 loja",
  },
  {
    id: "premium",
    name: "Premium",
    monthlyPrice: 299,
    annualPrice: 3014,
    features: [
      "50 ofertas/mes",
      "Importador IA (4 importacoes/mes)",
      "Inteligencia competitiva basica",
      "Email digest semanal",
      "Prioridade na busca",
    ],
    limits: "50 ofertas/mes, 1 loja, 4 importacoes IA/mes",
  },
  {
    id: "premium_plus",
    name: "Premium+",
    monthlyPrice: 699,
    annualPrice: 7030,
    features: [
      "Ofertas ilimitadas",
      "Importador IA ilimitado",
      "Inteligencia competitiva completa",
      "Dashboard de analytics",
      "Simulador de precos",
      "Suporte prioritario",
    ],
    limits: "Ilimitado, ate 3 lojas",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: -1,
    annualPrice: -1,
    features: [
      "Tudo do Premium+",
      "Lojas ilimitadas",
      "API de integracao",
      "Gerente de conta dedicado",
      "SLA garantido",
    ],
    limits: "Sob consulta",
  },
];

function formatPrice(value: number): string {
  if (value === 0) return "Gratis";
  if (value === -1) return "Sob consulta";
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

export default async function PlanPage() {
  const session = await requireSessionContext();

  if (session.role === "super_admin") {
    redirect("/painel/super/planos");
  }

  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("b2b_plan, stripe_customer_id, stripe_subscription_id, trial_ends_at")
    .eq("id", session.currentMarketId)
    .single();

  const currentPlan = store?.b2b_plan ?? "free";
  const stripeCustomerId = store?.stripe_customer_id ?? null;
  const trialEndsAt = store?.trial_ends_at
    ? new Date(store.trial_ends_at)
    : null;
  const isTrialing = trialEndsAt && trialEndsAt > new Date();

  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();
  const { count: monthlyCount } = await supabase
    .from("promotions")
    .select("*", { count: "exact", head: true })
    .eq("store_id", session.currentMarketId)
    .gte("created_at", monthStart);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Plano e Cobranca"
        subtitle="Gerencie sua assinatura e veja seu uso atual."
      />

      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            Plano atual:{" "}
            <span className="text-[var(--color-primary-deep)]">
              {PLAN_TIERS.find((t) => t.id === currentPlan)?.name ?? "Gratuito"}
            </span>
          </h2>
          {isTrialing && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Periodo de teste ate{" "}
              {trialEndsAt.toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--color-surface-strong)] p-4">
            <p className="text-xs text-[var(--color-muted)]">Ofertas este mes</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-ink)]">
              {monthlyCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--color-surface-strong)] p-4">
            <p className="text-xs text-[var(--color-muted)]">Limite mensal</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-ink)]">
              {currentPlan === "free"
                ? "5"
                : currentPlan === "premium"
                  ? "50"
                  : "Ilimitado"}
            </p>
          </div>
        </div>

        <PlanActions
          currentPlan={currentPlan}
          storeId={session.currentMarketId}
          stripeCustomerId={stripeCustomerId}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-[var(--color-surface-strong)] text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Mensal</th>
              <th className="px-4 py-3">Anual</th>
              <th className="px-4 py-3">Recursos</th>
              <th className="px-4 py-3">Limites</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_TIERS.map((tier) => (
              <tr
                key={tier.id}
                className={`border-t border-[var(--color-line)] ${
                  tier.id === currentPlan ? "bg-emerald-50" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--color-ink)]">
                      {tier.name}
                    </span>
                    {tier.id === currentPlan && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Atual
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">
                  {formatPrice(tier.monthlyPrice)}
                  {tier.monthlyPrice > 0 && (
                    <span className="text-[var(--color-muted)]">/mes</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  {formatPrice(tier.annualPrice)}
                  {tier.annualPrice > 0 && (
                    <span className="text-[var(--color-muted)]">/ano</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ul className="space-y-1">
                    {tier.features.map((f) => (
                      <li key={f} className="text-xs text-[var(--color-muted)]">
                        {f}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                  {tier.limits}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
