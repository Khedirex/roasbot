#!/usr/bin/env bash
set -euo pipefail
DB="${DB:-prisma/dev.db}"
OUT="${OUT:-export_$(date +%Y%m%d_%H%M%S).sql}"

echo "Exportando $DB -> $OUT"
sqlite3 "$DB" .dump > "$OUT"
echo "Feito: $OUT"
