# Blossom Hanami Redesign — Handoff (2026-09-05)

## Mission

Finish a creative redesign of Blossom into a lush, intimate, believable hanami performance garden. Austen finds the river, archway and stage workable, but the trees too sparse and the pathways unconvincing. He explicitly authorized wide creative freedom in Blender, including Easy Tree, PlantFactory and Meshy when useful. Accessibility, performer clearance, sightlines and runtime performance remain constraints. This session stopped at Austen's request before delivering or visually verifying the rebuilt runtime scene.

**Start in `E:/tka-platform`, directly on `main`. Do not make a worktree.** Austen explicitly changed the workflow on 2026-09-05. Preserve the implementation edits below and the unrelated edits listed separately.

**Immediate warning: the live files are temporarily inconsistent.** The shared JSON plan and ground mask have been rebuilt, but both runtime GLBs are still the old 2026-08-25 files. Export and optimize the saved Blender scene before judging the current browser result.

## Done — verified

Implementation changes are **uncommitted**. There is no implementation commit SHA. The primary checkout HEAD at handoff preparation was `39c20792c5` (`Merge branch 'codex/scripts-audit'`).

- Audited the live Blossom scene in the dedicated in-app browser. The wide view shows scattered trees, a large empty field, disconnected-looking technical pads and a dark horizon berm. The old August handoff's assertion that no trees exist is stale: the baseline builder already had 16 hero trees and 108 distant trees, using two PlantFactory source crowns. The sparse appearance comes substantially from placement distance.
- Inspected Forest live as a visual comparison. Its nearby trunks, understory and continuous ground cover make enclosure more convincing. An Autumn comparison attempt timed out; Ocean was not inspected. Do not claim those comparisons are complete.
- Built the revised Blender scene successfully with:

  ```powershell
  & 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --factory-startup --threads 6 --python scripts/build-blossom-environment.py
  ```

  The successful process exited 0. Its log reported 28 hero trees, 48 midground trees, 64 horizon trees, six source variants, eight lanterns, nine seats, 4,666 grass clumps and 5,105 settled petals. It verified hero trunk/path/water clearances, required scene objects, stage height and bridge slope. Output: `E:/tka-platform/blender/blossom_environment.blend`, 86,609,768 bytes, written 2026-09-05 18:27:04 local time.

- Generated and inspected the Blender QA image. A durable copy is [blossom-hanami-blender-first-pass.png](handoff-assets/2026-09-05-blossom-hanami/blossom-hanami-blender-first-pass.png). **This is a first pass, not visual approval.** It shows clearer paths and planted banks but is dark, retains a large clearing, and uses Blender's old circular stage and backdrop; the runtime hides/replaces those objects.
- The pure shared-plan validator returned `valid: true`, zero failures, 171 sightline rays, 13 connected public nodes, four wheelchair bays, 28 hero anchors, 112 backdrop instances and six actual source variants. One new east tree initially blocked technical access; it was moved to `[34, -36]` and the successful Blender rebuild includes that correction.
- Focused regression tests passed: **2 files, 18 tests**.

  ```powershell
  .\node_modules\.bin\vitest.CMD run tests/unit/3d/blossom-masterplan.test.js tests/unit/3d/blossom-production-contract.test.ts --config tests/config/vitest.config.ts
  ```

  The final test run started 2026-09-05 18:25:37. Tests cover declared geometry and existing behavior, not actual new seat clearance, exported canopy bounds, draw calls or beauty.

## Believed done — unverified

- Revised spatial direction: broad cherry crowns hold the audience lawn; the curving arrival joins an audience crescent; the bridge connects to a quiet gate garden with seating. Low foliage and a timber screen distinguish public space from storage. Whether this reaches Austen's requested visual standard remains unverified.
- The new `scripts/blossom_hanami_details.py` authors nine timber benches with backs/arms, a narrow backstage screen, a rounded gate and segmented dark cap, three combined grass meshes, and canopy-local settled petals. Planting checks paths, water, stage/backstage clearance, audience polygons, bridge landings, gate, trunks, lanterns and seats. Seat geometry itself has no automated collision check yet; inspect it before claiming accessibility or route clearance.
- Grass reuses `make_grass_prototype` and its root-weight UVs, and uses names/metadata recognized by the existing Blossom wind renderer. Runtime wind, normals, quality-tier performance and appearance have not been observed with this export.
- Full scene silhouette, ground quality, seated sightlines, human-height arrival, bridge approaches, gate/backstage contact and wide orbit need browser inspection.
- Asset compression, final transfer size, triangles, draw calls and lower-quality device behavior are unmeasured. More trees does not prove acceptable performance.

