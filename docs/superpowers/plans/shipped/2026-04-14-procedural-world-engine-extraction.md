# Procedural World Engine Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the procedural world engine out of `src/lib/features/realm/` into `src/lib/shared/3d/procedural-engine/`, relocate each destination to its own feature module (or merge into an existing feature), dissolve `RealmModule.svelte`, and delete dead code.

**Spec:** `docs/superpowers/specs/2026-04-14-procedural-world-engine-extraction-design.md`

**Tech stack:** Svelte 5 (runes), TypeScript, Three.js, Threlte, ITI (DI), Vite

**Verification rule:** every phase ends with runtime browser verification, not just `npm run check`. For 3D scenes, that means loading the destination in the browser and confirming rendering + interaction.

---

## File Movement Overview

### Moves (git mv)

| From | To |
|---|---|
| `src/lib/features/realm/core/chunk-manager.ts` | `src/lib/shared/3d/procedural-engine/core/chunk-manager.ts` |
| `src/lib/features/realm/core/hybrid-chunk-manager.ts` | `src/lib/shared/3d/procedural-engine/core/hybrid-chunk-manager.ts` |
| `src/lib/features/realm/core/ecs-world.ts` | `src/lib/shared/3d/procedural-engine/core/ecs-world.ts` |
| `src/lib/features/realm/core/systems.ts` | `src/lib/shared/3d/procedural-engine/core/systems.ts` |
| `src/lib/features/realm/core/realm-config.ts` | `src/lib/shared/3d/procedural-engine/core/world-config.ts` |
| `src/lib/features/realm/core/realm-definitions.ts` | `src/lib/shared/3d/procedural-engine/core/world-definitions.ts` |
| `src/lib/features/realm/terrain/*` | `src/lib/shared/3d/procedural-engine/terrain/*` |
| `src/lib/features/realm/vegetation/*` | `src/lib/shared/3d/procedural-engine/vegetation/*` |
| `src/lib/features/realm/generation/*` | `src/lib/shared/3d/procedural-engine/generation/*` |
| `src/lib/features/realm/rendering/*` | `src/lib/shared/3d/procedural-engine/rendering/*` |
| `src/lib/features/realm/spatial/*` | `src/lib/shared/3d/procedural-engine/spatial/*` |
| `src/lib/features/realm/objects/*` | `src/lib/shared/3d/procedural-engine/objects/*` |
| `src/lib/features/realm/domain/PlacedObject.ts` | `src/lib/shared/3d/procedural-engine/objects/PlacedObject.ts` |
| `src/lib/features/realm/workers/*` | `src/lib/shared/3d/procedural-engine/workers/*` |
| `src/lib/features/realm/components/scene/WorldScene.svelte` | `src/lib/shared/3d/procedural-engine/components/WorldScene.svelte` |
| `src/lib/features/realm/components/scene/WorldSceneContent.svelte` | `src/lib/shared/3d/procedural-engine/components/WorldSceneContent.svelte` |
| `src/lib/features/realm/components/scene/DebugPanel.svelte` | `src/lib/shared/3d/procedural-engine/components/DebugPanel.svelte` |
| `src/lib/features/realm/RealmDestination.svelte` | `src/lib/features/campground/CampgroundDestination.svelte` |
| `src/lib/features/realm/HannonsCampDestination.svelte` | `src/lib/features/hannons-camp/HannonsCampDestination.svelte` |
| `src/lib/features/realm/data/hannons-camp-terrain.json` | `src/lib/features/hannons-camp/data/hannons-camp-terrain.json` |
| `src/lib/features/realm/destinations/archive/**/*` | `src/lib/features/archive/**/*` |
| `src/lib/features/realm/destinations/museum/**/*` | `src/lib/features/museum/scenes/procedural/**/*` |
| `src/lib/features/realm/tools/3d-controls/ThreeDControlsLab.svelte` | `src/lib/features/lab/tools/3d-controls/ThreeDControlsLab.svelte` |

### Deletes

