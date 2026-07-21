# reviews/INDEX.md

| Review | Date | Status |
|--------|------|--------|
| 2026-07-16-onboarding.md | 2026-07-16 | PARTIALLY IMPLEMENTED (ONB-01 partial — 3 of 4 keys rotated 2026-07-17; NEWS_API_KEY accepted per ADR-7) |
| 2026-07-16-onboarding-docs.md | 2026-07-16 | PARTIALLY IMPLEMENTED (DOC-01 resolved 2026-07-17 via PRs #3/#4; DOC-06 deferred — deployment target unconfirmed) |
| 2026-07-17-setup-audit.md | 2026-07-17 | IMPLEMENTED — 2026-07-17 (PR #7 merged; SA-08 closed post-merge — REST-503 root cause, no action needed; only SA-10 plugin hygiene open) |
| 2026-07-17-full-audit.md | 2026-07-17 | IMPLEMENTED — 2026-07-17 (AUD-01..10 fixed via PR #12) |
| 2026-07-17-full-audit-fixes.md | 2026-07-17 | IMPLEMENTED — 2026-07-17 (AUD-FIX-01..04 fixed and re-verified in v2) |
| 2026-07-17-full-audit-fixes-v2.md | 2026-07-17 | IMPLEMENTED — 2026-07-17 (REV2-01 fixed inline; REV2-02 no-action-needed) |
| 2026-07-17-meridian-design-overhaul.md | 2026-07-17 | IMPLEMENTED |
| 2026-07-18-meridian-research-detail.md | 2026-07-18 | IMPLEMENTED — 2026-07-18 (iter 1: 3 SUGGESTIONs + 1 QUESTION resolved in `1c524c0a`; iter 2: 0 findings) |
| 2026-07-18-meridian-dashboard-detail-fixes.md | 2026-07-18 | IMPLEMENTED — 2026-07-18 (0 BLOCKERs/ISSUEs/QUESTIONs; MDF-S1 logged as TD-33) |
| 2026-07-18-performance-audit-remediation.md | 2026-07-18 | IMPLEMENTED — 2026-07-18 (0 BLOCKERs/ISSUEs; 2 SUGGESTIONs no-action; PAR-Q1 approved + migration applied) |
| 2026-07-18-yahoo-validation-error.md | 2026-07-18 | IMPLEMENTED — 2026-07-18 (0 BLOCKERs/ISSUEs/QUESTIONs; YV-S1 SUGGESTION no-action) |
| 2026-07-19-meridian-nav-responsiveness.md | 2026-07-19 | IMPLEMENTED — 2026-07-19 (0 BLOCKERs/ISSUEs; NAV-Q1 owner-accepted 2026-07-21 (non-blocking layout + skeletons verified, live nav straight to content); NAV-S1 SUGGESTION optional) |
| 2026-07-19-meridian-first-visit-latency.md | 2026-07-19 | IMPLEMENTED — 2026-07-19 (0 BLOCKERs/ISSUEs; FVL-Q1 owner-accepted 2026-07-21 (Turbopack dev confirmed; dev-only, no prod impact); FVL-S1 SUGGESTION optional/no-action) |
| 2026-07-19-positions-tab.md | 2026-07-19 | IMPLEMENTED — 2026-07-19 (0 BLOCKERs; PT-I1 Realized P/L re-surfaced + PT-I2 test/ADR fixed over 3 iters; PT-Q2 owner-accepted 2026-07-21 (Positions-tab restructure verified live); PT-S2 skipped) |
| 2026-07-19-positions-stat-distinction.md | 2026-07-19 | IMPLEMENTED — 2026-07-19 (0 BLOCKERs/ISSUEs/SUGGESTIONs; PSD-Q1 resolved 2026-07-21 — superseded by band-restyle card treatment) |
| 2026-07-19-positions-band-restyle.md | 2026-07-19 | IMPLEMENTED — 2026-07-19 (0 BLOCKERs/ISSUEs/SUGGESTIONs; supersedes stat-distinction bg-fill panel; PBR-Q1 owner-accepted 2026-07-21 — card+header treatment verified live+DOM on NVDA) |
| 2026-07-19-research-tab-fixes.md | 2026-07-20 | IMPLEMENTED — 2026-07-20 (0 BLOCKERs/ISSUEs/SUGGESTIONs; RTF-Q1 owner-accepted 2026-07-21 (verified live on NVDA); RTF-Q2 closed by analyst-revisions persistence; verify green 122/122) |
| 2026-07-20-analyst-revisions-nvda-fix.md | 2026-07-20 | IMPLEMENTED — 2026-07-20 (0 BLOCKERs/ISSUEs; 90-day filter + persist migration; ARV-Q1 migration applied + ARV-Q2 owner-accepted 2026-07-21 (NVDA revisions verified populating live); ARV-S1 optional) |
| 2026-07-20-small-visual-fixes.md | 2026-07-20 | IMPLEMENTED — 2026-07-20 (0 BLOCKERs/ISSUEs; dividers + overview five-query gate + data-derived chart gridlines; SVF-Q1 owner-accepted 2026-07-21 (dividers gone, verified live+DOM); SVF-Q2 resolved 2026-07-21 (owner: leave-as-is, TD-36 stays logged); SVF-S1/S2 optional; 135/135) |
| 2026-07-20-perf-graph-dip-clipping-fix.md | 2026-07-20 | IMPLEMENTED — 2026-07-20 (0 BLOCKERs/ISSUEs; margined drawing domain — bezier-sampling test + domain-registration invariant + labels-on-true-min/max verified; DIP-Q1 owner-accepted 2026-07-21 (dip inside plot, spike visible, true-min/max labels confirmed live); DIP-S1 optional; 141/141) |
| 2026-07-20-gemini-model-update.md | 2026-07-20 | IMPLEMENTED — 2026-07-20 (0 BLOCKERs/ISSUEs/SUGGESTIONs; gemini-1.5-flash→2.5-flash live-verified + centralized constant; GMU-Q1 owner-accepted 2026-07-21 — Morning Note + sentiment verified live; 117/117) |
| 2026-07-20-configurable-scoring-weights.md | 2026-07-20 | IMPLEMENTED — 2026-07-21 (0 BLOCKERs/ISSUEs; per-user weights, single-source module, cache-safe fundamental reweight, IDOR-safe prefs write, backward-compat verified; SCW-Q1 resolved — migration applied 2026-07-21; SCW-Q2 owner-accepted 2026-07-21 (settings validation verified live); SCW-S1 optional; 193/193) |
| 2026-07-21-scoring-weights-direct-percent.md | 2026-07-21 | IMPLEMENTED — 2026-07-21 (0 BLOCKERs; DP-I1 scale-agnostic meta-kicker fix + tests, DP-Q1 migration applied + docs reconciled, DP-S1 trim test — all resolved over 2 iters; scale-invariance + largest-remainder verified; migration applied/live; 230/230) |
| 2026-07-21-scoring-style-presets.md | 2026-07-21 | REVIEWED — CLEAN (iter 2, 2026-07-21): SP-I1 skeleton fix verified (block order + variants + DESIGN.md match), SP-S1 dispositioned to TD-36 (no code change); 0 open findings; core feature byte-identical since iter 1; 240/240; ready for owner merge |
