"use client";

interface DailyAggregate {
  event_date: string;
  event_type: string;
  event_count: number;
  unique_users: number;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  search_performed: { label: "Buscas", color: "#0D9488" },
  search_result_viewed: { label: "Impressões", color: "#14B8A6" },
  product_detail_viewed: { label: "Detalhes", color: "#6366F1" },
  list_item_added: { label: "Lista", color: "#F59E0B" },
  alert_created: { label: "Alertas", color: "#EF4444" },
  map_pin_tapped: { label: "Mapa", color: "#8B5CF6" },
  screen_viewed: { label: "Telas", color: "#94A3B8" },
  onboarding_completed: { label: "Onboarding", color: "#16A34A" },
};

export function DailyTrendChart({ data }: { data: DailyAggregate[] }) {
  if (data.length === 0) {
    return (
      <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
        Nenhum dado nos últimos 30 dias.
      </p>
    );
  }

  // Group by date
  const dateMap = new Map<string, Record<string, number>>();
  for (const row of data) {
    if (!dateMap.has(row.event_date)) {
      dateMap.set(row.event_date, {});
    }
    dateMap.get(row.event_date)![row.event_type] = row.event_count;
  }

  const dates = [...dateMap.keys()].sort();
  const eventTypes = [...new Set(data.map((d) => d.event_type))];

  // Find max for bar scaling
  const maxPerDay = Math.max(
    ...dates.map((date) => {
      const day = dateMap.get(date)!;
      return Object.values(day).reduce((sum, v) => sum + v, 0);
    }),
    1,
  );

  return (
    <div className="mt-4 space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {eventTypes.map((type) => {
          const cfg = EVENT_LABELS[type] ?? { label: type, color: "#94A3B8" };
          return (
            <div key={type} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
              <span className="text-[var(--color-muted)]">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Stacked horizontal bars */}
      <div className="space-y-1">
        {dates.map((date) => {
          const day = dateMap.get(date)!;
          const total = Object.values(day).reduce((sum, v) => sum + v, 0);
          const pct = (total / maxPerDay) * 100;
          const formattedDate = new Date(date + "T00:00:00").toLocaleDateString(
            "pt-BR",
            { day: "2-digit", month: "2-digit" },
          );

          return (
            <div key={date} className="flex items-center gap-2">
              <span className="w-12 text-right text-xs tabular-nums text-[var(--color-muted)]">
                {formattedDate}
              </span>
              <div className="flex h-5 flex-1 overflow-hidden rounded-md bg-slate-50">
                {eventTypes.map((type) => {
                  const count = day[type] ?? 0;
                  if (count === 0) return null;
                  const segPct = (count / maxPerDay) * 100;
                  const cfg = EVENT_LABELS[type] ?? {
                    label: type,
                    color: "#94A3B8",
                  };
                  return (
                    <div
                      key={type}
                      className="h-full"
                      style={{
                        width: `${segPct}%`,
                        backgroundColor: cfg.color,
                      }}
                      title={`${cfg.label}: ${count}`}
                    />
                  );
                })}
              </div>
              <span className="w-10 text-right text-xs tabular-nums font-medium text-[var(--color-ink)]">
                {total.toLocaleString("pt-BR")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
