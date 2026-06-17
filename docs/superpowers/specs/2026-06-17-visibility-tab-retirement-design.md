# Visibility Settings Tab Retirement — Design

**Date:** 2026-06-17
**Status:** Approved
**Author:** Austen + Claude (Opus 4.8)

## Context

The Settings → **Visibility** tab (`activeTab === "visibility"`) is a three-panel
board (Pictograph / Animation / Image-Card) of display toggles. Settings-module
audit (2026-06-16/17) found it is a **redundant third front-end** onto state the
sequence viewer + context menus already drive.

### State is 100% shared global singletons

Every control mutates a global singleton — the same object the viewer drives:

- `getVisibilityStateManager()` — `visibility-state.svelte.ts` (`globalVisibilityStateManager`)
- `getAnimationVisibilityManager()` — `animation-visibility-state.svelte.ts` (`globalAnimationVisibilityManager`)
- `getImageCompositionManager()` — `image-composition-state.svelte.ts` (`instance`)

The tab sets nothing unique. It is a parallel surface that drifts — the cause of
the 7 dead-wiring bugs the audit found.

### Every control already has a live in-context twin

| Tab domain | Existing surface (same global state) | Coverage |
|---|---|---|
| Pictograph (grid, nonRadial, TKA, TnD/elemental, positions, reversals) | pictograph right-click menu (`pictograph-context-menu-builder.ts:29-83`) | full |
| Animation display (grid, TKA, step#, props, word, progress) | `DisplayPanel` + `Viewer3DVisibilityToggles` + canvas context menu | full |
| Animation extras (pathLines, trail, playback, BPM) | PathShapePanel, SimpleTrailControls, playback controls | full |
| Image/Card (word, step#, difficulty, startPos, QR, mandala, loop, creator, notes, birthday) | `ExportImagePanel` (viewer drawer) | full |

## Decision

**Pure retire.** Delete the tab and its self-contained component tree. No
migration — the capability already lives in the viewer + context menus. The two
roles that were arguably unique resolve rather than relocate:

- **Discoverable home** → viewer drawer + context menus are already the primary
  editing model. The tab was the redundant surface.
- **Edit without a loaded sequence** → not a real gap. Context menus fire on any
  pictograph anywhere (browse grid, create workspace); global state persists, so
  setting it anywhere sets the default everywhere.

Rejected: (B) rebuild the aggregated board inside the viewer, (C) fold toggles
into the Preferences tab. Both recreate a surface that isn't needed. One surface
beats three.

## Change set (blast radius)

1. `navigation/config/tab-definitions.ts` — delete the `visibility` Section from
   `SETTINGS_TABS`. **Profile** becomes `sections[0]` → new settings landing tab.
2. `features/settings/SettingsModule.svelte` — remove `VisibilityTab` import and
   the `{#if activeTab === "visibility"}` branch.
3. `features/lab/services/screenshot-orchestrator.ts` — remove the
   `settings--visibility` capture entry.
4. **Delete** `settings/components/tabs/VisibilityTab.svelte` + the entire
   `settings/components/tabs/visibility/` directory (AnimationPanel,
   AnimationPreviewController, ImagePanel, PictographPanel, MobileSegmentControl,
   ImageExportPreviewLayered, example-data.ts, visibility-types.ts). Verified:
   no external importer references `tabs/visibility/`.

## Safe-by-design

- Stale `localStorage` saved-tab `"visibility"` falls back to `sections[0]`
  (Profile) via the `sections.some()` guard in `navigation-state.svelte.ts:296`.
  No crash.
- `settings-state.svelte.ts` `"visibility"` in `excludeFromRealtimeSync` is the
  persisted visibility settings **key**, not the tab — left untouched.
- The three global state managers are untouched; the viewer keeps driving them.
- i18n keys `tab_settings_visibility` / `tab_desc_settings_visibility` are inline
  on the Section only (no separate catalog entry) — removed with the Section.

## Collateral

The recently restored animation preview and the pictograph fade-consistency work
lived inside the deleted panels and go with them. The fade fix itself was in the
shared `PictographRenderer` (children self-gate visibility; outer wrappers no
longer hard-cut) — that stays and remains correct for all pictograph rendering,
including context-menu preview mode.
