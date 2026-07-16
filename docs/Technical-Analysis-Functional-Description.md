# Technical Analysis System - Functional Description

## Document Information
- **System**: Portfolio Tracker - Technical Analysis Module
- **Version**: 1.0
- **Date**: October 2025
- **Purpose**: Functional specification of the technical analysis scoring system

---

## 1. Executive Summary

The Technical Analysis System provides automated stock analysis using multiple technical indicators to generate buy/sell/hold signals. The system analyzes historical price data to calculate various indicators and combines them into a weighted scoring system that produces actionable trading signals.

---

## 2. System Overview

### 2.1 Purpose
The system helps investors make informed decisions by analyzing stock price movements through mathematical indicators that identify trends, momentum, and potential reversal points.

### 2.2 Key Features
- Multi-indicator technical analysis
- Weighted scoring algorithm
- Five-level signal classification
- Automatic calculation from historical price data
- Flexible data requirements (adapts to available data)

---

## 3. Technical Indicators

The system calculates seven primary technical indicators, each serving a specific purpose in market analysis.

### 3.1 Simple Moving Average (SMA)

**Purpose**: Identifies price trends by smoothing out short-term fluctuations.

**Calculation Periods**:
- **SMA 20**: 20-day moving average (short-term trend)
- **SMA 50**: 50-day moving average (medium-term trend)
- **SMA 200**: 200-day moving average (long-term trend)

**Interpretation**:
- Price above SMA → Bullish signal (upward trend)
- Price below SMA → Bearish signal (downward trend)

**Data Requirements**:
- SMA 20: Minimum 20 price points
- SMA 50: Minimum 50 price points
- SMA 200: Minimum 200 price points

---

### 3.2 Exponential Moving Average (EMA)

**Purpose**: Similar to SMA but gives more weight to recent prices, making it more responsive to new information.

**Calculation Periods**:
- **EMA 12**: 12-day exponential moving average
- **EMA 26**: 26-day exponential moving average

**Interpretation**:
- Used primarily for MACD calculation
- More sensitive to recent price changes than SMA

**Data Requirements**:
- EMA 12: Minimum 12 price points
- EMA 26: Minimum 26 price points

---

### 3.3 Relative Strength Index (RSI)

**Purpose**: Measures the speed and magnitude of price changes to identify overbought or oversold conditions.

**Calculation Period**: 14 days (RSI 14)

**Scale**: 0 to 100

**Interpretation**:
- **RSI < 30**: Oversold condition → Strong buy signal
- **RSI > 70**: Overbought condition → Strong sell signal
- **RSI > 50**: Above neutral → Moderate bullish
- **RSI < 50**: Below neutral → Moderate bearish

**Data Requirements**: Minimum 15 price points

---

### 3.4 Moving Average Convergence Divergence (MACD)

**Purpose**: Shows the relationship between two exponential moving averages to identify trend changes and momentum.

**Components**:
- **MACD Line**: Difference between 12-day EMA and 26-day EMA
- **Signal Line**: 9-day EMA of the MACD line
- **Histogram**: Difference between MACD line and Signal line

**Interpretation**:
- **MACD > Signal**: Bullish momentum
- **MACD < Signal**: Bearish momentum
- **Histogram > 0**: Increasing bullish momentum
- **Histogram < 0**: Increasing bearish momentum

**Data Requirements**: Minimum 35 price points

---

### 3.5 Bollinger Bands

**Purpose**: Measures market volatility and identifies potential price extremes.

**Components**:
- **Middle Band**: 20-day SMA
- **Upper Band**: Middle + (2 × standard deviation)
- **Lower Band**: Middle - (2 × standard deviation)

**Interpretation**:
- Price near upper band → Potentially overbought
- Price near lower band → Potentially oversold
- Band width indicates volatility

**Data Requirements**: Minimum 20 price points

---

### 3.6 Golden Cross / Death Cross

