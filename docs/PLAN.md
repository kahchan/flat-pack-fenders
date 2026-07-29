# Flat-pack fenders — implementation plan

Port `Fender Pattern.dc.html` (claude.ai/design project `0ec66220`) to a React + Vite + TypeScript
app in `github.com/kahchan/flat-pack-fenders`, plus shareable URLs, localStorage, a preset gallery,
and a full responsive redesign.

---

## 1. What the design already contains

The design file is **not a mockup — it is a working app**, ~1160 lines. It ships:

| Area     | What's in it                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geometry | Developed length `L = R·θ`, bend allowance (k-factor 0.44, `r=t`), dart take-up `L·drop/R`, local taper past a knee, hem allowance                   |
| Pattern  | Blank outline w/ V-darts, fold + score lines, hole/slot patterns for 4 join types, A4 panel seams w/ 20 mm laps, frame-mount slots, dimension labels |
| Parts    | Struts (pill outlines, fold marks, optional sacrificial hole), mudflap, butt straps / clips                                                          |
| Views    | Isometric preview (64-segment facet shading, rotatable ±80°), cross-section w/ dimensions, print tiles                                               |
| Export   | SVG (1 unit = 1 mm, Inkscape layers CUT/FOLD/HOLES) and DXF (LWPOLYLINE + CIRCLE)                                                                    |
| Print    | A4 landscape tiling, 15 mm safe margin, 12 mm tile overlap, 100 mm scale ruler per sheet                                                             |
| Copy     | 7 conditional warnings, 16 engineering notes, 8–10 assembly steps, 11-row spec table                                                                 |

23 parameters across 6 groups. **The port is a translation job, not a design job** — the risk is
numerical fidelity, not invention.

## 2. Decisions locked

- **Scope:** 1:1 port + shareable config URL + localStorage + preset gallery
- **Responsive:** full redesign (design file is fixed 1440×900, `100vh`, `overflow:hidden`)
- **Language:** TypeScript, `strict: true`
- **Deploy:** GitHub Pages via `gh-pages`, `base: '/flat-pack-fenders/'` _(assumed — repo exists, CC0, static app)_
- **Theme:** light only for v1, matching the design's pinned `data-theme="light"`. Drawing colours go
  in a separate `--draw-*` token set so dark mode is a later drop-in, not a rewrite.
- **Tests:** `vitest` as a dev dependency, geometry modules only, asserting §7 — approved
- **Default config:** replaced with a clean one, old default becomes a preset — see §9.5
- **DXF:** minimal `HEADER` + `TABLES` added, geometry untouched — see §9.3
- **Fonts:** self-hosted, no CDN — see §9.6
- **Nesting:** screen, print and export all cover the nested pair — see §9.4
- **Export formats:** SVG + DXF (already in the design) + **PDF, hand-written, zero dependencies** — see §11

## 3. File layout

```
flat-pack-fenders/
  index.html
  vite.config.ts                 base: '/flat-pack-fenders/'
  tsconfig.json                  strict
  package.json
  public/fonts/                  self-hosted woff2 (see §9.6)
  src/
    main.tsx
    App.tsx
    styles/
      tokens.css                 vendored kah DS tokens (colors/type/space/shadow/motion/grid)
      draw.css                   --draw-* palette for the technical drawings
      global.css                 reset, range inputs, print rules
    fender/
      types.ts        ← CONTRACT. FenderConfig, Geometry, DrawingModel, part types
      defaults.ts     ← CONTRACT. DEFAULTS, WHEELS, PARAM_SPECS, TONGUE_L/W, OVERLAP, PW/PH/OV
      geometry.ts                geo(), crownAt()
      pattern.ts                 blank outline, folds, scores, holes, slots, seams, laps, labels
      parts.ts                   struts, mudflap, straps/clips
      isometric.ts               3D projection, facets, rails, wheel, struts, mudflap
      crossSection.ts
      tiling.ts                  print tiles + tileRects
      warnings.ts
      notes.ts                   engineering notes + assembly steps
      specs.ts                   spec table rows
      index.ts                   buildModel(config): DrawingModel  ← single entry point
    export/
      pathPolys.ts               SVG path → polylines (DOM-dependent, see §9.2)
      svg.ts                     buildSvg(model): string
      dxf.ts                     buildDxf(model): string
    state/
      urlCodec.ts                encode/decode config ↔ location.hash
      presets.ts
      useFenderConfig.ts         reducer + localStorage + URL sync
    components/
      ui/Button.tsx              ported from _ds_bundle.js
      ...
```

