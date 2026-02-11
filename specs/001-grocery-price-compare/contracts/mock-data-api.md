# Mock Data API Contract

**Feature**: `001-grocery-price-compare`
**Date**: 2026-02-10

## Overview

The demo consumer app does not use a real backend. Instead, a mock data
layer in `mobile/data/` exports typed arrays, and `mobile/hooks/`
provides React hooks that simulate API-like query behavior (filtering,
sorting, searching) over that data. This contract defines the interface
between the UI components and the data layer, so that the hooks can
later be swapped to real API calls with minimal component changes.

## Hook Interfaces

### usePromotions

Returns promotions filtered and sorted by the current criteria.

```typescript
type SortMode = "cheapest" | "nearest" | "expiring";

type UsePromotionsParams = {
  query?: string;           // Free-text product name search
  categoryId?: string;      // Filter by category (null = all)
  sortMode?: SortMode;      // "cheapest" | "nearest" | "expiring"
  userLatitude: number;     // User's latitude for distance calc
  userLongitude: number;    // User's longitude for distance calc
};

type EnrichedPromotion = {
  id: string;
  product: Product;
  store: Store;
  originalPrice: number;
  promoPrice: number;
  startDate: string;
  endDate: string;
  verified: boolean;
  discountPercent: number;       // Computed
  belowNormalPercent: number;    // Computed from referencePrice
  gamificationMessage: string | null;  // Computed from thresholds
  distanceKm: number;           // Computed from user location
  isExpiringSoon: boolean;       // endDate within 24h
};

function usePromotions(
  params: UsePromotionsParams
): {
  promotions: EnrichedPromotion[];
  isLoading: boolean;   // Simulated brief loading state
  isEmpty: boolean;     // No results for current filters
};
```

### useStores

Returns stores with their promotion summaries for the map view.

```typescript
type StoreWithPromotions = {
  store: Store;
  activePromotionCount: number;
  topDeals: EnrichedPromotion[];  // Top 3 by discount %
  distanceKm: number;             // From user location
};

function useStores(params: {
  userLatitude: number;
  userLongitude: number;
}): {
  stores: StoreWithPromotions[];
  isLoading: boolean;
};
```

### useCategories

Returns the ordered list of browsing categories.

```typescript
function useCategories(): {
  categories: Category[];
};
```

### useFeaturedDeals

Returns top deals for the onboarding preview carousel.

```typescript
function useFeaturedDeals(): {
  deals: EnrichedPromotion[];  // Top 5 by discount %
};
```

### useSearch

Provides search-as-you-type functionality over product names.

```typescript
function useSearch(query: string): {
  results: EnrichedPromotion[];
  suggestions: string[];  // Product names matching partial query
  isSearching: boolean;
};
```

### useSocialProof

Returns hardcoded social proof stats and testimonials.

```typescript
function useSocialProof(): {
  stats: SocialProofStats;
  testimonials: Testimonial[];
};
```

## Distance Calculation

All distance values are computed using the Haversine formula
between the user's coordinates and the store's coordinates.
For the demo, the user's location is fixed to central Matao/SP:

```typescript
const DEMO_USER_LOCATION = {
  latitude: -21.6033,
  longitude: -48.3658,
};
```

## Search Behavior (Demo)

For the demo, search uses simple case-insensitive substring matching
on `product.name` and `product.brand`. In production, this will be
replaced with server-side fuzzy search with synonym resolution.

```typescript
function matchesQuery(product: Product, query: string): boolean {
  const q = query.toLowerCase().trim();
  return (
    product.name.toLowerCase().includes(q) ||
    (product.brand?.toLowerCase().includes(q) ?? false)
  );
}
```

## Sorting Behavior

| Sort Mode | Primary Sort | Secondary Sort |
|-----------|-------------|----------------|
| cheapest | promoPrice ASC | distanceKm ASC |
| nearest | distanceKm ASC | promoPrice ASC |
| expiring | endDate ASC | promoPrice ASC |

## Migration Path to Production

When transitioning from demo to production:

1. Replace mock data imports in hooks with `fetch()` calls to API
2. Hook signatures remain identical — no component changes needed
3. Add real authentication token to fetch headers
4. Replace fixed DEMO_USER_LOCATION with device GPS
5. Add error handling and retry logic to hooks
6. Add React Query or SWR for caching and revalidation
