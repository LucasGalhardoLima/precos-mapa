-- seed.sql: Development seed data for PrecoMapa
-- Source: mobile/data/*.ts mock files

-- =============================================================================
-- Categories (7 rows)
-- =============================================================================

insert into public.categories (id, name, icon, sort_order) values
  ('cat_todos', 'Todos', 'package', 0),
  ('cat_bebidas', 'Bebidas', 'coffee', 1),
  ('cat_limpeza', 'Limpeza', 'sparkles', 2),
  ('cat_alimentos', 'Alimentos', 'wheat', 3),
  ('cat_hortifruti', 'Hortifruti', 'apple', 4),
  ('cat_padaria', 'Padaria', 'croissant', 5),
  ('cat_higiene', 'Higiene', 'heart', 6);

-- =============================================================================
-- Products (21 rows)
-- =============================================================================

insert into public.products (id, name, category_id, brand, reference_price) values
  -- Bebidas
  ('a0000000-0000-4000-a000-000000000001', 'Coca-Cola 2L', 'cat_bebidas', 'Coca-Cola', 10.99),
  ('a0000000-0000-4000-a000-000000000002', 'Suco Del Valle 1L', 'cat_bebidas', 'Del Valle', 7.49),
  ('a0000000-0000-4000-a000-000000000003', 'Cerveja Skol 350ml', 'cat_bebidas', 'Skol', 3.99),
  ('a0000000-0000-4000-a000-000000000004', 'Leite Integral 1L', 'cat_bebidas', 'Parmalat', 5.99),
  -- Limpeza
  ('a0000000-0000-4000-a000-000000000005', 'Detergente Ype 500ml', 'cat_limpeza', 'Ype', 2.99),
  ('a0000000-0000-4000-a000-000000000006', 'Sabao em Po Omo 1kg', 'cat_limpeza', 'Omo', 15.99),
  ('a0000000-0000-4000-a000-000000000007', 'Desinfetante Pinho Sol 500ml', 'cat_limpeza', 'Pinho Sol', 6.49),
  -- Alimentos
  ('a0000000-0000-4000-a000-000000000008', 'Arroz Tio Joao 5kg', 'cat_alimentos', 'Tio Joao', 27.99),
  ('a0000000-0000-4000-a000-000000000009', 'Feijao Carioca 1kg', 'cat_alimentos', 'Camil', 8.99),
  ('a0000000-0000-4000-a000-000000000010', 'Macarrao Renata 500g', 'cat_alimentos', 'Renata', 4.49),
  ('a0000000-0000-4000-a000-000000000011', 'Oleo de Soja Liza 900ml', 'cat_alimentos', 'Liza', 7.99),
  -- Hortifruti
  ('a0000000-0000-4000-a000-000000000012', 'Banana Prata 1kg', 'cat_hortifruti', null, 5.99),
  ('a0000000-0000-4000-a000-000000000013', 'Tomate Italiano 1kg', 'cat_hortifruti', null, 8.49),
  ('a0000000-0000-4000-a000-000000000014', 'Batata Lavada 1kg', 'cat_hortifruti', null, 6.99),
  ('a0000000-0000-4000-a000-000000000015', 'Cebola 1kg', 'cat_hortifruti', null, 4.99),
  -- Padaria
  ('a0000000-0000-4000-a000-000000000016', 'Pao Frances 1kg', 'cat_padaria', null, 14.99),
  ('a0000000-0000-4000-a000-000000000017', 'Bolo de Chocolate', 'cat_padaria', null, 18.99),
  ('a0000000-0000-4000-a000-000000000018', 'Biscoito Maizena 200g', 'cat_padaria', 'Vitarella', 3.99),
  -- Higiene
  ('a0000000-0000-4000-a000-000000000019', 'Sabonete Dove 90g', 'cat_higiene', 'Dove', 4.49),
  ('a0000000-0000-4000-a000-000000000020', 'Shampoo Pantene 400ml', 'cat_higiene', 'Pantene', 19.99),
  ('a0000000-0000-4000-a000-000000000021', 'Pasta de Dente Colgate 90g', 'cat_higiene', 'Colgate', 5.99);

-- =============================================================================
-- Product Synonyms (brand → product mappings for fuzzy search)
-- =============================================================================

insert into public.product_synonyms (term, product_id) values
  ('coca', 'a0000000-0000-4000-a000-000000000001'),
  ('coca cola', 'a0000000-0000-4000-a000-000000000001'),
  ('refrigerante coca', 'a0000000-0000-4000-a000-000000000001'),
  ('del valle', 'a0000000-0000-4000-a000-000000000002'),
  ('suco de laranja', 'a0000000-0000-4000-a000-000000000002'),
  ('skolzinha', 'a0000000-0000-4000-a000-000000000003'),
  ('cerveja', 'a0000000-0000-4000-a000-000000000003'),
  ('leite moca', 'a0000000-0000-4000-a000-000000000004'),
  ('leite condensado', 'a0000000-0000-4000-a000-000000000004'),
  ('ype', 'a0000000-0000-4000-a000-000000000005'),
  ('detergente', 'a0000000-0000-4000-a000-000000000005'),
  ('omo', 'a0000000-0000-4000-a000-000000000006'),
  ('sabao em po', 'a0000000-0000-4000-a000-000000000006'),
  ('pinho sol', 'a0000000-0000-4000-a000-000000000007'),
  ('tio joao', 'a0000000-0000-4000-a000-000000000008'),
  ('arroz', 'a0000000-0000-4000-a000-000000000008'),
  ('camil', 'a0000000-0000-4000-a000-000000000009'),
  ('feijao', 'a0000000-0000-4000-a000-000000000009'),
  ('macarrao', 'a0000000-0000-4000-a000-000000000010'),
  ('banana', 'a0000000-0000-4000-a000-000000000012'),
  ('tomate', 'a0000000-0000-4000-a000-000000000013'),
  ('batata', 'a0000000-0000-4000-a000-000000000014'),
  ('cebola', 'a0000000-0000-4000-a000-000000000015'),
  ('pao', 'a0000000-0000-4000-a000-000000000016'),
  ('pao frances', 'a0000000-0000-4000-a000-000000000016'),
  ('dove', 'a0000000-0000-4000-a000-000000000019'),
  ('pantene', 'a0000000-0000-4000-a000-000000000020'),
  ('colgate', 'a0000000-0000-4000-a000-000000000021');

-- =============================================================================
-- Stores (4 rows) — search_priority auto-set by trigger
-- =============================================================================

insert into public.stores (id, name, chain, address, city, state, latitude, longitude, logo_initial, logo_color, b2b_plan, is_active) values
  ('b0000000-0000-4000-a000-000000000001', 'Carol Supermercado', 'Carol', 'Rua Sao Paulo, 1234 - Centro, Matao/SP', 'Matao', 'SP', -21.6033, -48.3658, 'C', '#E11D48', 'premium', true),
  ('b0000000-0000-4000-a000-000000000002', 'Mais Barato Araraquara', 'Mais Barato', 'Av. Brasil, 567 - Centro, Araraquara/SP', 'Araraquara', 'SP', -21.7946, -48.1756, 'M', '#2563EB', 'free', true),
  ('b0000000-0000-4000-a000-000000000003', 'Bom Dia Ribeirao', 'Bom Dia', 'Rua Floriano Peixoto, 890 - Centro, Ribeirao Preto/SP', 'Ribeirao Preto', 'SP', -21.1704, -47.8103, 'B', '#F59E0B', 'premium', true),
  ('b0000000-0000-4000-a000-000000000004', 'Santa Fe Sao Carlos', 'Santa Fe', 'Av. Sao Carlos, 2100 - Centro, Sao Carlos/SP', 'Sao Carlos', 'SP', -22.0174, -47.8908, 'S', '#7C3AED', 'enterprise', true);

-- =============================================================================
-- Promotions (29 rows) — dates relative to seed execution time
-- =============================================================================

insert into public.promotions (id, product_id, store_id, original_price, promo_price, start_date, end_date, status, verified, source) values
  -- Bebidas
  ('c0000000-0000-4000-a000-000000000001', 'a0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000001', 10.99, 7.49, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000002', 'a0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000002', 10.99, 8.29, now() - interval '1 day', now() + interval '3 days', 'active', true, 'crawler'),
  ('c0000000-0000-4000-a000-000000000003', 'a0000000-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-000000000003', 7.49, 4.99, now() - interval '3 days', now() + interval '4 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000004', 'a0000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000001', 3.99, 2.49, now() - interval '1 day', now() + interval '12 hours', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000005', 'a0000000-0000-4000-a000-000000000004', 'b0000000-0000-4000-a000-000000000004', 5.99, 3.99, now() - interval '2 days', now() + interval '6 days', 'active', false, 'crawler'),
  ('c0000000-0000-4000-a000-000000000006', 'a0000000-0000-4000-a000-000000000004', 'b0000000-0000-4000-a000-000000000001', 5.99, 4.49, now() - interval '1 day', now() + interval '2 days', 'active', true, 'manual'),
  -- Limpeza
  ('c0000000-0000-4000-a000-000000000007', 'a0000000-0000-4000-a000-000000000005', 'b0000000-0000-4000-a000-000000000001', 2.99, 1.49, now() - interval '3 days', now() + interval '4 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000008', 'a0000000-0000-4000-a000-000000000005', 'b0000000-0000-4000-a000-000000000002', 2.99, 1.79, now() - interval '2 days', now() + interval '19 hours', 'active', true, 'crawler'),
  ('c0000000-0000-4000-a000-000000000009', 'a0000000-0000-4000-a000-000000000006', 'b0000000-0000-4000-a000-000000000003', 15.99, 9.99, now() - interval '1 day', now() + interval '7 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000010', 'a0000000-0000-4000-a000-000000000006', 'b0000000-0000-4000-a000-000000000004', 15.99, 11.49, now() - interval '2 days', now() + interval '5 days', 'active', false, 'importador_ia'),
  ('c0000000-0000-4000-a000-000000000011', 'a0000000-0000-4000-a000-000000000007', 'b0000000-0000-4000-a000-000000000001', 6.49, 3.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  -- Alimentos
  ('c0000000-0000-4000-a000-000000000012', 'a0000000-0000-4000-a000-000000000008', 'b0000000-0000-4000-a000-000000000002', 27.99, 19.99, now() - interval '4 days', now() + interval '3 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000013', 'a0000000-0000-4000-a000-000000000008', 'b0000000-0000-4000-a000-000000000003', 27.99, 21.49, now() - interval '2 days', now() + interval '5 days', 'active', true, 'crawler'),
  ('c0000000-0000-4000-a000-000000000014', 'a0000000-0000-4000-a000-000000000009', 'b0000000-0000-4000-a000-000000000001', 8.99, 5.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000015', 'a0000000-0000-4000-a000-000000000010', 'b0000000-0000-4000-a000-000000000004', 4.49, 2.99, now() - interval '3 days', now() + interval '7 hours', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000016', 'a0000000-0000-4000-a000-000000000011', 'b0000000-0000-4000-a000-000000000002', 7.99, 5.49, now() - interval '2 days', now() + interval '6 days', 'active', false, 'importador_ia'),
  -- Hortifruti
  ('c0000000-0000-4000-a000-000000000017', 'a0000000-0000-4000-a000-000000000012', 'b0000000-0000-4000-a000-000000000001', 5.99, 3.49, now() - interval '1 day', now() + interval '2 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000018', 'a0000000-0000-4000-a000-000000000013', 'b0000000-0000-4000-a000-000000000003', 8.49, 4.99, now() - interval '2 days', now() + interval '3 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000019', 'a0000000-0000-4000-a000-000000000014', 'b0000000-0000-4000-a000-000000000002', 6.99, 3.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'crawler'),
  ('c0000000-0000-4000-a000-000000000020', 'a0000000-0000-4000-a000-000000000015', 'b0000000-0000-4000-a000-000000000004', 4.99, 2.99, now() - interval '3 days', now() + interval '5 days', 'active', true, 'manual'),
  -- Padaria
  ('c0000000-0000-4000-a000-000000000021', 'a0000000-0000-4000-a000-000000000016', 'b0000000-0000-4000-a000-000000000001', 14.99, 9.99, now() - interval '1 day', now() + interval '1 day', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000022', 'a0000000-0000-4000-a000-000000000017', 'b0000000-0000-4000-a000-000000000003', 18.99, 12.99, now() - interval '2 days', now() + interval '3 days', 'active', false, 'importador_ia'),
  ('c0000000-0000-4000-a000-000000000023', 'a0000000-0000-4000-a000-000000000018', 'b0000000-0000-4000-a000-000000000002', 3.99, 1.99, now() - interval '1 day', now() + interval '17 hours', 'active', true, 'manual'),
  -- Higiene
  ('c0000000-0000-4000-a000-000000000024', 'a0000000-0000-4000-a000-000000000019', 'b0000000-0000-4000-a000-000000000004', 4.49, 2.49, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000025', 'a0000000-0000-4000-a000-000000000020', 'b0000000-0000-4000-a000-000000000001', 19.99, 12.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'crawler'),
  ('c0000000-0000-4000-a000-000000000026', 'a0000000-0000-4000-a000-000000000020', 'b0000000-0000-4000-a000-000000000003', 19.99, 14.49, now() - interval '3 days', now() + interval '6 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000027', 'a0000000-0000-4000-a000-000000000021', 'b0000000-0000-4000-a000-000000000002', 5.99, 3.49, now() - interval '2 days', now() + interval '3 days', 'active', true, 'manual'),
  -- Extra cross-store deals
  ('c0000000-0000-4000-a000-000000000028', 'a0000000-0000-4000-a000-000000000008', 'b0000000-0000-4000-a000-000000000001', 27.99, 22.99, now() - interval '1 day', now() + interval '2 days', 'active', true, 'manual'),
  ('c0000000-0000-4000-a000-000000000029', 'a0000000-0000-4000-a000-000000000012', 'b0000000-0000-4000-a000-000000000004', 5.99, 3.99, now() - interval '2 days', now() + interval '3 days', 'active', false, 'crawler');

-- =============================================================================
-- Testimonials (3 rows)
-- =============================================================================

insert into public.testimonials (user_name, text, savings_amount, sort_order) values
  ('Maria Silva', 'Economizei muito no mes passado so seguindo as ofertas do PrecoMapa! Recomendo para todas as maes.', 120, 0),
  ('Carlos Santos', 'Antes eu ia em 3 mercados diferentes. Agora vejo tudo pelo app e ja sei onde comprar mais barato.', 85, 1),
  ('Ana Costa', 'O melhor app para quem quer economizar no supermercado. As ofertas sao sempre atualizadas!', 200, 2);

-- =============================================================================
-- Platform Stats (1 row)
-- =============================================================================

insert into public.platform_stats (id, user_count, city_name, avg_monthly_savings) values
  (1, '+3.200', 'Matao', 'R$ 47');
