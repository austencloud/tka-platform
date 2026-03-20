# Sequence Viewer UI Consolidation

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Header cleanup, bottom toolbar redesign, settings surface consolidation

---

## Problem

The sequence viewer has accumulated three overlapping configuration surfaces:

1. **Viewer Settings modal** (gear icon in header) — prop selector + VisibilityTab
2. **Settings module > Visibility tab** — same VisibilityTab component reused
3. **Right-click/long-press context menus** on animation canvas and choreo card

The header is also cluttered with buttons that either belong elsewhere (share link), are admin-only (Copy for Claude), or are redundant (dark mode toggle, settings gear).

## Design

### 1. Header Cleanup

**Remove from header:**
- Dark/light mode toggle (lives in Settings module only)
- Settings gear icon (viewer settings modal is being deleted)
- Copy link button (moves to bottom action row)

**Make admin-only (hidden, not disabled):**
- Copy for Claude button — check `isAdmin` from Firebase auth state via `authState.svelte.ts`. Hidden entirely for non-admin users.

**Header becomes:** Title + Generate dropdown (on compose routes) + Copy for Claude (admin only). On the public share route (`/p/[code]`), just the title.

**Note:** `SequenceViewerDrawerHost.svelte` has its own inline header (not using RouteViewerHeader) with Copy Link and Settings buttons. This inline header also needs cleanup — remove settings gear, move Copy Link to bottom toolbar.

### 2. Bottom Action Row Redesign

Restructure the collapsed (non-expanded) state of ViewerMorphToolbar into two rows:

**Row 1 — Actions:**
```
[Play] [Favorite] [Copy Link] [Save] [Props] [Video] ...
```

- Add **Copy Link** button (link icon + "Copy Link" label, copies shareable URL, shows checkmark feedback)
- Add **Props** button (opens PropSelectionSheet drawer). Must replicate the blue/red tab state and catDogMode logic currently in ViewerSettingsModal (lines 26-44).
- Existing buttons remain: Play, Favorite, Save/Remix, Video, Public/Private, Delete
- Buttons are conditional based on auth state and ownership (same logic as today)

**Row 2 — BPM chip:**
```
[slider icon] {bpm} BPM [chevron up]
```

Same expandable chip that opens transport + tempo controls.

### 3. Settings Consolidation

**Delete entirely:**
- `ViewerSettingsModal.svelte` — the modal opened by the gear icon
- `VisibilityTab.svelte` — only used by ViewerSettingsModal and SettingsModule, both consumers are being removed/modified
- Remove Visibility tab entry from Settings module tab definitions

**VisibilityTab sub-components fate:**
- `PictographPanel` — toggles (TKA glyph, VTG glyph, grid, hand points, etc.) accessible via canvas context menu only. The panel component itself becomes dead code.
- `AnimationPanel` — toggles accessible via canvas context menu only. Dead code.
- `ImagePanel` — image export composition toggles (word, difficulty, creator name, etc.) already exist as direct toggles in the ChoreoCard context menu. Dead code.
- All three panel components can be deleted since context menus build their own toggle lists from state managers directly.

**Canvas display toggles** (from DisplayCategory.svelte: Grid, TKA Glyph, Step Numbers, Beat Position, Props, Word Header, Progress Bar) → accessible only via long-press/right-click context menu on the animation pane. No visible affordance — power-user discovery.

**Card display toggles** (word, step numbers, difficulty, creator name, notes, birthday, QR code) → accessible only via long-press/right-click context menu on the choreo card. Already implemented there.

**Dark mode toggle** → Settings module only (app-wide preference).

**Prop selector** → bottom action row button that opens the existing PropSelectionSheet drawer.

### 4. Context Menu Enhancements

The canvas context menu currently has: Effects, Efforts, Path Shape, Disassemble, and "Canvas Settings..." which opens `CanvasSettingsModal.svelte`.

**Change:** Replace "Canvas Settings..." with a "Display" submenu containing the visibility toggles inline (Grid, TKA Glyph, Step Numbers, etc.). This eliminates one more hop.

**CanvasSettingsModal survives** for effect-specific configuration (Fire settings, LED settings, Trails settings, Effort details, Path Shape details). The "Canvas Settings..." menu item stays but only for these non-display categories. Consider renaming to "Effect Settings..." for clarity.

The choreo card context menu already has direct toggles. No changes needed there.

## Files Affected

### Delete
- `src/lib/shared/sequence-viewer/components/ViewerSettingsModal.svelte`
- `src/lib/shared/settings/components/tabs/VisibilityTab.svelte`
- `src/lib/shared/settings/components/tabs/visibility/PictographPanel.svelte` (evaluate — may be dead)
- `src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte` (evaluate — may be dead)
- `src/lib/shared/settings/components/tabs/visibility/ImagePanel.svelte` (evaluate — may be dead)

### Modify
- `src/routes/sequence/[id]/RouteViewerHeader.svelte` — remove dark toggle, link button, settings gear; admin-gate Copy for Claude (import isAdmin from authState)
- `src/routes/sequence/[id]/+page.svelte` — remove ViewerSettingsModal import, state, and rendering
- `src/routes/p/[code]/+page.svelte` — remove ViewerSettingsModal import, state, and rendering
- `src/lib/shared/sequence-viewer/components/ViewerHeader.svelte` — remove settings gear prop/button
- `src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte` — two-row layout, add Copy Link + Props buttons
- `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte` — pass new props through
- `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` — remove settings modal state, wire new props
- `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` — remove settings gear from inline header, remove ViewerSettingsModal import/rendering, move Copy Link to bottom toolbar
- `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts` — add "Display" submenu with visibility toggles, rename "Canvas Settings..." to "Effect Settings..."
- `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuHost.svelte` — support keepOpen behavior for toggle items in Display submenu
- `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` — update if CanvasSettingsModal integration changes
- `src/lib/features/settings/SettingsModule.svelte` — remove Visibility tab
- Settings tab definitions file (wherever SETTINGS_TABS is defined) — remove Visibility entry

## Out of Scope
- Long-press gesture implementation (already exists via context menu system)
- Transport controls simplification (separate task)
- Expanded BPM controls layout changes (already addressed in current session)
