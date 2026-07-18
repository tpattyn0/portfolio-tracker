-- CreateIndex
CREATE INDEX "Transaction_positionId_executedAt_idx" ON "Transaction"("positionId", "executedAt");
