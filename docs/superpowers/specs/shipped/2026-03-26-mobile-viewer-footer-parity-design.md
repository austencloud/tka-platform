# Mobile Sequence Viewer Footer — Full Feature Parity

**Date:** 2026-03-26
**Status:** Draft

## Problem

The mobile sequence viewer footer hides playback controls (transport, speed presets, practice mode, BPM +/-) behind an expand/collapse toggle (`ViewerMorphToolbar`). When expanded, the action buttons (Favorite, Save, Remix, Video) disappear. Users never see everything at once like desktop does.

Desktop shows a single row: tempo controls | transport | action buttons — all visible simultaneously.

## Goal

Mobile footer achieves full feature parity with desktop. Every control is visible without toggling.

## Design

### Two Always-Visible Rows

**Row 1 — Tempo & Speed:**

```
[- 60 BPM +] [Slow] [Med] [Fast] [Practice]
```

- BPM display with +/- hold-to-repeat buttons (reuse existing `TempoControl` with `showPresets={true}`)
- Three speed preset pills (Slow/Med/Fast) — compact sizing
- Practice toggle button with pulse animation when active

**Row 2 — Transport & Actions:**

```
[⏮] [▶] [⏭]   [♥] [💾] [✏️] [🎬] [⋯]
```

- Left group: 3-button transport — restart, play/pause, next beat
- Right group: icon-only action buttons + overflow trigger
- Color coding preserved: green Save, amber Remix, red Favorite (when active), neutral Video
- Half-step controls (half-beat back/forward) intentionally excluded from mobile — full-beat stepping is sufficient for the compact layout

### Conditional Button Visibility

The same visibility rules from the existing code carry over:

| Button | Condition |
|--------|-----------|
| Favorite | `isLoggedIn && onFavorite` |
| Save | `isLoggedIn && isOwned && !isSaved` |
| Remix | `isLoggedIn && isOwned && isSaved` |
| Video | `isLoggedIn && onVideoUpload` (badge shows `videoCount` via absolute-positioned pip on 44px circle) |
| Props | `isLoggedIn && onPropsOpen` — in overflow menu |
| Copy Link | `isLoggedIn && onCopyLink` — in overflow menu |
| Publish/Unpublish | `isLoggedIn && isOwned && isSaved` — in overflow menu |
| Delete | `isLoggedIn && isOwned && isSaved && onDeleteRequest` — in overflow menu |
| Export Image | `onExportImage` — in overflow menu |

### Logged-Out State

When `isLoggedIn === false`, Row 2 simplifies to:

```
[⏮] [▶] [⏭]   [Get App]
```

"Get App" renders as a pill button (not icon-only) with the `fa-arrow-up-right-from-square` icon + text, matching the existing behavior.

### Secondary Actions (Overflow Menu)

The three-dot overflow menu contains labeled buttons for: Props, Copy Link, Publish/Unpublish, Export Image, Delete. Opens as a popover above the trigger.

### Breakpoint Strategy

The existing `ViewerFooter` uses a ResizeObserver with a 960px threshold for desktop vs "mid" layout. This design replaces the "mid" layout entirely:

- **>= 960px**: Desktop single-row layout (unchanged)
- **< 960px**: New two-row layout (replaces ViewerMorphToolbar)

### Narrow Width Handling (< 375px)

At very narrow widths, Row 1 may overflow. Strategy:
- Speed preset pills use flexible min-width (no fixed 44px width, only 44px height)
- BPM +/- buttons stay at 36px width (existing TempoControl sizing)
- If still too tight, presets wrap to a third row via `flex-wrap: wrap` on the tempo row

## Component Changes

### ViewerFooter.svelte

- Remove the `ViewerMorphToolbar` import and usage
- Replace `{#if layout === "mid"}` block with inline two-row layout
- Row 1: `TempoControl` (with presets visible) + practice button
- Row 2: Transport buttons (restart, play/pause, next) + icon-only action buttons + overflow menu
- Handle logged-out state with "Get App" pill button

### TempoControl.svelte

