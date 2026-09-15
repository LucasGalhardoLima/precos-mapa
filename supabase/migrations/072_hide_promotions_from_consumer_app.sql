-- supabase/migrations/072_hide_promotions_from_consumer_app.sql
--
-- Removes promotions from consumer-facing surfaces "for now" while
-- consolidation + PDF-encarte validation work is figured out. Deliberately
-- scoped to the read path only:
--
-- shortcut: blocks ALL consumer reads of `promotions` (RLS) and strips the
-- promotion-driven tier out of the two consumer price RPCs, rather than a
-- finer-grained per-source toggle (e.g. keep PDF-validated promos visible).
-- upgrade: once crawler-sourced promotions are cross-validated against
-- PDF-encarte imports (importador_ia), reinstate a scoped version of this
-- (e.g. only source='crawler' hidden, or only until validated) instead of
-- blanket-hiding every source.
--
-- Explicitly NOT touched, and must keep working exactly as before:
--   - promotions table/schema, sync_promotion_to_store_price trigger (054),
--     expire-promotions edge function — all load-bearing for store_prices.
--   - src/lib/crawler-promotions.ts / scripts/scrape-*-prices.ts write path.
--   - "promotions_select_own_store" / "_super_admin" RLS policies and the
--     insert/update/delete "_member" policies — business self-service
--     (/painel/ofertas, mobile (business)/offers.tsx) and the admin
--     moderation queue (importador_ia) keep reading/writing promotions
--     exactly as before; only the anon/authenticated "see all active
--     promotions" policy is gated off.
--   - get_competitor_prices / get_store_rankings (migration 003) — B2B
--     competitive-intel RPCs, not consumer-facing.

-- =============================================================================
-- 1. RLS: anon/authenticated consumers can no longer read active promotions
--    directly. This alone covers every mobile hook/screen that queries
--    `promotions` straight from the client (use-promotions.ts store-grouped
--    mode, use-stores.ts, use-featured-deals.ts, use-shopping-list.ts,
--    use-economy-summary.ts, use-favorites.ts, product/[id].tsx) — they'll
--    all just get zero rows and fall back to whatever empty state they
--    already render.
-- =============================================================================

DROP POLICY IF EXISTS "promotions_select_active" ON public.promotions;

CREATE POLICY "promotions_select_active" ON public.promotions
  FOR SELECT TO anon, authenticated USING (false);

