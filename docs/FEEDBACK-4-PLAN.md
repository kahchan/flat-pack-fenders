# Feedback round 4 — plan

Corrective round. WP23 and WP28 shipped in `05439a9` and are wrong — not in their intent but in a
formula, and the architecture let the error render as if it were correct. This round fixes the cause,
not just the symptom.

Numbers throughout are the default config (`rear-700c`) unless stated: L 1382.3 mm, `removal`
81.8 mm, skirt 25.4 mm flat, 20 flaps, `lap` 4.9 mm.

Continues `docs/PLAN.md` §9 numbering from **§9.35**.

---

## Decisions (settled)

| #      | Decision                                                  | Consequence                                                                                                          |
| ------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **D1** | The **assembled 3D model is the source of truth**         | New `assembly.ts` builds the fender in real space. The flat pattern is *derived* from it by unrolling. `isometric.ts` drops to a pure projector with no geometry maths. |
| **D2** | A fastener is placed **once**, in assembled coordinates   | Piercing k layers emits k flat features automatically, one per panel, in that panel's own developed frame. Alignment is true by construction. |
| **D3** | The skirt angle floor is **derived from current geometry** | The slider's minimum is whatever angle yields at least a `cinch` lap at the current skirt and flap count. It moves when they move. |
| **D4** | Clamping still preserves intent                           | As in round 3: config stores what the user set, the derived floor applies on use. Raising the skirt back restores the angle. |

**D1 supersedes round 3's WP23/WP28 architecture**, which kept the flat pattern authoritative and had
`isometric.ts` re-derive the same geometry from parallel formulas. Two transcriptions of one intent
is what produced §9.35 below.

---

## WP29 — Build in 3D, unroll to flat ✅ DONE

### 29.1 The lap slant is inverted (§9.35)

`pattern.ts:290` computes the two layers' hole offset as

```
const t = d / g.skirt;              // d = depth IN FROM THE FREE EDGE
const x = xc + dir * t * (g.lap / 2);
```

The overlap band is a triangle: `lap` wide at the **free edge**, converging to zero at the **fold**.
So the lap available at depth `d` in from the free edge is `((skirt − d)/skirt)·lap`. The code uses
`d/skirt` — the complement. The slant runs the wrong way: the two hole columns converge where the
lap is widest and diverge where there is no lap at all.

Measured on a config where a zip stitch actually fits (skirt 60 mm, 8 sections, lap 24.4 mm):

| hole depth from free edge | code separates layers by | lap actually available |
| ------------------------- | ------------------------ | ---------------------- |
| 3.5 mm                    | 1.44 mm                  | **22.95 mm**           |
| 8.5 mm                    | 3.49 mm                  | **20.90 mm**           |

The holes cannot coincide when assembled. Correct form, with `u = (skirt − d)/skirt`:

```
x = xc ∓ u * (lap / 2)
```

**This came from the spec, not from the build.** `FEEDBACK-3-PLAN.md` §23.6 wrote
`x = i·pitch − (d/skirt)·(notch + lap)/2`, and the implementation reproduced it exactly. The
build is not at fault; the plan was.

### 29.2 Why the preview did not catch it (§9.36)

`isometric.ts:328` places the same fastener at

```
const ao = aa + (dir * t * (g.lap / 2)) / g.R;
```

— the flat offset transcribed into an arc angle. But in the **assembled** fender a fastener through
both layers is a *single point*: it should appear once in 3D, drawn per layer at radii differing by
`t`, never at two arc positions. So the 3D view reproduced the flat pattern's error faithfully and
rendered it as though correct. A misalignment that should have been obvious in the preview was
invisible, because the preview was derived from the same wrong number.

That is the architectural fault, and it is why D1 inverts the dependency rather than patching two
formulas.

### 29.3 The inversion (D1, D2)

**`assembly.ts` — new.** The fender in real 3D coordinates, before any projection or unrolling:

- Crown: cylinder at radius `R`, arc `aNose → aNose + th`, width `crownAt(x)`.
- Skirt: `n` planar panels, one per pitch, folded down at `angle`, each shingled over the next by
  `lap` at the free edge converging to zero at the fold.
