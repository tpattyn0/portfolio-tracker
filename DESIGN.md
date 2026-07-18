# DESIGN.md

Meridian — a newspaper-editorial visual identity for the portfolio tracker. Centered
masthead, serif figures, ruled stat bands, flat/no-shadow surfaces, a near-monochrome
warm palette with three chromatic accents reserved for gain/loss/mid-score meaning.

Source: `design_handoff_meridian/` (gitignored reference bundle — high-fidelity; colors,
typography, spacing, and interactions below are final). Governing plans:
`plans/2026-07-17-meridian-design-overhaul.md` (ADR-8 token reconciliation, ADR-9
Watchlist naming, ADR-10 custom SVG chart) and
`plans/2026-07-18-meridian-research-detail.md` (ADR-11 extends the custom SVG chart
to the research-detail tabs, retires Recharts there, and adds the 7-tab structure) —
see `DECISIONS.md`.

This is a re-skin. No data model, scoring logic, or UX flow changes — see `## UX flows`.

---

## Design tokens

### Colors

Meridian ships one token set per theme. Per ADR-8, these are implemented by writing
Meridian's actual values directly into the **existing shadcn CSS variable names** in
`app/globals.css` (`:root` / `.dark`), with the `hsl()` wrapper removed from
`tailwind.config.js` so variables hold complete color values (hex or oklch) instead of
bare HSL triples. Do not introduce a second, parallel `--meridian-*` namespace — the
whole point of ADR-8 is that `components/ui/**` inherits these for free through the
aliases it already uses (`bg-card`, `text-muted-foreground`, `border-border`, etc.).

**Mapping table — Meridian token → shadcn variable name → light / dark values**

| Meridian token | shadcn variable | Light value | Dark value | Usage |
|---|---|---|---|---|
| `--bg` | `--background` | `#faf8f4` | `#171411` | page background |
| `--card` | `--card` | `#fffdf9` | `#1e1a15` | card background |
| `--ink` | `--foreground` | `#1f1d1a` | `#f2ede4` | primary text |
| `--sub` | `--muted-foreground`* | `#4d483f` | `#c9c2b4` | secondary text |
| `--mut` | *(new: `--mut`)* | `#8a8478` | `#8d8578` | muted text / labels / kickers |
| `--line` | `--border` / `--input` | `#e5e0d6` | `#2e2921` | primary rules & borders |
| `--line2` | *(new: `--line2`)* | `#eee9df` | `#28231c` | hairline rules (row dividers, cell separators) |
| `--fill` | *(new: `--fill`)* | `#f3f0e9` | `#252019` | hover fills, at 45% alpha via `color-mix` |
| `--up` | *(new: `--up`)* | `oklch(0.55 0.1 155)` | `oklch(0.72 0.11 155)` | gains (green) |
| `--dn` | *(new: `--dn`)* | `oklch(0.55 0.14 25)` | `oklch(0.7 0.15 25)` | losses (red) |
| `--amber` | *(new: `--amber`)* | `oklch(0.62 0.12 80)` | `oklch(0.62 0.12 80)`† | middling scores (4–7 band) |
| `--btnbg` | *(new: `--btnbg`)* | `#1f1d1a` | `#f2ede4` | primary button background |
| `--btnfg` | *(new: `--btnfg`)* | `#faf8f4` | `#171411` | primary button text |

\* `--sub` maps onto shadcn's `--muted-foreground` slot because both mean "secondary
text" — no shadcn component needs a distinct third gray, so this is a direct
substitution, not a new token.
† The handoff does not list a separate dark-mode `--amber` — carry the light value
through unchanged (it is an oklch accent already legible on both dark surfaces the
handoff defines).

**Also mapped onto existing shadcn slots** (values follow `--card`/`--bg`/`--ink`
directly — these are not independent Meridian tokens, they are shadcn slots that need a
value so `components/ui/**` keeps working):

| shadcn variable | Value (light) | Value (dark) | Rationale |
|---|---|---|---|
| `--popover` | `#fffdf9` (= `--card`) | `#1e1a15` (= `--card`) | popovers/dropdowns read as cards |
| `--popover-foreground` | `#1f1d1a` (= `--ink`) | `#f2ede4` (= `--ink`) | — |
| `--card-foreground` | `#1f1d1a` (= `--ink`) | `#f2ede4` (= `--ink`) | — |
| `--primary` | `#1f1d1a` (= `--btnbg`) | `#f2ede4` (= `--btnbg`) | primary buttons/accents use ink, not blue |
| `--primary-foreground` | `#faf8f4` (= `--btnfg`) | `#171411` (= `--btnfg`) | — |
| `--secondary` | `#f3f0e9` (= `--fill`) | `#252019` (= `--fill`) | secondary surfaces |
| `--secondary-foreground` | `#1f1d1a` (= `--ink`) | `#f2ede4` (= `--ink`) | — |
| `--muted` | `#f3f0e9` (= `--fill`) | `#252019` (= `--fill`) | muted surfaces |
| `--accent` | `#f3f0e9` (= `--fill`) | `#252019` (= `--fill`) | hover/highlight surfaces |
| `--accent-foreground` | `#1f1d1a` (= `--ink`) | `#f2ede4` (= `--ink`) | — |
| `--destructive` | `oklch(0.55 0.14 25)` (= `--dn`) | `oklch(0.7 0.15 25)` (= `--dn`) | destructive actions use `--dn` |
| `--destructive-foreground` | `#faf8f4` | `#171411` | — |
| `--ring` | `#1f1d1a` (= `--ink`) | `#f2ede4` (= `--ink`) | focus rings |

