# Metadados das lojas — Poup (MLP)

Fonte de produto: `docs/poup-mlp-decisoes.md` (manda sobre este arquivo) e `mobile/CLAUDE.md`. Este arquivo só descreve o que o app do MLP faz hoje: responder **onde um produto está mais barato hoje, nos 4 mercados de Matão**. Nada aqui promete mapa, listas, ofertas, histórico, planos pagos ou área de lojista (fora do MLP, decisão 13).

Regras de redação para qualquer texto de loja:

- Vocabulário do MLP: preço, mercado, hoje, escanear, acompanhar. Não usar favorito, alerta, lista, oferta, mapa.
- "Poup" e os nomes dos 4 mercados (Savegnago, Jaú Serve, Tenda, Amarelinha) aparecem só para dizer, de forma factual, quais mercados o app cobre. Nunca como palavra-chave de busca, nunca no nome, subtítulo ou ícone, nunca sugerindo vínculo.
- Nada de "melhor preço garantido", "economize X%" ou qualquer número não medido.

Campos marcados `<PREENCHER>` dependem de dado que não está no repositório. Não inventar.

---

## Nome do app

| Loja | Texto | Limite |
|---|---|---|
| App Store | Poup: preços em Matão | 30 (21) |
| Google Play | Poup: preços em Matão | 30 (21) |

## Subtítulo (App Store, máx. 30)

Onde está mais barato hoje

(26 caracteres)

## Descrição curta (Google Play, máx. 80)

Veja em qual dos 4 mercados de Matão o produto está mais barato hoje.

(69 caracteres)

## Texto promocional (App Store, máx. 170, editável sem nova versão)

Busque ou escaneie um produto e veja o preço de hoje nos 4 mercados de Matão, do menor para o maior.

(100 caracteres)

## Descrição completa (pt-BR, App Store e Google Play, máx. 4000)

O Poup responde uma pergunta: onde este produto está mais barato hoje?

Busque pelo nome ou escaneie o código de barras. O Poup mostra o preço de hoje em cada um dos 4 mercados de Matão, SP (Savegnago, Jaú Serve, Tenda e Amarelinha), do menor para o maior, com a distância até cada um.

COMO FUNCIONA
- Os preços são coletados uma vez por dia, de madrugada. O app informa de quando é cada preço.
- Se o preço de um mercado está desatualizado, o app avisa em vez de mostrá-lo como se fosse de hoje.
- A comparação entre mercados só é feita quando o produto é identificado pelo código de barras. Sem o código, o app mostra o preço de um mercado só e não declara vencedor.
- O app usa sua localização para indicar qual mercado está mais perto de você.
- Você pode acompanhar itens e ver o menor preço de cada um já na tela inicial.

SEM CADASTRO
Você não precisa criar conta, informar nome ou senha para ver os preços. O app é gratuito.

COBERTURA
Hoje o Poup cobre apenas Matão, SP. Fora de Matão o app avisa que ainda não há preços para a sua cidade.

AVISO
O Poup é um app independente e não tem vínculo com os mercados citados; os nomes são usados apenas para informar quais mercados são comparados. Os preços exibidos podem diferir do praticado na loja no momento da compra.

## Palavras-chave (App Store, máx. 100, separadas por vírgula, sem espaço após a vírgula)

supermercado,comparar,preço,barato,compras,economizar,código de barras,scanner,EAN,Matão

(88 caracteres. Sem nomes de redes concorrentes ou de terceiros: marca de terceiros em palavra-chave é motivo de rejeição. Sem termos fora do vocabulário.)

## Categorias

| Loja | Principal | Secundária |
|---|---|---|
| App Store | Shopping (Compras) | nenhuma |
| Google Play | Compras (Shopping) | não se aplica |

## Classificação etária

- **App Store:** 4+. Questionário: nenhum item de conteúdo sensível; sem acesso irrestrito à web; sem conteúdo gerado por usuários; sem compras no app.
- **Google Play (IARC):** Livre / Everyone. Sem violência, conteúdo sexual, linguagem imprópria, jogos de azar ou interação entre usuários.

Revalidar o questionário antes de cada envio, porque as respostas dependem do que o binário contém.

## URLs e contato

| Campo | Valor |
|---|---|
| URL da política de privacidade (obrigatória nas duas lojas) | `<PREENCHER>` |
| URL de suporte (App Store) | `<PREENCHER>` |
| URL de marketing (App Store, opcional) | `<PREENCHER>` |
| E-mail de contato (Google Play, obrigatório) | `<PREENCHER>` |
| E-mail de contato do revisor (App Store Connect) | `<PREENCHER>` |
| Telefone do revisor (App Store Connect, obrigatório) | `<PREENCHER>` |

A política de privacidade precisa descrever, nos termos do que o app faz: localização para indicar o mercado mais perto; uso de câmera só para ler código de barras; coleta de eventos de uso de forma anônima e agregada (decisão 15, LGPD); e-mail opcional, informado só por quem está fora de Matão e quer aviso de cobertura.