| Path | Reason |
|---|---|
| `src/lib/features/realm/components/picker/**/*` | 5 files, zero consumers |
| `src/lib/features/realm/components/placement/**/*` | 2 files, never mounted |
| `src/lib/features/realm/components/debug/**/*` | 8 files, superseded by scene-feature gear popover |
| `src/lib/features/realm/components/dev/**/*` | 2 files, stubs |
| `src/lib/features/realm/services/implementations/PreviewRenderQueue.ts` | Zero consumers |
| `src/lib/features/realm/destinations/stage/StageDestination.svelte` | `enabled: false`, superseded by `shared/3d/StageWorld.svelte` |
| `src/lib/features/realm/RealmModule.svelte` | Module dissolved |
| `src/lib/features/realm/` (final empty folder) | After all moves complete |

---

## Phase 1 — Engine Extraction

**Purpose:** Move the procedural engine to shared infrastructure. No feature-level rewrites yet; all destinations still live under `features/realm/` after this phase, just importing from a new engine path.

### Task 1.1 — Create the engine directory structure

- [ ] **Step 1: Create target folder tree**

```bash
mkdir -p src/lib/shared/3d/procedural-engine/{core,terrain,vegetation/{config,domain,services/{contracts,implementations}},generation/gpu,rendering,spatial,objects,workers,components}
```

- [ ] **Step 2: Verify folder exists** via `ls src/lib/shared/3d/procedural-engine`.

### Task 1.2 — Move core files

- [ ] `git mv src/lib/features/realm/core/chunk-manager.ts src/lib/shared/3d/procedural-engine/core/chunk-manager.ts`
- [ ] `git mv src/lib/features/realm/core/hybrid-chunk-manager.ts src/lib/shared/3d/procedural-engine/core/hybrid-chunk-manager.ts`
- [ ] `git mv src/lib/features/realm/core/ecs-world.ts src/lib/shared/3d/procedural-engine/core/ecs-world.ts`
- [ ] `git mv src/lib/features/realm/core/systems.ts src/lib/shared/3d/procedural-engine/core/systems.ts`
- [ ] `git mv src/lib/features/realm/core/realm-config.ts src/lib/shared/3d/procedural-engine/core/world-config.ts`
- [ ] `git mv src/lib/features/realm/core/realm-definitions.ts src/lib/shared/3d/procedural-engine/core/world-definitions.ts`

After the two rename-moves (realm-config, realm-definitions), update exported symbol names in the files:

- [ ] In `world-config.ts`: no symbol renames needed (config constants are generic).
- [ ] In `world-definitions.ts`: leave `PERFORMANCE_STAGE_CONFIG`, `MUSEUM_GROUNDS_CONFIG`, `HANNONS_CAMP_CONFIG` as-is — these refer to specific scene presets, not "realm" as a concept.

### Task 1.3 — Move terrain, vegetation, generation, rendering, spatial, objects, workers

Straightforward `git mv` for each subfolder. One directory per step so the commit history stays clean.

