# Review: onboarding framework docs (PRODUCT / ARCHITECTURE / DECISIONS / AGENT / TECH_DEBT)
Date: 2026-07-16
Status: PARTIALLY IMPLEMENTED — 2026-07-16 (DOC-02..05 done; DOC-06 skipped — owner did not have the deployment target to confirm, deferred). DOC-01 resolved 2026-07-17 via PRs #3/#4 (owner-merged): CI `code-gate` scans each PR's commit range and `secret-history` scans full history; `npm run secret-scan:history` covers history locally; the working-tree scan keeps `--no-git` but suppresses only known findings by narrow fingerprint (`.gitleaks-local/`), never a path allowlist.

Audit target: branch `feature/onboarding-audit-fixes` @ `90f435fd` — working tree clean (non-`.next`; `.next` now untracked per ONB-08).
Scope: the five framework docs created by the Coding agent under ONB-09, verified against code at HEAD. This is a follow-up to `reviews/2026-07-16-onboarding.md`.

## Summary
Findings: 1 BLOCKER, 3 ISSUEs, 2 SUGGESTIONs, 0 QUESTIONs
Requires owner decision: DOC-01
Ready for Coding agent: DOC-02, DOC-03, DOC-04, DOC-05, DOC-06

Overall: the docs are accurate and unusually good. I verified every substantive claim I could reach from code and found **no invented features and no doc-vs-code drift** — the failure mode I was most concerned about. `AGENT.md` "Known fragile surfaces" is genuinely valuable engineering documentation (the `sentiment.service.ts` import-time crash, the self-referential HTTP calls in `wishlist.service.ts`, the `latestMigrationDate` cache trap). `TECH_DEBT.md` did **not** bury the secrets finding — it is TD-01, Critical, at the top. Credit where due.

The BLOCKER below is not a doc-accuracy problem. It is a real defect in the verification tooling that the docs describe accurately — the docs faithfully document a secret scan that does not do what its name implies.

## Findings

### DOC-01 — BLOCKER
**File:** `package.json` (`secret-scan` script), `AGENT.md:38`, `.gitleaks.toml`
**Problem:** The `secret-scan` step in the `## Verify` block cannot detect the leak it most needs to detect. The command is `gitleaks detect --source . --no-git -c .gitleaks.toml --redact`. The `--no-git` flag makes gitleaks scan the **working tree only**, treating the directory as unversioned files. It never reads commit history. Since `.env` is untracked and gitignored at HEAD, there is nothing in the working tree to find, and the step reports `no leaks found` — while three live credentials sit in `3855042e`, a commit reachable from HEAD.

Verified directly (gitleaks 8.30.1):
- `npm run verify` → secret-scan passes, `no leaks found`.
- `gitleaks detect --source . -c .gitleaks.toml --redact` (history mode, allowlist intact) → `no leaks found`.
- `git log -p --all -- .env | gitleaks stdin -c .gitleaks.toml --redact` → **`leaks found: 6`**.

The `.gitleaks.toml` allowlist is **not** the cause — the project's own config finds all 6 when history is piped in. The cause is solely `--no-git`. This was isolated by re-running with the allowlist stripped: identical result, 6 leaks either way.

Impact is worse than a missing check, because it is an actively misleading one. CLAUDE.md's standing checklist treats "the Verify secret-scan step passes" as evidence that secrets are clean; a future Reviewer or CI run will read this green check as an all-clear on exactly the exposure that is currently live and public. `TECH_DEBT.md` TD-01 and the `.gitleaks.toml` comment both correctly note the historical leak is "tracked separately" — but nothing in the automated pipeline can catch a recurrence either.

**Recommendation:** change the scan to cover history, e.g. `gitleaks detect --source . -c .gitleaks.toml --redact --log-opts="--all"`, or add a second `secret-scan:history` step piping `git log -p --all` into `gitleaks stdin`. Note this will fail loudly until TD-01 is rotated **and** history is scrubbed — which is correct behavior, not a reason to keep `--no-git`. If the owner chooses to defer scrubbing, the historical commits must be allowlisted **by explicit commit SHA** (`[allowlist] commits = [...]`) so the exemption is narrow, visible, and self-documenting, rather than silently blanket-disabling history scanning for all future commits. Do not leave the current form: a check that always passes is worse than no check.

### DOC-02 — ISSUE
**File:** `TECH_DEBT.md:7` (TD-01)
**Problem:** TD-01's severity and placement are correct, but its Impact cell records the owner's risk acceptance as settled: "Owner decision pending (2026-07-16): risk accepted for now". That acceptance was given earlier in the 2026-07-16 session on the basis of a reviewer error — the finding was presented as local-clone-only because a failing `git log @{u}..` was misread as "no remote configured". The repo is in fact public (`gh repo view` → `"visibility":"PUBLIC"`, re-confirmed at HEAD this session) and the secret-bearing commit is on `origin/main`. `reviews/2026-07-16-onboarding.md` ONB-01 marks that acceptance **SUPERSEDED** for this reason; `TECH_DEBT.md` does not carry that qualifier forward, so a reader of TD-01 alone would conclude the risk was knowingly accepted with full information. It was not.
**Recommendation:** amend TD-01's Impact to state that the prior acceptance was based on incorrect information and is superseded, and that the finding awaits a fresh decision on the corrected facts. Cross-reference ONB-01.

