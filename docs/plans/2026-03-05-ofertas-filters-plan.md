# Ofertas Page Filters — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 server-side filters (product name, store, category, due date, origin, status) to the admin "Todas as Ofertas" page.

**Architecture:** Extend the existing URL-params + server-component pattern. A new `FilterBar` client component renders filter controls and updates the URL via `router.push()`. The server component (`page.tsx`) reads these params and applies them as Supabase query filters. Dropdown options (stores, categories) are fetched server-side and passed as props.

**Tech Stack:** Next.js 16 server components, Supabase PostgREST, React `useRouter`/`useSearchParams`, Tailwind CSS via CSS variables.

**Design doc:** `docs/plans/2026-03-05-ofertas-filters-design.md`

---

## Task 1: Create FilterBar client component with filter controls

**Files:**
- Create: `src/app/painel/(protected)/ofertas/filter-bar.tsx`

**Step 1: Create the FilterBar component**

This is a `"use client"` component that renders the filter controls and updates the URL.

```tsx
// src/app/painel/(protected)/ofertas/filter-bar.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useCallback } from "react";
import { Search, X } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
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

  // Read current filter values from URL
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
      // Reset to page 1 on any filter change
      p.set("page", "1");
      // When date preset changes away from "custom", clear custom dates
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
    // Preserve sort/dir
    const sort = searchParams.get("sort");
    const dir = searchParams.get("dir");
    if (sort) p.set("sort", sort);
    if (dir) p.set("dir", dir);
    p.set("page", "1");
    router.push(`/painel/ofertas?${p.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Product name search */}
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

      {/* Store filter (super_admin only) */}
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

      {/* Category filter */}
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

      {/* Date preset filter */}
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

      {/* Custom date range (shown when preset is "custom") */}
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

      {/* Source filter */}
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

      {/* Status filter */}
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

      {/* Clear filters */}
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
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to `filter-bar.tsx`.

**Step 3: Commit**

```bash
git add src/app/painel/\(protected\)/ofertas/filter-bar.tsx
git commit -m "feat(ofertas): add FilterBar client component"
```

---

## Task 2: Update page.tsx — parse filter params, apply to Supabase query, fetch dropdown data

**Files:**
- Modify: `src/app/painel/(protected)/ofertas/page.tsx`

**Step 1: Update searchParams interface and parsing**

Add the new filter params to the `PageProps` interface and parse them.

```tsx
interface PageProps {
  searchParams: Promise<{
    store?: string;
    page?: string;
    sort?: string;
    dir?: string;
    q?: string;
    category?: string;
    source?: string;
    status?: string;
    date?: string;
    date_from?: string;
    date_to?: string;
  }>;
}
```

**Step 2: Fetch stores and categories for dropdown options**

After creating the Supabase client, fetch both lists:

```tsx
// Fetch dropdown data for FilterBar
const [{ data: storesList }, { data: categoriesList }] = await Promise.all([
  supabase.from("stores").select("id, name").order("name"),
  supabase.from("categories").select("id, name").order("sort_order"),
]);
```

**Step 3: Apply filter conditions to the Supabase query**

The key change: when `q` or `category` filters are active, switch from the normal `products(...)` join to `products!inner(...)` so that PostgREST allows filtering on the foreign table columns.

```tsx
const needsInnerJoin = params.q || params.category;

const productJoin = needsInnerJoin
  ? "product:products!inner(name, brand, category:categories(name))"
  : "product:products(name, brand, category:categories(name))";

const selectCols = crossMarket
  ? `id, store_id, promo_price, original_price, status, source, end_date, created_at, ${productJoin}, store:stores(name)`
  : `id, store_id, promo_price, original_price, status, source, end_date, created_at, ${productJoin}`;

let query = supabase
  .from("promotions")
  .select(selectCols, { count: "exact" });

if (!crossMarket) {
  query = query.eq("store_id", storeId);
}

// Product name search (ILIKE)
if (params.q) {
  query = query.ilike("products.name", `%${params.q}%`);
}

// Category filter
if (params.category) {
  query = query.eq("products.category_id", params.category);
}

// Source filter
if (params.source) {
  query = query.eq("source", params.source);
}

// Status filter
if (params.status) {
  query = query.eq("status", params.status);
}

// Date filters
if (params.date && params.date !== "custom") {
  const now = new Date();
  switch (params.date) {
    case "expired":
      query = query.lt("end_date", now.toISOString());
      break;
    case "today": {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      query = query.gte("end_date", startOfDay).lt("end_date", endOfDay);
      break;
    }
    case "week": {
      const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("end_date", now.toISOString()).lte("end_date", inWeek);
      break;
    }
    case "month": {
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      query = query.gte("end_date", now.toISOString()).lte("end_date", endOfMonth);
      break;
    }
  }
} else if (params.date === "custom") {
  if (params.date_from) {
    query = query.gte("end_date", params.date_from);
  }
  if (params.date_to) {
    query = query.lte("end_date", `${params.date_to}T23:59:59`);
  }
}
```