- [ ] `git mv src/lib/features/realm/terrain/TerrainMeshGenerator.ts src/lib/shared/3d/procedural-engine/terrain/`
- [ ] `git mv src/lib/features/realm/terrain/terrain-types.ts src/lib/shared/3d/procedural-engine/terrain/`
- [ ] `git mv src/lib/features/realm/vegetation/config/biome-vegetation-rules.ts src/lib/shared/3d/procedural-engine/vegetation/config/`
- [ ] `git mv src/lib/features/realm/vegetation/domain/vegetation-categories.ts src/lib/shared/3d/procedural-engine/vegetation/domain/`
- [ ] `git mv src/lib/features/realm/vegetation/services/contracts/IModelRegistry.ts src/lib/shared/3d/procedural-engine/vegetation/services/contracts/`
- [ ] `git mv src/lib/features/realm/vegetation/services/implementations/ModelRegistry.ts src/lib/shared/3d/procedural-engine/vegetation/services/implementations/`
- [ ] `git mv src/lib/features/realm/generation/seed-generator.ts src/lib/shared/3d/procedural-engine/generation/`
- [ ] `git mv src/lib/features/realm/generation/biome-system.ts src/lib/shared/3d/procedural-engine/generation/`
- [ ] `git mv src/lib/features/realm/generation/vegetation-scatter.ts src/lib/shared/3d/procedural-engine/generation/`
- [ ] `git mv src/lib/features/realm/generation/drainage-calculator.ts src/lib/shared/3d/procedural-engine/generation/`
- [ ] `git mv src/lib/features/realm/generation/real-terrain-zone.ts src/lib/shared/3d/procedural-engine/generation/`
- [ ] `git mv src/lib/features/realm/generation/gpu/* src/lib/shared/3d/procedural-engine/generation/gpu/`
- [ ] `git mv src/lib/features/realm/rendering/* src/lib/shared/3d/procedural-engine/rendering/`
- [ ] `git mv src/lib/features/realm/spatial/octree.ts src/lib/shared/3d/procedural-engine/spatial/`
- [ ] `git mv src/lib/features/realm/objects/* src/lib/shared/3d/procedural-engine/objects/`
- [ ] `git mv src/lib/features/realm/domain/PlacedObject.ts src/lib/shared/3d/procedural-engine/objects/PlacedObject.ts`
- [ ] `git mv src/lib/features/realm/workers/chunk-generator.worker.ts src/lib/shared/3d/procedural-engine/workers/`

### Task 1.4 — Move WorldScene components

- [ ] `git mv src/lib/features/realm/components/scene/WorldScene.svelte src/lib/shared/3d/procedural-engine/components/`
- [ ] `git mv src/lib/features/realm/components/scene/WorldSceneContent.svelte src/lib/shared/3d/procedural-engine/components/`
- [ ] `git mv src/lib/features/realm/components/scene/DebugPanel.svelte src/lib/shared/3d/procedural-engine/components/`

### Task 1.5 — Rewire intra-engine imports

Every file moved in 1.2–1.4 has relative imports to siblings inside realm/. After the moves, those paths are broken. Fix them to point within `shared/3d/procedural-engine/`.

- [ ] **Step 1:** `Grep` for `features/realm/` and `../../features/realm/` inside `src/lib/shared/3d/procedural-engine/`. Fix every hit to use `$lib/shared/3d/procedural-engine/...`.
- [ ] **Step 2:** Specifically verify `realm-config` / `realm-definitions` import renames: any import of `./realm-config` becomes `./world-config`; `./realm-definitions` becomes `./world-definitions`.
- [ ] **Step 3:** `WorldSceneContent.svelte` currently imports `hannonsTerrainData` from `../../data/hannons-camp-terrain.json`. This is destination-specific data the engine shouldn't know about. Refactor: add a `terrainData` prop to `WorldSceneContent.svelte`; the `HannonsCampDestination.svelte` imports the JSON and passes it down.
- [ ] **Step 4:** `npm run check` passes for every file under `shared/3d/procedural-engine/`. Fix any remaining path errors.

### Task 1.6 — Update external consumers (engine paths only)

Eleven import sites reference engine files. Update all of them in one commit.

- [ ] `src/lib/shared/3d/StageWorld.svelte`:
  - `$lib/features/realm/components/scene/WorldScene.svelte` → `$lib/shared/3d/procedural-engine/components/WorldScene.svelte`
  - `$lib/features/realm/core/realm-definitions` → `$lib/shared/3d/procedural-engine/core/world-definitions`
- [ ] `src/lib/shared/3d/components/StageTerrain.svelte`:
  - `$lib/features/realm/core/chunk-manager` → `$lib/shared/3d/procedural-engine/core/chunk-manager`
  - `$lib/features/realm/rendering/instanced-vegetation` → `$lib/shared/3d/procedural-engine/rendering/instanced-vegetation`
  - `$lib/features/realm/rendering/atmosphere` → `$lib/shared/3d/procedural-engine/rendering/atmosphere`
  - `$lib/features/realm/generation/seed-generator` → `$lib/shared/3d/procedural-engine/generation/seed-generator`
