# Unified Visibility Context Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all three visual components (pictograph, animation canvas, choreo card) under a consistent right-click → "[Thing] Settings..." → modal/drawer with live preview pattern.

**Architecture:** Three separate settings modals share a responsive `SettingsModalLayout` shell (drawer on mobile, modal on desktop). Each component's context menu is simplified to a single "Settings..." entry that opens the corresponding modal. The pictograph gets a brand new context menu + settings modal. The animation canvas and choreo card have their context menus simplified and their modals created/refactored.

**Tech Stack:** Svelte 5 (runes), TypeScript, BaseModal + Drawer for responsive layout, VisibilityStateManager + ImageCompositionStateManager + AnimationVisibilityStateManager for state.

**Spec:** `docs/superpowers/specs/2026-03-20-unified-visibility-context-menus-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| **CREATE** `src/lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte` | Responsive shell: Drawer on mobile, BaseModal on desktop. Preview + controls layout. |
| **CREATE** `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts` | Builder: returns single "Pictograph Settings..." menu entry |
| **CREATE** `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte` | Host: manages menu state, exports `openContextMenu(x, y)` |
| **CREATE** `src/lib/shared/pictograph/shared/components/PictographSettingsModal.svelte` | Pictograph settings modal with live preview + visibility toggles |
| **CREATE** `src/lib/features/choreo-card/components/CardSettingsModal.svelte` | Card settings modal with live preview + visibility/composition toggles |
| **SIMPLIFY** `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts` | Remove inline toggles, single "Animation Settings..." entry |
| **SIMPLIFY** `src/lib/features/choreo-card/components/context-menu/CardDesignerContextMenuBuilder.ts` | Remove Display submenu, single "Card Settings..." entry |
| **MODIFY** `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuHost.svelte` | Pass `onOpenSettings` callback |
| **MODIFY** `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte` | Add `onOpenSettings` callback, simplify menu items |
| **MODIFY** `src/lib/features/choreo-card/components/context-menu/CardDesignerContextMenuHost.svelte` | Add `onOpenSettings` callback, simplify menu items |
| **MODIFY** `src/lib/features/create/shared/workspace-panel/sequence-display/components/StepCell.svelte` | Add right-click handler, integrate PictographContextMenuHost |
| **RENAME** `src/lib/shared/animation-engine/components/canvas-settings-modal/CanvasSettingsModal.svelte` → `AnimationSettingsModal.svelte` | Rename title "Canvas Settings" → "Animation Settings" |
| **RENAME** `canvas-settings-modal/` → `animation-settings-modal/` | Directory rename |
| **MODIFY** `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` | Update imports for renamed modal |
| **MODIFY** `messages/en.json` | Add i18n keys for new UI strings |
| **DELETE** `src/lib/shared/settings/components/tabs/visibility/example-data.ts` | Stale orphan cleanup |

---

### Task 1: Add i18n Keys

**Files:**
- Modify: `messages/en.json`

- [ ] **Step 1: Add i18n keys for all new UI strings**

Add these keys to `messages/en.json`:

```json
"settings_pictograph_title": "Pictograph Settings",
"settings_animation_title": "Animation Settings",
"settings_card_title": "Card Settings",
"settings_toggle_grid": "Grid",
"settings_toggle_hand_points": "Hand Points",
"settings_toggle_non_radial": "Non-Radial Points",
"settings_toggle_tka_glyphs": "TKA Glyphs",
"settings_toggle_vtg_glyphs": "VTG Glyphs",
"settings_toggle_elemental_glyphs": "Elemental Glyphs",
"settings_toggle_position_glyphs": "Position Glyphs",
"settings_toggle_reversal_indicators": "Reversal Indicators",
"settings_toggle_step_numbers": "Step Numbers",
"settings_toggle_blue_motion": "Blue Motion",
"settings_toggle_red_motion": "Red Motion",
"settings_toggle_word": "Word",
"settings_toggle_start_position": "Start Position",
"settings_toggle_difficulty": "Difficulty",
"settings_toggle_creator_name": "Creator Name",
"settings_toggle_notes": "Notes",
"settings_toggle_birthday": "Birthday",
"settings_toggle_qr_code": "QR Code",
"settings_dependent_glyphs_disabled": "Requires both motions visible"
```

- [ ] **Step 2: Run typegen for i18n**

Run: `npm run typegen` (or whatever generates i18n types from `messages/en.json`)
Expected: Types regenerated without errors.

- [ ] **Step 3: Commit**

```bash
git add messages/en.json src/lib/shared/i18n/i18n-types.ts
git commit -m "feat: add i18n keys for unified visibility settings modals"
```

---

### Task 2: Create SettingsModalLayout

**Files:**
- Create: `src/lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte`

**Reference files:**
- `src/lib/shared/foundation/ui/modal/BaseModal.svelte` — desktop modal shell (size `"lg"`)
- `src/lib/shared/foundation/ui/Drawer.svelte` — mobile drawer shell (placement `"bottom"`)

- [ ] **Step 1: Create the responsive layout component**

Create `src/lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte`:

```svelte
<!--
  SettingsModalLayout.svelte - Responsive settings shell

  Desktop (>=768px): BaseModal with side-by-side preview + controls layout
  Mobile (<768px): Full-height bottom Drawer with stacked preview + controls

  Used by: PictographSettingsModal, CardSettingsModal
  NOT used by: AnimationSettingsModal (has its own complex layout)
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount, onDestroy } from "svelte";
  import BaseModal from "../modal/BaseModal.svelte";
  import Drawer from "../Drawer.svelte";

  interface Props {
    title: string;
    icon: string;
    open: boolean;
    onclose?: () => void;
    preview: Snippet;
    controls: Snippet;
  }

  let { title, icon, open = $bindable(), onclose, preview, controls }: Props = $props();

  let isMobile = $state(false);
  let mediaQuery: MediaQueryList | null = null;

  function handleMediaChange(e: MediaQueryListEvent | MediaQueryList) {
    isMobile = !e.matches;
  }

  onMount(() => {
    mediaQuery = window.matchMedia("(min-width: 768px)");
    handleMediaChange(mediaQuery);
    mediaQuery.addEventListener("change", handleMediaChange);
  });

  onDestroy(() => {
    mediaQuery?.removeEventListener("change", handleMediaChange);
  });

  function handleClose() {
    open = false;
    onclose?.();
  }
