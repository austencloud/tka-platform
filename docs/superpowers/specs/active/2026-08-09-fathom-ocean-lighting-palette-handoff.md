# Fathom — Ocean Lighting and Palette Pass

- **Ocean steward:** Fathom
- **Mood target:** Moody Twilight Reef (approved by Austen, 2026-08-09)
- **Started:** 2026-08-09
- **Peer stewards:** Bramble (Forest), Elsa (Winter) —
  `docs/superpowers/specs/active/2026-08-08-bramble-elsa-scene-coordination.md`
- **Predecessor spec:** `2026-08-09-ocean-zone-layout-design.md` (composition;
  three passes shipped, do not undo)

## Why this pass exists

A screenshot comparison across Ocean, Autumn, Winter, Forest, and Cosmic in
Scene Lab 3D (2026-08-09) produced a blunt finding: **Forest, built from
untextured primitive blobs, reads as more art-directed than Ocean's 36 MB of
photoreal Meshy coral.** The ocean has the best assets and the best technology
in the program and the worst pictures.

Austen's framing: *"it doesn't have composure it doesn't have artistic
qualities to it ... less like a bunch of stuff that's been slapped into a scene
and more like artfully composed intentional ocean experience."*

Rating at handoff time — asset craft 9, technical systems 9.5, layout 6,
**art direction 4, focal clarity 3, sense of place 4**; overall **6/10**
against Winter and Autumn at 8.5. Composition was addressed in the zone pass.
What remains is entirely light, value, and colour.

### The shared formula the working scenes follow

Every scene that reads as composed does the same four things. Ocean does none
of them.

| | Autumn | Winter | Forest | Cosmic | **Ocean** |
|---|---|---|---|---|---|
| Limited palette | purple/navy vs red-orange | blue/white + one warm | navy vs firelight | near-monochrome + Earth | **6–7 hue families** |
| One motivated key light | moon + warm bounce | campfire | campfire | Earth | **flat ambient, no key** |
| Atmospheric falloff (panel fog) | 0.022 | 0.018 | 0.034 | 0.008 (space, correct) | **0.012 applied** |
| Stage belongs to the scene | warm wood, lit | frozen pond | warm wood, firelit | station ring | **near-black alien slab** |

## Correction to an earlier claim

An earlier message in this thread cited Ocean's fog density as 0.008 from the
Scene Lab panel. **The applied value is 0.012**, hardcoded at
`OceanScene.svelte:139`. The panel's 0.008 comes from
`ocean-scene-config.ts:258` and **does not reach the 3D scene** — see Gate 1,
item 4. The comparative conclusion is unchanged (0.012 is still the thinnest
fog of any underwater-or-terrestrial scene), but the number was wrong and is
corrected here.

## Enumerated recommendations

Ordered by leverage per unit of effort. Items 1–8 are config and lighting and
should land before any Blender work.

### Gate 1 — Atmosphere and depth (cheapest, largest win)

1. **Raise fog density from 0.012 to ~0.025–0.030.** `OceanScene.svelte:139`.
   The reef should emerge from blue darkness and dissolve back into it. This
   single change buys the depth layering the zone spec specified and lighting
   never delivered.
2. **Shrink the ground plane from 180 m to 60–70 m.**
   `ocean-scene-config.ts:260`. Content occupies a 20 m radius; the floor is
   180 m across, so most of every frame is bare sand. Autumn is 50 m, Cosmic
   60 m. This is the largest single contributor to the "slapped into a scene"
   read.
3. **Verify the fog colour supports silhouettes.** `#0a2438` at
   `OceanScene.svelte:134`. If heroes go muddy against it at the new density,
   lift its value slightly rather than thinning the fog back out.
4. **Resolve the dead fog/ground controls.** `ocean-scene-config.ts:258–263`
   declares fog `#1a5580` / 0.008 and ground `#5a8898` / 180, but
   `OceanScene.svelte` hardcodes its own fog and ignores them. Decide one
   owner. Austen's Scene Lab sliders currently do nothing for 3D fog, which
   will waste his time the moment he tries to tune this himself.

### Gate 2 — One motivated key light

5. **Establish a single dominant god-ray shaft from the surface, landing on
   the stage.** This is the ocean's campfire: a key light the setting itself
   justifies. Existing owner is `runtime/atmosphere/GodRayShafts.svelte`;
   prefer promoting one shaft to hero status over adding new light types.
6. **Rebalance the rig so darkness exists.** `OceanRuntimeSystems.svelte`:
   `HemisphereLight` 0.2 (line 62), `DirectionalLight` 0.9 (line 71), two
   `PointLight` torches at 40 (lines 83, 90). Everything is currently lit
   evenly, so nothing is emphasised and nothing recedes. Target a bright pool
   on the stage with falloff toward dark blue past the reef.
7. **Keep the torches as warm secondary accents.** They are motivated
   (exported from Blender as `Torch_Light_0/_1`) and they are the only warm
   light in the scene today. They should read as accents against the cool key,
   not as general fill.