- [ ] `src/routes/test/infinite-worlds/+page.svelte`:
  - `$lib/features/realm/components/scene/WorldScene.svelte` → `$lib/shared/3d/procedural-engine/components/WorldScene.svelte`
- [ ] `src/lib/features/realm/RealmDestination.svelte`, `HannonsCampDestination.svelte`, and `destinations/museum/MuseumDestination.svelte` still live under realm/ at this point — their imports of WorldScene/WorldSceneContent need updating too. Grep inside each file and fix.

### Task 1.7 — Phase 1 verification

- [ ] `npm run check` — expect zero new errors related to realm/engine paths. Pre-existing errors (unrelated to this work) are fine.
- [ ] Browser smoke test in order:
  - [ ] Open `localhost:5173`. Navigate to Realm → Realm (campground). Scene loads, terrain renders, trees appear, camera moves.
  - [ ] Navigate to Realm → Museum. 3D museum loads, pavilions render, interaction prompts appear.
  - [ ] Navigate to Realm → Archive. Archive scene loads (IndoorScene, unrelated to engine — should be untouched).
  - [ ] Navigate to Sequence Viewer → 3D mode. StageWorld renders avatars and grid.
- [ ] If any of the above fail, `git diff` against the phase's starting commit to find missed imports.

### Task 1.8 — Commit Phase 1

- [ ] `git add` all changes.
- [ ] Commit message:
  ```
  refactor: extract procedural world engine to shared/3d/procedural-engine

  Moves chunk management, terrain generation, vegetation, atmosphere,
  and WorldScene components out of features/realm/ and into shared
  infrastructure. No behavior changes; destinations still render
  identically via the new engine import paths.

  Follows spec: docs/superpowers/specs/2026-04-14-procedural-world-engine-extraction-design.md
  ```

---

## Phase 2 — Destination Relocation

**Purpose:** Move each destination into its own feature folder, dissolve RealmModule, update MODULE_DEFINITIONS.

### Task 2.1 — Move campground (was RealmDestination)

- [ ] `mkdir -p src/lib/features/campground`
- [ ] `git mv src/lib/features/realm/RealmDestination.svelte src/lib/features/campground/CampgroundDestination.svelte`
- [ ] Inside the moved file, rename any internal refs from "realm"/"Realm" to "campground"/"Campground" for text copy only (not symbols that would break).
- [ ] Fix the file's imports (engine imports now resolve from `$lib/shared/3d/procedural-engine/`, not relative paths).
- [ ] Update `src/lib/shared/3d/destinations/definitions.ts`:
  - Change id `"realm"` → `"campground"`
  - Update `name: "Realm"` → `name: "Campground"` (optional — discuss with user)
  - Update `component: () => import("../../../features/realm/RealmDestination.svelte")` → `("../../../features/campground/CampgroundDestination.svelte")`

### Task 2.2 — Move hannons-camp

- [ ] `mkdir -p src/lib/features/hannons-camp/data`
- [ ] `git mv src/lib/features/realm/HannonsCampDestination.svelte src/lib/features/hannons-camp/`
- [ ] `git mv src/lib/features/realm/data/hannons-camp-terrain.json src/lib/features/hannons-camp/data/`
- [ ] Update the terrain JSON import path inside `HannonsCampDestination.svelte` to the new location.
- [ ] Update `definitions.ts` component path to `../../../features/hannons-camp/HannonsCampDestination.svelte`. Leave `enabled: false`.

### Task 2.3 — Move archive

- [ ] `mkdir -p src/lib/features/archive`
- [ ] `git mv src/lib/features/realm/destinations/archive/* src/lib/features/archive/`
- [ ] Inside every moved file, fix relative imports. Most internal archive imports will resolve correctly after the move (they were already relative to the `archive/` folder).
- [ ] Update `definitions.ts` component path: `../../../features/archive/ArchiveDestination.svelte`.

### Task 2.4 — Merge 3D museum into features/museum/

