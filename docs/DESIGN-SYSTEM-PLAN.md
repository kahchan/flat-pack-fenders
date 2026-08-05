# Design system adoption — plan

Adopting the shared design system across the app's screen surface, plus the repo's first CI:
a GitHub Pages workflow that publishes on push to `main` behind the test suite.

Not a feedback round — this is a deliberate re-skin, so it uses its own WP numbering (**WP35+**)
and does not continue `docs/PLAN.md`'s §9 defect numbering except where it turns one up.

---

## The export is in hand

`Approximately Scientific Design System.zip` — 150 files. The six token files and the readme are
vendored at **`docs/design-system/`** so this plan can be checked against them without the zip.

What it contains: `tokens/{base,colors,effects,fonts,spacing,typography}.css`; ten components as
JSX (Button, Card, Badge, IconButton, Tag, DataTable, Equation, FigureFrame, Sparkplot, StatBlock);
guidelines; app-screen and marketing templates; brand SVGs; and `_adherence.oxlintrc.json`, a lint
config for enforcing conformance.

It is a close fit for this project — paper/ink/blueprint, drafting-derived spacing, hairlines as
"the brand's geometry", viridis plot stops with darkened stroke-safe substitutes. That is a
technical-drawing vocabulary, which is what this app draws.

### What the system actually specifies

| | value |
| - | ----- |
| Colour | warm paper `#FFFDF8…#E4DFD1`, cool ink `#101418…#C7CBCF`, cyanotype blueprint `#173359…#DCE6F2`, signal (max contrast, **capped ~5% of screen**, reserved for "measurement, effort, now"), viridis `--plot-1…6`, muted status |
| Hairlines | light blueprint `--rule-hair #CBDDF3` — "lines on paper, **never grey**"; the drafting grid reuses the same value |
| Type | four families, strict roles: Newsreader display serif, Archivo body/UI, Geist Mono for *every* number/unit/label, Ojuju for eyebrows and sans numerals |
| Type scale | 10, 11.5, 13, 15, 17, 21, 27, 34, 44, 58, 76 px — paper-derived, **not** a 4px grid |
| Spacing | 3, 5, 8, 11, 15, 20, 27, 36, 48, 64, 84, 112 px — millimetric, "not digital" |
| Radii | 0, 1, 2, 3, pill — "paper does not have big round corners" |
| Shadows | offset, not blur: `--shadow-print 1px 1px 0`, `--shadow-raise 2px 2px 0`. One blurred token, overlays only |
| Motion | `--ease-plot cubic-bezier(.2,.6,.2,1)`, no spring or bounce; 120/200/900 ms |
| Scope | `.as-blueprint` inverts the whole palette for dark chrome |

### The four decisions, resolved

1. **Fonts — all four, fetched and vendored.** Newsreader, Archivo, Ojuju and Geist Mono are
   fetched from Google Fonts, subset to latin, vendored into `public/fonts/`, and declared with
   real `@font-face` rules. The `@import` in `tokens/fonts.css` is **not** shipped. All four are
   OFL; licences get recorded alongside the files.
2. **Editable values stay ≥ 16 px.** The system puts every number at 13 px; the rail's editable
   value fields keep 16 px, because below it iOS zooms the page on focus (WP24 §24.3, verified on
   device-width). *Reading taken:* this applies to the **editable** fields specifically — static
   data (spec table, captions, annotations) may take the system's 13 px. If you meant every number
   everywhere, say so and §35.4 changes.
3. **Keep the 4/8 spacing grid and the blurred shadows; take the radii.** Radii collapse to the
   system's 0–3 px. Spacing keeps today's 4, 8, 12, 16… scale. Shadows keep today's blurred
   `--shadow-1/2/nav`.
4. **Blueprint is the tie-breaker.** Where a mapping is genuinely ambiguous, take the blueprint
   value rather than inventing a neutral.

---

## Where this deliberately departs from the system

Recorded because a future reader will otherwise assume drift, and because the shipped
`_adherence.oxlintrc.json` will flag all three as violations. These are choices, not misses.

| Departure | The system says | We do | Cost |
| --------- | --------------- | ----- | ---- |
| **Spacing** | drafting-derived 3/5/8/11/15/20/27/36…, explicitly "millimetric, not digital" | keep 4/8/12/16/20/24/32/40… | loses the millimetric cadence that is part of the system's stated character. Cheap to reverse later — spacing touches layout only, not meaning. |
| **Shadows** | offset, not blur: `--shadow-print 1px 1px 0`, `--shadow-raise 2px 2px 0`; blur exists in exactly one token, for overlays | keep blurred `--shadow-1/2/nav` | this one is load-bearing for the system's identity — *"depth comes from rules and offset, not blur"* — and pairs with the 0–3 px radii we ARE taking. Sharp corners with soft blurred shadows is the combination the system exists to avoid. Worth revisiting once it is on screen. |
| **Data type size** | 13 px mono for every number | 16 px for editable values | forced by iOS zoom-on-focus, not aesthetic. Non-negotiable while the number is the control. |

