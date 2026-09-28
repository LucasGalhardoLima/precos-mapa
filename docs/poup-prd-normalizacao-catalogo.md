# PRD — Normalização do catálogo com LLM (POUP MLP)

28/09/2026 · status: proposta, entra depois da Etapa 7 (Ajustes)

## Problema

O catálogo tem ~49 mil produtos com nomes como vêm dos varejistas ("PAP HIG FOLHA DUPLA 12X30M", "ARROZ T1 5KG TIO JOAO"). O app depende de quatro coisas que esses nomes não entregam de forma confiável: tamanho (o parser cobre ~60%, então QUAL TAMANHO e preço por unidade somem em ~40% das Respostas), categoria (a busca trouxe ração para "arroz" e foi remendada com regra de ranking), marca e nome-base (a família de tamanhos do QUAL TAMANHO hoje é inferida tirando tokens do nome, o que é frágil). Itens genéricos do onboarding ("arroz · 5 kg") e o alerta por categoria dependem das mesmas quatro coisas.

## Objetivos

1. Tamanho resolvido em ≥ 95% do cohort fresco **nos departamentos Mercearia, Bebidas, Laticínios, Limpeza, Higiene, Bebê e Pet** (fora Hortifruti, Carnes, Congelados, Padaria e Bazar, onde tamanho não é o que se compara). "Resolvido" = tamanho parseado, ou produto vendido por kg (nome com "kg" sem número junto, ex.: "Linguiça Toscana Seara Kg"). O departamento é o de `category_l2` depois da Fase C. Medido em 29/09 com o `products.category_id` atual: 89,6% (18.353 de 20.477; faltam 1.101 para 95%), sendo 18.213 parseados e 140 vendidos por kg. Esse número subestima: `category_id` põe em "Alimentos" muito item de bazar (sandália, caneta, faca, vela, tinta), que sai do escopo quando o departamento vier de `category_l2`. Nos 7.279 produtos frescos que já têm `category_l2` nesses departamentos: 94,9% (6.911).
2. Categoria atribuída em ≥ 95% do cohort fresco, com precisão ≥ 95% numa auditoria amostral.
3. Melhorar a relevância da busca num conjunto fixo de consultas de referência (ver Métricas); a linha de base com usuários reais não existe (31 eventos de busca em 5 meses).
4. Custo recorrente abaixo de R$ 20/mês e nenhuma mudança de plano no Supabase.

## Fora do escopo

- **IA na tela** (chat, resumo, recomendação): fere "nada de informação não solicitada".
- **Busca semântica por embeddings**: o custo real é armazenamento, não API (ver Custos). Sinônimos entram como tabela gerada no mesmo passe.
- **Casar produtos sem EAN entre mercados**: a decisão 3 continua valendo. A categoria ajuda a busca, não cria comparação.
- **Reconhecer embalagem por foto**: fora do MLP (decisão 4).
- **Reescrever o nome exibido**: o app mostra o nome original; os campos normalizados são para busca, agrupamento e tamanho.

## Histórias

- Como quem busca "papel higiênico", quero ver os papéis higiênicos mesmo quando o mercado escreve "PAP HIG", para não concluir que o produto não existe.
- Como quem abre a Resposta de um arroz de 5 kg, quero ver se o de 2 kg sai mais barato por quilo, mesmo quando o nome não traz o tamanho de forma limpa.
- Como quem escolheu "arroz · 5 kg" no onboarding, quero que a raiz mostre o arroz de 5 kg mais barato de hoje, e não um arroz de 1 kg ou uma ração.
- Como Lucas, quero auditar uma amostra antes de publicar, para que um erro do modelo nunca chegue à tela sem passar por mim.

## Requisitos

### P0

1. **Job em lote no servidor** (mesmo padrão dos scrapers, GitHub Actions + conexão direta). Ele lê os produtos sem normalização e envia em lotes de 50 para a Batch API do Claude Haiku 4.5. Recebe JSON com `category`, `brand`, `base_name`, `size_value`, `size_unit`, `confidence`.
   - Critério: nenhuma chamada a modelo no app; o job é idempotente e reprocessa só produtos novos ou alterados.
