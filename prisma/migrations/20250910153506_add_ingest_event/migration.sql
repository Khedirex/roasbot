-- CreateTable
CREATE TABLE "IngestEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL,
    "casa" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "ts" BIGINT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "IngestEvent_game_casa_createdAt_idx" ON "IngestEvent"("game", "casa", "createdAt");
