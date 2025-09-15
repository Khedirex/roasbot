#!/usr/bin/env bash
BASE="https://glorious-xylophone-x5qgp4wvrp4qh575-3000.app.github.dev"
INGEST_TOKEN="ce3de8ddd3466f59f084b2e9b2ef2a359c5f43903eacfe162418adcd25ca8af8"
SIGNAL_KEY="04479f30f47f0e754692b3ab3587bc7b0369805bd1dc8ab3e6fb28a46db5fc84"

echo "== Health =="
curl -s -i "$BASE/api/healthz" | head -n 1

echo -e "\n== Targets =="
curl -s -i -H "x-api-key: $INGEST_TOKEN" "$BASE/api/telegram/targets" | head -n 10

echo -e "\n== Signal =="
curl -s -X POST "$BASE/api/telegram/signal" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SIGNAL_KEY" \
  -d '{"event":"WIN","strategy":"Aviator Pro","odds":"2.35","mg":0,"note":"Entrada limpa","when":"14:22"}' \
  | jq .
