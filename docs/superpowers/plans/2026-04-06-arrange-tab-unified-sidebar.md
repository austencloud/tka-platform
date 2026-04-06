# Arrange Tab Unified Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the arrange tab's separate control panel + drawer with a single unified sidebar containing collapsible sections for Grid Layout, Cell Editor, and Playback.

**Architecture:** Create a new `ArrangeSidebar.svelte` that wraps existing components (GridLayoutControls, CellEditorPanel, PlaybackBar) in collapsible sections. Modify ArrangeTab to use it instead of the control panel + Drawer. Strip standalone styling from CellEditorPanel so it can live inside the sidebar.

**Tech Stack:** Svelte 5, TypeScript, CSS Grid layout

**Spec:** `docs/superpowers/specs/2026-04-06-arrange-tab-unified-sidebar-design.md`

---

## File Structure

All paths relative to `src/lib/features/compose/tabs/arrange/`.

| File | Action | Responsibility |
|------|--------|---------------|
| `components/sidebar/ArrangeSidebar.svelte` | Create | Unified sidebar with collapsible Grid Layout, Cell Editor, Playback sections |
| `ArrangeTab.svelte` | Modify | Replace control-panel + Drawer with ArrangeSidebar |
| `components/grid/cell-editor/CellEditorPanel.svelte` | Modify | Remove close button, onClose prop, standalone panel styling |

---

### Task 1: Create ArrangeSidebar

**Files:**
- Create: `src/lib/features/compose/tabs/arrange/components/sidebar/ArrangeSidebar.svelte`

This is the main new component. It renders three sections:
1. Grid Layout — collapsible, wraps `GridLayoutControls`
2. Cell Editor — only visible when a cell is selected, wraps `CellEditorPanel`
3. Playback — always pinned to bottom, wraps `PlaybackBar`

- [ ] **Step 1: Create the component file**

