import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  helper: string;
  trend?: "up" | "down" | "stable";
}

const trendClasses: Record<NonNullable<KpiCardProps["trend"]>, string> = {
  up: "text-emerald-700 bg-emerald-100",
  down: "text-rose-700 bg-rose-100",
  stable: "text-slate-700 bg-slate-100",
};

function TrendIcon({ trend = "stable" }: { trend?: "up" | "down" | "stable" }) {
  if (trend === "up") {
    return <ArrowUpRight className="h-4 w-4" />;
  }
  if (trend === "down") {
    return <ArrowDownRight className="h-4 w-4" />;
  }
  return <ArrowRight className="h-4 w-4" />;
}

export function KpiCard({ label, value, helper, trend = "stable" }: KpiCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-ink)]">{value}</p>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-[var(--color-muted)]">{helper}</p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${trendClasses[trend]}`}>
          <TrendIcon trend={trend} />
          {trend === "up" ? "Alta" : trend === "down" ? "Baixa" : "Estável"}
        </span>
      </div>
    </article>
  );
}
