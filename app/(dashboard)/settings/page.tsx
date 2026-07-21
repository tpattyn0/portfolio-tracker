"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SCORING_WEIGHTS,
  fractionsToPercents,
  presetsForGroup,
  type CompositeWeights,
  type FundamentalWeights,
} from "@/lib/utils/scoring-weights";
import {
  computeGroupTotalState,
  toNumbers,
  type WeightInputs,
} from "@/lib/utils/scoring-weights-settings-gate";

/**
 * Settings — scoring weights (plans/2026-07-21-scoring-weights-direct-percent.md,
 * DESIGN.md "Settings — scoring weights", ADR-22 — supersedes the
 * plans/2026-07-20-configurable-scoring-weights.md auto-normalize UX). Two
 * Editorial-card sections, Composite score then Fundamental score, each with
 * five direct-whole-percent Weight steppers, a live group-total/validity
 * status line (replacing the removed live-normalized-% band), a per-section
 * reset, and an explicit save gated on sum-to-100 (within epsilon) AND dirty.
 */

const inputClass =
  "w-full h-10 box-border rounded-md border border-border bg-background px-3.5 text-sm text-foreground outline-none";

interface DimensionField<K extends string> {
  key: K;
  label: string;
}

const COMPOSITE_FIELDS: DimensionField<keyof CompositeWeights>[] = [
  { key: "technical", label: "Technical" },
  { key: "fundamental", label: "Fundamental" },
  { key: "analyst", label: "Analysts" },
  { key: "intrinsicValue", label: "Intrinsic value" },
  { key: "sentiment", label: "News & sentiment" },
];

const FUNDAMENTAL_FIELDS: DimensionField<keyof FundamentalWeights>[] = [
  { key: "valuation", label: "Valuation" },
  { key: "profitability", label: "Profitability" },
  { key: "growth", label: "Growth" },
  { key: "financial", label: "Financial health" },
  { key: "dividend", label: "Dividend" },
];

function toInputs<K extends string>(weights: Record<K, number>): WeightInputs<K> {
  const result = {} as WeightInputs<K>;
  for (const key of Object.keys(weights) as K[]) {
    result[key] = String(weights[key]);
  }
  return result;
}

interface ScoringWeightsResponse {
  composite: CompositeWeights;
  fundamental: FundamentalWeights;
}

const DEFAULT_COMPOSITE_PERCENTS = fractionsToPercents(DEFAULT_SCORING_WEIGHTS.composite);
const DEFAULT_FUNDAMENTAL_PERCENTS = fractionsToPercents(DEFAULT_SCORING_WEIGHTS.fundamental);

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const weightsQ = useQuery<ScoringWeightsResponse>({
    queryKey: ["scoring-weights"],
    queryFn: async () => {
      const res = await fetch("/api/settings/scoring-weights");
      if (!res.ok) throw new Error("Failed to fetch scoring weights");
      return res.json();
    },
    staleTime: Infinity,
  });

  return (
    <div>
      <div className="mb-9">
        <div className="text-[11px] uppercase tracking-[0.14em] text-mut">
          House rules · how your scores are weighed
        </div>
        <h1 className="mt-2.5 font-serif text-[52px] font-medium leading-[1.05]">Scoring weights</h1>
        <p className="mt-3 max-w-[680px] font-serif text-base italic text-mut">
          Set how much each dimension counts toward your Composite and Fundamental scores. Unweighted
          dimensions fall back to the house default.
        </p>
      </div>

      {weightsQ.isLoading ? (
        <SettingsSkeletonInline />
      ) : (
        <div className="space-y-6">
          <ScoringWeightsSection<keyof CompositeWeights>
            title="Composite score"
            metaKicker="5 categories · drives every research Overview"
            fields={COMPOSITE_FIELDS}
            defaultPercents={DEFAULT_COMPOSITE_PERCENTS}
            savedWeights={weightsQ.data?.composite ?? DEFAULT_COMPOSITE_PERCENTS}
            group="composite"
            queryClient={queryClient}
            toast={toast}
          />

          <ScoringWeightsSection<keyof FundamentalWeights>
            title="Fundamental score"
            metaKicker="5 subcategories · drives the Fundamental tab"
            fields={FUNDAMENTAL_FIELDS}
            defaultPercents={DEFAULT_FUNDAMENTAL_PERCENTS}
            savedWeights={weightsQ.data?.fundamental ?? DEFAULT_FUNDAMENTAL_PERCENTS}
            group="fundamental"
            queryClient={queryClient}
            toast={toast}
          />
        </div>
      )}
    </div>
  );
}