2. **Colunas novas em `products`** com origem registrada (`normalized_by`, `normalized_at`, `model`). Um campo parseado por regra nunca é sobrescrito pelo LLM, mesmo padrão do `image_url`.
3. **Taxonomia fechada de categorias** (lista curta, fixa, definida antes do job). O modelo só pode escolher dentro dela; fora dela, grava `null`.
4. **Auditoria antes de publicar**: 300 produtos sorteados, revisados à mão. A publicação só acontece com ≥ 95% de categoria certa e ≥ 97% de tamanho certo; abaixo disso, ajusta o prompt e roda de novo.
5. **Uso no app sem tela nova**: a busca passa a ranquear por categoria + texto; QUAL TAMANHO usa `base_name` + `brand` + `size_*`; item genérico usa `category` + tamanho padrão.

### P1

6. **Tabela de sinônimos** gerada no mesmo passe (abreviações de varejo e marcas usadas como genérico, por exemplo "moça" → leite condensado), aplicada na busca via `pg_trgm`.
7. **Produtos novos por dia** normalizados na rodada seguinte à das 03:00.

### P2

8. Embeddings para busca semântica, só se as métricas de busca estagnarem depois do P0/P1 e o plano do Supabase comportar.

## Custos reais

Preços consultados em 28/09/2026 · câmbio R$ 5,18/US$ (fechamento de 25/09).

| Item | Premissa | Custo |
|---|---|---|
| Passe inicial, Haiku 4.5 Batch ($0,50 entrada / $2,50 saída por MTok) | 49 mil produtos, ~80 tokens de entrada e ~50 de saída por produto, lotes de 50 | ~US$ 8 (≈ R$ 42), uma vez |
| Auditoria assistida, Sonnet 5.5 Batch | 500 produtos | < US$ 0,20 |
| Margem para uma segunda rodada, se a auditoria reprovar | +1 passe | ~US$ 8 |
| Produtos novos, Haiku 4.5 Batch | 100 a 500 por dia | US$ 0,50 a 2,40/mês (≈ R$ 3 a 12) |
| Alternativa: tudo em Sonnet 5.5 Batch, se Haiku não passar na auditoria | mesmo volume | ~US$ 16 uma vez; ~US$ 1 a 5/mês |
| Armazenamento no banco | 5 colunas curtas × 49 mil linhas | ~5 MB, cabe no Free |

**Total do P0:** menos de R$ 100 de uma vez (com margem para rodar duas vezes) e menos de R$ 15 por mês.

### Por que embeddings ficam de fora

A API é praticamente grátis: text-embedding-3-small custa US$ 0,01/MTok em batch, e o catálogo inteiro dá ~1 MTok, ou seja, US$ 0,01. O custo real é o banco. Com 1536 dimensões mais o índice HNSW, são ~12 KB por linha:

- 49 mil produtos ≈ 590 MB, acima dos 500 MB do Free.
- Mesmo em 512 dimensões e só o cohort fresco (~22 mil), são ~90 MB num banco que já está em 279 MB, com o `price_history` crescendo.

Na prática, embeddings obrigam o Supabase Pro (US$ 25/mês ≈ R$ 130/mês), que é justamente o gasto que você quer evitar. Também adicionam uma chamada de API por busca, que come a folga do limiar de 300 ms do esqueleto.

### Custo de engenharia

É o custo que realmente pesa: ~2 a 3 dias de agente (job, migration, taxonomia, uso na busca e no QUAL TAMANHO) e ~2 horas suas de auditoria.

## Métricas

- **Leading:** cobertura de tamanho e de categoria no cohort fresco (query no banco, logo após o passe); precisão da auditoria.
- **Relevância offline:** 50 consultas de referência (os 12 chips do onboarding + os produtos mais buscados/comuns), top-5 julgado certo/errado antes e depois da Fase D. Meta: ≥ 90% de top-5 relevante depois.
- **Com usuários (quando existirem):** taxa de busca sem resultado e buscas que chegam à Resposta, contando só a consulta final (≥ 3 letras, última antes de navegar), com `search_id` ligando busca → Resposta.

## Perguntas em aberto

- **Taxonomia** (produto, Lucas): quantas categorias e quais? Proposta: ~40 categorias de mercado, cobrindo os 12 chips do onboarding.
- **Linha de base de busca** (dados, agente): os eventos de busca já registram contagem zero? Se não, medir a partir de agora, antes do passe.
- **Volume real de produtos novos por dia** (dados, agente): define o custo recorrente exato.

## Taxonomia proposta (revisão de 28/09, a partir dos 4 mercados)

### O que os mercados fazem

