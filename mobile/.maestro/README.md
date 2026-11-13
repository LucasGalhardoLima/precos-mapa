# Fluxos E2E (Maestro)

Rodam no iOS Simulator, sem aparelho físico. Dados são reais (Supabase), então precisam de rede.

## Pré-requisitos
- Maestro 2.x e **Java 17+** (`JAVA_HOME=$(/usr/libexec/java_home -v 21)`; o padrão da máquina pode ser o 11).
- Build de dev instalado no simulador: `npx expo run:ios --device <udid> --no-bundler`. Mudou `app.json` (ex.: texto de permissão)? Rode `npx expo prebuild --platform ios --no-install` antes (apaga e recria `ios/`, gitignored).
- Metro de pé: `npx expo start --dev-client`.

## Build e2e e dados de teste (leia antes de rodar fluxos que concluem onboarding ou Acompanhar)
Os fluxos rodam contra o Supabase de produção. O que escreve só pode rodar com um build **marcado**:
- Build: perfil `e2e` do `eas.json` (cópia do `development` + `EXPO_PUBLIC_E2E=1`) ou, local, `EXPO_PUBLIC_E2E=1 npx expo run:ios --device <udid> --no-bundler`. Produção e preview nunca têm o flag. Sem ele, o app não marca nada: não rode os fluxos que escrevem.
- O que é marcado (`mobile/lib/e2e.ts`): o usuário anônimo (`auth.users.raw_user_meta_data.e2e = true`, via `signInAnonymously`) e todo evento de `analytics_events` (`metadata.e2e = true`; é só a marca para o cleanup achar as linhas: as views de engajamento ainda NÃO filtram por ela, então os eventos contam nos agregados até a limpeza). `tracked_items`, `profiles` e `notification_preferences` são identificáveis pelo dono marcado.
- Antes da primeira rodada, zere o simulador (`xcrun simctl erase <udid>`) ou deslogue: uma sessão que veio de build não marcado faz o app reutilizar esse usuário, e `tracked_items` gravados sob ele não são achados pelo cleanup.
- Limpar: `scripts/e2e-cleanup.sh` roda em **dry-run por padrão** (só SELECT, via Management API com o login do CLI) e lista usuários marcados e o que depende deles. Rode o dry-run primeiro e confira os números. `--apply` apaga (uma transação, `auth.users` marcados com cascata; confirmação digitada) e nunca toca em linhas sem a marca.
- **Regra: nunca preencher o e-mail de "Fora de Matão" em nenhum fluxo.** `city_interest` não tem dono nem marca, então o cleanup não consegue achar essa linha; nenhum fluxo pode escrevê-la.

## Rodar
```
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
cd $(mktemp -d)   # takeScreenshot grava no diretório corrente
~/.maestro/bin/maestro --device <udid> test <repo>/mobile/.maestro/<fluxo>.yaml
```
Fluxos só de leitura: Metro normal (`npx expo start --dev-client`). Atenção: o app emite `analytics_events` anônimos mesmo nos fluxos "só leitura"; só o Metro e2e (`EXPO_PUBLIC_E2E=1 npx expo start --dev-client --clear`) os marca. Prefira rodar a suíte inteira com o Metro e2e.

## Estado da suíte (iOS, rodada de 12/11/2026, iPhone 17 Pro, iOS 26.5, build de `main` 58813200)

