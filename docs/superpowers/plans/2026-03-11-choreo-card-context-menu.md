# ChoreoCard Context Menu Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-click / long-press context menu to the ChoreoCard with inline export visibility toggles.

**Architecture:** Two new files (builder + host) following the exact `CanvasContextMenuBuilder` / `CanvasContextMenuHost` pattern. The builder reads from `ExportOptionsStateManager` or `ImageCompositionStateManager` depending on export mode. ChoreoCard gets a new `onContextMenu` callback prop. Parent components mount the host and wire it up.

**Tech Stack:** Svelte 5, TypeScript, existing shared `ContextMenu.svelte` component, existing `context-menu-types.ts`

**Spec:** `docs/superpowers/specs/2026-03-11-choreo-card-context-menu-design.md`

---

## Chunk 1: Builder + Host + ChoreoCard Wiring

### Task 1: Create the ChoreoCardContextMenuBuilder

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuBuilder.ts`

- [ ] **Step 1: Create the builder file**

```typescript
/**
 * ChoreoCard Context Menu Builder
 *
 * Reads current state from ExportOptionsStateManager (export mode)
 * or ImageCompositionStateManager (normal mode) and produces
 * ContextMenuEntry[] for the ChoreoCard right-click menu.
 *
 * Toggle groups:
 *   - Include: Word, Start Position, Difficulty, Step Numbers
 *   - Footer: Creator Name, Notes, Birthday
 *   - Columns: Auto, 2, 3, 4, 5, 6 (submenu, radio-style)
 *   - Theme: Light / Dark toggle
 * Plus: Edit Notes Text..., Download Image actions.
 */

import type {
  ContextMenuEntry,
  ContextMenuItem,
} from "$lib/shared/components/context-menu/context-menu-types";

export interface ChoreoCardContextMenuDeps {
  // Current toggle states (read from whichever manager is active)
  showWord: boolean;
  showStepNumbers: boolean;
  showDifficulty: boolean;
  includeStartPosition: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  showBirthday: boolean;
  darkMode: boolean;
  columnCount: number | null; // null = auto

  // Callbacks to toggle each setting
  setShowWord: (v: boolean) => void;
  setShowStepNumbers: (v: boolean) => void;
  setShowDifficulty: (v: boolean) => void;
  setIncludeStartPosition: (v: boolean) => void;
  setShowCreatorName: (v: boolean) => void;
  setShowNotes: (v: boolean) => void;
  setShowBirthday: (v: boolean) => void;
  setDarkMode: (v: boolean) => void;
  setColumnCount: (v: number | null) => void;

  // Actions
  onEditNotes?: () => void;
  onExportImage?: () => void;
}

const COLUMN_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Auto", value: null },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
];

function buildColumnChildren(
  currentCount: number | null,
  setColumnCount: (v: number | null) => void
): ContextMenuItem[] {
  return COLUMN_OPTIONS.map((opt) => ({
    id: `columns-${opt.value ?? "auto"}`,
    label: opt.label,
    checked: currentCount === opt.value,
    action: () => setColumnCount(opt.value),
  }));
}

