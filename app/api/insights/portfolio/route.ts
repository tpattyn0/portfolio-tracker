// app/api/insights/portfolio/route.ts
// Add detailed logging version

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET(request: NextRequest) {
  console.log('=== Portfolio Insights API Called ===');
  
  try {
    const session = await getServerSession(authOptions);
    console.log('Session:', session?.user?.email);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user with their portfolio
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
      console.log('User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    console.log('User found:', user.id);
    console.log('Portfolio positions:', user.portfolio?.positions?.length || 0);
    
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
      console.log('Returning existing insight from today');
      return NextResponse.json(existingInsight);
    }
    
    // Get positions from user's portfolio
    const positions = user.portfolio?.positions || [];
    
    if (positions.length === 0) {
      console.log('No positions found');
      return NextResponse.json({
        marketSummary: 'No positions in portfolio to analyze',
        marketSentiment: 0,
        portfolioImpact: 'Add positions to receive personalized insights',
        topRisks: [],
        opportunities: [],
        recommendations: ['Add stocks to your portfolio to get started'],
      });
    }
    
    // Check Gemini API key
    const geminiKey = process.env.GEMINI_API_KEY;
    console.log('GEMINI_API_KEY exists:', !!geminiKey);
    console.log('GEMINI_API_KEY length:', geminiKey?.length || 0);
    
    if (!geminiKey) {
      console.log('GEMINI_API_KEY not configured');
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
      console.log('Initializing Gemini AI...');
      const genAI = new GoogleGenerativeAI(geminiKey);
      
      // Try different model names
      let model;
      let modelName = "gemini-1.5-flash";
      
      try {
        model = genAI.getGenerativeModel({ model: modelName });
        console.log(`Using model: ${modelName}`);
      } catch (modelError) {
        console.log(`Failed with ${modelName}, trying gemini-1.5-pro`);
        modelName = "gemini-1.5-pro";
        try {
          model = genAI.getGenerativeModel({ model: modelName });
        } catch (modelError2) {
          console.log(`Failed with ${modelName}, trying gemini-pro`);
          modelName = "gemini-pro";
          model = genAI.getGenerativeModel({ model: modelName });
        }
      }
      
      // Simplified prompt
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
      
      console.log('Sending prompt to Gemini...');
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      console.log('Gemini response received, length:', response.length);
      
      // Extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response:', response.substring(0, 200));
        throw new Error('Invalid AI response format');
      }
      
      const insights = JSON.parse(jsonMatch[0]);
      console.log('Parsed insights successfully');
      
      // Save insight
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
      
      console.log('Insight saved successfully');
      return NextResponse.json(savedInsight);
      
    } catch (aiError: any) {
      console.error('AI generation error details:', {
        message: aiError.message,
        status: aiError.status,
        statusText: aiError.statusText,
        name: aiError.name
      });
      
      // Create fallback with more specific error info
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
  } catch (error: any) {
    console.error('Main error in insights API:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights', details: error.message },
      { status: 500 }
    );
  }
}