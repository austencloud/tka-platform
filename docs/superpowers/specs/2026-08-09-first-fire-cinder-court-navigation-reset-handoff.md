# First Fire Cinder Court Navigation Reset — Handoff (2026-08-09)

## Mission

Take over the rejected First Fire Cinder Court graybox and restart it from first-person navigation proof. The current 58 × 44 metre candidate is mechanically coherent but failed Austen's walk test: `this is terrible. Worse thatn it was before, I don't even know where to walk. I'm totally lost.` Do not polish the existing interior. Preserve only the approved encounter contract that still has value: three isolated DJ/EK/FL performers, a return through a shared hub, the DJ → EK → FL order, red extinction, and the final green Earth reveal. The current production notes are in [first-fire-cinder-court-production-contract.md](first-fire-cinder-court/first-fire-cinder-court-production-contract.md), but Austen's 2026-08-09 rejection supersedes its current spatial target.

## Done — verified

- **The rejected candidate has a measured, deterministic spatial contract.** Commit: none; this work is uncommitted on `main` at base `2aef59b53b19163ad83957d2bd30b981be6d9fcd`. Evidence: on 2026-08-09, `pnpm exec vitest run tests/unit/museum/first-fire-procession-plan.test.ts tests/unit/museum/first-fire-blender-contract.test.ts tests/unit/museum/first-fire-flame-field.test.ts tests/unit/museum/first-fire-graybox-colliders.test.ts tests/unit/museum/first-fire-graybox-review.test.ts --exclude '.claude/worktrees/**'` passed 29/29 tests across five files.

- **The rejected Blender candidate builds and exports reproducibly.** Commit: none; worktree-only. Evidence: Blender 5.0.1 generated `blender/first-fire-cinder-court-graybox.blend`; `node scripts/verify-first-fire-graybox-glb.mjs` passed the optimized asset with 208,060 bytes, SHA-256 `2addf072392896f9ea3125bc36285489582d862cadf0dd8fce04064eb55ca58d`, one scene, no cameras, no lights, Draco compression, GPU instancing, and 126 flame anchors. The `.blend` SHA-256 is `22ef0ef1a26ea82c901a1f0b25791d445009d24b1c144a42f6c463ea65fa1684`.

- **The current runtime code type-checks.** Commit: none; worktree-only. Evidence: on 2026-08-09, `pnpm exec svelte-check --tsconfig ./tsconfig.json` reported `0 errors and 0 warnings`.

- **The scene-gate file is structurally valid without claiming approval.** Commit: none; worktree-only. Evidence: `node .agents/skills/museum-scene-production/scripts/validate-scene-gates.mjs docs/superpowers/specs/first-fire-cinder-court/scene-gates.json` returned `PASS`. It remains at Gate 0 because the required live motion-capture evidence was never accepted.

- **The failure is visually established.** Commit: none; browser evidence only. At a 1920 × 1080 Chrome DevTools viewport, the Water view had no dominant path cue; the DJ proof view was initially blocked by basalt; after a camera correction, the court was visible but navigation through the room remained unreadable. The independent visual reviewer concluded: accept the reimagined topology only as an overhead experiment, reject the contact sheet and runtime as visual approval. Austen then rejected the walk outright on 2026-08-09.

## Believed done — unverified

- The automatic state owner can progress DJ → DJ complete → EK → EK complete → FL → neutral blackout → green growth. Unit tests cover the transitions, but no human completed the entire route by ordinary WASD movement.

- The optimized GLB's pink Blender guide surfaces are hidden and replaced by an instanced runtime shader. A regression test covers optimized material-name extraction and authored-state classification, and the last browser frame showed shader flames instead of pink guides. The full live count was not re-read from the console after the final extractor change.

- Only one live `MuseumPerformerStation3D` and one detailed hero fire should exist at a time. The code follows that budget, but it was not profiled in Chrome after the final edits.

