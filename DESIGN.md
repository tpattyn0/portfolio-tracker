# DESIGN.md

Meridian — a newspaper-editorial visual identity for the portfolio tracker. Centered
masthead, serif figures, ruled stat bands, flat/no-shadow surfaces, a near-monochrome
warm palette with three chromatic accents reserved for gain/loss/mid-score meaning.

Source: `design_handoff_meridian/` (gitignored reference bundle — high-fidelity; colors,
typography, spacing, and interactions below are final). Governing plan:
`plans/2026-07-17-meridian-design-overhaul.md` (ADR-8 token reconciliation, ADR-9
Watchlist naming, ADR-10 custom SVG chart — see `DECISIONS.md`).

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
for chart range tabs (1D…Max), research-detail section tabs (Overview/Technical/…),
Add-position's Price-per-share/Total-amount pair (2px underline variant), and
Closed-positions' All/Winning/Losing filter.

### Dashboard SVG performance chart
Per ADR-10: a purpose-built inline SVG (not Recharts) on the dashboard hero only —
`lib/utils/chart-path.ts` exports the pure `buildPath()` Catmull-Rom→cubic-bezier
function ported from the prototype's `buildPath(vals, w, h)`. Rendering spec: viewBox
`0 0 1300 220` (190 on research-detail's retained-Recharts chart — not this component),
3 hairline `--line2` gridlines at fixed y-positions, ink line at 1.5px stroke width, no
fill on the line, a separate fill-only area path (`chartLine + 'L{w},{h}L0,{h}Z'`) at
`fill:var(--ink)` `fill-opacity:0.05` and `stroke:none`, and a `--line` (not `--line2`)
baseline rule at the bottom. Range-change morph: 500ms, ease-in-out
(`k<0.5 ? 2k² : 1-(-2k+2)²/2`), driven by `requestAnimationFrame`, interpolating every
point in the 20-point series from its previous value to its new value — not a snap
re-render. `price-chart.tsx` (research detail) keeps Recharts and is retokenized only
(ink line, `--line2` gridlines, no range tabs) — do not port the custom chart there.

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
   section tabs (Overview/Technical/Fundamental/Analysts/Intrinsic/News), retained
   Recharts price chart, composite score breakdown. Reached from any table row or the
   research index.
6. **Add position** (`/portfolio/add`) — narrow form, stock search, shares/date,
   price-per-share ↔ total-amount tab pair, order summary, Cancel/Add pills. Reached
   from the dashboard's "+ Add position" and research detail's "+ Add to portfolio".
7. **Login** (`/login`) — centered masthead + card, email/password, remember-me,
   forgot-password, sign-in. **Register** (`/register`) is not covered by the design
   bundle; it inherits the Login screen's treatment by direct extrapolation (same
   420px column, masthead block, card, field/label/button patterns) — see the plan's
   `## Assumptions`. No new tokens or patterns are needed for it.

**Explicitly out of scope for this pass** (unchanged, stock-shadcn look retained):
`app/page.tsx` (marketing landing page, not behind auth) and
`app/(dashboard)/portfolio/[ticker]/page.tsx` (position detail — reachable from the
dashboard but not one of the 7 designed screens; logged as tech debt).

**Edge cases carried over unchanged:** empty/loading/error states on the dashboard
chart, sorting on every Watchlist column, add/remove mutations, CSV export, currency
reconversion, form validation errors on Add position and Login. None of these behaviors
change — only their visual presentation does.