| Fluxo | Cobre | Lê/escreve | Resultado |
|---|---|---|---|
| `raiz-dia-zero.yaml` | Raiz dia zero (frase-fato, procedência, sem SEUS ITENS) | lê | passa |
| `resultado-lista.yaml` | Resultado: contador, teto 8 sem teclado (`ver mais` = total − 8, assertado), sem preço hoje no fim; teto 5 com teclado só por screenshot | lê | passa |
| `resultado-vazio.yaml` | "zzzzqq": título, botão + texto, saída "Escanear o código" | lê | passa |
| `resposta-com-ean.yaml` | Resposta com EAN (Patéko 1 kg): título, ONDE, rodapé | lê | passa |
| `resposta-sem-preco-hoje.yaml` | Camil 1 kg achado pela busca (fim da lista) → "Sem preço hoje" | lê | passa |
| `resposta-inexistente.yaml` | id inexistente: "Não achamos esse produto", 2 saídas | lê | passa |
| `resposta-aqui-paridade.yaml` | #94: "você está aqui" na Resposta = "mais perto" em Ajustes; rede mais perto sem o produto → sem "aqui" | lê | passa |
| `qual-tamanho.yaml` | QUAL TAMANHO: alternativas (Fanta 220 ml) e fallback "é o melhor por kg" (Lasanha Sadia) | lê | passa |
| `ajustes-vazio.yaml` | Ajustes vazio, folha "trocar" (4 mercados), rodapé sobre/termos | lê | passa |
| `scanner.yaml` | Scanner no simulador = "Sem câmera neste aparelho" + 2 saídas | lê | passa |
| `notificacao.yaml` + `notificacao.sh` | push → toque → Resposta | lê | **pendente do #84** (não conta como falha); o banner nem aparece sem permissão de notificação |
| `escreve/onboarding.yaml` | onboarding completo + Raiz×Ajustes com a mesma lista (#85) | **escreve** | passa (13/11/2026, anônimo ligado) |
| `escreve/acompanhar.yaml` | acompanhar com alvo → editar → Ajustes → ✕ → desfazer | **escreve** | passa (13/11/2026, depois do fix do teclado) |

Sub-fluxos: `_launch.yaml` (app zerado + Metro; trata a corrida do "Open in Poup?"), `_abrir.yaml` (deep link, mesma corrida), `_ate-raiz.yaml` (onboarding sem itens até a Raiz). Screenshots (`*.png` é gitignored aqui) ficam só locais; as da rodada de 12/11/2026 estão em `screenshots/` na máquina de quem rodou. O antigo `busca-e-resposta.yaml` foi substituído por `resultado-lista`/`resposta-*`.

### Fluxos que escrevem
Ficam em `escreve/` de propósito: `maestro test .maestro/` não desce em subpastas, então rodar a suíte inteira nunca escreve em produção por acidente. Rode-os um a um, só com Metro e2e, e rode `scripts/e2e-cleanup.sh` (dry-run) antes e depois.

O login anônimo do Supabase de produção foi ligado (`external_anonymous_users_enabled: true`, 30/h por IP). Confirmado: o usuário anônimo nasce com a marca e2e (`marked_users` 0 → 1, com 1 profile e 2 `tracked_items`) e nenhum usuário sem marca surge.
- **Zere o keychain antes de cada fluxo** (`xcrun simctl keychain <udid> reset`): ele sobrevive ao `clearState`, e uma sessão anterior com itens faz `_ate-raiz` cair na Raiz com itens em vez do dia zero. Cada rodada cria um usuário marcado novo.
- `acompanhar.yaml` digita um novo alvo (5,00) com o teclado aberto e toca em "Acompanhar e avisar". Isso só funciona porque a folha sobe por um listener de teclado; o `KeyboardAvoidingView` do #99 não empurrava a folha dentro do Modal no iOS 26.5.
- **Metro velho serve bundle velho:** um Metro de vida longa deixou de ver edições (o app rodou JS sem a correção). Se um fluxo contradiz o código, confira com `curl` no bundle (`grep` por uma string nova) ou reinicie com `--clear`.
- O app não pede permissão de notificação em lugar nenhum (nenhum `requestPermissionsAsync`); o diálogo nunca aparece, e o passo condicional "Allow" é pulado. `profiles.push_token` fica nulo (#84).

### Não coberto (e por quê)
- Rede caída, erro de leitura, ErrorBoundary: o simulador não derruba só o app sem mexer na rede da máquina; não forçado.
- Scanner 5b "Sem acesso à câmera": o simulador não tem câmera e cai antes, em "Sem câmera neste aparelho", mesmo com `simctl privacy revoke camera`. Leitura real de código e 5b só no aparelho.
- Permissão de notificação: `simctl privacy` não tem serviço de notificação; o diálogo só aparece no primeiro "acompanhar".
- Toque na engrenagem da Raiz: coberto pelo botão "Tools" do dev client (entra por `poup://settings`).
- Links sobre/termos/privacidade escondidos com URL placeholder: em `main` "sobre · termos" são texto simples sem destino e não há "privacidade"; os links são do #91 (não mergeado). `ajustes-vazio.yaml` assere o estado atual.
- Teto 5 com teclado: só por screenshot (a lista rola sob o teclado; não há como contar linhas por assertiva).

## Armadilhas
- Texto com chevron ("Buscar agora ›"): casar com regex `Buscar agora.*`.
- No dev client o botão flutuante "Tools" cobre o canto superior direito (ex.: link "Buscar agora"). Só existe em dev.
- Cada linha de resultado é um elemento único: `"<nome>, menor no <loja>, R$ <preço>"`.
- No dev client o botão "Tools" cobre a engrenagem inteira da raiz (toque por ponto na borda também abre o menu de dev): `ajustes-vazio.yaml` entra por `poup://settings`, então o toque na engrenagem fica sem cobertura E2E.
- O iOS pergunta "Open in Poup?" ao abrir links de esquema, às vezes tarde ou nunca: `_launch.yaml` e `_abrir.yaml` esperam (com `optional`) antes de decidir tocar em "Open". Um `when: visible` direto avalia cedo demais.
- Link de rodapé/ação com chevron no texto ("Escanear o código ›"): use regex `.*` no fim, sempre.
- zsh/macOS: `sed -i` exige `-i ''`; `echo == x` expande.
- Asserção frouxa (`.*`) passa em tela em branco. Confira o screenshot.
