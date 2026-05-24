# Sequence Viewer Drawer Header Redesign

**Date:** 2026-05-24
**File:** `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

## Problem

Header layout puts action buttons (heart, save, remix) at top-right where users expect a close button. The dismiss control is a down-chevron with a label at far-left, which reads as "go back" not "close this panel." The "Tap to download" subtitle adds no value.

## Design

### Normal viewing mode

```
[♥ 💾 ✏️ | 👁]  ···  Sequence Viewer  ···  [⋮  ×]
                       (prop toggle)
```

- **Left group** (`drawer-header-left-actions`): favorite, save (conditional), remix, divider, MotionVisibilityToggle, admin copy-for-Claude (conditional)
- **Center**: title "Sequence Viewer" + prop toggle when relevant. No subtitle.
- **Right group** (`drawer-header-right-actions`): ViewerOverflowMenu (⋮), then × close button at far right
- × calls `handleDismiss`
- Down-chevron + label back button removed in normal mode

### Export mode

```
[← Back]  ···  Export Title  ···  [⚙ ⋮  ×]
```

- **Left**: ← Back button (exits export mode, returns to viewer)
- **Center**: export title (Record Scene / Download Animation / Download Card / Upload Video)
- **Right**: export sidebar toggle (conditional), ViewerOverflowMenu, × close button
- × dismisses entire drawer. Back exits export only.

### Landscape mode

- Title group hidden (existing CSS). × still visible.

## Changes

1. Remove `.export-hint` / "Tap to download" from template and CSS
2. Split `.drawer-header-actions` into `.drawer-header-left-actions` and `.drawer-header-right-actions`
3. Move favorite, save, remix, divider, MotionVisibilityToggle, admin copy to left group
4. Move ViewerOverflowMenu to right group
5. Add × close button (`drawer-close-button`) as last element in right group
6. Remove down-chevron back button in normal mode (× replaces it)
7. Keep ← Back button in export mode (exits export, not drawer)
8. Add × close button in export mode right group too
9. Style `.drawer-close-button` to match InboxDrawer's close pattern

## Not changing

- ViewerContentRail (left vertical rail) — untouched
- Split pane content — untouched
- Prop toggle behavior — stays, just no fallback "Tap to download"
- Mobile behavior — follows same layout