- The latest proof-camera remount and target-selection changes compile, but the complete deterministic proof sequence was not recaptured after Austen rejected the room.

## In flight

All First Fire work is in the shared primary checkout on `main`; no branch or worktree was created. Base HEAD is `2aef59b53b19163ad83957d2bd30b981be6d9fcd`. The repository contains extensive unrelated dirty work from other sessions. Do not stage, revert, or commit anything outside the explicit First Fire paths.

### Spatial and production contract

- `src/lib/features/museum/data/first-fire-procession-plan.ts`
- `src/lib/features/museum/data/first-fire-blender-contract.ts`
- `scripts/export-first-fire-blender-plan.ts`
- `scripts/generate-first-fire-cinder-court-board.ts`
- `scripts/build-first-fire-graybox.py`
- `scripts/optimize-first-fire-graybox-glb.mjs`
- `scripts/verify-first-fire-graybox-glb.mjs`
- `docs/superpowers/specs/first-fire-cinder-court/`
- `tests/unit/museum/first-fire-procession-plan.test.ts`
- `tests/unit/museum/first-fire-blender-contract.test.ts`

### Rejected runtime slice

- `src/routes/test/first-fire-graybox/+page.svelte`
- `src/routes/test/first-fire-graybox/FirstFireGrayboxWalkScene.svelte`
- `src/routes/test/first-fire-graybox/FirstFireProcessionFlames.svelte`
- `src/routes/test/first-fire-graybox/FirstFireShrineVolumes.svelte`
- `src/routes/test/first-fire-graybox/FirstFireCinderStateEffects.svelte`
- `src/routes/test/first-fire-graybox/first-fire-flame-field.ts`
- `src/routes/test/first-fire-graybox/first-fire-graybox-colliders.ts`
- `src/routes/test/first-fire-graybox/first-fire-graybox-review.ts`
- `tests/unit/museum/first-fire-flame-field.test.ts`
- `tests/unit/museum/first-fire-graybox-colliders.test.ts`
- `tests/unit/museum/first-fire-graybox-review.test.ts`
- `static/models/museum/cave/first-fire-cinder-court-graybox.glb`

### Local evidence

- `artifacts/first-fire-cinder-court/first-fire-cinder-court-contact-sheet.png` exists locally and is intentionally **not** an approved visual target. SHA-256: `9130c22c7d3a797af92ecf58868445a6f038eed438fa138cfa6df50eda1902d4`.
- `docs/superpowers/specs/first-fire-cinder-court/first-fire-cinder-court-gate1-board.svg` is a readable measured plan, SHA-256 `cd4560ddecaaf259b3e19e12ae8ea0d7c0b18bf1805a6f84c199907452c8c086`, but its interior design is superseded by the failed walk.
- The nine Blender review renders are under `%TEMP%/tka-first-fire-cinder-court-evidence/`. They show geometry and rigid paper-like guide flames, not the runtime visual target.

## Loose ends (ranked)

1. **Discard the current interior arrangement before further implementation.** Keep the encounter/state contract, door positions only if useful, and exact DJ/EK/FL content. Do not tune the existing basalt forest or add more flames.

2. **Produce a navigation-first floor plan and five eye-height sightline frames before Blender.** Required frames: Water threshold, hub arrival with exactly one dominant gate, active fire corridor, court reveal after a bend, and coals leading back to the known hub. The route must be understandable without HUD text, arrows, or prior explanation.

3. **Use fire as a boundary and beacon, not visual noise.** The safe floor must remain continuously readable. No flame may overlap the walk centreline or sit close enough to fill the first-person camera. The active gate must be the only moving red landmark visible from the hub. The maze should feel dangerous while remaining a guided corridor, not a search puzzle.

4. **Differentiate the three courts before spatial approval.** The rejected candidate gave all three a circular dais, ring, and torch wreath. DJ, EK, and FL need different footprints and silhouettes while retaining one shared entry/exit throat each.

