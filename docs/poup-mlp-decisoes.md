# POUP — Decisões do MLP (15–16/09/2026)

Base para os esboços e a alta fidelidade no Claude Design e para o CLAUDE.md de lá. Uma decisão por linha; "por quê" só onde muda a leitura.

## Ponto de partida

App atual em React Native, 5 abas (Início, Busca, Mapa, Lista, Alertas), ranking de cesta, ofertas da semana, histórico 30/60/90, paywall. Dados: 4 redes em Matão (Savegnago, Jaú Serve, Tenda, Amarelinha) raspadas diariamente às 03:00 BRT, cobertura por rodada 78–90%, 88,8% dos itens com preço fresco têm EAN. Histórico de preço: zero acumulado até 15/09 (store_prices fazia upsert); passou a ser salvo em append-only.

## Decisões de produto

1. **Sem veredito no lançamento.** Resposta, itens e alerta funcionam só com preço de hoje. Veredito bom/normal/caro acende por item quando cruza 14 dias de dado, com rótulo dizendo a faixa real ("abaixo do normal dos últimos 21 dias") até chegar em 90.
   - Alerta sem histórico: "avisar quando cair abaixo de R$ X", X sugerido = preço de hoje.
   - `price_history` (migration 081) registra só mudança de preço, não uma linha por dia — datas ficam esparsas. "Normal" é a média ponderada pela duração de cada preço (dias que ele valeu), nunca a média simples das linhas gravadas: essa contaria mais os preços que mudam com frequência e menos os que ficam parados, invertendo o que "normal" deveria significar.
2. **Frescor em 3 estados.** Atualizado na última rodada: sem rótulo. 2–3 dias: entra no ONDE com "há N dias" em cinza. Mais de 3 dias: "sem preço hoje", fora do ranking, só em "ver todos os mercados". Loja inteira falhou: faixa âmbar "X: preços de N dias atrás".
3. **Identidade por EAN.** Comparação entre mercados só para produtos com EAN. Sem EAN: um mercado só, nunca casado por nome entre lojas.
4. **Entrada: texto + código de barras.** Foto/reconhecimento de embalagem fora do MLP.
5. **"Você está aqui".** Mercado mais próximo pelo GPS, com um toque para trocar. Sem geofence, sem check-in.
6. **Busca por departamento fora.** Busca resolve só produto. Departamentos existem apenas no onboarding.
7. **Hoje + Busca = uma tela raiz.**
8. **Raiz mostra só os itens do usuário.** Nada de ofertas por categoria. Princípio: nada de informação não solicitada.
9. **Onboarding mínimo.** Localização obrigatória; itens puláveis. Sem login, nome ou tour.
10. **Permissões com contexto.** Localização no onboarding; notificação no primeiro "acompanhar"; câmera no primeiro "escanear".
11. **React Native permanece.** Reescrita nativa só depois que o produto estabilizar.
12. **Sem barra de abas.** Raiz + telas empilhadas + Ajustes por ícone.
13. **MLP gratuito.** Paywall/RevenueCat saem; avaliação em outro momento.
14. **Preço por unidade só onde há tamanho.** size_value/size_unit em products via parser em batch (~60% do catálogo). Sem tamanho, o bloco QUAL TAMANHO some. Restante para passe com LLM depois.
15. **Instrumentação total, 4 métricas de decisão.** Coletar todo evento de uso (busca, scan, Resposta, mercado destacado, acompanhar, alerta, localização aproximada, hora), anônimo e agregado, descrito nos termos (LGPD). Ativo do pitch B2B. Decidir por: buscas que chegam à Resposta; taxa de "sem preço hoje"; retorno na semana seguinte; itens acompanhados por usuário.

## Telas fechadas nos esboços (doc "Poup MLP - Esboços")

**Raiz (2a/2b).** Cabeçalho fixo: campo "buscar produto" + botão "Escanear" com texto, mesmo peso. Abaixo: frase-título ("Hoje o Tenda tem o menor preço em 4 dos seus 6 itens"), procedência, "Seus itens" (teto 4 + "ver todos"), cada linha = item + produto vencedor + mercado + preço. Dia zero: frase-fato ("Preços de hoje nos 4 mercados de Matão · atualizados às 03:00"), sem bloco de itens, sem convite. Ajustes por ícone (engrenagem) em linha própria com a marca. Resultado substitui daqui para baixo; nunca empilha.

