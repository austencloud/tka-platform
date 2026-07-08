# Save-a-Tunnel — Favorite Tunnels Collection (design)

**Status:** Approved 2026-07-08. Ready for implementation plan.

## Problem

You can right-click a static mandala cell and save it to a "favorite mandalas"
collection (Playground). You cannot save a **tunnel** — the animated kaleidoscope
in the sequence viewer's Art pane. Today the only way to keep a tunnel is a video
export, which is slow and "a little funky." Austen wants to right-click a live
tunnel (or hit a "Save tunnel" button) and snapshot its ENTIRE reproduction state
— "the exact effects, the exact configurations, the exact speed, the exact
efforts, the exact playback, the exact prop, and the exact path type and
everything" — into a browsable collection page that mirrors the favorite-mandalas
one, and reproduce it instantly with no export. Export stays available from the
viewer and from the collection page.

## Prior art (investigated, cloned)

- **Favorite mandalas** is a clean, self-contained 4-file Firebase template:
  `mandala-collection-types.ts` (interface + zod + storage key/version) →
  `firestore-paths.ts` (`users/{uid}/mandala-collection`) →
  `firebase-mandala-collection-repository.ts` (load/save/remove over the shared
  `firestore-crud.ts`) → `mandala-collection-state.svelte.ts` (singleton
  `init/add/remove/teardown/count` + one-time localStorage→Firestore migration).
  Boot wiring: `auth-boot-orchestrator.ts` calls `.init(uid)` on sign-in;
  `auth-state.svelte.ts` calls `.teardown()` on sign-out. Save trigger: a
  right-click "Save to Collection" context-menu item in `WorkspaceGrid.svelte`
  (`mandalaCollectionState.add({...})`). Collection page: `MandalaModule.svelte`,
  a `phase` state machine (gallery/detail/…) surfaced as the Playground
  `mandala` tab; cards re-render live from stored `steps`.
- **`tunnelUserPresets`** (`tunnel-user-presets.svelte.ts`) is a config-only,
  localStorage, device-local, 24-item quick-preset store. It is NOT the vehicle —
  it captures only `TunnelConfig`, no sequence, no effects/effort/playback/prop/
  path, no auth, no cross-device sync, no gallery. Leave it doing its narrow job.
- **Tunnel full state** lives across several stores (see §2). Everything is plain
  serializable data. Effects already exposes a `config` getter + `replace()`
  capture/restore pair (also used by scene-undo). The video exporter
  (`export-coordinator.exportTunnel`) is NOT headless — it needs a live playback
  controller + panel state + a `TunnelViewController` built from the sequence, so
  "export from the collection page" routes into the real viewer (chosen below).

## Decisions (resolved with Austen)

- **Preview fidelity:** poster grid + live detail. The grid shows a static
  poster-frame thumbnail captured at save (unlimited cards); clicking a card
  plays the real animated tunnel in the detail view (one live WebGL canvas). A
  live grid is infeasible — browsers cap ~16 live WebGL contexts.
- **Export from the collection:** "Open in viewer + export." The collection
  Export button applies the snapshot into the real sequence viewer, switches to
  Tunnel mode, and fires the existing export flow. One export code path, zero
  duplication.
- **Persistence:** Firebase, cross-device, cloning the mandala template exactly.
  Guests get localStorage until sign-in (same migration path as mandala).

## 1. Data model

New doc type `CollectedTunnel` (mirrors `CollectedMandala`):

```ts
interface CollectedTunnel {
  id: string;            // assigned by the store
  name: string;
  steps: Step[];         // the tunneled sequence — needed to reproduce + export
  snapshot: TunnelSnapshot;
  poster: string;        // ~200px WebP data URL, captured at save
  createdAt: number;     // Date.now() at add()
  source?: "viewer" | "default";
}
```

`TunnelSnapshot` — the flat, JSON-serializable reproduction blob (every store
investigator 2 enumerated; trail *visuals* ride inside `effects.trails`, so they
are not double-stored):

```ts
interface TunnelSnapshot {
  version: number;                                   // SNAPSHOT_VERSION, migratable
  tunnel:   { config: TunnelConfig; gridVisible: boolean; spectrum: TunnelSpectrum; section: TunnelSection };
  effects:  EffectsConfig;                           // structuredClone(effectsConfigState.config)
  effort:   EffortId;
  paths:    { pathShape: PathShape; motionAwarePaths: boolean; bluePathLines: boolean; redPathLines: boolean };
  playback: { bpm: number; playbackMode: PlaybackMode };
  props:    { bluePropType: string; redPropType: string };
  trailRender: TrailSettings;                        // animationSettings.trail
}
```

