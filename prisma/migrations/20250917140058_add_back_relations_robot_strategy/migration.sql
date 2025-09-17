-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SignalCursor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "robotId" TEXT NOT NULL,
    "lastTs" BIGINT NOT NULL DEFAULT 0,
    "lastId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SignalCursor_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SignalCursor" ("id", "lastId", "lastTs", "robotId", "updatedAt") SELECT "id", "lastId", "lastTs", "robotId", "updatedAt" FROM "SignalCursor";
DROP TABLE "SignalCursor";
ALTER TABLE "new_SignalCursor" RENAME TO "SignalCursor";
CREATE INDEX "SignalCursor_lastTs_updatedAt_idx" ON "SignalCursor"("lastTs", "updatedAt");
CREATE UNIQUE INDEX "SignalCursor_robotId_key" ON "SignalCursor"("robotId");
CREATE TABLE "new_StrategyState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT NOT NULL,
    "tail" INTEGER NOT NULL DEFAULT 0,
    "lastTs" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StrategyState_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StrategyState" ("id", "lastTs", "strategyId", "tail", "updatedAt") SELECT "id", "lastTs", "strategyId", "tail", "updatedAt" FROM "StrategyState";
DROP TABLE "StrategyState";
ALTER TABLE "new_StrategyState" RENAME TO "StrategyState";
CREATE UNIQUE INDEX "StrategyState_strategyId_key" ON "StrategyState"("strategyId");
CREATE TABLE "new_TelegramTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL DEFAULT 'aviator',
    "casa" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "botToken" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "templates" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TelegramTarget" ("active", "botToken", "casa", "chatId", "createdAt", "game", "id", "kind", "templates", "updatedAt") SELECT "active", "botToken", "casa", "chatId", "createdAt", coalesce("game", 'aviator') AS "game", "id", "kind", "templates", "updatedAt" FROM "TelegramTarget";
DROP TABLE "TelegramTarget";
ALTER TABLE "new_TelegramTarget" RENAME TO "TelegramTarget";
CREATE INDEX "TelegramTarget_game_casa_updatedAt_idx" ON "TelegramTarget"("game", "casa", "updatedAt");
CREATE UNIQUE INDEX "TelegramTarget_game_casa_kind_key" ON "TelegramTarget"("game", "casa", "kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TelegramLog_casa_kind_createdAt_idx" ON "TelegramLog"("casa", "kind", "createdAt");
