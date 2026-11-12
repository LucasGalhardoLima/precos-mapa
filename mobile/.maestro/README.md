# Fluxos E2E (Maestro)

Rodam no iOS Simulator, sem aparelho físico. Dados são reais (Supabase), então precisam de rede.

## Pré-requisitos
- Maestro 2.x e **Java 17+** (`JAVA_HOME=$(/usr/libexec/java_home -v 21)`; o padrão da máquina pode ser o 11).
- Build de dev instalado no simulador: `npx expo run:ios --device <udid> --no-bundler`.
- Metro de pé: `npx expo start --dev-client`.

## Rodar
```
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
maestro --device <udid> test mobile/.maestro/onboarding.yaml
maestro --device <udid> test mobile/.maestro/busca-e-resposta.yaml
maestro --device <udid> test mobile/.maestro/ajustes.yaml
```

| Fluxo | Cobre |
|---|---|
| `onboarding.yaml` | passo 1 → cidade → passo 2 (plural do botão) → raiz com itens |
| `busca-e-resposta.yaml` | busca → Resultado → toque na linha → Resposta (bloco ONDE) |
| `ajustes.yaml` | raiz → engrenagem → Ajustes (seções, rodapé) → folha "trocar" → volta. Sem escrita em produção |
| `_launch.yaml` | sub-fluxo: app zerado conectado ao Metro (não rodar sozinho) |

## Armadilhas
- Texto com chevron ("Buscar agora ›"): casar com regex `Buscar agora.*`.
- No dev client o botão flutuante "Tools" cobre o canto superior direito (ex.: link "Buscar agora"). Só existe em dev.
- Cada linha de resultado é um elemento único: `"<nome>, menor no <loja>, R$ <preço>"`.
- Asserção frouxa (`.*`) passa em tela em branco. Confira o screenshot.