Zod schema mirrors mandala's (`z.any()` for `createdAt`/`updatedAt` because
`firestoreSet` stamps a server `updatedAt`). Constants:
`TUNNEL_COLLECTION_STORAGE_KEY = "tka:tunnel-collection"`, `SCHEMA_VERSION = 1`,
`SNAPSHOT_VERSION = 1`. Firestore doc stays well under 1MB (≤64 steps + a few-KB
WebP + small blob).

## 2. Capture / Apply — one symmetric pair

New `src/lib/shared/sequence-viewer/tunnel/tunnel-snapshot.ts`:

- `captureTunnelSnapshot(deps): TunnelSnapshot` — reads each store via its getter:
  `controller.config` / `gridVisible` / `spectrum` / `section`;
  `structuredClone(effectsConfig.config)`; `vm.getEffortPreset()`;
  `vm.getPathShape()` / `getMotionAwarePaths()` / `getVisibility("bluePathLines")`
  / `("redPathLines")`; `{ bpm, animationPanel.playbackMode }`;
  `settings.bluePropType` / `redPropType`; `animationSettings.trail`.
- `applyTunnelSnapshot(deps, snap): void` — fans out through the EXISTING
  per-store setters, never blasting stores directly, so persistence, reactivity,
  URL sync, and clamping all fire: `controller.applyConfig(snap.tunnel.config)` +
  assign `gridVisible/spectrum/section`; `effectsConfig.replace(snap.effects)`;
  `vm.setEffortPreset` / `setPathShape` / `setMotionAwarePaths` /
  `setVisibility("bluePathLines",…)` / `("redPathLines",…)`;
  `playback.handlePlaybackModeChange` + `playback.handleBpmChange(bpm)`;
  `updateSettings({ bluePropType, redPropType })`.

`deps` is a plain object of the already-available store handles/contexts, passed
in by the caller — the module has no ambient store access (testable in isolation).

The same pair powers three flows:

1. **Save** — `captureTunnelSnapshot` → `captureTunnelPoster` → `add`.
2. **Live detail preview (sandboxed)** — on mount: `prev = captureTunnelSnapshot(deps)`
   (the current globals) → `applyTunnelSnapshot(deps, saved)`; on unmount:
   `applyTunnelSnapshot(deps, prev)`. Restores your global effort/paths/trail so
   browsing the collection never mutates live settings. (`bpm`, props, effects,
   config are already per-instance props on `TunnelArtView`; only effort, paths,
   and `trailRender` are true globals — hence the guard.)
3. **Open in viewer** — `applyTunnelSnapshot(deps, saved)` persistently, then the
   viewer's existing Export works unchanged.

`captureTunnelPoster(deps): Promise<string>` — renders ONE composited tunnel
frame at the current playhead, downscaled to ~200px, returns a WebP data URL.
Reuses the exporter's single-frame compositing (base + `additionalLayersAt` +
spectrum). Riskiest unit; see §7.

## 3. Persistence — 4-file mandala clone

New `src/lib/features/tunnel-collection/`:

- `domain/tunnel-collection-types.ts` — `CollectedTunnel` + `TunnelSnapshot`
  interfaces, zod schemas, storage key + versions.
- `services/firestore-paths.ts` — `users/{uid}/tunnel-collection`.
- `services/firebase-tunnel-collection-repository.ts` — `loadTunnels/saveTunnel/
  removeTunnel` over `firestoreList/Set/Delete`.
- `services/local-tunnel-collection-repository.ts` — versioned localStorage
  load/save/clear (migration source only).
- `state/tunnel-collection-state.svelte.ts` — `class TunnelCollectionState`
  singleton `tunnelCollectionState`: reactive `collection`, `loading`, `count`,
  `init(uid)` (load Firestore → migrate localStorage), `add()`, `remove(id)`,
  `teardown()`.

Boot wiring: add `tunnelCollectionState.init(user.uid)` beside the mandala call
in `auth-boot-orchestrator.ts`; add `.teardown()` beside mandala's in
`auth-state.svelte.ts`.

## 4. Save triggers

- **Button:** a "Save tunnel" button in `ArtSettingsPanel.svelte`'s tunnel
  section, beside the always-visible `.customize-btn` (reuse its class). Default
  name = sequence word || `Tunnel #{count+1}`; `toast.success` on save.