```svelte
<!--
  ArrangeSidebar.svelte

  Unified sidebar for the arrange tab. Contains collapsible sections:
  - Grid Layout (auto-collapses on cell selection)
  - Cell Editor (appears on cell selection)
  - Playback (always pinned to bottom)
-->
<script lang="ts">
  import type { GridCell } from "../../state/arrange-grid-state.svelte";
  import type { CellMediaType, TransformType } from "../../../../compose/domain/types";
  import type { CellEffect } from "../../../../compose/domain/types";
  import type { TipEffectMap, TipEffortMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { TrailMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";
  import type { PropColors } from "../../../../compose/domain/types";
  import GridLayoutControls from "../grid/GridLayoutControls.svelte";
  import CellEditorPanel from "../grid/cell-editor/CellEditorPanel.svelte";
  import PlaybackBar from "../shared/PlaybackBar.svelte";

  interface ArrangeSidebarProps {
    // Grid layout props
    gridRows: number;
    gridCols: number;
    hasContent: boolean;
    onSetGridRows: (n: number) => void;
    onSetGridCols: (n: number) => void;
    onSetDimensions: (rows: number, cols: number) => void;
    onPresetLayout: (preset: string) => void;

    // Cell editor props (null when no cell selected)
    selectedCell: GridCell | null;
    cellIndex: number;
    clipboardHasData: boolean;
    transformingLayer: { cellId: string; layerIndex: number } | null;
    onAddSequence: () => void;
    onRemoveLayer: (layerIndex: number) => void;
    onEditLayerOffset: (layerIndex: number) => void;
    onClearCell: () => void;
    onMediaTypeChange: (mediaType: CellMediaType) => void;
    onCopyLayer?: (layerIndex: number) => void;
    onCopyCell?: () => void;
    onPasteLayer?: () => void;
    onTransformLayer?: (layerIndex: number, transformType: TransformType) => void;
    onSetSpeed?: (speed: number) => void;
    onSetEffect?: (effect: CellEffect) => void;
    onSetTrailMode?: (mode: TrailMode) => void;
    onSetEffort?: (effort: string) => void;
    onSetColors?: (colors: PropColors) => void;
    onSetBlueVisible?: (visible: boolean) => void;
    onSetRedVisible?: (visible: boolean) => void;
    onSetOffset?: (offset: number) => void;
    onSetTipEffectMap?: (map: TipEffectMap) => void;
    onSetTipEffortMap?: (map: TipEffortMap) => void;

    // Playback props
    hasAnyLayers: boolean;
    isPlaying: boolean;
    currentBeat: number;
    totalBeats: number;
    bpm: number;
    skipStartPosition: boolean;
    onPlayPause: () => void;
    onStop: () => void;
    onStepHalfBack: () => void;
    onStepHalfFwd: () => void;
    onStepFullBack: () => void;
    onStepFullFwd: () => void;
    onBpmChange?: (bpm: number) => void;
    onToggleLoop?: () => void;
  }

  const p: ArrangeSidebarProps = $props();

  // Grid config section: auto-collapse when cell selected, auto-expand when deselected
  let gridConfigManualOverride = $state<boolean | null>(null);
  let prevSelectedCell = $state<GridCell | null>(null);

  // Reset manual override when selection changes
  $effect(() => {
    if (p.selectedCell !== prevSelectedCell) {
      gridConfigManualOverride = null;
      prevSelectedCell = p.selectedCell;
    }
  });

  const gridConfigExpanded = $derived(
    gridConfigManualOverride !== null
      ? gridConfigManualOverride
      : p.selectedCell === null
  );

  function toggleGridConfig() {
    gridConfigManualOverride = !gridConfigExpanded;
  }
</script>

<aside class="arrange-sidebar">
  <!-- Section 1: Grid Layout -->
  <div class="sidebar-section">
    <button
      class="section-header"
      onclick={toggleGridConfig}
      aria-expanded={gridConfigExpanded}
    >
      <span class="section-title">
        <i class="fas fa-th" aria-hidden="true"></i>
        Grid
      </span>
      <div class="section-header-right">
        {#if !gridConfigExpanded}
          <span class="section-meta">{p.gridCols}&times;{p.gridRows}</span>
        {/if}
        <i
          class="fas fa-chevron-down section-chevron"
          class:collapsed={!gridConfigExpanded}
          aria-hidden="true"
        ></i>
      </div>
    </button>
    {#if gridConfigExpanded}
      <div class="section-body">
        <GridLayoutControls
          gridRows={p.gridRows}
          gridCols={p.gridCols}
          hasContent={p.hasContent}
          onSetGridRows={p.onSetGridRows}
          onSetGridCols={p.onSetGridCols}
          onSetDimensions={p.onSetDimensions}
          onPresetLayout={p.onPresetLayout}
        />
      </div>
    {/if}
  </div>

  <!-- Section 2: Cell Editor (only when cell selected) -->
  {#if p.selectedCell}
    <div class="sidebar-section cell-editor-section">
      <CellEditorPanel
        cell={p.selectedCell}
        cellIndex={p.cellIndex}
        clipboardHasData={p.clipboardHasData}
        transformingLayer={p.transformingLayer}
        onAddSequence={p.onAddSequence}
        onRemoveLayer={p.onRemoveLayer}
        onEditLayerOffset={p.onEditLayerOffset}
        onClearCell={p.onClearCell}
        onMediaTypeChange={p.onMediaTypeChange}
        onCopyLayer={p.onCopyLayer}
        onCopyCell={p.onCopyCell}
        onPasteLayer={p.onPasteLayer}
        onTransformLayer={p.onTransformLayer}
        onSetSpeed={p.onSetSpeed}
        onSetEffect={p.onSetEffect}
        onSetTrailMode={p.onSetTrailMode}
        onSetEffort={p.onSetEffort}
        onSetColors={p.onSetColors}
        onSetBlueVisible={p.onSetBlueVisible}
        onSetRedVisible={p.onSetRedVisible}
        onSetOffset={p.onSetOffset}
        onSetTipEffectMap={p.onSetTipEffectMap}
        onSetTipEffortMap={p.onSetTipEffortMap}
      />
    </div>
  {:else}
    <div class="empty-cell-placeholder">
      <i class="fas fa-mouse-pointer" aria-hidden="true"></i>
      <span>Click a cell to edit</span>
    </div>
  {/if}

  <!-- Section 3: Playback (always pinned to bottom) -->
  {#if p.hasAnyLayers}
    <div class="sidebar-section playback-section">
      <PlaybackBar
        isPlaying={p.isPlaying}
        currentBeat={p.currentBeat}
        totalBeats={p.totalBeats}
        bpm={p.bpm}
        skipStartPosition={p.skipStartPosition}
        onPlayPause={p.onPlayPause}
        onStop={p.onStop}
        onStepHalfBack={p.onStepHalfBack}
        onStepHalfFwd={p.onStepHalfFwd}
        onStepFullBack={p.onStepFullBack}
        onStepFullFwd={p.onStepFullFwd}
        onBpmChange={p.onBpmChange}
        onToggleLoop={p.onToggleLoop}
      />
    </div>
  {/if}
</aside>
```

