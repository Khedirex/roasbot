-- CreateTable
CREATE TABLE "TelegramTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL,
    "casa" TEXT NOT NULL,
    "robotId" TEXT,
    "botToken" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "templates" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "TelegramTarget_game_casa_updatedAt_idx" ON "TelegramTarget"("game", "casa", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramTarget_game_casa_robotId_key" ON "TelegramTarget"("game", "casa", "robotId");
