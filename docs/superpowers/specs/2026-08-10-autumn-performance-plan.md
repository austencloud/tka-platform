# Autumn 3D Performance Contract

**Status:** complete

## Outcome

Make the authored Autumn scene capture-ready at its intended high-quality look.
The optimization must preserve the current hero, depth, settlement, and root
contact compositions. No prop family may disappear from the high tier.

## Measured baseline

The production GLB currently contains 11,630,496 rendered vertices. In the
fixed hero harness, the renderer reports 7,761,400 triangles and 278 calls per
sample. A single 54-instance fern batch accounts for 2,278,314 source triangles
before the renderer's additional passes. The high tier sustains 60 FPS at a
3840 × 2160 backing buffer on the current development GPU, but it has little
geometry headroom for recording, heat, post-processing, or weaker hardware.

## Scope

- Build one texture-preserving web LOD for the repeated Meshy fern source
  before Blender duplicates its hierarchy.
- Keep the 54 authored fern placements, their transforms, and their shared GPU
  instancing batch.
- Let Autumn's runtime effects and shadow budget follow the live adaptive tier,
  not only the renderer tier detected at scene load.
- Add an asset verifier that locks the compression extensions, file budget,
  fern instance count, fern geometry ceiling, and scene-wide rendered geometry
  ceiling.
- Extend the existing review harness with explicit DPR and quality controls so
  1440p and 4K comparisons are repeatable.

## Acceptance gates

1. The optimized GLB remains at or below 20 MiB and retains meshopt, KTX2, GPU
   instancing, and mesh quantization.
2. The fern source is at or below 8,000 triangles, with exactly 54 instances.
3. Scene-wide rendered geometry is at or below 2.2 million triangles before
   runtime passes, down from roughly 3.88 million.
4. The high-tier hero view sustains at least 57 FPS after warmup at a 3840 ×
   2160 backing buffer on the current development GPU.
5. Hero, settlement, and root-contact screenshots retain fern massing,
   grounding, path continuity, lighting, and foreground silhouettes.
6. Under sustained frame pressure, Autumn follows the shared live tier so DPR,
   grass density, particles, wisps, and shadows step down together.

## Risks and controls

- **Fern silhouette erosion:** inspect hero and close ground views after the
  Blender rebuild. Raise the source ratio if individual fronds read faceted.
- **Source drift:** enforce counts and budgets from the final optimized GLB,
  not from Blender console output alone.
- **False performance win:** compare the same camera, tier, DPR, and warmup
  window before and after.
- **Visual downgrade disguised as optimization:** keep high-tier placements,
  textures, material grading, lighting, and runtime counts unchanged.

## Verification

- Python compile and the Autumn scene's focused unit tests.
- Blender rebuild and its existing placement/collision validator.
- Optimizer plus the new GLB performance verifier.
- Browser screenshots and warm performance samples at hero, settlement, and
  root-contact views, including a 4K-backing-buffer hero pass.

## Final evidence

- Blender source fern: 44,935 → 7,189 triangles.
- Optimized GLB fern: 7,108 triangles × 54 instances = 383,832 rendered
  triangles, down from 2,278,314.
- Whole optimized environment: 1,982,350 rendered source triangles, down from
  roughly 3.88 million.
- Renderer hero sample at 3840 × 2160: 7,761,400 → 3,972,400 reported
  triangles, stable at 60 FPS before and after.
- Settlement sample at 3840 × 2160: 3,797,800 reported triangles at 60 FPS.
- Close fern/root sample at 3840 × 2160: 1,808,400 reported triangles at 60
  FPS.
- Runtime asset: 16,982,540 bytes, 46/46 textures KTX2, meshopt and GPU
  instancing intact.
- Automated checks: 20 focused Autumn tests passed; `svelte-check` reported 0
  errors and 0 warnings; browser console reported 0 errors.