**Consequence for E2.** "Adopt the system's names wholesale" cannot hold where we keep our own
values. A token called `--sp-6` holding 24 px instead of 20 px is a lie that misleads every reader
and defeats the adherence linter. So:

- **Adopt system names AND values**: colour, type scale, radii, motion, hairlines.
- **Keep our names AND values**: spacing (`--space-N`), shadows (`--shadow-N`).

The rule is that a name and its value travel together. No token wears the system's label over a
different number.

## Decisions (settled)

| # | Decision | Consequence |
| - | -------- | ----------- |
| **E1** | **Screen chrome only** | `tokens.css` adopts the system. `draw.css` keeps its semantic colours; its neutrals are re-pointed so the drawing does not clash (§35.3). |
| **E2** | **Name and value travel together** | System names where we take system values (colour, type, radii, motion). Our names where we keep our values (spacing, shadows). No token wears a label over a different number. |
| **E3** | **All four families, fetched and vendored** | Newsreader, Archivo, Ojuju, Geist Mono, subset to latin, in `public/fonts/`. No CDN `@import`. |
| **E4** | **Pages deploys on push to `main`, gated on the suite** | Publishes only if `vitest`, `tsc` and `build` pass. Also the repo's first CI of any kind. |
| **E5** | **Editable values stay ≥ 16 px** | Forced by iOS zoom-on-focus, not taste. Static data may take the system's 13 px. |
| **E6** | **Blueprint is the tie-breaker** | Ambiguous mapping takes the blueprint value rather than an invented neutral. |

---

## What is there today

- **`src/styles/tokens.css`** — 65 tokens: 16 colour, 2 font families + 5 weights, 12 type, 12
  spacing, 4 radii, 3 shadows, 10 easing/duration. Also holds the four `@font-face` blocks.
- **`src/styles/draw.css`** — ~22 `--draw-*` tokens for the drawing and print surface. **Untouched
  per E1.**
- **17 files consume `var(--…)`**, including three that are not components:
  `src/fender/pattern.ts`, `isometric.ts` and `crossSection.ts` emit token references straight into
  geometry output, and `src/fender/__tests__/crossSection.test.ts` asserts on them.
- **Fonts**: `public/fonts/HankenGrotesk-latin.woff2` and `JetBrainsMono-latin.woff2`, preloaded in
  `index.html`, declared in `tokens.css`.
- **No CI.** No `.github/workflows` at all. Deploy is manual: `npm run deploy` → `gh-pages -d dist`.

---

## WP35 — Adopt the token vocabulary

### 35.1 What moves, and what does not (E2)

A token's name and its value travel together, so the migration splits:

| Group | Names | Values |
| ----- | ----- | ------ |
| colour, type scale, radii, motion, hairlines | **system's** | **system's** |
| spacing, shadows | **ours, unchanged** | **ours, unchanged** |

`--color-*` becomes the system's `--surface-*` / `--text-*` / `--accent` / `--border-*` aliases,
`--text-*-size` becomes `--text-2xs…5xl`, `--radius-*` becomes `--radius-none…pill`, and
`--ease-*` / `--dur-*` become `--ease-plot` and the system's durations. `--space-1…12` and
`--shadow-1/2/nav` stay exactly as they are, values included.

Three consumers are not CSS or components and need care:

- `pattern.ts`, `isometric.ts`, `crossSection.ts` build `var(--token)` strings into the drawing
  model. These reference **`--draw-*`** names, which §35.3 governs — so they should need **no
  change**. Confirm rather than assume: any `--color-*` reference inside `src/fender/**` is a
  screen token leaking into geometry output, and has to be resolved deliberately.
- `src/fender/__tests__/crossSection.test.ts` asserts on emitted token names. If it only names
  `--draw-*`, it is unaffected.

### 35.2 Method

Mechanical and verifiable, in this order:

1. Write the new `tokens.css` from the system's export, names and values verbatim.
2. Build a complete old→new mapping table **in the plan**, one row per old token, before touching
   any consumer. Where the system has no counterpart for an existing token, that is a decision to
   record, not a gap to improvise over.
