# Plan: TD-02 — separate the dev database from production
Date: 2026-07-23

> **Deferred to launch by owner decision, 2026-07-23 — not abandoned.** This plan is complete, reviewed by the owner, and approved in substance; only its timing was deferred. Resume it as-written at launch preparation, before any production deploy. See TD-02 in `TECH_DEBT.md` for the reasoning and trigger, and the 2026-07-23 review note on ADR-6 in `DECISIONS.md`.
>
> Two points to re-verify on resumption, since both were true on 2026-07-23 and may not be at launch: (1) the production project ref asserted throughout is `tatrnjylbupusigiyuyf` — confirm against `.env` before committing it as `PRODUCTION_DB_REF`; (2) the plan assumes no deployed environment exists, which shapes the "existing DB becomes production" decision — if Meridian is deployed by then, revisit the Approach section rather than executing Tasks 1/5/9 as written.
>
> The guard (Tasks 2–4) was deliberately **not** taken early. With a single database the only ref present is the production ref, so the guard would block every `npm run dev` and need a standing opt-out flag — which hollows it out into a tripwire the owner steps over daily. Its value arrives with the second database.

## Problem

Dev and production point at **the same Supabase database** (ADR-6, TD-02 severity High). This is verified, not assumed: `.env` and `.env.local` both carry connection strings for Supabase project ref `tatrnjylbupusigiyuyf` at `aws-0-eu-west-3.pooler.supabase.com` — same project, same database, differing only in pooler port (6543 transaction-mode for the app, 5432 session-mode for `prisma migrate`).

Consequences visible in the repo today:

1. **Every dev-side mutation hits real portfolio data.** Manual testing (buy/sell/delete a position), `npm run db:push`, `prisma migrate dev`, `prisma studio`, and one-off scripts like `scripts/fix-position-currencies.ts` (which does a live `findMany` + writes across all positions) all resolve `DATABASE_URL` to the real database with no isolation and no undo.
2. **A migration sign-off protocol exists purely as compensation.** ADR-14 and ADR-19 require the owner to personally run `prisma migrate deploy` because there is no environment in which a migration can be applied and observed before it touches real rows. `prisma/migrations/20260719231015_analyst_revisions_low_high` (a single additive `ALTER TABLE "AnalystRating" ADD COLUMN ...`) has been sitting created-but-unapplied since 2026-07-20 under exactly this gate.
3. **Real work is blocked.** TD-31 (rename the Prisma `Wishlist`/`WishlistItem` models to `Watchlist`, closing the ADR-9 copy-vs-code split) is explicitly deferred because a model rename generates destructive SQL and there is nowhere safe to rehearse it.
4. **There is no mechanical guard against the mistake.** Nothing in the codebase inspects which database a connection string points at. Once a second database exists, the failure mode inverts from "dev always hits prod" to "dev *usually* hits dev, until someone copies the wrong string into `.env.local`" — a quieter, more dangerous failure than today's known-bad state.

Note on what "production" means here: there is **no deployed environment**. No `.vercel` directory, no deploy platform configuration, no hosting reference in any doc (`future_ideas.md:43` states TD-01 and TD-02 block a production deploy). "Production" today is the owner's own local app run against the database holding his real portfolio. That does not reduce the severity — the data is real and irreplaceable — but it does shape the design: this plan makes the *dev* environment isolated, and leaves the current database as the untouched production database. Nothing about a future hosted deployment is decided here.

## Approach

**Core decision: the existing database stays production; a brand-new empty Supabase project becomes dev.**

The alternative — provision a new database, migrate real data into it, and repoint the "real" app at the new one — moves live data across a network boundary for no benefit. The current database already holds the real data, already has all migrations applied, and already works. Making it production is a rename, not a migration. The new project starts empty and is populated by `prisma migrate deploy` plus a locally-registered throwaway account. **No production data is ever copied into dev** — the dev database contains only synthetic data the owner creates through the app's own UI.

**Second decision: guard the split in code, not in discipline.**

Provisioning a second database converts a loud, always-true problem ("dev is prod") into a silent, occasionally-true one ("dev is prod again, because a string got pasted into the wrong file"). A split with no mechanical guard is worth noticeably less than a split with one. So the agent-implementable half of this work is a small, tested guard module plus a `verify`-adjacent check:

- A pure function that extracts the Supabase project ref from a Postgres connection string (the `postgres.<ref>` username segment Supabase uses, with a hostname fallback).
- A committed, non-secret constant naming the **production** project ref, and a check that fails loudly when a non-production `NODE_ENV` resolves to it.
- A `predev` npm hook so `npm run dev` refuses to start against production, and the same check exposed as `npm run db:check` for use before any migration or script.

