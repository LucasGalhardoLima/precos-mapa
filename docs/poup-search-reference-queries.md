# 50 consultas de referência — medida offline da busca (Fase D)

Rascunho da Fase B para você editar. Uso: antes da Fase D, rodar as 50 no app/RPC de busca e julgar o **top-5** de cada uma (relevante ou não); repetir depois da Fase D. Meta do PRD: ≥ 90% de top-5 relevante depois. "Relevante" = o produto é da categoria esperada (coluna 4); para os chips genéricos, o tamanho padrão da coluna 5 também conta.

- 12 chips do onboarding (`mobile/lib/onboarding.ts`, `GENERIC_ITEMS`) · 28 produtos comuns · 10 casos difíceis (sem acento, abreviação, marca usada como genérico, variação).
- A categoria esperada usa os ids de `product_categories` (migration 085).
- Os "produtos comuns" são minha escolha, não vêm de dados de uso (só existem 31 eventos de busca).

| # | Consulta | Tipo | Categoria esperada | Nota |
|---|---|---|---|---|
| 1 | Arroz | chip | arroz | 5 kg |
| 2 | Feijão | chip | feijao-graos | 1 kg |
| 3 | Leite | chip | leite | 1 L |
| 4 | Óleo | chip | oleos-azeites | 900 ml |
| 5 | Açúcar | chip | acucar-adocantes | 1 kg |
| 6 | Café | chip | cafe | 500 g |
| 7 | Ovos | chip | ovos | 30 un |
| 8 | Frango | chip | aves | kg |
| 9 | Papel higiênico | chip | papel-higienico-lencos | 12 rolos |
| 10 | Sabão em pó | chip | roupa | 1 kg |
| 11 | Detergente | chip | louca | 500 ml |
| 12 | Refrigerante | chip | refrigerante | 2 L |
| 13 | Macarrão | comum | massas |  |
| 14 | Farinha de trigo | comum | farinhas-fermentos |  |
| 15 | Sal | comum | temperos |  |
| 16 | Molho de tomate | comum | molhos-condimentos |  |
| 17 | Margarina | comum | manteiga-margarina |  |
| 18 | Manteiga | comum | manteiga-margarina |  |
| 19 | Queijo mussarela | comum | queijos |  |
| 20 | Iogurte | comum | iogurte-fermentado |  |
| 21 | Presunto | comum | frios-embutidos |  |
| 22 | Carne moída | comum | bovina |  |
| 23 | Peito de frango | comum | aves |  |
| 24 | Banana | comum | frutas |  |
| 25 | Tomate | comum | legumes-verduras |  |
| 26 | Batata | comum | legumes-verduras |  |
| 27 | Cebola | comum | legumes-verduras |  |
| 28 | Pão de forma | comum | paes |  |
| 29 | Biscoito recheado | comum | biscoitos |  |
| 30 | Chocolate | comum | doces-chocolates |  |
| 31 | Cerveja | comum | cerveja |  |
| 32 | Água mineral | comum | agua |  |
| 33 | Suco de laranja | comum | suco |  |
| 34 | Amaciante | comum | roupa |  |
| 35 | Água sanitária | comum | limpeza-geral |  |
| 36 | Shampoo | comum | cabelo |  |
| 37 | Sabonete | comum | corpo-banho |  |
| 38 | Creme dental | comum | saude-bucal |  |
| 39 | Fralda | comum | fraldas |  |
| 40 | Ração para cachorro | comum | racao |  |
| 41 | arroz integral | variação | arroz | não trazer ração nem biscoito de arroz no topo |
| 42 | feijao preto | sem acento | feijao-graos |  |
| 43 | acucar refinado | sem acento | acucar-adocantes |  |
| 44 | pap hig | abreviação | papel-higienico-lencos | abreviação de varejo |
| 45 | moça | marca como genérico | sobremesas-preparos | leite condensado |
| 46 | maizena | marca como genérico | farinhas-fermentos | amido de milho |
| 47 | nescau | marca como genérico | matinais | achocolatado |
| 48 | coca | marca | refrigerante | Coca-Cola, não 'cacau' nem 'coco' |
| 49 | leite desnatado | variação | leite |  |
| 50 | ração | genérico | racao | não trazer produto humano |