**Do not hardcode** any of the above as one-off hex/oklch values inside a component —
always reference the Tailwind alias (`bg-card`, `text-muted-foreground`, `border-border`,
or the new utilities the Coding agent exposes for `--mut`/`--line2`/`--fill`/`--up`/
`--dn`/`--amber`/`--btnbg`/`--btnfg` — e.g. `text-[color:var(--mut)]` or an added
Tailwind color alias, whichever `tailwind.config.js` ends up wiring per Task 1). If a
screen spec below needs a color not in this table, it is a spec error — flag it, do not
invent one.

**Chromatic accent rule:** `--up` / `--dn` / `--amber` are the *only* saturated colors
in the entire system. Everything else is warm neutral. Never introduce a fourth accent
hue (no blue, no purple) — that is the stock-shadcn look this overhaul replaces.

### Typography

Two font families, both via `next/font/google` (self-hosted, no runtime Google Fonts
request — see ADR-8's sibling decision in the plan's Fonts section):

- **Sans — Libre Franklin** (weights 400/500/600): UI text, labels, buttons, table body,
  nav, kickers.
- **Serif — Newsreader** (weights 400/500/600, italics, optical sizing `opsz`): masthead
  wordmark, all H1s, all large figures (portfolio value, stat-band values, score
  figures), company names in table rows, editorial italic sublines/captions.

Exposed as `--font-sans` / `--font-serif` CSS variables, wired into
`tailwind.config.js` `fontFamily.sans` / `fontFamily.serif`.

**Type scale** (exact values from the handoff — do not approximate):

| Role | Font | Size | Weight | Letter-spacing / style | Where used |
|---|---|---|---|---|---|
| Kicker / label | Sans | 10.5–11px | 400 | uppercase, 0.12–0.14em, color `--mut` | section eyebrows, stat-band labels, table headers |
| Nav item | Sans | 11.5px | 400 (600 active) | uppercase, 0.16em | masthead nav row |
| Body / table text | Sans | 13.5px | 400 | normal | table cells, general body copy |
| Secondary / detail text | Sans | 12–12.5px | 400 | normal | detail lines under stat values, table secondary cells |
| Masthead wordmark | Serif | 30px | 500 | 0.01em | header "Meridian" |
| Screen H1 | Serif | 52px (44px on Add position) | 500 | line-height 1.05 | page titles (Closed positions, Watchlist, Research index, Research detail, Add position) |
| Dashboard portfolio value | Serif | 54px | 500 | line-height 1.05 | dashboard hero figure |
| Stat-band value | Serif | 26px | 500 | — | ruled 3-col stat bands (dashboard, watchlist) |
| Summary-card value | Serif | 28px | 400/500 | — | closed-positions 6-col summary, research-detail 4-col stat card |
| Table score figure | Serif | 19px | 500 | colored by band | watchlist Score column |
| Composite score figure | Serif | 84px | 500 | line-height 1 | research-detail score breakdown |
| Composite sub-score | Serif | 28px | 400 | — | research-detail 5-dimension grid |
| Login "Meridian" | Serif | 38px | 500 | — | login masthead block |
| Login card heading | Serif | 26px | 500 | centered | "Welcome back" |
| Editorial paragraph | Serif | 19px | 400 | line-height 1.6 | Morning Note drop-cap paragraph |
| Editorial quote | Serif | 17px | 400 italic | line-height 1.55 | Morning Note pull-quote |
| Insight/recommendation line | Serif | 15.5px | 400 | line-height 1.5 | risks/opportunities/recommendations cells, key-insights list |
| Italic helper/caption | Serif | 11–14.5px | 400 italic | — | "as of 17:30 CET", form helper text, login subline |
| Research index H1 subline | Serif | 16px | 400 italic | color `--mut` | "Fundamentals, technicals & intrinsic value…" |
| Search input (research index) | Serif | 20px | 400 | centered text | large pill search |
| Order-total row | Serif | 22px | 400 | — | Add-position total cost |

Body text color defaults to `--ink`; secondary/tabular numeric cells often use `--sub`.
Kickers and muted labels always use `--mut`.

### Spacing / shape

- **Page container:** max-width 1400px, padding `56px 32px 96px` (all authed screens
  except Add position and Login).
  - Add position: max-width 680px, padding `56px 24px 104px`.
  - Login: centered column, max-width 420px, no shared container padding (full-viewport
    centering).
  - Research index hero block: centered, max-width 720px, top padding 76px.
- **Cards:** `--card` background, 1px `--line` border, radius 8px, padding 24–28px
  (32px on the Add-position form card). No shadows anywhere — flat, ruled aesthetic is
  the whole point; do not add `box-shadow` to any surface.
- **Buttons — pill shape** (radius = half of height):
  - Primary: `--btnbg` background / `--btnfg` text, no border. Heights 38–44px
    depending on context (40px dashboard "+ Add position", 38px secondary actions like
    "Export CSV" / "Watchlist", 44px form-submit pills).
  - Secondary: transparent background, `--ink` text, 1px `--line` border. Same height
    range as its paired primary button.
  - Segmented control (currency EUR/USD): outer pill, 1px `--line` border, radius 20px,
    height 40px, 3px inner padding, background `--card`; active segment is an inner
    pill (radius 16px, height 32px) filled `--btnbg`/`--btnfg`; inactive segment is
    transparent with `--mut` text, hover shifts to `--ink`.
