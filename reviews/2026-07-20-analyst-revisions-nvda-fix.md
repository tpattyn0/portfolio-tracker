# Review: analyst-revisions-nvda-fix

Date: 2026-07-20
Status:

## Summary

Findings: 0 BLOCKERs, 0 ISSUEs, 1 SUGGESTION, 2 QUESTIONs

Requires owner decision: ARV-Q1 (apply the pending migration — `prisma migrate deploy`), ARV-Q2 (live NVDA visual click-through, cold + cache-hit)
Ready for Coding agent: ARV-S1 (optional; no code change strictly required)

Scope reviewed: the analyst-revisions-nvda-fix delta only (`f8baca74..HEAD`), i.e. the 90-day filter + the `AnalystRating` persistence migration + docs. The prior research-tab-fixes work (already `IMPLEMENTED`, `reviews/2026-07-19-research-tab-fixes.md`) was not re-reviewed. The security-review skill's file list diffs against a wider base and therefore lists prior-work files (components, intrinsic-value, etc.); those are not part of this delta and were excluded from the correctness pass. Delta touches exactly: `lib/services/analyst-ratings.service.ts` (+ test), `prisma/schema.prisma`, the new migration, and 4 docs (`AGENT.md`, `DECISIONS.md`, `TECH_DEBT.md`, `STATUS.md`, `plans/INDEX.md`).

Verification: `npm run verify` green — typecheck ok, lint ok (only pre-existing warnings, none in the changed lines), 129/129 tests, secret-scan clean.

The delta is correct. The filter boundary math, the persistence write/read round-trip, the back-compat coalescing, and the additive-only migration were all verified statically and hold. The two QUESTIONs are owner-action items that cannot be closed in review (migration deploy + live-data eyeball), correctly gated by the coding agent (migration created-but-unapplied is the intended state, not a defect).

## Findings

### ARV-Q1 — QUESTION (owner action: apply the pending migration)
**File:** `prisma/migrations/20260719231015_analyst_revisions_low_high/migration.sql`
**Problem:** The migration is created (`prisma migrate dev --create-only`) but deliberately **not applied** to the shared dev/prod database (ADR-6/ADR-14 protocol, ADR-19 `Status: accepted-but-pending-deploy`). This is the *correct* behaviour for the coding agent — it must not apply a shared-DB migration without owner sign-off — so this is not a defect. But it is a known-and-active gated state with a real consequence: until the owner runs `prisma migrate deploy`, `saveToDatabase` writes `targetLowPrice`/`targetHighPrice`/`revisions` against a table whose columns do not yet exist, so a **fresh (cold) fetch of any symbol's analyst ratings will fail at the upsert** against the real unmigrated table (the locally-regenerated Prisma Client knows the columns; the live DB does not). Cache-hit reads are unaffected (they only read; `formatCachedData` coalesces absent columns to `null`/`[]`). The migration SQL was confirmed additive-only: three `ADD COLUMN`, all nullable, no `DROP`/`ALTER TYPE`/`NOT NULL`-without-default/destructive statements, and it matches the `schema.prisma` change exactly (`revisions` JSONB, `targetHighPrice`/`targetLowPrice` `DECIMAL(10,2)`).
**Recommendation:** Owner: apply the migration to the shared DB (`prisma migrate deploy`) before relying on a cold analyst-ratings fetch in either environment. Confirm `prisma migrate status` shows it applied afterward. No code change — this is a deploy/sequencing action the coding agent correctly left to you.

### ARV-Q2 — QUESTION (owner action: live NVDA visual acceptance)
**File:** `components/analyst-ratings.tsx` (unchanged) via `lib/services/analyst-ratings.service.ts`
**Problem:** The originating bug report ("No analyst revisions in the last 90 days" for NVDA) is a user-visible/live-data symptom. The fix's correctness was verified statically here (filter math, round-trip, back-compat) and via 129/129 unit tests, but the end-to-end "revisions actually populate for NVDA, including on a cache-hit reload, and stay within ~90 days newest-first" cannot be observed until the migration is applied (ARV-Q1) and the tab is opened against live Yahoo data. Also confirm a genuinely thin-coverage symbol (e.g. ENGI.PA) still shows the earned empty state.
**Recommendation:** Owner: after ARV-Q1, open the Analysts tab for NVDA twice (second load = 24h cache hit) — both must show a populated, ≤90-day, newest-first, ≤25-row revisions table; confirm a thin-coverage symbol still shows the empty state. This is owner acceptance, not a code finding.

