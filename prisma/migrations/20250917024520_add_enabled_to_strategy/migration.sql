-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Strategy" (
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
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Strategy_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Strategy" ("active", "blueThreshold", "createdAt", "endHour", "id", "messages", "mgCount", "name", "pattern", "pinkThreshold", "robotId", "startHour", "updatedAt", "winAt") SELECT "active", "blueThreshold", "createdAt", "endHour", "id", "messages", "mgCount", "name", "pattern", "pinkThreshold", "robotId", "startHour", "updatedAt", "winAt" FROM "Strategy";
DROP TABLE "Strategy";
ALTER TABLE "new_Strategy" RENAME TO "Strategy";
CREATE INDEX "Strategy_robotId_active_idx" ON "Strategy"("robotId", "active");
CREATE INDEX "Strategy_startHour_endHour_idx" ON "Strategy"("startHour", "endHour");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
