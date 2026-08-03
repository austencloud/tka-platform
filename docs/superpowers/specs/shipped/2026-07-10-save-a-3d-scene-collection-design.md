# Save-a-3D-Scene Collection — Design

**Date:** 2026-07-10
**Status:** Approved (Austen: "Scenes is good, accept it, full send")

## Goal

Let a user save the current 3D viewer configuration to a library, mirroring the
existing **tunnel-collection** and **mandala-collection** features: snapshot a
reproducible state blob → Firestore `users/{uid}/scene-3d-collection` → a
Playground "Scenes" tab gallery with the same 4K-unified layout.

"Steps optional": store the sequence steps when present so opening reproduces the
exact performance in that scene; also allow **applying the look** (scene, camera,
performers, formation, planes) to any other sequence without stored steps.

## Why it's harder than tunnel/mandala

3D config is fragmented across four owners, not one live controller:

1. **`createViewer3DState()`** (per-mount) — render mode, camera snapshot,
   performers, formation, selection, planes, grid labels, nav mode, camera
   presets, ocean variant, stage offset, effect toggles, default settings.
   Almost every field already has a `localStorage` serialize path (scattered
   per-key: `tka-viewer3d-*`).
2. **`settingsService`** (global singleton) — `backgroundType` (the
   `@austencloud/backgrounds` enum = the actual scene identity) + `bluePropType`/
   `redPropType`. Applying a scene rewrites this global, which also changes the
   2D background theme — **accepted** (same cross-cutting seam
   `open-tunnel-in-viewer` already lives with).
3. **`createSceneFeatureState()`** — `{stage, audience, environment, campfire,
   tent}` toggles, persisted to `tka-scene-features`. Context is scoped inside
   `Viewer3DCanvas`, so we read the persisted key directly at capture time
   instead of threading context to the save button.
4. **Quality tier** — auto-detected per device; deliberately **not** captured (a
   scene saved on a strong machine must not force a weak one).

## Data model

`src/lib/features/scene-3d-collection/domain/scene-3d-collection-types.ts`

```ts
interface Scene3DSnapshot {
  version: 1;
  scene: { backgroundType: string; oceanVariant: string };
  camera: CameraStateSnapshot | null;          // reused verbatim; restore guards already exist
  performers: StoredPerformerSnapshot[];
  selectedPerformerIndex: number | null;
  activeFormation: string;                      // FormationPreset | "manual"
  propSizeLinked: boolean;
  defaultSettings: { prop: string; effortId: string; planeMode: string;
                     customBluePlane: string; customRedPlane: string };
  visiblePlanes: string[];                      // Plane[]
  showGridLabels: boolean;
  navMode: "orbit" | "fly" | "walk";
  activePreset: string | null;
  activeCameraPreset: string;
  stageGroundOffset: number;
  effectToggles: Record<string, boolean>;       // captured + shown; NOT auto-restored (see Deferred)
  sceneFeatures: Record<string, boolean>;
  props: { bluePropType?: string; redPropType?: string };
}

interface Collected3DScene {
  id: string; name: string; poster: string;    // ~200px WebP data URL
  createdAt: number; snapshot: Scene3DSnapshot;
  steps?: StepData[];                            // present → reproduce exact performance
}
```

Zod: strict where safe (`version`, booleans, numbers); `z.any()`/`z.string()` for
external-enum fields (camera, planes, formation, backgroundType) — same
looseness the tunnel schema uses for `updatedAt`/nested StepData.

## Files (clone the tunnel 4-file template)

`src/lib/features/scene-3d-collection/`
- `domain/scene-3d-collection-types.ts` — types + zod + storage-key/version consts
- `services/firestore-paths.ts` — `users/{uid}/scene-3d-collection[/{id}]`
- `services/firebase-scene-3d-collection-repository.ts` — load/save/remove
- `services/local-scene-3d-collection-repository.ts` — localStorage fallback + migration source
- `services/capture-3d-scene.ts` — reads `getViewer3DContext()` getters +
  `tka-scene-features` key + `settingsService` → `Scene3DSnapshot`; poster via
  `captureTunnelPoster(viewer3DState.webglCanvas)`
- `services/open-3d-scene.ts` — reverse: seed all `tka-viewer3d-*` keys +
  `tka-scene-features` + `settingsService.updateSetting("backgroundType", …)` +
  `persistViewerMode("animation-3d")`, then `openSequenceOverlay(steps)` when
  present ("Open in Viewer") or seed-only + toast ("Apply look")
- `state/scene-3d-collection-state.svelte.ts` — singleton, init/add/remove/rename
  with optimistic rollback (byte-for-byte the tunnel state class)
- `Scene3DCollectionModule.svelte` — Playground tab, reusing the unified
  gallery/detail/4K layout (header + count, poster grid, floating glass back
  button, footer split, container-query 1200/1800 tiers)
- `components/Scene3DDetailPreview.svelte` — **poster still**, not a live
  Threlte re-render (mounting a full scene per gallery selection is too heavy;
  live 3D belongs in the viewer)

Shared additions:
- `viewer-3d-state.svelte.ts` — add `get currentSequenceData()` getter; export
  `readViewer3DConfig(state)` + `writeViewer3DConfig(config)` (they live in this
  module for access to the private `STORAGE_KEY_*` consts)
- `Save3DSceneButton.svelte` in the 3D side panel (`Animation3DSidePanel`), near
  the environment selector — a real button (44px), gated on `getViewer3DContext`

## Reproduce paths

- **Open in Viewer** (steps present) — seed the scattered globals + localStorage,
  `persistViewerMode("animation-3d")`, `openSequenceOverlay(steps)`. The fresh
  viewer mount reads the seeds (identical mechanism to `open-tunnel-in-viewer`);
  `enter3D` restores performers/camera; camera restore guards already validate.
- **Apply look** — seed the look globals only; toast "Scene look applied — open
  any sequence in 3D." No steps needed.

## Wiring

1. `firestore.rules` — add `match /scene-3d-collection/{sceneId}` block (clone of
   tunnel: `read, create, update` if owner; `delete` if owner or admin). Deploy.
2. `auth-boot-orchestrator.ts` — `scene3dCollectionState.init(user.uid)` beside
   the tunnel init.
3. `tab-definitions.ts` `PLAYGROUND_TABS` — add `scenes` entry.
4. `PlaygroundModule.svelte` `tabComponents` — lazy-import the module.
5. i18n — `tab_playground_scenes` / `tab_desc_playground_scenes`.

## Testing

- Domain zod round-trip + rejects malformed (clone tunnel test).
- Local repo round-trip / version-mismatch / clear (clone).
- State: add/remove-rollback/rename-rollback (clone).
- `capture-3d-scene`: given a stub viewer3DState + seeded `tka-scene-features`,
  produces a schema-valid snapshot with the right fields.
- `open-3d-scene`: seeds every expected localStorage key + calls
  `updateSetting("backgroundType")`; look-only path does not open an overlay.

## Deferred (documented, honest)

- **Effect toggles not auto-restored.** The app itself never persists the 3D
  `effectToggles` (they reset each session), so reproducing them is a new
  capability. Captured + shown in the detail meta; not re-applied on open.
- **Detail preview is a poster still**, not a live 3D scene (perf).
- **Guest saves memory-only** until sign-in (same as tunnel/mandala).
- **Quality tier** intentionally device-local, never saved.

## Related

- `[[project_tunnel_collection]]` — the template this clones
- `docs/superpowers/specs/2026-07-08-save-a-tunnel-collection-design.md`
