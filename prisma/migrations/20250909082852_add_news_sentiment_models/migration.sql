-- CreateTable
CREATE TABLE "public"."NewsArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "sentiment" DOUBLE PRECISION,
    "sentimentLabel" TEXT,
    "confidence" DOUBLE PRECISION,
    "symbols" TEXT[],
    "topics" TEXT[],
    "relevanceScore" DOUBLE PRECISION,
    "aiSummary" TEXT,
    "keyPoints" JSONB,
    "impact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PortfolioInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "marketSummary" TEXT NOT NULL,
    "marketSentiment" DOUBLE PRECISION NOT NULL,
    "portfolioImpact" TEXT NOT NULL,
    "topRisks" JSONB NOT NULL,
    "opportunities" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SentimentHistory" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "avgSentiment" DOUBLE PRECISION NOT NULL,
    "newsCount" INTEGER NOT NULL,
    "positiveCount" INTEGER NOT NULL,
    "neutralCount" INTEGER NOT NULL,
    "negativeCount" INTEGER NOT NULL,
    "weightedSentiment" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentimentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_url_key" ON "public"."NewsArticle"("url");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "public"."NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_symbols_idx" ON "public"."NewsArticle"("symbols");

-- CreateIndex
CREATE INDEX "NewsArticle_sentiment_idx" ON "public"."NewsArticle"("sentiment");

-- CreateIndex
CREATE INDEX "PortfolioInsight_userId_idx" ON "public"."PortfolioInsight"("userId");

-- CreateIndex
CREATE INDEX "PortfolioInsight_date_idx" ON "public"."PortfolioInsight"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioInsight_userId_date_key" ON "public"."PortfolioInsight"("userId", "date");

-- CreateIndex
CREATE INDEX "SentimentHistory_symbol_idx" ON "public"."SentimentHistory"("symbol");

-- CreateIndex
CREATE INDEX "SentimentHistory_date_idx" ON "public"."SentimentHistory"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SentimentHistory_symbol_date_key" ON "public"."SentimentHistory"("symbol", "date");

-- AddForeignKey
ALTER TABLE "public"."PortfolioInsight" ADD CONSTRAINT "PortfolioInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
