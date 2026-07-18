# Review: Meridian design overhaul (PR #13)
Date: 2026-07-17
Status: IMPLEMENTED — 2026-07-17

## Summary
Findings: 0 BLOCKERs, 3 ISSUEs, 2 SUGGESTIONs, 1 QUESTION
Requires owner decision: MDO-Q1 — resolved/withdrawn as a false positive (see resolution note under the finding below); no owner decision needed.
Ready for Coding agent: MDO-01 (plans/INDEX.md lifecycle drift), MDO-02 (STATUS.md template deviation), MDO-03 (dateline hydration guard), MDO-04 (chart-path min/max derivation clarity), MDO-05 (reviews/INDEX.md row for this review)

The Meridian overhaul itself is well-executed and scope-clean. Reviewing the design commits in isolation (`a85c88da..HEAD`), the implementation touches **zero** off-limits files: no `components/ui/**`, no `lib/services/**`, no `app/api/**`, no `prisma/schema.prisma`, no `app/page.tsx`, no `app/(dashboard)/portfolio/[ticker]/page.tsx`, and no `reviews/2026-07-17-scoring-methodology.md`. The plan's settled decisions all hold in the code:

- **ADR-8 token reconciliation verified.** `git diff --stat components/ui/` against `main` is empty (the stated proof of correctness). `tailwind.config.js` has no `hsl(var(--))` except the unused `--chart-*` set, which ADR-8 explicitly excludes. No inline `hsl(var(--))` remains in `components/ui/`.
- **Scoring untouched.** No scoring-computation file is in the diff. `getScoreColor` (`wishlist-table.tsx:44-49`) is retokenized to the Meridian presentation bands exactly as the plan specified (≥7 `text-up`, 4–7 `text-amber`, <4 `text-dn`, null `text-mut`) — a recolor of an already-computed number, not scoring logic.
- **Dateline computed live** (`components/navigation.tsx:32` → `formatDateline(new Date())`), pure fn in `lib/utils/dateline.ts` (Roman-numeral year / day-of-year), matching the owner formula.
- **Watchlist naming is copy-only** (ADR-9): nav label + H1 say "Watchlist"; route stays `/wishlist`.
- **Chart** preserves the React Query `/api/portfolio/performance` flow, uses the pure `buildPath`/`buildAreaPath`, and keeps the rAF morph.

**Coding-agent claims confirmed against the branch:** `npm run verify` passes — typecheck ok, lint ok (pre-existing warnings only), 42/42 tests, secret-scan clean. `components/ui/` diff empty. PR #13 open. New pure functions (`buildPath`, `toRoman`/`formatDateline`) have tests covering the plan's named edge cases (1–2 point degenerate, flat series, NaN/Infinity/empty for `buildPath`; Roman edge cases + the owner dateline example).

**Security pass (security-review skill + manual):** no HIGH/MEDIUM findings. Presentational-only diff with no auth/authz/data-access changes, no `dangerouslySetInnerHTML`/`eval`/`innerHTML` introduced, external news links carry `rel="noopener noreferrer"`, and the one navigation sink change uses `router.push` on server-sourced `ticker` data (not raw untrusted URL input). No secrets introduced.

The one thing the owner must weigh is not about the design work at all — it is that PR #13's diff against `main` is much larger than the overhaul because the branch base includes a separate, never-merged audit-fix commit (see MDO-Q1).

## Findings

### MDO-Q1 — QUESTION
**File:** PR #13 (branch `feature/meridian-design-overhaul`, base `main`)
**Problem:** The branch was cut from `main@1f370f21`, but its history includes commit `dda8a396 "fix: act on full-audit findings AUD-01..AUD-10 (#12)"`, which is **not** on `main`. As a result PR #13 (base `main`) carries two unrelated bodies of work: the Meridian overhaul *and* the entire AUD-01..10 audit fix — roughly 24 extra files including `app/api/**` route changes, `lib/services/**` changes (new `position.service.ts`, `realized-pl.service.ts`, `news.service.ts` edits, `wishlist.service.ts` edits), their tests, and three audit review files (`reviews/2026-07-17-full-audit*.md`). Those files look like off-limits-scope violations in the raw `main...HEAD` diff, but they belong to #12, not to this overhaul. This is not a defect in the Meridian implementation — it is a merge-hygiene problem: reviewing/merging #13 as-is silently lands the #12 work under a "design overhaul" title, and the design work cannot be reviewed or reverted independently of the audit fix.
**Recommendation:** Owner decision on how to land this. Options, in rough order of cleanliness: (a) merge PR #12 to `main` first, then rebase `feature/meridian-design-overhaul` onto the updated `main` so #13's diff reduces to design-only; (b) if #12 is already intended to ship with #13, retitle/re-scope PR #13's description to state it also merges AUD-01..10 so the merge is intentional and reviewers know both were audited; (c) split into two PRs. The design overhaul commits themselves require no code change for this — the resolution is entirely at the git/PR level.

