import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Plan (plans/2026-07-18-yahoo-validation-error.md) Task 1/5: safeQuoteSummary
 * catches yahoo-finance2's FailedYahooValidationError (detected by
 * `error.name`, not `instanceof` — see the wrapper's doc comment for why) and
 * falls back to the library's own coerced `error.result`, warning once per
 * drift. Re-throws when there's no usable result, and re-throws all other
 * errors unchanged. No live Yahoo network calls — `yahoo-finance2`'s default
 * export is mocked below.
 */

const quoteSummaryMock = vi.fn();
// TD-34a: capture the constructor argument so tests can assert on the
// options passed to `new YahooFinance(...)` — the bare class previously
// ignored its constructor args entirely. A plain array (not a `vi.fn()`
// mock) survives `vi.clearAllMocks()` in `beforeEach`, since the shared
// client is constructed exactly once, at module scope, on first import —
// before any test's `beforeEach` runs.
const { capturedConstructorArgs } = vi.hoisted(() => ({
  capturedConstructorArgs: [] as unknown[][],
}));

vi.mock("yahoo-finance2", () => ({
  default: class {
    quoteSummary = quoteSummaryMock;
    constructor(...args: unknown[]) {
      capturedConstructorArgs.push(args);
    }
  },
}));

function makeValidationError(opts: {
  result?: unknown;
  errors?: Array<{ instancePath?: string; message?: string }>;
}) {
  const error = new Error("Failed Yahoo Schema validation") as Error & {
    result?: unknown;
    errors?: unknown;
  };
  error.name = "FailedYahooValidationError";
  error.result = opts.result;
  error.errors = opts.errors ?? [];
  return error;
}

describe("safeQuoteSummary", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns error.result and warns once when a FailedYahooValidationError has a usable result", async () => {
    const { safeQuoteSummary } = await import("./yahoo-finance");
    const coerced = { price: { regularMarketPrice: 100 } };
    quoteSummaryMock.mockRejectedValueOnce(
      makeValidationError({
        result: coerced,
        errors: [{ instancePath: "/price/marketCap", message: "expected number" }],
      })
    );

    const result = await safeQuoteSummary("AAPL", { modules: ["price"] });

    expect(result).toBe(coerced);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("AAPL");
    expect(warnSpy.mock.calls[0][0]).toContain("/price/marketCap");
  });

  it("re-throws when error.result is nullish", async () => {
    const { safeQuoteSummary } = await import("./yahoo-finance");
    quoteSummaryMock.mockRejectedValueOnce(makeValidationError({ result: undefined }));

    await expect(safeQuoteSummary("AAPL", { modules: ["price"] })).rejects.toThrow(
      "Failed Yahoo Schema validation"
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("re-throws non-validation errors unchanged", async () => {
    const { safeQuoteSummary } = await import("./yahoo-finance");
    quoteSummaryMock.mockRejectedValueOnce(new Error("network down"));

    await expect(safeQuoteSummary("AAPL", { modules: ["price"] })).rejects.toThrow(
      "network down"
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns the result directly on success (no error)", async () => {
    const { safeQuoteSummary } = await import("./yahoo-finance");
    const ok = { price: { regularMarketPrice: 100 } };
    quoteSummaryMock.mockResolvedValueOnce(ok);

    const result = await safeQuoteSummary("AAPL", { modules: ["price"] });
    expect(result).toBe(ok);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("shared yahooFinance client construction (TD-34a)", () => {
  it("constructs the shared client with validation: { logErrors: false }, alongside suppressNotices", async () => {
    // The module builds its shared client once, at module scope, on first
    // import — importing it again (module already loaded from earlier tests
    // in this file) does not re-invoke the constructor, so this asserts on
    // whatever call already happened rather than forcing a fresh one.
    await import("./yahoo-finance");

    expect(capturedConstructorArgs.length).toBeGreaterThan(0);
    const optionsArg = capturedConstructorArgs[0][0] as {
      suppressNotices?: string[];
      validation?: { logErrors?: boolean };
    };
    expect(optionsArg.validation).toEqual({ logErrors: false });
    expect(optionsArg.suppressNotices).toEqual(["yahooSurvey", "ripHistorical"]);
  });
});
