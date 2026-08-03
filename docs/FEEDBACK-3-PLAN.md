# Feedback round 3 — plan

Two geometry packages, a 3D package and three UI packages. Same rule as rounds 1 and 2: every claim
below was checked against the code before it was written down, and the numbers are measured, not
estimated. Where a round-3 comment turned out to be right, the diagnosis is recorded so whoever
implements it does not have to rediscover it — all of them were.

Numbers throughout are the default config (`rear-700c`): L 1382.3 mm, `removal` 81.8 mm, skirt
25.4 mm flat, 20 flaps.

New findings continue `docs/PLAN.md` §9 numbering from **§9.26** (round 2 reached §9.25).

---

## Decisions (settled)

| #      | Decision                                              | Consequence                                                                                                                          |
| ------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | The skirt dart becomes a **shingled lap**             | Adjacent skirt segments overlap instead of butting.                                                                                      |
| **C2** | **The lap is derived, and nothing is capped**         | Lap width falls out of the geometry. Flaps stays free. The app reports which fasteners fit rather than clamping the config to suit one.   |
| **C3** | A **join family**, ordered by the lap each needs      | `none` → `cinch` → `rivet` → `zip` → `tab`. The selector never disables an option; it says what fits and what would make the rest fit.    |
| **C4** | Skirt depth and angle stay free                       | Both scale the lap linearly. No new bounds on either slider; the copy points at them as the levers.                                       |
| **C5** | The 3D preview renders **what will be built**         | Thickness, shingle steps, and every hole, slot, tab, strut and mudflap as real cut geometry. No painted-on decoration.                    |
| **C6** | Slot-and-tab is **redesigned this round**             | An integral tongue punched from the lap, through a slot in the panel beneath, folded flat. A real hardware-free joint.                    |
| **C7** | `measuredR = 0` stops being a magic number            | "Estimate" becomes an explicit state. The slider only ranges over physically real radii.                                                  |
| **C8** | Every slider value is click-to-edit                   | The number in each slider head becomes a text input, committing on blur.                                                                  |
| **C9** | Preset parity via **addition**                        | Two new front presets → 4 front / 4 rear, plus the side-agnostic `hole-free-minimal`. No preset is removed, and no flap count changes.    |
| **C10** | Panel seams are **pinned to the tile grid**          | `placeSeams`' drift is deleted. A seam is always at the page boundary.                                                                    |

**C2 replaces an earlier decision in this same document.** The first draft fixed the lap at 11 mm and
capped `flaps` so a zip stitch would always fit. That was backwards: it clamped the config to protect
a fastener choice the user might not want, and threw away ~60% of the achievable section count to do
it. Deriving the lap and reporting fit costs nothing and constrains nothing.

---

## WP23 — The shingled lap skirt ⚠️ SHIPPED WITH A DEFECT — see FEEDBACK-4-PLAN.md

> §23.6's hole-slant formula below is **wrong**: it uses `d/skirt` where the overlap triangle
> requires `(skirt − d)/skirt`, so the two layers' holes cannot coincide when assembled. The build
> implemented the spec faithfully; the spec was at fault. Round 4 §9.35 has the diagnosis, and WP29
> replaces the architecture that let it render as correct. Every other decision here stands.

### 23.1 The skirt darts butt; they have never overlapped (§9.26)

Confirmed in the code, not inferred. `geometry.ts:52` sets

```
notch = removal / n + t
```

and the doc comment above `geo()` states the intent outright: the `+ t` exists *"so the two folded
edges sit alongside each other instead of colliding."* The dart is sized to close to a **butt seam**
with one thickness of clearance. Overlap is not small — it is structurally absent. Page 1 of the
round-3 PDF shows it directly: every V-notch has two hole columns straddling it, nothing overlapping.

The columns at `pattern.ts:197` sit at `xc ± (notch/2 + 6)`, 6 mm back from each cut edge, so once
the dart closes they are a pair ~12 mm apart **spanning** the seam. Good in tension — it does pull
the dart shut, which is most of the job — but zero shear strength, and the tie head stands proud.

### 23.2 The lap is derived, not chosen (C2)

