import React from 'react';

const TechnicalAnalysisSpec = () => {
  return (
    <div className="max-w-4xl mx-auto p-8 bg-white">
      <style>
        {`
          @media print {
            .no-print { display: none; }
            body { margin: 0; }
          }
          h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 0.5rem; margin-top: 2rem; }
          h2 { color: #2563eb; border-bottom: 2px solid #93c5fd; padding-bottom: 0.3rem; margin-top: 1.5rem; }
          h3 { color: #3b82f6; margin-top: 1rem; }
          table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
          th { background-color: #dbeafe; padding: 0.75rem; text-align: left; font-weight: 600; border: 1px solid #93c5fd; }
          td { padding: 0.75rem; border: 1px solid #e5e7eb; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .info-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; }
          .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; margin: 1rem 0; }
          .highlight { background-color: #fef08a; padding: 0.1rem 0.3rem; }
          .new-badge { background-color: #10b981; color: white; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem; }
          .updated-badge { background-color: #3b82f6; color: white; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem; }
        `}
      </style>

      {/* Title Page */}
      <div className="text-center mb-12 pb-8 border-b-4 border-blue-600">
        <h1 className="text-4xl font-bold mb-4 border-b-0">Technical Analysis System</h1>
        <h2 className="text-2xl text-gray-700 mb-8 border-b-0">Functional Specification</h2>
        
        <div className="bg-blue-50 p-6 rounded-lg inline-block">
          <p className="text-sm mb-2"><strong>System:</strong> Portfolio Tracker - Technical Analysis Module</p>
          <p className="text-sm mb-2"><strong>Version:</strong> 2.0</p>
          <p className="text-sm mb-2"><strong>Date:</strong> October 2025</p>
          <p className="text-sm"><strong>Status:</strong> Updated Specification</p>
        </div>
      </div>

      {/* Document Control */}
      <div className="mb-8">
        <h2>Document Control</h2>
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Date</th>
              <th>Changes</th>
              <th>Author</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1.0</td>
              <td>October 2025</td>
              <td>Initial functional specification</td>
              <td>Original Team</td>
            </tr>
            <tr>
              <td>2.0</td>
              <td>October 2025</td>
              <td>Major revision: Added volume analysis, rebalanced weights, improved scoring logic, added confidence metrics</td>
              <td>Functional Analysis Team</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Executive Summary */}
      <div className="mb-8">
        <h2>1. Executive Summary</h2>
        <p className="mb-4">
          The Technical Analysis System provides automated stock analysis using multiple technical indicators to generate buy/sell/hold signals with confidence metrics. Version 2.0 introduces significant improvements including volume analysis, enhanced scoring logic, and transparent confidence reporting.
        </p>
        
        <div className="info-box">
          <h3 className="text-lg font-semibold mb-2">Key Improvements in Version 2.0</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Volume analysis integration for signal confirmation</li>
            <li>Stochastic Oscillator for enhanced momentum detection</li>
            <li>Full Bollinger Bands utilization with defined scoring rules</li>
            <li>Rebalanced indicator weights (total: 30 points)</li>
            <li>Refined RSI interpretation separating momentum from reversal signals</li>
            <li>Confidence scoring based on data availability</li>
            <li>Detailed signal breakdown for transparency</li>
            <li>More granular signal classifications</li>
          </ul>
        </div>
      </div>

      {/* System Overview */}
      <div className="mb-8">
        <h2>2. System Overview</h2>
        
        <h3>2.1 Purpose</h3>
        <p className="mb-4">
          The system helps investors make informed decisions by analyzing stock price movements and volume through mathematical indicators that identify trends, momentum, volatility, and potential reversal points. The system provides not only a signal but also the reasoning and confidence level behind that signal.
        </p>

        <h3>2.2 Key Features</h3>
        <ul className="list-disc ml-6 mb-4 space-y-1">
          <li>Multi-indicator technical analysis (9 indicators)</li>
          <li>Volume-confirmed signals</li>
          <li>Weighted scoring algorithm with rebalanced weights</li>
          <li>Seven-level signal classification</li>
          <li>Confidence metrics based on data availability and indicator agreement</li>
          <li>Transparent signal breakdown showing contributing indicators</li>
          <li>Automatic calculation from historical price and volume data</li>
          <li>Flexible data requirements with graceful degradation</li>
          <li>Divergence detection capabilities</li>
        </ul>

        <h3>2.3 Design Principles</h3>
        <ul className="list-disc ml-6 mb-4 space-y-1">
          <li><strong>Transparency:</strong> Users see which indicators contributed to the signal</li>
          <li><strong>Confidence:</strong> System reports reliability based on data completeness and indicator agreement</li>
          <li><strong>Context:</strong> Signals consider market regime and trend strength</li>
          <li><strong>Balance:</strong> No single indicator dominates; confirmation required from multiple sources</li>
          <li><strong>Practicality:</strong> Adapts to available data while maintaining quality standards</li>
        </ul>
      </div>

      {/* Technical Indicators */}
      <div className="mb-8">
        <h2>3. Technical Indicators</h2>
        <p className="mb-4">
          The system calculates nine primary technical indicators, each serving a specific purpose in market analysis. Indicators are grouped into categories: Trend, Momentum, Volatility, and Volume.
        </p>

        <h3>3.1 Trend Indicators</h3>
        
        <div className="ml-4 mb-6">
          <h4 className="font-semibold text-base mb-2">3.1.1 Simple Moving Average (SMA)</h4>
          <p className="mb-2"><strong>Purpose:</strong> Identifies price trends by smoothing out short-term fluctuations.</p>
          
          <p className="mb-2"><strong>Calculation Periods:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li><strong>SMA 20:</strong> 20-day moving average (short-term trend)</li>
            <li><strong>SMA 50:</strong> 50-day moving average (medium-term trend)</li>
            <li><strong>SMA 200:</strong> 200-day moving average (long-term trend)</li>
          </ul>

          <p className="mb-2"><strong>Interpretation:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>Price above SMA → Bullish signal (upward trend)</li>
            <li>Price below SMA → Bearish signal (downward trend)</li>
          </ul>

          <p className="mb-2"><strong>Data Requirements:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>SMA 20: Minimum 25 price points (20 for calculation + 5 warm-up)</li>
            <li>SMA 50: Minimum 55 price points (50 for calculation + 5 warm-up)</li>
            <li>SMA 200: Minimum 205 price points (200 for calculation + 5 warm-up)</li>
          </ul>
        </div>

        <div className="ml-4 mb-6">
          <h4 className="font-semibold text-base mb-2">3.1.2 Exponential Moving Average (EMA)</h4>
          <p className="mb-2"><strong>Purpose:</strong> Similar to SMA but gives more weight to recent prices, making it more responsive to new information.</p>
          
          <p className="mb-2"><strong>Calculation Periods:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li><strong>EMA 12:</strong> 12-day exponential moving average</li>
            <li><strong>EMA 26:</strong> 26-day exponential moving average</li>
          </ul>

          <p className="mb-2"><strong>Interpretation:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>Used primarily for MACD calculation</li>
            <li>More sensitive to recent price changes than SMA</li>
          </ul>

          <p className="mb-2"><strong>Data Requirements:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>EMA 12: Minimum 15 price points</li>
            <li>EMA 26: Minimum 30 price points</li>
          </ul>
        </div>

        <div className="ml-4 mb-6">
          <h4 className="font-semibold text-base mb-2">3.1.3 Golden Cross / Death Cross</h4>
          <p className="mb-2"><strong>Purpose:</strong> Identifies major trend reversals based on moving average crossovers.</p>
          
          <p className="mb-2"><strong>Patterns:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li><strong>Golden Cross:</strong> SMA 50 crosses above SMA 200 → Strong bullish signal</li>
            <li><strong>Death Cross:</strong> SMA 50 crosses below SMA 200 → Strong bearish signal</li>
          </ul>

          <p className="mb-2"><strong>Interpretation:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>SMA 50 &gt; SMA 200 → Long-term bullish trend</li>
            <li>SMA 50 &lt; SMA 200 → Long-term bearish trend</li>
          </ul>

          <p className="mb-2"><strong>Data Requirements:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>Both SMA 50 and SMA 200 must be available (minimum 205 price points)</li>
          </ul>
        </div>

        <h3>3.2 Momentum Indicators <span className="updated-badge">UPDATED</span></h3>
        
        <div className="ml-4 mb-6">
          <h4 className="font-semibold text-base mb-2">3.2.1 Relative Strength Index (RSI) <span className="updated-badge">UPDATED</span></h4>
          <p className="mb-2"><strong>Purpose:</strong> Measures the speed and magnitude of price changes to identify overbought or oversold conditions and momentum strength.</p>
          
          <p className="mb-2"><strong>Calculation Period:</strong> 14 days (RSI 14)</p>
          <p className="mb-2"><strong>Scale:</strong> 0 to 100</p>

          <div className="warning-box">
            <p className="font-semibold mb-2">Version 2.0 Change: Enhanced RSI Interpretation</p>
            <p className="text-sm">RSI signals are now categorized into momentum signals and reversal signals to provide more accurate context.</p>
          </div>

          <p className="mb-2"><strong>Interpretation:</strong></p>
          <table className="text-sm">
            <thead>
              <tr>
                <th>RSI Range</th>
                <th>Signal Type</th>
                <th>Meaning</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>&lt; 30</td>
                <td>Reversal Signal</td>
                <td>Oversold - potential bounce opportunity</td>
                <td>+4 bullish</td>
              </tr>
              <tr>
                <td>30-50</td>
                <td>Momentum Signal</td>
                <td>Below neutral - bearish momentum</td>
                <td>+2 bearish</td>
              </tr>
              <tr>
                <td>50-70</td>
                <td>Momentum Signal</td>
                <td>Above neutral - bullish momentum</td>
                <td>+2 bullish</td>
              </tr>
              <tr>
                <td>&gt; 70</td>
                <td>Reversal Signal</td>
                <td>Overbought - potential correction</td>
                <td>+4 bearish</td>
              </tr>
            </tbody>
          </table>

          <p className="mb-2 mt-4"><strong>Data Requirements:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>Minimum 20 price points (14 for calculation + 6 warm-up period)</li>
          </ul>
        </div>

        <div className="ml-4 mb-6">
          <h4 className="font-semibold text-base mb-2">3.2.2 Moving Average Convergence Divergence (MACD) <span className="updated-badge">UPDATED</span></h4>
          <p className="mb-2"><strong>Purpose:</strong> Shows the relationship between two exponential moving averages to identify trend changes and momentum.</p>
          
          <p className="mb-2"><strong>Components:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li><strong>MACD Line:</strong> Difference between 12-day EMA and 26-day EMA</li>
            <li><strong>Signal Line:</strong> 9-day EMA of the MACD line</li>
          </ul>

          <div className="warning-box">
            <p className="font-semibold mb-2">Version 2.0 Change: Removed MACD Histogram</p>
            <p className="text-sm">The histogram has been removed to eliminate redundancy since it represents the same information as the MACD/Signal relationship.</p>
          </div>

          <p className="mb-2"><strong>Interpretation:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>MACD &gt; Signal: Bullish momentum</li>
            <li>MACD &lt; Signal: Bearish momentum</li>
          </ul>

          <p className="mb-2"><strong>Data Requirements:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>Minimum 40 price points (26 + 9 + 5 warm-up)</li>
          </ul>
        </div>

        <div className="ml-4 mb-6">
          <h4 className="font-semibold text-base mb-2">3.2.3 Stochastic Oscillator <span className="new-badge">NEW</span></h4>
          <p className="mb-2"><strong>Purpose:</strong> Compares a stock's closing price to its price range over a specific period to identify momentum and potential reversal points.</p>
          
          <p className="mb-2"><strong>Calculation:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li><strong>%K Line:</strong> 14-period stochastic</li>
            <li><strong>%D Line:</strong> 3-period SMA of %K (signal line)</li>
          </ul>

          <p className="mb-2"><strong>Scale:</strong> 0 to 100</p>

          <p className="mb-2"><strong>Interpretation:</strong></p>
          <table className="text-sm">
            <thead>
              <tr>
                <th>Condition</th>
                <th>Signal</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>%K &lt; 20</td>
                <td>Oversold - bullish reversal potential</td>
                <td>+3 bullish</td>
              </tr>
              <tr>
                <td>%K &gt; 80</td>
                <td>Overbought - bearish reversal potential</td>
                <td>+3 bearish</td>
              </tr>
              <tr>
                <td>%K crosses above %D (20-80 range)</td>
                <td>Bullish momentum</td>
                <td>+1.5 bullish</td>
              </tr>
              <tr>
                <td>%K crosses below %D (20-80 range)</td>
                <td>Bearish momentum</td>
                <td>+1.5 bearish</td>
              </tr>
            </tbody>
          </table>

          <p className="mb-2 mt-4"><strong>Data Requirements:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>Minimum 20 price points (14 + 3 + 3 warm-up)</li>
          </ul>
        </div>

        <h3>3.3 Volatility Indicators <span className="updated-badge">UPDATED</span></h3>
        
        <div className="ml-4 mb-6">
          <h4 className="font-semibold text-base mb-2">3.3.1 Bollinger Bands <span className="updated-badge">UPDATED</span></h4>
          <p className="mb-2"><strong>Purpose:</strong> Measures market volatility and identifies potential price extremes and reversal points.</p>
          
          <p className="mb-2"><strong>Components:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li><strong>Middle Band:</strong> 20-day SMA</li>
            <li><strong>Upper Band:</strong> Middle + (2 × standard deviation)</li>
            <li><strong>Lower Band:</strong> Middle - (2 × standard deviation)</li>
          </ul>

          <div className="info-box">
            <p className="font-semibold mb-2">Version 2.0 Enhancement</p>
            <p className="text-sm">Bollinger Bands now have explicit scoring rules and are fully integrated into the signal generation algorithm.</p>
          </div>

          <p className="mb-2"><strong>Interpretation & Scoring:</strong></p>
          <table className="text-sm">
            <thead>
              <tr>
                <th>Price Position</th>
                <th>Signal</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Price &gt; Upper Band</td>
                <td>Potentially overbought - caution</td>
                <td>+3 bearish</td>
              </tr>
              <tr>
                <td>Price &lt; Lower Band</td>
                <td>Potentially oversold - opportunity</td>
                <td>+3 bullish</td>
              </tr>
              <tr>
                <td>Price between Middle and Upper</td>
                <td>Bullish zone</td>
                <td>+1.5 bullish</td>
              </tr>
              <tr>
                <td>Price between Middle and Lower</td>
                <td>Bearish zone</td>
                <td>+1.5 bearish</td>
              </tr>
              <tr>
                <td>Bandwidth expanding</td>
                <td>Increasing volatility - trend confirmation</td>
                <td>Context dependent</td>
              </tr>
              <tr>
                <td>Bandwidth contracting (squeeze)</td>
                <td>Decreasing volatility - breakout pending</td>
                <td>Neutral (awaiting direction)</td>
              </tr>
            </tbody>
          </table>

          <p className="mb-2 mt-4"><strong>Data Requirements:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>Minimum 25 price points (20 for SMA + 5 warm-up)</li>
          </ul>
        </div>

        <h3>3.4 Volume Indicators <span className="new-badge">NEW</span></h3>
        
        <div className="ml-4 mb-6">
          <h4 className="font-semibold text-base mb-2">3.4.1 Volume Trend Analysis <span className="new-badge">NEW</span></h4>
          <p className="mb-2"><strong>Purpose:</strong> Confirms price movements by analyzing trading volume. Volume validates the strength of price trends.</p>
          
          <p className="mb-2"><strong>Calculation:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>Compare current volume to 20-day average volume</li>
            <li>Analyze volume direction with price direction</li>
          </ul>

          <div className="info-box">
            <p className="font-semibold mb-2">Why Volume Matters</p>
            <p className="text-sm">Price increases on high volume are more reliable than those on low volume. Volume confirms the conviction behind price movements.</p>
          </div>

          <p className="mb-2"><strong>Interpretation & Scoring:</strong></p>
          <table className="text-sm">
            <thead>
              <tr>
                <th>Condition</th>
                <th>Signal</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Price ↑ + Volume ↑ (&gt;20% above avg)</td>
                <td>Strong bullish confirmation</td>
                <td>+4 bullish</td>
              </tr>
              <tr>
                <td>Price ↓ + Volume ↑ (&gt;20% above avg)</td>
                <td>Strong bearish confirmation</td>
                <td>+4 bearish</td>
              </tr>
              <tr>
                <td>Price ↑ + Volume ↓ (&lt;20% below avg)</td>
                <td>Weak bullish move - caution</td>
                <td>+1 bearish</td>
              </tr>
              <tr>
                <td>Price ↓ + Volume ↓ (&lt;20% below avg)</td>
                <td>Weak bearish move - potential reversal</td>
                <td>+1 bullish</td>
              </tr>
              <tr>
                <td>Volume within normal range (±20%)</td>
                <td>Neutral - no strong conviction</td>
                <td>0 points</td>
              </tr>
            </tbody>
          </table>

          <p className="mb-2 mt-4"><strong>Data Requirements:</strong></p>
          <ul className="list-disc ml-6 mb-2">
            <li>Minimum 25 volume data points (20 for average + 5 for trend)</li>
          </ul>
        </div>
      </div>

      {/* Signal Generation Algorithm */}
      <div className="mb-8">
        <h2>4. Signal Generation Algorithm <span className="updated-badge">UPDATED</span></h2>

        <h3>4.1 Weighted Scoring System <span className="updated-badge">UPDATED</span></h3>
        <p className="mb-4">
          The system uses a rebalanced weighted points system where each indicator contributes points based on its reliability, importance, and to avoid redundancy.
        </p>

        <div className="warning-box mb-4">
          <p className="font-semibold mb-2">Major Change from Version 1.0</p>
          <p className="text-sm">Total weight increased from 23 to 30 points for cleaner mathematics. MACD histogram removed, volume and stochastic added, RSI and Bollinger weights adjusted.</p>
        </div>

        <h4 className="font-semibold mb-2">Weight Distribution:</h4>
        <table>
          <thead>
            <tr>
              <th>Indicator</th>
              <th>Weight</th>
              <th>Change</th>
              <th>Rationale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Golden/Death Cross</td>
              <td className="font-semibold">5</td>
              <td className="text-green-600">+1</td>
              <td>Strongest long-term trend signal</td>
            </tr>
            <tr>
              <td>Volume Trend</td>
              <td className="font-semibold">4</td>
              <td className="text-green-600">NEW</td>
              <td>Essential confirmation of price moves</td>
            </tr>
            <tr>
              <td>RSI 14</td>
              <td className="font-semibold">4</td>
              <td className="text-blue-600">-1</td>
              <td>High reliability but not dominant</td>
            </tr>
            <tr>
              <td>SMA 20 vs Price</td>
              <td className="font-semibold">3</td>
              <td className="text-gray-600">0</td>
              <td>Short-term trend indicator</td>
            </tr>
            <tr>
              <td>SMA 50 vs Price</td>
              <td className="font-semibold">3</td>
              <td className="text-gray-600">0</td>
              <td>Medium-term trend indicator</td>
            </tr>
            <tr>
              <td>MACD Signal</td>
              <td className="font-semibold">3</td>
              <td className="text-blue-600">-1</td>
              <td>Reliable momentum, reduced to avoid double-counting</td>
            </tr>
            <tr>
              <td>Stochastic Oscillator</td>
              <td className="font-semibold">3</td>
              <td className="text-green-600">NEW</td>
              <td>Momentum and reversal confirmation</td>
            </tr>
            <tr>
              <td>Bollinger Bands Position</td>
              <td className="font-semibold">3</td>
              <td className="text-green-600">NEW</td>
              <td>Volatility context and extremes</td>
            </tr>
            <tr>
              <td>SMA 200 vs Price</td>
              <td className="font-semibold">2</td>
              <td className="text-gray-600">0</td>
              <td>Long-term trend baseline</td>
            </tr>
            <tr>
              <td>MACD Histogram</td>
              <td className="font-semibold">-</td>
              <td className="text-red-600">REMOVED</td>
              <td>Redundant with MACD signal</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="font-bold bg-blue-100">
              <td>Total Maximum Weight</td>
              <td>30</td>
              <td>+7</td>
              <td>Cleaner calculation basis</td>
            </tr>
          </tfoot>
        </table>

        <h3>4.2 Point Allocation Rules <span className="updated-badge">UPDATED</span></h3>

        <h4 className="font-semibold mb-2 mt-4">Trend Indicators (Moving Averages):</h4>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>SMA 20 vs Price:</strong>
            <ul className="list-circle ml-6">
              <li>Current Price &gt; SMA 20: +3 bullish points</li>
              <li>Current Price &lt; SMA 20: +3 bearish points</li>
            </ul>
          </li>
          <li><strong>SMA 50 vs Price:</strong>
            <ul className="list-circle ml-6">
              <li>Current Price &gt; SMA 50: +3 bullish points</li>
              <li>Current Price &lt; SMA 50: +3 bearish points</li>
            </ul>
          </li>
          <li><strong>SMA 200 vs Price:</strong>
            <ul className="list-circle ml-6">
              <li>Current Price &gt; SMA 200: +2 bullish points</li>
              <li>Current Price &lt; SMA 200: +2 bearish points</li>
            </ul>
          </li>
          <li><strong>Golden/Death Cross:</strong>
            <ul className="list-circle ml-6">
              <li>SMA 50 &gt; SMA 200: +5 bullish points</li>
              <li>SMA 50 &lt; SMA 200: +5 bearish points</li>
            </ul>
          </li>
        </ul>

        <h4 className="font-semibold mb-2">Momentum Indicators:</h4>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>RSI Analysis</strong> <span className="updated-badge">UPDATED</span>
            <ul className="list-circle ml-6">
              <li>RSI &lt; 30 (Oversold): +4 bullish points</li>
              <li>RSI &gt; 70 (Overbought): +4 bearish points</li>
              <li>30 ≤ RSI ≤ 70 and RSI &gt; 50: +2 bullish points</li>
              <li>30 ≤ RSI ≤ 70 and RSI &lt; 50: +2 bearish points</li>
            </ul>
          </li>
          <li><strong>MACD Analysis</strong> <span className="updated-badge">UPDATED</span>
            <ul className="list-circle ml-6">
              <li>MACD &gt; Signal Line: +3 bullish points</li>
              <li>MACD &lt; Signal Line: +3 bearish points</li>
            </ul>
          </li>
          <li><strong>Stochastic Oscillator</strong> <span className="new-badge">NEW</span>
            <ul className="list-circle ml-6">
              <li>%K &lt; 20: +3 bullish points</li>
              <li>%K &gt; 80: +3 bearish points</li>
              <li>%K crosses above %D (mid-range): +1.5 bullish points</li>
              <li>%K crosses below %D (mid-range): +1.5 bearish points</li>
            </ul>
          </li>
        </ul>

        <h4 className="font-semibold mb-2">Volatility Indicators:</h4>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>Bollinger Bands</strong> <span className="updated-badge">UPDATED</span>
            <ul className="list-circle ml-6">
              <li>Price &gt; Upper Band: +3 bearish points</li>
              <li>Price &lt; Lower Band: +3 bullish points</li>
              <li>Price between Middle and Upper: +1.5 bullish points</li>
              <li>Price between Middle and Lower: +1.5 bearish points</li>
            </ul>
          </li>
        </ul>

        <h4 className="font-semibold mb-2">Volume Indicators:</h4>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>Volume Trend</strong> <span className="new-badge">NEW</span>
            <ul className="list-circle ml-6">
              <li>Price ↑ + Volume ↑ (&gt;20% above avg): +4 bullish points</li>
              <li>Price ↓ + Volume ↑ (&gt;20% above avg): +4 bearish points</li>
              <li>Price ↑ + Volume ↓ (&lt;20% below avg): +1 bearish points</li>
              <li>Price ↓ + Volume ↓ (&lt;20% below avg): +1 bullish points</li>
            </ul>
          </li>
        </ul>

        <h3>4.3 Score Calculation <span className="updated-badge">UPDATED</span></h3>

        <h4 className="font-semibold mb-2">Base Net Score Calculation:</h4>
        <div className="bg-gray-100 p-4 rounded mb-4 font-mono text-sm">
          Base Score = (Bullish Points - Bearish Points) / Total Available Weight
        </div>
        <p className="mb-4"><strong>Range:</strong> -1.0 to +1.0</p>

        <h4 className="font-semibold mb-2">Confidence Modifier <span className="new-badge">NEW</span>:</h4>
        <div className="bg-gray-100 p-4 rounded mb-4 font-mono text-sm">
          Confidence Factor = Number of Available Indicators / Total Possible Indicators (9)
        </div>

        <h4 className="font-semibold mb-2">Final Adjusted Score:</h4>
        <div className="bg-gray-100 p-4 rounded mb-4 font-mono text-sm">
          Final Score = Base Score × (0.7 + 0.3 × Confidence Factor)
        </div>

        <div className="info-box">
          <p className="font-semibold mb-2">Why Confidence Adjustment?</p>
          <p className="text-sm mb-2">Scores based on limited data are less reliable. The confidence modifier ensures that:</p>
          <ul className="list-disc ml-6 text-sm">
            <li>With all 9 indicators (100% confidence): Full score applies (multiplier = 1.0)</li>
            <li>With 5 indicators (55% confidence): Score × 0.87</li>
            <li>With 3 indicators (33% confidence): Score × 0.80</li>
          </ul>
          <p className="text-sm mt-2">This prevents overconfident signals from incomplete data.</p>
        </div>

        <h4 className="font-semibold mb-2 mt-4">Example Calculation:</h4>
        <div className="bg-blue-50 p-4 rounded">
          <p className="mb-2"><strong>Scenario:</strong></p>
          <ul className="list-disc ml-6 mb-3">
            <li>Bullish Points: 18</li>
            <li>Bearish Points: 5</li>
            <li>Available Weight: 25 (7 out of 9 indicators available)</li>
            <li>Confidence Factor: 7/9 = 0.778</li>
          </ul>
          
          <p className="mb-2"><strong>Calculations:</strong></p>
          <div className="ml-4 mb-3 font-mono text-sm">
            <p>Base Score = (18 - 5) / 25 = 0.52</p>
            <p>Confidence Modifier = 0.7 + (0.3 × 0.778) = 0.933</p>
            <p>Final Score = 0.52 × 0.933 = 0.485</p>
          </div>
          
          <p className="font-semibold">Result: BUY signal (score 0.485 falls in 0.3-0.6 range)</p>
        </div>

        <h3>4.4 Signal Classification <span className="updated-badge">UPDATED</span></h3>
        
        <div className="warning-box mb-4">
          <p className="font-semibold mb-2">Version 2.0 Enhancement</p>
          <p className="text-sm">Expanded from 5 to 7 signal levels for more granular guidance</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Net Score Range</th>
              <th>Signal</th>
              <th>Meaning</th>
              <th>Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-green-100">
              <td>≥ 0.6</td>
              <td className="font-bold">STRONG BUY</td>
              <td>Very bullish - multiple strong positive indicators</td>
              <td>Consider buying or adding to position</td>
            </tr>
            <tr className="bg-green-50">
              <td>0.3 to 0.6</td>
              <td className="font-bold">BUY</td>
              <td>Moderately bullish - positive trend indicated</td>
              <td>Consider buying with normal position sizing</td>
            </tr>
            <tr className="bg-blue-50">
              <td>0.1 to 0.3</td>
              <td className="font-bold">WEAK BUY</td>
              <td>Slightly bullish - early positive signals</td>
              <td>Monitor closely, small position if desired</td>
            </tr>
            <tr className="bg-gray-100">
              <td>-0.1 to 0.1</td>
              <td className="font-bold">HOLD</td>
              <td>Neutral - no clear trend or mixed signals</td>
              <td>Maintain current position, no action needed</td>
            </tr>
            <tr className="bg-orange-50">
              <td>-0.3 to -0.1</td>
              <td className="font-bold">WEAK SELL</td>
              <td>Slightly bearish - early negative signals</td>
              <td>Consider reducing position or taking profits</td>
            </tr>
            <tr className="bg-red-50">
              <td>-0.6 to -0.3</td>
              <td className="font-bold">SELL</td>
              <td>Moderately bearish - negative trend indicated</td>
              <td>Consider selling or reducing position</td>
            </tr>
            <tr className="bg-red-100">
              <td>&lt; -0.6</td>
              <td className="font-bold">STRONG SELL</td>
              <td>Very bearish - multiple strong negative indicators</td>
              <td>Consider exiting position</td>
            </tr>
          </tbody>
        </table>

        <h3>4.5 Signal Confidence Rating <span className="new-badge">NEW</span></h3>
        <p className="mb-4">
          In addition to the signal itself, the system provides a confidence rating based on data completeness and indicator agreement.
        </p>

        <table>
          <thead>
            <tr>
              <th>Confidence Level</th>
              <th>Criteria</th>
              <th>Display</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-green-100">
              <td className="font-bold">HIGH</td>
              <td>8-9 indicators available AND ≥75% agreement</td>
              <td>⭐⭐⭐</td>
            </tr>
            <tr className="bg-blue-50">
              <td className="font-bold">MEDIUM</td>
              <td>6-7 indicators available OR 60-74% agreement</td>
              <td>⭐⭐</td>
            </tr>
            <tr className="bg-orange-50">
              <td className="font-bold">LOW</td>
              <td>&lt;6 indicators available OR &lt;60% agreement</td>
              <td>⭐</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4 mb-2"><strong>Agreement Calculation:</strong></p>
        <div className="bg-gray-100 p-4 rounded mb-4 font-mono text-sm">
          Agreement % = (Dominant Direction Points / Total Points) × 100
        </div>
        <p className="text-sm italic">Where dominant direction is the side (bullish or bearish) with more points</p>
      </div>

      {/* Adaptive Data Requirements */}
      <div className="mb-8">
        <h2>5. Adaptive Data Requirements <span className="updated-badge">UPDATED</span></h2>

        <h3>5.1 Flexibility</h3>
        <p className="mb-4">
          The system adapts to available data, calculating only indicators for which sufficient data exists. This ensures the system remains functional across different data availability scenarios.
        </p>

        <h3>5.2 Minimum Data Requirements</h3>
        <table>
          <thead>
            <tr>
              <th>Indicator</th>
              <th>Minimum Price Points</th>
              <th>Volume Required</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>SMA 20, Bollinger Bands</td>
              <td>25</td>
              <td>No</td>
            </tr>
            <tr>
              <td>RSI 14, Stochastic</td>
              <td>20</td>
              <td>No</td>
            </tr>
            <tr>
              <td>MACD</td>
              <td>40</td>
              <td>No</td>
            </tr>
            <tr>
              <td>SMA 50</td>
              <td>55</td>
              <td>No</td>
            </tr>
            <tr>
              <td>SMA 200, Golden/Death Cross</td>
              <td>205</td>
              <td>No</td>
            </tr>
            <tr className="bg-blue-50">
              <td>Volume Trend</td>
              <td>25</td>
              <td>Yes (25 points)</td>
            </tr>
          </tbody>
        </table>

        <h3>5.3 Operational Tiers</h3>
        
        <div className="ml-4 mb-4">
          <h4 className="font-semibold mb-2">Tier 1: Minimal (20-24 price points)</h4>
          <p className="mb-2"><strong>Available Indicators:</strong> RSI, Stochastic (2/9 indicators)</p>
          <p className="mb-2"><strong>Max Weight:</strong> 7 points</p>
          <p className="mb-2"><strong>Confidence:</strong> LOW ⭐</p>
          <p className="text-sm italic">System will generate signal but flag as low confidence</p>
        </div>

        <div className="ml-4 mb-4">
          <h4 className="font-semibold mb-2">Tier 2: Basic (25-39 price points + volume)</h4>
          <p className="mb-2"><strong>Available Indicators:</strong> SMA 20, RSI, Stochastic, Bollinger Bands, Volume (5/9 indicators)</p>
          <p className="mb-2"><strong>Max Weight:</strong> 17 points</p>
          <p className="mb-2"><strong>Confidence:</strong> LOW to MEDIUM ⭐-⭐⭐</p>
          <p className="text-sm italic">Sufficient for short-term analysis</p>
        </div>

        <div className="ml-4 mb-4">
          <h4 className="font-semibold mb-2">Tier 3: Standard (40-54 price points + volume)</h4>
          <p className="mb-2"><strong>Available Indicators:</strong> All except SMA 50, 200, and Golden/Death Cross (6/9 indicators)</p>
          <p className="mb-2"><strong>Max Weight:</strong> 22 points</p>
          <p className="mb-2"><strong>Confidence:</strong> MEDIUM ⭐⭐</p>
          <p className="text-sm italic">Good for medium-term analysis</p>
        </div>

        <div className="ml-4 mb-4">
          <h4 className="font-semibold mb-2">Tier 4: Enhanced (55-204 price points + volume)</h4>
          <p className="mb-2"><strong>Available Indicators:</strong> All except SMA 200 and Golden/Death Cross (7/9 indicators)</p>
          <p className="mb-2"><strong>Max Weight:</strong> 25 points</p>
          <p className="mb-2"><strong>Confidence:</strong> MEDIUM to HIGH ⭐⭐-⭐⭐⭐</p>
          <p className="text-sm italic">Excellent for most analysis needs</p>
        </div>

        <div className="ml-4 mb-4">
          <h4 className="font-semibold mb-2">Tier 5: Complete (205+ price points + volume)</h4>
          <p className="mb-2"><strong>Available Indicators:</strong> All 9 indicators</p>
          <p className="mb-2"><strong>Max Weight:</strong> 30 points</p>
          <p className="mb-2"><strong>Confidence:</strong> HIGH ⭐⭐⭐</p>
          <p className="text-sm italic">Optimal - full long-term analysis capability</p>
        </div>

        <h3>5.4 Graceful Degradation</h3>
        <p className="mb-2">When insufficient data exists for certain indicators:</p>
        <ol className="list-decimal ml-6 mb-4">
          <li>Those indicators are excluded from the calculation</li>
          <li>Total available weight is adjusted accordingly</li>
          <li>Signal is generated from available indicators</li>
          <li>Confidence rating reflects data completeness</li>
          <li>Output clearly indicates which indicators were used/missing</li>
          <li>If fewer than 2 indicators available, system returns "INSUFFICIENT DATA" instead of HOLD</li>
        </ol>
      </div>

      {/* Output Specifications */}
      <div className="mb-8">
        <h2>6. Output Specifications <span className="new-badge">NEW SECTION</span></h2>
        
        <h3>6.1 Primary Output Structure</h3>
        <p className="mb-4">The system must provide transparent, actionable output that shows not just the signal, but the reasoning behind it.</p>

        <h4 className="font-semibold mb-2">Required Output Fields:</h4>
        <table className="text-sm">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>signal</td>
              <td>String</td>
              <td>STRONG_BUY | BUY | WEAK_BUY | HOLD | WEAK_SELL | SELL | STRONG_SELL</td>
            </tr>
            <tr>
              <td>score</td>
              <td>Number</td>
              <td>Final adjusted score (-1.0 to +1.0)</td>
            </tr>
            <tr>
              <td>baseScore</td>
              <td>Number</td>
              <td>Base score before confidence adjustment</td>
            </tr>
            <tr>
              <td>confidence</td>
              <td>String</td>
              <td>HIGH | MEDIUM | LOW</td>
            </tr>
            <tr>
              <td>confidenceStars</td>
              <td>Number</td>
              <td>1-3 stars</td>
            </tr>
            <tr>
              <td>bullishPoints</td>
              <td>Number</td>
              <td>Total bullish points accumulated</td>
            </tr>
            <tr>
              <td>bearishPoints</td>
              <td>Number</td>
              <td>Total bearish points accumulated</td>
            </tr>
            <tr>
              <td>availableWeight</td>
              <td>Number</td>
              <td>Total weight of available indicators</td>
            </tr>
            <tr>
              <td>indicatorsUsed</td>
              <td>Number</td>
              <td>Count of indicators with sufficient data (out of 9)</td>
            </tr>
            <tr>
              <td>agreement</td>
              <td>Number</td>
              <td>Percentage of indicators agreeing with dominant direction</td>
            </tr>
            <tr>
              <td>breakdown</td>
              <td>Object</td>
              <td>Detailed indicator-by-indicator results</td>
            </tr>
            <tr>
              <td>warnings</td>
              <td>Array</td>
              <td>Any cautions or notes about the analysis</td>
            </tr>
          </tbody>
        </table>

        <h3>6.2 Breakdown Structure</h3>
        <p className="mb-4">The breakdown object provides transparency by showing each indicator's contribution:</p>

        <div className="bg-gray-100 p-4 rounded mb-4 font-mono text-xs overflow-x-auto">
{`breakdown: {
  trend: {
    sma20: { available: true, signal: "bullish", points: 3, value: 145.2 },
    sma50: { available: true, signal: "bullish", points: 3, value: 140.8 },
    sma200: { available: true, signal: "bullish", points: 2, value: 135.1 },
    goldenCross: { available: true, signal: "bullish", points: 5, active: true }
  },
  momentum: {
    rsi: { available: true, signal: "bullish", points: 2, value: 62.3, category: "momentum" },
    macd: { available: true, signal: "bullish", points: 3, macdValue: 2.5, signalValue: 1.8 },
    stochastic: { available: true, signal: "bullish", points: 1.5, kValue: 65, dValue: 60 }
  },
  volatility: {
    bollinger: { available: true, signal: "bullish", points: 1.5, position: "upper_half", 
                 upper: 155, middle: 145, lower: 135 }
  },
  volume: {
    volumeTrend: { available: true, signal: "bullish", points: 4, 
                   currentVol: 2500000, avgVol: 2000000, change: "+25%" }
  }
}`}
        </div>

        <h3>6.3 Example Complete Output</h3>
        <div className="bg-blue-50 p-4 rounded text-sm">
          <p className="font-bold text-lg mb-2">Stock: XYZ</p>
          <p className="font-bold text-green-600 text-xl mb-1">Signal: BUY ⭐⭐⭐</p>
          <p className="mb-3">Score: +0.48 | Confidence: HIGH | Agreement: 82%</p>
          
          <div className="bg-white p-3 rounded mb-3">
            <p className="font-semibold mb-2">Signal Breakdown (7/9 indicators available):</p>
            
            <p className="font-semibold text-green-700 mt-2">Bullish Signals (22 points):</p>
            <ul className="list-disc ml-6 text-xs">
              <li>✓ Golden Cross active (+5)</li>
              <li>✓ Volume increasing with price (+4)</li>
              <li>✓ Price above SMA 20, 50, 200 (+8)</li>
              <li>✓ MACD bullish crossover (+3)</li>
              <li>✓ RSI showing bullish momentum (+2)</li>
            </ul>
            
            <p className="font-semibold text-red-700 mt-2">Bearish Signals (4 points):</p>
            <ul className="list-disc ml-6 text-xs">
              <li>✗ Stochastic entering overbought (+3 bearish)</li>
              <li>✗ Price approaching upper Bollinger Band (+1 caution)</li>
            </ul>
          </div>
          
          <div className="bg-yellow-50 p-2 rounded text-xs">
            <p className="font-semibold">⚠ Considerations:</p>
            <p>• Stochastic and Bollinger suggest potential short-term pullback</p>
            <p>• Strong uptrend intact; consider waiting for dip to add position</p>
          </div>
          
          <p className="text-xs mt-3 italic text-gray-600">Missing: SMA 200 and Bollinger Bands (insufficient historical data)</p>
        </div>

        <h3>6.4 Warning Messages</h3>
        <p className="mb-2">The system should generate contextual warnings when appropriate:</p>
        <ul className="list-disc ml-6 mb-4 text-sm">
          <li><strong>Low confidence:</strong> "Signal based on limited data (only X/9 indicators available)"</li>
          <li><strong>Mixed signals:</strong> "Indicators show divergence - trend signals bullish but momentum weakening"</li>
          <li><strong>Overbought in uptrend:</strong> "Strong uptrend but overbought conditions suggest potential pullback"</li>
          <li><strong>Low volume:</strong> "Price movement not confirmed by volume - exercise caution"</li>
          <li><strong>Insufficient data:</strong> "Less than 20 days of data - unable to generate reliable signal"</li>
          <li><strong>High volatility:</strong> "Bollinger Bands expanding - increased volatility and risk"</li>
        </ul>
      </div>

      {/* Example Scenarios */}
      <div className="mb-8">
        <h2>7. Example Scenarios <span className="updated-badge">UPDATED</span></h2>

        <h3>7.1 Complete Data - Strong Bullish Signal</h3>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <p className="font-semibold mb-2">Input Data:</p>
          <ul className="list-disc ml-6 text-sm mb-3">
            <li>250 days of price and volume history for Stock XYZ</li>
            <li>Current Price: $150</li>
            <li>Price trend: Strong upward over past months</li>
            <li>Volume: Increasing with price rises</li>
          </ul>

          <p className="font-semibold mb-2">Calculated Indicators:</p>
          <table className="text-xs">
            <thead>
              <tr><th>Indicator</th><th>Value</th><th>Signal</th><th>Points</th></tr>
            </thead>
            <tbody>
              <tr><td>SMA 20</td><td>$145</td><td>Bullish (price above)</td><td>+3</td></tr>
              <tr><td>SMA 50</td><td>$140</td><td>Bullish (price above)</td><td>+3</td></tr>
              <tr><td>SMA 200</td><td>$135</td><td>Bullish (price above)</td><td>+2</td></tr>
              <tr><td>Golden Cross</td><td>Active</td><td>Bullish</td><td>+5</td></tr>
              <tr><td>RSI 14</td><td>65</td><td>Bullish momentum</td><td>+2</td></tr>
              <tr><td>MACD</td><td>2.5 vs 1.8</td><td>Bullish</td><td>+3</td></tr>
              <tr><td>Stochastic</td><td>%K:70 %D:65</td><td>Bullish (K>D)</td><td>+1.5</td></tr>
              <tr><td>Bollinger</td><td>Upper half</td><td>Bullish zone</td><td>+1.5</td></tr>
              <tr><td>Volume</td><td>+30% vs avg</td><td>Strong bullish confirmation</td><td>+4</td></tr>
            </tbody>
          </table>

          <p className="font-semibold mb-2 mt-3">Calculation:</p>
          <div className="ml-4 text-sm space-y-1">
            <p>• Total Bullish: 25 points</p>
            <p>• Total Bearish: 0 points</p>
            <p>• Available Weight: 30 points (9/9 indicators)</p>
            <p>• Base Score: (25 - 0) / 30 = 0.833</p>
            <p>• Confidence Factor: 9/9 = 1.0</p>
            <p>• Final Score: 0.833 × (0.7 + 0.3 × 1.0) = 0.833</p>
            <p>• Agreement: 100% (all bullish)</p>
          </div>

          <p className="font-bold text-green-600 text-lg mt-3">Result: STRONG BUY ⭐⭐⭐</p>
          <p className="text-sm italic">High confidence - all indicators confirm strong uptrend with volume support</p>
        </div>

        <h3>7.2 Limited Data - Moderate Signal</h3>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <p className="font-semibold mb-2">Input Data:</p>
          <ul className="list-disc ml-6 text-sm mb-3">
            <li>45 days of price and volume history for Stock ABC</li>
            <li>Current Price: $82</li>
            <li>Recent upward momentum</li>
          </ul>

          <p className="font-semibold mb-2">Available Indicators (6/9):</p>
          <table className="text-xs">
            <thead>
              <tr><th>Indicator</th><th>Value</th><th>Signal</th><th>Points</th></tr>
            </thead>
            <tbody>
              <tr><td>SMA 20</td><td>$80</td><td>Bullish</td><td>+3</td></tr>
              <tr><td>RSI 14</td><td>58</td><td>Bullish momentum</td><td>+2</td></tr>
              <tr><td>MACD</td><td>1.2 vs 1.0</td><td>Bullish</td><td>+3</td></tr>
              <tr><td>Stochastic</td><td>%K:60 %D:55</td><td>Bullish</td><td>+1.5</td></tr>
              <tr><td>Bollinger</td><td>Middle-Upper</td><td>Bullish</td><td>+1.5</td></tr>
              <tr><td>Volume</td><td>+15% vs avg</td><td>Neutral</td><td>0</td></tr>
              <tr className="text-gray-400"><td>SMA 50</td><td>-</td><td>N/A</td><td>-</td></tr>
              <tr className="text-gray-400"><td>SMA 200</td><td>-</td><td>N/A</td><td>-</td></tr>
              <tr className="text-gray-400"><td>Golden Cross</td><td>-</td><td>N/A</td><td>-</td></tr>
            </tbody>
          </table>

          <p className="font-semibold mb-2 mt-3">Calculation:</p>
          <div className="ml-4 text-sm space-y-1">
            <p>• Total Bullish: 11 points</p>
            <p>• Total Bearish: 0 points</p>
            <p>• Available Weight: 17 points (6/9 indicators)</p>
            <p>• Base Score: (11 - 0) / 17 = 0.647</p>
            <p>• Confidence Factor: 6/9 = 0.667</p>
            <p>• Final Score: 0.647 × (0.7 + 0.3 × 0.667) = 0.583</p>
            <p>• Agreement: 100% (all bullish, but limited indicators)</p>
          </div>

          <p className="font-bold text-green-600 text-lg mt-3">Result: BUY ⭐⭐</p>
          <p className="text-sm italic">Medium confidence - positive signals but missing long-term trend confirmation</p>
          <p className="text-sm text-yellow-700 mt-1">⚠ Warning: Long-term trend indicators unavailable due to limited history</p>
        </div>

        <h3>7.3 Mixed Signals - Hold Scenario</h3>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <p className="font-semibold mb-2">Input Data:</p>
          <ul className="list-disc ml-6 text-sm mb-3">
            <li>210 days of price and volume history for Stock DEF</li>
            <li>Current Price: $95</li>
            <li>Price consolidating, mixed indicators</li>
          </ul>

          <p className="font-semibold mb-2">Calculated Indicators:</p>
          <table className="text-xs">
            <thead>
              <tr><th>Indicator</th><th>Value</th><th>Signal</th><th>Points</th></tr>
            </thead>
            <tbody>
              <tr><td>SMA 20</td><td>$96</td><td>Bearish (price below)</td><td>+3 bearish</td></tr>
              <tr><td>SMA 50</td><td>$94</td><td>Bullish (price above)</td><td>+3 bullish</td></tr>
              <tr><td>SMA 200</td><td>$92</td><td>Bullish (price above)</td><td>+2 bullish</td></tr>
              <tr><td>Golden Cross</td><td>Active</td><td>Bullish</td><td>+5 bullish</td></tr>
              <tr><td>RSI 14</td><td>48</td><td>Bearish momentum</td><td>+2 bearish</td></tr>
              <tr><td>MACD</td><td>0.8 vs 1.1</td><td>Bearish</td><td>+3 bearish</td></tr>
              <tr><td>Stochastic</td><td>%K:45 %D:50</td><td>Bearish (K&lt;D)</td><td>+1.5 bearish</td></tr>
              <tr><td>Bollinger</td><td>Lower half</td><td>Bearish zone</td><td>+1.5 bearish</td></tr>
              <tr><td>Volume</td><td>-5% vs avg</td><td>Neutral</td><td>0</td></tr>
            </tbody>
          </table>

          <p className="font-semibold mb-2 mt-3">Calculation:</p>
          <div className="ml-4 text-sm space-y-1">
            <p>• Total Bullish: 10 points</p>
            <p>• Total Bearish: 11 points</p>
            <p>• Available Weight: 30 points (9/9 indicators)</p>
            <p>• Base Score: (10 - 11) / 30 = -0.033</p>
            <p>• Confidence Factor: 9/9 = 1.0</p>
            <p>• Final Score: -0.033 × (0.7 + 0.3 × 1.0) = -0.033</p>
            <p>• Agreement: 52% (nearly split)</p>
          </div>

          <p className="font-bold text-gray-600 text-lg mt-3">Result: HOLD ⭐⭐⭐</p>
          <p className="text-sm italic">High confidence in HOLD - trend is bullish but momentum turning bearish</p>
          <p className="text-sm text-yellow-700 mt-1">⚠ Warning: Mixed signals - long-term trend bullish but short-term momentum weakening. Monitor closely.</p>
        </div>

        <h3>7.4 Bearish with Volume Confirmation</h3>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <p className="font-semibold mb-2">Input Data:</p>
          <ul className="list-disc ml-6 text-sm mb-3">
            <li>250 days of price and volume history for Stock GHI</li>
            <li>Current Price: $45</li>
            <li>Declining price with increasing volume</li>
          </ul>

          <p className="font-semibold mb-2">Calculated Indicators:</p>
          <table className="text-xs">
            <thead>
              <tr><th>Indicator</th><th>Value</th><th>Signal</th><th>Points</th></tr>
            </thead>
            <tbody>
              <tr><td>SMA 20</td><td>$48</td><td>Bearish</td><td>+3 bearish</td></tr>
              <tr><td>SMA 50</td><td>$51</td><td>Bearish</td><td>+3 bearish</td></tr>
              <tr><td>SMA 200</td><td>$55</td><td>Bearish</td><td>+2 bearish</td></tr>
              <tr><td>Golden Cross</td><td>Death Cross</td><td>Bearish</td><td>+5 bearish</td></tr>
              <tr><td>RSI 14</td><td>35</td><td>Bearish momentum</td><td>+2 bearish</td></tr>
              <tr><td>MACD</td><td>-1.5 vs -0.8</td><td>Bearish</td><td>+3 bearish</td></tr>
              <tr><td>Stochastic</td><td>%K:25 %D:30</td><td>Neutral/Oversold</td><td>+3 bullish</td></tr>
              <tr><td>Bollinger</td><td>Below lower band</td><td>Oversold signal</td><td>+3 bullish</td></tr>
              <tr><td>Volume</td><td>+35% on decline</td><td>Strong bearish confirmation</td><td>+4 bearish</td></tr>
            </tbody>
          </table>

          <p className="font-semibold mb-2 mt-3">Calculation:</p>
          <div className="ml-4 text-sm space-y-1">
            <p>• Total Bullish: 6 points (oversold signals)</p>
            <p>• Total Bearish: 22 points</p>
            <p>• Available Weight: 30 points (9/9 indicators)</p>
            <p>• Base Score: (6 - 22) / 30 = -0.533</p>
            <p>• Confidence Factor: 9/9 = 1.0</p>
            <p>• Final Score: -0.533 × (0.7 + 0.3 × 1.0) = -0.533</p>
            <p>• Agreement: 73% bearish</p>
          </div>

          <p className="font-bold text-red-600 text-lg mt-3">Result: SELL ⭐⭐⭐</p>
          <p className="text-sm italic">High confidence - strong downtrend with volume confirmation</p>
          <p className="text-sm text-yellow-700 mt-1">⚠ Note: Oversold signals present but downtrend remains strong. Not yet a reversal.</p>
        </div>
      </div>

      {/* Use Cases */}
      <div className="mb-8">
        <h2>8. Use Cases</h2>

        <h3>8.1 Portfolio Review</h3>
        <p className="mb-2"><strong>Scenario:</strong> User wants to review all holdings for potential rebalancing</p>
        <p className="mb-2"><strong>System Behavior:</strong></p>
        <ul className="list-disc ml-6 mb-4">
          <li>Calculate technical signals for each position in portfolio</li>
          <li>Display signals with confidence ratings</li>
          <li>Identify positions with SELL or STRONG_SELL signals</li>
          <li>Flag positions with low confidence due to limited data</li>
          <li>Sort by signal strength or by positions requiring attention</li>
          <li>Provide summary: "3 positions showing SELL signals, 5 showing BUY"</li>
        </ul>

        <h3>8.2 New Investment Research</h3>
        <p className="mb-2"><strong>Scenario:</strong> User researching potential new stock purchase</p>
        <p className="mb-2"><strong>System Behavior:</strong></p>
        <ul className="list-disc ml-6 mb-4">
          <li>Analyze technical indicators for candidate stock</li>
          <li>Provide detailed signal breakdown showing which indicators support the signal</li>
          <li>Display confidence rating based on data availability</li>
          <li>Highlight any warnings (overbought, low volume, mixed signals)</li>
          <li>Show trend context (short vs. long-term alignment)</li>
          <li>Suggest: "Strong uptrend but consider entry on pullback" or "Good entry point - oversold with trend support"</li>
        </ul>

        <h3>8.3 Exit Strategy Monitoring</h3>
        <p className="mb-2"><strong>Scenario:</strong> User holds profitable position and wants to monitor for exit signals</p>
        <p className="mb-2"><strong>System Behavior:</strong></p>
        <ul className="list-disc ml-6 mb-4">
          <li>Track signal changes over time</li>
          <li>Alert when signal changes from BUY to WEAK_BUY or HOLD</li>
          <li>Flag early warning signs (momentum divergence, volume declining)</li>
          <li>Notify on SELL or STRONG_SELL signals</li>
          <li>Provide context: "Uptrend intact but momentum weakening - monitor closely"</li>
        </ul>

        <h3>8.4 Watchlist Screening</h3>
        <p className="mb-2"><strong>Scenario:</strong> User monitors watchlist of 20+ stocks for opportunities</p>
        <p className="mb-2"><strong>System Behavior:</strong></p>
        <ul className="list-disc ml-6 mb-4">
          <li>Batch calculate signals for all watchlist stocks</li>
          <li>Filter and sort by signal strength</li>
          <li>Highlight new STRONG_BUY or BUY signals</li>
          <li>Show confidence ratings to prioritize research</li>
          <li>Provide quick summary view with key metrics per stock</li>
        </ul>
      </div>

      {/* Limitations */}
      <div className="mb-8">
        <h2>9. Limitations and Considerations</h2>

        <h3>9.1 Data Quality Dependencies</h3>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>Accuracy depends on input:</strong> System requires clean, accurate historical price and volume data</li>
          <li><strong>Historical data only:</strong> Cannot predict unexpected events (earnings surprises, regulatory changes, macroeconomic shocks)</li>
          <li><strong>Market hours limitation:</strong> Only reflects traded prices, not after-hours movements</li>
          <li><strong>Corporate actions:</strong> Stock splits, dividends must be adjusted in source data</li>
        </ul>

        <h3>9.2 Not Financial Advice</h3>
        <div className="warning-box">
          <p className="font-semibold mb-2">Important Disclaimer</p>
          <ul className="list-disc ml-6 text-sm">
            <li><strong>Tool for analysis only:</strong> Not a recommendation to buy or sell securities</li>
            <li><strong>One perspective:</strong> Should be combined with fundamental analysis, valuation, company research</li>
            <li><strong>User responsibility:</strong> Final investment decisions rest with the user</li>
            <li><strong>No guarantees:</strong> Past price patterns do not guarantee future results</li>
            <li><strong>Risk awareness:</strong> All investing involves risk of loss</li>
          </ul>
        </div>

        <h3>9.3 Market Condition Sensitivities</h3>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>Trending markets:</strong> System works best in clear trending markets (up or down)</li>
          <li><strong>Sideways markets:</strong> Less reliable in ranging/choppy markets with no clear trend</li>
          <li><strong>Lagging indicators:</strong> Based on past prices, not predictive of future moves</li>
          <li><strong>External factors:</strong> Cannot account for news, earnings, analyst reports, sector rotation, market sentiment</li>
          <li><strong>Low liquidity:</strong> Less reliable for thinly traded stocks where price gaps are common</li>
        </ul>

        <h3>9.4 Signal Interpretation Guidelines</h3>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>Confidence matters:</strong> Low confidence signals should be treated with caution</li>
          <li><strong>Context is key:</strong> Consider overall market conditions and sector trends</li>
          <li><strong>Timeframe alignment:</strong> Day traders and long-term investors may interpret same signal differently</li>
          <li><strong>Multiple timeframes:</strong> Consider analyzing multiple timeframes (daily, weekly) for confirmation</li>
          <li><strong>Risk management:</strong> Use position sizing and stop losses regardless of signal strength</li>
        </ul>

        <h3>9.5 Known Edge Cases</h3>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>Recent IPOs:</strong> Limited history may produce unreliable signals</li>
          <li><strong>Penny stocks:</strong> High volatility and low liquidity reduce reliability</li>
          <li><strong>Market crashes:</strong> Extreme volatility can produce whipsaw signals</li>
          <li><strong>Gap events:</strong> Overnight gaps (earnings, takeover bids) not captured by indicators</li>
          <li><strong>Manipulation:</strong> System cannot detect price manipulation or unusual activity</li>
        </ul>
      </div>

      {/* System Benefits */}
      <div className="mb-8">
        <h2>10. System Benefits</h2>

        <h3>10.1 Objectivity and Consistency</h3>
        <ul className="list-disc ml-6 mb-4">
          <li>Removes emotional bias from technical analysis</li>
          <li>Applies consistent rules across all analyzed securities</li>
          <li>Quantifiable decision criteria enable backtesting</li>
          <li>Documented methodology ensures reproducible results</li>
        </ul>

        <h3>10.2 Efficiency and Scalability</h3>
        <ul className="list-disc ml-6 mb-4">
          <li>Instant analysis of any stock with available data</li>
          <li>Batch processing enables portfolio-wide analysis</li>
          <li>Automated recalculation with new daily data</li>
          <li>Scales from single stock to hundreds of securities</li>
        </ul>

        <h3>10.3 Transparency and Learning <span className="new-badge">ENHANCED</span></h3>
        <ul className="list-disc ml-6 mb-4">
          <li>Clear breakdown shows which indicators contributed to signal</li>
          <li>Users understand the "why" behind each signal</li>
          <li>Educational value helps users learn technical analysis concepts</li>
          <li>Confidence metrics build appropriate trust levels</li>
          <li>Warnings highlight important considerations</li>
        </ul>

        <h3>10.4 Risk Management Support</h3>
        <ul className="list-disc ml-6 mb-4">
          <li>Early warning system for position exits</li>
          <li>Identifies weakening trends before major reversals</li>
          <li>Confidence ratings help with position sizing decisions</li>
          <li>Multiple confirmation reduces false signals</li>
        </ul>
      </div>

      {/* Future Enhancements */}
      <div className="mb-8">
        <h2>11. Future Enhancements</h2>

        <h3>11.1 Phase 2: Advanced Indicators</h3>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>On-Balance Volume (OBV):</strong> Cumulative volume indicator for trend confirmation</li>
          <li><strong>Volume-Weighted Average Price (VWAP):</strong> Intraday benchmark for institutional trading levels</li>
          <li><strong>Average True Range (ATR):</strong> Volatility measurement for stop loss placement</li>
          <li><strong>Fibonacci Retracement:</strong> Key support/resistance levels based on mathematical ratios</li>
          <li><strong>Ichimoku Cloud:</strong> Comprehensive trend and momentum system</li>
        </ul>

        <h3>11.2 Phase 3: Pattern Recognition</h3>
        <ul className="list-disc ml-6 mb-4">
          <li>Chart pattern detection (head & shoulders, double tops/bottoms, triangles, flags)</li>
          <li>Candlestick pattern analysis (doji, hammer, engulfing patterns)</li>
          <li>Support and resistance level identification</li>
          <li>Trendline detection and breakout alerts</li>
          <li>Price channel analysis</li>
        </ul>

        <h3>11.3 Phase 4: Customization and Profiles</h3>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>User-adjustable weights:</strong> Allow users to customize indicator importance</li>
          <li><strong>Trading style profiles:</strong> Pre-configured settings for day trading, swing trading, long-term investing</li>
          <li><strong>Custom signal thresholds:</strong> User-defined boundaries for signal classification</li>
          <li><strong>Indicator toggles:</strong> Enable/disable specific indicators</li>
          <li><strong>Timeframe flexibility:</strong> Support for multiple timeframes (intraday, daily, weekly)</li>
        </ul>

        <h3>11.4 Phase 5: Advanced Features</h3>
        <ul className="list-disc ml-6 mb-4">
          <li><strong>Divergence detection:</strong> Identify price-indicator divergences automatically</li>
          <li><strong>Multi-timeframe analysis:</strong> Combine signals from multiple timeframes</li>
          <li><strong>Comparative analysis:</strong> Compare stock vs. sector vs. market indices</li>
          <li><strong>Historical signal tracking:</strong> Track signal changes and performance over time</li>
          <li><strong>Backtesting capability:</strong> Test strategy performance on historical data</li>
          <li><strong>Alert system:</strong> Notifications when signals change or conditions met</li>
        </ul>

        <h3>11.5 Phase 6: Integration Features</h3>
        <ul className="list-disc ml-6 mb-4">
          <li>Fundamental data overlay (P/E ratios, earnings dates)</li>
          <li>News sentiment integration</li>
          <li>Sector rotation analysis</li>
          <li>Market regime detection (bull/bear/sideways)</li>
          <li>Correlation analysis between holdings</li>
        </ul>
      </div>

      {/* Glossary */}
      <div className="mb-8">
        <h2>Appendix A: Glossary</h2>
        
        <div className="grid grid-cols-1 gap-2 text-sm">
          <div><strong>Moving Average:</strong> Average price over a specified time period, used to smooth price data and identify trends</div>
          <div><strong>Momentum:</strong> Rate of price change, indicating the speed of price movement</div>
          <div><strong>Overbought:</strong> Condition where price has risen too far too fast, correction likely</div>
          <div><strong>Oversold:</strong> Condition where price has fallen too far too fast, bounce likely</div>
          <div><strong>Crossover:</strong> When one indicator line crosses above or below another, often signaling trend change</div>
          <div><strong>Volatility:</strong> Degree of price variation over time, measure of risk and price movement</div>
          <div><strong>Trend:</strong> General direction of price movement over time (upward, downward, or sideways)</div>
          <div><strong>Signal Line:</strong> Moving average of another indicator used for smoothing and generating signals</div>
          <div><strong>Divergence:</strong> When price and indicator move in opposite directions, often precedes reversals</div>
          <div><strong>Support:</strong> Price level where buying interest historically prevents further decline</div>
          <div><strong>Resistance:</strong> Price level where selling interest historically prevents further advance</div>
          <div><strong>Breakout:</strong> Price movement through established support or resistance level</div>
          <div><strong>Consolidation:</strong> Period of sideways price movement, often before a breakout</div>
          <div><strong>Volume:</strong> Number of shares traded, confirms strength of price movements</div>
          <div><strong>Band Width:</strong> Distance between upper and lower Bollinger Bands, indicates volatility</div>
        </div>
      </div>

      {/* Technical References */}
      <div className="mb-8">
        <h2>Appendix B: Technical References</h2>
        
        <h3>Indicator Calculation Standards</h3>
        <ul className="list-disc ml-6 mb-4 text-sm">
          <li><strong>Simple Moving Average (SMA):</strong> Sum of closing prices / Number of periods</li>
          <li><strong>Exponential Moving Average (EMA):</strong> Weighted average giving more weight to recent prices. Multiplier = 2/(periods + 1)</li>
          <li><strong>RSI:</strong> RSI = 100 - (100 / (1 + RS)), where RS = Average Gain / Average Loss over period</li>
          <li><strong>MACD:</strong> MACD Line = EMA(12) - EMA(26); Signal Line = EMA(9) of MACD Line</li>
          <li><strong>Stochastic:</strong> %K = (Current Close - Lowest Low) / (Highest High - Lowest Low) × 100</li>
          <li><strong>Bollinger Bands:</strong> Upper = SMA(20) + 2σ; Lower = SMA(20) - 2σ</li>
        </ul>

        <h3>Industry Resources</h3>
        <ul className="list-disc ml-6 mb-4 text-sm">
          <li>Technical Analysis Library: Standard technical indicators calculation methods</li>
          <li>Murphy, John J. "Technical Analysis of the Financial Markets" - Industry standard reference</li>
          <li>Investopedia Technical Analysis section - Indicator definitions and interpretations</li>
          <li>StockCharts.com - ChartSchool for technical analysis education</li>
        </ul>

        <h3>Implementation Notes</h3>
        <ul className="list-disc ml-6 text-sm">
          <li>All calculations use closing prices unless otherwise specified</li>
          <li>Volume calculations use actual share volume, not dollar volume</li>
          <li>Moving averages use simple arithmetic mean unless exponential weighting specified</li>
          <li>Standard deviation uses sample standard deviation (n-1 denominator)</li>
          <li>Prices should be adjusted for splits and dividends before calculation</li>
        </ul>
      </div>

      {/* Document Approval */}
      <div className="mb-8 pb-8 border-t-2 border-gray-300 pt-8">
        <h2>Document Approval</h2>
        
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-semibold">Prepared By:</p>
              <p className="text-sm">Functional Analysis Team</p>
              <p className="text-sm text-gray-600">Date: October 2025</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Reviewed By:</p>
              <p className="text-sm">___________________</p>
              <p className="text-sm text-gray-600">Date: ___________</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Approved By:</p>
              <p className="text-sm">___________________</p>
              <p className="text-sm text-gray-600">Date: ___________</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 border-t pt-4 no-print">
        <p>Technical Analysis System - Functional Specification v2.0</p>
        <p>Portfolio Tracker Module | October 2025</p>
        <p className="mt-2 text-xs">This is a functional specification document. No code implementation details included.</p>
      </div>

    </div>
  );
};

export default TechnicalAnalysisSpec;
            