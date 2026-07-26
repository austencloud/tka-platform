# Spinner mandala + prop-size convergence

**Date:** 2026-07-26
**Status:** Shipped
**Surfaces:** the endless spinner (`PlayWithItInner.svelte`, hosted on `/composer` and `/embed/spinner`), the 2D animation canvas everywhere

## Problem

Three things, one root:

1. The spinner never showed the mandala, though the viewer has had a Display >
   Mandala toggle for every sequence.
2. The spinner offered no way to change the sequence, and the prop lived buried
   in the AnimationPanel's Props grid — so nothing communicated that sequence
   and prop are independent variables.
3. The club's mandala was tuned; nobody else's was. A sword traced a mandala
   more than twice the club's radius.

(3) is why (1) could not just be switched on. `computeEngineAlignedMandalaScale`
is fixed — `canvasSize/950 × ENGINE_GRID_RADIUS/MANDALA_GRID_RADIUS` — **not**
fit-to-content. So a prop's mandala radius is literally hand orbit (150) plus its
furthest tip. Club → 280 of a 475 half-canvas. Sword → 430. Guitar → 440.

## Key discovery

`static/images/props/` holds the same artwork twice:

| family | regular props | notes |
|---|---|---|
| `pictograph/` | ~250–262 wide | the tuned family; club is `258.67` here |
| `animated/` | 300 / 600 | the same paths, each uniformly scaled **up** |

`animated/club.svg` and `pictograph/club.svg` are **byte-identical**. The club
tuning was a migration onto the pictograph family that stopped after one prop.
Every other regular prop is its pictograph twin times a per-prop constant (staff
×1.068, fan ×1.154, triad ×1.206, quiad ×1.2, …).

So this is not a new normalization scheme. It is finishing that migration.

## Design

### 1. The animation canvas draws the pictograph family

`svg-generator.ts` gains `resolvePropSvgPath`, returning `pictograph/` for
everything except an explicit carve-out set. `PROP_DIMENSIONS` takes the
pictograph viewBoxes; each entry in `PROP_TIP_POINTS` is divided by that prop's
scale constant. Pivot is unaffected — both families are origin-`0 0` and the
renderer draws at `-width/2`, so a uniform scale keeps the center fixed.

The three staves and the two triquetras had shared tip tables; they scale by
different constants now, so each gets its own.

**Carve-outs (stay on `animated/`):**

- `torch` / `bigtorch` — their animated viewBoxes are deliberately offset and
  padded so the flame isn't clipped while the hand pivot stays put.
- `triquetra2` — the two families hold different artwork (300×175.3 vs 170×170),
  not a uniform rescale.
- `sword-*` variants — no pictograph counterpart exists.

Balls, `bigstaff`, `bigbuugeng`, `bighoop`, `poi`, `sword`, `ukulele`, `hand`
were already identical in both families. Two stale `PROP_DIMENSIONS` entries were
corrected against their files (`sword` 578.8 → 572.3).

Bilateral vs unilateral is preserved because each prop's existing tip set is
scaled, not re-derived. Two-ended props (staff, buugeng, bigclub, bigchicken,
doublestar, eightrings) keep both tips and land near ±130 — a ~260 span.
Single-ended props (club, sword, chicken, poi, guitar) keep their one tip.

### 2. Mandala on the spinner

`visibilityManager.setVisibility("mandala", true)` in `PlayWithItInner`'s
`onMount`. The render loop's `renderMandalaGuide` and `MandalaOverlayCanvas`'s
`guideFadeManager` already crossfade whenever the prepared paths change — a
sequence swap changes `sequenceKey`, which is a new prepared-path object, which
is the same trigger a prop swap uses. Nothing new was built.

The guide fade moved from `DURATION.emphasis` (280ms) to `DURATION.dramatic`
(350ms): a whole mandala dissolving into the next one is a major transition, not
a module switch. This applies to the viewer's mandala guide too, which wants it
equally.

The Display > Mandala chip still turns it off.

### 3. Two peer buttons

**Next sequence** (`playback.skip()`) and **Next prop** (cycles staff → club →
fan → buugeng → mini hoop → triad → poi), side by side under the canvas as
equals. Each click changes exactly one variable, which is what makes the
independence legible. Labels are static so the row cannot reflow; the caption
below (simplified word · prop name) is centred and alone on its line, so its own
width changes displace nothing.

Analytics reuse the existing `try_another` and `change_prop` demo actions.

## Result

Reach after convergence, against the club's 129.3:

- **within 5%:** club, fan (130 exactly), buugeng, triquetra 2, staff, big
  chicken, big club, triquetra
- **short:** trigeng −8%, big torch −7%, simple staff −12%, staff v2 −13%,
  triad −16%, mini hoop −19%, quiad −19%, eight rings −34%
- **long:** torch +8%, doublestar +16%, chicken +26%, sword +116%
- **big variants:** +53% to +132%, by design

## Known gaps

- **Eight rings** reads −34% but its silhouette visibly extends past the ring it
  reports. Its tip points sit on the ring tops, not the outer extent — a
  tip-point accuracy bug, independent of this convergence.
- **Sword, guitar, chicken** stay well outside the band. Their artwork is that
  long; bringing them in means new artwork or a per-prop override, not a rescale.
- The short group (eight rings, quiad, mini hoop, triad) sits under 130 rather
  than on it. Faithful proportional scaling put them there; pulling them onto
  exactly 130 is a separate decision.

## Verification

- `/test/prop-size-audit` renders every active prop at true animation-canvas
  scale against the engine grid, with its produced mandala radius as a dashed
  ring and the club's as a reference ring.
- Spinner screenshotted at 3840, 2560, 1920, 1440, 820×1180, 960×412, 375.
  At 375 the control block was tightened to one row of equal halves (151px →
  81px of chrome, canvas 196 → 267, 44px touch floor held).
- Crossfade measured on sequence change: mandala alpha ramps across frames
  rather than cutting.
- `npm run check`: 0 errors.

## Related

- `.claude/rules/no-layout-shift.md`, `visual-verification-mandatory.md`,
  `4k-native-layout.md`, `simplified-word-display.md`
