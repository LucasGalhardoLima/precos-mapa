import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  premium: "Premium",
  premium_plus: "Premium+",
  enterprise: "Enterprise",
};

const PLAN_AMOUNTS: Record<string, string> = {
  free: "R$ 0,00",
  premium: "R$ 299,00",
  premium_plus: "R$ 699,00",
  enterprise: "Sob consulta",
};

export default async function SuperPlansPage() {
  await requirePermission("plan:manage");
  const supabase = await createClient();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, b2b_plan, stripe_customer_id, stripe_subscription_id, trial_ends_at")
    .order("name");

  const now = new Date();

  const plans = (stores ?? []).map((s) => {
    const plan = s.b2b_plan as string;
    const trialEndsAt = s.trial_ends_at ? new Date(s.trial_ends_at as string) : null;
    const inTrial = trialEndsAt && trialEndsAt > now;

    let status: "ativo" | "trial" | "expirado";
    if (inTrial) {
      status = "trial";
    } else if (trialEndsAt && trialEndsAt <= now && !s.stripe_subscription_id) {
      status = "expirado";
    } else {
      status = "ativo";
    }

    let renewalDate: string;
    if (inTrial && trialEndsAt) {
      renewalDate = new Intl.DateTimeFormat("pt-BR").format(trialEndsAt);
    } else if (s.stripe_subscription_id) {
      renewalDate = "Mensal";
    } else {
      renewalDate = "—";
    }

    return {
      id: s.id as string,
      marketName: s.name as string,
      plan: PLAN_LABELS[plan] ?? plan,
      amount: PLAN_AMOUNTS[plan] ?? "—",
      renewalDate,
      status,
    };
  });

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Planos e faturamento"
        subtitle="Monitoramento de assinaturas dos mercados com foco em expansão de receita."
      />

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--color-muted)]">Nenhum mercado cadastrado.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-strong)] text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3">Mercado</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Mensalidade</th>
                <th className="px-4 py-3">Renovação</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-t border-[var(--color-line)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{plan.marketName}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{plan.plan}</td>
                  <td className="px-4 py-3 text-[var(--color-ink)]">{plan.amount}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{plan.renewalDate}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        plan.status === "ativo"
                          ? "bg-emerald-100 text-emerald-700"
                          : plan.status === "trial"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {plan.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
