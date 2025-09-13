-- CreateTable
CREATE TABLE "TelegramLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "casa" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "response" JSONB NOT NULL
);