- Features placed **once**, in assembled space: dart fasteners, tongues and their slots, strut holes,
  mount slots, mudflap holes, panel seam fasteners. Each records which layers it pierces.

**`develop.ts` — new.** Unrolls the assembly into the flat blank:

- The crown is a developable cylinder and unrolls exactly (arc length `R·θ`).
- Each skirt panel is planar, so it maps rigidly to the flat pattern.
- A feature piercing k layers emits **k flat features**, one per panel it passes through, each
  expressed in that panel's own developed frame. The two zip holes at a dart are then the same 3D
  hole seen from two panels — they cannot disagree, because there is only one of them.

**`pattern.ts`** keeps everything that is genuinely flat-only: labels, panel seams, annotations,
tiling hooks, sheet layout. It consumes `develop.ts` instead of computing dart geometry itself.

**`isometric.ts`** becomes a pure projector: assembly + `spin` → 2D paths. No `crownAt`, no `pf`, no
depth fractions, no duplicated formulas. Every geometry expression in it today is deleted, not fixed.

### 29.4 What this does and does not change

It does not change any decision from round 3. The join family, the derived lap, "report fit, never
disable", the punched tongue, keeping intent on clamps — all stand. What changes is *where the
numbers come from*, so that a hole that lines up in the preview lines up in the cut sheet because
they are the same hole.

`geometry.ts` keeps `lap`, `JOIN_LAP_NEEDED` and `joinFits()` unchanged; they are about how much
overlap exists and what it can take, which is upstream of both representations.

### Verify

These are the tests the round exists to make possible — they are not expressible under the current
architecture, which is the point:

- **Layer coincidence.** For every through-lap fastener, the k flat holes it produced all map back to
  the same assembled point, within 0.05 mm. This is the test that would have caught §9.35 on day one.
- **Round trip.** Every flat feature, re-folded through the assembly map, lands within 0.05 mm of its
  3D source.
- **Isometry.** Unrolling preserves distances within a panel — a developable map must not stretch.
- **Regression on the known-bad case.** skirt 60 / 8 sections / zip: assert the layer separation at
  8.5 mm depth is 20.90 mm, not 3.49 mm.
- Existing goldens regenerate. The zip and rivet hole positions **should** move; if any other
  coordinate moves, the unroll is wrong.

---

## WP29 — Outcome, measured

`src/fender/assembly.ts` and `src/fender/develop.ts` are new. `pattern.ts` and
`isometric.ts` no longer compute any dart-fastener position — both consume the assembly.

**The map, derived rather than asserted.** A folded panel is rigid, so an arc-length
offset from its own mid-line survives folding:

```
x_flat = (p + 0.5)·pitch + (aa − aMid(p)) · (R − u·drop),   u = (skirt − d)/skirt
```

Substituting the dart angle collapses this to `x = k·pitch ∓ u·lap/2` for panels `k-1`
and `k` — the round-3 formula, but with the fraction the right way up. It is written once,
in `depthFraction`, and nothing restates it.

**Two further defects found while removing the duplicated maths:**

- **`lap` was overstated by one thickness.** It shipped as `removal/n + t`, carrying over
  the allowance the BUTT notch needed so its two folded edges had room. A lap just
  stacks — the thickness buys no overlap. 0.8 mm against a 4.9 mm default lap, 16%, and
  it fed straight into `joinFits()`. Now `removal/n`.
- **The preview's strut holes sat at the wrong depth.** `isometric.ts` used
  `lerp(free, fold, 0.2)` — a *fraction* of the skirt — where `pattern.ts` drills at an
  absolute `inset` mm below the free edge. The two agreed only near a 30 mm skirt. Same
  class as §9.35, found next door to it.

**Tests.** `src/fender/__tests__/develop.test.ts`, 10 cases. The one that matters:
every layer of every through-lap feature refolds to the same assembled point within
0.05 mm, for all four piercing joins. Plus the `flatX`/`assembledAngle` inverse, an
isometry check on unrolling, the free-edge/fold endpoints, and the §9.35 regression
pinned at 20.90 mm separation against the old 3.49 mm.

**Suite:** 1180 passing, 27 files. Goldens regenerated — `scripts/extract-golden.mjs`
mirrors the new map, and its isometric section (still on pre-WP23 `notch/2 + 6` offsets)
was brought in line at the same time.

