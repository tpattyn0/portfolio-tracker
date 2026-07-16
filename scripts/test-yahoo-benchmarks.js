
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function testYahoo() {
    try {
        const symbol = 'AAPL';
        const quoteSummary = await yahooFinance.quoteSummary(symbol, {
            modules: [
                'defaultKeyStatistics',
                'financialData',
                'summaryDetail',
                'earningsHistory', // Quarterly EPS history
                // 'timeSeries' // Often restricted or empty, but let's try if needed later
            ]
        });

        console.log('\n--- Earnings History ---');
        console.log(JSON.stringify(quoteSummary.earningsHistory, null, 2));

        console.log('\n--- Chart Data ---');
        // Fetch 5 years of monthly data
        const chartResult = await yahooFinance.chart(symbol, {
            period1: '2023-01-01', // Approx 1 year ago for test
            interval: '1mo',
        });

        console.log('Chart Meta:', JSON.stringify(chartResult.meta, null, 2));
        if (chartResult.quotes && chartResult.quotes.length > 0) {
            console.log('Sample Quote:', JSON.stringify(chartResult.quotes[0], null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testYahoo();
