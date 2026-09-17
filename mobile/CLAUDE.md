# Poup Mobile — MLP

Leia este arquivo inteiro antes de tocar em qualquer coisa em `mobile/`. Ele é curto de propósito: aponta para as fontes de verdade em vez de repeti-las.

## O que estamos construindo

O Poup responde uma pergunta: **onde este produto está mais barato hoje, nos 4 mercados de Matão?** Só isso. Preços vêm de scrapers que rodam todo dia às 03:00. Não há login, paywall, mapa, lista, ofertas, histórico ou veredito de "bom/caro" — tudo isso saiu do MLP.

Princípio que decide qualquer dúvida de UI: **nada de informação não solicitada.** Se o usuário não pediu, não aparece.

## Fontes de verdade (nesta ordem)

1. **Doc de decisões** — `docs/poup-mlp-decisoes.md`. Regras de negócio, cada tela estado por estado, o que está fora do MLP. Quando qualquer outra fonte divergir, este doc manda.
2. **Design system + telas em alta fidelidade** — artefato Claude Design: https://claude.ai/artifact/2iTFp1CFYKN3kVAtMr6p8C. Tokens, tipografia, componentes, e cada tela em cada estado, com anotações.
3. **Protótipo navegável** — https://claude.ai/artifact/18XMrjtmCkZ1ruscwXT9YW. Fluxo e transições. Use para entender navegação, não para copiar pixels.

Não existe uma quarta fonte. Não invente tela, estado, texto, cor ou componente que não esteja nessas três. Se faltar algo, pare e pergunte.

## Estrutura

```
mobile/
  app/            # rotas novas (Expo Router). Só as listadas abaixo.
  components/     # componentes novos, um por arquivo, do design system Capital Verde
  hooks/          # hooks de dados reaproveitados (lista abaixo)
  lib/            # supabase, posthog, cache — reaproveitados como estão
  legacy/         # app e componentes antigos. SOMENTE LEITURA. Nunca importar daqui.
```

`packages/shared/`, `supabase/` e `scripts/` não são tocados por trabalho de UI.

### Rotas (e nada além delas)

| Rota | Tela | Estados (ver doc) |
|---|---|---|
| `app/onboarding.tsx` | Onboarding | passo 1 localização, passo 2 itens, fora de Matão |
| `app/index.tsx` | Raiz (Hoje + Busca) | com itens, dia zero; **Resultado** é estado desta tela, substitui abaixo do cabeçalho |
| `app/product/[id].tsx` | Resposta | com EAN, "aqui" vence, sem EAN, sem preço hoje, loja defasada |
| `app/scan.tsx` | Scanner | leitura, sem câmera, EAN fora do catálogo |
| `app/settings.tsx` | Ajustes | com itens, vazio, notificação bloqueada |

Sem barra de abas. Navegação é raiz + telas empilhadas + Ajustes por ícone.

### Hooks reaproveitados

Renomeados para o vocabulário do MLP. Os antigos ficam em `legacy/hooks/` como referência.

| Novo nome | Origem em legacy | Uso no MLP |
|---|---|---|
| `use-search.ts` | `use-search.ts` | Resultado (RPC `search_products_with_prices`) |
| `use-location.ts` | `use-location.ts` | "você está aqui" = mercado mais perto |
| `use-stores.ts` | `use-stores.ts` | os 4 mercados, distâncias, folha "trocar" |
| `use-tracked-items.ts` | `use-favorites.ts` + `use-alerts.ts` | "acompanhar este item" + alerta de preço (um conceito só) |
| `use-push-notifications.ts` | `use-push-notifications.ts` | permissão pedida no primeiro "acompanhar" |
| `use-analytics.ts` | `use-analytics.ts` | instrumentação total (decisão 15) |
| `use-cities.ts` | `use-cities.ts` | "digitar minha cidade" no onboarding |
| `use-haptics.ts` | `use-haptics.ts` | vibração na leitura do scanner |

