# Review: workflow-framework setup audit
Date: 2026-07-17
Status: IMPLEMENTED — 2026-07-17 (SA-01..07 and SA-09 fixed in this session; SA-08 and SA-10 are owner-only actions, tracked below)

Scope: full audit of this repo's adoption of `~/Projects/workflow` (SETUP.md §1–§8) — enforcement, scaffolding, docs, and whether the pieces actually work, not just exist.

## Summary
Findings: 0 BLOCKERs, 5 ISSUEs, 5 SUGGESTIONs, 0 QUESTIONs
Requires owner decision: none (SA-08 and SA-10 are owner *actions*, not decisions)
Ready for Coding agent: SA-01..07, SA-09 (all fixed in this session)

## Verified working (no action)
- **Branch protection on `main`**: probed per SETUP.md §1 — empty-commit push with `--no-verify` rejected by GitHub (`GH013`: PR required, `code-gate` required status check). Enforcement is real, not just configured.
- **Local hooks**: `.githooks/pre-commit` matches the template and is installed in `.git/hooks/` (blocks secrets + direct commits to main).
- **Claude session-end hook**: `.claude/settings.json` wires `Stop` → `session-end-git-check.sh`; script present and correct.
- **Role subagents**: `.claude/agents/` matches the template byte-for-byte (reviewer has Write/Edit per the post-`f3ce6f8` fix).
- **CLAUDE.md** matches `workflow/templates/CLAUDE.md` exactly; **GEMINI.md** defers to it.
- **CI workflow**: `.github/workflows/verify.yml` is the template correctly adapted (Node toolchain, `prisma generate`, `npm run verify:code`, PR-range secret scan as the gate, full-history scan reporting-only per ADR-7/TD-01).
- **Secrets hygiene**: `.env`, `.env.local`, `scratch/` gitignored; gitleaks installed; `verify` / `verify:code` / `secret-scan` / `secret-scan:history` scripts all present and consistent with AGENT.md.
- **`.env.local` rotation sync (was TD-29, ex-TD-07)**: all keys in `.env.local` now hash-identical to `.env`, and the rotated keys differ from the `3855042e` leaked values. Only `NEWS_API_KEY` still matches history — the known, ADR-7-accepted exposure.

## Findings

### SA-01 — ISSUE (fixed)
**File:** `.gitleaks-local/.gitleaksignore`
**Problem:** The `## Verify` block was FAILING: the working-tree secret scan flagged `.env.local:generic-api-key:16`. Syncing `.env.local` to the rotated values (which closed TD-29) made the new Gemini key fire the broader `generic-api-key` rule there, and only the `.env` variant of that fingerprint had been added. Anyone running `npm run verify` got a red on a healthy tree — the "everyone learns to ignore the scan" failure mode the ignore file itself warns about.
**Recommendation:** add the `.env.local:generic-api-key:16` fingerprint (same grounds as the existing `.env` entry). **Done.**

### SA-02 — ISSUE (fixed)
**File:** `TECH_DEBT.md`
**Problem:** Duplicate IDs in the Backlog: two TD-06 rows (secret-history gating vs in-memory rate limiting) and two TD-07 rows (.env.local pre-rotation values vs zero test coverage). Cross-references (e.g. the onboarding review's "see TD-07") were ambiguous.
**Recommendation:** renumber the newer rows to TD-28 (secret-history gating) and TD-29 (.env.local), update cross-references. **Done.**

### SA-03 — ISSUE (fixed)
**File:** `TECH_DEBT.md` (TD-29, ex-TD-07)
**Problem:** Doc drift — the Backlog said `.env.local` still carried pre-rotation secrets, but hashing shows it was already synced to the rotated values. A High-severity row that is no longer true erodes trust in the register.
**Recommendation:** move to Resolved with the hash verification recorded. **Done.**

### SA-04 — ISSUE (fixed)
**File:** `STATUS.md`
**Problem:** Stale: named `feature/onboarding-docs-fixes` as in-flight ("awaiting owner decision") though PR #2 merged 2026-07-16 and PRs #3–#6 landed after it; the Blocked section described ONB-01 as "rotation still open" (it is partially rotated + ADR-7-accepted) and DOC-01's scan blindness as current (CI history scanning shipped in PRs #3/#4).
**Recommendation:** rewrite to current facts. **Done.**

### SA-05 — ISSUE (fixed)
**File:** `reviews/2026-07-16-onboarding-docs.md`, `reviews/INDEX.md`
**Problem:** Doc drift — DOC-01 (BLOCKER: local secret scan blind to history) was still marked "awaits owner decision", but its recommendation was implemented and owner-merged in PRs #3/#4: PR-range scan gates merges, full-history scan reports in CI, `secret-scan:history` exists locally, and suppression is by narrow fingerprint rather than path allowlist.
**Recommendation:** update the review Status line and INDEX row to record the resolution. **Done.**

### SA-06 — SUGGESTION (fixed)
**File:** `plans/INDEX.md`
**Problem:** `plans/` existed but had no `INDEX.md`; the file map and plan lifecycle require it (it is the single home of plan status).
**Recommendation:** create it with the standard empty table. **Done.**

### SA-07 — SUGGESTION (fixed)
**File:** `.gitignore`
**Problem:** `!.env.example    # comment` — gitignore has no trailing comments, so the `#` text was part of the pattern and the negation matched nothing (harmless only because `.env.example` is already tracked).
**Recommendation:** move the comment to its own line. **Done** (verified: `.env.example` no longer matches an ignore pattern).

### SA-08 — ISSUE (owner action)
**File:** — (local machine)
**Problem:** The `gh` CLI token in the keyring is invalid — `gh auth status` fails and `gh api` returns errors (this session had to verify branch protection by push-probe instead of reading the ruleset, and could not confirm the auto-delete-branches setting). Oddly, `gh pr create` still worked (PR #7), so some credential path functions; API queries do not. Git push auth (keychain) is fine.
**Recommendation:** run `gh auth refresh -h github.com` in a terminal.

### SA-09 — SUGGESTION (fixed; one-minute owner confirmation left)
**File:** — (GitHub settings / stale branches)
**Problem:** Six stale merged branches locally and two on origin. The PR #3–#6 head branches were already auto-deleted on GitHub (only stale local tracking refs remained), so "Automatically delete head branches" appears to be ON — the two origin leftovers were from PRs #1/#2, merged before the setting was flipped. Every branch was verified fully contained in main (`git cherry` / tree-diff against the squash commits) before deletion; all are restorable from their PR pages.
**Recommendation:** local branches deleted, tracking refs pruned, the two origin leftovers deleted. **Done.** Owner: glance at Settings → General → Pull Requests once to confirm auto-delete is indeed enabled (unverifiable from here while `gh` auth is broken — SA-08).

### SA-10 — SUGGESTION (owner action)
**File:** — (Claude plugin config)
**Problem:** SETUP.md §6 plugin hygiene not done: bigdata-com, daloopa, and sp-global finance plugins are still installed, contributing 50+ skills of context noise to product-work sessions.
**Recommendation:** uninstall them from the profile used for product work (app settings; not scriptable from a session).

## Proposed DECISIONS.md entries
None — no new decisions were made; everything here enforces decisions already recorded (ADR-7, the CI split in PRs #3/#4).
