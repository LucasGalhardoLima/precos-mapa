# Viabilidade de scraping por site próprio — supermercados de Matão/SP

> **Rodada 1** — 2026-09-01, 3 agentes de pesquisa em paralelo (WebSearch + WebFetch + robots.txt, **sem navegador**, sem coleta de dados reais). Objetivo original: identificar quais dos supermercados ativos de Matão têm um catálogo de produtos com preço real por loja, como alternativa ao catálogo genérico do Cosmos (Bluesoft) — que só traz preço médio nacional, não preço por loja.
>
> **Rodada 2** — mesmo dia, 7 agentes em paralelo com **Chrome real (extensão) + Playwright**, revalidando cada loja ao vivo. Resultado: **4 vereditos da rodada 1 foram revertidos** (Tenda, Jaú Serve e Amarelinha ganharam preço-por-loja real; Amarelinha também passou de ❌ pra ✅). Até uma checagem intermediária minha via `curl` puro entre as duas rodadas — que corrigiu a rodada 1 pro Savegnago dizendo "não tem preço por loja" — também estava errada, e foi corrigida de novo na rodada 2. O padrão que se repete: **fetch estático (curl/WebFetch) sem simular o fluxo real de seleção de loja subestima sistematicamente a granularidade de preço** — 3 dos 4 sites com catálogo (Savegnago, Tenda, Jaú Serve) só mostram preço por loja quando a sessão carrega o cookie/carrinho certo, e a Amarelinha só revela a cidade Matão depois de JS rodar.

## Resumo

| Loja / rede | Veredito | Ponto chave |
|---|---|---|
| **Savegnago Matão** | ✅ Escrapeável, preço **real por loja** | VTEX. Diferenciação por **Regions/seller** (não salesChannel) — cada loja física é um seller VTEX distinto. Confirmado: mesma Coca-Cola 2L, R$10,49 (Matão) vs R$11,45 (Americana) |
| **Tenda Atacado - Matão** | ✅ Escrapeável, preço **real por filial** | Reverte doc anterior. Preço só muda com um `cartID` de sessão real (obtido via fluxo completo de seleção de loja) — o cookie `branchID` sozinho é cosmético. 5/6 produtos testados com preço diferente entre Matão e SP capital |
| **Jaú Serve** | ✅ Escrapeável, preço **real por loja (parcial)** | Reverte doc anterior. Selecionando a loja via `Delivery-SetPickupStore`, ~10% dos SKUs testados têm valor diferente e ~30% desaparecem do price book da loja (`isInAPriceBook:false`) — a UI mostra "Em estoque" mesmo quando não vendável ali |
| **Amarelinha (5 lojas)** | ✅ Escrapeável | Reverte doc anterior. `online.grupoamarelinha.com.br` **atende Matão** (loja 17) — só não aparecia porque as opções do seletor de cidade são renderizadas via JS, invisíveis a fetch estático |
| **Milla's Supermercado** | 🟡 Fora do ar hoje, recandidatar depois | Loja WooCommerce real e grande (37+ sitemaps de produto, 1000+ URLs cada) confirmada via Wayback Machine, funcionando até 13/12/2025. Hoje em manutenção real (não bot-block) — migrando de `supermillas.com.br` pra `millas.com.br` |
| **Supermercado Mortari** | ❌ Não escrapeável | Confirmado ao vivo. Site só institucional + PDF de ofertas. Portal "Cliente Preferencial" é clube de fidelidade do consumidor (não ERP de fornecedor como se pensava) — mas mesmo assim não é catálogo de produtos |
| **Supermercado Paulista** | ❌ Não escrapeável | Confirmado ao vivo — site estático parado desde 2021 (sitemap com 5 URLs só). Instagram/Facebook postam flyers de oferta 2x/semana (mais frescos que o PDF, mas ainda exigem OCR) |
| **Supermercado Simoni** | ❌ Não escrapeável | Confirmado ao vivo. App existiu em 2021 (vídeo promocional no Facebook) mas não é localizável hoje em nenhuma loja de apps; o único app atual divulgado é de cartão fidelidade ("Siga Cred"), não catálogo |
| **Supermercado São Lucas** | ❌ Não escrapeável | Confirmado ao vivo. 3 lojas físicas, atendimento só via WhatsApp (`wa.me/...`, achado via Linktree) — sem catálogo web |

