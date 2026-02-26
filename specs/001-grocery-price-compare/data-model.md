# Data Model: Grocery Price Comparison — Production (Supabase)

**Feature**: `001-grocery-price-compare`
**Date**: 2026-02-11

## Database: Supabase PostgreSQL

All tables live in the `public` schema with Row Level Security (RLS)
enabled. UUIDs are used for all primary keys. Timestamps use
`timestamptz`.

## Tables

### profiles

User profile linked to Supabase Auth. Created via database trigger
on `auth.users` INSERT.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | — | PK, references `auth.users.id` |
| role | text | no | `'consumer'` | `'consumer'` or `'business'` |
| display_name | text | yes | — | User's display name (from OAuth) |
| avatar_url | text | yes | — | Profile picture URL (from OAuth) |
| city | text | yes | — | User's city for location context |
| state | text | yes | — | User's state abbreviation (e.g., `SP`) |
| search_radius_km | integer | no | `5` | Preferred search radius (max 50) |
| b2c_plan | text | no | `'free'` | `'free'`, `'plus'`, or `'family'` |
| rc_customer_id | text | yes | — | RevenueCat customer ID |
| push_token | text | yes | — | Expo push notification token |
| created_at | timestamptz | no | `now()` | — |
| updated_at | timestamptz | no | `now()` | — |

**RLS policies**:
- SELECT: Users can read their own profile
- UPDATE: Users can update their own profile
- INSERT: Handled by database trigger (not direct user insert)

### stores

Physical supermarket locations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| name | text | no | — | Store display name |
| chain | text | yes | — | Chain/brand name |
| address | text | no | — | Full address (pt-BR) |
| city | text | no | — | City name |
| state | text | no | — | State abbreviation |
| latitude | double precision | no | — | Geo-coordinate |
| longitude | double precision | no | — | Geo-coordinate |
| logo_url | text | yes | — | Store logo in Supabase Storage |
| logo_initial | text | no | — | Single char for avatar fallback |
| logo_color | text | no | — | Brand color hex |
| phone | text | yes | — | Contact phone |
| b2b_plan | text | no | `'free'` | `'free'`, `'premium'`, `'premium_plus'`, `'enterprise'` |
| stripe_customer_id | text | yes | — | Stripe customer ID |
| stripe_subscription_id | text | yes | — | Active Stripe subscription ID |
| trial_ends_at | timestamptz | yes | — | Free trial expiry date (7-day trial) |
| search_priority | integer | no | `0` | Search ranking (0=free, 10=premium, 20=premium+, 30=enterprise) |
| is_active | boolean | no | `true` | Whether store is publicly visible |
| created_at | timestamptz | no | `now()` | — |
| updated_at | timestamptz | no | `now()` | — |

**RLS policies**:
- SELECT: Public read (all authenticated + anon) for active stores
- INSERT/UPDATE/DELETE: Only store members with `owner` or `admin` role

### store_members

Links users (business role) to stores they manage.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| store_id | uuid | no | — | FK → stores.id |
| user_id | uuid | no | — | FK → profiles.id |
| role | text | no | `'owner'` | `'owner'`, `'admin'`, `'staff'` |
| created_at | timestamptz | no | `now()` | — |

**Unique constraint**: `(store_id, user_id)`
**RLS policies**:
- SELECT: Members can see their own store memberships
- INSERT: Only store owners can add new members
- DELETE: Only store owners can remove members

### categories

Product categories for browsing tabs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | text | no | — | PK (e.g., `bebidas`) |
| name | text | no | — | Display name (pt-BR) |
| icon | text | no | — | Lucide icon name |
| sort_order | integer | no | `0` | Display order |

**RLS policies**:
- SELECT: Public read (anon + authenticated)
- INSERT/UPDATE/DELETE: Service role only (admin seeding)

### products

Grocery items that can have promotions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| name | text | no | — | Display name (pt-BR) |
| category_id | text | no | — | FK → categories.id |
| brand | text | yes | — | Brand name |
| reference_price | numeric(10,2) | no | — | Average price for "abaixo do normal" |
| image_url | text | yes | — | Product image |
| created_at | timestamptz | no | `now()` | — |
| updated_at | timestamptz | no | `now()` | — |

