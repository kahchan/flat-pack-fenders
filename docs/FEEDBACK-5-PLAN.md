# Feedback round 5 — plan

The four packages round 3 scoped but never built, carried forward and **re-measured against
the current codebase**. WP29–WP32 (merged in `8dab74c`) moved enough underneath them that
several of the round-3 numbers are now wrong — one defect is materially worse, one package
gains a much better home, and one preset that round 3 called safe would now ship warning-first.

Numbers are the default config (`rear-700c`) as it stands today: L 1386.56 mm, pitch 69.3 mm,
lap 4.1 mm, 20 flaps, `join: cinch`.

Continues `docs/PLAN.md` §9 numbering from **§9.40**. Where a defect is the same unfixed
defect round 3 diagnosed, it keeps its original §9 number.

---

## What changed underneath these packages

| Since round 3 | Consequence for this plan |
| ------------- | -------------------------- |
| `L` is the polygon perimeter, not the arc (WP32) | Every seam/tile number re-measured. Pitch is now 50–76 mm across presets, was 63–86. |
| Fasteners are declared in `assembly.ts` and unrolled by `develop.ts` (WP29) | WP27's "merge the dart hole" stops being a special case and becomes the architecture's normal move. |
| `dangerXs` is now pushed per developed hole **instance** (WP29) | More columns for `placeSeams` to dodge, so seam drift got **worse** — see §9.40. |
| `lap` lost its spurious `+ t` (WP29) | Preset laps are 3.3–5.4 mm. Nothing but `cinch` fits anywhere — see §9.42. |
| The angle slider's `min` is derived (WP30) | WP24's click-to-edit has to clamp to live bounds and write to `config.angle`, not `angleEff` — see §9.43. |

---

## WP27 — Pin the seam to the page grid

### 27.1 Two grids that were supposed to be one (§9.28, unfixed)

WP19 decision B1 declared *"one printed tile **is** one material panel."* Still false, still for
two independent reasons, both verified in today's code:

**The origin is off by a constant 6 mm.** `tiling.ts:25` starts the tile grid at
`x0 = (s.tongue ? -TONGUE_L : 0) - 6`. `pattern.ts:344` starts the seam grid at `-tongueOff`.
Same step (`PW - LAP` = 247 mm), different origin.

**`placeSeams` wanders.** It lets each seam slide up to 40 mm earlier than nominal to dodge
dart/strut/mount columns, against a shared budget.

### 27.2 It got worse, not better (§9.40)

WP29 routes every dart fastener through `develop()`, and `pattern.ts` pushes a `dangerX` per
hole **instance** — both skirts, both layers — where the round-3 code pushed two per dart. More
columns to dodge means more drift. Re-measured offset of each seam from its page boundary:

| preset | pitch | round 3 | **today** |
| ------ | ----- | ------- | --------- |
| Hole-free minimal | 69.3 | +6 ×5 | **+6, +6, +6, +6, +6** |
| Cargo / folder 20″ | 58.9 | −3, −15, −26 | **−3, −14, −23** |
| Gravel 650b | 63.0 | +6, +6, +6, +6, −31 | **+6, +6, +6, −34, −34** |
| Rear commuter 700c | 69.3 | −30, −30, −40, −40, −50 | **−30, −69, −69, −75, −75** |
| MTB 26″ | 75.9 | −10, −30, −51, −71, −91 | **−10, −29, −49, −68, −87** |
| Front commuter 700c | 55.1 | −17, −44, −71, −98 | **−17, −43, −70, −97** |

Rear commuter's worst seam went from 50 mm off to **75 mm off**. Hole-free minimal is still the
clean case that isolates the origin bug: zero drift, 6 mm out on every seam.

### 27.3 Panel-seam fasteners are the last hand-placed column (§9.41)

After WP29 every dart fastener is declared once in `assembly.ts` and unrolled per layer. The
**panel-seam** fastener column is not: `pattern.ts` still builds it inline, a `rowN`-long loop of
holes at `xm = x + LAP/2`, in flat coordinates, with no assembled position at all.

That is the same shape of problem §9.35 was, one level up — and it makes the round-3 fix plan
awkward for no reason. Moving the seam column into `assembly.ts` first turns C10's two collision
rules into ordinary consequences:

- A seam fastener becomes a feature with an assembled position, so **"the dart hole serves both"**
  is just a feature whose `layers` list names the panel lap *and* the skirt lap. The four-layer
  corner stops being a special case in the drawing code and becomes a four-entry `layers` array
  that `develop.ts` already knows how to unroll.
