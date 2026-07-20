# Cosmic Astral Reliquary Second Pass: Handoff (2026-07-19)

> **Second pass landed 2026-07-19 (Fable), then superseded same day.** The
> observatory-complex arrangement (terrace, crescent, stairs, walls, rubble)
> read as clutter at runtime; Austen rejected it: procedural connector blocks
> and multi-asset arrangement are outside current AI aesthetic ability. Third
> pass is the keeper: **restraint** — quiet lunar plain with soft craters, the
> celestial arch alone, upright at r19 on the Earth sight line, base slab
> buried; deck + rings + amber marks + three flush channels; nothing else.
> Pavilion/orrery/dais/fault assets stay on disk unused (raw GLBs remain for a
> future human-directed pass). Shipping GLB 5,691,088 bytes, validator clean.
> Cold directional stays `[28, 12, -19]`. Still open: perf numbers in-app,
> loose end 10 (legacy retirement gated on approval). Lesson for the next
> agent: do not attempt multi-asset ruin composition again — single silhouette
> + negative space is the ceiling of what reads well from this pipeline.

## Mission

Turn the current Astral Reliquary blockout into one convincing lunar observatory complex. The first pass replaced Cosmic's programmer-art ground, crystal ring, and bright platform with Meshy-authored ruins composed in Blender. Austen's verdict on 2026-07-19 was "an interesting start" and the next pass belongs to Fable. The current weakness is composition, not model quality: five detailed assets still read as separate exhibits placed around a circular stage. The earlier concept history is in [the shipped Crystal Garden design](./shipped/2026-05-23-cosmic-crystal-garden-design.md).

## Done: verified

No Cosmic implementation commit exists yet. Current `HEAD` is `b2ec15ab3cea09dcac31af349569787799a504eb`, which predates this work. Treat every Cosmic file listed under **In flight** as uncommitted shared-checkout work.

## Believed done: unverified

- The live Threlte scene should load the authored GLB and wait for both the GLB and Earth before reporting the environment ready. Vite compiled `CosmicScene.svelte` with HTTP `200`, but no browser session was available for a live 3D screenshot.
- Earth was lowered from Y=12 to Y=2 in both Cosmic variants because that position frames it through the Blender lens from the saved front camera. The actual orbit-camera framing still needs visual proof.
- The authored deck top is exactly 0.4 m in Blender, matching `Viewer3DScene.svelte`. Performer foot contact still needs a runtime screenshot.
- Desktop and mobile frame time have not been profiled. The GLB budget is reasonable, but retained stars, god rays, dust, energy particles, and meteors still need runtime measurement.

## In flight

Work is in the primary `main` checkout at `E:\tka-platform`. At handoff time the branch is one commit ahead and 34 commits behind `origin/main`, with substantial unrelated work from other sessions in the shared index and working tree. Do not stash, rebase, reset, or make a broad commit.

Cosmic files created or changed by this pass:

- `src/lib/shared/3d/environments/scenes/CosmicScene.svelte`
- `src/lib/shared/3d/environments/domain/models/scene-configs.ts`
- `scripts/cosmic-meshy-assets.json`
- `scripts/generate-cosmic-meshy.mjs`
- `scripts/build-cosmic-reliquary.py`
- `scripts/blender-export-cosmic-full.py`
- `scripts/optimize-cosmic-glb.mjs`
- `static/models/cosmic/cosmic-reliquary.glb`

Local generated sources are intentionally ignored by git but exist in this checkout:

- `blender/cosmic-reliquary.blend`
- `blender/previews/cosmic-reliquary-{front,quarter,side,top}.png`
- `blender/cosmic-meshy-tasks.json`
- `static/models/cosmic/reliquary/*_raw.glb`
- `static/models/cosmic/cosmic-reliquary_raw.glb`

Five Meshy-6 assets were generated and downloaded: `celestial-arch`, `reliquary-dais`, `ruined-orrery`, `shattered-pavilion`, and `crystal-fault`. The batch consumed exactly 150 credits. The verified balance after generation was 980.

Verification already run:

- Four Blender Eevee renders completed. The front render is `blender/previews/cosmic-reliquary-front.png`.
- Raw GLB: 121,825,072 bytes. Shipping GLB: 15,462,908 bytes, an 87.3% reduction.
- `gltf-transform inspect`: 615,486 render vertices, 291,942 uploaded vertices, nine materials, 23 KTX2 textures, `EXT_meshopt_compression`, `KHR_texture_basisu`, and GPU instancing.
- `gltf-transform validate`: no errors. It reports KTX2 MIME/schema warnings because its core validator only lists PNG/JPEG.
- Dev server query: `206`, `model/gltf-binary`, `Content-Range: bytes 0-11/15462908`, magic `glTF`.
- Vite source query: `CosmicScene.svelte` returned `200 text/javascript`, contained `cosmic-reliquary.glb`, and had no transform error.
- Node syntax checks passed for both `.mjs` scripts. Blender Python parsed both `.py` scripts.
- `npm run check:fast` and full `npm run check` produced no Cosmic diagnostics. The full check remains red from concurrent work: `builder-step-converter.ts:85` and two implicit-any errors in `WordLabel.svelte:250`.

