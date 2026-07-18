import { describe, it, expect, vi, beforeEach } from "vitest";
import { TechnicalAnalysisService } from "./technical-analysis.service";

// Fixed fixture: 220 ascending-then-oscillating closes (needs 205+ points
// per AGENT.md/ARCHITECTURE.md for a complete SMA200 read) with matching
// volumes — deterministic input for parity checks (plan Task 3).
function buildFixture(length = 220) {
  const prices: number[] = [];
  const volumes: number[] = [];
  for (let i = 0; i < length; i++) {
    const base = 100 + i * 0.2;
    const wave = Math.sin(i / 5) * 3;
    prices.push(Math.round((base + wave) * 100) / 100);
    volumes.push(1_000_000 + (i % 7) * 10_000);
  }
  return { prices, volumes };
}

describe("TechnicalAnalysisService.getCachedIndicators (plan Task 3)", () => {
  let service: TechnicalAnalysisService;

  beforeEach(() => {
    service = new TechnicalAnalysisService();
  });

  it("is byte-identical to the uncached calculateIndicators for the same fixed input", () => {
    const { prices, volumes } = buildFixture();
    const direct = service.calculateIndicators(prices, volumes);
    const cached = service.getCachedIndicators("AAPL", prices, volumes);

    expect(cached).toEqual(direct);
  });

  it("computes indicators once for two sequential requests within the TTL for the same symbol", () => {
    const { prices, volumes } = buildFixture();
    const spy = vi.spyOn(service, "calculateIndicators");

    const first = service.getCachedIndicators("AAPL", prices, volumes);
    const second = service.getCachedIndicators("AAPL", prices, volumes);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("recomputes for a different symbol even with an identical price series", () => {
    const { prices, volumes } = buildFixture();
    const spy = vi.spyOn(service, "calculateIndicators");

    service.getCachedIndicators("AAPL", prices, volumes);
    service.getCachedIndicators("MSFT", prices, volumes);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("recomputes when the underlying series changes for the same symbol (fingerprint miss)", () => {
    const { prices, volumes } = buildFixture();
    const spy = vi.spyOn(service, "calculateIndicators");

    service.getCachedIndicators("AAPL", prices, volumes);
    const changedPrices = [...prices];
    changedPrices[changedPrices.length - 1] += 5; // new latest close
    service.getCachedIndicators("AAPL", changedPrices, volumes);

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