- Clearance from other columns can be judged in assembled space, where it physically matters,
  instead of against a list of flat x positions.

**Do this before pinning the grid.** Pinning first means writing the collision handling twice.

### 27.4 The fix

Delete `placeSeams`. Seam `i` sits at `x0 + i·(PW − LAP)`, with the origin extracted into one
constant shared with `tiling.ts` so the two grids cannot drift apart again. Collisions resolve in
the order decision C10 already settled:

1. **Struts and mounts move** — both have real placement freedom.
2. **The dart hole serves both** where a seam column meets a dart, per §27.3.

With pitch now 50–76 mm against a 247 mm page step, a seam lands on or near a dart often, so this
path is ordinary, not an edge case. It needs a hole sized for four thicknesses and its own line in
the assembly steps.

### 27.5 Two defects the shipped PDF shows (unfixed)

- The orange `PANEL n: WHEEL SIDE OF THE JOINT…` label is **clipped by the tile crop**. Drawn at
  `pattern.ts:386` (`yFreeB(xm) + 9`), outside the blank, and `croppedTile` cuts to content height
  without accounting for annotations beyond the outline. Same risk for the `SEAM n` label above it.
- The **100 mm ruler overprints the pattern**. `tiling.ts:51` fixes it at `oy + PH - 10`, which
  lands on the blank whenever the blank reaches the bottom of the tile.

### Verify

- **The invariant this package exists for**: every seam within 0.05 mm of its tile boundary, for
  every preset and a sweep of lengths that stress `ceil()` boundaries.
- `panelCount === tiling.cols`. Two independent formulas (`1 + ceil((totalW − PW)/stepX)` vs
  `ceil((bboxW + 12 − overlapX)/stepX)`); they agree on all seven presets today, nothing enforces it.
- A merged seam/dart fastener refolds to one assembled point from all four layers — the WP29
  coincidence test, extended.
- No annotation extends outside its own tile's cropped bounds.

---

## WP26 — Two front presets

Today: **7 presets, 2 front** (`front-700c`, `front-gravel-650b`), 4 rear, 1 side-agnostic.
Round 3's decision C9 stands: add two front presets for 4/4 by addition, removing nothing.

- **Front MTB 26″** — mirrors `mtb-26in` with front coverage and a mudflap.
- **Front cargo / folder 20″** — mirrors `cargo-20in`, same wheel and stock.

### 26.1 Both candidates work, but only on the parent's join (§9.42)

Built and measured. Both clear their derived angle floor comfortably at 55°:

| candidate | lap | angleMin | joins that fit |
| --------- | --- | -------- | -------------- |
| Front MTB 26″ | 3.6 mm | 43° | none, cinch |
| Front cargo / folder 20″ | 4.7 mm | 31° | none, cinch |

**The trap round 3 could not have seen:** its text says the cargo preset "mirrors `cargo-20in`,
same wheel and stock". `cargo-20in` carried `join: 'zip'` when that was written. It carries
`join: 'cinch'` now, and a front copy built with `zip` raises `join-lacks-lap` immediately —
4.7 mm of lap against the 11 mm a stitch needs. Inherit the parent's join, do not re-specify it.

### 26.2 The join family is currently unreachable (§9.42, cont.)

Worth stating plainly because it is a design question, not a bug: **no shipped preset has enough
lap for anything but `cinch`.** Laps run 3.3–5.4 mm; `rivet` needs 7 mm, `zip` and `slot` need
11 mm. Every preset reports `fits: [none, cinch]`.

So the rivet, stitch and punched-tongue joins — all built, all tested — cannot be reached from any
preset a user is likely to start from. Nothing here is broken; the presets simply all sit in
smooth-skirt territory. If those joins are meant to be discoverable, that wants a preset that
demonstrates one (a deep skirt at a low section count), and that is a **decision, not a defect** —
flagged here rather than assumed either way.

### Verify

- Both new presets ship warning-free apart from `radius-estimated`, which every BSD-estimated
  config raises. Confirmed for both candidates as specified above.
- `PresetSelect`'s Front/Rear `<optgroup>`s read 4 and 4.

---

## WP25 — Rail and canvas layout defects

All five re-checked in today's CSS and components. All still present, unchanged.

### 25.1 Content scrolls into the gap above the title (§9.30)

