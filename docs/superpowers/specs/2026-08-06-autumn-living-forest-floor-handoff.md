# Autumn Living Forest Floor — Handoff (2026-08-06)

---

# ADDENDUM — Opus 5 audit remediation pass (2026-08-09)

A read-only Opus evaluator graded the shipped Autumn scene, then a separate
Opus fixer session implemented the justified findings. This addendum records
the baseline, what changed, what was measured, and what was rejected. Nothing
below was committed; every change sits uncommitted in the shared checkout on
`main`.

## Baseline the evaluator recorded

Code: Architecture B-, Code Quality B, Svelte 5 A-, Accessibility C+,
UX States C, UI Consistency A-, Performance D, Security A.

Scene craft (out of 10): art 5, composition 4, performer/contact 5, ground 2,
ecology 4, trees 3, lighting/atmosphere 3, pond/story 4, motion 4, runtime
efficiency 2, responsive framing 3, production readiness 4. Average 3.6.

## Measured results after the pass

| Measure | Before | After |
|---|---|---|
| GPU texture memory | 290.7 MB | **23.33 MB** |
| Texture format | WebP (no KTX2) | 51 KTX2 — 29 UASTC @512, 22 ETC1S @1024 |
| `KHR_texture_basisu` in asset | absent | **present** (so `useKtx2` is no longer a lie) |
| GLB on disk | 13.51 MiB | 17.17 MiB |
| glPrimitives | 380K | 390K |
| Focused tests | 30/30 | **38/38** |
| `pnpm check` | — | **0 errors, 0 warnings** |
| Grass beyond 17.5m | hard cut at 22.5m | 623 clumps, ramped to 26m |
| QA proxy feet | floating 0.11m | **soles at z=0.000m**, crown 1.804m |

The GLB grew 3.7 MiB because UASTC is larger on disk than WebP. That is the
correct trade: it buys a 92% cut in VRAM, which is the binding constraint on
mobile WebGL. Normal/metallicRoughness/occlusion drop to 512 precisely to keep
that disk cost bounded — leaving them at 1024 produced a 38.92 MiB GLB.

## What changed

**Pixels**
- Leaf litter is real leaf geometry, not diamonds. `append_leaf_card` emits an
  ovate blade (rounded base, drawn-out tip, lobed margin) with per-leaf length,
  width, curl and tilt. Airborne leaves get a matching `leaf` SDF in
  `FallingParticles` with per-particle aspect jitter and a darker midrib. The
  litter palette was also pulled down ~45%: shape alone did not stop bright
  chips reading as confetti.
- The `Packed_Performance_Clearing` decal is gone. It was redundant — the
  terrain already carried that material — and the optimizer decimated its rim to
  45 triangles, which is what produced the faceted "crater". Giving the clearing
  its own lighter albedo was then tried and also rejected: on a 96×96 grid the
  boundary rendered as stair-steps. The clearing now shares the surrounding
  soil, so no albedo boundary exists there at all.
- Contact shadows on high/medium from a moon-aligned key, budgeted by
  `resolveAutumnShadowRole` so only near-field silhouettes cast.
  `shadow.intensity 0.58` plus a dedicated non-casting fill fixed the
  ink-black pools of the first attempt.
- **The finite world edge is fixed geometrically, not with fog.** A terrain
  apron carries the ground to 165m. Fog could never have solved this: the old
  rim sat ~31m out and the camera ~34m back, so any fog thick enough to hide
  the edge also erased the scene. Fog density landed at 0.020 after 0.034
  visibly collapsed the whole image into one milky value.
- `scene.background` now matches SkyGradient's `topColor`. The 200-radius sky
  dome is clipped by the camera far plane, and the mismatch showed as a hard
  curved black band across the top of frame.
- Starfield gained opt-in legibility knobs (`intensity`, `magnitudeFalloff`,
  `brightnessFloor`, `horizonSpread`), all defaulting to today's behaviour so
  Cosmic/Forest/Winter are untouched. Stars now register in-frame.