**Hard rule:** everything under `src/fender/` is pure — no React, no DOM, no `React.createElement`.
`buildModel()` returns plain data. Labels are data (`{x, y, size, fill, anchor, text}`), rendered as
JSX by components. This is the single biggest departure from the source, and it's what makes the
export path and the preset thumbnails work.

## 4. Responsive spec

Three layouts. Print output is byte-identical at every breakpoint.

**≥ 1100px — desk.** Exactly the design. Canvas left (scrolls), 392px control rail right, both
`100vh`. No changes.

**760–1099px — tablet.** Canvas full width. Control rail becomes an overlay drawer from the right
(392px, `transform: translateX`, `--dur-slide` 600ms `--ease-out`), scrim `--color-overlay`.
Triggered by a floating pill bottom-right showing the live spec line. Assembled preview sticky at
the top of the canvas.

**< 760px — phone.** Single column.

- Assembled isometric pinned as a sticky header card, ~38vh, rotate slider beneath it.
- Controls in a **bottom sheet with three snap points**: peek 96px (drag handle + current spec
  line + preset strip), half 55vh, full 92vh. Drag to move between snaps, momentum-aware,
  interruptible mid-flight, velocity decides the target snap. Respect `prefers-reduced-motion`
  (snap instantly, no spring).
- Tabs (Construction sheets / Assembly) become a segmented control.
- Every wide SVG sits in an `overflow-x: auto` container with a right-edge fade mask; Sheet A keeps
  its `min-width: 720px`.

> The coder agent on the sheet **must load the `apple-design` skill first** — snap physics,
> interruptibility and reduced-motion handling are exactly what it covers, and hand-rolled drag
> sheets are where this kind of port usually falls apart.

## 5. Presets

Six, each a `Partial<FenderConfig>` merged over `DEFAULTS`:

| Preset              | Key params                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rear commuter 700c  | rear, 700c, tyre 35, clear 14, crown 55, skirt 26, 55/200°, flaps 20, 2 struts, flap 120, a4                                                                      |
| Front commuter 700c | front, 700c, tyre 35, crown 55, 120/140°, flaps 20, 2 struts, flap 60                                                                                             |
| Gravel 650b         | rear, 650b, tyre 50, clear 18, crown 72, skirt 32, flaps 22, hem on                                                                                               |
| MTB 26″             | rear, 26in, tyre 55, clear 20, crown 78, flaps 18                                                                                                                 |
| Cargo / folder 20″  | **the design file's original defaults** — rear, 20in, tyre 50, clear 16, crown 62, skirt 30, 60/200°, taper 25, flaps 16, 3 struts, strutLen 220, flap 90, single |
| Hole-free minimal   | join `none`, 1 strut, tongue on, mudflap 0                                                                                                                        |

The **new app default is "Rear commuter 700c"** (§9.5), not the 20″ config — and the preset of
that name is **deliberately identical to it**, so clicking it returns you to the fresh-load state.

_Corrected during WP6._ This table originally gave that preset 55°/200°, which is 255° of coverage —
it would have tripped the very warning §9.5 picked the default to avoid, and a preset that silently
differs from the state sharing its name is a trap. Notation in this table: `X/Y°` is `lead`/`trail`;
singular "flap N" is `mudflap`, plural "flaps N" is the flap count.

Only Cargo 20″ is pinned to a golden value (it must equal the design's original defaults, asserted
against the `cargo-20in-single` fixture case). The other four presets' exact numbers are a reading
of this table, not a verified reference — adjust them freely if they ride badly.

**Placement:** horizontal scroll strip at the top of the control rail (desktop) / in the sheet's peek
state (phone), so a phone user lands on presets first. Each card ~108×92: a **live mini
cross-section** rendered from `crossSection.ts` at that preset's config — no image assets — plus name
and a mono spec line. Selected state reuses the existing coral treatment (`#FAE4DE` fill,
`#D4614E` border) already used by join/stock options.

## 6. URL codec

Fixed field order, `.`-separated, version-prefixed. `thick` travels as tenths so no value contains
a `.`:

```
     side wheel tyre mR clear crown skirt angle thick(×10) lead trail taper
     taperAt flaps struts strutLen mudflap join stock tongue fuse nest hem

#f1.rear.20in.50.0.16.62.30.55.8.60.200.25.70.16.3.220.90.zip.single    ← Cargo 20″ preset
#f1                                                                     ← DEFAULTS
```

