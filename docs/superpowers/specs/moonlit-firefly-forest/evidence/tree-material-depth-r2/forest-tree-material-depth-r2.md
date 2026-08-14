# Forest tree material and depth R2 evidence

## Result

The Day tree correction now changes hue only where the decoded leaf color has a
measurable green signal. It preserves the source atlas luminance exactly, makes
the Day rig more directional, and gives the four near-frame crowns internal
depth by reducing indirect diffuse on downward-facing foliage normals. Tree
shadow-map casting remains off, so the alpha-card polygon islands rejected in
R1 do not return.

The Night anchor still deep-equals `createDefaultForestFireflyConfig()`. Night
does not provide `materialResponse`, so neither the foliage grade nor the new
near-frame depth patch mounts on the locked Night Master.

## Atlas measurement

Measurement source:

- `assets/3d-source/forest/polyhaven/jacaranda_tree/textures/jacaranda_tree_leaves_diff_1k.jpg`
- `assets/3d-source/forest/polyhaven/jacaranda_tree/textures/jacaranda_tree_leaves_alpha_1k.png`
- 264,113 pixels visible at the production alpha cutoff of 0.35
- sRGB color decoded to linear RGB before applying either shader formula

| Metric                                            | Problem v4 |    R1 v7 |    R2 v8 |
| ------------------------------------------------- | ---------: | -------: | -------: |
| Pixels receiving a foliage grade                  |       100% |     100% | 82.6639% |
| Neutral/non-green pixels graded                   |       100% |     100% |       0% |
| Mean grade weight                                 |     0.5000 | 0.756339 | 0.133897 |
| Pixels raised by more than 0.002 linear luminance |   71.7204% |       0% |       0% |
| Mean linear luminance                             |   0.194174 | 0.170847 | 0.170847 |
| Linear luminance standard deviation               |   0.037156 | 0.060884 | 0.060884 |
| P90/P10 luminance contrast                        |   1.634743 | 2.931260 | 2.931260 |
| Green-dominant pixels after grading               |       100% |     100% | 91.8141% |

The ungraded source mean is 0.170847, its standard deviation is 0.060884, and
its P90/P10 contrast is 2.931260. R2 retains 100% of both source luminance
dispersion and P90/P10 contrast. Unlike R1, it also leaves the atlas' 8.1859%
neutral/non-green population untouched instead of recoloring every visible
pixel green.

## Day lighting ratios

| Contract             | Problem | R1 input |      R2 |
| -------------------- | ------: | -------: | ------: |
| Hemisphere intensity |    1.12 |     1.02 |    1.00 |
| Key intensity        |    1.78 |     2.40 |    2.40 |
| Fill intensity       |    0.48 |     0.36 |    0.32 |
| Ambient intensity    |    0.22 |     0.13 |    0.11 |
| Key/fill ratio       |  3.7083 |   6.6667 |  7.5000 |
| Key/ambient ratio    |  8.0909 |  18.4615 | 21.8182 |

Against the reported problem state, fill is down 33.33%, ambient is down 50%,
and the key/fill ratio is up 102.25%. Against R1, fill is down a further 11.11%
and ambient is down 15.38%. This removes flat fill without changing the Day key
direction or the Night configuration.

## Near-canopy depth contract

R2 applies a 0.24 orientation-aware attenuation to `indirectDiffuse` only for
foliage cloned under the `near-frame` scope. The normal-map-adjusted fragment
normal controls sky exposure:

| Foliage orientation | Indirect-light retention |
| ------------------- | -----------------------: |
| Downward-facing     |                 76.0000% |
| Horizontal          |                 81.7431% |
| Upward-facing       |                100.0000% |

Direct key light is untouched. Environment, stage, and camp foliage receive a
depth strength of zero. Near-frame trees remain receivers but not casters;
rocks and deadwood continue casting local contact shadows. This is consistent
with Three.js' separation of material fragment lighting from an object's
[`castShadow`](https://threejs.org/docs/pages/Object3D.html) participation and
keeps the rejected alpha-card shadow geometry out of the terrain pass.

## Changed owners

- `src/lib/shared/3d/environments/scenes/forest/forest-foliage-grade.ts`
  owns the measured green gate, luminance-preserving reference transform, and
  near-frame indirect-depth contract.
- `src/lib/shared/3d/environments/scenes/forest/ForestAtmosphereMaterials.svelte`
  applies the v8 shader grade and the scoped indirect-depth response.
- `src/lib/shared/3d/environments/scenes/forest/forest-atmosphere-profile.ts`
  owns the revised Day fill, ambient, and hemisphere values.
- `src/lib/shared/3d/environments/scenes/forest/forest-shadow-roles.ts` keeps
  alpha-card trees out of shadow-map casting and documents the material-depth
  owner.

No tree source asset, GLB, source manifest, procedural tree layout, or static
prop layout changed in R2.

## Verification

- Focused Vitest run: 18/18 tests passed across foliage grading, atmosphere
  anchors, and shadow roles.
- `svelte-check --tsconfig ./tsconfig.json`: 0 errors and 0 warnings.
- The focused tests verify exact luminance preservation, zero neutral-pixel
  grading, scope isolation, the 76%/81.7431%/100% depth response, Day light
  ratios, alpha-card cast suppression, and exact Night Master preservation.