**Resultado (5a–5c).** Contador "N produtos · menor preço de hoje". Linha = produto + menor preço + mercado vencedor (sem EAN: "só no X"). Ordem: relevância textual + popularidade, nunca por preço. Teto 5 com teclado / 8 sem; "ver mais N" estende na tela. Sem preço hoje: fim da lista, cinza, "—". Vazio: "nenhum produto com X" + "buscar só [1ª palavra]" + "escanear". Offline: "tentar de novo" + "ajustes de rede". Todo estado sem lista tem duas saídas.

**Resposta (4a–4d).** Título "Menor preço no X: R$ Y"; sem EAN, "Preço de hoje no X: R$ Y" (fato, sem motivo). Subfrase: R$/unidade (se houver) + "R$ Z a menos que no [onde você está]"; sem "aqui" ou se "aqui" vence, compara com o 2º. ONDE: até 4 linhas, cada uma com distância; vencedor em verde "menor preço"; "você está aqui" com borda escura + "trocar ›", ou uma linha verde "◉ você está aqui · menor preço" quando vence; "há N dias" em cinza; "ver todos os mercados ›". "acompanhar este item ›" em texto abaixo do ONDE, sem botão fixo. QUAL TAMANHO: só tamanhos que batem o atual por unidade, com chevron; nenhum → "5 kg é o melhor por kg"; sem tamanho → bloco some. Rodapé: "preços de hoje, 03:00 · N de 4 mercados" (sem "sem tamanho cadastrado"). Loja defasada: faixa âmbar acima do ONDE.

**Scanner (6a–6c).** Câmera cheia, moldura + laser, "Aponte para o código de barras", "Digitar o nome em vez disso". Leitura: vibração + verde ~300 ms → Resposta direto, sem confirmação. Sem histórico de leituras. Permissão pedida aqui, no primeiro toque; negada (agora ou antes) → tela "Sem acesso à câmera" com "Buscar pelo nome" (botão) e "Abrir Ajustes" (texto). EAN desconhecido → cartão sobre a câmera "Não achamos esse produto" + procedência + "Buscar pelo nome" / "Ler outro código". EAN conhecido sem preço hoje → Resposta no estado "sem preço hoje" (não o cartão).

**Ajustes (7a/7b).** Nome "Ajustes", não Perfil. Itens acompanhados (teto 4 + "ver todos"; ✕ remove com desfazer; sem adicionar; toque abre a Resposta do item, onde o valor-alvo se edita). Localização (cidade + mercado mais perto; "trocar" abre folha com os 4). Notificações (um interruptor; negada no sistema → travado + link "Ajustes do aparelho"). Rodapé: sobre · termos. Vazio: texto explica que "acompanhar" fica na Resposta, sem botão.

**Onboarding (8a–8c).** Passo 1 localização (obrigatória, contexto antes do pedido do sistema; negada → "digitar minha cidade", app segue sem "aqui"). Passo 2 itens (pulável por "Buscar agora"): 12 chips genéricos fixos; "escolher tipo" abre folha para fixar produto; botão "Ver preços de hoje · N itens". Fora de Matão: "Ainda não estamos em X" + e-mail opcional (única coleta de contato, com linha de consentimento) + "Ver preços de Matão mesmo assim". Notificação e câmera nunca no onboarding.

**Item genérico vs. item-produto.** Genérico = categoria + tamanho padrão ("arroz · 5 kg"): na raiz mostra o produto vencedor de hoje da categoria/tamanho; toque abre a Resposta desse produto; alerta compara o menor preço da categoria. Fixado um tipo, vira item-produto (EAN) e segue as regras normais.

## Alta fidelidade fechada (16/09) — artefato Claude Design

Artefato: https://claude.ai/artifact/2iTFp1CFYKN3kVAtMr6p8C (design system + Raiz, Resposta, Resultado, Scanner, Ajustes, Onboarding). O que mudou na revisão da alta fidelidade, além do que já estava nos esboços:

**Base visual (Capital Verde).** Manrope, números tabulares. Marca #12A08C; verde-texto e botão preenchido #0E7F6F (contraste); selo #E4F3EF; fundo #F2F5F4; tinta #16201D; secundário #5B6965; ausência #A3AEAA; borda #DCE3E0; âmbar #9A5B00 sobre #FBF1DC; vermelho só para erro de bloqueio. Escala: título 26/700, frase 20/600, preço 22/800, corpo 16/500, apoio 14/500, rótulo 13/700 caps, procedência 13. Nada abaixo de 13 px. Raio 16/20, alvo 44, botão 52, cartão com borda 1,5 px sem sombra. Verde tem três usos: marca, vencedor de bloco, toque com chevron. Fato nunca leva chevron. Uma borda colorida por linha. Superfície escura só no scanner.

**Raiz.** Nome do mercado na frase-título em tinta 800, não verde (frase não é toque).

**Resposta.** Loja com mais de 3 dias sai do ONDE e do contador ("3 de 4"), fica na faixa âmbar e em "ver todos os mercados". "há N dias" na linha é cinza, não âmbar. Sem EAN: linha única sem sublabel; rodapé "preço de hoje, 03:00 · Jaú Serve".

**Resultado.** Nome quebra em 2 linhas, nunca reticências (o tamanho distingue as linhas); altura da linha acompanha. Lista rola sob o teclado; teto 5 é limite de carga, não promessa de caber. Estados sem lista: botão + texto (vazio: "Buscar só X" botão, "Escanear o código" texto).

**Scanner.** EAN completo no cartão "Não achamos esse produto".

**Ajustes.** Linha de item: ✕ à esquerda do nome, chevron na borda direita (convenção de edição do iOS).

**Onboarding.** Botão do passo 2 nunca desabilita: com 0 itens vira "Ver preços de hoje ›" → raiz dia zero (mesmo destino do "Buscar agora"). Ícone de localização em tinta sobre o selo, não verde.

## Camada visual (17/09) — resposta ao "mais bonito" do sócio

O sócio aprovou o protótipo integralmente e pediu só visual. Os mockups que ele mandou como referência trazem features já descartadas (categorias no onboarding, ofertas, lista, semáforo, dicas, histórico) — tratados como tom, não como pedido de função. O que entrou:

