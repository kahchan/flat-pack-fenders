# Approximately Scientific — Design System

**Approximately Scientific** makes fun pseudo-scientific web and mobile apps, mostly cycling related. The products model quantities that are expensive to measure — power without a power meter, gradient anxiety, how much of your PR was tailwind — and are cheerfully honest about the error bar. The brand voice is a research group that knows it is not one.

## Sources

None. This system was built from a written brand brief only:

- Company description: "We make fun pseudo-scientific web and mobile apps, mostly cycling related."
- Influences given: science papers, architectural drawings, technical / CAD drawings, mathematical equations. **There should always be the _suggestion_ of geometry, even if there are NO lines on screen.**
- Logo direction given: the mark may be `~`, `≈` or `≅`; should work as a square iOS icon / favicon.
- Wordmark direction given: experiment with `APPROX.` (small eyebrow) over `Scientific`.

No codebase, Figma file, deck, screenshots or font binaries were supplied. Everything below is therefore an **original proposal** against that brief, not a recreation of an existing product. The UI kits in particular are applications of the foundations, not replicas — replace them with real product screens once they exist.

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | The single entry point consumers link. `@import` list only. |
| `tokens/fonts.css` | Font families + the Google Fonts import (see substitutions) |
| `tokens/colors.css` | Paper, ink, blueprint, signal, plot series, status, semantic aliases, `.as-blueprint` theme scope |
| `tokens/typography.css` | Scale, tracking, weights, composite `--type-*` roles |
| `tokens/spacing.css` | Spacing steps, grid, containers, radii, hairlines, fixed chrome |
| `tokens/effects.css` | Shadows, motion, scrim/blur, drafting patterns |
| `tokens/base.css` | Element resets, link colours, `.as-eyebrow` / `.as-label` / `.as-data` / `.as-graph` utilities |
| `assets/` | `logo.svg` (blueprint tile), `logo-mark.svg` (≈, currentColor), `logo-mark-congruent.svg` (≅), `wordmark.svg` |
| `guidelines/*.html` | 22 foundation specimen cards (Colors, Type, Spacing, Surfaces, Brand) |
| `components/` | 23 React primitives in 5 groups — see below |
| `ui_kits/app/` | Mobile cycling-app kit: Ride, Log, Analysis, Lab (click-through) |
| `ui_kits/website/` | Marketing site kit: hero, catalogue, method, papers, signup, footer |
| `templates/marketing-page/` | Template (Design Component): marketing page starting point |
| `templates/app-screen/` | Template (Design Component): 390px app screen starting point |
| `SKILL.md` | Agent Skills entry point |

### Components

- **core** — `Button`, `IconButton`, `Badge`, `Tag`, `Card`, `Annotation`
- **forms** — `Input`, `Select`, `Checkbox`, `Radio`, `Switch`
- **feedback** — `Callout`, `Dialog`, `Tooltip`, `ProgressMeter`
- **data** — `StatBlock`, `Equation`, `FigureFrame`, `Sparkplot`, `DataTable`
- **navigation** — `Tabs`, `SegmentedControl`, `TabBar`

Each has a sibling `.d.ts` (props contract) and `.prompt.md` (what & when + usage).

**Intentional additions** — no source defined a component inventory, so this is an authored standard set. Four members are brand-specific rather than generic: `Annotation` (drafting callout with leader line), `Equation` (numbered journal formula), `FigureFrame` (numbered plate on graph paper), `StatBlock` (mono figure with `≈` and error). They exist because the brief's core motifs — papers, equations, technical drawings — have no equivalent in a generic UI set.

## Content fundamentals

**The voice is a lab notebook with a sense of humour.** Precise about method, deadpan about conclusions. It never oversells, because overselling is the thing it is gently satirising.