- **Inputs:** 40px height (34px for the header search pill, 36px for the closed-
  positions filter), radius 6px (17–18px for pill-shaped search inputs), `--bg`
  background (cards' inputs sit on `--bg`, not `--card`, to read as a cutout), 1px
  `--line` border, no focus ring glow — outline none, rely on border.
- **Double rules** (`border: 3px double var(--ink)`) mark editorial emphasis — used
  sparingly, only at:
  - Login masthead block bottom border.
  - Morning Note card top border.
  - Research-detail score-breakdown card top border.
  - Add-position order-summary total row top border.
  - Research-detail composite-score "verdict stamp" border (see Components).
- **Ruled stat bands:** full-width row, `border-top` + `border-bottom` 1px `--line`,
  divided into equal columns (3 on Dashboard/Watchlist, 6 on Closed positions, 4 on
  Research detail, 5 on the score-breakdown dimension grid) by 1px `--line2` vertical
  rules between cells. Each cell = kicker label (10.5px uppercase `--mut`) / large serif
  value (26–28px) / 12px detail line. First cell has no left padding, last cell has no
  right padding, so the band aligns flush with the container edges.
- **Hairline row dividers:** 1px `--line2` between table rows and between insight
  sub-items; the last row in a table/list has no bottom rule.
- **Row hover:** `background: color-mix(in srgb, var(--fill) 45%, transparent)` on
  every clickable table row / list row. No border or inset change on hover — background
  only.
- **Theme transition:** `body { transition: background-color .25s, color .25s }` — the
  only animated property besides the chart morph.

---

## Components

Name, variants, states, and usage rules for every reusable Meridian pattern. Build
these once and reuse — do not restyle the same pattern differently on two screens.

### Masthead (shared header)
Sticky, `--bg` background, 1px `--line` bottom border. Two rows inside a 1400px
container:
1. **Top row** — 3-column grid (`1fr auto 1fr`), vertically centered, `14px 0` padding,
   1px `--line` bottom border under this row only:
   - Left: dateline kicker, 10.5px uppercase `--mut`, format `"Vol. {roman} — № {n} ·
     {long date}"`. Fully computed, never hardcoded — see the dateline formula below.
   - Center: "Meridian" wordmark, Newsreader 30px/500, clickable → Dashboard.
   - Right, `12px` gap: search input (pill, 200px, 34px height, magnifier icon at
     `left:13px`), theme toggle (34px circle, 1px `--line` border, ◐ glyph, 15px,
     `--sub`), account control (34px circle, 1px `--line` border, user-outline icon,
     `--sub`) — a Radix `DropdownMenu` trigger (kept from the current app; the
     prototype's plain click-to-login is prototype shorthand for sign-out, not a spec
     to remove the menu).
2. **Nav row** — centered flex, `52px` gap, `14px 0 0` padding: PORTFOLIO · CLOSED ·
   WATCHLIST · RESEARCH. 11.5px uppercase, 0.16em letter-spacing. Active item: weight
   600, color `--ink`, 2px `--ink` bottom border (`padding-bottom:13px` to clear it).
   Inactive: weight 400, color `--mut`, 2px transparent border (reserve the space so
   nothing shifts on activation).

**Dateline formula** (owner-specified, computed — never hardcoded):
- **Volume** = 2-digit year in Roman numerals (2026 → `26` → `XXVI`).
- **Issue №** = day-of-year via `date-fns` `getDayOfYear`.
- **Date** = existing long-form date string, e.g. `Friday, 17 July 2026`.
- Example: 17 July 2026 renders `Vol. XXVI — № 198 · Friday, 17 July 2026`.
- The prototype's own `Vol. III — № 128` is placeholder sample data and does not match
  this formula — the formula supersedes it. Roman-numeral conversion lives in
  `lib/utils/dateline.ts` as a tested pure function (Planner-specified, not a Designer
  decision).

### Ruled stat band
Full-bleed-within-container row: `border-top` + `border-bottom` 1px `--line`, N equal
columns via CSS grid, `1px --line2` left border on every column after the first (acts
as a vertical rule). Cell content, top to bottom: kicker (10.5px uppercase `--mut`),
serif value (26px/500, colored `--up`/`--dn` when the metric is signed), 12px detail
line (colored to match the value when signed, else `--mut`). Used on: Dashboard (Total
return / Best performer / Largest holding), Watchlist (Targets reached / Watched /
Average score). The Closed-positions 6-col summary and Research-detail 4-col stat card
are the same pattern at a different column count, card-wrapped instead of bare-ruled
(1px `--line` border all around + radius 8px, `--line2` internal verticals) — treat as
a variant, not a new component.

### Position/Watchlist table row — two-line position cell
Every positions/closed-positions/watchlist/research-index table row that names a
security uses the same cell: company name (Newsreader 16px/500, `--ink`) on the first
line, `TICKER · EXCHANGE` (10.5px uppercase, 0.12em, `--mut`, `margin-top:2px`) on the
second. Table shell: `border-collapse:collapse`, header row 1px `--line` bottom border,
header cells 10.5px uppercase `--mut` (600/`--ink` only for an emphasized sortable
column, e.g. Watchlist's Score), body rows 1px `--line2` bottom border (omit on the
last row), `15px 0` cell padding, row hover per the Row hover rule above, `cursor:
pointer`, whole row clickable through to research detail. Numeric cells right-aligned;
signed cells (P/L, Return, Change) colored `--up`/`--dn`; Market value / Realized P/L
bold (weight 500).

### Score figure
Newsreader serif numeral, colored by band against the *presentational* thresholds
(scoring math is unchanged — this recolors an already-computed number):
- **≥ 7** → `--up`
- **4–7** → `--amber`
- **< 4** → `--dn`
- **null/unavailable** → `--mut`

Two sizes: 19px/500 inline in the Watchlist table Score column; 84px/500 (line-height
1) as the research-detail composite headline, with a smaller `/10` suffix at 30px
`--mut`. Sub-dimension scores in the 5-col breakdown grid use 28px, same band coloring.

### Grading dot
A `●` glyph, `margin-left:8px`, set inline immediately after a metric's value —
never on its own line. Colored by the metric's grade against the same band logic as
Score figure, applied to a per-metric status rather than a 0–10 number:
- **Strong** → `--up`
- **In line** → `--amber`
- **Weak** → `--dn`
- **Unavailable** (metric not computable) → `--mut`

Used on every metric row inside the Fundamental tab's sub-views (Score-breakdown
grid, and the six pill sub-nav sections' `GradedMetricRow`s). Always paired with a
legend row where it first appears on a screen, sans 10.5px uppercase `--mut` label,
12.5px `--sub` body, exact wording: **"● Strong vs peers · ● In line · ● Weak vs
peers"** (three `<span>`s, `gap:24px`, each a colored `●` followed by its label).
Grading today is threshold-based (see `metricGrade()` in `lib/utils/score-band.ts`
per the governing plan), not a literal peer comparison — the legend wording is kept
as-is per the plan's Assumptions; do not silently reword it without a Designer note.

### Headline score card
The single editorial headline pattern reused, unchanged in structure, across
Overview, Technical, Fundamental, Analysts, Intrinsic value, and News & sentiment —
**one component, not six**. Card chrome: `--card` background, 1px `--line` border,
radius 8px, `border-top: 3px double var(--ink)`, padding `24px 28px 28px`.

Header row inside the card (`padding-bottom:16px`, `1px --line2` bottom border):
left = section kicker (11px/600, uppercase, 0.14em, `--ink`); right = a muted meta
kicker (10.5px uppercase, 0.1em, `--mut`) — e.g. "Meridian rating · updated daily",
"Daily bars · updated at close", "Trailing twelve months · FY ends Sep", "34
analysts · last 90 days", "Discounted cash flow · 10-year model", "1,240 articles
analysed · last 30 days".

Body: `grid-template-columns: 280px 1fr`, `gap:56px`, `padding-top:28px`.
- **Left column** — always in this order:
  1. `ScoreFigure` at 84px with the `/10` suffix at 30px `--mut`, banded per Score
     figure's thresholds.
  2. Either a rotated `VerdictStamp` (Overview, Analysts — anywhere the design shows
     a "Buy"-style call) **or** a verdict kicker line (10.5px uppercase, 0.12em,
     `--mut` by default or the band color + weight 600 when the kicker itself carries
     the verdict, e.g. "Positive momentum" in `--up`, `margin-top:20px`) — never both.
  3. An optional italic serif summary paragraph, 14.5px/1.55, color `--mut`,
     `margin:10px 0 0` (Technical, Fundamental, Intrinsic, News use this; Overview and
     Analysts instead show a plain kicker line under the stamp, e.g. "Momentum +
     quality", "Street consensus").
  4. Intrinsic value's left column additionally inserts a fair-value figure (34px
     serif, `margin-top:4px`) and a colored "Trading X% above/below fair value" line
     (13px/500) between steps 2 and 3 — a documented variant, not a new component.
- **Right column** — a flexible `children` slot: the 5-dimension `SubscoreBand`
  (Overview), the `DetailPriceChart` (Technical), the Fundamental 5-col
  `SubscoreBand`, the Analysts ratings-distribution rows + 3-col price-target band,
  the Intrinsic 3-col scenario band + Model-assumptions rows, or the News 3-col tone
  band. Each slot's internals are documented in their own tab entry under
  `## UX flows → Research detail`; the card itself never changes shape to fit them.

### Subscore band
N-column ruled band of `ScoreFigure`s at 28px (not 84px), banded per the same
thresholds, `1px --line2` vertical rules between columns (first column no left
padding, last column no right padding — same flush-edge rule as the dashboard/
watchlist Ruled stat band). Kicker label per column: 10.5px uppercase `--mut`,
`margin-top:6px` above the figure. Used at:
- **5-col** — Overview's Technical/Fundamental/Analysts/Intrinsic/Sentiment
  dimension grid, and Fundamental's Valuation/Profitability/Growth/Health/Dividend
  headline band. Both live inside a Headline score card's right-hand slot.
This is the same component as the Ruled stat band's card-wrapped variant, sized down
(28px vs 26px value, `ScoreFigure` band coloring instead of `--up`/`--dn` signed
coloring) — treat as a sibling pattern, not a fork: both are "N equal columns,
`--line2` verticals, kicker-over-value-over-detail cells."

### Detail price chart (`DetailPriceChart`)
The research-detail Overview/Technical chart — same drawing primitives as the
Dashboard SVG performance chart (`buildPath`/`buildAreaPath`, ink line, `--ink`
0.05 area fill, `--line` baseline) but a **distinct component**: no range-morph
animation, and it adds hover/y-axis behavior the hero chart intentionally does not
have (see the hero chart's own entry below).

- **ViewBox** — `0 0 1300 190` on Overview (1-year, no range tabs, static); `0 0
  1000 190` on Technical (6-month). Both `preserveAspectRatio="none"`, `height:190px`
  container (Overview) / `170px` (Technical per the handoff's outer wrapper), 3
  hairline `--line2` gridlines at fixed y-fractions (y=47/94/141 of 190), ink line
  1.5px stroke, `--ink` 0.05 fill-opacity area (no stroke), `--line` baseline rule.
- **Y-axis price labels** — a few (3–4) `--mut` value labels, sans, positioned as
  HTML text absolutely against the chart container at the gridline y-fractions (not
  inside the SVG, which would distort under `preserveAspectRatio="none"`), formatted
  with `formatCurrency`. Minimal — this is a "few labels," not a dense axis.
- **Hover crosshair + tooltip** — on `mousemove` over the plotted area: an `--ink`
  marker dot on the line at the nearest data point, a thin vertical `--line`
  crosshair through it, and a small card-style tooltip (`--card` background, 1px
  `--line` border, same radius/shadow-free treatment as any Card) showing the point's
  date and `formatCurrency(price)`. All three hide on `mouseleave`.
- **Reference lines + legend (Technical only)** — optional `--mut`
  `stroke-dasharray="6 5"` horizontal lines at given values (support/resistance),
  1px stroke width, plus a legend row beneath the chart: sans 10.5px uppercase
  `--mut`, `justify-content:space-between`, e.g. "Resistance $216.80 ┄ · Support
  $208.20 ┄ · Jan – Jul 2026". Omit both the lines and the legend entirely when no
  reference values are available — never fabricate a level.
- **Date-axis caption row** (Overview) — below the chart, `justify-content:
  space-between`, sans 10.5px uppercase 0.08em `--mut`, evenly spaced date labels
  (e.g. "Jul 2025 · Oct 2025 · Jan 2026 · Apr 2026 · Jul 2026").

Distinct from `portfolio-chart.tsx` (dashboard hero): the hero has the range-morph
tab row and 220-tall viewBox but no hover marker/crosshair/tooltip and no y-axis
labels — do not merge the two components or backport one's exclusive behavior into
the other without a Designer decision (adding hover/y-axis to the hero is logged in
`future_ideas.md`, out of scope here).

### Editorial coverage list
Hairline-divided list for News & sentiment's "Latest coverage": each row
`justify-content:space-between`, `align-items:baseline`, `gap:32px`, `padding:18px
0`, `1px --line2` bottom border (omit on the last row), `cursor:pointer`, row hover
per the standard rule (`background: color-mix(in srgb, var(--fill) 45%,
transparent)`, no border/inset change). Row content:
- **Left** — serif headline, Newsreader 17px/500, line-height 1.35, over a kicker
  line `{source} · {date}` (10.5px uppercase, 0.12em, `--mut`, `margin-top:6px`).
- **Right** — a single uppercase tag, sans 10.5px/600, 0.14em letter-spacing,
  `white-space:nowrap`, colored `--up` (POSITIVE) / `--mut` (NEUTRAL) / `--dn`
  (NEGATIVE). No pill/border chrome — text color only, unlike the outlined badges
  elsewhere in the system.

### Outlined type badge (transactions)
Inline pill, sans 10px/600 uppercase, 0.14em letter-spacing, `border-radius:10px`,
`padding:2px 10px`. Two variants by transaction type:
- **BUY** — `1px --up` border, `--up` text.
- **Other** (SELL, or any type outside the schema's BUY/SELL — see
  `TECH_DEBT.md TD-DTL-TXTYPE`) — `1px --line` border, `--mut` text.
Used in the Transactions tab's table Type column only; do not reuse for the
Analysts "Recent revisions" RAISED/HELD/LOWERED tags, which are unbordered colored
text (`--up`/`--mut`/`--dn`, 10.5px/600, 0.14em) matching the Editorial coverage
list's tag treatment, not this badge.

### TARGET REACHED badge
Outlined pill, no fill: 1px `--up` border, `--up` text, radius 10px, padding `2px 8px`,
sans 10px/600, uppercase, 0.12em letter-spacing, inline next to the security name
(`margin-left:8px`, `vertical-align:middle`). Appears only on watchlist rows whose
target condition is currently met; the row itself gets no background fill — only the
badge, and the Target cell text turns `--up`/weight 500.

### Circular row-action button
28px circle, 1px `--line` border, `--sub` icon color (12px stroke SVG, stroke-width 2,
round caps), `margin-left:8px`, `display:inline-flex` centered. Two variants by hover
color only:
- **Add/buy** (plus icon) — hover border + icon → `--ink`.
- **Remove** (× icon) — hover border + icon → `--dn`.
Used in the Watchlist table's action column; same 28–34px circular-button pattern
(border + icon, no fill) is reused at 34px for the masthead's theme toggle and account
control.

### Segmented control (currency EUR/USD)
See Spacing/shape above for exact metrics. Semantic note: replaces the multi-currency
`CurrencySelector` **only on the dashboard hero**; the underlying preference and other
6 currencies are unchanged elsewhere in the app — the control shows whichever currency
is currently active rather than forcing EUR.

### Verdict stamp
Research-detail "Buy"/"Hold"/"Sell"-style call: inline-block, `3px double` border in
the verdict's color (`--up` for a positive call — the only color the handoff shows;
apply the same coloring rule as Score figure for other verdicts, i.e. `--amber`/`--dn`
bands), matching text color, padding `8px 20px`, 13px/600, uppercase, 0.2em
letter-spacing, `transform: rotate(-3deg)`. Reads as a rubber ink stamp — keep the
rotation, it is deliberate, not a bug.

### Drop-cap editorial paragraph
Used once, in "The Morning Note" insights strip. First letter: Newsreader, 56px,
line-height 0.82, `float:left`, padding `6px 10px 0 0`, color `--ink`. Rest of
paragraph: Newsreader 19px/1.6, color `--sub`. Paired with a right-hand rail
(`border-left:1px --line`, `padding-left:32px`) holding an italic serif pull-quote
(17px) and a `--mut` 10.5px uppercase attribution line. Below both, a 3-column
`--line2`-ruled strip (Top risks / Opportunities / Recommendations), each column
carrying: a colored eyebrow (`--amber` for risks, `--ink`-default for opportunities,
`--up` for recommendations) with a symbol prefix (⚠ / ◇ / →), 8px bottom
border-`--line2`, then stacked 15.5px serif lines each preceded (Recommendations only)
by a `№{n}` serif index in `--mut`.

### Order-summary total row
Label/value rows at 13.5px `--sub`, `4px 0` padding each. Final "Total cost" row sits
above a `3px double var(--ink)` top rule with `12px` margin-top / `14px` padding-top,
rendered at Newsreader 22px in `--ink` (no muted styling — this is the number the
screen exists to show). Used identically in Buy-more/Sell-position modals per the
plan's Task 10 (shared form surface).

### Card
Base surface for every non-table content block: `--card` background, 1px `--line`
border, radius 8px, padding 24–28px (32px for forms). Optional variants:
- **Editorial card** — adds `border-top: 3px double var(--ink)` (Morning Note, research
  score breakdown).
- **Bare stat band** — no card wrapper, just the ruled band (see Ruled stat band).

### Segmented tabs (range / section tabs)
Flex row, `18–32px` gap. Inactive: 10.5–11px, `--mut`, transparent 1–2px bottom border
(space reserved). Active: weight 600, `--ink` text, 1–2px `--ink` bottom border. Used
for chart range tabs (1D…Max), Add-position's Price-per-share/Total-amount pair (2px
underline variant), and Closed-positions' All/Winning/Losing filter.

Research-detail's own tab bar is the same pattern at its exact handoff values: flex
row `gap:32px`, `padding:4px 4px 0`, `1px --line` bottom border under the whole row.
Each tab: sans 11px/uppercase/0.14em, `padding-bottom:12px`, `cursor:pointer`,
`white-space:nowrap`. Inactive: `--mut`, no border. Active: weight 600, `--ink` text,
`2px solid --ink` bottom border. Client-side tab state, 7 tabs: Overview · Technical
· Fundamental · Analysts · Intrinsic value · Transactions · News & sentiment.

### Pill sub-nav (Fundamental tab)
A second-level nav, distinct from Segmented tabs — filled/outlined pills, not
underlines, because it sits one level below the section tab bar and must not be
mistaken for it. Flex row, `gap:10px`, `flex-wrap:wrap`, `margin-bottom:20px`. Each
pill: sans 10.5px uppercase 0.12em, `padding:8px 18px`, `border-radius:16px`,
`cursor:pointer`, `white-space:nowrap`. Inactive: `--mut` text, `1px --line` border,
transparent fill. Active: `--btnbg` fill, `--btnfg` text, weight 600, no border. Six
pills, client-side state: Overview · Valuation · Profitability · Growth · Health ·
Dividend — switches which single card renders below (Overview = 2-col
score-breakdown grid + Revenue-by-segment card; the other five = one grouped-metrics
card each, per `## UX flows → Research detail`).

### Dashboard SVG performance chart
Per ADR-10: a purpose-built inline SVG (not Recharts) on the dashboard hero only —
`lib/utils/chart-path.ts` exports the pure `buildPath()` Catmull-Rom→cubic-bezier
function ported from the prototype's `buildPath(vals, w, h)`. Rendering spec: viewBox
`0 0 1300 220`, 3 hairline `--line2` gridlines at fixed y-positions, ink line at
1.5px stroke width, no fill on the line, a separate fill-only area path
(`chartLine + 'L{w},{h}L0,{h}Z'`) at `fill:var(--ink)` `fill-opacity:0.05` and
`stroke:none`, and a `--line` (not `--line2`)
baseline rule at the bottom. Range-change morph: 500ms, ease-in-out
(`k<0.5 ? 2k² : 1-(-2k+2)²/2`), driven by `requestAnimationFrame`, interpolating every
point in the 20-point series from its previous value to its new value — not a snap
re-render.

**Superseded note (ADR-11):** the prior sentence here said research detail's chart
(`price-chart.tsx`) keeps Recharts, retokenized only. Per
`plans/2026-07-18-meridian-research-detail.md` and ADR-11, that is no longer current
— the research-detail Overview and Technical charts now use `DetailPriceChart` (see
Components → "Detail price chart"), which shares this component's `buildPath`/
`buildAreaPath` primitives but is a separate component (no range-morph; adds hover/
y-axis/reference-line behavior this hero chart does not have). `price-chart.tsx`
(Recharts) is retired once no importer remains — do not build new screens against it.

---

## Tone of voice

Meridian speaks as a newspaper of record covering one reader's own money — measured,
declarative, editorial, never hyped or chatty.

**Principles:**
- **Kickers over labels.** Section headers are newspaper eyebrows: uppercase, wide
  letter-spacing, muted color — "Under observation · before you invest," "The ledger ·
  completed trades," "New entry · the ledger." Every screen's H1 gets one.
- **Serif for consequence, sans for interface.** Numbers that matter (portfolio value,
  scores, totals) and anything editorial (headlines, pull-quotes, italic asides) are
  Newsreader. Chrome — labels, buttons, table body — is Libre Franklin. Don't swap
  these: serif everywhere reads costume-y, sans everywhere loses the newspaper voice.
- **Italic serif for asides, not instructions.** "as of 17:30 CET," "Current market
  price: €196.40," "Sign in to your account to continue." — quiet, secondary,
  never load-bearing information. If a sentence is required reading, it is not italic.
- **"The Morning Note" framing** for AI-generated portfolio insights: written as a
  dispatch with a drop cap, a pull-quote, and byline-style attribution ("— Portfolio
  impact"), not as a card of bullet points. Risks/Opportunities/Recommendations get
  editorial-page symbols (⚠ / ◇ / →), not icon-font icons.
- **Precision over enthusiasm.** "Time to consider buying," not "Great opportunity!".
  "Trim NVDA toward a 10% target weight," not "You should sell some NVIDIA!" State the
  number, state the implication, stop.
- **№ and · as house punctuation.** Use `№` for numbered list items (insights,
  recommendations) and `·` as a mid-dot separator in kickers and metadata lines
  ("AAPL · Nasdaq", "4 trades settled"), matching the handoff exactly — not "#" or "-".

**Do / Don't**

| Do | Don't |
|---|---|
| "Realized to date: +$545.60" | "You've made $545.60! 🎉" |
| "Time to consider buying" | "Buy now!!" |
| "Tech concentration above 55% of portfolio value." | "Warning: too much tech!" |
| "Under observation · before you invest" | "Your Watchlist" |
| "Sign in to your account to continue." (italic, quiet) | A loud instructional banner |

---

## UX flows

This overhaul is a re-skin: every flow, route, and piece of business logic is
unchanged. The 7 screens covered (per the plan) and their navigation:

1. **Dashboard** (`/dashboard`) — hero portfolio value, currency toggle, stat band,
   performance chart, positions table, "The Morning Note" insights. Entry point after
   login; masthead wordmark always returns here. Rows → Research detail.
2. **Closed positions** (`/portfolio/closed-positions`) — realized P/L ledger, CSV
   export, ticker filter, All/Winning/Losing tabs. Reached via nav "Closed".
3. **Watchlist** (`/wishlist` route; **user-visible copy only** renamed to "Watchlist"
   per ADR-9 — route, files, service, and Prisma schema stay `wishlist`, out of scope
   for this pass) — targets/scores stat band, 13-col scrollable table, add/remove
   actions. Reached via nav "Watchlist".
4. **Research index** (`/research`) — centered search, "Popular this week", 3
   discipline cards (Technical/Fundamental/Intrinsic) linking into the existing
   research flow (no new routes). Reached via nav "Research".
5. **Research detail** (`/research/[symbol]`) — company header, 4-col stat card,
   a 7-tab bar (Overview/Technical/Fundamental/Analysts/Intrinsic value/Transactions/
   News & sentiment), a custom-SVG `DetailPriceChart` (ADR-11, supersedes the earlier
   retained-Recharts plan), and a headline score card per tab. Reached from any table
   row or the research index. Full tab-by-tab spec: see "Research detail" below.
6. **Add position** (`/portfolio/add`) — narrow form, stock search, shares/date,
   price-per-share ↔ total-amount tab pair, order summary, Cancel/Add pills. Reached
   from the dashboard's "+ Add position" and research detail's "+ Add to portfolio".
7. **Login** (`/login`) — centered masthead + card, email/password, remember-me,
   forgot-password, sign-in. **Register** (`/register`) is not covered by the design
   bundle; it inherits the Login screen's treatment by direct extrapolation (same
   420px column, masthead block, card, field/label/button patterns) — see the plan's
   `## Assumptions`. No new tokens or patterns are needed for it.

### Research detail — tab-by-tab

Governing plan: `plans/2026-07-18-meridian-research-detail.md` (ADR-11). Company
header: name (Newsreader 52px) over a `TICKER · EXCHANGE` kicker (sector clause
appended only when the quote payload has it — a data gap when absent, see the
plan's data-gap map); right-aligned "☆ Watchlist" secondary pill + "+ Add to
portfolio" primary pill. Below: the 4-col quote stat card (Current price / Day
range / 52-week range / Market cap), then the Segmented tabs research-detail tab
bar (7 tabs, client-side state — see Components → "Segmented tabs").

Score band thresholds used throughout every tab (presentational only — recolors an
already-computed number, never changes scoring math): **≥ 7 → `--up`, 4–7 →
`--amber`, < 4 → `--dn`, null/unavailable → `--mut`** (same thresholds as Score
figure).

1. **Overview** — `DetailPriceChart period="1Y"` card (no range tabs, static),
   then the Headline score card: 84px composite score + rotated `VerdictStamp` +
   verdict kicker on the left, 5-col `SubscoreBand` (Technical/Fundamental/
   Analysts/Intrinsic/Sentiment) + №-numbered key-insights list on the right.
2. **Technical** — Headline score card: 84px score + verdict kicker + italic
   summary on the left, `DetailPriceChart period="6M"` (+ dashed support/
   resistance reference lines and legend when available — data gap otherwise, see
   Components → "Detail price chart") on the right. Below: an "Indicators" card,
   4-col ruled table (Indicator / Reading / Interpretation / Signal), Signal cell
   uppercase 10.5px/600 colored BUY `--up` / NEUTRAL `--amber` / SELL `--dn`.
3. **Fundamental** — Headline score card: 84px score + italic summary on the left,
   5-col `SubscoreBand` (Valuation/Profitability/Growth/Health/Dividend) on the
   right. Below: the Pill sub-nav (Overview/Valuation/Profitability/Growth/Health/
   Dividend). *Overview* sub-view = a "Score breakdown" card, 2-col grid of the
   five sections (each: serif name + subscore under a `3px double var(--ink)` rule,
   then 4 `GradedMetricRow`s), plus the Grading dot legend, plus a "Revenue by
   segment" card (thin `--ink`-on-`--fill` bar per segment + % + colored YoY delta —
   full data gap today, render the empty state). Each of the other five sub-views =
   one card: serif title + subscore under the same double rule, then grouped metric
   sections (uppercase kicker group heading over a `1px --line` rule, 2-col
   `GradedMetricRow` grid), occasionally closed with an italic serif footnote
   (13.5px, `--mut`) — e.g. the Profitability ROE-buyback caveat, the Dividend
   payout caveat.
