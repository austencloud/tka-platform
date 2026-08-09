# Moonlit Firefly Forest: Gated Rebuild Plan

- **Date:** 2026-08-08
- **Status:** Gates 0 through 6 are approved. Gate 7, ground-life ecology, is
  implemented and awaiting Austen's visual verdict. Later gates remain blocked.
- **Quality reference:** Autumn's Blender-authored environment and runtime split.
- **Review authority:** Austen approves or rejects every visual gate.
- **Scene steward:** Bramble
- **Cross-scene log:**
  [Bramble and Elsa Scene Coordination](../../specs/active/2026-08-08-bramble-elsa-scene-coordination.md)

## Later atmosphere decision

Austen proposed a continuous day-to-night slider on 2026-08-08. Keep it out of
the floor and vegetation gates. During the later lighting/sky pass, specify one
Forest-owned `0–24 h` atmosphere value that derives sky, celestial visibility,
fog, lighting, exposure, fireflies, and campfire response. Reuse Scene Lab's
existing `ParamSlider`; keep `SkyGradient` and the celestial components as
render primitives. Coordinate with Elsa before promoting any interpolation
contract to shared ownership.

## Target

Rebuild the Forest scene as a coherent woodland clearing that holds up from the
hero camera, walking height, close range, and free orbit. The scene should feel
like one site with terrain, paths, trees, ground life, camp, stage, light, and
sky designed around each other.

The accepted scene should have these immediate reads:

- an irregular woodland basin with no visible rectangular ground edge;
- a generous, level performance clearing connected to believable footpaths;
- dense tree masses with canopy depth, openings, and several age classes;
- a forest floor with soil, moss, leaf litter, roots, stones, and damp shade;
- rocks and deadwood grouped as site-specific ecology, not radial scatter;
- a camp and performance area embedded into the clearing;
- fireflies, moonlight, fog, and warm fire light supporting one focal hierarchy;
- the stage first, fire and camp second, and forest depth third.

The rebuild is split into small visual decisions. One system changes, work
stops, and Austen reviews it before the next system begins.

## Confirmed baseline

The current runtime owner is
`src/lib/shared/3d/environments/scenes/ForestScene.svelte`.

- Ground: one 50 metre square `TexturedGroundPlane` or `GroundPlane`.
- Trees: 128 KayKit instances generated in four circular rings.
- Rocks: 10 KayKit rocks generated around one radius.
- Bushes: 16 KayKit bushes generated around one radius.
- Deadwood: nine authored transforms using two camping log GLBs.
- Camp: one tent GLB, one campfire GLB, volumetric fire, smoke, and two lights.
- Sky: shared `SkyGradient` owns the directional Moon, with `Starfield` and
  meteor owners layered around it.
- Stage: shared `Stage3D` owner.
- Loading: eleven GLBs, mostly loaded from the Forest R2 asset set.

Autumn establishes the target technical split: a Blender-authored optimized GLB
for static set dressing, shared runtime owners for dynamic water, particles,
lighting, interaction, and quality tiers.

## Capability ownership

- Extend `ForestScene.svelte` as the Forest runtime owner.
- Create `scripts/build-forest-environment.py` as the deterministic Forest
  Blender composition owner. Forest creative geometry is separate from Autumn
  and Winter geometry.
- Reuse the established scene-specific Blender export and glTF Transform
  optimization pattern. Do not create a second generic exporter.
- Reuse shared stage, sky-integrated moon, starfield, fire, particle, fog,
  loading, and orbit-control owners until their own gate explicitly replaces
  only Forest content.
- Reuse approved Autumn assets when they belong in Forest. Record source family
  and intended distance instead of copying geometry into a new asset family.
- Use the established Meshy manifest, task-state, remesh, and optimizer pattern
  for later candidate-asset gates. Paid generation is not part of terrain
  Phase 1.

## Production rules

