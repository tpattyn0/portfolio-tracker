"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
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
}

interface IntrinsicValueProps {
  symbol: string;
  currentPrice: number;
  currency?: string;
}

export function IntrinsicValue({ symbol, currentPrice, currency }: IntrinsicValueProps) {
  const [data, setData] = useState<IntrinsicValueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIntrinsicValue = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/research/${symbol}/intrinsic-value?price=${currentPrice}`);

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch intrinsic value");
        }

        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchIntrinsicValue();
  }, [symbol, currentPrice]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
        Loading intrinsic value…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-mut">
        <AlertCircle className="mr-2 h-4 w-4" />
        {error || "Unable to calculate intrinsic value"}
      </div>
    );
  }

  const score = upsideToScore(data.upsidePercent);
  const dcfLite = data.methods.find((m) => m.name === "DCF Lite");
  const revenueGrowth = dcfLite?.inputs?.growthRate;
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
        summary={`Confidence-weighted across ${data.methods.length} valuation methods.`}
      >
        <div className="grid grid-cols-3 border-t border-line pt-5">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-dn">Bear</div>
            <div className="mt-1.5 font-serif text-[26px] text-mut">—</div>
            <div className="mt-0.5 text-[12px] text-mut">Single-point estimate</div>
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
            <div className="mt-1.5 font-serif text-[26px] text-mut">—</div>
            <div className="mt-0.5 text-[12px] text-mut">Single-point estimate</div>
          </div>
        </div>

        <div className="mt-6 border-t border-line2 pt-5">
          <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-mut">Model assumptions</div>
          <AssumptionRow
            label="Revenue growth"
            value={typeof revenueGrowth === "number" ? `${(revenueGrowth * 100).toFixed(1)}%` : null}
          />
          <AssumptionRow
            label="Discount rate (WACC)"
            value={typeof discountRate === "number" ? `${(discountRate * 100).toFixed(1)}%` : null}
          />
          <AssumptionRow label="FCF margin" value={null} />
          <AssumptionRow label="Terminal growth" value={null} />
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
