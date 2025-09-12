-- CreateTable
CREATE TABLE "AviatorSignal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "casa" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "ts" BIGINT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RobotState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "casa" TEXT NOT NULL,
    "lastProcessedTs" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AviatorSignal_casa_ts_idx" ON "AviatorSignal"("casa", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "RobotState_casa_key" ON "RobotState"("casa");