1. Only one numbered phase may be active.
2. Work stops after each review packet until Austen approves that gate.
3. A rejected phase is revised in place. Later detail cannot hide weak form.
4. Shape and placement are approved before expensive asset or material work.
5. Every packet uses fixed cameras so camera drift cannot improve a weak pass.
6. The free-orbit `world` view is included at every gate.
7. Approved phases stay locked. A regression returns to its owning phase.
8. The Blender build is deterministic and carries semantic metadata.
9. Meshy calls use the existing credit check and task-state safeguards. An
   ambiguous paid POST is never retried without task reconciliation.
10. The production Forest environment GLB stays at or below 20 MiB unless a
    measured visual improvement earns explicit approval for a larger budget.
11. Gates 1 through 3 change terrain form and materials only. Existing trees,
    rocks, bushes, logs, camp, stage, particles, lighting, and sky stay in
    place.

## Fixed review views

| View       | Purpose                                                  |
| ---------- | -------------------------------------------------------- |
| `hero`     | Primary composition and focal hierarchy                  |
| `reverse`  | The side hidden by the hero camera                       |
| `walk`     | Eye-level scale, paths, and ground contact               |
| `world`    | Whole environment, boundaries, and empty regions         |
| `trees`    | Trunk scale, crown depth, and canopy openings            |
| `floor`    | Soil, moss, roots, litter, and contact detail            |
| `camp`     | Tent, fire, seating, deadwood, and local light           |
| `stage`    | Performance zone, stage contact, and audience sightlines |
| `paths`    | Overhead route hierarchy, loops, exits, and shoulders    |
| `pathwalk` | Ground-level wear, grade, and approach to the clearing   |

Every packet includes the active views, one deliberately unflattering view,
the live route, console status, current GLB size, and the exact system that
changed. Final integration uses 1920x1080, 2560x1440, 3840x2160, 1440x900,
820x1180, 960x412, and 375x667.

## Phase sequence

### Gate 0: Diagnostic views and baseline

**Change:** Review tooling only.

- Add `/test/forest-scene` through the real `Environment3D` switch.
- Add the eight fixed camera presets.
- Record current world edge, circular placement, object counts, console state,
  and runtime loading behavior.

**Review question:** Do the views expose the Forest scene honestly?

### Gate 1: World envelope and terrain form

**Change:** Terrain geometry only.

- Replace the square ground with an irregular radial terrain envelope.
- Keep a mathematically flat 30 metre central performance zone so the default
  scene and expanded Coven Hub layout remain supported.
- Build low outer rises, broken woodland banks, and a lowered irregular skirt.
- Keep every existing object at its current transform.
- Add assertions for clearing flatness, minimum world extent, boundary
  irregularity, and skirt depth.

**Review question:** Does the scene read as a natural woodland basin from
ground level and above, with enough room for later density?

**Pass condition:** No straight or floating ground edge is visible from
`hero`, `reverse`, `walk`, or `world`, and Austen approves the landform.

### Gate 2: Forest-floor material zones

**Change:** Terrain materials only.

- Separate packed clearing, path soil, leaf duff, moss shade, damp hollows, and
  quiet distant ground.
- Break broad texture repetition with macro-scale color and roughness changes.
- Keep the stage footprint calm enough for performer readability.

**Review question:** Does the ground read as a forest floor with history rather
than one tiled photograph?

**Gate 2 evidence, 2026-08-08:** Six exported material zones now separate the
packed clearing, path soil, leaf duff, shade moss, damp hollows, and distant
ground. One deterministic 4096 px macro diffuse keeps color transitions
continuous across material boundaries; a second UV set preserves repeating
normal and roughness detail. The optimized production GLB is 2,728,616 bytes,
contains six material primitives and five WebP textures, and retains a flat
30 m clearing, a 152.787 to 187.206 m irregular boundary, and a 15.346 m
minimum skirt drop. The automated contract passes. Approval remains unchecked
until Austen reviews the fixed renders.

**Approval:** Austen, 2026-08-08: “You're doing awesome Please continue with
the next step.” This answered the requested Gate 2 `approve or revise` verdict.

### Gate 3: Path and clearing composition

**Change:** Terrain paths and clearing edges only.

