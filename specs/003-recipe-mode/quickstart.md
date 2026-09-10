# Quickstart: Modo Receita

**Branch**: `003-recipe-mode`

## Prerequisites

- Supabase local running (`supabase start`)
- Mobile dev client installed on device/simulator
- Node 20+, `pnpm` installed

---

## 1. Apply the migration

```bash
supabase db reset        # or: supabase migration up
# Verify new tables exist:
supabase db shell <<'SQL'
\d recipes
\d recipe_ingredient_lines
SELECT * FROM pg_proc WHERE proname = 'match_ingredient';
SQL
```

---

## 2. Test ingredient matching (RPC)

```bash
supabase db shell <<'SQL'
SELECT * FROM match_ingredient('feijão preto');
SELECT * FROM match_ingredient('leite integral');
SELECT * FROM match_ingredient('sal');          -- generic, should return lowest-priced
SELECT * FROM match_ingredient('xyznonexistent'); -- should return 0 rows
SQL
```

Expected: 1–3 rows ordered by `similarity_score DESC`, highest score ≥ 0.5 for common Brazilian staples.

---

## 3. Test the Edge Function locally

```bash
supabase functions serve recipe-calculate --env-file ./supabase/.env.local

# Happy path — 3 matched ingredients
curl -X POST http://localhost:54321/functions/v1/recipe-calculate \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "matches": [
      { "ingredientId": "a1", "productId": "<uuid>", "parsedQuantity": 500, "parsedUnit": "g" },
      { "ingredientId": "a2", "productId": "<uuid>", "parsedQuantity": 1, "parsedUnit": "kg" }
    ],
    "location": { "lat": -23.5505, "lng": -46.6333 },
    "requestSplitBasket": true
  }'

# Verify response contains:
# - stores[] ranked by total (complete before incomplete)
# - splitBasket or splitBasketTeaser depending on user tier
# - calculatedAt ISO timestamp
```

---

## 4. Run unit tests

```bash
# Ingredient parser
pnpm test packages/shared/src/lib/ingredient-parser.test.ts

# Basket optimizer
pnpm test packages/shared/src/lib/basket-optimizer.test.ts

# Key cases to cover:
# parser: "500g de feijão" → {quantity:500, unit:'g', name:'feijão'}
# parser: "2 dentes de alho" → {quantity:2, unit:'dente', name:'alho'}
# parser: "sal" → {quantity:null, unit:null, name:'sal'}
# optimizer: single store cheaper → splitBasket null
# optimizer: 2-store saves > R$5,00 → splitBasket with correct allocation
# optimizer: savings exactly R$5,00 → splitBasket null (strictly greater)
```

---

## 5. Run the feature on device

```bash
cd mobile && npx expo start --dev-client
```

1. Navigate to the Modo Receita tab (new tab icon)
2. Paste: `500g de arroz, 1 kg de feijão preto, 2 latas de tomate pelado, 1 cebola, 3 dentes de alho`
3. Tap **Calcular** — watch progressive matching: each ingredient row resolves independently
4. Verify store totals appear ranked cheapest → most expensive
5. If logged in as Plus user: verify split-basket card appears when applicable
6. If logged in as Free user: verify teaser card shows savings amount + upgrade CTA
7. Tap **Salvar receita** — verify recipe appears in Minhas Receitas
8. Reopen saved recipe — verify prices recalculate and delta shows (↑/↓)

---

## 6. Verify Free tier limits

1. Log in as a Free user
2. Save 3 recipes
3. Attempt to save a 4th → verify paywall prompt appears, no recipe created

---

## Key Files

| File | Purpose |
|------|---------|
| `supabase/migrations/040_recipe_mode.sql` | Tables + RLS + match_ingredient RPC |
| `supabase/functions/recipe-calculate/index.ts` | Store totals + split-basket Edge Function |
| `packages/shared/src/lib/ingredient-parser.ts` | Client-side text → {qty, unit, name} |
| `packages/shared/src/lib/basket-optimizer.ts` | O(M²N) split-basket algorithm |
| `packages/shared/src/types/recipe.ts` | Shared TypeScript types |
| `mobile/store/recipe-store.ts` | Zustand store for match state |
| `mobile/hooks/use-recipe.ts` | CRUD for saved recipes (Supabase) |
| `mobile/hooks/use-recipe-match.ts` | Orchestrates parallel matching + totals |
| `mobile/app/(tabs)/recipe.tsx` | Entry screen |
| `mobile/components/recipe/` | All recipe UI components |
