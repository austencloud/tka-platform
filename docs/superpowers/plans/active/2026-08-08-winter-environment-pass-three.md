# Moonlit Winter Hollow: Pass Three Gated Production Plan

- **Date:** 2026-08-08
- **Status:** Gates 0 through 2 approved. Gate 3 performance-stage form is
  implemented and ready for Austen's visual review.
  The shared celestial-sky correction is accepted spatially; final moon
  luminance and atmospheric balance remain owned by Gate 12.
- **Previous work:**
  [pass-two design](../../specs/active/2026-08-08-moonlit-winter-hollow-design.md)
  and
  [pass-two implementation plan](./2026-08-08-winter-hero-environment.md)
- **Review authority:** Austen approves or rejects every visual gate.

## Target

Rebuild Moonlit Winter Hollow until it reads as a complete winter place from
the hero camera, walking height, close range, and free orbit. The high-angle
view must not expose a rectangular snow slab, sparse prop scatter, or objects
that only work from one camera.

The accepted scene should have these immediate reads:

- a natural snow hollow with no visible hard world edge inside the legal orbit;
- an ice stage embedded in the clearing, not a circular object placed on top;
- a frozen pond with a shoreline, shelves, snow banks, and visible depth;
- a dense mixed-age evergreen forest with both lush and thin silhouettes;
- grounded stone, deadwood, and stump groupings that belong to the site;
- a campfire with a built fire bed, convincing fuel, embers, and local light;
- Forest's shared moon and stars inside a believable night horizon;
- one clear focal hierarchy: stage first, fire and pond second, forest frame
  third.

Pass three is not one uninterrupted build. It is a sequence of small art
decisions. One visual system changes at a time, then work stops for Austen's
review.

## Why pass two failed

The failure is structural, not a final-polish problem.

- `scripts/build-winter-environment.py` builds terrain from a 70 by 70 metre
  square. The test route allows a 70 metre orbit, so the world boundary is
  visible from a legal camera position.
- `IcePlatform.svelte` constructs the stage from `CircleGeometry` and a
  cylinder. The geometry itself creates the coin-like read.
- The pond outline begins with 6 by 4.4 metre ellipse proportions and only
  small radial perturbations. From above, it still reads as an egg.
- Forest, rock, and deadwood placement tables establish isolated objects, not
  enough connected masses to fill the full environment.
- The hero camera hides several of these weaknesses. A free-orbit review must
  therefore be a release gate, not an optional diagnostic.

## Production rules

1. Only one numbered phase may be active.
2. Work stops after every review packet. The next phase does not begin until
   Austen explicitly approves the current gate.
3. Revisions stay inside the rejected phase. Downstream work does not cover an
   unresolved form, scale, or composition problem.
4. Shape and placement are reviewed before expensive material polish when the
   two can be separated.
5. Every packet uses the same fixed cameras so changes can be compared without
   camera drift.
6. The free-orbit `world` view is always included. A camera crop cannot hide a
   weak boundary or sparse region.
7. Approved phases are treated as locked. A later regression returns to the
   phase that owns it and is shown again.
8. No new parallel owner is created for moon, stars, fire particles, snow
   particles, model loading, or glTF optimization.
9. The Blender build remains deterministic. Source assets, placements, QA
   cameras, exports, and assertions must be reproducible from scripts.
10. The production GLB remains at or below 20 MiB unless a review packet shows
    the measured benefit and Austen explicitly accepts a larger budget.

## The review packet

Every gate delivers a live link and a compact visual packet. The packet
contains only the active phase plus enough surrounding context to judge it.

### Fixed scene views

| View      | Purpose                                                       |
| --------- | ------------------------------------------------------------- |
| `hero`    | Primary composition and focal hierarchy                       |
| `reverse` | The side the original hero camera can hide                    |
| `walk`    | Eye-level scale, clear paths, and ground contact              |
| `pond`    | Pond shape, banks, and material at useful distance            |
| `trees`   | Crown density, trunk scale, and snow loading                  |
| `props`   | Rocks, stump, logs, burial, and contact shadows               |
| `world`   | High oblique view of the whole environment and every boundary |

`world` is added before art changes begin. Its camera must fit inside the
existing 70 metre orbit limit and reproduce the failure shown in Austen's
2026-08-08 screenshot.

### Evidence supplied at each gate

