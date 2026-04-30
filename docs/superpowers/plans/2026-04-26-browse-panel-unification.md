# Browse Panel Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three independent sequence-browsing implementations with a single headless engine + composed panel component, eliminating all duplicate state/filter/zoom logic.

**Architecture:** `createBrowseEngine(config)` — a headless state machine using Svelte 5 runes — drives all filtering, sorting, source switching, and grid zoom. `<BrowsePanel>` is the only UI component consumers need. Three layout modes (fullpage, compact, minimal) cover gallery, modal picker, and card designer.

**Tech Stack:** SvelteKit, Svelte 5 runes ($state/$derived/$effect), TypeScript, existing singleton services (IBrowseLoader, IBrowseFilter, IMultiFilter, IBrowseSorter, BrowseSectionManager).

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/shared/browse/engine/types.ts` | All interfaces: BrowseEngineConfig, BrowseEngine, SequenceSource, SectionGroupBy, ActiveFilter (with `locked`), PersistedEngineState |
| `src/lib/shared/browse/engine/createBrowseEngine.ts` | Headless state machine. Absorbs createBrowseState + sequenceSourceManager + gridZoomManager. ~400 lines |
| `src/lib/shared/browse/components/BrowsePanel.svelte` | Composed UI. Wires engine to sub-components, handles ResizeObserver, pinch/Ctrl+scroll, scroll restore. ~300 lines |
| `src/lib/shared/browse/components/BrowseToolbar.svelte` | Sort dropdown + ExpandableSearchBar + result count. Replaces SequenceTopBarControls + PickerToolbar |
| `src/lib/shared/browse/components/BrowseFilterBar.svelte` | Filter chip row + active filter bar. Locked constraints show without dismiss. Replaces InlineFilterPanel + ActiveFilterBar + picker's FilterChipRow |
| `src/lib/shared/browse/components/BrowseSidebar.svelte` | Thin wrapper around existing SectionIndexSidebar |
| `src/lib/shared/browse/components/BrowseGrid.svelte` | Grid renderer. Delegates to existing BrowseGrid (renamed import) + VirtualizedSequenceGrid. Column count from engine |

### Files to Delete (after migration)

| File | Replaced By |
|------|------------|
| `src/lib/features/browse/shared/state/browse-state-factory.svelte.ts` | createBrowseEngine |
| `src/lib/features/browse/shared/state/sequence-source-state.svelte.ts` | Engine source management |
| `src/lib/features/browse/shared/state/grid-zoom-state.svelte.ts` | Engine column management |
| `src/lib/shared/components/sequence-picker/PickerToolbar.svelte` | BrowseToolbar |
| `src/lib/features/choreo-card/components/designer/SequencePickerGrid.svelte` | BrowsePanel minimal |
| `src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte` | BrowsePanel fullpage |
| `src/lib/features/browse/sequences/display/components/SequenceTopBarControls.svelte` | BrowseToolbar |
| `src/lib/features/browse/sequences/filtering/components/inline-filter/InlineFilterPanel.svelte` | BrowseFilterBar |

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/features/browse/shared/components/BrowseModule.svelte` | Replace `createBrowseState()` with `createBrowseEngine()` |
| `src/lib/features/browse/shared/components/GalleryTab.svelte` | Use BrowsePanel, remove 20+ prop bridge |
| `src/lib/shared/components/sequence-picker/SequencePickerModal.svelte` | Gut to ~80-line thin shell |
| `src/lib/features/choreo-card/components/CardDesigner.svelte` | Replace SequencePickerGrid import |

---

## Task 1: Engine Types

**Files:**
- Create: `src/lib/shared/browse/engine/types.ts`

- [ ] **Step 1: Write types file**

```typescript
// src/lib/shared/browse/engine/types.ts

import type { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
import type { BrowseSortMethod } from "$lib/features/browse/shared/domain/enums/browse-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceSection } from "$lib/features/browse/shared/domain/models/browse-models";

export type SequenceSource = "community" | "my-library";

export type SectionGroupBy = "letter" | "length" | "difficulty" | "date" | "none";

export type BrowseLayout = "fullpage" | "compact" | "minimal";

export interface ActiveFilter {
  type: BrowseFilterType;
  value: BrowseFilterValue;
  label: string;
  chipColor: string;
  locked: boolean;
}

export interface BrowseEngineConfig {
  sources?: SequenceSource[];
  defaultSource?: SequenceSource;
  constraints?: {
    beatCount?: number;
    source?: SequenceSource;
    gridMode?: string;
  };
  sections?: boolean;
  defaultSectionGroupBy?: SectionGroupBy;
  persistKey?: string | null;
  minColumns?: number;
  maxColumns?: number;
  defaultSort?: BrowseSortMethod;
}

export interface BrowseEngine {
  // Data
  readonly sequences: SequenceData[];
  readonly sections: SequenceSection[];
  readonly allSequences: SequenceData[];
  readonly resultCount: number;
  readonly isLoading: boolean;
  readonly error: string | null;

  // Source
  readonly source: SequenceSource;
  readonly canSwitchSource: boolean;

  // Filters
  readonly filters: ReadonlyMap<string, ActiveFilter>;
  readonly constraintFilters: ReadonlyMap<string, ActiveFilter>;
  readonly allFilterChips: ActiveFilter[];
  readonly hasActiveFilters: boolean;

  // Sort
  readonly sortMethod: BrowseSortMethod;
  readonly sortDirection: "asc" | "desc";

  // Search
  readonly searchQuery: string;

  // Grid
  readonly columnCount: number;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly isTransitioning: boolean;

  // Sections
  readonly sectionsEnabled: boolean;
  readonly sectionGroupBy: SectionGroupBy;

  // Derived filter metadata
  readonly availableLengths: number[];
  readonly loopTypeCounts: Record<string, number>;

  // Actions
  setSource(source: SequenceSource): Promise<void>;
  addFilter(type: BrowseFilterType, value: BrowseFilterValue, label: string, chipColor?: string): void;
  removeFilter(type: BrowseFilterType | string): void;
  clearUserFilters(): void;

  setSort(method: BrowseSortMethod, direction?: "asc" | "desc"): void;
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

export interface PersistedEngineState {
  source: SequenceSource;
  sortMethod: BrowseSortMethod;
  sortDirection: "asc" | "desc";
  filters: [string, ActiveFilter][];
  sectionGroupBy: SectionGroupBy;
  columnCount: number;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | head -30`
Expected: No errors in `types.ts` (it's pure type declarations).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/browse/engine/types.ts
git commit -m "feat(browse): add unified engine type definitions"
```

---

## Task 2: Engine Core — createBrowseEngine

**Files:**
- Create: `src/lib/shared/browse/engine/createBrowseEngine.ts`

This is the largest task. The engine absorbs all logic from `browse-state-factory.svelte.ts` (837 lines), `grid-zoom-state.svelte.ts` (157 lines), and `sequence-source-state.svelte.ts` (149 lines), but restructured as a clean reactive pipeline.

- [ ] **Step 1: Write createBrowseEngine**

```typescript
// src/lib/shared/browse/engine/createBrowseEngine.ts

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceSection, SectionConfig } from "$lib/features/browse/shared/domain/models/browse-models";
import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
import { BrowseSortMethod } from "$lib/features/browse/shared/domain/enums/browse-enums";
import { getBrowseLoader } from "$lib/features/browse/sequences/display/getBrowseLoader";
import { getBrowseFilter } from "$lib/features/browse/sequences/display/getBrowseFilter";
import { getMultiFilter } from "$lib/features/browse/sequences/display/getMultiFilter";
import { getBrowseSorter } from "$lib/features/browse/sequences/display/getBrowseSorter";
import { getBrowseSectionManager } from "$lib/features/browse/sequences/display/getBrowseSectionManager";
import { getFavoritesManager } from "$lib/features/browse/shared/getFavoritesManager";
import { getLibraryRepository } from "$lib/features/library/getLibraryRepository";
import { getCollectionManager } from "$lib/features/library/getCollectionManager";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { onLibraryMutated, onLibrarySequenceAdded } from "$lib/shared/library/library-events";
import type {
  BrowseEngineConfig,
  BrowseEngine,
  ActiveFilter,
  SequenceSource,
  SectionGroupBy,
  PersistedEngineState,
} from "./types";

