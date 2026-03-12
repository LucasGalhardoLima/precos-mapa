# iOS 26 Native Features — Refined Design

**Goal:** Adopt iOS 26 platform features where they genuinely improve UX — native tab behavior, meaningful glass surfaces, better transitions, and snappier motion — without overusing Liquid Glass.

**Principle:** Glass is for floating/overlay elements where seeing content behind them adds value. Functional inputs (search bar, pills, banners) stay solid for readability.

---

## 1. Tab Bar Minimize on Scroll

Add `minimizeBehavior="onScrollDown"` to `NativeTabs`. Tab bar shrinks when scrolling down, expands on scroll up. One-line change in `native-tab-layout.tsx`.

**Fallback:** No-op on older iOS / Android.

## 2. Zoom Transition for Product Detail

Add the `product/[id]` Stack.Screen with native `'default'` animation in `_layout.tsx`. On iOS 26 this gives the native push transition; no custom zoom config needed.

**Fallback:** Standard push animation on older platforms.

## 3. Glass Floating Pill on Map

Wrap the "Ver minha lista" floating pill (`map.tsx`) in `GlassView` with green `tintColor`. This is a floating overlay on the map — glass is meaningful here because you see the map through it.

**Fallback:** Solid green background (current behavior).

## 4. Glass Bottom Sheets (Store + List Panel)

Apply `GlassView` wrapper inside both bottom sheets on the map screen:
- Store detail sheet (`store-bottom-sheet.tsx`)
- Shopping list panel sheet (`map.tsx`)

Set `backgroundColor: 'transparent'` on the sheet background when glass is available. These are overlay surfaces where transparency over the map adds depth.

**Fallback:** Current solid white/surface background.

## 5. Snappier Spring Animations

Replace `timing` transitions with `spring` configs across:
- **Deal cards** (`deal-card.tsx`, `featured-deals-carousel.tsx`): `damping: 15, stiffness: 150`
- **Social proof** (`social-proof.tsx`): `damping: 15, stiffness: 120-130`
- **Onboarding** (`onboarding.tsx`): `damping: 15, stiffness: 130`

Springs give slight overshoot and faster settle — feels more alive than linear timing.

**Fallback:** N/A — springs work on all platforms.

---

## What We're NOT Doing

- **Glass search bar** — functional input, glass hurts readability/focus
- **Glass sort/filter pills** — too small, glass is visual noise on interactive elements
- **Glass location banner** — informational warning, needs clear readability

---

## Technical Approach

- **Runtime detection:** `isLiquidGlassAvailable()` from `expo-glass-effect` — all glass is conditional
- **No code duplication:** Extract shared content into variables, swap only the container (GlassView vs View)
- **Package:** `expo-glass-effect ~0.1.9` (install if not present)
- **Additive only:** Non-iOS 26 devices keep current appearance unchanged

## Files Touched

| File | Changes |
|------|---------|
| `mobile/components/native-tab-layout.tsx` | Add `minimizeBehavior` prop |
| `mobile/app/_layout.tsx` | Add product/[id] Stack.Screen |
| `mobile/app/(tabs)/map.tsx` | Glass floating pill + glass list panel sheet |
| `mobile/components/store-bottom-sheet.tsx` | Glass store sheet |
| `mobile/components/deal-card.tsx` | Spring animation |
| `mobile/components/featured-deals-carousel.tsx` | Spring animation |
| `mobile/components/social-proof.tsx` | Spring animation |
| `mobile/app/onboarding.tsx` | Spring animation |
