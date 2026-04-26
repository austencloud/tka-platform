# Sticker Lab UI Modernization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the Sticker Lab from 2021-era UI (radio buttons, 11px fonts, 24px touch targets) to 2026 design system standards (SegmentedControl, 44px targets, design tokens, drawer-based layout).

**Architecture:** Replace 3-column permanent layout with 2-column (list + preview) plus two Drawer instances (primitive picker, export panel). Migrate all hardcoded CSS to design system tokens. Replace all radio/selector patterns with existing SegmentedControl component.

**Tech Stack:** Svelte 5, existing `Drawer` component (`$lib/shared/foundation/ui/Drawer.svelte`), existing `SegmentedControl` (`$lib/shared/3d/components/controls/SegmentedControl.svelte`), CSS custom properties from `app.css`.

**Spec:** `docs/superpowers/specs/2026-04-25-sticker-lab-ui-modernization.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/features/sticker-lab/StickerLab.svelte` | Rewrite | 2-col layout, drawer state, drawer hosts |
| `src/lib/features/sticker-lab/components/StickerListItem.svelte` | Rewrite | SegmentedControl selectors, token migration |
| `src/lib/features/sticker-lab/components/StickerList.svelte` | Modify | Add Export button, token migration |
| `src/lib/features/sticker-lab/components/SheetSizePicker.svelte` | Rewrite | SegmentedControl replacing radio inputs |
| `src/lib/features/sticker-lab/components/PrimitivePicker.svelte` | Rewrite | Drawer-based, responsive placement |
| `src/lib/features/sticker-lab/components/StickerExportPanel.svelte` | Modify | Token migration, no structural change |
| `src/lib/features/sticker-lab/components/StickerSheetPreview.svelte` | Modify | Token migration on toolbar + pager |

---

### Task 1: SheetSizePicker — Kill Radio Inputs

**Files:**
- Rewrite: `src/lib/features/sticker-lab/components/SheetSizePicker.svelte`

- [ ] **Step 1: Rewrite SheetSizePicker with SegmentedControl**

Replace the entire file contents:

```svelte
<script lang="ts">
  import type { SheetSize } from "../domain/sticker-types";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";

  interface Props {
    value: SheetSize;
    onChange: (size: SheetSize) => void;
  }
  let { value, onChange }: Props = $props();

  const options = [
    { value: "8.5x11" as SheetSize, label: "Letter 8.5×11" },
    { value: "13x19" as SheetSize, label: "Tabloid 13×19" },
  ];
</script>

<div class="sheet-size-picker">
  <span class="section-label">Sheet size</span>
  <SegmentedControl {options} {value} onchange={onChange} color="accent" />
</div>

<style>
  .sheet-size-picker {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  .section-label {
    font-size: var(--font-size-compact);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--theme-text-dim);
  }
</style>
```

- [ ] **Step 2: Verify no radio inputs remain**

Run: `grep -r 'type="radio"' src/lib/features/sticker-lab/`
Expected: zero matches.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: no new errors in sticker-lab files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/sticker-lab/components/SheetSizePicker.svelte
git commit -m "refactor(sticker-lab): replace SheetSizePicker radio inputs with SegmentedControl"
```

---

### Task 2: StickerListItem — SegmentedControl + Token Migration

**Files:**
- Rewrite: `src/lib/features/sticker-lab/components/StickerListItem.svelte`

- [ ] **Step 1: Rewrite StickerListItem**

Replace the entire file contents:

```svelte
<script lang="ts">
  import type { StickerUnit, StickerVariant, StickerBackground } from "../domain/sticker-types";
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { MAX_COPIES_PER_STICKER } from "../domain/sticker-constants";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";

  interface Props {
    sticker: StickerUnit;
  }
  let { sticker }: Props = $props();

  const state = getStickerLabContext();

  const variantOptions = [
    { value: "blue" as StickerVariant, label: "Blue" },
    { value: "red" as StickerVariant, label: "Red" },
    { value: "full" as StickerVariant, label: "Full" },
  ];

  const backgroundOptions = [
    { value: "transparent" as StickerBackground, label: "Clear" },
    { value: "white" as StickerBackground, label: "White" },
    { value: "radial-gradient" as StickerBackground, label: "Soft" },
  ];

  function bump(delta: number) {
    state.setCopies(sticker.id, sticker.copies + delta);
  }