- **Person.** "We" for the company and its methods ("We would rather be honestly approximate than precisely wrong"). "You" and "your" for the rider's data ("Your assumptions", "how much of your PR was the wind"). Never "I".
- **Casing.** Sentence case for headlines and body — *"Numbers you can nearly trust."* UPPERCASE only for micro-type: eyebrows (`THE CATALOGUE`), mono labels (`FIG. 03`, `TABLE 1 — SEGMENT SPLITS`), button labels, tab labels, badges.
- **Punctuation.** Real symbols, always: `≈`, `±`, `°`, `³`, `ρ`, `θ`, `—`. Serial commas. Full stops in headlines are allowed and used.
- **The tilde is a promise.** Any number we modelled rather than measured is written `≈268 W`, and is followed by its error somewhere nearby (`±11 W`, `±4%`). This is a hard rule, not a flourish.
- **Numbers are named honestly.** "Est. FTP", "Estimated power", "Median error", "Assumptions: 17". Never "Score", never "Fitness: 84" with no interval.
- **Humour is dry and structural, never zany.** It lives in titles and captions: *"Four hours of guessing"*, *"The Wall, 12%"*, *"Subscribed ≈ probably"*, *"Nothing here is medical, legal or particularly rigorous advice."* The joke is always the gap between rigour and reality — never a pun on the product.
- **Length.** Headlines ≤ 8 words. Lede paragraphs ≤ 2 sentences. Captions one line. Buttons 1–3 words.
- **Emoji: never.** Not in UI, not in copy, not in marketing. The only glyph decoration is mathematical (`≈`, `±`, `Ø`, `ε`).
- **Disclaimers are features.** Where a competitor would hide the uncertainty, we typeset it: `n = 1 rider · ±4%` in a card footer, `ρ assumed 1.225 kg/m³` under an equation.

Vocabulary we use: estimate, model, assume, residual, interval, approximately, allegedly, notional, method, appendix, retraction.
Vocabulary we avoid: unlock, supercharge, effortless, AI-powered, insights, journey, game-changing, revolutionary.

## Visual foundations

**The organising idea: the suggestion of geometry.** A page should feel plotted — aligned to an implied grid, annotated, measured — even when almost no lines are drawn. Achieved with alignment, hairlines used sparingly, mono micro-labels, and figure numbering; not with heavy borders everywhere.