- Pond: visible silty bed, higher transmission, bank tucked under the terrain
  instead of standing proud (that lip was the hard pale rim), and a cheap
  additive moon-glint column instead of a second full scene render.
- Moss patches now take normal/roughness from the same set as the terrain.
  Mismatched surface response, not albedo, was making them read as pale wet
  blobs — `soil` measures brighter (58.8) than `moss` (52.2).
- Tree rhythm: hero heights spread 8.4–13.8m with alternating mirroring; the
  belt moved off its constant ~26m radius to 21.5–29.5m with deliberate gaps.
- Owl dropped from 7.0m to 5.4m and turned to present its profile, so it
  silhouettes against fogged background instead of vanishing into canopy.

**Code**
- Deleted the orphaned `autumn/authored/` subtree and `GodRayShafts.svelte`.
- Deleted the `godRays` / `pondReflector` dead gates and the test that pinned
  them false, plus the `Reflector` import.
- Restored frustum culling on grass; bounds are grown by the wind shader's
  maximum displacement instead of culling being disabled outright.
- Reduced motion now honoured by particles, stars, wisps and pond, via one
  shared `motion-preference` module, not just the wind.
- Real GLB error state through `asyncWritable`'s `.error` store.
- Fixed the lying `as unknown as` / `as any` Threlte casts, the no-op
  `untrack`, the stranded `groundY` in wisps, comment drift, and the
  NaN-fragile `allocateWeighted`.

## Rejected recommendations, with evidence

- **"Delete the nine unreferenced build-input GLBs."** Three of them —
  `autumn-snag.glb`, `golden-larch.glb`, `autumn-willow.glb` — are consumed by
  `scripts/forest-tree-layout.json` as `sourcePath` inputs to the forest
  builder. Deleting them breaks another scene. They are instead trimmed from
  the **deploy output** in `scripts/trim-deploy-assets.js`, which keeps them on
  disk for builders while the CDN stops serving them.
- **"Recolour the cobalt-blue flower clumps."** The builder authors no flowers.
  A material audit added to the build prints every understory base colour and
  reported both Fern and Log as *textured*, with no flat blue value to
  recolour. The blue cast comes from lighting, which this pass rebalanced.
- **"The 12-segment clearing disc."** `create_organic_patch` passes `12.0` as
  the *seed* argument; the segment count is 72. The faceting came from the
  optimizer's simplify pass, not the builder.
- **"Wire `mushroomTargets` into `PulseTarget[]`."** GPU instancing collapses
  all 16 mushroom clusters into one `InstancedMesh` sharing one material, and
  the pulse loop writes `emissiveIntensity` per target in sequence — so shared
  materials resolve to "last target wins", and approaching one ring would light
  the other 15m away. Took the report's sanctioned alternative: removed the
  prop and documented why.
- **"The pond's vertical material seam."** That artifact lives in the Blender
  QA render only. `QA_Pond_Water` is excluded from the GLB export by the
  `QA_` prefix, so it never shipped.

## Bonus finding

`.gitignore` does not stop SvelteKit copying `static/` into the build, so every
`*_raw.glb` was being published — ~146 MiB of Blender source models, of which
only the largest tripped the existing 25 MiB per-file sweep. The deploy trimmer
now removes them by suffix.

## Evidence — screenshots

Seven-viewport sweep, all CSS-viewport-verified via `innerWidth/innerHeight`
(DevTools `emulate` lands a tier low on this display, so targets are passed
×1.1):

`C:\Users\Austen\AppData\Local\Temp\autumn-opus-v2-{1920x1080,2560x1440,3840x2160,1440x900,820x1180,960x412,375x667}.webp`

Performer contact was verified in the real app at `/q/S0K3` → 3D Animation:
four figures planted on the deck with soft contact pools, no float, no clipping.

## Remaining risks