interface ScoringWeightsSectionProps<K extends string> {
  title: string;
  metaKicker: string;
  fields: DimensionField<K>[];
  defaultPercents: Record<K, number>;
  savedWeights: Record<K, number>;
  group: "composite" | "fundamental";
  queryClient: ReturnType<typeof useQueryClient>;
  toast: ReturnType<typeof useToast>["toast"];
}

function ScoringWeightsSection<K extends string>({
  title,
  metaKicker,
  fields,
  defaultPercents,
  savedWeights,
  group,
  queryClient,
  toast,
}: ScoringWeightsSectionProps<K>) {
  const [inputs, setInputs] = useState<WeightInputs<K>>(() => toInputs(savedWeights));
  const [savedInputs, setSavedInputs] = useState<WeightInputs<K>>(() => toInputs(savedWeights));
  const [isSaving, setIsSaving] = useState(false);

  // Re-seed local state whenever the fetched saved values change (e.g. after
  // a successful save re-invalidates ["scoring-weights"]).
  useEffect(() => {
    const seeded = toInputs(savedWeights);
    setInputs(seeded);
    setSavedInputs(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(savedWeights)]);

  const fieldKeys = useMemo(() => fields.map((f) => f.key), [fields]);

  const { total, isValid, canSave } = useMemo(
    () => computeGroupTotalState(inputs, savedInputs, fieldKeys),
    [inputs, savedInputs, fieldKeys]
  );

  const handleChange = (key: K, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setInputs(toInputs(defaultPercents));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/scoring-weights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [group]: toNumbers(inputs) }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save weights");
      }
      await queryClient.invalidateQueries({ queryKey: ["scoring-weights"] });
      toast({
        title: "Weights saved",
        description:
          group === "composite"
            ? "Your Composite scores now use this weighting."
            : "Your Fundamental scores now use this weighting.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card px-7 pb-7 pt-6" style={{ borderTop: "3px double var(--foreground)" }}>
      <div className="flex items-center justify-between border-b border-line2 pb-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{title}</span>
        <span className="text-[10.5px] uppercase tracking-[0.1em] text-mut">{metaKicker}</span>
      </div>

      <div
        className={cn(
          "mt-2 pb-5 text-[10.5px] uppercase tracking-[0.1em]",
          isValid ? "text-mut" : "text-dn"
        )}
      >
        {isValid ? "Total: 100% · valid" : `Total: ${total}% · must equal 100%`}
      </div>

      <details className="group mb-5">
        <summary
          className="flex list-none items-center justify-between gap-2 py-1 [&::-webkit-details-marker]:hidden hover:bg-fill focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground"
        >
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-mut">
            Start from a style — prefill weights from a named investing style
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-mut transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="mt-2 rounded-md border border-line divide-y divide-line2">
          {presetsForGroup(group).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setInputs(toInputs(preset[group]! as Record<K, number>))}
              className="flex w-full flex-col items-start gap-1 bg-transparent px-4 py-3 text-left hover:bg-fill focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground"
            >
              <span className="text-[13.5px] font-medium text-foreground">{preset.label}</span>
              <span className="text-[12px] text-mut">{preset.blurb}</span>
            </button>
          ))}
        </div>
      </details>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-2 block text-[10.5px] uppercase tracking-[0.12em] text-mut">{f.label} %</label>
            <input
              type="text"
              inputMode="decimal"
              className={inputClass}
              value={inputs[f.key]}
              onChange={(e) => handleChange(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="h-[38px] rounded-full border border-line px-5 text-[13px] font-medium text-foreground"
        >
          Reset to house defaults
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="h-10 rounded-full bg-btnbg px-5 text-[13px] font-medium text-btnfg disabled:opacity-50"
        >
          Save weights
        </button>
      </div>
    </div>
  );
}

function SettingsSkeletonInline() {
  // Fallback inline skeleton for the (rare) case this page renders its own
  // loading state outside the route-level loading.tsx Suspense boundary
  // (e.g. a client-side refetch). The real route-level skeleton is
  // settings/loading.tsx.
  return (
    <div className="space-y-6">
      <div className="h-64 animate-pulse rounded-lg border border-border bg-fill" />
      <div className="h-64 animate-pulse rounded-lg border border-border bg-fill" />
    </div>
  );
}
