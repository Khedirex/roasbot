-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TelegramTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL DEFAULT 'aviator',
    "casa" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "botToken" TEXT,
    "chatId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "templates" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TelegramTarget" ("active", "botToken", "casa", "chatId", "createdAt", "game", "id", "kind", "templates", "updatedAt") SELECT "active", "botToken", "casa", "chatId", "createdAt", "game", "id", "kind", "templates", "updatedAt" FROM "TelegramTarget";
DROP TABLE "TelegramTarget";
ALTER TABLE "new_TelegramTarget" RENAME TO "TelegramTarget";
CREATE INDEX "TelegramTarget_chatId_idx" ON "TelegramTarget"("chatId");
CREATE UNIQUE INDEX "telegram_target_game_casa_kind_uq" ON "TelegramTarget"("game", "casa", "kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