const MIN_COLUMNS = 2;

function getMaxColumnsForWidth(width: number): number {
  if (width < 480) return 2;
  if (width < 800) return 3;
  if (width < 1200) return 4;
  return 5;
}

function deduplicateById(sequences: SequenceData[]): SequenceData[] {
  const seen = new Set<string>();
  return sequences.filter((seq) => {
    if (seen.has(seq.id)) return false;
    seen.add(seq.id);
    return true;
  });
}

function deriveFilterLabel(type: BrowseFilterType, value: unknown): string {
  if (type === BrowseFilterType.FAVORITES) return "Favorites";
  if (type === BrowseFilterType.DIFFICULTY) return `Level ${value}`;
  if (type === BrowseFilterType.STARTING_LETTER) return `Letter ${value}`;
  if (type === BrowseFilterType.LENGTH) return `${value} beats`;
  if (type === BrowseFilterType.STARTING_POSITION) return `Start: ${value}`;
  if (type === BrowseFilterType.END_POSITION) return `End: ${value}`;
  if (type === BrowseFilterType.CONTAINS_LETTERS) return `"${value}"`;
  if (type === BrowseFilterType.GRID_MODE) {
    const mode = String(value);
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  }
  if (type === BrowseFilterType.LOOP_TYPE) {
    const formatted = String(value)
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return `Pattern: ${formatted}`;
  }
  if (type === BrowseFilterType.RECENT) return "Recent";
  return String(type);
}

function deriveChipColor(type: BrowseFilterType): string {
  switch (type) {
    case BrowseFilterType.DIFFICULTY: return "var(--semantic-info)";
    case BrowseFilterType.FAVORITES: return "#ec4899";
    case BrowseFilterType.STARTING_LETTER: return "#10b981";
    case BrowseFilterType.LENGTH: return "#f59e0b";
    case BrowseFilterType.LOOP_TYPE: return "#8b5cf6";
    case BrowseFilterType.STARTING_POSITION:
    case BrowseFilterType.END_POSITION: return "#06b6d4";
    case BrowseFilterType.GRID_MODE: return "#14b8a6";
    case BrowseFilterType.CONTAINS_LETTERS: return "var(--semantic-info)";
    case BrowseFilterType.RECENT: return "#f97316";
    default: return "var(--theme-accent)";
  }
}

