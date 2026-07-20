# Plan: Configurable scoring weights

Date: 2026-07-20

## Problem

Every asset's scores use fixed, hardcoded weights that cannot reflect a user's
personal investment style:

- The **composite / general score** in `components/overview.tsx:136-141` blends the
  five research dimensions with fixed weights (intrinsicValue 0.25, fundamental
  0.25, technical 0.20, sentiment 0.15, analyst 0.15).
- The **fundamental score** in `lib/services/fundamental-analysis.service.ts:322-336`
  blends its five subcategories with fixed weights (valuation 0.3, profitability
  0.3, growth 0.2, financial 0.15, dividend 0.05).

A value investor wants fundamentals/intrinsic value to dominate; a momentum trader
wants technical/sentiment to dominate. `future_ideas.md:12` calls for making the
scoring reflect the user's style. This feature lets each user set their own weights,
persisted per-user, so their scores are personalized everywhere while a user who
never touches the settings sees exactly the same numbers as today.

## Approach

### Owner decisions (already settled — baked into this plan)

1. **Persistence:** a new per-user Prisma table, additive migration generated
   `--create-only` and **NOT applied** by the Coding agent (owner-gated
   `prisma migrate deploy`, per ADR-6/ADR-14/ADR-19 precedent — dev and prod share
   one database).
2. **Compute split:** composite recomputed **client-side** in `overview.tsx` from the
   five dimension scores + the user's fetched category weights (live, no refetch on
   weight change); fundamental subcategory weighting stays **server-side** in
   `fundamental-analysis.service.ts`, applied by passing the user's weights in as a
   parameter (route reads prefs, passes to a pure service method — service does NOT
   fetch from the DB itself, per ADR-3).
3. **UI:** a dedicated Settings page at `/settings` (the account-menu link
   `components/navigation.tsx:110-112` already points there and currently 404s).
4. **Normalization:** auto-normalize each group to sum to 1.0 before scoring. User
   enters relative weights; the app normalizes. Two groups normalize independently.

### Storage shape decision — discrete `Float?` columns, not a JSON blob

The new table stores the ten weights as **ten discrete nullable `Float` columns**
(five composite, five fundamental), not a single `Json` column. Rationale:

- The set is **fixed and known at schema-design time** (exactly ten scalars, no
  growth expected — a sixth composite dimension would be an ADR-level change to the
  scoring model itself, not a preferences-shape change), so the "JSON is simpler for
  an unbounded/evolving bag" argument (the reason `AnalystRating.revisions` is Json,
  ADR-19) does not apply here.
- Discrete typed columns give Prisma-level type safety and DB-level defaults, and are
  self-documenting in the schema (a reviewer sees the ten knobs directly).
- We store **raw** weights (what the user typed), never normalized — normalization is
  a pure, deterministic derivation applied at scoring time. Storing raw keeps the
  round-trip lossless (the settings UI shows back exactly what the user set) and keeps
  all normalization logic in one tested pure function rather than split between write
  and read. See ADR-20.

`Float` (not `Decimal`) is correct here: these are relative UI weights, not money —
no exact-decimal requirement, and `Float?` matches the `FundamentalData` numeric
columns' precedent. All ten columns are **nullable with no DB default**; "no row" and
"a row with some nulls" both fall back to the hardcoded defaults in one place (the
GET normaliser), so a partially-populated row can never silently zero a dimension.

### Table