Note the second case: when every field is default the hash collapses to the bare version tag, and
the hook clears the hash entirely rather than writing `#f1`. The worked example above encodes the
**Cargo 20″** values, not `DEFAULTS` — they were the default when §6 was written.

- Trailing values equal to defaults are dropped; the decoder backfills from `DEFAULTS`.
- **Decode is untrusted input.** Clamp every numeric to its `PARAM_SPECS` `[min,max]`; fall back to
  the default on any unknown enum or unparseable field. Never let a hash produce `NaN` geometry.
- Precedence on load: **URL hash > localStorage > DEFAULTS**.
- Writes are debounced (~250ms) via `history.replaceState` — never `pushState`, or the back button
  becomes a slider undo.
- `Reset` clears both the hash and localStorage.

## 7. Golden values — the verification contract

Extracted by running the design's own `geo()` in Node. **A port that reproduces these is correct;
one that doesn't is wrong, regardless of whether it builds.**

### NEW default (rear · 700c · tyre 35 · clear 14 · crown 55 · skirt 26 @ 55° · t 0.8 · 40/175° · 20 flaps · a4)

```
R          = 360.0000      L         = 1350.8848     Wd       = 105.8801
yc         =  52.9400      proj      =   14.9130     drop     =   21.2980
skirt(flat)=  25.4400      crownTail =   46.7500     knee     =  945.6194
pitch      =  67.5442      removal   =   79.9197     notch    =    4.7960
setback    =   0.8329      BA        =    1.1058     bendComp =   -0.5600
tyreR      = 346.0000      finished  =   84.8260     tiles    = 6×1 (8 sheets)
outline vertices = 124      holes = 183      slots = 3      cov = 215°
panelCount = 6 (stock a4)
```

Blank outline head/tail (must match character-for-character):

```
M 0.0,0.0 L 65.1,0.0 L 67.5,25.4 L 69.9,0.0 L 132.7,0.0 L 135.1,25.4 L 137.5,0.0 L 200.2,0.0 …
… L 69.9,105.9 L 67.5,80.4 L 65.1,105.9 L 0.0,105.9 L 0,64.9 L -34,64.9 L -34,40.9 L 0,40.9 Z
foldT: M 0.0,25.4 L 945.6,25.4 L 1350.9,29.6
foldB: M 0.0,80.4 L 945.6,80.4 L 1350.9,76.3
```

### "Cargo / folder 20″" preset — the design file's original default

```
R          = 269.0000      L         = 1220.6833     Wd       = 120.8801
yc         =  60.4400      proj      =   17.2073     drop     =   24.5746
skirt(flat)=  29.4400      crownTail =   46.5000     knee     =  854.4783
pitch      =  76.2927      removal   =  111.5158     notch    =    7.7697
setback    =   0.8329      BA        =    1.1058     bendComp =   -0.5600
tyreR      = 253.0000      finished  =   96.4146     tiles    = 5×1 (7 sheets)
outline vertices = 100      holes = 135      slots = 3
M 0.0,0.0 L 72.4,0.0 L 76.3,29.4 L 80.2,0.0 L 148.7,0.0 L 152.6,29.4 L 156.5,0.0 L 225.0,0.0 …
… L 80.2,120.9 L 76.3,91.4 L 72.4,120.9 L 0.0,120.9 L 0,72.4 L -34,72.4 L -34,48.4 L 0,48.4 Z
foldT: M 0.0,29.4 L 854.5,29.4 L 1220.7,37.2
foldB: M 0.0,91.4 L 854.5,91.4 L 1220.7,83.7
```

### Four more cases (same field order as above)

```
front 700c commuter      R=360.0000 L=1633.6282 Wd=105.8801 notch=5.6324  knee=1143.5397
                         crownTail=41.2500 finished=84.8260 vertices=124 tiles=7×1 holes=163 slots=2

rear 650b gravel·hem·a4  R=360.0000 L=1633.6282 Wd=147.1201 notch=6.6068  hem=6.4000
                         skirt(flat)=37.5600 bendComp=-0.8400 finished=108.7089 vertices=136
                         holes=213 slots=3 panels=7

measured R · no taper    R=266.0000 L=1207.0697 crownTail=62.0000 knee=844.9488
                         join=none → holes=15 slots=2  vertices=96
                         foldT: M 0.0,29.4 L 844.9,29.4 L 1207.1,29.4   (flat — no taper)

26in · slot · t=2.0      R=350.5000 L=1590.5185 Wd=135.2001 notch=11.2930 pitch=132.5432
                         setback=2.0823 BA=2.7646 bendComp=-1.3999 vertices=76 slots=47
```