Não existe "favorito", "alerta" separado de item, "lista" ou "oferta" no vocabulário. Se um hook antigo usa esses nomes por dentro, adapte a interface pública; não vaze o termo para a UI.

Scanner usa `react-native-vision-camera` (já instalado). Câmera é pedida no primeiro toque em "Escanear", nunca no onboarding.

## Regras duras

Estas não são preferências. Uma PR que quebra qualquer uma volta.

- **Cores**: só os tokens do design system. Verde tem exatamente três usos: marca, vencedor de bloco, toque com chevron. Vermelho só em erro de bloqueio. Ausência é cinza, nunca vermelho nem âmbar.
- **Tipografia**: Manrope, números tabulares. Nada abaixo de 13 px.
- **Chevron** só em linha tocável. Fato nunca leva chevron. Uma borda colorida por linha.
- **Tetos**: Raiz 4 itens + "ver todos"; Resultado 5 com teclado / 8 sem + "ver mais N"; ONDE até 4 linhas + "ver todos os mercados". A lista rola sob o teclado; o teto é limite de carga, não promessa de caber.
- **Frescor**: última rodada = sem rótulo; 2–3 dias = "há N dias" em cinza dentro do ONDE; >3 dias = fora do ONDE e do contador, só em "ver todos" e na faixa âmbar. Nunca mostrar preço velho como se fosse de hoje.
- **EAN**: comparação entre mercados só com EAN. Sem EAN é fato de um mercado, sem vencedor, sem selo.
- **Todo estado sem lista tem duas saídas**: um botão + um texto. Nenhuma é "voltar". Nenhum botão fica desabilitado esperando o usuário fazer algo opcional.
- **Permissões com contexto**: localização no onboarding, notificação no primeiro "acompanhar", câmera no primeiro "escanear". Nunca todas de uma vez.
- **Instrumentação**: todo evento listado na decisão 15 é emitido via `use-analytics`, anônimo. Tela nova sem eventos não está pronta.
- **Sem `legacy/`**: nenhum import, nenhum copy-paste de componente. Se precisa de algo de lá, reescreva com os tokens novos.
- **Sem estado global novo** sem justificativa no PR. O app é dirigido por dados do servidor; Zustand só se realmente necessário.

## Ordem de construção

Uma etapa por PR. Cada PR de tela inclui screenshot do simulador (iPhone 15, 393×852) lado a lado com a tela correspondente do artefato.

1. `constants/tokens.ts` — cores, tipografia, raios, alvos, a partir do design system.
2. Componentes base — botão (52 px), texto-link, linha de lista (com/sem chevron, com ✕), rótulo de bloco, procedência, faixa âmbar, cartão tracejado de ausência, campo de busca, chip.
3. Onboarding
4. Raiz (com itens, dia zero) + Resultado (lista, vazio, offline)
5. Resposta (todos os estados)
6. Scanner
7. Ajustes

Não pule etapas nem construa duas telas na mesma PR.

## Comandos e definição de pronto

```
npm run typecheck   # tsc --noEmit, strict
npm test            # jest — testes de hooks obrigatórios; testes de tela opcionais
npx expo start      # simulador
```

Pronto = typecheck limpo + testes de hook passando + screenshot conferido contra o artefato + eventos de analytics emitidos + nenhum termo fora do vocabulário do MLP na UI.

## Assets pendentes

- Símbolo do app: usar `assets/poup-mark.svg` (via `react-native-svg`), ~200 px, sem fundo, sem wordmark. O `assets/poup-mark.png` é só referência.
- Logos monocromáticos dos 4 mercados (SVG, 28 px) para o ONDE.
- Foto de produto: no cabeçalho da Resposta e na lista (Raiz e Resultado). Cobertura de `image_url` em 91,7% (cohort ≤14 dias, 17/09), acima do gate de 85%. Sem `image_url`: sem miniatura e sem quadrado cinza — a linha fecha o espaço. Fonte é só o varejista; OpenFoodFacts não entra no MLP.