- Establish the stage-to-camp path, two forest exits, and one secondary loop.
- Shape compressed soil, root crossings, soft shoulders, and small grade
  changes without blocking performer space.

**Review question:** Do the paths make the clearing feel inhabited without
looking landscaped?

**Gate 3 evidence, 2026-08-08:** One versioned layout contract now defines the
stage-to-camp spur, southeast and northwest forest exits, west woodland loop,
three root-grade crossings, and an irregular 30.209 to 33.791 m clearing edge.
The terrain builder, macro texture generator, diagram, and GLB verifier all
consume that same contract. The exported paths use shallow 0.10 to 0.16 m soil
compression, soft 2.2 to 2.8 m shoulders, and 0.06 to 0.08 m root relief while
the 30 m performance core remains level. The optimized production GLB is
2,565,316 bytes with 102,080 triangles, six material primitives, three shared
WebP textures, meshopt compression, and a decoded maximum clearing deviation of
0.00614 m. The automated contract passes. Approval remains unchecked until
Austen reviews the route contract and fixed renders.

**Approval:** Austen, 2026-08-08: “Let's gooooo.” This approved Gate 3 and
advanced Forest to the tree asset lineup.

### Gate 4: Tree asset lineup

**Change:** Candidate tree assets only. Do not place candidates in the scene.

- Present equal-scale turntables for existing KayKit sources, reusable Autumn
  trees, approved CC0 sources, and new Meshy candidates where a silhouette is
  still missing.
- Cover mature canopy trees, irregular middle trees, young trees, snags, and
  distant silhouettes.
- For Meshy candidates, prefer image-to-3D or multi-image-to-3D from approved
  clean-subject concept art, `meshy-6`, PBR texture generation, lighting
  removal, bottom origin, and a measured remesh target.
- Record source, license or generation task, height, crown width, triangles,
  materials, textures, and intended distance.

**Review question:** Which trees belong in this forest?

**Gate 4 evidence, 2026-08-08:** The versioned lineup contains all three current
KayKit sources, all six reusable Autumn tree sources, and four fresh Forest
candidates. A deterministic Blender rig normalizes all 13 candidates to 12 m,
includes a 1.75 m person, and renders front, 45-degree, and silhouette views.
The verifier passed 39 square renders, three labeled contact sheets, unique IDs,
the current contract hash, and all required role labels.

The fresh family was generated from clean-subject ImageGen concepts through a
guarded Meshy 6 image-to-3D owner. Four paid tasks consumed 120 credits in
total. The accepted optimized assets retain PBR textures, WebP encoding, and
meshopt compression: F1 is 31,995 triangles / 1,155,360 bytes, F2 is 25,923
triangles / 1,138,220 bytes, and F4 is 17,951 triangles / 1,034,760 bytes. F3
is retained only as rejection evidence because its reconstruction lost most of
the proposed foliage.

**Approved cut:** F1 is the mature canopy anchor, F2 is the irregular middle
tier, and F4 is the true young/understory tier. A3 birch, A4 snag, A5 larch,
and A6 willow remain available as secondary ecological accents. K1, K2, K3,
A1, A2, and rejected F3 do not enter the Gate 5 placement family.

**Approval:** Austen, 2026-08-08: “I'm totally cool with you generating fresh
trees that feel more appropriate … more lush and green. … full speed ahead on
the next phase.” This authorized the fresh family and advanced Forest to Gate 5.

### Gate 5: Forest composition and canopy depth

**Change:** Tree transforms only.

- Replace uniform circular rings with connected masses and intentional gaps.
- Build foreground frames, middle canopy, and a lower-cost distant belt.
- Preserve the stage view, camp access, and two path openings.
- Retain linked Blender data and exported GPU instances.

**Review question:** Does the forest feel dense, varied, and deep without
turning the clearing into a wall?

**Gate 5 evidence, 2026-08-08:** The deterministic composition now places 295
trees from six approved families in 13 irregular near, bridge, and distant
masses. The layout preserves both authored canopy openings and every path
shoulder. Its measured minimum trunk spacing is 2.989 m, and its minimum clear
distance beyond a path shoulder is 1.825 m. The production runtime no longer
draws the legacy KayKit rings over the authored woodland; Scene Lab retains
those rings for its reactive controls.