Note `bendComp` is **negative** — the bend allowance _shortens_ the flat pattern
(`skirtFlat = skirt + bendComp`). Getting this sign wrong is the single easiest way to produce a
plausible-looking but wrong pattern.

The reference script lives at `scratchpad/golden.mjs` and can regenerate all of this.

**Verification: `vitest`, geometry modules only.** Port `golden.mjs` into `src/fender/__tests__/`
as a fixture table — six configs × ~17 derived values, plus exact string equality on `blankOutline`
and both fold paths. That's ~120 assertions and it is the entire safety net for the numerical work.
`npm test` joins `npm run build` as a gate. No UI tests, no snapshot tests, no test infrastructure
beyond vitest itself.

## 8. Work packages

`WP0` is a hard gate. `WP1`–`WP6` then run **in parallel** — they share only `types.ts` + `defaults.ts`.

| WP          | Scope                                                                                                                  | Depends on    | Notes                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| ✅ **WP0**  | Scaffold (Vite/TS strict/vitest/gh-pages), self-hosted fonts, vendored tokens, `types.ts`, `defaults.ts`, `Button.tsx` | —             | **Blocks everything. Freeze the contract before fanning out.**    |
| ✅ **WP1**  | `geometry.ts`, `pattern.ts` + the §7 fixture tests                                                                     | WP0           | Largest + highest risk. Must hit §7 exactly.                      |
| ✅ **WP2**  | `parts.ts`, `crossSection.ts`, `tiling.ts`                                                                             | WP0           | Tiling must cover the nested pair (§9.4)                          |
| ✅ **WP3**  | `isometric.ts`                                                                                                         | WP0           | Self-contained; verify visually against the design                |
| ✅ **WP4**  | `warnings.ts`, `notes.ts`, `specs.ts`                                                                                  | WP0           | Mostly copy — transcribe prose verbatim, keep the em-dashes       |
| ✅ **WP5**  | `pathPolys.ts`, `svg.ts`, `dxf.ts`                                                                                     | WP1, WP2      | Diff exported SVG against the design's own export                 |
| ✅ **WP6**  | `urlCodec.ts`, `presets.ts`, `useFenderConfig.ts`                                                                      | WP0           | §5, §6                                                            |
| ✅ **WP7**  | Desktop UI shell — canvas, control rail, tabs, warnings banner, spec table                                             | WP0           | Can stub `buildModel()` from a fixture                            |
| **WP8**     | Responsive layer — drawer, bottom sheet, scroll containers                                                             | WP7           | **Load `apple-design` skill first**                               |
| ✅ **WP9**  | Print stylesheet + `.print-only` DOM                                                                                   | WP1, WP2, WP7 | Verify by actually printing to PDF and measuring the 100 mm ruler |
| ✅ **WP10** | Preset strip UI + mini cross-section thumbs                                                                            | WP2, WP6, WP7 |                                                                   |
| **WP11**    | `export/pdf.ts` — hand-written vector PDF writer                                                                       | WP1, WP2, WP5 | §11. Zero deps. Verify by measuring the ruler in the output.      |

Each agent gets: the golden values for its slice, the relevant source line range from
`scratchpad/fender.html`, and the frozen `types.ts`.

## 9. Issues found in the design source

Real things a coder will hit. **None of these should be silently "fixed" — they're the designed
behaviour until you say otherwise.**

**9.1 — `renderVals()` mixes geometry with React.** It returns `blankLabelsEl`, `xsecLabelsEl`,
`partsLabelsEl` and `t.rulerEl` built with `React.createElement`, and `exportSvg`/`exportDxf` call
`renderVals()` to get their geometry. The port must split these. _Resolved by the §3 architecture —
noting it so nobody copies the shape._

**9.2 — `pathPolys()` needs the DOM.** It uses `getTotalLength`/`getPointAtLength` for arcs and
quadratics. Only `partsOutlines` contains curves (strut pill `a` arcs, mudflap `q` corners) — the
blank is pure `M`/`L`, so **blank DXF geometry is exact** and only parts are sampled (0.4 mm step).
Keep it, isolate it in `export/pathPolys.ts`, and note it can't run server-side or in a worker.