5. **Get Austen's explicit approval on the navigation proof.** Do not generate a new `.blend`, GLB, or runtime route before that gate. After approval, replace the rejected plan rather than layering another implementation beside it.

6. **Then rebuild the Blender graybox and runtime in order.** Re-run the scene-production gates honestly. Gate 0 still needs live performer-motion evidence; Gate 1 must be regenerated for the approved floor plan; Gate 2 needs first-person sightline proof before another walk link is presented.

## Decisions already made

- On 2026-08-08 Austen approved exploring a reimagined First Fire room with separated performers and a dramatic environmental progression.
- Fire must appear in multiple forms, but it must never own collision. Permanent basalt/architecture owns navigation.
- There are exactly three Fire performers: DJ, EK, and FL. Their exact live data is:
  - DJ: word `JDJD`, sequence `cave-fire-seq-dj`, catalog `tnd-split-opp-jdjd`
  - EK: word `KEKE`, sequence `cave-fire-seq-ek`, catalog `tnd-split-opp-keke`
  - FL: word `LFLF`, sequence `cave-fire-seq-fl`, catalog `tnd-split-opp-lflf`
- The intended order is DJ → return through a known hub → EK → return through the hub → FL → all red/fire extinguishes → a neutral pause → green Earth growth appears.
- Performer rooms should remain spatially separate because each performer demonstrates a different sequence and letters.
- Austen rejected triangle/cone/paper-cutout flames. Torch fire must emit light and cast shadow. Blender guide geometry is never acceptable as player-facing fire.
- On 2026-08-09 Austen rejected the current implementation: `this is terrible. Worse thatn it was before, I don't even know where to walk. I'm totally lost.` This supersedes the earlier `lock it` approval for the current topology and interior placement.
- The next pass must be judged in first person, not from an overhead plan or code metrics.
- Do not use ASCII floor plans. Austen asked for a real readable visual floor plan.

## Gotchas

- The current topology passes geometric tests and still fails as a room. Do not mistake 29 green tests for design acceptance.
- The current Blender contact sheet is actively misleading as visual evidence: its pale organic guides still read like rigid paper flames, multiple red lanes appear active simultaneously, threshold frames contain no performer proxies, and the blackout frame is almost featureless black.
- The optimized GLB uses `EXT_mesh_gpu_instancing`. Object names may collapse during optimization. The runtime extractor now falls back to material semantics and classifies the 72 field anchors by nearest authored fire-guide state.
- The last live correction shrank the instanced flames, changed them to additive blending, classified field flames by DJ/EK/FL state, and remounted the first-person camera for proof-state yaw. These are technical corrections to a rejected design, not a reason to continue polishing it.
- The user's dev server is HTTPS on port 5173 and must not be restarted or killed. During the failed review, 5173 transiently returned a Svelte-kit `ENOENT` for `.svelte-kit/types/src/routes/proxy+layout.server.ts` while other sessions were active. A task-owned HTTPS Vite server responded on 5176. Recheck rather than assuming either current state.
- Run Vitest with `--exclude '.claude/worktrees/**'`; a stale unrelated worktree contains duplicate historical First Fire tests.
- The Git index and worktree are shared with many live sessions. Scope any future commit with explicit First Fire pathspecs. Never use `git add -A`, `git add .`, or a bare `git commit`.
- Headless Blender is `C:\Program Files\Blender Foundation\Blender 5.0\blender.exe` version 5.0.1. The deterministic builder works, but should not be run again until the replacement navigation proof is approved.
- Museum tracker session `6S7U3amt1mpyqTYeqk6Y` recorded the earlier accepted Cinder Court decision `1bUBNo26hJpRq4Bf36gh`. It now needs a superseding rejection/reset decision before the next design is treated as canon.
- This Codex environment exposed no direct task-transfer tool and no Claude Opus model in the collaboration pool. Austen must open an Opus task and point it to this handoff file; the document is written for a cold pickup.