Removing `lap` less material than the cone needs leaves exactly `lap` of surplus at the free edge,
which the shingle absorbs. The bound is `notch ≥ 0` — you cannot cut a negative V, and in a single
continuous sheet two adjacent skirt segments cannot overlap in the **flat** pattern. So the available
lap is simply:

```
lap = removal / n + t − notch,   maximised at   lapMax = removal / n + t
```

with `notch = 0` (a plain slit) giving the maximum. Nothing is capped. `flaps`, `skirt` and `angle`
all stay free; the lap moves with them and the UI reports what that lap can take.

`removal = L·skirt·sin(angle)/R`, so **skirt depth and skirt angle are the levers**, both linear-ish:

| skirt      | lapMax at 20 flaps | | angle | total removal | lapMax at 20 flaps |
| ---------- | ------------------ |-| ----- | ------------- | ------------------ |
| 20 mm      | 3.9 mm             | | 10°   | 17.3 mm       | 1.7 mm             |
| 26 mm (today) | 4.9 mm          | | 20°   | 34.1 mm       | 2.5 mm             |
| 40 mm      | 7.1 mm             | | 45°   | 70.6 mm       | 4.3 mm             |
| 60 mm      | 10.2 mm            | | 55° (today) | 81.8 mm | 4.9 mm             |
| 75 mm      | 12.6 mm            | | 70°   | 93.8 mm       | 5.5 mm             |

**No minimum or maximum is added to either slider.** Angle self-limits at the top (`sin` saturates —
70° and 85° differ by 6%) and has an honest terminal state at the bottom: at 5° the whole fender has
8.7 mm of surplus and the skirt is near enough developable to take it up elastically.

**The hazard is `n = 0`.** `geo()` computes `pitch = L/n` and `notch = removal/n + t`; both divide by
zero. A dartless skirt must be a real branch — drawn and labelled as such, not an error.

### 23.3 The join family (C3)

Five styles, ordered by the lap each needs. Requirements are proposed here and get validated against
real fasteners during the build:

| join      | lap needed | construction                                                                                  |
| --------- | ---------- | --------------------------------------------------------------------------------------------- |
| **none**  | 0 mm       | Scored girth channel, one tie round the outside. Unchanged.                                     |
| **cinch** | ≥ 3 mm     | **New.** The butt seam's *manner of attaching*, carried onto a lapped seam: one hole per panel, *outside* the lap band either side, tie spanning across. The tie pulls the lap closed; the overlap itself carries shear and sheds water. |
| **rivet** | ≥ 7 mm     | One hole per layer through the lap, ⌀3.2 mm, 4.5 mm in from the free edge.                      |
| **zip**   | ≥ 11 mm    | Two holes per layer through the lap at 3.5 mm and 8.5 mm in from the free edge. One tie stitches down through the outer pair and back up through the inner: 4 holes, 2 per layer. |
| **tab**   | ≥ 11 mm    | Integral tongue through a slot, no hardware. See §23.5.                                         |

**`cinch` is the fallback that makes "nothing fits" unreachable**, and it is the direct answer to the
round-3 note — today's butt-and-tie, but with real overlap under it. Because the tie never passes
through the lap, it needs almost none.

**What falls back is the fastening, never the geometry.** At minimal overlap the skirt is still a
shingled lap; only the manner of attaching reverts to ties spanning across adjacent skirt pieces, the
way the butt seam does it today. There is no config anywhere in the app that reintroduces a butt
seam, and no second dart geometry to draw, document or test. `notch = max(0, removal/n + t − lap)`
is the only dart there is. Measured against the existing presets at their **current** flap counts:

| preset               | flaps | lap now | fits    | max sections: cinch / rivet / zip·tab |
| -------------------- | ----- | ------- | ------- | ------------------------------------- |
| Rear commuter 700c   | 20    | 4.9 mm  | cinch   | 37 / 13 / 8                           |
| Front commuter 700c  | 20    | 4.1 mm  | cinch   | 29 / 10 / 6                           |
| Gravel 650b          | 22    | 5.4 mm  | cinch   | 45 / 16 / 9                           |
| MTB 26″              | 18    | 5.3 mm  | cinch   | 37 / 13 / 8                           |
| Front gravel 650b    | 22    | 4.4 mm  | cinch   | 36 / 12 / 7                           |
| Cargo / folder 20″   | 16    | 6.2 mm  | cinch   | 38 / 13 / 8                           |
| Hole-free minimal    | 20    | 4.9 mm  | cinch   | 37 / 13 / 8                           |

