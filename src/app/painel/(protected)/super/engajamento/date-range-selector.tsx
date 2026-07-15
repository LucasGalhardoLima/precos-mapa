"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { DateRangePreset } from "./engajamento-queries";

const OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];

export function DateRangeSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (searchParams.get("range") as DateRangePreset) ?? "30d";

  function handleChange(value: DateRangePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border border-[var(--color-line)] bg-white p-1 text-sm">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => handleChange(option.value)}
          className={
            option.value === current
              ? "rounded-md bg-[var(--color-primary)] px-3 py-1.5 font-medium text-white"
              : "rounded-md px-3 py-1.5 text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
