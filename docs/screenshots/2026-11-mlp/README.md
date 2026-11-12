# Screenshots do MLP, 12/11/2026

Capturadas no iOS Simulator (iPhone 17 Pro, iOS 26.5) com o build de dev de `main` (c622d173, inclui #85/#87), dados reais de produção em modo só leitura (nenhum onboarding concluído, nenhum "acompanhar").

- **Tamanho real:** 1206x2622 px (402x874 pt @3x). Não é o 393x852 do iPhone 15 pedido em `mobile/CLAUDE.md`; a proporção é parecida, o layout fica 9 pt mais largo e 22 pt mais alto.
- Barra de status fixada em 9:41 (`simctl status_bar`) nas capturas por deep link e nas de busca; as quatro de `resultado-lista-fim-*`, `resposta-3d-camil-pelo-resultado` mostram a hora real (17:30/17:31).
- O botão flutuante "Tools" do dev client (círculo cinza com engrenagem, canto superior direito) aparece em todas as telas e só existe em dev. Nas telas com cabeçalho ele cobre a engrenagem do app e parte do botão "Escanear".
- Resposta e Ajustes foram abertos por `xcrun simctl openurl ... poup://product/<id>` e `poup://settings`. Ids lidos por GET com a chave anon: Patéko 1 kg `a4b7679d-3f5b-4445-8624-7210f9f99be7`, Camil 1 kg `fc9c2d64-ed71-46b5-9c9c-13fb979e7387`.

## Telas

| Arquivo | Tela / estado |
|---|---|
| `raiz-dia-zero.png` | Raiz, dia zero (cidade escolhida, nenhum item): frase-fato "Preços de hoje nos 4 mercados de Matão", procedência "atualizados às 03:00 · Savegnago, Jaú Serve, Tenda, Amarelinha" |
| `resultado-lista-com-teclado.png` | Resultado "arroz branco" com teclado aberto |
| `resultado-lista-sem-teclado.png` | Mesmo, teclado fechado (Enter): 30 produtos, 8 visíveis, "ver mais 22" no fim |
| `resultado-lista-fim-camil-1kg-sem-preco-hoje.png` | Lista expandida, trecho do fim: linhas com preço de hoje, depois "Arroz Branco Camil Tipo 1 1kg" cinza com "—" e "sem preço hoje" (verificação do #87) |
| `resultado-lista-fim-sem-preco-hoje-cinza.png` | Fim da lista: só linhas cinza com "—" |
| `resultado-vazio-com-teclado.png`, `resultado-vazio-sem-teclado.png` | Busca "zzzzqq": "Nenhum produto com "zzzzqq"", botão "Buscar só "zzzzqq"", texto "Escanear o código" |
| `resultado-erro-sem-conexao-com-teclado.png` | Estado de erro "Sem conexão" com "Tentar de novo" (botão) e "Ajustes de rede do aparelho" (texto). Apareceu sozinho, sem eu desligar a rede (falha transitória da busca); "Tentar de novo" recuperou a lista |
| `resposta-3a-menor-preco-com-ean.png` | Resposta, Patéko 1 kg: "Menor preço no Jaú Serve: R$ 5,49", R$/kg, ONDE com "você está aqui · menor preço", "acompanhar este item ›", QUAL TAMANHO, rodapé "preços de hoje, 03:00 · 1 de 4 mercados" |
| `resposta-3d-sem-preco-hoje.png`, `resposta-3d-camil-pelo-resultado.png` | Resposta, Camil 1 kg, "Sem preço hoje" (a segunda chegou tocando na linha do Resultado) |
| `ajustes-vazio.png` | Ajustes sem itens acompanhados |
| `scanner-sem-camera.png` | Scanner no simulador (sem câmera): superfície escura, moldura, laser, "Aponte para o código de barras", "Digitar o nome em vez disso ›", "fechar" |

Não capturadas: Scanner "Sem acesso à câmera" (o simulador abriu o estado de leitura, sem pedir nem negar permissão), cartão "Não achamos esse produto", Resposta sem EAN (o único produto sem EAN achado com "arroz branco" não tem preço), faixa âmbar de loja defasada, Ajustes com itens, Onboarding (escrevem em produção).

## Divergências em relação a `docs/poup-mlp-decisoes.md`

Só observação, nada corrigido.

1. **Resposta "Sem preço hoje" mostra lojas com preço velho no ONDE** (`resposta-3d-*`): Savegnago "há 57 dias" e Tenda "há 4 dias" (ambas com mais de 3 dias), sem faixa âmbar e sem "ver todos os mercados ›". O doc diz que mais de 3 dias sai do ONDE e fica só em "ver todos os mercados"; aqui, como nenhuma loja tem preço de hoje, a tela lista as duas direto. Pode ser decisão para o estado 3d, mas o doc não a descreve. O rodapé também é outro: "últimos preços vistos · 2 de 4 mercados" (doc: "preços de hoje, 03:00 · N de 4 mercados"). O título "Sem preço hoje" e o preço das linhas estão em cinza, coerente com "ausência".
2. **Linha de Resultado com nome de loja truncado com reticências**: "só no Tenda Atacado - Mat…", "menor no Tenda Atacado -…" (`resultado-lista-sem-teclado`). O doc proíbe reticências no nome do produto (esse quebra em 2-3 linhas, correto); o nome da loja ("Tenda Atacado - Matão") é o nome cru da filial e não o da rede ("Tenda", usado na Resposta). Em `resposta-3a` a loja aparece como "Jaú Serve"/"Tenda".
3. **Resultado "sem teclado" mostra 8 linhas e "ver mais 22 ›"**, de acordo com o teto 8 do doc. Com teclado o teto 5 está de acordo; a lista rola sob o teclado.
4. **Resultado, linhas sem preço de hoje** (#87): cinza, "—" no lugar do preço, "sem preço hoje", ao fim da lista, após todas as linhas com preço, e sem "menor no X". Conforme o doc. A ordem por relevância textual fica quebrada dentro do grupo com preço (R$ 4,79, 4,99, 5,49, 29,89, 5,99, 7,67, 10,89, 11,79 ...), coerente com "nunca por preço".
5. **Resultado, produto não relacionado**: "Strogonoff de Frango e Arroz Branco Perdigão 300g" e "Bis Branco 100,8g" aparecem entre as 8 primeiras para "arroz branco" (relevância textual, não bug de tela).
6. **Estado vazio**: título "Nenhum produto com "zzzzqq"" (doc: "nenhum produto com X", ok); botão preenchido verde + texto "Escanear o código ›", conforme a alta fidelidade. Linha extra "nos 4 mercados de Matão hoje" não consta no doc.
7. **Raiz, dia zero**: a procedência lista as quatro redes ("atualizados às 03:00 · Savegnago, Jaú Serve, Tenda, Amarelinha"); o doc cita só "Preços de hoje nos 4 mercados de Matão · atualizados às 03:00". Marca "poup" em verde-escuro acima do campo, "Escanear" com texto e mesmo peso do campo, como no doc.
8. **Ajustes**: seção "ITENS ACOMPANHADOS" vazia com caixa tracejada (texto "Nenhum ainda. Ao ver o preço de um produto, toque em "acompanhar este item"."), "trocar ›" em verde, interruptor "Avisar quando um item baixar / no máximo 1 por dia" desligado, rodapé "sobre · termos". Conforme o doc. A linha "mais perto: Amarelinha · 0,4 km" aparece sob "Matão", enquanto na Resposta "você está aqui" é o Jaú Serve a 1,2 km e o Savegnago a 0,5 km (mercados vistos de posições diferentes em momentos diferentes é possível; não investigado, a localização do simulador pode ter mudado entre as capturas).
9. **Scanner**: sem câmera, o simulador mostra o estado de leitura (moldura + laser) e não "Sem acesso à câmera". O botão "fechar" fica coberto pelo "Tools" do dev client.
10. **Resposta 3a**: título com quebra "Menor preço no Jaú Serve:" / "R$ 5,49" (26 pt), linha ONDE com borda verde e selo "você está aqui · menor preço", como no doc; QUAL TAMANHO mostra "Arroz Branco Patéko Tipo 1 Pacote 5kg · 5" / "kg" (o tamanho "5 kg" quebra sozinho na segunda linha).
