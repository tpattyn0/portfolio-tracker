# STATUS.md

## In progress
Orchestration: Analyst revisions empty for NVDA — recently-built revisions plumbing returns nothing for a heavily-covered symbol (likely a real bug in the extractor/filter)
Plan: plans/2026-07-20-analyst-revisions-nvda-fix.md
Since: 2026-07-20
Branch: fix/research-tab-fixes
Next: awaiting owner decision
Review: reviews/2026-07-20-analyst-revisions-nvda-fix.md (0 BLOCKERs/ISSUEs; ARV-S1 optional)

## Blocked
ARV-Q1 — apply pending migration (owner `prisma migrate deploy`); cold fetch fails until applied
ARV-Q2 — live NVDA revisions click-through (cold + cache-hit) after ARV-Q1
TD-01 — NEWS_API_KEY live + public in history; risk accepted per ADR-7, blocks production deploys only
