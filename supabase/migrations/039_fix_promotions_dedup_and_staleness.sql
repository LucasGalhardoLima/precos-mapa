-- supabase/migrations/039_fix_promotions_dedup_and_staleness.sql
--
-- 1. Purge last_price rows older than 30 days (stale reference prices).
-- 2. Expire duplicate active promotions per (product_id, store_id), keeping cheapest.
-- 3. Expire duplicate last_price rows per (product_id, store_id), keeping most recent.
-- 4. Add partial unique indexes to prevent future duplicates.
-- 5. Update search RPC to enforce 30-day staleness window on last_price rows.

-- ── Step 1: Purge stale last_price rows ─────────────────────────────────────
UPDATE public.promotions
SET    status = 'expired', updated_at = now()
WHERE  status = 'last_price'
  AND  last_price_date < now() - interval '30 days';

-- ── Step 2: Expire duplicate active promotions (keep cheapest per store) ────
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY product_id, store_id
      ORDER BY promo_price ASC, created_at DESC
    ) AS rn
  FROM public.promotions
  WHERE status = 'active'
)
UPDATE public.promotions
SET    status = 'expired', updated_at = now()
WHERE  id IN (SELECT id FROM ranked WHERE rn > 1);

-- ── Step 3: Expire duplicate last_price rows (keep most recent per store) ───
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY product_id, store_id
      ORDER BY last_price_date DESC NULLS LAST
    ) AS rn
  FROM public.promotions
  WHERE status = 'last_price'
)
UPDATE public.promotions
SET    status = 'expired', updated_at = now()
WHERE  id IN (SELECT id FROM ranked WHERE rn > 1);

-- ── Step 4: Partial unique indexes to prevent future duplicates ──────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_promotions_active_per_store
  ON public.promotions (product_id, store_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_promotions_last_price_per_store
  ON public.promotions (product_id, store_id)
  WHERE status = 'last_price';

-- ── Step 5: Search RPC — add 30-day staleness window for last_price rows ────
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
      COALESCE(pd.cheapest_price,   p.reference_price)            AS cheapest_price,
      COALESCE(pd.prices,           '[]'::jsonb)                  AS prices
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN (
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
        (
          (pr.status = 'active' AND pr.end_date > now())
          OR (pr.status = 'last_price' AND pr.last_price_date > now() - interval '30 days')
        )
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
      CASE
        WHEN COALESCE(pd.has_active_price, false)        THEN 1
        WHEN pd.product_id IS NOT NULL                   THEN 2
        WHEN p.reference_price IS NOT NULL               THEN 3
        ELSE                                                  4
      END ASC,
      COALESCE(pd.cheapest_price, p.reference_price) ASC NULLS LAST
    LIMIT  page_size
    OFFSET page_offset
  ) AS r;

  RETURN result;
END;
$$;
