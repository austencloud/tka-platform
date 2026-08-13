# Forest SpeedTree pilot verdict

## Decision

Reject the SpeedTree pilot for Forest production. Keep the current authored
placement, production trees, Blender bake, GLB delivery, and Threlte runtime.
Do not buy SpeedTree or a species pack for this scene.

The isolated candidate proved that semantic bark and foliage surfaces are
useful. The live Forest comparison failed the composition gate. One broad,
root-heavy oak repeated across 68 placements turned the clearing into a canopy
wall and read far larger than the compact silhouettes those placements expect.
Nominal height matching did not correct crown width, root spread, repetition,
or visual mass.

Austen rejected the purchase path on 2026-08-10 after reviewing revision 97.
The runtime override was then removed from the Forest scene and review route.
The licensed evaluation evidence remains quarantined for pipeline research.

## What passed

- The SpeedTree oak has separate bark, cut wood, outer foliage, and inner
  foliage surfaces. The current Meshy oak has one material for the whole tree.
- Bark remains dry gray-brown in daylight. No green wash crosses from foliage
  onto the trunk.
- Major limbs, secondary branches, pruning scars, crown gaps, and leaf-scale
  breakup remain readable at neutral, human-height, and trunk cameras.
- The live Forest review route replaces the existing `canopy-beech` prototype
  across all 68 authored instance matrices. It does not move the stage,
  campsite, paths, clearing, or any tree placement.
- The live swap renders four semantic surfaces per oak and preserves the
  source instance count.
- The candidate stays close to the current geometry budget: 36,760 triangles
  against 34,151. It uploads 41,699 vertices against 60,755 for the Meshy oak.
- The corrected runtime GLB is 3,393,372 bytes against 1,559,680 bytes. The
  extra 1.83 MB buys botanical structure and four independently gradeable
  material families.

## What failed during the proof

The generic glTF `optimize` transform damaged the old ORCA foliage layout and
produced visible rectangular cards in Chromium. Lossy WebP foliage conversion
was tested separately and rejected as well. The final evaluation build keeps
the two foliage diffuse atlases as PNG, compresses the opaque and normal maps,
and preserves the authored geometry and UVs. The browser then matches the
source render.

That failure is useful pipeline evidence: tree assets need a vegetation-aware
optimization contract. They cannot be sent through the same blanket transform
used for opaque props.

## Why this exact oak does not ship

The source is SpeedTree's 2017 ORCA White Oak, distributed under CC BY-NC-SA
3.0. It is valid for evaluation and not valid for this commercial production.
The sample also has long exposed root tips and only one mature crown shape.
Using it for every mature-oak placement makes the forest repetitive.

The candidate remains quarantined under
`static/models/forest/trees/candidates/evaluation-only/`. The production oak
was not replaced.

## Lessons retained

Any later generated-tree candidate must provide separate bark and foliage
control, calibrated crown and root footprints, more than one silhouette, and a
vegetation-aware optimization path. It must beat the current Forest through the
same live cameras before a production tree or placement changes. The next
Forest work stays on the approved sky, sun, cloud, shadow, and time-of-day lane.

## Evidence

- `speedtree-pilot-contact-sheet.png`: matched isolated cameras.
- `speedtree-pilot-live-hero-comparison.png`: current and SpeedTree Forest
  renders with the same hero camera and placements.
- `speedtree-pilot-live-oak-close.png`: live bark, cut wood, root, and foliage
  response.
- `speedtree-pilot-runtime-metrics.json`: license boundary, hashes, dimensions,
  materials, and runtime deltas.