-- =============================================================================
-- 2. search_products_with_prices / get_product_prices (last redefined in
--    068) — drop the promotion-driven tier entirely. These run
--    SECURITY DEFINER so RLS above doesn't reach them; they need their own
--    fix. Tier order becomes: 1 crawler, 2 crowdsourced, 3 reference, 4
--    nothing (was: 1 active promo, 2 crawler, 3 last_price, 4 crowdsourced,
--    5 reference, 6 nothing).
--
--    has_active_price / active_count are reinterpreted rather than zeroed:
--    has_active_price now means "has a real scraped/crowdsourced price"
--    (not "has an active promo") so mobile/app/(tabs)/search.tsx's existing
--    priced/no-price split and mobile/components/product-price-card.tsx's
--    existing three-state rendering (live price / last known / catalog-only)
--    keep working without any promo framing — badges and discount% there
--    are keyed off price_type === 'active' and original_price, both of
--    which simply never occur anymore. active_count has no consumer either
--    way; left at 0.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_products_with_prices(
  query          text,
  user_lat       float,
  user_lng       float,
  radius_km      float DEFAULT 10,
  category_id    text  DEFAULT NULL,
  page_size      int   DEFAULT 30,
  page_offset    int   DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
#variable_conflict use_variable
DECLARE
  result     jsonb;
  safe_query text;
BEGIN
  IF length(trim(query)) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  safe_query := replace(replace(replace(trim(query), '\', '\\'), '%', '\%'), '_', '\_');

  SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      p.id                AS product_id,
      p.name              AS product_name,
      p.brand,
      c.name              AS category,
      p.image_url,
      p.reference_price,
      (cr.product_id IS NOT NULL OR sd.product_id IS NOT NULL)             AS has_active_price,
      0::bigint                                                            AS active_count,
      COALESCE(cr.cheapest_price, sd.cheapest_price, p.reference_price)    AS cheapest_price,
      COALESCE(cr.prices, '[]'::jsonb) || COALESCE(sd.prices, '[]'::jsonb) AS prices
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN (
      -- Official retailer prices from scripts/scrape-*-prices.ts. Trusted
      -- outright — no confidence field, no staleness cutoff — since these
      -- are re-scraped periodically rather than aged out at query time.
      SELECT
        sp.product_id,
        min(sp.price)                                            AS cheapest_price,
        jsonb_agg(
          jsonb_build_object(
            'store_id',           s.id,
            'store_name',         s.name,
            'price',              sp.price,
            'original_price',     NULL,
            'price_type',         'crawler',
            'distance_km',        CASE
              WHEN user_lat IS NULL OR user_lng IS NULL THEN NULL
              ELSE round((
                6371 * acos(
                  least(1.0, greatest(-1.0,
                    cos(radians(user_lat)) * cos(radians(s.latitude))
                    * cos(radians(s.longitude) - radians(user_lng))
                    + sin(radians(user_lat)) * sin(radians(s.latitude))
                  ))
                )
              )::numeric, 1)
            END,
            'end_date',           NULL,
            'last_price_date',    sp.updated_at,
            'store_logo_initial', s.logo_initial,
            'store_logo_color',   s.logo_color,
            'search_priority',    s.search_priority
          )
          ORDER BY s.search_priority DESC, sp.price ASC
        ) AS prices
      FROM public.store_prices sp
      JOIN public.stores s ON s.id = sp.store_id
      WHERE
        sp.source = 'crawler'
        AND s.is_active = TRUE
        AND (
          user_lat IS NULL OR user_lng IS NULL
          OR (
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(user_lat)) * cos(radians(s.latitude))
                * cos(radians(s.longitude) - radians(user_lng))
                + sin(radians(user_lat)) * sin(radians(s.latitude))
              ))
            )
          ) <= radius_km
        )
      GROUP BY sp.product_id
    ) cr ON cr.product_id = p.id
    LEFT JOIN (
      -- Crowdsourced-only store_prices, with confidence decay and a 14-day
      -- staleness cutoff (see migration 058's original header).
      SELECT
        sp.product_id,
        min(sp.price)                                            AS cheapest_price,
        jsonb_agg(
          jsonb_build_object(
            'store_id',           s.id,
            'store_name',         s.name,
            'price',              sp.price,
            'original_price',     NULL,
            'price_type',         'crowdsourced',
            'confidence',         CASE
              WHEN now() - sp.updated_at < interval '48 hours' THEN sp.confidence
              WHEN now() - sp.updated_at < interval '5 days'   THEN round(sp.confidence * 0.5, 2)
              ELSE                                                   round(sp.confidence * 0.25, 2)
            END,
            'distance_km',        CASE
              WHEN user_lat IS NULL OR user_lng IS NULL THEN NULL
              ELSE round((
                6371 * acos(
                  least(1.0, greatest(-1.0,
                    cos(radians(user_lat)) * cos(radians(s.latitude))
                    * cos(radians(s.longitude) - radians(user_lng))
                    + sin(radians(user_lat)) * sin(radians(s.latitude))
                  ))
                )
              )::numeric, 1)
            END,
            'end_date',           NULL,
            'last_price_date',    sp.updated_at,
            'store_logo_initial', s.logo_initial,
            'store_logo_color',   s.logo_color,
            'search_priority',    s.search_priority
          )
          ORDER BY s.search_priority DESC, sp.price ASC
        ) AS prices
      FROM public.store_prices sp
      JOIN public.stores s ON s.id = sp.store_id
      WHERE
        sp.source = 'crowdsourced'
        AND sp.updated_at > now() - interval '14 days'
        AND s.is_active = TRUE
        AND (
          user_lat IS NULL OR user_lng IS NULL
          OR (
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(user_lat)) * cos(radians(s.latitude))
                * cos(radians(s.longitude) - radians(user_lng))
                + sin(radians(user_lat)) * sin(radians(s.latitude))
              ))
            )
          ) <= radius_km
        )
      GROUP BY sp.product_id
    ) sd ON sd.product_id = p.id
    WHERE
      (
        similarity(p.name, query) > 0.3
        OR p.name ilike '%' || safe_query || '%'
        OR EXISTS (
          SELECT 1 FROM public.product_synonyms ps
          WHERE ps.product_id = p.id
            AND (
              similarity(ps.term, query) > 0.3
              OR ps.term ilike '%' || safe_query || '%'
            )
        )
      )
      AND (category_id IS NULL OR p.category_id = category_id)
    ORDER BY
      -- Tier 1: crawler (official retailer price) → 2: crowdsourced store_price
      -- → 3: catalog+reference → 4: catalog, no price at all
      CASE
        WHEN cr.product_id IS NOT NULL                   THEN 1
        WHEN sd.product_id IS NOT NULL                    THEN 2
        WHEN p.reference_price IS NOT NULL                THEN 3
        ELSE                                                  4
      END ASC,
      COALESCE(cr.cheapest_price, sd.cheapest_price, p.reference_price) ASC NULLS LAST
    LIMIT  page_size
    OFFSET page_offset
  ) AS r;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_product_prices(
  product_id uuid,
  user_lat   float DEFAULT NULL,
  user_lng   float DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.search_priority DESC, r.price ASC), '[]'::jsonb)
  FROM (
    SELECT
      s.id                 AS store_id,
      s.name               AS store_name,
      sp.price,
      NULL::numeric        AS original_price,
      'crawler'            AS price_type,
      1.0::numeric         AS confidence,
      CASE
        WHEN user_lat IS NULL OR user_lng IS NULL THEN NULL
        ELSE round((
          6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(user_lat)) * cos(radians(s.latitude))
              * cos(radians(s.longitude) - radians(user_lng))
              + sin(radians(user_lat)) * sin(radians(s.latitude))
            ))
          )
        )::numeric, 1)
      END                  AS distance_km,
      NULL::timestamptz    AS end_date,
      sp.updated_at        AS last_price_date,
      s.logo_initial       AS store_logo_initial,
      s.logo_color         AS store_logo_color,
      s.search_priority
    FROM public.store_prices sp
    JOIN public.stores s ON s.id = sp.store_id
    WHERE sp.product_id = get_product_prices.product_id
      AND sp.source = 'crawler'
      AND s.is_active = TRUE

    UNION ALL

    SELECT
      s.id                 AS store_id,
      s.name               AS store_name,
      sp.price,
      NULL::numeric        AS original_price,
      'crowdsourced'       AS price_type,
      CASE
        WHEN now() - sp.updated_at < interval '48 hours' THEN sp.confidence
        WHEN now() - sp.updated_at < interval '5 days'   THEN round(sp.confidence * 0.5, 2)
        ELSE                                                   round(sp.confidence * 0.25, 2)
      END                  AS confidence,
      CASE
        WHEN user_lat IS NULL OR user_lng IS NULL THEN NULL
        ELSE round((
          6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(user_lat)) * cos(radians(s.latitude))
              * cos(radians(s.longitude) - radians(user_lng))
              + sin(radians(user_lat)) * sin(radians(s.latitude))
            ))
          )
        )::numeric, 1)
      END                  AS distance_km,
      NULL::timestamptz    AS end_date,
      sp.updated_at        AS last_price_date,
      s.logo_initial       AS store_logo_initial,
      s.logo_color         AS store_logo_color,
      s.search_priority
    FROM public.store_prices sp
    JOIN public.stores s ON s.id = sp.store_id
    WHERE sp.product_id = get_product_prices.product_id
      AND sp.source = 'crowdsourced'
      AND sp.updated_at > now() - interval '14 days'
      AND s.is_active = TRUE
      -- Don't duplicate a store that already has a crawler price above
      -- (crawler outranks crowdsourced).
      AND NOT EXISTS (
        SELECT 1 FROM public.store_prices sp2
        WHERE sp2.product_id = sp.product_id
          AND sp2.store_id = sp.store_id
          AND sp2.source = 'crawler'
      )
  ) r;
$$;

-- =============================================================================
-- 3. get_trending_products (028) was entirely promotion-driven (ranked by
--    active promo count + discount %) and has no non-promo definition —
--    return empty rather than leaving a promo-only discovery feature
--    exposed. Feeds mobile's search-discovery "trending" chips, which
--    already handle an empty trending list.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_trending_products(
  result_limit int DEFAULT 3
)
RETURNS TABLE (
  id            uuid,
  name          text,
  min_price     numeric,
  max_price     numeric,
  store_count   bigint,
  discount_pct  integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN;
END;
$$;