**Purpose**: Identifies major trend reversals based on moving average crossovers.

**Patterns**:
- **Golden Cross**: SMA 50 crosses above SMA 200 → Strong bullish signal
- **Death Cross**: SMA 50 crosses below SMA 200 → Strong bearish signal

**Interpretation**:
- SMA 50 > SMA 200 → Long-term bullish trend
- SMA 50 < SMA 200 → Long-term bearish trend

**Data Requirements**: Both SMA 50 and SMA 200 must be available

---

## 4. Signal Generation Algorithm

### 4.1 Weighted Scoring System

The system uses a weighted points system where each indicator contributes points based on its reliability and importance.

#### Weight Distribution:

| Indicator | Weight | Rationale |
|-----------|--------|-----------|
| RSI 14 | 5 | High reliability for momentum |
| Golden/Death Cross | 4 | Strong trend confirmation |
| MACD Signal | 4 | Reliable momentum indicator |
| SMA 20 vs Price | 3 | Short-term trend |
| SMA 50 vs Price | 3 | Medium-term trend |
| MACD Histogram | 2 | Additional momentum confirmation |
| SMA 200 vs Price | 2 | Long-term trend baseline |

**Total Maximum Weight**: 23 points

---

### 4.2 Point Allocation Rules

#### Moving Averages (SMA 20, 50, 200):
- **Current Price > SMA**: Add weight to bullish points
- **Current Price < SMA**: Add weight to bearish points

#### RSI Analysis:
- **RSI < 30 (Oversold)**: Add 5 points to bullish
- **RSI > 70 (Overbought)**: Add 5 points to bearish
- **30 ≤ RSI ≤ 70 and RSI > 50**: Add 2.5 points to bullish
- **30 ≤ RSI ≤ 70 and RSI < 50**: Add 2.5 points to bearish

#### MACD Analysis:
- **MACD > Signal Line**: Add 4 points to bullish
- **MACD < Signal Line**: Add 4 points to bearish
- **Histogram > 0**: Add 2 points to bullish
- **Histogram < 0**: Add 2 points to bearish

#### Golden/Death Cross:
- **SMA 50 > SMA 200**: Add 4 points to bullish
- **SMA 50 < SMA 200**: Add 4 points to bearish

---

### 4.3 Net Score Calculation

**Formula**:
```
Net Score = (Bullish Points - Bearish Points) / Total Weight
```

**Range**: -1.0 to +1.0

**Example Calculation**:
- Bullish Points: 15
- Bearish Points: 5
- Total Weight: 20
- Net Score = (15 - 5) / 20 = 0.5

---

### 4.4 Signal Classification

Based on the Net Score, the system generates one of five signals:

| Net Score Range | Signal | Meaning |
|----------------|---------|----------|
| ≥ 0.6 | **STRONG BUY** | Very bullish - multiple strong positive indicators |
| 0.2 to 0.6 | **BUY** | Moderately bullish - positive trend indicated |
| -0.2 to 0.2 | **HOLD** | Neutral - no clear trend or mixed signals |
| -0.6 to -0.2 | **SELL** | Moderately bearish - negative trend indicated |
| < -0.6 | **STRONG SELL** | Very bearish - multiple strong negative indicators |

---

## 5. Adaptive Data Requirements

### 5.1 Flexibility
The system adapts to available data, calculating only indicators for which sufficient data exists.

### 5.2 Minimum Requirements
- **Absolute Minimum**: 20 price points (allows basic SMA 20 and Bollinger Bands)
- **Recommended**: 200+ price points (enables all indicators)

### 5.3 Graceful Degradation
When insufficient data exists for certain indicators:
1. Those indicators are excluded from the calculation
2. Total weight is adjusted accordingly
3. Signal is generated from available indicators
4. If no indicators can be calculated, system returns "HOLD"

---

## 6. Example Scenario

### 6.1 Sample Stock Analysis

