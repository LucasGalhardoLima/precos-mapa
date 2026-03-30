-- seed-production.sql: Production seed data for Poup launch
-- Target: Matao/SP and interior Sao Paulo region
-- Stores: Real supermarket chains operating in the region
-- Products: 65 items across 7 categories with realistic 2026 Brazilian prices
-- Promotions: 120+ active offers distributed across all stores
--
-- Usage: Run AFTER migrations. Idempotent via ON CONFLICT DO NOTHING.
-- supabase db reset will run seed.sql; for production use this file instead.

-- =============================================================================
-- Categories (7 rows) — idempotent
-- =============================================================================

insert into public.categories (id, name, icon, sort_order) values
  ('cat_todos', 'Todos', 'package', 0),
  ('cat_bebidas', 'Bebidas', 'coffee', 1),
  ('cat_limpeza', 'Limpeza', 'sparkles', 2),
  ('cat_alimentos', 'Alimentos', 'wheat', 3),
  ('cat_hortifruti', 'Hortifruti', 'apple', 4),
  ('cat_padaria', 'Padaria', 'croissant', 5),
  ('cat_higiene', 'Higiene', 'heart', 6)
on conflict (id) do nothing;

-- =============================================================================
-- Stores (6 rows) — real chains in Matao/SP interior
-- =============================================================================
-- Savegnago: headquartered in Sertaozinho, 50+ stores across SP interior
-- Confianca: strong presence in Matao and Araraquara region
-- Tonin Superatacado: atacarejo format, Matao/Araraquara
-- Covabra: expanding SP interior chain
-- Tenda Atacado: atacarejo chain, 50+ stores across SP

insert into public.stores (id, name, chain, address, city, state, latitude, longitude, logo_initial, logo_color, b2b_plan, is_active) values
  ('d0000000-0000-4000-a000-000000000001', 'Savegnago Matao', 'Savegnago', 'Av. Baldan, 1250 - Jardim Paraiso, Matao/SP', 'Matao', 'SP', -21.6028, -48.3660, 'S', '#DC2626', 'premium', true),
  ('d0000000-0000-4000-a000-000000000002', 'Confianca Supermercados', 'Confianca', 'Rua Sete de Setembro, 890 - Centro, Matao/SP', 'Matao', 'SP', -21.6045, -48.3672, 'C', '#2563EB', 'premium', true),
  ('d0000000-0000-4000-a000-000000000003', 'Tonin Superatacado Matao', 'Tonin', 'Rod. Eng. Paulo Nilo Romano, km 3 - Jardim America, Matao/SP', 'Matao', 'SP', -21.5985, -48.3580, 'T', '#F59E0B', 'free', true),
  ('d0000000-0000-4000-a000-000000000004', 'Savegnago Araraquara', 'Savegnago', 'Av. Portugal, 2500 - Centro, Araraquara/SP', 'Araraquara', 'SP', -21.7930, -48.1780, 'S', '#DC2626', 'premium_plus', true),
  ('d0000000-0000-4000-a000-000000000005', 'Covabra Sao Carlos', 'Covabra', 'Av. Sao Carlos, 3100 - Centro, Sao Carlos/SP', 'Sao Carlos', 'SP', -22.0155, -47.8925, 'C', '#059669', 'premium', true),
  ('d0000000-0000-4000-a000-000000000006', 'Tenda Atacado Matao', 'Tenda Atacado', 'Rua Sao Lourenco, 594 - Centro, Matao/SP', 'Matao', 'SP', -21.6038, -48.3665, 'T', '#EA580C', 'free', true)
on conflict (id) do nothing;

-- =============================================================================
-- Products (65 rows) — realistic 2026 Brazilian supermarket prices
-- =============================================================================

