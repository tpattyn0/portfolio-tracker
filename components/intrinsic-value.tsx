"use client";

import { AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { HeadlineScoreCard } from "@/components/research/headline-score-card";
import { formatCurrency } from "@/lib/utils/format";
import { upsideToScore } from "@/lib/utils/research-scores";
import { cn } from "@/lib/utils";

interface ValuationMethod {
  name: string;
  value: number | null;
  formula: string;
  inputs: Record<string, number | null>;
  confidence: "high" | "medium" | "low";
}

interface IntrinsicValueData {
  currentPrice: number;
  intrinsicValue: number | null;
  upside: number | null;
  upsidePercent: number | null;
  methods: ValuationMethod[];
  confidence: "high" | "medium" | "low";
  lastUpdated: string;
  scenarioLow: number | null;
  scenarioHigh: number | null;
  validMethodCount: number;
}

interface IntrinsicValueProps {
  symbol: string;
  currentPrice: number;
  currency?: string;
}

export function IntrinsicValue({ symbol, currentPrice, currency }: IntrinsicValueProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["intrinsic-value", symbol, currentPrice],
    queryFn: async (): Promise<IntrinsicValueData> => {
      const res = await fetch(`/api/research/${symbol}/intrinsic-value?price=${currentPrice}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch intrinsic value");
      }
      return res.json();
    },
    enabled: currentPrice > 0,
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
        Loading intrinsic value…
      </div>
    );
  }

  // A genuine network/parse error (the route itself 500s, or is unreachable)
  // still shows the full-card failure — distinct from the "no fundamental
  // data" data-absence case, which the route now returns as a 200 with
  // intrinsicValue:null/methods:[] so it falls through to the shell below
  // with scoped em-dash placeholders (plan Task 5).
  if (error || !data) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
        <AlertCircle className="mr-2 h-4 w-4" />
        {error instanceof Error ? error.message : "Unable to calculate intrinsic value"}
      </div>
    );
  }

  const score = upsideToScore(data.upsidePercent);
  const dcfLite = data.methods.find((m) => m.name === "DCF Lite");
  // OD-1 resolved (honest relabel, plans/2026-07-19-research-tab-fixes.md):
  // these are the three real DCF Lite inputs — "growthRate" is EARNINGS
  // growth (capped at +15%, uncapped downside), not revenue growth as the
  // row used to claim. "FCF margin"/"Terminal growth" are dropped, not
  // em-dashed — the DCF Lite method (an EPS-multiple model) never computes
  // them, so a permanent hardcoded "—" for a non-existent model was the bug.
  const earningsGrowth = dcfLite?.inputs?.growthRate;
  const terminalPE = dcfLite?.inputs?.terminalPE;
  const discountRate = dcfLite?.inputs?.discountRate;

  const upsideColor = data.upsidePercent === null ? "text-mut" : data.upsidePercent >= 0 ? "text-up" : "text-dn";
  const upsideLine =
    data.upsidePercent === null
      ? "No fair-value estimate available"
      : `Trading ${Math.abs(data.upsidePercent).toFixed(1)}% ${data.upsidePercent >= 0 ? "below" : "above"} fair value`;

  return (
    <div className="space-y-5">
      <HeadlineScoreCard
        kicker="Intrinsic value"
        metaKicker="Discounted cash flow · 10-year model"
        score={score}
        leftExtra={
          <>
            <div className="mt-1 text-[10.5px] uppercase tracking-[0.12em] text-mut">Fair value estimate</div>
            <div className="mt-1 font-serif text-[34px]">
              {data.intrinsicValue ? formatCurrency(data.intrinsicValue, currency) : "—"}
            </div>
            <div className={cn("mt-1 text-[13px] font-medium", upsideColor)}>{upsideLine}</div>
          </>
        }
        summary={
          data.methods.length > 0
            ? `Confidence-weighted across ${data.methods.length} valuation methods.`
            : "No fundamental data available for this symbol."
        }
      >
        <div className="grid grid-cols-3 pt-5">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-dn">Bear</div>
            <div className={cn("mt-1.5 font-serif text-[26px]", data.scenarioLow === null && "text-mut")}>
              {data.scenarioLow !== null ? formatCurrency(data.scenarioLow, currency) : "—"}
            </div>
            <div className="mt-0.5 text-[12px] text-mut">
              {data.scenarioLow !== null ? `Lowest of ${data.validMethodCount} methods` : "Insufficient methods"}
            </div>
          </div>
          <div className="border-l border-line2 pl-5">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-mut">Base</div>
            <div className="mt-1.5 font-serif text-[26px]">
              {data.intrinsicValue ? formatCurrency(data.intrinsicValue, currency) : "—"}
            </div>
            <div className="mt-0.5 text-[12px] text-mut">Weighted estimate</div>
          </div>
          <div className="border-l border-line2 pl-5">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-up">Bull</div>
            <div className={cn("mt-1.5 font-serif text-[26px]", data.scenarioHigh === null && "text-mut")}>
              {data.scenarioHigh !== null ? formatCurrency(data.scenarioHigh, currency) : "—"}
            </div>
            <div className="mt-0.5 text-[12px] text-mut">
              {data.scenarioHigh !== null ? `Highest of ${data.validMethodCount} methods` : "Insufficient methods"}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-line2 pt-5">
          <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-mut">Model assumptions</div>
          <AssumptionRow
            label="Earnings growth (capped)"
            value={typeof earningsGrowth === "number" ? `${(earningsGrowth * 100).toFixed(1)}%` : null}
          />
          <AssumptionRow
            label="Terminal P/E"
            value={typeof terminalPE === "number" ? terminalPE.toFixed(1) : null}
          />
          <AssumptionRow
            label="Discount rate (WACC)"
            value={typeof discountRate === "number" ? `${(discountRate * 100).toFixed(1)}%` : null}
          />
        </div>
      </HeadlineScoreCard>
    </div>
  );
}

function AssumptionRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-line2 py-2.5 text-[13.5px] last:border-b-0">
      <span className="text-sub">{label}</span>
      <span className="font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}
