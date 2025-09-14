#!/usr/bin/env bash
set -euo pipefail

OUT="dup-report.md"
echo "# Duplicate Scan Report" > "$OUT"
date >> "$OUT"
echo >> "$OUT"

# ---------- helpers ----------
SECTION() { echo -e "\n## $1\n" >> "$OUT"; }
ROW() { echo "$*" >> "$OUT"; }

# ---------- inventário ----------
SECTION "Inventory"
ROW "- Repo root: $(pwd)"
ROW "- Git branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'n/a')"
ROW "- Total tracked files: $(git ls-files | wc -l)"
ROW ""

# Lista top-level dirs relevantes (ignora node_modules/.next)
ROW "### Top-level dirs"
find . -maxdepth 2 -type d ! -path "./node_modules*" ! -path "./.next*" | sort >> "$OUT"

# ---------- 0. arquivos gerados / caches que devem ser ignorados ----------
SECTION "Generated/Cache candidates (deveriam estar ignorados)"
find . -type d \( -name "node_modules" -o -name ".next" -o -name "out" -o -name "build" -o -path "./lib/generated" \) -prune -print >> "$OUT"

# ---------- 1. Duplicatas por CONTEÚDO (hash) ----------
SECTION "Duplicate files by CONTENT (hash idêntico)"
# só arquivos rastreados pelo git, evitando node_modules/.next
git ls-files -z | xargs -0 -I{} sh -c 'test -f "{}" && printf "%s  %s\n" "$(md5sum "{}" | cut -d" " -f1)" "{}"' \
  | sort | awk '
  {hash=$1; file=$2; H[hash]++; L[hash]=L[hash] ? L[hash] ORS "  - " file : "  - " file}
  END {for (h in H) if (H[h]>1) {print "- Hash " h " (" H[h] " files):"; print L[h]; print ""}}' >> "$OUT" || true

# ---------- 2. Duplicatas por NOME (mesmo basename em caminhos diferentes) ----------
SECTION "Duplicate files by BASENAME (mesmo nome, caminhos diferentes)"
git ls-files | awk -F/ '{print $NF, $0}' | sort | awk '
{
  base=$1; $1=""; path=substr($0,2);
  CNT[base]++; L[base]=L[base] ? L[base] ORS "  - " path : "  - " path
}
END {
  for (b in CNT) if (CNT[b]>1) {
    print "- " b " (" CNT[b] "):"; print L[b]; print ""
  }
}' >> "$OUT"

# ---------- 3. Pares .ts / .tsx com o mesmo "stem" ----------
SECTION "TS/TSX pairs with same stem (ex.: hook duplicado .ts e .tsx)"
git ls-files '*.ts' '*.tsx' | sed 's/\.\(ts\|tsx\)$//' | sort | uniq -d | while read -r stem; do
  echo "- $stem.{ts,tsx}" >> "$OUT"
done

# ---------- 4. Subprojetos duplicados (múltiplos roots) ----------
SECTION "Potential duplicated subprojects (múltiplos package/tsconfig/eslint-config)"
ROW "### package.json encontrados"
git ls-files | grep -E '/package\.json$' | sort >> "$OUT" || true
ROW ""
ROW "### tsconfig.* encontrados"
git ls-files | grep -E '/tsconfig(\.|$)' | sort >> "$OUT" || true
ROW ""
ROW "### eslint config encontrados"
git ls-files | grep -E '/eslint\.config\.js$' | sort >> "$OUT" || true

# ---------- 5. Árvores espelho (subpastas grandes com estrutura parecida) ----------
SECTION "Mirror-like trees (estruturas que parecem clones)"
# Heurística: listar subdirs grandes e ver se há padrões repetidos
ROW "### Top-20 maiores diretórios (profundidade 2)"
du -sh -- ./* | sort -hr | head -n 20 >> "$OUT" 2>/dev/null || true

echo -e "\n> Dica: se houver algo como 'roasbot/roasbot-main/**', compare as árvores:" >> "$OUT"
echo '```bash' >> "$OUT"
echo 'diff -rq roasbot/ roasbot/roasbot-main/ | head -n 200' >> "$OUT"
echo '```' >> "$OUT"

# ---------- 6. Duplicatas suspeitas comuns (hooks, RobotManager, etc.) ----------
SECTION "Common suspects (hooks/components duplicados por nome)"
for name in usePersistedState RobotManager BotsClient; do
  echo "### $name" >> "$OUT"
  git ls-files | grep -i "$name" | sort >> "$OUT" || true
  echo >> "$OUT"
done

echo -e "\n---\nScan finished. Abra: $OUT\n"