**Every preset already clears cinch at its existing flap count, with headroom.** So no preset's flap
count changes, the smooth skirt is kept, and every one of them gains a real overlap over today's
butt seam. That is the whole cap problem dissolved by choosing the right fallback.

### 23.4 Reporting fit, never disabling (C3)

The join selector shows all five always. Each carries its state: fits, or what it needs. The message
names the lever and the number — *"needs 11 mm of lap, you have 4.9 mm at 20 sections; 8 sections or
a 60 mm skirt would do it"* — computed, not canned. Selecting a join that does not fit is allowed
and produces a warning, not a clamp, consistent with keeping intent everywhere else.

### 23.5 The integral tab (C6)

Today's slot join is two slots either side of a butt seam with nothing passing between them. With a
lap it becomes a real joint.

**Recommended — punched tongue.** A U-shaped cut in the *upper* panel within the lap band frees a
tongue hinged at its inboard end. The tongue passes inward through a slot in the panel beneath and
folds flat against the inside. It needs no material beyond the lap itself, so it costs the same
sections as a zip stitch (8 on the default) rather than more.

**The trade, stated plainly:** the punched tongue leaves an aperture in the outer skin of a
mudguard. The tongue folds back over its own aperture, and the shingle direction puts the upstream
panel on top so water runs over the joint rather than into it, but it is a hole in a part whose job
is shedding water. It needs a spray check in the assembled preview before it ships.

**Alternative — edge tab.** A tab integral to the panel's trailing edge, extending into the V. No
aperture, but the tab must fit inside `notch`, which forces `notch ≥ tabLen`. At an 8 mm tab that is
`removal/n + t ≥ 19`, i.e. **5 sections on the default** against 8 for the punched tongue. Documented
here so the choice is on the record; build the punched tongue unless the spray check fails.

### 23.6 Cut and hole geometry

**Shingle direction.** Consistent nose→tail, upstream segment on top — the same rule the panel seams
already use (`pattern.ts`: *"forward panel on top"*). One rule for both joints, stated once.

**Hole placement.** The overlap band is a triangle: `lap` wide at the free edge, zero at the fold.
Holes are placed by absolute distance in from the free edge, not by fraction, so their spacing does
not shrink on shallow skirts. Because the band converges toward the fold, the hole columns are
**slanted**, not vertical as they are today. On segment *i* a hole at depth `d` sits at
`x = i·pitch − (d/skirt)·(notch + lap)/2`; on segment *i+1*, the mirror. Both land on the same point
once assembled — except `cinch`, whose holes sit outside the band by design.

### 23.7 Blast radius

`notch` changes meaning, so this is not a local edit:

- `geometry.ts` — `notch`, derived `lap`, the per-join fit table, and the `n = 0` branch.
- `pattern.ts` — dart outline vertices, the dart-fastening block, `dangerXs` for the slanted columns.
- `types.ts` — `join` gains `'cinch'`; `'slot'` changes meaning.
- `crossSection.ts` — the skirt is now shingled. (`isometric.ts` is WP28.)
- `warnings.ts` — the "chosen join does not fit" warning, with its computed remedy.
- `notes.ts`, `AssemblySteps`, `JoinSelector` — the copy currently implies an overlap that does not
  exist. It will. Plus two new joins to document.
- `controlText.ts` — flaps/skirt/angle hints carry the lap and what it can take.
- `urlCodec.ts` — one new `join` value in the enum.
- `__tests__/golden.json` — regenerated. Every preset's `notch` and hole set changes.

### Verify

- For every preset at its shipped flap count: `notch ≥ 0`, and the reported fit is non-empty.
- The `n = 0` branch renders without a division by zero.
- A config where the chosen join does not fit produces a warning naming a remedy that, when applied,
  actually makes it fit — assert the round trip, not just the string.
- Visual: assembled preview shows the shingle, and a tie visibly passing through four holes.

### 23.8 Implementation notes (added after WP23 build)