**RLS policies**:
- SELECT: Public read (anon + authenticated)
- INSERT/UPDATE: Store members (via store_members join) and service role

### product_synonyms

Synonym mapping for fuzzy search (e.g., "leite moca" → "leite condensado").
Enables FR-012 brand-to-product resolution.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| term | text | no | — | Search term (e.g., "leite moca") |
| product_id | uuid | no | — | FK → products.id (canonical product) |
| created_at | timestamptz | no | `now()` | — |

**Unique constraint**: `(term)`
**RLS policies**:
- SELECT: Public read (anon + authenticated)
- INSERT/UPDATE/DELETE: Service role only (admin seeding)

**Note**: Enable `pg_trgm` extension for trigram-based fuzzy matching
on `products.name`. Add GIN index: `CREATE INDEX ix_products_name_trgm
ON products USING gin (name gin_trgm_ops);`

### promotions

Time-bound price offers. Core table with Realtime enabled.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| product_id | uuid | no | — | FK → products.id |
| store_id | uuid | no | — | FK → stores.id |
| original_price | numeric(10,2) | no | — | Original/list price (BRL) |
| promo_price | numeric(10,2) | no | — | Promotional price (BRL) |
| start_date | timestamptz | no | — | Promotion start |
| end_date | timestamptz | no | — | Promotion end |
| status | text | no | `'active'` | `'active'`, `'expired'`, `'pending_review'` |
| verified | boolean | no | `false` | Confirmed by moderation |
| source | text | no | `'manual'` | `'manual'`, `'importador_ia'`, `'crawler'` |
| created_by | uuid | yes | — | FK → profiles.id (who created) |
| created_at | timestamptz | no | `now()` | — |
| updated_at | timestamptz | no | `now()` | — |

**Indexes**:
- `ix_promotions_store_id` on `store_id`
- `ix_promotions_product_id` on `product_id`
- `ix_promotions_status_end_date` on `(status, end_date)` — for active promotion queries
- `ix_promotions_category` on `product_id, store_id` — for category filtering

**Realtime**: Enabled via `alter publication supabase_realtime add table promotions;`

**RLS policies**:
- SELECT: Public read for `status = 'active' AND end_date > now()`
- INSERT: Store members only, with monthly limit check (Free: 5/month, Premium+: unlimited). Limit checked by counting rows where `created_at` falls in current calendar month (BRT timezone) — no counter column needed.
- UPDATE/DELETE: Store members for their own store's promotions

### user_favorites

Consumer's saved products.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_id | uuid | no | — | FK → profiles.id |
| product_id | uuid | no | — | FK → products.id |
| created_at | timestamptz | no | `now()` | — |

**Unique constraint**: `(user_id, product_id)`
**RLS policies**:
- SELECT: Users can read their own favorites
- INSERT: Users can add favorites (with B2C plan limit: Free max 10)
- DELETE: Users can remove their own favorites

### user_alerts

Consumer's price alert subscriptions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_id | uuid | no | — | FK → profiles.id |
| product_id | uuid | no | — | FK → products.id |
| target_price | numeric(10,2) | yes | — | Optional: alert when price drops below |
| radius_km | integer | no | `5` | Alert radius |
| is_active | boolean | no | `true` | Whether alert is enabled |
| created_at | timestamptz | no | `now()` | — |

**Unique constraint**: `(user_id, product_id)`
**RLS policies**:
- SELECT/INSERT/UPDATE/DELETE: Own alerts only (with B2C plan limit: Free max 3, Plus unlimited, Family unlimited)

### testimonials

Platform testimonials for onboarding (admin-seeded).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_name | text | no | — | Display name |
| text | text | no | — | Testimonial content (pt-BR) |
| savings_amount | numeric(10,2) | no | — | Amount saved (BRL) |
| sort_order | integer | no | `0` | Display order |

**RLS policies**:
- SELECT: Public read (anon + authenticated)

### shopping_lists (D1 Phase 2 — Plus feature)

Smart shopping lists for consumers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| user_id | uuid | no | — | FK → profiles.id |
| name | text | no | — | List name (e.g., "Compras da semana") |
| is_template | boolean | no | `false` | Recurring list template |
| created_at | timestamptz | no | `now()` | — |
| updated_at | timestamptz | no | `now()` | — |