The optimized production GLB is 7,691,940 bytes and contains seven meshes in
seven nodes: one terrain node plus six `EXT_mesh_gpu_instancing` nodes. The
verifier accounted for all 295 exported instances by family and confirmed that
translation, rotation, and scale accessors survived optimization. Meshopt,
WebP, the flat clearing, material zones, four paths, three root crossings, and
the irregular terrain envelope all remain intact. The fixed Blender and runtime
renders were reviewed before the approval below.

**Approval:** Austen, 2026-08-08: “These are fantastic I can't wait to see you
next step please continue.” This approved Gate 5 and advanced Forest to the
ground-life asset lineup.

### Gate 6: Ground-life asset lineup

**Change:** Candidate ferns, bushes, mushrooms, roots, grass, and litter only.

- Compare existing assets, reusable Autumn families, CC0 sources, and focused
  Meshy generations at their closest shipping distance.
- Reject alpha damage, melted stems, fused clusters, poor root contact, and
  texture lighting that fights the scene lights.

**Evidence packet:** Nine candidates were rendered at fixed front, 45-degree,
overhead, and silhouette views beside a segmented 1 m scale post. The resulting
2296 x 1780 contact sheet covers two current Forest bushes, one current grass
clump, two reusable Autumn families, and four Forest-specific Meshy candidates.
The four fresh candidates consumed 120 Meshy credits; the verified balance after
generation was 800 credits. Their optimized GLBs pass the Forest asset contract
with WebP textures, meshopt compression, and decoded triangle counts between
17,553 and 22,251.

**Recommended cut for Austen's review:**

- Keep A1 Lush Fern Clump as the primary shade and damp-floor anchor.
- Keep F1 Woodland Hazel Shrub as the primary woody understory family.
- Keep F2 Damp Sedge Tussock for hollows and wet transitions.
- Keep F3 Chestnut Mushroom Colony as the natural fungi family.
- Reject F4 Moss Root and Litter Island as a repeated full object. Preserve its
  material idea through separate root arcs, moss mats, leaf drifts, and twigs.
- Reject K1 and K2 KayKit bushes from Forest production because their smooth,
  faceted crowns conflict with the authored tree family.
- Reject K3 Quaternius grass because its crystalline silhouette breaks at
  walking distance.
- Keep A2 Bioluminescent Mushroom Grove in Autumn only. Its glow competes with
  Forest's firefly and campfire hierarchy.

**Organic ecology revision:** Austen kept Gate 6 open on 2026-08-08 after
identifying the risk that repeated bushes, mushroom colonies, and the circular
root island would read as a spread-out generated scatter. He approved a revised
family-and-microhabitat direction with “that sounds good,” then cancelled the
proposed outside review with “yknow lets' do it ourselves.”

The revised Gate 6 board presents six separate 8 x 8 m habitat studies: a damp
willow hollow, beech-shade fern colony, fallen-log decomposition patch, sunlit
hazel edge, root crossing with a directional litter drift, and sparse path
shoulder. Across the board, four source plants become 17 visible silhouettes or
growth stages. Ground contact uses five modular systems. No habitat repeats one
complete plant variant, and the rejected circular root island appears zero
times. The deterministic verifier records 27% to 58% negative-space targets,
960 x 640 source renders, and a 2832 x 1570 review sheet.

**Review question:** Do the family variation and microhabitat causes prevent the
ground layer from reading as repeated asset stamps?

**Approval:** Austen, 2026-08-08: “I approve.” This approved the six-vignette
ecology board as Forest's ground-life vocabulary and advanced the scene to
Gate 7 full placement. Museum tracker decision: `W8SPNRGyTmAbzoV1GvFR`.

### Gate 7: Ground-life ecology

**Change:** Ground-life placement only.

- Place shade families beneath canopy, damp families in hollows, disturbance
  near logs and roots, and sparse growth beside paths.
