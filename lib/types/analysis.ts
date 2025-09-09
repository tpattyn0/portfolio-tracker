export interface TechnicalIndicator {
  name: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume';
  rawValue: number | null;
  interpretation: 'Bullish' | 'Neutral' | 'Bearish';
  score: number; // -1 to +1
  baseWeight: number;
  dynamicMultiplier: number;
  effectiveWeight: number;
  contribution: number;
}

export interface MarketRegime {
  trendStrength: number; // 0-1, from ADX
  volatility: number; // 0-1, from ATR/Bollinger
  adx: number;
  atr: number;
  bollingerBandWidth: number;
}

export interface RiskMetrics {
  suggestedStopLoss: number;
  stopDistance: number;
  positionSizeShares: number;
  maxRiskAmount: number;
  riskRewardRatio: number;
}

export interface EnhancedTechnicalAnalysis {
  // Core analysis
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  netScore: number; // -1 to +1
  score10: number; // 0-10
  
  // Confidence metrics
  weightedConfidence: number; // 0-100%
  agreementRatio: number; // 0-100%
  activeIndicators: number;
  
  // Market regime
  marketRegime: MarketRegime;
  
  // Risk management
  riskMetrics: RiskMetrics;
  
  // Detailed breakdown
  indicators: TechnicalIndicator[];
  
  // Explanations
  summary: string;
  detailedReasoning: string[];
  
  // Metadata
  timestamp: Date;
  dataPoints: number;
  timeframe: 'daily' | 'weekly' | 'monthly';
}

export interface MultiTimeframeAnalysis {
  daily: EnhancedTechnicalAnalysis | null;
  weekly: EnhancedTechnicalAnalysis | null;
  monthly: EnhancedTechnicalAnalysis | null;
  alignment: 'Aligned' | 'Divergent' | 'Mixed';
  primarySignal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
}