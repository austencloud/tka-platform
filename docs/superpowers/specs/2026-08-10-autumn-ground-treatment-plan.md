# Autumn ground treatment plan

## Target

Raise the Autumn scene's weakest surface from a uniform forest-floor tile with visible overlay seams to a continuous, authored living floor. The performance clearing, route to the shack, depth trail, pond bank, root zones, moss, and leaf-duff beds must read as one ecosystem from hero, walking, overhead, and settlement views.

## Ownership

`scripts/build-autumn-floor-textures.mjs` owns the baked ground appearance. `scripts/autumn-ground-layout.json` owns the spatial contract shared by the texture bake and Blender authoring. `scripts/build-autumn-environment.py` owns geometry, dual UVs, and contract metadata. The runtime continues to consume the single optimized Autumn GLB.

This extends the proven Forest scene treatment: macro color lives on a world-space UV while normal and roughness retain a repeating detail UV. No runtime decal system, duplicate terrain renderer, or new procedural effect is introduced.

## Changes

1. Bake one world-space Autumn atlas from the existing soil, packed earth, leaf duff, cool shadow, and moss sources.
2. Blend ecological regions with broad feathered masks and deterministic noise. Preserve a tamped clearing, collect duff beneath tree crowns and deadwood, cool the root pockets, darken the pond bank, and keep moss restrained.
3. Bake both paths and settlement yards into the same atlas so they cannot intersect, float above, or disappear beneath the terrain and apron.
4. Give the terrain and fog apron a shared macro UV plus a separate 5.2-metre detail UV for normal and roughness.
5. Replace the former moss, yard, and path overlay meshes with metadata anchors. Keep their names, lengths, destinations, and roles available for verification without retaining visible cut-paper geometry.

## Acceptance gates

- Hero ground has no pale floating polygons or hard circular moss boundaries.
- The cabin lane reads continuously from the stage clearing to the shack door, including across the 31-metre terrain/apron seam.
- The forest trail remains subordinate to the cabin lane and preserves the central sightline.
- The clearing stays flat and performance-safe, with no added runtime animation or scatter count.
- Both ground meshes expose macro and detail UV sets, the GLB retains meshopt, Basis Universal textures, quantization, and instancing, and stays below 20 MiB and 2.2 million source-render triangles.
- The 4K hero view remains at the existing 60 FPS ceiling with no new console errors.
- Matched before/after captures are produced for hero, walking-ground, overhead, and settlement views.

## Completion evidence, 2026-08-10

- The baked ground atlas is 2048 x 2048 in the optimized GLB. Macro color uses
  `TEXCOORD_1`; repeating normal and roughness detail use `TEXCOORD_0`.
- The stage-to-shack lane begins beneath the stage edge and is baked into the
  same atlas as the clearing, terrain, and fog apron. No visible path overlay
  mesh remains to clip against the floor.
- Tree grounding now measures the transformed underside of each root plate in
  terrain-space cells. All 84 tree placements passed with 6,837 contact
  samples and a worst post-grounding clearance of -0.140 m.
- The owl tree, `HeroTreeA_03`, was lowered 1.430 m from 433 root-envelope
  samples. Its owl and connector inherit the same offset.
- Runtime evidence:
  - `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\after-hero-ground-v2.png`
  - `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\after-settlement-ground-v2.png`
  - `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\after-owl-root-contact-v2.png`
- Verification passed: 18 focused Autumn tests, `pnpm check` with zero errors
  and zero warnings, 16.15 MiB optimized GLB, 1,981,355 rendered source
  triangles, and zero uncompressed textures.

## Final living-floor pass, 2026-08-10

The first atlas pass solved the overlay seams but still lost too much of its
route and soil colour under the violet moon rig. The final treatment now has
three coordinated scales:

- a 2048 x 2048 world-space ecological atlas for the clearing, cabin lane,
  depth trail, root pockets, pond bank, duff beds, and settlement yards;
- a separately compressed 1024 x 1024 repeating modulation map for leaf-scale
  colour at walking distance; and
- stable world-space shader variation that preserves broad value breakup and
  the compacted cabin lane after PBR lighting, fog, mip reduction, and tone
  mapping.

The cabin lane uses the same authored spline as the bake and geometry exclusion
rules. Its soft shoulders begin beneath the stage edge and terminate at the
shack door. Hero-tree crowns are receive-only in the clearing shadow pass; this
removes the former screen-sized polygon islands without discarding compact
shadows from logs, rocks, ferns, the owl, or settlement props.

The physical floor was rebuilt with 3,504 smaller leaf pieces and 2,000 thinner,
darker grass clumps. All 84 trees passed transformed root-envelope grounding;
the owl tree's highest sampled root contact remains 0.140 m below terrain.

Final runtime proof:

- `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\after-hero-ground-v6.png`
- `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\after-settlement-ground-v6.png`
- `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\after-walk-ground-v6.png`
- `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\after-owl-root-contact-v6.png`
- Hero, settlement, walking, and owl-root browser consoles: zero errors and
  zero warnings.
- Focused Autumn tests: 20/20 passed.
- `pnpm check`: zero errors and zero warnings.
- Optimized GLB: 18,166,992 bytes, 2,004,286 rendered source triangles, 47
  KTX2 textures, and zero uncompressed textures.

## Depth asset-cohesion pass, 2026-08-10

The textured birch, larch, snag, and willow families keep their existing mesh,
texture, and placement contracts. Their optimized material factors now share a
controlled copper, gold, wine, and umber grade, with family-specific roughness
and normal response. A material-local runtime grade is applied after fog so
the middle grove retains seasonal colour instead of turning silver. Hero-tree
materials are excluded, preserving the foreground's stronger red/gold contrast.

The scene fog moved from cool violet to warm plum. This preserves moonlit depth
while tying the imported grove, procedural horizon silhouettes, ground, and
cabin sightline into one palette. No Meshy generation or new geometry was
needed.

Evidence:

- `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\before-cohesion-hero.png`
- `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\after-cohesion-v4-hero.png`
- `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\after-cohesion-v4-settlement.png`
- `C:\Users\Austen\AppData\Local\Temp\tka-autumn-ground-treatment\after-cohesion-v4-walk.png`
- Hero, settlement, and walking browser consoles: zero errors and zero warnings.
- Focused Autumn tests: 23/23 passed.
- `pnpm check`: zero errors and zero warnings.
- Optimized GLB: 18,166,992 bytes, 2,004,286 rendered source triangles, 47
  KTX2 textures, and zero uncompressed textures.