**Step 4: Pass filter data and dropdown options to OffersTable**

```tsx
return (
  <OffersTable
    promotions={(promotions ?? []) as unknown as PromotionRow[]}
    storeId={crossMarket ? undefined : storeId}
    showStoreColumn={crossMarket}
    totalCount={count ?? 0}
    page={page}
    pageSize={PAGE_SIZE}
    sort={sort}
    dir={dir}
    stores={(storesList ?? []).map((s) => ({ value: s.id, label: s.name }))}
    categories={(categoriesList ?? []).map((c) => ({ value: c.id, label: c.name }))}
  />
);
```

**Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: Errors about missing props on `OffersTable` (expected — fixed in Task 3).

**Step 6: Commit**

```bash
git add src/app/painel/\(protected\)/ofertas/page.tsx
git commit -m "feat(ofertas): apply server-side filters to Supabase query"
```

---

## Task 3: Update OffersTable — accept new props, render FilterBar, update buildHref

**Files:**
- Modify: `src/app/painel/(protected)/ofertas/offers-table.tsx`

**Step 1: Import FilterBar and update props**

Add imports and extend `OffersTableProps`:

```tsx
import { FilterBar, type FilterOption } from "./filter-bar";

interface OffersTableProps {
  promotions: PromotionRow[];
  storeId?: string;
  showStoreColumn?: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: string;
  stores: FilterOption[];
  categories: FilterOption[];
}
```

Update the component destructuring to accept `stores` and `categories`.

**Step 2: Update buildHref to preserve filter params**

The current `buildHref` only preserves `store`, `page`, `sort`, `dir`. It must also preserve all active filter params from the current URL. Change it to accept a `searchParams` string that carries through filters:

```tsx
function buildHref(
  baseParams: string,
  overrides: { page?: number; sort?: string; dir?: string },
) {
  const p = new URLSearchParams(baseParams);
  if (overrides.page != null) p.set("page", String(overrides.page));
  if (overrides.sort != null) p.set("sort", overrides.sort);
  if (overrides.dir != null) p.set("dir", overrides.dir);
  return `/painel/ofertas?${p.toString()}`;
}
```

Inside the component, use `useSearchParams()` to get the current URL params string:

```tsx
import { useRouter, useSearchParams } from "next/navigation";

// Inside component:
const currentParams = useSearchParams().toString();
```

Then pass `currentParams` to `buildHref` and `SortableHeader` everywhere instead of the old `storeId` + `current` pattern.

**Step 3: Update SortableHeader to use the new buildHref**

```tsx
function SortableHeader({
  label,
  column,
  baseParams,
  currentSort,
  currentDir,
}: {
  label: string;
  column: string;
  baseParams: string;
  currentSort: string;
  currentDir: string;
}) {
  const isActive = currentSort === column;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";
  const Icon = isActive && currentDir === "asc" ? ChevronUp : ChevronDown;

  return (
    <th className="px-4 py-3">
      <Link
        href={buildHref(baseParams, { sort: column, dir: nextDir, page: 1 })}
        className="inline-flex items-center gap-1 hover:text-[var(--color-ink)]"
      >
        {label}
        {isActive && <Icon className="h-3.5 w-3.5" />}
      </Link>
    </th>
  );
}
```

**Step 4: Render FilterBar between SectionHeader and table**

Insert after `<SectionHeader>` and before the table `<div>`:

```tsx
<FilterBar
  stores={stores}
  categories={categories}
  showStoreFilter={showStoreColumn ?? false}
/>
```

**Step 5: Update all SortableHeader calls and pagination links**

Replace `storeId={storeId}` with `baseParams={currentParams}` on every `<SortableHeader>` instance.

Update pagination `<Link>` hrefs:
```tsx
href={buildHref(currentParams, { page: page - 1 })}
// ...
href={buildHref(currentParams, { page: page + 1 })}
```

**Step 6: Verify no TypeScript errors and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

**Step 7: Commit**

```bash
git add src/app/painel/\(protected\)/ofertas/offers-table.tsx
git commit -m "feat(ofertas): render FilterBar and preserve filter params in navigation"
```

---

## Task 4: Manual smoke test and final commit

**Step 1: Start dev server and test**

Run: `npm run dev`

Test checklist:
- [ ] Page loads without errors at `/painel/ofertas`
- [ ] Filter bar renders with all 6 controls
- [ ] Typing in product search updates URL after 300ms debounce and filters table
- [ ] Store dropdown only appears for super_admin
- [ ] Category dropdown shows all categories and filters correctly
- [ ] Date presets filter by expiration date
- [ ] "Personalizado" preset reveals date range inputs
- [ ] Source dropdown filters by origin
- [ ] Status dropdown filters by status
- [ ] "Limpar filtros" clears all filters
- [ ] Sorting still works (preserves filter params)
- [ ] Pagination still works (preserves filter params)
- [ ] Store name links (super_admin drill-down) still work

**Step 2: Final commit (if any adjustments needed)**

```bash
git add -A
git commit -m "fix(ofertas): adjustments from smoke testing"
```
