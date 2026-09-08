# Blue Hour Lodge

Winter's current production venue, replacing Moonlit Winter Hollow on 2026-09-05.
The former asset and its evidence remain available.

The performer occupies a 15.4 m slate court connected to a sheltered alpine
longhouse. A glazed larch facade, reading room, broad promenade, side hearth,
frozen tarn and mixed-age conifers form the middle distance. Three sculpted
mountain ridges enclose the basin. The entrance and shore paths reach actual
destinations, and furniture starts beyond the clear floor.

## Source and delivery

- Editable, packed source: `blender/winter/blue-hour-lodge.blend`.
- Production asset: `static/models/winter/blue-hour-lodge.glb`.
- Measurements, checksum and size: `blue-hour-lodge-manifest.json`.
- Scene review: `/test/winter-scene`; add `?performers` for the real viewer or
  `?performers&worker` for its worker backend.

Re-export edits made in Blender from the repository root:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --factory-startup --threads 8 --python scripts/blender-export-winter-bluehour.py
node scripts/optimize-winter-bluehour.mjs
```

`scripts/build-winter-bluehour.py` reconstructs the initial composition from the
previous Winter source library. If that untracked authoring library lives outside
the checkout, set `TKA_WINTER_SOURCE` to its absolute `.blend` path. This is only
needed for reconstruction; the committed new source contains the reusable assets
and packed images needed for normal Blender editing and export.

The exporter preserves semantic roles and excludes cameras, authoring lights and
the Blender pond preview. The optimizer retains shared conifer meshes as GPU
instances and caps textures at 1024 pixels. Runtime owns the existing sky, moon,
snow, smoke, volumetric fire, ice material and lighting. Both renderer adapters
construct the same `winter-environment-world`; the boot manifest prefetches the
new asset. Ground height and cast growth use the canonical stage owners.

Exported tangent attributes caused black frames in the production bloom pass on
the review GPU. The final export omits them and retains the normal maps; Three.js
derives tangent frames from the UVs. glTF Validator reports eight generated-tangent
warnings for this intentional choice. Both production renderers were inspected
with bloom active after the correction.

## Asset provenance

- Lodge, interior, court, paths, furniture, lanterns, terrain and ridges: original
  geometry authored in Blender for this project in this task.
- Four conifer families: the project's previously shipped Meshy Winter trees,
  reused from `blender/winter_environment.blend`. Their source prompts and task
  records remain in `scripts/winter-meshy-assets.json`,
  `scripts/winter-tree-layout.json`, and the prior Winter asset records. No new
  generation service, purchase or model download was used.
- Boulder geometry: the previously shipped Poly Haven `boulder_01` and `rock_07`
  scans (CC0), with a new shared granite material.
- Snow surface: the existing ambientCG Snow004 CC0 texture set. The source
  archive and checksum are recorded in `scripts/fetch-winter-environment-assets.mjs`.
- Ice and moon textures: unchanged project assets used by the existing runtime.

## Verification

Focused tests cover the canonical foot plane through cast growth, retained scene
resources, reduced motion, and shared renderer ownership. The production renderer
is the visual authority; Blender renders are authoring evidence. Runtime captures
record arrival, walking, reverse, shore, wide views, the supported viewport matrix,
and real performer casts. See `blue-hour-lodge-verification.json` for the delivered
build's observations and their limits.