- [ ] `mkdir -p src/lib/features/museum/scenes/procedural`
- [ ] `git mv src/lib/features/realm/destinations/museum/* src/lib/features/museum/scenes/procedural/`
- [ ] Fix relative imports inside every moved file.
- [ ] Update external consumers:
  - [ ] `src/lib/features/museum/components/game/DimensionFlipProof.svelte` — `SequenceBrowserOverlay` import path.
  - [ ] `src/lib/features/museum/components/panel/DetailPanel.svelte` — same.
  - [ ] `src/lib/shared/di/containers/museum-container.ts` — `MuseumPersister` + `InteractionDetector` import paths.
  - [ ] `tests/unit/museum/layout-calculator.test.ts` — `layout-calculator` import path.
- [ ] Update `definitions.ts` component path: `../../../features/museum/scenes/procedural/MuseumDestination.svelte`.

### Task 2.5 — Move 3D Controls to Lab

- [ ] `mkdir -p src/lib/features/lab/tools/3d-controls`
- [ ] `git mv src/lib/features/realm/tools/3d-controls/ThreeDControlsLab.svelte src/lib/features/lab/tools/3d-controls/`
- [ ] Fix imports inside the moved file.
- [ ] Update `definitions.ts` component path: `../../../features/lab/tools/3d-controls/ThreeDControlsLab.svelte`.
- [ ] Add 3D Controls as a tab inside `features/lab/LabModule.svelte` if it isn't already wired.

### Task 2.6 — Delete dead code

- [ ] `git rm src/lib/features/realm/components/picker/ -r`
- [ ] `git rm src/lib/features/realm/components/placement/ -r`
- [ ] `git rm src/lib/features/realm/components/debug/ -r`
- [ ] `git rm src/lib/features/realm/components/dev/ -r`
- [ ] `git rm src/lib/features/realm/services/implementations/PreviewRenderQueue.ts`
- [ ] `git rm src/lib/features/realm/destinations/stage/StageDestination.svelte`
- [ ] Remove the `stage` entry from `definitions.ts` (the component it pointed to is now gone).
- [ ] Verify `src/lib/features/realm/` is now empty except for `RealmModule.svelte`; if subfolders have stragglers, investigate.

### Task 2.7 — Phase 2 verification

- [ ] `npm run check` — no new errors vs. baseline.
- [ ] Browser tests:
  - [ ] Realm → Realm-world loads campground
  - [ ] Realm → Museum loads 3D museum, exhibits persist via Firebase
  - [ ] Realm → Archive loads
  - [ ] Realm → 3D Controls loads
  - [ ] Sequence Viewer 3D mode still loads
  - [ ] Museum module (2D editor) still loads normally — DimensionFlipProof 3D scene renders, SequenceBrowserOverlay opens from DetailPanel
- [ ] `tests/unit/museum/layout-calculator.test.ts` passes (`npm test -- layout-calculator`).

### Task 2.8 — Commit Phase 2

- [ ] Commit message:
  ```
  refactor: relocate realm destinations to their own feature folders

  - RealmDestination.svelte → features/campground/CampgroundDestination.svelte
  - HannonsCampDestination.svelte → features/hannons-camp/
  - destinations/archive/ → features/archive/
  - destinations/museum/ → features/museum/scenes/procedural/
  - tools/3d-controls/ → features/lab/tools/3d-controls/

  Deletes dead code: debug panels, dev stubs, picker UI, placement HUD,
  PreviewRenderQueue, disabled stage destination.

  RealmModule dissolution deferred to phase 3.
  ```

---

## Phase 3 — Module Dissolution

**Purpose:** Remove the `realm` top-level module. Promote Archive to its own nav entry. Redirect legacy `realm` deep links to `museum`.

### Task 3.1 — Remove `realm` from navigation

- [ ] Read `src/lib/shared/navigation/config/module-definitions.ts`:
  - [ ] Remove the entry with `id: "realm"`.
  - [ ] Add an entry with `id: "archive"`, `label: "Archive"`, an icon (use `fa-scroll` from the destination entry), `isMain: true`, `sections: []` (archive is a single-page module, no tabs).
  - [ ] Add a `MODULE_ID_MIGRATIONS` entry: `realm: "museum"` (preserves deep-link compatibility).
