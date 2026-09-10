# Poup vs InfoPrice — Análise Estratégica de Gap

> Documento interno · Julho 2026  
> Objetivo: mapear o que o Poup já tem, o que a InfoPrice oferece, e o caminho da Fase 1 (consumidor) até a oferta B2B.

---

## 1. Contexto

Lucas trabalhou na InfoPrice no sistema IPA (precificação automática) e ajudou a desenvolver a ferramenta de análise de competitividade. A ambição do Poup é oferecer ferramentas similares às da InfoPrice, começando por um app consumidor que coleta dados de preço e usando esses dados como pitch para onboardar supermercados como clientes B2B.

---

## 2. O que a InfoPrice oferece (produtos principais)

### ISA InfoPanel — Inteligência de Mercado
- Maior painel de preços do varejo físico do Brasil (+10 bilhões de pontos de dados)
- +2 milhões de SKUs (supermercados, atacadistas, farmácias, pet shops)
- Monitoramento de preços dos concorrentes (físico e digital)
- Módulo de Lojas Concorrentes com IA (mapeia concorrência por proximidade/sortimento/preço)
- Análise de Competitividade com índice percentual e sinalização por cor
- Rastreamento de tendências de preço com dispersão min/max
- Tier gratuito (InfoPanel Free) + plano Pro

### IPA — Sistema de Precificação (onde Lucas trabalhou)
- SaaS 100% cloud
- Motor automatizado que calcula preços ideais com base em: custo (ERP), preço atual, preços dos concorrentes, previsão de demanda, regras psicológicas de pricing, gestão de promoções, IA/ML
- Criação de regras de pricing (frequência, margem desejada, fator de competitividade, limites)
- Quando um produto entra via nota fiscal, o sistema calcula automaticamente o novo preço
- Integração com ERP em 90 dias

### ISA Monitoramento PDV
- Pesquisa de campo em lojas concorrentes
- Captura preços, promoções e posicionamento de produtos no ponto de venda

### PEX — Consultoria de Pricing
- Serviço consultivo para estruturação de estratégia de precificação

### Método de coleta de dados (principal moat)
- Hardware patenteado **SmartPrice** simula EAN no terminal de consulta da loja
- Pesquisadores de campo com app proprietário
- Coleta de +1 bilhão de pontos de dados por ano
- Parceria com Precifica (e-commerce) para oferta "Phydigital"

### Modelo de negócio
- SaaS B2B por assinatura (Free, Flex, Pro)
- Clientes: Carrefour, Assaí, GPA, Grupo Mateus, Grupo ABC

---

## 3. O que o Poup já tem construído

### App Consumidor (Mobile — Expo/React Native)

| Tela | Status | O que faz |
|------|--------|-----------|
| Onboarding (2 telas) | ✅ Funcional | Permissão de localização + notificações |
| Home | ✅ Funcional | Ranking de mercados por preço, ofertas próximas, mercados próximos com distância/status |
| Busca | ⚠️ Quebrada | Grid de 12 categorias, populares na região, ranking "em alta" — mas busca retorna erro (bug de localização null) |
| Mapa | ✅ Funcional | Apple Maps com markers dos mercados cadastrados, filtro por categoria |
| Lista | ✅ Estado vazio | CTA "Nova lista" + 4 listas sugeridas (Cesta básica, Café da manhã, Limpeza, Higiene) |
| Alertas | ✅ Estado vazio | Sugestões de produtos para monitorar + "Como funciona" em 3 passos |
| Conta | ✅ Funcional | Badge de plano (FREE), economia mensal (R$35,45), upsell Poup Plus, preferências |
| Produto | ⛔ Não capturada | Tela existe no código (`product/[id].tsx`) mas Maestro não conseguiu navegar |
| Favoritos | ⛔ Não capturada | Tela existe no código (`favorites.tsx`) |

### App Lojista (Mobile — grupo `(business)`)

| Tela | Status | O que faz |
|------|--------|-----------|
| Dashboard B2B | ✅ No código | KPIs (ofertas ativas, views, clicks, usuários), análise competitiva via `useCompetitive` hook |
| Ofertas | ✅ No código | CRUD de promoções do lojista |
| Importador | ✅ No código | Importação de ofertas (provavelmente de panfletos/PDFs) |
| Perfil da loja | ✅ No código | Edição de dados do supermercado |
| ⚠️ Bloqueio | Auth desativada | Routing para `(business)` comentado (AUTH_STASHED), telas inacessíveis no build atual |

### Painel Admin (Next.js — `/painel/super/`)

