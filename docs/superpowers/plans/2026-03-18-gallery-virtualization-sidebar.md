# Gallery Virtualization + Section Index Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 400+ card DOM mounting on gallery tab switch by always virtualizing, and add a right-side section index sidebar for sort-dependent navigation.

**Architecture:** Remove the sectioned rendering path from BrowseGrid so it always routes to VirtualizedSequenceGrid. Add a SectionIndexSidebar component that reads section data and scrolls the virtualizer to the appropriate row on click.

**Tech Stack:** Svelte 5, TypeScript, TanStack Virtual (@tanstack/svelte-virtual), CSS Flexbox

**Spec:** `docs/superpowers/specs/2026-03-18-gallery-virtualization-sidebar-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/features/browse/sequences/navigation/components/SectionIndexSidebar.svelte` | Vertical section navigation sidebar (desktop only) |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/features/browse/sequences/display/components/BrowseGrid.svelte` | Remove `!showSections` from virtualization condition |
| `src/lib/features/browse/sequences/display/components/VirtualizedSequenceGrid.svelte` | Expose `scrollToSequenceIndex()` method via bind:this |
| `src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte` | Add sidebar to layout, wire scroll-to-section, pass section data |

---

## Task 1: Always-Virtualize BrowseGrid

**Files:**
- Modify: `src/lib/features/browse/sequences/display/components/BrowseGrid.svelte`

- [ ] **Step 1: Read BrowseGrid.svelte**

Read the file to find the virtualization decision logic.

- [ ] **Step 2: Remove `!showSections` from the virtualization condition**

Find (around line 57-62):
```typescript
const useVirtualization = $derived(
  !disableVirtualization &&
    !showSections &&
    sequences.length > VIRTUALIZATION_THRESHOLD &&
    viewMode === "grid"
);
```

Change to:
```typescript
const useVirtualization = $derived(
  !disableVirtualization &&
    sequences.length > VIRTUALIZATION_THRESHOLD &&
    viewMode === "grid"
);
```

This makes the gallery always use `VirtualizedSequenceGrid` for 50+ sequences regardless of section state.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/sequences/display/components/BrowseGrid.svelte
git commit -m "perf: always virtualize gallery grid regardless of section state"
```

---

## Task 2: Expose scrollToSequenceIndex on VirtualizedSequenceGrid

**Files:**
- Modify: `src/lib/features/browse/sequences/display/components/VirtualizedSequenceGrid.svelte`

- [ ] **Step 1: Read VirtualizedSequenceGrid.svelte**

Read the file to understand the virtualizer setup, especially `virtualizerStore` and how `scrollToIndex` works with TanStack Virtual.

- [ ] **Step 2: Add a scrollToSequenceIndex function and export it**

Add a function that converts a sequence array index to a row index and scrolls the virtualizer:

```typescript
/**
 * Scroll the virtualizer to bring the given sequence index into view.
 * Called by the SectionIndexSidebar when a section marker is clicked.
 */
export function scrollToSequenceIndex(sequenceIndex: number): void {
  const rowIndex = Math.floor(sequenceIndex / columnCount);
  const virtualizer = virtualizerRef;
  if (virtualizer) {
    virtualizer.scrollToIndex(rowIndex, { align: "start" });
  }
}
```

The `virtualizerRef` is the TanStack virtualizer instance. Check how it's currently stored — it may be in the `$effect` subscription or via `virtualizerStore`. The key method is `scrollToIndex(index, options)`.

- [ ] **Step 3: Also expose a way to get the current first visible sequence index**

Add a reactive getter or callback prop so the parent can track which section is currently visible:

```typescript
/** Get the index of the first visible sequence in the flat array */
export function getFirstVisibleSequenceIndex(): number {
  const virtualizer = virtualizerRef;
  if (!virtualizer) return 0;
  const items = virtualizer.getVirtualItems();
  if (items.length === 0) return 0;
  return items[0].index * columnCount;
}
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/browse/sequences/display/components/VirtualizedSequenceGrid.svelte
git commit -m "feat: expose scrollToSequenceIndex on VirtualizedSequenceGrid"
```

---

## Task 3: Create SectionIndexSidebar Component

**Files:**
- Create: `src/lib/features/browse/sequences/navigation/components/SectionIndexSidebar.svelte`

- [ ] **Step 1: Read the existing section data model**

Read `src/lib/features/browse/shared/domain/models/browse-models.ts` to understand the `SequenceSection` type (specifically the `title` and `sequences` fields).

Also read `src/lib/features/browse/shared/domain/enums/browse-enums.ts` for `BrowseSortMethod`.

- [ ] **Step 2: Create the SectionIndexSidebar component**

