# Third Order prop-tip Mandalas

Research checked against SpiroAnim `origin/dev` at
[`2dbb40624c80ac586de82a700fa1a7f33923a1f7`](https://github.com/rbgirard/spiroanim/tree/2dbb40624c80ac586de82a700fa1a7f33923a1f7)
on 2026-09-05. This includes the September 4 Third Order optimization. Mentive
is the public attribution name. Austen has permission to use the repository
for research and development. No upstream source was copied for this change.

## What matters in the current renderer

[`createSpiroAnimator.ts`](https://github.com/rbgirard/spiroanim/blob/2dbb40624c80ac586de82a700fa1a7f33923a1f7/src/workers/animation/createSpiroAnimator.ts)
bakes paths after the prop pose and outer motion offsets are composed. Its
`pathsGroup` stays in world space. `additionalPathHeadPositions` gives other
prop ends their own paths. `updateProgressivePaths` searches `pathSampleTimes`
to reveal the correct portion for the current time, rather than using a
percentage of path length. This matters when the tip speeds up or slows down.

Current Third Order pattern generation is under `src/features/vtg/thirdOrder.ts`.
The older `features/third-order/components/ThirdOrderPane.vue` link is historical,
not the current implementation.

## FAC implementation boundary

The Third Order Toy adapts its sampled frames to the shared world-trajectory
pipeline. Each prop end comes from the animator's canonical tip registry and
endpoint calculator, then receives the child grid's scale, rotation and
translation. The completed strokes live on the stationary parent stage.

The Toy offers Off, Trace and Full. Trace follows the same count as playback
and seeking. It keeps the finished drawing after the first composition loop;
Restart or seeking starts a new reveal. Motion hides the grids and props without
changing the drawing. SVG saves every tip layer over the full composition span,
including both outer cycles of a 2:3 or 2:5 flower. Discontinuous inner restarts
lift the pen instead of adding an invented closing line.

This is the current Toy's composition span, not a new automatic least-common-
multiple loop solver for arbitrary independently timed clips. General recursive
V3 composition authoring, all SpiroAnim transforms, URL importing and collection
saving remain separate work. Endpoint tracing does not establish full feature
parity with SpiroAnim.

## Ownership

Search terms: `trajectory`, `Mandala`, `tip`, `endpoint`, `progressive`, `bake`.
Closest matches were `motion-trajectory-baker.ts`, `trajectory-projector.ts`,
`mandala-layer-adapter.ts`, `prop-tip-points.ts` and
`prop-position-calculator.ts`.

- Extend the existing baker to accept any sampled world frame.
- Reuse the prop registry, endpoint geometry, projection and layer adapter.
- Add time-based reveal, canvas presentation and SVG serialization under
  `shared/mandala`. Keep the Third Order adapter in the Toy.
- Reuse FAC's segmented control, filter chip, panel button, playback controls,
  file downloader and error handler.

Regression coverage checks transformed endpoints, all eight staff tips,
two-cycle flowers, hidden grids, unequal prop tip counts, nonuniform tip speed,
backward seeking and discontinuities. The zero-based composition clock maps to
the animator's first moving count at position one, with no extra opening hold.