export function createBrowseEngine(config: BrowseEngineConfig = {}): BrowseEngine {
  // Resolve config with defaults
  const sources = config.sources ?? ["community", "my-library"];
  const persistKey = config.persistKey ?? null;
  const configMinColumns = config.minColumns ?? MIN_COLUMNS;
  const configMaxColumns = config.maxColumns ?? 8;
  const sectionsConfigured = config.sections ?? false;
  const defaultSectionGroupBy = config.defaultSectionGroupBy ?? "letter";
  const defaultSort = config.defaultSort ?? BrowseSortMethod.ALPHABETICAL;

  // Services (singleton factories, no new instances)
  const loaderService = getBrowseLoader();
  const filterService = getBrowseFilter();
  const multiFilterService = getMultiFilter();
  const sortService = getBrowseSorter();
  const sectionManager = getBrowseSectionManager();

  // Library service — lazily resolved
  let libraryService: ReturnType<typeof getLibraryRepository> | null = null;
  function resolveLibrary() {
    return libraryService ??= getLibraryRepository();
  }

  // Per-source sequence cache
  let libraryCache: SequenceData[] | null = null;

  // Load persisted state
  const persisted = loadPersistedState();

  // ── Core reactive state ──────────────────────────────────────

  let _allSequences = $state<SequenceData[]>([]);
  let _isLoading = $state(false);
  let _error = $state<string | null>(null);
  let _source = $state<SequenceSource>(
    persisted?.source ?? config.defaultSource ?? sources[0] ?? "community"
  );
  let _userFilters = $state<Map<string, ActiveFilter>>(
    persisted?.filters ? new Map(persisted.filters.filter(([, f]) => !f.locked)) : new Map()
  );
  let _sortMethod = $state<BrowseSortMethod>(persisted?.sortMethod ?? defaultSort);
  let _sortDirection = $state<"asc" | "desc">(persisted?.sortDirection ?? "asc");
  let _searchQuery = $state("");
  let _sectionsEnabled = $state(sectionsConfigured);
  let _sectionGroupBy = $state<SectionGroupBy>(persisted?.sectionGroupBy ?? defaultSectionGroupBy);

  // Column state
  let _containerWidth = $state(0);
  let _columns = $state(persisted?.columnCount ?? getInitialColumns());
  let _isTransitioning = $state(false);
  let _transitionTimeout: ReturnType<typeof setTimeout> | null = null;

  // Mutation watcher cleanup fns
  let _cleanupMutated: (() => void) | null = null;
  let _cleanupAdded: (() => void) | null = null;

  // ── Constraint filters (locked, from config) ────────────────

  const constraintFilters = new Map<string, ActiveFilter>();

  if (config.constraints?.beatCount != null) {
    constraintFilters.set(BrowseFilterType.LENGTH, {
      type: BrowseFilterType.LENGTH,
      value: config.constraints.beatCount,
      label: `${config.constraints.beatCount} beats (locked)`,
      chipColor: "#f59e0b",
      locked: true,
    });
  }

  if (config.constraints?.source != null) {
    _source = config.constraints.source;
  }

  if (config.constraints?.gridMode != null) {
    constraintFilters.set(BrowseFilterType.GRID_MODE, {
      type: BrowseFilterType.GRID_MODE,
      value: config.constraints.gridMode,
      label: `${config.constraints.gridMode} (locked)`,
      chipColor: "#14b8a6",
      locked: true,
    });
  }

  // ── Derived pipeline ─────────────────────────────────────────

  const _constraintFiltered = $derived.by(() => {
    if (constraintFilters.size === 0) return _allSequences;
    let result = _allSequences;
    for (const filter of constraintFilters.values()) {
      result = filterService.applyFilter(result, filter.type, filter.value);
    }
    return result;
  });

  const _userFiltered = $derived.by(() => {
    if (_userFilters.size === 0) return _constraintFiltered;
    return multiFilterService.applyFilters(_constraintFiltered, _userFilters as Map<string, any>);
  });

  const _searched = $derived.by(() => {
    if (!_searchQuery.trim()) return _userFiltered;
    return filterService.applyFilter(
      _userFiltered,
      BrowseFilterType.CONTAINS_LETTERS,
      _searchQuery
    );
  });

  const _sorted = $derived.by(() => {
    const sorted = sortService.sortSequences([..._searched], _sortMethod);
    if (_sortDirection === "desc") sorted.reverse();
    return sorted;
  });

  const _sections = $derived.by((): SequenceSection[] => {
    if (!_sectionsEnabled || _sorted.length === 0) return [];

    let groupBy: SectionConfig["groupBy"];
    switch (_sectionGroupBy) {
      case "letter": groupBy = "letter"; break;
      case "difficulty": groupBy = "difficulty"; break;
      case "length": groupBy = "length"; break;
      case "date": groupBy = "date"; break;
      default: groupBy = "letter";
    }

    return sectionManager.organizeSections(_sorted, {
      groupBy,
      sortMethod: _sortMethod,
      showEmptySections: false,
    });
  });

  const _availableLengths = $derived.by(() => {
    const lengths = new Set<number>();
    for (const seq of _allSequences) {
      const length = seq.sequenceLength ?? seq.steps?.length ?? 0;
      if (length > 0) lengths.add(length);
    }
    return Array.from(lengths).sort((a, b) => a - b);
  });

  const _loopTypeCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    let circularCount = 0;
    const total = _allSequences.length;
    for (const seq of _allSequences) {
      if (seq.isCircular) {
        circularCount++;
        if (seq.loopType) counts[seq.loopType] = (counts[seq.loopType] ?? 0) + 1;
      }
    }
    counts["_total"] = total;
    counts["_circular"] = circularCount;
    counts["_non_circular"] = total - circularCount;
    return counts;
  });

  const _allFilterChips = $derived.by(() => {
    const chips: ActiveFilter[] = [];
    for (const f of constraintFilters.values()) chips.push(f);
    for (const f of _userFilters.values()) chips.push(f);
    return chips;
  });

  const _maxColumns = $derived(
    Math.min(configMaxColumns, getMaxColumnsForWidth(_containerWidth || 1200))
  );

  const _clampedColumns = $derived(
    Math.max(configMinColumns, Math.min(_maxColumns, _columns))
  );

  // ── Persistence ──────────────────────────────────────────────

  function loadPersistedState(): PersistedEngineState | null {
    if (!persistKey) return null;
    try {
      const stored = localStorage.getItem(persistKey);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  function persistState(): void {
    if (!persistKey) return;
    try {
      const state: PersistedEngineState = {
        source: _source,
        sortMethod: _sortMethod,
        sortDirection: _sortDirection,
        filters: Array.from(_userFilters.entries()),
        sectionGroupBy: _sectionGroupBy,
        columnCount: _columns,
      };
      localStorage.setItem(persistKey, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  function getInitialColumns(): number {
    if (import.meta.hot?.data?.browseEngineColumns !== undefined) {
      return import.meta.hot.data.browseEngineColumns;
    }
    return settingsService.settings.gridZoomLevel ?? 2;
  }

  function persistColumns(): void {
    if (_columns !== settingsService.settings.gridZoomLevel) {
      settingsService.updateSetting("gridZoomLevel", _columns);
    }
  }

  // ── Data loading ─────────────────────────────────────────────

  async function loadCommunity(): Promise<void> {
    _isLoading = true;
    _error = null;
    try {
      const raw = await loaderService.loadSequenceMetadata();
      _allSequences = deduplicateById(raw);
    } catch (err) {
      _error = err instanceof Error ? err.message : "Failed to load sequences";
    } finally {
      _isLoading = false;
    }
  }

  async function loadLibrary(): Promise<void> {
    if (libraryCache) {
      _allSequences = libraryCache;
      return;
    }

    const lib = resolveLibrary();
    if (!lib) {
      _error = "Please sign in to view your library";
      _allSequences = [];
      return;
    }

    _isLoading = true;
    _error = null;
    try {
      const raw = await lib.getSequences();
      const deduped = deduplicateById(raw);
      _allSequences = deduped;
      libraryCache = deduped;
    } catch (err) {
      _error = err instanceof Error ? err.message : "Failed to load library";
    } finally {
      _isLoading = false;
    }
  }

  // ── Column transition ────────────────────────────────────────

  function triggerTransition(): void {
    _isTransitioning = true;
    if (_transitionTimeout) clearTimeout(_transitionTimeout);
    _transitionTimeout = setTimeout(() => {
      _isTransitioning = false;
      _transitionTimeout = null;
    }, 200);
  }

  // ── Public API ───────────────────────────────────────────────

  const engine: BrowseEngine = {
    get sequences() { return _sorted; },
    get sections() { return _sections; },
    get allSequences() { return _allSequences; },
    get resultCount() { return _sorted.length; },
    get isLoading() { return _isLoading; },
    get error() { return _error; },

    get source() { return _source; },
    get canSwitchSource() {
      return sources.length > 1 && !config.constraints?.source;
    },

    get filters() { return _userFilters as ReadonlyMap<string, ActiveFilter>; },
    get constraintFilters() { return constraintFilters as ReadonlyMap<string, ActiveFilter>; },
    get allFilterChips() { return _allFilterChips; },
    get hasActiveFilters() { return _userFilters.size > 0; },

    get sortMethod() { return _sortMethod; },
    get sortDirection() { return _sortDirection; },
    get searchQuery() { return _searchQuery; },

    get columnCount() { return _clampedColumns; },
    get canZoomIn() { return _clampedColumns < _maxColumns; },
    get canZoomOut() { return _clampedColumns > configMinColumns; },
    get isTransitioning() { return _isTransitioning; },

    get sectionsEnabled() { return _sectionsEnabled; },
    get sectionGroupBy() { return _sectionGroupBy; },

    get availableLengths() { return _availableLengths; },
    get loopTypeCounts() { return _loopTypeCounts; },

    async setSource(source: SequenceSource): Promise<void> {
      if (source === "my-library" && !authState.isAuthenticated) return;
      if (source === _source && _allSequences.length > 0) return;
      _source = source;
      if (source === "my-library") await loadLibrary();
      else await loadCommunity();
      persistState();
    },

    addFilter(type, value, label, chipColor) {
      const newMap = new Map(_userFilters);
      newMap.set(type as string, {
        type,
        value,
        label: label || deriveFilterLabel(type, value),
        chipColor: chipColor || deriveChipColor(type),
        locked: false,
      });
      _userFilters = newMap;
      persistState();
    },

    removeFilter(type) {
      const newMap = new Map(_userFilters);
      newMap.delete(type as string);
      _userFilters = newMap;
      persistState();
    },

    clearUserFilters() {
      _userFilters = new Map();
      persistState();
    },

    setSort(method, direction) {
      _sortMethod = method;
      if (direction !== undefined) _sortDirection = direction;
      persistState();
    },

    setSearch(query) {
      _searchQuery = query;
    },

    zoomIn() {
      const next = Math.min(_maxColumns, _columns + 1);
      if (next !== _columns) {
        _columns = next;
        triggerTransition();
        persistColumns();
        persistState();
      }
    },

    zoomOut() {
      const next = Math.max(configMinColumns, _columns - 1);
      if (next !== _columns) {
        _columns = next;
        triggerTransition();
        persistColumns();
        persistState();
      }
    },

    setColumns(count) {
      const clamped = Math.max(configMinColumns, Math.min(_maxColumns, count));
      if (clamped !== _columns) {
        _columns = clamped;
        triggerTransition();
        persistColumns();
        persistState();
      }
    },

    updateContainerWidth(width) {
      if (width <= 0 || width === _containerWidth) return;
      _containerWidth = width;
      const max = Math.min(configMaxColumns, getMaxColumnsForWidth(width));
      if (_columns > max) {
        _columns = max;
        persistColumns();
      }
    },

    setSectionsEnabled(enabled) {
      _sectionsEnabled = enabled;
    },

    setSectionGroupBy(groupBy) {
      _sectionGroupBy = groupBy;
      persistState();
    },

    async toggleFavorite(sequenceId) {
      const collectionManager = getCollectionManager();
      if (!collectionManager) return;
      try {
        const newStatus = await collectionManager.toggleFavorite(sequenceId);
        _allSequences = _allSequences.map((seq) =>
          seq.id === sequenceId ? { ...seq, isFavorite: newStatus } : seq
        );
        if (libraryCache) {
          libraryCache = libraryCache.map((seq) =>
            seq.id === sequenceId ? { ...seq, isFavorite: newStatus } : seq
          );
        }
      } catch (err) {
        console.error("Failed to toggle favorite:", err);
      }
    },

    getFilteredCount(type, value) {
      return multiFilterService.getFilteredCount(
        _allSequences,
        type,
        value,
        _userFilters as Map<string, any>
      );
    },

    invalidateLibraryCache() {
      libraryCache = null;
    },

    async initialize() {
      // Subscribe to library mutation events
      _cleanupMutated = onLibraryMutated((sequenceId) => {
        libraryCache = libraryCache?.filter((s) => s.id !== sequenceId) ?? null;
        loaderService.removeFromCache(sequenceId);
        _allSequences = _allSequences.filter((s) => s.id !== sequenceId);
      });

      _cleanupAdded = onLibrarySequenceAdded((sequence) => {
        if (_source === "my-library") {
          if (libraryCache) libraryCache = [sequence, ...libraryCache];
          _allSequences = deduplicateById([sequence, ..._allSequences]);
        } else {
          libraryCache = null;
        }
      });

      // Load data for current source
      if (_source === "my-library") await loadLibrary();
      else await loadCommunity();
    },

    async refresh() {
      libraryCache = null;
      if (_source === "my-library") await loadLibrary();
      else await loadCommunity();
    },

    destroy() {
      _cleanupMutated?.();
      _cleanupAdded?.();
      _cleanupMutated = null;
      _cleanupAdded = null;
      if (_transitionTimeout) clearTimeout(_transitionTimeout);
    },
  };

  // HMR preservation
  if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
      import.meta.hot!.data.browseEngineColumns = _columns;
    });
  }

  return engine;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors. Fix any import path issues.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/browse/engine/createBrowseEngine.ts
git commit -m "feat(browse): add headless createBrowseEngine state machine"
```

---

## Task 3: BrowseToolbar Component

**Files:**
- Create: `src/lib/shared/browse/components/BrowseToolbar.svelte`

Port from `SequenceTopBarControls` (gallery toolbar) + `PickerToolbar` (picker toolbar). Unified: sort dropdown + search + result count.

- [ ] **Step 1: Write BrowseToolbar**

```svelte
<!-- src/lib/shared/browse/components/BrowseToolbar.svelte -->
<script lang="ts">
  import { BrowseSortMethod } from "$lib/features/browse/shared/domain/enums/browse-enums";
  import ExpandableSearchBar from "$lib/features/browse/shared/components/ExpandableSearchBar.svelte";
  import type { BrowseEngine } from "../engine/types";

  interface Props {
    engine: BrowseEngine;
    showSourceToggle?: boolean;
  }

  let { engine, showSourceToggle = false }: Props = $props();

  const sortOptions = [
    { id: BrowseSortMethod.ALPHABETICAL, label: "A-Z", icon: "fa-font" },
    { id: BrowseSortMethod.DATE_ADDED, label: "Recent", icon: "fa-clock" },
    { id: BrowseSortMethod.DIFFICULTY_LEVEL, label: "Level", icon: "fa-signal" },
    { id: BrowseSortMethod.SEQUENCE_LENGTH, label: "Length", icon: "fa-ruler" },
  ];

  let showSortDropdown = $state(false);

  const currentSortLabel = $derived(
    sortOptions.find((o) => o.id === engine.sortMethod)?.label ?? "Sort"
  );

  function handleSortSelect(method: BrowseSortMethod) {
    engine.setSort(method);
    showSortDropdown = false;
  }

  function handlePointerDownOutside(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".sort-dropdown-wrapper")) {
      showSortDropdown = false;
    }
  }

  function handleSourceToggle() {
    const next = engine.source === "community" ? "my-library" : "community";
    engine.setSource(next);
  }