4. **Analysts** — Headline score card: 84px score + rotated `VerdictStamp` +
   "Street consensus" kicker on the left; on the right, a 5-row ratings-distribution
   list (label 10.5px uppercase `--mut` / thin colored bar on a `--fill` track,
   `height:6px radius:3px`, width = count⁄total, colored `--up`/`--amber`/`--dn` by
   rating tier / right-aligned count), then a `1px --line`-topped 3-col price-target
   band (Low `--dn` / Median unstyled + upside `--up` line / High `--up`; Low/High
   render as em-dash placeholders when the API only returns a mean target — data
   gap). Below: a "Recent revisions" card, table of firm (serif) / action text
   (`--sub`) / RAISED `--up` · HELD `--mut` · LOWERED `--dn` tag (10.5px/600,
   0.14em, unbordered text — same tag treatment as the Editorial coverage list, not
   the Outlined type badge) / date (`--mut`); empty state when revisions are absent
   (current API gap).
5. **Intrinsic value** — Headline score card: 84px amber-band score, "Fair value
   estimate" kicker + 34px serif fair-value figure + a colored "Trading X%
   above/below fair value" line (13px/500, banded), then an italic summary — all on
   the left. Right: a 3-col scenario band (Bear `--dn` kicker / Base `--mut` kicker
   / Bull `--up` kicker, each a 26px serif value + a 12px `--mut` caption; Bear/Bull
   render em-dash when only a single-point estimate exists — data gap, Base always
   populated), then "Model assumptions" label/value rows (Revenue growth + Discount
   rate available from the DCF Lite method; FCF margin + terminal growth em-dash —
   data gap).