### DOC-03 — ISSUE
**File:** `TECH_DEBT.md:31-38` (Resolved table)
**Problem:** The Resolved table reuses the `ONB-*` IDs from `reviews/2026-07-16-onboarding.md` as `TECH_DEBT.md` IDs. This collides with the file's own `TD-*` scheme and creates an ambiguous namespace: "ONB-03" now refers both to a review finding and to a resolved-debt row, and TD-05 (`CSRF`) is the live follow-up to resolved-ONB-03 while TD-06 (`rate-limit`) follows from the same row. A future reader cannot tell from an ID alone which document it belongs to.
**Recommendation:** renumber the Resolved rows to `TD-*` IDs with a "resolved by ONB-0N" reference in the Description, or add a header note stating that Resolved rows intentionally carry review-finding IDs. Either is fine; the ambiguity is not.

### DOC-04 — ISSUE
**File:** `TECH_DEBT.md:23-25` (TD-17, TD-18, TD-19)
**Problem:** All three are explicitly marked as carried over from `IMPROVEMENTS.md` without reverification ("not reverified against current line numbers", "original line range `424-481` not reverified"). Importing unverified claims into the canonical debt register contradicts CLAUDE.md's rule that a document asserting something the code does not confirm is wrong. The honesty of the annotation is good, but the entries are assertions about the codebase that nobody has checked — TD-18 in particular cites a line range that may no longer exist after this session's changes. `IMPROVEMENTS.md` also still exists at repo root, outside the framework, partially duplicated into `TECH_DEBT.md`.
**Recommendation:** verify the three against HEAD and either correct them with current evidence or drop them. Then delete `IMPROVEMENTS.md` (its content now lives in `TECH_DEBT.md`) or reduce it to a pointer, so there is one debt register rather than two.

### DOC-05 — SUGGESTION
**File:** `ARCHITECTURE.md:52`
**Problem:** The API surface section says "~23 route files under `app/api`" and declines to enumerate them. The actual count at HEAD is 23 exactly (verified by `find app/api -name 'route.ts'`), so the hedge is unnecessary. More usefully, the deliberate exceptions to the auth rule — `api/auth/[...nextauth]` and `api/auth/register`, the only two routes without a guard, both correctly public — are not recorded anywhere. That is precisely the fact a future reviewer needs, since ADR-2 warns a forgotten guard silently ships an open endpoint, and those two would otherwise read as the same defect ONB-04/ONB-05 fixed.
**Recommendation:** state the exact count and name the two intentionally-public routes with one line on why each is public.

### DOC-06 — SUGGESTION
**File:** `DECISIONS.md:24-29` (ADR-4)
**Problem:** ADR-4's Confidence is "Medium — inferred from usage; owner should confirm the deployment target before this is settled." This is carried over verbatim from the seed I wrote in the prior review and remains genuinely unresolved. The deployment target is load-bearing for more than this ADR: TD-06 (per-instance rate limiting) and TD-03 (Next.js upgrade risk) both hinge on whether this is single-instance or serverless/multi-instance. `.env` contains `NEXTAUTH_URL` and the repo has a Vercel-oriented `.gitignore` entry (`.vercel`), which hints at serverless but is not evidence.
**Recommendation:** ask the owner to confirm the deployment target, then settle ADR-4's confidence to High and reconcile TD-06's recommendation accordingly. Worth resolving once, as three items depend on it.

## Verified accurate (no action)

Recorded so a future session need not redo this work:

- **Every `PRODUCT.md` capability claim maps to real code.** Spot-checked the specific and falsifiable ones: FIFO closed-position computation with no persistence (`app/api/portfolio/closed-positions/route.ts`, no `ClosedPosition` model in schema — matches ADR-5); the `IndustryComparison` read-but-never-written fallback to hardcoded P/E 15 / P/B 1.5; wishlist 50-item cap; the five intrinsic-value methods. The "What this does NOT do" section is honest about real limitations rather than aspirational.
- **All five previously-unguarded routes now carry guards** (ONB-04/ONB-05). Full sweep of 23 route files: 21 guarded, 2 intentionally public (NextAuth handler, registration). `test-yahoo` is deleted (ONB-02). `csrf.ts` is deleted and `rate-limit.ts` is wired into 5 routes including `/api/auth/register` (ONB-03) — matching DOC-05/ONB-13's recommendation.
- **The `## Verify` block exists and passes**: typecheck clean, lint clean (pre-existing warnings only, as AGENT.md documents), 10/10 tests across 3 files, secret-scan green. AGENT.md's description of it is accurate — see DOC-01 for the caveat about what the secret-scan step actually covers.
- **ADR evidence citations check out.** `middleware.ts:21-23` is the matcher; `lib/utils/auth.ts` holds both helpers; `wishlist.service.ts:113` is the scoped `findFirst`. ADR-1 and ADR-2 are correctly marked `accepted-but-flagged` rather than presented as clean.
- **`GTM.md`, `DESIGN.md`, `future_ideas.md` are `[REQUIRES INPUT]` stubs** with no invented positioning, pricing, or design decisions.
- **ARCHITECTURE.md documents the auth *inconsistency*** (two guard patterns coexisting) rather than claiming uniformity, and TD-08 tracks it with the exact 7 affected routes. This is the doc describing reality over the ideal — exactly right.

## Proposed DECISIONS.md entries

None. ADR-1 through ADR-6 cover the decisions visible in code; ADR-6 correctly records the owner's dev/prod database confirmation. ADR-4 needs its confidence settled (DOC-06) rather than replacing.
