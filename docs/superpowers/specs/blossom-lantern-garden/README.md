# Blossom lantern garden

Replacement for the rejected moonlit amphitheatre. Austen authorized a complete redesign and direct work in the primary checkout in the September 5 handoff. Visual acceptance remains pending; passing the technical checks does not establish a design score.

The garden uses a rounded 12 × 8 m slate court, a continuous stone apron and approaches, broad front steps, a crescent pond, eight low washi lanterns, four lanterns hung from sampled branch positions, planted rock banks and 26 botanical cherry trees. A 17 m main tree anchors the pond. The protected performance volume and two circulation routes remain part of the authored plan.

## Reproduction

Run from the repository root, sequentially:

```powershell
$env:BLOSSOM_SKIP_RENDER='1'
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --factory-startup --threads 6 --python scripts/build-blossom-lantern-garden.py
node scripts/optimize-blossom-glb.mjs
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --factory-startup --threads 6 --python scripts/verify-blossom-lantern-garden.py
node scripts/verify-blossom-composition.mjs
```

The builder saves `blender/blossom/lantern-garden.blend`, an ignored editable source. `scripts/blender-export-blossom-full.py` exports subsequent Blender edits. The existing `amphitheatre-plan.json` and `amphitheatre-manifest.json` filenames remain the active runtime contract; their contents identify the lantern garden.

## Source assets

Botanical branches and the cherry flower atlas come from the existing `blossom-plantfactory-family-r1` family, with licensing recorded in `scripts/blossom-plantfactory-family.json`. The builder reconstructs full-UV blossom cards instead of retaining elongated oak leaf polygons. Project moss, stone and bark maps are packed into the GLB. This is an embedded scene, not a standalone redistribution of the PlantFactory source library.

`composition-reference.png` is generated concept art. It is a composition target, not a screenshot of the implemented scene. Runtime screenshots are labelled separately.

## Verification

- 75 focused tests pass across ten suites, including court bounds, material borrowing and disposal, quality tiers, water coordinates, production contracts, opening cameras, welcome transitions, selection scope and performer facing. One pre-existing Ember test remains a TODO.
- Actual Blender vertex checks pass for 56 relevant meshes: no roots in the pond, no objects in the performance volume, and clear approaches between 0.25 m and 2.4 m above walking grade. Both approach grades remain below 3.51%.
- The optimized export is 12.82 MiB, with 3,367,696 authored visible triangles. Four near trees preserve individual shadow ownership; the remaining grove uses shared GPU instances.
- These are sampled geometry checks, not collision certification. The legacy audience target of 48 remains unvalidated.

See the evidence directory for the geometry and delivery reports. Browser review is recorded separately from these technical checks.

The shared opening-camera owner now uses the authored Blossom view when no neighboring 2D card needs alignment. The single-performer welcome transition preserves this composition; larger casts retain their group framing. Portrait screens use a wider, offset composition. Blossom's performer heading follows its reversed stage axis, and the worker renderer receives the same authored opening pose. Saved user camera poses continue to take precedence.