export function buildChoreoCardContextMenuItems(
  deps: ChoreoCardContextMenuDeps
): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = [
    // ── Include section ──
    { type: "header" as const, label: "Include" },
    {
      id: "toggle-word",
      label: "Word",
      icon: "fa-font",
      checked: deps.showWord,
      keepOpen: true,
      action: () => deps.setShowWord(!deps.showWord),
    },
    {
      id: "toggle-start",
      label: "Start Position",
      icon: "fa-play",
      checked: deps.includeStartPosition,
      keepOpen: true,
      action: () => deps.setIncludeStartPosition(!deps.includeStartPosition),
    },
    {
      id: "toggle-difficulty",
      label: "Difficulty",
      icon: "fa-signal",
      checked: deps.showDifficulty,
      keepOpen: true,
      action: () => deps.setShowDifficulty(!deps.showDifficulty),
    },
    {
      id: "toggle-step-numbers",
      label: "Step Numbers",
      icon: "fa-list-ol",
      checked: deps.showStepNumbers,
      keepOpen: true,
      action: () => deps.setShowStepNumbers(!deps.showStepNumbers),
    },

    // ── Footer section ──
    { type: "separator" as const },
    { type: "header" as const, label: "Footer" },
    {
      id: "toggle-creator-name",
      label: "Creator Name",
      icon: "fa-user",
      checked: deps.showCreatorName,
      keepOpen: true,
      action: () => deps.setShowCreatorName(!deps.showCreatorName),
    },
    {
      id: "toggle-notes",
      label: "Notes",
      icon: "fa-sticky-note",
      checked: deps.showNotes,
      keepOpen: true,
      action: () => deps.setShowNotes(!deps.showNotes),
    },
    {
      id: "toggle-birthday",
      label: "Birthday",
      icon: "fa-cake-candles",
      checked: deps.showBirthday,
      keepOpen: true,
      action: () => deps.setShowBirthday(!deps.showBirthday),
    },

    // ── Columns submenu ──
    { type: "separator" as const },
    {
      id: "columns-submenu",
      label: "Columns",
      icon: "fa-table-columns",
      children: buildColumnChildren(deps.columnCount, deps.setColumnCount),
    },

    // ── Theme toggle ──
    { type: "separator" as const },
    {
      id: "toggle-theme",
      label: deps.darkMode ? "Switch to Light" : "Switch to Dark",
      icon: deps.darkMode ? "fa-sun" : "fa-moon",
      checked: deps.darkMode,
      keepOpen: true,
      action: () => deps.setDarkMode(!deps.darkMode),
    },
  ];

  // ── Actions ──
  if (deps.onEditNotes || deps.onExportImage) {
    items.push({ type: "separator" as const });

    if (deps.onEditNotes) {
      items.push({
        id: "edit-notes",
        label: "Edit Notes Text\u2026",
        icon: "fa-pen",
        action: deps.onEditNotes,
      });
    }

    if (deps.onExportImage) {
      items.push({
        id: "export-image",
        label: "Download Image",
        icon: "fa-download",
        action: deps.onExportImage,
      });
    }
  }

  return items;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i error`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuBuilder.ts
git commit -m "feat(sequence-viewer): add ChoreoCardContextMenuBuilder"
```

---

### Task 2: Create the ChoreoCardContextMenuHost

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte`

The host bridges the two state managers to the builder. It reads from `ExportOptionsStateManager` when `isExportMode` is true, otherwise from `ImageCompositionStateManager` (singleton via `getImageCompositionManager()`).

- [ ] **Step 1: Create the host component**

```svelte
<!--
  ChoreoCardContextMenuHost — Orchestrates the ChoreoCard right-click context menu.
  Reads from ExportOptionsStateManager (export mode) or ImageCompositionStateManager (normal mode).
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import { buildChoreoCardContextMenuItems } from "./ChoreoCardContextMenuBuilder";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import type { ExportOptionsStateManager } from "$lib/shared/sequence-viewer/state/export-options-state.svelte";

  interface Props {
    isExportMode: boolean;
    exportOptions: ExportOptionsStateManager;
    onEditNotes?: () => void;
    onExportImage?: () => void;
  }

  const { isExportMode, exportOptions, onEditNotes, onExportImage }: Props = $props();

  let menuState: ContextMenuState = $state({ open: false });

  // ImageCompositionStateManager is a singleton — get it directly
  const imageComposition = getImageCompositionManager();

  // Observer for ImageCompositionStateManager (non-rune reactivity)
  let compositionVersion = $state(0);

  function onCompositionChanged(): void {
    compositionVersion++;
  }

  imageComposition.registerObserver(onCompositionChanged);

  onDestroy(() => {
    imageComposition.unregisterObserver(onCompositionChanged);
  });

  function closeContextMenu(): void {
    menuState = { open: false };
  }

  // Build menu items reactively.
  // In export mode: reads ExportOptionsStateManager getters ($state runes → automatic reactivity).
  // In normal mode: reads ImageCompositionStateManager via compositionVersion (observer → $derived).
  const menuItems: ContextMenuEntry[] = $derived.by(() => {
    if (isExportMode) {
      // Reading $state getters creates Svelte reactive dependencies automatically
      return buildChoreoCardContextMenuItems({
        showWord: exportOptions.imageShowWord,
        showStepNumbers: exportOptions.imageShowStepNumbers,
        showDifficulty: exportOptions.imageShowDifficulty,
        includeStartPosition: exportOptions.imageIncludeStartPosition,
        showCreatorName: exportOptions.imageShowCreatorName,
        showNotes: exportOptions.imageShowNotes,
        showBirthday: imageComposition.showBirthday, // Always from composition manager
        darkMode: exportOptions.imageDarkMode,
        columnCount: exportOptions.imageColumnCount,

        setShowWord: (v) => exportOptions.setImageShowWord(v),
        setShowStepNumbers: (v) => exportOptions.setImageShowStepNumbers(v),
        setShowDifficulty: (v) => exportOptions.setImageShowDifficulty(v),
        setIncludeStartPosition: (v) => exportOptions.setImageIncludeStartPosition(v),
        setShowCreatorName: (v) => exportOptions.setImageShowCreatorName(v),
        setShowNotes: (v) => exportOptions.setImageShowNotes(v),
        setShowBirthday: (v) => imageComposition.setShowBirthday(v),
        setDarkMode: (v) => exportOptions.setImageDarkMode(v),
        setColumnCount: (v) => exportOptions.setImageColumnCount(v),

        onEditNotes: onEditNotes ? () => { closeContextMenu(); onEditNotes(); } : undefined,
        onExportImage: onExportImage ? () => { closeContextMenu(); onExportImage(); } : undefined,
      });
    } else {
      // Touch compositionVersion to create reactive dependency on observer
      void compositionVersion;

      const comp = imageComposition;
      return buildChoreoCardContextMenuItems({
        showWord: comp.addWord,
        showStepNumbers: comp.addStepNumbers,
        showDifficulty: comp.addDifficultyLevel,
        includeStartPosition: comp.includeStartPosition,
        showCreatorName: comp.showCreatorName,
        showNotes: comp.showNotes,
        showBirthday: comp.showBirthday,
        darkMode: comp.darkMode,
        columnCount: null, // No column override in normal mode

        setShowWord: (v) => comp.setAddWord(v),
        setShowStepNumbers: (v) => comp.setAddBeatNumbers(v),
        setShowDifficulty: (v) => comp.setAddDifficultyLevel(v),
        setIncludeStartPosition: (v) => comp.setIncludeStartPosition(v),
        setShowCreatorName: (v) => comp.setShowCreatorName(v),
        setShowNotes: (v) => comp.setShowNotes(v),
        setShowBirthday: (v) => comp.setShowBirthday(v),
        setDarkMode: (v) => comp.setDarkMode(v),
        setColumnCount: () => {}, // No-op in normal mode (auto layout)

        onEditNotes: onEditNotes ? () => { closeContextMenu(); onEditNotes(); } : undefined,
        onExportImage: onExportImage ? () => { closeContextMenu(); onExportImage(); } : undefined,
      });
    }
  });

  /**
   * Open the context menu at the given viewport coordinates.
   * Called from ChoreoCard via the onContextMenu prop.
   */
  export function openContextMenu(x: number, y: number): void {
    menuState = { open: true, x, y };
  }