- [ ] Remove `REALM_TABS` from `src/lib/shared/navigation/config/tab-definitions.ts`.
- [ ] Grep for `REALM_TABS` — confirm zero remaining references.

### Task 3.2 — Update ModuleRenderer

- [ ] In `src/lib/shared/modules/ModuleRenderer.svelte`:
  - [ ] Remove the line `realm: () => import("../../features/realm/RealmModule.svelte"),`
  - [ ] Add `archive: () => import("../../features/archive/ArchiveDestination.svelte"),`
  - [ ] Verify the museum preload block doesn't reference realm.

### Task 3.3 — Delete RealmModule.svelte

- [ ] `git rm src/lib/features/realm/RealmModule.svelte`
- [ ] Remove the empty `src/lib/features/realm/` directory if anything remains: `rm -rf src/lib/features/realm/` (verify it's empty first via `ls`).

### Task 3.4 — Verify museum module unaffected

The 2D Museum module (features/museum/MuseumModule.svelte) has internal tabs including a 3D walk mode. Confirm that mode still loads the procedural museum (now at `features/museum/scenes/procedural/MuseumDestination.svelte`).

- [ ] Read `features/museum/MuseumModule.svelte` — find where it dispatches to sub-views.
- [ ] If it routes to the procedural scene, ensure that path is updated.

### Task 3.5 — Deep-link test

- [ ] Browser: navigate to the app with `?module=realm` (or the equivalent deep-link pattern) — verify redirect to `museum`.
- [ ] Navigate to `/archive` — verify archive loads.
- [ ] Navigate to Lab — verify Campground and 3D Controls are accessible there.

### Task 3.6 — Phase 3 verification

- [ ] `npm run check` — zero new errors.
- [ ] `npm test` — all tests pass.
- [ ] Browser smoke test: every former realm destination still reachable by its new path.
- [ ] `Grep` for `features/realm` across the entire repo — zero hits outside `docs/` and `scripts/service-rename-plan.md`.
- [ ] `Grep` for `RealmModule` — zero hits outside docs.

### Task 3.7 — Commit Phase 3

- [ ] Commit message:
  ```
  refactor: dissolve Realm module, promote Archive to its own nav entry

  - RealmModule.svelte deleted; its destinations now reachable directly
    (museum, archive as top-level modules; campground + 3d-controls
    under lab).
  - MODULE_ID_MIGRATIONS: realm → museum (deep-link compat).
  - REALM_TABS deleted.

  features/realm/ folder is gone. Procedural engine lives in
  shared/3d/procedural-engine/.
  ```

---

## Phase 4 — Documentation cleanup

- [ ] Update `MEMORY.md` if any entries reference `features/realm/` paths.
- [ ] Add a short note to `docs/architecture/` describing `shared/3d/procedural-engine/` and how destinations consume it.
- [ ] Update `.monolith-audited.json` and `.deadcode-tracker.json` to remove references to deleted files.

---

## Rollback strategy

Each phase ends with a commit. If Phase N breaks something unrecoverably:

- `git reset --hard HEAD^` to the previous phase.
- Investigate in a scratch branch (do not create unless user explicitly approves — see CLAUDE.md rule).

Do **not** bypass pre-commit hooks. If a hook fails, fix the root cause.

---

## Invariants to preserve across all phases

1. The 3D sequence viewer (StageWorld) keeps rendering avatars + grid.
2. Museum module's 2D editor keeps loading.
3. Museum module's 3D procedural walk mode keeps loading and persisting exhibits to Firebase.
4. Archive keeps loading.
5. Deep links that worked before the refactor still work (via MODULE_ID_MIGRATIONS).
6. `tests/unit/museum/layout-calculator.test.ts` keeps passing.
7. No destination renders blank or throws in the console.

If any invariant breaks mid-phase, stop and fix before continuing.
