# Moonlit Firefly Forest: Gated Rebuild Plan

- **Date:** 2026-08-08
- **Status:** Gate 1 implemented and awaiting Austen's visual approval. Later
  gates remain blocked.
- **Quality reference:** Autumn's Blender-authored environment and runtime split.
- **Review authority:** Austen approves or rejects every visual gate.

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
11. Phase 1 changes terrain form only. Existing trees, rocks, bushes, logs,
    camp, stage, particles, lighting, and sky stay in place.

## Fixed review views

| View      | Purpose                                                  |
| --------- | -------------------------------------------------------- |
| `hero`    | Primary composition and focal hierarchy                  |
| `reverse` | The side hidden by the hero camera                       |
| `walk`    | Eye-level scale, paths, and ground contact               |
| `world`   | Whole environment, boundaries, and empty regions         |
| `trees`   | Trunk scale, crown depth, and canopy openings            |
| `floor`   | Soil, moss, roots, litter, and contact detail            |
| `camp`    | Tent, fire, seating, deadwood, and local light           |
| `stage`   | Performance zone, stage contact, and audience sightlines |

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

### Gate 3: Path and clearing composition

**Change:** Terrain paths and clearing edges only.

- Establish the stage-to-camp path, two forest exits, and one secondary loop.
- Shape compressed soil, root crossings, soft shoulders, and small grade
  changes without blocking performer space.

**Review question:** Do the paths make the clearing feel inhabited without
looking landscaped?

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

### Gate 5: Forest composition and canopy depth

**Change:** Tree transforms only.

- Replace uniform circular rings with connected masses and intentional gaps.
- Build foreground frames, middle canopy, and a lower-cost distant belt.
- Preserve the stage view, camp access, and two path openings.
- Retain linked Blender data and exported GPU instances.

**Review question:** Does the forest feel dense, varied, and deep without
turning the clearing into a wall?

### Gate 6: Ground-life asset lineup

**Change:** Candidate ferns, bushes, mushrooms, roots, grass, and litter only.

- Compare existing assets, reusable Autumn families, CC0 sources, and focused
  Meshy generations at their closest shipping distance.
- Reject alpha damage, melted stems, fused clusters, poor root contact, and
  texture lighting that fights the scene lights.

**Review question:** Which ground-life families survive close inspection?

### Gate 7: Ground-life ecology

**Change:** Ground-life placement only.

- Place shade families beneath canopy, damp families in hollows, disturbance
  near logs and roots, and sparse growth beside paths.
- Use clusters and ecological transitions instead of even scatter.

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

| Area                     | Owner                                                                     |
| ------------------------ | ------------------------------------------------------------------------- |
| Runtime orchestration    | `src/lib/shared/3d/environments/scenes/ForestScene.svelte`                |
| Review route             | `src/routes/test/forest-scene/+page.svelte`                               |
| Terrain and authored set | `scripts/build-forest-environment.py`, `blender/forest_environment.blend` |
| Export                   | `scripts/blender-export-forest-full.py`                                   |
| Optimization             | `scripts/optimize-forest-environment.mjs`                                 |
| GLB contract             | `scripts/verify-forest-environment-glb.mjs`                               |
| Production asset         | `static/models/forest/forest-environment.glb`                             |
| Later Meshy assets       | Forest manifests, task state, source GLBs, and Forest-only optimized GLBs |

## Verification ledger

- [ ] Gate 0: diagnostic views approved
- [ ] Gate 1: world envelope and terrain approved
- [ ] Gate 2: forest-floor material zones approved
- [ ] Gate 3: paths and clearing edges approved
- [ ] Gate 4: tree lineup approved
- [ ] Gate 5: forest composition approved
- [ ] Gate 6: ground-life lineup approved
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
