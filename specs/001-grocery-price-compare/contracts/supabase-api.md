# Supabase API Contract

**Feature**: `001-grocery-price-compare`
**Date**: 2026-02-11

## Overview

The production system uses Supabase's auto-generated REST API (PostgREST)
and Realtime channels. This contract defines the client-side query
patterns used by mobile hooks and admin panel pages. All queries go
through `@supabase/supabase-js` — no custom API routes for data access.

## Authentication

### Sign In with Google (Mobile)

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const { idToken } = await GoogleSignin.signIn();
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'google',
  token: idToken!,
});
```

### Sign In with Apple (Mobile)

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';

const credential = await AppleAuthentication.signInAsync({
  requestedScopes: [
    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
    AppleAuthentication.AppleAuthenticationScope.EMAIL,
  ],
});
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: credential.identityToken!,
});
```

### Set User Role (After First Sign-In)

```typescript
await supabase
  .from('profiles')
  .update({ role: 'consumer' | 'business' })
  .eq('id', user.id);
```

### Get Current Session

```typescript
const { data: { session } } = await supabase.auth.getSession();
```

### Get User Profile

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .single();
```

## Consumer Queries

### Fuzzy Product Search (pg_trgm + Synonyms)

```typescript
// For queries >= 3 chars, use fuzzy search RPC
const { data: productIds } = await supabase
  .rpc('search_products', { query: searchQuery });

// RPC function (in migration):
// Uses pg_trgm similarity() on products.name
// UNION matches from product_synonyms.term
// Returns product IDs ranked by similarity score
// Threshold: similarity > 0.3

// Then fetch promotions for matched products
const { data: promotions } = await supabase
  .from('promotions')
  .select('*, product:products!inner(*), store:stores!inner(*)')
  .eq('status', 'active')
  .gt('end_date', new Date().toISOString())
  .in('product_id', productIds.map(p => p.id))
  .order('store.search_priority', { ascending: false });
```

### Search Promotions (Home Screen)

Replaces `usePromotions` hook.

```typescript
type SearchParams = {
  query?: string;
  categoryId?: string;
  sortBy?: 'promo_price' | 'end_date';
  sortAsc?: boolean;
  limit?: number;
  offset?: number;
};

const { data: promotions } = await supabase
  .from('promotions')
  .select(`
    *,
    product:products!inner(*),
    store:stores!inner(*)
  `)
  .eq('status', 'active')
  .gt('end_date', new Date().toISOString())
  .ilike('product.name', `%${query}%`)        // if query provided
  .eq('product.category_id', categoryId)       // if categoryId provided
  .order('store.search_priority', { ascending: false })  // paid stores first
  .order(sortBy, { ascending: sortAsc })
  .range(offset, offset + limit - 1);
```

**Response shape** (per row):

```typescript
type PromotionRow = {
  id: string;
  product_id: string;
  store_id: string;
  original_price: number;
  promo_price: number;
  start_date: string;
  end_date: string;
  status: 'active';
  verified: boolean;
  source: 'manual' | 'importador_ia' | 'crawler';
  product: {
    id: string;
    name: string;
    category_id: string;
    brand: string | null;
    reference_price: number;
    image_url: string | null;
  };
  store: {
    id: string;
    name: string;
    chain: string | null;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
    logo_url: string | null;
    logo_initial: string;
    logo_color: string;
    b2b_plan: string;
    search_priority: number;
  };
};
```

**Computed fields** (client-side, same as demo):

```typescript
type EnrichedPromotion = PromotionRow & {
  discountPercent: number;
  belowNormalPercent: number;
  gamificationMessage: string | null;
  distanceKm: number;
  isExpiringSoon: boolean;
};
```

### Get Stores with Promotions (Map)

Replaces `useStores` hook.

```typescript
const { data: stores } = await supabase
  .from('stores')
  .select(`
    *,
    promotions:promotions(
      *,
      product:products(*)
    )
  `)
  .eq('is_active', true)
  .eq('promotions.status', 'active')
  .gt('promotions.end_date', new Date().toISOString());
```

### Get Categories

Replaces `useCategories` hook.

```typescript
const { data: categories } = await supabase
  .from('categories')
  .select('*')
  .order('sort_order');
