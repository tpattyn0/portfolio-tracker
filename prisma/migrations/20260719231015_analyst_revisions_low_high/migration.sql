-- AlterTable
ALTER TABLE "AnalystRating" ADD COLUMN     "revisions" JSONB,
ADD COLUMN     "targetHighPrice" DECIMAL(10,2),
ADD COLUMN     "targetLowPrice" DECIMAL(10,2);
