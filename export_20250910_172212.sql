PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
);
INSERT INTO _prisma_migrations VALUES('96c1bd51-0632-4119-8654-5f7e15517efd','439ecea9b4059094f1e078234fe3e33c4ea02ee13f7c8aa4e4be9ef26950552e',1757451871467,'20250909210431_init_auth',NULL,NULL,1757451871451,1);
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO User VALUES('cmfd4mu6r00005z4io0jp82k8','Willian','marcelinow7@gmail.com','$2b$10$jSOSzCTJZNjO84n05hRRaeop69a5iZUazdBL37PDPdBNtBWBHhzjS',1757457189459,1757457189459);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
COMMIT;
