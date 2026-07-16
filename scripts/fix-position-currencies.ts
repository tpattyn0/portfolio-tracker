import { prisma } from "../lib/prisma";
import { marketDataService } from "../lib/services/market-data.service";

async function fixPositionCurrencies() {
  console.log("Fetching all positions...");

  const positions = await prisma.position.findMany({
    where: {
      quantity: {
        gt: 0,
      },
    },
    select: {
      id: true,
      ticker: true,
      currency: true,
      quantity: true,
    },
  });

  console.log(`Found ${positions.length} positions to check`);

  for (const position of positions) {
    try {
      console.log(`\nChecking ${position.ticker}...`);
      const quote = await marketDataService.getQuote(position.ticker);

      if (quote?.currency && quote.currency !== position.currency) {
        console.log(`  Updating ${position.ticker}: ${position.currency} -> ${quote.currency}`);

        await prisma.position.update({
          where: { id: position.id },
          data: {
            currency: quote.currency,
            exchange: quote.exchange || position.ticker.includes('.') ? position.ticker.split('.')[1] : 'NASDAQ',
          },
        });

        console.log(`  ✓ Updated ${position.ticker}`);
      } else {
        console.log(`  ✓ ${position.ticker} currency is correct (${position.currency})`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ✗ Error updating ${position.ticker}:`, error);
    }
  }

  console.log("\n✓ Currency fix complete!");
}

fixPositionCurrencies()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
