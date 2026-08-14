# Forest semantic canopy R2 verdict

Verified 2026-08-14.

## Verdict

Accepted for the current Forest production layer. The six Meshy semantic tree
families are now integrated rather than remaining candidate-only. Their bark
and branch silhouettes are preserved, their fused AI foliage texture is not.
Each species uses a three-surface runtime prototype:

1. the species-specific Meshy bark and branch surface;
2. enlarged, alpha-tested Poly Haven photographic leaf clusters for near and
   middle distance; and
3. an aggressively reduced, texture-free crown shell that fades in from 24 to
   48 metres, with alpha-hashed breakup and a 72 percent maximum coverage.

This resolves both rejected intermediate failures. Individual photographic
leaf components no longer dissolve into bare-tree speckles at forest distance,
and the fallback crown no longer reads as a continuous mint-green foam mass.

## Population proof

- 294 trees across 13 authored ecological clusters.
- 17 structural source silhouettes.
- 119 semantic Meshy trees across beech, hornbeam, birch, tulip, hickory, and
  sycamore families.
- Largest single silhouette share: 42 / 294, or 14.29 percent.
- 128,855 grass clumps remain in the near-frame ecosystem.
- Final mass-tree prototype geometry: 780,330 triangles before instancing.

## Production proof

- `forest-environment.glb`: 20,885,804 bytes, below the 20 MiB ceiling.
- `forest-near-frame.glb`: 18,846,988 bytes, below its delivery ceiling.
- Environment GLB verifier: passed.
- Near-frame GLB verifier: passed.
- Foliage and ground focused tests: 27 / 27 passed.
- `svelte-check`: 0 errors and 0 warnings.
- Scoped diff hygiene: passed.

## Visual proof

- `day-hero-final-r6.jpg`: fixed daytime hero camera.
- `day-trees-final-r6.jpg`: tree-focused middle-distance camera.
- `day-world-final-r6.jpg`: overhead population and placement camera.
- `night-hero-final-r6.jpg`: locked Night regression.

The in-app browser's current compositor repeats a narrow strip at the bottom
edge of captures. That is not scene geometry and was not compensated for in
the Forest assets.

## Honest remaining ceiling

The tree system now has real population and silhouette variation and no longer
depends on one material model. It is still not a walk-up photoreal tree demo:
the semantic crown shell is deliberately distance-only, and the mass forest
keeps 512 px leaf atlases plus aggressive geometry compression to satisfy the
production budget. The separate near-frame layer remains the correct owner for
future hero-tree close-ups.
