# Blossom hanami review — 2026-09-05

The rebuilt garden uses 31 nearby cherry trees from six source silhouettes,
112 background instances, nine backed timber benches, six hanging paper
lanterns, eight stone lanterns, planted banks, and settled and falling petals.
The runtime deck now honors the plan's 12 × 8 m minimum footprint while
retaining the shared performer height. Stage planks share one instanced draw.

The grove was brought closer and given actual horizontal canopy sizing.
Walking routes were curved and their junction tangents softened. The final
browser review exposed kerbstones crossing junction paving; the builder now
excludes edging from landings and intersecting paths. Sky, water, bark,
petals, and practical lighting were adjusted together. Exported tree and
ground names now participate in runtime shadows.

## Technical evidence

- [Export validation](../blossom-hanami-technical-validation.json): 17.00 MiB;
  3,705,298 authored triangles, including instances but excluding the runtime-hidden
  stage/backdrop proxies. GPU instancing, Meshopt, and WebP remain enabled.
- [Evaluated geometry audit](../blossom-hanami-geometry-validation.json): all
  31 hero trees passed the sampled 2.4 m walking-headroom and protected performance
  checks; all 12 junction pads have zero edging vertices inside their checked
  interior. Hanging lanterns remain above 3 m.
- Shared spatial validation: 136 audience capacity, four wheelchair bays,
  13 connected public nodes, 12 public and two service paths, 171 sightline rays,
  and 4.5% bridge slope. These are geometric checks, not a venue certification.
- Focused Vitest suite: 38 tests across masterplan, production contract, runtime
  tiers, ground, and the environment world. Focused runtime ESLint and whitespace
  checks also passed.

## Browser evidence

Reviewed in the task-owned in-app browser on localhost port 5186. Port 5173 was
left untouched. Camera coordinates below use viewer axes, not Blender axes.

| View            | Camera / target / FOV   | Evidence                                           |
| --------------- | ----------------------- | -------------------------------------------------- |
| Garden overview | 25,16,-34 / 0,2,5 / 48  | [Final overview](wide-final.jpg)                   |
| Stage reverse   | 0,2.2,7 / 0,2,-22 / 65  | [Final cleared junctions](stage-reverse-final.jpg) |
| Bridge approach | -21,2.3,0 / 1,2,22 / 55 | [Final bridge view](bridge-final.jpg)              |
| Audience eye    | 0,2,-19 / 0,3,8 / 55    | [Audience view](audience-eye.webp)                 |

Viewport inspection covered 375×667, 960×412, 820×1180, 1440×900,
1920×1080, 2560×1440, and 3840×2160 CSS pixels. Compact layouts retained
the performer/scene controls and playback strip. Large views retained the
stage focal point and grove enclosure. Native captures are JPEG; the earlier
camera captures are WebP. Viewport captures precede the last kerb-only export;
the final overview, reverse, and bridge images show that correction.

Low quality was exercised with two-core emulation and reduced motion. A settled
375-pixel sample measured 60 FPS, 17.1 ms P95, 4.5 ms GPU95, and 110 draw calls.
High-quality samples ranged from 51–60 FPS, with roughly 292–296 draw calls
and 9.14 million submitted triangles across render passes. Scene startup,
shader warmup, and simultaneous local work caused larger frame-time spikes.
These are local development observations, not a sustained benchmark or physical
phone measurement. The focused runtime tests also cover reduced-motion policy.

The final export at 1440×900 settled at 60 FPS, 22.2 ms P95, 31.7 ms P99,
6.6 ms GPU95, 1.04% long frames, 292 draw calls, and 9.135 million submitted
triangles. Startup spikes remain visible when reloading the scene.

The historical rejected visual status remains intact. Current authoring is
authorized separately; technical success does not manufacture Austen's visual
acceptance or an objective “10/10” score. The garden retains an open audience
lawn and a stylized tree/ground treatment, visible in the review images.

## Rebuild

From the repository root, run the Blender builder with six threads, then open
the saved blend with `scripts/verify-blossom-authoring.py`, export with
`scripts/blender-export-blossom-full.py`, and run
`node scripts/optimize-blossom-glb.mjs` followed by
`node scripts/verify-blossom-composition.mjs --technical`.
`BLOSSOM_SKIP_RENDER=1` skips only the Blender QA image. The editable blend and
raw GLB are local generated files; the reproducible authoring scripts and
optimized delivery GLB are tracked.