1. **Portrait still spends ~25% on empty foreground and never shows the moon.**
   This is camera-owned, not scene-owned. The harness preset pitches down ~22°
   with a 48° fov, putting the top of frame at ~+2°; the moon sits at 25°
   elevation and cannot be in frame at any aspect. Moon elevation is locked to
   the key light by design, so lowering it to chase framing would flatten the
   shadows it exists to cast. Resolving this needs an aspect-aware camera in
   `@austencloud/camera-3d`, which was out of scope.
2. A faint bright arc remains on the pond's near shore. It survived both the
   glint reduction and the bank-height fix, so it is basin geometry rather than
   the reflection quad. Much subtler than the original hard rim, but not gone.
3. The frame-rate sample (30 FPS median, 150ms p95 at 1920) was taken with five
   other sessions' live 3D tabs on the same GPU. It is contaminated and should
   not be read as a clean benchmark.
4. Ferns, saplings and mushrooms do not cast shadows: GPU instancing strips
   their names, so they fall to the receive-only default. Documented in
   `autumn-shadow-roles.ts`.

---

## Mission

Turn the rebuilt Autumn 3D environment into a performer-scale living woodland
with a new floor material, layered leaf ecology, deterministic wind grass,
mushroom rings, moon and stars, spatially coherent fireflies, and one perched
owl. The governing plan is
[`2026-08-06-autumn-living-forest-floor.md`](../plans/active/2026-08-06-autumn-living-forest-floor.md).

## Done — verified

- The new floor material source and aligned maps exist under
  `static/textures/autumn-floor/`. Evidence:
  `node scripts/build-autumn-floor-textures.mjs` produced 2048x2048 albedo, normal,
  and roughness maps and reported `leftRight: 0` plus `topBottom: 0` for all
  three. The generated 2x2 QA tile was visually inspected with no visible
  border line. The final image-generation prompt and selected source are
  recorded in the session; the workspace source is `albedo-source.png`.
- The perched owl was generated through the checkpointed Meshy preview/refine
  flow. Evidence: preview task `019fd84d-e1ba-7ba1-a079-fe7e3e38359c` and refine
  task `019fd84f-0ea2-7db4-9d6b-7a5b65a4cdc5` both reached `SUCCEEDED` on
  2026-08-06. The 10.9 MiB raw GLB downloaded successfully and optimized to
  1.9 MiB with 26,044 uploaded vertices. No implementation commit exists yet.
- Planning and reuse audit completed on 2026-08-06. Evidence: repository reads
  confirmed the existing ocean rooted-sway shader, MoonBillboard, Starfield,
  FallingParticles, Autumn quality tiers, CC0 grass and mushroom models, and the
  Blender authoring/export pipeline. No implementation commit exists yet.
- The pre-pass Autumn baseline is reproducible. Evidence: the Blender builder
  reported 30 ferns, 15 boulders, 320 fixed leaves, 16 floating pond leaves,
  and zero pond/stage/footprint collisions. Focused Vitest results before this
  pass were 6/6 passing. The fresh desktop harness console contained no warnings
  or errors.
- The complete static Living Forest Floor build passes the Blender ecology
  validator. Evidence:
  `python scripts/blender-client.py exec scripts/build-autumn-environment.py`
  reported 54 ferns, 15 boulders, 1,000
  fixed leaves, 2,000 multi-blade grass clumps, 16 mushroom-ring clusters, 150
  twigs, and zero forbidden-placement collisions. It also verified a perfectly
  level performance footprint with maximum deviation `0.000000m`.
- All five Blender QA views were inspected after the material-scale correction.
  The owl is anatomically clear, perched correctly, and legible as a quiet
  silhouette. The floor now shows distinct leaf-scale structure and the grass
  uses olive-gold materials with shorter blades. Blender's deliberately dark QA
  rig still reads redder than the intended app result, so final color judgment
  remains assigned to the real runtime viewport pass.
- A 1.75 m QA-only performer reference now appears in the hero, floor, pond,
  and reverse Blender renders. It is hidden before the final `.blend` save and
  excluded from export by the existing `QA_` prefix rule. The hero view proves
  the authored clearing preserves real performance space while the grass,
  saplings, roots, leaf strata, mushrooms, and pond provide human-scale depth
  cues around it.