Os quatro convergem em ~12–16 departamentos (os corredores): Bebidas, Mercearia, Frios e Laticínios, Carnes, Congelados, Hortifruti, Padaria, Limpeza, Higiene e Perfumaria, Bebê, Pet e Bazar. A divergência está no segundo nível:

- **Savegnago:** tem árvore completa (14 departamentos, 461 folhas).
- **Amarelinha:** quebra a Mercearia em corredores próprios (Matinais, Cereais e Farináceos, Molhos e Conservas, Doces, Biscoitos).
- **Tenda:** tem departamentos transversais ("Marca própria", "Food Service", "Fit e Saudável") que não são categoria de produto.
- **Jaú Serve:** tem "Sazonais" e "Empório".

As 12 categorias atuais do POUP (`categories`) equivalem a esse primeiro nível. Falta o segundo, que é o que a busca e os itens genéricos precisam. Hoje "cat_alimentos" engole a Mercearia inteira, e a "Marca própria" do Tenda cai em "cat_outros".

### Dois níveis

- **Nível 1 (departamento):** as 12 atuais, com "cat_outros" renomeada para Bazar.
- **Nível 2 (categoria):** a lista abaixo. O critério é separar o que o usuário compara entre si (arroz não se compara com feijão) e nada mais fino que isso (arroz branco e integral ficam juntos; quem separa é o nome e o tamanho).

| Nível 1 | Nível 2 |
|---|---|
| Mercearia | Arroz · Feijão e grãos · Massas · Molhos e condimentos · Óleos e azeites · Açúcar e adoçantes · Café · Matinais (achocolatado, cereal, aveia) · Farinhas e fermentos · Conservas · Temperos · Biscoitos · Salgadinhos e snacks · Doces e chocolates · Sobremesas e preparos · Sopas e pratos prontos · Saudáveis e suplementos · Castanhas e frutas secas |
| Bebidas | Água · Refrigerante · Suco · Cerveja · Vinho e espumante · Destilados · Energético e isotônico · Chá |
| Laticínios e frios | Leite · Iogurte e fermentado · Queijos · Manteiga e margarina · Requeijão e creme de leite · Frios e embutidos |
| Carnes | Bovina · Aves · Suína · Peixes e frutos do mar · Outras carnes |
| Congelados | Prontos congelados · Sorvete e açaí · Vegetais e polpas |
| Hortifruti | Frutas · Legumes e verduras · Ovos |
| Padaria | Pães · Bolos e confeitaria |
| Limpeza | Roupa · Louça · Limpeza geral · Utilidades de limpeza · Inseticidas e odorizadores |
| Higiene | Papel higiênico e lenços · Cabelo · Corpo e banho · Saúde bucal · Higiene íntima e absorventes · Beleza e maquiagem |
| Bebê | Fraldas · Alimentação infantil · Higiene infantil |
| Pet | Ração · Higiene e acessórios pet |
| Bazar | Descartáveis · Utensílios · Outros |

São 12 departamentos e 61 categorias (a contagem de 57 estava errada), mais 3 adicionadas na revisão da Fase A: Castanhas e frutas secas (Mercearia), Outras carnes (Carnes), Beleza e maquiagem (Higiene). Total: 64. Geleias, mel e cremes de untar vão para Matinais; pratos prontos da rotisserie vão para Sopas e pratos prontos; folhas de bazar não alimentares vão para Bazar > Outros (não null). Os 12 chips do onboarding caem em categorias próprias: Arroz, Feijão, Leite, Óleo, Açúcar, Café, Ovos, Frango (Aves), Papel higiênico, Sabão em pó (Roupa), Detergente (Louça) e Refrigerante.

### Atribuição sem LLM primeiro

1. **Produtos do Savegnago:** a folha da árvore dele (461) mapeia direto para o nível 2, por tabela.
2. **Produtos dos outros mercados com EAN:** herdam a categoria do mesmo EAN no Savegnago. Como 88,8% dos produtos com preço fresco têm EAN, a maior parte do catálogo resolve aqui, sem modelo.
3. **LLM só no resto:** produtos sem EAN e EANs que não existem no Savegnago. Isso reduz o volume do passe e o custo abaixo do estimado acima.

## Faseamento

Depois da Etapa 7:

1. Taxonomia e migration.
2. Passe em 500 produtos e auditoria.
3. Passe completo.
4. Busca e QUAL TAMANHO lendo as colunas novas.
5. Sinônimos (P1).
