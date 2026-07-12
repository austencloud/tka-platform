# Art in the Library — Design

**Date:** 2026-07-12
**Status:** Approved in conversation (Austen, 2026-07-12)
**Decisions made interactively:** home = Library index → playground detail · restore UX = snapshot + revert · collective noun = **Art** · lineage = stamp word + forward link only.

## Problem

The Playground's three saved collections (Tunnels, 3D Scenes, Mandalas) are the same species as Library collections — curated personal stuff — but live in a disconnected parallel system. Worse conceptually: a **sequence is raw data**; a saved tunnel/scene/mandala is an **expression of that data under specific user-controlled parameters**. Nothing in the UI teaches that two-level hierarchy, and restoring a tunnel or scene **silently overwrites persisted global settings** (effects config, prop types, viewer boot mode, and for scenes the app-wide background theme), which then affects the sequence viewer for everything the user opens afterward. The Playground is technically public in nav but unreleased in spirit; this design is its release, as part of turning the app into an art export curation platform.

## Ground truth (verified 2026-07-12 by two scouts)

| | Mandala | Tunnel | 3D Scene |
|---|---|---|---|
| Entry type | `CollectedMandala` (steps, variant, propTypes) | `CollectedTunnel` (steps, full `TunnelSnapshot`, poster) | `Collected3DScene` (`Scene3DSnapshot` + groups mask, optional steps, poster) |
| Restore side effects | none (renders in-module) | overwrites visibility manager (effort/paths), `animationSettings.trail`, settings propTypes, `tka_tunnel_view_state`, effects-config key, `tka-viewer-mode` → "tunnel" | overwrites all `tka-viewer3d-*` keys, `tka-scene-features`, settings propTypes + **backgroundType (2D theme app-wide)**, `tka-viewer-mode` → "3d" |
| Restore entry point | `MandalaModule.selectMandala()` | `services/open-tunnel-in-viewer.ts` | `services/open-3d-scene.ts` (`applyScene3DLook` / `openScene3DInViewer`) |

- Shared infra: `src/lib/shared/collections/` (`CollectionState<T>`, Firestore `users/{uid}/*-collection`, localStorage guest mode + sign-in migration) + `CollectionGalleryDetail.svelte` shell.
- Library (`MyCollectionsPanel.svelte`) is sequence-only, but its snippet-per-shelf sectioning (My Collections / TKA Originals / Following) and content-agnostic `CollectionCard` are the natural seam.
- Tunnel gallery **browsing** is already sandboxed (`TunnelDetailPreview` restores state on destroy). Only explicit Open in Viewer / Apply look mutates globals — today with zero warning or undo.
- BrowseEngine / smart collections are hard-typed to `SequenceData`; art does NOT ride that pipeline.

## Unit 1 — Library "Art" shelf + nav rename

**`MyCollectionsPanel.svelte`** gains a fourth shelf, heading **Art**, positioned after "My Collections", before "TKA Originals". Rendered in BOTH hosts (desktop rail snippet + phone list snippet), same `shelf-heading` pattern.

