# Viewer Content Switcher & Customizable Split View

**Date:** 2026-05-06
**Status:** Draft

## Problem

The sequence viewer has dead space on the left when in focused/export mode. Currently a simple "back" button lives there. This space should become a proper content switcher — a vertical nav rail that controls what the center viewport shows. Additionally, the dual-pane split view should let users choose what each pane displays rather than hardcoding Animation + Card.

## Architecture: Two Orthogonal State Dimensions

### Current (conflated)

```
editingPane: 'animation' | 'image' | 'video-upload' | null
```

One state controls both "what's in the center" and "what's in the right sidebar." Viewing and editing are entangled.

### New (separated)

| Dimension | Purpose | Values |
|-----------|---------|--------|
| `viewerMode` | What the center viewport shows | `split` · `animation` · `card` · `videos` |
| `exportContext` | What the right sidebar shows (optional) | `animation-export` · `image-export` · `null` |

**Why two dimensions:**
- View animation fullscreen without export controls → `viewerMode: 'animation'`, `exportContext: null`
- View animation with export sidebar → `viewerMode: 'animation'`, `exportContext: 'animation-export'`
- View card fullscreen → `viewerMode: 'card'`, `exportContext: null`
- View card with export settings → `viewerMode: 'card'`, `exportContext: 'image-export'`
- Browse uploaded videos → `viewerMode: 'videos'`, `exportContext: null`
- Split view, no sidebar → `viewerMode: 'split'`, `exportContext: null`

Each dimension is independent. Adding new center modes (3D-only, comparison, practice) doesn't touch export logic. Adding new right-sidebar tools (AI analysis, step editor) doesn't touch the viewport.

## Left Rail: Content Switcher

### When visible

Only when `viewerMode !== 'split'`. Split view = home base, full width, no rail.

### Layout (desktop, top to bottom)

```
┌──────────┐
│  ◄ Back  │  ← Large, easy to press. Returns to split view.
├──────────┤
│          │
│ Animation│  ← Equal-sized section. Icon + label.
│  🎬      │
│          │
├──────────┤
│          │
│   Card   │  ← Equal-sized section. Icon + label.
│  🃏      │
│          │
├──────────┤
│          │
│  Videos  │  ← Equal-sized section. Icon + label. Badge with count.
│  🎥 (3)  │
│          │
└──────────┘
```

- Three equal-height sections fill the vertical space below the Back button
- Each section is a full-width button (the entire section is clickable)
- Active mode gets a highlighted background + left accent border (IconRailNav pattern)
- `videoCount` badge shows on Videos section when > 0 (already fetched in DrawerHost)
- Icon + text label, vertically centered in each section

### Sizing

Grid column: `1fr 4fr var(--export-sidebar-width)` when export sidebar is active, `1fr 4fr 0px` when not. Same proportional approach as the current gutter — rail takes ~20% of pre-sidebar space.

### Mobile

No rail. Mobile uses header Back button (already exists) and footer buttons for mode switching. The rail is desktop-only (≥768px).

### Keyboard

- `ArrowUp` / `ArrowDown` to move between rail items
- `Home` / `End` to jump to first/last
- `Enter` / `Space` to activate
- Follows IconRailNav's existing keyboard pattern

### Icons (Font Awesome solid)

| Mode | Icon | Label |
|------|------|-------|
| Back | `fa-chevron-left` | "Back" |
| Animation | `fa-play` | "Animation" |
| Card | `fa-grip` | "Card" |
| Videos | `fa-video` | "Videos" |

## Customizable Split View: Per-Pane Selectors

### Concept

In split view, each pane has a small selector in its top-left corner showing what content type it displays. Tap to switch.

```
┌──────────────────────────────┬──────────────────────────────┐
│ [Animation ▾]                │ [Card ▾]                     │
│                              │                              │
│         [canvas]             │       [choreo card]          │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

### Selector UI

- Small chip/pill in the top-left corner of each pane
- Shows current content type name + dropdown chevron
- Tap → dropdown with options: Animation, Card, Videos
- Semi-transparent background, appears on hover or always visible (subtle)
- Positioned inside the pane, above content, z-index above canvas

### Content types available in split panes

| Content type | Description |
|-------------|-------------|
| Animation | 2D/3D animation canvas with playback |
| Card | Choreo card (pictograph grid) |
| Videos | Video gallery for this sequence |

### Defaults

- Left pane: Animation
- Right pane: Card
- Persisted to localStorage per-user (not per-sequence)

### Rules

- Both panes CAN show the same content type (e.g., Card + Card)
- Switching a pane's content type doesn't affect the other pane
- Mobile split view (vertical stack) gets the same selectors, positioned at top of each row

### Interaction with focused mode

When user clicks a pane to focus it (expand), the focused content type becomes the `viewerMode`. The rail appears showing that mode as active.

When user clicks "Back" in the rail, they return to split view with both panes restored to their persisted configuration.

## State Management

### New state shape

```typescript
type ContentType = 'animation' | 'card' | 'videos';
type ViewerMode = 'split' | ContentType;
type ExportContext = 'animation-export' | 'image-export' | null;

