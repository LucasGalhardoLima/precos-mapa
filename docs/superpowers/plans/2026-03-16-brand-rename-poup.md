# Brand Rename (PrecoMapa → Poup) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename every reference of PrecoMapa/precomapa/precos-mapa to Poup/poup across the entire codebase.

**Architecture:** Mechanical find-and-replace organized bottom-up: shared package first (dependency root), then app code, seed data, docs. Finish with `npm install` + full test suite to verify.

**Tech Stack:** TypeScript, React Native (Expo), Next.js, Supabase, Maestro E2E YAML

**Spec:** `docs/superpowers/specs/2026-03-16-brand-rename-poup-design.md`

---

## Chunk 1: Foundation — Shared Package + Root Config

### Task 1: Rename shared package and root config

**Files:**
- Modify: `packages/shared/package.json:2`
- Modify: `package.json:2`
- Modify: `mobile/tsconfig.json:8-9`
- Modify: `mobile/jest.config.js:6,11-12`
- Modify: `supabase/config.toml:5`

- [ ] **Step 1: Rename shared package**

In `packages/shared/package.json`, change line 2:
```json
"name": "@poup/shared",
```

- [ ] **Step 2: Rename root package**

In `package.json`, change line 2:
```json
"name": "poup",
```

- [ ] **Step 3: Update mobile tsconfig path aliases**

In `mobile/tsconfig.json`, change lines 8-9:
```json
"@poup/shared": ["../packages/shared/src/index.ts"],
"@poup/shared/*": ["../packages/shared/src/*"]
```

- [ ] **Step 4: Update jest config**

In `mobile/jest.config.js`:

Line 6 — in the `transformIgnorePatterns` regex, replace `@precomapa/.*` with `@poup/.*`:
```js
'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|moti|@gorhom/.*|nativewind|react-native-reanimated|lucide-react-native|@supabase/.*|react-native-purchases|@react-native-google-signin/.*|expo-apple-authentication|expo-location|expo-notifications|expo-secure-store|expo-device|expo-constants|@poup/.*)',
```

Line 11-12 — update module name mapper:
```js
'^@poup/shared$': '<rootDir>/../packages/shared/src/index.ts',
'^@poup/shared/(.*)$': '<rootDir>/../packages/shared/src/$1',
```

- [ ] **Step 5: Update Supabase config**

In `supabase/config.toml`, change line 5:
```toml
project_id = "poup"
```

- [ ] **Step 6: Regenerate lock file**