**9.3 — The DXF is not valid R12. → RESOLVED: add the header.** The engineering note claims
"R12 ASCII", but `LWPOLYLINE` is R14+ and the file emits only an `ENTITIES` section — no `HEADER`,
`TABLES` or `BLOCKS`. LibreCAD, Inkscape and LightBurn will open it; stricter R12 readers won't.
**Do:** emit a minimal `HEADER` with `$ACADVER` = `AC1015`, and a `TABLES` section with a `LAYER`
table declaring CUT / FOLD / HOLES (colours 7 / 5 / 1). **Entity geometry stays byte-identical** —
same `LWPOLYLINE` and `CIRCLE` output, same coordinate rounding, same Y-flip.

⚠️ **The "R12 ASCII" wording is prose, and it lives in `src/fender/notes.ts`, not
`export/dxf.ts`.** _(Caught by WP4.)_ This plan previously implied the fix belonged with the
exporter. It does not — the sentence is the `formula` line of the "Export" engineering note, which
WP4 owns. WP4 deliberately left it verbatim with an inline comment at `notes.ts:244`. **Whoever does
WP5 must edit `notes.ts` to change it to "DXF AC1015 (R2000)"** and update the fixture's expected
string accordingly. Easy to miss entirely, which is why it is called out twice.

**9.4 — Nesting was screen-only. → RESOLVED across all three surfaces (tiling WP2, print + exports WP9).** The on-screen viewBox
used `bboxH = Wd·2 + 10` while the print tile grid computed `rows` from `Wd` alone, so the nested
ghost never reached the printed sheets or the exports. **Do:**

- `tiling.ts`: compute `rows` from `bboxH`, not `g.Wd`. Verified effect — default: 1 row → 2 rows,
  8 sheets → 14; cargo 20″ preset: 7 sheets → 12. That doubling is correct, you're printing two.
- Print tiles and the SVG/DXF exports must both emit the **second instance as real geometry**
  (`translate(L, Wd·2+10) rotate(180)` applied to outline, folds, scores, holes, slots), on the same
  CUT/FOLD/HOLES layers — not as a dashed ghost. Nesting means cutting two.
- Keep the dashed ghost styling **on screen only**, so the canvas still reads as "primary + pair".
- Sheet-count labels, the `specs` "Sheets to print" row and assembly step 02 all derive from the
  same `rows × cols` — check all three update.
- _Minor:_ the note says "cut the shared edge once", but the transform leaves a 10 mm gap — the two
  blanks don't actually share an edge. Reword the note to match the geometry.

**9.5 — The default tripped five warnings on first load. → RESOLVED: new default.** Verified: 260°
coverage > 220°; `measuredR = 0`; `crownTail` 46.5 < `tyre + 6` = 56; a single blank needing 1221 mm
of stock; and Sheet B at 316 mm > 267 mm of A4. All five correct — but a wall of red on arrival.

**New default — "Rear commuter 700c":**

```
side rear · wheel 700c · tyre 35 · measuredR 0 · clear 14 · crown 55 · skirt 26 · angle 55
thick 0.8 · lead 40 · trail 175 · taper 15 · taperAt 70 · flaps 20 · struts 2 · strutLen 160
mudflap 100 · join zip · stock a4 · tongue on · fuse off · nest off · hem off
```

Verified: **5 warnings → 1.** The survivor is "tyre radius is estimated at 346 mm — measure the real
thing", which is exactly the warning that _should_ fire on a fresh load. It's a prompt to act, not a
complaint. Golden values in §7. The old values ship as the **"Cargo / folder 20″"** preset, so
nothing is lost.

**9.6 — Fonts loaded from the Google Fonts CDN. → RESOLVED: self-host.** Per CLAUDE.md's
no-external-runtime-dependencies rule. **Do:** vendor `HankenGrotesk[wght].woff2` and
`JetBrainsMono[wght].woff2` (both OFL) into `public/fonts/`, replace the two `@import`s in
`tokens/fonts.css` with `@font-face` blocks using `font-display: swap` and the full
`font-weight: 100 900` / `400 700` variable ranges, and `<link rel="preload">` both in `index.html`.
Ship the OFL licence text alongside them. Removes a render-blocking third-party round trip.

**9.7 — `reset` doesn't reset everything.** `setState({...DEFAULTS})` leaves `spin`, `tab` and
`warnDismissed` untouched. Probably intended. The port should make that explicit rather than
inheriting it by accident.

**9.8 — Warning dismissal is keyed on joined warning text**, so changing any parameter that alters
the text re-surfaces the banner. That's good behaviour, not a bug — keep it deliberately.
_(Ported with stable `Warning.id`s so dismissal keys on identity instead of prose.)_

