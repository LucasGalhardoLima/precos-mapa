# Mobile consumer app — screenshots

Captured 2026-07-17 from the `mobile/` Expo app running on an iPhone 17 Pro Max
simulator (iOS 26.5), built locally via `npx expo run:ios --configuration
Release` and driven with Maestro. Status bar normalized to 9:41 / full
signal-wifi-battery via `xcrun simctl status_bar`.

## Screens

| File | Screen |
|---|---|
| `01-onboarding-location.png` | First-launch onboarding, step 1 — location permission primer |
| `02-onboarding-notification.png` | First-launch onboarding, step 2 — notification permission primer |
| `03-home.png` | Home tab — ranking, nearby offers, nearby stores |
| `04-list-empty.png` | Lista tab — empty state with suggested starter lists |
| `05-map.png` | Mapa tab — store markers (zoomed to fit all seeded stores, some outside Matão) |
| `06-alerts-empty.png` | Alertas tab — empty state with suggested products |
| `07-account.png` | Account screen — plan badge, savings summary, Poup Plus upsell, preferences |
| `08-search-empty.png` | Busca tab — category grid and popular-search suggestions |
| `09-search-error.png` | Busca tab after a search attempt — current-build error state (see Known gaps) |

## Known gaps / current-build limitations

- **Business app screens (Dashboard, Ofertas, Importador, Loja) — not captured.**
  Auth is disabled in this build: `mobile/app/index.tsx` and `app/_layout.tsx`
  have their session-based routing commented out (`AUTH_STASHED`), so the app
  never routes to the `(business)` group and its layout redirects to
  `/onboarding` whenever `session === null` — which it always is in this
  build. The business UI is present in code but unreachable, not broken.
- **Search results — genuinely broken in this build state**, not a capture
  artifact. Tapping a search suggestion consistently returns "Não foi possível
  buscar produtos" even after granting location permission and retrying.
  Matches the account screen's `Localização: Não definida` and the repo's own
  `supabase/migrations/038_fix_search_null_location.sql` — the search RPC
  appears to require a resolved location the onboarding "Agora não" path never
  requests.
- **Product detail, paywall modal, favorites list — not captured this pass.**
  The Poup Plus CTA and "Meus favoritos" row are visible in
  `07-account.png`, but Maestro couldn't independently tap them (likely a
  grouped/combined accessibility label on those rows) or a `Home` feed card
  (same cause). A coordinate-based tap for the product card landed on Home
  again rather than a card.
- **List detail / map-list-panel** — need at least one saved list item to
  render; the test account's list is empty and there's no in-app path to
  seed one without a working search.
- Onboarding screens (01/02) only render once per Keychain state (completing
  onboarding persists `hasSeenOnboarding` via `expo-secure-store`, which
  survives app uninstall/reinstall) — captured on a freshly-erased simulator.
