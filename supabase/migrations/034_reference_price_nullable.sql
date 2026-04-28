-- Allow products to exist without a reference price (e.g. Cosmos-seeded catalog products
-- where avg_price is not available on the free tier).
ALTER TABLE public.products
  ALTER COLUMN reference_price DROP NOT NULL;