- [ ] **Step 2: Add styles**

```css
<style>
  .arrange-sidebar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow-y: auto;
    padding: var(--spacing-sm, 8px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: var(--border-radius-lg);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  /* Section containers */
  .sidebar-section {
    flex-shrink: 0;
  }

  .cell-editor-section {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    border: 1px solid rgba(139, 92, 246, 0.08);
    border-radius: 10px;
    background: rgba(139, 92, 246, 0.02);
  }

  /* Collapsible section header */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    min-height: 44px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .section-header:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-title i {
    font-size: 11px;
    opacity: 0.6;
  }

  .section-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-meta {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
  }

  .section-chevron {
    font-size: 8px;
    color: rgba(255, 255, 255, 0.25);
    transition: transform 150ms ease;
  }

  .section-chevron.collapsed {
    transform: rotate(-90deg);
  }

  .section-body {
    padding: 8px 0 0;
  }

  /* Empty state placeholder */
  .empty-cell-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.15);
    font-size: 12px;
    font-style: italic;
    min-height: 100px;
  }

  .empty-cell-placeholder i {
    font-size: 18px;
    opacity: 0.5;
  }

  /* Playback: pinned to bottom */
  .playback-section {
    margin-top: auto;
    flex-shrink: 0;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  @media (prefers-reduced-motion: reduce) {
    .section-header,
    .section-chevron {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No TypeScript errors. Component compiles. (It won't be wired in yet, so no visual output.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/sidebar/ArrangeSidebar.svelte
git commit -m "feat(arrange): create ArrangeSidebar with collapsible grid/cell/playback sections"
```

---

