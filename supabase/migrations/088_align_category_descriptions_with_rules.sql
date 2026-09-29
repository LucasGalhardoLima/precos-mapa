-- Catalog normalization, phase C: three category descriptions contradicted the
-- consistency rules the LLM prompt now states (docs/poup-normalizacao-auditoria-*):
-- água de coco is "suco", caldos are "temperos", paper towels are
-- "papel-higienico-lencos". The prompt already says its rules win; this makes the
-- descriptions say the same so the two never disagree.

update public.product_categories set description =
  'Água mineral com e sem gás e água saborizada. Água de coco é suco, não água.'
where id = 'agua';

update public.product_categories set description =
  'Molho de tomate, extrato de tomate, ketchup, maionese, mostarda, molhos prontos, vinagre, shoyu. Caldo em tablete ou pó é temperos, não molho.'
where id = 'molhos-condimentos';

update public.product_categories set description =
  'Copos, pratos, talheres e potes descartáveis, papel alumínio, filme PVC, guardanapo, palito, forma de papel. NÃO inclui saco de lixo (utilidades-limpeza), toalha de papel (papel-higienico-lencos) nem balões e artigos de festa (outros).'
where id = 'descartaveis';