- The verified Blender source exported and optimized successfully. Evidence:
  `python scripts/blender-client.py exec scripts/blender-export-autumn-full.py`
  exported 120 mesh objects to a 134.30 MiB raw GLB;
  `node scripts/optimize-autumn-environment.mjs` reduced it to 10.02 MiB, below the
  12 MiB target. The optimized asset uses meshopt, WebP, mesh quantization, and
  GPU instancing. Its three `Autumn_Grass_*` meshes retain root-weight UVs and
  the owl retains its PBR material.
- Runtime integration is type-clean. Evidence: `pnpm check` completed with
  `svelte-check found 0 errors and 0 warnings` after the rooted wind, tiered
  grass visibility, owl idle, starfield, moon, and localized firefly changes.
- Focused layout tests pass. Evidence:
  `pnpm vitest run --config tests/config/vitest.config.ts tests/unit/3d-autumn/autumn-scene-layout.test.ts`
  completed 7/7 tests, including cumulative grass tiers, exact firefly count
  allocation, and stage-safe ecology centers.
- Austen supplied a real-app screenshot after the first integrated runtime pass
  at `https://localhost:5173/create/generate?v=2ZQ7`. It proves the optimized
  environment, performer, wind grass, moon, stars, pond, owl, and authored tree
  ring all render together. Austen's review: the moon and stars are gorgeous,
  the grass looks good, the floor still needs composition, falling leaves appear
  to enter from open sky, and the performer needs a stage anchor.
- The follow-up composition pass is code-verified. Falling leaves now reuse the
  same quality budgets across six authored canopy zones instead of one 40 m sky
  volume. The canonical rustic `Stage3D` now anchors the performer. Five broad
  golden/cool leaf swaths create a rear path and asymmetric side drifts above
  the repeating albedo. The rebuilt optimized GLB is 10.03 MiB
  (10,516,636 bytes). Focused tests pass 8/8 and the fresh project check again
  reports zero errors and zero warnings.
- Austen's next real-app screenshot at
  `C:\Users\Austen\AppData\Local\Temp\codex-clipboard-V5jEip.png` verifies the
  canonical stage, tree-localized falling leaves, darker night sky, owl, and
  macro floor swaths in the actual Create viewer. His review: the scene is now
  becoming gorgeous; the performer feet still intersect the deck, the near
  ground still reads generic, the horizon is barren, the hero-tree silhouettes
  repeat too much, and the owl reads detached from its branch at app distance.
- The deck-contact regression is fixed at its coordinate source. Autumn now
  declares the canonical Stage3D deck top as its native performer surface,
  exactly like Forest, so the environment is no longer shifted upward by one
  deck height. Focused stage-coordinate verification passes 22/22 tests.
- The horizon-variety generation is checkpointed. The silver-birch cluster
  completed Meshy preview `019fd884-ceb8-70e1-9d9c-94d6bfa6a309` and refine
  `019fd885-fc83-7917-b98b-f01cca20cc94`; its 12,571,060-byte source GLB is
  downloaded. The broken snag preview
  `019fd889-31c2-71cf-9161-d530d8b1e9fc` succeeded and refine
  `019fd88a-36fe-71ec-a7ec-a6a71f0f74af` also reached `SUCCEEDED`; its
  10,219,428-byte source GLB is downloaded. These IDs prevent duplicate paid
  submissions if the session is interrupted.
- The first horizon-belt rebuild completed its expanded ecology validator: 54
  ferns, 15 boulders, 1,800 fixed leaf cards, 2,000 quality-tiered grass
  clumps, 16 mushroom clusters, 150 twigs, 17 distant trees, a connected owl
  branch, and zero forbidden-placement collisions. The tree belt is 12
  silver-birch cluster instances plus 5 broken-snag instances, with the moon
  gap protected between the upper crowns.