8. **Check the IBL contribution.** `OceanScene.svelte:152–159`, currently 0.08
   `RoomEnvironment`. A flat specular wash fights the moody target; the dev
   `ibl` toggle exists precisely to A/B how much washout it owns.

### Gate 3 — Palette discipline (Blender + materials)

9. **Cut to two hue families plus one accent:** blue-teal environment, warm
   coral accent, everything else desaturated toward the water. Restraint is
   what reads as taste.
10. **Reduce coral variety by roughly a third.** Magenta, orange, and
    yellow-green currently all compete at full saturation. The scene will get
    better as it loses objects. Prefer desaturating the losers over deleting
    them where the silhouette is doing useful work.
11. **Cool the sand.** The salmon-orange seabed fights the water in every
    frame. The driver is the seabed GLB texture, not the config ground colour,
    so this is a Blender/texture change routed through the standard pipeline.
12. **Let the caustics carry the warmth** instead of the sand's base colour.

### Gate 4 — Stage integration

13. **Re-material the dais toward pale stone or sea-sand.** It is currently the
    darkest object in a frame whose subject is the performer standing on it.
14. **Make the stage the brightest object in frame**, lit by the Gate 2 shaft.
    In Winter the stage is a frozen pond; in Autumn and Forest it is firelit
    wood. In Ocean it is made of nothing in the scene.
15. **Demote the bioluminescent cracks to an accent.** They are currently the
    only feature the stage has. Owner is `runtime/RuinsPlatform.svelte`.
16. **Add a soft rim or up-light** so the dais edge separates from the seabed.

### Gate 5 — Verification and production

17. **Screenshot the required viewport set** per
    `.claude/rules/visual-verification-mandatory.md`.
18. **Before/after at identical camera positions**, not new flattering angles.
19. **Side-by-side against Autumn and Winter.** The bar is "does this belong in
    the same program", and that is only answerable by comparison.
20. **Re-bake and upload.** Export → optimize → **R2 re-upload** (see Carried
    debt).

## Guardrails

- **Do not undo the zone layout.** Passes 1–3 (`ocean_zone_recompose.py`,
  `ocean_zone_refine.py`, `ocean_zone_pass3.py`) shipped composition,
  intersection separation, and species logic. Lighting work must not re-scatter
  placements. `blender/ocean_scene.pre-*.blend` backups exist per pass.
- **The stage stays procedural.** `RuinsPlatform` is an animated shader that
  cannot bake to glTF — the documented exception to `blender-first-3d-scenes.md`.
  Re-material it; do not replace it with a GLB.
- **Any geometry or texture change goes through the Blender pipeline**
  (`blender-first-3d-scenes.md`), not hand-authored Threlte primitives.
- **Shared owners are announced before editing.** `SkyGradient.svelte`,
  `Starfield.svelte`, `EnvironmentReviewCamera`, and scene-config types are
  shared with Bramble and Elsa. Announce in the coordination file first.
- **Visual verification is not delegable.** Design fan-outs produce documents,
  not pixels. Build it and look at it (`fable-routing.md` → Workflow Cost
  Discipline).
- **Scoped commits only** (`commit-only-your-own-changes.md`). Multiple agents
  share this checkout; one already swept these files mid-flight on 2026-08-09.

## Carried debt from the zone pass

| Item | State |
|---|---|
| R2 re-upload of `ocean_flora_scene.glb` | **Open.** Production serves from R2; dev/localhost is current. Every zone pass so far is invisible in prod. |
| Wreck (`boat.glb` + `octopus.glb`) | **Open.** Not yet in `ocean_scene.blend`; needs import + decimation. Zone `wreck-hollow-southeast` is reserved for it. |
| Fauna cluster anchors → zone anchor points | **Open.** `fish-compute.ts:121-132` still seeds an even ring. |
| Residual small-rock contacts at skyline hero bases | **Accepted.** Reads as natural set dressing. |

## Reference paths

| Purpose | Path |
|---|---|
| Scene root | `src/lib/shared/3d/environments/scenes/ocean/OceanScene.svelte` |
| Lighting rig | `.../ocean/runtime/OceanRuntimeSystems.svelte` |
| Stage | `.../ocean/runtime/RuinsPlatform.svelte`, `OceanStage.svelte` |
| God rays | `.../ocean/runtime/atmosphere/GodRayShafts.svelte` |
| Config (sky/fog/ground/zones) | `src/lib/shared/3d/environments/domain/models/scene-configs/ocean-scene-config.ts` |
| Authored placements | `.../ocean/authored/placements.ts` |
| Zone contract | `scripts/ocean-zone-layout.json` |
| Blender source | `blender/ocean_scene.blend` |
| Export → optimize | `scripts/blender-export-ocean-full.py` → `scripts/optimize-ocean-glb.mjs` |
| Review surface | Scene Lab → Ocean → 3D (`/lab/themes`) |

## Definition of done

The ocean reaches parity with Winter and Autumn: a viewer who sees a still
frame with no context can name the mood, find the subject in under a second,
and would not guess the scene was assembled from a catalog. Target 9/10.
