/*
  Warnings:

  - You are about to alter the column `targetPrice` on the `AnalystRating` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `averageRating` on the `AnalystRating` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(3,2)`.

*/
-- AlterTable
ALTER TABLE "public"."AnalystRating" ALTER COLUMN "targetPrice" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "averageRating" SET DATA TYPE DECIMAL(3,2);

-- CreateIndex
CREATE INDEX "AnalystRating_symbol_idx" ON "public"."AnalystRating"("symbol");
