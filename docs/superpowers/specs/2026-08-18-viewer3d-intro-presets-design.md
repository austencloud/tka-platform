# 3D Viewer First-Open Guidance + Presets Surfacing — Design

**Date:** 2026-08-18
**Status:** Approved direction (Austen delegated remaining calls to recommendations)

## Problem

Opening the 3D viewer inside the sequence viewer restores whatever configuration
was last saved to localStorage — eight performers with eight different props and
effects — regardless of the prop the user has set in the app. Meanwhile the
scene-3d-collection preset system (save/load full 3D configurations) exists and
works, but only the *save* half is reachable from the viewer (RightRail bookmark
→ `SaveSceneModal`); *loading* a saved scene requires navigating to Browse → My
Collections → "3D Scenes", which nobody discovers. And the intentional 2D↔3D
background coupling (the live viewer tracks the app-wide `backgroundType`) is
never explained to the user — the app theme just changes.

## Decisions (settled in brainstorm)

1. **Trigger:** guided flow appears on the first-ever 3D open, once per user.
   Persisted flag via the existing onboarding persister (localStorage +
   Firebase). After that, the viewer opens directly but the Presets entry point
   remains.
2. **Prop sync:** a plain open follows the current app prop. Structure restores
   (performer count, formation, camera, effects); props re-seed from
   `settingsService` prop types. Loading a saved preset applies its snapshot
   verbatim, props included.
3. **Scene↔theme:** stays linked (it is intentional and documented in
   `viewer-3d-state.svelte.ts` → `seededBackgroundType`). The fix is copy: the
   scene pickers state "This also sets your app theme."
4. **Flow shape:** live-scene steps — the 3D canvas loads immediately and
   guidance floats over it as skippable cards whose choices take effect live.
   No full-screen takeover (per `src/lib/shared/onboarding/README.md`).

## Components

### 1. `Viewer3DIntro` — first-open guided flow

Location: `src/lib/shared/3d/components/onboarding/` (new folder), mounted by
the 3D pane host (`ViewerMotionSurface` / `Viewer3DCanvas` seam).

- **Gate:** new flag `VIEWER3D_INTRO_ENABLED` in
  `src/lib/shared/onboarding/domain/onboarding-flags.ts`, plus persisted
  completion flag (`hasSeenViewer3DIntro`) through
  `src/lib/shared/onboarding/services/onboarding-persister.ts` and
  `config/storage-keys.ts`. Same pattern as `CREATE_TUTORIAL_ENABLED`; NOT the
  disabled `AUTO_TOURS_ENABLED` coach-mark system.
- **Step 1 — Scene:** reuse the `background-card` web components
  (`@austencloud/backgrounds/card`) already used by
  `BackgroundTab.svelte`. Selection applies live via
  `settingsService.updateSetting("backgroundType", …)` +
  `applyThemeFromColors()` — the world swaps behind the card. Card copy
  includes: "This also sets your app theme."
- **Step 2 — Formation:** reuse `FormationSelector.svelte` presets
  (count-gating via `PRESET_VALID_COUNTS` already handled). Picking one
  rearranges performers live through the existing viewer-3d-state formation
  path.
- **Step 3 — Presets:** if the scene-3d-collection store has saved scenes,
  render them with `Scene3DPreview` thumbnails and one-tap apply
  (`applyScene3DLook`). If none, teach saving instead: point at the RightRail
  bookmark ("build something you like, then save it here").
- **Dismissal:** every step is skippable; completing or skipping sets the
  persisted flag. Reduced motion respected. No focus-trap takeover — the cards
  are an overlay on a live, interactive scene.

### 2. Presets sheet in the viewer

- New Presets entry in `RightRail.svelte` (3D mode only), adjacent to the
  existing Save bookmark.
- Opens a sheet listing saved scenes from
  `scene-3d-collection-state.svelte.ts`, with **"Save current setup"** pinned
  at the top (routes to the existing `SaveSceneModal`).
- Apply path is `applyScene3DLook(scene)` unchanged — it already takes a
  settings checkpoint and shows an Undo toast.
- Empty state: a save-first prompt mirroring intro Step 3.
- Error state: list-load failure renders a retry affordance (per
  error-boundaries philosophy: this is a real user-facing failure path).
- Reuse, don't fork: the sheet composes `Scene3DPreview` and the collection
  store; `Scene3DCollectionModule.svelte` (the Browse surface) remains the
  full-management home (rename/delete). The sheet is load + save only.

### 3. Prop-follow hydrate change

In the plain-open restore path (`scene3d-persister` →
`viewer-3d-state` hydrate):

- Restore performer count, positions/formation, camera, planes, effects as
  today.
- Replace each performer's prop override with the current app prop from
  `settingsService.settings` at hydrate time.
- `applyScene3DLook` (preset load) is exempt: snapshots apply verbatim. The
  distinction hinges on the write path — `writeViewer3DConfig` from a snapshot
  marks the config as preset-sourced (one new field or a sessionStorage intent
  mirroring the existing `SCENE_BPM_INTENT_KEY` pattern) so the next hydrate
  skips the prop re-seed exactly once.

### 4. Copy additions (no architecture change)

- Intro Step 1 card and settings `BackgroundTab` gain the one-liner explaining
  the scene↔theme link.

## Out of scope

- Decoupling 2D/3D backgrounds.
- Per-sequence 3D memory.
- Reviving the `AUTO_TOURS_ENABLED` coach-mark system.
- Any change to the Browse "3D Scenes" management surface.

## Testing & verification

- Unit: hydrate prop re-seed (plain open re-seeds; preset-sourced open does
  not); intro flag set on complete AND on skip; intro never mounts when flag
  present.
- Manual/visual: run the intro on a simulated first visit (extend the
  `src/routes/test/onboarding-first-visit` harness or a dedicated
  `test/viewer3d-intro` route rendering the real components); screenshot the
  card steps and the presets sheet at the required viewports
  (`visual-verification-mandatory.md`) — this is a new surface, so the full
  sweep applies.
- Existing contract: `sequence-viewer-shell-contract.test.ts` must stay green —
  the RightRail change lives inside the shell, which is the sanctioned place.

## Open questions for implementation planning

- Exact mount seam for the intro overlay (ViewerMotionSurface vs. inside
  Viewer3DCanvas) — pick whichever keeps the overlay above the canvas but
  below portal dialogs.
- Whether the presets sheet reuses the existing dock/sheet-dismiss primitive
  (it should; see recent commit d118288194).
