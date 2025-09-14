#!/usr/bin/env bash
set -euo pipefail
BASE="https://glorious-xylophone-x5qgp4wvrp4qh575-3000.app.github.dev"
ADMIN_CHAT_ID="-1002968487990"  # ou um chat privado seu
BOT_TOKEN="8384960154:AAEYVYnk2UF6JTnKK-Mwv1iOXtoe6RLTUWI"

ok=$(curl -s --max-time 6 "$BASE/api/healthz" | jq -r '.ok' || echo "false")
if [ "$ok" != "true" ]; then
  txt="⚠️ ALARME: Health falhou em $(date -Iseconds)\nHost: $BASE"
  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\":\"${ADMIN_CHAT_ID}\",\"text\":\"${txt}\",\"parse_mode\":\"Markdown\"}" >/dev/null || true
fi
