# First Fire production slice: decisions (2026-09-06)

Status: technical verification of the production shell in the full `/museum`
grid. No gate approval is claimed here; gate approvals are Austen's.

Water (`DrownedGalleryAuthored.svelte`, `build-drowned-gallery-production.py`)
set the pattern: a Blender-authored shell, baked lightmaps, one runtime
component that owns the cave's light and state. This slice applies the same
pattern to the Cinder Court and records where Fire had to differ.

## What was built

- `scripts/build-first-fire-production.py` reads the measured carve
  (`blender/first-fire-cinder-court-graybox.blend`), remeshes and skins the
  void, cuts the rock into four pieces (lane, DJ, EK, FL), unwraps each,
  bakes a lightmap per piece and per court stone from the fire itself
  (flame guides, trench embers, torch point lights), denoises, exports a raw
  GLB and runs gltf-transform into
  `static/models/museum/cave/first-fire-cinder-court.glb`.
- `FirstFireAuthored.svelte` mounts that GLB at the grid room's plan centre,
  hides the 60 flame guides and stands the shader flames on them, drives each
  court's emissive by the procession phase, and registers the three authored
  point lights.
- `Museum3DScene.svelte` skips the generic `cave-fire-*` performer loop when
  the authored component is present, exactly as it does for Water.
- The graybox test-route modules that the museum now needs (flame field,
  procession review, court vocabulary, the flame and shrine-volume
  components) moved under `src/lib/features/museum`; the test route imports
  them from there.

## Decisions

1. **The room is the S-procession Cinder Court, not the amphitheatre.** The
   plan JSON's `sourceDigest` (`11f497bf…`) is the contract the build checks;
   an out-of-date carve fails the build instead of producing a stale shell.
2. **Route ribbons, the steam threshold slab and the performer pads are not
   exported.** They were graybox instrumentation. The museum renders the
   performer stations from the plan at runtime, and the walked-route coal
   memory is the only floor guide kept.
3. **The rock is split four ways by court, with one lightmap each.** The lane
   gets 4096 px, the courts 2048 px, the court stones 1024 px. The split lets
   the runtime cool a finished court by material name while the next one
   still burns; a single rock material could only dim the whole cave.
4. **Skin-cap bounds come from the carve block widened by the corridor
   rectangles**, never from the void's own bounding box. The void's box hugs
   the outermost room walls, so cutting there removed real walls (14 323
   faces deleted instead of 390).
5. **Pieces are identified by material-slot name after
   `separate(type="MATERIAL")`**, because each separated piece keeps only its
   own slot and `material_index` reads 0 everywhere.
6. **The bake is one fire.** The flame guides were still carrying the
   graybox's crimson emission; baked through dark basalt under amber torch
   lights it produced a lava-red floor and a second, cooler colour of fire.
   The guides now emit the same warm colour as the torch lights
   (`FLAME_COLOUR` per category), and the floor reads as lit cinder.
7. **Each trench ring has its own mesh datablock and its own material with a
   distinct ember colour.** The rings were linked duplicates, so assigning a
   material to one assigned it to all; and gltf-transform's dedup folds
   byte-identical materials into one, which handed every ring to DJ. Distinct
   colours keep them apart; the runtime additionally clones the material per
   ring node and names it for the court so the court is never inferred from
   a material that an optimiser could merge.
8. **`gltf-transform optimize` runs with `--palette false --instance false
   --join false`.** The defaults fold untextured materials into a palette
   atlas (breaks tuning by name), collapse identical nodes into GPU
   instancing (the guides lose their names) and join same-material
   primitives. `--simplify false` because the rock is already decimated to
   its budget.
9. **Metallic stays 0 everywhere** (the museum has no environment map; metal
   would draw nothing).
10. **Torches are re-placed against the real rock by ray cast**: 45 wall
    sconces stand off the remeshed surface, 15 floor torches where no wall is
    in reach. The graybox floated them 0.9 m off the carve.
11. **The performer station never unmounts once it has mounted.** The
    review reports no displayed court after the growth beat, and unmounting
    the station there threw a null read inside the rig's reactive props during
    teardown, which killed the Threlte frame loop (a frozen frame, no
    recovery short of a reload). The FL performer now stays at its cold court,
    present and still, the way the Water performers stay mounted and merely go
    inactive. Found on the first bridge-driven walk to the growth beat.

## Runtime behaviour

- The procession state machine is the existing review owner
  (`first-fire-procession-review.ts`); the component only feeds it the
  visitor's plan-space position while the visitor is in the Fire route.
- Per-court emissive factors: burning 1, finished court 0.28 (coals), unlit
  0.06, lane memory 0.10 after the growth reveal, everything 0 during the
  extinguish blackout. Factors are slewed at 2.2 per second so a court cools
  rather than switches off.
- Lightmapped materials get the same 2.6 emissive boost Water uses.
- Authored point lights (three slots, always mounted, intensity faded): the
  hero light on the current court's centre (amber, flicker 3.3 Hz), a cold
  water spill just inside the Water door, and the green growth light at the
  Earth door that only rises after the blackout.
- Pooled flame lights are disabled for the museum (`pooledLights={0}`); the
  baked lightmaps carry the fire and the three authored lights are the whole
  dynamic budget, so `MAX_*` light pools are unchanged.
- The growth slabs are lit moss, not emitters: a mossy base with a whisper
  of emissive (0.1), so the Earth-door light shades them with its falloff.
  At emissive 1.1, and still at 0.38, they tone-mapped to a flat lime
  plank that read as graybox.
- A dev-only `window.__firstFire` seam (phase, near, player, review, lights,
  and `advance()`, one canonical procession transition per call) exists for
  browser verification, following the docent's `window.__docent`.
- The game bridge's move and teleport bindings now sync the reactive player
  position the way the portal and Moon arrivals already did. The bridge drives
  the physics body directly and never enters the camera controller's movement
  step, which is where the reactive position normally follows the body, so a
  bridge teleport used to leave the avatar, proximity culling and every
  position-driven cave state at the previous spot until the next keypress.
  Real walking was never affected.

## Frame of reference

Blender x = plan x − centre x, Blender y = centre z − plan z, where the
centre is the grid room's plan centre. In the current full grid that centre is
world (60.25, 45), so world = (bx + 60.25, 45 − by). The plan JSON's own
`planCentre` values are in the exporter's frame and differ from the runtime
grid by a constant z offset; only the Blender-relative coordinates are shared
between the build and the runtime.

## Evidence

The procession was driven end to end in the full `/museum` grid on the
worktree server (127.0.0.1:5431) through the game bridge, reading the phase
from the dev seam at every station: DJ mouth, DJ court, ember bridge with DJ
behind, EK mouth and court, FL mouth and court, the extinguish blackout, and
the green Earth route after it. Screenshots are in the session transcript for
2026-09-06; the Water production gate kept the same form of evidence. Build
report: `first-fire-cinder-court-production-report.json`. Evidence entries
with hashes are on the `production-slice` gate in `scene-gates.json`; the gate
itself stays pending until Austen walks it.

Two verification lessons, recorded so the next slice does not relearn them:
the hidden browser pane only ticks frames while a screenshot is taken, so a
bridge-driven walk needs a frame pump after every step; and importing a raw
source module by URL in the page makes Vite re-optimise and fully reload,
which the museum's pagehide hook then restores at the same tile with a fresh
procession.

## Not in this slice

- Earth-side graybox geometry visible through the Earth door.
- Flame card halos are visible at close range on the shared flame renderer.
- The trench rings and the coal-memory band are uniform emissive surfaces;
  a textured ember treatment is a follow-up.