Run: `npm install`
Expected: Completes without error. `package-lock.json` updated with new package names.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/package.json package.json mobile/tsconfig.json mobile/jest.config.js supabase/config.toml package-lock.json
git commit -m "refactor: rename shared package and root config to poup"
```

---

## Chunk 2: Mobile App Config + All Imports

### Task 2: Update mobile app.json

**Files:**
- Modify: `mobile/app.json:3,4,10,18,31`

- [ ] **Step 1: Update all fields in app.json**

Apply these changes:
- Line 3: `"name": "Poup"`
- Line 4: `"slug": "poup"`
- Line 10: `"scheme": "poup"`
- Line 18: `"bundleIdentifier": "com.poup.app"`
- Line 31: `"package": "com.poup.app"`

- [ ] **Step 2: Commit**

```bash
git add mobile/app.json
git commit -m "refactor: rename mobile app config to Poup"
```

### Task 3: Update all @precomapa/shared imports to @poup/shared

**Files (41 files):**
- Modify: All files under `mobile/` that import from `@precomapa/shared` or `@precomapa/shared/*`

Full file list:
```
mobile/app/index.tsx
mobile/app/_layout.tsx
mobile/app/onboarding.tsx
mobile/app/(tabs)/_layout.tsx
mobile/app/(tabs)/account.tsx
mobile/app/(tabs)/alerts.tsx
mobile/app/(tabs)/favorites.tsx
mobile/app/(tabs)/list.tsx
mobile/app/(business)/_layout.tsx
mobile/app/(business)/importer.tsx
mobile/app/(business)/index.tsx
mobile/app/(business)/offers.tsx
mobile/app/(business)/profile.tsx
mobile/components/auth-buttons.tsx
mobile/components/offline-banner.tsx
mobile/components/ui/badge.tsx
mobile/components/ui/button.tsx
mobile/components/ui/text.tsx
mobile/constants/colors.ts
mobile/constants/messages.ts
mobile/hooks/use-account.ts
mobile/hooks/use-alerts.ts
mobile/hooks/use-auth.ts
mobile/hooks/use-competitive.ts
mobile/hooks/use-favorites.ts
mobile/hooks/use-location.ts
mobile/hooks/use-plan-gate.ts
mobile/hooks/use-promotions.ts
mobile/hooks/use-push-notifications.ts
mobile/hooks/use-realtime.ts
mobile/hooks/use-shopping-list.ts
mobile/hooks/use-store-ranking.ts
mobile/hooks/use-subscription.ts
mobile/lib/cache.ts
mobile/lib/schemas.ts
mobile/lib/supabase.ts
mobile/store/app-store.ts
mobile/types/index.ts
mobile/__tests__/components/offline-banner.test.tsx
mobile/__tests__/foundational/store.test.ts
mobile/__tests__/us0/auth-flow.test.ts
```

- [ ] **Step 1: Replace all imports**

In every file listed above, replace:
- `from '@precomapa/shared'` → `from '@poup/shared'`
- `from '@precomapa/shared/` → `from '@poup/shared/`
- `import type { ... } from '@precomapa/shared` → `import type { ... } from '@poup/shared`

This is a mechanical find-and-replace of `@precomapa/shared` → `@poup/shared` across all 41 files.

- [ ] **Step 2: Verify no remaining references**

Run: `grep -r "@precomapa" mobile/ --include="*.ts" --include="*.tsx"`
Expected: No output (zero matches).

- [ ] **Step 3: Commit**

```bash
git add mobile/
git commit -m "refactor: rename all @precomapa/shared imports to @poup/shared"
```

### Task 4: Update E2E test files

**Files (9 files):**
- Modify: `mobile/__tests__/e2e/business-dashboard.yaml:3`
- Modify: `mobile/__tests__/e2e/business-importer.yaml:3`
- Modify: `mobile/__tests__/e2e/consumer-onboarding.yaml:4,15`
- Modify: `mobile/__tests__/e2e/list-optimization.yaml:5`
- Modify: `mobile/__tests__/e2e/map-exploration.yaml:3`
- Modify: `mobile/__tests__/e2e/map-list-panel.yaml:5`
- Modify: `mobile/__tests__/e2e/product-to-list.yaml:5`
- Modify: `mobile/__tests__/e2e/search-and-find.yaml:5`
- Modify: `mobile/__tests__/e2e/helpers/sign-in-consumer.yaml:3`

- [ ] **Step 1: Replace appId in all 9 YAML files**

In every file, replace:
- `appId: com.precomapa.consumer` → `appId: com.poup.app`

Additionally in `consumer-onboarding.yaml` line 15:
- `text: "PrecoMapa"` → `text: "Poup"`

- [ ] **Step 2: Verify**

Run: `grep -r "precomapa" mobile/__tests__/e2e/`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add mobile/__tests__/e2e/
git commit -m "refactor: rename appId and brand text in E2E tests to poup"
```

---

## Chunk 3: Admin Panel + Edge Functions + Mobile Content

### Task 5: Update admin panel branding

**Files:**
- Modify: `src/app/layout.tsx:5` — metadata title
- Modify: `src/app/page.tsx:14` — logo text
- Modify: `src/app/painel/acesso/page.tsx:28` — heading
- Modify: `src/app/(public)/layout.tsx:16,46` — header + footer
- Modify: `src/features/panel/components/panel-shell.tsx:90` — sidebar logo
- Modify: `src/app/(public)/indice/page.tsx:24,33,39,138` — metadata + OG + JSON-LD
- Modify: `src/app/(public)/indice/[month]/page.tsx:30,37,43` — metadata + OG

- [ ] **Step 1: Update layout.tsx metadata**

In `src/app/layout.tsx` line 5, replace:
```tsx
title: "Poup | Inteligencia Regional de Precos",
```

- [ ] **Step 2: Update page.tsx logo text**

In `src/app/page.tsx` line 14, replace:
```tsx
<p className="text-sm font-semibold text-[var(--color-ink)]">Poup</p>
```

- [ ] **Step 3: Update admin panel heading**

In `src/app/painel/acesso/page.tsx` line 28, replace:
```tsx
<h1 className="text-4xl font-semibold tracking-tight text-[var(--color-ink)]">Painel Poup</h1>
```

- [ ] **Step 4: Update public layout header + footer**

In `src/app/(public)/layout.tsx`:
- Line 16: `PrecoMapa` → `Poup`
- Line 46: `PrecoMapa` → `Poup`

- [ ] **Step 5: Update panel shell sidebar**

In `src/features/panel/components/panel-shell.tsx` line 90:
```tsx
<p className="text-xl font-semibold">Poup</p>
```

- [ ] **Step 6: Update indice page metadata**

In `src/app/(public)/indice/page.tsx`:
- Line 24: `"Indice Regional de Precos | Poup"`
- Line 33: `\`Indice de Precos de ${index.city} - ${period} | Poup\``
- Line 39: `siteName: "Poup"`
- Line 138: `name: "Poup"` (JSON-LD structured data `creator` field)

In `src/app/(public)/indice/[month]/page.tsx`:
- Line 30: `"Indice nao encontrado | Poup"`
- Line 37: `\`Indice de Precos de ${index.city} - ${period} | Poup\``
- Line 43: `siteName: "Poup"`

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/painel/acesso/page.tsx src/app/\(public\)/layout.tsx src/features/panel/components/panel-shell.tsx src/app/\(public\)/indice/page.tsx src/app/\(public\)/indice/\[month\]/page.tsx
git commit -m "refactor: rename admin panel branding to Poup"
```

### Task 6: Update storage keys, HTTP config, mock/demo data

**Files:**
- Modify: `src/features/offers/offers-store.tsx:17`
- Modify: `src/features/market-importer/importer-draft-store.ts:24`
- Modify: `src/lib/geocode.ts:21`
- Modify: `src/features/shared/mock-data.ts:269,277,285,373`
- Modify: `src/app/demo/page.tsx:15`

- [ ] **Step 1: Update storage keys**

In `src/features/offers/offers-store.tsx` line 17:
```ts
const STORAGE_KEY = "poup_offers_store_v1";
```

In `src/features/market-importer/importer-draft-store.ts` line 24:
```ts
const STORAGE_KEY = "poup_importer_draft_v1";
```

- [ ] **Step 2: Update User-Agent**

In `src/lib/geocode.ts` line 21:
```ts
"User-Agent": "Poup/1.0 (admin-panel)",
```

- [ ] **Step 3: Update mock emails**

In `src/features/shared/mock-data.ts`:
- Line 269: `email: "lucas@poup.com.br",`
- Line 277: `email: "ana@poup.com.br",`
- Line 285: `email: "pedro@poup.com.br",`
- Line 373: `userEmail: "lucas@poup.com.br",`

In `src/app/demo/page.tsx` line 15:
```ts
userEmail: "demo@poup.com.br",
```

- [ ] **Step 4: Commit**

```bash
git add src/features/offers/offers-store.tsx src/features/market-importer/importer-draft-store.ts src/lib/geocode.ts src/features/shared/mock-data.ts src/app/demo/page.tsx
git commit -m "refactor: rename storage keys, user-agent, and mock emails to poup"
```

### Task 7: Update Supabase Edge Functions

**Files:**
- Modify: `supabase/functions/trial-reminders/index.ts:7,14,77,89`
- Modify: `supabase/functions/daily-digest/index.ts:85,199`

- [ ] **Step 1: Update trial-reminders**

In `supabase/functions/trial-reminders/index.ts`:
- Line 7: `'https://precomapa.com.br'` → `'https://poup.com.br'`
- Line 14: `recursos Premium do PrecoMapa` → `recursos Premium do Poup`
- Line 77: `'PrecoMapa <noreply@precomapa.com.br>'` → `'Poup <noreply@poup.com.br>'`
- Line 89: `Enviado por PrecoMapa` → `Enviado por Poup`

- [ ] **Step 2: Update daily-digest**

In `supabase/functions/daily-digest/index.ts`:
- Line 85: `Enviado por PrecoMapa` → `Enviado por Poup`
- Line 199: `'PrecoMapa <digest@precomapa.com.br>'` → `'Poup <digest@poup.com.br>'`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/
git commit -m "refactor: rename brand and emails in edge functions to Poup"
```

### Task 8: Update mobile content files

**Files:**
- Modify: `mobile/app/privacy.tsx:38`
- Modify: `mobile/data/testimonials.ts:7`
- Modify: `mobile/store-metadata.md` (multiple lines)

- [ ] **Step 1: Update privacy email**

In `mobile/app/privacy.tsx` line 38, replace:
`privacidade@precomapa.com.br` → `privacidade@poup.com.br`

- [ ] **Step 2: Update testimonial**

In `mobile/data/testimonials.ts` line 7, replace:
`ofertas do PrecoMapa` → `ofertas do Poup`

- [ ] **Step 3: Update store metadata**

In `mobile/store-metadata.md`, replace all occurrences:
- Line 1: `# App Store Metadata — Poup`
- Line 4: `Poup — Precos e Ofertas`
- Line 14: `Poup e o app que ajuda voce...`
- Line 41: `Baixe o Poup agora!`
- Line 57: `https://poup.com.br/privacidade`

- [ ] **Step 4: Commit**

```bash
git add mobile/app/privacy.tsx mobile/data/testimonials.ts mobile/store-metadata.md
git commit -m "refactor: rename brand in mobile content to Poup"
```

---

## Chunk 4: Seed Data + Documentation + Verification

### Task 9: Update seed data and migrations

**Files:**
- Modify: `supabase/migrations/001_initial_schema.sql:2`
- Modify: `supabase/seed.sql:1,141`
- Modify: `supabase/seed-admin.sql:5,24,31,47,49,58,63,64`
- Modify: `supabase/seed-consumer.sql:5,24,47,49`

- [ ] **Step 1: Update migration comment**

In `supabase/migrations/001_initial_schema.sql` line 2:
```sql
-- Poup: Grocery Price Comparison Platform
```

- [ ] **Step 2: Update seed.sql**

- Line 1: `-- seed.sql: Development seed data for Poup`
- Line 141: `ofertas do PrecoMapa` → `ofertas do Poup`

- [ ] **Step 3: Update seed-admin.sql**

Replace all occurrences:
- `admin@precomapa.com` → `admin@poup.com.br` (lines 5, 24, 47, 49)
- `Admin PrecoMapa` → `Admin Poup` (lines 31, 58, 63, 64)

- [ ] **Step 4: Update seed-consumer.sql**

Replace all occurrences:
- `consumer@precomapa.com` → `consumer@poup.com.br` (lines 5, 24, 47, 49)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql supabase/seed.sql supabase/seed-admin.sql supabase/seed-consumer.sql
git commit -m "refactor: rename brand in seed data and migration comments to Poup"
```

### Task 10: Update documentation

**Files:**
- Modify: `CLAUDE.md:1`
- Modify: `specs/001-grocery-price-compare/spec.md` (6 occurrences)
- Modify: `specs/001-grocery-price-compare/plan.md:217`
- Modify: `specs/001-grocery-price-compare/quickstart.md:1,198`
- Modify: `specs/001-grocery-price-compare/tasks.md` (4+ occurrences)
- Modify: `specs/001-grocery-price-compare/research.md:228`
- Modify: `docs/plans/2026-03-06-palette-selector-plan.md:459`
- Modify: `docs/plans/2026-03-06-tab-icon-customization-plan.md:271`
- Modify: `docs/plans/2026-03-06-liquid-glass-tabbar-plan.md:476`
- Modify: `docs/plans/2026-03-07-comprehensive-test-coverage-plan.md:1494,1549,1596,1634`
- Modify: `.specify/memory/constitution.md:14,159`

- [ ] **Step 1: Update CLAUDE.md**

Line 1: `# precos-mapa Development Guidelines` → `# Poup Development Guidelines`

- [ ] **Step 1b: Update .specify constitution**

In `.specify/memory/constitution.md`:
- Line 14: `# Precos Mapa Constitution` → `# Poup Constitution`
- Line 159: `decisions in the Precos Mapa project.` → `decisions in the Poup project.`

- [ ] **Step 2: Update spec files**

In all `specs/001-grocery-price-compare/` files, replace:
- `PrecoMapa` → `Poup` (all occurrences)
- `precomapa` → `poup` (all occurrences)
- `precos-mapa` → `poup` (all occurrences in prose, NOT filesystem paths — e.g. `quickstart.md` line 198 shows a directory tree with `precos-mapa/`, leave that as-is)
- `noreply@precomapa.com.br` → `noreply@poup.com.br`

- [ ] **Step 3: Update plan docs**

In `docs/plans/2026-03-06-palette-selector-plan.md`:
- Line 459: `@precomapa/shared` → `@poup/shared`

In `docs/plans/2026-03-06-tab-icon-customization-plan.md`:
- Line 271: `@precomapa/shared` → `@poup/shared`

In `docs/plans/2026-03-06-liquid-glass-tabbar-plan.md`:
- Line 476: `@precomapa/shared` → `@poup/shared`

In `docs/plans/2026-03-07-comprehensive-test-coverage-plan.md`:
- Lines 1494, 1549, 1596, 1634: `appId: com.precomapa.mobile` → `appId: com.poup.app`

**Note:** `docs/plans/2026-03-06-pill-tabbar-border-fixes-design.md` contains only filesystem paths (`/Users/.../precos-mapa/...`) — leave unchanged per spec (matches directory name decision).

- [ ] **Step 4: Update memory file (outside repo)**

In `~/.claude/projects/-Users-lucasgalhardo-Documents-Projects-precos-mapa/memory/MEMORY.md`:
- `# PrecoMapa Project Memory` → `# Poup Project Memory`

- [ ] **Step 5: Commit documentation changes**

```bash
git add CLAUDE.md .specify/memory/constitution.md specs/ docs/plans/
git commit -m "docs: rename all brand references to Poup"
```

### Task 11: Verification

- [ ] **Step 1: Reinstall dependencies**

Run: `npm install`
Expected: Clean install, no errors.

- [ ] **Step 2: Run tests and lint**

Run: `npm test && npm run lint`
Expected: All tests pass, no lint errors.

- [ ] **Step 3: Grep for remaining references**

Run: `grep -ri "precomapa\|PrecoMapa\|precos-mapa\|preco-mapa" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.md" --include="*.sql" --include="*.toml" --include="*.yaml" --include="*.yml" . | grep -v node_modules | grep -v .next | grep -v .git | grep -v .claude | grep -v package-lock.json | grep -v "brand-rename-poup"`
Expected: No output (zero remaining references), or only the spec file itself.

- [ ] **Step 4: Fix any remaining references found in Step 3**

If grep finds unexpected matches, update them following the naming convention map from the spec.

- [ ] **Step 5: Final commit if needed**

```bash
git add -A
git commit -m "refactor: fix remaining brand references to Poup"
```
