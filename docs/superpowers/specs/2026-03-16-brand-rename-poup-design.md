# Brand Rename: PrecoMapa → Poup

**Date:** 2026-03-16
**Status:** Approved
**Scope:** Full brand rename across all layers — user-facing, code, config, seed data, documentation

## Context

The B2C app has been renamed from "PrecoMapa" to "Poup". The app is pre-launch (not published to any app store), so all identifiers — including bundle IDs, package names, and URI schemes — can be changed without migration concerns.

The project directory name (`precos-mapa/`) is intentionally left unchanged as it's a filesystem concern outside the codebase.

## Naming Convention Map

| Old | New | Usage |
|-----|-----|-------|
| `PrecoMapa` | `Poup` | User-facing display name |
| `precomapa` | `poup` | Slugs, URI schemes, lowercase refs |
| `precos-mapa` | `poup` | Root package name, directory refs in docs |
| `@precomapa/shared` | `@poup/shared` | NPM scoped package + all imports |
| `com.precomapa.consumer` | `com.poup.app` | iOS bundle ID, Android package (suffix changed from `.consumer` to `.app` since the app is dual-role) |
| `precomapa_*` | `poup_*` | Storage keys (localStorage, AsyncStorage) |
| `*@precomapa.com.br` | `*@poup.com.br` | Email addresses (placeholder domain) |
| `precomapa.com.br` | `poup.com.br` | URLs (placeholder domain) |
| `PrecoMapa/1.0` | `Poup/1.0` | User-Agent header |
| `Precos Mapa` / `Preco Mapa` | `Poup` | Prose references in docs |

**Note:** `poup.com.br` is a placeholder domain — final domain TBD.

## Execution Strategy

### Tier 1 — Shared Package + Root Config (foundation)

The shared package is the dependency root. Rename it first so downstream updates resolve correctly.

1. Rename `@precomapa/shared` → `@poup/shared` in `packages/shared/package.json`
2. Rename `precos-mapa` → `poup` in root `package.json`
3. Update path alias in `mobile/tsconfig.json` (`@precomapa/shared` → `@poup/shared`)
4. Update jest config in `mobile/jest.config.js` (`@precomapa/.*` → `@poup/.*`)
5. Update `supabase/config.toml`: `project_id = "precomapa"` → `project_id = "poup"`
6. Run `npm install` to regenerate `package-lock.json`

### Tier 2 — App Config + Code (bulk)

All application code and configuration files.

**Mobile app config (`mobile/app.json`):**
- `name`: `PrecoMapa` → `Poup`
- `slug`: `precomapa` → `poup`
- `scheme`: `precomapa` → `poup`
- `ios.bundleIdentifier`: `com.precomapa.consumer` → `com.poup.app`
- `android.package`: `com.precomapa.consumer` → `com.poup.app`

**Import statements (40+ files):**
- All `from '@precomapa/shared'` → `from '@poup/shared'`
- Spans mobile app, components, hooks, constants, tests

**Admin panel branding:**
- `src/app/layout.tsx` — page title metadata
- `src/app/page.tsx` — homepage logo text
- `src/app/painel/acesso/page.tsx` — admin panel heading
- `src/app/(public)/indice/page.tsx` and `[month]/page.tsx` — metadata/OG tags
- `src/app/(public)/layout.tsx` — header navigation
- `src/features/panel/components/panel-shell.tsx` — sidebar logo

**Storage keys:**
- `src/features/offers/offers-store.tsx`: `precomapa_offers_store_v1` → `poup_offers_store_v1`
- `src/features/market-importer/importer-draft-store.ts`: `precomapa_importer_draft_v1` → `poup_importer_draft_v1`

**HTTP config:**
- `src/lib/geocode.ts`: User-Agent `PrecoMapa/1.0` → `Poup/1.0`

**Supabase Edge Functions:**
- `trial-reminders/index.ts`: email sender, body text, default URL
- `daily-digest/index.ts`: email sender, footer text

**Mobile specific:**
- `mobile/app/privacy.tsx`: privacy contact email
- `mobile/data/testimonials.ts`: testimonial text
- `mobile/store-metadata.md`: all app store listing text

**Mock/demo data:**
- `src/features/shared/mock-data.ts`: demo user emails
- `src/app/demo/page.tsx`: demo email

**E2E test files (9 Maestro YAML files):**
- `mobile/__tests__/e2e/business-dashboard.yaml`: `appId: com.precomapa.consumer` → `com.poup.app`
- `mobile/__tests__/e2e/business-importer.yaml`: same
- `mobile/__tests__/e2e/consumer-onboarding.yaml`: appId + user-facing text
- `mobile/__tests__/e2e/list-optimization.yaml`: same
- `mobile/__tests__/e2e/map-exploration.yaml`: same
- `mobile/__tests__/e2e/map-list-panel.yaml`: same
- `mobile/__tests__/e2e/product-to-list.yaml`: same
- `mobile/__tests__/e2e/search-and-find.yaml`: same
- `mobile/__tests__/e2e/helpers/sign-in-consumer.yaml`: same

### Tier 3 — Seed Data + Migrations

- `supabase/migrations/001_initial_schema.sql`: comment header
- `supabase/seed.sql`: comment + testimonial text
- `supabase/seed-admin.sql`: comments, emails, display names
- `supabase/seed-consumer.sql`: comments, emails

### Tier 4 — Documentation

- `CLAUDE.md`: project title and references
- `specs/001-grocery-price-compare/spec.md`: brand references
- `specs/001-grocery-price-compare/plan.md`: brand references
- `specs/001-grocery-price-compare/quickstart.md`: title
- `specs/001-grocery-price-compare/tasks.md`: brand references
- `specs/001-grocery-price-compare/research.md`: email reference
- `docs/plans/2026-03-06-palette-selector-plan.md`: `@precomapa/shared` imports
- `docs/plans/2026-03-06-tab-icon-customization-plan.md`: `@precomapa/shared` imports
- `docs/plans/2026-03-06-liquid-glass-tabbar-plan.md`: `@precomapa/shared` imports + filesystem paths
- `docs/plans/2026-03-07-comprehensive-test-coverage-plan.md`: `appId` references (note: uses stale `com.precomapa.mobile`, update to `com.poup.app`)
- `docs/plans/2026-03-06-pill-tabbar-border-fixes-design.md`: filesystem paths only — leave unchanged (matches directory name decision)
- `~/.claude/projects/-Users-lucasgalhardo-Documents-Projects-precos-mapa/memory/MEMORY.md`: update title (note: outside repo, not committed)

## Edge Cases

| Case | Decision |
|------|----------|
| `.next/` build artifacts | Ignored — auto-regenerated on build |
| `package-lock.json` | Regenerated via `npm install`, not manually edited |
| `node_modules/` | Reinstalled, not manually edited |
| Git history | No rewriting — old name stays in commit history |
| Project directory name (`precos-mapa/`) | Left as-is — filesystem concern |
| Memory files | Updated for future conversation context |

## Verification

After all changes:
1. `npm install` from root (regenerate lock file)
2. `npm test && npm run lint` (verify nothing broke)
3. Manual grep for any remaining `precomapa` / `PrecoMapa` / `precos-mapa` / `preco-mapa` references (excluding `.next/`, `node_modules/`, `.git/`, `package-lock.json`, and this spec file itself)

## Estimated Scope

- ~85+ files modified
- ~200+ individual text replacements
- Zero migration risk (pre-launch)
