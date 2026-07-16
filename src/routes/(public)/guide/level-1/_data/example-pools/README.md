# Guide example pools

`permutations.pool.json` is the single on-disk source for the permutations page's
refreshable example pools (Mirrored / Rotated / Swapped). It is a **verbatim copy**
of the curated pilot slate that lives with the design spec:

- Source of truth: `docs/superpowers/specs/2026-07-16-guide-example-pools-pilot-data.json`
- Design + lifecycle: `docs/superpowers/specs/2026-07-16-guide-example-pools-design.md`

Each candidate's steps use `step` keys (nomenclature: a **step** is one pictograph
in a sequence - never "beat"). Step data is captured verbatim from MCP
`generate_sequence` responses; prose is verified against those exact instances.

`pool-adapter.ts` turns each candidate into a playable `PictographData[]` strip
using the same canonical primitives the hand-authored content uses
(`createMotionData`, `getGridPositionFromLocations`, `bakeReversals`). It ships all
12 pilot candidates so Austen can curate (keep / cut / edit) by seeing animation +
prose + step strip together. Cuts happen after his pass - update the source spec
JSON first, then re-copy it here.
