import YahooFinance from "yahoo-finance2";

// yahoo-finance2's `exports` map does not expose the module-level option
// types (e.g. `QuoteSummaryOptions`) for deep import, so this is a minimal
// local shape covering what call sites in this codebase pass today.
interface QuoteSummaryQueryOptions {
  modules: string[];
}

// Single shared instance of yahoo-finance2 v3
// v3 requires instantiation with `new` (unlike v2 which used a default export)
//
// TD-34a (plans/2026-07-23-lib-cleanup-batch.md, ADR-27): `validation.logErrors:
// false` suppresses ONLY yahoo-finance2's own ~40-line pre-throw console dump
// ("The following result did not validate with schema..."). Validation itself
// stays ON — FailedYahooValidationError is still thrown, and safeQuoteSummary's
// catch/coerce/one-line-console.warn contract (ADR-15) below is fully
// retained. Verified against the installed yahoo-finance2@3.13.0 source: the
// dump is gated by `if (options.logErrors === true)`
// (esm/src/lib/validateAndCoerceTypes.js:183) and sits BEFORE the throw
// (:214), which is outside that gate. The library's option merge is a nested
// merge (esm/src/lib/options/options.js mergeObjects), so this overrides only
// the `logErrors` key and leaves the runtime default
// `allowAdditionalProps: true` intact.
//
// Do NOT "upgrade" this to `validateResult: false` — that is the blanket
// alternative ADR-15 explicitly rejected because it silences the drift signal
// safeQuoteSummary's warn depends on. This flag only quiets the library's own
// redundant console output; it does not change what is caught, coerced, or
// logged by this codebase.
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  validation: { logErrors: false },
});

export default yahooFinance;

/**
 * The single sanctioned entry point for `yahooFinance.quoteSummary(...)`.
 *
 * yahoo-finance2 v3 validates every quoteSummary response against a frozen Zod
 * schema. When Yahoo drifts its payload shape (a recurring, documented failure
 * mode of this library), validation throws `FailedYahooValidationError` even
 * though the underlying data is usually still present and usable.
 *
 * This wrapper keeps validation ON (so drift is observable — see the
 * `console.warn` below), catches only that specific error, and falls back to
 * the library's own partially-validated/coerced `error.result`. Any other
 * error, or a validation error with no usable `result`, re-throws unchanged.
 *
 * Detection is by `error.name === "FailedYahooValidationError"`, NOT
 * `instanceof yahooFinance.errors.FailedYahooValidationError`. Verified
 * against the installed yahoo-finance2@3.13.0: the package's `exports` map
 * does not expose an `errors` subpath and the package root does not re-export
 * the error classes, so `instanceof` against the real class is unavailable
 * without a deep import — and a deep import
 * (`yahoo-finance2/esm/src/lib/errors.js`) would violate the package's
 * `exports` map and can break under Next.js bundling. Do not switch this
 * detection to `instanceof` (see DECISIONS.md ADR-15 and the AGENT.md
 * fragile-surface entry for this file).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeQuoteSummary(
  symbol: string,
  queryOptions: QuoteSummaryQueryOptions
): Promise<Record<string, any>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await yahooFinance.quoteSummary(symbol, queryOptions as any)) as Record<string, any>;
  } catch (error) {
    if (error instanceof Error && error.name === "FailedYahooValidationError") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { result, errors } = error as Error & { result?: any; errors?: any[] };

      if (result) {
        const fieldPaths = Array.isArray(errors)
          ? errors
              .map((e) => e?.instancePath || e?.message || String(e))
              .join(", ")
          : "unknown";

        console.warn(
          `[yahoo-finance] Schema validation drift for ${symbol} (modules: ${
            queryOptions.modules?.join(", ") ?? "n/a"
          }). Falling back to coerced result. Drifted fields: ${fieldPaths}`
        );

        return result;
      }
    }

    throw error;
  }
}
