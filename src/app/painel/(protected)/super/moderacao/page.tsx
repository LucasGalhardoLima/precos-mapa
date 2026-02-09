import { SectionHeader } from "@/features/panel/components/section-header";
import { mockModerationQueue } from "@/features/shared/mock-data";

export default function SuperModerationPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Fila de moderação"
        subtitle="Revisão de ofertas com inconsistências detectadas pela validação automática."
      />

      <div className="space-y-3">
        {mockModerationQueue.map((item) => (
          <article key={item.id} className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{item.offerName}</p>
                <p className="text-sm text-[var(--color-muted)]">{item.marketName}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  item.status === "pendente"
                    ? "bg-amber-100 text-amber-700"
                    : item.status === "aprovado"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                }`}
              >
                {item.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-[var(--color-muted)]">Motivo: {item.reason}</p>
            <p className="mt-2 text-xs text-[var(--color-muted)]">Criado em {item.createdAt}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