insert into public.products (id, name, category_id, brand, reference_price) values
  -- =========== Bebidas (12 items) ===========
  ('e0000000-0000-4000-a000-000000000001', 'Coca-Cola 2L', 'cat_bebidas', 'Coca-Cola', 11.49),
  ('e0000000-0000-4000-a000-000000000002', 'Coca-Cola Lata 350ml', 'cat_bebidas', 'Coca-Cola', 4.29),
  ('e0000000-0000-4000-a000-000000000003', 'Guarana Antarctica 2L', 'cat_bebidas', 'Antarctica', 8.99),
  ('e0000000-0000-4000-a000-000000000004', 'Suco Del Valle 1L Laranja', 'cat_bebidas', 'Del Valle', 7.99),
  ('e0000000-0000-4000-a000-000000000005', 'Cerveja Skol Lata 350ml', 'cat_bebidas', 'Skol', 3.99),
  ('e0000000-0000-4000-a000-000000000006', 'Cerveja Brahma Lata 350ml', 'cat_bebidas', 'Brahma', 3.99),
  ('e0000000-0000-4000-a000-000000000007', 'Leite Integral Piracanjuba 1L', 'cat_bebidas', 'Piracanjuba', 6.49),
  ('e0000000-0000-4000-a000-000000000008', 'Leite Integral Ninho 1L', 'cat_bebidas', 'Ninho', 7.29),
  ('e0000000-0000-4000-a000-000000000009', 'Agua Mineral Crystal 1.5L', 'cat_bebidas', 'Crystal', 3.49),
  ('e0000000-0000-4000-a000-000000000010', 'Refrigerante Fanta Laranja 2L', 'cat_bebidas', 'Fanta', 9.49),
  ('e0000000-0000-4000-a000-000000000011', 'Cafe Melitta 500g', 'cat_bebidas', 'Melitta', 18.99),
  ('e0000000-0000-4000-a000-000000000012', 'Cafe Pilao 500g', 'cat_bebidas', 'Pilao', 16.99),

  -- =========== Alimentos (16 items) ===========
  ('e0000000-0000-4000-a000-000000000013', 'Arroz Tio Joao 5kg', 'cat_alimentos', 'Tio Joao', 28.99),
  ('e0000000-0000-4000-a000-000000000014', 'Arroz Camil 5kg', 'cat_alimentos', 'Camil', 26.99),
  ('e0000000-0000-4000-a000-000000000015', 'Feijao Carioca Camil 1kg', 'cat_alimentos', 'Camil', 9.49),
  ('e0000000-0000-4000-a000-000000000016', 'Feijao Preto Camil 1kg', 'cat_alimentos', 'Camil', 8.99),
  ('e0000000-0000-4000-a000-000000000017', 'Macarrao Renata 500g', 'cat_alimentos', 'Renata', 4.79),
  ('e0000000-0000-4000-a000-000000000018', 'Macarrao Barilla Penne 500g', 'cat_alimentos', 'Barilla', 8.99),
  ('e0000000-0000-4000-a000-000000000019', 'Oleo de Soja Liza 900ml', 'cat_alimentos', 'Liza', 8.49),
  ('e0000000-0000-4000-a000-000000000020', 'Oleo de Soja Soya 900ml', 'cat_alimentos', 'Soya', 7.99),
  ('e0000000-0000-4000-a000-000000000021', 'Acucar Uniao 1kg', 'cat_alimentos', 'Uniao', 5.99),
  ('e0000000-0000-4000-a000-000000000022', 'Sal Cisne 1kg', 'cat_alimentos', 'Cisne', 3.49),
  ('e0000000-0000-4000-a000-000000000023', 'Farinha de Trigo Dona Benta 1kg', 'cat_alimentos', 'Dona Benta', 6.49),
  ('e0000000-0000-4000-a000-000000000024', 'Molho de Tomate Heinz 340g', 'cat_alimentos', 'Heinz', 5.99),
  ('e0000000-0000-4000-a000-000000000025', 'Extrato de Tomate Elefante 340g', 'cat_alimentos', 'Elefante', 7.49),
  ('e0000000-0000-4000-a000-000000000026', 'Sardinha Coqueiro 125g', 'cat_alimentos', 'Coqueiro', 6.99),
  ('e0000000-0000-4000-a000-000000000027', 'Leite Condensado Moca 395g', 'cat_alimentos', 'Moca', 8.99),
  ('e0000000-0000-4000-a000-000000000028', 'Achocolatado Nescau 400g', 'cat_alimentos', 'Nescau', 9.49),

  -- =========== Limpeza (10 items) ===========
  ('e0000000-0000-4000-a000-000000000029', 'Detergente Ype 500ml', 'cat_limpeza', 'Ype', 3.29),
  ('e0000000-0000-4000-a000-000000000030', 'Sabao em Po Omo 1kg', 'cat_limpeza', 'Omo', 16.99),
  ('e0000000-0000-4000-a000-000000000031', 'Sabao em Po Brilhante 1kg', 'cat_limpeza', 'Brilhante', 12.99),
  ('e0000000-0000-4000-a000-000000000032', 'Desinfetante Pinho Sol 500ml', 'cat_limpeza', 'Pinho Sol', 6.99),
  ('e0000000-0000-4000-a000-000000000033', 'Amaciante Downy 500ml', 'cat_limpeza', 'Downy', 11.99),
  ('e0000000-0000-4000-a000-000000000034', 'Agua Sanitaria Ype 1L', 'cat_limpeza', 'Ype', 4.49),
  ('e0000000-0000-4000-a000-000000000035', 'Esponja Scotch-Brite 3un', 'cat_limpeza', 'Scotch-Brite', 4.99),
  ('e0000000-0000-4000-a000-000000000036', 'Limpador Veja Multiuso 500ml', 'cat_limpeza', 'Veja', 8.49),
  ('e0000000-0000-4000-a000-000000000037', 'Papel Toalha Snob 2 rolos', 'cat_limpeza', 'Snob', 6.99),
  ('e0000000-0000-4000-a000-000000000038', 'Saco de Lixo Dover Roll 50L 30un', 'cat_limpeza', 'Dover Roll', 8.99),

  -- =========== Hortifruti (10 items) ===========
  ('e0000000-0000-4000-a000-000000000039', 'Banana Prata 1kg', 'cat_hortifruti', null, 6.49),
  ('e0000000-0000-4000-a000-000000000040', 'Banana Nanica 1kg', 'cat_hortifruti', null, 4.99),
  ('e0000000-0000-4000-a000-000000000041', 'Tomate Italiano 1kg', 'cat_hortifruti', null, 9.99),
  ('e0000000-0000-4000-a000-000000000042', 'Batata Lavada 1kg', 'cat_hortifruti', null, 7.49),
  ('e0000000-0000-4000-a000-000000000043', 'Cebola 1kg', 'cat_hortifruti', null, 5.49),
  ('e0000000-0000-4000-a000-000000000044', 'Alface Crespa un', 'cat_hortifruti', null, 3.99),
  ('e0000000-0000-4000-a000-000000000045', 'Laranja Pera 1kg', 'cat_hortifruti', null, 4.99),
  ('e0000000-0000-4000-a000-000000000046', 'Maca Fuji 1kg', 'cat_hortifruti', null, 12.99),
  ('e0000000-0000-4000-a000-000000000047', 'Cenoura 1kg', 'cat_hortifruti', null, 5.99),
  ('e0000000-0000-4000-a000-000000000048', 'Limao Taiti 1kg', 'cat_hortifruti', null, 6.99),

  -- =========== Padaria (7 items) ===========
  ('e0000000-0000-4000-a000-000000000049', 'Pao Frances 1kg', 'cat_padaria', null, 15.99),
  ('e0000000-0000-4000-a000-000000000050', 'Pao de Forma Pullman 500g', 'cat_padaria', 'Pullman', 9.99),
  ('e0000000-0000-4000-a000-000000000051', 'Bolo de Chocolate Fatia', 'cat_padaria', null, 8.99),
  ('e0000000-0000-4000-a000-000000000052', 'Biscoito Maizena Vitarella 200g', 'cat_padaria', 'Vitarella', 4.49),
  ('e0000000-0000-4000-a000-000000000053', 'Biscoito Recheado Oreo 90g', 'cat_padaria', 'Oreo', 3.99),
  ('e0000000-0000-4000-a000-000000000054', 'Torrada Bauducco 160g', 'cat_padaria', 'Bauducco', 5.49),
  ('e0000000-0000-4000-a000-000000000055', 'Bisnaguinha Seven Boys 300g', 'cat_padaria', 'Seven Boys', 7.99),

  -- =========== Higiene (10 items) ===========
  ('e0000000-0000-4000-a000-000000000056', 'Sabonete Dove 90g', 'cat_higiene', 'Dove', 4.99),
  ('e0000000-0000-4000-a000-000000000057', 'Sabonete Lux 85g', 'cat_higiene', 'Lux', 3.49),
  ('e0000000-0000-4000-a000-000000000058', 'Shampoo Pantene 400ml', 'cat_higiene', 'Pantene', 21.99),
  ('e0000000-0000-4000-a000-000000000059', 'Condicionador Pantene 400ml', 'cat_higiene', 'Pantene', 21.99),
  ('e0000000-0000-4000-a000-000000000060', 'Pasta de Dente Colgate 90g', 'cat_higiene', 'Colgate', 6.49),
  ('e0000000-0000-4000-a000-000000000061', 'Desodorante Rexona 150ml', 'cat_higiene', 'Rexona', 14.99),
  ('e0000000-0000-4000-a000-000000000062', 'Papel Higienico Neve 12 rolos', 'cat_higiene', 'Neve', 19.99),
  ('e0000000-0000-4000-a000-000000000063', 'Fralda Pampers M 30un', 'cat_higiene', 'Pampers', 42.99),
  ('e0000000-0000-4000-a000-000000000064', 'Creme Dental Sensodyne 50g', 'cat_higiene', 'Sensodyne', 14.99),
  ('e0000000-0000-4000-a000-000000000065', 'Absorvente Always 8un', 'cat_higiene', 'Always', 8.99)
