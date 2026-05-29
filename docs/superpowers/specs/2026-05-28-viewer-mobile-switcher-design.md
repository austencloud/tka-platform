# Sequence Viewer — Mobile View-Switcher Parity

**Date:** 2026-05-28
**Status:** Design — approved, pending spec review
**Area:** `src/lib/shared/sequence-viewer/`

## Problem

On desktop the sequence viewer has a left vertical rail (`ViewerContentRail.svelte`) to switch between **Side-by-Side** and single views (**2D / 3D / Card / Mandala**, plus a **Practice** toggle). The split also auto-orients: stacked rows in portrait, columns in landscape.

On mobile this switcher is **hidden entirely** — `SequenceViewerDrawerHost.svelte` sets `showRail = !isMobileWidth` (line ~286), where `isMobileWidth = window.innerWidth < 768` (lines ~84-94). A resizable vertical sidebar (180px default) doesn't fit a portrait phone, so it was simply removed — leaving mobile users with no way to switch views. They've fallen behind the desktop experience.

## Goal

Give mobile the **same view-switching capability as desktop**: pick Side-by-Side or any single view. Presented as a bottom bar in portrait (thumb-reachable). Landscape phones (width ≥ 768) already show the sidebar rail, so they're unaffected.

## Decisions (locked)

- **Split orientation:** unchanged. Auto rows in portrait, columns in landscape (existing `@media` rules in `ViewerSplitPane.svelte`). No manual toggle — the user explicitly rejected one.
- **3D on mobile:** stays enabled. Full parity, no gating change.
- **Switcher placement:** portrait → bottom bar; landscape/desktop (≥768px) → existing sidebar rail.
- **Comparison pairing:** `ComparisonModeBar` keeps showing in Side-by-Side mode to pick the pairing (2D+Card / 3D+Card / 2D+3D / 2D+Mandala). On mobile it floats top-center as it does now.

## Components

### New: `viewer-modes.ts` (shared mode config)
`src/lib/shared/sequence-viewer/services/viewer-modes.ts`

Extract the mode list currently inlined in `ViewerContentRail.svelte` into a shared const so the rail and the new bottom bar share one source of truth:

```ts
export interface ViewerModeOption {
  mode: ViewerMode;          // 'split' | 'animation' | 'animation-3d' | 'card' | 'mandala'
  icon: string;              // fontawesome class
  label: string;
  requiresWebgl2?: boolean;  // 'animation-3d' → filtered when !webgl2Available
}
export const VIEWER_MODE_OPTIONS: ViewerModeOption[] = [ ... ];
```

`Practice` stays a separate toggle (not a `ViewerMode`), surfaced as its own bottom-bar item like it is in the rail.

### New: `ViewerModeBottomBar.svelte`
`src/lib/shared/sequence-viewer/components/ViewerModeBottomBar.svelte`

- Horizontal bottom bar built from the existing **`NavButton.svelte`** primitive (`src/lib/shared/navigation/components/buttons/NavButton.svelte`) — the same icon+label+active button the global `BottomNavigation` uses, with its container-query label behavior.
- Props mirror the rail's: `activeMode`, `webgl2Available`, `practiceActive`, `onSelectMode`, `onSelectSplit`, `onPracticeToggle`.
- Filters out `animation-3d` when `!webgl2Available` (same rule as the rail).
- Pinned to the bottom with `padding-bottom: env(safe-area-inset-bottom)`; sits **above** the viewer's playback transport.
- Justification for a new component (never-hand-roll): a horizontal safe-area bottom bar is structurally different from the resizable vertical sidebar; it reuses `NavButton` + the shared mode config rather than duplicating either. Closest existing analog `BottomNavigation` is bound to global `navigationState`/`MODULE_DEFINITIONS`, so it can't be reused directly.

### Modified: `ViewerContentRail.svelte`
- Import `VIEWER_MODE_OPTIONS` instead of the inlined list. Behavior and appearance unchanged.

### Modified: `SequenceViewerDrawerHost.svelte`
- Keep `showRail = !isMobileWidth` for the sidebar.
- Add: when `isMobileWidth`, render `<ViewerModeBottomBar>` wired to the same `ctx` handlers the rail receives (lines ~428-431).
- Place the bottom bar above the existing transport controls in the drawer layout.

## Unchanged

- `ViewerSplitPane.svelte` split-orientation media queries.
- 3D init / `wants3D` / `webgl2Available` gating.
- `ComparisonModeBar.svelte` render condition (split mode, not exporting).
- Desktop and landscape (≥768px) layout.

## Data flow

```
ViewerModeBottomBar (portrait)  ─┐
ViewerContentRail (landscape/desktop) ─┤→ same ctx handlers
                                       │   onSelectMode → viewerState.setViewerMode
                                       │   onSelectSplit → viewerState.setViewerMode('split')
                                       │   onPracticeToggle → ctx.practiceActive
                                       └→ activeMode = viewerState.viewerMode
```

Both switchers are thin presentational consumers of the same state + config. Selecting a mode flows through the existing `viewerState` setters; no new state.

## Testing

- Unit: `VIEWER_MODE_OPTIONS` filters `animation-3d` when `webgl2Available` is false; rail and bottom bar render the same option set.
- Runtime (browser :5173, narrow viewport): bottom bar appears in portrait, hidden ≥768px; sidebar rail appears ≥768px, hidden below; selecting each mode switches the view; Side-by-Side shows the comparison bar; bottom bar clears the transport and the iOS home indicator.
- Verify visually that the bottom bar stacks above the transport without crowding (explicitly not assumed).

## Out of scope

- Redesigning viewer transport / toolbar / export chrome for mobile.
- Any change to the split's auto-orientation behavior.
- Mobile 3D performance tuning.
