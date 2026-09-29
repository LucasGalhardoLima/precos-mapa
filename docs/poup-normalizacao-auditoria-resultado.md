# Auditoria da amostra de normalização — resultado (29/09/2026)

Amostra: 300 produtos do cohort fresco, sementes 1 e 2 (200 pelo LLM + 100 pela árvore do Savegnago). Linhas em `docs/poup-normalizacao-auditoria-amostra.csv`; pré-auditoria do PM (S / N / ? e nota) em `docs/poup-normalizacao-auditoria-preaudit.csv`. Rodada auditada: run `sample-202609282252-s1` (prompt com nome + descrição das categorias).

## Categoria

Meta: ≥ 95% certos. Resultado: **290 de 300 (96,7%)**.
- LLM: 193 de 200 (96,5%).
- Árvore (`savegnago_tree`): 97 de 100 (97,0%).

Os 10 erros (5 marcados N e 5 dos 9 "?" que o PM decidiu que eram erro):
- LLM: batata Keleck 90 g (chips, não legume); cappuccino La Sante (→ `cafe`); água de coco Campo Largo e Puro Coco (→ `suco`); Caldo Maggi (→ `temperos`); vermute Martini (→ `destilados`); água oxigenada 40 vol (→ `cabelo`).
- Árvore: toalha de papel Snob (→ `papel-higienico-lencos`); defensivo Fumax (→ `inseticidas-odorizadores`); sabonete infantil Granado Bebê (→ `higiene-infantil`).

Decisões do PM nos "?": curativo, Not Milk e pêssego em calda ficam como estão; amido de milho fica em `sobremesas-preparos` porque a folha do Savegnago ("Mistura Para Bolos E Sorv") não é específica de amido.

Correções (nenhuma foi verificada com uma rodada nova do LLM, só com testes e com o dry-run nas linhas da árvore):
- Regras no prompt: cappuccino, água de coco, caldos, batata chips/palha, toalha de papel, vermute, defensivo, água oxigenada, Higiene com bebê/baby/infantil.
- Árvore (PR #76): refinamento por nome; 63 linhas já gravadas foram corrigidas.

## Tamanho

O LLM não propôs nenhum tamanho (nenhum dos candidatos tinha tamanho escrito), então a medida é a do parser regex: 264 linhas com tamanho do parser.
- Antes das correções: 15 erradas (dimensão lida como tamanho, "por item" no lugar do pacote, capacidade "suporta até") → 249 de 264 (94,3%).
- Com o parser atual (#73 e #77): as 14 linhas com causa no parser passam a dar o tamanho certo ou nenhum tamanho. Sobra 1: **iogurte Nestlé 28×170 g** dá 4.760 g, mas o preço no Savegnago é R$ 4,19, ou seja, o preço é de um pote de 170 g e o "28x" descreve a caixa. Nenhum parser resolve isso pelo nome; só uma checagem de preço por quilo.
- Custo da mudança: três linhas antes certas (saco de lixo 30 l C/20, copo de brigadeiro 50 ml C/10, pote 180 ml "10un") passam a sem tamanho pela regra "X g N unidades sem marcador → sem tamanho".
- O pack de sabonete de 85 g: nome completo "…Envoltório 340g 4 Unidades 85g Cada", R$ 4,99 → o pacote é 340 g (o parser antigo dizia 85 g).
