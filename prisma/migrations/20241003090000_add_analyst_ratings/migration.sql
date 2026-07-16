-- CreateTable
CREATE TABLE "AnalystRating" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "targetPrice" DOUBLE PRECISION,
    "strongBuy" INTEGER NOT NULL DEFAULT 0,
    "buy" INTEGER NOT NULL DEFAULT 0,
    "hold" INTEGER NOT NULL DEFAULT 0,
    "sell" INTEGER NOT NULL DEFAULT 0,
    "strongSell" INTEGER NOT NULL DEFAULT 0,
    "totalAnalysts" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "scoreInterpretation" TEXT NOT NULL DEFAULT 'No analyst data available',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalystRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalystRating_symbol_key" ON "AnalystRating"("symbol");