- **The `n = 0` hazard (§23.2) is defensive-only.** `flaps` has its own UI slider floor of 4;
  `notch = 0`/`n ≤ 1` is only reachable by calling `geo()` directly, e.g. from a test. Worth
  flagging so nobody goes hunting for a UI slider bound to loosen — the guard exists for callers
  of the geometry function, not for anything a user can reach.
- **`DEFAULTS.join` and `cargo-20in` had to move from `zip` to `cinch`.** §23.3's fit table already
  shows every preset clears `cinch` with headroom at its shipped flap count; what it doesn't say
  explicitly is that the *default* config and the `cargo-20in` preset were both set to `zip`, which
  needs 11 mm of lap against ~5–6 mm available — i.e. they shipped a join that doesn't fit, breaking
  the WP18 "ships warning-free" invariant the moment C2/C3 landed. Fixed by moving both to `cinch`.
  Worth stating in the plan text next time so it isn't half an hour of test-chasing to rediscover.
- **§23.6's slanted-hole formula doesn't sign-check against its own description.** Implemented
  literally as written — `x = i·pitch − (d/skirt)·(notch+lap)/2` — but the band is described as
  "lap wide at the free edge, zero at the fold," and this formula grows the offset as `d` (depth
  from the free edge) increases, i.e. it moves further from centre approaching the fold, which reads
  backwards from that description. Implemented as specified since the plan states every claim was
  checked against the code, but flagging it here: verify against a physical fold or a mockup before
  cutting material based on this hole placement.
- **Removing the old `slot` join's Sheet-B hardware has a WP27 side effect.** The butt-strap/clip
  hardware being deleted (the tab is integral now, §23.5) also orphans the *panel-seam*'s own
  `join === 'slot'` branch in `pattern.ts` — a different joint, sized for A4-panel laps rather than
  dart laps. Panel seams now always use holes. This wasn't in §23.7's blast-radius list; WP27 (pin
  the seam to the page grid) should know this already changed underneath it before it touches
  `pattern.ts` seams again.

---

## WP28 — The 3D view shows a fender that does not exist ⚠️ SUPERSEDED — see FEEDBACK-4-PLAN.md

> Shipped, but on the wrong architecture: `isometric.ts` re-derives geometry from formulas parallel
> to `pattern.ts`, so it reproduced §9.35's inverted slant and rendered it as though correct. WP29
> inverts the dependency — the assembled 3D model becomes the source of truth and this file drops to
> a pure projector. The fidelity goals (C5) stand unchanged.

### 28.1 The facet mesh ignores the flap count entirely (§9.27)

`isometric.ts:10` fixes `NS = 64` segments along the arc, and the facet loop at line 100 runs over
`NS` with **no reference to `g.n`**. The skirt renders as a smooth 64-facet sweep whether the fender
has 8 sections or 22, and the dart seams at lines 190–196 are painted onto that smooth surface as
decoration. The preview has never shown the real geometry.

### 28.2 Render what will be built (C5)

The governing rule, without exceptions:

- **Skirt** — a polygon of `g.n` flat panels, hard-edged at every dart. Not a shading ramp.
- **Crown** — a sheet bent round the wheel genuinely does form a smooth cylinder, so its high
  segment count is the faithful render of it. Same rule, not an exemption.
- **Thickness** — the sheet renders with its real thickness, so the doubled material at each lap
  reads as a physical step and free edges show an edge face. `thick` already drives the bend maths;
  now it is visible.
- **Cut geometry** — every hole, slot, tongue, strut and mudflap as real geometry, not decoration.
  This is the only version where you can look at the preview and confirm the stitch passes through
  four holes, or see what the punched tongue does to the outer skin.

`pf(a)` returns the four rails; rails 0–1 and 2–3 are skirt, 1–2 is crown, so the loop splits along
an existing boundary. Thickness and boolean cut geometry are the genuinely new work here and the
reason this is its own package rather than a WP23 footnote.

### Verify

- Skirt facet count equals `g.n`; crown stays smooth.
- Set flaps to 6 and to 22; the preview visibly differs in section count both times.
- The lap step is visible at every dart, and the aperture left by a punched tongue is visible.
- A dartless config (§23.2) renders without artefacts.

### 28.3 Implementation notes (added after WP28 build)

