"use client";

import { useState, useTransition } from "react";
import { generateIndexNow } from "./generate-index-action";

const MONTHS = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function GenerateIndexButton() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleGenerate() {
    setResult(null);
    startTransition(async () => {
      const res = await generateIndexNow({ month, year });
      if (res.error) {
        setResult(res.error);
      } else if (res.indicesCreated > 0) {
        setResult(
          `${res.indicesCreated} indice(s) gerado(s) para ${res.cities.join(", ")}`,
        );
      } else {
        setResult("Nenhum indice gerado.");
      }
    });
  }

  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        className="rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm text-[var(--color-ink)]"
      >
        {MONTHS.map((label, i) => (
          <option key={i + 1} value={i + 1}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm text-[var(--color-ink)]"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-50"
      >
        {isPending ? "Gerando..." : "Gerar Indice Agora"}
      </button>

      {result && (
        <span className="text-sm text-[var(--color-muted)]">{result}</span>
      )}
    </div>
  );
}
