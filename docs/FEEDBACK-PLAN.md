# Feedback round 1 — plan

Thirteen items from riding-the-app feedback, grouped into five packages. Everything here was
verified against the code first; where a claim turned out to be right, the diagnosis is recorded so
whoever implements it does not have to rediscover it.

`docs/PLAN.md` remains the port plan and its §9 findings list stays authoritative. New findings from
this round continue that numbering from §9.19.

---

## Assumptions taken

Four questions were asked and not answered, so the plan proceeds on the recommended option for each.
Each is cheap to reverse **before** the relevant package starts, and expensive after.

| #   | Assumption                                                                                                                                       | Reverse by                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| A1  | Your coverage numbers become the single source of truth: presets, app default, **and** the Front/Rear selector                                   | Saying which of the three should keep its current values |
| A2  | Strut length stays a free slider; the 3D view is fixed to draw the true length so an over-long strut visibly overshoots                          | Choosing derived-from-geometry instead                   |
| A3  | Em-dashes and `·` are stripped from **prose**; `·` stays where it delimits data (`700c · 622`, spec lines, drawing labels)                       | Saying "everywhere"                                      |
| A4  | "Combine pieces at small widths" means packing Sheet A tile rows onto fewer sheets, and letting Sheet B share the last Sheet A page when it fits | Naming a different combination                           |

A1 has a consequence worth stating: rear at 120/100 is **220°**, exactly the "coverage exceeds
frame" threshold. The warning fires at `> 220`, so it will not trigger — but it sits on the line. If
you consider 220° a normal rear fender rather than an edge case, the threshold should move up; say
so and it is a one-line change.

---

## WP13 — Geometry and domain correctness

### 13.1 Coverage numbers (A1)

Front **55 lead / 120 trail** (175°), rear **120 lead / 100 trail** (220°).

These currently live in three places that already drifted apart once (PLAN §9.16): `DEFAULTS`,
`PRESETS`, and `src/lib/sideDefaults.ts`. Collapse them to one exported constant that all three read,
so they cannot drift again. Update golden fixtures and the §9.5 single-warning assertion.

### 13.2 Warn when the tyre will not fit

No warning currently fires when tyre width exceeds what the fender can cover. Add one keyed on the
real constraint: the tyre must fit **inside the crown plus both skirt projections**, with clearance.

```
required = tyre + 2 × clearance
available = crown + 2 × proj        (proj = skirt × cos(angle))
```

Warn when `required > available`, naming both numbers and suggesting the crown width that would fix
it. Related but distinct from the existing `crownTail < tyre + 6` tail warning, which only checks the
tapered end — this one checks the whole fender.

Also fixes **§9.17**: the existing tail warning can print "keep the taper under -56%" once tyre
exceeds crown. Clamp at 0 and switch the advice to widening the crown, since no taper value helps.

### 13.3 Bevel at the tongue end of the skirt edges

The tongue is 24 mm wide and sits at crown width; the skirts start abruptly at `x = 0` at full
depth. That leaves a square corner at the nose that fouls the frame and is sharp against a shin.

Add a chamfer on both skirt free edges over the first `BEVEL_L` mm of the blank, running from the
tongue's edge out to full skirt depth. New constant, default 20 mm, exposed as a config field so it
can be zeroed. It changes `blankOutline`, so it needs new golden values rather than a fixture diff.

### 13.4 Struts stop growing at ~290 mm

**Confirmed.** `src/fender/isometric.ts:219` clamps the drawn strut to the distance to the hub:

```ts
const k = Math.min(s.strutLen, len) / len;
```

So past that distance the slider changes the number but not the picture. Per A2, drop the clamp and
draw the true length, letting an over-long strut overshoot visibly. Add a warning when
`strutLen` exceeds the mount distance by more than ~10%, since that is a strut you will have to cut.

---

## WP14 — Make the visualisations tell the truth ✅ DONE

**Confirmed: the wheel does shrink.** Both `crossSection.ts` and `isometric.ts` size their viewBox
from the _fender's_ extent:

```text
crossSection.ts   xw = finished + 130        viewBox width follows the fender
isometric.ts      isoViewBox = fit(ext)      ext is the accumulated content bounding box
```

So widening the crown grows the viewBox, and everything inside — including the wheel — renders
smaller. The gap appears to grow partly because the wheel is shrinking. Your read was right.

**Fix:** pin both views to an absolute millimetre scale so the wheel is a fixed size and the fender
grows and shrinks against it.

- Cross-section: viewBox from the **tyre and clearance envelope**, not `finished`. Widen only when
  the fender genuinely exceeds it, and never shrink below a floor, so small changes do not rescale.
- Isometric: same treatment against `tyreR`, which is already absolute.
- Both need a hysteresis floor or the view will still jitter on every slider drag. Round the
  envelope up to the next 10 mm.

One clarification worth recording: the cross-section's circle is the **tyre section** (diameter =
section width), not the wheel diameter. Changing 700c → 20″ correctly does nothing to it. Only tyre
width does. That is right, but it reads as a wheel and confuses people — label it `TYRE SECTION`.