interface ViewerState {
  viewerMode: ViewerMode;
  exportContext: ExportContext;
  splitConfig: {
    leftPane: ContentType;
    rightPane: ContentType;
  };
}
```

### Persistence

```typescript
// localStorage keys
'tka-viewer-mode'         // ViewerMode — remembered across sequences
'tka-viewer-split-config' // { leftPane, rightPane } — remembered across sequences
```

`exportContext` is NOT persisted. Export sidebar is transient — it appears when you invoke an export action, disappears when done.

### Migration

The existing `editingPane` persistence (`tka-viewer-editing-pane`) maps to the new system:
- `'animation'` → `viewerMode: 'animation'`, `exportContext: 'animation-export'`
- `'image'` → `viewerMode: 'card'`, `exportContext: 'image-export'`
- `null` → `viewerMode: 'split'`, `exportContext: null`

On first load with old key present, migrate to new keys and delete old key.

## Right Sidebar Behavior

| viewerMode | exportContext | Right sidebar shows |
|------------|--------------|-------------------|
| `animation` | `null` | Nothing (fullscreen animation) |
| `animation` | `animation-export` | ExportVideoDrawer (current) |
| `card` | `null` | Nothing (fullscreen card) |
| `card` | `image-export` | ExportImagePanel (current) |
| `videos` | `null` | Nothing or video details (future) |
| `split` | `null` | Nothing |

### How export context activates

- Rail click on a mode → sets `viewerMode` only. `exportContext` stays null. User sees fullscreen content.
- Footer "Download" buttons → sets `exportContext` AND `viewerMode` to match. "Download Animation" → `viewerMode: 'animation'`, `exportContext: 'animation-export'`. "Download Card" → `viewerMode: 'card'`, `exportContext: 'image-export'`.
- Right sidebar close (X or collapse) → sets `exportContext: null`, `viewerMode` unchanged. User stays in focused mode but without the sidebar.
- Rail "Back" → sets `viewerMode: 'split'`, `exportContext: null`. Full reset to home.

This means clicking "Animation" in the rail gives you fullscreen animation for VIEWING. Footer "Download" buttons are the entry to EXPORTING. Viewing ≠ exporting.

## Video Upload Integration

Video upload (`video-upload` in the old system) becomes a secondary action within the Videos mode, not a top-level mode. When `viewerMode === 'videos'`, the center shows the video gallery. An "Upload" button within the gallery triggers the upload flow. No separate `video-upload` editing pane needed.

## Component Architecture

### New components

| Component | Purpose |
|-----------|---------|
| `ViewerContentRail.svelte` | Left rail with Back + three content sections |
| `PaneContentSelector.svelte` | Per-pane dropdown chip for split view |
| `VideoGallery.svelte` | Center content for Videos mode (refactored from VideoPanel) |

### Modified components

| Component | Change |
|-----------|--------|
| `SequenceViewerOrchestrator.svelte` | Replace `editingPane` with `viewerMode` + `exportContext` |
| `SequenceViewerDrawerHost.svelte` | Replace gutter-back with ViewerContentRail; route center content by viewerMode |
| `ViewerSplitPane.svelte` | Add PaneContentSelector to each pane; support configurable content types |
| `ViewerFooter.svelte` | Remove mode-entry buttons (rail handles it); keep playback transport + export triggers |
| `editing-pane-persistence.ts` | Replace with `viewer-state-persistence.ts` — handles viewerMode + splitConfig |

### Data flow

```
ViewerContentRail ──setViewerMode()──► ViewerState
PaneContentSelector ──setSplitConfig()──► ViewerState
Footer export buttons ──setExportContext()──► ViewerState

ViewerState.viewerMode ──drives──► Center content routing
ViewerState.exportContext ──drives──► Right sidebar routing
ViewerState.splitConfig ──drives──► What each split pane renders
```

## Transition Behavior

- Switching modes via rail: 250ms grid transition (existing motion language)
- Pane selector change in split view: crossfade (200ms) within the pane
- Export sidebar open/close: existing grid-template-columns animation
- Rail appear/disappear (entering/leaving split): grid transition same as current gutter

## Scope Boundaries

### In scope
- Left content rail (desktop) with Back + Animation + Card + Videos
- Per-pane content selectors in split view
- Two-dimensional state (viewerMode + exportContext)
- Persistence of viewerMode and splitConfig
- Video count badge on rail
- Migration from old editingPane persistence

### Out of scope
- New content types beyond Animation / Card / Videos
- Video details sidebar (right panel for video mode)
- Mobile rail (mobile keeps existing header + footer pattern)
- Record Scene mode changes (stays as-is, triggered from export context)
- 3D-specific viewport modes
