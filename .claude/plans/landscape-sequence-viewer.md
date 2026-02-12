# Landscape Mode: Sequence Viewer Drawer Host

**Feedback:** HNPo29Dr7IjmoTmCPyCR
**Status:** Planned
**Complexity:** Medium (most pieces already exist)

---

## Problem

When a phone is in landscape orientation, the sequence viewer drawer wastes vertical space:
- Header sits at top (~48px)
- ViewerFooter buttons sit at bottom (~60-80px)
- Only ~50% of the already-short screen height goes to the actual sequence content

The main navigation already moves to a left sidebar in landscape. The ViewerFooter already HAS a vertical sidebar mode. They're just not wired up in SequenceViewerDrawerHost.

---

## What Already Exists

| Component | Landscape Support | Status |
|-----------|------------------|--------|
| `SideNavigation.svelte` | 72px left rail | Working |
| `DeviceDetector.isLandscapeMobile()` | width > height, AR > 1.7, height ≤ 600px | Working |
| `ViewerFooter` `landscape` prop | Vertical icon-only sidebar (72px) | Built, unused in drawer |
| `ViewerSplitPane` `[data-landscape]` | Horizontal 50/50 columns | Built, unused in drawer |
| `SequenceDetailsModal` | Full landscape wiring | Working (reference impl) |

---

## Implementation Plan

### Step 1: Add landscape detection to SequenceViewerDrawerHost

**File:** `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

Replace the simple `isMobileWidth` detection with landscape-aware detection. Use DeviceDetector from the DI container (same pattern as MobileNavigation.svelte):

```typescript
import { container } from "$lib/shared/di";

const deviceDetector = container.items.deviceDetector;
let isLandscape = $state(false);

$effect(() => {
  const settings = deviceDetector.getResponsiveSettings();
  isLandscape = settings.isLandscapeMobile;

  const unsub = deviceDetector.onCapabilitiesChanged(() => {
    const updated = deviceDetector.getResponsiveSettings();
    isLandscape = updated.isLandscapeMobile;
  });

  return unsub;
});
```

### Step 2: Change drawer container layout for landscape

**File:** Same file, CSS section

Currently `.drawer-viewer-container` is always `flex-direction: column`. In landscape, the body and footer should be side-by-side:

```svelte
<div class="drawer-viewer-container" class:landscape={isLandscape}>
```

```css
.drawer-viewer-container.landscape {
  /* Header stays on top (full width, minimal height) */
  /* Body + footer become a row below it */
}

.drawer-viewer-container.landscape .drawer-body-content {
  flex: 1;
}
```

The structure change:
- **Portrait:** column → [header] [body] [footer]
- **Landscape:** column → [header (compact)] [row → [body | footer-sidebar]]

Wrap body + footer in a `.drawer-main` div, and make it `flex-direction: row` in landscape.

### Step 3: Pass landscape prop to ViewerFooter

**File:** Same file, template section (~line 239)

```svelte
<ViewerFooter
  landscape={isLandscape}
  ...existing props
/>
```

### Step 4: Compact header in landscape

In landscape, the header can be slimmed down. Options:
- Reduce padding (already has 8px, could go to 4px)
- Hide the "Sequence Viewer" title text (redundant when content is visible)
- Make back button icon-only (drop the text label)

```css
.drawer-viewer-container.landscape .drawer-header {
  padding-top: 4px;
  padding-bottom: 4px;
  min-height: 36px;
}

.drawer-viewer-container.landscape .drawer-header-title {
  display: none;
}

.drawer-viewer-container.landscape .drawer-back-label {
  display: none;
}
```

### Step 5: Pass landscape to ViewerSplitPane (optional)

ViewerSplitPane already handles landscape via its own `[data-landscape]` attribute and has a prop for it. If the split pane isn't already detecting landscape on its own, pass it:

```svelte
<ViewerSplitPane
  isLandscapeMobile={isLandscape}
  ...existing props
/>
```

Check `ViewerSplitPane` to confirm whether it self-detects or needs the prop.

---

## Feedback Module (Secondary)

The feedback was also mentioned in the request. The submit tab already has landscape container queries (`@container submit-tab (min-width: 600px) and (max-height: 420px)`). The manage tab uses container queries via ResizeObserver.

The feedback module's landscape handling is decent already. If improvements are needed:
- AdminTwoPanelLayout already switches drawer placement (right vs bottom) based on landscape
- Submit form already goes side-by-side in landscape

Lower priority than the sequence viewer.

---

## Files to Touch

1. `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` — main changes
2. `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte` — no changes needed (landscape mode already built)
3. `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` — verify if prop needed

---

## Reference Implementation

`SequenceDetailsModal.svelte` already does this correctly for the desktop modal. Use it as the reference for how landscape detection + prop passing works in that component.

---

## Testing

1. Chrome DevTools → toggle device toolbar → pick a phone → rotate to landscape
2. Verify: footer moves to right side as vertical icon column
3. Verify: header compresses (no title, icon-only back button)
4. Verify: sequence content fills the full height minus the slim header
5. Verify: rotating back to portrait restores normal layout
6. Verify: BPM popover in landscape opens correctly (positioned left of the sidebar)