- before and after images from the relevant fixed views;
- one deliberately unflattering angle chosen to expose the active system;
- a live `https://localhost:5173/test/winter-scene?view=...` link;
- the seven required browser sizes: 1920x1080, 2560x1440, 3840x2160,
  1440x900, 820x1180, 960x412, and 375x667;
- console status, renderer counts, frame-time sample, and current GLB size;
- a short note naming exactly what changed and what remained untouched;
- one review question specific to the gate.

Asset-selection gates use equal-scale turntables in addition to the scene
views. No candidate is integrated before its lineup is approved.

## Phase sequence

### Gate 0: Lock the diagnostic views and baseline

**Change:** Review tooling only. Do not alter the scene.

- Add the `world` preset to the Winter test route.
- Add deterministic Blender QA cameras matching all seven scene views.
- Capture the current pass-two scene from every fixed view.
- Record baseline GLB size, node and mesh counts, draw calls, triangles,
  texture memory, and a repeatable frame-time sample.
- Keep the user's exact failure angle as a named regression image.

**Review question:** Do these views expose the scene honestly enough to judge
every later pass?

**Gate 0 passes when:** Austen approves the review angles and no camera can
hide the square terrain, pond silhouette, stage disc, or sparse perimeter.

### Gate 1: World envelope and terrain form

**Change:** Terrain geometry only. Use a neutral snow material and keep the
existing stage, pond, forest, props, fire, and sky unchanged.

- Replace the square terrain with an irregular inner hollow and a larger outer
  terrain envelope.
- Shape a low basin around the performance clearing and broken snow berms near
  the outer forest.
- Keep the required performance zone mathematically flat.
- Use an irregular lowered skirt, outer tree belt, and depth fog together so a
  legal orbit never exposes a straight border or floating plane.
- Preserve walkable routes between stage, pond, fire, and forest openings.
- Add assertions for clearing flatness, terrain extent, camera containment,
  and absence of a rectangular boundary loop.

**Review question:** Does this read as a natural hollow from ground level and
from above, with enough room for the scene to become dense?

**Gate 1 passes when:** no hard slab edge is visible in `hero`, `reverse`,
`walk`, or `world`, and Austen approves the overall landform and scale.

### Gate 2: Snow surface and ground detail

**Change:** Snow surface only. Do not move scene objects.

- Replace obvious texture repetition with separate macro and micro scales.
- Add broad wind-shaped value variation, compressed paths, drift buildup, and
  shallow disturbed snow near the stage and fire.
- Keep detailed contrast away from the performer so the clearing stays clean.
- Make slope, depression, and contact areas respond differently to moonlight.
- Prove that all texture sources survive the optimized GLB and runtime path.

**Review question:** Does the ground look like snow with history and depth,
without reading as a tiled photograph?

**Gate 2 passes when:** the surface holds up in walking close-up and the world
view still reads as one coherent snow field.

### Gate 3: Performance stage form

**Change:** Stage geometry and its immediate snow contact only.

- Replace the perfect circular top and cylinder wall with one organic,
  authored outline derived from the configurable stage radius.
- Build a shallow ice shelf embedded into the clearing instead of a raised
  puck.
- Vary rim width, ice thickness, snow overlap, and exposed edge around the
  perimeter.
- Preserve performer-count sizing and existing stage ownership.
- Keep movement clearance and stage registration unchanged.

**Review question:** Does this feel like a place to perform inside the hollow,
or does it still look like a glowing object sitting on the ground?

**Gate 3 passes when:** the stage reads as embedded ice from hero, walking,
side, and high views. Austen approves the silhouette before material tuning
continues.

**Current review evidence:** the irregular shelf, shallow buried body,
snow-contact collar, and fixed `stage` camera are implemented. The 1920 hero,
stage, walk, and world frames plus the seven-size hero sweep are stored in the
local Gate 3 evidence packet. Shape approval remains open; pond and tree work
have not started.

