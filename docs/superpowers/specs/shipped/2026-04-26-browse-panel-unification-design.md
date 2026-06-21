# Browse Panel Unification — Design Spec

**Date:** 2026-04-26
**Status:** Draft
**Scope:** Unify all sequence-browsing surfaces behind a single headless engine + composed panel component.

---

## Problem

Three independent implementations let users browse/pick sequences:

| Surface | Location | Grid | State | Filters |
|---------|----------|------|-------|---------|
| Browse Gallery | `SequenceDisplayPanel` | BrowseGrid + sections + sidebar | `createBrowseState()` (837-line factory) | Full (7+ types, multi-filter AND, legacy single-filter bridge) |
| Sequence Picker Modal | `SequencePickerModal` (11 consumers) | BrowseGrid (flat) | Inline `$derived.by` pipeline | Level, favorites, length, search |
| Card Designer Picker | `SequencePickerGrid` | Own flex grid | Own state | Beat count chips only |

Additional state fragmentation:
- `sequenceSourceManager` singleton (source toggle) is unsynchronized with `createBrowseState.currentSource`
- `gridZoomManager` singleton (column zoom) is separate from both
- `createBrowseState()` maintains a legacy single-filter (`currentFilter`) bridged to a multi-filter Map (`activeFilters`) for backwards compat — two systems doing one job

Result: filter improvements don't propagate, zoom logic is tripled, bugs fixed in one surface recur in others.

---

## Architecture

Three layers. Each layer depends only on the one below it.

```
Layer 1 — createBrowseEngine(config)     Headless state machine. Zero DOM.
Layer 2 — <BrowsePanel>                  Batteries-included composed UI.
Layer 3 — <BrowseProvider> + pieces      Composable escape hatch (future).
```

### Layer 1: `createBrowseEngine(config)`

Pure TypeScript + Svelte 5 runes. No components, no DOM, no CSS. Fully unit-testable.

Absorbs: `createBrowseState()`, `sequenceSourceManager`, `gridZoomManager`, the picker's inline pipeline, and `SequencePickerGrid`'s beat-count logic.

Calls internally: `IBrowseLoader`, `IBrowseFilter`, `MultiFilter`, `IBrowseSorter`, `BrowseSectionManager` — all existing singletons, unchanged.

#### Config

```typescript
interface BrowseEngineConfig {
  /** Which sources are available. Default: ['community', 'my-library'] */
  sources?: SequenceSource[];

  /** Initial source. Default: 'community' */
  defaultSource?: SequenceSource;

  /** Locked filters the user cannot remove. */
  constraints?: {
    beatCount?: number;
    source?: SequenceSource;
    gridMode?: string;
  };

  /** Enable section grouping. Default: false */
  sections?: boolean;

  /** Default section grouping strategy. Default: 'letter' */
  defaultSectionGroupBy?: SectionGroupBy;

  /** localStorage key for persisting filter/sort/source state.
   *  null = ephemeral (modals). Default: null */
  persistKey?: string | null;

  /** Column count range. Defaults: min=2, max=8 */
  minColumns?: number;
  maxColumns?: number;

  /** Default sort. Default: BrowseSortMethod.ALPHABETICAL */
  defaultSort?: BrowseSortMethod;
}
```

#### Reactive State