**Placar atualizado: 4 escrapeáveis com preço real por loja hoje (Savegnago, Tenda, Jaú Serve, Amarelinha), 1 candidata a recheck (Milla's), 4 sem catálogo algum.**

Rappi não cobre Matão (confirmado pela própria plataforma testando com endereços reais de várias lojas da cidade) — não é canal viável pra nenhuma loja daqui.

---

## Detalhe por loja

### Savegnago Matão — ✅ Escrapeável, preço real por loja

- Plataforma VTEX (account `savegnagoio`), catálogo com **15.179 produtos** (header `resources: 0-49/15179` da API).
- **Mecanismo de diferenciação por loja: VTEX Regions, não salesChannel.** Cada loja física é um **seller** distinto (ex. `savegnagoiomatao24`, `savegnagoioamericana57`). Um CEP resolve pra um seller via:
  ```
  GET /api/checkout/pub/regions?country=BRA&postalCode=<CEP da loja>&sc=1
  → [{"id": "v2....", "sellers": [{"id": "savegnagoiomatao24", ...}]}]
  ```
  Esse `regionId` vira parte do cookie `vtex_segment` (JSON base64: `{..., "regionId": "<base64 de SW#seller>", ...}`), e requests subsequentes em `/api/catalog_system/pub/products/search` já vêm com o preço daquele seller.
- **Confirmado ao vivo com preço realmente diferente**: Coca-Cola 2L R$10,49 (Matão) vs R$11,45 (Americana), reproduzido depois com `curl` puro (zero browser) só trocando o cookie.
- `/matao`, `/franca`, `/araraquara` etc. são landing pages de merchandising (productClusters tipo "Cidade Sumaré") — não é daí que vem a diferenciação de preço, é do cookie de região.
- Dados por produto: EAN real (~62% populado numa amostra de 50), nome, marca, árvore de categorias, imagens, `Price`/`ListPrice`/`AvailableQuantity`/`IsAvailable` por seller.
- **Paginação**: a API trava em 2500 resultados totais (`_from`/`_to`), inclusive na GraphQL Search mais nova — é limite do backend de busca VTEX, não da API legada. Precisa paginar por categoria (`fq=C:/<id>/`) pra cobrir os 15k produtos.
- Testado e descartado: `/api/io/_v2/api/catalog_system/pub/products/search` (404, não é rota válida nessa conta); `_v/segment/graphql/v1` funciona mas é mais frágil (precisa de `sha256Hash` de persisted query) sem ganho de paginação — ficar na API REST legada + cookie de região.
- robots.txt permissivo pra `/api/`.

**Receita de extração**: resolver CEP→seller via `/api/checkout/pub/regions`, montar cookie `vtex_segment`, paginar `/api/catalog_system/pub/products/search` por categoria com esse cookie.

### Tenda Atacado - Matão — ✅ Escrapeável, preço real por filial

- Next.js (não é VTEX apesar do cookie `vtex_session_id` — coincidência de nome).
- **Preço muda por filial de verdade** (reverte a validação anterior, que só setava o cookie `branchID` sem completar o fluxo real). 5 de 6 produtos testados tiveram valor diferente entre Matão e São Paulo capital, estável em repetição e com 2 carrinhos Matão independentes reproduzindo o mesmo preço.
- **Causa raiz**: quem determina o preço é o cookie `_Tendaatacado-cartID` (carrinho server-side criado só ao completar o fluxo de seleção de loja), não `_Tendaatacado-branchID` (que é só espelho de UI, cosmético sozinho).
- **Melhor fonte de dado, achada nesta rodada**: endpoint de listagem por categoria, muito mais rico que abrir produto por produto:
  ```
  GET api.tendaatacado.com.br/api/public/store/category/{id}/products?query[link]={slug}&page={n}&cartId={cart_id_matao}
  ```
  Cada item já vem com `barcode` (EAN real, validado por checksum+prefixo GS1 em amostra de 13/13), `price` (já correto pra filial do `cartId`), `inventory` por filial, `brand`, `sku`, `thumbnail`, `promotions`. Mesmo endpoint aceita busca full-text em `/api/public/store/search?query=...&cartId=...`.
  - **Corrige o script atual e a nota antiga "Tenda não expõe EAN"** — isso só é verdade pro payload `__NEXT_DATA__` da página de produto individual; o endpoint de listagem tem EAN real (`barcode`).
- **16 departamentos de topo cobrem o catálogo inteiro** (subcategorias já vêm agregadas no pai) → ~1.526 requests paginados no total, contra ~7.653 requests individuais do script atual — precisa deduplicar por `sku`/`barcode` (departamentos se sobrepõem).
- Estoque (`inventory[]`, todas as ~45 filiais) vem completo independente da sessão — não é gateado por filial, só o preço é.
- Heurístico "nome da foto = EAN" testado em amostra maior (25 produtos): só 12% batem EAN-13 válido com prefixo GS1 Brasil — **descartado**, o campo `barcode` do endpoint de listagem resolve isso de forma confiável.

**Receita de extração**: completar o fluxo real de seleção de loja (CEP → Clique & Retire → Matão) uma vez pra obter `cartId` válido, paginar os 16 departamentos via `category/{id}/products?cartId=...`, deduplicar por `barcode`.

### Jaú Serve — ✅ Escrapeável, preço real por loja (parcial)

- Salesforce Commerce Cloud (site `Sites-JauServe-Site`).
- **Preço/disponibilidade variam por loja de verdade** (reverte a validação anterior de 12 SKUs, que não tinha amostra suficiente pra pegar o efeito real). Testado com 20 SKUs, 3 sessões (nenhuma loja / Matão / Avaré):
  - 12/20 (60%) preço idêntico
  - 2/20 (10%) preço genuinamente diferente (ex. cerveja R$5,69 default vs R$5,79 em Matão)
  - 6/20 (30%) **somem do price book da loja** (`isInAPriceBook:false`, `price.sales.value:null`) — a UI mostra botão de compra desabilitado, mas os campos `availability.messages`/`available` continuam dizendo "Em estoque"/`true` (não confiar nesses campos pra saber disponibilidade real por loja).
- **Mecanismo**: `GET .../Delivery-SetPickupStore?postcode=<CEP>` seta cookies `dw_storeid`/`dw_shippostalcode` (não-httpOnly, replicável sem browser); a partir daí `Product-Variation?pid={id}&format=ajax` reflete a loja.
- **Correção importante ao script atual**: nem toda URL/pid de produto é EAN de verdade. A maioria (mercearia embalada, bebidas) sim, mas hortifrúti/padaria usam SKU interno curto (3-4 dígitos, ex. `/7116.html`) que a própria página rotula erroneamente como "EAN: 7116" — o regex atual (`/EAN:\s*(\d+)/`) captura isso como EAN válido. Vale validar 13 dígitos antes de gravar em `products.ean`.
- Sem OCAPI pública utilizável: o módulo Shop API existe (`GET /s/.../dw/shop/v23_2/products/{id}` → `400 MissingClientIdException`, não 404), mas não há `client_id` público registrado (testado client_id de demo conhecido → `401`). Sem ganho sobre os endpoints AJAX do storefront.
- Achado lateral: `Stores-Cities` e `Stores-FindStoresByCity?city=X` são JSON limpos com a lista de cidades/lojas atendidas — útil pra montar a lista dinamicamente em vez de hardcode.
- robots.txt continua 404 (sem restrição declarada).

**Receita de extração**: `Delivery-SetPickupStore?postcode=<CEP Matão>` uma vez pra pegar cookies de sessão, chamar `Product-Variation?pid=X&format=ajax` por produto usando `isInAPriceBook`/`price.sales.value` (não `available`) como sinal de disponibilidade real, validar que `pid` tem 13 dígitos antes de tratar como EAN.

### Amarelinha Supermercados (5 lojas em Matão) — ✅ Escrapeável

- **Reverte completamente o veredito anterior.** `online.grupoamarelinha.com.br` (OpenCart) **atende Matão** — loja 17 (Rua São Lourenço, 395, Centro — bate com o cadastro oficial `grupoamarelinha.com.br/nossas_lojas/loja-17/`).
- **Causa da conclusão errada anterior**: as `<option>` do seletor de cidade/loja só existem no DOM depois do JS rodar — no HTML estático (o que WebFetch vê) elas simplesmente não existem. Não foi erro de leitura, foi limitação de ferramenta.
- Confirmado ao vivo: selecionar loja 17 → "Você está na loja: 17 - Matão - SP" → navegação real por categoria (`route=product/category&path=10006`) → produtos reais com preço em R$.
- URLs de categoria são padrão OpenCart clássico, enumerável e paginável (`index.php?route=product/category&path=X`).
- Nota: a lista de lojas obtida via JS mostrou só 4 lojas em Matão (15, 16, 17, 21), não as 5 mencionadas — vale confirmar antes de assumir cobertura completa das lojas físicas.
- Nenhum canal alternativo (WhatsApp — é link de chat, não catálogo; iFood/Rappi — zero resultados) acrescenta dado além do site.

**Receita de extração**: forçar o contexto de loja 17 (via sessão/cookie do OpenCart — provavelmente precisa completar o fluxo de seleção como nos outros sites, ou existe param de URL — vale checar antes de escrever o scraper) e paginar as categorias.

### Milla's Supermercado (Laranjeiras) — 🟡 Fora do ar hoje, recandidatar depois

- Confirmado ao vivo (Chrome real, 5 URLs diferentes) que tanto `supermillas.com.br` quanto o domínio novo `millas.com.br` retornam **503 "em manutenção" de verdade** — não é bot-block (mesmo corpo em `robots.txt`, sem CAPTCHA/challenge JS, header `Retry-After` correto).
- A empresa está migrando de host (HostGator → Hostinger) e pede pros clientes comprarem presencialmente enquanto isso — **hoje não há loja virtual funcional em nenhum dos dois domínios**.
- **Mas a loja existiu e era grande**: via Wayback Machine (CDX API), confirmado WordPress + WooCommerce 9.8.4, 37+ arquivos de sitemap de produto (~1000 URLs cada, então bem acima de 2.000 produtos), REST API `wp-json/wp/v2/product/{id}` respondendo publicamente, homepage funcionando com HTTP 200 até 13/12/2025.
- **Ação recomendada**: recheck periódico de `millas.com.br` — quando voltar, WooCommerce normalmente expõe um Store API público (`/wp-json/wc/store/v1/products`), bom candidato a scraping simples assim que a migração terminar.

### Supermercado Mortari — ❌ Não escrapeável

- Confirmado ao vivo: site (`supermercadomortari.com.br`) só institucional (Home/Institucional/Ofertas-PDF/Setores/Receitas/Contato), rotas `/loja/`, `/catalogo/`, `/produtos/` testadas → 404.
- **Correção**: o portal "Cliente Preferencial" (`189.50.252.172:9090`, sistema VR Software) **não é ERP de fornecedor** como se pensava — é um clube de fidelidade pro consumidor final (cadastro de CPF/pontos). O sistema de fornecedor de verdade é outro, separado (`:34000/php/vrcotacao/`, "VR Cotação"). Nenhum dos dois é catálogo de produtos com preço.
- Novidade: telefone dedicado pra "Pedidos/Entrega de Compras" — canal de pedido por telefone, sem lista de preços navegável.
- Sem Facebook Shop, sem WhatsApp catalog, zero resultados no iFood, Rappi não cobre Matão.

### Supermercado Paulista — ❌ Não escrapeável

- Confirmado ao vivo via sitemap.xml: só 5 URLs indexadas (`/`, `/sobre`, `/contato`, `/blog`, 1 post de 2020), última modificação 2021-07-01 — site estático abandonado.
- Armadilha de homônimo ("Meu Paulista"/`@paulistasupermercados`, rede de São Joaquim da Barra/Botucatu) recheckada e descartada corretamente — perfis reais são `facebook.com/superpaulistamatao` e `@paulistasupermercadomatao`, endereço bate.
- **Achado novo**: Facebook e Instagram publicam flyers de oferta com preço real 2x/semana, mais frescos que o PDF de tabloide atual — mas ainda é imagem, exige o mesmo tratamento de OCR já usado no pipeline. Bio linka só pra WhatsApp de chat direto (não catálogo).
- Zero resultados no iFood, Rappi não cobre Matão.

### Supermercado Simoni — ❌ Não escrapeável

- Confirmado ao vivo: sem Facebook Shop, sem WhatsApp catalog, zero no iFood, Rappi não cobre Matão.
- **App mencionado no Facebook**: localizado o post original (09/04/2021, vídeo mostrando instalação via Play Store) — mas o app **não é localizável hoje** em nenhuma das duas app stores (Play Store e App Store, busca direta), indicando descontinuação. Um comentário no post (21 semanas depois) pergunta "como comprar online" sem resposta da loja, sugerindo que mesmo em 2021 não tinha fluxo de compra funcional.
- O único app atualmente divulgado pela loja é "Siga Cred" — gestão de cartão fidelidade/crédito, não catálogo de produtos.

### Supermercado São Lucas — ❌ Não escrapeável

- Domínio próprio (`supermercadossaolucas.com.br`) confirmado ainda "em construção" ao vivo.
- Armadilha de homônimo (grupo de Garibaldi/Carlos Barbosa-RS) recheckada e descartada — perfil real é `facebook.com/supermercadosaolucasmatao`.
- **Achado novo**: via Linktree (`linktr.ee/saolucasmatao`, criado maio/2026) confirma **3 lojas físicas**, atendimento só via WhatsApp (`wa.me/16997843916` pra ofertas, `wa.me/551633825332` fixo — atende as 3 lojas). Sem catálogo web navegável, sem Facebook Shop.
- Zero no iFood, Rappi não cobre Matão.

---

## Nota operacional: Chrome compartilhado entre os 7 agentes da rodada 2

Vários agentes reportaram abas "sequestradas" pra sites de outras lojas do próprio doc (inclusive um relato de redirecionamento pra um IP cru achado suspeito). Cruzando os 7 relatórios: **é contaminação de abas por concorrência, não malware** — os 7 agentes rodaram em paralelo usando a mesma sessão real do Chrome (mesma extensão/perfil), e cada um viu ocasionalmente a navegação do outro. Confirmado diretamente: o IP "suspeito" que o agente do Savegnago viu (`189.50.252.172:9090`) é exatamente o portal "Cliente Preferencial" que o agente do Mortari estava investigando legitimamente no mesmo horário. Não há indício de extensão comprometida — mas fica registrado: **não rodar múltiplos agentes de browser em paralelo contra o mesmo perfil real do Chrome sem isolamento de aba/contexto** (Playwright com contexto isolado por agente, como vários já migraram pra fazer nesta rodada, evita o problema).

---

## Recomendação

1. **Savegnago, Tenda Atacado, Jaú Serve e Amarelinha são todos escrapeáveis com preço real por loja hoje** — prioridade de implementação sugerida pelo retorno/esforço:
   - **Tenda**: reescrever `scripts/scrape-tenda-atacado-prices.ts` pra usar o endpoint de listagem por categoria com `cartId` (~1.526 requests, EAN real via `barcode`, preço já correto) — maior ganho de qualidade de dado com menor esforço, substitui completamente a abordagem atual de regex+sitemap.
   - **Jaú Serve**: ajustar `scripts/scrape-jauserve-prices.ts` pra usar `Delivery-SetPickupStore` + `isInAPriceBook` como sinal de disponibilidade real (não `available`), e validar EAN por dígito antes de gravar.
   - **Savegnago**: escrever scraper novo usando a API de catálogo + cookie `vtex_segment` resolvido via `/api/checkout/pub/regions`, paginado por categoria.
   - **Amarelinha**: escrever scraper novo pro OpenCart, loja 17 — precisa primeiro confirmar como forçar o contexto de loja via request direta (sessão vs. param de URL) antes de implementar.
2. **Milla's**: sem ação agora — recheck periódico de `millas.com.br` (ex. mensal) até a migração terminar; quando voltar, checar o WooCommerce Store API primeiro.
3. **Mortari, Paulista, Simoni, São Lucas**: continuam sem catálogo público — pipeline atual de PDF/imagem + Cosmos como fallback de metadados continua sendo a única fonte pra essas 4. Os flyers do Instagram/Facebook do Paulista são um upgrade de frescor sobre o PDF, mas exigem o mesmo OCR.
