#!/usr/bin/env bash
set -euo pipefail

HOST="${https://glorious-xylophone-x5qgp4wvrp4qh575-3000.app.github.dev}"
TOKEN="${TOKEN:-ce3de8ddd3466f59f084b2e9b2ef2a359c5f43903eacfe162418adcd25ca8af8}"
CASA="${CASA:-1win}"
VALOR="${VALOR:-4.56}"
TS="${TS:-1694312345679}"

echo "===> POST $HOST/api/ingest/aviator/$CASA"
curl -sS -X POST "$HOST/api/ingest/aviator/$CASA" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  --data "{\"value\": $VALOR, \"ts\": $TS}" | jq .

echo
echo "===> GET $HOST/api/ingest/aviator/$CASA?limit=5"
curl -sS "$HOST/api/ingest/aviator/$CASA?limit=5" | jq .