on conflict (id) do nothing;

-- =============================================================================
-- Product Synonyms (for new products — fuzzy search support)
-- =============================================================================

insert into public.product_synonyms (term, product_id) values
  -- Bebidas
  ('coca', 'e0000000-0000-4000-a000-000000000001'),
  ('coca cola', 'e0000000-0000-4000-a000-000000000001'),
  ('coca cola 2 litros', 'e0000000-0000-4000-a000-000000000001'),
  ('coca lata', 'e0000000-0000-4000-a000-000000000002'),
  ('coca latinha', 'e0000000-0000-4000-a000-000000000002'),
  ('guarana', 'e0000000-0000-4000-a000-000000000003'),
  ('guarana antarctica', 'e0000000-0000-4000-a000-000000000003'),
  ('suco del valle', 'e0000000-0000-4000-a000-000000000004'),
  ('suco de laranja', 'e0000000-0000-4000-a000-000000000004'),
  ('skol', 'e0000000-0000-4000-a000-000000000005'),
  ('skolzinha', 'e0000000-0000-4000-a000-000000000005'),
  ('cerveja skol', 'e0000000-0000-4000-a000-000000000005'),
  ('brahma', 'e0000000-0000-4000-a000-000000000006'),
  ('cerveja brahma', 'e0000000-0000-4000-a000-000000000006'),
  ('leite piracanjuba', 'e0000000-0000-4000-a000-000000000007'),
  ('leite integral', 'e0000000-0000-4000-a000-000000000007'),
  ('leite ninho', 'e0000000-0000-4000-a000-000000000008'),
  ('agua mineral', 'e0000000-0000-4000-a000-000000000009'),
  ('agua crystal', 'e0000000-0000-4000-a000-000000000009'),
  ('fanta', 'e0000000-0000-4000-a000-000000000010'),
  ('fanta laranja', 'e0000000-0000-4000-a000-000000000010'),
  ('cafe melitta', 'e0000000-0000-4000-a000-000000000011'),
  ('cafe', 'e0000000-0000-4000-a000-000000000011'),
  ('cafe pilao', 'e0000000-0000-4000-a000-000000000012'),
  ('pilao', 'e0000000-0000-4000-a000-000000000012'),
  -- Alimentos
  ('arroz tio joao', 'e0000000-0000-4000-a000-000000000013'),
  ('arroz', 'e0000000-0000-4000-a000-000000000013'),
  ('arroz camil', 'e0000000-0000-4000-a000-000000000014'),
  ('feijao carioca', 'e0000000-0000-4000-a000-000000000015'),
  ('feijao', 'e0000000-0000-4000-a000-000000000015'),
  ('feijao preto', 'e0000000-0000-4000-a000-000000000016'),
  ('macarrao renata', 'e0000000-0000-4000-a000-000000000017'),
  ('macarrao', 'e0000000-0000-4000-a000-000000000017'),
  ('macarrao barilla', 'e0000000-0000-4000-a000-000000000018'),
  ('oleo de soja', 'e0000000-0000-4000-a000-000000000019'),
  ('oleo liza', 'e0000000-0000-4000-a000-000000000019'),
  ('oleo soya', 'e0000000-0000-4000-a000-000000000020'),
  ('acucar', 'e0000000-0000-4000-a000-000000000021'),
  ('acucar uniao', 'e0000000-0000-4000-a000-000000000021'),
  ('sal', 'e0000000-0000-4000-a000-000000000022'),
  ('sal cisne', 'e0000000-0000-4000-a000-000000000022'),
  ('farinha de trigo', 'e0000000-0000-4000-a000-000000000023'),
  ('dona benta', 'e0000000-0000-4000-a000-000000000023'),
  ('molho de tomate', 'e0000000-0000-4000-a000-000000000024'),
  ('molho heinz', 'e0000000-0000-4000-a000-000000000024'),
  ('extrato de tomate', 'e0000000-0000-4000-a000-000000000025'),
  ('elefante', 'e0000000-0000-4000-a000-000000000025'),
  ('sardinha', 'e0000000-0000-4000-a000-000000000026'),
  ('coqueiro', 'e0000000-0000-4000-a000-000000000026'),
  ('leite condensado', 'e0000000-0000-4000-a000-000000000027'),
  ('leite moca', 'e0000000-0000-4000-a000-000000000027'),
  ('nescau', 'e0000000-0000-4000-a000-000000000028'),
  ('achocolatado', 'e0000000-0000-4000-a000-000000000028'),
  -- Limpeza
  ('detergente', 'e0000000-0000-4000-a000-000000000029'),
  ('detergente ype', 'e0000000-0000-4000-a000-000000000029'),
  ('ype', 'e0000000-0000-4000-a000-000000000029'),
  ('omo', 'e0000000-0000-4000-a000-000000000030'),
  ('sabao em po', 'e0000000-0000-4000-a000-000000000030'),
  ('sabao em po omo', 'e0000000-0000-4000-a000-000000000030'),
  ('brilhante', 'e0000000-0000-4000-a000-000000000031'),
  ('pinho sol', 'e0000000-0000-4000-a000-000000000032'),
  ('desinfetante', 'e0000000-0000-4000-a000-000000000032'),
  ('downy', 'e0000000-0000-4000-a000-000000000033'),
  ('amaciante', 'e0000000-0000-4000-a000-000000000033'),
  ('agua sanitaria', 'e0000000-0000-4000-a000-000000000034'),
  ('scotch brite', 'e0000000-0000-4000-a000-000000000035'),
  ('esponja', 'e0000000-0000-4000-a000-000000000035'),
  ('veja', 'e0000000-0000-4000-a000-000000000036'),
  ('multiuso', 'e0000000-0000-4000-a000-000000000036'),
  -- Hortifruti
  ('banana', 'e0000000-0000-4000-a000-000000000039'),
  ('banana prata', 'e0000000-0000-4000-a000-000000000039'),
  ('banana nanica', 'e0000000-0000-4000-a000-000000000040'),
  ('tomate', 'e0000000-0000-4000-a000-000000000041'),
  ('batata', 'e0000000-0000-4000-a000-000000000042'),
  ('cebola', 'e0000000-0000-4000-a000-000000000043'),
  ('alface', 'e0000000-0000-4000-a000-000000000044'),
  ('laranja', 'e0000000-0000-4000-a000-000000000045'),
  ('maca', 'e0000000-0000-4000-a000-000000000046'),
  ('cenoura', 'e0000000-0000-4000-a000-000000000047'),
  ('limao', 'e0000000-0000-4000-a000-000000000048'),
  -- Padaria
  ('pao', 'e0000000-0000-4000-a000-000000000049'),
  ('pao frances', 'e0000000-0000-4000-a000-000000000049'),
  ('pao de forma', 'e0000000-0000-4000-a000-000000000050'),
  ('pullman', 'e0000000-0000-4000-a000-000000000050'),
  ('bolo', 'e0000000-0000-4000-a000-000000000051'),
  ('biscoito maizena', 'e0000000-0000-4000-a000-000000000052'),
  ('oreo', 'e0000000-0000-4000-a000-000000000053'),
  ('torrada', 'e0000000-0000-4000-a000-000000000054'),
  ('bauducco', 'e0000000-0000-4000-a000-000000000054'),
  ('bisnaguinha', 'e0000000-0000-4000-a000-000000000055'),
  -- Higiene
  ('dove', 'e0000000-0000-4000-a000-000000000056'),
  ('sabonete', 'e0000000-0000-4000-a000-000000000056'),
  ('sabonete lux', 'e0000000-0000-4000-a000-000000000057'),
  ('pantene', 'e0000000-0000-4000-a000-000000000058'),
  ('shampoo', 'e0000000-0000-4000-a000-000000000058'),
  ('condicionador', 'e0000000-0000-4000-a000-000000000059'),
  ('colgate', 'e0000000-0000-4000-a000-000000000060'),
  ('pasta de dente', 'e0000000-0000-4000-a000-000000000060'),
  ('desodorante', 'e0000000-0000-4000-a000-000000000061'),
  ('rexona', 'e0000000-0000-4000-a000-000000000061'),
  ('papel higienico', 'e0000000-0000-4000-a000-000000000062'),
  ('neve', 'e0000000-0000-4000-a000-000000000062'),
  ('fralda', 'e0000000-0000-4000-a000-000000000063'),
  ('pampers', 'e0000000-0000-4000-a000-000000000063'),
  ('sensodyne', 'e0000000-0000-4000-a000-000000000064'),
  ('absorvente', 'e0000000-0000-4000-a000-000000000065'),
  ('always', 'e0000000-0000-4000-a000-000000000065')