3. Rewrite consumers, one file at a time.
4. Delete the old names. **The build must fail loudly on a missed reference**, not fall back —
   an unresolved `var()` renders as nothing and is easy to miss visually. Grep for any surviving
   old-name reference across `src/` and `index.html` as a hard gate.

### 35.2b Token mapping (resolved)

Ten current tokens are dead (zero consumers in `src/` or `index.html`) and are deleted, not
migrated: `--color-surface`, `--color-brand-pale` (revived below under its new name since it's
needed regardless), `--color-accent-soft`, `--color-grid-hairline`, `--text-heading-xl-size`,
`--text-heading-md-size`, `--text-body-lg-size`, `--ease-in-out`, `--ease-in`, `--dur-base` (old),
`--dur-reveal`, `--dur-slow` (old).

Two tokens split because they do two jobs: `--color-fg` (text vs. dark *fill*) and
`--text-mono-sm-size` (static data vs. the E5 editable-value field).

**Colour**

| old | new | note |
| --- | --- | --- |
| `--color-bg` | `--surface-page` (`#F7F4EC`) | text-on-dark-fill sites (`app.css:480`, `responsive.css:80`, `Button.tsx:38`) take `--text-inverse` instead |
| `--color-bg-alt` | `--surface-sunken` (`#EFEBE0`) | |
| `--color-surface-raised` | `--surface-card` (`#FFFDF8`) | surfaces collapse to one raised tier — confirmed |
| `--color-fg` (text) | `--text-strong` (`#101418`) | |
| `--color-fg` (fill) | `--surface-inverse` (`#101418`) | `.option-btn--dark`, `.rail-pill` |
| `--color-fg-muted` | `--text-muted` (`#545C64`) | |
| `--color-fg-faint` | `--text-faint` (`#7C848C`) | still 3.45:1 on `--surface-page`, short of AA — **deferred**, not fixed in this pass per sign-off |
| `--color-brand` | `--accent` (`#1E4478`) | semantic alias, not the raw ramp |
| `--color-brand-mid` (link) | `--text-link` (`#1E4478`) | |
| `--color-brand-mid` (lit button) | `--accent-hover` (`#173359`) | hover direction inverts: darkens, not lightens |
| `--color-brand-pale` | `--accent-quiet` (`#DCE6F2`) | |
| `--color-accent` | dissolves — confirmed | warning banner → `--warn-500`/`--warn-100`/`--warn-600`; "live now" state (toggle-on, tinted option, editing value, focus ring) → `--measure`/`--measure-quiet`/`--focus-ring`; step/figure numbering → `--accent`; link/reset hover → `--text-link-hover`. Coral leaves screen chrome entirely; survives only in `draw.css` (`--draw-seam`, `--draw-iso-strut-edge`), untouched per E1. |
| `--color-accent-pale` | `--measure-quiet` / `--warn-100` | editing-field sites → `--measure-quiet`; warning banner → `--warn-100` |
| `--color-border` | `--border-default` (`--rule-hair`, `#CBDDF3`) | warm grey → notebook blue, per E6 |
| `--color-border-strong` | `--rule-solid` (`#9CBBDA`) | not `--border-strong` (ink-900) — that would blacken the value underline |
| `--color-overlay` | `--scrim` (`rgba(16,20,24,.42)`) | |