A project ref is not a secret — it is the public subdomain of every Supabase project URL and grants nothing on its own. Committing it is what makes the guard work without reading `.env`. This is stated explicitly because a reviewer will otherwise, correctly, ask.

**Third decision: the guard fails closed on ambiguity, but only where the stakes justify it.**

If `DATABASE_URL` is unparseable or absent, the check reports an error rather than silently passing. But it does **not** block on "unknown ref" — a dev ref it has never seen is the expected, correct case. It blocks on exactly one condition: *the resolved ref equals the known production ref while `NODE_ENV !== "production"`*. A guard that cries wolf gets `--force`d into irrelevance within a week.

**Fourth decision: keep the ADR-14/ADR-19 sign-off protocol, but retarget it.**

Once dev is isolated, the protocol changes shape rather than disappearing:

- **Dev database:** the agent may run `prisma migrate dev` freely. No sign-off. This is the whole point — schema changes can now be authored and observed against a real Postgres instance without owner involvement.
- **Production database:** `prisma migrate deploy` remains **owner-only, every time, without exception.** The agent never holds or uses production credentials.

That is a genuine loosening on one side and an unchanged constraint on the other, so it needs a new ADR superseding ADR-6 and amending the ADR-14/ADR-19 protocol — not a silent reinterpretation of the existing ones.

**Fifth decision: sequence the held migration deliberately.**

`20260719231015_analyst_revisions_low_high` is currently unapplied on the shared database. Once dev exists, `prisma migrate deploy` against dev applies **all** migrations including that one — which is exactly the rehearsal ADR-19 wanted and never had. So the sequencing is: create dev → apply the full migration history to dev → confirm the held migration applies cleanly and the app works against it → *then* the owner has evidence in hand for the production `migrate deploy` sign-off. This plan does not apply it to production; it makes that decision better-informed. If the owner prefers, applying it to production can remain a separate follow-up entirely.

**What this plan explicitly does not do:**
- Does not perform the TD-31 Watchlist rename (this plan unblocks it; the rename is separately scoped).
- Does not apply the held migration to production (Task 9 only surfaces the evidence).
- Does not copy, export, or back up production data into dev.
- Does not set up a hosted deployment, a third staging environment, or CI database access.
- Does not close TD-01 (the live NewsAPI key), which is an independent production blocker.

## Tasks

Tasks are marked **[OWNER]** (requires Supabase console access and credentials — an agent cannot do these) or **[AGENT]** (implementable and verifiable in a Coding agent session). The agent-implementable tasks (2, 3, 4, 6, 7, 8) are written so they can be completed and verified **before** the owner provisions anything — the guard is inert-but-correct against a single database and becomes active the moment a second one exists. This means the Coding agent is never blocked waiting on the owner.

1. [ ] **[OWNER]** Create a new Supabase project (suggested name `meridian-dev`, same region `eu-west-3` to keep latency comparable). Record both connection strings: the transaction-mode pooler URI (port 6543, with `?pgbouncer=true`) and the session-mode pooler URI (port 5432). Do **not** paste them into any file the agent reads or into any chat/PR — they go directly into `.env.local` in step 5. — Acceptance: a second project ref exists in the Supabase console, distinct from `tatrnjylbupusigiyuyf`, and its database is empty (no tables).