**9.9 — The zero-thickness engineering note is wrong.** _(Found by the WP1 tests.)_ The note says
"at zero thickness every term collapses to zero and the pattern is the ideal one". It doesn't:
`rBend = max(t, 0.2)` keeps a 0.2 mm bend radius alive even at `t = 0`, leaving
`bendComp = a·0.2 − 2·(0.2·tan(a/2)) ≈ −0.016 mm` per fold. That's 16 microns — unmeasurable in any
material this app cuts, and the `notch` term _does_ collapse correctly. **Kept the source's
behaviour** rather than changing geometry to match prose. **Fix the note's wording in WP4**, not the
maths. The test documents the real behaviour and pins the bound at 0.02 mm.

**9.10 — Golden hole counts must include the panel-seam rows.** _(Found while building the WP1
fixture.)_ Each A4 seam adds `max(3, floor(Wd/30)) + 1` fasteners through the lap. An extraction that
stops at darts + struts + mudflap undercounts badly: the default reads 163 instead of **183**, and
the 650b gravel case 183 instead of **213**. §7 is corrected. The committed fixture
`src/fender/__tests__/golden.json` is generated by a verbatim transcription of the original
`renderVals()`, so it cannot drift from the design by refactor.

**9.11 — `partsSlots` on Sheet B is dead code.** _(Found by WP2.)_ The source declares
`partsSlots`, returns it, and renders it in two `<sc-for>` blocks (screen and print) — but nothing
ever pushes into it. It is always `[]`. Ported faithfully: `PartsModel.slots` exists and is always
empty, asserted by a test so it stays that way honestly rather than by accident. **Downstream work
packages (WP5 exports, WP7 UI, WP9 print) should not go hunting for the bug — there isn't one, the
array is simply never filled.** Open question for later: the slot-and-tab join produces folded clips
on Sheet B that arguably _should_ carry slots, so this may be an unfinished feature rather than
merely vestigial. Not blocking.

**9.12 — The cross-section labels the skirt with the wrong number.** _(Found by WP2, verified
against source line 971 vs 965.)_ The cross-section _draws_ the skirt from `g.proj` / `g.drop`,
which derive from `s.skirt` — the true folded length. It _labels_ it `SKIRT ${f0(g.skirt)}`, where
`g.skirt` is `skirtFlat`, the bend-compensated **flat-pattern** dimension. On the default config the
drawing shows a 26 mm skirt annotated "SKIRT 25".

The label contradicts the line it points at. A cross-section is a picture of the finished object, so
26 is the correct number there; 25.44 is a flat-pattern dimension that belongs on Sheet A. This is
not cosmetic — someone checking their folded part against the drawing will measure a real
discrepancy and distrust the pattern.

**RESOLVED — labels the finished dimension.** `crossSection.ts` now reads `skirtTrue`. Position,
styling and every other label are untouched; only the number changed. The `skirt < 12` warning still
reads the flat value, which is correct — that one is about material around the fastener holes, a
flat-pattern concern. Worst case found in the fixtures was the hemmed 650b: drawn 32 mm, labelled
38 mm.

**9.13 — The isometric bounding box ignores fasteners.** _(Found by WP3.)_ Facets, rails, caps,
wheel, struts and mudflap all feed the `ext` accumulator via `note()`; the dart seam / hole / slot
loop (source lines 890–917) never calls it. Harmless in practice — those points always sit inside
the rail-0-to-rail-3 span and the angular arc the facet mesh already covers — so nothing is clipped
today. Ported faithfully. Flagged only because it reads like a bug and someone will eventually
"fix" it: there is nothing to fix unless the fastener layout changes.

**9.14 — Plan arithmetic slips, corrected.** Two counts in §1 were wrong and were caught by the
packages that implemented them: the design has **7** warnings (not 8) and **16** engineering notes
(not 15). Both verified directly against the source. Noted because §1 is the summary people will
skim, and a wrong count there quietly becomes a wrong test expectation downstream.

**9.15 — The DXF fixture records intended output, not original output.** _(WP5.)_ Everywhere else the
golden fixture captures exactly what the design source produced, and the tests assert our deliberate
divergences against it (`rowsSource`/`rowsFixed` in §9.4, the original prose in §9.9). The DXF
fixture is different: because §9.3's `HEADER`/`TABLES` addition is sanctioned, the extractor emits it
too, so `dxfBlankOnly` is what we _intend_, not what the design _did_.