</script>

<article class="item" data-sticker-id={sticker.id}>
  <div class="row-primary">
    <span class="word">{sticker.primitiveRef.displayName ?? sticker.primitiveRef.shapeHash.slice(0, 8)}</span>
    <button
      class="remove"
      aria-label="Remove sticker"
      onclick={() => state.removeSticker(sticker.id)}
    >
      <i class="fas fa-xmark" aria-hidden="true"></i>
    </button>
  </div>

  <div class="control-group">
    <span class="section-label">Variant</span>
    <SegmentedControl
      options={variantOptions}
      value={sticker.variant}
      onchange={(v) => state.setVariant(sticker.id, v)}
      color="blue"
      size="sm"
    />
  </div>

  <div class="control-group">
    <span class="section-label">Background</span>
    <SegmentedControl
      options={backgroundOptions}
      value={sticker.background}
      onchange={(b) => state.setBackground(sticker.id, b)}
      color="accent"
      size="sm"
    />
  </div>

  <div class="row-copies">
    <span class="copies-label">Copies</span>
    <div class="copies-controls">
      <button
        class="copies-btn"
        aria-label="Decrease copies"
        onclick={() => bump(-1)}
        disabled={sticker.copies <= 1}
      >−</button>
      <span class="count">{sticker.copies}</span>
      <button
        class="copies-btn"
        aria-label="Increase copies"
        onclick={() => bump(1)}
        disabled={sticker.copies >= MAX_COPIES_PER_STICKER}
      >+</button>
    </div>
  </div>
</article>

