-- CreateTable
CREATE TABLE "public"."FundamentalData" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketCap" DOUBLE PRECISION,
    "enterpriseValue" DOUBLE PRECISION,
    "peRatio" DOUBLE PRECISION,
    "pegRatio" DOUBLE PRECISION,
    "psRatio" DOUBLE PRECISION,
    "pbRatio" DOUBLE PRECISION,
    "evToEbitda" DOUBLE PRECISION,
    "evToRevenue" DOUBLE PRECISION,
    "profitMargin" DOUBLE PRECISION,
    "operatingMargin" DOUBLE PRECISION,
    "netMargin" DOUBLE PRECISION,
    "roe" DOUBLE PRECISION,
    "roa" DOUBLE PRECISION,
    "roic" DOUBLE PRECISION,
    "revenueGrowth" DOUBLE PRECISION,
    "earningsGrowth" DOUBLE PRECISION,
    "ebitdaGrowth" DOUBLE PRECISION,
    "fcfGrowth" DOUBLE PRECISION,
    "currentRatio" DOUBLE PRECISION,
    "quickRatio" DOUBLE PRECISION,
    "debtToEquity" DOUBLE PRECISION,
    "debtToAssets" DOUBLE PRECISION,
    "interestCoverage" DOUBLE PRECISION,
    "dividendYield" DOUBLE PRECISION,
    "payoutRatio" DOUBLE PRECISION,
    "dividendGrowth" DOUBLE PRECISION,
    "eps" DOUBLE PRECISION,
    "bookValue" DOUBLE PRECISION,
    "fcfPerShare" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION,
    "incomeStatement" JSONB,
    "balanceSheet" JSONB,
    "cashFlow" JSONB,
    "fundamentalScore" DOUBLE PRECISION,
    "scoreDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundamentalData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IndustryComparison" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "avgPeRatio" DOUBLE PRECISION,
    "avgPbRatio" DOUBLE PRECISION,
    "avgPsRatio" DOUBLE PRECISION,
    "avgRoe" DOUBLE PRECISION,
    "avgProfitMargin" DOUBLE PRECISION,
    "avgDebtToEquity" DOUBLE PRECISION,
    "avgDividendYield" DOUBLE PRECISION,
    "pePercentile" DOUBLE PRECISION,
    "growthPercentile" DOUBLE PRECISION,
    "profitPercentile" DOUBLE PRECISION,
    "healthPercentile" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryComparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundamentalData_symbol_key" ON "public"."FundamentalData"("symbol");

-- CreateIndex
CREATE INDEX "FundamentalData_symbol_idx" ON "public"."FundamentalData"("symbol");

-- CreateIndex
CREATE INDEX "FundamentalData_lastUpdated_idx" ON "public"."FundamentalData"("lastUpdated");

-- CreateIndex
CREATE INDEX "IndustryComparison_industry_idx" ON "public"."IndustryComparison"("industry");

-- CreateIndex
CREATE INDEX "IndustryComparison_sector_idx" ON "public"."IndustryComparison"("sector");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryComparison_symbol_key" ON "public"."IndustryComparison"("symbol");