</script>

<ContextMenu {menuState} items={menuItems} onClose={closeContextMenu} />
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i error`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte
git commit -m "feat(sequence-viewer): add ChoreoCardContextMenuHost"
```

---

### Task 3: Add onContextMenu prop to ChoreoCard

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

ChoreoCard gets a new `onContextMenu` callback prop. The existing `oncontextmenu` handler calls it for all users. Long-press (500ms) also triggers it on touch/pen.

- [ ] **Step 1: Add prop and long-press state**

In the `Props` interface (around line 127), add:

```typescript
    // Context menu callback (right-click / long-press)
    onContextMenu?: (x: number, y: number) => void;
```

In the destructuring (around line 151), add:

```typescript
    onContextMenu,
```

After the destructuring block, add long-press state variables:

```typescript
  // Long-press for touch context menu (matches animation canvas pattern)
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressOrigin: { x: number; y: number } | null = null;

  function cancelLongPress(): void {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressOrigin = null;
  }
```

- [ ] **Step 2: Wire up event handlers on the root element**

Find the root `<div class="choreo-card-root"` element (around line 1237). Replace its `oncontextmenu` handler.

Current:
```svelte
oncontextmenu={(e) => { handleContextMenu(e); if (!featureFlagService.isAdmin) handleCellContextMenu(e); }}
```

New (adds the export context menu call, then the existing admin logic):
```svelte
oncontextmenu={(e: MouseEvent) => {
  if (onContextMenu) {
    e.preventDefault();
    onContextMenu(e.clientX, e.clientY);
  }
  handleContextMenu(e);
  if (!featureFlagService.isAdmin) handleCellContextMenu(e);
}}
onpointerdown={(e: PointerEvent) => {
  if (e.button !== 0 || e.pointerType === "mouse" || !onContextMenu) return;
  const x = e.clientX;
  const y = e.clientY;
  longPressOrigin = { x, y };
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    longPressOrigin = null;
    onContextMenu(x, y);
  }, 500);
}}
onpointermove={(e: PointerEvent) => {
  if (longPressOrigin) {
    const dx = e.clientX - longPressOrigin.x;
    const dy = e.clientY - longPressOrigin.y;
    if (dx * dx + dy * dy > 100) cancelLongPress(); // >10px movement
  }
}}
onpointerup={() => cancelLongPress()}
onpointercancel={() => cancelLongPress()}
```