```svelte
<script lang="ts">
  import type { SequenceSection } from "../../../shared/domain/models/browse-models";
  import type { BrowseSortMethod } from "../../../shared/domain/enums/browse-enums";

  interface Props {
    sections: SequenceSection[];
    sortMethod: BrowseSortMethod;
    onScrollToSection: (firstSequenceIndex: number) => void;
    activeSection?: string;
  }

  const { sections, sortMethod, onScrollToSection, activeSection } = $props<Props>();

  // Compute the flat index of the first sequence in each section.
  // Sections are ordered, so we accumulate counts.
  const sectionOffsets = $derived.by(() => {
    const offsets: { title: string; startIndex: number }[] = [];
    let runningIndex = 0;
    for (const section of sections) {
      offsets.push({ title: section.title, startIndex: runningIndex });
      runningIndex += section.sequences.length;
    }
    return offsets;
  });

  function handleClick(startIndex: number) {
    onScrollToSection(startIndex);
  }
</script>

<nav class="section-index-sidebar" aria-label="Section navigation">
  <div class="sidebar-items">
    {#each sectionOffsets as { title, startIndex } (title)}
      <button
        class="sidebar-item"
        class:active={activeSection === title}
        onclick={() => handleClick(startIndex)}
        title={title}
      >
        <span class="sidebar-label">{title}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .section-index-sidebar {
    display: none;
    flex-shrink: 0;
    width: 72px;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--spacing-xs, 4px) 0;
    scrollbar-width: none; /* Hide scrollbar — sidebar is narrow */
  }

  .section-index-sidebar::-webkit-scrollbar {
    display: none;
  }

  /* Show only on desktop */
  @media (min-width: 768px) {
    .section-index-sidebar {
      display: flex;
      flex-direction: column;
    }
  }

  .sidebar-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--spacing-xs, 4px);
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    border: none;
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-height: 28px;
  }

  .sidebar-item:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
  }

  .sidebar-item.active {
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-weight: 600;
  }

  .sidebar-label {
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/sequences/navigation/components/SectionIndexSidebar.svelte
git commit -m "feat: add SectionIndexSidebar for sort-dependent gallery navigation"
```

---

## Task 4: Wire Sidebar into SequenceDisplayPanel Layout

**Files:**
- Modify: `src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte`

- [ ] **Step 1: Read SequenceDisplayPanel.svelte fully**

Understand the current layout structure, especially the `.display-content` div and how `BrowseGrid` is rendered.

- [ ] **Step 2: Add imports**

```typescript
import SectionIndexSidebar from "../../navigation/components/SectionIndexSidebar.svelte";
import type { BrowseSortMethod } from "../../../shared/domain/enums/browse-enums";
```

- [ ] **Step 3: Add new props for section data and sort method**

Add to the props destructuring:
```typescript
sortMethod = "alphabetical" as BrowseSortMethod,
```

Add to the Props type:
```typescript
sortMethod?: BrowseSortMethod;
```

- [ ] **Step 4: Add a ref to VirtualizedSequenceGrid (via BrowseGrid)**

The sidebar needs to call `scrollToSequenceIndex` on the virtualized grid. Since `BrowseGrid` wraps `VirtualizedSequenceGrid`, we need to pass the scroll function through.

Add a state variable for the scroll callback:
```typescript
let scrollToSequenceIndex: ((index: number) => void) | null = $state(null);
```

Pass it to BrowseGrid as a bindable callback or have BrowseGrid expose it.

- [ ] **Step 5: Add active section tracking**

Add state for tracking which section is currently visible:
```typescript
let activeSection = $state<string | undefined>(undefined);
```

Wire scroll events to update the active section based on the first visible sequence index.

- [ ] **Step 6: Modify the template to include the sidebar**

Change the `.display-content` area to include the sidebar:

```svelte
<div class="display-content-wrapper">
  <div class="display-content" bind:this={displayContentEl} onscroll={handleScroll}>
    <!-- existing grid content -->
  </div>

  {#if hasSequences && sections.length > 0}
    <SectionIndexSidebar
      {sections}
      {sortMethod}
      onScrollToSection={(index) => scrollToSequenceIndex?.(index)}
      {activeSection}
    />
  {/if}
</div>
```

- [ ] **Step 7: Add CSS for the wrapper layout**

```css
.display-content-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.display-content {
  flex: 1;
  min-width: 0;
  /* existing styles preserved */
}
```

- [ ] **Step 8: Wire sections and sortMethod from GalleryTab through to SequenceDisplayPanel**

Read `GalleryTab.svelte` to see how it renders `SequenceDisplayPanel`. Add the `sections` and `sortMethod` props being passed through. The `galleryState` object already has `sequenceSections` and `currentSortMethod` available.

- [ ] **Step 9: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 10: Run build**

Run: `npm run build 2>&1 | tail -15`

- [ ] **Step 11: Commit**

```bash
git add src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte src/lib/features/browse/shared/components/GalleryTab.svelte
git commit -m "feat: wire SectionIndexSidebar into gallery layout"
```

---

## Task 5: Full Verification

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit --pretty`

- [ ] **Step 2: Run tests**

Run: `npx vitest run`

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -15`

- [ ] **Step 4: Manual verification checklist**

1. Open gallery with 400+ community sequences — should load instantly (virtualized)
2. Switch to Creators tab and back — should be instant (no 400 card remount)
3. Sidebar visible on desktop with section markers matching current sort
4. Click a sidebar marker — grid scrolls to that section
5. Change sort method — sidebar updates with new labels
6. Apply filters — sidebar updates to show only sections with results
7. Mobile — sidebar hidden, no behavior change

- [ ] **Step 5: Commit any fixes**
