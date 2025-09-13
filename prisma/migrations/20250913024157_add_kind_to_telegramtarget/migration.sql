/*
  Warnings:

  - You are about to drop the column `robotId` on the `TelegramTarget` table. All the data in the column will be lost.
  - Added the required column `kind` to the `TelegramTarget` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TelegramTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT,
    "casa" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "botToken" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "templates" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TelegramTarget" ("botToken", "casa", "chatId", "createdAt", "game", "id", "templates", "updatedAt") SELECT "botToken", "casa", "chatId", "createdAt", "game", "id", "templates", "updatedAt" FROM "TelegramTarget";
DROP TABLE "TelegramTarget";
ALTER TABLE "new_TelegramTarget" RENAME TO "TelegramTarget";
CREATE INDEX "TelegramTarget_game_casa_updatedAt_idx" ON "TelegramTarget"("game", "casa", "updatedAt");
CREATE UNIQUE INDEX "TelegramTarget_casa_kind_key" ON "TelegramTarget"("casa", "kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