- Use clusters and ecological transitions instead of even scatter.

**Evidence packet:** The authored layout contains 21 site-specific habitat
patches, 339 plant groups, all 17 approved growth variants, and 128 ground
modules. The six habitat causes remain distinct: damp willow hollows,
beech-shade fern colonies, fallen-log decomposition, sunlit hazel edges,
root-crossing litter drifts, and sparse path shoulders. Placement verification
records a 1.046 m clearing clearance, a 0.492 m path-core clearance, a 19.506 m
maximum canopy-anchor distance, and zero full circular root islands. The
production GLB is 17,175,916 bytes with meshopt compression, WebP textures, 13
source-variant instance groups, four procedural mushroom-part instance groups,
and 11 repeated-module instance groups. The live review route loaded the asset
at 1920 x 1080, 2560 x 1440, 3840 x 2160, 1440 x 900, 820 x 1180, 960 x 412,
and 375 x 667. The fixed hero, floor, and tree views show no legacy bush ring;
the performance clearing stays open while the lower layer gathers at canopy,
moisture, deadwood, root, and path-edge causes.

**Review question:** Does the lower layer feel grown in place?

### Gate 8: Rock, root, and deadwood lineup

**Change:** Candidate props only.

- Present approved Autumn rock families, existing Forest props, stumps, root
  flares, branches, and focused Meshy candidates.
- Reject polygon boulders, smooth cylinders, flat cut ends, floating roots,
  and weak walking-distance textures.

**Review question:** Which prop families are good enough for close use?

### Gate 9: Rock, root, and deadwood ecology

**Change:** Static prop placement only.

- Build connected vignettes at tree bases, path shoulders, and eroded banks.
- Bury stones by family, align roots to grades, and make deadwood affect nearby
  moss and litter.

**Review question:** Do these props tell one site-specific story?

### Gate 10: Stage form and terrain contact

**Change:** Forest stage geometry and its immediate ground contact only.

- Preserve shared performer sizing and registration.
- Replace any floating or generic platform read with a stage that belongs to
  the woodland clearing.

**Review question:** Does this feel like a performance place built here?

### Gate 11: Camp composition

**Change:** Tent, fire bed, seating, fuel, and camp placement only.

- Build a believable fire bed, split fuel, ash, coals, seating, trampled soil,
  and a tent pitch that follows the site.
- Keep the warm focal area secondary to the stage.

**Review question:** Does the camp feel used and physically assembled?

### Gate 12: Forest lighting and depth

**Change:** Forest lighting and fog only.

- Tune moon key, canopy shadow, fire bounce, fog layers, and distant silhouette
  separation around the approved geometry.
- Keep path exits readable from walking height.

**Review question:** Does the light reveal depth without flattening the forest?

### Gate 13: Sky and living atmosphere

**Change:** Shared sky configuration and Forest particle balance only.

- Reuse the shared moon, stars, meteors, leaves, and firefly owners.
- Apply any shared moon-distance correction without creating a Forest-specific
  moon implementation.
- Tune Forest values only after the spatial scene is locked.

**Review question:** Does the night continue beyond the trees, and do the
particles add life without noise?

### Gate 14: Integration and free-orbit review

**Change:** Cross-system balance only.

- Run every fixed camera and every required viewport.
- Test the legal orbit for world seams, floating assets, broken silhouettes,
  and lighting failures.
- Compare renderer counts, frame time, texture memory, and GLB size with Gate 0.
- Confirm the default Forest scene and Coven Hub both retain their approved
  performance clearings.

**Review question:** Taken as a whole, does Forest now belong beside Autumn?

## Asset-generation and provenance contract

Meshy work begins only after the relevant lineup gate reaches a specific asset
gap. Each candidate records its prompt or image references, task ID, source GLB,
remesh task, texture settings, Blender corrections, optimized output, and final
scene role. Source and raw generation files stay separate from shipping GLBs.

Current Meshy documentation supports `meshy-6`, image enhancement controls,
lighting removal, bottom-origin placement, target formats, and remesh topology
with a target polycount. Every paid call is gated by current credit balance and
the existing no-ambiguous-retry safeguard.

