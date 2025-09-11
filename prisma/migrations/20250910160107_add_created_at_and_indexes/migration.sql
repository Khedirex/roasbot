-- CreateIndex
CREATE INDEX "IngestEvent_game_casa_ts_idx" ON "IngestEvent"("game", "casa", "ts");

-- CreateIndex
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");