**Colour.** Warm paper (`--paper-000…300`, never `#fff`) against cool near-black ink (`--ink-900 #101418`, never `#000`). One primary, cyanotype blueprint blue (`--blueprint-600 #1E4478`), for structure and action. One maximum-contrast accent, signal (`--signal-500`), which resolves to ink on paper and to paper inside `.as-blueprint` — reserved for *measurement, effort and now* — live values, estimated figures, record buttons — and capped at roughly 5% of any screen. Data series use **viridis** sampled at six stops (`--plot-1…6`, `#440154 → #FDE725`) plus a continuous `--plot-scale` ramp — perceptually uniform and colour-blind safe. **Stops 5 and 6 are fill-only or dark-background-only:** at 1.5px on paper `#7AD151` and `#FDE725` are illegible, so line series use the darkened substitutes `--plot-5-line #4E9B2E` and `--plot-6-line #8F8410` (Sparkplot substitutes them automatically for `tone="plot5"/"plot6"`). **Exception, stated explicitly:** signal is used for a plot only when that plot shows one live or estimated quantity (the app's live ride trace, a single-metric ride chart). Anything comparative or categorical — a catalogue of apps, a list of rides, residual plots — uses viridis in `--plot-1…6` order. Status colours are muted and print-derived, not neon. `.as-blueprint` is a full theme scope that inverts everything for dark chrome (recording screens, one marketing band).

**Type.** Three families, strict roles. Display: **Newsreader** serif at 300–400 weight, `-0.02em`, for titles and any long-form prose (`--type-body-serif`) — plus italic for subtitles, exactly like a paper's subtitle line. Body/UI: **Archivo** grotesque, 400–600. Data: **Geist Mono** — *every* number, unit, mono label, caption, table cell and annotation. Eyebrows and uppercase micro-type in sans use **Ojuju** (`--font-eyebrow`), which also covers sans numerals. Micro-type carries heavy tracking (`0.14em` labels, `0.24em` eyebrows) and is 10–11.5px. Numerals are tabular everywhere. Type is the main hierarchy device; size jumps are large (15px body → 34px title → 76px hero figure).

**Spacing & layout.** A drafting-derived scale (3, 5, 8, 11, 15, 20, 27, 36, 48, 64, 84, 112) rather than a 4/8 grid — it reads as millimetric, not digital. 12-column implied grid, `--grid-margin 36px`, `--grid-gutter 20px`. Text measure capped at 64ch (46–58ch in practice). Fixed chrome: 56px sticky web header (translucent `--veil` + 6px blur), 64px app tab bar, 44px minimum touch target. Sections begin with a numbered head over a **2px ink rule** — that rule is the strongest horizontal element in the system.

**Backgrounds.** No photography in the system as shipped (none was supplied — see caveats). No gradients, ever, as decoration. Instead: flat paper tints, and three drafting substrates from `--pattern-graph` / `--pattern-dot` / `--pattern-hatch` (grid lines use `--pattern-line #D5E4F6`, a light blueprint one step lighter than `--rule-hair`; set `background-size: var(--pattern-tile)` alongside). **Graph paper is for graphs only** — it appears inside `FigureFrame` and chart containers, never behind a page, section, card or hero. Everything else is flat paper. Alternate `--paper-100` and `--paper-000` between sections; at most two background colours per page plus one inverted blueprint band.

**Borders, cards & shadows.** Hairlines are **light blueprint** (`--rule-hair #CBDDF3`, `--rule-solid #9CBBDA`) — lines on paper, never grey — and the drafting grid uses the *same* value (`--pattern-line: var(--rule-hair)`), so a card border and a grid line are one system. On the dark scope the grid switches to mid blue (`--pattern-line #436EA0`). Cards are `--surface-card` with a **1px hairline**, **2px radius**, and `--shadow-print` (`1px 1px 0`) — a registration offset, not a blur. Elevated/modal surfaces get an ink hairline plus `--shadow-raise` (`2px 2px 0 var(--ink-900)`), like a pressed plate. Blurred shadow exists in exactly one token (`--shadow-overlay`) and is only for floating overlays. Radii are 0–3px; the only pill in the system is the radio dot. Never a coloured left border — callouts are marked by a 2px **top** rule and a mono kicker.

**Motion.** Mechanical and plotted: `--ease-plot cubic-bezier(.2,.6,.2,1)`, no spring, no overshoot, no bounce. 120ms for hover, 200ms for state changes, 900ms for data reveals (meters and plots sweep left to right, like a pen plotter). Nothing scales on press.

**Interaction states.** Hover: a step *darker* for filled controls (`blueprint-600 → 700`), a step of paper tint for quiet ones (`paper-000 → 100`) — never opacity fades, never lighten-on-hover. Press: `translate(1px, 1px)`, no scale. Focus: 1.5px signal outline at 2px offset, plus an inset hairline on fields. Selected: inversion (ink fill, paper text) rather than a tint — see `Tag`, `SegmentedControl`. Disabled: 38% opacity, no colour change.

**Transparency & blur.** Two uses only: the sticky web header (`--veil` + `--blur-sheet`) and the modal scrim (`--scrim` + blur). Data and cards are always opaque.

**Imagery direction (for when photography arrives).** Cool, flat, documentary — overcast light, minimal saturation, visible fine grain; road/landscape/equipment shot as evidence rather than lifestyle. Duotone in ink + blueprint is preferred over full colour. Never warm golden-hour hero shots, never motion-blurred heroics.

## Iconography

- **System: Lucide, loaded from CDN** (`https://unpkg.com/lucide-static@0.428.0/icons/<name>.svg`), used at 14–18px. **This is a substitution, flagged:** no icon set was supplied. Lucide's 1.5px stroke, square terminals and geometric construction are the closest available match to the technical-drawing brief. If you have a real icon set, swap it in and update this section.
- Icons are supporting, never decorative — chrome actions, tab bars, toolbars. A screen with more than ~6 icons is probably wrong; the system prefers a mono text label to a picture.
- **Unicode glyphs are first-class iconography here** and are used in preference to drawn icons: `≈` (approximation, the brand mark itself), `±` (error), `Ø` (null / no data), `ε` (residual), `▾` (select caret), `×` (dismiss). Set them in `--font-mono`.
- **Emoji are never used.**
- Logo assets in `assets/`: `logo.svg` (blueprint tile, app-icon ready), `logo-mark.svg` (≈ in `currentColor`), `logo-mark-congruent.svg` (`≅`, for triple-approximation contexts), `wordmark.svg` — the single wordmark lockup (mark + `APPROX.` eyebrow over `Scientific`, Newsreader 500, eyebrow tracked `0.16em` / `--tracking-lockup`), `wordmark-mono.svg` (**preferred**: small mark left of the eyebrow, `Scientific.` beneath in Geist Mono 500), `wordmark-mono-nomark.svg` (type only), `wordmark-stacked.svg` (same layout in Newsreader 500). Both carry the full stop and are `currentColor`, so dark surfaces just set the colour. **The stacked lockup is the app-side default** (app icon, app chrome — see the Log screen header); the horizontal lockup stays the web default. **Chosen lockup: `wordmark-stacked.svg`** — the geometric ≈ mark at eyebrow cap height, left of `APPROX.`, with `APPROX.` in **Ojuju 600** and `Scientific.` in **Newsreader 500** beneath (`--tracking-lockup 0.16em`). The mark is drawn to match Geist Mono's ≈ (shallow waves, flat terminals) so it stays consistent with all data type; all four mark files (`logo.svg`, `logo-mark.svg`, `logo-mark-congruent.svg`, and the mark inside every wordmark) use this one construction; it is two stroked waves — **Wave field** (`logo-tile.svg` white-on-blue, `logo-tile-light.svg` black-on-white): a seamlessly tileable six-row wave texture (64px tile, 21.3px period at the mark's own wave geometry, transparent ground so the surface colour shows through; the top and bottom rows straddle the frame so the field always reads as clipped). It is the *secondary* mark — avatars, favicons, splash and loading states — never the primary app icon. Loading motion: rows **trace on once** left to right, staggered ~90ms apart, then hand over to the rising loop (`background-position` scrolls up one tile, seamless). Motion means "computing"; it stops when the result lands. Only ever white on blueprint or black on paper — the field is never multi-coloured.
- No product illustrations exist yet; charts and plates (`Sparkplot`, `FigureFrame`) do the work illustration usually would.

## Font substitutions — please confirm

No font binaries were provided, so the fonts below are loaded from Google Fonts (Geist Mono and Ojuju were specified by you; Newsreader and Archivo remain proposals) and loaded via `@import` in `tokens/fonts.css`:

| Role | Substitute | Why |
| --- | --- | --- |
| Display serif | **Newsreader** | Journal-like, variable optical size, real italic |
| Body sans | **Archivo** | Grotesque with drafting-label character; avoids Inter |
| Mono / numerals | **Geist Mono** | Requested. Tight, technical, excellent tabular figures |
| Eyebrows + sans numerals | **Ojuju** | Requested. Variable display sans; gives uppercase micro-type its own voice |

Because the fonts arrive through a Google Fonts stylesheet rather than local files, the compiler reports **0 `@font-face` rules**. If you send real font files (or want self-hosted webfonts), drop them in `assets/fonts/` and I will write proper `@font-face` rules.

## Caveats

- No photography or illustration assets exist in the system; imagery direction above is written but unproven.
- Product names in the UI kits ("Watt, Approximately", "Gradient Anxiety", …) are placeholders written to demonstrate voice — replace with the real catalogue.
- No slide template was supplied, so no deck cards were created.