| Módulo | O que faz |
|--------|-----------|
| **Dashboard** | KPIs (mercados ativos, consumidores, ofertas ativas), economia total, benchmarks de preço |
| **Engajamento** | Tabelas de engajamento por produto, por loja, por usuário, geo-hotzones, tendência diária com gráficos |
| **Índice de Preços** | Motor de índice mensal (tipo IPCA), geração automática, admin actions — **embrião do ISA InfoPanel** |
| **Mercados** | Gestão de lojas cadastradas (CRUD, ativação) |
| **Moderação** | Revisão de importações, aprovação/rejeição de ofertas |
| **PDF Sources** | Gestão de fontes de PDF para extração automática de panfletos |
| **Qualidade** | Dashboard de qualidade dos dados |
| **Planos** | Gestão de planos freemium |
| **Usuários** | Gestão de consumidores e lojistas |

### Supabase/Backend

- 47 migrations aplicadas
- Normalização de produtos com `pg_trgm` (threshold 0.55) + tabela `product_synonyms`
- Tabelas: `products`, `promotions`, `stores`, `store_members`, `profiles`, `analytics_events`, `categories`
- RLS (Row Level Security) ativo
- Edge Functions para operações server-side
- RPCs: `product_engagement_summary`, `store_engagement_summary`, `user_engagement_summary`, geo-grouped views

### Modelo Freemium já definido

| Tier | Preço | Para quem |
|------|-------|-----------|
| Grátis | R$0 | Consumidor (10 favoritos, 3 alertas, top 3 resultados) |
| B2C Plus | R$9,90/mês | Consumidor power-user (ilimitado, sem ads, histórico, listas, rotas) |
| B2B Premium | R$299/mês | Lojista (produtos ilimitados, inteligência competitiva, alertas email, 90d histórico) |
| B2B Premium+ | R$799/mês | Lojista multi-loja (push real-time, simulador, recomendações IA) |

---

## 4. Matriz de Gap: InfoPrice vs Poup

| Feature InfoPrice | Equivalente Poup | Gap |
|-------------------|------------------|-----|
| ISA InfoPanel (painel de preços) | `super/indice` + `super/dashboard` | 🟡 Embrião existe, falta: volume de dados, dispersão min/max, sinalização por cor, série temporal longa |
| Análise de Competitividade | `useCompetitive` hook no app lojista | 🟡 Hook existe, falta: índice de competitividade com %, comparação lado-a-lado com concorrentes nomeados |
| IPA (precificação automática) | ❌ Não existe | 🔴 Gap total: motor de cálculo de preço ideal, integração ERP, regras de pricing, previsão de demanda |
| SmartPrice (coleta hardware) | Crowdsource via app consumidor + PDF extraction | 🟢 Abordagem diferente e potencialmente superior — sem custo de hardware/campo |
| Monitoramento PDV | ❌ Não existe | 🟠 Pode ser substituído por crowdsource (fotos de prateleira via consumidores) ou NFC-e |
| PEX (consultoria) | ❌ Não existe | ⚪ Serviço, não produto — pode ser adicionado quando houver base de clientes |
| Módulo de Lojas Concorrentes (IA) | Mapa + ranking de mercados | 🟡 Base geográfica existe, falta: mapeamento automático de concorrência por proximidade/sortimento |
| Parceria Precifica (e-commerce) | ❌ Não existe | 🟠 Futuro — pode ser construído ou parceria similar |
| +2M SKUs, +10B datapoints | ~centenas de SKUs (seed Matão) | 🔴 Gap de escala — é o desafio central da Fase 1 |

---

## 5. Vantagens competitivas do Poup vs InfoPrice

### O que o Poup tem que a InfoPrice NÃO tem:

1. **App consumidor como motor de coleta** — InfoPrice depende de hardware caro (SmartPrice) e pesquisadores de campo. Poup coleta dados via crowdsource gratuito de consumidores (modelo GasBuddy).

2. **Dados de intenção de compra** — Listas de compras, buscas, favoritos = dados extremamente valiosos para marcas CPG (modelo Basket App). InfoPrice só tem dados de preço, não de demanda.

3. **NFC-e como fonte de dados** — O sistema brasileiro obrigatório de nota fiscal eletrônica cria uma fonte que não existe na maioria dos países. Menor Preço Brasil já provou que funciona em escala (40B+ documentos). InfoPrice não usa NFC-e.

4. **Custo de coleta zero** — Consumidores coletam dados de graça (em troca de economia). InfoPrice precisa pagar pesquisadores + hardware.

5. **Dados de preço REAL (transação)** — Via NFC-e, os dados são de compras reais, não preços de etiqueta/terminal. Potencialmente mais valiosos.