- The owl is no longer runtime-rotated. Its source GLB already contains talons
  closed around a short branch; Blender now buries that branch into
  `Autumn_Owl_Tree_Connector`, which grows from the rear hero-tree fork. The
  final optimized GLB retains both `Autumn_Owl_Tree_Connector` and
  `Autumn_Owl_Perch_0.007`. The close QA render at
  `C:\Users\Austen\AppData\Local\Temp\tka-autumn-evidence\autumn_environment_qa_owl.png`
  verifies continuous branch contact and visible talon contact.
- That pre-variety asset exported 146 visible meshes to a 154.37 MiB raw GLB
  and optimized to 11,675,576 bytes (SHA-256
  `4636C69917437E92CE31443E4EEDA1442FA64F979D0270F7D18AE9D6F6D9CBF0`). It
  uses meshopt, WebP, mesh quantization, and GPU instancing. Direct GLB JSON
  inspection proves three scenery instance batches of 8, 12, and 5 instances;
  the 12/5 batches are the new birches/snags. Grass nodes and eight macro floor
  swath nodes also survive optimization.
- Final code verification is green: the Autumn layout and coordinate-frame
  suites pass 30/30 focused tests, and `pnpm check` reports 0 errors and 0
  warnings. HTTPS runtime probes return 200 for the Construct route, the
  environment GLB, `AutumnScene.svelte`, and the coordinate-frame module.
- Austen approved another tree-variety pass after seeing the 17-tree belt. The
  target mix keeps the same placement count and replaces repeated birches with
  four distinct background families: 5 birch clusters, 5 broken snags, 4
  golden larches, and 3 drooping autumn willows. Together with HeroA and HeroB,
  the scene contains six clearly different tree silhouettes. Golden-larch
  Meshy preview `019fd8a3-1542-7e6b-8406-4d9a80e81f22` and refine
  `019fd8a5-285a-7fdf-9b3e-8e675701bf1d` both succeeded; the raw source is
  11,709,576 bytes. Autumn-willow preview
  `019fd8a7-5f19-7f63-8c89-41e637ba9c89` and refine
  `019fd8a9-2754-70c7-a5dd-7a570ee620ba` both succeeded; the raw source is
  11,781,812 bytes.
- The rebuilt Blender validator proves the exact family distribution:
  `{'Birch': 5, 'Larch': 4, 'Snag': 5, 'Willow': 3}` with the ecology counts
  and collision checks unchanged. Blender QA hero and reverse views were
  inspected after the swap. Export retained 146 visible meshes and optimizer
  inspection found separate 5-, 5-, 4-, and 3-instance family batches.
- The final varied-tree GLB is 13,080,804 bytes with SHA-256
  `6B56AC7DFBE127C3E900602CF72F5FA5EEFFFD0FBAEB761C223D81210341802E`.
  Focused tests remain 30/30, `pnpm check` remains 0 errors and 0 warnings, and
  HTTPS probes return 200 with the exact 13,080,804-byte asset response.
- The final runtime-inspected asset is the uncommitted working-tree build from
  2026-08-06. Its Blender validator reports 54 ferns, 15 boulders, 1,800 fixed
  leaf cards, 2,000 grass clumps, 16 mushroom clusters, 150 twigs, zero
  forbidden-placement collisions, and the exact rear-belt distribution
  `{'Birch': 5, 'Larch': 4, 'Snag': 5, 'Willow': 3}`. The optimized GLB is
  14,166,492 bytes (13.51 MiB), SHA-256
  `89AC8CB48C23D3AC43F70C5619EA4306B908257C1942C2AD475D867D8FE88189`,
  with meshopt, WebP textures, quantization, and 5 GPU-instance batches holding
  16 repeated objects.
