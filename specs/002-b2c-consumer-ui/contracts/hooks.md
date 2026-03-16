# Hook Contracts: POUP B2C Consumer UI

**Branch**: `002-b2c-consumer-ui` | **Date**: 2026-03-02

## New Hooks

### useTheme()

**Location**: `mobile/theme/use-theme.ts`
**Purpose**: Provides the active palette name and full token set.

```typescript
interface PaletteTokens {
  name: 'encarte' | 'fintech';
  bg: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textHint: string;
  primary: string;
  primaryLight: string;
  header: string;
  headerText: string;
  border: string;
  discountRed: string;
  discountRedActive: string;
  discountRedSoft: string;
  gold: string;
  goldBright: string;
  goldLight: string;
  dark: string;
  darkSurface: string;
  mist: string;
}

function useTheme(): {
  palette: 'encarte' | 'fintech';
  tokens: PaletteTokens;
  togglePalette: () => void;
}
```

**Behavior**:
- Reads palette selection from Zustand store (persisted to AsyncStorage)
- Returns the full token set for the active palette
- `togglePalette()` switches between `'encarte'` and `'fintech'`
- All consumers re-render immediately on toggle (Zustand subscription)

---

### useThemeClasses()

**Location**: `mobile/hooks/use-theme-classes.ts`
**Purpose**: Maps semantic UI roles to palette-specific Tailwind class strings.

```typescript
interface ThemeClasses {
  // Backgrounds
  bg: string;               // Screen background
  surface: string;          // Card/surface background
  headerBg: string;         // Header/economy card background
  headerText: string;       // Header text color
  discountBg: string;       // Discount card background tint

  // Text
  textPrimary: string;      // Primary text color class
  textSecondary: string;    // Secondary text color class
  textHint: string;         // Hint/metadata text color class

  // Borders
  border: string;           // Default border class
  separator: string;        // List separator class (dotted for encarte, solid for fintech)

  // Interactive
  primaryButton: string;    // Primary button bg + text classes
  primaryButtonText: string;

  // Semantic
  discountText: string;     // Discount price/badge text
  savingsText: string;      // Positive savings text (green)
  goldText: string;         // Achievement/Plus text
  goldBg: string;           // Plus section background

  // Tab bar
  tabBarBg: string;
  tabBarActive: string;
  tabBarInactive: string;
}

function useThemeClasses(): ThemeClasses
```

**Behavior**:
- Depends on `useTheme()` internally
- Returns pre-composed Tailwind class strings (e.g., `'bg-encarte-paper'` or `'bg-fintech-box'`)
- Memoized — only recomputes when palette changes

---

### useEconomySummary()

**Location**: `mobile/hooks/use-economy-summary.ts`
**Purpose**: Computes potential savings for the home dashboard economy card.

```typescript
interface EconomySummary {
  totalSavings: number;
  cheapestStore: { id: string; name: string } | null;
  mode: 'list' | 'deals';
  itemCount: number;
}

function useEconomySummary(params: {
  userLatitude: number;
  userLongitude: number;
  radiusKm?: number;          // default: 10
}): {
  summary: EconomySummary;
  isLoading: boolean;
}
```

**Behavior**:
- Checks if user has any shopping list items (via existing `useShoppingList()`)
- **List mode**: For each list item, queries cheapest active promotion. Savings = Σ (reference_price − cheapest_promo_price). Cheapest store = store with lowest total across all items
- **Deals mode** (empty list fallback): Queries all active promotions within radius. Savings = total discount value of top store. Cheapest store = store with highest total discount
- Subscribes to Supabase Realtime on `promotions` table for live updates
- Returns `isLoading: true` during initial fetch

---

### useStoreRanking()

**Location**: `mobile/hooks/use-store-ranking.ts`
**Purpose**: Returns weekly top 3 cheapest stores for a reference basket.

