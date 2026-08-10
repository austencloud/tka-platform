# Scene Composer for Every Scene — Handoff (2026-08-10)

## Mission

Finish the existing shared Scene Composer so every scene exposed by Scene Lab supports fast prop edits: select, place, move, rotate, scale, delete, undo/redo, save, and reload. Winter is the proving slice because its current composition is under active visual review and needs per-tree and per-prop adjustment without another Blender rebuild. Reuse and extend the existing architecture in [the active Scene Composer design](active/2026-05-20-scene-composer-design.md). Do not create another editor.

The user's authorization on 2026-08-10 was: "finish making scene composer work in all our scenes for quick edits." The target is the ten `SceneId` values in `src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts`: `winter`, `forest`, `autumn`, `cosmic`, `ocean`, `ember`, `blossom`, `rainbow`, `celestial`, and `void`.

## Done — verified

- The museum already has a Sims-style editor with F2 entry, raycast selection, TransformControls, placement preview, a picker, transform undo/redo, and persisted manual placements. The editor was introduced in commit `bf892495f3dc90c53feb9d29d4e6b960bca045f6`. Current source proof: `MuseumSceneEditor.svelte`, `PlacementGhost.svelte`, `PlacementPickerPanel.svelte`, `museum-3d-editor-state.svelte.ts`, and `museum-editor-placement.ts` are mounted through `Museum3DScene.svelte` and `DimensionFlipProof.svelte`.

- The generic Scene Composer core exists. `GenericSceneEditor.svelte` was introduced in commit `263444929f3f02cd0e4a36131a84db542ab384c6`, and Scene Lab Compose integration shipped in commit `ec5f0ca2644358aa1b07c12a3adcfc65b10b8e88`. The core provides catalog placement, surface snapping, click selection for composer-owned objects, TransformControls, Delete/Backspace removal, undo/redo, and dev-file persistence.

- The core test suite passed on 2026-08-10 at repository HEAD `49b225992b9d888f3750f811d311b7298ccea85f`: `pnpm exec vitest run src/lib/shared/3d/scene-composer/__tests__` returned 3 files passed and 13 tests passed.

- Autumn and Cosmic plugins are live and explicitly imported by `SceneLab.svelte`. Autumn's plugin began in commit `8baad1c06aa45c52ea60a8f3cee1c1e7a95a41ff`; Cosmic's plugin began in commit `5cf015cbf4da31e017b08af50bc1ee7f3415d8ba`. An Ocean plugin file exists and registers itself, but Scene Lab does not currently import it.

- Winter's current asset and performance contract were verified immediately before this handoff. `winter-environment.glb` passes `node scripts/verify-winter-environment-glb.mjs`, contains 472 trees in GPU instance batches, records tree layout version 6, and preserves at least 0.510 metres of authored corridor clearance. `pnpm exec vitest run tests/unit/3d-winter/winter-settlement-layout.test.ts` passed all 7 tests.

## Believed done — unverified

- Autumn and Cosmic show the Compose control in the live Scene Lab because they are imported and registered. This was proven from current source, not by clicking through both scenes in a browser during this handoff.

- The Ocean plugin may still work if imported, but its 2026-05 implementation predates the current composed Ocean work. Treat it as a candidate for drift repair, not as production-ready coverage.

- Composer persistence writes TypeScript placement modules through `/__composer-placements/:sceneId`. Unit serialization passes, but this handoff did not perform a live save-and-reload through the Vite endpoint.

## In flight

- Work is on `main`. Do not create a branch or worktree unless Austen explicitly asks in the new conversation.

- The checkout is heavily shared and dirty. Do not revert, overwrite, stage, or commit unrelated files. In particular, Winter, Forest, Ocean, Autumn, and Celestial art passes are active. At handoff time the dirty files included:
  - `scripts/winter-tree-layout.json`
  - `static/models/winter/winter-environment.glb`
  - `docs/superpowers/specs/moonlit-winter-hollow/scene-gates.json`
  - `src/lib/shared/3d/environments/scenes/forest/ForestAtmosphereMaterials.svelte`
  - `src/lib/shared/3d/environments/scenes/forest/forest-atmosphere-profile.ts`
  - `src/lib/shared/3d/environments/scenes/ocean/authored/FloraInstances.svelte`
  - `src/lib/shared/3d/environments/scenes/celestial/OliveCloudbreakSlice.svelte`
  - Autumn and Ocean build scripts, layouts, models, textures, and evidence files

- The Winter sightline pass changed the tree layout, optimized GLB, and Gate 2 hashes. Those changes belong to the Winter art pass. Read them as current truth; do not fold them into Scene Composer commits.

## Loose ends (ranked)

1. **Drift-audit and update the active design before changing the contract.** The spec already carries a warning that core phases live but museum migration never happened. Add the native-object and instanced-object editing contract to that spec, or write a tightly linked addendum. Do not follow the old unchecked implementation plan mechanically.

2. **Establish one capability owner.** `src/lib/shared/3d/scene-composer/` must own selection, placement, transforms, deletion, history, and persistence. Migrate the museum editor to a thin adapter around that owner once the shared contract can express museum surface rules. Preserve the museum's current F2 behavior and picker.