**Type scale** — names change entirely (system's `--text-2xs…5xl`, not size-role names):

| old | new | note |
| --- | --- | --- |
| `--text-heading-lg-size` (32px) | `--text-2xl` (34px) | `.rail-title` |
| `--text-heading-sm-size` (20px) | `--text-lg` (21px) | glyph sizing, not headings |
| `--text-body-md-size` / `--text-body-sm-size` (16px) | `--text-base` (15px) | both collapse to one token |
| `--text-mono-sm-size`, static (16px) | `--text-sm` (13px) | section meta, print-tile head, step numbers, spec-row value, rail-pill |
| `--text-mono-sm-size`, editable value (16px) | `--text-md` (17px) | `.slider-item__value` only — E5 floor is 16px, `--text-base` (15px) fails it |
| `--text-caption-size` / `--text-label-size` (12px) | `--text-xs` (11.5px) | both collapse to one token |
| `--text-label-weight` (600) | `--weight-semibold` (600) | kept at 600, not the system's label-role default of 500 |
| `--text-label-track` (0.07em) | `--tracking-label` (0.14em) | doubles; weight stays semibold rather than also taking the system's full label role — confirmed as the middle path |

Discrete `--text-*` + `--weight-*` + `--tracking-*` primitives throughout, not composite `--type-*`
shorthands — three sites (editable value, dismiss glyph, `.rail-title` tracking) each override a
single axis against the system's role, and `font: var(--type-*)` resets line-height/font-variant on
any partial override. `.as-data` / `.as-label` utility classes may still take the composite roles
directly where WP36 needs them verbatim.

**Radii** — collapse to one value, confirmed:

| old | new |
| --- | --- |
| `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (16px) | `--radius-sm` (2px) — including the bottom-sheet top corners |
| `--radius-pill` (999px) | `--radius-pill` (999px), unchanged |

**Motion**

| old | new | note |
| --- | --- | --- |
| `--ease-out` | `--ease-plot` | drawer + scrim — confirmed, including the curve-shape change |
| `--dur-instant` (80ms) | `--dur-fast` (120ms) | Button press |
| `--dur-fast` (200ms, ours) | `--dur-base` (200ms, system) | **name collision** — value is unchanged but the name is reused at a different value (system's `--dur-fast` is 120ms). Highest-risk row for the 35.2-step-4 grep. |
| `--dur-slide` (600ms) | `--dur-slow` (420ms) | drawer transform + scrim opacity — confirmed |
| `--dur-lazy` (900ms) | `--dur-plot` (900ms) | value already matched, name adopted for free |

One repair alongside, not a token rename: `Button.tsx:69–72` and `app.css:470` use the bare `ease`
keyword instead of a token. Route them through `--ease-plot` in the same pass — invisible to a grep
for `--ease-*`.

`--space-1…12` and `--shadow-1/2/nav` are unaffected — ours, unchanged, per E2.

### 35.3 The drawing seam, resolved by E6

`draw.css`'s colours split into two kinds:

- **Semantic** — `--draw-cut` (solid, cut this), `--draw-fold` (blue dashed, never cut),
  `--draw-seam` (coral, panel seam), `--draw-fold-print` (deliberately greyer so folds survive a
  mono printer). These carry meaning a builder relies on. **Left alone.**
- **Neutral** — `--draw-paper` `#faf8f3`, `--draw-blank-fill`, `--draw-frame`, `--draw-ghost`,
  `--draw-label*`, `--draw-iso-seam`, `--draw-xsec-tyre/rim`. These are *duplicated literals* of
  today's UI palette — `--draw-paper` is exactly today's `--color-surface`. Left untouched, the
  drawing card visibly clashes with the new paper tint it sits on.

The neutrals are re-pointed at the system's paper/ink tokens, and **per E6 the hairline neutrals
(`--draw-frame`, `--draw-ghost`) take blueprint** — `--rule-hair #CBDDF3` is the system's answer to
exactly this: "lines on paper, never grey".

**Not done here:** the semantic set. The system has a real technical palette — viridis with
`--plot-5-line` / `--plot-6-line` substitutes that exist precisely because bright viridis is
illegible as a thin line on paper — and it is arguably better than what `draw.css` improvises. But
changing what a builder reads as "fold, never cut" needs a mono-print verification pass, not a
re-skin. Recorded as its own package.

### Verify

- Zero references to any old token name anywhere in `src/` or `index.html`.
- Zero unresolved `var()` at runtime: enumerate every custom property used and assert each resolves
  to a non-empty computed value, at desk, tablet and phone widths.
- `npx vitest run` and `npx tsc --noEmit -p tsconfig.app.json` clean.
- Screenshots at 1400×900, 769×1024 and 390×844, before and after, for a deliberate comparison
  rather than a vibe check.
- Contrast: body text, muted text and faint text each checked against their actual background. The
  current palette puts `--color-fg-faint` `#8898a8` on `#f5f0e8`, which is already marginal — do not
  inherit that silently into the new system.

---

## WP36 — Typefaces

### 36.1 Four families, fetched and vendored (E3)

The system ships **no font binaries** — `tokens/fonts.css` is a Google Fonts `@import`, and that
`@import` is not shipped. Per E3 all four are fetched, subset to latin, vendored into
`public/fonts/`, and declared with real `@font-face` rules beside the existing pattern:

| Role | Family | Weights needed |
| ---- | ------ | -------------- |
| Display serif | **Newsreader** | 300–400, plus real italic for `--type-subtitle` |
| Body / UI | **Archivo** | 400–600 |
| Eyebrow / sans numerals | **Ojuju** | 300–700 |
| Mono / data | **Geist Mono** | 400, 500 |

All four are OFL — record the licences alongside the files. Hanken Grotesk and JetBrains Mono are
removed once nothing references them, not before.

`index.html` currently preloads two `.woff2`. Four families is more than is worth preloading;
preload the two that paint first (Archivo, Geist Mono) and let the display serif and eyebrow face
load normally, with `font-display: swap`.

**Two of these were the system author's proposals, not your choice.** Its readme says Geist Mono
and Ojuju were specified by you, while "Newsreader and Archivo remain proposals". Taking all four
answers that, but it is worth seeing them on screen before the swap is irreversible.

### 36.2 The PDF does not use these fonts, and will not change

`src/export/pdf.ts` writes the **standard Adobe Helvetica** (`/F1`, `/F2`) with hardcoded AFM widths
for ASCII 32–126, and hand-rolls WinAnsi encoding. It never references the web fonts.

That is deliberate and stays: embedding a subset would mean shipping glyph outlines and a widths
table through a hand-written PDF writer, for labels on a cutting pattern. But it means **screen and
printed typography diverge further** with any new family — worth stating, since the plan otherwise
implies the re-skin reaches the printed output. It does not.

### 36.3 Three things the swap must not break

- **Tabular alignment.** The rail's numeric column and the drawing labels rely on the mono face's
  figures lining up. Geist Mono has tabular figures and the system sets `font-variant-numeric:
  tabular-nums` on `.as-data` — carry that over explicitly rather than relying on the face's
  defaults. Check by dragging a slider and watching whether the digits jitter, not with a static
  screenshot.
- **The 16 px floor (E5).** `--type-data` is 13 px in the system. The editable value field must
  stay ≥ 16 px or iOS zooms the page on focus. This is the one place the type scale does not win.
- **First paint on the print path.** `@media print` and the print tiles render text; a swapped or
  still-loading face changes label metrics. The PDF export is unaffected (§36.2), but the browser
  print path is not.

### Verify

- Fonts load from the same origin, with no network request to a third party (check
  `read_network_requests` for off-origin font hosts).
- A value field at 390 px still measures ≥16 px computed, and focusing it does not zoom.
- Numbers do not shift horizontally while a slider is dragged.
- Licences for any new family are compatible with a public repo, and recorded.

---

## WP37 — GitHub Pages on push to `main`

### 37.1 Today

No CI exists. Publishing is `npm run deploy` (`build && gh-pages -d dist`) run by hand, and the live
site is whatever someone last remembered to run it against — currently **stale by the whole of this
work**: `gh-pages` was last built 2026-08-03, `main` is at `efa6ab0`.

### 37.2 The workflow

`.github/workflows/deploy.yml`, on `push` to `main`:

1. `npm ci`
2. `npx vitest run`
3. `npx tsc --noEmit -p tsconfig.app.json`
4. `npm run build`
5. Upload `dist/` and publish via `actions/deploy-pages`

Needs `permissions: { contents: read, pages: write, id-token: write }` and a `concurrency` group so
overlapping pushes do not race. `vite.config.ts` already sets `base: '/flat-pack-fenders/'`, correct
for a project page — unchanged.

**Per E4 the gate is real**: a red suite blocks the deploy. People cut metal from what this prints,
so a broken pattern generator must not reach the live page. This is also the repo's first automated
check of any kind, which is a benefit worth naming on its own.

### 37.3 Two things only you can do

- **Switch the Pages source to "GitHub Actions"** in repo settings. It currently publishes from the
  `gh-pages` branch, and `actions/deploy-pages` does not use a branch. Until that is switched the
  workflow will run and publish nothing visible.
- Decide what happens to **`npm run deploy`** and the `gh-pages` branch. Once Actions is the source,
  running it pushes to a branch nobody serves — an escape hatch that silently does nothing.
  Recommend removing the script and the `gh-pages` dependency, and deleting the branch once a
  workflow deploy has succeeded.

### 37.4 A release consequence worth stating once

Automatic deploy means every merge to `main` immediately changes the pattern people print. This
round's geometry work already moved developed length, hole positions and section counts — a pattern
printed before it does not match one printed after. Automation makes that instant and silent.

If that matters, the answer is a version stamp on the printed sheet, not a slower deploy. Recorded
here as a follow-up rather than folded in.

### Verify

- A deliberately failing test on a scratch branch merged to `main` blocks the deploy and does not
  publish.
- A passing push publishes, and the live page serves the new build (check an asset hash, not a
  screenshot — caching lies).
- The live page loads with no console errors and no 404s on assets, which is what a wrong `base`
  would produce.

---

## Sequencing

WP37 first, and deliberately: it is independent of the re-skin, it makes the live page correct
*today*, and it means the design system lands with the suite gating it rather than after. WP35 then
WP36, since the type scale arrives with the tokens and the font files only matter once the scale is
in place.

1. **WP37** — Pages workflow on push, gated on the suite
2. **WP35** — token vocabulary (blocked on the export)
3. **WP36** — typefaces (blocked on the export; may be empty if families are unchanged)
