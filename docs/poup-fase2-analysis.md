# Poup — Análise Fase 2 (ponto a ponto)

> Documento interno · Julho 2026  
> Premissas: app sem auth, dashboard restrito (Lucas + sócio), dados Cosmos em coleta diária, app ainda não lançado.

---

## Situação atual (pré-lançamento)

### Base de dados

| Métrica | Valor | % do total |
|---------|-------|------------|
| Produtos totais | 25.806 | 100% |
| Com preço (`reference_price`) | 3.608 | 14% |
| Com imagem (`image_url`) | 6.185 | 24% |
| Com marca (`brand`) | 6.632 | 26% |
| Sem nenhum enriquecimento | ~17.000 | ~66% |

### Pipeline de dados ativo

- **Cosmos API** (Bluesoft) — cron diário às 13h UTC via Vercel (`/api/cron/cosmos-daily-sync`)
- 4 tokens com fallback por rate-limit (429)
- Puxa produtos por data (`/products/by_date`), faz upsert por EAN
- Traz: GTIN, descrição, marca, thumbnail, avg_price, categoria GPC
- Mapeamento GPC → categorias Poup via tabela `cosmos_gpc_map` (67 códigos mapeados)
- **Processo lento**: ~100-200 produtos/dia por token, muitos sem preço

### Pipeline de dados secundário

- **PDF extraction** — cron a cada 6h (`/api/cron/process-import`)
- Upload de panfletos de supermercados → extração de ofertas
- Moderação manual via `/painel/super/moderacao`
- Fontes gerenciadas em `/painel/super/pdf-sources`

### Analytics (coleta de dados do app)

- Hook `useAnalytics` grava eventos no Supabase (`analytics_events`)
- Tipos: `search_performed`, `product_detail_viewed`, `list_item_added`, `alert_created`, `map_pin_tapped`, `screen_viewed`
- Inclui `region` (geolocalização) quando disponível
- Sem auth = sem `user_id` → **eventos de analytics NÃO estão sendo gravados** (o hook verifica `if (!userId) return`)
- ⚠️ **Gap crítico**: sem auth, o analytics atual é inoperante. Precisa de alternativa (analytics anônimo ou serviço externo).

### O que já funciona no app (visto nos screenshots)

| Funcionalidade | Status |
|----------------|--------|
| Onboarding (localização + notificações) | ✅ |
| Home (ranking de mercados + ofertas próximas) | ✅ |
| Mapa com markers de mercados | ✅ |
| Busca com categorias + populares | ⚠️ Busca quebrada (bug localização null) |
| Lista de compras (estado vazio + sugeridas) | ✅ |
| Alertas (estado vazio + sugestões) | ✅ |
| Conta (economia, upsell Plus, preferências) | ✅ |
| App lojista `(business)` | ⛔ Routing comentado (AUTH_STASHED) |

### Dashboard admin (só Lucas + sócio)

| Módulo | O que mostra |
|--------|-------------|
| Dashboard (`super/dashboard`) | KPIs: mercados ativos, consumidores, ofertas ativas, economia total, benchmarks |
| Engajamento (`super/engajamento`) | Tabelas por produto/loja/usuário, geo-hotzones, tendência diária |
| Índice de preços (`super/indice`) | Motor de índice mensal tipo IPCA, geração automática |
| Mercados (`super/mercados`) | CRUD de lojas cadastradas |
| Moderação (`super/moderacao`) | Revisão de importações PDF |
| PDF Sources (`super/pdf-sources`) | Gestão de fontes de panfletos |
| Qualidade (`super/qualidade`) | Dashboard de qualidade dos dados |
| Planos (`super/planos`) | Gestão de tiers freemium |
| Usuários (`super/usuarios`) | Gestão de perfis |

---

## Definição de fases

### Fase 1 = Lançamento do app consumidor (o que falta)
O que precisa acontecer ANTES de lançar.

### Fase 2 = Pós-lançamento → construção de valor B2B
O que fazer DEPOIS de lançar para evoluir rumo à oferta tipo InfoPrice.

---

## Fase 2 — Ponto a ponto

### 2.1 Resolver o gap de analytics sem auth