- **"Real thickness" (§28.2) is a projected 2D approximation, not a solid.** The isometric renderer
  is a flat SVG painter's-algorithm projection with no depth buffer or boolean geometry engine.
  Building a literal watertight 3D solid was out of scope; instead the free edges and lap step are
  rendered as genuine, config-driven facets — present iff `thick > 0` / `lap > 0`, sized off the real
  `thick`/`lap` values rather than decoration — that disappear correctly at `t = 0` or `lap = 0`.
  Visually confirmed: the skirt facet count equals `g.n` (checked 6 vs 22 flaps side by side) and the
  crown stays a smooth sweep independently of flap count. If a future package wants a true
  solid/boolean model (e.g. for a physical export), treat this as the known simplification to
  revisit.

---

## WP27 — The panel seam is not where the page is

### 27.1 Two grids that were supposed to be one (§9.28)

WP19 decision B1 declared *"one printed tile **is** one material panel."* In the shipped code that is
false, for two independent reasons.

**The origin is off by a constant 6 mm.** `tiling.ts:26` starts the tile grid at `x0 = -TONGUE_L - 6`.
`pattern.ts:311` starts the seam grid at `-TONGUE_L`. Same step (`PW - LAP` = 247 mm), different
origin. Even at zero drift the seam is 6 mm from the page boundary — never on it.

**`placeSeams` then wanders.** WP19 §19.3/§19.4 added it so seam fastener columns would not land on
dart, strut and mount holes; it lets each seam slide up to 40 mm earlier than nominal against a
shared budget. It resolved §19.3 by breaking §19.1, and nothing was watching. Measured offset of each
seam from its page boundary:

| preset               | seam 1 → last                    |
| -------------------- | -------------------------------- |
| Hole-free minimal    | +6, +6, +6, +6, +6               |
| Gravel 650b          | +6, +6, +6, +6, −31              |
| Cargo / folder 20″   | −3, −15, −26                     |
| Rear commuter 700c   | −30, −30, −40, −40, −50          |
| MTB 26″              | −10, −30, −51, −71, −91          |
| **Front commuter 700c** | **−17, −44, −71, −98**        |

Hole-free minimal is the clean case that isolates the origin bug — zero drift, still 6 mm out
everywhere. Front commuter is the worst: by the last seam the cut line is 98 mm from where the page
says it is, over a third of a page width, and the position differs per seam *and* per config. That
is exactly the reported symptom.

### 27.2 The fix (C10)

Delete `placeSeams` entirely. Seam `i` is at `x0 + i·(PW − LAP)`, sharing one origin constant with
`tiling.ts` — extract it so the two grids cannot drift apart again. Collisions resolve in order:

1. **Struts and mounts move.** Both have real freedom — struts their `span` fractions, mounts their
   placement along the crown. They yield to the seam, not the other way round.
2. **The dart hole serves both.** Darts are evenly spaced by construction and cannot move. Where a
   seam column coincides with a dart, merge them into one fastener closing the lap and the dart
   together, rather than two holes a few mm apart.

The merged hole is a **four-layer corner**: the panel lap crossed by the skirt lap. Strong, but a
special case needing a hole sized for four thicknesses, its own line in the assembly steps, and a
test that it is reachable. With flaps at 16–22 the pitch is 63–86 mm against a 247 mm page step, so
it will not be rare.

### 27.3 Also observed in the shipped PDF

Page 1 of the round-3 output shows two defects not visible from the code:

- The orange `PANEL 1: WHEEL SIDE OF THE JOINT…` label is **clipped by the tile crop**. It is drawn
  at `yFreeB + 9`, outside the blank, and `croppedTile` cuts to content height without accounting
  for annotations beyond the outline. Same risk for the `SEAM n: CUT PANEL n TO HERE` label above.
- The **100 mm ruler overprints the pattern**. `tiling.ts` places it at a fixed `oy + PH - 10`,
  which lands on the blank whenever the blank reaches the bottom of the tile.

### Verify

- **The invariant this package exists to protect**: for every preset, and a sweep of lengths that
  stress `ceil()` boundaries, every seam is within 0.05 mm of its tile boundary.
- `panelCount === tiling.cols`. Two independent formulas today
  (`1 + ceil((totalW − PW)/stepX)` vs `ceil((bboxW + 12 − overlapX)/stepX)`); they agree on all seven
  presets, but nothing enforces it.
