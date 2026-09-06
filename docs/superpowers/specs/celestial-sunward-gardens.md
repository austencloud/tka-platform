# Sunward Gardens

Celestial's Olive Cloudbreak setting now has a complete Blender-authored
limestone landmass, sheltered olive groves, a peripheral lagoon, eroded mesas,
and a natural arch joining the rear mountain shoulders. The dry performer lane
remains the center of the composition. Winter is unchanged.

The editable source is `blender/celestial/sunward-gardens.blend`. It contains
packed tree textures, individual editable objects, a review camera, lights,
and a preview lagoon. Production loads `static/models/celestial/sunward-gardens.glb`;
the existing shared owner supplies animated water, atmosphere, lighting, and
formation-dependent court sizing to both renderers.

## Rebuild

1. Run `node scripts/prepare-celestial-sunward.mjs` to decode the shipped source
   olives and rocks into the temporary `.sunward-source` directory.
2. Run Blender with `--background --factory-startup --threads 8 --python
scripts/build-celestial-sunward.py`. Set `TKA_CELESTIAL_EVIDENCE` to an external
   evidence directory. This saves the editable file, renders, then exports.
3. Run `node scripts/optimize-celestial-sunward.mjs` to apply mesh instancing,
   WebP textures, and meshopt compression. Its manifest records the output hash.

Static scenery is authored in Blender. Runtime retains only the genuinely
dynamic water and the existing formation-driven scaling of the authored court.
The solo court radius is 6.08 m, its surface remains at 0.225 m, and the eight
performer growth produces a 9.58 m radius inside the 10.2 m dry lane. The lagoon
moves four metres east to preserve that clearance. The old asset catalog remains
available on its review routes and is excluded from production prefetch.

## Provenance

Geology, arch, ground, shoreline, and planting are original Blender geometry.
The two olives reuse the project's shipped Meshy Ancient Olive West and
Windswept Olive East assets. Their prior production record is
`seraphic-vault/seraphic-vault-gate1-r4-asset-production.md`.
Scanned stones reuse the already shipped Poly Haven `coast_rocks_05` and
`sand_rocks_small_01` assets under CC0. No new paid or external assets were used.

Nearby olives retain their source detail; distant olives use reduced meshes.
Stone mineral variation is baked to vertex colors to avoid repeating texture
bands on large cliffs. Float positions retain measured contacts. Exported
tangents remain disabled, matching the verified Winter pipeline; Three.js
derives tangent frames for the olive normal maps.

## Verification

The focused shared-world and adapter suite covers loading declarations, stage
growth without source mutation, world assembly, grounding, visibility,
disposal, animated water, and reduced motion. Svelte diagnostics pass.
Direct browser evidence is stored in the task's `celestial-sunward` visualization
directory. The broad prefetch scan also reports an existing unrelated missing
Rainbow `spectrum-commons.glb` entry; Celestial's entries match its new owner.

Worker verification also corrected the legacy adapter to apply the canonical
stage-height offset, respond to changing performer bounds, and honor reduced
motion. A mocked-loader regression test covers that boundary. The final focused
suite contains ten passing tests; Svelte reports zero errors and warnings.
The GLB validator reports zero errors and four expected derivative-tangent
warnings for the olive meshes.