- **Right-click:** add a "Save tunnel" (`fa-bookmark`) ENTRY to `AnimatorCanvas`'s
  existing context-menu host via a new additive `extraContextMenuItems?:
  ContextMenuEntry[]` prop (threaded canvas → its menu host). `TunnelArtView`
  passes the entry. One menu, no collision (the canvas's own effects items stay);
  reuses the shared `ContextMenu` primitive; mirrors mandala's menu-item pattern.

Both call `captureTunnelSnapshot` + `captureTunnelPoster` → `tunnelCollectionState.add`.
The save handler lives where the store handles are in scope (ArtPane /
TunnelArtView), passed the `deps` object.

## 5. Collection page — Playground "Tunnels" tab

`src/lib/features/tunnel-collection/TunnelCollectionModule.svelte`, mirroring
`MandalaModule`:

- `phase`: `"gallery" | "detail"`.
- Gallery: `{#each tunnelCollectionState.collection}` → poster `<img>` cards
  (static, unlimited), name label, empty-state hint ("Right-click a tunnel in the
  viewer to save one"). Click → `phase = "detail"`.
- Detail: ONE live `<TunnelArtView>` seeded from the saved snapshot (sandboxed
  apply per §2.2 — a local `TunnelViewController.applyConfig(snapshot.tunnel.config)`,
  a local effects context `replace(snapshot.effects)`, `steps` + `bpm` + prop
  types passed as props, globals borrowed+restored). Actions: **Open in Viewer**
  (apply snapshot into the real viewer + load steps + switch to Tunnel mode),
  **Export** (Open in Viewer → auto-fire existing Export), **Delete** (two-tap
  confirm → `remove(id)`).

Registration: `tab-definitions.ts` `PLAYGROUND_TABS` gains a "Tunnels" tab (icon
`fa-fan`); `PlaygroundModule.svelte` `tabComponents` gains
`tunnels: () => import(".../TunnelCollectionModule.svelte")`. Gated the same way
as the mandala tab (behind the existing playground/mandala flag).

## 6. Files

**Create:** `features/tunnel-collection/domain/tunnel-collection-types.ts`,
`.../services/firestore-paths.ts`, `.../services/firebase-tunnel-collection-repository.ts`,
`.../services/local-tunnel-collection-repository.ts`,
`.../state/tunnel-collection-state.svelte.ts`, `.../TunnelCollectionModule.svelte`;
`sequence-viewer/tunnel/tunnel-snapshot.ts` (+ `.test.ts`);
`features/tunnel-collection/state/tunnel-collection-state.test.ts`.

**Modify:** `AnimatorCanvas.svelte` + its context-menu host (additive
`extraContextMenuItems`), `TunnelArtView.svelte` (pass the save entry + expose
`deps` for capture), `ArtPane.svelte` (wire the save handler + Open-in-Viewer
plumbing), `ArtSettingsPanel.svelte` ("Save tunnel" button),
`SequenceViewerOrchestrator.svelte` (apply-snapshot + load-steps entry for
Open-in-Viewer/Export), `auth-boot-orchestrator.ts`, `auth-state.svelte.ts`,
`tab-definitions.ts`, `PlaygroundModule.svelte`.

## 7. Testing & risks

**Tests:** `tunnel-snapshot.test.ts` — capture→apply→capture idempotent
round-trip (with mock `deps`), and a coverage assertion that the snapshot
includes every enumerated field (guards a future store being added and silently
dropped). Zod accept/reject. `tunnel-collection-state.test.ts` — add/remove/count
+ localStorage migration (mock repo). Full `npm run check` 0/0; then Austen's
live confirm for the actual save→gallery→reproduce loop (in-app, not curl-able).

**Risks:**
- **Poster capture** (WebGL composite read) is the delicate unit. Primary: reuse
  the exporter's single-frame composite at ~200px. Fallback: read the on-screen
  canvas at the current animation frame. Isolated behind `captureTunnelPoster` so
  a fallback swap doesn't ripple.
- **Sandboxed detail preview** must restore globals on unmount even if the user
  navigates away mid-preview (`onDestroy` guard). Same capture/apply pair, so no
  new restore logic.
- **Curated/default tunnels** (a `DEFAULT_TUNNELS` seed like `DEFAULT_MANDALAS`) —
  deferred; start with an empty collection.

## Related

- `project_tunnel_performer_appearance` (speed/spotlight — snapshot must capture
  `speedOverrides`, already inside `TunnelConfig`).
- `project_tunnel_choreo_reconstruction` (the "magic button" — will consume the
  same saved snapshot to build choreo sheets).
- Mandala template: `docs/superpowers/specs/shipped/2026-05-20-mandala-collection-firebase-design.md`.