That is fine — but know what it does and does not prove. The **entity** emission in
`scripts/extract-golden.mjs` is still a verbatim transcription (same `toFixed(3)`, same `-(y+off)`
Y-flip, same layer strings, same order), so entity geometry really is pinned against the source. The
header is new in both and pinned only against itself. If the header ever needs to change, the test
will not tell you whether you broke compatibility — check against a real CAD tool instead.

**9.16 — The Side selector's canned coverage trips the coverage warning.** _(Found by WP7.)_
Clicking Front/Rear jumps `lead`/`trail` to fixed values: the design hardcoded front → 120/140 and
rear → 60/200. **Both sum to 260°**, over the 220° threshold, so either button walls a fresh fender
in red — exactly the trap §5's preset correction already fixed once.

Rear is fixed: `src/lib/sideDefaults.ts` points it at `DEFAULTS.lead`/`DEFAULTS.trail` rather than
literals, so the selector and the default cannot drift apart again. **Front is not**, and is left at
120/140 deliberately: a front fender genuinely wants substantial lead, so unlike rear there is no
obviously-correct value to point it at. See §10.5.

**9.17 — A warning can quote a negative percentage.** _(Found by WP7.)_ The "tail narrower than
tyre" warning ends `keep the taper under ${f0((1 - (s.tyre+6)/g.crown0)*100)}%`. Once tyre width
exceeds crown width — reachable on the Tyre width slider — that expression goes negative and the
warning reads "keep the taper under -56%", which is not advice. Inherited verbatim and left in the
frozen `warnings.ts`. Cheap fix when someone wants it: clamp at 0 and change the wording to say the
crown must be widened, since at that point no taper value can help.

**9.18 — Sheet B printed at 78% of true size.** _(Found in WP9 review, by measuring.)_ The worst bug
in the port, and it was inherited from the design.

Sheet B's print SVG used the **content's** extent as its viewBox with
`preserveAspectRatio="xMinYMin meet"`. `meet` scales to fit, so any parts sheet taller than the
page was silently shrunk. The default config's parts sheet is 220 mm tall against 172 mm of live
page → **scale 0.78183**. Struts cut from it come out 22% short, on the one sheet whose entire
purpose is cutting parts to length.

It was invisible because the design's fit check compared **width only** (`width <= PW`, 256 ≤ 267)
and never height, so the app printed "fits A4 at full size" across the top of a sheet it was
shrinking by a fifth.

**Fixed three ways**, because fixing the check alone would not have stopped the scaling:

1. The print viewBox extent is now the **page** (`-2 0 267 172`), not the content, so 1 unit = 1 mm
   unconditionally. Overflow clips — visible — instead of scaling.
2. `fitsA4 = width <= PW && height <= PARTS_PH` (`PARTS_PH = 172`, added to `defaults.ts`).
3. The warning names whichever dimension overflows and gives matching advice. Telling someone to
   shorten their struts does nothing about a sheet that is too tall.

Verified by measurement: all 13 print pages now resolve to one scale, 1.00002, and the ruler
measures 283.462 pt against a theoretical 283.465 (99.999 mm).

**Known consequence: the default now raises two warnings, not one** — §9.5's clean-default property
is relaxed accordingly, and its test now asserts one warning _about the fender_ plus the Sheet B
one. This is not something to tune away. With 2 struts and a 100 mm mudflap Sheet B is 220 mm tall
and no reasonable default fits it (the ceiling is roughly a 52 mm mudflap, and a 52 mm mudflap is a
worse fender). **The real fix is to paginate Sheet B like Sheet A — see §10.6.**

## 10. Open questions

_(§9.3, §9.4, §9.5, §9.6 and the test approach are all resolved — see above. Two left, neither
blocking.)_

**10.1 — Dark mode. RESOLVED: light only.** The output of this app is paper. A dark canvas would
have to invert back to white for every print and export anyway, so the second palette would exist
only for the screen half of a tool whose point is the printed half. `--draw-*` stays structured for
a later drop-in if that ever changes.

**10.4 — `color-mix()` in Safari. LARGELY RESOLVED.** Verified on real WebKit — iPadOS 26 Simulator,
Safari, 1032px — where the facet ramp renders a correct smooth gradient with no fallback or black
fills. Not literally checked on **macOS** Safari, which is a different build. If you see flat or
black facets in the isometric on your Mac, this is the cause and §10.4's fallback below is the fix.