3. **Add a scene-native object adapter.** Composer currently recognizes only `ComposedObject` groups carrying `userData.composerId`. The scenes also contain native GLB nodes, runtime components, and `InstancedMesh` members. Extend `SceneComposerPlugin` with an adapter contract that can:
   - enumerate selectable prop instances with stable IDs;
   - resolve a raycast hit, including `intersection.instanceId`, to a placement ID;
   - read and apply position, quaternion, scale, visibility, and deletion;
   - rebuild or patch an instance batch without turning every tree into a separate draw call;
   - expose locked objects that may be selected for inspection but not moved or removed.

4. **Prove the design in Winter.** Keep terrain, the skirt, paths, stage, pond surface, lodge shell, and required lighting locked. Make trees, rocks, logs, stump, seats, woodpile pieces, and appropriate hearth props editable. Cabin, fire, pond, and stage may be movable only if their runtime configuration owners update with them. Preserve stage routes, the cabin sightline, the hearth sightline, grounding, spacing, and settlement exclusions.

5. **Make Winter's source manifests the save target.** `winter-environment.glb` is currently an opaque optimized delivery asset. Do not save edits only as unstable GLB node indexes. Stable placement IDs must survive reordering, optimization, and Blender rebuilds. Prefer manifest-backed IDs and a sidecar mapping for GPU batches. The same authored data must feed runtime and Blender export so the two cannot drift.

6. **Use the actual model catalog.** Do not ship fallback cones, spheres, or cylinders as the editor's visible Winter objects. Catalog items should load the generated snow trees, rocks, logs, seats, and other approved assets. Asset definitions should be reusable by rendering and the placement ghost.

7. **Register every Scene Lab scene.** Create or repair plugins for all ten IDs and import them through one explicit registration owner rather than scattering side-effect imports. `void` may have a deliberately small catalog, but it must make an explicit coverage decision rather than silently lacking Compose mode.

8. **Roll out without colliding with active art sessions.** Prefer new plugin, adapter, manifest, and test files. If a dirty scene component must change, inspect the current diff and coordinate before editing it. Never revert another session's changes.

9. **Add coverage contracts.** At minimum:
   - every `SCENE_OPTIONS` ID resolves to a composer plugin;
   - native mesh and instanced-mesh hits resolve to stable placement IDs;
   - delete, undo, redo, and save/reload preserve IDs and transforms;
   - locked structural objects reject mutation;
   - Winter safety zones reject invalid placements;
   - instance editing does not increase draw calls linearly with tree count.

10. **Visually verify each rollout.** In Theme/Scene Lab, open Compose mode for each scene, select an existing prop, move it, delete it, undo, place one catalog item, save, reload, and prove the change persists. Capture desktop and mobile/tablet layouts for the picker. Run each scene's existing performance verifier after integration.

## Decisions already made

- On 2026-08-10 Austen asked for Sims-like editing across every scene: click a prop, delete it, or place any available prop.

- The shared Scene Composer is the canonical technical direction. Reuse or extend it. Do not create a Winter-only editor or a third object-placement system.

- Winter is the first vertical slice because it is under active review and has the hardest relevant case: hundreds of editable trees delivered through GPU instancing.

- "Any glob" means an authored scene-object instance such as a tree, rock, log, chair, cabin prop, or effect anchor. It does not mean arbitrary triangles, branches inside a tree asset, terrain vertices, or internal TransformControls meshes.

- Fast editing cannot destroy the composition contract. Scene safety rules such as paths, stage clearances, protected sightlines, terrain grounding, and room-specific exclusions remain enforced.

- Runtime performance is not optional. Per-instance editing must preserve batching and instancing in normal viewing mode.

- This is a developer Scene Lab tool first. The existing `PlacementPersistence` interface leaves room for user-facing persistence later, but Firebase or public editing is not part of this assignment.

## Gotchas

- `SceneLab.svelte` currently imports only the Autumn and Cosmic plugin modules. The existing Ocean plugin does nothing in Scene Lab until imported.

- `GenericSceneEditor.findComposerId()` walks ancestors for `userData.composerId`; arbitrary GLB children and instance members do not have this field.

- A Three.js `InstancedMesh` raycast returns one shared mesh plus `instanceId`. TransformControls cannot directly attach to one instance. The editor will need a proxy transform object or an adapter-managed gizmo target, then write the proxy transform back into the instance matrix and mark `instanceMatrix.needsUpdate`.

- Deleting an instance by compacting a matrix array changes later indexes. Stable authored IDs must be separate from transient batch indexes.

- GLTF Transform and meshopt can merge or reorder nodes and instance batches. Node name plus instance index is not a durable persistence key by itself.

- Winter's campfire flame, lights, smoke, pond, lodge smoke, and window light are runtime-owned in `WinterScene.svelte`, while their physical bases live in the GLB/config. Moving one side without its owner will split the effect from the prop.

- The active Scene Composer plan's checkboxes are stale. Current source and tests outrank that plan. The design spec's drift warning is accurate.

- Port 5173 is Austen's HTTPS dev server. Never start, stop, restart, or kill it. Use the in-app browser or a separate Vite port for agent-owned verification, and never overwrite the user's active browser tab.

- Scope every commit with explicit pathspecs. The shared Git index already contains other sessions' state.
