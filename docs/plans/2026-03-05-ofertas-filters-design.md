# Ofertas Page Filters

**Date:** 2026-03-05
**Status:** Approved

## Problem

The "Todas as Ofertas" admin page has sorting and pagination but no filtering. With growing data (multiple stores, hundreds of promotions from automated imports), finding specific offers requires scrolling through pages manually.

## Solution

Add an inline filter bar above the table with 6 server-side filters. Filters use URL query params, extending the existing sort/page pattern. Each filter change resets pagination to page 1.

### Filters

| Filter | Control | URL Param | Supabase Query |
|--------|---------|-----------|----------------|
| Produto | Text input, debounced 300ms | `q` | `ilike("products.name", "%q%")` via `!inner` join |
| Mercado | `<select>` (super_admin only) | `store` | `eq("store_id", uuid)` (existing) |
| Categoria | `<select>` from categories table | `category` | `eq("products.category_id", uuid)` via `!inner` join |
| Validade | `<select>` presets + date range | `date`, `date_from`, `date_to` | Preset-based `.lt`/`.gte` on `end_date`, or custom range |
| Origem | `<select>` (manual, importador_ia, cron, crawler) | `source` | `eq("source", value)` |
| Status | `<select>` (active, pending_review, expired) | `status` | `eq("status", value)` |

### Date Presets

- Todas (default)
- Vencidas (`end_date < now()`)
- Vence hoje (`end_date` between start/end of today)
- Vence esta semana (`end_date` within 7 days)
- Vence este mes (`end_date` within current month)
- Personalizado (shows `date_from` / `date_to` inputs)

### Layout

Horizontal flex bar between `SectionHeader` and table. Wraps on smaller screens. "Limpar filtros" link appears when any filter is active.

### Files

1. **`page.tsx`** — Parse new searchParams, apply to Supabase query, fetch categories/stores for dropdowns, pass to OffersTable.
2. **`filter-bar.tsx`** (new) — Client component with filter controls. Uses `router.push()` to update URL params.
3. **`offers-table.tsx`** — Updated props to receive filter values + dropdown options. `buildHref` extended to preserve filter params.

### Query Strategy

Use Supabase PostgREST `!inner` join modifier for product name and category filters. This converts the LEFT JOIN to an INNER JOIN, enabling `.ilike()` and `.eq()` on the foreign table columns.