`app.css:337` — `.control-header--rail` is sticky with `padding-top: var(--space-8)` and
`margin-top: calc(var(--space-8) * -1)`, against a rail that already carries
`padding: var(--space-8) var(--space-7) 120px` and `gap: 26px`. The header's background covers its
own box; the 26 px flex gap below it is transparent, so scrolled content shows through the band.
The sticky band must own its background down to the divider.

### 25.2 The Fine tuning disclosure has no affordance (§9.31)

`app.css:361` — `.fine-tuning > summary` sets `list-style: none` and hides the webkit marker,
leaving a bordered box with no indication anything is inside. Add a `[+]` / `[−]` keyed to the
`open` attribute so it works without JS state.

### 25.3 The cluster headings are styled as the disclosure (§9.32)

`ControlRail.tsx` uses `rail-group-label` **six times** — once on the `<summary>` and once on each
of the five cluster headings. Identical treatment, so the headings read as five more accordions.
Split the classes, and give clusters real separation (the current 8 px is intra-group spacing doing
inter-group work).

Note WP30 lengthened the angle slider's hint (it now names the derived floor and the lever), so the
cluster spacing needs checking against the longest hint, not the default one.

### 25.4 The third export button is clipped (§9.33)

`ActionButtons.tsx` renders **five** `size="lg"` buttons — Print/Reset on one `.action-row`, three
exports on another — and `.action-row { display: flex; gap: 10px }` overflows the 392 px rail on
the second. Wrap the row or drop the exports to `size="md"`; decide against the real rail width in
the preview, not on paper.

### 25.5 The section nav scrolls away (§9.34)

`app.css:150` — `.section-nav` has `margin: 32px 0 18px` and no `position`, so it scrolls with the
canvas and returning to it means scrolling back up, defeating a jump nav. Make it sticky to the top
of the canvas scroll container, inheriting §25.1's lesson that it must own its background. Check the
phone/tablet breakpoints in `responsive.css:164`, where it is already restyled.

---

## WP24 — Editable numbers and radius as a real state

### 24.1 The radius slider reaches physically impossible values (§9.29)

`defaults.ts:181` — `measuredR: { min: 0, max: 400, step: 1 }`, with `0` doubling as the sentinel
for "use the BSD estimate", so dragging sweeps through radii like 28 mm: a valid input describing no
wheel. Decision C7 stands:

- The slider ranges over real radii only, minimum **150 mm** (under the 203 mm bare rim radius of
  the smallest supported wheel, so an unusually low 20″ measurement stays reachable; a two-digit
  radius does not).
- "Estimate" becomes an explicit state, not a value: the field shows `estimate` with a clear
  affordance back to it, and leaving estimate seeds the slider at the current BSD estimate.
- `measuredR = 0` stays the wire format in config and URL codec — a control-layer change only.

### 24.2 Every slider value becomes click-to-edit (C8)

`SliderGroups.tsx:22` renders the value as `<span className="slider-item__value mono">`. It becomes
a text input styled identically until focused, committing **on blur** per house convention; Enter
commits, Escape reverts.

### 24.3 Two new constraints from WP30 (§9.43)

The angle slider is no longer an ordinary field, and a naive implementation gets it wrong twice:

- **Clamp to the item's live bounds, not `PARAM_SPECS`.** `angleItem()` in `controlText.ts`
  overrides `min` with the derived floor, which moves whenever skirt or flap count moves. Typing
  a value must clamp to that, not to the static 20°.
- **Write to `config.angle`, never `angleEff`.** The field *displays* `g.angleEff` — the angle the
  fender is actually built at — which differs from the stored value whenever the floor is holding it
  up. Round-tripping the displayed number back into config would silently destroy the user's intent,
  which is precisely what decision D4 exists to prevent.

### Verify

- Typing an angle below the current floor clamps to the floor and leaves `config.angle` alone;
  deepening the skirt afterwards restores the typed value.
- Every other slider round-trips: type, blur, read back the same number.
- `measuredR` cannot be dragged to a non-physical value, and "estimate" is reachable and legible.

---

## Sequencing

WP27 first, and §27.3 (move the seam column into `assembly.ts`) before §27.4 (pin the grid) —
pinning first means writing the collision handling twice. WP26 next: small, and it settles what the
preset list looks like before any UI work is checked against it. WP25 and WP24 are independent of
both and of each other, but WP25 §25.3 should land before WP24 touches the same slider rows.

1. **WP27** — seam column into the assembly, then pin the seam to the page grid
2. **WP26** — two front presets
3. **WP25** — rail and canvas layout defects
4. **WP24** — editable numbers + radius state