- The floor's final runtime pass removes the eight broad golden/cool overlay
  meshes because browser inspection proved that their borders read as flat
  cut-outs. Macro variation now comes from the physical leaf-card drifts, moss
  islands, understory, packed performance clearing, and tile-safe woodland
  albedo. The floor materials connect their baked color-grade images directly
  to Principled Base Color so glTF does not discard a Blender-only grading node.
  Evidence: the final integrated frame at
  `C:\Users\Austen\AppData\Local\Temp\codex-autumn-s0k3-front-balanced-1920.webp`
  shows continuous soil, leaf-scale edges, readable deck contact, the moon
  centered in the protected opening, and six tree silhouettes across the hero
  and rear tiers.
- Final live Composer verification is complete in the task-owned DevTools tab
  on `https://localhost:5173/create/construct?v=S0K3`. Desktop screenshots were
  inspected at 1920x1080, 2560x1440, 3840x2160, and 1440x900:
  `codex-autumn-s0k3-front-balanced-1920.webp`,
  `codex-autumn-s0k3-2560.webp`, `codex-autumn-s0k3-3840.webp`, and
  `codex-autumn-s0k3-1440.webp` in the Windows temp directory. The real Composer
  route proves performer feet meet the stage deck and that the moon, pond,
  varied rear belt, leaf drifts, grass, ferns, logs, rocks, and hero trees render
  together without visible loading or scene errors.
- The environment-only responsive sweep is complete at 820x1180, 960x412, and
  375x667 because the real Composer intentionally switches to its dedicated
  mobile viewer at small widths. Inspected evidence lives at
  `codex-autumn-harness-820x1180.webp`,
  `codex-autumn-harness-960x412.webp`, and
  `codex-autumn-harness-375x667.webp` in the Windows temp directory. Portrait
  keeps the stage centered between the tree walls; landscape reveals the full
  pond-to-stage clearing with no clipping or blank canvas.
- Runtime evidence is stable after quality adaptation. The final live route
  settled at 30 fps on the low adaptive tier, with repeated
  33.3 ms frame windows and update callbacks averaging about 0.15 ms. A direct
  browser HEAD request returned HTTP 200, `model/gltf-binary`, and the exact
  14,166,492-byte content length for the final GLB. One separate resource
  request returned HTTP 429 on the full Composer route; the Autumn harness had
  no console warnings or errors.
- Final verification is green on the uncommitted implementation. Evidence:
  `pnpm vitest run --config tests/config/vitest.config.ts tests/unit/3d-autumn/autumn-scene-layout.test.ts tests/unit/3d/stage-coordinate-frame.test.ts`
  passed 30/30 tests, `pnpm check` reported 0 errors and 0 warnings,
  `python -m py_compile scripts/build-autumn-environment.py` passed, and
  `git diff --check` passed for the changed Autumn code and handoff.

## Believed done — unverified

- The owl's baked branch contact is proven in the close Blender QA image, but
  the owl is intentionally tiny in the full Composer composition. A reviewer
  should use the QA image rather than expecting talon contact to read at the
  performance camera distance.
- Recording/export performance was not profiled. Interactive playback settled
  at 30 fps after adaptive quality moved to low, but capture mode may add load.
- The exact request behind the Composer route's HTTP 429 was not
  identified. It did not occur in the isolated Autumn harness and did not block
  the environment GLB, moon, stars, performers, stage, or runtime systems.

## In flight

- Branch: `main` in the shared primary checkout at `E:\\tka-platform`. No branch
  or worktree was created.
- The checkout was already dirty when this pass started. Autumn files from the
  preceding ecology rebuild are uncommitted and belong to this workstream;
  unrelated dirty files belong to other live sessions and must not be staged,
  reverted, or reformatted.
- Earlier handoff updates are isolated in scoped local commits `fb87cb0436`,
  `807f9c7904`, and `697bea0f40`. Implementation files remain uncommitted.
- Current implementation state: the final asset, lighting, direct glTF floor
  material path, integrated browser proof, responsive harness proof, frame
  evidence, and test evidence are complete. This doc is being updated for the
  Fapel and Opus review requested by Austen.
