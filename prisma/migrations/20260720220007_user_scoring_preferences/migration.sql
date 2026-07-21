-- CreateTable
CREATE TABLE "UserScoringPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wCompositeIntrinsic" DOUBLE PRECISION,
    "wCompositeFundamental" DOUBLE PRECISION,
    "wCompositeTechnical" DOUBLE PRECISION,
    "wCompositeSentiment" DOUBLE PRECISION,
    "wCompositeAnalyst" DOUBLE PRECISION,
    "wFundValuation" DOUBLE PRECISION,
    "wFundProfitability" DOUBLE PRECISION,
    "wFundGrowth" DOUBLE PRECISION,
    "wFundFinancial" DOUBLE PRECISION,
    "wFundDividend" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserScoringPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserScoringPreferences_userId_key" ON "UserScoringPreferences"("userId");

-- CreateIndex
CREATE INDEX "UserScoringPreferences_userId_idx" ON "UserScoringPreferences"("userId");

-- AddForeignKey
ALTER TABLE "UserScoringPreferences" ADD CONSTRAINT "UserScoringPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