**2026-08-09 revision (Austen direction):** keep the embedded organic outline
but raise it into an elevated ICE stage. The full configured height (0.45 m,
matching the registered Winter native surface in `stage-coordinate-frame.ts`)
is now exposed, with a banked snow drift extruded against the base walls so the
stage stays embedded in the clearing. Two defects fixed along the way: the
frost shader surface had always rendered buried under the ExtrudeGeometry top
bevel (now lifted above it — the crystalline ice surface is visible for the
first time), and performer clearance now uses the bounding diagonal
`hypot(w, d) / 2` instead of `max(w, d) / 2`. Deep-ice shader palette and
finer fracture veining tuned so the deck reads as glassy ice, not snow.
Evidence packet recaptured. **Approved by Austen 2026-08-09 ("It's good")** —
the elevated embedded ice stage form passes Gate 3.

### Gate 4: Pond basin and shoreline shape

**Change:** Pond geometry only. Use a plain diagnostic ice surface.

- Replace the ellipse-led outline with a multi-lobed shoreline built from
  authored control points.
- Add a readable inlet or pinched neck, shelves, bank height changes, and snow
  overhangs.
- Compose the pond as a basin in the terrain rather than a separate flat mesh.
- Verify its visible area from the hero camera and its shape from `world`.
- Keep the nearest bank outside the performance buffer.

**Review question:** With no ice texture helping it, is this unmistakably a
pond rather than an oval or an egg?

**Gate 4 passes when:** Austen approves the pond silhouette, size, position,
and hero-camera visibility.

### Gate 5: Pond ice and bank material

**Change:** Pond material, ice depth, and bank finish only.

- Build layered ice with a clear upper sheet, cloudy depth, restrained cracks,
  trapped bubbles, rough snow patches, and grazing highlights.
- Vary detail scale and direction so the cracks do not read as one stamped
  texture.
- Add thin snow shelves and frozen slush where ice meets the bank.
- Keep reflections restrained. No black mirror, polygon edge, or square patch
  may appear.

**Review question:** Does the surface have believable frozen depth at close
range while remaining readable in the wide shot?

**Gate 5 passes when:** Austen approves both the pond close-up and its role as
a secondary focal area.

### Gate 6: Conifer asset lineup

**Change:** Candidate tree assets only. Do not change forest placement.

- Prepare equal-scale turntables for every existing mature, mid-age, and young
  conifer source.
- Add new CC0 sources only where the lineup lacks a broad, lush silhouette or
  a convincing distant form.
- Show summer-green material, snow loading, alpha edges, trunk base, and the
  closest shipping distance for each candidate.
- Record height, crown width, triangles, materials, texture cost, and intended
  hero, middle, or distant role.
- Reject damaged simplifications before they enter the scene.

**Review question:** Which trees actually belong in this forest, and which
ones should be removed from the asset set?

**Gate 6 passes when:** Austen approves the tree family and the lineup contains
lush, irregular, sparse, young, and distant silhouettes.

### Gate 7: Forest composition and density

**Change:** Tree placement, scale, rotation, and forest depth only.

- Place roughly 12 to 20 full-detail hero trees, 40 to 60 middle trees, and a
  low-cost distant belt sized by measured performance.
- Use linked Blender data and retained GPU instances. Do not realize repeated
  forest geometry.
- Build connected masses and openings, not a uniform radial ring.
- Mix crown width, age, height, leaning, dead branches, and snow loading.
- Keep the pond visible, maintain two walking sightlines, and avoid covering
  the performer with foreground branches.
- Make the forest dense from `world` without turning the hero view into a wall.

The count ranges are starting envelopes, not visual targets. Density is judged
by the images and then checked against measured render cost.

**Review question:** Does the forest feel lush, varied, and deep while still
leaving a deliberate clearing?

**Gate 7 passes when:** Austen approves hero, reverse, walking, tree close-up,
and world views. No later prop pass may be used to repair sparse trees.

**2026-08-09 implementation checkpoint:** Austen directed Winter to adapt the
Forest scene's layered, path-led depth logic without copying its assets or
palette. `scripts/winter-tree-layout.json` is now the versioned composition
contract. Version 3 authors 472 linked conifers in 21 irregular habitat
clusters: 98 near trees, 141 middle trees, and 233 far trees. Four curved
sightline corridors preserve the hero approach, pond, fire, and northwest
depth exit. Two near gates, two middle banks, a far backstop, and a central
hill cluster keep the runtime hero camera's route legible without exposing an
empty horizon. The generated layout leaves at least 0.510 m beyond every
required tree-crown and corridor shoulder, while the largest measured gap
between radial depth layers is 2.716 m. The age mix is 36 mature, 195 mid-age,
and 241 young trees.