- Publishing note: `main` was already three commits ahead of `origin/main` with
  unrelated ghost-system commits (`5b1d123b0c`, `e3a0b07518`, `8d1ba89880`). A
  handoff commit may be created locally with explicit pathspecs, but pushing it
  would also publish those unrelated commits. Do not push until their owning
  session resolves that state or Austen explicitly authorizes the combined
  push.

### Current Autumn workstream files

- Authored assets and build tooling: `scripts/build-autumn-environment.py`,
  `scripts/build-autumn-floor-textures.mjs`, `scripts/generate-autumn-meshy.mjs`,
  `scripts/optimize-autumn-meshy.mjs`, `scripts/autumn-meshy-assets.json`,
  `static/models/autumn/autumn-environment.glb`, and
  `static/textures/autumn-floor/*`.
- Runtime integration: `src/lib/shared/3d/environments/scenes/AutumnScene.svelte`,
  `autumn/runtime/AutumnRuntimeSystems.svelte`,
  `autumn/runtime/atmosphere/AutumnParticles.svelte`,
  `autumn/runtime/atmosphere/autumn-ground-life-layout.ts`,
  `autumn/runtime/wind/AutumnWind.svelte`,
  `autumn/runtime/wind/autumn-grass-tier.ts`, plus the canonical coordinate
  frame in `environments/domain/stage-coordinate-frame.ts`.
- Verification: `tests/unit/3d-autumn/autumn-scene-layout.test.ts` and this
  handoff. Several additional dirty Autumn files predate this Living Forest
  Floor pass and belong to the preceding hero-environment workstream; do not
  revert or stage them casually.

## Loose ends (ranked)

1. Fapel and Opus should judge the final integrated desktop frame, the three
   responsive harness frames, and the five Blender close QA views. If they ask
   for more floor variation, add or reshape physical leaf-card drift centers;
   do not restore broad overlay meshes.
2. Profile recording/export mode separately if the next review includes video
   capture. Interactive playback is already measured.
3. Trace the Composer route's HTTP 429 as a separate application-infrastructure
   issue if it remains reproducible.
4. Commit the implementation with explicit Autumn-only pathspecs after the
   owning session confirms the current shared worktree scope. Push this handoff
   only after the unrelated commits already ahead of `origin/main` are resolved.

### Browser resume recipe

1. Reuse the shared browser with
   `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`.
2. Create one background tab for `https://localhost:5173/create/construct?v=S0K3`
   and retain its page ID for every call.
3. Switch 3D Scene to Autumn, choose the Front camera, close the camera panel,
   and zoom out four small wheel increments. That reproduces the final desktop
   composition without mutating Austen's visible browser window.
4. For environment-only responsive review, use
   `https://localhost:5173/test/autumn-scene`; the full Composer enters its
   dedicated mobile viewer at small widths.
5. Clear emulation and close only the task-owned tab when finished.

## Decisions already made

- On 2026-08-06 Austen approved the full Living Forest Floor pass with “go for
  it” and explicitly requested a running handoff for later Fapel and Opus
  review.
- Keep the performer at canonical scale. Correct the scale read with a closer
  ecological edge and human-size ground references.
- Static scenery stays Blender-first. Runtime code is reserved for wind, water,
  particles, sky, and restrained creature motion.
- Use a generated floor material plus real geometry. A single replacement
  texture is not enough.
- Include one owl because it reads at the scene camera distance. Defer worms,
  beetles, and animated roots.
- Reuse the existing moon, starfield, firefly, and ocean sway patterns.
- Keep Austen's PC usable. No visible desktop automation; background Blender
  socket work and task-owned background Chrome tabs only.

## Gotchas

- Port 5173 is Austen's HTTPS/2 dev server. Never start, stop, restart, or kill
  it. Use `https://localhost:5173`.
- Browser verification must use `scripts/launch-chrome-debug.ps1`, one
  task-owned background tab, explicit page IDs, and per-page viewport emulation.
  Never resize the shared Chrome window.