**Problema**: O hook `useAnalytics` retorna sem gravar nada se `userId` é null. Sem auth, isso significa zero dados de comportamento coletados.

**Opções**:

| Opção | Prós | Contras |
|-------|------|---------|
| **A) ID anônimo persistido (recomendada)** | Simples, sem fricção para o usuário, captura tudo | Não identifica usuário individual, dificulta cross-device |
| B) Analytics externo (Amplitude, Mixpanel, PostHog) | Dashboards prontos, funnels, cohorts | Custo, dependência externa, dados fora do Supabase |
| C) Firebase Analytics | Gratuito, robusto, integração React Native | Dados no Google, não no seu Supabase |
| D) Auth opcional leve (magic link / Apple Sign-in) | Dados ricos quando o user opta | Fricção, a maioria não vai logar |

**Recomendação**: Opção A — gerar um UUID no primeiro launch, persistir com `expo-secure-store` (já usado para `hasSeenOnboarding`), e usar esse `anonymous_id` como fallback no `useAnalytics` quando `userId` é null. Custo: ~30 linhas de código. Resultado: 100% dos eventos capturados desde o dia 1.

**Dados que isso desbloqueia para pitch B2B:**
- Quantas buscas por produto X na região Y
- Quais mercados têm mais visualizações de pin no mapa
- Quais produtos são mais adicionados a listas
- Retention por região (mesmo sem identificar quem)

---

### 2.2 Acelerar enriquecimento do catálogo

**Situação**: 25.806 produtos, mas apenas 14% têm preço. Um app de comparação de preços com 86% dos produtos sem preço não entrega valor.

**Ações Fase 2**:

| Ação | Impacto | Esforço |
|------|---------|---------|
| **Priorizar Cosmos por categoria** — focar tokens nos GTINs das categorias mais buscadas (alimentos, bebidas, higiene) em vez de sync genérico por data | Alto — garante que as categorias core tenham preço | Médio — precisa mudar a query do cron |
| **Open Food Facts (OFF) como fallback** — já existe `scripts/enrich-from-off.ts` | Médio — traz imagens e dados nutricionais, raramente preço | Baixo — script já existe |
| **Enrich via scraping de retailers** — já existe `scripts/enrich-images-from-retailers.ts` | Alto — imagens reais dos produtos | Médio — manutenção de seletores CSS |
| **Crowdsource de preços (pós-lançamento)** — usuários confirmam/reportam preços | Muito alto — dados reais, atualizados, geolocalizados | Alto — precisa de UX de contribuição |
| **NFC-e parsing** — usuário escaneia QR da nota fiscal | Muito alto — preço real de transação, todos os itens da compra, loja identificada | Alto — precisa de parser + UX + SEFAZ API |

**Meta mínima para lançamento útil**: 80% dos top 500 produtos (cesta básica + itens mais buscados) com preço e imagem.

---

### 2.3 Expandir de Matão para cidades vizinhas

**Situação**: Mercados seeded são de Matão e região (Savegnago, Tenda Atacado, Jaú Serve, Supermercado Mortari). O mapa mostra stores de Araraquara a São Carlos.

**Estratégia de expansão**:

1. **Círculos concêntricos a partir de Matão** — Araraquara (120K hab), São Carlos (250K hab), Jaú (150K hab), Bauru (380K hab)
2. **Uma cidade por vez** — só expandir quando a anterior tiver cobertura mínima (10+ mercados, 2K+ produtos com preço)
3. **Parceria com mercados regionais primeiro** — redes menores são mais receptivas e mais dependentes de competitividade de preço
4. **Não ir para São Paulo** até ter prova de conceito regional — capital é caro de cobrir e os incumbentes (ClickSuper) já estão lá

---

### 2.4 Pipeline de ingestão de panfletos (PDF → ofertas)

**O que já existe**:
- `/api/cron/process-import` (a cada 6h)
- `/api/extract` + `/api/extract-image` — extração de dados de PDFs
- `/painel/super/pdf-sources` — gestão de fontes
- `/painel/super/moderacao` — revisão e aprovação
- `(business)/importer.tsx` — tela de importação no app lojista

**O que falta para Fase 2**:

| Item | Descrição |
|------|-----------|
| **Auto-discovery de panfletos** | Crawler que busca novos PDFs em sites de supermercados automaticamente (o `/api/crawl` já existe como base) |
| **OCR de panfletos físicos** | Usuários fotografam panfletos → extração via Vision AI |
| **Matching automático aprimorado** | O `product-match.ts` já existe, mas precisa: matching por GTIN (mais preciso) + fallback fuzzy pg_trgm |
| **Pipeline de confiança** | Score de confiança por fonte (Cosmos > panfleto digital > panfleto foto > crowdsource) |
| **Deduplicação robusta** | Migration 033 (`product_dedup`) existe, mas precisa tratar variações regionais |

---

### 2.5 Índice de preços Poup (ISA InfoPanel lite)

**O que já existe**: `super/indice` com geração de índice, visualização por mês, admin actions.

**Fase 2 — evoluir para produto público**:

| Item | O que é | Para quê |
|------|---------|----------|
| **Página pública SEO** | `poup.com.br/indice` com gráficos de tendência de preço por cidade/categoria | Autoridade de marca, tráfego orgânico, PR |
| **Índice Poup de Cesta Básica** | Preço médio da cesta básica na região, atualizado semanalmente | Comparação com DIEESE/PROCON, gera mídia |
| **API pública (limitada)** | Endpoint aberto com dados agregados (sem preços individuais) | Atrai desenvolvedores, jornalistas, pesquisadores |
| **Newsletter semanal** | "Os preços da semana em [cidade]" com tendências | Engajamento, lista de email para pitch B2B |
| **Widget embeddable** | iFrame do ranking de mercados para blogs/portais locais | Distribuição sem custo de aquisição |

---

### 2.6 Construir pitch B2B com dados reais

**A partir de quando**: Quando tiver 500+ MAU e 10K+ eventos de analytics.

**Dados para o pitch (já coletáveis com analytics anônimo)**:

| Dado | O que vende | Para quem |
|------|-------------|-----------|
| "X buscas por [produto] na [cidade]/mês" | Demanda real medida | Marcas CPG (Nestlé, Unilever, P&G) |
| "Mercado Y tem Z visualizações/mês vs concorrente W" | Share of attention | Supermercados (dono/gerente) |
| "Categoria [bebidas] cresceu N% em interesse" | Tendência de categoria | Distribuidores regionais |
| "N usuários adicionaram [produto] a listas" | Intenção de compra confirmada | Marcas CPG |
| "Mapa de calor: região X busca mais [produto]" | Geodemanda | Supermercados planejando expansão |

**Formato do pitch**:
1. Relatório PDF mensal automatizado (já tem `/super/dashboard` como base)
2. Demo ao vivo do dashboard (com dados reais)
3. Trial gratuito de 30 dias do dashboard para o supermercado

---

### 2.7 App lojista (reativar `(business)`)

**Status atual**: Código existe e funciona, mas routing está comentado (AUTH_STASHED).

**Fase 2 — quando reativar**: Após primeiro supermercado demonstrar interesse no pitch B2B.

**O que já está pronto no código**:
- `(business)/index.tsx` — Dashboard com KPIs (ofertas ativas, views, clicks, usuários, análise competitiva)
- `(business)/offers.tsx` — CRUD de promoções
- `(business)/importer.tsx` — Importação de ofertas
- `(business)/profile.tsx` — Perfil da loja
- `useCompetitive` hook — análise de competitividade (posicionamento vs concorrentes)

**O que adicionar**:
- Auth por convite (email do lojista → magic link) — sem self-service
- Dashboard simplificado: "Quantas pessoas viram sua loja esta semana" + "Como você está vs concorrentes"
- Alertas: "Concorrente X baixou o preço de [produto] para R$Y"

---

### 2.8 Monetização Fase 2

**NÃO monetizar o consumidor ainda.** O valor está nos dados, não na assinatura B2C.

| Receita | Modelo | Quando |
|---------|--------|--------|
| Supermercado Premium | R$299/mês por dashboard de engajamento + competitividade | Após pitch com dados reais (6-12 meses pós-lançamento) |
| Destaque patrocinado | Mercado paga para aparecer em destaque no ranking/mapa | Quando tiver 1K+ MAU (credibilidade) |
| Dados para CPGs | Relatório de intenção de compra por categoria/região | Quando tiver 5K+ MAU e 50K+ eventos |
| Poup Plus (B2C) | R$9,90/mês para consumidor power-user | Só quando o app grátis já for indispensável |

