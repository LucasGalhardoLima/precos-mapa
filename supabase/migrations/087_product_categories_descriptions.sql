-- Catalog normalization, phase C: the LLM prompt reads each category's name
-- AND a one-line description. The 200-product audit sample showed the names
-- alone mislead ("Roupa" read as clothing, "Louça" as dishware), so two
-- display names change (slugs stay) and every category gets a description.
-- Ambiguous ones say what is in and what is out.

alter table public.product_categories add column description text;

update public.product_categories set name = 'Lavanderia'   where id = 'roupa';
update public.product_categories set name = 'Lava-louças'  where id = 'louca';

update public.product_categories as pc set description = d.description
from (values
  -- Mercearia
  ('arroz', 'Arroz de qualquer tipo (branco, integral, parboilizado, arbóreo). Não inclui biscoito ou farinha de arroz.'),
  ('feijao-graos', 'Feijão, lentilha, grão-de-bico, ervilha seca, milho de pipoca e outros grãos secos.'),
  ('massas', 'Macarrão seco, massa fresca, lasanha, nhoque. Molho de tomate é molhos-condimentos.'),
  ('molhos-condimentos', 'Molho de tomate, extrato de tomate, ketchup, maionese, mostarda, molhos prontos, vinagre, shoyu, caldo em tablete.'),
  ('oleos-azeites', 'Óleo de soja/girassol/milho, azeite, óleo de coco para cozinha.'),
  ('acucar-adocantes', 'Açúcar (refinado, cristal, mascavo, demerara), adoçante, xarope de açúcar.'),
  ('cafe', 'Café torrado/moído, em grão, solúvel, cápsulas e cappuccino em pó.'),
  ('matinais', 'Achocolatado em pó, cereal matinal, granola, aveia, geleia, mel, cremes de untar, torradas de café da manhã.'),
  ('farinhas-fermentos', 'Farinha de trigo/mandioca/milho, fubá, amido (maizena), farofa pronta, fermento, misturas para bolo.'),
  ('conservas', 'Alimentos em lata, vidro ou vácuo: atum, sardinha, milho, ervilha, palmito, azeitona, pepino, pimenta em conserva.'),
  ('temperos', 'Sal, pimenta-do-reino, orégano, colorau, temperos em pó ou pasta, ervas e especiarias secas.'),
  ('biscoitos', 'Biscoitos e bolachas doces, salgados, recheados, wafer, rosquinhas e cookies.'),
  ('salgadinhos-snacks', 'Salgadinhos de pacote, batata frita/palha, pipoca pronta, amendoim salgado, mix de snacks.'),
  ('doces-chocolates', 'Chocolates, bombons, balas, chicletes, pirulitos, doces prontos, paçoca, barras de chocolate.'),
  ('sobremesas-preparos', 'Leite condensado, gelatina, pudim e mousse em pó, cobertura, chocolate em pó culinário, leite de coco, coco ralado.'),
  ('sopas-pratos-prontos', 'Sopas instantâneas, cremes, pratos prontos de prateleira ou refrigerados, refeições da rotisserie.'),
  ('saudaveis-suplementos', 'Suplementos (whey, creatina), barras de proteína, produtos light/diet/orgânicos/sem glúten, bebidas vegetais.'),
  ('castanhas-frutas-secas', 'Castanhas, nozes, amendoim, amêndoas, uva-passa, ameixa seca, frutas secas e cristalizadas.'),
  -- Bebidas
  ('agua', 'Água mineral com e sem gás, água saborizada, água de coco em embalagem.'),
  ('refrigerante', 'Refrigerantes (cola, guaraná, laranja, limão), água tônica e bebidas gaseificadas doces.'),
  ('suco', 'Sucos prontos, integrais, concentrados, em pó e néctares, bebidas mistas de fruta.'),
  ('cerveja', 'Cerveja e chopp, com ou sem álcool.'),
  ('vinho-espumante', 'Vinho tinto/branco/rosé, espumante, champagne, sangria.'),
  ('destilados', 'Cachaça, vodka, whisky, gin, rum, tequila, licores, batidas e drinks alcoólicos prontos.'),
  ('energetico-isotonico', 'Energéticos e isotônicos.'),
  ('cha', 'Chá em sachê, folhas, pronto para beber, mate.'),
  -- Laticínios e frios
  ('leite', 'Leite líquido ou em pó (integral, desnatado, sem lactose), leite UHT. Leite condensado é sobremesas-preparos.'),
  ('iogurte-fermentado', 'Iogurte, leite fermentado, bebida láctea, kefir, coalhada.'),
  ('queijos', 'Queijos de qualquer tipo, fatiados, ralados ou inteiros.'),
  ('manteiga-margarina', 'Manteiga, margarina, ghee.'),
  ('requeijao-creme-leite', 'Requeijão, cream cheese, creme de leite, chantilly, doce de leite pastoso.'),
  ('frios-embutidos', 'Presunto, mortadela, salame, peito de peru, linguiça, salsicha, bacon, apresuntado.'),
  -- Carnes
  ('bovina', 'Carne bovina fresca ou congelada (cortes, moída, hambúrguer bovino), carne seca, charque, miúdos bovinos.'),
  ('aves', 'Frango, peru, chester, codorna, pato, cortes e miúdos de ave, frango temperado.'),
  ('suina', 'Carne suína: lombo, pernil, costela, bisteca, bacon em peça, tender.'),
  ('peixes-frutos-do-mar', 'Peixes frescos ou congelados, bacalhau, salmão, camarão, lula, polvo.'),
  ('outras-carnes', 'Carnes exóticas ou não classificadas: cordeiro, cabrito, coelho, javali, jacaré, rã, capivara.'),
  -- Congelados
  ('prontos-congelados', 'Pizza, lasanha, hambúrguer, empanados, nuggets, pão de queijo congelado, salgados e refeições congeladas.'),
  ('sorvete-acai', 'Sorvete, picolé, açaí, sobremesas geladas.'),
  ('vegetais-polpas', 'Vegetais congelados, batata congelada, polpa de fruta congelada, frutas congeladas.'),
  -- Hortifruti
  ('frutas', 'Frutas frescas in natura (banana, maçã, laranja, mamão, uva etc.). Fruta seca é castanhas-frutas-secas.'),
  ('legumes-verduras', 'Legumes, verduras, raízes, cogumelos, ervas frescas (salsinha, coentro, cheiro-verde), saladas embaladas.'),
  ('ovos', 'Ovos de galinha, codorna e pata.'),
  -- Padaria
  ('paes', 'Pão francês, de forma, bisnaga, torrada, pão de alho, hambúrguer/hot dog (pão).'),
  ('bolos-confeitaria', 'Bolos, tortas, doces de padaria, salgados assados, petit four.'),
  -- Limpeza
  ('roupa', 'Produtos para LAVAR roupa: sabão em pó ou líquido, amaciante, alvejante, tira-manchas, sabão em barra. NÃO é vestuário nem roupa de cama/mesa/banho (isso é outros).'),
  ('louca', 'Produtos para LAVAR louça: detergente, lava-louças, sabão para louça. NÃO inclui copos, pratos, panelas, potes ou jarras (isso é utensilios).'),
  ('limpeza-geral', 'Limpadores da casa: multiuso, desinfetante, água sanitária, limpa-vidros, limpa-piso, cera, limpador de banheiro, desengordurante. Sem produtos de lavar roupa ou louça.'),
  ('utilidades-limpeza', 'Ferramentas e itens de limpeza: vassoura, rodo, pano, esponja, luva, saco de lixo, balde.'),
  ('inseticidas-odorizadores', 'Inseticida, repelente, raticida, aromatizador e odorizador de ambiente, vela aromática.'),
  -- Higiene
  ('papel-higienico-lencos', 'Papel higiênico, lenço de papel, papel toalha de banheiro. Lenço umedecido infantil é higiene-infantil.'),
  ('cabelo', 'Shampoo, condicionador, máscara, creme e gel para cabelo, tintura, spray fixador.'),
  ('corpo-banho', 'Sabonete, desodorante, hidratante corporal, protetor solar, aparelho e lâmina de barbear, espuma de barbear, absorvente de algodão.'),
  ('saude-bucal', 'Creme dental, escova de dente, fio dental, enxaguante bucal.'),
  ('higiene-intima-absorventes', 'Absorventes, protetor diário, sabonete íntimo, preservativo.'),
  ('beleza-maquiagem', 'Maquiagem, esmalte, cuidados com o rosto, hidratante labial, cílios e pincéis, lixa e acessórios de beleza.'),
  -- Bebê
  ('fraldas', 'Fraldas descartáveis infantis, fralda de pano.'),
  ('alimentacao-infantil', 'Fórmulas infantis, papinhas, cereais infantis, complemento alimentar para crianças.'),
  ('higiene-infantil', 'Lenço umedecido, pomada de assadura, sabonete e shampoo infantil, cotonete, mamadeira e acessórios do bebê.'),
  -- Pet
  ('racao', 'Ração seca ou úmida (sachê, lata) e petiscos para cães, gatos, pássaros e peixes.'),
  ('higiene-acessorios-pet', 'Areia sanitária, tapete higiênico, shampoo pet, coleira, guia, comedouro, brinquedo para animais.'),
  -- Bazar
  ('descartaveis', 'Copos, pratos, talheres e potes descartáveis, papel alumínio, filme PVC, papel toalha de cozinha, guardanapo, palito, forma de papel. NÃO inclui saco de lixo (utilidades-limpeza) nem balões e artigos de festa (outros).'),
  ('utensilios', 'Utensílios de cozinha e mesa: panelas, formas, copos, taças, xícaras, pratos, talheres, potes, jarras, garrafas, facas, tábuas, organizadores. Vidro e louça de mesa ficam aqui.'),
  ('outros', 'Bazar não alimentar que não cabe nas outras categorias: material escolar, brinquedos, pilhas, lâmpadas, ferramentas, cama/mesa/banho, colchas, plantas e vasos, automotivo, lazer, calçados, artigos de festa, balões, velas.')
) as d(id, description)
where pc.id = d.id;

-- Every category must have one: the prompt depends on it.
alter table public.product_categories alter column description set not null;