</script>

<div class="toolbar" role="toolbar" tabindex="0" onpointerdown={handlePointerDownOutside}>
  {#if showSourceToggle && engine.canSwitchSource}
    <div class="source-toggle">
      <button
        class="source-btn"
        class:active={engine.source === "community"}
        onclick={() => engine.setSource("community")}
      >Community</button>
      <button
        class="source-btn"
        class:active={engine.source === "my-library"}
        onclick={() => engine.setSource("my-library")}
      >My Library</button>
    </div>
  {/if}

  <div class="sort-dropdown-wrapper">
    <button
      class="sort-trigger"
      onclick={(e) => { e.stopPropagation(); showSortDropdown = !showSortDropdown; }}
      aria-haspopup="listbox"
      aria-expanded={showSortDropdown}
    >
      <i class="fas fa-sort-amount-down" aria-hidden="true"></i>
      <span>{currentSortLabel}</span>
      <i class="fas fa-chevron-down dropdown-arrow" class:open={showSortDropdown} aria-hidden="true"></i>
    </button>

    {#if showSortDropdown}
      <div class="sort-dropdown" role="listbox">
        {#each sortOptions as option}
          <button
            class="sort-option"
            class:active={engine.sortMethod === option.id}
            onclick={(e) => { e.stopPropagation(); handleSortSelect(option.id); }}
            role="option"
            aria-selected={engine.sortMethod === option.id}
          >
            <i class="fas {option.icon}" aria-hidden="true"></i>
            <span>{option.label}</span>
            {#if engine.sortMethod === option.id}
              <i class="fas fa-check check-icon" aria-hidden="true"></i>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <ExpandableSearchBar
    onSearch={(q) => engine.setSearch(q)}
    value={engine.searchQuery}
    placeholder="Search sequences..."
  />

  <span class="result-count">
    {engine.resultCount} sequence{engine.resultCount === 1 ? "" : "s"}
  </span>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 12px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .source-toggle {
    display: flex;
    gap: 2px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border-radius: var(--border-radius-sm, 4px);
    padding: 2px;
    flex-shrink: 0;
  }

  .source-btn {
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    border: none;
    border-radius: var(--border-radius-sm, 4px);
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .source-btn.active {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .sort-dropdown-wrapper { position: relative; flex-shrink: 0; }

  .sort-trigger {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 4px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    transition: all var(--duration-fast, 150ms) ease;
  }

  .sort-trigger:hover {
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, white);
    color: var(--theme-text, white);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .dropdown-arrow {
    font-size: var(--font-size-compact, 12px);
    margin-left: 2px;
    transition: transform var(--duration-fast, 150ms) ease;
  }

  .dropdown-arrow.open { transform: rotate(180deg); }

  .sort-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 130px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-md, 8px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 100;
    overflow: hidden;
  }

  .sort-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    width: 100%;
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    text-align: left;
    transition: all 0.1s ease;
  }

  .sort-option:hover {
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, white);
    color: var(--theme-text, white);
  }

  .sort-option.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 15%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  .sort-option i:first-child { width: 14px; text-align: center; opacity: 0.7; }

  .sort-option .check-icon {
    margin-left: auto;
    color: var(--theme-accent, #8b5cf6);
  }

  .result-count {
    flex: 1;
    text-align: right;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  @media (max-width: 520px) {
    .toolbar { gap: var(--spacing-sm, 8px); padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px); }
    .sort-trigger span { display: none; }
    .result-count { display: none; }
    .source-btn span { font-size: 11px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sort-trigger, .dropdown-arrow, .sort-option, .source-btn { transition: none; }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/browse/components/BrowseToolbar.svelte
git commit -m "feat(browse): add unified BrowseToolbar component"
```

---

## Task 4: BrowseFilterBar Component

**Files:**
- Create: `src/lib/shared/browse/components/BrowseFilterBar.svelte`

Composes existing filter chip components (LevelFilterChip, FavoritesFilterChip, LengthFilterChip). Shows locked constraint chips without dismiss button.

- [ ] **Step 1: Write BrowseFilterBar**

```svelte
<!-- src/lib/shared/browse/components/BrowseFilterBar.svelte -->
<script lang="ts">
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
  import LevelFilterChip from "$lib/features/browse/sequences/filtering/components/inline-filter/chips/LevelFilterChip.svelte";
  import FavoritesFilterChip from "$lib/features/browse/sequences/filtering/components/inline-filter/chips/FavoritesFilterChip.svelte";
  import LengthFilterChip from "$lib/features/browse/sequences/filtering/components/inline-filter/chips/LengthFilterChip.svelte";
  import type { BrowseEngine, ActiveFilter } from "../engine/types";

  interface Props {
    engine: BrowseEngine;
  }

  let { engine }: Props = $props();

  const activeLevel = $derived(() => {
    const f = engine.filters.get(BrowseFilterType.DIFFICULTY as string);
    return f ? (f.value as number) : null;
  })();

  const isFavoritesActive = $derived(
    engine.filters.has(BrowseFilterType.FAVORITES as string)
  );

  const activeLength = $derived(() => {
    const f = engine.filters.get(BrowseFilterType.LENGTH as string);
    return f ? (f.value as number) : null;
  })();

  const hasLengthConstraint = $derived(
    engine.constraintFilters.has(BrowseFilterType.LENGTH as string)
  );

  function handleLevelSelect(level: number | null) {
    if (level == null) engine.removeFilter(BrowseFilterType.DIFFICULTY);
    else engine.addFilter(BrowseFilterType.DIFFICULTY, level, `Level ${level}`, "var(--semantic-info)");
  }

  function handleFavoritesToggle(active: boolean) {
    if (active) engine.addFilter(BrowseFilterType.FAVORITES, true, "Favorites", "#ec4899");
    else engine.removeFilter(BrowseFilterType.FAVORITES);
  }

  function handleLengthSelect(length: number | null) {
    if (length == null) engine.removeFilter(BrowseFilterType.LENGTH);
    else engine.addFilter(BrowseFilterType.LENGTH, length, `${length} beats`, "#f59e0b");
  }
</script>

<div class="filter-bar">
  <div class="chip-row" role="group" aria-label="Filters">
    <LevelFilterChip
      activeLevel={activeLevel}
      onSelect={handleLevelSelect}
      getFilteredCount={(type, value) => engine.getFilteredCount(type, value)}
    />
    <FavoritesFilterChip
      active={isFavoritesActive}
      onToggle={handleFavoritesToggle}
    />
    {#if !hasLengthConstraint}
      <LengthFilterChip
        activeLength={activeLength}
        availableLengths={engine.availableLengths}
        onSelect={handleLengthSelect}
      />
    {/if}
  </div>

  {#if engine.allFilterChips.length > 0}
    <div class="active-chips">
      {#each engine.allFilterChips as chip (chip.type)}
        <span
          class="active-chip"
          style:border-color={chip.chipColor}
          style:background="color-mix(in srgb, {chip.chipColor} 12%, transparent)"
        >
          {#if chip.locked}
            <i class="fas fa-lock lock-icon" aria-hidden="true"></i>
          {/if}
          <span class="chip-label">{chip.label}</span>
          {#if !chip.locked}
            <button
              class="chip-dismiss"
              onclick={() => engine.removeFilter(chip.type)}
              aria-label="Remove {chip.label} filter"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          {/if}
        </span>
      {/each}

      {#if engine.hasActiveFilters}
        <button class="clear-all" onclick={() => engine.clearUserFilters()}>
          Clear all
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-xs, 4px) var(--spacing-md, 12px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs, 4px);
    align-items: center;
  }

  .active-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs, 4px);
    align-items: center;
  }

  .active-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid;
    border-radius: 999px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, white);
  }

  .lock-icon {
    font-size: 9px;
    opacity: 0.5;
  }

  .chip-label {
    white-space: nowrap;
  }

  .chip-dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: 10px;
    transition: color 0.1s ease;
  }

  .chip-dismiss:hover {
    color: var(--theme-text, white);
  }

  .clear-all {
    padding: 2px 8px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: color 0.1s ease;
  }

  .clear-all:hover {
    color: var(--theme-text, white);
  }

  @media (prefers-reduced-motion: reduce) {
    .chip-dismiss, .clear-all { transition: none; }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/browse/components/BrowseFilterBar.svelte
git commit -m "feat(browse): add unified BrowseFilterBar component"
```

---

## Task 5: BrowseSidebar Component

**Files:**
- Create: `src/lib/shared/browse/components/BrowseSidebar.svelte`

Thin wrapper around existing `SectionIndexSidebar`.

- [ ] **Step 1: Write BrowseSidebar**

```svelte
<!-- src/lib/shared/browse/components/BrowseSidebar.svelte -->
<script lang="ts">
  import SectionIndexSidebar from "$lib/features/browse/sequences/navigation/components/SectionIndexSidebar.svelte";
  import type { BrowseEngine } from "../engine/types";

  interface Props {
    engine: BrowseEngine;
    activeSection?: string;
    onScrollToSection: (title: string) => void;
  }

  let { engine, activeSection, onScrollToSection }: Props = $props();

  const showSidebar = $derived(engine.sections.length > 1);
</script>

{#if showSidebar}
  <SectionIndexSidebar
    sections={engine.sections}
    {onScrollToSection}
    {activeSection}
  />
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/browse/components/BrowseSidebar.svelte
git commit -m "feat(browse): add BrowseSidebar wrapper component"
```

---

## Task 6: BrowseGrid Component (Unified)

**Files:**
- Create: `src/lib/shared/browse/components/BrowseGrid.svelte`

Refactored grid renderer. Receives data from engine. Column count from engine. Delegates to existing `ChoreoCardThumbnail` and `VirtualizedSequenceGrid`.

- [ ] **Step 1: Write BrowseGrid**

```svelte
<!-- src/lib/shared/browse/components/BrowseGrid.svelte -->
<script lang="ts">
  import { getSequenceDataProvider } from "$lib/shared/sequence-viewer/getSequenceDataProvider";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { onDestroy } from "svelte";
  import type { IBrowseThumbnailProvider } from "$lib/features/browse/sequences/display/services/contracts/IBrowseThumbnailProvider";
  import ChoreoCardThumbnail from "$lib/features/browse/sequences/display/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import SectionHeader from "$lib/features/browse/sequences/display/components/SectionHeader.svelte";
  import VirtualizedSequenceGrid, {
    type VirtualGridApi,
  } from "$lib/features/browse/sequences/display/components/VirtualizedSequenceGrid.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { isCatDogMode } from "$lib/features/browse/sequences/display/utils/prop-mode-helpers";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { getVariationGrouper } from "$lib/features/browse/sequences/display/getVariationGrouper";
  import type { BrowseEngine } from "../engine/types";
  import type { SequenceSection } from "$lib/features/browse/shared/domain/models/browse-models";

  const VIRTUALIZATION_THRESHOLD = 50;

  interface Props {
    engine: BrowseEngine;
    thumbnailService: IBrowseThumbnailProvider | null;
    onAction?: (action: string, sequence: SequenceData, variations?: SequenceData[]) => void;
    disableVirtualization?: boolean;
    eager?: boolean;
    onGridReady?: (api: VirtualGridApi) => void;
  }

  let {
    engine,
    thumbnailService,
    onAction = () => {},
    disableVirtualization = false,
    eager = false,
    onGridReady,
  }: Props = $props();

  const useVirtualization = $derived(
    !disableVirtualization &&
    !engine.sectionsEnabled &&
    engine.sequences.length > VIRTUALIZATION_THRESHOLD
  );

  const variationGrouper = getVariationGrouper();

  const variationMap = $derived.by(() => {
    return variationGrouper.buildVariationMap(engine.sequences);
  });

  function getVariationsForSequence(sequence: SequenceData): SequenceData[] {
    const word = sequence.word || sequence.name;
    if (!word) return [sequence];
    return variationMap.get(word.trim()) ?? [sequence];
  }

  const propSettings = $derived({
    bluePropType: settingsService.settings.bluePropType,
    redPropType: settingsService.settings.redPropType,
    catDogMode: settingsService.settings.catDogMode,
  });

  const isCatDog = $derived(
    isCatDogMode(propSettings.bluePropType, propSettings.redPropType, propSettings.catDogMode)
  );

  const visibilityManager = getAnimationVisibilityManager();
  let lightMode = $state(!visibilityManager.isDarkMode());

  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }

  visibilityManager.registerObserver(handleVisibilityChange);
  onDestroy(() => visibilityManager.unregisterObserver(handleVisibilityChange));

  function handleSequenceAction(action: string, sequence: SequenceData, variations?: SequenceData[]) {
    onAction(action, sequence, variations);
  }

  const sequenceDataProvider = getSequenceDataProvider();

  function handleSequenceHover(seq: SequenceData) {
    sequenceDataProvider.prefetch(seq);
  }
</script>

{#if useVirtualization}
  <VirtualizedSequenceGrid
    sequences={engine.sequences}
    {thumbnailService}
    onAction={handleSequenceAction}
    pinchColumnOverride={engine.columnCount}
    {onGridReady}
  />
{:else if engine.sectionsEnabled && engine.sections.length > 0}
  <div class="sections-container">
    {#each engine.sections as section (section.id)}
      <div class="sequence-section" data-section={section.title}>
        <SectionHeader title={section.title} />
        {#if section.sequences.length > 0}
          <div
            class="sequences-grid grid-view"
            class:is-transitioning={engine.isTransitioning}
            style:grid-template-columns="repeat({Math.min(engine.columnCount, section.sequences.length)}, 1fr)"
            style:max-width={section.sequences.length < engine.columnCount
              ? `${(section.sequences.length / engine.columnCount) * 100}%`
              : undefined}
          >
            {#each section.sequences as sequence (sequence.id)}
              {@const seqVariations = getVariationsForSequence(sequence)}
              <ChoreoCardThumbnail
                {sequence}
                variations={seqVariations}
                onPrimaryAction={(seq) => handleSequenceAction("view-detail", seq, seqVariations)}
                onHover={handleSequenceHover}
                bluePropType={propSettings.bluePropType}
                redPropType={propSettings.redPropType}
                catDogModeEnabled={isCatDog}
                {lightMode}
                {eager}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{:else if engine.sequences.length > 0}
  <div
    class="sequences-grid grid-view"
    class:is-transitioning={engine.isTransitioning}
    style:grid-template-columns="repeat({engine.columnCount}, 1fr)"
  >
    {#each engine.sequences as sequence (sequence.id)}
      {@const seqVariations = getVariationsForSequence(sequence)}
      <ChoreoCardThumbnail
        {sequence}
        variations={seqVariations}
        onPrimaryAction={(seq) => handleSequenceAction("view-detail", seq, seqVariations)}
        onHover={handleSequenceHover}
        bluePropType={propSettings.bluePropType}
        redPropType={propSettings.redPropType}
        catDogModeEnabled={isCatDog}
        {lightMode}
        {eager}
      />
    {/each}
  </div>
{/if}

<style>
  .sections-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .sequence-section {
    display: flex;
    flex-direction: column;
  }

  .sequences-grid.grid-view {
    display: grid;
    gap: var(--spacing-sm);
    align-items: start;
  }

  .sequences-grid.grid-view.is-transitioning {
    transition: gap 200ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .sequences-grid.grid-view.is-transitioning { transition: none; }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/browse/components/BrowseGrid.svelte
git commit -m "feat(browse): add unified BrowseGrid component"
```

---

## Task 7: BrowsePanel Component

**Files:**
- Create: `src/lib/shared/browse/components/BrowsePanel.svelte`

Composes BrowseToolbar + BrowseFilterBar + BrowseSidebar + BrowseGrid. Handles ResizeObserver, pinch/Ctrl+scroll zoom, scroll position save/restore, empty/loading/error states.

- [ ] **Step 1: Write BrowsePanel**

```svelte
<!-- src/lib/shared/browse/components/BrowsePanel.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getBrowseThumbnailProvider } from "$lib/features/browse/sequences/display/getBrowseThumbnailProvider";
  import { PinchZoomGridController } from "$lib/features/browse/sequences/display/services/implementations/PinchZoomGridController";
  import { getSequenceOverlayState } from "$lib/shared/sequence-viewer/state/sequence-viewer-overlay-state.svelte";
  import { browseScrollState } from "$lib/features/browse/shared/state/BrowseScrollState.svelte";
  import BrowseThumbnailSkeleton from "$lib/features/browse/sequences/display/components/BrowseThumbnailSkeleton.svelte";
  import type { IBrowseThumbnailProvider } from "$lib/features/browse/sequences/display/services/contracts/IBrowseThumbnailProvider";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { BrowseEngine, BrowseLayout } from "../engine/types";
  import BrowseToolbar from "./BrowseToolbar.svelte";
  import BrowseFilterBar from "./BrowseFilterBar.svelte";
  import BrowseSidebar from "./BrowseSidebar.svelte";
  import BrowseGrid from "./BrowseGrid.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    engine: BrowseEngine;
    layout: BrowseLayout;
    onSelect?: (sequence: SequenceData, variations?: SequenceData[]) => void;
    showSidebar?: boolean;
    showToolbar?: boolean;
    showFilterBar?: boolean;
    showSourceToggle?: boolean;
    eager?: boolean;
    title?: string;
  }

  let {
    engine,
    layout,
    onSelect,
    showSidebar: sidebarOverride,
    showToolbar: toolbarOverride,
    showFilterBar: filterBarOverride,
    showSourceToggle: sourceToggleOverride,
    eager: eagerOverride,
    title,
  }: Props = $props();

  // Layout defaults
  const showToolbar = $derived(toolbarOverride ?? (layout !== "minimal"));
  const showFilterBar = $derived(filterBarOverride ?? (layout !== "minimal"));
  const showSidebar = $derived(sidebarOverride ?? (layout === "fullpage"));
  const showSourceToggle = $derived(sourceToggleOverride ?? false);
  const isEager = $derived(eagerOverride ?? (layout !== "fullpage"));
  const disableVirtualization = $derived(layout === "minimal");

  // Internal state
  let thumbnailService: IBrowseThumbnailProvider | null = $state(null);
  let pinchController: PinchZoomGridController | null = null;
  let contentEl: HTMLElement | null = $state(null);
  let containerEl: HTMLElement | null = $state(null);
  let activeSection = $state<string | undefined>(undefined);

  // Skeleton loading
  let showSkeleton = $state(true);
  let skeletonFading = $state(false);

  const isInitializing = $derived(engine.isLoading);
  const isEmpty = $derived(!isInitializing && !engine.error && engine.sequences.length === 0);
  const hasSequences = $derived(!isInitializing && !engine.error && engine.sequences.length > 0);

  const emptyMessage = $derived(
    engine.hasActiveFilters
      ? t('browse_no_sequences')
      : engine.source === "my-library"
        ? t('browse_no_sequences_saved')
        : t('browse_no_sequences_found')
  );

  $effect((): void | (() => void) => {
    if (isInitializing) { showSkeleton = true; skeletonFading = false; }
    else if (showSkeleton) {
      skeletonFading = true;
      const timer = setTimeout(() => { showSkeleton = false; skeletonFading = false; }, 300);
      return () => clearTimeout(timer);
    }
  });

  // ResizeObserver → engine.updateContainerWidth
  $effect(() => {
    const el = containerEl;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) engine.updateContainerWidth(w);
      }
    });
    ro.observe(el);
    requestAnimationFrame(() => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) engine.updateContainerWidth(w);
    });
    return () => ro.disconnect();
  });

  // Ctrl+Scroll zoom (compact mode)
  const SCROLL_THRESHOLD = 50;
  let cumulativeScrollDelta = 0;

  function handleWheel(ev: WheelEvent) {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    cumulativeScrollDelta += ev.deltaY;
    if (cumulativeScrollDelta > SCROLL_THRESHOLD) {
      engine.zoomIn();
      cumulativeScrollDelta = 0;
    } else if (cumulativeScrollDelta < -SCROLL_THRESHOLD) {
      engine.zoomOut();
      cumulativeScrollDelta = 0;
    }
  }

  $effect(() => {
    const el = contentEl;
    if (!el || layout === "minimal") return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  });

  // Active section tracking (fullpage)
  function updateActiveSection() {
    if (!contentEl || !engine.sections.length) return;
    const scrollTop = contentEl.scrollTop;
    const sections = contentEl.querySelectorAll("[data-section]");
    let current: string | undefined;
    for (const el of sections) {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetTop <= scrollTop + 100) current = htmlEl.dataset.section;
    }
    activeSection = current;
  }

  function scrollToSection(sectionTitle: string) {
    if (!contentEl) return;
    const el = contentEl.querySelector(`[data-section="${CSS.escape(sectionTitle)}"]`) as HTMLElement;
    if (!el) return;
    const containerRect = contentEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetScroll = elRect.top - containerRect.top + contentEl.scrollTop;
    contentEl.scrollTo({ top: targetScroll, behavior: "instant" });
  }

  // Scroll restore on overlay close (fullpage)
  const overlayState = getSequenceOverlayState();
  let wasOverlayOpen = false;

  $effect(() => {
    if (layout !== "fullpage") return;
    const isOpen = overlayState.isOpen;
    if (wasOverlayOpen && !isOpen && contentEl) {
      const savedScrollY = browseScrollState.lastScrollY;
      if (savedScrollY > 0) {
        requestAnimationFrame(() => contentEl?.scrollTo({ top: savedScrollY }));
      }
    }
    wasOverlayOpen = isOpen;
  });

  function handleScroll() {
    if (!contentEl) return;
    browseScrollState.updateScrollPosition(contentEl.scrollTop);
    updateActiveSection();
  }

  function handleAction(action: string, sequence: SequenceData, variations?: SequenceData[]) {
    if (action === "view-detail" && onSelect) {
      onSelect(sequence, variations);
    }
  }

  onMount(() => {
    thumbnailService = getBrowseThumbnailProvider();

    if (layout === "fullpage" && contentEl) {
      pinchController = new PinchZoomGridController();
      pinchController.setColumnCount(engine.columnCount);
      pinchController.setOnStateChange((state) => engine.setColumns(state.columns));
      pinchController.attach(contentEl);
    }
  });

  onDestroy(() => {
    pinchController?.detach();
    pinchController = null;
  });
</script>

<div class="browse-panel" class:fullpage={layout === "fullpage"} class:compact={layout === "compact"} class:minimal={layout === "minimal"} bind:this={containerEl}>
  {#if title}
    <div class="panel-title">
      <h3>{title}</h3>
    </div>
  {/if}

  {#if showToolbar}
    <BrowseToolbar {engine} showSourceToggle={showSourceToggle} />
  {/if}

  {#if showFilterBar}
    <BrowseFilterBar {engine} />
  {/if}

  <div class="panel-content" bind:this={contentEl} onscroll={handleScroll}>
    {#if engine.error}
      <div class="error-state" role="alert">
        <p>{engine.error}</p>
        <button onclick={() => engine.refresh()}>Try again</button>
      </div>
    {:else if isEmpty}
      <div class="empty-state" role="status">
        <i class="fas {engine.hasActiveFilters ? 'fa-filter' : 'fa-inbox'} empty-icon" aria-hidden="true"></i>
        <p class="empty-message">{emptyMessage}</p>
        {#if engine.hasActiveFilters}
          <button class="clear-filters-btn" onclick={() => engine.clearUserFilters()}>
            <i class="fas fa-times" aria-hidden="true"></i>
            Clear all filters
          </button>
        {/if}
      </div>
    {:else}
      <div class="grid-with-sidebar">
        {#if showSidebar}
          <BrowseSidebar {engine} {activeSection} {onScrollToSection}={scrollToSection} />
        {/if}
        {#if hasSequences}
          <div class="grid-area">
            <BrowseGrid
              {engine}
              {thumbnailService}
              onAction={handleAction}
              {disableVirtualization}
              eager={isEager}
            />
          </div>
        {/if}
      </div>
      {#if showSkeleton}
        <div class="skeleton-overlay" class:fading={skeletonFading}>
          <BrowseThumbnailSkeleton count={12} />
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .browse-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    container-type: inline-size;
  }

  .panel-title {
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .panel-title h3 {
    margin: 0;
    font-size: var(--font-size-base, 16px);
    color: var(--theme-text, white);
  }

  .panel-content {
    position: relative;
    flex: 1;
    overflow-y: auto;
    container-type: inline-size;
    touch-action: pan-y;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .panel-content::-webkit-scrollbar { width: 6px; }
  .panel-content::-webkit-scrollbar-track { background: var(--scrollbar-track); }
  .panel-content::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }

  .grid-with-sidebar {
    display: flex;
    align-items: flex-start;
    gap: 0;
  }

  .grid-area {
    flex: 1;
    min-width: 0;
    padding: var(--spacing-lg);
  }

  .browse-panel.minimal .grid-area {
    padding: var(--spacing-sm);
  }

  .skeleton-overlay {
    position: absolute;
    inset: 0;
    padding: var(--spacing-lg);
    background: inherit;
    z-index: 1;
    opacity: 1;
    transition: opacity 300ms ease-out;
  }

  .skeleton-overlay.fading {
    opacity: 0;
    pointer-events: none;
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: var(--spacing-md);
    color: var(--semantic-error);
  }

  .error-state p { margin: 0; text-align: center; }

  .error-state button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border: 1px solid var(--semantic-error);
    border-radius: 6px;
    color: var(--semantic-error);
    cursor: pointer;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-xl, 24px);
    min-height: 200px;
    color: var(--theme-text-dim);
  }

  .empty-icon { font-size: 2rem; opacity: 0.5; margin-bottom: var(--spacing-sm, 8px); }
  .empty-message { margin: 0; font-size: var(--font-size-base, 16px); color: var(--theme-text, #ffffff); font-weight: 500; }

  .clear-filters-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    margin-top: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    font: inherit;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-overlay, .clear-filters-btn { transition: none; }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors. Fix any import path issues.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/browse/components/BrowsePanel.svelte
git commit -m "feat(browse): add composed BrowsePanel component with layout modes"
```

---

## Task 8: Gallery Migration — BrowseModule

**Files:**
- Modify: `src/lib/features/browse/shared/components/BrowseModule.svelte`

Replace `createBrowseState()` with `createBrowseEngine()`. Pass engine to GalleryTab.

- [ ] **Step 1: Update BrowseModule imports and state creation**

Replace the import and `createBrowseState()` call:

```typescript
// REMOVE:
import { createBrowseState } from "../state/browse-state-factory.svelte";
const galleryState = createBrowseState();

// ADD:
import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine";
import type { BrowseEngine } from "$lib/shared/browse/engine/types";

const engine = createBrowseEngine({
  sections: true,
  defaultSectionGroupBy: "letter",
  persistKey: "tka-browse-gallery",
  sources: ["community", "my-library"],
});
```

- [ ] **Step 2: Remove sequenceSourceManager usage**

The engine now owns source switching. Remove `sequenceSourceManager` import and replace `sequenceSourceManager.source` references with `engine.source`. Replace `sequenceSourceManager.setSource()` calls with `engine.setSource()`.

- [ ] **Step 3: Update GalleryTab prop passing**

Replace `galleryState={galleryState}` with `{engine}` in the `<GalleryTab>` usage.

- [ ] **Step 4: Update impersonation cache invalidation**

Replace:
```typescript
galleryState.invalidateLibraryCache();
```
With:
```typescript
engine.invalidateLibraryCache();
```

- [ ] **Step 5: Initialize and destroy engine lifecycle**

In the `onMount`, add `engine.initialize()`. In `onDestroy`, add `engine.destroy()`.

- [ ] **Step 6: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/browse/shared/components/BrowseModule.svelte
git commit -m "refactor(browse): migrate BrowseModule to createBrowseEngine"
```

---

## Task 9: Gallery Migration — GalleryTab

**Files:**
- Modify: `src/lib/features/browse/shared/components/GalleryTab.svelte`

Replace the massive prop bridge to SequenceDisplayPanel with a single `<BrowsePanel>` usage. Keep gallery-specific drawers/FAB.

- [ ] **Step 1: Update Props interface**

Replace:
```typescript
type BrowseState = ReturnType<typeof createBrowseState>;
// ... galleryState: BrowseState in Props
```

With:
```typescript
import type { BrowseEngine } from "$lib/shared/browse/engine/types";
// ... engine: BrowseEngine in Props
```

- [ ] **Step 2: Replace SequenceDisplayPanel with BrowsePanel**

Remove the `<SequenceDisplayPanel>` import and usage. Replace with:

```svelte
<script>
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
</script>

<BrowsePanel
  {engine}
  layout="fullpage"
  onSelect={handleOpenViewer}
  showSourceToggle
/>
```

- [ ] **Step 3: Remove derived values that engine now owns**

Remove the `$derived` blocks for `currentLetter`, `currentLevel`, `currentLength`, `currentLoopType`, `currentGridMode`, `isFavoritesActive`, `hasActivePositions` — the engine's filter map replaces all of these. GalleryTab no longer needs to derive filter state from `galleryState.currentFilter`.

- [ ] **Step 4: Update drawer callbacks to use engine API**

Replace `galleryState.handleFilterChange(type, value)` with `engine.addFilter(type, value, label, color)` and `engine.removeFilter(type)` in the letter selection and position option sheet callbacks.

- [ ] **Step 5: Update handleOpenViewer**

The `onSelect` from BrowsePanel provides the sequence. Wire it to `openSequenceViewer()` as GalleryTab already does.

- [ ] **Step 6: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors.

- [ ] **Step 7: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/browse/shared/components/GalleryTab.svelte
git commit -m "refactor(browse): migrate GalleryTab to BrowsePanel + engine"
```

---

## Task 10: Delete Old Gallery Files

**Files:**
- Delete: `src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte`
- Delete: `src/lib/features/browse/shared/state/browse-state-factory.svelte.ts`
- Delete: `src/lib/features/browse/shared/state/sequence-source-state.svelte.ts`
- Delete: `src/lib/features/browse/shared/state/grid-zoom-state.svelte.ts`

- [ ] **Step 1: Verify no remaining imports**

Run:
```bash
grep -r "SequenceDisplayPanel" src/ --include="*.svelte" --include="*.ts" -l
grep -r "createBrowseState" src/ --include="*.svelte" --include="*.ts" -l
grep -r "sequenceSourceManager" src/ --include="*.svelte" --include="*.ts" -l
grep -r "gridZoomManager" src/ --include="*.svelte" --include="*.ts" -l
```

Expected: Each returns 0 results (or only the file being deleted). If any consumer remains, update it first.

- [ ] **Step 2: Delete files**

```bash
git rm src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte
git rm src/lib/features/browse/shared/state/browse-state-factory.svelte.ts
git rm src/lib/features/browse/shared/state/sequence-source-state.svelte.ts
git rm src/lib/features/browse/shared/state/grid-zoom-state.svelte.ts
```

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(browse): delete old gallery state files (replaced by engine)"
```

---

## Task 11: Picker Migration — SequencePickerModal

**Files:**
- Modify: `src/lib/shared/components/sequence-picker/SequencePickerModal.svelte`

Gut the 684-line file to ~80 lines. Thin shell around BrowsePanel compact mode.

- [ ] **Step 1: Rewrite SequencePickerModal**

Replace the entire file contents:

```svelte
<!-- SequencePickerModal.svelte — Thin shell around BrowsePanel compact mode -->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { getSequenceDataProvider } from "$lib/shared/sequence-viewer/getSequenceDataProvider";
  import { onDestroy } from "svelte";

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

  let initialized = $state(false);
  let isSelectingSequence = $state(false);

  $effect(() => {
    if (open && !initialized) {
      engine.initialize();
      initialized = true;
    }
  });

  onDestroy(() => engine.destroy());

  const sequenceDataProvider = getSequenceDataProvider();

  async function handleSelect(sequence: SequenceData) {
    isSelectingSequence = true;
    try {
      const fullData = await sequenceDataProvider.getFullSequenceData(sequence);
      onSelect(fullData ?? sequence);
      onClose();
    } finally {
      isSelectingSequence = false;
    }
  }
</script>

<BaseModal bind:open onclose={() => onClose()} size="xl" labelledBy="sequence-picker-title">
  {#snippet header()}
    <div class="picker-header">
      <h2 id="sequence-picker-title">{title}</h2>
      <button class="close-btn" onclick={onClose} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <div class="picker-body">
    <BrowsePanel
      {engine}
      layout="compact"
      onSelect={handleSelect}
      showSourceToggle={showSourceToggle}
      eager
    />

    {#if isSelectingSequence}
      <div class="loading-overlay">
        <ProgressRing size={40} />
      </div>
    {/if}
  </div>
</BaseModal>

<style>
  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  }

  .picker-header h2 {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    color: var(--theme-text, white);
    font-weight: 600;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .close-btn:hover {
    color: var(--theme-text, white);
    background: rgba(255, 255, 255, 0.08);
  }

  .picker-body {
    position: relative;
    height: 60vh;
    min-height: 300px;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10;
    border-radius: inherit;
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn { transition: none; }
  }
</style>
```

- [ ] **Step 2: Delete PickerToolbar**

```bash
git rm src/lib/shared/components/sequence-picker/PickerToolbar.svelte
```

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors.

- [ ] **Step 4: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds. All 11 picker consumers unchanged — same Props interface.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/components/sequence-picker/SequencePickerModal.svelte
git commit -m "refactor(browse): rewrite SequencePickerModal as thin BrowsePanel shell"
```

---

## Task 12: Card Designer Migration

**Files:**
- Modify: `src/lib/features/choreo-card/components/CardDesigner.svelte`
- Delete: `src/lib/features/choreo-card/components/designer/SequencePickerGrid.svelte`

Replace SequencePickerGrid with BrowsePanel minimal mode.

- [ ] **Step 1: Update CardDesigner**

Replace the SequencePickerGrid import and usage in `CardDesigner.svelte`:

```typescript
// REMOVE:
import SequencePickerGrid from "./designer/SequencePickerGrid.svelte";

// ADD:
import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine";
```

Create the engine with beat count constraint (the `selectedLength` state from CardDesigner feeds the constraint). Since beat count can change via length chips, recreate engine or use a derived approach. The simplest: create one engine per active `selectedLength`.

In the card designer, the length filter is a UI control. Replace the `SequencePickerGrid` component usage:

```svelte
<!-- In the picker-panel div -->
<BrowsePanel
  {engine}
  layout="minimal"
  onSelect={(seq) => handleSequenceSelect(seq)}
  eager
/>
```

The engine is created in CardDesigner's script:

```typescript
const pickerEngine = createBrowseEngine({
  constraints: selectedLength > 0 ? { beatCount: selectedLength } : undefined,
  minColumns: 1,
  maxColumns: 4,
});

$effect(() => {
  pickerEngine.initialize();
  return () => pickerEngine.destroy();
});
```

Note: Since `selectedLength` can change, the constraint needs updating. Two options:
1. Recreate engine on length change (simple, length changes are rare)
2. Use `addFilter` instead of constraints for dynamic beat count

Option 2 is cleaner — use a user filter instead of a locked constraint since the user controls it:

```typescript
const pickerEngine = createBrowseEngine({
  minColumns: 1,
  maxColumns: 4,
});

$effect(() => {
  if (selectedLength > 0) {
    pickerEngine.addFilter(BrowseFilterType.LENGTH, selectedLength, `${selectedLength} beats`, "#f59e0b");
  } else {
    pickerEngine.removeFilter(BrowseFilterType.LENGTH);
  }
});
```

- [ ] **Step 2: Delete SequencePickerGrid**

```bash
git rm src/lib/features/choreo-card/components/designer/SequencePickerGrid.svelte
```

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/CardDesigner.svelte
git commit -m "refactor(browse): migrate card designer to BrowsePanel minimal mode"
```

---

## Task 13: Cleanup — Dead Imports and Legacy Files

**Files:**
- Delete: `src/lib/features/browse/sequences/display/components/SequenceTopBarControls.svelte` (if no remaining imports)
- Delete: `src/lib/features/browse/sequences/filtering/components/inline-filter/InlineFilterPanel.svelte` (if no remaining imports)
- Clean up any dead imports across modified files

- [ ] **Step 1: Check for remaining imports**

Run:
```bash
grep -r "SequenceTopBarControls" src/ --include="*.svelte" --include="*.ts" -l
grep -r "InlineFilterPanel" src/ --include="*.svelte" --include="*.ts" -l
grep -r "PickerToolbar" src/ --include="*.svelte" --include="*.ts" -l
grep -r "SequencePickerGrid" src/ --include="*.svelte" --include="*.ts" -l
grep -r "browse-state-factory" src/ --include="*.svelte" --include="*.ts" -l
grep -r "sequence-source-state" src/ --include="*.svelte" --include="*.ts" -l
grep -r "grid-zoom-state" src/ --include="*.svelte" --include="*.ts" -l
```

Expected: 0 results for each. If any remain, update or remove the import.

- [ ] **Step 2: Delete dead files**

```bash
git rm src/lib/features/browse/sequences/display/components/SequenceTopBarControls.svelte
git rm src/lib/features/browse/sequences/filtering/components/inline-filter/InlineFilterPanel.svelte
```

- [ ] **Step 3: Run full typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "Error|error" | head -20`
Expected: 0 errors.

- [ ] **Step 4: Run full build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(browse): remove dead imports and legacy browse files"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run typecheck**

Run: `npm run check 2>&1 | tail -20`
Expected: 0 errors.

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Verify file count**

Run:
```bash
find src/lib/shared/browse -type f | wc -l
```
Expected: 7 files (types.ts, createBrowseEngine.ts, BrowsePanel.svelte, BrowseToolbar.svelte, BrowseFilterBar.svelte, BrowseSidebar.svelte, BrowseGrid.svelte).

- [ ] **Step 4: Verify deleted files are gone**

Run:
```bash
ls src/lib/features/browse/shared/state/browse-state-factory.svelte.ts 2>&1
ls src/lib/features/browse/shared/state/sequence-source-state.svelte.ts 2>&1
ls src/lib/features/browse/shared/state/grid-zoom-state.svelte.ts 2>&1
ls src/lib/shared/components/sequence-picker/PickerToolbar.svelte 2>&1
ls src/lib/features/choreo-card/components/designer/SequencePickerGrid.svelte 2>&1
ls src/lib/features/browse/sequences/display/components/SequenceDisplayPanel.svelte 2>&1
```
Expected: All return "No such file or directory".

- [ ] **Step 5: Commit final state**

Only if there are remaining uncommitted changes from verification cleanup:

```bash
git add -A
git commit -m "chore(browse): final verification cleanup"
```
