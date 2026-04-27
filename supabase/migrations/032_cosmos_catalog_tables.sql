-- supabase/migrations/032_cosmos_catalog_tables.sql

-- GPC (Global Product Classification) code → Poup category_id
-- Used by the PDF import Cosmos fallback and the seed script.
-- Extend this table as new GPC codes appear in Cosmos API responses.
-- Default fallback for unmapped codes: cat_alimentos

CREATE TABLE IF NOT EXISTS public.cosmos_gpc_map (
  gpc_code    text PRIMARY KEY,
  category_id text NOT NULL REFERENCES public.categories(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed: GPC brick codes → Poup categories
-- Only confirmed or high-confidence mappings are included.
-- Source: GS1 GPC browser + Cosmos API example responses.
INSERT INTO public.cosmos_gpc_map (gpc_code, category_id) VALUES
  -- Alimentos (food staples)
  ('10000043', 'cat_alimentos'),  -- Açúcar / Substitutos (confirmed from Cosmos API)
  ('10000106', 'cat_alimentos'),  -- Arroz / Cereais
  ('10000114', 'cat_alimentos'),  -- Feijão / Leguminosas
  ('10000122', 'cat_alimentos'),  -- Farinha de Trigo / Amidos
  ('10000130', 'cat_alimentos'),  -- Massas / Macarrão
  ('10000148', 'cat_alimentos'),  -- Óleos e Gorduras Vegetais
  ('10000156', 'cat_alimentos'),  -- Molhos / Condimentos / Temperos
  ('10000169', 'cat_alimentos'),  -- Conservas / Enlatados
  ('10000027', 'cat_alimentos'),  -- Leite UHT / Leite em Pó
  ('10000035', 'cat_alimentos'),  -- Queijos
  ('10000078', 'cat_alimentos'),  -- Iogurtes
  ('10000086', 'cat_alimentos'),  -- Manteiga / Margarina
  ('10000197', 'cat_alimentos'),  -- Carnes Processadas / Frios
  ('10000205', 'cat_alimentos'),  -- Embutidos / Linguiças
  ('10000213', 'cat_alimentos'),  -- Ovos
  ('10000221', 'cat_alimentos'),  -- Café / Chá / Achocolatado
  ('10000239', 'cat_alimentos'),  -- Biscoitos / Bolachas
  ('10000247', 'cat_alimentos'),  -- Chocolates / Doces
  -- Bebidas
  ('50000001', 'cat_bebidas'),    -- Água Mineral
  ('50000012', 'cat_bebidas'),    -- Refrigerantes
  ('50000020', 'cat_bebidas'),    -- Sucos / Néctares
  ('50000039', 'cat_bebidas'),    -- Cervejas / Chope
  ('50000047', 'cat_bebidas'),    -- Vinhos
  ('50000055', 'cat_bebidas'),    -- Energéticos / Isotônicos
  -- Hortifruti
  ('50000175', 'cat_hortifruti'), -- Frutas Frescas
  ('50000183', 'cat_hortifruti'), -- Verduras / Legumes Frescos
  ('50000191', 'cat_hortifruti'), -- Tubérculos / Raízes (batata, cenoura)
  -- Padaria
  ('10000394', 'cat_padaria'),    -- Pães / Torradas
  ('10000408', 'cat_padaria'),    -- Bolos / Tortas
  ('10000416', 'cat_padaria'),    -- Massas Frescas / Congeladas
  -- Higiene Pessoal
  ('53000000', 'cat_higiene'),    -- Higiene Pessoal (família)
  ('53000019', 'cat_higiene'),    -- Shampoo / Condicionador
  ('53000027', 'cat_higiene'),    -- Sabonetes / Produtos de Banho
  ('53000035', 'cat_higiene'),    -- Creme Dental / Higiene Bucal
  ('53000043', 'cat_higiene'),    -- Desodorantes / Antitranspirantes
  ('53000051', 'cat_higiene'),    -- Absorventes / Fraldas
  ('53000086', 'cat_higiene'),    -- Papel Higiênico / Lenços
  -- Limpeza
  ('47000000', 'cat_limpeza'),    -- Limpeza Doméstica (família)
  ('47000019', 'cat_limpeza'),    -- Detergentes / Lava-Louças
  ('47000027', 'cat_limpeza'),    -- Sabão em Pó / Amaciante
  ('47000035', 'cat_limpeza'),    -- Desinfetantes / Multiuso
  ('47000043', 'cat_limpeza'),    -- Água Sanitária / Alvejante
  ('47000051', 'cat_limpeza')     -- Esponjas / Acessórios de Limpeza
ON CONFLICT (gpc_code) DO NOTHING;