### Outcome, measured

**The reported complaint is fixed.** Cross-section viewBox width holds at exactly **220.0 mm across
the whole clearance range (6→40 mm)** — only the height grows to admit the bigger gap, so increasing
clearance now opens a visible gap against a fixed wheel instead of shrinking the wheel. Switching
700c ↔ 20″ leaves the tyre circle and viewBox byte-identical. The label now reads `TYRE SECTION`.

**Residual, quantified:** dragging **crown** alone across its full 30→140 mm range still rescales, in
**12 discrete steps** (viewBox width 190 → 300 mm), shrinking the rendered tyre circle by about a
third at the extreme. That is inherent: the envelope floors on the tyre but must still widen once
`finished` genuinely exceeds it, or a 140 mm crown would be clipped.

Judged acceptable, on the grounds that clearance is the value you fiddle with while judging fit and
crown is one you set once and leave. Recorded rather than hidden, so nobody rediscovers it as a bug.
A fully fixed frame is possible but would have to be sized for the widest fender anyone might build,
which renders every ordinary config small in a sea of white space.

---

## WP15 — Print correctness ✅ DONE

### 15.1 The lap joint is arbitrary and can overflow the page

**Confirmed, and worse than "arbitrary".**

```text
OVERLAP    = 20                     defaults.ts, a magic number
panelCount = ceil(L / 250)          pattern.ts:200, another one
PW         = 267                    the actual A4 live width
```

Panels are cut to ~250 mm, then each is cut a further 20 mm past its seam for the lap — so a panel
plus its lap is 270 mm against 267 mm of printable width. **The lap can push a panel off the sheet.**
Neither 250 nor 20 derives from the paper.

**Fix:** derive both from the page.

```
usable   = PW − 2 × safety            (safety ≈ 4 mm, keeps the lap off the trim edge)
panelL   = usable − lap
panelCount = ceil(L / panelL)
```

with `lap` a named constant (keep 20 mm, but make it a _stated_ choice with the paper-fit constraint
enforced around it). Assert in a test that `panelL + lap ≤ PW` for every wheel, coverage and stock
combination — that is the invariant that is currently violated.

### 15.2 Label the lap joint on printed pieces

The lap lines are drawn on the print tiles but carry no annotation. On paper you cannot tell which
side laps over which, and PLAN's own engineering note says lap direction matters more than fastener
choice. Add a label at each lap: which panel goes **under**, and an arrow showing the direction water
runs across the joint.

### 15.3 Fewer sheets at small widths (A4)

Currently one tile row per page regardless of how little of the page it uses. Pack multiple tile rows
onto one A4 page when they fit, and let Sheet B share the final Sheet A page when there is room. The
2D packer built for Sheet B in WP12 (`src/fender/packer.ts`) already does this shape of work — reuse
it rather than writing a second one.

### 15.4 Instructions page in the app's design language

The instructions page is currently plain. Bring it onto the same system as the rest: Hanken Grotesk
and JetBrains Mono, the type scale from WP16, the same label treatment and rules. It is the page
someone reads while building, so it should look like it belongs to the thing they are building.

### Outcome, measured

- **Lap arithmetic now derives from the page.** `PANEL_L = PW − 2×PANEL_SAFETY − OVERLAP = 267 − 8 − 20 = 239`, so `panel + lap = 259 ≤ 267` **by construction**, not by luck. The invariant is swept in `pattern.test.ts` across every wheel × lead × trail × stock combination, which is the test that would have caught the original 270 mm overflow.
- **Lap direction is now on the paper**: each joint carries `PANEL n UNDER — PANEL n-1 LAPS OVER IT` plus a flow arrow, so you can tell which way water runs across it without reading the engineering notes.
- **1:1 survived the page-combining change.** Every print SVG measures scale 1.0 (0.99983–1.00002, browser float noise) using the §9.18 method. This was the risk: combining pages is exactly where a fit-to-page could sneak back in.
- Sheet B now shares a page with the last Sheet A tile when there is room, so the default drops a sheet.

1139 assertions.

---

## WP16 — Visual system

### 16.1 Type scale on a 4 px grid

Current sizes are scattered: 11, 11.5, 12, 13, 13.5, 14, 15 px inline. Nothing is on a grid and the
whole thing reads small.

Proposed scale, every step a multiple of 4:

| Token               | Now       | Proposed | Used for                     |
| ------------------- | --------- | -------- | ---------------------------- |
| `--text-label`      | 11        | **12**   | uppercase section labels     |
| `--text-caption`    | 12        | **12**   | slider hints, notes          |
| `--text-body-sm`    | 13 / 13.5 | **16**   | control labels, option text  |
| `--text-body-md`    | 14 / 15   | **16**   | body copy, engineering notes |
| `--text-body-lg`    | 18        | **20**   | intro paragraph              |
| `--text-heading-sm` | 18        | **20**   | section headings             |
| `--text-heading-md` | 22        | **24**   | —                            |
| `--text-heading-lg` | 28        | **32**   | page title                   |
| `--text-mono-sm`    | 12/13     | **16**   | spec values, readouts        |

