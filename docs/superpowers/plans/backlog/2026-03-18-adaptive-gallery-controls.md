# Adaptive Gallery Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface all browse gallery filter chips inline in the top bar on wide screens (>900px), eliminating the hidden filter toggle.

**Architecture:** Container-query-driven responsive layout. Filter chips render in two DOM locations (top bar for wide, collapsible panel for narrow) with CSS `display` toggling. ActiveFilterBar moves to always render below the top bar, independent of the collapsible panel.

**Tech Stack:** Svelte 5, CSS container queries, existing filter chip components unchanged.

**Spec:** `docs/superpowers/specs/2026-03-18-adaptive-gallery-controls-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte` | Modify | Add container name, pass filter props to top bar, render ActiveFilterBar outside InlineFilterPanel, hide InlineFilterPanel on wide screens |
| `src/lib/features/browse/shared/components/SequenceTopBarControls.svelte` | Modify | Accept filter props, render inline filter chips section, hide filter toggle on wide, add vertical dividers |
| `src/lib/features/browse/sequences/filtering/components/inline-filter/InlineFilterPanel.svelte` | Modify | Remove ActiveFilterBar (moved to parent), add narrow-only CSS class |

---

### Task 1: Add container name to SequenceDisplayPanel

**Files:**
- Modify: `src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte:253-259`

The panel already has `container-type: inline-size` on `.display-content`, but we need it on the outer `.sequence-display-panel` so child components (top bar, filter panel) can query it.

- [ ] **Step 1: Add container name to the outer panel**

In `.sequence-display-panel` CSS, add:

```css
.sequence-display-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  container-type: inline-size;
  container-name: gallery;
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: No errors. This is additive CSS, nothing breaks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte
git commit -m "feat(browse): add container query name to gallery panel"
```

---

### Task 2: Move ActiveFilterBar out of InlineFilterPanel

**Files:**
- Modify: `src/lib/features/browse/sequences/filtering/components/inline-filter/InlineFilterPanel.svelte`
- Modify: `src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte`

ActiveFilterBar currently renders inside the collapsible panel, which means it's hidden when the panel is closed. Move it to render independently below the top bar, visible whenever filters are active regardless of screen size.

- [ ] **Step 1: Remove ActiveFilterBar from InlineFilterPanel**

In `InlineFilterPanel.svelte`:
- Remove the `ActiveFilterBar` import
- Remove the `<ActiveFilterBar>` render (lines ~145-149)
- Remove the `onRemoveFilter` and `onClearAllFilters` props (they only exist for ActiveFilterBar)
- Remove the `activeFilterList` prop

- [ ] **Step 2: Add ActiveFilterBar render to SequenceDisplayPanel**

In `SequenceDisplayPanel.svelte`, between the InlineFilterPanel and the `.display-content` div, add:

```svelte
<!-- Active filter bar — always visible when filters are applied -->
{#if activeFilterList.length > 0 && onRemoveFilter && onClearAllFilters}
  <div class="active-filter-container">
    <ActiveFilterBar
      filters={activeFilterList}
      onRemoveFilter={onRemoveFilter}
      onClearAll={onClearAllFilters}
    />
  </div>
{/if}
```

Add the import for `ActiveFilterBar`:
```typescript
import ActiveFilterBar from "../../filtering/components/inline-filter/ActiveFilterBar.svelte";
```

Add CSS:
```css
.active-filter-container {
  flex-shrink: 0;
  padding: 4px 16px;
  border-bottom: 1px solid var(--theme-stroke);
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/sequences/filtering/components/inline-filter/InlineFilterPanel.svelte src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte
git commit -m "refactor(browse): move ActiveFilterBar out of collapsible panel"
```

---

### Task 3: Add inline filter chips to SequenceTopBarControls

**Files:**
- Modify: `src/lib/features/browse/shared/components/SequenceTopBarControls.svelte`

This is the main task. The top bar gains a new section between the sort popover and the right actions that renders all 7 filter chips. This section is only visible on wide screens via container query.

