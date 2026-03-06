"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useCallback } from "react";
import { Search, X } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterBarProps {
  stores: FilterOption[];
  categories: FilterOption[];
  showStoreFilter: boolean;
}

const SOURCE_OPTIONS: FilterOption[] = [
  { value: "manual", label: "Manual" },
  { value: "importador_ia", label: "Importador IA" },
  { value: "cron", label: "Cron" },
  { value: "crawler", label: "Crawler" },
];

const STATUS_OPTIONS: FilterOption[] = [
  { value: "active", label: "Ativa" },
  { value: "pending_review", label: "Em revisao" },
  { value: "expired", label: "Expirada" },
];

const DATE_PRESET_OPTIONS: FilterOption[] = [
  { value: "expired", label: "Vencidas" },
  { value: "today", label: "Vence hoje" },
  { value: "week", label: "Vence esta semana" },
  { value: "month", label: "Vence este mes" },
  { value: "custom", label: "Personalizado" },
];

const selectClass =
  "h-9 rounded-lg border border-[var(--color-line)] bg-white px-2.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] hover:border-[var(--color-primary)]";

const inputClass =
  "h-9 rounded-lg border border-[var(--color-line)] bg-white px-2.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] hover:border-[var(--color-primary)]";

export function FilterBar({ stores, categories, showStoreFilter }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQ = searchParams.get("q") ?? "";
  const currentStore = searchParams.get("store") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentSource = searchParams.get("source") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentDate = searchParams.get("date") ?? "";
  const currentDateFrom = searchParams.get("date_from") ?? "";
  const currentDateTo = searchParams.get("date_to") ?? "";

  const hasFilters =
    currentQ || currentCategory || currentSource || currentStatus || currentDate || currentDateFrom || currentDateTo || (showStoreFilter && currentStore);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (value) {
        p.set(key, value);
      } else {
        p.delete(key);
      }
      p.set("page", "1");
      if (key === "date" && value !== "custom") {
        p.delete("date_from");
        p.delete("date_to");
      }
      router.push(`/painel/ofertas?${p.toString()}`);
    },
    [router, searchParams],
  );

  const handleSearchChange = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateFilter("q", value), 300);
  };

  const clearFilters = () => {
    const p = new URLSearchParams();
    const sort = searchParams.get("sort");
    const dir = searchParams.get("dir");
    if (sort) p.set("sort", sort);
    if (dir) p.set("dir", dir);
    p.set("page", "1");
    router.push(`/painel/ofertas?${p.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          type="text"
          placeholder="Buscar produto..."
          defaultValue={currentQ}
          onChange={(e) => handleSearchChange(e.target.value)}
          className={`${inputClass} w-48 pl-8`}
        />
      </div>

      {showStoreFilter && (
        <select
          value={currentStore}
          onChange={(e) => updateFilter("store", e.target.value)}
          className={selectClass}
        >
          <option value="">Todos os mercados</option>
          {stores.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      <select
        value={currentCategory}
        onChange={(e) => updateFilter("category", e.target.value)}
        className={selectClass}
      >
        <option value="">Todas categorias</option>
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={currentDate}
        onChange={(e) => updateFilter("date", e.target.value)}
        className={selectClass}
      >
        <option value="">Validade</option>
        {DATE_PRESET_OPTIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      {currentDate === "custom" && (
        <>
          <input
            type="date"
            value={currentDateFrom}
            onChange={(e) => updateFilter("date_from", e.target.value)}
            className={`${inputClass} w-36`}
          />
          <input
            type="date"
            value={currentDateTo}
            onChange={(e) => updateFilter("date_to", e.target.value)}
            className={`${inputClass} w-36`}
          />
        </>
      )}

      <select
        value={currentSource}
        onChange={(e) => updateFilter("source", e.target.value)}
        className={selectClass}
      >
        <option value="">Origem</option>
        {SOURCE_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={currentStatus}
        onChange={(e) => updateFilter("status", e.target.value)}
        className={selectClass}
      >
        <option value="">Status</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[var(--color-muted)] transition hover:text-[var(--color-primary-deep)]"
        >
          <X className="h-3.5 w-3.5" />
          Limpar filtros
        </button>
      )}
    </div>
  );
}
