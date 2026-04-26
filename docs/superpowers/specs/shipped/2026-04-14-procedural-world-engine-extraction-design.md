# Procedural World Engine Extraction

## Problem

`src/lib/features/realm/` does three jobs at once:

1. **A procedural world engine** — chunk manager, terrain mesh generator, vegetation scatter, GPU compute, atmosphere/water rendering, octree, ECS, worker-based generation. This is infrastructure.
2. **A collection of 3D destinations** that use the engine (Campground, Hannon's Camp, the 3D Museum scene) and destinations that don't (Archive uses `IndoorScene`, Stage uses `StageWorld`).
3. **A module + tab router** (`RealmModule.svelte`) that switches between some of these destinations.

The name "realm" no longer describes what the folder is. The 3D surfaces are a museum, a village, a festival sim, a sequence viewer, and a couple of exploration destinations — no single one is a "realm". Calling shared procedural-world infrastructure "realm" forces every future 3D feature to either import from a feature folder it doesn't own, or duplicate the engine.

Today's consequences:

- `src/lib/shared/3d/StageWorld.svelte` imports `WorldScene`, `ChunkManager`, `VegetationManager`, `AtmosphereManager`, `SeededNoise`, `PERFORMANCE_STAGE_CONFIG` from `features/realm/`. Shared-layer code depending on a feature folder.
- `src/lib/features/museum/components/game/DimensionFlipProof.svelte` and `DetailPanel.svelte` import `SequenceBrowserOverlay` from `features/realm/destinations/museum/overlay/`. One feature reaching into another.
- `src/lib/shared/di/containers/museum-container.ts` imports `MuseumPersister` and `InteractionDetector` from inside realm's destinations folder.
- `tests/unit/museum/layout-calculator.test.ts` imports from `features/realm/destinations/museum/domain/`.
- Dead and dev-only code (picker UI, placement HUD stubs, disabled stage destination, unused `PreviewRenderQueue`) is ~30% of the folder.

## Goal

Extract the procedural engine into `src/lib/shared/3d/procedural-engine/` as infrastructure. Relocate each destination to its own feature module (or merge into an existing feature). Dissolve `RealmModule.svelte` — each destination becomes its own nav entry or moves under Lab. Delete dead code.

## Not in scope

- Rewriting engine internals (chunk allocator, Poisson scatter, terrain compute shader, vegetation scatter).
- Changing museum/archive state formats, persistence schemas, or Firebase contracts.
- Touching `features/museum/` 2D editor, DimensionFlipProof, or other internals beyond import paths.
- Village, Festivals, or 3D sequence viewer code (zero realm dependencies today).
- Adding new destinations.

## Target structure

### Engine (moves to shared infrastructure)

```
src/lib/shared/3d/procedural-engine/
├── core/
│   ├── chunk-manager.ts
│   ├── hybrid-chunk-manager.ts
│   ├── ecs-world.ts
│   ├── systems.ts
│   ├── world-config.ts           (was realm-config.ts)
│   └── world-definitions.ts      (was realm-definitions.ts)
├── terrain/
│   ├── TerrainMeshGenerator.ts
│   └── terrain-types.ts
├── vegetation/
│   ├── config/biome-vegetation-rules.ts
│   ├── domain/vegetation-categories.ts
│   ├── services/contracts/IModelRegistry.ts
│   └── services/implementations/ModelRegistry.ts
├── generation/
│   ├── seed-generator.ts
│   ├── biome-system.ts
│   ├── vegetation-scatter.ts
│   ├── drainage-calculator.ts
│   ├── real-terrain-zone.ts
│   └── gpu/
│       ├── gpu-chunk-generator.ts
│       ├── terrain-compute-generator.ts
│       └── terrain-compute-types.ts
├── rendering/
│   ├── atmosphere.ts
│   ├── water.ts
│   ├── drainage-water.ts
│   ├── instanced-vegetation.ts
│   ├── model-cache.ts
│   └── terrain-texture-material.ts
├── spatial/
│   └── octree.ts
├── objects/
│   ├── object-catalog.ts
│   ├── PlacedObjectRenderer.ts
│   └── PlacedObject.ts           (was domain/PlacedObject.ts)
├── workers/
│   └── chunk-generator.worker.ts
└── components/
    ├── WorldScene.svelte          (was components/scene/WorldScene.svelte)
    ├── WorldSceneContent.svelte
    └── DebugPanel.svelte          (dev-only, gated behind feature flag)
```

### Destinations (move to features)

```
src/lib/features/campground/
└── CampgroundDestination.svelte       (was RealmDestination.svelte)

src/lib/features/hannons-camp/
├── HannonsCampDestination.svelte
└── data/hannons-camp-terrain.json

src/lib/features/archive/
├── ArchiveModule.svelte                (new thin wrapper)
├── ArchiveDestination.svelte
├── components/
├── domain/
└── state/

src/lib/features/museum/
├── MuseumModule.svelte                 (existing 2D editor + mode switcher)
├── ... existing files unchanged ...
└── scenes/
    └── procedural/                     (was realm/destinations/museum/)
        ├── MuseumDestination.svelte
        ├── overlay/SequenceBrowserOverlay.svelte
        ├── components/
        ├── domain/
        ├── services/
        └── state/

src/lib/features/lab/tools/3d-controls/
└── ThreeDControlsLab.svelte            (was realm/tools/3d-controls/)
```

The 3D procedural museum is a *rendering mode* of the museum feature, not a separate feature. Putting it under `features/museum/scenes/procedural/` reflects that. `DimensionFlipProof.svelte` is the existing 3D scene within museum; the procedural variant joins it as a second scene choice.

### Dead code deleted

- `components/picker/*` (5 files) — destination picker UI, replaced by main nav
- `components/placement/*` (2 files) — stub object placement HUD, never mounted
- `components/debug/*` (8 files) — superseded by the new scene-feature gear popover system (spec `2026-04-13-scene-feature-system-design.md`)
- `components/dev/*` (2 files) — world editor stubs
- `services/PreviewRenderQueue.ts` — offscreen preview queue, zero consumers
- `destinations/stage/StageDestination.svelte` — `enabled: false`, superseded by `shared/3d/StageWorld.svelte`

Dev-only `DebugPanel.svelte` remains but is gated behind a feature flag (only mounted when `showDebug=true`, which is never set in production paths).

### Module dissolution

Currently:

- `MODULE_DEFINITIONS` has a `realm` entry (id: `"realm"`, `isMain: true`, sections: `REALM_TABS`).
- `REALM_TABS` has two sections: `realm-world`, `3d-controls`.
- `RealmModule.svelte` hardcodes a `tabComponents` map with five keys: `realm-world`, `archive`, `museum`, `museum-2d`, `3d-controls`.
- `ModuleRenderer.svelte` maps `realm` → `RealmModule.svelte`.

After:

- `MODULE_DEFINITIONS`: remove `realm`. Add `archive` as a main module (The Kinetic Archive is a real destination, not an experiment).
- `MODULE_ID_MIGRATIONS`: add `realm` → `museum` (most polished destination; preserves deep-link compatibility).
- `REALM_TABS`: delete.
- `RealmModule.svelte`: delete.
- `ModuleRenderer.svelte`: remove `realm` loader, add `archive` loader, preserve `museum` (which will render the 2D editor or the procedural scene depending on its internal tab state).
- Campground becomes a Lab tab (`features/lab/` already exists as the catch-all for experiments).
- Hannon's Camp moves to `features/hannons-camp/` but stays disabled in `DESTINATIONS` registry — not visible in nav. Available for re-enabling later.
- 3D Controls moves to `features/lab/tools/3d-controls/` as a lab tool.

### Destinations registry (`shared/3d/destinations/definitions.ts`)

Keep the registry — it still serves the destination manager. Update import paths:

- `realm` → `../../../features/campground/CampgroundDestination.svelte` (rename the `id` to `campground` too, for consistency)
- `archive` → `../../../features/archive/ArchiveDestination.svelte`
- `museum` → `../../../features/museum/scenes/procedural/MuseumDestination.svelte`
- `3d-controls` → `../../../features/lab/tools/3d-controls/ThreeDControlsLab.svelte`
- `stage` → delete entry (file is being deleted)
- `hannons-camp` → `../../../features/hannons-camp/HannonsCampDestination.svelte` (stays `enabled: false`)

## External consumer updates

Eleven import sites need path updates. Full list in the plan doc. Summary:

| Consumer | Old path | New path |
|---|---|---|
| `shared/3d/StageWorld.svelte` | `features/realm/components/scene/WorldScene.svelte` | `shared/3d/procedural-engine/components/WorldScene.svelte` |
| `shared/3d/StageWorld.svelte` | `features/realm/core/realm-definitions` | `shared/3d/procedural-engine/core/world-definitions` |
| `shared/3d/components/StageTerrain.svelte` | `features/realm/core/chunk-manager` | `shared/3d/procedural-engine/core/chunk-manager` |
| `shared/3d/components/StageTerrain.svelte` | `features/realm/rendering/instanced-vegetation` | `shared/3d/procedural-engine/rendering/instanced-vegetation` |
| `shared/3d/components/StageTerrain.svelte` | `features/realm/rendering/atmosphere` | `shared/3d/procedural-engine/rendering/atmosphere` |
| `shared/3d/components/StageTerrain.svelte` | `features/realm/generation/seed-generator` | `shared/3d/procedural-engine/generation/seed-generator` |
| `features/museum/components/game/DimensionFlipProof.svelte` | `features/realm/destinations/museum/overlay/SequenceBrowserOverlay.svelte` | `features/museum/scenes/procedural/overlay/SequenceBrowserOverlay.svelte` |
| `features/museum/components/panel/DetailPanel.svelte` | (same) | (same) |
| `shared/di/containers/museum-container.ts` | `features/realm/destinations/museum/services/implementations/MuseumPersister` | `features/museum/scenes/procedural/services/implementations/MuseumPersister` |
| `shared/di/containers/museum-container.ts` | (same for InteractionDetector) | (same pattern) |
| `tests/unit/museum/layout-calculator.test.ts` | `features/realm/destinations/museum/domain/layout-calculator` | `features/museum/scenes/procedural/domain/layout-calculator` |
| `routes/test/infinite-worlds/+page.svelte` | `features/realm/components/scene/WorldScene.svelte` | `shared/3d/procedural-engine/components/WorldScene.svelte` |

Asset path for `hannons-camp-terrain.json`: the file moves with the component. One hardcoded import in `WorldSceneContent.svelte` must become a parameter passed from the destination component (engine shouldn't know about specific destination data).

## Verification plan

Each phase verified at runtime, not just compile-time:

1. **Engine extraction**: build passes, `npm run check` reports no new realm-related errors.
2. **Each destination move**: load the destination in-browser, camera moves, terrain renders, no console errors.
3. **Museum merge**: both museum modes (2D edit + 3D procedural walk) load from `MuseumModule.svelte`.
4. **Module dissolution**: `/realm` deep link redirects to `/museum`. `/archive` loads. Lab tab shows 3D Controls and Campground.
5. **DI container**: `container.items.museumPersister` resolves. `container.items.interactionDetector` resolves. 3D Museum walk mode loads/saves exhibits from Firebase.

## Risk analysis

| Risk | Likelihood | Mitigation |
|---|---|---|
| Asset path breaks for `hannons-camp-terrain.json` | Medium | Pass terrain data as a prop to the scene component instead of importing in engine code |
| Missed import somewhere in 85+ files | Medium | Use `Grep` for `features/realm/` after each phase; verify zero hits before merging |
| Museum 3D scene silently breaks | Low | Manual runtime verification after the museum merge |
| GPU worker path confusion | Medium | Workers use explicit paths in Vite; update and test during engine phase |
| Svelte component context chains break | Low | All context setting is inside destinations, not crossing the engine boundary |

## Open questions

1. Should `campground` keep that id or get a more evocative name? (The old id was `realm`.)
2. Should `ArchiveModule.svelte` wrap `ArchiveDestination.svelte` in nav chrome, or should `ArchiveDestination.svelte` itself be the module?
3. Do we need a `MODULE_ID_MIGRATIONS` entry for `realm`, or is breaking old deep links acceptable?

Answer defaults if unspecified during execution: (1) rename to `campground`, (2) `ArchiveDestination.svelte` becomes the module directly (no wrapper — it's a 3D scene module, matches Museum's pattern), (3) add the migration for safety.