The rejected `distant-snow-conifer_raw.glb` silhouette source is forbidden by
the contract and absent from the export. The far belt instead reuses measured
LODs of the detailed mid fir, young sapling, and windswept spruce families.
Every far tree is bedded at least 0.40 m into sampled terrain; the maximum
exported grounding error is below 0.000001 m. The narrowed hero approach has
0.143 m of verified snow-bank relief and is feathered with scanned rocks and
detailed deadwood.

The optimized production asset remains within its delivery contract at 11.04
MiB, 2,083,674 rendered vertices, and 89,119 uploaded position vertices. It
uses KTX2 textures, meshopt compression, and GPU instance batches as large as
202 trees. The live in-app hero, walk, and world samples measured 50.6, 59.0,
and 57.8 average FPS respectively. Blender and runtime hero, walking, and
world views pass the deterministic layout verifier and are ready for Austen's
visual composition verdict. Gate 7 remains open until that verdict; the
metrics prove coverage, provenance, grounding, and performance, not aesthetic
approval.

### Gate 8: Rock and deadwood lineup

**Change:** Candidate props only. Do not place them in the scene yet.

- Present equal-scale turntables of the three Autumn rock families, detailed
  logs, broken trunks, branches, and the stump.
- Show bark, broken ends, root flare, normals, snow response, and silhouette.
- Remove any smooth cylinder, generic polygon boulder, floating root mass, or
  source that fails at walking distance.
- Record triangle and texture cost for each approved family.

**Review question:** Which rocks and deadwood look real enough for close-up use?

**Gate 8 passes when:** Austen approves the prop families and rejects the weak
ones before placement begins.

### Gate 9: Rock, deadwood, and stump ecology

**Change:** Static prop composition only.

- Build several connected vignettes near the tree line with approximately 25
  to 40 visible rocks and 6 to 10 deadwood pieces, adjusted by review and
  performance.
- Bury rocks by family, align them to local slopes, and add snow contact.
- Keep one stump at most. Integrate its roots with a log, stones, branch debris,
  and uneven snow.
- Use clusters, exposed ridges, and buried fragments instead of even scatter.
- Preserve paths, performance clearance, pond access, and the approved forest
  composition.

**Review question:** Do these objects tell one site-specific story, or do any
of them still look placed by hand to fill empty space?

**Gate 9 passes when:** every close-up prop is grounded and Austen approves the
wide distribution and the individual vignettes.

### Gate 10: Campfire construction and local light

**Change:** Fire bed, fuel, embers, smoke, and local fire lighting only.

- Replace loose or cylindrical fuel with split, charred wood and irregular
  broken ends.
- Build a grounded fire bed with ash, coals, stone contact, melted snow, and a
  small heat-affected zone.
- Tune flame scale, color, smoke, sparks, and light falloff as one system.
- Keep the warm pool controlled so it supports the stage instead of flattening
  the whole clearing into orange light.

**Review question:** Does the fire feel physically built and hot, and is its
light helping the composition?

**Gate 10 passes when:** the fire works in close-up and the hero view preserves
the intended warm versus cool hierarchy.

### Gate 11: Horizon, fog, and depth

**Change:** Distant depth structure and fog only.

- Build irregular distance bands from terrain, trees, and fog without a
  vertical ridge wall.
- Remove every black void or sharp world seam visible from the legal orbit.
- Keep distant silhouettes quieter than the playable forest.
- Tune depth cues separately for hero, walking, reverse, and world views.

**Review question:** Does the scene continue beyond the clearing, or does the
background still reveal a finite set?

**Gate 11 passes when:** Austen approves the horizon from every wide view and
the high orbit shows no rectangular stage set.

### Gate 12: Moon, stars, snowfall, and night balance

**Change:** Shared sky configuration and atmospheric balance only.

- Reuse the shared `SkyGradient` celestial-Moon owner and `Starfield` owner.
- Match Forest's moon texture and star behavior, then tune only Winter's
  direction, angular diameter, density, color, and exposure.
- Keep the Blender moon absent from the authored GLB.
- Balance snowfall against the fixed sky so particles add depth without
  becoming visual noise.
- Check the moon at every viewport size and remove any flat white-disc read.

**Review question:** Does the night sky feel like the same world as Forest,
with the right amount of atmosphere for Winter?