```

### Get Featured Deals (Onboarding)

Replaces `useFeaturedDeals` hook. Top 5 by discount percentage.

```typescript
const { data: promotions } = await supabase
  .from('promotions')
  .select('*, product:products(*), store:stores(*)')
  .eq('status', 'active')
  .gt('end_date', new Date().toISOString())
  .order('promo_price', { ascending: true })
  .limit(5);
// Client computes discountPercent and sorts by it
```

### Get Social Proof

Replaces `useSocialProof` hook.

```typescript
const { data: stats } = await supabase
  .from('platform_stats')
  .select('*')
  .eq('id', 1)
  .single();

const { data: testimonials } = await supabase
  .from('testimonials')
  .select('*')
  .order('sort_order');
```

### Manage Favorites

```typescript
// Get user's favorites
const { data: favorites } = await supabase
  .from('user_favorites')
  .select('*, product:products(*, promotions(*, store:stores(*)))')
  .eq('user_id', userId);

// Add favorite
const { error } = await supabase
  .from('user_favorites')
  .insert({ user_id: userId, product_id: productId });
// RLS enforces plan limit (Free: 10)

// Remove favorite
const { error } = await supabase
  .from('user_favorites')
  .delete()
  .eq('user_id', userId)
  .eq('product_id', productId);
```

### Manage Alerts

```typescript
// Get user's alerts
const { data: alerts } = await supabase
  .from('user_alerts')
  .select('*, product:products(*)')
  .eq('user_id', userId)
  .eq('is_active', true);

// Create alert
const { error } = await supabase
  .from('user_alerts')
  .insert({
    user_id: userId,
    product_id: productId,
    target_price: targetPrice,
    radius_km: radiusKm,
  });
// RLS enforces plan limit (Free: 3, Plus/Family: unlimited)

// Disable alert
const { error } = await supabase
  .from('user_alerts')
  .update({ is_active: false })
  .eq('id', alertId)
  .eq('user_id', userId);
```

## Business Queries

### Get Store Dashboard KPIs

```typescript
const { data: store } = await supabase
  .from('stores')
  .select('*')
  .eq('id', storeId)
  .single();

const { count: activePromotions } = await supabase
  .from('promotions')
  .select('*', { count: 'exact', head: true })
  .eq('store_id', storeId)
  .eq('status', 'active');
```

### CRUD Promotions (Business)

```typescript
// List store's promotions
const { data: promotions } = await supabase
  .from('promotions')
  .select('*, product:products(*)')
  .eq('store_id', storeId)
  .order('created_at', { ascending: false });

// Create promotion
const { data, error } = await supabase
  .from('promotions')
  .insert({
    product_id: productId,
    store_id: storeId,
    original_price: originalPrice,
    promo_price: promoPrice,
    start_date: startDate,
    end_date: endDate,
    source: 'manual',
    created_by: userId,
  })
  .select()
  .single();
// RLS enforces: store membership + plan promotion limit

// Update promotion
const { error } = await supabase
  .from('promotions')
  .update({
    promo_price: newPrice,
    end_date: newEndDate,
    updated_at: new Date().toISOString(),
  })
  .eq('id', promotionId)
  .eq('store_id', storeId);

// Delete promotion
const { error } = await supabase
  .from('promotions')
  .delete()
  .eq('id', promotionId)
  .eq('store_id', storeId);
```

### Update Store Profile

```typescript
const { error } = await supabase
  .from('stores')
  .update({
    name: storeName,
    address: storeAddress,
    phone: storePhone,
    logo_url: logoUrl,
  })
  .eq('id', storeId);
```

## Realtime Subscriptions

### Consumer: Live Promotion Updates

```typescript
const channel = supabase
  .channel('consumer-promotions')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'promotions',
      filter: 'status=eq.active',
    },
    (payload) => {
      // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
      // payload.new: the new/updated row
      // payload.old: the old row (UPDATE/DELETE only)
      // Update local state/cache accordingly
    }
  )
  .subscribe();

// Cleanup on unmount
supabase.removeChannel(channel);
```

## Admin Panel Queries (Next.js — Server-Side)

The Next.js admin panel uses `@supabase/ssr` for server-side Supabase
client creation with cookie-based session management.

```typescript
// lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

## Stripe Integration (Admin Panel)

### Create Checkout Session (Server Action)

