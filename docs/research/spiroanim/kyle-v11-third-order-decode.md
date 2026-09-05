# Kyle v11 Third Order reference

Status: verified golden fixture

## Source and method

Kyle authored the supplied `play-edit` URL in SpiroAnim. Austen supplied the
URL for parity research with Kyle's explicit permission to analyze his R&D.
The source is preserved in
`fixtures/kyle-v11-third-order.json`.

The URL was decoded at SpiroAnim `origin/dev` commit
`3f42385010ecd4d5c5a0c78f5f35f7f5391e5ad3` through SpiroAnim's own v11
`useSpiroAnimQS` boundary, finalized with `rootFinal`, and compiled with
`rootCompile`. Re-encoding the decoded object produced the exact original
query object. No FAC code guessed or reimplemented the packed query format.

The fixture also records world-space staff-tip polylines created by
SpiroAnim's own `createSpiroAnimator`. Each moving tip's original 3,600-point
polyline is represented by 192 evenly spaced reference points. These are
numeric parity evidence, not the proposed FAC persistence format.

## Complete structural decode

| Property                                        | Decoded value                      |
| ----------------------------------------------- | ---------------------------------- |
| Codec                                           | v11                                |
| Props                                           | 18 Staff streams                   |
| Props with Motion                               | 16                                 |
| Props without Motion                            | 2                                  |
| Distinct Motion cohorts                         | 6 moving + 1 static                |
| Inner Animation                                 | 37 frames / 37 beats on props 0–15 |
| Outer Motion                                    | 4 frames / 48 beats on props 0–15  |
| Camera                                          | 10 frames / 45 beats               |
| Composition duration                            | 48 beats                           |
| BPM                                             | 60                                 |
| Aspect                                          | 1:1                                |
| Root color                                      | Green                              |
| Paths / hands / arms / nodes / anchors / guides | On                                 |
| Travel guide                                    | Off                                |

The clocks are intentionally independent. The moving staffs finish their
inner animation at beat 37 and hold that final local pose while their Motion
tracks continue through beat 48. The camera finishes at beat 45 and likewise
holds through the final three beats. A parity implementation must not wrap or
stretch these tracks unless the author explicitly selects that behavior.

## Prop arrangement

| Props | Colors                           | Outer behavior                                                                        |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------- |
| 0–3   | Orange, Magenta, Orange, Magenta | Four staffs share a radius-13 closed Circle about the origin                          |
| 4–7   | Yellow, Yellow, Cyan, Cyan       | Initial placement near `(12.164, 45.399)`, then radius-13 closed Circles              |
| 8–9   | Orange, Orange                   | Initial placement near `(-47.993, -0.838)`, then radius-15 closed Circles             |
| 10–11 | Red, Red                         | Same center as 8–9, with the Circle bend reversed                                     |
| 12–13 | Green, Green                     | Initial half-Circle placement near `(-41.719, 41.719)`, then radius-15 closed Circles |
| 14–15 | Yellow, Yellow                   | Same center as 12–13, with the Circle bend reversed                                   |
| 16–17 | Green, Green                     | Static central pair; no Motion track                                                  |

Every moving Motion track consists of four 12-beat Circle frames. SpiroAnim's
Circle `amount: 100` closes back to its segment origin. Several first frames
use `amount: 0` as placement, while props 12–15 use the inherited default
`amount: 50` to land through a half Circle. The identical encoded `mN` values
are authoring evidence for the cohorts, but the v11 file contains no shared
group identity: every prop still owns its own Motion array.

## What the link proves

This reference is not a two-grid composition. It proves all of the following
at once:

- an arbitrary prop count rather than a hard-coded left/right pair;
- ordinary local prop animation and independent outer translation on the same
  absolute clock;
- identical Motion tracks used as a rigid-cohort authoring pattern;
- paired cohorts that share a center while bending in opposite directions;
- a static reference pair alongside moving cohorts;
- a camera track independent from both prop Animation and outer Motion;
- world-space path baking, including the interval after local Animation ends.

The link does **not** contain SpiroAnim's newer v12 Warp and Strength fields.
Those fields rotate and blend an auxiliary hand-path vector inside a prop's
local animation. They are a second Third Order capability and must remain a
separate normalized channel from v11 Motion translation.

## FAC boundary decision

Mandala, export, and render code must not consume Spiro query keys or codec
objects. The import boundary should normalize a decoded source into a
source-neutral motion composition. One deterministic sampler then emits
world-space prop endpoints and camera poses. Mandala receives only a projected
trajectory set derived from those samples.

The persisted composition keeps authored parametric tracks. Sampled points,
SVG paths, screen projections, and posters are derived artifacts. This keeps
seeking deterministic, preserves editability, and prevents a camera choice
from being mistaken for the physical path.

## Reproduction

The artifact was produced in a detached worktree of SpiroAnim `origin/dev` by
an ephemeral Vitest spec that:

1. parsed the exact supplied URL;
2. called the v11 codec selected by `useSpiroAnimQS`;
3. asserted exact encode/decode round-trip equality;
4. called `rootCompile`;
5. instantiated `createSpiroAnimator` once per prop;
6. extracted the renderer's two staff-tip lines for every moving prop;
7. wrote the decoded and derived reference data into FAC.

FAC intentionally does not vendor that ephemeral spec or a copy of
SpiroAnim's codec. Regeneration must continue to run against a pinned upstream
commit until SpiroAnim publishes a supported decoder package or readable
interchange format.

## Primary upstream references

- v11 codec: <https://github.com/rbgirard/spiroanim/blob/3f42385010ecd4d5c5a0c78f5f35f7f5391e5ad3/src/services/query/versions/SpiroAnimQSv11.ts>
- query boundary: <https://github.com/rbgirard/spiroanim/blob/3f42385010ecd4d5c5a0c78f5f35f7f5391e5ad3/src/composables/useSpiroAnimQS.ts>
- Motion math: <https://github.com/rbgirard/spiroanim/blob/3f42385010ecd4d5c5a0c78f5f35f7f5391e5ad3/src/math/animation/MotionFunc.ts>
- world-path renderer: <https://github.com/rbgirard/spiroanim/blob/3f42385010ecd4d5c5a0c78f5f35f7f5391e5ad3/src/workers/animation/createSpiroAnimator.ts>
- v12 Third Order helpers: <https://github.com/rbgirard/spiroanim/blob/3f42385010ecd4d5c5a0c78f5f35f7f5391e5ad3/src/features/vtg/thirdOrder.ts>
