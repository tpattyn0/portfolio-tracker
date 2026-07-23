import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/utils/auth';
import { prisma } from '@/lib/prisma';
import { GEMINI_MODEL, getGeminiApiKey, createGeminiClient } from '@/lib/services/gemini';

export async function GET() {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: auth.userId },
      include: {
        positions: {
          where: {
            quantity: {
              gt: 0, // Only current holdings — a fully-sold position keeps its
              // row at quantity 0 (never deleted, see ADR-18) and must not
              // leak into the AI prompt as if still held.
            },
          },
        },
      },
    });

    // Check for existing insight today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingInsight = await prisma.portfolioInsight.findUnique({
      where: {
        userId_date: {
          userId: auth.userId,
          date: today,
        },
      },
    });

    if (existingInsight) {
      return NextResponse.json(existingInsight);
    }

    const positions = portfolio?.positions || [];

    if (positions.length === 0) {
      return NextResponse.json({
        marketSummary: 'No positions in portfolio to analyze',
        marketSentiment: 0,
        portfolioImpact: 'Add positions to receive personalized insights',
        topRisks: [],
        opportunities: [],
        recommendations: ['Add stocks to your portfolio to get started'],
      });
    }

    const geminiKey = getGeminiApiKey();

    // AUD-10: don't persist the "not configured" placeholder as today's cached
    // insight — a single request made before the key is set would otherwise
    // pin this message in PortfolioInsight for the rest of the day (the
    // userId_date unique key + existing-insight early-return above means the
    // next request just returns the stale row). Return it transiently instead;
    // a later request the same day can still succeed once the key is set.
    if (!geminiKey) {
      return NextResponse.json({
        marketSummary: 'Configure Gemini API key for AI-powered insights',
        marketSentiment: 0,
        portfolioImpact: 'AI analysis not available - API key missing',
        topRisks: ['AI service not configured'],
        opportunities: [],
        recommendations: ['Add GEMINI_API_KEY to environment variables'],
      });
    }

    try {
      const genAI = createGeminiClient(geminiKey);
      // AUD-07: this was the only Gemini call site with a nested-fallback
      // try/catch. `getGenerativeModel` never throws on an unrecognized model
      // name (it only fails at `generateContent` time), so the fallback
      // branches were dead code — removed. Both Gemini call sites in this repo
      // (here and sentiment.service.ts) now share the model name via the
      // `GEMINI_MODEL` constant (`lib/services/gemini.ts`) — change it once,
      // in one place, to update both.
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      const prompt = `
        You are a financial analyst. Analyze this portfolio and provide brief insights.

        Portfolio: ${positions.length} positions
        Symbols: ${positions.map(p => p.ticker).join(', ')}

        Respond with this exact JSON structure (no other text):
        {
          "marketSummary": "One sentence about market conditions",
          "marketSentiment": 0,
          "portfolioImpact": "One sentence about portfolio impact",
          "topRisks": ["risk 1", "risk 2"],
          "opportunities": ["opportunity 1"],
          "recommendations": ["recommendation 1"]
        }
      `;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI response format');
      }

      const insights = JSON.parse(jsonMatch[0]);

      const savedInsight = await prisma.portfolioInsight.create({
        data: {
          userId: auth.userId,
          date: today,
          marketSummary: insights.marketSummary || 'Analysis complete',
          marketSentiment: parseFloat(insights.marketSentiment) || 0,
          portfolioImpact: insights.portfolioImpact || 'Portfolio analyzed',
          topRisks: insights.topRisks || ['Market volatility'],
          opportunities: insights.opportunities || ['Monitor market'],
          recommendations: insights.recommendations || ['Review positions'],
        },
      });

      return NextResponse.json(savedInsight);

    } catch (aiError: unknown) {
      console.error('AI generation error:', aiError instanceof Error ? aiError.message : aiError);

      // AUD-10: return the fallback without persisting it — a transient
      // Gemini failure should not pin "AI analysis temporarily unavailable"
      // as the cached result for the rest of the day.
      return NextResponse.json({
        marketSummary: 'AI analysis temporarily unavailable',
        marketSentiment: 0,
        portfolioImpact: 'Unable to generate AI insights at this time',
        topRisks: ['Service temporarily unavailable'],
        opportunities: [],
        recommendations: ['Try again later for AI-powered insights'],
      });
    }
  } catch (error: unknown) {
    console.error('Insights API error:', error);
    // AUD-06: don't echo raw error.message to the client.
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