<style>
  .item {
    display: grid;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-2026-sm);
    color: var(--theme-text, white);
  }

  .row-primary {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .word {
    font-weight: 600;
    font-size: var(--font-size-base);
    flex: 1;
  }

  .remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: none;
    border-radius: var(--radius-2026-sm);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-base);
    transition: color var(--duration-fast), background var(--duration-fast);
  }
  .remove:hover {
    color: var(--semantic-error, #ef4444);
    background: rgba(239, 68, 68, 0.1);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .section-label {
    font-size: var(--font-size-compact);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--theme-text-dim);
  }

  .row-copies {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .copies-label {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .copies-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-left: auto;
  }

  .copies-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, white);
    font-size: var(--font-size-lg);
    cursor: pointer;
    transition: background var(--duration-fast);
  }
  .copies-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
  .copies-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .count {
    min-width: 32px;
    text-align: center;
    font-weight: 600;
    font-size: var(--font-size-lg);
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/sticker-lab/components/StickerListItem.svelte
git commit -m "refactor(sticker-lab): StickerListItem — SegmentedControl selectors + design tokens"
```

---

### Task 3: StickerSheetPreview — Token Migration

**Files:**
- Modify: `src/lib/features/sticker-lab/components/StickerSheetPreview.svelte`

- [ ] **Step 1: Update toolbar and pager styles**

In `StickerSheetPreview.svelte`, replace the entire `<style>` block with token-based styles. Key changes:
- `.toolbar` font-size: `var(--font-size-sm)` (was 12px)
- `.toggle-btn` padding: `var(--spacing-sm) var(--spacing-md)`, min-height: `var(--min-touch-target)`, border-radius: `var(--radius-2026-sm)` (was 4px padding, 4px radius)
- `.pager button` width/height: `var(--min-touch-target)` (was 28px), border-radius: `var(--radius-2026-sm)`
- `.toolbar` gap: `var(--spacing-md)` (was 16px hardcoded — same value but now token)
- `.toolbar .count` font-size: `var(--font-size-compact)`
- All color values → `var(--theme-*)` tokens

Replace the `<style>` block:

```css
  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    height: 100%;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex-wrap: wrap;
    font-size: var(--font-size-sm);
    color: var(--theme-text, white);
  }

  .toolbar .toggle-btn {
    min-height: var(--min-touch-target);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-2026-sm);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text, white);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: background var(--duration-fast), border-color var(--duration-fast);
  }
  .toolbar .toggle-btn[aria-pressed="true"] {
    background: rgba(255, 255, 255, 0.15);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .toolbar .count {
    margin-left: auto;
    font-size: var(--font-size-compact);
    opacity: 0.6;
  }

  .pager {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
  }
  .pager button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    border: none;
    border-radius: var(--radius-2026-sm);
    cursor: pointer;
    font-size: var(--font-size-base);
    transition: background var(--duration-fast);
  }
  .pager button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
  .pager button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .sheet-frame {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    padding: var(--spacing-md);
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-2026-sm);
  }

  .sheet {
    width: calc(var(--sheet-w));
    height: calc(var(--sheet-h));
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: var(--sheet-ar);
    background: #f9f6ef;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    gap: 0.15in;
    padding: 0.5in;
    box-sizing: border-box;
  }

  .slot {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .slot :global(svg) {
    width: 100%;
    height: 100%;
  }

  .sheet.show-cut-lines .slot::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1px dashed rgba(0, 0, 0, 0.4);
  }

  .sheet.show-bleed .slot::after {
    content: "";
    position: absolute;
    inset: -0.1in;
    border-radius: 50%;
    border: 1px dotted rgba(200, 0, 0, 0.4);
    pointer-events: none;
  }

  .missing {
    font-size: var(--font-size-compact);
    color: rgba(0, 0, 0, 0.4);
  }
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/sticker-lab/components/StickerSheetPreview.svelte
git commit -m "refactor(sticker-lab): StickerSheetPreview — design token migration"
```

---

### Task 4: StickerExportPanel — Token Migration

**Files:**
- Modify: `src/lib/features/sticker-lab/components/StickerExportPanel.svelte`

- [ ] **Step 1: Replace style block with token-based styles**

Replace the entire `<style>` block in `StickerExportPanel.svelte`:

```css
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    height: 100%;
  }

  .summary {
    padding: var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-2026-sm);
    color: var(--theme-text, white);
    font-size: var(--font-size-sm);
  }
  .summary .num {
    font-weight: 600;
    font-size: var(--font-size-base);
    margin-right: var(--spacing-xs);
  }

  .primary {
    min-height: var(--min-touch-target);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-accent, #8b5cf6);
    color: white;
    border: none;
    border-radius: var(--radius-2026-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 600;
    transition: opacity var(--duration-fast);
  }
  .primary:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .help {
    margin-top: auto;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }
  .help summary {
    cursor: pointer;
    padding: var(--spacing-sm) 0;
    min-height: var(--min-touch-target);
    display: flex;
    align-items: center;
  }
  .help-content h4 {
    margin: var(--spacing-md) 0 var(--spacing-xs);
    font-size: var(--font-size-sm);
    color: var(--theme-text, white);
  }
  .help-content p {
    margin: 0;
    font-size: var(--font-size-compact);
    line-height: 1.5;
  }
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/sticker-lab/components/StickerExportPanel.svelte
git commit -m "refactor(sticker-lab): StickerExportPanel — design token migration"
```

---

### Task 5: StickerList — Add Export Button + Token Migration

**Files:**
- Modify: `src/lib/features/sticker-lab/components/StickerList.svelte`

- [ ] **Step 1: Rewrite StickerList with Export button and tokens**

Replace the entire file contents. Key changes: add `onExportClick` prop, Export button in footer, token migration.

```svelte
<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import StickerListItem from "./StickerListItem.svelte";
  import PrimitivePicker from "./PrimitivePicker.svelte";

  interface Props {
    onExportClick: () => void;
  }
  let { onExportClick }: Props = $props();

  const stickerState = getStickerLabContext();

  let pickerOpen = $state(false);
</script>

<PrimitivePicker open={pickerOpen} onclose={() => (pickerOpen = false)} />

<div class="list-header">
  <span class="count">
    {stickerState.sheet.stickers.length}
    {stickerState.sheet.stickers.length === 1 ? "sticker" : "stickers"}
  </span>
  {#if stickerState.sheet.stickers.length > 0}
    <button class="clear-btn" onclick={() => stickerState.clearSheet()} aria-label="Clear all stickers">
      Clear
    </button>
  {/if}
</div>

<div class="list">
  {#if stickerState.sheet.stickers.length === 0}
    <div class="empty">
      <p>Add a primitive to start your sheet.</p>
      <button class="action-btn primary" onclick={() => (pickerOpen = true)}>Browse Primitives</button>
    </div>
  {:else}
    {#each stickerState.sheet.stickers as sticker (sticker.id)}
      <StickerListItem {sticker} />
    {/each}
  {/if}
</div>

<div class="list-footer">
  <button class="action-btn primary" onclick={() => (pickerOpen = true)} aria-label="Browse primitives">
    + Add
  </button>
  <button class="action-btn secondary" onclick={onExportClick} aria-label="Open export panel">
    Export
  </button>
</div>

<style>
  .list-header {
    display: flex;
    align-items: center;
    margin-bottom: var(--spacing-sm);
    min-height: var(--min-touch-target);
  }

  .count {
    flex: 1;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .clear-btn {
    min-height: var(--min-touch-target);
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    color: var(--theme-text-dim);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--radius-2026-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: color var(--duration-fast), border-color var(--duration-fast);
  }
  .clear-btn:hover {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    flex: 1;
    overflow-y: auto;
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-xl) var(--spacing-md);
    align-items: center;
    text-align: center;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .list-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-sm);
  }

  .action-btn {
    min-height: var(--min-touch-target);
    border: none;
    border-radius: var(--radius-2026-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: 600;
    transition: opacity var(--duration-fast);
  }

  .action-btn.primary {
    background: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .action-btn.secondary {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, white);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }
  .action-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.1);
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: type error in `StickerLab.svelte` because `StickerList` now requires `onExportClick` prop. This is expected — Task 7 will fix it.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/sticker-lab/components/StickerList.svelte
git commit -m "refactor(sticker-lab): StickerList — add Export button, token migration"
```

---

### Task 6: PrimitivePicker — Modal to Drawer

**Files:**
- Rewrite: `src/lib/features/sticker-lab/components/PrimitivePicker.svelte`

- [ ] **Step 1: Rewrite PrimitivePicker using Drawer**

Replace the entire file. The key structural change: replaces the `position: fixed` modal + backdrop with the shared `Drawer` component. Uses `placement="right"` with `respectLayoutMode={true}` so it automatically becomes a bottom sheet on mobile.

```svelte
<script lang="ts">
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { loadPrimitiveCatalog } from "../services/implementations/PrimitiveCatalogReader";
  import { loadPrimitivePaths, getPrimitivePaths } from "../state/mandala-paths-cache.svelte";
  import { MandalaRenderer } from "$lib/shared/mandala/services/implementations/MandalaRenderer";
  import { entryToRef } from "../domain/primitive-catalog-types";
  import type { PrimitiveCatalogEntry } from "../domain/primitive-catalog-types";
  import type { MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";
  import { onMount } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";

  interface Props {
    open: boolean;
    onclose: () => void;
  }
  let { open = $bindable(), onclose }: Props = $props();

  const stickerState = getStickerLabContext();
  const renderer = new MandalaRenderer();

  const PICKER_PALETTE: MandalaPalette = {
    blueStroke: "#1e40af",
    blueFill: "rgba(37, 99, 235, 0.65)",
    redStroke: "#991b1b",
    redFill: "rgba(220, 38, 38, 0.65)",
    purpleStroke: "#6b21a8",
    purpleFill: "rgba(126, 34, 206, 0.75)",
  };

  let entries = $state<PrimitiveCatalogEntry[]>([]);
  let isLoading = $state(true);

  onMount(async () => {
    const catalog = await loadPrimitiveCatalog();
    entries = catalog.entries;
    isLoading = false;
    for (const entry of entries) {
      void loadPrimitivePaths(entry.shapeHash);
    }
  });

  const copiesMap = $derived(
    new Map(stickerState.sheet.stickers.map(s => [s.primitiveRef.shapeHash, s.copies]))
  );

  function handleAdd(entry: PrimitiveCatalogEntry) {
    stickerState.addPrimitive(entryToRef(entry));
  }

  function handleClose() {
    open = false;
    onclose();
  }
</script>

<Drawer
  bind:isOpen={open}
  placement="right"
  respectLayoutMode={true}
  ariaLabel="Choose a mandala primitive"
  closeOnBackdrop={true}
  showHandle={true}
  class="primitive-picker-drawer"
  onclose={handleClose}
  trapFocus={true}
  preventScroll={false}
>
  <div class="picker-content">
    <header class="picker-header">
      <h3>Primitives</h3>
      <div class="header-right">
        <span class="entry-count">{entries.length}</span>
        <button class="close-btn" aria-label="Close picker" onclick={handleClose}>
          <i class="fas fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    {#if isLoading}
      <div class="loading">Loading primitives…</div>
    {:else if entries.length === 0}
      <div class="empty">No primitives available.</div>
    {:else}
      <div class="grid">
        {#each entries as entry (entry.shapeHash)}
          {@const paths = getPrimitivePaths(entry.shapeHash)}
          {@const copies = copiesMap.get(entry.shapeHash) ?? 0}
          <button
            class="tile"
            class:on-sheet={copies > 0}
            onclick={() => handleAdd(entry)}
            aria-label="{entry.displayName} — {copies > 0 ? `${copies} on sheet` : 'Add to sheet'}"
          >
            {#if paths}
              {@html renderer.renderSVG(paths, {
                size: 120,
                style: "filled",
                showGridDots: false,
                show: "both",
                strokeWidth: 2,
                transparentBackground: true,
                palette: PICKER_PALETTE,
              })}
            {:else}
              <div class="tile-loading">…</div>
            {/if}
            <span class="tile-label">{entry.displayName}</span>
            {#if copies > 0}
              <span class="badge">{copies}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</Drawer>

<style>
  :global(.drawer-content.primitive-picker-drawer[data-placement="right"]) {
    width: clamp(300px, 30vw, 400px);
  }

  .picker-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--spacing-md);
  }

  .picker-header {
    display: flex;
    align-items: center;
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    margin-bottom: var(--spacing-md);
  }

  .picker-header h3 {
    margin: 0;
    flex: 1;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .entry-count {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: none;
    border-radius: var(--radius-2026-sm);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-base);
    transition: color var(--duration-fast);
  }
  .close-btn:hover {
    color: var(--theme-text, white);
  }

  .loading, .empty {
    padding: var(--spacing-xl);
    text-align: center;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: var(--spacing-sm);
    overflow-y: auto;
    flex: 1;
  }

  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid transparent;
    border-radius: var(--radius-2026-sm);
    cursor: pointer;
    transition: background var(--duration-fast), border-color var(--duration-fast);
  }
  .tile:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }
  .tile.on-sheet {
    border-color: var(--theme-accent, #8b5cf6);
    background: rgba(139, 92, 246, 0.08);
  }

  .tile :global(svg) {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #f9f6ef;
  }

  .tile-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile-loading {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim);
    font-size: var(--font-size-lg);
  }

  .badge {
    position: absolute;
    top: var(--spacing-xs);
    right: var(--spacing-xs);
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    font-size: var(--font-size-compact);
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--spacing-xs);
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: no new errors (the `open` prop is now `$bindable()` — verify Drawer's `isOpen` bind works).

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/sticker-lab/components/PrimitivePicker.svelte
git commit -m "refactor(sticker-lab): PrimitivePicker — modal to responsive Drawer"
```

---

### Task 7: StickerLab — 2-Column Layout + Drawer Hosts

**Files:**
- Rewrite: `src/lib/features/sticker-lab/StickerLab.svelte`

- [ ] **Step 1: Rewrite StickerLab with 2-column layout and export drawer**

Replace the entire file. The 3-column grid becomes 2-column. Export panel moves into a Drawer.

```svelte
<script lang="ts">
  import { createStickerLabState } from "./state/sticker-lab-state.svelte";
  import { setStickerLabContext } from "./context/sticker-lab-context";
  import StickerList from "./components/StickerList.svelte";
  import StickerSheetPreview from "./components/StickerSheetPreview.svelte";
  import StickerExportPanel from "./components/StickerExportPanel.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";

  const state = createStickerLabState();
  setStickerLabContext(state);

  let exportDrawerOpen = $state(false);
</script>

<div class="sticker-lab">
  <section class="col col-list" aria-label="Sticker list">
    <header><h2>Stickers</h2></header>
    <StickerList onExportClick={() => (exportDrawerOpen = true)} />
  </section>

  <section class="col col-preview" aria-label="Sheet preview">
    <header><h2>Sheet Preview</h2></header>
    <StickerSheetPreview />
  </section>
</div>

<Drawer
  bind:isOpen={exportDrawerOpen}
  placement="right"
  respectLayoutMode={true}
  ariaLabel="Export sticker sheet"
  closeOnBackdrop={true}
  showHandle={true}
  class="sticker-export-drawer"
  trapFocus={false}
  preventScroll={false}
>
  <div class="export-drawer-content">
    <header class="export-header">
      <h3>Export</h3>
      <button
        class="close-btn"
        aria-label="Close export panel"
        onclick={() => (exportDrawerOpen = false)}
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    </header>
    <StickerExportPanel />
  </div>
</Drawer>

<style>
  .sticker-lab {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: var(--spacing-md);
    height: 100%;
    padding: var(--spacing-md);
    box-sizing: border-box;
  }

  @media (max-width: 640px) {
    .sticker-lab {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }
    .col-preview {
      min-height: 300px;
    }
  }

  .col {
    display: flex;
    flex-direction: column;
    background: var(--theme-surface, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-2026-sm);
    padding: var(--spacing-md);
    overflow: auto;
  }

  .col header {
    margin-bottom: var(--spacing-md);
  }

  .col h2 {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  :global(.drawer-content.sticker-export-drawer[data-placement="right"]) {
    width: clamp(280px, 25vw, 360px);
  }

  .export-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--spacing-md);
  }

  .export-header {
    display: flex;
    align-items: center;
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    margin-bottom: var(--spacing-md);
  }

  .export-header h3 {
    margin: 0;
    flex: 1;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: none;
    border-radius: var(--radius-2026-sm);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-base);
    transition: color var(--duration-fast);
  }
  .close-btn:hover {
    color: var(--theme-text, white);
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: clean — all prop contracts now satisfied.

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run tests/unit/sticker-lab/`
Expected: all 50 existing tests pass (tests are unit tests on state/services, not component tests — layout changes don't affect them).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/sticker-lab/StickerLab.svelte
git commit -m "refactor(sticker-lab): 2-column layout with export drawer — kill 3-column grid"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Grep for banned patterns**

Run all three checks:

```bash
grep -r 'type="radio"' src/lib/features/sticker-lab/
grep -r 'type="checkbox"' src/lib/features/sticker-lab/
grep -rn "font-size:.*[0-9]\+px" src/lib/features/sticker-lab/
```

Expected: zero matches for radio/checkbox. The font-size grep may catch inline values inside `@html` SVG output from MandalaRenderer — those are fine (they're generated SVG attributes, not component styles). Any hardcoded font-size in `<style>` blocks is a bug — fix it.

- [ ] **Step 2: Grep for hardcoded touch targets**

```bash
grep -rn "width: *[0-9]\+px\|height: *[0-9]\+px" src/lib/features/sticker-lab/components/ --include="*.svelte"
```

Expected: zero hardcoded width/height on interactive elements. The sheet preview `.sheet` uses `calc(var(--sheet-w))` and physical units (inches) which are correct — those are print dimensions, not touch targets.

- [ ] **Step 3: Run full typecheck + test suite**

```bash
npm run check && npx vitest run tests/unit/sticker-lab/
```

Expected: 0 errors, all tests pass.

- [ ] **Step 4: Build verification**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit verification results**

No code changes expected. If any grep caught violations, fix them first, then re-run verification and commit the fixes.
