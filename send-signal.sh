#!/usr/bin/env bash
set -euo pipefail
BASE="https://glorious-xylophone-x5qgp4wvrp4qh575-3000.app.github.dev"
KEY="04479f30f47f0e754692b3ab3587bc7b0369805bd1dc8ab3e6fb28a46db5fc84"

EVENT="${1:-WIN}"
STRAT="${2:-Aviator Pro}"
ODDS="${3:-2.35}"
MG="${4:-0}"
NOTE="${5:-Entrada limpa}"
WHEN="${6:-$(date +%H:%M:%S)}"

# Se tiver jq instalado, usamos. Senão, caímos no plano B sem jq.
if command -v jq >/dev/null 2>&1; then
  PAYLOAD=$(jq -n \
    --arg e "$EVENT" --arg s "$STRAT" --arg o "$ODDS" \
    --argjson mg "$MG" --arg n "$NOTE" --arg w "$WHEN" \
    '{event:$e,strategy:$s,odds:$o,mg:$mg,note:$n,when:$w}')
else
  PAYLOAD=$(printf '{"event":"%s","strategy":"%s","odds":"%s","mg":%s,"note":"%s","when":"%s"}' \
    "$EVENT" "$STRAT" "$ODDS" "$MG" "$NOTE" "$WHEN")
fi

curl -s -X POST "$BASE/api/telegram/signal" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $KEY" \
  -d "$PAYLOAD"
echo
