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