**RLS policies**:
- SELECT/INSERT/UPDATE/DELETE: Own lists only (Plus/Family plan required)

### shopping_list_items (D1 Phase 2 — Plus feature)

Items within a shopping list.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| list_id | uuid | no | — | FK → shopping_lists.id (cascade delete) |
| product_id | uuid | no | — | FK → products.id |
| quantity | integer | no | `1` | Item quantity |
| is_checked | boolean | no | `false` | Checked off during shopping |
| created_at | timestamptz | no | `now()` | — |

**RLS policies**:
- SELECT/INSERT/UPDATE/DELETE: Via list ownership (join through shopping_lists)

### price_snapshots (D1 Phase 2 — Plus feature)

Daily aggregated price snapshots for graph visualization. One row per
product per day. Populated by a daily cron Edge Function. 90-day
retention (Plus), 180-day (Premium+ B2B, D2).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| product_id | uuid | no | — | FK → products.id |
| date | date | no | — | Snapshot date |
| min_promo_price | numeric(10,2) | yes | — | Cheapest active promotion price |
| avg_promo_price | numeric(10,2) | yes | — | Average across all active promotions |
| store_count | integer | no | `0` | How many stores have this on promo |
| reference_price | numeric(10,2) | yes | — | Product's reference_price at time of snapshot |
| created_at | timestamptz | no | `now()` | — |

**Unique constraint**: `(product_id, date)`
**Indexes**:
- `ix_snapshots_product_date` on `(product_id, date)` — unique
- `ix_snapshots_date` on `(date)` — for range queries and cleanup

**RLS policies**:
- SELECT: Plus/Family consumers and Premium+ B2B users
- INSERT: Service role only (via daily cron Edge Function)

### platform_stats

Singleton row for social proof stats (admin-managed).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | no | `1` | PK (always 1) |
| user_count | text | no | — | Formatted, e.g., "+3.200" |
| city_name | text | no | — | Target city |
| avg_monthly_savings | text | no | — | Formatted, e.g., "R$ 47" |
| updated_at | timestamptz | no | `now()` | — |

**RLS policies**:
- SELECT: Public read

## Relationships

```text
profiles        1 ←→ N store_members
stores          1 ←→ N store_members
stores          1 ←→ N promotions
products        1 ←→ N promotions
categories      1 ←→ N products
products        1 ←→ N product_synonyms
profiles        1 ←→ N user_favorites
profiles        1 ←→ N user_alerts
products        1 ←→ N user_favorites
products        1 ←→ N user_alerts
profiles        1 ←→ N shopping_lists
shopping_lists  1 ←→ N shopping_list_items
products        1 ←→ N shopping_list_items
products        1 ←→ N price_snapshots
```

- A User (profile) has a role: consumer or business.
- A business User can be a member of multiple Stores (via store_members).
- Store membership limited by plan: Free/Premium = 1 store, Premium+ = 5 stores (D2).
- A Store can have multiple members (owner, admin, staff).
- A Promotion links exactly one Product to exactly one Store.
- A consumer can favorite multiple Products (with plan-based limits).
- A consumer can set alerts for multiple Products (Free: 3, Plus/Family: unlimited).
- A consumer (Plus/Family) can create shopping lists with product items.
- Price snapshots track daily aggregated prices per product for graph visualization.

## State Transitions

### Promotion Lifecycle

```text
pending_review → active    (after moderation approval or auto-approve for verified stores)
active → expired           (when end_date passes — via scheduled Edge Function or query filter)
active → pending_review    (if flagged by price outlier detection)
```

### User Role

```text
(new user) → consumer      (default role on sign-up via "Sou Consumidor")
(new user) → business      (role set on sign-up via "Sou Lojista")
```

Role is set once during onboarding. Role switching (D2 scope) would
allow business users to browse as consumers.

### B2B Plan Transitions

```text
free → premium             (via Stripe Checkout + 7-day trial, CC required)
free → premium_plus        (D2: via Stripe Checkout + 7-day trial, CC required)
premium → premium_plus     (D2: upgrade via Stripe)
premium_plus → premium     (D2: downgrade via Stripe Customer Portal)
premium/premium_plus → free (subscription lapse after 7-day grace)
any → enterprise           (D2: custom onboarding, sob consulta)
```