**Resolution (2026-07-17):** False positive — computed against a stale `main`. Against current origin/main the merge base is dda8a396 and `git diff --name-only origin/main...HEAD` is design-only (no app/api, lib/services, or prisma files). No action required.

### MDO-01 — ISSUE
**File:** `plans/INDEX.md:5`
**Problem:** The plan's row still reads `Status: planned` with `Review: —`, but implementation is complete and PR #13 is open. Per the lifecycle in CLAUDE.md the Coding agent should have advanced this to `implementing` when starting and `in review` when the PR opened. The index is the single source of plan status, so it currently misreports the plan as not started.
**Recommendation:** Set the row's Status to `in review`. (It becomes `implemented` only later, in the same commit that stamps this review file `Status: IMPLEMENTED`, with the `Review` column pointing to `reviews/2026-07-17-meridian-design-overhaul.md`.)

### MDO-02 — ISSUE
**File:** `STATUS.md:1-11`
**Problem:** `STATUS.md` uses custom fields not in the template (`Orchestration:`, `Reviewer: running (iteration 1)`) instead of the defined `Plan:` / `Since:` / `Branch:` / `Next:` shape. The standing checklist requires STATUS.md to conform to the template with no custom sections. It is within the 20-line / links-only hard limit, so this is a structural-conformance nit, not a hard-limit breach. Note: this file is orchestrator-managed (I was instructed not to edit it), so this is flagged for the orchestrator rather than for a code fix.
**Recommendation:** When the orchestration completes, normalise STATUS.md to the template fields (or clear it) — replace `Orchestration:`/`Reviewer:` lines with a `Next:` line. No action needed from a Coding-agent session; this is for whoever owns STATUS.md updates in the pipeline.

### MDO-03 — SUGGESTION
**File:** `components/navigation.tsx:1,32,49`
**Problem:** `navigation.tsx` is a `"use client"` component that renders `formatDateline(new Date())` inline. `new Date()` is evaluated on both the server (SSR/prerender) and the client (hydration). At the exact midnight/day-of-year boundary the two evaluations can produce different dateline strings (different day-of-year issue №, or different long-form date), yielding a React hydration mismatch warning and a flash of the wrong dateline. The window is tiny and the text is purely decorative, so this is low-priority — but it is a real, if narrow, correctness edge.
**Recommendation:** Render the dateline after mount (e.g. compute it in a `useEffect` into state, defaulting to empty/placeholder on first paint), or wrap the dateline node in `suppressHydrationWarning`. Either removes the boundary-case mismatch without changing the visible output in the common case.

### MDO-04 — SUGGESTION
**File:** `lib/utils/chart-path.ts:44-46`
**Problem:** `min`/`max` are computed from `values`, while the finiteness guard above filters into `finiteValues` and bails if any entry is non-finite. This is correct today (after the guard, `values` is guaranteed all-finite, so `Math.min/max(...values)` is safe), but the reader has to reason across the early-return to see it, and a future edit that loosens the guard (e.g. "skip NaN points instead of bailing") would silently make `Math.min/max` return `NaN`. Purely a readability/robustness nit — no current bug.
**Recommendation:** Optionally compute `min`/`max` from `finiteValues` (identical values today) so the safety is local to the computation, or add a one-line comment noting the min/max relies on the earlier all-finite guarantee. Not required for correctness.

### MDO-05 — ISSUE
**File:** `reviews/INDEX.md`
**Problem:** `reviews/INDEX.md` has no row for this review file. Per CLAUDE.md a row should be added when a review is written (Status blank) so review lifecycle state is visible without opening each file.
**Recommendation:** Add a row: `| 2026-07-17-meridian-design-overhaul.md | 2026-07-17 | |` (Status blank until the Coding agent stamps it IMPLEMENTED). I add this row and commit it alongside this review file.

