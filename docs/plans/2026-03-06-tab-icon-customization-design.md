# Tab Icon Customization + Simplification

**Date:** 2026-03-06
**Branch:** 002-b2c-ux-refinements

## Summary

Simplify the theme system by removing the glass-pill tab bar and all palette variants except Economia Verde. Add a per-tab icon customization feature that lets users choose SF Symbols for each of the 5 native tabs.

## Removals

1. **Glass-pill tab bar** — Delete `mobile/components/floating-tab-bar.tsx`
2. **4 palette variants** — Keep only `economia_verde` in `mobile/theme/palettes.ts`
3. **Palette selector + tab style selector** — Remove from `mobile/app/(tabs)/account.tsx`
4. **Theme store simplification** — Remove `palette`, `setPalette`, `tabStyle`, `setTabStyle` from Zustand store
5. **Layout simplification** — `mobile/app/(tabs)/_layout.tsx` always renders `NativeTabLayout`
6. **Unused imports** — Lucide tab icons, `FloatingTabBar`, palette-related code

## Icon Customization

### Store

```typescript
type TabName = 'index' | 'search' | 'map' | 'list' | 'account';

interface ThemeState {
  tabIcons: Record<TabName, string>; // SF Symbol names
  setTabIcon: (tab: TabName, icon: string) => void;
}
```

Persisted via AsyncStorage under existing `poup-theme` key.

### Defaults

| Tab | Label | Default SF Symbol |
|-----|-------|------------------|
| index | Início | `house.fill` |
| search | Busca | `magnifyingglass` |
| map | Mapa | `mappin` |
| list | Lista | `checklist` |
| account | Conta | `person.fill` |

### Icon Options

| Tab | Options |
|-----|---------|
| Início | `house.fill`, `house`, `storefront.fill`, `house.circle.fill` |
| Busca | `magnifyingglass`, `magnifyingglass.circle.fill`, `text.magnifyingglass`, `sparkle.magnifyingglass` |
| Mapa | `mappin`, `map.fill`, `mappin.and.ellipse`, `mappin.circle.fill`, `location.fill` |
| Lista | `checklist`, `list.bullet`, `list.clipboard.fill`, `cart.fill`, `basket.fill` |
| Conta | `person.fill`, `person.circle.fill`, `person.crop.circle.fill`, `gearshape.fill` |

### Selector UX

- **Account screen** → "ÍCONES" section with 5 rows (one per tab)
- Each row shows: tab label + current SF Symbol icon
- Tap row → navigates to a detail screen showing icon options as a grid
- Each option: SF Symbol rendered at tab-bar size with name below
- Tap to select → haptic feedback, checkmark, auto-navigate back
- Changes apply immediately to the native tab bar

### NativeTabLayout

Reads `tabIcons` from store, passes dynamic SF symbols:

```tsx
<NativeTabs.Trigger name="index">
  <Icon sf={tabIcons.index} />
  <Label>Início</Label>
</NativeTabs.Trigger>
```
