#!/usr/bin/env bash
# Dispara o push de teste enquanto o fluxo notificacao.yaml espera o banner.
# Uso: ./notificacao.sh <product-id> [udid]
# PENDENTE DO #84: sem o handler, o toque não abre a Resposta e o fluxo falha em "ONDE".
set -euo pipefail
PRODUCT_ID="${1:?uso: $0 <product-id> [udid]}"
UDID="${2:-52223F35-47B8-49FD-BE6F-BD3B3F1B8C03}"
DIR="$(cd "$(dirname "$0")" && pwd)"
PAYLOAD="$(mktemp -t poup-push)"
printf '{"aps":{"alert":{"title":"Teste","body":"x"}},"productId":"%s"}' "$PRODUCT_ID" > "$PAYLOAD"
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
# O push sai depois que o fluxo já mandou o app para segundo plano.
( sleep 45; xcrun simctl push "$UDID" com.poup.consumer "$PAYLOAD" ) &
~/.maestro/bin/maestro --device "$UDID" test "$DIR/notificacao.yaml"
wait
