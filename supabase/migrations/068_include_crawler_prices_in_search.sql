-- supabase/migrations/068_include_crawler_prices_in_search.sql
--
-- search_products_with_prices and get_product_prices have never surfaced
-- store_prices rows with source = 'crawler' — only 'promotions' rows and
-- store_prices with source = 'crowdsourced' feed the `prices` array/tiering,
-- a gap that predates the 'crawler' source itself (055/057/058 all filter
-- on sp.source = 'crowdsourced' only, even though 030 added 'crawler' as a
-- valid source from the start). Confirmed live: a product with a real
-- crawler-sourced store_prices row came back from search with `prices: []`,
-- with cheapest_price only coincidentally right because it fell back to
-- p.reference_price. Every price scraped by scripts/scrape-*-prices.ts
-- (~28k rows across 4 retailers as of 2026-09-04/05) was invisible to both
-- search and the product detail page.
--
-- Fix: add crawler as a new tier, ranked above last_price/crowdsourced and
-- below an active promotion — an official retailer-scraped price is more
-- trustworthy than a single user's NFC-e scan, and unlike crowdsourced it
-- gets no confidence decay or staleness cutoff, since freshness here comes
-- from re-running the scrapers periodically (see [[live_price_scrapers_status
-- ]] in project memory) rather than from a query-time age filter.
--
-- New tier order: 1 active promo, 2 crawler, 3 last_price, 4 crowdsourced,
-- 5 reference_price, 6 nothing.

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
      COALESCE(pd.has_active_price, false)                        AS has_active_price,
      COALESCE(pd.active_count,     0)                            AS active_count,
      COALESCE(pd.cheapest_price, cr.cheapest_price, sd.cheapest_price, p.reference_price) AS cheapest_price,
      COALESCE(pd.prices, '[]'::jsonb) || COALESCE(cr.prices, '[]'::jsonb) || COALESCE(sd.prices, '[]'::jsonb) AS prices
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN (
      -- Promotion-driven prices (active or last_price), unchanged from 035.
      SELECT
        pr.product_id,
        (count(*) FILTER (WHERE pr.status = 'active' AND pr.end_date > now()) > 0)
                                                                AS has_active_price,
        count(*) FILTER (WHERE pr.status = 'active' AND pr.end_date > now())
                                                                AS active_count,
        min(CASE WHEN pr.status = 'active' THEN pr.promo_price
                 ELSE pr.last_known_price END)                  AS cheapest_price,
        jsonb_agg(
          jsonb_build_object(
            'store_id',           s.id,
            'store_name',         s.name,
            'price',              CASE WHEN pr.status = 'active'
                                       THEN pr.promo_price
                                       ELSE pr.last_known_price END,
            'original_price',     pr.original_price,
            'price_type',         pr.status,
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
            'end_date',           CASE WHEN pr.status = 'active' THEN pr.end_date ELSE NULL END,
            'last_price_date',    pr.last_price_date,
            'store_logo_initial', s.logo_initial,
            'store_logo_color',   s.logo_color,
            'search_priority',    s.search_priority
          )
          ORDER BY
            s.search_priority DESC,
            (CASE WHEN pr.status = 'active' THEN pr.promo_price
                  ELSE pr.last_known_price END) ASC
        ) AS prices
      FROM public.promotions pr
      JOIN public.stores s ON s.id = pr.store_id
      WHERE
        ((pr.status = 'active' AND pr.end_date > now()) OR pr.status = 'last_price')
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
      GROUP BY pr.product_id
    ) pd ON pd.product_id = p.id
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
      -- Tier 1: active promo → 2: crawler (official retailer price) →
      -- 3: last_price → 4: crowdsourced store_price → 5: catalog+reference
      -- → 6: catalog, no price at all
      CASE
        WHEN COALESCE(pd.has_active_price, false)        THEN 1
        WHEN cr.product_id IS NOT NULL                   THEN 2
        WHEN pd.product_id IS NOT NULL                    THEN 3
        WHEN sd.product_id IS NOT NULL                    THEN 4
        WHEN p.reference_price IS NOT NULL                THEN 5
        ELSE                                                  6
      END ASC,
      COALESCE(pd.cheapest_price, cr.cheapest_price, sd.cheapest_price, p.reference_price) ASC NULLS LAST
    LIMIT  page_size
    OFFSET page_offset
  ) AS r;

  RETURN result;
END;
$$;

-- =============================================================================
-- get_product_prices — same crawler tier added to the union, ranked between
-- the promotions branch and the crowdsourced branch. Each branch excludes
-- stores already covered by a higher-priority branch above it.
-- =============================================================================

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
      CASE WHEN pr.status = 'active' THEN pr.promo_price ELSE pr.last_known_price END AS price,
      pr.original_price,
      pr.status            AS price_type,
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
      CASE WHEN pr.status = 'active' THEN pr.end_date ELSE NULL END AS end_date,
      pr.last_price_date,
      s.logo_initial       AS store_logo_initial,
      s.logo_color         AS store_logo_color,
      s.search_priority
    FROM public.promotions pr
    JOIN public.stores s ON s.id = pr.store_id
    WHERE pr.product_id = get_product_prices.product_id
      AND ((pr.status = 'active' AND pr.end_date > now()) OR pr.status = 'last_price')
      AND s.is_active = TRUE

    UNION ALL

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
      -- Don't duplicate a store that already has an active/last_price promo above.
      AND NOT EXISTS (
        SELECT 1 FROM public.promotions pr2
        WHERE pr2.product_id = sp.product_id
          AND pr2.store_id = sp.store_id
          AND ((pr2.status = 'active' AND pr2.end_date > now()) OR pr2.status = 'last_price')
      )

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
      -- Don't duplicate a store that already has an active/last_price promo,
      -- or a crawler price (crawler outranks crowdsourced), above.
      AND NOT EXISTS (
        SELECT 1 FROM public.promotions pr2
        WHERE pr2.product_id = sp.product_id
          AND pr2.store_id = sp.store_id
          AND ((pr2.status = 'active' AND pr2.end_date > now()) OR pr2.status = 'last_price')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.store_prices sp2
        WHERE sp2.product_id = sp.product_id
          AND sp2.store_id = sp.store_id
          AND sp2.source = 'crawler'
      )
  ) r;
$$;