```prisma
model UserScoringPreferences {
  id                    String   @id @default(cuid())
  userId                String   @unique
  // Composite category weights (raw, relative — normalised at scoring time)
  wCompositeIntrinsic   Float?
  wCompositeFundamental Float?
  wCompositeTechnical   Float?
  wCompositeSentiment   Float?
  wCompositeAnalyst     Float?
  // Fundamental subcategory weights (raw, relative)
  wFundValuation        Float?
  wFundProfitability    Float?
  wFundGrowth           Float?
  wFundFinancial        Float?
  wFundDividend         Float?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Plus `userScoringPreferences UserScoringPreferences?` added to the `User` model
(1:1, mirroring the existing `portfolio`/`wishlist` 1:1 relations).

### Defaults (must equal today's hardcoded values — verified against code)

Captured as a shared, exported constant `DEFAULT_SCORING_WEIGHTS` in a new pure module
`lib/utils/scoring-weights.ts`, the single source of truth used by the client
composite math, the server fundamental math, the GET-preferences fallback, and the
reset action:

```ts
// Composite — from components/overview.tsx:136-141 (and wishlist.service.ts:274-280, identical)
composite: { intrinsic: 0.25, fundamental: 0.25, technical: 0.20, sentiment: 0.15, analyst: 0.15 }
// Fundamental — from fundamental-analysis.service.ts:322-328 (READ from code, verified)
fundamental: { valuation: 0.3, profitability: 0.3, growth: 0.2, financial: 0.15, dividend: 0.05 }
```

Both groups already sum to 1.0 as authored, so normalizing the defaults is a no-op —
a user with no row scores byte-identically to today. This is the backward-compat
guarantee and is asserted by a test.

### Normalization contract (pure, tested — `lib/utils/scoring-weights.ts`)

`normalizeWeights(raw: Record<K, number>): Record<K, number>` for a group:

- **Negative inputs** → clamped to `0` before summing (defensive; the API also
  rejects negatives at write time, so this is belt-and-suspenders for any stored/
  legacy value).
- **All-zero (or all-negative-clamped-to-zero) group** → fall back to that group's
  **defaults** (not equal weights). Rationale: defaults are a meaningful, curated
  distribution; equal weights would silently change a user's scores to something they
  never chose. Documented in ADR-20 and tested.
- **Single non-zero weight** → that dimension gets `1.0`, all others `0.0` (a valid,
  intended "score purely on X" configuration).
- **Normal case** → each weight divided by the group sum, so the group sums to `1.0`.
- Output is always a full group (every key present), so downstream weighted sums never
  see an undefined weight.

The **composite** weighted sum then follows the existing `overview.tsx` pattern
exactly: each dimension's score defaults to a neutral `5` when its own query errored/
returned nothing (`?? 5`), multiplied by its normalized weight, summed. Because
normalized weights sum to 1.0, the result stays a valid 0-10 weighted average.

The **fundamental** weighted total follows the existing service formula
(`fundamental-analysis.service.ts:330-336`), which already divides by the sum of
weights — with normalized weights that divisor is 1.0, so the existing shape is
preserved and the current default weights reproduce the current number exactly.

### Composite (client) plumbing

`overview.tsx` gains one more `useQuery` (`queryKey: ["scoring-weights"]`,
`staleTime: Infinity` / a long stale time — this is user config, not market data)
fetching `GET /api/settings/scoring-weights`. The hardcoded `weights` object at
`overview.tsx:136-141` is replaced by `normalizeWeights(prefs?.composite ?? DEFAULT_SCORING_WEIGHTS.composite)`.
Because the composite is a `useMemo` over the dimension scores + weights, changing a
weight anywhere (or the query resolving) re-derives the composite instantly with no
market-data refetch. The five dimension queries are untouched. The weights query is
added to the existing five-way `isLoading` OR-gate
(`overview.tsx:165-170`) so the card paints once with final weights, never a jump
from default → custom (consistent with the fragile-surface rule at
`AGENT.md` overview loading gate).

### Fundamental (server) plumbing

- `calculateFundamentalScore` (private, `fundamental-analysis.service.ts:227`) is
  **not** where weights get injected — keep it computing the weight-independent
  `breakdown` (the five subcategory 0-10 scores) exactly as today. Its final
  `total`/`weights` block stays as the default-weighted total (so nothing that reads
  the method in isolation changes).
- The subcategory reweighting is applied as a **separate pure step** because the
  `breakdown` is weight-independent and is carried through **both** the fresh path
  (`calculateFundamentalScore` output) and the 24h cache path (`formatCachedData`
  reads `scoreDetails.breakdown` from the DB). Add a pure exported helper
  `weightedFundamentalTotal(breakdown, weights): number` to `lib/utils/scoring-weights.ts`.
- `fetchFundamentals(symbol)` gains an optional second parameter:
  `fetchFundamentals(symbol: string, fundamentalWeights?: FundamentalWeights)`.
  When provided, after obtaining `metrics.score` (from either the fresh or the cached
  path), it recomputes `metrics.score.total = weightedFundamentalTotal(metrics.score.breakdown, normalizeWeights(fundamentalWeights))`
  before returning. When omitted, behaviour is byte-identical to today (defaults are
  already baked into the stored/computed total). This keeps the service **pure w.r.t.
  the DB for weights** (ADR-3): the service never reads `UserScoringPreferences`; the
  route does.
  - **Cache safety:** the persisted `FundamentalData.fundamentalScore` /
    `scoreDetails` continue to store the **default-weighted** total and the
    weight-independent breakdown — the per-user reweight is applied on read, after the
    cache, and is **never written back**. So the shared symbol-keyed cache stays
    user-independent (ADR-4 unaffected). Only `total` is re-derived per user;
    `breakdown` and all raw metrics are identical for every user.
- **Route:** `app/api/market/fundamentals/[symbol]/route.ts` (currently inline-auth,
  `getServerSession`) reads the authenticated user's prefs and passes the fundamental
  weights to `fetchFundamentals`. It should migrate to `getAuthenticatedUser()`
  (AGENT.md conventions) while we are touching it, then load prefs via the new
  preferences service and pass `prefs.fundamental` to the service call.

### Wishlist (scope-flagged extension)

`lib/services/wishlist.service.ts` is a **second consumer** of both weight groups: it
calls `fetchFundamentals(item.ticker)` at line 199 (fundamental subcategory weights)
and hard-codes the composite weights at lines 274-280 (identical to overview's). Its
methods already receive `userId`. For a coherent "set once, applies everywhere"
promise, the wishlist composite and its fundamental call should also use the user's
weights. This is included as an explicit, ordered task (Task 8) rather than left
silently inconsistent — but it is sequenced last so the core feature (Tasks 1-7)
lands independently if Task 8 hits a snag. See Assumptions.

### Settings page

New route `app/(dashboard)/settings/page.tsx` (client component) with two labelled
sections — "Composite score" (5 category weights) and "Fundamental score" (5
subcategory weights) — each a weight control per dimension, a live normalized-%
readout per dimension and per group, and a "Reset to defaults" action per group (or
one global reset — Designer's call). Save persists via
`PUT /api/settings/scoring-weights`; on success, invalidate the `["scoring-weights"]`
query so open research tabs pick up the change. The exact visual treatment (control
type, layout, live-% presentation, the "custom weights active" affordance on score
cards) is the **Designer stage's** job — see "Notes for the Designer stage".

## Tasks

Ordered, independently verifiable. Task status markers maintained by the Coding agent
in this file: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked.

1. [ ] **Pure weights module + defaults + normalization.** Create
   `lib/utils/scoring-weights.ts` exporting: `DEFAULT_SCORING_WEIGHTS` (the verified
   defaults above), types (`CompositeWeights`, `FundamentalWeights`),
   `normalizeWeights(raw)` (clamp-negatives, all-zero→defaults, single→1.0, normal→sum-to-1),
   `weightedFundamentalTotal(breakdown, weights)`, and `weightedCompositeTotal(scores, weights)`
   (the composite math, extracted so both `overview.tsx` and the future wishlist path
   share one implementation). No React, no DB, no I/O.
   — **Acceptance:** `lib/utils/scoring-weights.test.ts` passes covering: defaults sum
   to 1.0 and normalize to themselves (no-op); all-zero → defaults; single non-zero →
   1.0/0.0; negatives clamped; normal case sums to 1.0; `weightedFundamentalTotal` with
   default weights reproduces the current default-weighted number for a known breakdown;
   `weightedCompositeTotal` with default weights matches `overview.tsx`'s current formula
   for a known score set. `npm run verify` green.

2. [ ] **Prisma model + owner-gated migration.** Add `UserScoringPreferences` (shape
   above) and the `User.userScoringPreferences` back-relation to
   `prisma/schema.prisma`. Generate the migration with
   `prisma migrate dev --create-only` (session-mode `DIRECT_URL`), run
   `prisma generate` so the client knows the model, and **do NOT run
   `prisma migrate deploy`** — hold for owner sign-off (see Open decisions).
   — **Acceptance:** `prisma/migrations/<ts>_user_scoring_preferences/migration.sql`
   exists and contains only additive statements (`CREATE TABLE`, `CREATE INDEX`,
   `ADD CONSTRAINT` FK — no `DROP`/`ALTER ... DROP`). `prisma migrate status` shows it
   as pending (not applied). Typecheck passes against the regenerated client.

3. [ ] **Preferences service.** Create `lib/services/scoring-preferences.service.ts`
   with `getWeights(userId): { composite, fundamental }` (reads the row, coalesces each
   null column to its default, returns the RAW-but-defaulted set — normalization is a
   read-model concern the callers apply) and `saveWeights(userId, input)` (validates,
   upserts on `userId`). Validation: reject any negative or non-finite number (400);
   accept any group that is all-zero (the normaliser handles it as defaults). Pure
   business logic in the service; no auth (route does auth), per ADR-3.
   — **Acceptance:** `lib/services/scoring-preferences.service.test.ts` passes (Prisma
   mocked): no row → all-defaults; partial row (some nulls) → nulls filled with
   defaults, set values preserved; `saveWeights` upserts; negative/NaN input rejected.

4. [ ] **Preferences API route.** Create `app/api/settings/scoring-weights/route.ts`
   with `GET` (auth via `getAuthenticatedUser()`, returns
   `{ composite, fundamental }` from the service) and `PUT` (auth, validates body,
   calls `saveWeights`, returns the saved+defaulted set). Thin — delegates to the
   service (ADR-3).
   — **Acceptance:** `app/api/settings/scoring-weights/route.test.ts` passes: 401 when
   unauthenticated; GET returns defaults for a user with no row; PUT persists and GET
   reflects it; PUT with a negative weight → 400.

5. [ ] **Composite goes user-weighted (research Overview).** In `overview.tsx`, add the
   `["scoring-weights"]` query, replace the hardcoded weights object
   (`overview.tsx:136-141`) with `weightedCompositeTotal(scores, normalizeWeights(prefs.composite))`
   using the shared module, and add the weights query to the `isLoading` OR-gate
   (`overview.tsx:165-170`). No change to the five dimension queries or the neutral-5
   fallbacks.
   — **Acceptance:** with no prefs row the composite figure is unchanged vs. today
   (default weights). Manually: change a weight on `/settings`, return to a research
   Overview tab, the composite reflects the new weighting without a market-data
   refetch. `npm run verify` green.

6. [ ] **Fundamental score goes user-weighted (server).** Add the optional
   `fundamentalWeights` param to `fetchFundamentals` and the post-step reweight (both
   fresh and cached paths) using `weightedFundamentalTotal`. Migrate
   `app/api/market/fundamentals/[symbol]/route.ts` to `getAuthenticatedUser()`, load the
   user's fundamental weights via the preferences service, and pass them to
   `fetchFundamentals`. Persisted cache still stores the default-weighted total +
   breakdown (never the reweighted total).
   — **Acceptance:** service tests: `fetchFundamentals(symbol)` (no weights) returns the
   same `total` as before; `fetchFundamentals(symbol, customWeights)` returns a `total`
   equal to `weightedFundamentalTotal(breakdown, normalizeWeights(customWeights))` and an
   unchanged `breakdown`. Route test: fundamentals response `score.total` for a user with
   custom fundamental weights differs from a default user, while `breakdown` is identical.
   Verify the cache row is not rewritten with a per-user total. `npm run verify` green.

7. [ ] **Settings page.** Create `app/(dashboard)/settings/page.tsx` implementing the
   Designer's spec (Task 0 of the Designer stage): two labelled sections, per-dimension
   weight controls, live normalized-% readout, reset-to-defaults, save (PUT +
   `["scoring-weights"]` invalidation + toast). Uses only DESIGN.md tokens/components.
   Add a route `loading.tsx` per the DESIGN.md skeleton rule.
   — **Acceptance:** `/settings` loads (no longer 404s from the account menu), shows the
   ten controls seeded from GET, the live % updates as weights change, reset restores
   defaults, save persists (reload shows saved values). `npm run verify` green.

8. [ ] **Wishlist uses the SAME single scoring definition (owner requirement — not optional).**
   Owner decision (2026-07-20): **there must be exactly ONE definition of the scores — no
   two parallel implementations.** The wishlist currently DUPLICATES the composite math
   (`wishlist.service.ts:274-280` hardcodes the same weights + formula that `overview.tsx`
   does) and calls `fetchFundamentals(item.ticker)` on defaults. This task eliminates that
   duplication: the wishlist must consume the shared `weightedCompositeTotal` /
   `weightedFundamentalTotal` / `normalizeWeights` from `lib/utils/scoring-weights.ts` (the
   single source of truth created in Task 1) — it must NOT keep its own copy of the weights
   or the summation formula. In `wishlist.service.ts`, load the user's weights once per
   `getWishlistWithScores(userId, …)` call, pass `weights.fundamental` to the
   `fetchFundamentals(item.ticker, weights.fundamental)` call (line 199), and replace the
   hardcoded composite weights + inline formula (lines 274-280) with
   `weightedCompositeTotal(scores, normalizeWeights(weights.composite))` (preserving the
   existing `?? 5` missing-dimension fallback). After this task, `grep` for a hardcoded
   composite/fundamental weights object should find it ONLY in
   `DEFAULT_SCORING_WEIGHTS` (lib/utils/scoring-weights.ts) — nowhere else. This task is
   REQUIRED (still sequenced last so Tasks 1-7 land first, but it is not droppable).
   — **Acceptance:** wishlist composite for a user with no prefs row is unchanged vs.
   today; with custom weights it matches `weightedCompositeTotal`; the wishlist and the
   research Overview tab produce the IDENTICAL composite for the same stock + same user
   (proving one definition). `grep -rn` finds no hardcoded scoring-weights object outside
   `lib/utils/scoring-weights.ts`. Existing wishlist tests still pass; a new test covers
   the custom-weights path and the wishlist-equals-overview invariant. `npm run verify` green.

## Files to create or modify

Create:
- `lib/utils/scoring-weights.ts` + `.test.ts`
- `lib/services/scoring-preferences.service.ts` + `.test.ts`
- `app/api/settings/scoring-weights/route.ts` + `.test.ts`
- `app/(dashboard)/settings/page.tsx` + `app/(dashboard)/settings/loading.tsx`
- `prisma/migrations/<ts>_user_scoring_preferences/migration.sql` (generated,
  `--create-only`, held)

Modify:
- `prisma/schema.prisma` (new model + `User` back-relation)
- `components/overview.tsx` (weights query, composite math, loading gate)
- `lib/services/fundamental-analysis.service.ts` (`fetchFundamentals` param + reweight step)
- `app/api/market/fundamentals/[symbol]/route.ts` (auth helper + load/pass weights)
- `lib/services/wishlist.service.ts` (Task 8 — user weights)
- `DECISIONS.md` (ADR-20, ADR-21 below)
- `ARCHITECTURE.md` (data-model + key-files rows — see below)
- `AGENT.md` (new fragile-surface note — see below)

## Verification

`npm run verify` (the AGENT.md Verify block: typecheck, lint, tests, secret-scan)
runs after every task and must pass. Beyond it:

- **Backward-compat proof:** with no `UserScoringPreferences` row, both the composite
  figure (research Overview + wishlist) and the fundamental `total` are numerically
  identical to pre-change output. Covered by unit tests (defaults normalize to
  themselves; default-weighted totals reproduce current numbers) and a manual spot-check
  on one symbol.
- **Live composite recompute (manual):** change a composite weight on `/settings`,
  open a research Overview tab — composite updates with no `/api/market|research`
  refetch (observe the network tab; the only new request is the one-time
  `GET /api/settings/scoring-weights`).
- **Fundamental per-user (manual):** two users (or one user toggling weights) see
  different fundamental `total` for the same symbol while `breakdown` and metrics are
  identical, and the shared `FundamentalData` cache row's stored `fundamentalScore`
  does not change per user.
- **Migration is held:** `prisma migrate status` shows the new migration pending, not
  applied, before owner sign-off.

## Assumptions

- **Wishlist is in scope (Task 8), REQUIRED — owner decision 2026-07-20.** The owner
  ruled there must be exactly one definition of the scores, no two parallel
  implementations. The wishlist currently duplicates the composite math; Task 8 makes it
  consume the shared `scoring-weights.ts` module (single source of truth) and the user's
  weights. Sequenced last (so Tasks 1-7 land first) but NOT droppable — leaving the
  wishlist on a duplicate hardcoded definition is exactly what the owner forbade.
- **Store raw weights, normalize at read/scoring time** (ADR-20). The settings UI
  shows back exactly what the user typed; scoring always uses the normalized form.
- **All-zero group falls back to defaults, not equal weights** (ADR-20) — a curated
  distribution the user has seen, not a silent third behaviour.
- **Discrete `Float?` columns, not a Json blob** (ADR-20) — the ten knobs are fixed and
  known; discrete columns are type-safe and self-documenting.
- **Per-user fundamental reweight is applied on read and never written back to the
  shared cache** — the symbol-keyed `FundamentalData` cache stays user-independent
  (ADR-4 preserved); only `score.total` is re-derived per user from the
  weight-independent `breakdown`.
- **The existing `components/ui/slider.tsx` (Radix) already consumes Meridian-mapped
  tokens** (`bg-secondary` = `--fill`, `bg-primary` = `--btnbg`, `ring-ring` = `--ink`
  per the DESIGN.md mapping table), so if the Designer chooses sliders it needs
  retokenization review, not a new component — but the control choice is the Designer's
  (see below).
- **Weights are relative positive numbers with a sensible input range** (e.g. 0-100
  integer steppers or 0-10 sliders) — the exact range/step is a Designer decision; the
  math treats them as arbitrary non-negative reals and normalizes, so any range works.
- **News/sentiment and analyst subscores are not further subdivided** — only the
  composite (5 categories) and the fundamental score (5 subcategories) are configurable,
  exactly as the owner scoped. Technical/analyst/intrinsic/sentiment internal weighting
  is out of scope.

## Open decisions

- **Migration apply is owner-gated.** The `UserScoringPreferences` migration is
  generated `--create-only` and must NOT be applied by the Coding agent. Per
  ADR-6/ADR-14/ADR-19, the owner runs `prisma migrate deploy` (or explicitly signs off)
  against the shared dev/prod database before the feature is live. Until then, GET/PUT
  will fail against the unmigrated table even though the regenerated Prisma Client knows
  the model. The Coding agent must surface this in its PR summary (mirroring ADR-19's
  "accepted-but-pending-deploy" handling) and must not mark the plan `implemented` on
  the strength of code alone.

---

## Notes for the Designer stage (required — this feature adds a whole new page)

The Designer owns the exact visual treatment. This section frames the surfaces and the
open visual choices, and points at the DESIGN.md tokens/components to reuse. Do **not**
invent new colors, type sizes, or spacing — everything below maps to an existing token
or component; flag any genuine gap rather than hardcoding.

### The Settings page (`/settings`)

- **Page chrome:** authed-screen container (DESIGN.md Spacing/shape: max-width 1400px,
  padding `56px 32px 96px`). H1 in Newsreader (Screen H1, 52px/500) with a kicker
  eyebrow above it per the Tone-of-voice "every screen's H1 gets a kicker" rule —
  something in the newspaper register (e.g. an eyebrow like "House rules · how your
  scores are weighed"; final copy is the Designer's, matching the "measured,
  declarative, editorial" voice). An italic-serif subline is optional (Research index
  H1 subline pattern, 16px italic `--mut`).
- **Two labelled sections, in order:** (1) **Composite score** — the five research
  categories: Technical · Fundamental · Analysts · Intrinsic value · News & sentiment;
  (2) **Fundamental score** — the five subcategories: Valuation · Profitability ·
  Growth · Financial health · Dividend. Each section is a **Card** (DESIGN.md Card:
  `--card` bg, 1px `--line` border, radius 8px, 24-28px padding; no shadow) with a
  section kicker header (11px/600 uppercase 0.14em `--ink`, matching the Headline score
  card header row). Consider the `border-t: 3px double var(--ink)` Editorial-card
  variant to give the two sections editorial weight — Designer's call.
- **Per-dimension weight control — Designer chooses the control type.** Three options,
  with a recommendation:
  - **Recommended: numeric steppers / small numeric inputs** (DESIGN.md Inputs: 40px
    height, radius 6px, `--bg` background as a cutout, 1px `--line` border, no focus
    glow). Rationale: the weights are *relative numbers the user reasons about* and the
    live normalized-% readout is the real feedback surface; a precise numeric field
    reads cleaner in the newspaper-ledger aesthetic than a chunky slider, and reuses an
    existing, already-tokenized component with no new primitive.
  - **Alternative: sliders** (`components/ui/slider.tsx` exists, Radix-based). It
    currently uses `bg-secondary`/`bg-primary`/`ring-ring` which already resolve to
    Meridian tokens (`--fill`/`--btnbg`/`--ink`), so it is close — but a 20px round
    thumb with a filled track is a heavier, more "app-like" motif than Meridian's flat
    ruled surfaces. If the Designer wants sliders, note in DESIGN.md how the slider is
    retokenized to sit in the ruled aesthetic (thinner track, square/flat thumb?), and
    add a "Slider" component entry to DESIGN.md's Components section (there is none
    today) so it is a named, reusable pattern rather than a one-off.
  - **Not recommended: free sliders + numeric both** — redundant; pick one primary
    control.
- **Live normalized-% readout.** Each dimension shows its normalized share (e.g.
  "Fundamental · 31%") updating live as weights change, and each group shows it sums to
  100%. This is the feature's core feedback loop — the user sets *relative* weights and
  sees the *resulting* distribution. Recommended treatment: reuse the **Subscore band /
  Ruled stat band** vocabulary (N equal columns, `--line2` verticals, kicker-over-value
  cells) to show the live percentages as a ruled band beneath each section's controls —
  this ties the settings page to the exact visual language of the score cards the
  weights drive. The percentage figure in Newsreader (the "value that matters" per
  Tone-of-voice serif-for-consequence rule). Designer finalizes whether the % sits
  inline next to each control, in a summary band, or both.
- **Reset to defaults.** A secondary pill button (DESIGN.md Buttons: transparent bg,
  `--ink` text, 1px `--line` border, 38px) — one per section, or one global reset;
  Designer's call. Copy in the measured register ("Reset to house defaults" or similar,
  not "Reset!"). On reset, controls return to `DEFAULT_SCORING_WEIGHTS`.
- **Save.** Primary pill button (`--btnbg`/`--btnfg`, no border, 38-44px). A toast on
  success (existing `toaster`). Consider whether save is explicit or auto-on-change —
  recommend **explicit save** (a "Save weights" primary + a dirty-state indication) so
  the user commits deliberately; auto-save would fire a PUT on every keystroke. Designer
  finalizes.
- **Loading / skeleton.** Add `settings/loading.tsx` per the DESIGN.md Loading-skeleton
  rule (compose from `components/ui/loading-skeleton.tsx` primitives: kicker + H1 block,
  two `SkeletonCard`s each with a `SkeletonStatBand columns={5}` for the live-% band and
  control-row blocks). Mirror the real two-section geometry, not a generic placeholder.

### The "custom weights active" affordance (Designer's call)

When a user has customized their weights, their scores everywhere are personalized —
they should have a subtle signal so they know a composite/fundamental score reflects
*their* weighting, not the house default. The Headline score card's **meta kicker**
(right side of the header row, 10.5px uppercase `--mut` — today reads e.g. "Meridian
rating · updated daily", `overview.tsx:214`) is the natural, already-existing home for
this: it could read "Your weighting · updated daily" (or append "· custom weights") when
the user has a non-default set. This needs the client to know whether the active weights
differ from defaults (a cheap comparison against `DEFAULT_SCORING_WEIGHTS`, already
fetched). Whether to show it, the exact copy, and whether it also appears on the
Fundamental tab's headline card are **Designer decisions** — flagged here so the affordance
is considered rather than forgotten. Keep it a text/kicker signal (no new color, no new
badge chrome) to stay within the "text-only, no fourth accent" system unless the
Designer explicitly adds a named pattern.

### Nav / entry point

The account dropdown already links to `/settings` (`components/navigation.tsx:110-112`)
and currently 404s — no nav change is needed, this plan just makes the destination
exist. Confirm the Settings link placement/label is right for this page's content
(it is a generic "Settings" today; if more settings arrive later this page may grow
sections — out of scope now).