---

### 2.9 Competitividade de dados: Cosmos vs NFC-e vs Crowdsource

| Fonte | Cobertura | Frescor | Custo | Esforço |
|-------|-----------|---------|-------|---------|
| **Cosmos (atual)** | Nacional, +25K GTINs | avg_price (histórico, não tempo real) | 4 tokens, rate-limited | Baixo (já funciona) |
| **PDF de panfletos** | Regional, ofertas ativas | Semanal (quando panfleto é publicado) | Grátis (público) | Médio (extração + moderação) |
| **Crowdsource (futuro)** | Hiperlocal, preço real na gôndola | Tempo real | Grátis (usuário contribui) | Alto (UX + gamificação + validação) |
| **NFC-e (futuro)** | Nacional, preço de transação real | Tempo real (pós-compra) | Grátis (público via SEFAZ) | Alto (parser + integração SEFAZ) |

**Recomendação Fase 2**: Manter Cosmos como backbone de catálogo (produtos, imagens, marcas). Adicionar panfletos para preços regionais reais. Priorizar NFC-e como diferencial de longo prazo — é o moat que a InfoPrice não tem e que o ClickSuper não usa.

---

### 2.10 Checklist de Fase 2 por prioridade

#### P0 — Bloqueia tudo (fazer ANTES de lançar)
- [ ] Fix busca (bug localização null — migration 038)
- [ ] Analytics anônimo (anonymous_id no useAnalytics)
- [ ] Top 500 produtos com preço + imagem

#### P1 — Primeiros 30 dias pós-lançamento
- [ ] Monitorar analytics: quais telas, quais buscas, quais mercados
- [ ] Auto-discovery de panfletos (expandir crawler)
- [ ] Índice de cesta básica Matão (publicação semanal)

#### P2 — 30-90 dias pós-lançamento
- [ ] Expandir para Araraquara + São Carlos
- [ ] Página pública do índice (SEO)
- [ ] Primeiro pitch B2B com dados reais
- [ ] Crowdsource v1 (confirmar preço com tap)

#### P3 — 90-180 dias pós-lançamento
- [ ] Reativar app lojista com auth por convite
- [ ] Dashboard B2B simplificado
- [ ] Integração NFC-e v1 (scan QR da nota)
- [ ] Newsletter semanal automatizada

#### P4 — 180+ dias pós-lançamento
- [ ] Monetização B2B (primeiro cliente pagante)
- [ ] API pública limitada
- [ ] Dados para CPGs (primeiro relatório)
- [ ] Motor de sugestão de preço (IPA Lite)

---

## Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Cosmos rate-limit impede crescimento do catálogo | Alta | Médio | Diversificar fontes (OFF, panfletos, NFC-e) |
| Busca quebrada impacta retention D1 | Alta | Crítico | P0 — fix obrigatório antes de lançar |
| Sem analytics = lançar às cegas | Alta | Crítico | P0 — implementar anonymous_id |
| ClickSuper lança B2B antes | Média | Alto | Velocidade de execução + vantagem de conhecimento IPA |
| Mercados não se interessam pelo pitch | Média | Alto | Começar com mercados pequenos/regionais, não redes nacionais |
| Dados insuficientes para ser útil | Média | Crítico | Focar em cobertura profunda de 1 cidade antes de expandir |

---

## Conclusão

A Fase 2 do Poup não é sobre construir mais features — é sobre **coletar dados suficientes para provar o modelo**. O app consumidor é o veículo de coleta, não o produto final. Cada busca, cada visualização de mapa, cada lista criada é um ponto de dados que alimenta o pitch B2B.

Os 3 bloqueios que precisam ser resolvidos antes de lançar (P0): fix da busca, analytics anônimo, e massa crítica de produtos com preço. Todo o resto pode ser iterado pós-lançamento.

O diferencial de longo prazo é claro: crowdsource + NFC-e > SmartPrice + pesquisadores de campo. Mais barato, mais fresco, mais escalável. E nenhum concorrente brasileiro está fazendo isso ainda.