- Remove the `isMobile` state and the `window.innerWidth < 768` resize listener entirely
- Preset visibility becomes purely prop-driven via `showPresets` (already the case for other consumers like the landscape popover)
- No new `compact` prop needed — the existing component already sizes well; the parent controls layout via flex

### ViewerMorphToolbar.svelte

- Delete. All its functionality moves into ViewerFooter's mid-layout block.

### New: ViewerOverflowMenu.svelte

Location: `src/lib/shared/sequence-viewer/components/ViewerOverflowMenu.svelte`

Props:
```typescript
interface Props {
  isPublished?: boolean;
  onCopyLink?: () => void;
  linkCopied?: boolean;
  onPropsOpen?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onExportImage?: () => void;
  onDeleteRequest?: () => void;
}
```

Behavior:
- 44px circle trigger with `fa-ellipsis-vertical` icon
- Popover opens above trigger, anchored to bottom-right
- Click-outside or Escape to dismiss
- Focus trapped while open
- Menu items use `role="menuitem"`, container uses `role="menu"`
- Arrow key navigation between items
- Each item: icon + label, full-width rows

## Layout Details

### Row 1 (Tempo)

```css
.tempo-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  flex-wrap: wrap; /* safety valve for narrow screens */
}
```

TempoControl fills available width. Practice button sits at the end.

### Row 2 (Transport + Actions)

```css
.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.transport-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.actions-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
```

Transport buttons: 44px circles.
Action buttons: 44px icon-only circles with color-coded borders.

### Action Button Sizing (Icon-Only)

```css
.action-icon-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  /* color coding via border-color and icon color */
}
```

Video badge: absolute-positioned 16px circle at top-right of the 44px button, same pattern as existing `video-badge-sm` in landscape mode.

### Overflow Menu

```css
.overflow-trigger {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.overflow-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  background: var(--theme-panel-bg);
  border: 1.5px solid var(--theme-stroke);
  border-radius: 12px;
  padding: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.overflow-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border-radius: 8px;
}
```

## Touch Target Compliance

All interactive elements meet WCAG AAA 44x44px minimum:
- Transport buttons: 44px circles
- Action buttons: 44px circles
- BPM +/- buttons: existing TempoControl sizing (meets 44px)
- Speed preset pills: 44px height, natural text width (min ~48px with padding)
- Practice button: 44px height
- Overflow trigger: 44px circle
- Overflow menu items: 44px height, full width

## Accessibility

- All buttons have `aria-label` attributes
- Overflow trigger: `aria-haspopup="menu"` + `aria-expanded`
- Overflow popover: `role="menu"` with `role="menuitem"` children
- Arrow key navigation within overflow menu (up/down)
- Escape closes overflow menu, returns focus to trigger
- Focus trapped inside overflow menu while open
- Speed presets use `aria-pressed` for active state
- Practice button uses `aria-pressed`
- `prefers-reduced-motion` disables all animations/transitions

## What This Doesn't Change

- Desktop layout (>= 960px) — untouched
- Landscape layout — untouched (vertical column on right side)
- Auto-hide behavior — still applies to the new two-row footer
- All existing callback props on ViewerFooter — same interface, just rendered differently
- Other consumers of TempoControl (landscape popover, compose module) — unaffected since preset visibility is already prop-driven

## Files Affected

| File | Change |
|------|--------|
| `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte` | Replace mid-layout block with two-row layout |
| `src/lib/shared/sequence-viewer/components/TempoControl.svelte` | Remove `isMobile` state + resize listener |
| `src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte` | Delete |
| `src/lib/shared/sequence-viewer/components/ViewerOverflowMenu.svelte` | New: secondary actions popover |

## Testing

- Visual: verify at 320px, 375px, 414px, 768px, and 959px widths
- Logged-in state: all primary buttons visible and functional
- Logged-out state: "Get App" button renders correctly
- Overflow menu: opens, closes (click-outside + Escape), keyboard navigable
- Video badge renders on 44px circle button
- All buttons functional (play, step, BPM, speed, practice, favorite, save, remix, video)
- Touch targets meet 44px minimum
- Desktop layout unchanged at 960px+
- Landscape layout unchanged
- Narrow screens (320px): verify row wrapping behavior