2. [ ] **[AGENT]** Create `lib/utils/db-environment.ts` with two pure, exported functions and one exported constant:
   - `PRODUCTION_DB_REF = "tatrnjylbupusigiyuyf"` — the production Supabase project ref, with a comment explaining that a project ref is a public identifier (it is the subdomain of the project's public URL), is not a credential, and is committed deliberately so the guard works without reading secrets.
   - `parseSupabaseRef(connectionString: string | undefined): string | null` — extracts the project ref. Primary source is the username segment, which Supabase pooler URIs format as `postgres.<ref>`; fall back to the first hostname label when the host is a direct `<ref>.supabase.co` form. Returns `null` for undefined, empty, unparseable, or non-Supabase strings. Must not throw on any input.
   - `assertNotProduction(connectionString: string | undefined, nodeEnv: string | undefined): { ok: true } | { ok: false; reason: string }` — returns `ok: false` only when `nodeEnv !== "production"` **and** `parseSupabaseRef(...) === PRODUCTION_DB_REF`. Returns `ok: true` for an unknown ref, a null ref, and for any `nodeEnv === "production"`. Never reads `process.env` itself — both inputs are parameters, so the function is trivially testable.
   — Acceptance: `lib/utils/db-environment.test.ts` passes with cases covering: a production-ref transaction-pooler URI under `development` → blocked; the same URI under `production` → allowed; a different (dev) ref under `development` → allowed; `undefined`/`""`/`"not-a-url"` → `parseSupabaseRef` returns `null` and `assertNotProduction` returns `ok: true` with no throw; a direct `<ref>.supabase.co` host form parses correctly.

3. [ ] **[AGENT]** Create `scripts/check-db-env.ts` — a thin CLI wrapper that reads `process.env.DATABASE_URL` and `process.env.NODE_ENV`, calls `assertNotProduction`, and on `ok: false` prints a clear multi-line message (which ref was found, that it is the production ref, and that `.env.local` should point at the dev project) then exits with code 1. On `ok: true` it prints a one-line confirmation naming the ref (a ref is not a secret, so printing it is safe and is the whole diagnostic value) and exits 0. Must load `.env.local` then `.env` with the same precedence Next.js uses, so the check sees exactly what the app will see. — Acceptance: with the current production `DATABASE_URL` and `NODE_ENV` unset, `npx tsx scripts/check-db-env.ts` (or the equivalent runner already available in this repo — do not add a new dependency if `tsx`/`ts-node` is absent; a plain `node` script reading env directly is acceptable) exits 1 with the explanatory message. Temporarily setting `DATABASE_URL` to a fabricated non-production ref makes it exit 0.

4. [ ] **[AGENT]** Wire the check into `package.json`: add `"db:check": "<runner> scripts/check-db-env.ts"` and `"predev": "npm run db:check"`. Do **not** add it to `verify` or `verify:code` — CI has no `DATABASE_URL` and the check would either fail spuriously or have to be weakened into uselessness; the guard's job is protecting a developer's local runtime, not the CI gate. — Acceptance: `npm run dev` against the production `DATABASE_URL` aborts before Next.js starts, printing the Task 3 message. `npm run verify` and `npm run verify:code` are unaffected and still pass.

5. [ ] **[OWNER]** Point local development at the new dev database: replace `DATABASE_URL` and `DIRECT_URL` in **`.env.local`** with the Task 1 dev project's strings. Leave **`.env` unchanged** — it keeps the production strings and remains the production reference. (Next.js gives `.env.local` precedence over `.env`, so this one edit repoints the entire local app; this precedence is already established in this repo — see TD-29, where a stale `.env.local` silently overrode a rotated `.env`.) — Acceptance: `npm run db:check` exits 0 and names the dev ref, not `tatrnjylbupusigiyuyf`.

6. [ ] **[AGENT]** Update `.env.example` to document the split. Add a comment block above the two database variables stating that `DATABASE_URL`/`DIRECT_URL` in `.env.local` must point at the **dev** Supabase project, that `.env` holds production, that `npm run db:check` enforces this, and that both pooler modes (6543 transaction / 5432 session) are still required per environment. Keep the existing placeholder values — no real strings, no real refs beyond the one already committed in Task 2's constant. — Acceptance: `.env.example` reads correctly for a fresh clone; `npm run secret-scan` still passes.

7. [ ] **[AGENT]** Update `ARCHITECTURE.md`'s "Environment separation" section to describe the split as implemented: two Supabase projects (production = the original; dev = new and empty), which file holds which, the guard module and `predev` hook as the enforcement mechanism, and the retargeted migration protocol (agent may `prisma migrate dev` against dev; `prisma migrate deploy` against production stays owner-only). Remove the current text asserting a single shared instance. — Acceptance: no sentence in `ARCHITECTURE.md` claims dev and prod share a database; the section names the guard module path.

8. [ ] **[AGENT]** Update `AGENT.md`:
   - Replace the Hard-limits line "Dev and production share one database (ADR-6) — be extra cautious…" with the new reality: dev is isolated; `npm run db:check` must pass before any migration or data-touching script; `prisma migrate deploy` against production is owner-only.
   - Add a Known-fragile-surfaces entry for `lib/utils/db-environment.ts` covering: the committed `PRODUCTION_DB_REF` is deliberate and not a leaked secret; if the production project is ever migrated or recreated the constant must be updated in the same change or the guard silently stops guarding; and the guard deliberately allows unknown refs, so it protects against "pointed back at prod" and not against "pointed at some third database."
   - Add a note that `scripts/fix-position-currencies.ts` and any future data-touching script must be preceded by `npm run db:check`.
   — Acceptance: `AGENT.md` contains no remaining claim that dev and prod share a database; the fragile-surface entry names the constant and its update obligation.

9. [ ] **[OWNER]** Apply the full migration history to the new dev database: `npx prisma migrate deploy` with `.env.local` pointing at dev. This applies all 13 migrations including the held `20260719231015_analyst_revisions_low_high`, giving it its first real application anywhere. Then register a throwaway account through the app's own UI and add a couple of synthetic positions. — Acceptance: `npx prisma migrate status` reports "Database schema is up to date!" against the dev database with no pending migrations; the app runs against dev, a new account registers successfully, and a position can be added, bought-more, and sold. Record whether the held migration applied cleanly — this is the rehearsal evidence ADR-19 wanted; the production `migrate deploy` decision remains a separate owner call, not part of this plan.

10. [ ] **[AGENT]** Update `TECH_DEBT.md`: move TD-02 to the Resolved table with today's date and this plan as the resolver. Update TD-31's entry to remove the "once a safe, isolated dev database exists (see TD-02)" blocker — the rename is now schedulable (still not done here). — Acceptance: TD-02 no longer appears in Backlog; TD-31's text no longer names TD-02 as a precondition.

11. [ ] **[AGENT]** Add ADR-27 to `DECISIONS.md` (drafted below) and mark ADR-6 as **superseded by ADR-27**, leaving ADR-6's text intact for history. Also append a line to ADR-14 and ADR-19 noting that their owner-sign-off requirement is retained for production `migrate deploy` and lifted for the dev database, per ADR-27. — Acceptance: ADR-6's Status line reads `superseded by ADR-27`; ADR-27 exists with evidence citing the files created in Tasks 2–4.

## Files to create or modify

**Create:**
- `lib/utils/db-environment.ts` — `PRODUCTION_DB_REF`, `parseSupabaseRef`, `assertNotProduction`
- `lib/utils/db-environment.test.ts` — unit tests for both functions
- `scripts/check-db-env.ts` — CLI guard invoked by `db:check` / `predev`

**Modify:**
- `package.json` — `db:check` and `predev` scripts
- `.env.example` — document the dev/prod split
- `ARCHITECTURE.md` — rewrite "Environment separation"
- `AGENT.md` — Hard limits, Known fragile surfaces
- `TECH_DEBT.md` — TD-02 → Resolved; TD-31 unblocked
- `DECISIONS.md` — ADR-27 added; ADR-6 superseded; ADR-14/ADR-19 amended

**Owner-only, not in the repo:** the new Supabase project; `.env.local` (gitignored — never committed by anyone).

## Verification

`npm run verify` (AGENT.md `## Verify` block) covers typecheck, lint, the new unit tests, and the secret scan.

Beyond it:

1. **Guard blocks production under dev** — with `.env.local` still holding the production string, `npm run dev` must abort with the Task 3 message. Run this *before* Task 5 to observe a true positive, not just an absence of failure. A guard only ever verified in its passing state has not been verified.
2. **Guard allows dev** — after Task 5, `npm run db:check` exits 0 naming the dev ref, and `npm run dev` starts normally.
3. **CI unaffected** — `npm run verify:code` passes with no `DATABASE_URL` set, confirming the guard was not wired into the CI gate.
4. **Dev database is genuinely isolated** — register an account on dev, then confirm from `prisma studio` against the dev database that it holds only the synthetic account, and that the production database's row counts are unchanged. This is the actual claim being made; the guard is a means to it.
5. **App works end-to-end against dev** — add a position, buy more, sell part, view closed positions. This exercises the migration history's real schema on a fresh database, which nothing has ever done before.
6. **Secret hygiene** — confirm `.env.local` is still gitignored and untracked (`git check-ignore .env.local`), and that no dev connection string appears in any tracked file. Per the AGENT.md fragile surface on rotated keys, be aware that new credentials can match a *different* gitleaks rule than the old ones — if `npm run secret-scan` newly fails after Task 5, the fix is a narrow fingerprint in `.gitleaks-local/.gitleaksignore` for that specific env file, never a path allowlist.

## Assumptions

- **The current database becomes production; the new one becomes dev.** No real data is copied anywhere. If the owner instead wants the fresh project to become production, this plan's direction reverses and Tasks 1/5/9 change substantially.
- **A Supabase project ref is not a secret.** It is the public subdomain of the project URL and confers no access without credentials. Committing `PRODUCTION_DB_REF` is therefore safe and is what lets the guard run without reading `.env`. If the owner disagrees, the fallback is a `PRODUCTION_DB_REF` env var read from `.env` — weaker (a missing var silently disables the guard) but functional.
- **A free-tier Supabase project is acceptable for dev.** Meridian's dev workload is one developer and a handful of synthetic rows. Free-tier projects pause after inactivity and need a console click to resume — an annoyance, not a blocker, and cheaper than a second paid project.
- **`NODE_ENV` is the environment signal.** `npm run dev` sets `NODE_ENV=development`, so the `predev` guard fires in exactly the case that matters. A `NODE_ENV=production` local run (e.g. `npm run build && npm start` against production data) is deliberately *not* blocked — that is a legitimate production-parity check, and blocking it would make the guard wrong rather than safe.
- **Dev gets no production data, ever — including anonymized extracts.** Synthetic data entered through the UI is sufficient for every feature this app has. This keeps the split a security boundary rather than a convenience one.
- **A `.ts` script runner exists or a plain `.js` script is acceptable.** The repo has no `tsx`/`ts-node` dependency today (`scripts/fix-position-currencies.ts` is TypeScript with no visible runner script in `package.json`). The Coding agent should check what actually runs before adding a dependency; a plain `node scripts/check-db-env.js` reading `process.env` directly is a fully acceptable outcome and avoids a new devDependency for a 30-line guard.
- **The held `analyst_revisions_low_high` migration is not applied to production by this plan.** Task 9 applies it to dev only. Whether and when it reaches production stays an owner decision under the ADR-14/ADR-19 protocol.

## Open decisions

None blocking. Task 1 and Task 5 require owner action, but the design questions they would raise are answered in Assumptions and can be confirmed at execution time rather than blocking the Coding agent — Tasks 2, 3, 4, 6, 7, 8 are all implementable and verifiable against the current single-database state.

## Proposed ADR (for Task 11)

```
## ADR-27 — Dev and production run on separate Supabase projects, enforced by a committed production-ref guard
- **Decision:** the original Supabase project (`tatrnjylbupusigiyuyf`) is production and holds the real portfolio data; a second, empty project is provisioned for development. `.env` holds production strings, `.env.local` holds dev strings (Next.js precedence makes `.env.local` win locally). No production data is ever copied into dev — dev is populated by `prisma migrate deploy` plus synthetic data entered through the app's UI. Enforcement is mechanical, not procedural: `lib/utils/db-environment.ts` exports the production project ref as a committed constant plus a pure `assertNotProduction(connectionString, nodeEnv)` check, and `scripts/check-db-env.ts` runs it via a `predev` npm hook, so `npm run dev` aborts if a non-production `NODE_ENV` resolves to the production ref. The migration protocol of ADR-14/ADR-19 is retargeted rather than retired: `prisma migrate dev` against the dev database needs no sign-off; `prisma migrate deploy` against production remains owner-only, every time.
- **Evidence:** `lib/utils/db-environment.ts`, `lib/utils/db-environment.test.ts`, `scripts/check-db-env.ts`, `package.json` (`db:check`, `predev`), `.env.example`, `ARCHITECTURE.md` "Environment separation". `plans/2026-07-23-td-02-dev-prod-db-split.md`.
- **Tradeoffs:** a second Supabase project to maintain (free tier, pauses when idle) and two connection-string pairs to keep straight — which is precisely the new failure mode the guard exists to catch, since a split with no guard converts a loud always-true problem into a silent occasionally-true one. The guard deliberately allows *unknown* refs, so it protects against "pointed back at production" and not against "pointed at some unrelated third database"; a stricter allowlist was rejected because it would block the dev ref on day one and be disabled within a week. The committed `PRODUCTION_DB_REF` is a public identifier, not a credential, but it creates a maintenance obligation: if the production project is ever recreated, the constant must move with it or the guard silently stops guarding (recorded in `AGENT.md` fragile surfaces). Rejected alternatives: (a) provisioning a fresh *production* project and migrating real data into it — network movement of live data for no benefit, since the existing database already has the data and the full migration history applied; (b) discipline-only separation with no code guard — the exact posture that let ADR-6 persist for a week past its own flagging; (c) reading the production ref from an env var instead of committing it — a missing var would silently disable the guard, failing open in the one case that matters.
- **Supersedes:** ADR-6 (dev and production share one database). Amends the sign-off protocol of ADR-14 and ADR-19 — retained for production, lifted for dev.
- **Status:** proposed
- **Confidence:** High on the split itself (the shared-ref fact was verified directly against `.env`/`.env.local`); Medium on the guard's long-run effectiveness, which depends on the `PRODUCTION_DB_REF` constant being maintained if the production project is ever recreated.
```