**Gate 12 passes when:** Austen approves moon, stars, snowfall, and overall
night exposure in wide and mobile views.

### Gate 13: Integration, performance, and final free-orbit review

**Change:** Cross-system balance only. New asset families or major geometry
changes return to their owning gate.

- Balance stage, pond, fire, forest, snow, sky, and fog without erasing the
  approved character of any phase.
- Test every legal orbit angle, especially the original failure angle.
- Run the GLB verifier, focused tests, project check, console inspection, and
  full viewport sweep.
- Compare final renderer counts, frame time, texture memory, and GLB size with
  Gate 0.
- Confirm High, Medium, and Low tiers retain the approved composition.
- Produce a final before-and-after board using identical cameras.

**Review question:** Taken as a whole, does this now belong beside Autumn, and
is any single weak system still pulling the scene down?

**Gate 13 passes when:** Austen explicitly approves the complete scene. Tests
and performance evidence cannot substitute for that visual decision.

## Technical basis and asset budget

Blender 4.5 instances retain shared geometry instead of duplicating it. Three.js
`InstancedMesh` reduces draw calls when many objects share geometry and
materials. The forest and prop systems must preserve those benefits through
export. glTF Transform remains the production owner for deduplication, WebP,
and meshopt compression.

References:

- [Blender 4.5 instance documentation](https://docs.blender.org/manual/ka/4.5/modeling/geometry_nodes/instances.html)
- [Three.js InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html)
- [glTF Transform optimization documentation](https://gltf-transform.dev/)

The asset budget is checked at every gate, not only at the end:

- production GLB target: no more than 20 MiB;
- new textures: WebP, normally no more than 1024 pixels per axis;
- full-detail trees: reserved for silhouettes that need close inspection;
- middle and distant trees: lower-cost approved variants, still instanced;
- repeated rocks and deadwood: instance approved source meshes;
- no duplicated moon, star, fire, particle, loader, or optimizer owner;
- no count increase without renderer and frame-time evidence in the same packet.

## File ownership by phase

| Area                             | Primary files                                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review route and cameras         | `src/routes/test/winter-scene/+page.svelte`, `scripts/build-winter-environment.py`                                                                                                              |
| Terrain, forest, rocks, deadwood | `scripts/build-winter-environment.py`, `blender/winter_environment.blend`                                                                                                                       |
| Stage                            | `src/lib/shared/3d/environments/scenes/winter/IcePlatform.svelte` and the existing stage config owner                                                                                           |
| Pond                             | `scripts/build-winter-environment.py`, `winter/runtime/WinterPond.svelte`, `primitives/organic-pond-shape.ts` only if the shared owner can support the approved outline without changing Autumn |
| Sky and atmosphere               | `WinterScene.svelte` plus existing shared moon, star, snow, fog, fire, and light owners                                                                                                         |
| Export and budget                | `scripts/blender-export-winter-full.py`, `scripts/optimize-winter-environment.mjs`, `scripts/verify-winter-environment-glb.mjs`                                                                 |
| Production asset                 | `static/models/winter/winter-environment.glb`, `static/textures/winter/*`                                                                                                                       |
| Tests                            | Winter layout, quality, persistence, geometry, and route tests adjacent to their existing owners                                                                                                |

Autumn may be read as a quality reference. Its appearance or behavior is out
of scope unless a shared-owner change is proven necessary and its own visual
regression evidence is included.

## Verification ledger

- [x] Gate 0: diagnostic views and baseline approved
- [x] Gate 1: world envelope and terrain form approved
- [x] Gate 2: snow surface approved
- [ ] Gate 3: stage form approved
- [ ] Gate 4: pond basin and shoreline approved
- [ ] Gate 5: pond ice approved
- [ ] Gate 6: conifer lineup approved
- [ ] Gate 7: forest composition approved
- [ ] Gate 8: rock and deadwood lineup approved
- [ ] Gate 9: prop ecology approved
- [ ] Gate 10: campfire and local light approved
- [ ] Gate 11: horizon and fog approved
- [ ] Gate 12: moon, stars, snowfall, and night balance approved
- [ ] Gate 13: final integration and free-orbit review approved

No unchecked gate is implied by approval of a later screenshot. Each check is
recorded only after Austen's explicit visual verdict in the conversation.