6. **Transactions** *(new tab)* — a bare (no card) 4-col ruled stat band (`1px
   --line` top+bottom, `--line2` verticals) — Shares held / Average cost / Market
   value / Unrealised P/L (banded `--up`/`--dn` when signed) — shown only when the
   symbol is held; unowned symbols render a quiet empty state ("You do not hold
   {symbol}." + the "+ Add to portfolio" pill) with no stat band. Below: a "Your
   transactions" card with a "+ Add transaction" outlined pill (height 32px, per
   Spacing/shape's secondary-button pattern) and the standard table shell (Date /
   Type / Shares / Price / Fees / Total), Type cell using the Outlined type badge.
7. **News & sentiment** — Headline score card: 84px sentiment score + trend kicker
   (banded, e.g. "Warming" in `--up`) + italic summary on the left; 3-col tone band
   on the right (Positive/Neutral/Negative %, each with a colored MoM-delta caption
   line — omitted when history is too thin to compute, data gap). Below: the
   Editorial coverage list ("Latest coverage").

**Explicitly out of scope for this pass** (unchanged, stock-shadcn look retained):
`app/page.tsx` (marketing landing page, not behind auth) and
`app/(dashboard)/portfolio/[ticker]/page.tsx` (position detail — reachable from the
dashboard but not one of the 7 designed screens; logged as tech debt).

**Edge cases carried over unchanged:** empty/loading/error states on the dashboard
chart, sorting on every Watchlist column, add/remove mutations, CSV export, currency
reconversion, form validation errors on Add position and Login. None of these behaviors
change — only their visual presentation does.

**Research-detail-specific edge cases (new with the 7-tab structure):** the
Transactions tab's owned-vs-not-owned empty state (see item 6 above); every data
gap in the plan's data-gap map renders a quiet editorial placeholder (em-dash cell
or a muted italic caption) rather than fabricated numbers or a broken layout — never
hide the surrounding card/row, only the missing value. Placeholder wording is a
Coding-agent detail within the tone-of-voice rules above, not a fixed string this
file mandates.