```typescript
'use server';
export async function createCheckoutSession(priceId: string, storeId: string) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/plano?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/plano`,
    subscription_data: {
      trial_period_days: 7,
      trial_settings: {
        end_behavior: { missing_payment_method: 'cancel' },
      },
    },
    payment_method_collection: 'always',  // CC required for trial
    metadata: { storeId },
  });
  redirect(session.url!);
}
```

### Webhook Handler

```typescript
// app/api/webhooks/stripe/route.ts
// Handles: checkout.session.completed, customer.subscription.updated,
//          customer.subscription.deleted, invoice.payment_succeeded
// Updates stores.b2b_plan, stripe_customer_id, stripe_subscription_id
```

### Customer Portal (Server Action)

```typescript
'use server';
export async function redirectToPortal(stripeCustomerId: string) {
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/plano`,
  });
  redirect(portalSession.url);
}
```

## Smart Shopping Lists (D1 Phase 2 — Plus Feature)

### Manage Shopping Lists

```typescript
// Get user's shopping lists
const { data: lists } = await supabase
  .from('shopping_lists')
  .select('*, items:shopping_list_items(*, product:products(*))')
  .eq('user_id', userId)
  .order('updated_at', { ascending: false });

// Create new list
const { data: list } = await supabase
  .from('shopping_lists')
  .insert({ user_id: userId, name: listName })
  .select()
  .single();

// Add item to list
const { error } = await supabase
  .from('shopping_list_items')
  .insert({ list_id: listId, product_id: productId, quantity: qty });

// Check off item
const { error } = await supabase
  .from('shopping_list_items')
  .update({ is_checked: true })
  .eq('id', itemId);

// Delete list (cascades to items)
const { error } = await supabase
  .from('shopping_lists')
  .delete()
  .eq('id', listId)
  .eq('user_id', userId);
```

### Optimize Shopping List (Client-Side)

```typescript
type OptimizedResult = {
  stores: Array<{
    store: StoreRow;
    items: Array<{ product: ProductRow; price: number }>;
    subtotal: number;
  }>;
  totalCost: number;
  estimatedSavings: number;  // vs buying all at nearest store
  routeUrl: string;          // Google Maps deep link
};

// 1. Fetch promotions for all products in the list
const productIds = listItems.map(i => i.product_id);
const { data: promotions } = await supabase
  .from('promotions')
  .select('*, store:stores(*)')
  .eq('status', 'active')
  .gt('end_date', new Date().toISOString())
  .in('product_id', productIds);

// 2. Run greedy optimization algorithm client-side
// (see research.md R12 for algorithm details)
```

## Price History (D1 Phase 2 — Plus Feature)

Uses daily aggregated snapshots (one row per product per day).

```typescript
// Get 90-day price history for a product
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
const startDate = ninetyDaysAgo.toISOString().split('T')[0];

const { data: history } = await supabase
  .from('price_snapshots')
  .select('date, min_promo_price, avg_promo_price, store_count, reference_price')
  .eq('product_id', productId)
  .gte('date', startDate)
  .order('date', { ascending: true });

// Response shape
type PriceSnapshotPoint = {
  date: string;              // YYYY-MM-DD
  min_promo_price: number | null;  // cheapest active promotion
  avg_promo_price: number | null;  // average across stores
  store_count: number;       // how many stores have this on promo
  reference_price: number;   // product's reference price at snapshot time
};
```

## Competitive Intelligence (D1 Phase 2 — Premium B2B Feature)

### Get Competitor Prices

```typescript
// Get competitor prices for a product within radius
// Uses Haversine distance calculated server-side via RPC
const { data: competitors } = await supabase
  .rpc('get_competitor_prices', {
    p_store_id: storeId,
    p_product_id: productId,
    p_radius_km: 5,
  });

// Response shape
type CompetitorPrice = {
  store_name: string;
  promo_price: number;
  original_price: number;
  end_date: string;
  distance_km: number;
};
```

### Get Competitiveness Dashboard

```typescript
// Get store's price ranking across all products
const { data: rankings } = await supabase
  .rpc('get_store_rankings', {
    p_store_id: storeId,
    p_radius_km: 5,
  });

// Response shape
type ProductRanking = {
  product_id: string;
  product_name: string;
  category_name: string;
  my_price: number;
  avg_market_price: number;
  min_market_price: number;
  my_rank: number;      // 1 = cheapest
  total_stores: number;
};
```

## Stripe Launch Offer (50% Off)

### Create Checkout with Launch Coupon

```typescript
'use server';
export async function createCheckoutWithLaunchOffer(
  priceId: string,
  storeId: string,
  launchCouponId: string,
) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    discounts: [{ coupon: launchCouponId }],  // 50% off 3 months
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/plano?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/plano`,
    subscription_data: {
      trial_period_days: 7,
      trial_settings: {
        end_behavior: { missing_payment_method: 'cancel' },
      },
    },
    payment_method_collection: 'always',
    metadata: { storeId },
  });
  redirect(session.url!);
}
```

## Error Handling

All Supabase queries return `{ data, error }`. Hooks should:

1. Check `error` before using `data`
2. Map Supabase error codes to user-friendly Portuguese messages
3. Handle RLS "no rows returned" gracefully (not as crashes)
4. Retry on network errors with exponential backoff

## Migration Path from Demo

The hook interfaces remain similar to the demo. Key changes:

| Demo (mock) | Production (Supabase) |
|-------------|----------------------|
| `import { stores } from '@/data/stores'` | `supabase.from('stores').select()` |
| `DEMO_USER_LOCATION` (hardcoded) | `expo-location` (device GPS) |
| `appStore.isAuthenticated` (boolean flag) | `supabase.auth.getSession()` |
| `AsyncStorage` (onboarding flag) | Supabase profile + `expo-secure-store` |
| No favorites persistence | `user_favorites` table |
| No alerts | `user_alerts` + push notifications |
| No realtime | Supabase Realtime subscriptions |
| No shopping lists | `shopping_lists` + `shopping_list_items` (Plus) |
| No price history | `price_snapshots` table (Plus) |
| No competitive data | `get_competitor_prices` RPC (Premium B2B) |
| No search ranking | `stores.search_priority` ordering |
| No email alerts | Resend via Edge Functions (Premium B2B) |

---

## D1.5: Price Intelligence RPCs

### get_latest_index(p_city, p_state, p_limit)

Returns the last N published indices for a city/state.

```typescript
// Public index page — no auth required (anon RLS)
const { data: indices } = await supabase.rpc('get_latest_index', {
  p_city: 'Matao',
  p_state: 'SP',
  p_limit: 12,
});
// Returns: { id, period_start, period_end, index_value,
//   mom_change_percent, yoy_change_percent, data_quality_score,
//   product_count, store_count, published_at }[]
```

### get_price_movers(p_index_id, p_direction, p_limit)

Returns top price risers or fallers for a given index.

```typescript
// Top 5 price risers
const { data: risers } = await supabase.rpc('get_price_movers', {
  p_index_id: indexId,
  p_direction: 'up',
  p_limit: 5,
});
// Returns: { product_id, product_name, category_name,
//   avg_price, min_price, max_price, mom_change_percent }[]

