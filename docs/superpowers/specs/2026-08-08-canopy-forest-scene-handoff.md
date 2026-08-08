# Canopy Forest Scene — Handoff (2026-08-08)

## Mission

Bring the Moonlit Firefly Forest up to the visual standard of Autumn through
small, user-approved production gates. The governing plan is
[Moonlit Firefly Forest: Gated Rebuild Plan](../plans/active/2026-08-08-forest-environment-pass-one.md).
The Forest steward is Bramble, renamed from the provisional Canopy label on
2026-08-08. Bramble is patient, ecological, and exacting about making every
asset look grown into one site. Bramble works directly in its own user-visible
task, does not spawn child agents, and must preserve shared scene owners and
Elsa's concurrent Winter work.

## Done — verified

- Commit `209f626eca` adds Gate 1's deterministic Blender-authored terrain
  envelope, runtime GLB integration, fixed-camera review route, optimizer, and
  structural verifier. `node scripts/verify-forest-environment-glb.mjs` passed
  on 2026-08-08: 1,080,668 bytes, one scene/node/mesh/material, three textures,
  a perfectly flat 30 metre clearing, irregular 152.783–187.217 metre boundary,
  and an 18 metre authored skirt. The GLB carries `EXT_meshopt_compression`,
  `EXT_texture_webp`, and `KHR_mesh_quantization`.
- The same commit's Python sources passed
  `python -m py_compile scripts/build-forest-environment.py scripts/blender-export-forest-full.py`
  on 2026-08-08. Its plan, Svelte review route, optimizer, and verifier passed a
  targeted Prettier check. The complete Forest path set passed
  `git diff --check` before commit.
- Commit `d2d8c4a085` replaces the shared world-space Moon billboard with a
  direction-indexed Moon composited into `SkyGradient.svelte`. Forest now passes
  its Moon configuration to that shared owner; `Starfield.svelte` also ignores
  camera translation. `pnpm exec svelte-check --output machine` completed with
  83 files, zero errors, and zero warnings on 2026-08-08. Winter hero, world,
  and walk captures confirmed that the Moon is absent when looking down and is
  occluded by foreground trees when looking toward its sky direction.

## Believed done — unverified

- `https://localhost:5173/test/forest-scene?view=world` exists in source, but
  Austen's already-running Vite process did not hot-register the new route. It
  redirected to Create during the production pass. Verify the fixed-camera
  route after the existing server naturally restarts; never stop or restart
  port 5173 for this.
- The producing agent reported `/coven` loading `forest-environment.glb` with
  HTTP 200 and no console warnings or errors. The saved proof is
  `C:\Users\Austen\AppData\Local\Temp\tka-forest-evidence\forest_coven_runtime_final.webp`.
  A fresh task should repeat the console inspection when it can use the fixed
  review route.
- Gate 1 is technically complete but not visually approved. The Blender proof
  images are evidence for review, not permission to begin Gate 2.

## In flight

- Branch: `main`; no Forest branch or worktree exists.
- There are no uncommitted changes in the committed Forest path set. The shared
  checkout remains dirty with unrelated work from other live tasks. Do not
  stage, revert, format, or commit files outside Bramble's explicit path list.
- The generated Blender source is
  `E:\tka-platform\blender\forest_environment.blend`. It is ignored by Git and
  was left open in Blender 5.0.1 at the world camera. The deterministic source
  of truth is `scripts/build-forest-environment.py`.
- Gate 2 has not started. No Meshy credits were used.

## Loose ends (ranked)

1. Present Gate 1 to Austen using the hero and world proof below. Wait for an
   explicit approve/reject verdict. If rejected, revise Gate 1 only.
2. Once the route is registered, verify `hero`, `reverse`, `walk`, and `world`
   in the real runtime, including a console check and the deliberately
   unflattering world view.
3. If Gate 1 is approved, update the plan ledger and begin Gate 2: forest-floor
   material zones only. Do not alter paths, tree assets, placement, props,
   stage, camp, lighting, or sky during that gate.
4. When later gates identify an actual asset gap, use the existing Meshy
   manifest/task-state/remesh path. Never make a paid call before the lineup
   gate and credit check.

Gate 1 review evidence:

- `C:\Users\Austen\AppData\Local\Temp\tka-forest-evidence\forest_environment_qa_hero.png`
- `C:\Users\Austen\AppData\Local\Temp\tka-forest-evidence\forest_environment_qa_world.png`
- `C:\Users\Austen\AppData\Local\Temp\tka-forest-evidence\forest_coven_runtime_final.webp`

## Decisions already made

- On 2026-08-08, Austen requested one careful visual system at a time with many
  review points. No later Forest gate may begin before the current one receives
  his visual approval.
- On 2026-08-08, Austen approved the multi-scene character model and asked for
  Forest to move into its own visible task rather than remain a child agent.
  The Forest character is Bramble; the Winter character is Elsa.
- Scene tasks must be aware of one another, reuse shared components, and respect
  concurrent edits. Shared capability ownership takes priority over
  scene-specific duplication.
- The Moon is celestial background, not Blender geometry or a world-space
  sprite. Its shared owner is `SkyGradient.svelte`; Forest may tune only its
  configuration at the later sky gate.
- The 30 metre level clearing supports the default scene and Coven Hub. Terrain
  outside it may be irregular, but later material or path work must not break
  the clearing's measured flatness.

## Gotchas

- Port 5173 is Austen's HTTPS/2 dev server. Use `https://localhost:5173`; do not
  start, stop, restart, or kill it. A separate verification server may use 5174.
- The shared Git index and working tree contain other agents' work. Every
  commit must use explicit pathspecs. Never run `git add -A`, `git add .`, or a
  bare `git commit`.
- `ForestScene.svelte` is an orchestration owner shared with the celestial-sky
  integration. Preserve its `SkyGradient moon={activeConfig.moon}` contract and
  coordinate before editing any other shared sky primitive.
- The current runtime still contains old placeholder trees, rocks, logs, camp,
  and stage. Gate 1 deliberately changes terrain only; their poor appearance is
  not a terrain regression and must be handled in their assigned later gates.
- Blender proof without runtime props is intentional for terrain-form review.
  Runtime proof contains the current props so terrain contact and concealment
  can still be checked.
