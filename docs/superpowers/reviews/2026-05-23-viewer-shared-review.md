---
phase: viewer-shared-review
reviewed: 2026-05-23T18:45:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
  - src/lib/shared/sequence-viewer/components/RightRail.svelte
  - src/lib/shared/sequence-viewer/components/RouteViewerHeader.svelte
  - src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
  - src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte
  - src/lib/shared/sequence-viewer/components/ViewerOverflowMenu.svelte
  - src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
  - src/lib/shared/sequence-viewer/components/record-scene/RecordSceneChrome.svelte
  - src/lib/shared/timeline/UnifiedTimeline.svelte
  - src/lib/shared/timeline/adapters/animator-playback-adapter.svelte.ts
  - src/lib/shared/timeline/adapters/avatar-playback-adapter.svelte.ts
  - src/lib/shared/timeline/unified-playback-context.ts
  - src/lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte
  - src/lib/shared/browse/services/ThumbnailLocalCache.ts
  - src/lib/shared/choreo-card/state/choreo-card-layout-state.svelte.ts
  - src/lib/shared/navigation/config/tab-definitions.ts
  - src/lib/shared/render/services/implementations/ImageFormatConverter.ts
  - src/lib/shared/render/services/implementations/TextRenderer.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Viewer + Shared UI: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed all uncommitted changes across the sequence-viewer module, shared timeline, browse services, choreo-card layout state, tab definitions, and render services. The changes represent a significant refactor: footer-to-header action migration, tempo/BPM controls added to UnifiedTimeline, practice mode replacing videos mode, 3D canvas persistence via visibility toggling, and record-scene UI consolidation.

Svelte 5 rune usage is correct throughout -- `$state`, `$derived`, `$derived.by`, `$effect`, and `$props` patterns are applied consistently. Reactivity chains are properly wired. No broken imports found; removed components (TempoPopover, ViewerFooter) are fully cleaned up from import graphs.

Three warnings and three info items identified. No critical security issues.

## Warnings

### WR-01: Export-mode back button closes entire drawer instead of exiting export

**File:** `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte:293`
**Issue:** The back button inside the `{#if isAnyExportActive}` header block now calls `handleDismiss` (which closes the entire drawer overlay) instead of the previous `handleExitExport` (which returned to the normal viewer state within the drawer). A user who enters image/video export mode and presses "Back" will lose their viewer context entirely rather than returning to split-pane view.
**Fix:** Restore a dedicated export-exit handler or route through the mode state machine:
```svelte
<!-- line 293: change handleDismiss to a handler that exits export mode -->
<button
  type="button"
  class="drawer-back-button"
  onclick={() => {
    // Exit export mode, return to viewer -- don't close drawer
    if (onExitExport) onExitExport();
  }}
  aria-label="Exit export mode"
>
```

### WR-02: validateFormatOptions always returns false for valid input

**File:** `src/lib/shared/render/services/implementations/ImageFormatConverter.ts:170`
**Issue:** `validateFormatOptions` checks `["PNG", "JPEG", "WEBP"].includes(options.format)` but the `ImageFormatOptions.format` type is `"png" | "jpeg" | "webp"` (lowercase, defined at line 6). The uppercase array will never match a correctly-typed lowercase input. Any caller relying on this validation will get `false` for valid options.
**Fix:**
```typescript
validateFormatOptions(options: ImageFormatOptions): boolean {
  return options && ["png", "jpeg", "webp"].includes(options.format);
}
```
Also update `getSupportedFormats` (line 173-175) and `getOptimalFormat` (line 165-167) to return lowercase values for consistency with the type, or change the type to uppercase -- but pick one and be consistent.

### WR-03: Fragile DOM query for BPM popover outside-click detection

**File:** `src/lib/shared/timeline/UnifiedTimeline.svelte:129`
**Issue:** `handleOutsideClick` uses `document.querySelector(".bpm-popover")` to find the popover element. If multiple UnifiedTimeline instances exist on the page (e.g., split pane with 2D and 3D viewers), all instances share the same class selector. Clicking outside one popover could inadvertently match another instance's popover, preventing it from closing -- or the wrong instance's popover could be checked.
**Fix:** Use the already-bound `popoverEl` ref instead:
```typescript
function handleOutsideClick(event: MouseEvent) {
  if (!showBpmPopover) return;
  const target = event.target as HTMLElement;
  if (popoverEl && bpmBtnEl && !popoverEl.contains(target) && !bpmBtnEl.contains(target)) {
    showBpmPopover = false;
  }
}
```

## Info

### IN-01: Debug console.log statements left in ChoreoCard

**File:** `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte:767,1107,1179`
**Issue:** Three verbose `console.log` statements fire on every render cycle, resize observation, and contain-dimension calculation. These produce high-volume output in production and leak internal state details (column counts, container dimensions, aspect ratios) to the browser console.
**Fix:** Remove all three lines, or gate behind a `DEV` constant:
```typescript
// Delete lines 767, 1107, and 1179 entirely, or:
if (import.meta.env.DEV) console.log(`[ChoreoCard:renderAllCells] ...`);
```

### IN-02: Dead component files no longer imported

**File:** `src/lib/shared/sequence-viewer/components/record-scene/RecordSceneRecordButton.svelte`
**File:** `src/lib/shared/sequence-viewer/components/record-scene/RecordingModeToggle.svelte`
**Issue:** Both files exist on disk but are no longer imported by any component (RecordSceneChrome.svelte inlined their functionality). They are dead code.
**Fix:** Delete both files.

### IN-03: ThumbnailLocalCache DB_VERSION skips from 3 to 5

**File:** `src/lib/shared/browse/services/ThumbnailLocalCache.ts:25`
**Issue:** `DB_VERSION` jumped from 3 to 5, skipping version 4. While IndexedDB handles non-sequential version bumps correctly (the `onupgradeneeded` handler deletes and recreates the store), the skip suggests a version was used during development and then abandoned. Not a bug, but makes version history harder to reason about.
**Fix:** No action required. Document the skip in the version comment if meaningful, or renumber to 4 if version 4 was never deployed.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
