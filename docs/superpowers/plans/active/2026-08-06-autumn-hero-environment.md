# Autumn Hero Environment Implementation Plan

## Outcome

Replace the Autumn scene's flat textured disk and low-poly perimeter kit with
one authored, editable Blender environment. The target is an enchanted dusk
clearing with strong foreground-to-background depth, two distinctive hero-tree
silhouettes, a sculpted forest floor, a readable pond shore, and restrained
bioluminescent accents. The performer area remains clear and level.

## Source of truth

- `blender/autumn_environment.blend` is the editable environment source.
- `scripts/build-autumn-environment.py` rebuilds that source and its QA render.
- `scripts/blender-export-autumn-full.py` creates the uncompressed export.
- `scripts/optimize-autumn-environment.mjs` creates the web-delivery GLB.
- `static/models/autumn/autumn-environment.glb` is the runtime asset.

The two hero-tree prototypes come from Meshy multi-image reconstruction using
curated references in `assets/meshy-refs/autumn/hero-tree-a/` and
`assets/meshy-refs/autumn/hero-tree-b/`. Existing Meshy fern and fallen-log
assets are reused as linked Blender instances. Existing scanned Poly Haven
stones are decoded into a Blender-readable authoring cache, linked throughout
the scene, then recompressed with the full environment for delivery.

## Composition

1. Keep a level, obstruction-free clearing around the origin.
2. Shape a recessed, elliptical pond basin at the runtime pond coordinate,
   with clustered partially buried stones and floating autumn leaves.
3. Place the upright hero tree as a monumental rear and side anchor.
4. Use the windswept hero tree to create two asymmetric framing arches.
5. Build depth with linked midground tree repetitions, rocks, logs, ferns,
   leaf litter, and a raised outer terrain ring.
6. Use ecological placement masks: no vegetation in the pond or performance
   clearing; tree, log, and stone clearance; shaded fern clusters; root and
   log leaf drifts; paired shoreline-stone clusters rather than even spacing.
7. Preserve two staggered sightline openings so the orbit camera never depends
   on one privileged front view.
8. Keep particles, wisps, animated pond normals, fog, and sky in the runtime
   layer.

## Runtime integration

`AutumnScene.svelte` loads the optimized authored environment and reports its
real load progress to the scene curtain. The previous textured ground and
low-poly flora scaffold are removed from this scene. The existing authored
mushroom grove remains a separate runtime object so its emissive treatment and
interaction hooks stay available. `AutumnPond.svelte` matches the authored
basin's center, radii, outline seed, and recessed water level, then animates the
two water-normal textures already used by the procedural water system.

## Risks and controls

- **Asset weight:** linked mesh data in Blender, GPU instancing during GLB
  optimization, WebP textures, meshopt compression, and measured output size.
- **Performance-space obstruction:** terrain height is forced flat near the
  origin and verified before export.
- **Tree repetition:** two unrelated prototypes, irregular scale, rotation,
  mirroring, depth, and partial fog occlusion.
- **Coordinate mismatch:** Blender Z-up authoring follows the existing export
  convention and converts to glTF Y-up.
- **Fallback behavior:** the loading curtain has the existing timeout safety
  valve; a failed asset load must not strand the workspace.

## Verification

- Meshy tasks must report `SUCCEEDED` and write non-empty GLBs.
- Blender must save the editable source, prove the clearing and ecology
  invariants, and write hero, pond-detail, and reverse-camera QA renders.
- The export optimizer must inspect the final GLB and report its dimensions,
  draw-call tables, texture sizes, and total file size.
- Focused Autumn unit tests must pass.
- The Autumn harness must be visually checked at desktop and 4K viewports with
  no new console errors.