**Two behavioural assertions changed, because they encoded the bug:**

- `zip.holes.length > cinch.holes.length` in 3D. Now equal, and correctly so — a zip
  stitch is two depths each piercing both layers at one point; cinch is one hole on each
  of two panels. Round 3 drew zip twice over, at two arc positions (§9.36).
- Punched-tongue quads went from `darts × 2 × 2` to `darts × 2`. The tongue passes
  *through* its slot, so on the assembled fender they are one opening. They separate only
  when the panels are unrolled, and the blank does still carry both.

**Not done, against the plan's letter.** §29.3 said `isometric.ts` would become a pure
projector with *every* geometry expression deleted. Its fastener maths is gone and its
strut holes now come from `point3`, but the surface itself — `pf()`, the facet loop,
rails, outline, wheel, struts, mudflap — still computes its own geometry from `Geometry`
rather than consuming assembly panels. That is the half of the inversion that was not
causing incorrect output, and it is still outstanding.

---

## WP30 — A derived floor under the skirt angle ✅ DONE

### 30.1 A flat fender has no shingle (§9.37)

`defaults.ts:185` sets the angle slider to a fixed `min: 20`, which is not tied to anything. Whether
20° leaves any overlap depends entirely on skirt depth and flap count, and often it does not. The
angle needed for even a `cinch` lap (3 mm), at each preset's own skirt and flap count:

| preset               | flaps | skirt | angle | needs ≥ |
| -------------------- | ----- | ----- | ----- | ------- |
| Cargo / folder 20″   | 16    | 30    | 55°   | 20°     |
| Gravel 650b          | 22    | 32    | 55°   | 23.5°   |
| MTB 26″              | 18    | 26    | 55°   | 23.5°   |
| Rear commuter 700c   | 20    | 26    | 55°   | 26.5°   |
| Front gravel 650b    | 22    | 32    | 55°   | 30°     |
| Front commuter 700c  | 20    | 26    | 55°   | **34°** |

So the fixed 20° floor is below the real requirement for five of six, and a single higher fixed floor
would be wrong in the other direction for cargo. Hence D3: derive it.

### 30.2 The derived floor (D3, D4)

`angleMin(s)` = the smallest angle at which `lap ≥ JOIN_LAP_NEEDED.cinch`, holding skirt and flaps
fixed. It becomes the angle slider's `min`, recomputed whenever skirt or flaps moves. Per **D4** the
config still stores what the user set and the floor applies on use, so pushing skirt down and back up
restores the angle rather than destroying it.

The hint must say *why* the floor is where it is and which slider moves it — a minimum that shifts
under you without explanation is worse than a wrong fixed one.

### 30.3 Two edge cases that must not be silent

**`angleMin` can be undefined.** With `flaps` at its max of 40 and a shallow skirt, no angle up to 85°
produces a 3 mm lap — `sin` saturates before the requirement is met. At flaps 40 / skirt 10 mm the
required removal is 88 mm against a ceiling of 39 mm. The floor cannot apply, and the UI has to say
"reduce sections" rather than silently pinning the slider at 85°.

**`skirt` has `min: 0`.** A zero-depth skirt has no fold, no overlap and nothing for any join to
fasten. It needs the same treatment as the angle floor, or an explicit dartless branch — §23.2 of
round 3 already requires one for `n ≤ 1`, and this is the same terminal state reached by a different
slider.

### Verify

- For every preset, and a sweep of skirt/flap combinations, `angle = angleMin` yields
  `lap ≥ 3 mm` and `angle = angleMin − 1` does not.
- Intent round trip: set angle 30°, drop skirt until the floor exceeds 30°, raise it back, assert the
  angle is 30° again.
- The undefined-floor case surfaces a message naming sections as the lever, and no slider silently
  pins.

---

## WP30 — Outcome, measured

`geo()` gains `angleMin` (nullable) and `angleEff`, computed before `a` from terms that
do not involve the angle, so there is no circularity. Everything downstream builds at
`angleEff`.

Floors came out **higher than the plan's table** because they are now measured against the
corrected `lap` (WP29 dropped the spurious `+ t`): the default is **37°**, not the 26.5°
the plan quoted, against the fixed `min: 20` it replaces. Verified live in the app —
the slider's `min` reads 37 and the hint reads *"Below 37° there is no shingle to fasten
at 20 sections"*.

