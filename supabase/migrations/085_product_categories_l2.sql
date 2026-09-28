-- Catalog normalization, phase A (docs/poup-prd-normalizacao-catalogo.md):
-- a level-2 taxonomy under the 12 existing departments (`categories`), plus the
-- columns on `products` that the assignment passes (phase B: no-LLM, phase C:
-- Haiku batch) will fill. Nothing here assigns a value — this migration only
-- creates the slots.
--
-- The rows below are the PRD's "Taxonomia proposta" table: 61 rows (the PRD's
-- "57" was a miscount) plus three added in the phase A review — castanhas-
-- frutas-secas, outras-carnes, beleza-maquiagem — for 64. Slugs are ASCII kebab-case and are the ids the
-- Savegnago leaf mapping (scripts/savegnago-leaf-category-map.tsv) refers to.

create table public.product_categories (
  id            text primary key,
  department_id text not null references public.categories(id),
  name          text not null,
  sort_order    integer not null
);

alter table public.product_categories enable row level security;

create policy "product_categories_select_all" on public.product_categories
  for select to anon, authenticated using (true);

grant select on public.product_categories to anon, authenticated;
grant all on public.product_categories to service_role;

insert into public.product_categories (id, department_id, name, sort_order) values
  -- Mercearia (cat_alimentos)
  ('arroz',                    'cat_alimentos',  'Arroz',                        1),
  ('feijao-graos',             'cat_alimentos',  'Feijão e grãos',               2),
  ('massas',                   'cat_alimentos',  'Massas',                       3),
  ('molhos-condimentos',       'cat_alimentos',  'Molhos e condimentos',         4),
  ('oleos-azeites',            'cat_alimentos',  'Óleos e azeites',              5),
  ('acucar-adocantes',         'cat_alimentos',  'Açúcar e adoçantes',           6),
  ('cafe',                     'cat_alimentos',  'Café',                         7),
  ('matinais',                 'cat_alimentos',  'Matinais',                     8),
  ('farinhas-fermentos',       'cat_alimentos',  'Farinhas e fermentos',         9),
  ('conservas',                'cat_alimentos',  'Conservas',                   10),
  ('temperos',                 'cat_alimentos',  'Temperos',                    11),
  ('biscoitos',                'cat_alimentos',  'Biscoitos',                   12),
  ('salgadinhos-snacks',       'cat_alimentos',  'Salgadinhos e snacks',        13),
  ('doces-chocolates',         'cat_alimentos',  'Doces e chocolates',          14),
  ('sobremesas-preparos',      'cat_alimentos',  'Sobremesas e preparos',       15),
  ('sopas-pratos-prontos',     'cat_alimentos',  'Sopas e pratos prontos',      16),
  ('saudaveis-suplementos',    'cat_alimentos',  'Saudáveis e suplementos',     17),
  ('castanhas-frutas-secas',   'cat_alimentos',  'Castanhas e frutas secas',    18),
  -- Bebidas
  ('agua',                     'cat_bebidas',    'Água',                         1),
  ('refrigerante',             'cat_bebidas',    'Refrigerante',                 2),
  ('suco',                     'cat_bebidas',    'Suco',                         3),
  ('cerveja',                  'cat_bebidas',    'Cerveja',                      4),
  ('vinho-espumante',          'cat_bebidas',    'Vinho e espumante',            5),
  ('destilados',               'cat_bebidas',    'Destilados',                   6),
  ('energetico-isotonico',     'cat_bebidas',    'Energético e isotônico',       7),
  ('cha',                      'cat_bebidas',    'Chá',                          8),
  -- Laticínios e frios (cat_laticinios)
  ('leite',                    'cat_laticinios', 'Leite',                        1),
  ('iogurte-fermentado',       'cat_laticinios', 'Iogurte e fermentado',         2),
  ('queijos',                  'cat_laticinios', 'Queijos',                      3),
  ('manteiga-margarina',       'cat_laticinios', 'Manteiga e margarina',         4),
  ('requeijao-creme-leite',    'cat_laticinios', 'Requeijão e creme de leite',   5),
  ('frios-embutidos',          'cat_laticinios', 'Frios e embutidos',            6),
  -- Carnes
  ('bovina',                   'cat_carnes',     'Bovina',                       1),
  ('aves',                     'cat_carnes',     'Aves',                         2),
  ('suina',                    'cat_carnes',     'Suína',                        3),
  ('peixes-frutos-do-mar',     'cat_carnes',     'Peixes e frutos do mar',       4),
  ('outras-carnes',            'cat_carnes',     'Outras carnes',                5),
  -- Congelados
  ('prontos-congelados',       'cat_congelados', 'Prontos congelados',           1),
  ('sorvete-acai',             'cat_congelados', 'Sorvete e açaí',               2),
  ('vegetais-polpas',          'cat_congelados', 'Vegetais e polpas',            3),
  -- Hortifruti
  ('frutas',                   'cat_hortifruti', 'Frutas',                       1),
  ('legumes-verduras',         'cat_hortifruti', 'Legumes e verduras',           2),
  ('ovos',                     'cat_hortifruti', 'Ovos',                         3),
  -- Padaria
  ('paes',                     'cat_padaria',    'Pães',                         1),
  ('bolos-confeitaria',        'cat_padaria',    'Bolos e confeitaria',          2),
  -- Limpeza
  ('roupa',                    'cat_limpeza',    'Roupa',                        1),
  ('louca',                    'cat_limpeza',    'Louça',                        2),
  ('limpeza-geral',            'cat_limpeza',    'Limpeza geral',                3),
  ('utilidades-limpeza',       'cat_limpeza',    'Utilidades de limpeza',        4),
  ('inseticidas-odorizadores', 'cat_limpeza',    'Inseticidas e odorizadores',   5),
  -- Higiene
  ('papel-higienico-lencos',   'cat_higiene',    'Papel higiênico e lenços',     1),
  ('cabelo',                   'cat_higiene',    'Cabelo',                       2),
  ('corpo-banho',              'cat_higiene',    'Corpo e banho',                3),
  ('saude-bucal',              'cat_higiene',    'Saúde bucal',                  4),
  ('higiene-intima-absorventes','cat_higiene',   'Higiene íntima e absorventes', 5),
  ('beleza-maquiagem',         'cat_higiene',    'Beleza e maquiagem',           6),
  -- Bebê
  ('fraldas',                  'cat_bebes',      'Fraldas',                      1),
  ('alimentacao-infantil',     'cat_bebes',      'Alimentação infantil',         2),
  ('higiene-infantil',         'cat_bebes',      'Higiene infantil',             3),
  -- Pet
  ('racao',                    'cat_pet',        'Ração',                        1),
  ('higiene-acessorios-pet',   'cat_pet',        'Higiene e acessórios pet',     2),
  -- Bazar (cat_outros)
  ('descartaveis',             'cat_outros',     'Descartáveis',                 1),
  ('utensilios',               'cat_outros',     'Utensílios',                   2),
  ('outros',                   'cat_outros',     'Outros',                       3);

-- Display name only; the id stays because scrapers and products.category_id
-- reference it.
update public.categories set name = 'Bazar' where id = 'cat_outros';

-- Provenance columns. A row with normalized_by set is never overwritten by a
-- later pass unless that pass is run explicitly with --force (enforced in the
-- scripts, not here: --force has to be able to write).
alter table public.products
  add column category_l2      text references public.product_categories(id),
  add column brand_norm       text,
  add column base_name        text,
  add column normalized_by    text check (normalized_by in ('savegnago_tree', 'ean_inherit', 'llm')),
  add column normalized_at    timestamptz,
  add column normalized_model text;

comment on column public.products.category_l2 is 'Level-2 category (product_categories.id); null = not assigned. Written only by the normalization passes.';
comment on column public.products.normalized_by is 'Which pass wrote category_l2/brand_norm/base_name; set = protected from overwrite unless --force.';