## In flight

All actual implementation changes are in **`E:/tka-platform` on `main`**, unstaged/uncommitted:

| Owned path                                                                | State                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/superpowers/specs/blossom-masterplan-r2/blossom-masterplan-r2.json` | Adds `authoringRevision: hanami-garden-r3`; terrain 192 × 196 m instead of 256 × 264 m; lower berms; 58 m maximum orbit; closer hero and background grove; actual candidate IDs; baked curved path stations and adjusted lantern station references. |
| `scripts/build-blossom-environment.py`                                    | Uses all six source variants for heroes, authored candidate assignments, closer backdrop bands, revised canopy thinning, correct gate ground height, new detail module call, optional `BLOSSOM_SKIP_RENDER` support.                                 |
| `scripts/blossom_hanami_details.py`                                       | New, untracked Blender detail module; complete enough to run, still needs review/refinement.                                                                                                                                                         |
| `static/textures/blossom-floor/blossom-ground-family-mask.png`            | New mask, 65,823 bytes. **Currently paired with old GLB until export completes.**                                                                                                                                                                    |
| `tests/unit/3d/blossom-masterplan.test.js`                                | Repetition mutation now clones the whole grove, instead of assuming the retired repetition limit.                                                                                                                                                    |
| `tests/unit/3d/blossom-production-contract.test.ts`                       | Tests actual orbit containment rather than hardcoding the old 82 m / 256 m dimensions.                                                                                                                                                               |

Local generated files, outside the tracked implementation diff:

- `blender/blossom_environment.blend`: **new completed authoring source**, 86,609,768 bytes.
- `static/models/blossom/blossom_environment_raw.glb`: **OLD**, 75,455,516 bytes, 2026-08-25 21:49:47.
- `static/models/blossom/blossom_environment.glb`: **OLD**, 12,324,216 bytes, 2026-08-25 21:49:56.
- Original QA output: `C:/Users/Austen/AppData/Local/Temp/tka-blossom-evidence/blossom_environment_qa.png`, 2,539,793 bytes; copied beside this handoff for persistence.

Unrelated changes observed in the shared checkout, **do not stage, alter or revert**:

- `scripts/audit-frame-budget.mjs`
- `docs/superpowers/specs/flow-fest-sim/austen-site-markers.json`

The task initially created branch `codex/blossom-hanami-garden` in `C:/Users/Austen/.codex/worktrees/ba05/tka-platform`, based on `361c38834d`. That worktree has no implementation edits from this session. After Austen said “no worktree,” all implementation moved to the primary checkout. The branch/worktree were left intact; neither needs to be used for continuation.

No task-owned dev server was started. A process inspection immediately before writing this document found **no running Blender process**. The dedicated browser tab list was empty, so no review tabs remain to clean up. Port 5173 was never stopped or restarted.

## Loose ends (ranked)

1. **Export the saved Blender scene, then optimize it.** The first export ran but failed writing the raw GLB with `PermissionError: [Errno 13] Permission denied`. A retry requesting sandbox escalation was interrupted by the user; filesystem inspection confirms it did not update the raw asset. Permissions have since changed to unrestricted, approval policy `never`. No new permission prompt is needed or allowed in that environment.

   ```powershell
   Set-Location E:/tka-platform
   & 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background blender/blossom_environment.blend --threads 6 --python scripts/blender-export-blossom-full.py
   node scripts/optimize-blossom-glb.mjs
   ```

   Verify output timestamps and contents. Blender can exit 0 despite a Python export exception; read the log. Do not optimize the old raw GLB by accident.

2. **Inspect the rebuilt runtime and iterate creatively.** Use `https://localhost:5173/test/viewer-3d?scene=blossom`. A useful wide comparison pose is `&cam=-42,30,-43&look=0,0,8&fov=50`. A closer proposed pose is `&cam=25,16,-34&look=0,2,5&fov=48`. Review audience eye level, bridge arrival, stage reverse, gate, and wide orbit. The existing tests passing does not mean this composition is finished.
3. **Audit the new detail geometry and asset budget.** Check seat/path intersections, wheelchair/companion space, the backstage screen, gate cap placement and foliage intrusion into the performance envelope. Background instances currently use only the two broad crowns, while heroes use all six forms. Check whether the repeated distant crowns read naturally. All three grass batches currently use the `base` quality tier; lower-tier cost must be measured.
4. **Refine light and material quality after seeing runtime.** No runtime TypeScript lighting, sky, water or atmosphere modules were changed. The Blender first pass is too dark to establish final quality; runtime lighting differs. Do not call the cap “copper” visually: it currently shares the dark torii material despite its object name.
5. **Reconcile stale contract prose and formatting.** The plan retains `status: rejected-visual-review`, `approvalGate.productionChangesAllowed: false` and phase 4; `authoringRevision` separately records this newly authorized rebuild and pending visual review. This avoids inventing user visual approval, but legacy prose is now inconsistent. `verify-blossom-composition.mjs` intentionally refuses to certify that rejected status. Separate current technical validation from actual visual acceptance instead of changing the status merely to make a command green. The builder still prints “Decorative grass: gated for later production phases” even though the new module creates grass; correct that log. Old two-crown/distant-band comments also need a scoped update. The JSON diff is inflated by expanded arrays; format owned files only.
6. **Finish verification and scoped commits when the actual result earns completion.** Tests have already passed; rerun those affected by further changes. No full Svelte check was run, and no final browser matrix, asset inspection or visual acceptance has happened. Respect Austen's direct-main workflow and preserve the other task's edits. Commit only explicit owned paths. No implementation commit or integration was completed in this session.

