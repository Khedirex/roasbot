-- CreateTable
CREATE TABLE "SignalCursor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "robotId" TEXT NOT NULL,
    "lastTs" BIGINT NOT NULL DEFAULT 0,
    "lastId" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StrategyState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT NOT NULL,
    "tail" INTEGER NOT NULL DEFAULT 0,
    "lastTs" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SignalDispatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "robotId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tail" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SignalCursor_lastTs_updatedAt_idx" ON "SignalCursor"("lastTs", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SignalCursor_robotId_key" ON "SignalCursor"("robotId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyState_strategyId_key" ON "StrategyState"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalDispatch_dedupeKey_key" ON "SignalDispatch"("dedupeKey");

-- CreateIndex
CREATE INDEX "SignalDispatch_robotId_strategyId_createdAt_idx" ON "SignalDispatch"("robotId", "strategyId", "createdAt");
