# future_ideas.md

Aspirational / not-yet-built ideas only. Do not treat anything here as implemented or committed — see `PRODUCT.md` for implemented reality.

- **Hover crosshair + y-axis price labels on the dashboard hero chart** (`components/portfolio-chart.tsx`). The research-detail tabs' `DetailPriceChart` (ADR-11, `plans/2026-07-18-meridian-research-detail.md`) added a hover crosshair+tooltip and a minimal y-axis to the Overview/Technical charts; the owner said adding the same to the dashboard hero is "acceptable but call it out as a scope note" rather than bundling it into that plan, since the hero has its own range-morph animation that hover/crosshair interaction would need to coexist with. The shared primitives (`niceYTicks` in `lib/utils/chart-ticks.ts`, the crosshair pixel-mapping approach in `DetailPriceChart`) already exist and are unit-tested/verified — a future pass can port them into `portfolio-chart.tsx` without rebuilding from scratch.
