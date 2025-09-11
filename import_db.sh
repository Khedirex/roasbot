#!/usr/bin/env bash
set -euo pipefail
SRC="${1:-}"
DB="${DB:-prisma/dev.db}"

if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "uso: $0 caminho/do/dump.sql"
  exit 1
fi

mkdir -p "$(dirname "$DB")"
rm -f "$DB"
sqlite3 "$DB" < "$SRC"
echo "Importado para $DB"
