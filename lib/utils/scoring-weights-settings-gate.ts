import { sumsTo100 } from "@/lib/utils/scoring-weights";

/**
 * Pure group-total/validity/save-gating logic for the Settings — scoring
 * weights page's direct-percent inputs (ADR-22,
 * plans/2026-07-21-scoring-weights-direct-percent.md). Extracted from
 * `app/(dashboard)/settings/page.tsx` into its own module because Next.js App
 * Router `page.tsx` files may only export `default` and a small set of
 * reserved route-config names — any other named export fails the route's
 * type-check (`OmitWithTag` constraint) even though the function itself has
 * nothing to do with routing. This also gives the total/validity/save-gate
 * logic a React-free, DOM-free unit-testable seam (no @testing-library/react
 * is installed in this repo — see scoring-weights-settings-gate.test.ts).
 */

export type WeightInputs<K extends string> = Record<K, string>;

const parseWeightInput = (value: string): string => value.replace(",", ".");

/** Parses a section's string inputs into numbers, coercing invalid input to 0. */
export function toNumbers<K extends string>(inputs: WeightInputs<K>): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const key of Object.keys(inputs) as K[]) {
    const parsed = parseFloat(parseWeightInput(inputs[key]));
    result[key] = Number.isFinite(parsed) ? parsed : 0;
  }
  return result;
}

export interface GroupTotalState {
  /** Running sum of the section's inputs (whatever numbers they parse to). */
  total: number;
  /** Whether the group sums to 100 within epsilon (sumsTo100). */
  isValid: boolean;
  /** Whether any field differs from its last-saved value. */
  isDirty: boolean;
  /** Whether Save should be enabled: isValid AND isDirty. */
  canSave: boolean;
}

/**
 * Computes the running total, sum-to-100 validity, dirty state, and the
 * resulting Save-button gate for one section (Composite or Fundamental) of
 * the scoring-weights settings page. `fields` supplies the ordered key list
 * for the group (so `total` sums exactly the section's own five fields, not
 * every key present on the input record).
 */
export function computeGroupTotalState<K extends string>(
  inputs: WeightInputs<K>,
  savedInputs: WeightInputs<K>,
  keys: K[]
): GroupTotalState {
  const numbers = toNumbers(inputs);
  const total = keys.reduce((sum, key) => sum + numbers[key], 0);
  const group = {} as Record<K, number>;
  for (const key of keys) group[key] = numbers[key];
  const isValid = sumsTo100(group);
  const isDirty = keys.some((key) => inputs[key] !== savedInputs[key]);
  return { total, isValid, isDirty, canSave: isValid && isDirty };
}
