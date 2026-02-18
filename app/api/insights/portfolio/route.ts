import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        portfolio: {
          include: {
            positions: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check for existing insight today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingInsight = await prisma.portfolioInsight.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
    });

    if (existingInsight) {
      return NextResponse.json(existingInsight);
    }

    const positions = user.portfolio?.positions || [];

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

    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      const basicInsight = await prisma.portfolioInsight.create({
        data: {
          userId: user.id,
          date: today,
          marketSummary: 'Configure Gemini API key for AI-powered insights',
          marketSentiment: 0,
          portfolioImpact: 'AI analysis not available - API key missing',
          topRisks: ['AI service not configured'],
          opportunities: [],
          recommendations: ['Add GEMINI_API_KEY to environment variables'],
        },
      });
      return NextResponse.json(basicInsight);
    }

    try {
      const genAI = new GoogleGenerativeAI(geminiKey);

      // Try different model names
      let model;
      const modelName = "gemini-1.5-flash";

      try {
        model = genAI.getGenerativeModel({ model: modelName });
      } catch {
        try {
          model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        } catch {
          model = genAI.getGenerativeModel({ model: "gemini-pro" });
        }
      }

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
          userId: user.id,
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

      const fallbackInsight = await prisma.portfolioInsight.create({
        data: {
          userId: user.id,
          date: today,
          marketSummary: 'AI analysis temporarily unavailable',
          marketSentiment: 0,
          portfolioImpact: 'Unable to generate AI insights at this time',
          topRisks: ['Service temporarily unavailable'],
          opportunities: [],
          recommendations: ['Try again later for AI-powered insights'],
        },
      });

      return NextResponse.json(fallbackInsight);
    }
  } catch (error: unknown) {
    console.error('Insights API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