```typescript
interface BrowseEngine {
  // --- Data ---
  readonly sequences: SequenceData[];          // filtered + sorted
  readonly sections: SequenceSection[];        // grouped (if sections enabled)
  readonly allSequences: SequenceData[];       // unfiltered (for count display)
  readonly resultCount: number;
  readonly isLoading: boolean;
  readonly error: string | null;

  // --- Source ---
  readonly source: SequenceSource;
  readonly canSwitchSource: boolean;           // auth guard

  // --- Filters ---
  readonly filters: ReadonlyMap<string, ActiveFilter>;         // user filters
  readonly constraintFilters: ReadonlyMap<string, ActiveFilter>; // locked
  readonly allFilterChips: ActiveFilter[];     // constraints + user, for chip bar
  readonly hasActiveFilters: boolean;

  // --- Sort ---
  readonly sortMethod: BrowseSortMethod;
  readonly sortDirection: 'asc' | 'desc';

  // --- Search ---
  readonly searchQuery: string;

  // --- Grid ---
  readonly columnCount: number;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly isTransitioning: boolean;           // 200ms after column change

  // --- Sections ---
  readonly sectionsEnabled: boolean;
  readonly sectionGroupBy: SectionGroupBy;

  // --- Derived filter metadata ---
  readonly availableLengths: number[];
  readonly loopTypeCounts: Record<string, number>;

  // --- Actions ---
  setSource(source: SequenceSource): Promise<void>;
  addFilter(type: BrowseFilterType, value: BrowseFilterValue, label: string, chipColor?: string): void;
  removeFilter(type: BrowseFilterType | string): void;
  clearUserFilters(): void;

  setSort(method: BrowseSortMethod, direction?: 'asc' | 'desc'): void;
  setSearch(query: string): void;

  zoomIn(): void;
  zoomOut(): void;
  setColumns(count: number): void;
  updateContainerWidth(width: number): void;

  setSectionsEnabled(enabled: boolean): void;
  setSectionGroupBy(groupBy: SectionGroupBy): void;

  toggleFavorite(sequenceId: string): Promise<void>;
  getFilteredCount(type: BrowseFilterType, value: BrowseFilterValue): number;

  invalidateLibraryCache(): void;
  initialize(): Promise<void>;
  refresh(): Promise<void>;
  destroy(): void;
}
```

#### Internal Pipeline

All derived reactively — no imperative `applyFilterAndSort()` calls:

```
allSequences (from IBrowseLoader)
  │
  ├─ $derived: apply constraintFilters (locked)
  ├─ $derived: apply userFilters (AND logic via MultiFilter)
  ├─ $derived: apply search (CONTAINS_LETTERS)
  ├─ $derived: sort (via IBrowseSorter)
  │
  ├─ = sequences (flat result)
  └─ $derived: generate sections (via BrowseSectionManager, if enabled)
      = sections
```

#### Mutation Watchers

Engine subscribes to library events on `initialize()`, cleans up on `destroy()`:

- `onLibraryMutated(sequenceId)` — removes from allSequences + library cache. Pipeline re-derives automatically.
- `onLibrarySequenceAdded(sequence)` — adds to allSequences if viewing library, invalidates cache if on community.

#### Persistence

When `persistKey` is set, engine saves to localStorage on filter/sort/source changes:

```typescript
interface PersistedEngineState {
  source: SequenceSource;
  sortMethod: BrowseSortMethod;
  filters: [string, ActiveFilter][];  // serialized Map
  sectionGroupBy: SectionGroupBy;
  columnCount: number;
}
```

Loaded on construction. No legacy `currentFilter` field — clean break.

#### Auth Guard

`setSource('my-library')` checks `authState.isAuthenticated`. If not authenticated, silently stays on current source.

#### Column State

Engine owns column count. Per-breakpoint max columns derived from container width:

```typescript
function getMaxColumnsForWidth(width: number): number {
  if (width < 480) return 2;
  if (width < 800) return 3;
  if (width < 1200) return 4;
  return 5;
}
```

Config `maxColumns` overrides the breakpoint max (clamped to the breakpoint max if lower). HMR preservation via `import.meta.hot.data`.

Settings sync: column count persists to `settingsService.gridZoomLevel` (same as current `gridZoomManager`).

---

### Layer 2: `<BrowsePanel>`

Single Svelte component. Receives an engine instance. Renders the complete browsing UI.

#### Props

```typescript
interface BrowsePanelProps {
  engine: BrowseEngine;
  layout: 'fullpage' | 'compact' | 'minimal';
  onSelect?: (sequence: SequenceData, variations?: SequenceData[]) => void;

  // Layout overrides (each has sensible defaults per mode)
  showSidebar?: boolean;
  showToolbar?: boolean;
  showFilterBar?: boolean;
  showSourceToggle?: boolean;

  // Rendering hints
  eager?: boolean;           // skip lazy thumbnails (modals)
  title?: string;            // optional header
}
```

#### Layout Modes

**fullpage** — Gallery page. Full chrome.

```
┌─────────────────────────────────────────────┐
│ [Source Toggle]  [Toolbar: sort|search|count]│
│ [Filter Bar: chips + add filter]            │
├──────────┬──────────────────────────────────┤
│ Sidebar  │  Sectioned Grid                  │
│ A (12)   │  ┌───┬───┬───┬───┐              │
│ B (8)    │  │   │   │   │   │              │
│ C (5)    │  ├───┼───┼───┼───┤              │
│ ...      │  │   │   │   │   │              │
│          │  └───┴───┴───┴───┘              │
└──────────┴──────────────────────────────────┘
```