_Original note:_ The isometric facet ramp emits
`color-mix(in srgb, rgb(var(--draw-facet-lit)) N%, rgb(var(--draw-facet-dark)) M%)` as an SVG `fill`.
Confirmed rendering correctly in Chromium. `color-mix()` is Safari 16.2+ and SVG presentation
attributes accept CSS colour functions, so it should be fine, but it is **unverified on Safari/iOS**
and Kah is on macOS. If it fails there, the fallback is to have the component resolve the two tokens
once via `getComputedStyle` and pass literal `rgb()` down — which keeps `src/fender/` pure by doing
the DOM read in the UI layer, not the model. Check this during WP7.

**10.5 — The front Side preset also trips the coverage warning.** 120 + 140 = 260°, same as the old
rear pair (§9.16). A front fender does want substantial lead, so there is no obviously-correct
number to point it at the way rear could point at `DEFAULTS`. Needs someone who has ridden one.

**10.6 — Paginate Sheet B. RECOMMENDED NEXT.** Sheet B does not fit A4 for most realistic configs
(§9.18), so it currently clips and warns. Sheet A already solves exactly this problem by tiling, and
`TilingModel` is most of the machinery. Doing the same for Sheet B would remove a standing warning
from the default config and make the parts sheet usable at 1:1 for any strut length or mudflap. Not
huge, but it touches `tiling.ts` and the print tree, so it wants its own package rather than being
folded into WP8 or WP11.

**10.2 — Does the repo keep CC0?** It's CC0 now. Fine for patterns; unusual for code. Worth a
deliberate choice before the first real commit.

---

## 11. Export formats

Three exports, all at true 1:1, all from the same `DrawingModel`.

### 11.1 DXF — laser cutting _(already in the design; WP5)_

Not a new feature. `buildDxf()` emits `LWPOLYLINE` + `CIRCLE` at 1 unit = 1 mm on layers
CUT / FOLD / HOLES, so a laser can score folds at low power and cut outlines at full. §9.3 adds the
missing header. Blank geometry is exact (pure `M`/`L`); strut/mudflap curves are sampled at 0.4 mm.
**Nothing further needed for laser work.**

### 11.2 PDF — printing _(new; WP11)_

`window.print()` hands scale fidelity to the print driver. Browsers default to "fit to page", add
headers and footers, and apply their own margins — which is precisely why the design prints a 100 mm
ruler on every sheet. A pattern that comes out 3% small is scrap material.

**Write the PDF directly. No library.** PDF content streams use `m` / `l` / `c` / `re` / `S`
operators that map almost one-to-one onto the path data we already hold, and we already hand-write
DXF. Roughly 200 lines.

- **Page:** A4 landscape, `MediaBox [0 0 841.89 595.28]` pt.
- **Scale:** one `cm` transform of `2.834645669` (= 72/25.4) puts user space in millimetres, then
  every coordinate is emitted verbatim from the model. **The file is dimensionally exact by
  construction** — no fit-to-page, no driver scaling, no DPI guesswork.
- **Text:** the 14 standard PDF fonts need no embedding. Helvetica for labels and sheet headers —
  correct register for technical annotation, and it keeps the file dependency-free and ~40 KB.
  _(This is the one place the app doesn't use Hanken Grotesk; embedding a subset is a later option
  if it bothers you.)_
- **Content:** one page per tile, then Sheet B, then the assembly instructions — matching the
  existing `.print-only` sequence exactly. Same 15 mm safe margin, same 12 mm tile overlap, same
  100 mm ruler (kept as a cross-check even though the PDF is exact — printers still lie).
- **Layers:** PDF optional content groups (OCGs) for CUT / FOLD / HOLES, so the fold lines can be
  toggled off before printing. Cheap to add while we're writing the structure ourselves.
- **Colour:** pure black stroke, no fills, hairline `0.35` mm. Nothing that a greyscale printer or a
  cheap toner cartridge can misread as a cut line.

**Keep `window.print()` too.** It's the zero-friction path and some people just want paper. The
"Print pattern" button stays; "Export PDF" joins Export SVG / Export DXF.

**Verification:** open the exported PDF, measure the 100 mm ruler in a PDF reader at 100% zoom —
must read 100.0 mm. Then print one and measure it with a real ruler.

---

## Suggested execution order

1. Run **WP0** solo. Review and freeze `types.ts` + `defaults.ts`.
2. Fan out **WP1–WP7** across coder agents in parallel.
3. Integrate, verify against §7 (`npm test` + `npm run build`).
4. **WP8–WP11**.
5. Deploy to Pages, export a PDF, measure the ruler with a real ruler.
