import { SectionHeader } from "@/features/panel/components/section-header";
import { mockPlanOverview } from "@/features/shared/mock-data";

export default function SuperPlansPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Planos e faturamento"
        subtitle="Monitoramento de assinaturas dos mercados com foco em expansão de receita."
      />

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
            {mockPlanOverview.map((plan) => (
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
    </div>
  );
}
