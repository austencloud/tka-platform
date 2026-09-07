# Distant flank activity

2026-09-05. Austen explicitly requested more distant lava without going overboard, to convey a genuinely active volcano around the performer. Tracker authority: `j3ejDU3TZSXpXz7By4mh`; existing end-to-end production delegation: `HyW3fFQVRHU3Uc0ezeWO`. These authorize implementation, not a claim of user review of this artifact.

## Authored addition

Three subordinate channels extend the existing network onto quieter flanks:

| Route | Length | Descent | Clearance beyond 4.5 m action envelope |
| --- | ---: | ---: | ---: |
| Western distant flow | 338.30 m | 119.36 m | 98.59 m |
| Far eastern flow | 290.50 m | 85.76 m | 84.13 m |
| Lower western breakout | 168.22 m | 46.68 m | 110.26 m |

Every half-metre centreline sample strictly descends the unchanged terrain. Raycasts prove roots overlap existing active channels, including the lower breakout's parent. All three continue to the south scene boundary. Uneven width and fixed cooler reaches interrupt the glow; this is an authored surface interpretation, not a new fluid simulation or a claim of geophysical prediction.

The source is `blender/ember-mountain-tributaries-r1.blend`. The builder asserts that every pre-existing mesh retains its vertex digest. Terrain, bench, close river, previous tributaries, and rock masses are not rebuilt. The full network plan and per-channel geometry evidence are generated as `measured-flow-plan.svg` and `build-report.json`.

## Existing owners

Extend `scripts/build-ember-tributaries.py` and the existing optimizer with `--distant`; retain their R1 modes. Deliver `blender/ember-mountain-tributaries-r2.blend` and the matching versioned GLB. The canonical GLB is 3,344,180 bytes, 349,728 bytes larger than R1, with 19 mesh primitives.

Reuse the shared `ember-midflank-finish.ts` material and animation owner for both renderers. Green/red vertex-color ratio still controls heat. Blue/red now controls reflection: the old streams retain unit reflection; new distant crust uses 0.06 to avoid a white ribbon in grazing light. This correction follows direct visual inspection. The moving texture uses the same downstream UV convention and clock. Ninety-six new small rafts use the existing instanced draw (400 total); no additional animation loop, light, texture, dependency, paid asset, or loader is introduced.

## Verification

- Ten focused tests pass with the repository's explicit jsdom configuration. Actual optimized GLB checks cover downhill UV and trajectories, metre-scale drift, stage clearance, cold-material exclusion, heat variation, exported low-reflection mask, reduced-motion freezing, disposal, and worker/legacy world parity.
- Focused production TypeScript lint passes. Full Svelte check: zero errors and zero warnings.
- Browser review uses the actual shared environment world at the user's western and eastern angles, plus lower-country and overview views. Screenshots record the final appearance. This local 3D addition does not change responsive UI structure.
- The isolated shared-world preview reports 20–24 draws depending on view; this is not a full-viewer performance benchmark.

Scene gates retain their historical authority and Gate 4 remains in progress. The previously recorded cold-boot input-gap failure is not resolved or waived by this task. No final user acceptance, deployment, or Meshy spending is claimed.