### B2C Plan Transitions

```text
free → plus                (via RevenueCat in-app purchase)
free → family              (via RevenueCat in-app purchase)
plus → family              (upgrade via RevenueCat)
family → plus              (downgrade — manage in device settings)
plus/family → free         (subscription lapse)
```

## Plan Limits (Enforced via RLS + Application Logic)

### B2B Limits

| Resource | Free | Premium (D1) | Premium+ (D2) | Enterprise (D2) |
|----------|------|-------------|---------------|-----------------|
| Promotions | 5/month (resets 1st) | Unlimited | Unlimited | Unlimited |
| Stores | 1 (hard limit) | 1 (hard limit) | 5 | Unlimited |
| Importador IA | No | 4 imports/month | Unlimited (priority) | Custom |
| Competitive intelligence | No | 5km radius | 15km + advanced | Full + API |
| Email alerts | No | Daily digest | Real-time (D2) | Real-time + custom |
| Analytics | Dados basicos badge | Standard + "Verificado" badge | Advanced + "Melhor Preco" badge | Full + API |
| Price history | No | 90 days | 180 days | Unlimited |
| Search priority | Low (below paid) | High | Highest | Highest |
| Support | Community | Email | Priority | Dedicated |

### B2C Limits

| Resource | Free | Plus (D1) | Family (D2) |
|----------|------|----------|-------------|
| Favorites | 10 | Unlimited | Unlimited |
| Alerts | 3 | Unlimited | Unlimited |
| Store comparison | 5 stores | Unlimited | Unlimited |
| Smart shopping lists | No | Yes | Yes |
| Optimized routes | No | Yes | Yes |
| Price history | No | 90 days | 90 days |
| Ads | Placeholder banners | Hidden | Hidden |
| Shared lists | No | No | Yes (5 members) |

## Computed Fields (Application Layer)

These fields are derived at query/render time, not stored:

| Field | Derivation |
|-------|------------|
| discount_percent | `ROUND((1 - promo_price / original_price) * 100)` |
| below_normal_percent | `ROUND((1 - promo_price / product.reference_price) * 100)` |
| gamification_message | Based on discount_percent thresholds |
| is_expiring_soon | `end_date` within 24 hours of current time |
| distance_km | Haversine formula between user and store coordinates |

## Gamification Messages

| Threshold | Message |
|-----------|---------|
| >= 40% | "Voce evitou pagar caro!" |
| >= 25% | "Boa economia!" |
| >= 10% | "Vale a pena conferir" |
| < 10% | (no message) |

## Seed Data (Development)

Existing mock data files in `mobile/data/` serve as seed data:

| Entity | Count | Source |
|--------|-------|--------|
| Stores | 4 | mobile/data/stores.ts |
| Categories | 7 | mobile/data/categories.ts |
| Products | 21 | mobile/data/products.ts |
| Promotions | 29 | mobile/data/promotions.ts |
| Testimonials | 3 | mobile/data/testimonials.ts |

A Supabase seed script (`supabase/seed.sql`) will be generated from
these files for consistent development environments.

## Database Functions

### check_promotion_limit(store_id uuid)

Returns boolean. Checks if a store has reached its monthly
promotion limit by counting rows where `created_at` falls in the
current calendar month (BRT timezone). No counter column needed —
always correct, idempotent, no reset logic required.

```sql
create or replace function public.check_promotion_limit(p_store_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select case
    when s.b2b_plan in ('premium', 'premium_plus', 'enterprise') then true
    else (
      select count(*) < 5
      from public.promotions
      where store_id = p_store_id
        and created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
        and created_at < date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month'
    )
  end
  from public.stores s where s.id = p_store_id;
$$;
```

**Index for fast counting**:
```sql
create index ix_promotions_store_created on public.promotions (store_id, created_at);
```

### update_search_priority()

Trigger function that automatically sets `stores.search_priority`
when `b2b_plan` changes.