## Decisions already made

- 2026-09-05: Austen authorized a full creative rethink; existing river, archway and stage can be retained if they earn their place. Do not treat the old rejected layout as locked.
- 2026-09-05: Austen explicitly allowed Easy Tree, PlantFactory and generated Meshy assets when appropriate. Historical documents forbidding all Meshy choices do not override this new authorization. This pass uses existing PlantFactory sources and the existing lantern; it generated no new Meshy assets and spent no credits.
- 2026-09-05: Austen said “I give explicit permission for local access … no prompts please, no worktree.” Work directly in `E:/tka-platform`. Do not ask him to approve routine local work again.
- 2026-09-05: After repeated sandbox prompts, Austen stopped this agent and requested this handoff for another local agent. **Do not resume autonomous implementation in this stopped task.**

## Gotchas

- The final environment update granted `danger-full-access`, enabled network access, and set approval policy to `never`. Earlier permission errors were real sandbox restrictions; that blocker is now gone. Never pass `sandbox_permissions` in the new unrestricted environment.
- `BlossomScene.svelte` now delegates to `src/lib/shared/3d/environments/worlds/blossom/blossom-environment-world.ts`. That owner rotates the authored GLB by PI, hides the authored stage/backdrop, and supplies runtime stage, lighting, water and ground handling. Plan-to-viewer coordinates are `[-x, elevation, depth]`.
- Runtime `Stage3D` can be 6 × 6 m while the plan retains a 12 × 8 m protected performance design. The Blender QA stage is an old circular authoring proxy. Judge stage contact and perceived clearing scale in the real viewer.
- Six uncompressed PlantFactory proof sources are under `static/models/blossom/candidates/plantfactory-family-r1/`. Blender cannot import the meshopt-compressed delivery variants; the builder correctly uses `*-proof.glb`.
- Local source lantern is `static/models/blossom/assets/kasuga-lantern_raw.glb`, present in the primary checkout but absent from the initial task worktree. Use the primary checkout as authorized.
- Authoring is reproducible from the changed builder, JSON and new Python module. It took roughly four minutes with six Blender threads. Sources and temporary helper scripts under `%TEMP%` are not needed to rebuild.
- **Do not rerun `%TEMP%/apply-blossom-redesign.cjs`.** It was a one-time patch helper that adds trees and densifies paths; rerunning it would duplicate that work. `%TEMP%/revise-blossom.cjs` was another editing helper, not a production build entry point. The checked-out source files are authoritative.
- The in-app browser connection timed out during the Autumn comparison and reset its scripting session. Forest and pre-change Blossom were observed; post-change runtime was not.
- Keep the existing 5173 HTTPS/IPv6 dev server untouched. Its successful probe was `curl.exe -k -g "https://[::1]:5173/"`. No replacement dev server is necessary for direct-main work.
- Earlier research: `docs/superpowers/specs/2026-08-23-blossom-scene-rebuild-handoff.md` and `docs/superpowers/specs/blossom-plantfactory-family-r1/`. Their rejected visuals are valuable evidence; their old approval/worktree instructions are superseded by the current request.