References:

- [Blender Mesh API](https://docs.blender.org/api/5.0/bpy.types.Mesh.html)
- [Blender UV workflow](https://docs.blender.org/manual/en/dev/modeling/meshes/uv/workflows/layout.html)
- [Meshy API changelog](https://docs.meshy.ai/en/api/changelog)
- [Meshy Remesh API](https://docs.meshy.ai/en/api/remesh)
- [glTF Transform](https://gltf-transform.dev/)

## File ownership

| Area                      | Owner                                                                     |
| ------------------------- | ------------------------------------------------------------------------- |
| Runtime orchestration     | `src/lib/shared/3d/environments/scenes/ForestScene.svelte`                |
| Review route              | `src/routes/test/forest-scene/+page.svelte`                               |
| Terrain and authored set  | `scripts/build-forest-environment.py`, `blender/forest_environment.blend` |
| Path layout contract      | `scripts/forest-path-layout.json`                                         |
| Macro terrain texture     | `scripts/build-forest-floor-texture.mjs`                                  |
| Tree lineup contract      | `scripts/forest-tree-lineup.json`                                         |
| Tree layout contract      | `scripts/forest-tree-layout.json`                                         |
| Tree review rig           | `scripts/build-forest-tree-lineup.py`                                     |
| Tree review sheets        | `scripts/build-forest-tree-lineup-contact-sheet.mjs`                      |
| Tree lineup verification  | `scripts/verify-forest-tree-lineup.mjs`                                   |
| Ground-life generation    | `scripts/forest-ground-life-images.json`                                  |
| Ground-life lineup        | `scripts/forest-ground-life-lineup.json`                                  |
| Ground-life review rig    | `scripts/build-forest-ground-life-lineup.py`                              |
| Ground-life review sheet  | `scripts/build-forest-ground-life-lineup-contact-sheet.mjs`               |
| Ground-life verification  | `scripts/verify-forest-ground-life-lineup.mjs`                            |
| Ecology vignette contract | `scripts/forest-ground-life-ecology.json`                                 |
| Ecology vignette rig      | `scripts/build-forest-ground-life-ecology.py`                             |
| Ecology review sheet      | `scripts/build-forest-ground-life-ecology-contact-sheet.mjs`              |
| Ecology verification      | `scripts/verify-forest-ground-life-ecology.mjs`                           |
| Ground-life layout        | `scripts/forest-ground-life-layout.json`                                  |
| Ground-life placement     | `scripts/forest_ground_life.py`                                           |
| Placement review sheet    | `scripts/build-forest-ground-life-layout-contact-sheet.mjs`               |
| Placement verification    | `scripts/verify-forest-ground-life-layout.mjs`                            |
| Export                    | `scripts/blender-export-forest-full.py`                                   |
| Optimization              | `scripts/optimize-forest-environment.mjs`                                 |
| GLB contract              | `scripts/verify-forest-environment-glb.mjs`                               |
| Production asset          | `static/models/forest/forest-environment.glb`                             |
| Later Meshy assets        | Forest manifests, task state, source GLBs, and Forest-only optimized GLBs |

## Verification ledger

- [x] Gate 0: diagnostic views approved
- [x] Gate 1: world envelope and terrain approved
- [x] Gate 2: forest-floor material zones approved
- [x] Gate 3: paths and clearing edges approved
- [x] Gate 4: tree lineup approved
- [x] Gate 5: forest composition approved
- [x] Gate 6: ground-life lineup approved
- [ ] Gate 7: ground-life ecology approved
- [ ] Gate 8: rock, root, and deadwood lineup approved
- [ ] Gate 9: prop ecology approved
- [ ] Gate 10: stage form approved
- [ ] Gate 11: camp composition approved
- [ ] Gate 12: lighting and depth approved
- [ ] Gate 13: sky and atmosphere approved
- [ ] Gate 14: final integration approved

No unchecked gate is implied by a later screenshot. A check is recorded only
after Austen's explicit visual verdict.