## Notas para o revisor (App Review / Google Play)

Texto para colar no campo "Notes" do App Store Connect e na declaração de acesso do Play Console:

> O Poup compara o preço de produtos de supermercado entre os 4 mercados de Matão, SP. Não há login: o app não pede conta, nome nem senha, e por isso não há credencial de teste.
>
> Os preços cobrem apenas Matão. Para ver o app com dados, use Matão como localização ou, no primeiro passo, toque em "digitar minha cidade" e informe Matão. Se o aparelho estiver em outra cidade, o app mostra "Ainda não estamos em ..." e oferece "Ver preços de Matão mesmo assim".
>
> Permissões, todas pedidas só no momento de uso:
> - Localização (ao usar o app): pedida no primeiro passo, com explicação antes do diálogo do sistema. Usada para indicar qual mercado de Matão está mais perto e a distância até cada um, e para escolher entre as filiais de uma mesma rede (a Amarelinha tem 5 em Matão). Por isso pedimos localização precisa. Se o usuário recusar, o app continua funcionando: ele digita a cidade e vê os preços sem a indicação "você está aqui". A localização não é usada em segundo plano.
> - Câmera: pedida só no primeiro toque em "Escanear". Usada exclusivamente para ler o código de barras de um produto. Nenhuma imagem é gravada nem enviada. Se recusada, o usuário pode buscar digitando o nome.
> - Notificações: pedidas só quando o usuário acompanha um item e escolhe receber aviso; o botão "Acompanhar sem avisos" nunca pede a permissão. Usadas apenas para avisos sobre os itens que o usuário escolheu acompanhar. Recusar não afeta o resto do app.
>
> Login anônimo: ao acompanhar o primeiro item, o app cria uma sessão anônima (sem e-mail, nome ou senha) para guardar os itens acompanhados deste aparelho. Não há outro tipo de conta.
>
> Dados coletados: eventos de uso anônimos (buscas, leituras do scanner, telas vistas, localização aproximada, hora), sem identificar a pessoa. Único dado de contato: e-mail opcional, informado por quem está fora de Matão e quer ser avisado quando houver cobertura, com consentimento explícito na tela.
>
> O app é gratuito, não tem compras no app, anúncios, conteúdo de usuários nem login por terceiros. Os nomes dos mercados são usados apenas para informar quais mercados têm preço comparado; o Poup não tem vínculo com eles.

Pontos que o revisor costuma questionar e a resposta curta:

- Por que localização precisa? Escolher a filial mais próxima dentro de uma rede com várias lojas na mesma cidade.
- Por que câmera? Ler código de barras (EAN) para identificar o produto sem ambiguidade.
- Há login com Apple/Google? Não.

## Privacidade (rótulos)

Rascunho para App Privacy (App Store) e Segurança dos dados (Play). Confirmar contra o binário final antes de enviar.

| Dado | Coletado | Vinculado à identidade | Uso |
|---|---|---|---|
| Localização aproximada | sim, em eventos de uso | `<PREENCHER>` | análise de produto |
| Localização precisa | usada no aparelho para distância; se sai do aparelho: `<PREENCHER>` | `<PREENCHER>` | funcionalidade do app |
| Identificador (ID de usuário anônimo) | sim, ao acompanhar um item | `<PREENCHER>` | funcionalidade do app |
| Dados de uso (buscas, scanner, telas) | sim | `<PREENCHER>` | análise de produto |
| E-mail | opcional, só fora de Matão | sim | aviso de cobertura |
| Câmera | não coletado (leitura local do código) | não se aplica | funcionalidade do app |

Rastreamento (ATT): o app não usa dados para rastrear entre apps de terceiros. Confirmar `<PREENCHER>` antes de responder "não" no App Store Connect.

## Capturas de tela

| Dispositivo | Tamanho | Quantidade |
|---|---|---|
| iPhone 6.7" | 1290x2796 | 3 a 5 |
| iPhone 6.5" ou 5.5" (se exigido) | 1242x2688 / 1242x2208 | 3 a 5 |
| Android celular | 1080x1920 ou maior | 3 a 5 |

iPad não se aplica (`supportsTablet: false`).

### Sequência

Cada captura vem do app real, em Matão, com dados do dia. Sem legenda que prometa algo fora do que a tela mostra.

1. **Raiz com itens** — frase do dia e "Seus itens" com o menor preço de cada um.
2. **Busca** — resultado com preços por produto.
3. **Resposta** — "Menor preço no X" e os mercados com distância.
4. **Scanner** — leitura de código de barras.
5. **Ajustes** — itens acompanhados, localização e notificações.

Textos de legenda sugeridos (opcionais, ≤ 40 caracteres): "Onde está mais barato hoje", "Busque ou escaneie", "Compare os 4 mercados de Matão".

## Antes de enviar

- Rebuild nativo é pré-requisito: textos de permissão e configuração nativa só mudam no binário.
- Versão e build vêm do `app.json` / EAS (`appVersionSource: remote`).
- Conferir que nenhum texto acima divergiu do app depois de mudança de escopo.
