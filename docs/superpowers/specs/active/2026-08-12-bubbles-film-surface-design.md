# Bubbles Film Surface Pass

**Status:** Approved for implementation on 2026-08-12

## Outcome

Bubbles reads as transparent soap film in both renderers. The existing 2D
renderer remains the visual reference: a clear center, a grazing-angle rim,
restrained thin-film color, two light responses, buoyant size-dependent motion,
and a short film-fragment pop. The 3D renderer reaches the same contract without
changing saved intents, presets, controls, or palette names.

## Evidence and ownership

Search terms: `bubble material`, `thin film`, `iridescence`, `Fresnel`,
`wireframe`, `soap film`.

- `Bubbles2DRenderer` already owns the complete Canvas presentation and stays
  intact.
- `BubbleRenderer3D` owns pooled Three.js presentation and becomes the one 3D
  simulation owner. It keeps shells and film fragments in separate bounded
  instance pools because their geometry costs differ materially.
- `BubbleEmitter3D` currently duplicates the simulation with per-particle
  Svelte meshes. It will delegate to `BubbleRenderer3D` instead.
- `ParticleInstancePool3D` is the closest instancing infrastructure, but it is
  already being changed by another session and its generic material contract
  cannot carry bubble film data. Bubbles therefore creates one effect-local
  instanced pool with the same allocation-free frame policy.

Relationship: **create** a bubble-specific film material and instanced pool,
then **reuse** them from both 3D entry paths. This is new creative rendering,
not a second generic particle capability.

## Optical model

The film shader uses a bounded real-time approximation of the properties that
make soap bubbles legible:

1. Schlick-like grazing-angle reflectance creates a strong rim and clear center.
2. View angle, per-bubble film phase, and time drive a restrained RGB
   interference sweep.
3. A tight key reflection and a broad opposing bounce break the sphere's
   symmetry without requiring scene-color refraction.
4. Standard alpha blending and camera-relative, back-to-front instance sorting
   keep overlaps soft and avoid allocation-order artifacts.

The approximation follows the same concepts exposed by Three.js
`MeshPhysicalMaterial` (`iridescence`, `iridescenceIOR`, thickness, and
transmission), but avoids its per-pixel physical transmission cost across a
large particle field:

- https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- https://threejs.org/docs/pages/InstancedMesh.html

The physical reference is thin-film reflection and transmission, with the
strongest interference near grazing incidence:

- https://doi.org/10.14935/jssej.38.188
- https://doi.org/10.1016/0095-8522(65)90025-5

## Motion and scale

- The field uses the 2D renderer's power-law size distribution: many small
  bubbles, rare large bubbles.
- World-space size gets an additional bounded scale so no bubble competes with
  a staff or performer.
- Radius swells by only eight percent across a lifetime. Bubbles do not triple
  in size.
- Larger bubbles rise faster; smaller bubbles sway more.
- Per-bubble phase drives mild anisotropic tension wobble.
- The pop briefly collapses the shell and emits four to seven tiny film
  fragments through a two-triangle film-sliver pool. Shells use tier-aware
  icosahedron tessellation, so the 512 tier does not pay the 2,048-tier cost.

## Compatibility

- `BubblesIntent`, storage, presets, controls, palettes, and translators do not
  change.
- Scene batching remains two bounded draws: one for curved shells and one for
  materially cheaper film fragments.
- The fallback renderer uses the same simulation and material as the scene
  manager.
- Disabling emission lets existing bubbles complete their lifetime instead of
  disappearing immediately.

## Risks

- Transparent instances are sorted back-to-front from the active camera before
  each draw. Sorting is bounded by the resolved 512/1,024/2,048 pool tier.
- A physically complete spectral integration would be too expensive here. The
  three-channel phase approximation is deliberately art-directed and bounded.
- More sphere segments improve hero-scale silhouettes but raise vertex cost.
  Shell detail therefore follows the capacity tier, while fragments use a
  two-triangle plane instead of sphere geometry.

## Verification

1. Pure tests prove size bounds, lifetime swell, pop collapse, and fragment
   count.
2. Material tests prove the film shader keeps Fresnel, interference, clear
   center, normal blending, color management, and single-pass transparency.
3. Renderer tests prove one instanced mesh, stable attributes, bounded writes,
   clear, and disposal.
4. The production 16-count effect-preview LOOP drives the effect-grid hero and
   full-roster views.
5. Before/after review covers 1920x1080, 2560x1440, 3840x2160, 1440x900,
   820x1180, 960x412, and 375x667. The visual gate checks scale, clear centers,
   controlled overlap, recognizable pop, 2D/3D parity, and scene readability.