- [ ] **Step 1: Add filter-related props**

Add these props to the `Props` interface and destructure:

```typescript
interface Props {
  onSourceChange?: (source: SequenceSource) => void;
  // Filter props for inline display on wide screens
  activeLevel?: number | null;
  activeLetter?: string | null;
  activeLength?: number | null;
  activeLoopType?: string | null;
  activeGridMode?: string | null;
  isFavoritesActive?: boolean;
  hasActivePositions?: boolean;
  availableLengths?: number[];
  loopTypeCounts?: Record<string, number>;
  onFilterChange?: (type: SequenceFilterType, value?: BrowseFilterValue) => void;
  onRemoveFilter?: (type: string) => void;
  onOpenLetterSheet?: () => void;
  onOpenOptionsSheet?: () => void;
  getFilteredCount?: (candidateType: BrowseFilterType, candidateValue: BrowseFilterValue) => number;
}
```

Import the types:
```typescript
import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
import type { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
import type { SequenceFilterType } from "../state/sequence-controls-state.svelte";
```

- [ ] **Step 2: Add filter handler functions**

Copy the same handler pattern from InlineFilterPanel (level select, favorites toggle, length select, pattern select, grid mode select):

```typescript
function handleInlineLevelSelect(level: number | null) {
  if (level === null) onRemoveFilter?.("difficulty");
  else onFilterChange?.("difficulty", level);
}

function handleInlineFavoritesToggle(active: boolean) {
  if (active) onFilterChange?.("favorites");
  else onRemoveFilter?.("favorites");
}

function handleInlineLengthSelect(length: number | null) {
  if (length === null) onRemoveFilter?.("length");
  else onFilterChange?.("length", length);
}

function handleInlinePatternSelect(value: string | null) {
  if (value === null) onRemoveFilter?.("cap_type");
  else onFilterChange?.("cap_type", value);
}

function handleInlineGridModeSelect(gridMode: string | null) {
  if (gridMode === null) onRemoveFilter?.("gridMode");
  else onFilterChange?.("gridMode", gridMode);
}
```

- [ ] **Step 3: Add inline filter chip imports**

```typescript
import LevelFilterChip from "../../sequences/filtering/components/inline-filter/chips/LevelFilterChip.svelte";
import FavoritesFilterChip from "../../sequences/filtering/components/inline-filter/chips/FavoritesFilterChip.svelte";
import LetterFilterChip from "../../sequences/filtering/components/inline-filter/chips/LetterFilterChip.svelte";
import LengthFilterChip from "../../sequences/filtering/components/inline-filter/chips/LengthFilterChip.svelte";
import PatternFilterChip from "../../sequences/filtering/components/inline-filter/chips/PatternFilterChip.svelte";
import GridModeFilterChip from "../../sequences/filtering/components/inline-filter/chips/GridModeFilterChip.svelte";
import PositionFilterChip from "../../sequences/filtering/components/inline-filter/chips/PositionFilterChip.svelte";
```

- [ ] **Step 4: Add inline filters section to the template**

Between `<SortPopover>` and `.actions-section`, add:

```svelte
<!-- Inline filter chips (wide screens only, hidden on narrow via container query) -->
{#if onFilterChange}
  <div class="inline-divider" aria-hidden="true"></div>
  <div class="inline-filters">
    <LevelFilterChip
      activeLevel={activeLevel ?? null}
      onSelect={handleInlineLevelSelect}
      {getFilteredCount}
    />
    <FavoritesFilterChip
      active={isFavoritesActive ?? false}
      onToggle={handleInlineFavoritesToggle}
    />
    <LetterFilterChip
      activeLetter={activeLetter ?? null}
      onOpenSheet={onOpenLetterSheet ?? (() => {})}
    />
    <LengthFilterChip
      activeLength={activeLength ?? null}
      availableLengths={availableLengths ?? []}
      onSelect={handleInlineLengthSelect}
      {getFilteredCount}
    />
    <PatternFilterChip
      activeValue={activeLoopType ?? null}
      loopTypeCounts={loopTypeCounts ?? {}}
      onSelect={handleInlinePatternSelect}
    />
    <GridModeFilterChip
      activeGridMode={activeGridMode ?? null}
      onSelect={handleInlineGridModeSelect}
      {getFilteredCount}
    />
    <PositionFilterChip
      hasActivePositions={hasActivePositions ?? false}
      onOpenSheet={onOpenOptionsSheet ?? (() => {})}
    />
  </div>
  <div class="inline-divider" aria-hidden="true"></div>
{/if}
```