Three cards: **Tunnels**, **3D Scenes**, **Mandalas**.
- Count = live entry count from the three collection-state singletons (`tunnelCollectionState`, `scene3dCollectionState`, `mandalaCollectionState`); init lazily on Library mount if needed.
- Cover = latest entry's poster (tunnels/scenes). Mandalas have no poster field → icon + color fallback.
- Card component: reuse/extend `CollectionCard` (it reads generic folder metadata). If poster-cover rendering is missing, extend `CollectionCard` with an optional cover — do NOT fork a new card. Art cards get poster-art covers; sequence collections keep icon-folder look. That visual split is the hierarchy lesson: folders of raw material vs framed pieces.
- Tap → cross-module navigation to the existing playground gallery tab (same pattern as GalleryDrill's `setActiveTab("discover")` mini-tile): `playground` module + `tunnels` / `scenes` / `mandala` tab. No detail UI is ported. No history/nav detail-location write (display-only cards).

**Nav rename:** Playground module → **Art** (label + description + icon, e.g. `fa-palette`) in `module-definitions.ts` / i18n. Module id `playground` and tab ids stay frozen (routes/keys/analytics untouched). Two front doors, one destination: Library indexes your art; the Art module is the gallery space.

i18n: new/changed keys go in `messages/en.json`; keys are typed — run `npm run i18n:types` after adding. Other locales stale-by-default (existing pattern).

## Unit 2 — Settings checkpoint + revert

**New shared service** `src/lib/shared/collections/settings-checkpoint.ts` (pure module + tiny persistence, no class):

- `captureSettingsCheckpoint(label: string)` — snapshots the **superset** of everything either apply path touches:
  - semantic values from live singletons: animation visibility manager (effort preset, path shape, motion-aware paths, blue/red path-line visibility), `animationSettings.trail`, `settingsService` blue/red prop types + `backgroundType`
  - raw string values (or null) for localStorage keys: `tka_tunnel_view_state`, effects-config key, `tka-viewer-mode`, every `tka-viewer3d-*` key, `tka-scene-features`
  - stored as one JSON blob in localStorage key `tka_settings_checkpoint` with `{ label, capturedAt }`.
- `revertSettingsCheckpoint()` — mirror of apply: re-applies singleton values through the same APIs (so mounted singletons resync, not just storage), writes raw localStorage values back (`removeItem` where captured null), restores previous viewer mode. Returns the label for toast copy.

**Wiring:** `openTunnelInViewer` and `applyScene3DLook` call `captureSettingsCheckpoint(name)` as their first act. After apply, show toast: **"Viewer now using '<name>' — Undo"** (~8s). Undo action = `revertSettingsCheckpoint()` + close the sequence overlay if this apply opened one (undo the whole gesture). If the toast system lacks an action button, extend the shared toast primitive — don't hand-roll a one-off.

Checkpoint persists until the next capture overwrites it, so a later "restore previous settings" surface can reuse it (not in v1). Mandala restore stays pure — no checkpoint.

Edge accepted: reverting while a restored viewer is still mounted restores globals; a live tunnel/3D controller may not fully re-read until remount — mitigated by Undo also closing the overlay.

## Unit 3 — Lineage stamp (forward link)

All three entry types gain **optional** fields (zod `.optional()`, no migration, old entries simply lack them):

```ts
sourceWord?: string;        // simplifyRepeatedWord(word) at save time
sourceSequenceId?: string;  // when known in the save context
```

- Stamp at save: tunnel save (`ArtPane.handleSaveTunnel`), scene save (`SaveSceneModal` / `captureScene3DSnapshot` caller), mandala save (`WorkspaceGrid` context menu). All three contexts have the word; stamp id when available.
- Display: detail views show a chip **"From FΨ"** (meta-chip row already exists in tunnel detail; match it in scene + mandala detail). Tap → opens the **source sequence** in the viewer with **no settings seeding** — raw data under current settings, which itself demonstrates the data-vs-expression split. Resolution: by `sourceSequenceId` via library repository when present; fallback `openSequenceOverlay(entry.steps)`.
- Word display always goes through `simplifyRepeatedWord` (rule: simplified-word-display).

## Explicitly not v1

- Public/shared art — collections stay private; sharing gets its own spec after this lands.
- Bidirectional lineage ("Art made from this" on sequence cards) — v2; needs reverse lookup and is an empty affordance for most sequences today.
- BrowseEngine / smart collections over art — pipeline is sequence-typed; not forcing it.
- Retiring the Art (playground) module from main nav — revisit after usage.

## Ledger

- [ ] Unit 1: Library Art shelf (both hosts) + cards + counts + covers + cross-nav + Playground→Art rename + i18n
- [ ] Unit 2: settings-checkpoint service + capture wiring in both apply paths + Undo toast (+ toast primitive extension if needed)
- [ ] Unit 3: schema fields + save-site stamping ×3 + "From <word>" chip ×3 detail views + tap-to-open-source
- [ ] Verification: full `npm run check` green once at the end; unit tests for checkpoint capture/revert symmetry + lineage stamp; runtime evidence per verification-protocol

## Executor discipline (per fable-routing)

Executors re-read this spec at phase start; prove completion with tool output; commit with explicit pathspec (`git commit -m "..." -- <files>`) listing only their own files.
