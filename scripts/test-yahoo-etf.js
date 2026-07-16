
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function testEtfData() {
    try {
        const etfs = ['XLK', 'XLF', 'XLV']; // Tech, Financials, Healthcare

        for (const symbol of etfs) {
            const quoteSummary = await yahooFinance.quoteSummary(symbol, {
                modules: [
                    'summaryDetail', // Yield, Trailing P/E?
                    'defaultKeyStatistics', // Forward P/E?
                    'fundProfile', // Sometimes differs for ETFs
                ]
            });

            console.log(`\n--- ${symbol} Data ---`);
            console.log('Trailing P/E:', quoteSummary.summaryDetail?.trailingPE);
            console.log('Forward P/E:', quoteSummary.summaryDetail?.forwardPE);
            console.log('Yield:', quoteSummary.summaryDetail?.yield);
            console.log('Category:', quoteSummary.fundProfile?.categoryName);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testEtfData();