**Foto do produto.** No cabeçalho da Resposta e na lista (Raiz/Resultado). Gate de 85% de cobertura de `image_url` entre produtos com preço fresco (≤14 dias) cumprido em 17/09: 91,7% (43,9% → backfill por EAN Savegnago → imagem dos scrapers Amarelinha #44, Savegnago #45, Tenda #47). Sem imagem: sem placeholder, a linha fecha o espaço. OpenFoodFacts fora do MLP.

**Logo do mercado.** Só no ONDE da Resposta e na folha "trocar": 28 px, monocromático em tinta (cinza quando "há N dias"), mesmo tratamento para os 4. Raiz e Resultado seguem só texto. Uso nominativo: uma linha nos termos; conversar com cada rede no B2B.

**Onboarding, passo 1.** Símbolo do app sem o fundo do ícone, recolorido para o sistema (carrinho e letras #0E7F6F, brilho #12A08C, moeda dourada com $ branco), ~200 px, sem wordmark no topo desta tela. Venceu as ilustrações (fachada, cesta) e o ícone com fundo. O dourado é a única cor fora do sistema em todo o app, aceita como marca; não migra para outras telas. SVG em `mobile/assets/poup-mark.svg`.

Nada mais do mockup entrou: sem formas de fundo, gradiente, tagline, "dica", selo ou badge.

## Implementação (23/09) — Resposta

**ONDE agrupa por rede, não por filial.** O app promete "onde este produto está mais barato hoje, nos 4 mercados de Matão" — os 4 mercados são as 4 redes (Savegnago, Jaú Serve, Tenda, Amarelinha), não os endereços físicos (só a Amarelinha tem 5 lojas em Matão). Uma linha por rede: preço = menor preço de hoje entre as filiais daquela rede; distância = a filial mais próxima que tem esse preço. "Você está aqui" é a rede da filial fisicamente mais próxima — independe de frescor: se a filial mais próxima está com preço defasado, "aqui" continua sendo a rede dela, só que a linha sai do ONDE pra faixa âmbar. "ver todos os mercados ›" só aparece quando alguma rede fica de fora do ONDE (defasada); ao tocar, mostra as filiais individuais (não mais redes).

**Folha "Acompanhar" (artefato seção 8).** Modal com puxador no topo e "fechar" à direita (diferente do padrão "‹ voltar" das outras folhas — esta é uma ação isolada, não um passo de fluxo). Rótulo "AVISAR QUANDO CAIR ABAIXO DE" + campo de preço, pré-preenchido com o menor preço de hoje (vazio, com "R$" cinza, quando não há preço hoje). Duas saídas: "Acompanhar e avisar ›" (signInAnonymously se ainda não há sessão → pedido de permissão do sistema → grava com o preço-alvo; permissão negada não bloqueia a gravação, só fica sem push até o usuário conceder depois) e "Acompanhar sem avisos ›" (grava sem alvo, nunca pede permissão). Depois de acompanhar, o texto "acompanhar este item ›" vira duas linhas: "acompanhando · avisar abaixo de R$ X" (ou só "acompanhando", sem alvo) em cinza, e "editar ›" reabrindo a mesma folha pra ajustar.

## Fora do MLP (lista consolidada)

Veredito no lançamento · foto da embalagem · busca por departamento · ofertas por categoria · ranking de mercados por cesta · "quanto poupei" · aba Lista · favoritos · filtros · preço de/por · paywall · encartes/fotos de promoção (só o campo "fonte" no modelo de preço) · semáforo de 4 estados · apps nativos · histórico de leituras · barra de abas.

## Do sócio (15/09) — o que entrou

Posicionamento "autoridade de preços da região" (tom dos textos, não feature). Motivo em percentual ("25% abaixo do normal dos últimos 90 dias"), quando o veredito existir. "Lista que avisa" = o "acompanhar"; evitar a palavra "lista".

## Em andamento (técnico)

- Histórico append-only de store_prices (feito).
- Parser de tamanho/unidade em batch (em construção).
- Fila de limpeza: 2.103 produtos sem EAN (11,2%).

## Infra (22/09) — decisões e restrições

Supabase fica no plano Free (1 GB de Storage, 500 MB de banco; banco em 279 MB hoje). Decisão deliberada, não esquecimento — antes de subir de plano, aliviar o que ocupa espaço sem necessidade.

**Incidente 17–22/09.** Os buckets de encarte (`pdf-imports`, `image-imports`) passaram de 1 GB, e o projeto entrou em restrição: REST e Storage responderam 402 (`exceed_storage_size_quota`) para toda chamada, leitura incluída — não só escrita. Os 4 scrapers pararam de gravar por 5 dias (17 a 22/09). O cron que enchia os buckets foi desligado (#55); a limpeza dos arquivos antigos está pronta (script do #54) e só falta a API do Storage voltar a responder para rodar.

**Scrapers por conexão direta.** Bypassam a REST via uma conexão Postgres direta (role `scraper`, membro de `service_role`, pelo pooler em modo session — modo transaction não sustenta o `SET ROLE` entre queries). Connection string no secret `SCRAPER_DATABASE_URL` do GitHub Actions. PRs #56 (Jaú Serve) e #58 (Savegnago, Amarelinha, Tenda). Não ficou mais lento: a rodada completa da Tenda por conexão direta levou 1h36, contra 1h56 da rodada antiga por REST.

**O app em si segue pela REST** e não funciona enquanto a restrição não cair — a ponte cobre só os scrapers.

**Migration 079 aplicada, sem uso ainda.** A tabela do e-mail de "Fora de Matão" existe no banco (aplicada por conexão direta), mas o app não consegue gravar nela até a REST voltar.

**Pendências:**
- Retenção de 90 dias em `price_history` (ainda sem política).
- Retenção em qualquer importação futura de encarte, para o incidente não se repetir.
- Medir o tamanho do banco semanalmente.

## Próximo passo

Alta fidelidade completa. Próximo: implementação em React Native a partir do artefato e deste doc (o CLAUDE.md do app deve apontar para ambos).
