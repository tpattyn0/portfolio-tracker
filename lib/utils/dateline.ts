import { format, getDayOfYear } from "date-fns";

/**
 * Converts a positive integer to Roman numerals.
 *
 * Used for the Meridian masthead "Volume" figure (2-digit year, e.g. 26 -> XXVI).
 * Pure function — no I/O, no clock reads. See plans/2026-07-17-meridian-design-overhaul.md
 * ("Dateline formula") and DESIGN.md for the formula this backs.
 */
export function toRoman(value: number): string {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return "";
  }

  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let remaining = value;
  let result = "";
  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }
  return result;
}

/**
 * Builds the Meridian masthead dateline string for a given date, e.g.
 * "Vol. XXVI — № 198 · Friday, 17 July 2026".
 *
 * - Volume = 2-digit year in Roman numerals (2026 -> 26 -> XXVI).
 * - Issue № = day-of-year (date-fns getDayOfYear).
 * - Date = long-form date, e.g. "Friday, 17 July 2026".
 *
 * Fully computed from `date` — nothing hardcoded. See DESIGN.md "Masthead
 * (shared header)" for the formula rationale.
 */
export function formatDateline(date: Date): string {
  const twoDigitYear = date.getFullYear() % 100;
  const volume = toRoman(twoDigitYear);
  const issue = getDayOfYear(date);
  const longDate = format(date, "EEEE, d MMMM yyyy");
  return `Vol. ${volume} — № ${issue} · ${longDate}`;
}
