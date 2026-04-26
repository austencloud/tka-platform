# Viewer Settings Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplicated controls across 3D and 2D viewers by removing right-click context menus and consolidating settings into gear popovers.

**Architecture:** Both viewers use the same pattern: gear icon opens a tabbed popover with chip-style toggles. The 3D viewer's gear popover gets a new Visibility tab and loses the Effects stub. The 2D choreo card viewer gets a brand-new gear popover with Display, Glyphs, and Layout tabs. All right-click context menus are deleted from viewer surfaces. Pictograph-level context menus in create mode are untouched (different context).

**Tech Stack:** Svelte 5 runes, AnimationVisibilityStateManager, VisibilityStateManager, ImageCompositionManager

**Spec:** `docs/superpowers/specs/2026-04-13-viewer-settings-consolidation-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/shared/3d/components/controls/Viewer3DVisibilityToggles.svelte` | Chip toggles for 5 visibility settings (props, beat#s, glyph, header, progress) |
| `src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardGearPopover.svelte` | Tabbed popover for 2D viewer (Display, Glyphs, Layout) |
| `src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardDisplayToggles.svelte` | Chip toggles for motion visibility, grid, points, step numbers |
| `src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardGlyphToggles.svelte` | Chip toggles for 5 glyph types |
| `src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardLayoutPanel.svelte` | Column count chips + Card Settings button |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/shared/3d/components/Viewer3DGearPopover.svelte` | Replace "effects" tab with "visibility" tab, wire new component |
| `src/lib/shared/3d/components/Viewer3DCanvas.svelte` | Remove context menu host import, ref, event handler, and template |
| `src/lib/shared/3d/components/panels/Animation3DSidePanel.svelte` | Remove Grid collapsible section (lines 206-236) |
| `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` | Add gear popover, remove context menu host |
| `src/routes/p/[code]/+page.svelte` | Remove ChoreoCardContextMenuHost usage |
| `src/routes/sequence/[id]/+page.svelte` | Remove ChoreoCardContextMenuHost usage |

### Deleted Files
| File | Reason |
|------|--------|
| `src/lib/shared/3d/components/context-menu/Viewer3DContextMenuBuilder.ts` | Right-click menu removed |
| `src/lib/shared/3d/components/context-menu/Viewer3DContextMenuHost.svelte` | Right-click menu removed |
| `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte` | Right-click menu removed |
| `src/lib/features/choreo-card/components/context-menu/CardDesignerContextMenuBuilder.ts` | Right-click menu removed |

### NOT Deleted (used in create mode, different context)
| File | Reason kept |
|------|------------|
| `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte` | Used by OptionCard, OptionViewerSection, StepCell in create workflow |
| `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts` | Builder for above |

---

## Task 1: Create Viewer3DVisibilityToggles Component

**Files:**
- Create: `src/lib/shared/3d/components/controls/Viewer3DVisibilityToggles.svelte`

This component renders chip-style toggles for the 5 visibility settings that were in the 3D right-click context menu's Visibility submenu. It reads/writes the `AnimationVisibilityStateManager` singleton.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/shared/3d/components/controls/Viewer3DVisibilityToggles.svelte -->
<script lang="ts">
  /**
   * Viewer3DVisibilityToggles
   *
   * Chip-style toggles for overlay visibility in the 3D viewer.
   * Controls whether props, beat numbers, TKA glyph, word header,
   * and progress bar are visible. Reads/writes the global
   * AnimationVisibilityStateManager.
   */

  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  const vm = getAnimationVisibilityManager();

  type VisibilityKey = "props" | "stepNumbers" | "tkaGlyph" | "wordHeader" | "progressBar";

  const TOGGLES: { key: VisibilityKey; label: string }[] = [
    { key: "props", label: "Props" },
    { key: "stepNumbers", label: "Beat #s" },
    { key: "tkaGlyph", label: "TKA Glyph" },
    { key: "wordHeader", label: "Word Header" },
    { key: "progressBar", label: "Progress Bar" },
  ];

  // Bridge observer pattern into reactive state
  let version = $state(0);
  $effect(() => {
    const bump = () => { version++; };
    vm.registerObserver(bump);
    return () => vm.unregisterObserver(bump);
  });

  function isEnabled(key: VisibilityKey): boolean {
    void version; // reactive dependency
    return vm.getVisibility(key);
  }

  function handleToggle(key: VisibilityKey) {
    vm.toggleVisibility(key);
  }
</script>

<div class="visibility-chips">
  {#each TOGGLES as toggle (toggle.key)}
    {@const enabled = isEnabled(toggle.key)}
    <button
      class="chip"
      class:active={enabled}
      onclick={() => handleToggle(toggle.key)}
      aria-pressed={enabled}
    >
      {toggle.label}
    </button>
  {/each}
</div>

<style>
  .visibility-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0;
  }

  .chip {
    padding: 5px 12px;
    border-radius: 100px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .chip:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }

  .chip.active {
    border-color: color-mix(in srgb, #8b8bff 40%, transparent);
    background: color-mix(in srgb, #8b8bff 15%, transparent);
    color: rgba(255, 255, 255, 0.9);
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: No errors referencing `Viewer3DVisibilityToggles`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/controls/Viewer3DVisibilityToggles.svelte
git commit -m "feat(3d): create Viewer3DVisibilityToggles chip component"
```

---

## Task 2: Wire Visibility Tab into Gear Popover + Remove Effects Stub

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DGearPopover.svelte`

Replace the disabled "effects" tab with a working "visibility" tab that renders the new `Viewer3DVisibilityToggles` component.

- [ ] **Step 1: Update TabId type and TABS array**

In `Viewer3DGearPopover.svelte`, change line 28:

```typescript
// OLD
type TabId = "camera" | "planes" | "performers" | "scene" | "effects";
// NEW
type TabId = "camera" | "planes" | "performers" | "scene" | "visibility";
```

Change lines 30-36:

```typescript
// OLD
const TABS: { id: TabId; label: string; disabled?: boolean }[] = [
  { id: "camera", label: "Camera" },
  { id: "planes", label: "Planes" },
  { id: "performers", label: "Performers" },
  { id: "scene", label: "Scene" },
  { id: "effects", label: "Effects", disabled: true },
];
// NEW
const TABS: { id: TabId; label: string; disabled?: boolean }[] = [
  { id: "camera", label: "Camera" },
  { id: "planes", label: "Planes" },
  { id: "performers", label: "Performers" },
  { id: "scene", label: "Scene" },
  { id: "visibility", label: "Visibility" },
];
```

- [ ] **Step 2: Add import for the new component**

Add after the existing `SceneFeatureToggles` import (line 26):

```typescript
import Viewer3DVisibilityToggles from "./controls/Viewer3DVisibilityToggles.svelte";
```

- [ ] **Step 3: Replace Effects stub tab panel with Visibility panel**

Replace lines 291-296:

```svelte
<!-- OLD: Effects tab (stub) -->
{#if activeTab === "effects"}
  <div class="tab-panel" id="tab-panel-effects" role="tabpanel">
    <div class="placeholder">Coming soon</div>
  </div>
{/if}
```

With:

```svelte
<!-- Visibility tab -->
{#if activeTab === "visibility"}
  <div class="tab-panel" id="tab-panel-visibility" role="tabpanel">
    <Viewer3DVisibilityToggles />
  </div>
{/if}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DGearPopover.svelte
git commit -m "feat(3d): replace Effects stub with working Visibility tab in gear popover"
```

---

## Task 3: Remove Grid Section from Sidebar

**Files:**
- Modify: `src/lib/shared/3d/components/panels/Animation3DSidePanel.svelte`

The Grid collapsible section is redundant with the Scene tab's Grid chip toggle and the Planes tab.

- [ ] **Step 1: Remove the Grid section from the template**

Delete lines 206-236 (the entire `<!-- Grid Section -->` block):

```svelte
<!-- DELETE THIS ENTIRE BLOCK -->
<!-- Grid Section -->
<section class="collapsible-section">
  <button
    class="section-header"
    onclick={() => {
      const next = new Set(expandedSections);
      next.has("grid") ? next.delete("grid") : next.add("grid");
      expandedSections = next;
    }}
    aria-expanded={expandedSections.has("grid")}
    aria-label={expandedSections.has("grid") ? "Collapse grid settings" : "Expand grid settings"}
  >
    <i class="fas fa-border-all" aria-hidden="true"></i>
    <span>{t("viewer3d_grid")}</span>
    <i
      class="fas fa-chevron-down chevron"
      class:rotated={!expandedSections.has("grid")}
      aria-hidden="true"
    ></i>
  </button>
  {#if expandedSections.has("grid")}
    <div class="section-content">
      <GridSettingsPanel
        {gridMode}
        {visiblePlanes}
        {onGridModeChange}
        {onPlaneToggle}
      />
    </div>
  {/if}
</section>
```

- [ ] **Step 2: Remove unused imports and props**

If `GridSettingsPanel` is no longer used anywhere in the file after removing the Grid section, remove:
- The `GridSettingsPanel` import
- The `gridMode`, `visiblePlanes`, `onGridModeChange`, `onPlaneToggle` props from the Props interface (only if they're not used elsewhere in the component — check first)

Check for other usages of these props before removing them. The `gridMode` and `visiblePlanes` props may still be used by other sections. If they are only used by GridSettingsPanel, remove them from the Props interface.

- [ ] **Step 3: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: No errors. If there are unused-prop errors from parent components still passing `gridMode`/`onGridModeChange`/`onPlaneToggle`, remove those prop passes from the parent too.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/panels/Animation3DSidePanel.svelte
git commit -m "refactor(3d): remove redundant Grid section from sidebar"
```

---

## Task 4: Delete 3D Right-Click Context Menu

**Files:**
- Delete: `src/lib/shared/3d/components/context-menu/Viewer3DContextMenuBuilder.ts`
- Delete: `src/lib/shared/3d/components/context-menu/Viewer3DContextMenuHost.svelte`
- Modify: `src/lib/shared/3d/components/Viewer3DCanvas.svelte`

- [ ] **Step 1: Remove context menu from Viewer3DCanvas.svelte**

In `src/lib/shared/3d/components/Viewer3DCanvas.svelte`:

Remove the import (line 23):
```typescript
// DELETE
import Viewer3DContextMenuHost from "./context-menu/Viewer3DContextMenuHost.svelte";
```

Remove the ref and handler (lines 56-61):
```typescript
// DELETE
let contextMenuHost: ReturnType<typeof Viewer3DContextMenuHost> | undefined = $state();

function handleContextMenu(e: MouseEvent) {
  e.preventDefault();
  contextMenuHost?.openContextMenu(e.clientX, e.clientY);
}
```

Remove `oncontextmenu={handleContextMenu}` from the outer div (line 66). Change:
```svelte
<!-- OLD -->
<div class="viewer-3d-canvas" oncontextmenu={handleContextMenu}>
<!-- NEW -->
<div class="viewer-3d-canvas">
```

Remove the host component instantiation (line 137):
```svelte
<!-- DELETE -->
<Viewer3DContextMenuHost bind:this={contextMenuHost} />
```

- [ ] **Step 2: Delete the context menu files**

```bash
rm src/lib/shared/3d/components/context-menu/Viewer3DContextMenuBuilder.ts
rm src/lib/shared/3d/components/context-menu/Viewer3DContextMenuHost.svelte
```

Check if the `context-menu/` directory is now empty. If so, remove it:
```bash
rmdir src/lib/shared/3d/components/context-menu/ 2>/dev/null
```

- [ ] **Step 3: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A src/lib/shared/3d/components/context-menu/
git add src/lib/shared/3d/components/Viewer3DCanvas.svelte
git commit -m "refactor(3d): delete right-click context menu from 3D viewer"
```

---

## Task 5: Create 2D Gear Popover Tab Components

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardDisplayToggles.svelte`
- Create: `src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardGlyphToggles.svelte`
- Create: `src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardLayoutPanel.svelte`

These three components are the tab contents for the new 2D gear popover. They follow the same chip pattern as `SceneFeatureToggles.svelte`.

- [ ] **Step 1: Create ChoreoCardDisplayToggles**

This component controls motion visibility, grid, hand points, non-radial points, and step numbers. It reads/writes the pictograph `VisibilityStateManager`.

```svelte
<!-- src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardDisplayToggles.svelte -->
<script lang="ts">
  /**
   * ChoreoCardDisplayToggles
   *
   * Chip-style toggles for 2D pictograph display settings:
   * motion visibility, grid, hand points, non-radial points,
   * and step/beat numbers. Reads/writes the global
   * VisibilityStateManager from the pictograph system.
   */

  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import { MotionColor } from "$lib/shared/pictograph/motion/domain/enums/MotionColor";

  const vm = getVisibilityStateManager();

  // Bridge observer into reactive state
  let version = $state(0);
  $effect(() => {
    const bump = () => { version++; };
    vm.registerObserver(bump);
    return () => vm.unregisterObserver(bump);
  });

  function getState() {
    void version;
    return {
      blueMotion: vm.getMotionVisibility(MotionColor.BLUE),
      redMotion: vm.getMotionVisibility(MotionColor.RED),
      grid: vm.getGridVisibility(),
      handPoints: vm.getHandPointVisibility(),
      nonRadial: vm.getNonRadialVisibility(),
      beatNumbers: vm.getBeatNumbersVisibility(),
    };
  }

  function toggleBlue() { const s = getState(); vm.setMotionVisibility(MotionColor.BLUE, !s.blueMotion); }
  function toggleRed() { const s = getState(); vm.setMotionVisibility(MotionColor.RED, !s.redMotion); }
  function toggleGrid() { const s = getState(); vm.setGridVisibility(!s.grid); }
  function toggleHandPoints() {
    const s = getState();
    vm.setHandPointVisibility(s.handPoints === "all" ? "active" : "all");
  }
  function toggleNonRadial() { const s = getState(); vm.setNonRadialVisibility(!s.nonRadial); }
  function toggleBeatNumbers() { const s = getState(); vm.setBeatNumbersVisibility(!s.beatNumbers); }
</script>

<div class="display-chips">
  {@const s = getState()}
  <button class="chip blue-chip" class:active={s.blueMotion} onclick={toggleBlue} aria-pressed={s.blueMotion}>
    Blue Motion
  </button>
  <button class="chip red-chip" class:active={s.redMotion} onclick={toggleRed} aria-pressed={s.redMotion}>
    Red Motion
  </button>
  <button class="chip" class:active={s.grid} onclick={toggleGrid} aria-pressed={s.grid}>
    Grid
  </button>
  <button class="chip" class:active={s.handPoints === "all"} onclick={toggleHandPoints} aria-pressed={s.handPoints === "all"}>
    Hand Points
  </button>
  <button class="chip" class:active={s.nonRadial} onclick={toggleNonRadial} aria-pressed={s.nonRadial}>
    Non-Radial
  </button>
  <button class="chip" class:active={s.beatNumbers} onclick={toggleBeatNumbers} aria-pressed={s.beatNumbers}>
    Beat #s
  </button>
</div>

<style>
  .display-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0;
  }

  .chip {
    padding: 5px 12px;
    border-radius: 100px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .chip:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }

  .chip.active {
    border-color: color-mix(in srgb, #8b8bff 40%, transparent);
    background: color-mix(in srgb, #8b8bff 15%, transparent);
    color: rgba(255, 255, 255, 0.9);
  }

  .blue-chip.active {
    border-color: color-mix(in srgb, #2563eb 40%, transparent);
    background: color-mix(in srgb, #2563eb 15%, transparent);
  }

  .red-chip.active {
    border-color: color-mix(in srgb, #dc2626 40%, transparent);
    background: color-mix(in srgb, #dc2626 15%, transparent);
  }
</style>
```

- [ ] **Step 2: Create ChoreoCardGlyphToggles**

```svelte
<!-- src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardGlyphToggles.svelte -->
<script lang="ts">
  /**
   * ChoreoCardGlyphToggles
   *
   * Chip-style toggles for glyph visibility on 2D pictographs.
   * Glyphs are disabled when not all motions are visible (same
   * rule as the old context menu).
   */

  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";

  const vm = getVisibilityStateManager();

  let version = $state(0);
  $effect(() => {
    const bump = () => { version++; };
    vm.registerObserver(bump);
    return () => vm.unregisterObserver(bump);
  });

  type GlyphKey = "tka" | "vtg" | "elemental" | "positions" | "reversals";

  const GLYPHS: { key: GlyphKey; label: string }[] = [
    { key: "tka", label: "TKA" },
    { key: "vtg", label: "VTG" },
    { key: "elemental", label: "Elemental" },
    { key: "positions", label: "Positions" },
    { key: "reversals", label: "Reversals" },
  ];

  function allMotionsVisible(): boolean {
    void version;
    return vm.areAllMotionsVisible();
  }

  function isGlyphEnabled(key: GlyphKey): boolean {
    void version;
    return vm.getRawGlyphVisibility(key);
  }

  function toggleGlyph(key: GlyphKey) {
    vm.setGlyphVisibility(key, !isGlyphEnabled(key));
  }
</script>

{@const motionsVisible = allMotionsVisible()}

<div class="glyph-chips">
  {#each GLYPHS as glyph (glyph.key)}
    {@const enabled = isGlyphEnabled(glyph.key)}
    <button
      class="chip"
      class:active={enabled}
      disabled={!motionsVisible}
      onclick={() => toggleGlyph(glyph.key)}
      aria-pressed={enabled}
      title={motionsVisible ? glyph.label : `${glyph.label} (show all motions first)`}
    >
      {glyph.label}
    </button>
  {/each}
</div>

{#if !motionsVisible}
  <p class="hint">Show both motions to toggle glyphs</p>
{/if}

<style>
  .glyph-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0;
  }

  .chip {
    padding: 5px 12px;
    border-radius: 100px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .chip:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }

  .chip:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .chip.active {
    border-color: color-mix(in srgb, #8b8bff 40%, transparent);
    background: color-mix(in srgb, #8b8bff 15%, transparent);
    color: rgba(255, 255, 255, 0.9);
  }

  .hint {
    margin: 6px 0 0;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
  }
</style>
```

- [ ] **Step 3: Create ChoreoCardLayoutPanel**

```svelte
<!-- src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardLayoutPanel.svelte -->
<script lang="ts">
  /**
   * ChoreoCardLayoutPanel
   *
   * Column count picker (chip-style) and Card Settings button
   * for the 2D choreo card viewer gear popover.
   */

  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";

  interface Props {
    stepCount: number;
    onOpenSettings: () => void;
  }

  let { stepCount, onOpenSettings }: Props = $props();

  const composition = getImageCompositionManager();

  let version = $state(0);
  $effect(() => {
    const bump = () => { version++; };
    composition.registerObserver(bump);
    return () => composition.unregisterObserver(bump);
  });

  function getCurrentCols(): number | null {
    void version;
    return composition.getColumnCountForStepCount(stepCount);
  }

  // Even column options up to min(stepCount, 8), only for 4+ steps
  const columnOptions = $derived.by(() => {
    if (stepCount < 4) return [];
    const options: (number | null)[] = [null]; // null = Auto
    for (let c = 2; c <= Math.min(stepCount, 8); c += 2) {
      options.push(c);
    }
    return options;
  });

  function selectColumns(cols: number | null) {
    composition.setColumnCountForStepCount(stepCount, cols);
  }
</script>

{#if columnOptions.length > 0}
  <div class="section-label">Columns</div>
  <div class="column-chips">
    {#each columnOptions as cols}
      {@const current = getCurrentCols()}
      {@const isActive = cols === current}
      <button
        class="chip"
        class:active={isActive}
        onclick={() => selectColumns(cols)}
        aria-pressed={isActive}
      >
        {cols === null ? "Auto" : cols}
      </button>
    {/each}
  </div>
{/if}

<div class="settings-row">
  <button class="settings-btn" onclick={onOpenSettings}>
    <i class="fas fa-sliders" aria-hidden="true"></i>
    Card Settings
  </button>
</div>

<style>
  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }

  .column-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0;
    margin-bottom: 12px;
  }

  .chip {
    padding: 5px 12px;
    border-radius: 100px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .chip:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }

  .chip.active {
    border-color: color-mix(in srgb, #8b8bff 40%, transparent);
    background: color-mix(in srgb, #8b8bff 15%, transparent);
    color: rgba(255, 255, 255, 0.9);
  }

  .settings-row {
    padding-top: 4px;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    width: 100%;
  }

  .settings-btn:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
  }
</style>
```

- [ ] **Step 4: Verify all three compile**

Run: `npx svelte-check --threshold error 2>&1 | head -30`
Expected: No errors referencing the new files

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/gear-popover/
git commit -m "feat(2d): create Display, Glyphs, Layout tab components for choreo card gear popover"
```

---

## Task 6: Create ChoreoCardGearPopover Component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardGearPopover.svelte`

The main tabbed popover for the 2D viewer. Same visual pattern as `Viewer3DGearPopover.svelte` — gear icon button that opens a floating panel with tab navigation.

- [ ] **Step 1: Create the popover component**

```svelte
<!-- src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardGearPopover.svelte -->
<script lang="ts">
  /**
   * ChoreoCardGearPopover
   *
   * Gear icon + tabbed popover for the 2D choreo card viewer.
   * Three tabs: Display (motion/grid/points), Glyphs (notation
   * overlays), Layout (column count + card settings).
   * Replaces the old right-click context menu.
   */

  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import ChoreoCardDisplayToggles from "./ChoreoCardDisplayToggles.svelte";
  import ChoreoCardGlyphToggles from "./ChoreoCardGlyphToggles.svelte";
  import ChoreoCardLayoutPanel from "./ChoreoCardLayoutPanel.svelte";

  interface Props {
    stepCount: number;
    onOpenSettings: () => void;
  }

  let { stepCount, onOpenSettings }: Props = $props();

  type TabId = "display" | "glyphs" | "layout";

  const TABS: { id: TabId; label: string }[] = [
    { id: "display", label: "Display" },
    { id: "glyphs", label: "Glyphs" },
    { id: "layout", label: "Layout" },
  ];

  let open = $state(false);
  let activeTab = $state<TabId>("display");
  let rootEl = $state<HTMLDivElement | null>(null);

  function togglePopover(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function selectTab(e: MouseEvent, id: TabId) {
    e.stopPropagation();
    activeTab = id;
  }

  // Close on outside click
  function handleWindowClick(e: MouseEvent) {
    if (open && rootEl && !rootEl.contains(e.target as Node)) {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="gear-root" bind:this={rootEl}>
  <button
    class="gear-button"
    class:open
    onclick={togglePopover}
    aria-label="Viewer settings"
    aria-expanded={open}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  </button>

  {#if open}
    <div
      class="popover"
      role="dialog"
      aria-label="Viewer settings"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
      in:scale={{ duration: 250, start: 0.9, opacity: 0, easing: backOut }}
      out:scale={{ duration: 180, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <!-- Tab bar -->
      <div class="tab-bar" role="tablist">
        {#each TABS as tab}
          <button
            class="tab-btn"
            class:active={activeTab === tab.id}
            onclick={(e) => selectTab(e, tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- Display tab -->
      {#if activeTab === "display"}
        <div class="tab-panel" role="tabpanel">
          <ChoreoCardDisplayToggles />
        </div>
      {/if}

      <!-- Glyphs tab -->
      {#if activeTab === "glyphs"}
        <div class="tab-panel" role="tabpanel">
          <ChoreoCardGlyphToggles />
        </div>
      {/if}

      <!-- Layout tab -->
      {#if activeTab === "layout"}
        <div class="tab-panel" role="tabpanel">
          <ChoreoCardLayoutPanel {stepCount} {onOpenSettings} />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .gear-root {
    position: relative;
  }

  .gear-button {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
  }

  .gear-button:hover,
  .gear-button.open {
    background: rgba(0, 0, 0, 0.6);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  .popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 240px;
    max-width: 320px;
    background: rgba(18, 18, 28, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    backdrop-filter: blur(16px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 50;
    overflow: hidden;
  }

  .tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    flex: 0 0 auto;
    padding: 8px 14px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s ease;
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: rgba(255, 255, 255, 0.7);
  }

  .tab-btn.active {
    color: rgba(255, 255, 255, 0.95);
    box-shadow: inset 0 -2px 0 #8b8bff;
  }

  .tab-panel {
    padding: 12px;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/gear-popover/ChoreoCardGearPopover.svelte
git commit -m "feat(2d): create ChoreoCardGearPopover with Display/Glyphs/Layout tabs"
```

---

## Task 7: Wire 2D Gear Popover + Remove Choreo Card Context Menu

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`
- Modify: `src/routes/p/[code]/+page.svelte`
- Modify: `src/routes/sequence/[id]/+page.svelte`

Wire the new gear popover into the sequence viewer header. Remove all ChoreoCardContextMenuHost usage.

- [ ] **Step 1: Update SequenceViewerDrawerHost.svelte**

Add the gear popover import near the other imports:
```typescript
import ChoreoCardGearPopover from "./gear-popover/ChoreoCardGearPopover.svelte";
```

Remove the ChoreoCardContextMenuHost import (line 44):
```typescript
// DELETE
import ChoreoCardContextMenuHost from "./choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
```

Remove the context menu host state variable:
```typescript
// DELETE
let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();
```

In the `.drawer-header-actions` div (around lines 322-352), add the gear popover alongside existing buttons. Find the area where the 3D button and admin buttons are and add:

```svelte
<ChoreoCardGearPopover
  stepCount={overlay.sequence?.steps?.length ?? 0}
  onOpenSettings={() => { cardSettingsOpen = true; }}
/>
```

Remove the `onChoreoCardContextMenu` prop being passed to the ChoreoCard component (line 403):
```svelte
// DELETE this prop
onChoreoCardContextMenu={(x, y) => choreoCardMenuHost?.openContextMenu(x, y)}
```

Remove the ChoreoCardContextMenuHost instantiation (lines 414-422):
```svelte
<!-- DELETE THIS ENTIRE BLOCK -->
<ChoreoCardContextMenuHost
  bind:this={choreoCardMenuHost}
  onOpenSettings={() => { cardSettingsOpen = true; }}
  onRerender={() => { rerenderTrigger++; }}
  isExportMode={isImageExportActive}
  exportOptions={ctx.exportOptions}
  onSendTo={overlay.sequence ? handleSendTo : undefined}
  stepCount={overlay.sequence?.steps?.length ?? 0}
/>
```

- [ ] **Step 2: Update route pages**

In `src/routes/p/[code]/+page.svelte` and `src/routes/sequence/[id]/+page.svelte`:

Remove the ChoreoCardContextMenuHost import, state variable, event wiring, and template instantiation. These follow the same pattern as SequenceViewerDrawerHost — find and remove:
- The import line
- The `let choreoCardMenuHost` state variable
- The `onChoreoCardContextMenu` prop on ChoreoCard
- The `<ChoreoCardContextMenuHost .../>` template block

If these route pages need the gear popover too, add it. But first check whether these routes render their own ChoreoCard or delegate to SequenceViewerDrawerHost. If they use SequenceViewerDrawerHost (which already has the gear popover), no changes needed beyond removing context menu references.

- [ ] **Step 3: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -30`
Expected: No errors. Watch for "unknown prop" warnings if ChoreoCard still expects `onChoreoCardContextMenu` — if so, remove it from ChoreoCard's Props interface too.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git add src/routes/p/\[code\]/+page.svelte
git add src/routes/sequence/\[id\]/+page.svelte
git commit -m "feat(2d): wire gear popover into sequence viewer, remove context menu usage"
```

---

## Task 8: Delete Choreo Card Context Menu Files

**Files:**
- Delete: `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte`
- Delete: `src/lib/features/choreo-card/components/context-menu/CardDesignerContextMenuBuilder.ts`

- [ ] **Step 1: Verify no remaining imports**

Run:
```bash
grep -r "ChoreoCardContextMenuHost" src/ --include="*.svelte" --include="*.ts" -l
grep -r "CardDesignerContextMenuBuilder\|buildChoreoCardContextMenuItems\|buildCardDesignerContextMenuItems" src/ --include="*.svelte" --include="*.ts" -l
```

Expected: No files listed (all references already removed in Task 7). If any remain, remove them first.

- [ ] **Step 2: Delete the files**

```bash
rm src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte
rm src/lib/features/choreo-card/components/context-menu/CardDesignerContextMenuBuilder.ts
```

Remove empty directories if applicable:
```bash
rmdir src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ 2>/dev/null
rmdir src/lib/features/choreo-card/components/context-menu/ 2>/dev/null
```

- [ ] **Step 3: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A src/lib/shared/sequence-viewer/components/choreo-card-context-menu/
git add -A src/lib/features/choreo-card/components/context-menu/
git commit -m "refactor(2d): delete choreo card context menu files"
```

---

## Task 9: Clean Up ChoreoCard Context Menu Prop

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

The ChoreoCard component likely still has an `onContextMenu` or `onChoreoCardContextMenu` prop and the `contextmenu` event handler that opened the context menu. Remove them.

- [ ] **Step 1: Remove the context menu prop and handler from ChoreoCard**

In `ChoreoCard.svelte`, find and remove:
- The `onContextMenu` or `onChoreoCardContextMenu` prop from the Props interface
- The `handleContextMenu` function (if it exists internally)
- The `oncontextmenu` event binding on the card's root element (around line 1738)

For the `oncontextmenu` handler on the root element, remove the entire binding. If there's a long-press handler that also triggers the context menu, remove that too:

```svelte
<!-- REMOVE the oncontextmenu binding entirely -->
<!-- The element should just not have oncontextmenu at all -->
```

- [ ] **Step 2: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "refactor(2d): remove context menu prop and handler from ChoreoCard"
```
