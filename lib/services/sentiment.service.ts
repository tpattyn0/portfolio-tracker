// lib/services/sentiment.service.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { GEMINI_MODEL, createGeminiClient } from '@/lib/services/gemini';

interface SentimentResult {
  sentiment: number;        // -1 to 1
  sentimentLabel: string;   // negative, neutral, positive
  confidence: number;       // 0 to 1
  keyFactors: string[];
  impact: 'low' | 'medium' | 'high';
  aiSummary?: string;
}

export class SentimentAnalysisService {
  private genAI: GoogleGenerativeAI;
  
  constructor() {
    this.genAI = createGeminiClient();
  }
  
  async analyzeSentiment(
    title: string, 
    content: string | null,
    symbol?: string
  ): Promise<SentimentResult> {
    try {
      const model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
      
      const prompt = `
        Analyze the sentiment of this financial news article for stock market impact:
        
        Title: ${title}
        Content: ${content || 'N/A'}
        ${symbol ? `Related to stock: ${symbol}` : ''}
        
        Provide your analysis in the following JSON format:
        {
          "sentiment": <number between -1 and 1>,
          "sentimentLabel": <"negative", "neutral", or "positive">,
          "confidence": <number between 0 and 1>,
          "keyFactors": [<list of key factors affecting sentiment>],
          "impact": <"low", "medium", or "high">,
          "aiSummary": <brief 1-2 sentence summary of market impact>
        }
        
        Guidelines:
        - sentiment: -1 is very bearish, 0 is neutral, 1 is very bullish
        - confidence: how certain you are about the sentiment
        - impact: potential market impact of this news
        - Consider the financial and market implications
        
        Return only valid JSON.
      `;
      
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        sentiment: Math.max(-1, Math.min(1, parsed.sentiment)),
        sentimentLabel: parsed.sentimentLabel || this.getSentimentLabel(parsed.sentiment),
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        keyFactors: parsed.keyFactors || [],
        impact: parsed.impact || 'medium',
        aiSummary: parsed.aiSummary,
      };
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      // Return neutral sentiment on error
      return {
        sentiment: 0,
        sentimentLabel: 'neutral',
        confidence: 0.5,
        keyFactors: [],
        impact: 'low',
      };
    }
  }
  
  private getSentimentLabel(sentiment: number): string {
    if (sentiment > 0.3) return 'positive';
    if (sentiment < -0.3) return 'negative';
    return 'neutral';
  }
  
  async analyzeAndUpdateArticle(articleId: string): Promise<void> {
    const article = await prisma.newsArticle.findUnique({
      where: { id: articleId },
    });
    
    if (!article) return;
    
    const result = await this.analyzeSentiment(
      article.title,
      article.summary || article.content,
      article.symbols[0]
    );
    
    await prisma.newsArticle.update({
      where: { id: articleId },
      data: {
        sentiment: result.sentiment,
        sentimentLabel: result.sentimentLabel,
        confidence: result.confidence,
        impact: result.impact,
        aiSummary: result.aiSummary,
        keyPoints: result.keyFactors,
      },
    });
  }
  
  async calculateDailySentiment(symbol: string, date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const articles = await prisma.newsArticle.findMany({
      where: {
        symbols: { has: symbol },
        publishedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        sentiment: { not: null },
      },
    });
    
    if (articles.length === 0) return;
    
    const sentiments = articles.map(a => a.sentiment!);
    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    
    const positiveCount = sentiments.filter(s => s > 0.3).length;
    const negativeCount = sentiments.filter(s => s < -0.3).length;
    const neutralCount = sentiments.length - positiveCount - negativeCount;
    
    // Calculate weighted sentiment (by impact)
    const weightedSum = articles.reduce((sum, article) => {
      const weight = article.impact === 'high' ? 3 : article.impact === 'medium' ? 2 : 1;
      return sum + (article.sentiment! * weight);
    }, 0);
    
    const totalWeight = articles.reduce((sum, article) => {
      return sum + (article.impact === 'high' ? 3 : article.impact === 'medium' ? 2 : 1);
    }, 0);
    
    const weightedSentiment = totalWeight > 0 ? weightedSum / totalWeight : avgSentiment;
    
    await prisma.sentimentHistory.upsert({
      where: {
        symbol_date: {
          symbol,
          date: startOfDay,
        },
      },
      update: {
        avgSentiment,
        newsCount: articles.length,
        positiveCount,
        neutralCount,
        negativeCount,
        weightedSentiment,
      },
      create: {
        symbol,
        date: startOfDay,
        avgSentiment,
        newsCount: articles.length,
        positiveCount,
        neutralCount,
        negativeCount,
        weightedSentiment,
      },
    });
  }
}

export const sentimentService = new SentimentAnalysisService();