### ARV-S1 — SUGGESTION (optional; not blocking)
**File:** `lib/services/analyst-ratings.service.ts:267`
**Problem:** `formatCachedData` casts `cached.revisions as unknown as AnalystRevision[]` after only an `Array.isArray` guard — it validates that the stored value is an array, but not that each element has the `{firm, action, fromGrade, toGrade, date}` shape. In practice this is safe: the only writer is `saveToDatabase`, which always serializes the typed `filterRecentRevisions(...)` output, so the shape cannot drift within this codebase, and the downstream React render is auto-escaped. The residual risk is only a future schema/shape change to `AnalystRevision` made in one of the two round-trip sites but not the other — which AGENT.md's fragile-surface entry already explicitly warns against. No action is strictly required.
**Recommendation:** Optional hardening only if desired later: a lightweight per-element shape check (or a shared serialize/deserialize pair) would make the write/read contract enforced rather than documented. Given the bounded, single-writer, display-only nature of the field, leaving it as-is with the existing AGENT.md guard is a reasonable call — record as no-action unless the owner wants the belt-and-braces.

## Verified (no finding)

- **Filter boundary math (`filterRecentRevisions`, service:22–38).** `t >= windowStartMs && t <= nowMs` with `windowStartMs = nowMs - windowDays*86400000`. Exactly-90-days-ago is `>= windowStart` → **included**; 91-days-ago is `< windowStart` → **excluded**. Future-dated (`t > nowMs`) → **excluded**. Sort is `b - a` (newest-first), then `.slice(0, cap)` keeps the newest `cap` after sort. `now` is an injected parameter; the production call at service:145 passes `new Date()`. Tests assert all of this with real dates: boundary-inclusive (90), boundary-exclusive (91), future-exclusion, cap-to-25-with-newest-first-ordering asserted explicitly, and custom window/cap params. Meaningful, not presence-only.
- **Persistence round-trip.** Write: `saveToDatabase` serializes `data.revisions` (the already-90-day-filtered set, since `filterRecentRevisions` is applied in `extractRatings` *before* the return that flows into `saveToDatabase`) as `Prisma.InputJsonValue`, plus the two Decimals. Read: `formatCachedData` deserializes to the same `AnalystRevision[]` shape and `Number()`-coerces the Decimals. Write and read shapes agree (`{firm, action, fromGrade, toGrade, date}`). The persisted set is the post-filter set, consistent with the cold-fetch path (both surface the same windowed list) — no cold-vs-cache mismatch. Round-trip covered by the updated cache-hit test.
- **Back-compat.** A pre-migration row (columns absent/null) coalesces: `targetLowPrice`/`targetHighPrice` via falsy-check → `null`; `revisions` via `Array.isArray` → `[]`. Does not crash or return `undefined`. Explicitly tested ("gracefully returns null/[] on a cache hit when the revisions/low/high columns are absent").
- **Migration additive-only + schema parity.** Confirmed above (ARV-Q1). Safe for the shared DB.
- **Scope containment.** `git diff --name-only f8baca74..HEAD` touches only the service, its test, schema, migration, and docs — no buy-bar / intrinsic / positions / news component files re-touched. No `hsl(var(--x))` reintroduced. No new `quoteSummary` call site (`safeQuoteSummary` remains the sole chokepoint, ADR-15). The filter helper is pure (no side effects, `now` injected).
- **Security pass (Step 1).** No HIGH/MEDIUM findings. The `revisions` JSON is populated exclusively from Yahoo's server-side response, never user input; DB access is via Prisma parameterized upsert (no injection surface); the JSON read is Prisma-parsed (no unsafe deserialization/reviver) and rendered by auto-escaping React; migration DDL is static/additive. No new endpoints, auth, secrets, or crypto.
- **Standing checklist.** Working tree clean (`git status --porcelain` empty). STATUS.md 12 lines, links + one `Note:` line (pending-migration flag) — within the ≤20-line limit, not narrative bloat. ADR-19 conforms to the ADR template (Decision/Evidence/Tradeoffs/Status/Confidence); `accepted-but-pending-deploy` is an honest status that accurately flags the unapplied migration. TD-DTL-REV2 moved to the Resolved table with a dated, accurate row and correctly notes the migration is created-but-unapplied. AGENT.md fragile-surface entry updated to the persisted reality, the saveToDatabase/formatCachedData sync requirement, and the owner-gated apply. No secrets; secret-scan passes. `## Verify` block present and green (129/129). Tests mock `@/lib/prisma` (`findUnique`/`upsert` are `vi.fn()`), so the unapplied migration does not block the suite — confirmed by reading the test mocks, and verify passes.

## Proposed DECISIONS.md entries

None. ADR-19 was authored by the Planner/Coding agent for this change and is accurate as written (including the honest `accepted-but-pending-deploy` status and the not-applied evidence note). No additional ADR required.