- No annotation extends outside its own tile's cropped bounds.

---

## WP24 — Numbers you can type, and radius as a real state

### 24.1 The radius slider reaches physically impossible values (§9.29)

`measuredR` is an ordinary slider whose `0` doubles as the sentinel for "use the BSD estimate", so
dragging it sweeps through radii like 28 mm — a valid input describing no wheel. Per **C7**:

- The slider ranges over real radii only, minimum **150 mm** (under the 203 mm bare rim radius of the
  smallest supported wheel, so an unusually low 20″ measurement is still reachable; a two-digit
  radius is not).
- "Estimate" becomes an explicit state, not a value: the field shows `estimate` with a clear
  affordance to return to it, and leaving estimate seeds the slider at the current BSD estimate.
- `measuredR = 0` stays the wire format in config and URL codec — a control-layer change only.

### 24.2 Every slider value becomes click-to-edit (C8)

`SliderGroups` renders the value as `<span className="slider-item__value mono">`. It becomes a text
input styled identically until focused. Per house convention it **commits on blur**; Enter commits,
Escape reverts. Clamped to the slider's own min/max on commit.

---

## WP25 — Rail and canvas layout defects

### 25.1 Content scrolls into the gap above the title (§9.30)

`.control-header--rail` is sticky with `padding-top: var(--space-8); margin-top: calc(var(--space-8) * -1)`
against a rail that already carries `padding: var(--space-8)` and a 26 px flex `gap`. The header's
background covers its own box, but the 26 px gap below it is transparent, so scrolled content shows
through the band. The sticky band must own its background down to the divider.

### 25.2 The Fine tuning disclosure has no affordance (§9.31)

`.fine-tuning > summary` sets `list-style: none` and hides the webkit marker, leaving a bordered box
with no indication anything is inside it. Add a `[+]` / `[−]` keyed to the `open` attribute so it
works without JS state.

### 25.3 The cluster headings are styled as the disclosure (§9.32)

`ControlRail` uses the same class — `rail-group-label` — for both the `<summary>` and the inner
SHAPE / COVERAGE / CONSTRUCTION headings. Identical, so the headings read as four more accordions.
Split the classes, and give clusters real separation (the current 8 px is intra-group spacing doing
inter-group work).

### 25.4 The third export button is clipped (§9.33)

`.action-row { display: flex; gap: 10px }` with three `size="lg"` buttons overflows the 392 px rail.
Wrap the row or drop the export buttons to `size="md"` — decide against the real rail width in the
preview, not on paper.

### 25.5 The section nav scrolls away (§9.34)

`.section-nav` scrolls with the canvas, so returning to it means scrolling back up — defeating a jump
nav. Make it sticky to the top of the canvas scroll container, inheriting §25.1's lesson that it must
own its background. Check the phone and tablet breakpoints in `responsive.css:164`.

---

## WP26 — Preset parity

Today: 2 front, 4 rear, 1 side-agnostic. Per **C9**, add two front presets for 4/4:

- **Front MTB 26″** — mirrors `mtb-26in` with front coverage and a mudflap.
- **Front cargo / folder 20″** — mirrors `cargo-20in`, same wheel and stock.

`hole-free-minimal` stays ungrouped; it is a construction profile, not a wheel profile.
`PresetSelect`'s Front/Rear `<optgroup>`s become 4 and 4.

**No existing preset's flap count changes** — §23.3 measured every one of them clearing the cinch
join at its current count with headroom. Both new presets must ship warning-free, the standing rule
from WP18, which now includes a join that fits.

---

## Sequencing

WP23 first — it changes `Geometry`, the goldens and the join enum. WP28 second, because a faithful
preview is the fastest way to *see* whether WP23's geometry is right, and the punched tongue's spray
question (§23.5) cannot be settled without it. WP27 third: it also touches `pattern.ts` seams and
wants WP23's dart positions final before pinning seams against them. WP26 follows. WP24 and WP25 are
independent of everything.

1. **WP23** — shingled lap skirt, the join family, the integral tab
2. **WP28** — faithful 3D: real sections, thickness, cut geometry
3. **WP27** — pin the seam to the page grid
4. **WP26** — two front presets
5. **WP25** — rail and canvas layout defects
6. **WP24** — editable numbers + radius state