// Top 5 price fallers
const { data: fallers } = await supabase.rpc('get_price_movers', {
  p_index_id: indexId,
  p_direction: 'down',
  p_limit: 5,
});
```

### Public Index Page Query Pattern

```typescript
// Get last 12 published indices (anon access via RLS)
const { data: indexRows } = await supabase
  .from('price_indices')
  .select('*')
  .eq('status', 'published')
  .order('period_start', { ascending: false })
  .limit(12);

// Get category breakdown for a specific index
const { data: categories } = await supabase
  .from('price_index_categories')
  .select('*, category:categories(name)')
  .eq('index_id', indexId)
  .order('weight', { ascending: false });
```

### Admin Index Management

```typescript
// Admin: view all indices (super_admin RLS)
const { data: allIndices } = await supabase
  .from('price_indices')
  .select('*')
  .order('period_start', { ascending: false });

// Admin: publish a draft index
await supabase
  .from('price_indices')
  .update({ status: 'published', published_at: new Date().toISOString() })
  .eq('id', indexId);

// Admin: get unresolved quality flags
const { data: flags } = await supabase
  .from('price_quality_flags')
  .select('*, product:products(name), store:stores(name)')
  .eq('is_resolved', false)
  .order('created_at', { ascending: false });

// Admin: resolve a quality flag
await supabase
  .from('price_quality_flags')
  .update({ is_resolved: true, resolved_by: userId, resolved_at: new Date().toISOString() })
  .eq('id', flagId);
```