### Task 2: Strip standalone styling from CellEditorPanel

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte`

CellEditorPanel currently styles itself as a standalone drawer panel (background, border-left, height:100%, padding). Since it will now live inside ArrangeSidebar's `.cell-editor-section`, these standalone styles need to be removed. The close button is also no longer needed — deselecting happens by clicking away from the cell.

- [ ] **Step 1: Remove onClose from the interface**

In the `CellEditorProps` interface (line 46), remove:

```diff
-    onClose?: () => void;
```

- [ ] **Step 2: Remove close button from template**

Remove lines 143-152 (the `{#if p.onClose}` block with the close button):

```diff
-    {#if p.onClose}
-      <button
-        class="close-btn"
-        onclick={p.onClose}
-        title="Close"
-        aria-label="Close panel"
-      >
-        <i class="fas fa-times" aria-hidden="true"></i>
-      </button>
-    {/if}
```

- [ ] **Step 3: Update .cell-editor-panel CSS**

Replace the `.cell-editor-panel` style block (lines 240-252) to remove standalone panel styling:

```css
.cell-editor-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 3cqi, 20px);
  padding: clamp(10px, 2.5cqi, 16px);
  container-type: inline-size;
  container-name: celleditorpanel;
}
```

Removed: `height: 100%`, `overflow-y: auto` (sidebar section handles scrolling), `background` (sidebar provides it), `border-left` (sidebar provides border).

- [ ] **Step 4: Remove .close-btn CSS**

Delete the `.close-btn` and `.close-btn:hover` style rules (lines 299-317).

- [ ] **Step 5: Remove close-btn from reduced-motion media query**

In the `@media (prefers-reduced-motion)` block (around line 365), remove `.close-btn` from the selector:

```diff
  @media (prefers-reduced-motion: reduce) {
-    .close-btn,
     .footer-btn {
       transition: none;
     }
  }
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: No errors. The `onClose` prop is optional so removing it won't break existing Drawer usage until Task 3 removes that too.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte
git commit -m "refactor(cell-editor): strip standalone panel styling, remove close button"
```

---

### Task 3: Wire ArrangeSidebar into ArrangeTab

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/ArrangeTab.svelte`

This is the main integration task. Replace the control panel div + Drawer component with the new ArrangeSidebar.

- [ ] **Step 1: Update imports**

Replace old imports (lines 23, 24, 28):

```diff
- import CellEditorPanel from "./components/grid/cell-editor/CellEditorPanel.svelte";
- import PlaybackBar from "./components/shared/PlaybackBar.svelte";
- import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
+ import ArrangeSidebar from "./components/sidebar/ArrangeSidebar.svelte";
```

Keep: `GridLayoutControls` import is no longer needed directly (ArrangeSidebar imports it), so remove it too:

```diff
- import GridLayoutControls from "./components/grid/GridLayoutControls.svelte";
```

- [ ] **Step 2: Remove handleDrawerClose**

Find and delete the `handleDrawerClose` function. Search for it in the script section — it likely calls `gridState.deselectCell()`. The deselection now happens via clicking empty grid area (already works) or pressing Escape (already handled by keyboard handler).

- [ ] **Step 3: Replace the control panel and drawer in the template**

Replace the control panel div (lines 426-461) AND the Drawer block (lines 465-506) with a single ArrangeSidebar:

```svelte
      <!-- Right: Unified Sidebar -->
      <ArrangeSidebar
        gridRows={gridState.gridRows}
        gridCols={gridState.gridCols}
        hasContent={gridState.hasAnyLayers}
        onSetGridRows={handleSetGridRows}
        onSetGridCols={handleSetGridCols}
        onSetDimensions={handleSetDimensions}
        onPresetLayout={handlePresetLayout}
        selectedCell={selectedCell}
        cellIndex={selectedCell ? gridState.getCellDisplayIndex(selectedCell.id) : 0}
        clipboardHasData={gridState.clipboard !== null}
        transformingLayer={gridState.transformingLayer}
        onAddSequence={handleAddSequence}
        onRemoveLayer={handleRemoveLayer}
        onEditLayerOffset={handleEditLayerOffset}
        onClearCell={handleClearCell}
        onMediaTypeChange={handleMediaTypeChange}
        onCopyLayer={handleCopyLayer}
        onCopyCell={handleCopyCell}
        onPasteLayer={handlePasteLayer}
        onTransformLayer={handleTransformLayer}
        onSetSpeed={selectedCell ? (speed) => gridState.setCellSpeed(selectedCell.id, speed) : undefined}
        onSetEffect={selectedCell ? (effect) => gridState.setCellEffect(selectedCell.id, effect) : undefined}
        onSetTrailMode={selectedCell ? (mode) => gridState.setCellTrailMode(selectedCell.id, mode) : undefined}
        onSetEffort={selectedCell ? (effort) => gridState.setCellEffort(selectedCell.id, effort) : undefined}
        onSetBlueVisible={selectedCell ? (visible) => gridState.setCellMotionVisibility(selectedCell.id, 'blue', visible) : undefined}
        onSetRedVisible={selectedCell ? (visible) => gridState.setCellMotionVisibility(selectedCell.id, 'red', visible) : undefined}
        onSetOffset={selectedCell ? (offset) => gridState.setCellBeatOffset(selectedCell.id, offset) : undefined}
        onSetColors={selectedCell ? (colors) => gridState.setCellPropColors(selectedCell.id, colors) : undefined}
        onSetTipEffectMap={selectedCell ? (map) => gridState.setCellTipEffectMap(selectedCell.id, map) : undefined}
        onSetTipEffortMap={selectedCell ? (map) => gridState.setCellTipEffortMap(selectedCell.id, map) : undefined}
        hasAnyLayers={gridState.hasAnyLayers}
        isPlaying={gridState.isPlaying}
        currentBeat={gridState.currentBeat}
        totalBeats={gridState.totalBeats}
        bpm={gridState.bpm}
        skipStartPosition={gridState.skipStartPosition}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onStepHalfBack={handleStepHalfBack}
        onStepHalfFwd={handleStepHalfFwd}
        onStepFullBack={handleStepFullBack}
        onStepFullFwd={handleStepFullFwd}
        onBpmChange={handleBpmChange}
        onToggleLoop={handleToggleLoop}
      />
```

- [ ] **Step 4: Update grid-template-columns**

In the CSS, update `.desktop-content` (line 582):

```css
.desktop-content {
  display: grid;
  grid-template-columns: 1fr clamp(280px, 20vw, 340px);
  gap: var(--spacing-lg);
  height: 100%;
  padding: var(--spacing-lg);
}
```

- [ ] **Step 5: Update responsive breakpoints**

Replace the media queries (lines 662-676):

```css
/* Larger screens: wider sidebar */
@media (min-width: 1200px) {
  .desktop-content {
    grid-template-columns: 1fr clamp(300px, 20vw, 360px);
  }
}

/* Medium screens: slightly narrower */
@media (max-width: 1024px) and (min-width: 768px) {
  .desktop-content {
    grid-template-columns: 1fr clamp(260px, 18vw, 320px);
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }
}
```

- [ ] **Step 6: Remove old control panel and drawer CSS**

Delete these CSS blocks that are no longer needed:
- `.control-panel` (lines 638-644)
- `.panel-section` (lines 646-651)
- `.panel-section.grid-section` (lines 654-656)
- `.playback-section` (lines 658-660)
- `:global(.cell-editor-backdrop)` (lines 692-696)
- `:global(.cell-editor-drawer[data-placement="right"])` (lines 698-702)

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: No errors. No references to Drawer, CellEditorPanel, PlaybackBar, or GridLayoutControls remain in ArrangeTab (they're all inside ArrangeSidebar now).

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/ArrangeTab.svelte
git commit -m "feat(arrange): replace control panel + drawer with unified ArrangeSidebar"
```

---

### Task 4: Smoke test

- [ ] **Step 1: Open compose > arrange in the browser**

Navigate to the arrange tab. Verify:
- Sidebar is visible on the right with grid config expanded
- "Click a cell to edit" placeholder shows in the middle
- Playback controls are at the bottom (if any cells have layers)
- No drawer animation or overlay visible

- [ ] **Step 2: Click a cell**

Verify:
- Grid config auto-collapses to "Grid 4×3" one-liner
- Cell editor appears with layers, chips, footer
- No drawer slide-in animation
- Playback stays in the same position

- [ ] **Step 3: Click away from the cell (empty grid area)**

Verify:
- Cell editor disappears
- Grid config re-expands
- No drawer slide-out animation

- [ ] **Step 4: Click a cell, then click grid config header**

Verify:
- Grid config expands while cell editor stays visible
- Both sections are accessible simultaneously
- Sidebar scrolls if content overflows

- [ ] **Step 5: Test playback**

Verify play/pause/step controls work while cell is selected and while no cell is selected.

- [ ] **Step 6: Test cell editor functionality**

With a cell selected, verify:
- Layer card shows gradient background
- Chips expand their sections (effects, effort, transform, etc.)
- Copy All / Clear All buttons work
- Adding a sequence works

- [ ] **Step 7: Test responsive behavior**

Resize the browser window. Verify:
- Sidebar width adjusts via clamp()
- Grid cells auto-resize (smaller on narrower windows)
- Below 768px: mobile placeholder still shows
