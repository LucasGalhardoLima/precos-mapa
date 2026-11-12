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
maestro --device <udid> test mobile/.maestro/onboarding.yaml
maestro --device <udid> test mobile/.maestro/busca-e-resposta.yaml
maestro --device <udid> test mobile/.maestro/ajustes.yaml
```

| Fluxo | Cobre |
|---|---|
| `onboarding.yaml` | passo 1 → cidade → passo 2 (plural do botão) → raiz com itens → Ajustes com os mesmos 2 itens. **Só com build e2e** (cria usuário anônimo + 2 linhas em tracked_items em produção, todos marcados) |
| `busca-e-resposta.yaml` | busca → Resultado → toque na linha → Resposta (bloco ONDE). Sem escrita em produção (não escolhe item no onboarding) |
| `ajustes.yaml` | raiz → engrenagem → Ajustes (seções, rodapé) → folha "trocar" → volta. Sem escrita em produção |
| `qual-tamanho.yaml` | busca → Resposta → bloco QUAL TAMANHO. Sem escrita em produção. Rodado em 12/11/2026: **não passa** — o primeiro "arroz" não tem família de tamanhos com preço de hoje (ver comentário no arquivo) |
| `_launch.yaml` | sub-fluxo: app zerado conectado ao Metro (não rodar sozinho) |

## Armadilhas
- Texto com chevron ("Buscar agora ›"): casar com regex `Buscar agora.*`.
- No dev client o botão flutuante "Tools" cobre o canto superior direito (ex.: link "Buscar agora"). Só existe em dev.
- Cada linha de resultado é um elemento único: `"<nome>, menor no <loja>, R$ <preço>"`.
- No dev client o botão "Tools" cobre a engrenagem inteira da raiz (toque por ponto na borda também abre o menu de dev): `ajustes.yaml` entra por `poup://settings`, então o toque na engrenagem fica sem cobertura E2E.
- O iOS pergunta "Open in Poup?" ao abrir links de esquema; `_launch.yaml` e `ajustes.yaml` tocam em "Open" quando aparece (é uma corrida: se o diálogo aparecer depois, o próximo passo falha).
- Asserção frouxa (`.*`) passa em tela em branco. Confira o screenshot.