Defaults: sidebar on (when >1 section), sections on, source toggle on, toolbar on, filter bar on. Virtualizes at 50+ items. Pinch-to-zoom via PinchZoomGridController (touch). Scroll position saved/restored for overlay returns.

**compact** — Modal / embedded picker.

```
┌─────────────────────────────────┐
│ [Toolbar: sort | search | count]│
│ [Filter Bar: chips]             │
├─────────────────────────────────┤
│  Flat Grid (Ctrl+scroll zoom)   │
│  ┌───┬───┬───┬───┬───┐        │
│  │   │   │   │   │   │        │
│  └───┴───┴───┴───┴───┘        │
└─────────────────────────────────┘
```

Defaults: sidebar off, sections off, toolbar on, filter bar on, eager thumbnails, Ctrl+scroll zoom. No persistence. Source toggle (if enabled) renders in the toolbar row.

**minimal** — Inline embed. Grid + optional constraint chip.

```
┌─────────────────────────────────┐
│  ┌───┬───┬───┬───┐            │
│  │   │   │   │   │            │
│  └───┴───┴───┴───┘            │
└─────────────────────────────────┘
```

Defaults: everything off except grid. Eager thumbnails. Replaces SequencePickerGrid.

#### Internal Responsibilities

BrowsePanel handles (not the engine's job):
- ResizeObserver → `engine.updateContainerWidth()`
- Ctrl+scroll / pinch → `engine.zoomIn()` / `engine.zoomOut()` / `engine.setColumns()`
- Scroll position save/restore (for overlay returns)
- Active section tracking via IntersectionObserver (fullpage mode)
- Empty/loading/error state rendering
- Skeleton loading overlay during initial load
- Selection callback — fires `onSelect(sequence)` with metadata. Full data fetch (if needed) is the consumer's responsibility. SequencePickerModal fetches full data + shows loading overlay before calling its own `onSelect`. Gallery passes metadata to the viewer, which loads full data itself.

#### Sub-components (internal to BrowsePanel)

These are private implementation details of BrowsePanel, not public API:

- **BrowseToolbar** — Sort dropdown (reuses existing sort options), ExpandableSearchBar (reuses existing), result count. Replaces both `SequenceTopBarControls` (gallery) and `PickerToolbar` (picker).
- **BrowseFilterBar** — Filter chip row + active filter bar. Level, favorites, length, loop type, grid mode, letter, position chips. Locked constraint chips show without dismiss button. Replaces `InlineFilterPanel` + `ActiveFilterBar` combo and the picker's inline FilterChipRow.
- **BrowseSidebar** — Section index. Scroll-to-section on click. Active section highlight. Wraps existing `SectionIndexSidebar`.
- **BrowseGrid** — Refactored from existing `BrowseGrid.svelte`. Receives sequences/sections + column count from engine. Renders `ChoreoCardThumbnail` (unchanged). Virtualizes when >50 items and `disableVirtualization` is not set.

---

### Layer 3: `<BrowseProvider>` + Composable Pieces (Future)

Not built in this implementation. The architecture supports it:

```svelte
<BrowseProvider engine={engine}>
  <!-- children call getBrowseEngine() from Svelte context -->
  <MyCustomToolbar />
  <BrowseGrid />
</BrowseProvider>
```

BrowsePanel could eventually be rewritten as a consumer of BrowseProvider + composable pieces. For now, BrowsePanel is the only public UI component.

---

## Consumer Migration

### Gallery Page

**Before** (BrowseModule.svelte → GalleryTab.svelte → SequenceDisplayPanel.svelte):
- `createBrowseState()` in BrowseModule
- GalleryTab bridges state to SequenceDisplayPanel via 20+ props
- SequenceDisplayPanel renders controls + grid + sidebar
- GalleryTab manages letter/options drawers, floating search, variation picker

**After** (BrowseModule.svelte → GalleryTab.svelte):
```svelte
<!-- BrowseModule.svelte -->
<script>
  const engine = createBrowseEngine({
    sections: true,
    defaultSectionGroupBy: 'letter',
    persistKey: 'tka-browse-gallery',
    sources: ['community', 'my-library'],
  });
  engine.initialize();
</script>

<!-- GalleryTab.svelte -->
<BrowsePanel
  {engine}
  layout="fullpage"
  onSelect={handleOpenViewer}
  showSourceToggle
/>
```

GalleryTab retains: letter selection drawer, position options drawer, variation picker drawer, floating search FAB + VirtualKeyboard, detail panel integration via `sequencePanelManager`. These are gallery-page-specific presentation concerns that live outside BrowsePanel.

### Sequence Picker Modal (11 consumers)

**Before:** 684-line SequencePickerModal with inline filter pipeline.

**After:**
```svelte
<!-- SequencePickerModal.svelte (~60 lines) -->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (sequence: SequenceData) => void;
    requiredBeatCount?: number | null;
    title?: string;
    showSourceToggle?: boolean;
  }

  let {
    open = $bindable(false),
    onClose,
    onSelect,
    requiredBeatCount = null,
    title = "Select Sequence",
    showSourceToggle = true,
  }: Props = $props();

  const engine = createBrowseEngine({
    constraints: requiredBeatCount != null ? { beatCount: requiredBeatCount } : undefined,
  });

  $effect(() => {
    if (open) engine.initialize();
  });

  function handleSelect(sequence: SequenceData) {
    onSelect(sequence);
    onClose();
  }
</script>

<BaseModal bind:open onclose={onClose} size="xl" class="sequence-picker-modal" labelledBy="sequence-picker-title">
  {#snippet header()}
    <div class="picker-header">
      <h2 id="sequence-picker-title">{title}</h2>
      <button class="close-btn" onclick={onClose} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <BrowsePanel
    {engine}
    layout="compact"
    onSelect={handleSelect}
    showSourceToggle={showSourceToggle}
    eager
  />
</BaseModal>
```

**11 consumers change nothing.** Same `<SequencePickerModal>` API. Source toggle moves into BrowsePanel (if `showSourceToggle` is true).

Note: `requiredBeatCount` is static for the life of a picker instance — it's set when the modal opens and doesn't change mid-session. The engine is created once with the constraint baked in. If `requiredBeatCount` were to become dynamic in the future, engine would need a `setConstraints()` method or be recreated.

### Card Designer Picker (SequencePickerGrid)

**Before:** Own flex grid, own zoom, own beat-count filter.

**After:** Replaced by `<BrowsePanel layout="minimal">` with a beat-count constraint.

```svelte
<script>
  const engine = createBrowseEngine({
    constraints: { beatCount: selectedLength },
  });
  engine.initialize();
</script>

<BrowsePanel {engine} layout="minimal" onSelect={handlePick} eager />
```

---

## File Plan

### New Files

| File | Purpose |
|------|---------|
| `src/lib/shared/browse/engine/createBrowseEngine.ts` | Headless state machine (~400 lines) |
| `src/lib/shared/browse/engine/types.ts` | Config, state, filter interfaces |
| `src/lib/shared/browse/components/BrowsePanel.svelte` | Composed UI (~300 lines) |
| `src/lib/shared/browse/components/BrowseToolbar.svelte` | Sort + search + count |
| `src/lib/shared/browse/components/BrowseFilterBar.svelte` | Filter chips + active bar |
| `src/lib/shared/browse/components/BrowseSidebar.svelte` | Section index wrapper |
| `src/lib/shared/browse/components/BrowseGrid.svelte` | Grid renderer (refactored from existing) |

### Deleted Files

| File | Reason |
|------|--------|
| `src/lib/features/browse/shared/state/browse-state-factory.svelte.ts` | Replaced by createBrowseEngine |
| `src/lib/features/browse/shared/state/sequence-source-state.svelte.ts` | Absorbed into engine |
| `src/lib/features/browse/shared/state/grid-zoom-state.svelte.ts` | Absorbed into engine |
| `src/lib/shared/components/sequence-picker/PickerToolbar.svelte` | Replaced by BrowseToolbar |
| `src/lib/features/choreo-card/components/designer/SequencePickerGrid.svelte` | Replaced by BrowsePanel minimal |
| `src/lib/features/browse/sequences/display/components/SequenceTopBarControls.svelte` | Absorbed into BrowseToolbar |
| `src/lib/features/browse/sequences/filtering/components/inline-filter/InlineFilterPanel.svelte` | Absorbed into BrowseFilterBar |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/features/browse/shared/components/BrowseModule.svelte` | Replace `createBrowseState()` with `createBrowseEngine()` |
| `src/lib/features/browse/shared/components/GalleryTab.svelte` | Use BrowsePanel, remove prop bridging to SequenceDisplayPanel |
| `src/lib/shared/components/sequence-picker/SequencePickerModal.svelte` | Gut and rewrite as thin shell (~60 lines) |
| `src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte` | Delete (replaced by BrowsePanel fullpage) |

### Unchanged Files

| File | Why |
|------|-----|
| `IBrowseLoader` / `PublicSequencesLoader` | Engine calls it internally |
| `IBrowseFilter` / `BrowseFilter` | Engine calls it internally |
| `IBrowseSorter` / `BrowseSorter` | Engine calls it internally |
| `MultiFilter` | Engine calls it internally |
| `BrowseSectionManager` | Engine calls it internally |
| `ChoreoCardThumbnail` | Grid renders it, unchanged |
| `VirtualizedSequenceGrid` | BrowseGrid delegates to it, unchanged |
| `SectionIndexSidebar` | BrowseSidebar wraps it, unchanged |
| `PinchZoomGridController` | BrowsePanel attaches it, feeds engine |
| `sequencePanelManager` | Gallery-only, stays in GalleryTab |
| `browseNavigationState` | Module-level nav, stays in BrowseModule |
| `browseScrollState` | BrowsePanel uses for scroll restore |
| All 11 SequencePickerModal consumers | API unchanged |
| Filter chip components (LevelFilterChip, FavoritesFilterChip, etc.) | BrowseFilterBar composes them |

---

## Constraints System

Constraints are locked filters. Same data structure, `locked: true` flag.

```typescript
interface ActiveFilter {
  type: BrowseFilterType;
  value: BrowseFilterValue;
  label: string;
  chipColor?: string;
  locked: boolean;        // true = constraint, user cannot remove
}
```

Engine converts config constraints to locked filters on construction:

```typescript
// config.constraints = { beatCount: 8 }
// becomes:
constraintFilters.set('LENGTH', {
  type: BrowseFilterType.LENGTH,
  value: 8,
  label: '8 beats (locked)',
  locked: true,
});
```

Filter pipeline applies constraints first, then user filters. `clearUserFilters()` only clears user filters.

BrowseFilterBar renders locked chips with: no dismiss button, subtle lock icon, muted color treatment.

---

## Filter System (Unified)

One filter system. No legacy `currentFilter`. No inline `$derived.by` pipeline.

All filters go through the same path:

```typescript
engine.addFilter(BrowseFilterType.DIFFICULTY, 'beginner', 'Beginner', '#22c55e');
engine.addFilter(BrowseFilterType.LENGTH, '8', '8 beats', '#f59e0b');
engine.addFilter(BrowseFilterType.FAVORITES, 'true', 'Favorites', '#ec4899');
engine.addFilter(BrowseFilterType.CONTAINS_LETTERS, 'sigma', '"sigma"');
```

Removal:

```typescript
engine.removeFilter(BrowseFilterType.DIFFICULTY);
engine.clearUserFilters(); // clears all except locked constraints
```

Available filter types (all already supported by IBrowseFilter):
- `STARTING_LETTER` — first letter of sequence word
- `CONTAINS_LETTERS` — search/substring match
- `LENGTH` — beat count
- `DIFFICULTY` — level (beginner/intermediate/advanced, or 1-7)
- `STARTING_POSITION` — start position (alpha/beta/gamma)
- `END_POSITION` — end position
- `GRID_MODE` — diamond/box
- `AUTHOR` — creator
- `FAVORITES` — user's favorites
- `RECENT` — recently viewed/added
- `LOOP_TYPE` — cap type / loop classification

---

## Edge Cases Ported From createBrowseState

| Edge Case | How Engine Handles It |
|-----------|----------------------|
| Library cache (no re-fetch on source switch back) | `libraryCache` field, same pattern. Invalidated by `onLibraryMutated`. |
| Mutation watcher — sequence deleted | `onLibraryMutated` subscription removes from `allSequences` + cache. Pipeline re-derives. |
| Mutation watcher — sequence added | `onLibrarySequenceAdded` subscription adds to `allSequences` if viewing library; invalidates cache if on community. |
| Auth guard on My Library | `setSource('my-library')` checks `authState.isAuthenticated`. No-ops if unauthenticated. |
| Impersonation cache invalidation | `invalidateLibraryCache()` method. BrowseModule calls it when `userPreviewState.activeUserId` changes. |
| Favorites toggle local update | `toggleFavorite(id)` updates across allSequences. Pipeline re-derives filtered/sections automatically (no manual 4-array update). |
| Deduplication | `deduplicateById()` applied on load, same as current. |
| Sort direction (asc/desc) | Engine supports `sortDirection` in addition to `sortMethod`. Persisted. |
| HMR state preservation | Column count saved to `import.meta.hot.data` on dispose. |
| Contextual filter counts | `getFilteredCount(type, value)` calls `MultiFilter.getFilteredCount()` against current active filters. |
| sectionsReady flag | Replaced by derived: `readonly sectionsReady = !isLoading && sections.length > 0`. |

---

## What BrowsePanel Does NOT Own

These stay with their current owners:

| Concern | Owner | Why |
|---------|-------|-----|
| Detail panel (sequence viewer drawer) | `sequencePanelManager` + GalleryTab | Gallery-specific right-side drawer system |
| Letter selection drawer | GalleryTab | Full-screen sheet with pictograph grid, gallery-only |
| Position options drawer | GalleryTab | Pictograph position picker, gallery-only |
| Floating search FAB + VirtualKeyboard | GalleryTab | Gallery-specific mobile search UX |
| Variation picker drawer | GalleryTab | Gallery-specific multi-variation selection |
| Tab switching (gallery/collections/creators) | BrowseModule | Module-level navigation |
| Browse navigation history | `browseNavigationState` | Module-level back/forward |
| Creator profile URL sync | `browseNavigationState` | /browse/creators/[userId] routing |
| Collaborative video invites | GalleryTab | Gallery-specific social feature |
| View presets sheet (mobile) | GalleryTab | Gallery-specific mobile filter shortcuts |
| Sort & jump sheet (mobile) | GalleryTab | Gallery-specific mobile navigation |

---

## Implementation Phases

### Phase 1: Engine + Types
- Create `src/lib/shared/browse/engine/types.ts`
- Create `src/lib/shared/browse/engine/createBrowseEngine.ts`
- Unit tests for engine (filter pipeline, constraints, source switching, persistence)

### Phase 2: BrowsePanel + Sub-components
- Create BrowseToolbar (port from SequenceTopBarControls + PickerToolbar)
- Create BrowseFilterBar (port from InlineFilterPanel + ActiveFilterBar + picker's FilterChipRow)
- Create BrowseSidebar (thin wrapper around SectionIndexSidebar)
- Create BrowseGrid (refactor from existing, remove column logic — engine owns it)
- Create BrowsePanel (compose sub-components, wire to engine)

### Phase 3: Gallery Migration
- Rewrite GalleryTab to use BrowsePanel + engine
- Delete SequenceDisplayPanel
- Delete createBrowseState
- Delete sequenceSourceManager
- Delete gridZoomManager
- Verify: gallery browsing, filtering, sorting, sections, sidebar, scroll restore, favorites, source toggle, skeleton loading

### Phase 4: Picker Migration
- Rewrite SequencePickerModal as thin shell
- Delete PickerToolbar
- Verify: all 11 consumers still work, requiredBeatCount constraint, source toggle, filter chips

### Phase 5: Card Designer Migration
- Replace SequencePickerGrid with BrowsePanel minimal
- Delete SequencePickerGrid
- Verify: card designer picker works with beat count constraint

### Phase 6: Cleanup
- Delete dead imports across codebase
- Delete InlineFilterPanel, SequenceTopBarControls
- Remove legacy filter types/interfaces no longer referenced
- Final typecheck + build verification

---

## Success Criteria

1. **One engine, one filter system.** No duplicate filter pipelines anywhere in codebase.
2. **11 picker consumers unchanged.** Same `<SequencePickerModal>` API, zero migration.
3. **Gallery feature parity.** Sections, sidebar, scroll restore, favorites, source toggle, skeleton loading — all working.
4. **Filter improvements propagate everywhere.** Adding a new filter type to the engine makes it available in gallery, picker, and card designer simultaneously.
5. **Net code reduction.** ~9 files deleted, ~7 files created. Total line count should decrease.
6. **Build green.** `npm run check` passes with 0 errors.