6. **Relação direta com consumidor final** — InfoPrice é 100% B2B. Poup tem acesso direto ao consumidor, criando dois lados de um marketplace.

---

## 6. Roadmap: Fase 1 → B2B

### Fase 1 — Lançamento Consumidor (Atual → 3 meses)

**Objetivo:** Adquirir usuários e começar a coletar dados.

Prioridades:
1. **Corrigir busca** — Bug de localização null é bloqueante (migration 038 já existe, precisa ser aplicada/testada)
2. **Reativar auth** — Descomentar AUTH_STASHED, testar fluxo completo
3. **Polir produto detail** — Aplicar mockup v1 (hierarquia corrigida, comparação primeiro)
4. **Lançar em Matão** — Cidade seed, mercados já cadastrados, provar modelo local
5. **Gamificação de contribuição** — Incentivar usuários a confirmar/reportar preços (modelo GasBuddy)
6. **Integração NFC-e** — Permitir usuários escanear QR code da nota fiscal → extração automática de preços

### Fase 1.5 — Índice de Preços (3-6 meses)

**Objetivo:** Gerar credibilidade e visibilidade com dados públicos.

Prioridades:
1. **Motor de índice mensal** — Já tem embrião em `super/indice`, expandir para publicação pública
2. **Página pública SEO** — Índice Poup de Preços (tipo IPCA regional), gera autoridade
3. **Dashboard de qualidade** — Já existe em `super/qualidade`, refinar para garantir confiabilidade

### Fase 2 — Onboarding B2B (6-12 meses)

**Objetivo:** Usar dados coletados para fazer pitch e onboardar supermercados.

Prioridades:
1. **Reativar app lojista** — Descomentar `(business)` routing, polir telas
2. **Dashboard competitivo expandido** — Transformar `useCompetitive` em painel completo tipo ISA InfoPanel
3. **PDF extraction pipeline** — Já tem `pdf-sources` no admin, expandir para ingestão automática de panfletos
4. **Pitch deck com dados reais** — "Temos X mil usuários em Y cidades vendo seus preços Z vezes por mês"

### Fase 3 — IPA Lite (12-24 meses)

**Objetivo:** Oferecer precificação inteligente (versão simplificada do IPA).

Prioridades:
1. **Motor de sugestão de preço** — Com base nos dados coletados, sugerir preço competitivo ao lojista
2. **Alertas de competitividade** — Notificar lojista quando concorrente baixar preço
3. **Integração ERP básica** — Começar com CSV/planilha, evoluir para API
4. **Simulador de margem** — "Se eu baixar o preço para X, qual o impacto na margem vs competitividade?"

---

## 7. Concorrentes diretos no caminho

| Player | Ameaça | Status |
|--------|--------|--------|
| **ClickSuper** | Alta — maior comparador BR, +350K produtos, ambições B2B | Ainda não monetizou B2B, sem background de pricing |
| **Menor Preço Brasil** | Média — dados NFC-e governamentais, gratuito | Não tem ambição B2B, UX pobre, mas valida o modelo |
| **Smarket/Neogrid** | Baixa direta — foca em trade marketing, não pricing consumer | Adquirida por R$17M, valida mercado |
| **InfoPrice** | Referência, não concorrente direto | Abordagem diferente (field research vs crowdsource), público diferente (enterprise vs SMB) |

---

## 8. Métricas-chave para validar Fase 1

| Métrica | Meta Mínima | O que valida |
|---------|-------------|--------------|
| Usuários ativos mensais (Matão) | 500 | Demanda local existe |
| Preços coletados/mês | 10.000 | Modelo de coleta funciona |
| SKUs únicos com preço | 2.000 | Cobertura mínima para utilidade |
| Mercados cadastrados | 15 | Cobertura regional |
| Retention D7 | 30% | App resolve problema real |
| Listas criadas | 200 | Dados de intenção (ativo mais valioso para B2B) |

---

## 9. Conclusão

O Poup já tem uma base técnica surpreendentemente avançada para a jornada B2B — o painel admin com dashboard, engajamento, índice de preços, moderação e qualidade de dados cobre ~40% do que o ISA InfoPanel oferece. O gap principal não é tecnológico, é de **escala de dados**. A estratégia de usar o app consumidor como motor de coleta (ao invés do hardware caro SmartPrice) é sound e tem precedentes comprovados (GasBuddy, Basket App). O background de Lucas no IPA é uma vantagem competitiva única que nenhum outro player no mercado brasileiro de comparação de preços possui.

**Próximo passo concreto:** Corrigir o bug de busca, reativar auth, e lançar em Matão para começar a coletar dados reais.
