-- DropIndex
DROP INDEX "TelegramTarget_game_casa_updatedAt_idx";

-- CreateIndex
CREATE INDEX "TelegramTarget_chatId_idx" ON "TelegramTarget"("chatId");