</script>

{#if isMobile}
  <Drawer
    isOpen={open}
    placement="bottom"
    showHandle={true}
    onclose={handleClose}
    ariaLabel={title}
    class="settings-modal-drawer"
  >
    <div class="settings-layout-mobile">
      <div class="settings-header">
        <i class="fas {icon}" aria-hidden="true"></i>
        <h2>{title}</h2>
      </div>
      <div class="settings-preview-mobile">
        {@render preview()}
      </div>
      <div class="settings-controls-mobile themed-scrollbar">
        {@render controls()}
      </div>
    </div>
  </Drawer>
{:else}
  <BaseModal {open} onclose={handleClose} size="lg" animation="pop">
    {#snippet header()}
      <div class="settings-header">
        <i class="fas {icon}" aria-hidden="true"></i>
        <h2>{title}</h2>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="settings-layout-desktop">
        <div class="settings-preview-desktop">
          {@render preview()}
        </div>
        <div class="settings-controls-desktop themed-scrollbar">
          {@render controls()}
        </div>
      </div>
    {/snippet}
  </BaseModal>
{/if}

<style>
  .settings-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
  }

  .settings-header h2 {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    margin: 0;
    color: var(--theme-text, #ffffff);
  }

  .settings-header i {
    color: var(--theme-accent, #3b82f6);
    font-size: var(--font-size-lg, 18px);
  }

  /* Desktop: side-by-side */
  .settings-layout-desktop {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    padding: 1rem;
    min-height: 400px;
  }

  .settings-preview-desktop {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-lg, 12px);
    padding: 1rem;
  }

  .settings-controls-desktop {
    overflow-y: auto;
    max-height: 60vh;
    padding-right: 0.5rem;
  }

  /* Mobile: stacked */
  .settings-layout-mobile {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .settings-preview-mobile {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    flex: 0 0 40%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .settings-controls-mobile {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  /* Drawer overrides */
  :global(.settings-modal-drawer) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
    height: 85vh;
  }
</style>
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: No errors. The component is created but not yet imported anywhere.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte
git commit -m "feat: create SettingsModalLayout responsive shell component"
```

---

### Task 3: Create Pictograph Context Menu (Builder + Host)

**Files:**
- Create: `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts`
- Create: `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte`

**Reference files:**
- `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts` — pattern to follow
- `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuHost.svelte` — pattern to follow
- `src/lib/shared/components/context-menu/context-menu-types.ts` — type definitions

- [ ] **Step 1: Create PictographContextMenuBuilder.ts**

Create `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts`:

```typescript
/**
 * Pictograph Context Menu Builder
 *
 * Minimal menu: single "Pictograph Settings..." entry that opens
 * the PictographSettingsModal with live preview.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";

interface PictographContextMenuDeps {
  onOpenSettings: () => void;
}

export function buildPictographContextMenuItems(
  deps: PictographContextMenuDeps
): ContextMenuEntry[] {
  return [
    {
      id: "open-pictograph-settings",
      label: "Pictograph Settings\u2026",
      icon: "fa-sliders",
      action: () => deps.onOpenSettings(),
    },
  ];
}
```

- [ ] **Step 2: Create PictographContextMenuHost.svelte**

Create `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte`:

```svelte
<!--
  PictographContextMenuHost — Orchestrator for the pictograph right-click context menu.
  Single entry: "Pictograph Settings..." → opens PictographSettingsModal.
-->
<script lang="ts">
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildPictographContextMenuItems } from "./PictographContextMenuBuilder";

  interface Props {
    onOpenSettings: () => void;
  }

  const { onOpenSettings }: Props = $props();

  let menuState: ContextMenuState = $state({ open: false });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    return buildPictographContextMenuItems({
      onOpenSettings: () => {
        closeContextMenu();
        onOpenSettings();
      },
    });
  });

  /**
   * Open the context menu at the given coordinates.
   * Called from StepCell via bind:this.
   */
  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte
git commit -m "feat: create pictograph context menu builder and host"
```

---

### Task 4: Create PictographSettingsModal

**Files:**
- Create: `src/lib/shared/pictograph/shared/components/PictographSettingsModal.svelte`

**Reference files:**
- `src/lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte` — layout shell (Task 2)
- `src/lib/shared/pictograph/shared/state/visibility-state.svelte.ts` — all visibility API methods
- `src/lib/shared/pictograph/shared/components/PictographContainer.svelte` — for preview rendering

- [ ] **Step 1: Create PictographSettingsModal.svelte**

Create `src/lib/shared/pictograph/shared/components/PictographSettingsModal.svelte`:

```svelte
<!--
  PictographSettingsModal — Full visibility settings with live preview.

  Shows the specific pictograph beat the user right-clicked on.
  All toggles modify global VisibilityStateManager settings.
  Preview updates in real-time via observer registration.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import SettingsModalLayout from "$lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte";
  import PictographContainer from "./PictographContainer.svelte";
  import { getVisibilityStateManager } from "../state/visibility-state.svelte";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
  import { MotionColor } from "../domain/enums/pictograph-enums";

  interface Props {
    open: boolean;
    stepData: StepData | StartPositionData | null;
  }

  let { open = $bindable(), stepData }: Props = $props();

  const visibility = getVisibilityStateManager();

  // Observer-based reactivity
  let version = $state(0);
  function onChanged(): void {
    version++;
  }
  visibility.registerObserver(onChanged, ["all"]);
  onDestroy(() => visibility.unregisterObserver(onChanged));

  // Derive toggle states reactively
  const toggles = $derived.by(() => {
    void version;
    return {
      showGrid: visibility.getGridVisibility(),
      handPoints: visibility.getHandPointVisibility(),
      nonRadial: visibility.getNonRadialVisibility(),
      tkaGlyph: visibility.getRawGlyphVisibility("tkaGlyph"),
      vtgGlyph: visibility.getRawGlyphVisibility("vtgGlyph"),
      elementalGlyph: visibility.getRawGlyphVisibility("elementalGlyph"),
      positionsGlyph: visibility.getRawGlyphVisibility("positionsGlyph"),
      reversalIndicators: visibility.getGlyphVisibility("reversalIndicators"),
      stepNumbers: visibility.getBeatNumbersVisibility(),
      blueMotion: visibility.getMotionVisibility(MotionColor.BLUE),
      redMotion: visibility.getMotionVisibility(MotionColor.RED),
      dependentAvailable: visibility.areAllMotionsVisible(),
    };
  });

  // Toggle handlers
  function toggleGrid() { visibility.setGridVisibility(!toggles.showGrid); }
  function toggleHandPoints() {
    visibility.setHandPointVisibility(toggles.handPoints === "all" ? "active" : "all");
  }
  function toggleNonRadial() { visibility.setNonRadialVisibility(!toggles.nonRadial); }
  function toggleGlyph(type: string) {
    visibility.setGlyphVisibility(type, !visibility.getRawGlyphVisibility(type));
  }
  function toggleMotion(color: MotionColor) {
    visibility.setMotionVisibility(color, !visibility.getMotionVisibility(color));
  }
  function toggleStepNumbers() { visibility.setBeatNumbersVisibility(!toggles.stepNumbers); }
  function toggleReversalIndicators() {
    visibility.setGlyphVisibility("reversalIndicators", !toggles.reversalIndicators);
  }
</script>

<SettingsModalLayout
  title="Pictograph Settings"
  icon="fa-sliders"
  bind:open
>
  {#snippet preview()}
    {#if stepData}
      <div class="preview-container">
        <PictographContainer pictographData={stepData} />
      </div>
    {/if}
  {/snippet}

  {#snippet controls()}
    <div class="toggle-sections">
      <!-- Motion Visibility -->
      <section class="toggle-section">
        <h3 class="section-title">Motions</h3>
        <label class="toggle-row">
          <input type="checkbox" checked={toggles.blueMotion} onchange={() => toggleMotion(MotionColor.BLUE)} />
          <i class="fas fa-circle" style="color: var(--prop-blue)" aria-hidden="true"></i>
          <span>Blue Motion</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={toggles.redMotion} onchange={() => toggleMotion(MotionColor.RED)} />
          <i class="fas fa-circle" style="color: var(--prop-red)" aria-hidden="true"></i>
          <span>Red Motion</span>
        </label>
      </section>

      <!-- Grid & Points -->
      <section class="toggle-section">
        <h3 class="section-title">Grid & Points</h3>
        <label class="toggle-row">
          <input type="checkbox" checked={toggles.showGrid} onchange={toggleGrid} />
          <i class="fas fa-border-all" aria-hidden="true"></i>
          <span>Grid</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={toggles.handPoints === "all"} onchange={toggleHandPoints} />
          <i class="fas fa-hand-dots" aria-hidden="true"></i>
          <span>Hand Points</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={toggles.nonRadial} onchange={toggleNonRadial} />
          <i class="fas fa-circle-dot" aria-hidden="true"></i>
          <span>Non-Radial Points</span>
        </label>
      </section>

      <!-- Glyphs -->
      <section class="toggle-section">
        <h3 class="section-title">Glyphs</h3>
        {#if !toggles.dependentAvailable}
          <p class="glyph-hint">Some glyphs require both motions visible</p>
        {/if}
        <label class="toggle-row" class:disabled={!toggles.dependentAvailable}>
          <input type="checkbox" checked={toggles.tkaGlyph} onchange={() => toggleGlyph("tkaGlyph")} disabled={!toggles.dependentAvailable} />
          <i class="fas fa-language" aria-hidden="true"></i>
          <span>TKA Glyphs</span>
        </label>
        <label class="toggle-row" class:disabled={!toggles.dependentAvailable}>
          <input type="checkbox" checked={toggles.vtgGlyph} onchange={() => toggleGlyph("vtgGlyph")} disabled={!toggles.dependentAvailable} />
          <i class="fas fa-v" aria-hidden="true"></i>
          <span>VTG Glyphs</span>
        </label>
        <label class="toggle-row" class:disabled={!toggles.dependentAvailable}>
          <input type="checkbox" checked={toggles.elementalGlyph} onchange={() => toggleGlyph("elementalGlyph")} disabled={!toggles.dependentAvailable} />
          <i class="fas fa-fire" aria-hidden="true"></i>
          <span>Elemental Glyphs</span>
        </label>
        <label class="toggle-row" class:disabled={!toggles.dependentAvailable}>
          <input type="checkbox" checked={toggles.positionsGlyph} onchange={() => toggleGlyph("positionsGlyph")} disabled={!toggles.dependentAvailable} />
          <i class="fas fa-map-pin" aria-hidden="true"></i>
          <span>Position Glyphs</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={toggles.reversalIndicators} onchange={toggleReversalIndicators} />
          <i class="fas fa-rotate" aria-hidden="true"></i>
          <span>Reversal Indicators</span>
        </label>
      </section>

      <!-- Display -->
      <section class="toggle-section">
        <h3 class="section-title">Display</h3>
        <label class="toggle-row">
          <input type="checkbox" checked={toggles.stepNumbers} onchange={toggleStepNumbers} />
          <i class="fas fa-list-ol" aria-hidden="true"></i>
          <span>Step Numbers</span>
        </label>
      </section>
    </div>
  {/snippet}
</SettingsModalLayout>

<style>
  .preview-container {
    width: 100%;
    max-width: 300px;
    aspect-ratio: 1;
  }

  .toggle-sections {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .toggle-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0;
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
  }

  .toggle-row.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toggle-row i {
    width: 1.25rem;
    text-align: center;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
  }

  .toggle-row input[type="checkbox"] {
    accent-color: var(--theme-accent, #3b82f6);
    width: 1rem;
    height: 1rem;
  }

  .glyph-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-warning, #f59e0b);
    margin: 0;
    font-style: italic;
  }
</style>
```

**Note:** Step number methods on VisibilityStateManager are named `getBeatNumbersVisibility()` and `setBeatNumbersVisibility()` (lines 544-556 of visibility-state.svelte.ts).

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: No errors. Fix any missing methods on VisibilityStateManager if needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/pictograph/shared/components/PictographSettingsModal.svelte
git commit -m "feat: create PictographSettingsModal with live preview and visibility toggles"
```

---

### Task 5: Wire Pictograph Context Menu into StepCell

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/StepCell.svelte`

**Reference files:**
- `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte` (Task 3)
- `src/lib/shared/pictograph/shared/components/PictographSettingsModal.svelte` (Task 4)

- [ ] **Step 1: Add imports to StepCell.svelte**

Add these imports at the top of the `<script>` block:

```typescript
import PictographContextMenuHost from "$lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte";
import PictographSettingsModal from "$lib/shared/pictograph/shared/components/PictographSettingsModal.svelte";
```

- [ ] **Step 2: Add state for context menu and settings modal**

After the existing state declarations (around line 100), add:

```typescript
// Context menu and settings modal state
let contextMenuHost: PictographContextMenuHost;
let settingsOpen = $state(false);
```

- [ ] **Step 3: Update handleContextMenu to open the context menu**

Replace the existing `handleContextMenu` function (around line 267-272):

```typescript
function handleContextMenu(event: MouseEvent) {
  event.preventDefault();
  contextMenuHost?.openContextMenu(event.clientX, event.clientY);
}
```

- [ ] **Step 4: Add the context menu host and settings modal to the template**

After the closing `</div>` of the step-cell (before `<style>`), add:

```svelte
<PictographContextMenuHost
  bind:this={contextMenuHost}
  onOpenSettings={() => { settingsOpen = true; }}
/>

<PictographSettingsModal
  bind:open={settingsOpen}
  stepData={step}
/>
```

- [ ] **Step 5: Verify build compiles**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 6: Manual verification**

Open the app at `localhost:5173`. Navigate to a sequence with beats in the step grid. Right-click a pictograph. Verify:
1. Context menu appears with "Pictograph Settings..." entry
2. Clicking it opens the settings modal/drawer
3. The preview shows the correct beat
4. Toggling settings updates the preview in real-time
5. Changes persist (close modal, right-click again — toggles reflect previous state)

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/StepCell.svelte
git commit -m "feat: wire pictograph context menu into StepCell with settings modal"
```

---

### Task 6: Simplify Animation Canvas Context Menu + Rename Modal

**Files:**
- Modify: `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts`
- Modify: `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuHost.svelte`
- Rename: `src/lib/shared/animation-engine/components/canvas-settings-modal/` → `animation-settings-modal/`
- Modify: `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte`

- [ ] **Step 1: Rename directory and file**

```bash
cd src/lib/shared/animation-engine/components
git mv canvas-settings-modal animation-settings-modal
git mv animation-settings-modal/CanvasSettingsModal.svelte animation-settings-modal/AnimationSettingsModal.svelte
```

- [ ] **Step 2: Update the title in AnimationSettingsModal.svelte**

In `animation-settings-modal/AnimationSettingsModal.svelte`, find line 166:

```html
<h2>
  <i class="fas fa-sliders" aria-hidden="true"></i>
  Canvas Settings
</h2>
```

Replace "Canvas Settings" with "Animation Settings".

- [ ] **Step 3: Update imports in AnimatorCanvas.svelte**

In `AnimatorCanvas.svelte` (around line 44), change:

```typescript
// OLD
import CanvasSettingsModal from "./canvas-settings-modal/CanvasSettingsModal.svelte";
// NEW
import AnimationSettingsModal from "./animation-settings-modal/AnimationSettingsModal.svelte";
```

Also update the template usage (around line 524):
```svelte
<!-- OLD -->
<CanvasSettingsModal ... />
<!-- NEW -->
<AnimationSettingsModal ... />
```

- [ ] **Step 4: Update imports in EffectPicker.svelte**

Check `animation-settings-modal/EffectPicker.svelte` for any self-referencing imports that used the old path. Update if needed.

- [ ] **Step 5: Simplify CanvasContextMenuBuilder.ts**

Replace the entire contents of `CanvasContextMenuBuilder.ts` with:

```typescript
/**
 * Canvas Context Menu Builder
 *
 * Simplified: single "Animation Settings..." entry that opens the full modal.
 * Plus optional Disassemble toggle.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";

interface CanvasContextMenuDeps {
  onOpenSettings: () => void;
  disassembled?: boolean;
  onToggleDisassemble?: () => void;
}

export function buildCanvasContextMenuItems(
  deps: CanvasContextMenuDeps
): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = [
    {
      id: "open-animation-settings",
      label: "Animation Settings\u2026",
      icon: "fa-sliders",
      action: () => deps.onOpenSettings(),
    },
  ];

  if (deps.onToggleDisassemble) {
    items.push(
      { type: "separator" as const },
      {
        id: "toggle-disassemble",
        label: deps.disassembled ? "Reassemble" : "Disassemble",
        icon: deps.disassembled ? "fa-compress" : "fa-table-columns",
        checked: deps.disassembled,
        action: () => deps.onToggleDisassemble!(),
      },
    );
  }

  return items;
}
```

- [ ] **Step 6: Update CanvasContextMenuHost.svelte**

The host no longer needs the `AnimationVisibilityStateManager` observer (no inline toggles to re-derive). Simplify:

```svelte
<!--
  CanvasContextMenuHost — Orchestrator for the canvas right-click context menu.
  Single entry: "Animation Settings..." plus optional Disassemble toggle.
-->
<script lang="ts">
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildCanvasContextMenuItems } from "./CanvasContextMenuBuilder";

  interface Props {
    onOpenSettings: () => void;
    disassembled?: boolean;
    onToggleDisassemble?: () => void;
  }

  const { onOpenSettings, disassembled = false, onToggleDisassemble }: Props = $props();

  let menuState: ContextMenuState = $state({ open: false });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    return buildCanvasContextMenuItems({
      onOpenSettings: () => {
        closeContextMenu();
        onOpenSettings();
      },
      disassembled,
      onToggleDisassemble,
    });
  });

  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
```

- [ ] **Step 7: Update AnimatorCanvas.svelte to pass onOpenSettings instead of onOpenPanel**

In `AnimatorCanvas.svelte`, find where `CanvasContextMenuHost` is rendered and update props. The old `onOpenPanel` callback opened the settings modal with a specific category. Replace with `onOpenSettings` that opens the modal directly. Search for the existing `openSettingsPanel` or similar function and update accordingly.

- [ ] **Step 8: Remove old SettingsPanelCategory export**

The `SettingsPanelCategory` type was exported from the old builder. Check if any other files import it. If AnimatorCanvas was the only consumer, it's now handled internally.

- [ ] **Step 9: Verify build compiles**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add -A src/lib/shared/animation-engine/components/
git commit -m "feat: rename Canvas Settings to Animation Settings, simplify context menu"
```

---

### Task 7: Create CardSettingsModal + Simplify Choreo Card Context Menu

**Files:**
- Create: `src/lib/features/choreo-card/components/CardSettingsModal.svelte`
- Modify: `src/lib/features/choreo-card/components/context-menu/CardDesignerContextMenuBuilder.ts`
- Modify: `src/lib/features/choreo-card/components/context-menu/CardDesignerContextMenuHost.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte`

**Reference files:**
- `src/lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte` (Task 2)
- `src/lib/shared/share/state/image-composition-state.svelte.ts` — card composition API
- `src/lib/shared/pictograph/shared/state/visibility-state.svelte.ts` — pictograph visibility API

- [ ] **Step 1: Create CardSettingsModal.svelte**

Create `src/lib/features/choreo-card/components/CardSettingsModal.svelte`:

```svelte
<!--
  CardSettingsModal — Card composition + pictograph visibility settings with live preview.

  Reads from ImageCompositionStateManager (card layout toggles) and
  VisibilityStateManager (pictograph element toggles).
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import SettingsModalLayout from "$lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";

  interface Props {
    open: boolean;
  }

  let { open = $bindable() }: Props = $props();

  const imageComp = getImageCompositionManager();
  const visibility = getVisibilityStateManager();

  // Observer reactivity
  let compVersion = $state(0);
  let visVersion = $state(0);

  function onCompChanged(): void { compVersion++; }
  function onVisChanged(): void { visVersion++; }

  imageComp.registerObserver(onCompChanged);
  visibility.registerObserver(onVisChanged, ["all"]);

  onDestroy(() => {
    imageComp.unregisterObserver(onCompChanged);
    visibility.unregisterObserver(onVisChanged);
  });

  // Derive states
  const compToggles = $derived.by(() => {
    void compVersion;
    return {
      word: imageComp.addWord,
      startPosition: imageComp.includeStartPosition,
      difficulty: imageComp.addDifficultyLevel,
      stepNumbers: imageComp.addStepNumbers,
      creatorName: imageComp.showCreatorName,
      notes: imageComp.showNotes,
      birthday: imageComp.showBirthday,
      qrCode: imageComp.showQRCode,
    };
  });

  const visToggles = $derived.by(() => {
    void visVersion;
    return {
      handPoints: visibility.getHandPointVisibility() === "all",
      grid: visibility.getGridVisibility(),
      tka: visibility.getGlyphVisibility("tkaGlyph"),
    };
  });
</script>

<SettingsModalLayout
  title="Card Settings"
  icon="fa-id-card"
  bind:open
>
  {#snippet preview()}
    <div class="card-preview-placeholder">
      <!-- Card preview will render here. During implementation, integrate with
           the existing choreo card rendering pipeline (ChoreoCard.svelte or
           PropAwareThumbnail). The exact integration depends on what data
           the parent passes — either a rendered thumbnail or sequence data. -->
      <p style="color: var(--theme-text-secondary); font-style: italic;">Card Preview</p>
    </div>
  {/snippet}

  {#snippet controls()}
    <div class="toggle-sections">
      <!-- Pictograph Visibility -->
      <section class="toggle-section">
        <h3 class="section-title">Pictograph Visibility</h3>
        <label class="toggle-row">
          <input type="checkbox" checked={visToggles.handPoints} onchange={() => visibility.setHandPointVisibility(visToggles.handPoints ? "active" : "all")} />
          <i class="fas fa-hand-dots" aria-hidden="true"></i>
          <span>Hand Points</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={visToggles.grid} onchange={() => visibility.setGridVisibility(!visToggles.grid)} />
          <i class="fas fa-border-all" aria-hidden="true"></i>
          <span>Grid</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={visToggles.tka} onchange={() => visibility.setGlyphVisibility("tkaGlyph", !visibility.getRawGlyphVisibility("tkaGlyph"))} />
          <i class="fas fa-language" aria-hidden="true"></i>
          <span>TKA Glyphs</span>
        </label>
      </section>

      <!-- Card Composition -->
      <section class="toggle-section">
        <h3 class="section-title">Card Composition</h3>
        <label class="toggle-row">
          <input type="checkbox" checked={compToggles.word} onchange={() => imageComp.setAddWord(!compToggles.word)} />
          <i class="fas fa-font" aria-hidden="true"></i>
          <span>Word</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={compToggles.startPosition} onchange={() => imageComp.setIncludeStartPosition(!compToggles.startPosition)} />
          <i class="fas fa-play" aria-hidden="true"></i>
          <span>Start Position</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={compToggles.difficulty} onchange={() => imageComp.setAddDifficultyLevel(!compToggles.difficulty)} />
          <i class="fas fa-signal" aria-hidden="true"></i>
          <span>Difficulty</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={compToggles.stepNumbers} onchange={() => imageComp.setAddBeatNumbers(!compToggles.stepNumbers)} />
          <i class="fas fa-list-ol" aria-hidden="true"></i>
          <span>Step Numbers</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={compToggles.creatorName} onchange={() => imageComp.setShowCreatorName(!compToggles.creatorName)} />
          <i class="fas fa-user" aria-hidden="true"></i>
          <span>Creator Name</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={compToggles.notes} onchange={() => imageComp.setShowNotes(!compToggles.notes)} />
          <i class="fas fa-sticky-note" aria-hidden="true"></i>
          <span>Notes</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={compToggles.birthday} onchange={() => imageComp.setShowBirthday(!compToggles.birthday)} />
          <i class="fas fa-cake-candles" aria-hidden="true"></i>
          <span>Birthday</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" checked={compToggles.qrCode} onchange={() => imageComp.setShowQRCode(!compToggles.qrCode)} />
          <i class="fas fa-qrcode" aria-hidden="true"></i>
          <span>QR Code</span>
        </label>
      </section>
    </div>
  {/snippet}
</SettingsModalLayout>

<style>
  .card-preview-placeholder {
    width: 100%;
    max-width: 280px;
    aspect-ratio: 3/4;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-lg, 12px);
  }

  .toggle-sections {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .toggle-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0;
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
  }

  .toggle-row i {
    width: 1.25rem;
    text-align: center;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
  }

  .toggle-row input[type="checkbox"] {
    accent-color: var(--theme-accent, #3b82f6);
    width: 1rem;
    height: 1rem;
  }
</style>
```

- [ ] **Step 2: Simplify CardDesignerContextMenuBuilder.ts**

Replace the entire contents with:

```typescript
/**
 * Unified Choreo Card Context Menu Builder
 *
 * Simplified: single "Card Settings..." entry that opens the full modal.
 * Plus optional Re-render and Send to... actions.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";

export interface ChoreoCardContextMenuDeps {
  onOpenSettings: () => void;
  onRerender?: () => void;
  onSendTo?: () => void;
}

/** @deprecated Use ChoreoCardContextMenuDeps */
export type CardDesignerContextMenuDeps = ChoreoCardContextMenuDeps;

export function buildChoreoCardContextMenuItems(
  deps: ChoreoCardContextMenuDeps
): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = [
    {
      id: "open-card-settings",
      label: "Card Settings\u2026",
      icon: "fa-sliders",
      action: () => deps.onOpenSettings(),
    },
  ];

  const actions: ContextMenuEntry[] = [];

  if (deps.onRerender) {
    actions.push({
      id: "rerender",
      label: "Re-render",
      icon: "fa-sync-alt",
      action: deps.onRerender,
    });
  }

  if (deps.onSendTo) {
    actions.push({
      id: "send-to",
      label: "Send to\u2026",
      icon: "fa-paper-plane",
      action: deps.onSendTo,
    });
  }

  if (actions.length > 0) {
    items.push({ type: "separator" as const });
    items.push(...actions);
  }

  return items;
}

/** @deprecated Use buildChoreoCardContextMenuItems instead */
export const buildCardDesignerContextMenuItems = buildChoreoCardContextMenuItems;
```

- [ ] **Step 3: Update CardDesignerContextMenuHost.svelte**

The host no longer needs observer-based reactivity for inline toggles. Simplify to pass `onOpenSettings`:

```svelte
<!--
  CardDesignerContextMenuHost — Orchestrates the Card Designer right-click context menu.
  Single entry: "Card Settings..." plus optional Re-render action.
-->
<script lang="ts">
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildChoreoCardContextMenuItems } from "./CardDesignerContextMenuBuilder";

  interface Props {
    onOpenSettings: () => void;
    onRerender?: () => void;
  }

  let { onOpenSettings, onRerender }: Props = $props();

  let menuState: ContextMenuState = $state({ open: false });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    return buildChoreoCardContextMenuItems({
      onOpenSettings: () => {
        closeContextMenu();
        onOpenSettings();
      },
      onRerender,
    });
  });

  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
```

- [ ] **Step 4: Update ChoreoCardContextMenuHost.svelte (sequence viewer)**

This host has dual-mode logic (normal vs export mode). The export mode reads from `ExportOptionsStateManager` for per-export-session overrides. **Keep the `isExportMode` and `exportOptions` props** — they're used by `SequenceViewerDrawerHost.svelte`. The simplification only applies to the MENU ITEMS (replacing inline toggles with "Card Settings..."), not to the modal behavior. When in export mode, "Card Settings..." should still open the modal, but the modal would need to know about export mode to show the right state.

For now, simplify the menu entries but keep the export mode props flowing through. The `CardSettingsModal` will initially only support global settings. Export-mode overrides in the modal is a follow-up enhancement. The export flow still works because exports read from `ExportOptionsStateManager` directly when rendering — the context menu inline toggles were a convenience, not the only way to set export options.

```svelte
<!--
  ChoreoCardContextMenuHost — Orchestrates the ChoreoCard right-click context menu.
  Single entry: "Card Settings..." plus optional Send to action.
  Preserves export mode props for parent compatibility.
-->
<script lang="ts">
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildChoreoCardContextMenuItems } from "$lib/features/choreo-card/components/context-menu/CardDesignerContextMenuBuilder";
  import type { ExportOptionsStateManager } from "$lib/shared/sequence-viewer/state/export-options-state.svelte";

  interface Props {
    onOpenSettings: () => void;
    isExportMode?: boolean;
    exportOptions?: ExportOptionsStateManager;
    onSendTo?: () => void;
  }

  const { onOpenSettings, isExportMode = false, exportOptions, onSendTo }: Props = $props();

  let menuState: ContextMenuState = $state({ open: false });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    return buildChoreoCardContextMenuItems({
      onOpenSettings: () => {
        closeContextMenu();
        onOpenSettings();
      },
      onSendTo: onSendTo ? () => { closeContextMenu(); onSendTo(); } : undefined,
    });
  });

  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
```

- [ ] **Step 5: Update all parent components that render these hosts**

The parent components that render `CardDesignerContextMenuHost` and `ChoreoCardContextMenuHost` need to:
1. Remove the old prop-passing of visibility/composition state
2. Pass `onOpenSettings` callback instead
3. Add `CardSettingsModal` to their template
4. Wire `onOpenSettings` to open the modal

Files to check and update:
- `src/lib/features/choreo-card/components/CardDesigner.svelte`
- `src/lib/features/choreo-card/components/ChoreoCardTab.svelte`
- `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`
- `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`
- `src/routes/p/[code]/+page.svelte`
- `src/routes/sequence/[id]/+page.svelte`

Each needs: import CardSettingsModal, add `let cardSettingsOpen = $state(false)`, pass `onOpenSettings={() => { cardSettingsOpen = true }}` to the host, and render `<CardSettingsModal bind:open={cardSettingsOpen} />`.

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/choreo-card/ src/lib/shared/sequence-viewer/ src/routes/
git commit -m "feat: create CardSettingsModal, simplify choreo card context menus"
```

---

### Task 8: ~~Delete Stale Visibility Orphan~~ SKIPPED

**Reason:** `example-data.ts` is NOT an orphan — it's actively imported by:
- `src/lib/shared/onboarding/components/first-run/DesktopConfigPanel.svelte`
- `src/lib/shared/onboarding/components/first-run/steps/PictographModeStep.svelte`

Leave it in place. Remove the DELETE line from the spec's file changes summary as well.

---

### Task 9: Final Verification + TypeCheck

- [ ] **Step 1: Run full TypeScript check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Manual smoke test**

Open the app at `localhost:5173`. Verify each component:

1. **Pictograph (step grid):** Right-click a beat → "Pictograph Settings..." → modal opens with live preview → toggles work → changes persist
2. **Animation canvas:** Right-click → "Animation Settings..." → opens existing (renamed) modal → all category controls still work
3. **Choreo card:** Right-click → "Card Settings..." → modal opens with toggles → changes persist
4. **Mobile responsive:** Resize to mobile width → all three should render as drawers instead of modals

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address final verification issues for unified visibility context menus"
```