```sql
create or replace function public.update_search_priority()
returns trigger
language plpgsql
as $$
begin
  new.search_priority := case
    when new.b2b_plan = 'enterprise' then 30
    when new.b2b_plan = 'premium_plus' then 20
    when new.b2b_plan = 'premium' then 10
    else 0
  end;
  return new;
end;
$$;

create trigger trg_stores_search_priority
  before insert or update of b2b_plan on public.stores
  for each row execute function update_search_priority();
```

### check_store_limit(user_id uuid)

Returns boolean. Checks if a business user has reached their
plan-based store limit before allowing new store_members INSERT.

```sql
create or replace function public.check_store_limit(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select case
    when p.role != 'business' then false
    when exists (
      select 1 from public.store_members sm
      join public.stores s on s.id = sm.store_id
      where sm.user_id = p_user_id
      and s.b2b_plan in ('premium_plus', 'enterprise')
    ) then (
      select count(*) < 5 from public.store_members
      where user_id = p_user_id and role = 'owner'
    )
    else (
      select count(*) < 1 from public.store_members
      where user_id = p_user_id and role = 'owner'
    )
  end
  from public.profiles p where p.id = p_user_id;
$$;
```

### get_competitor_prices(store_id, radius_km)

RPC function for competitive intelligence (Premium B2B). Returns
competitor prices for products the store sells, within a geographic
radius using Haversine distance calculation.

```sql
-- See contracts/supabase-api.md for full RPC function signatures
-- and response shapes. Uses Haversine formula (no PostGIS needed).
```

### check_favorite_limit(user_id uuid)

Returns boolean. Checks B2C plan-based favorite limit.

```sql
create or replace function public.check_favorite_limit(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select case
    when p.b2c_plan in ('plus', 'family') then true
    else (
      select count(*) < 10 from public.user_favorites
      where user_id = p_user_id
    )
  end
  from public.profiles p where p.id = p_user_id;
$$;
```

### check_alert_limit(user_id uuid)

Returns boolean. Checks B2C plan-based alert limit.
Plus and Family: unlimited. Free: max 3.

```sql
create or replace function public.check_alert_limit(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select case
    when p.b2c_plan in ('plus', 'family') then true
    else (
      select count(*) < 3 from public.user_alerts
      where user_id = p_user_id and is_active = true
    )
  end
  from public.profiles p where p.id = p_user_id;
$$;
```

## Supabase Edge Functions

### notify-favorite-match

Triggered by database webhook on `promotions` INSERT. Queries
`user_favorites` + `user_alerts` to find matching consumers, then
sends push notifications via Expo's push service.

### expire-promotions

Scheduled (cron) Edge Function that sets `status = 'expired'` on
promotions where `end_date < now()`. Runs every 15 minutes.

### daily-digest (D1 Phase 2 — Premium feature)

Scheduled Edge Function (daily, 8am BRT). For each Premium B2B
store, generates a digest email with:
- Competitor price comparisons within 5km radius
- Their ranking by product/category
- Expiring promotions summary
Sends via Resend API to store owner's email.

### trial-reminders

Scheduled Edge Function (daily). Queries stores where `trial_ends_at`
is approaching and sends reminder emails via Resend:
- Day 3: "Voce ja usou metade do seu periodo de teste"
- Day 5: "Faltam 2 dias para o fim do teste"
- Day 7: "Ultimo dia! Assine para nao perder acesso"
Each email includes a direct link to upgrade via Stripe Checkout.

### daily-price-snapshot (D1 Phase 2)

Scheduled Edge Function (daily, 1am BRT via pg_cron). Queries all
products with active promotions and inserts one `price_snapshots`
row per product with min/avg promo price and store count. Also
cleans up snapshots older than 365 days (extended from 90 for YoY
index calculation). Also performs outlier detection and staleness
checks, inserting flags into `price_quality_flags`.

---

## D1.5 Tables (Price Intelligence)

### price_indices