```typescript
interface StoreRankEntry {
  id: string;
  name: string;
  totalPrice: number;
  savingsPercent: number;
  rank: 1 | 2 | 3;
}

interface StoreRanking {
  stores: StoreRankEntry[];
  city: string;
  basketLabel: string;
}

function useStoreRanking(params: {
  userLatitude: number;
  userLongitude: number;
  radiusKm?: number;          // default: 15
}): {
  ranking: StoreRanking | null;
  isLoading: boolean;
}
```

**Behavior**:
- Queries stores within radius that have active promotions
- Uses a reference basket of common staple products (defined as a constant: arroz, feijão, óleo, açúcar, leite, café, farinha, sal)
- For each store, sums the cheapest active promotion price per basket item
- Ranks by total basket price ascending, returns top 3
- `savingsPercent` = (1 − thisStore / highestStore) × 100
- `city` derived from user's profile or reverse geocoding
- Caches result for 1 hour (basket prices don't change frequently)

---

## Modified Hooks

### usePromotions() — Search Mode Enhancement

**Location**: `mobile/hooks/use-promotions.ts` (existing)
**Change**: Add `productQuery` parameter and `plusGated` enrichment.

```typescript
// Existing params + new:
function usePromotions(params: {
  query?: string;
  productQuery?: string;      // NEW: search for specific product across stores
  categoryId?: string;
  sortMode?: 'cheapest' | 'nearest' | 'expiring' | 'discount';  // NEW: 'discount' sort
  userLatitude: number;
  userLongitude: number;
}): {
  promotions: EnrichedPromotion[];
  isLoading: boolean;
  isEmpty: boolean;
}

// EnrichedPromotion gains:
interface EnrichedPromotion {
  // ... existing fields ...
  isLocked: boolean;          // NEW: true for 4th+ result when user is free plan
}
```

**Behavior changes**:
- When `productQuery` is set, returns one promotion per store for the queried product (grouped by store, cheapest promotion per store)
- New `'discount'` sort mode: sorts by `discountPercent` descending
- `isLocked` flag: for free-plan users, promotions beyond rank 3 get `isLocked: true`

---

### usePriceHistory() — No Changes Needed

The existing hook already returns `dataPoints` with `{ date, min_promo_price, avg_promo_price }` and `trend` with `{ direction, changePercent, bestTimeToBuy }`. The new SVG chart just needs to consume this data differently (as x/y coordinates instead of bar heights).

---

### useShoppingList() — No Changes Needed

The existing hook already provides `addItem`, `toggleItem`, `removeItem`, and `optimizeList`. The new List screen just renders items differently (receipt style vs current FlatList).

---

### useAlerts() — No Changes Needed

The existing hook already provides `create(productId, targetPrice)` and `disable(alertId)`. The product detail screen's alert toggle uses these directly.

---

### useFavorites() — No Changes Needed

Moved from a tab to the Account screen's preferences section. Hook interface unchanged.

---

## Theme Store Contract

**Location**: `mobile/theme/store.ts`

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeState {
  palette: 'encarte' | 'fintech';
  togglePalette: () => void;
  setPalette: (palette: 'encarte' | 'fintech') => void;
}

const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      palette: 'encarte',
      togglePalette: () =>
        set((s) => ({ palette: s.palette === 'encarte' ? 'fintech' : 'encarte' })),
      setPalette: (palette) => set({ palette }),
    }),
    {
      name: 'poup-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

## Constants

### TAB_BAR_HEIGHT

**Location**: `mobile/components/floating-tab-bar.tsx`
**Value**: Exported constant, approximately `72` (actual bar) + safe area bottom inset
**Usage**: All tab screen ScrollViews use `contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom }}` to prevent content from hiding behind the floating bar

### REFERENCE_BASKET

**Location**: `mobile/hooks/use-store-ranking.ts`
**Value**: Array of product category+name pairs representing common Brazilian grocery staples
**Usage**: Used to compute store ranking by comparing basket totals