## Loose ends (ranked)

1. **Make one place, not five asset islands.** Start in `scripts/build-cosmic-reliquary.py`. Sink every Meshy base into terrain, overlap rubble, and connect the pavilion, lens, and orrery with broken walls, stairs, terraces, and one readable route from the performance deck to the lens. The current four-quadrant placement is the central problem.
2. **Recompose the large masses.** Build a crescent of connected observatory ruins around roughly 120 degrees of the stage. Cluster the orrery and pavilion into one secondary mass. Leave one side quiet so Earth and the lens own the negative space. Avoid an even ring.
3. **Give the ground three elevation zones.** Keep the performance socket flat. Raise a fractured observatory terrace around the lens. Add a lower crater basin on the opposite side. The current terrain relief is too subtle at the saved camera height.
4. **Unify materials in Blender.** Current Meshy assets carry separate stone, bronze, violet, and cyan reads. Grade them toward one palette: near-black lunar basalt, tarnished pale metal, sparse moon-ice crystal, and very limited amber calibration marks. Emission belongs inside cracks and channels, not on every rim.
5. **Integrate the deck.** The deck is clean and correctly sized, but it looks dropped onto the terrain. Add a broken approach, actuator housings, cable or channel cuts, and two asymmetrical anchor points tying it to the observatory.
6. **Make the lens less literal.** The generated arch currently reads like a standing portal. Preserve the Earth-framing hole, then bury or fracture part of the circular housing so it reads as excavated celestial machinery. Let one broken rib or metal ring reach toward the stage.
7. **Tune runtime light and fog after composition.** Keep Earth, nebula, starfield, god rays, sparse dust, energy particles, and meteors. Aim the cold directional light across the new terrace relief. Reduce any runtime emission that competes with the lens.
8. **Capture live proof.** With Austen's current-conversation permission, take a runtime screenshot showing performer foot contact and Earth through the lens. If permission does not carry into the new conversation, ask before browser use. Record console and scene-feature readiness state.
9. **Only then consider more Meshy work.** The current failure is arrangement. If two connectors are still missing after the Blender pass, generate a broken wall/stair module and a low rubble-channel module. Do not spend more credits on another hero object.
10. **Retire legacy Cosmic assets after approval.** `CrystalFormations`, `LunarGroundPlane`, `PrismaticCaustics`, `LunarCrystals`, the unused `CosmicStage`, and the old crystal GLBs are no longer mounted by `CosmicScene`. Delete them only after Austen approves the second-pass scene and a source search confirms no remaining consumers.

## Decisions already made

- On 2026-07-19 Austen asked for the weakest non-Blossom scene to be improved with Meshy. Cosmic was selected from the existing weakest-first queue.
- On 2026-07-19 Austen called the first Astral Reliquary result "an interesting start" and asked for a Fable handoff to implement it better. Treat the current work as a blockout, not approved final art.
- Static environment geometry stays Blender-authored and ships as an optimized GLB. Do not add more static Threlte primitives.
- The 0.4 m performance-deck top and runtime expansion for multi-performer layouts must remain intact.
- Keep Cosmic's moving atmosphere: Earth, sky gradient, nebula, starfield, god rays, sparse dust, energy particles, and meteors.
- The flat lunar shader, scene-wide caustic sheet, and evenly scattered crystal garden should not return.
- Reuse the current five Meshy assets before spending more credits.
- Blossom is outside this task and has active changes from another session.

## Gotchas

- `shell_command` and `powershell.exe` hung repeatedly during this session. Node-backed file access and `node:child_process` worked. Blender is at `C:/Program Files/Blender Foundation/Blender 5.0/blender.exe`.
- Port 5173 is Austen's HTTPS/2 server. Never start, stop, or kill it. Use `https://localhost:5173` for read-only queries.
- The shared git index contains many staged files owned by other sessions. Every Cosmic commit must use an explicit pathspec on `git commit`, not only on `git add`.
- `main` is 34 commits behind `origin/main`. Do not pull with the current dirty shared tree, and do not autostash other sessions' work. Coordinate the sync first.
- `scripts/generate-stage-meshy.mjs` is modified by another session. It was read as a precedent and must not be edited or committed with Cosmic.
- Meshy exposes no idempotency key. `generate-cosmic-meshy.mjs` never retries an ambiguous paid POST. It checkpoints IDs before polling.
- The reproducible composition source is `scripts/build-cosmic-reliquary.py`. Running it deletes and rebuilds the current Blender scene before saving `blender/cosmic-reliquary.blend` and four previews.
- The build script imports ignored raw Meshy GLBs. They exist locally but will not arrive in a fresh clone unless copied separately. The optimized shipping GLB is the portable artifact.
- Preview Earth and lights live in `PREVIEW_not_exported`; only `EXPORT_cosmic_reliquary` enters the shipping GLB.
- KTX2 and meshopt are required at runtime. The loader already uses `useKtx2("/basis/")` and `useMeshopt()`.
