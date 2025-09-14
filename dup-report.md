# Duplicate Scan Report
Sun Sep 14 19:20:07 UTC 2025


## Inventory

- Repo root: /workspaces/roasbot
- Git branch: restore-ultimosave
- Total tracked files: 143

### Top-level dirs
.
./.git
./.git/filter-repo
./.git/hooks
./.git/info
./.git/lfs
./.git/logs
./.git/objects
./.git/refs
./.vscode
./app
./app/(app)
./app/(public)
./app/actions
./app/api
./app/hooks
./components
./components/bots
./components/ui
./k8s
./lib
./lib/aviator
./lib/generated
./prisma
./prisma/migrations
./prisma/prisma
./public
./roasbot
./roasbot/.git
./roasbot/.vscode
./roasbot/app
./roasbot/components
./roasbot/lib
./roasbot/public
./roasbot/roasbot-main
./roasbot/src
./scripts
./types

## Generated/Cache candidates (deveriam estar ignorados)

./lib/generated
./.next
./node_modules

## Duplicate files by CONTENT (hash idêntico)

- Hash 6cfa5c5e0b5de6abfc20f2532414712c (3 files):
  - lib/generated/prisma/client.d.ts
  - lib/generated/prisma/default.d.ts
  - lib/generated/prisma/wasm.d.ts

- Hash cc2e694c75a79bdef5d6996d149e71b8 (2 files):
  - tsconfig.json.bak_alias_1757820813
  - tsconfig.json.bak_rollback_1757820449

- Hash db064eca924258f6ecc7cc32340da9f6 (2 files):
  - lib/generated/prisma/client.js
  - lib/generated/prisma/default.js

- Hash ef5b3f2b150c0657f9c373392b72d6f1 (4 files):
  - backup_20250910_172813.sql
  - export_20250910_171943.sql
  - export_20250910_172114.sql
  - export_20250910_172212.sql

- Hash a2c2496d84a522ed876627dc79cdd506 (2 files):
  - lib/generated/prisma/index-browser.js
  - lib/generated/prisma/wasm.js


## Duplicate files by BASENAME (mesmo nome, caminhos diferentes)

- auth.ts (2):
  - auth.ts
  - lib/auth.ts

- page.tsx (8):
  - app/(app)/admin/page.tsx
  - app/(app)/bots/aviator/1win/page.tsx
  - app/(app)/bots/page.tsx
  - app/(app)/ingest/aviator/[casa]/page.tsx
  - app/(app)/page.tsx
  - app/(public)/login/page.tsx
  - app/(public)/register/page.tsx
  - components/bots/aviator/page.tsx

- package.json (2):
  - lib/generated/prisma/package.json
  - package.json

- edge.js (2):
  - lib/generated/prisma/edge.js
  - lib/generated/prisma/runtime/edge.js

- index-browser.js (2):
  - lib/generated/prisma/index-browser.js
  - lib/generated/prisma/runtime/index-browser.js

- migration.sql (8):
  - prisma/migrations/20250909210431_init_auth/migration.sql
  - prisma/migrations/20250910013720_add_role_to_user/migration.sql
  - prisma/migrations/20250910153506_add_ingest_event/migration.sql
  - prisma/migrations/20250910160107_add_created_at_and_indexes/migration.sql
  - prisma/migrations/20250912155901_strategy_pattern_as_json/migration.sql
  - prisma/migrations/20250913013252_add_telegram_target/migration.sql
  - prisma/migrations/20250913024157_add_kind_to_telegramtarget/migration.sql
  - prisma/migrations/20250913051129_add_telegram_log/migration.sql

- schema.prisma (2):
  - lib/generated/prisma/schema.prisma
  - prisma/schema.prisma

- providers.tsx (2):
  - app/(app)/providers.tsx
  - app/providers.tsx

- route.ts (13):
  - app/actions/register/route.ts
  - app/api/auth/[...nextauth]/route.ts
  - app/api/healthz/route.ts
  - app/api/ingest/aviator/[casa]/route.ts
  - app/api/ingest/aviator/[casa]/stats/route.ts
  - app/api/messages/render/route.ts
  - app/api/ping/route.ts
  - app/api/telegram/msg/route.ts
  - app/api/telegram/route.ts
  - app/api/telegram/send/route.ts
  - app/api/telegram/signal/route.ts
  - app/api/telegram/targets/route.ts
  - app/api/telegram/webhook/route.ts

- layout.tsx (3):
  - app/(app)/layout.tsx
  - app/(public)/layout.tsx
  - app/layout.tsx

- dev.db (2):
  - prisma/dev.db
  - prisma/prisma/dev.db


## TS/TSX pairs with same stem (ex.: hook duplicado .ts e .tsx)

- app/hooks/usePersistedState.{ts,tsx}

## Potential duplicated subprojects (múltiplos package/tsconfig/eslint-config)

### package.json encontrados
lib/generated/prisma/package.json

### tsconfig.* encontrados

### eslint config encontrados

## Mirror-like trees (estruturas que parecem clones)

### Top-20 maiores diretórios (profundidade 2)
958M	./node_modules
358M	./roasbot.zip
28M	./roasbot
23M	./lib
736K	./prisma
368K	./app
268K	./package-lock.json
156K	./components
24K	./public
20K	./k8s
12K	./scripts
8.0K	./types
4.0K	./watchdog.sh
4.0K	./verify_ingest.sh
4.0K	./tsconfig.json.bak_rollback_1757820449
4.0K	./tsconfig.json.bak_alias_1757820813
4.0K	./tsconfig.json.bak
4.0K	./tsconfig.json
4.0K	./tsconfig.backup.json
4.0K	./send-signal.sh

> Dica: se houver algo como 'roasbot/roasbot-main/**', compare as árvores:
```bash
diff -rq roasbot/ roasbot/roasbot-main/ | head -n 200
```

## Common suspects (hooks/components duplicados por nome)

### usePersistedState
app/hooks/usePersistedState.ts
app/hooks/usePersistedState.tsx

### RobotManager
components/RobotManager.tsx

### BotsClient
app/(app)/bots/BotsClient.tsx