## Proposed DECISIONS.md entries
None. ADR-8, ADR-9, and ADR-10 are already present, marked `accepted`, and carry accurate evidence that I verified against the branch (ADR-8's "components/ui diff empty" proof holds; ADR-9's route/schema-unchanged claim holds; ADR-10's `buildPath` + retained-Recharts split holds). No new architectural decisions were introduced by this implementation that are not already recorded.

---

## Iteration 2 outcome (2026-07-17)

Fix pass reviewed: commit `e4ac2ac5` (the code/doc fixes) plus the STATUS.md chore commits since iteration 1. Scope of this iteration was narrow — verify the fixes landed correctly and introduced no new correctness/security/scope problem — not a full re-review of the overhaul.

**Working tree:** clean (`git status --porcelain` empty). Reviewed at branch HEAD `60e5a5ec`.

**Verify block:** `npm run verify` passes — typecheck ok, lint ok (pre-existing warnings only), 42/42 tests, secret-scan clean.

**Off-limits set:** still untouched. `git diff --name-only origin/main...HEAD` contains no `components/ui/**`, `app/page.tsx`, `app/(dashboard)/portfolio/[ticker]/page.tsx`, `lib/services/**`, `app/api/**`, `prisma/schema.prisma`, or `reviews/2026-07-17-scoring-methodology.md`. The fix commit touched only `components/navigation.tsx`, `lib/utils/chart-path.ts`, `plans/INDEX.md`, and this review file — all in-scope. No new scope violation introduced.

**Security:** re-ran the security pass (skill + manual) against the fix diff. No HIGH/MEDIUM findings. `suppressHydrationWarning` is not a security-relevant attribute (affects only hydration reconciliation, introduces no sink); the chart-path change is a pure numeric edit with no untrusted-input surface. No new `dangerouslySetInnerHTML`/`eval`/`innerHTML`; external news link keeps `rel="noopener noreferrer"`.

### Per-finding resolution

- **MDO-01 — RESOLVED.** `plans/INDEX.md` row now reads `in review` (was `planned`). Correct interim state; it becomes `implemented` only when this review is stamped `Status: IMPLEMENTED` with the Review column filled.
- **MDO-03 — RESOLVED.** `suppressHydrationWarning` is applied to the dateline `<div>` alone (`components/navigation.tsx:56-61`), scoped to that single node plus its `{dateline}` text child. It does **not** wrap the header or any sibling nav element, so warnings elsewhere in the subtree are not suppressed. This removes the midnight/day-of-year boundary mismatch risk while keeping the correct server-rendered value visible (no client-only render, no flash). Verified as correctly scoped.
- **MDO-04 — RESOLVED.** `min`/`max` now computed from `finiteValues` (`lib/utils/chart-path.ts:48-49`). Because the guard above bails whenever `finiteValues.length !== values.length`, `finiteValues` is content-identical to `values` at this point — behavior is unchanged and all 42 tests still pass. The safety is now local to the computation, addressing the future-edit robustness concern.
- **MDO-Q1 — CONFIRMED RESOLVED (false positive verified independently).** I re-ran the checks myself: `git merge-base origin/main HEAD` = `dda8a396...`, which **equals** `git rev-parse origin/main` (`dda8a396...`). `git diff --name-only origin/main...HEAD` is design-only — no `app/api/**`, `lib/services/**`, or `prisma/**` files. The prior QUESTION was computed against a stale `main`; against current origin/main it genuinely does not apply. The resolution note in the finding is accurate. No owner decision required.
- **MDO-02 — orchestrator-owned (unchanged).** STATUS.md template deviation remains flagged for the orchestrator, not a Coding-agent fix; I was instructed not to edit STATUS.md this iteration. Not a blocker.
- **MDO-05 — RESOLVED.** `reviews/INDEX.md` now carries a row for this review (Status blank, pending IMPLEMENTED stamp).

### Iteration-2 verdict

0 BLOCKERs, 0 ISSUEs, 0 SUGGESTIONs, 0 QUESTIONs remaining. All actionable findings from iteration 1 are resolved; MDO-Q1 is confirmed a false positive; MDO-02 is orchestrator-owned. Branch is clean and Verify is green. No new correctness, security, or scope problem introduced by the fix pass. Nothing requires owner decision — the orchestrator can finalize (merge PR #13; the Coding agent then stamps this file `Status: IMPLEMENTED` and advances `plans/INDEX.md` to `implemented`).