**Input Data**: 250 days of price history for Stock XYZ
- Current Price: $150
- Price trend: Upward over past months

**Calculated Indicators**:
- SMA 20: $145 → Price above (Bullish)
- SMA 50: $140 → Price above (Bullish)
- SMA 200: $135 → Price above (Bullish)
- RSI 14: 65 → Above 50, not overbought (Moderately Bullish)
- MACD: 2.5 (Signal: 1.8) → Above signal (Bullish)
- MACD Histogram: 0.7 → Positive (Bullish)
- Golden Cross: SMA 50 (140) > SMA 200 (135) → Active (Bullish)

**Point Calculation**:
- SMA 20 above: +3 bullish
- SMA 50 above: +3 bullish
- SMA 200 above: +2 bullish
- Golden Cross: +4 bullish
- RSI above 50: +2.5 bullish
- MACD above signal: +4 bullish
- MACD histogram positive: +2 bullish
- **Total Bullish: 20.5 points**
- **Total Bearish: 0 points**
- **Total Weight: 23 points**

**Net Score**: (20.5 - 0) / 23 = 0.89

**Signal**: **STRONG BUY** (Net Score ≥ 0.6)

---

## 7. Use Cases

### 7.1 Portfolio Review
**Scenario**: User wants to review all holdings
- System calculates technical signals for each position
- User can identify which stocks show strong buy/sell signals
- Helps in rebalancing decisions

### 7.2 New Investment Research
**Scenario**: User researching potential new stock purchase
- System analyzes technical indicators
- Provides objective signal based on price trends
- Complements fundamental analysis

### 7.3 Exit Strategy
**Scenario**: User holds profitable position
- System monitors for SELL or STRONG_SELL signals
- Helps identify optimal exit timing
- Prevents emotional decision-making

---

## 8. Limitations and Considerations

### 8.1 Data Quality
- **Accuracy depends on input**: Garbage in, garbage out
- **Historical data only**: Cannot predict unexpected events
- **Market hours**: Only reflects traded prices

### 8.2 Not Financial Advice
- **Tool for analysis**: Not a recommendation to buy or sell
- **One perspective**: Should be combined with fundamental analysis
- **User responsibility**: Final investment decisions rest with user

### 8.3 Market Conditions
- **Works best in trending markets**: Less reliable in sideways markets
- **Lagging indicators**: Based on past prices, not future predictions
- **External factors**: Cannot account for news, earnings, or macro events

---

## 9. System Benefits

### 9.1 Objectivity
- Removes emotional bias from analysis
- Consistent application of rules
- Quantifiable decision criteria

### 9.2 Efficiency
- Instant analysis of any stock
- Batch processing of entire portfolio
- Automated recalculation with new data

### 9.3 Educational Value
- Users learn technical analysis concepts
- Understanding of market momentum
- Pattern recognition development

---

## 10. Future Enhancements

### 10.1 Potential Additions
- Volume-based indicators (OBV, VWAP)
- Fibonacci retracement levels
- Support and resistance levels
- Pattern recognition (head & shoulders, triangles)
- Candlestick pattern analysis

### 10.2 Customization Options
- Adjustable indicator periods
- Custom weight assignments
- User-defined signal thresholds
- Indicator on/off toggles

---

## Appendix A: Glossary

**Moving Average**: Average price over a specified time period

**Momentum**: Rate of price change

**Overbought**: Price has risen too far too fast, correction likely

**Oversold**: Price has fallen too far too fast, bounce likely

**Crossover**: When one indicator crosses above/below another

**Volatility**: Degree of price variation over time

**Trend**: General direction of price movement

**Signal Line**: Moving average of another indicator (smoothing)

---

## Appendix B: References

**Technical Indicators Library**: technicalindicators npm package

**Calculation Methods**: Standard industry formulas for all indicators

**Best Practices**: Based on common technical analysis principles used by traders worldwide

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | October 2025 | Initial functional specification |

---

**End of Document**