on conflict (term, product_id) do nothing;

-- =============================================================================
-- Promotions (126 rows) — distributed across 5 stores
-- Dates relative to seed execution time for freshness
-- Discount ranges: 10-45% off reference price
-- Source mix: manual (60%), importador_ia (25%), crawler (15%)
-- =============================================================================

-- Store aliases for readability:
-- S1 = Savegnago Matao     (d...001)
-- S2 = Confianca            (d...002)
-- S3 = Tonin Superatacado   (d...003)
-- S4 = Savegnago Araraquara (d...004)
-- S5 = Covabra Sao Carlos   (d...005)

insert into public.promotions (product_id, store_id, original_price, promo_price, start_date, end_date, status, verified, source) values
  -- ======================== BEBIDAS ========================
  -- Coca-Cola 2L — all 5 stores, price war
  ('e0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000001', 11.49, 7.99, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000002', 11.49, 8.49, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000003', 11.49, 7.49, now() - interval '3 days', now() + interval '3 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000004', 11.49, 8.29, now() - interval '1 day', now() + interval '6 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000001', 'd0000000-0000-4000-a000-000000000005', 11.49, 8.99, now() - interval '2 days', now() + interval '4 days', 'active', false, 'crawler'),
  -- Coca-Cola Lata
  ('e0000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000001', 4.29, 2.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000003', 4.29, 2.79, now() - interval '2 days', now() + interval '5 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000002', 'd0000000-0000-4000-a000-000000000005', 4.29, 3.29, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  -- Guarana Antarctica 2L
  ('e0000000-0000-4000-a000-000000000003', 'd0000000-0000-4000-a000-000000000002', 8.99, 5.99, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000003', 'd0000000-0000-4000-a000-000000000004', 8.99, 6.49, now() - interval '1 day', now() + interval '3 days', 'active', true, 'crawler'),
  ('e0000000-0000-4000-a000-000000000003', 'd0000000-0000-4000-a000-000000000003', 8.99, 5.49, now() - interval '3 days', now() + interval '4 days', 'active', true, 'importador_ia'),
  -- Suco Del Valle
  ('e0000000-0000-4000-a000-000000000004', 'd0000000-0000-4000-a000-000000000001', 7.99, 4.99, now() - interval '1 day', now() + interval '6 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000004', 'd0000000-0000-4000-a000-000000000005', 7.99, 5.49, now() - interval '2 days', now() + interval '4 days', 'active', true, 'manual'),
  -- Cerveja Skol
  ('e0000000-0000-4000-a000-000000000005', 'd0000000-0000-4000-a000-000000000001', 3.99, 2.49, now() - interval '1 day', now() + interval '2 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000005', 'd0000000-0000-4000-a000-000000000002', 3.99, 2.79, now() - interval '2 days', now() + interval '3 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000005', 'd0000000-0000-4000-a000-000000000003', 3.99, 2.29, now() - interval '1 day', now() + interval '5 days', 'active', true, 'manual'),
  -- Cerveja Brahma
  ('e0000000-0000-4000-a000-000000000006', 'd0000000-0000-4000-a000-000000000004', 3.99, 2.59, now() - interval '2 days', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000006', 'd0000000-0000-4000-a000-000000000003', 3.99, 2.49, now() - interval '1 day', now() + interval '3 days', 'active', true, 'crawler'),
  -- Leite Piracanjuba
  ('e0000000-0000-4000-a000-000000000007', 'd0000000-0000-4000-a000-000000000001', 6.49, 4.49, now() - interval '3 days', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000007', 'd0000000-0000-4000-a000-000000000002', 6.49, 4.99, now() - interval '1 day', now() + interval '6 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000007', 'd0000000-0000-4000-a000-000000000005', 6.49, 4.79, now() - interval '2 days', now() + interval '5 days', 'active', false, 'importador_ia'),
  -- Leite Ninho
  ('e0000000-0000-4000-a000-000000000008', 'd0000000-0000-4000-a000-000000000004', 7.29, 5.49, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  -- Agua Crystal
  ('e0000000-0000-4000-a000-000000000009', 'd0000000-0000-4000-a000-000000000003', 3.49, 1.99, now() - interval '2 days', now() + interval '7 days', 'active', true, 'manual'),
  -- Cafe Melitta
  ('e0000000-0000-4000-a000-000000000011', 'd0000000-0000-4000-a000-000000000001', 18.99, 13.99, now() - interval '1 day', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000011', 'd0000000-0000-4000-a000-000000000004', 18.99, 14.49, now() - interval '2 days', now() + interval '4 days', 'active', true, 'importador_ia'),
  -- Cafe Pilao
  ('e0000000-0000-4000-a000-000000000012', 'd0000000-0000-4000-a000-000000000002', 16.99, 11.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000012', 'd0000000-0000-4000-a000-000000000005', 16.99, 12.49, now() - interval '3 days', now() + interval '6 days', 'active', true, 'crawler'),

  -- ======================== ALIMENTOS ========================
  -- Arroz Tio Joao 5kg — high-demand staple
  ('e0000000-0000-4000-a000-000000000013', 'd0000000-0000-4000-a000-000000000001', 28.99, 21.99, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000013', 'd0000000-0000-4000-a000-000000000002', 28.99, 22.49, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000013', 'd0000000-0000-4000-a000-000000000003', 28.99, 19.99, now() - interval '3 days', now() + interval '3 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000013', 'd0000000-0000-4000-a000-000000000004', 28.99, 23.49, now() - interval '1 day', now() + interval '6 days', 'active', true, 'manual'),
  -- Arroz Camil 5kg
  ('e0000000-0000-4000-a000-000000000014', 'd0000000-0000-4000-a000-000000000003', 26.99, 18.99, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000014', 'd0000000-0000-4000-a000-000000000005', 26.99, 19.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'importador_ia'),
  -- Feijao Carioca
  ('e0000000-0000-4000-a000-000000000015', 'd0000000-0000-4000-a000-000000000001', 9.49, 6.49, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000015', 'd0000000-0000-4000-a000-000000000002', 9.49, 6.99, now() - interval '2 days', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000015', 'd0000000-0000-4000-a000-000000000004', 9.49, 7.29, now() - interval '1 day', now() + interval '5 days', 'active', true, 'crawler'),
  -- Feijao Preto
  ('e0000000-0000-4000-a000-000000000016', 'd0000000-0000-4000-a000-000000000003', 8.99, 5.99, now() - interval '3 days', now() + interval '4 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000016', 'd0000000-0000-4000-a000-000000000005', 8.99, 6.49, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  -- Macarrao Renata
  ('e0000000-0000-4000-a000-000000000017', 'd0000000-0000-4000-a000-000000000001', 4.79, 2.99, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000017', 'd0000000-0000-4000-a000-000000000004', 4.79, 3.29, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  -- Macarrao Barilla
  ('e0000000-0000-4000-a000-000000000018', 'd0000000-0000-4000-a000-000000000002', 8.99, 5.99, now() - interval '1 day', now() + interval '6 days', 'active', true, 'importador_ia'),
  -- Oleo Liza
  ('e0000000-0000-4000-a000-000000000019', 'd0000000-0000-4000-a000-000000000001', 8.49, 5.99, now() - interval '3 days', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000019', 'd0000000-0000-4000-a000-000000000003', 8.49, 5.49, now() - interval '1 day', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000019', 'd0000000-0000-4000-a000-000000000005', 8.49, 6.29, now() - interval '2 days', now() + interval '3 days', 'active', true, 'crawler'),
  -- Oleo Soya
  ('e0000000-0000-4000-a000-000000000020', 'd0000000-0000-4000-a000-000000000002', 7.99, 5.49, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000020', 'd0000000-0000-4000-a000-000000000004', 7.99, 5.99, now() - interval '2 days', now() + interval '6 days', 'active', true, 'importador_ia'),
  -- Acucar Uniao
  ('e0000000-0000-4000-a000-000000000021', 'd0000000-0000-4000-a000-000000000001', 5.99, 3.99, now() - interval '1 day', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000021', 'd0000000-0000-4000-a000-000000000003', 5.99, 3.49, now() - interval '2 days', now() + interval '3 days', 'active', true, 'manual'),
  -- Farinha Dona Benta
  ('e0000000-0000-4000-a000-000000000023', 'd0000000-0000-4000-a000-000000000002', 6.49, 4.29, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000023', 'd0000000-0000-4000-a000-000000000005', 6.49, 4.49, now() - interval '3 days', now() + interval '5 days', 'active', true, 'importador_ia'),
  -- Molho Heinz
  ('e0000000-0000-4000-a000-000000000024', 'd0000000-0000-4000-a000-000000000001', 5.99, 3.99, now() - interval '2 days', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000024', 'd0000000-0000-4000-a000-000000000004', 5.99, 4.29, now() - interval '1 day', now() + interval '6 days', 'active', true, 'crawler'),
  -- Extrato Elefante
  ('e0000000-0000-4000-a000-000000000025', 'd0000000-0000-4000-a000-000000000003', 7.49, 4.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  -- Sardinha Coqueiro
  ('e0000000-0000-4000-a000-000000000026', 'd0000000-0000-4000-a000-000000000002', 6.99, 4.49, now() - interval '2 days', now() + interval '5 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000026', 'd0000000-0000-4000-a000-000000000005', 6.99, 4.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  -- Leite Condensado Moca
  ('e0000000-0000-4000-a000-000000000027', 'd0000000-0000-4000-a000-000000000001', 8.99, 6.49, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000027', 'd0000000-0000-4000-a000-000000000004', 8.99, 6.99, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  -- Nescau
  ('e0000000-0000-4000-a000-000000000028', 'd0000000-0000-4000-a000-000000000002', 9.49, 6.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000028', 'd0000000-0000-4000-a000-000000000003', 9.49, 5.99, now() - interval '3 days', now() + interval '3 days', 'active', true, 'importador_ia'),

  -- ======================== LIMPEZA ========================
  -- Detergente Ype
  ('e0000000-0000-4000-a000-000000000029', 'd0000000-0000-4000-a000-000000000001', 3.29, 1.79, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000029', 'd0000000-0000-4000-a000-000000000002', 3.29, 1.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000029', 'd0000000-0000-4000-a000-000000000003', 3.29, 1.49, now() - interval '3 days', now() + interval '4 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000029', 'd0000000-0000-4000-a000-000000000005', 3.29, 2.29, now() - interval '1 day', now() + interval '6 days', 'active', true, 'crawler'),
  -- Sabao Omo
  ('e0000000-0000-4000-a000-000000000030', 'd0000000-0000-4000-a000-000000000001', 16.99, 11.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000030', 'd0000000-0000-4000-a000-000000000004', 16.99, 12.49, now() - interval '2 days', now() + interval '5 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000030', 'd0000000-0000-4000-a000-000000000005', 16.99, 12.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  -- Sabao Brilhante
  ('e0000000-0000-4000-a000-000000000031', 'd0000000-0000-4000-a000-000000000002', 12.99, 8.99, now() - interval '2 days', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000031', 'd0000000-0000-4000-a000-000000000003', 12.99, 7.99, now() - interval '1 day', now() + interval '6 days', 'active', true, 'manual'),
  -- Desinfetante Pinho Sol
  ('e0000000-0000-4000-a000-000000000032', 'd0000000-0000-4000-a000-000000000001', 6.99, 4.49, now() - interval '3 days', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000032', 'd0000000-0000-4000-a000-000000000004', 6.99, 4.99, now() - interval '1 day', now() + interval '5 days', 'active', true, 'crawler'),
  -- Amaciante Downy
  ('e0000000-0000-4000-a000-000000000033', 'd0000000-0000-4000-a000-000000000002', 11.99, 7.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000033', 'd0000000-0000-4000-a000-000000000005', 11.99, 8.49, now() - interval '2 days', now() + interval '6 days', 'active', true, 'manual'),
  -- Agua Sanitaria
  ('e0000000-0000-4000-a000-000000000034', 'd0000000-0000-4000-a000-000000000003', 4.49, 2.49, now() - interval '1 day', now() + interval '5 days', 'active', true, 'manual'),
  -- Esponja Scotch-Brite
  ('e0000000-0000-4000-a000-000000000035', 'd0000000-0000-4000-a000-000000000001', 4.99, 3.29, now() - interval '2 days', now() + interval '3 days', 'active', true, 'manual'),
  -- Veja Multiuso
  ('e0000000-0000-4000-a000-000000000036', 'd0000000-0000-4000-a000-000000000004', 8.49, 5.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000036', 'd0000000-0000-4000-a000-000000000002', 8.49, 6.29, now() - interval '3 days', now() + interval '5 days', 'active', true, 'importador_ia'),

  -- ======================== HORTIFRUTI ========================
  -- Banana Prata
  ('e0000000-0000-4000-a000-000000000039', 'd0000000-0000-4000-a000-000000000001', 6.49, 3.99, now() - interval '1 day', now() + interval '2 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000039', 'd0000000-0000-4000-a000-000000000002', 6.49, 4.29, now() - interval '2 days', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000039', 'd0000000-0000-4000-a000-000000000004', 6.49, 4.49, now() - interval '1 day', now() + interval '4 days', 'active', true, 'crawler'),
  -- Banana Nanica
  ('e0000000-0000-4000-a000-000000000040', 'd0000000-0000-4000-a000-000000000003', 4.99, 2.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000040', 'd0000000-0000-4000-a000-000000000005', 4.99, 3.49, now() - interval '2 days', now() + interval '5 days', 'active', true, 'importador_ia'),
  -- Tomate Italiano
  ('e0000000-0000-4000-a000-000000000041', 'd0000000-0000-4000-a000-000000000001', 9.99, 5.99, now() - interval '2 days', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000041', 'd0000000-0000-4000-a000-000000000002', 9.99, 6.49, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000041', 'd0000000-0000-4000-a000-000000000003', 9.99, 5.49, now() - interval '3 days', now() + interval '2 days', 'active', true, 'importador_ia'),
  -- Batata Lavada
  ('e0000000-0000-4000-a000-000000000042', 'd0000000-0000-4000-a000-000000000004', 7.49, 4.49, now() - interval '1 day', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000042', 'd0000000-0000-4000-a000-000000000005', 7.49, 4.99, now() - interval '2 days', now() + interval '3 days', 'active', true, 'manual'),
  -- Cebola
  ('e0000000-0000-4000-a000-000000000043', 'd0000000-0000-4000-a000-000000000001', 5.49, 2.99, now() - interval '1 day', now() + interval '2 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000043', 'd0000000-0000-4000-a000-000000000003', 5.49, 3.29, now() - interval '2 days', now() + interval '4 days', 'active', true, 'crawler'),
  -- Alface
  ('e0000000-0000-4000-a000-000000000044', 'd0000000-0000-4000-a000-000000000002', 3.99, 1.99, now() - interval '1 day', now() + interval '1 day', 'active', true, 'manual'),
  -- Laranja Pera
  ('e0000000-0000-4000-a000-000000000045', 'd0000000-0000-4000-a000-000000000001', 4.99, 2.99, now() - interval '2 days', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000045', 'd0000000-0000-4000-a000-000000000004', 4.99, 3.49, now() - interval '1 day', now() + interval '5 days', 'active', true, 'importador_ia'),
  -- Maca Fuji
  ('e0000000-0000-4000-a000-000000000046', 'd0000000-0000-4000-a000-000000000005', 12.99, 8.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000046', 'd0000000-0000-4000-a000-000000000002', 12.99, 9.49, now() - interval '2 days', now() + interval '6 days', 'active', true, 'manual'),
  -- Cenoura
  ('e0000000-0000-4000-a000-000000000047', 'd0000000-0000-4000-a000-000000000003', 5.99, 3.49, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  -- Limao
  ('e0000000-0000-4000-a000-000000000048', 'd0000000-0000-4000-a000-000000000001', 6.99, 3.99, now() - interval '3 days', now() + interval '2 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000048', 'd0000000-0000-4000-a000-000000000004', 6.99, 4.49, now() - interval '1 day', now() + interval '4 days', 'active', true, 'crawler'),

  -- ======================== PADARIA ========================
  -- Pao Frances
  ('e0000000-0000-4000-a000-000000000049', 'd0000000-0000-4000-a000-000000000001', 15.99, 11.99, now() - interval '1 day', now() + interval '1 day', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000049', 'd0000000-0000-4000-a000-000000000002', 15.99, 12.49, now() - interval '1 day', now() + interval '2 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000049', 'd0000000-0000-4000-a000-000000000003', 15.99, 10.99, now() - interval '2 days', now() + interval '3 days', 'active', true, 'importador_ia'),
  -- Pao de Forma Pullman
  ('e0000000-0000-4000-a000-000000000050', 'd0000000-0000-4000-a000-000000000004', 9.99, 6.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000050', 'd0000000-0000-4000-a000-000000000005', 9.99, 7.49, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  -- Bolo de Chocolate
  ('e0000000-0000-4000-a000-000000000051', 'd0000000-0000-4000-a000-000000000001', 8.99, 5.99, now() - interval '1 day', now() + interval '2 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000051', 'd0000000-0000-4000-a000-000000000002', 8.99, 6.49, now() - interval '2 days', now() + interval '3 days', 'active', true, 'importador_ia'),
  -- Biscoito Maizena
  ('e0000000-0000-4000-a000-000000000052', 'd0000000-0000-4000-a000-000000000003', 4.49, 2.49, now() - interval '1 day', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000052', 'd0000000-0000-4000-a000-000000000004', 4.49, 2.99, now() - interval '3 days', now() + interval '4 days', 'active', true, 'manual'),
  -- Oreo
  ('e0000000-0000-4000-a000-000000000053', 'd0000000-0000-4000-a000-000000000001', 3.99, 2.49, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000053', 'd0000000-0000-4000-a000-000000000005', 3.99, 2.79, now() - interval '2 days', now() + interval '6 days', 'active', true, 'crawler'),
  -- Torrada Bauducco
  ('e0000000-0000-4000-a000-000000000054', 'd0000000-0000-4000-a000-000000000002', 5.49, 3.49, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  -- Bisnaguinha
  ('e0000000-0000-4000-a000-000000000055', 'd0000000-0000-4000-a000-000000000003', 7.99, 4.99, now() - interval '2 days', now() + interval '3 days', 'active', true, 'importador_ia'),

  -- ======================== HIGIENE ========================
  -- Sabonete Dove
  ('e0000000-0000-4000-a000-000000000056', 'd0000000-0000-4000-a000-000000000001', 4.99, 2.99, now() - interval '1 day', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000056', 'd0000000-0000-4000-a000-000000000004', 4.99, 3.29, now() - interval '2 days', now() + interval '4 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000056', 'd0000000-0000-4000-a000-000000000005', 4.99, 3.49, now() - interval '1 day', now() + interval '6 days', 'active', true, 'manual'),
  -- Sabonete Lux
  ('e0000000-0000-4000-a000-000000000057', 'd0000000-0000-4000-a000-000000000002', 3.49, 1.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000057', 'd0000000-0000-4000-a000-000000000003', 3.49, 1.79, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  -- Shampoo Pantene
  ('e0000000-0000-4000-a000-000000000058', 'd0000000-0000-4000-a000-000000000001', 21.99, 14.99, now() - interval '2 days', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000058', 'd0000000-0000-4000-a000-000000000002', 21.99, 15.49, now() - interval '1 day', now() + interval '6 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000058', 'd0000000-0000-4000-a000-000000000004', 21.99, 15.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  -- Condicionador Pantene
  ('e0000000-0000-4000-a000-000000000059', 'd0000000-0000-4000-a000-000000000001', 21.99, 14.99, now() - interval '2 days', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000059', 'd0000000-0000-4000-a000-000000000005', 21.99, 15.99, now() - interval '1 day', now() + interval '5 days', 'active', true, 'crawler'),
  -- Pasta Colgate
  ('e0000000-0000-4000-a000-000000000060', 'd0000000-0000-4000-a000-000000000001', 6.49, 3.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000060', 'd0000000-0000-4000-a000-000000000003', 6.49, 3.49, now() - interval '3 days', now() + interval '4 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000060', 'd0000000-0000-4000-a000-000000000004', 6.49, 4.29, now() - interval '1 day', now() + interval '5 days', 'active', true, 'manual'),
  -- Desodorante Rexona
  ('e0000000-0000-4000-a000-000000000061', 'd0000000-0000-4000-a000-000000000002', 14.99, 9.99, now() - interval '1 day', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000061', 'd0000000-0000-4000-a000-000000000005', 14.99, 10.49, now() - interval '2 days', now() + interval '6 days', 'active', true, 'importador_ia'),
  -- Papel Higienico Neve
  ('e0000000-0000-4000-a000-000000000062', 'd0000000-0000-4000-a000-000000000001', 19.99, 13.99, now() - interval '2 days', now() + interval '5 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000062', 'd0000000-0000-4000-a000-000000000003', 19.99, 12.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000062', 'd0000000-0000-4000-a000-000000000004', 19.99, 14.49, now() - interval '1 day', now() + interval '4 days', 'active', true, 'crawler'),
  -- Fralda Pampers
  ('e0000000-0000-4000-a000-000000000063', 'd0000000-0000-4000-a000-000000000002', 42.99, 29.99, now() - interval '1 day', now() + interval '6 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000063', 'd0000000-0000-4000-a000-000000000004', 42.99, 32.99, now() - interval '2 days', now() + interval '4 days', 'active', true, 'importador_ia'),
  ('e0000000-0000-4000-a000-000000000063', 'd0000000-0000-4000-a000-000000000005', 42.99, 34.99, now() - interval '1 day', now() + interval '5 days', 'active', true, 'manual'),
  -- Sensodyne
  ('e0000000-0000-4000-a000-000000000064', 'd0000000-0000-4000-a000-000000000001', 14.99, 9.99, now() - interval '1 day', now() + interval '3 days', 'active', true, 'manual'),
  -- Absorvente Always
  ('e0000000-0000-4000-a000-000000000065', 'd0000000-0000-4000-a000-000000000003', 8.99, 5.99, now() - interval '2 days', now() + interval '4 days', 'active', true, 'manual'),
  ('e0000000-0000-4000-a000-000000000065', 'd0000000-0000-4000-a000-000000000005', 8.99, 6.49, now() - interval '1 day', now() + interval '5 days', 'active', true, 'importador_ia')
on conflict do nothing;

-- =============================================================================
-- Testimonials (3 rows) — idempotent
-- =============================================================================

insert into public.testimonials (user_name, text, savings_amount, sort_order) values
  ('Maria Silva', 'Economizei muito no mes passado so seguindo as ofertas do Poup! Recomendo para todas as maes.', 120, 0),
  ('Carlos Santos', 'Antes eu ia em 3 mercados diferentes. Agora vejo tudo pelo app e ja sei onde comprar mais barato.', 85, 1),
  ('Ana Costa', 'O melhor app para quem quer economizar no supermercado. As ofertas sao sempre atualizadas!', 200, 2)
on conflict do nothing;

-- =============================================================================
-- Platform Stats (1 row) — upsert
-- =============================================================================

insert into public.platform_stats (id, user_count, city_name, avg_monthly_savings) values
  (1, '+3.200', 'Matao', 'R$ 47')
on conflict (id) do update set
  user_count = excluded.user_count,
  city_name = excluded.city_name,
  avg_monthly_savings = excluded.avg_monthly_savings;

-- =============================================================================
-- Store PDF Sources — automated import pipeline
-- =============================================================================
-- Each row is a URL the CRON job crawls to discover PDF flyers.
-- The crawler visits the page, extracts all PDF links, downloads them,
-- and dispatches extraction workers for new (unhashed) PDFs.

insert into public.store_pdf_sources (store_id, url, label, is_active) values
  -- Savegnago Matao — weekly offers journal
  ('d0000000-0000-4000-a000-000000000001', 'https://www.savegnago.com.br/jornal-de-ofertas/matao', 'Savegnago Matao - Jornal Semanal', true),
  -- Savegnago Araraquara — weekly offers journal
  ('d0000000-0000-4000-a000-000000000004', 'https://www.savegnago.com.br/jornal-de-ofertas/araraquara', 'Savegnago Araraquara - Jornal Semanal', true),
  -- Covabra Sao Carlos — weekly offers journal
  ('d0000000-0000-4000-a000-000000000005', 'https://www.savegnago.com.br/jornal-de-ofertas/sao-carlos', 'Savegnago Sao Carlos - Jornal Semanal', true),
  -- Tenda Atacado Matao — image-based offers (is_active=false until image crawler exists)
  ('d0000000-0000-4000-a000-000000000006', 'https://www.tendaatacado.com.br/institucional/nossas-ofertas', 'Tenda Atacado Matao - Ofertas', false)
on conflict do nothing;

-- =============================================================================
-- Summary:
--   6 stores: Savegnago Matao, Confianca, Tonin Superatacado, Savegnago Araraquara, Covabra Sao Carlos, Tenda Atacado Matao
--   65 products across 7 categories (12 bebidas, 16 alimentos, 10 limpeza, 10 hortifruti, 7 padaria, 10 higiene)
--   126 active promotions with realistic price competition
--   105 product synonyms for fuzzy search
--   4 store PDF sources (3 active + 1 inactive: Tenda uses images, not PDFs)
--   Source mix: ~60% manual, ~25% importador_ia, ~15% crawler
-- =============================================================================
