-- supabase/migrations/048_fix_search_category_id_ambiguity.sql
--
-- Fixes search_products_with_prices: the function parameter `category_id`
-- shadows the `products.category_id` column, so any bare reference to
-- `category_id` in the query body is rejected by Postgres as ambiguous.
-- This breaks the RPC on every call (not just null-location calls) --
-- confirmed by direct RPC tests with null location, real location, and an
-- explicit category_id, all returning:
--   "column reference \"category_id\" is ambiguous"
--
-- Fix: add `#variable_conflict use_variable` so bare, unqualified
-- identifiers resolve to the function's parameters. Already-qualified
-- references (p.category_id) are untouched.

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
