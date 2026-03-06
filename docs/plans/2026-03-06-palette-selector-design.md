# Palette Selector + Fonts

**Date:** 2026-03-06
**Status:** Approved

## Problem

The app has 2 hardcoded palettes (encarte/fintech) with a simple toggle. We need 5 palettes with distinct visual identities, per-palette display fonts, and a proper selector UI.

## Solution

Extend the theme system with 3 new palettes, a refined 20-token schema, per-palette font definitions, and an inline palette selector in the Account tab.

### Token Schema (20 tokens)

**Variable per palette (14):**

| Token | Purpose |
|-------|---------|
| `primary` | Main brand color (buttons, active icons) |
| `primaryHover` | Lighter primary for press/hover states |
| `primaryMuted` | Very light tint for badge/tag backgrounds |
| `accent` | Discount/promo highlight (badges, prices) |
| `accentSoft` | Light accent tint for badge backgrounds |
| `bg` | Screen background |
| `surface` | Card/elevated surface |
| `border` | Dividers, card borders |
| `mist` | Subtle wash/ripple backgrounds |
| `textPrimary` | Main body text |
| `textSecondary` | Supporting/subtitle text |
| `textHint` | Tertiary, metadata text |
| `header` | Header background |
| `headerText` | Text on header |

**Shared across all palettes (4):**

| Token | Value |
|-------|-------|
| `success` | `#16A34A` |
| `danger` | `#EF4444` |
| `warning` | `#F59E0B` |
| `muted` | `#64748B` |

**Dark mode (2):**

| Token | Purpose |
|-------|---------|
| `dark` | Dark mode base |
| `darkSurface` | Dark mode surface |

### Token renames (old -> new)

| Old | New |
|-----|-----|
| `discountRed` | `accent` |
| `discountRedActive` | `accent` |
| `discountRedSoft` | `accentSoft` |
| `primaryLight` | `primaryMuted` |
| `gold`, `goldBright`, `goldLight` | removed (use `accent`/`warning`) |

### 5 Palettes

**Encarte (existing, updated tokens):**
- Display font: Nunito ExtraBold
- Primary: `#2A6041`, Accent: `#C8392B`, Bg: `#FAF7F0`

**Fintech (existing, updated tokens):**
- Display font: Inter Bold
- Primary: `#0B5E3A`, Accent: `#0B5E3A`, Bg: `#FAFBFC`

**Economia Verde (new):**
- Display font: Poppins Bold
- Primary: `#0D9488`, PrimaryHover: `#14B8A6`, PrimaryMuted: `#5EEAD4`
- Accent: `#F59E0B`, AccentSoft: `#FEF3C7`
- TextPrimary: `#1A1A2E`, Bg: `#F0FDFA`

**Encarte Digital (new):**
- Display font: Nunito ExtraBold
- Primary: `#059669`, PrimaryHover: `#10B981`, PrimaryMuted: `#6EE7B7`
- Accent: `#EF4444`, AccentSoft: `#FEE2E2`
- TextPrimary: `#1E293B`, Bg: `#ECFDF5`

**Fintech Moderna (new):**
- Display font: Poppins Bold
- Primary: `#0891B2`, PrimaryHover: `#22D3EE`, PrimaryMuted: `#A5F3FC`
- Accent: `#8B5CF6`, AccentSoft: `#EDE9FE`
- TextPrimary: `#0F172A`, Bg: `#F0F9FF`

### Fonts

Load via `expo-font` with `@expo-google-fonts/*`:
- **Poppins**: Bold (700), ExtraBold (800)
- **Nunito**: ExtraBold (800)
- **Inter**: Regular (400), Medium (500)

Each palette specifies `fontDisplay` and `fontBody` in its tokens. Body is Inter for all palettes.

| Palette | fontDisplay | fontBody |
|---------|-------------|----------|
| Encarte | Nunito_800ExtraBold | Inter_400Regular / Inter_500Medium |
| Fintech | Inter_500Medium | Inter_400Regular / Inter_500Medium |
| Economia Verde | Poppins_700Bold | Inter_400Regular / Inter_500Medium |
| Encarte Digital | Nunito_800ExtraBold | Inter_400Regular / Inter_500Medium |
| Fintech Moderna | Poppins_700Bold | Inter_400Regular / Inter_500Medium |

### Palette selector UI

In the Account tab, replace the toggle with an inline list of 5 palette rows. Each row:
- 3 color circles (primary, accent, bg) as swatch preview
- Palette name + short description
- Checkmark icon on the selected palette
- Tap to select with haptic feedback

### Files to change

1. `mobile/theme/palettes.ts` — New token type, 5 palette definitions with font info
2. `mobile/theme/store.ts` — Update union type to 5 palette names
3. `mobile/theme/use-theme.ts` — Update TOKEN_MAP
4. `mobile/theme/provider.tsx` — Update context type
5. `mobile/app/_layout.tsx` — Font loading via expo-font
6. `mobile/app/(tabs)/account.tsx` — Palette selector UI
7. All components using old token names — Rename (discountRed->accent, etc.)