- [ ] **Step 5: Add CSS for inline filters and dividers**

```css
/* Inline filter chips — visible on wide screens only */
.inline-filters {
  display: none; /* Hidden by default, shown via container query */
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  min-width: 0;
  flex: 1;
}

.inline-filters::-webkit-scrollbar {
  display: none;
}

/* Vertical divider between logical groups */
.inline-divider {
  display: none; /* Hidden by default, shown via container query */
  width: 1px;
  height: 24px;
  background: var(--theme-stroke);
  flex-shrink: 0;
}

/* Wide screen: show inline filters, hide filter toggle */
@container gallery (min-width: 900px) {
  .inline-filters {
    display: flex;
  }

  .inline-divider {
    display: block;
  }

  .filter-button {
    display: none;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .inline-filters {
    scroll-behavior: auto;
  }
}
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/browse/shared/components/SequenceTopBarControls.svelte
git commit -m "feat(browse): add inline filter chips to top bar for wide screens"
```

---

### Task 4: Pass filter props from SequenceDisplayPanel to SequenceTopBarControls

**Files:**
- Modify: `src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte:188-193`

Currently the top bar is rendered with no filter props. Pass them through.

- [ ] **Step 1: Update SequenceTopBarControls render**

Replace:
```svelte
<SequenceTopBarControls />
```

With:
```svelte
<SequenceTopBarControls
  {activeLevel}
  {activeLetter}
  {activeLength}
  activeLoopType={activeLoopType}
  {activeGridMode}
  {isFavoritesActive}
  {hasActivePositions}
  {availableLengths}
  {loopTypeCounts}
  {onFilterChange}
  {onRemoveFilter}
  {onOpenLetterSheet}
  {onOpenOptionsSheet}
  {getFilteredCount}
/>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte
git commit -m "feat(browse): wire filter props to top bar controls"
```

---

### Task 5: Hide InlineFilterPanel on wide screens

**Files:**
- Modify: `src/lib/features/browse/sequences/filtering/components/inline-filter/InlineFilterPanel.svelte`

On wide screens, the collapsible filter panel is redundant — chips are in the top bar. Hide it via container query.

- [ ] **Step 1: Add wide-screen hide rule**

Add to the `<style>` block:

```css
/* Wide screen: filters are inline in top bar, hide this panel */
@container gallery (min-width: 900px) {
  .inline-filter-panel {
    display: none !important;
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/sequences/filtering/components/inline-filter/InlineFilterPanel.svelte
git commit -m "feat(browse): hide collapsible filter panel on wide screens"
```

---

### Task 6: Visual verification

No code changes. Verify the implementation works across screen sizes.

- [ ] **Step 1: Check wide screen (4K / 1920px+)**

Open `localhost:5173/browse/gallery` on the user's running dev server.

Verify:
- All 7 filter chips visible inline in the top bar
- Vertical dividers between source/sort | filters | actions
- No filter toggle button visible
- Active filter bar appears below top bar when a filter is applied
- Clicking filter chips works (popovers open, filters apply)

- [ ] **Step 2: Check narrow screen (<900px)**

Resize browser window or use DevTools responsive mode.

Verify:
- Filter toggle button visible
- Inline filter chips hidden
- Collapsible panel works as before
- Active filter bar visible when filters applied

- [ ] **Step 3: Check overflow behavior**

On a ~1000px wide window (just above breakpoint):

Verify:
- Filter chips scroll horizontally if they don't fit
- No layout breaking or overlap

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No new errors.