- Fresh harness navigations can spend about 20 seconds behind the app's
  `Resolving services` or `Connecting to cloud` curtain even when the route and
  GLB are healthy. Wait for the curtain instead of treating it as a render
  failure.
- At small widths the full Composer route enters its dedicated mobile viewer.
  The Autumn environment's 820x1180, 960x412, and 375x667 evidence therefore
  comes from the isolated real-component harness.
- The Blender MCP add-on disappears if the builder calls factory reset. The
  builder uses `reset_scene_contents()` to remove data without disabling the
  add-on.
- Blender cannot import the meshopt-compressed Poly Haven rocks directly. The
  builder decodes temporary authoring copies with `gltf-transform` first.
- `static/models/autumn/*_raw.glb` and `blender/` are intentionally ignored.
  The optimized runtime GLB is the ship asset.
- The shared git index may contain other sessions' staged files. Every commit
  must use an explicit pathspec.
- `gltf-transform` preserves the grass nodes exactly as `Autumn_Grass_Base`,
  `Autumn_Grass_Medium`, and `Autumn_Grass_High`. The final pass names the owl
  `Autumn_Owl_Perch_0.007` and keeps `Autumn_Owl_Tree_Connector`; neither is
  runtime-transformed.
- `static/models/autumn/perched-owl.glb` is the optional 1.9 MiB standalone
  optimized owl. The ship asset already bakes the owl into
  `autumn-environment.glb`; do not load the standalone file in the scene.

## Generated floor provenance

The selected image came from the built-in image-generation tool, not an
external API call. Original generated source:
`C:\Users\Austen\.codex\generated_images\019fd523-c290-7a80-808a-735e018b862d\exec-4523316a-af80-40e0-9ec5-ac2ab3c04820.png`.
Workspace source: `static/textures/autumn-floor/albedo-source.png`.

Final generation prompt:

```text
Use case: stylized-concept
Asset type: seamless tileable albedo texture for a premium real-time 3D autumn woodland floor
Primary request: Create a square, perfectly seamless top-down forest-floor diffuse texture dominated by layered autumn leaf duff over dark damp soil.
Scene/backdrop: orthographic material scan, surface only, no horizon and no perspective
Subject: overlapping small curled and decomposing maple, oak, and beech leaves in deep russet, muted copper, burgundy, burnt orange, umber, and occasional subdued gold; irregular glimpses of cool dark brown soil; faint forest-green moss filaments; a few very small broken twigs
Style/medium: physically plausible high-detail game material albedo, natural woodland ecology, rich but restrained color, suitable beneath realistic gnarled fantasy trees
Composition/framing: uniform edge-to-edge material coverage; seamless wrapping on all four edges; no single central focal object; no obvious repeating clusters
Lighting/mood: flat diffuse overcast capture with lighting and shadows removed; neutral color response; no baked highlights, ambient occlusion, vignette, or directional shadow
Constraints: square; tileable; crisp micro-detail; similar scale throughout; leaves small enough that many dozens fill the frame; geometry such as grass and mushrooms will be added separately
Avoid: large stones, large branches, mushrooms, grass tufts, flowers, animals, footprints, water, sky, purple color cast, pale straw lawn, bare uniform dirt, dramatic lighting, depth of field, text, border, watermark
```

Final seamless-edge edit prompt:

```text
Edit target: the generated square autumn leaf-duff forest-floor texture.
Primary request: Make the image genuinely seamless and tileable on both axes while preserving the existing color palette, leaf scale, density, soil gaps, moss flecks, micro-detail, and flat top-down diffuse appearance.
Required change: reconstruct and blend the border regions so the left edge continues perfectly into the right edge and the top edge continues perfectly into the bottom edge. Remove any edge discontinuity, clipped focal leaf, lighting change, or repeated border band.
Invariants: keep the center and overall material identity unchanged; keep many small realistic leaves; no perspective; no directional light; no baked shadow; no new large object.
Avoid: visible seams, mirrored edge strips, kaleidoscope symmetry, obvious repeating quadrants, central focal point, blur, text, watermark.
```