**Intent is preserved (D4).** Nothing rewrites `config.angle`. Set 30°, shallow the skirt
until the floor passes it, deepen it again, and 30° is back — pinned as a test.

**§30.3's two edge cases are both live, not silent:**

- `angleMin` is `null` when `sin` saturates first (40 sections on an 8 mm skirt). The
  angle is then left exactly as set — nothing pins to 85° — and the hint names sections
  as the lever instead. `urlCodec`'s hostile-input sweep reaches this state, and its
  finite-geometry helper now exempts `angleMin` while asserting it is `null` and never
  `NaN`.
- A stored angle below the floor — reachable from a shared link, or by shallowing the
  skirt after setting it — raises the new `angle-below-shingle-floor` warning, naming
  what it is built at and that the original returns.

**Tests.** `src/fender/__tests__/angleFloor.test.ts`, 6 cases: the floor is exactly
tight (at it the lap clears, a degree under it would not), the null case, the D4 round
trip, the warning, every preset clearing its own floor, and that the floor genuinely
varies across presets — which is why it could not have stayed a constant.

**`skirt` still has `min: 0`.** §30.3 flagged it as the same terminal state reached by a
different slider. Not addressed — the angle floor does not protect against it.

---

## WP31 — The crown facets too ✅ DONE

### 31.1 The developable-cylinder argument was about the wrong object (§9.38)

WP28 §28.2 exempted the crown from faceting: *"a sheet bent round the wheel genuinely
does form a smooth cylinder, so its high segment count is the faithful render of it."*
That is true of the **flat blank** and false of the **folded part**.

Once both skirts are turned down, the section is a channel. A channel is far stiffer
about the axle than the flat strip it was cut from, and it does not curve smoothly under
hand pressure — it creases at whatever relief it is given. The dart slits *are* that
relief. The built fender is a polygonal prism that kinks at every dart line, and the
crown facets exactly like the skirt. Nothing about the fender is drawn at a fixed segment
count now; `NS` survives only for the wheel ghost.

The golden script's isometric section was still on the pre-WP28 three-quads-per-`NS`-
segment sweep — a shape the app had not drawn since WP28 and never drew at all after
this. Brought in line at the same time.

### 31.2 What faceting exposes: the crown dips inside its own clearance (§9.39)

A flat facet spanning angular pitch `dA` sits inside the design radius by the sagitta
`R·(1 − cos(dA/2))` at its midpoint. The smooth-crown render hid this completely. At the
shipped presets it is minor; at the section counts a zip stitch needs, it is not:

| sections | facet | dip at facet midpoint | vs 14 mm clearance |
| -------- | ----- | --------------------- | ------------------ |
| 30       | 7.3°  | 0.74 mm               | 5%                 |
| 20 (default) | 11.0° | 1.66 mm           | 12%                |
| 12       | 18.3° | 4.60 mm               | 33%                |
| 8        | 27.5° | **10.32 mm**          | **74%**            |
| 6        | 36.7° | **18.27 mm**          | **fouls the tyre** |

Across the shipped presets the dip runs 0.87–2.01 mm, i.e. 5–12% of each one's own
clearance — tolerable but real. At 6 sections the fender intersects the tyre.

**This is a geometry defect, not a rendering one, and it is NOT fixed here.** `clear` is
documented as "Gap between tyre and fender inner face", and with a faceted crown the
real minimum gap is `clear − sagitta`, not `clear`.

The fix is to circumscribe rather than inscribe: put the facet *midpoints* on the
clearance circle instead of the fold vertices, so vertices move out to `R/cos(dA/2)` and
the minimum gap is honest again. That changes the developed length to the polygon
perimeter, `L = 2n·R·tan(dA/2)` — **+0.16% to +0.40% across the presets, +2.0% at 8
sections, +3.6% at 6**. Small, but `L` drives pitch, removal, lap, tiling and panel
count, so it moves every dimension in the app and every golden.

It also invalidates part of WP29's map, which places the fold line on a circle of radius
`R`: on a prism the fold is a straight chord, so a flat offset `ξ` from a panel's mid-line
lands at radius `√(R² + ξ²)` and angle `aMid + atan(ξ/R)`, not at `R` and `ξ/R`. The
overlap derivation survives unchanged — `removal = th·drop` either way — but `flatX` does
not.