The real work is not the tokens, it is **removing the ~40 inline `fontSize` values** in the rail and
canvas components that bypass them. Audit and route everything through tokens, or the scale will
drift again the next time someone edits a component.

Drawing-label sizes (the `size` field on `Label`, in mm) are **not** part of this — those are
millimetre annotations on a technical drawing and must not follow a screen type scale.

### 16.2 Active option states

**Confirmed and trivial.** `OptionButton` already supports `emphasis="dark" | "tinted"`. Side and
Wheel pass `dark` (inverted, high contrast); Join, Stock and Options pass `tinted` (coral). Switch
the latter three to `dark` so selection reads the same everywhere. Coral then goes back to meaning
one thing: attention, i.e. warnings and seams.

### 16.3 Presets: front/rear grouping and scroll affordance

Split the strip into labelled **Front** and **Rear** groups, and make the horizontal scroll visible:
a right-edge fade mask plus a partially-visible next card, so it reads as scrollable at rest. Six
presets currently render as a flat row that looks complete at three.

### 16.4 700c = 29″

Wheel labels are `700c · 622`. Add the imperial equivalent people actually shop for:
`700c · 29″ · 622`. 700c and 29″ share the 622 mm bead seat — same rim, different marketing name —
so it is worth stating plainly rather than making people know it.

---

## WP17 — Copy pass

Run `/anthropic-skills:stop-slop` across all user-facing prose: the 16 engineering notes, assembly
steps, warnings, preset descriptions, UI labels.

Per A3, strip em-dashes and `·` from **sentences**, keep `·` where it delimits data. The distinction:
`700c · 29″ · 622` is a delimiter and stays; "Score the fold lines — about a third of the way
through" is punctuation and goes.

Two cautions:

- This is careful technical writing. The goal is removing AI-writing tells, not flattening voice.
  Prefer restructuring a sentence over swapping one character for another.
- Golden fixtures record the original prose verbatim. Every prose change needs its fixture
  expectation updated with a comment saying why, exactly as §9.9 and §9.4 did.

---

## WP18 — Every preset ships warning-free

A shipped preset that greets you in red teaches people to ignore the warnings, which is exactly what
PLAN §9.5 chose the new default to avoid. Right now five of six are clean and `cargo-20in` fires
five.

**The invariant:** every preset produces **no warnings other than `radius-estimated`**.

That exception is deliberate and permanent. `radius-estimated` fires whenever `measuredR === 0`,
which is every preset, because we cannot honestly guess someone's actual tyre radius. It is a prompt
to go and measure, and it is the largest single error in the pattern. Silencing it by inventing a
measured radius would be worse than leaving it.

### The conflict to resolve first

`cargo-20in` currently fires `coverage-exceeds-frame` (260°), `tail-narrower-than-tyre` (47 mm tail
vs a 50 mm tyre), `single-blank-too-long` (1221 mm in one piece) and `strut-too-long` (220 mm struts
against a ~196 mm mount distance). Every one is correct. They fire because the preset **is** the
design file's original defaults, values that PLAN §9.5 rejected as a default precisely because they
trip five warnings.

So the preset cannot be both "the original defaults" and "warning-free". Pick the user:

- **Retarget it to a working 20″ cargo config.** Keep the wheel and the intent, fix the numbers:
  coverage down to ≤ 220°, taper down so the tail clears the tyre, `stock: 'a4'`, struts shortened to
  the real mount distance. A preset is for building a fender, not for archiving history.
- The original values are already preserved where they belong: the `cargo-20in-single` case in
  `src/fender/__tests__/golden.json`, and git. **Move the deep-equality test** in
  `presets.test.ts` off the preset and onto that fixture case directly, so the historical record is
  still pinned but no longer constrains a user-facing preset.

### Also check

- The four other presets are clean today, but WP13 changed the coverage constant and added the
  bevel. Re-verify rather than assume.
- Front at 55/120 is 175°, rear at 120/100 is 220°. Rear sits exactly on the threshold, so any
  preset that nudges lead or trail upward will trip it. Worth a comment where those numbers live.

### Verify

A property test over `PRESETS`, not a per-preset assertion:

```ts
for (const p of PRESETS) {
  const ids = buildWarnings(p.config).map((w) => w.id);
  expect(ids.filter((id) => id !== 'radius-estimated')).toEqual([]);
}
```

This is the kind of test that keeps working as presets are added, and it will fail loudly the next
time a warning threshold moves.

---

## Sequencing

1. **WP13** — geometry first, since coverage numbers and the bevel change golden values everything
   else is tested against.
2. **WP14** — visualisation, independent.
3. **WP15** — print, depends on nothing above but touches the packer WP12 introduced.
4. **WP16** — visual system, safe to run alongside anything.
5. **WP17** — copy last, so it only has to be done once over settled text.

**WP18** can run at any point after WP13, and should run after any package that changes a warning
threshold or a geometry default — it is the cheapest way to catch a preset that has quietly gone bad.

WP13 and WP15 both change golden fixtures; do not run them in parallel.