- [ ] **Step 3: Clean up long-press timer on destroy**

In the existing `onDestroy` block (around line 1061), add:

```typescript
    cancelLongPress();
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i error`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "feat(sequence-viewer): add onContextMenu prop and long-press to ChoreoCard"
```

---

### Task 4: Wire up in +page.svelte (desktop route)

**Files:**
- Modify: `src/routes/sequence/[id]/+page.svelte`

Mount `ChoreoCardContextMenuHost` and pass its `openContextMenu` to the `ViewerSplitPane` → `ChoreoCard` chain.

- [ ] **Step 1: Import the host component**

Add import near other component imports:

```typescript
import ChoreoCardContextMenuHost from "$lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
```

- [ ] **Step 2: Add host instance variable**

Inside the `{#snippet children(ctx)}` block (after the `@const` declarations around line 542), add:

```svelte
{@const choreoMenuHost = null as ChoreoCardContextMenuHost | null}
```

Actually, since we need `bind:this`, declare a `let` in the script block:

```typescript
let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();
```

- [ ] **Step 3: Mount the host and pass openContextMenu to ViewerSplitPane**

Place the host component near the bottom of the template (inside the `{#snippet children(ctx)}` block, after the main layout), alongside the existing ContextMenu usage:

```svelte
<ChoreoCardContextMenuHost
  bind:this={choreoCardMenuHost}
  isExportMode={isImageExportActive}
  exportOptions={ctx.exportOptions}
  onEditNotes={() => {
    if (!isImageExportActive) ctx.enterEditMode("image");
  }}
  onExportImage={() => ctx.handleExport()}
/>
```

On the `ViewerSplitPane` component, add the `onChoreoCardContextMenu` prop:

```svelte
onChoreoCardContextMenu={(x, y) => choreoCardMenuHost?.openContextMenu(x, y)}
```

- [ ] **Step 4: Thread onContextMenu through ViewerSplitPane to ChoreoCard**

In `ViewerSplitPane.svelte`, add prop:

```typescript
onChoreoCardContextMenu?: (x: number, y: number) => void;
```

Pass it through to `ChoreoCard`:

```svelte
<ChoreoCard ... onContextMenu={onChoreoCardContextMenu} />
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i error`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/routes/sequence/[id]/+page.svelte src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
git commit -m "feat(sequence-viewer): wire ChoreoCard context menu in desktop route"
```

---

### Task 5: Wire up in SequenceViewerDrawerHost.svelte (mobile/drawer)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

Same pattern as Task 4 but for the mobile drawer host.

- [ ] **Step 1: Import and declare host variable**

```typescript
import ChoreoCardContextMenuHost from "./choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";

let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();
```

- [ ] **Step 2: Mount host and pass to ChoreoCard**

Mount the host inside the `{#snippet children(ctx)}` block (near the end, before the closing tags):

```svelte
<ChoreoCardContextMenuHost
  bind:this={choreoCardMenuHost}
  isExportMode={isImageExportActive}
  exportOptions={ctx.exportOptions}
  onEditNotes={() => {
    if (!isImageExportActive) ctx.enterEditMode("image");
  }}
  onExportImage={() => ctx.handleExport()}
/>
```

On the `ViewerSplitPane` that renders the ChoreoCard, add:

```svelte
onChoreoCardContextMenu={(x, y) => choreoCardMenuHost?.openContextMenu(x, y)}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error 2>&1 | grep -i error`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat(sequence-viewer): wire ChoreoCard context menu in drawer host"
```

---

### Task 6: Manual verification

- [ ] **Step 1: Test desktop route**

1. Navigate to a sequence in the sequence viewer (`/sequence/[id]`)
2. Right-click the ChoreoCard → context menu appears
3. Toggle Word off → word disappears from header, menu stays open, checkmark updates
4. Toggle Start Position off → grid reflows to 4 columns with FLIP animation
5. Toggle Difficulty on → badge appears
6. Toggle Dark mode → card switches to dark
7. Open Columns submenu → select 3 → grid reflows to 3 columns
8. Click "Download Image" → export triggers, menu closes
9. Open export sidebar → right-click card again → toggles now affect export preview (not global defaults)

- [ ] **Step 2: Test mobile drawer**

1. Open sequence viewer in mobile layout
2. Long-press (500ms) the ChoreoCard → context menu appears
3. Toggle settings → card updates in real time
4. Tap outside menu → dismisses

- [ ] **Step 3: Test admin users**

1. As admin, right-click the card → export context menu opens (not cell menu)
2. The existing admin cell context menu still works on individual cell clicks

- [ ] **Step 4: Commit any fixes from testing**
