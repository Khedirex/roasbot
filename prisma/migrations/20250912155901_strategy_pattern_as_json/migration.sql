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

-- CreateTable
CREATE TABLE "Robot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL,
    "casa" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "botToken" TEXT,
    "chatId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "robotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startHour" TEXT NOT NULL,
    "endHour" TEXT NOT NULL,
    "pattern" JSONB NOT NULL,
    "winAt" INTEGER NOT NULL DEFAULT 1,
    "mgCount" INTEGER NOT NULL DEFAULT 0,
    "blueThreshold" REAL,
    "pinkThreshold" REAL,
    "messages" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Strategy_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AviatorSignal_casa_ts_idx" ON "AviatorSignal"("casa", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "RobotState_casa_key" ON "RobotState"("casa");

-- CreateIndex
CREATE INDEX "Robot_game_casa_idx" ON "Robot"("game", "casa");

-- CreateIndex
CREATE INDEX "Robot_enabled_updatedAt_idx" ON "Robot"("enabled", "updatedAt");

-- CreateIndex
CREATE INDEX "Strategy_robotId_active_idx" ON "Strategy"("robotId", "active");

-- CreateIndex
CREATE INDEX "Strategy_startHour_endHour_idx" ON "Strategy"("startHour", "endHour");