Left as the next package rather than folded in here, because it is a change to the core
dimension every other number depends on.

---

## WP32 — Circumscribe the clearance circle ✅ DONE

### 32.1 The developed length is the polygon perimeter

```
dA = th / n                        angular pitch, one facet
L  = 2·n·R·tan(dA/2)               perimeter of the CIRCUMSCRIBED polygon
```

Facet midpoints now sit on the clearance circle and the fold vertices move out to
`R/cos(dA/2)`. `clear` means what it says again — the minimum gap to the tyre, not the gap
at the corners.

**Everything else survived in form.** `pitch = L/n`, `removal = L·drop/R` and
`lap = removal/n` are all unchanged as written, because `lap = pitch·drop/R` holds on the
polygon exactly as it did on the cylinder. That was not obvious in advance and is the
reason the change stayed contained.

A dartless skirt (`n ≤ 1`) has no crease lines, so nothing makes it a polygon: it keeps
the true arc. `dA < π` is the same guard from the other side.

### 32.2 The map became `tan`, and two things had been quietly wrong

On a prism a fold is a straight **chord**, so a flat offset `ξ` from a panel's mid-line
sits at angle `aMid + atan(ξ/rq)`, not `aMid + ξ/rq`, and its distance from the axis is
`rq/cos(Δφ)` rather than a constant `rq`. `flatX`, `assembledAngle`, `point3` and
`isometric.ts`'s `p3` all carry that now.

Two latent errors surfaced only once the geometry was exact enough to expose them:

- **Panel and dart angles were multiples of `pitch/R`.** Identical to `dA` on a cylinder,
  and wrong on a prism by exactly the amount the perimeter grew. This broke the WP29
  coincidence test the moment `L` changed — which is the test doing its job.
- **The crown taper was read at the wrong radius.** `point3` looked it up at the point's
  own depth, so the two layers of a lap read it at positions differing by the local lap
  width and disagreed by ~0.2 mm. A skirt point inherits the crown width of the fold point
  it hangs from, and the fold is at `R` for every depth. Reading it there makes both
  layers agree exactly.

`cinch`'s 6 mm clearance is now converted through the same chord map instead of being
divided by a radius, so the one join whose holes sit *outside* the lap keeps its spacing
honest too.

### Outcome, measured

**Clearance, sampled across every facet of every panel** — the check the package exists
for. Minimum crown radius against `R`, i.e. the true closest approach to the tyre:

| config | gap | `clear` |
| ------ | --- | ------- |
| Rear commuter 700c | 14.00 mm | 14 |
| Gravel 650b | 18.00 mm | 18 |
| default at 12 sections | 14.00 mm | 14 |
| default at 8 sections | 14.00 mm | 14 |
| **default at 6 sections** | **14.00 mm** | 14 |

Exact at every section count, including the two that previously fouled the tyre.

**Cost:** `L` 1382.30 → 1386.56 mm on the default, +0.31%, exactly as predicted. Pitch
69.1 → 69.3 mm. Panel and page counts unchanged on every preset.

**Suite:** 1181 passing, 27 files. Goldens regenerated; `scripts/extract-golden.mjs`
mirrors the chord map, the prism lift and the new angles.

**Three invariants changed, all deliberately:**

- `developed length is the arc, not the chord` → now asserts the polygon perimeter,
  that it exceeds the arc, and that it does so by under 5%. Joined by a new test that
  facet midpoints lie on the clearance circle and vertices outside it.
- The isometry check is now an **exact identity** — a panel is flat, so straight-line 3D
  distance equals flat separation, where on the cylinder it only held to within the
  chord-versus-arc error.
- `pathPolys`' golden head/tail moved 69.1 → 69.3 with the pitch.

---

## Sequencing

WP29 first and alone. WP30's floor is a function of `lap`, and `lap` is about to be produced by a new
pipeline — deriving a slider bound from a number that is mid-refactor would mean doing it twice.

1. **WP29** — assembly model, unroll, projector-only isometric
2. **WP30** — derived angle floor, skirt-zero and undefined-floor branches