One row per month per city. Stores the computed regional price index.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| city | text | no | — | City name |
| state | text | no | — | State abbreviation |
| period_start | date | no | — | First day of month |
| period_end | date | no | — | Last day of month |
| index_value | numeric(10,4) | no | `100` | CPI-like index value (base 100) |
| mom_change_percent | numeric(6,2) | yes | — | Month-over-month change |
| yoy_change_percent | numeric(6,2) | yes | — | Year-over-year change |
| data_quality_score | integer | no | `0` | 0-100 quality score |
| product_count | integer | no | `0` | Products included in computation |
| store_count | integer | no | `0` | Stores contributing data |
| snapshot_count | integer | no | `0` | Data points used |
| status | text | no | `'draft'` | `'draft'`, `'published'`, `'archived'` |
| published_at | timestamptz | yes | — | When published |
| created_at | timestamptz | no | `now()` | — |
| updated_at | timestamptz | no | `now()` | — |

**Unique constraint**: `(city, state, period_start)`

**RLS policies**:
- SELECT (anon + authenticated): Only `status = 'published'` rows
- ALL (super_admin): Full access for management

### price_index_categories

Category-level breakdown per monthly index.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| index_id | uuid | no | — | FK → price_indices |
| category_id | text | no | — | FK → categories |
| avg_price | numeric(10,2) | no | — | Average price in category |
| min_price | numeric(10,2) | no | — | Minimum price in category |
| max_price | numeric(10,2) | no | — | Maximum price in category |
| product_count | integer | no | `0` | Products in category |
| mom_change_percent | numeric(6,2) | yes | — | Category MoM change |
| weight | numeric(5,4) | no | `0` | Category weight in index (0-1) |
| created_at | timestamptz | no | `now()` | — |

**Unique constraint**: `(index_id, category_id)`

### price_index_products

Product-level detail per monthly index. Source for "top movers."

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| index_id | uuid | no | — | FK → price_indices |
| product_id | uuid | no | — | FK → products |
| avg_price | numeric(10,2) | no | — | Monthly average price |
| min_price | numeric(10,2) | no | — | Lowest price seen |
| max_price | numeric(10,2) | no | — | Highest price seen |
| snapshot_days | integer | no | `0` | Days with price data |
| mom_change_percent | numeric(6,2) | yes | — | Product MoM change |
| created_at | timestamptz | no | `now()` | — |

**Unique constraint**: `(index_id, product_id)`

### price_quality_flags

Data quality anomalies detected by daily-price-snapshot function.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | `gen_random_uuid()` | PK |
| product_id | uuid | no | — | FK → products |
| store_id | uuid | yes | — | FK → stores |
| promotion_id | uuid | yes | — | FK → promotions |
| flag_type | text | no | — | `'outlier_high'`, `'outlier_low'`, `'stale'`, `'missing_data'`, `'suspicious_pattern'` |
| severity | text | no | `'medium'` | `'low'`, `'medium'`, `'high'`, `'critical'` |
| detail | text | yes | — | Human-readable description |
| reference_value | numeric(10,2) | yes | — | Expected value |
| actual_value | numeric(10,2) | yes | — | Found value |
| is_resolved | boolean | no | `false` | Whether admin resolved |
| resolved_by | uuid | yes | — | FK → profiles |
| resolved_at | timestamptz | yes | — | Resolution timestamp |
| created_at | timestamptz | no | `now()` | — |

**RLS**: Admin-only (super_admin full access)

### price_snapshots (modified)

Added `store_id` column (FK → stores) for richer competitive data.

## D1.5 RPCs

### get_latest_index(p_city, p_state, p_limit)

Returns last N published indices for a city, ordered by period descending.

### get_price_movers(p_index_id, p_direction, p_limit)

Returns top price risers (`p_direction = 'up'`) or fallers (`'down'`)
for a given index, with product name, category, prices, and MoM change.

## D1.5 Edge Functions

### monthly-price-index

Scheduled Edge Function (1st of month, 2am BRT). Computes CPI-like
monthly price index per city:
1. Aggregates daily snapshots for prior month
2. Groups by category with IPCA-inspired weights
3. Computes index relative to product reference prices
4. Calculates MoM and YoY changes
5. Produces data quality score (0-100)
6. Auto-publishes if quality >= 70, otherwise saves as draft

### daily-price-snapshot (enhanced)

Now includes:
- Outlier detection: flags prices <30% or >150% of reference_price
- Staleness check: flags products with no data in 7+ days
- Extended retention: 365 days (was 90) for YoY index calculation
