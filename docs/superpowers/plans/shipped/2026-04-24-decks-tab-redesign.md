# Decks Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the drill-down sidebar + sequential filter UX with a full-width filter-chip bar and grouped deck grid that shows all 420 decks immediately on load.

**Architecture:** New `createDeckBrowseState()` factory replaces `createDrillDownState()`. Filter chips use existing `FilterChipBase` from the browse feature (toggle mode). Decks render in a responsive CSS Grid grouped by loop type (LOOPs) or VTG family (VTG), with `max-width: 1200px` centered container. The deck interior (sequence viewing, print preview) is untouched.

**Tech Stack:** Svelte 5 (`$state`, `$derived`, `$effect`), CSS Grid, localStorage, existing `FilterChipBase`/`FilterChipRow` primitives, `LOOP_TYPE_LABELS` from circular-models, vitest for state logic tests.

**Spec:** `docs/superpowers/specs/2026-04-23-decks-tab-redesign-design.md`

---

## File Map

**New files:**
| File | Responsibility |
|------|---------------|
| `src/lib/features/choreo-card/state/deck-browse-types.ts` | Filter state, available filters, persistence, VTG family labels |
| `src/lib/features/choreo-card/state/deck-browse-state.svelte.ts` | Reactive state factory: collection, filters, grouping, localStorage |
| `src/lib/features/choreo-card/context/deck-browse-context.ts` | Svelte context wrapper for browse state |
| `src/lib/features/choreo-card/components/DeckBrowseFilterBar.svelte` | Collection toggle + multi-select filter chips |
| `src/lib/features/choreo-card/components/DeckBrowseGrid.svelte` | Grouped responsive grid of DeckCards |
| `tests/unit/deck-browse/deck-browse-filters.test.ts` | Unit tests for filter + grouping logic |

**Modified files:**
| File | Change |
|------|--------|
| `src/lib/features/choreo-card/components/DeckCard.svelte` | Rewrite: vertical → horizontal layout with reversal dots right |
| `src/lib/features/choreo-card/components/DeckBrowser.svelte` | Rewrite browse layer (drilldown → filter+grid); keep interior intact |
| `src/lib/features/choreo-card/components/ChoreoCardTab.svelte` | Remove drilldown wiring, simplify back-navigation |

**Deleted files (Task 8):**
| Path | Reason |
|------|--------|
| `src/lib/features/choreo-card/components/drilldown/` (23 files) | Entire directory replaced by filter bar + grid |
| `src/lib/features/choreo-card/state/deck-drilldown-state.svelte.ts` | Replaced by deck-browse-state |
| `src/lib/features/choreo-card/state/deck-drilldown-types.ts` | Replaced by deck-browse-types |
| `src/lib/features/choreo-card/context/deck-drilldown-context.ts` | Replaced by deck-browse-context |

---

### Task 1: Types + Context (foundation)

**Files:**
- Create: `src/lib/features/choreo-card/state/deck-browse-types.ts`
- Create: `src/lib/features/choreo-card/context/deck-browse-context.ts`

- [ ] **Step 1: Create `deck-browse-types.ts`**

```typescript
// src/lib/features/choreo-card/state/deck-browse-types.ts

export interface FilterState {
  loopTypes: string[];
  vtgFamilies: string[];
  sliceTypes: string[];
  gridModes: string[];
  stepCounts: number[];
  turnPatterns: string[];
}

export interface AvailableFilters {
  loopTypes: string[];
  vtgFamilies: string[];
  sliceTypes: string[];
  gridModes: string[];
  stepCounts: number[];
  turnPatterns: string[];
}

export interface SavedDeckBrowseState {
  collection: 'LOOPs' | 'VTG';
  filters: FilterState;
  scrollY: number;
}

export const EMPTY_FILTERS: FilterState = {
  loopTypes: [],
  vtgFamilies: [],
  sliceTypes: [],
  gridModes: [],
  stepCounts: [],
  turnPatterns: [],
};

export const VTG_FAMILY_LABELS: Record<string, string> = {
  'split-same': 'Split-Same',
  'tog-same': 'Tog-Same',
  'split-opp': 'Split-Opp',
  'tog-opp': 'Tog-Opp',
  'quarter-same': 'Quarter-Same',
  'quarter-opp': 'Quarter-Opp',
};

export const VTG_FAMILY_KEYS = Object.keys(VTG_FAMILY_LABELS);
```

- [ ] **Step 2: Create `deck-browse-context.ts`**

```typescript
// src/lib/features/choreo-card/context/deck-browse-context.ts

import { getContext, setContext } from 'svelte';
import type { DeckBrowseState } from '../state/deck-browse-state.svelte';

const KEY = Symbol('deck-browse');

export function setBrowseContext(state: DeckBrowseState) {
  setContext(KEY, state);
}

export function getBrowseContext(): DeckBrowseState {
  return getContext<DeckBrowseState>(KEY);
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from new files (context file may warn about unresolved import until Task 2 creates the state file — that's fine, proceed).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/state/deck-browse-types.ts src/lib/features/choreo-card/context/deck-browse-context.ts
git commit -m "feat(decks): add browse types and context for deck tab redesign"
```

---

### Task 2: State Factory + Tests

**Files:**
- Create: `tests/unit/deck-browse/deck-browse-filters.test.ts`
- Create: `src/lib/features/choreo-card/state/deck-browse-state.svelte.ts`

- [ ] **Step 1: Write failing tests for filter logic**

```typescript
// tests/unit/deck-browse/deck-browse-filters.test.ts

import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  computeAvailableFilters,
  groupDecks,
  toggleInArray,
  inferVtgFamily,
} from '$lib/features/choreo-card/state/deck-browse-state.svelte';
import { EMPTY_FILTERS } from '$lib/features/choreo-card/state/deck-browse-types';
import type { Deck } from '$lib/features/choreo-card/domain/models/Deck';

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: overrides.id ?? 'deck-1',
    name: 'Test',
    canonicalName: 'test',
    description: '',
    families: overrides.families ?? [{ id: 'fam-1', label: 'Fam', typeCombo: 'pro-iso', sequenceIds: ['s1'] }],
    totalSequences: overrides.totalSequences ?? 10,
    gridMode: overrides.gridMode ?? 'diamond',
    level: 1,
    collection: overrides.collection ?? 'LOOPs',
    loopType: overrides.loopType ?? 'rotated',
    sliceType: overrides.sliceType ?? 'halved',
    stepCount: overrides.stepCount ?? 4,
    turnPattern: overrides.turnPattern ?? 'uniform-0t',
    reversalPattern: overrides.reversalPattern ?? 'continuous',
  } as Deck;
}

describe('toggleInArray', () => {
  it('adds value when not present', () => {
    expect(toggleInArray(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });

  it('removes value when present', () => {
    expect(toggleInArray(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('works with numbers', () => {
    expect(toggleInArray([4, 6], 8)).toEqual([4, 6, 8]);
    expect(toggleInArray([4, 6, 8], 6)).toEqual([4, 8]);
  });
});

describe('applyFilters', () => {
  const decks = [
    makeDeck({ id: '1', loopType: 'rotated', stepCount: 4, sliceType: 'halved', gridMode: 'diamond' }),
    makeDeck({ id: '2', loopType: 'mirrored', stepCount: 4, sliceType: 'halved', gridMode: 'diamond' }),
    makeDeck({ id: '3', loopType: 'rotated', stepCount: 8, sliceType: 'quartered', gridMode: 'box' }),
    makeDeck({ id: '4', loopType: 'flipped', stepCount: 6, sliceType: 'halved', gridMode: 'diamond' }),
  ];

  it('returns all decks with empty filters', () => {
    const result = applyFilters(decks, EMPTY_FILTERS, 'LOOPs');
    expect(result).toHaveLength(4);
  });

  it('filters by loopType (OR within dimension)', () => {
    const filters = { ...EMPTY_FILTERS, loopTypes: ['rotated', 'flipped'] };
    const result = applyFilters(decks, filters, 'LOOPs');
    expect(result.map(d => d.id)).toEqual(['1', '3', '4']);
  });

  it('filters by stepCount', () => {
    const filters = { ...EMPTY_FILTERS, stepCounts: [4] };
    const result = applyFilters(decks, filters, 'LOOPs');
    expect(result.map(d => d.id)).toEqual(['1', '2']);
  });

  it('AND across dimensions', () => {
    const filters = { ...EMPTY_FILTERS, loopTypes: ['rotated'], stepCounts: [8] };
    const result = applyFilters(decks, filters, 'LOOPs');
    expect(result.map(d => d.id)).toEqual(['3']);
  });

  it('returns empty when no match', () => {
    const filters = { ...EMPTY_FILTERS, loopTypes: ['rotated'], stepCounts: [6] };
    const result = applyFilters(decks, filters, 'LOOPs');
    expect(result).toHaveLength(0);
  });
});

describe('applyFilters VTG', () => {
  const decks = [
    makeDeck({
      id: 'v1', collection: 'VTG',
      families: [{ id: 'split-same-pro-iso', label: 'SS', typeCombo: 'pro-iso', sequenceIds: ['s1'] }],
    }),
    makeDeck({
      id: 'v2', collection: 'VTG',
      families: [{ id: 'tog-opp-anti-iso', label: 'TO', typeCombo: 'anti-iso', sequenceIds: ['s2'] }],
    }),
  ];

  it('filters VTG by vtgFamilies', () => {
    const filters = { ...EMPTY_FILTERS, vtgFamilies: ['split-same'] };
    const result = applyFilters(decks, filters, 'VTG');
    expect(result.map(d => d.id)).toEqual(['v1']);
  });
});

describe('groupDecks', () => {
  const decks = [
    makeDeck({ id: '1', loopType: 'rotated' }),
    makeDeck({ id: '2', loopType: 'mirrored' }),
    makeDeck({ id: '3', loopType: 'rotated' }),
  ];

  it('groups LOOPs by loopType', () => {
    const groups = groupDecks(decks, 'LOOPs');
    expect(groups.size).toBe(2);
    expect(groups.get('rotated')?.map(d => d.id)).toEqual(['1', '3']);
    expect(groups.get('mirrored')?.map(d => d.id)).toEqual(['2']);
  });
});

describe('inferVtgFamily', () => {
  it('infers from family id', () => {
    const deck = makeDeck({
      families: [{ id: 'quarter-opp-anti-iso', label: 'QO', typeCombo: 'anti-iso', sequenceIds: ['s1'] }],
    });
    expect(inferVtgFamily(deck)).toBe('quarter-opp');
  });

  it('falls back to loopType when no family matches', () => {
    const deck = makeDeck({ loopType: 'rotated', families: [{ id: 'custom', label: 'C', typeCombo: 'c', sequenceIds: [] }] });
    expect(inferVtgFamily(deck)).toBe('rotated');
  });
});

describe('computeAvailableFilters', () => {
  const decks = [
    makeDeck({ loopType: 'rotated', stepCount: 4, sliceType: 'halved', gridMode: 'diamond', turnPattern: 'uniform-0t' }),
    makeDeck({ loopType: 'mirrored', stepCount: 8, sliceType: 'quartered', gridMode: 'box', turnPattern: 'uniform-1t' }),
  ];

  it('extracts unique values for LOOPs', () => {
    const av = computeAvailableFilters(decks, 'LOOPs');
    expect(av.loopTypes).toEqual(['mirrored', 'rotated']);
    expect(av.stepCounts).toEqual([4, 8]);
    expect(av.sliceTypes).toEqual(['halved', 'quartered']);
    expect(av.gridModes).toEqual(['box', 'diamond']);
    expect(av.turnPatterns).toEqual(['uniform-0t', 'uniform-1t']);
    expect(av.vtgFamilies).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/deck-browse/ --reporter verbose 2>&1 | tail -20`
Expected: FAIL — module not found (`deck-browse-state.svelte` doesn't exist yet).

- [ ] **Step 3: Create `deck-browse-state.svelte.ts`**

```typescript
// src/lib/features/choreo-card/state/deck-browse-state.svelte.ts

import type { Deck } from '../domain/models/Deck';
import type { FilterState, AvailableFilters, SavedDeckBrowseState } from './deck-browse-types';
import { EMPTY_FILTERS, VTG_FAMILY_KEYS } from './deck-browse-types';

const STORAGE_KEY = 'deckBrowser.state';
const DEBOUNCE_MS = 300;

function loadFromStorage(): SavedDeckBrowseState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedDeckBrowseState;
  } catch {
    return null;
  }
}

function saveToStorage(state: SavedDeckBrowseState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded */ }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function toggleInArray<T>(arr: T[], value: T): T[] {
  const index = arr.indexOf(value);
  if (index >= 0) return [...arr.slice(0, index), ...arr.slice(index + 1)];
  return [...arr, value];
}

export function applyFilters(decks: Deck[], filters: FilterState, collection: 'LOOPs' | 'VTG'): Deck[] {
  let result = decks;

  if (collection === 'LOOPs' && filters.loopTypes.length > 0) {
    result = result.filter(d => filters.loopTypes.includes(d.loopType));
  }

  if (collection === 'VTG' && filters.vtgFamilies.length > 0) {
    result = result.filter(d =>
      filters.vtgFamilies.some(family =>
        d.families.some(f => f.id.toLowerCase().includes(family))
      )
    );
  }

  if (filters.sliceTypes.length > 0) {
    result = result.filter(d => filters.sliceTypes.includes(d.sliceType));
  }
  if (filters.gridModes.length > 0) {
    result = result.filter(d => filters.gridModes.includes(d.gridMode));
  }
  if (filters.stepCounts.length > 0) {
    result = result.filter(d => filters.stepCounts.includes(d.stepCount));
  }
  if (filters.turnPatterns.length > 0) {
    result = result.filter(d => filters.turnPatterns.includes(d.turnPattern));
  }

  return result;
}

export function computeAvailableFilters(decks: Deck[], collection: 'LOOPs' | 'VTG'): AvailableFilters {
  return {
    loopTypes: collection === 'LOOPs' ? unique(decks.map(d => d.loopType)).sort() : [],
    vtgFamilies: collection === 'VTG'
      ? VTG_FAMILY_KEYS.filter(key => decks.some(d => d.families.some(f => f.id.toLowerCase().includes(key))))
      : [],
    sliceTypes: unique(decks.map(d => d.sliceType)).sort(),
    gridModes: unique(decks.map(d => d.gridMode)).sort(),
    stepCounts: unique(decks.map(d => d.stepCount)).sort((a, b) => a - b),
    turnPatterns: unique(decks.map(d => d.turnPattern)).sort(),
  };
}

export function inferVtgFamily(deck: Deck): string {
  for (const key of VTG_FAMILY_KEYS) {
    if (deck.families.some(f => f.id.toLowerCase().includes(key))) return key;
  }
  return deck.loopType || 'unknown';
}

export function groupDecks(decks: Deck[], collection: 'LOOPs' | 'VTG'): Map<string, Deck[]> {
  const groups = new Map<string, Deck[]>();
  for (const deck of decks) {
    const key = collection === 'LOOPs' ? deck.loopType : inferVtgFamily(deck);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(deck);
  }
  return groups;
}

export function createDeckBrowseState(allDecksOrGetter: Deck[] | (() => Deck[])) {
  const getAllDecks = typeof allDecksOrGetter === 'function' ? allDecksOrGetter : () => allDecksOrGetter;

  const saved = typeof window !== 'undefined' ? loadFromStorage() : null;

  let collection = $state<'LOOPs' | 'VTG'>(saved?.collection ?? 'LOOPs');
  let filters = $state<FilterState>(saved?.filters ? { ...saved.filters } : { ...EMPTY_FILTERS });
  let scrollY = $state(saved?.scrollY ?? 0);

  const collectionDecks = $derived(getAllDecks().filter(d => d.collection === collection));
  const filteredDecks = $derived(applyFilters(collectionDecks, filters, collection));
  const groupedDecks = $derived(groupDecks(filteredDecks, collection));
  const availableFilters = $derived(computeAvailableFilters(collectionDecks, collection));
  const totalCount = $derived(filteredDecks.length);
  const totalSequences = $derived(filteredDecks.reduce((sum, d) => sum + d.totalSequences, 0));

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const snapshot: SavedDeckBrowseState = { collection, filters, scrollY };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveToStorage(snapshot), DEBOUNCE_MS);
  });

  return {
    get collection() { return collection; },
    get filters() { return filters; },
    get filteredDecks() { return filteredDecks; },
    get groupedDecks() { return groupedDecks; },
    get availableFilters() { return availableFilters; },
    get totalCount() { return totalCount; },
    get totalSequences() { return totalSequences; },
    get scrollY() { return scrollY; },

    setCollection(c: 'LOOPs' | 'VTG') {
      collection = c;
      filters = { ...EMPTY_FILTERS };
      scrollY = 0;
    },

    toggleFilter(dimension: keyof FilterState, value: string | number) {
      const current = filters[dimension] as (string | number)[];
      filters = { ...filters, [dimension]: toggleInArray(current, value) };
    },

    clearFilters() {
      filters = { ...EMPTY_FILTERS };
    },

    setScrollY(y: number) {
      scrollY = y;
    },
  };
}

export type DeckBrowseState = ReturnType<typeof createDeckBrowseState>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/deck-browse/ --reporter verbose 2>&1 | tail -30`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/state/deck-browse-state.svelte.ts tests/unit/deck-browse/deck-browse-filters.test.ts
git commit -m "feat(decks): add browse state factory with filter logic and tests"
```

---

### Task 3: DeckCard Rewrite

**Files:**
- Modify: `src/lib/features/choreo-card/components/DeckCard.svelte`

- [ ] **Step 1: Rewrite DeckCard with horizontal layout**

Replace the entire file. Horizontal layout: placeholder pictograph left, name + meta center, reversal dot strip right. No `translateY` on hover (spec: border-color only). New `tags` prop for context-determined labels.

```svelte
<!-- src/lib/features/choreo-card/components/DeckCard.svelte -->
<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import { getReversalPattern } from "../domain/reversal-patterns";

  interface Props {
    deck: Deck;
    tags: string;
    onSelect: () => void;
  }

  const { deck, tags, onSelect }: Props = $props();

  const patternDef = $derived(
    deck.reversalPattern ? getReversalPattern(deck.reversalPattern) : null
  );

  const displayLabel = $derived(patternDef?.label ?? "Continuous");

  const displaySymbols = $derived(
    patternDef
      ? patternDef.sequence.slice(0, Math.min(8, patternDef.period)).split("")
      : ["-", "-", "-", "-"]
  );

  function getDotPair(symbol: string): [boolean, boolean] {
    switch (symbol) {
      case "P": return [true, true];
      case "R": return [true, false];
      case "B": return [false, true];
      default:  return [false, false];
    }
  }

  function formatCount(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }
</script>

<button
  type="button"
  class="deck-card"
  aria-label="Open {displayLabel} deck with {deck.totalSequences} sequences"
  onclick={onSelect}
>
  <div class="card-picto" aria-hidden="true">
    <svg viewBox="0 0 36 36" width="36" height="36">
      <circle cx="18" cy="4" r="3" fill="rgba(255,255,255,0.15)" />
      <circle cx="32" cy="18" r="3" fill="rgba(255,255,255,0.15)" />
      <circle cx="18" cy="32" r="3" fill="rgba(255,255,255,0.15)" />
      <circle cx="4" cy="18" r="3" fill="rgba(255,255,255,0.15)" />
    </svg>
  </div>

  <div class="card-center">
    <span class="card-name">{displayLabel}</span>
    <span class="card-meta">
      {formatCount(deck.totalSequences)} seq · {deck.stepCount}-step{#if tags} · {tags}{/if}
    </span>
  </div>

  <div class="card-dots">
    {#each displaySymbols as symbol}
      {@const [redDot, blueDot] = getDotPair(symbol)}
      <div class="dot-col">
        <div class="dot" class:red={redDot} class:empty={!redDot}></div>
        <div class="dot" class:blue={blueDot} class:empty={!blueDot}></div>
      </div>
    {/each}
  </div>
</button>

<style>
  .deck-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    text-align: left;
    width: 100%;
    font: inherit;
    transition: border-color 0.15s ease;
  }

  .deck-card:hover {
    border-color: var(--accent, #63b7cd);
  }

  .deck-card:focus-visible {
    outline: 2px solid var(--accent, #63b7cd);
    outline-offset: 2px;
  }

  .card-picto {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
  }

  .card-center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-name {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    line-height: 1.3;
  }

  .card-dots {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
  }

  .dot-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .dot.red { background: var(--prop-red, #e74c3c); }
  .dot.blue { background: var(--prop-blue, #3498db); }
  .dot.empty { background: rgba(255, 255, 255, 0.08); }

  @media (max-width: 768px) {
    .card-picto { width: 28px; height: 28px; }
    .card-picto :global(svg) { width: 28px; height: 28px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .deck-card { transition: none; }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check 2>&1 | tail -20`
Expected: May produce errors from existing consumers passing old props — those get fixed in Task 6. Confirm the DeckCard file itself has no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckCard.svelte
git commit -m "feat(decks): rewrite DeckCard with horizontal layout and context tags"
```

---

### Task 4: DeckBrowseFilterBar

**Files:**
- Create: `src/lib/features/choreo-card/components/DeckBrowseFilterBar.svelte`

Reuses existing primitives:
- `FilterChipBase` at `src/lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte` — toggle mode
- `FilterChipRow` at `src/lib/features/browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte` — horizontal scrollable row

- [ ] **Step 1: Create DeckBrowseFilterBar**

```svelte
<!-- src/lib/features/choreo-card/components/DeckBrowseFilterBar.svelte -->
<script lang="ts">
  import type { DeckBrowseState } from "../state/deck-browse-state.svelte";
  import FilterChipBase from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte";
  import FilterChipRow from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte";
  import { LOOP_TYPE_LABELS } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { VTG_FAMILY_LABELS } from "../state/deck-browse-types";

  interface Props {
    state: DeckBrowseState;
  }

  const { state }: Props = $props();

  let filtersExpanded = $state(true);

  function loopTypeLabel(type: string): string {
    return (LOOP_TYPE_LABELS as Record<string, string>)[type] ?? capitalize(type);
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatTurn(turn: string): string {
    const m = turn.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
    return m ? `${m[1]}T` : capitalize(turn.replace(/-/g, ' '));
  }

  const chipColor = $derived(state.collection === 'VTG' ? '#b763cd' : '#63b7cd');

  const hasActiveFilters = $derived(
    state.filters.loopTypes.length > 0 ||
    state.filters.vtgFamilies.length > 0 ||
    state.filters.sliceTypes.length > 0 ||
    state.filters.gridModes.length > 0 ||
    state.filters.stepCounts.length > 0 ||
    state.filters.turnPatterns.length > 0
  );
</script>

<div class="filter-bar">
  <div class="filter-header">
    <div class="collection-toggle">
      <button
        class="collection-pill"
        class:active={state.collection === 'LOOPs'}
        onclick={() => state.setCollection('LOOPs')}
        type="button"
      >LOOPs</button>
      <button
        class="collection-pill vtg"
        class:active={state.collection === 'VTG'}
        onclick={() => state.setCollection('VTG')}
        type="button"
      >VTG</button>
    </div>

    <span class="deck-count">{state.totalCount} decks</span>

    <button
      class="collapse-toggle mobile-only"
      onclick={() => { filtersExpanded = !filtersExpanded; }}
      type="button"
      aria-label={filtersExpanded ? 'Collapse filters' : 'Expand filters'}
    >
      <i class="fas fa-chevron-{filtersExpanded ? 'up' : 'down'}" aria-hidden="true"></i>
    </button>
  </div>

  {#if filtersExpanded}
    <div class="filter-rows">
      <FilterChipRow>
        {#if state.collection === 'LOOPs'}
          {#each state.availableFilters.loopTypes as type (type)}
            <FilterChipBase
              label={loopTypeLabel(type)}
              active={state.filters.loopTypes.includes(type)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => state.toggleFilter('loopTypes', type)}
            />
          {/each}
        {:else}
          {#each state.availableFilters.vtgFamilies as family (family)}
            <FilterChipBase
              label={VTG_FAMILY_LABELS[family] ?? capitalize(family)}
              active={state.filters.vtgFamilies.includes(family)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => state.toggleFilter('vtgFamilies', family)}
            />
          {/each}
        {/if}
      </FilterChipRow>

      <FilterChipRow>
        {#each state.availableFilters.sliceTypes as slice (slice)}
          <FilterChipBase
            label={capitalize(slice)}
            active={state.filters.sliceTypes.includes(slice)}
            mode="toggle"
            chipColor={chipColor}
            onclick={() => state.toggleFilter('sliceTypes', slice)}
          />
        {/each}

        {#if state.availableFilters.gridModes.length > 1}
          <span class="chip-divider" aria-hidden="true">·</span>
          {#each state.availableFilters.gridModes as grid (grid)}
            <FilterChipBase
              label={capitalize(grid)}
              active={state.filters.gridModes.includes(grid)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => state.toggleFilter('gridModes', grid)}
            />
          {/each}
        {/if}

        {#if state.availableFilters.stepCounts.length > 1}
          <span class="chip-divider" aria-hidden="true">·</span>
          {#each state.availableFilters.stepCounts as count (count)}
            <FilterChipBase
              label="{count}"
              active={state.filters.stepCounts.includes(count)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => state.toggleFilter('stepCounts', count)}
            />
          {/each}
        {/if}

        {#if state.availableFilters.turnPatterns.length > 1}
          <span class="chip-divider" aria-hidden="true">·</span>
          {#each state.availableFilters.turnPatterns as turn (turn)}
            <FilterChipBase
              label={formatTurn(turn)}
              active={state.filters.turnPatterns.includes(turn)}
              mode="toggle"
              chipColor={chipColor}
              onclick={() => state.toggleFilter('turnPatterns', turn)}
            />
          {/each}
        {/if}
      </FilterChipRow>

      {#if hasActiveFilters}
        <button class="clear-btn" onclick={() => state.clearFilters()} type="button">
          <i class="fas fa-times" aria-hidden="true"></i> Clear filters
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .filter-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .collection-toggle {
    display: flex;
  }

  .collection-pill {
    padding: 8px 18px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .collection-pill:first-child { border-radius: 8px 0 0 8px; }
  .collection-pill:last-child { border-radius: 0 8px 8px 0; border-left: 0; }

  .collection-pill.active {
    background: rgba(99, 183, 205, 0.15);
    border-color: rgba(99, 183, 205, 0.4);
    color: var(--theme-text, #fff);
  }

  .collection-pill.vtg.active {
    background: rgba(183, 99, 205, 0.15);
    border-color: rgba(183, 99, 205, 0.4);
  }

  .deck-count {
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-left: auto;
  }

  .filter-rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .chip-divider {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.2));
    font-size: 16px;
    padding: 0 4px;
    user-select: none;
  }

  .clear-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .clear-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .collapse-toggle { display: none; }

  @media (max-width: 768px) {
    .filter-bar { padding: 12px 16px; }
    .collapse-toggle.mobile-only { display: block; background: none; border: none; color: var(--theme-text-muted); font-size: 14px; cursor: pointer; padding: 8px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .collection-pill, .clear-btn { transition: none; }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check 2>&1 | tail -20`
Expected: No errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckBrowseFilterBar.svelte
git commit -m "feat(decks): add filter bar with collection toggle and multi-select chips"
```

---

### Task 5: DeckBrowseGrid

**Files:**
- Create: `src/lib/features/choreo-card/components/DeckBrowseGrid.svelte`

- [ ] **Step 1: Create DeckBrowseGrid**

Groups decks by loop type (LOOPs) or VTG family. Each group gets a header with name + horizontal rule + deck count. Uses the context-determined tags pattern from the old `DeckResultsPanel.varyingAxes`, computed per-group.

```svelte
<!-- src/lib/features/choreo-card/components/DeckBrowseGrid.svelte -->
<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import DeckCard from "./DeckCard.svelte";
  import { LOOP_TYPE_LABELS } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { VTG_FAMILY_LABELS } from "../state/deck-browse-types";

  interface Props {
    groupedDecks: Map<string, Deck[]>;
    collection: 'LOOPs' | 'VTG';
    onSelectDeck: (deck: Deck) => void;
  }

  const { groupedDecks, collection, onSelectDeck }: Props = $props();

  function groupLabel(key: string): string {
    if (collection === 'LOOPs') {
      return (LOOP_TYPE_LABELS as Record<string, string>)[key] ?? capitalize(key);
    }
    return VTG_FAMILY_LABELS[key] ?? capitalize(key);
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatTurn(turn: string): string {
    const m = turn.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
    return m ? `${m[1]}T` : capitalize(turn.replace(/-/g, ' '));
  }

  function computeVaryingAxes(decks: Deck[]) {
    if (decks.length <= 1) return { stepCount: false, turn: false, reversal: false, slice: false, grid: false };
    return {
      stepCount: new Set(decks.map(d => d.stepCount)).size > 1,
      turn: new Set(decks.map(d => d.turnPattern)).size > 1,
      reversal: new Set(decks.map(d => d.reversalPattern)).size > 1,
      slice: new Set(decks.map(d => d.sliceType)).size > 1,
      grid: new Set(decks.map(d => d.gridMode)).size > 1,
    };
  }

  function contextTags(deck: Deck, axes: ReturnType<typeof computeVaryingAxes>): string {
    const parts: string[] = [];
    if (axes.stepCount) parts.push(`${deck.stepCount}-step`);
    if (axes.slice) parts.push(capitalize(deck.sliceType));
    if (axes.turn) parts.push(formatTurn(deck.turnPattern));
    if (axes.grid) parts.push(capitalize(deck.gridMode));
    if (parts.length === 0 && !axes.reversal) {
      parts.push(formatTurn(deck.turnPattern));
    }
    return parts.join(' · ');
  }
</script>

<div class="browse-grid-container">
  {#each [...groupedDecks.entries()] as [key, decks] (key)}
    {@const axes = computeVaryingAxes(decks)}
    <section class="deck-group">
      <div class="group-header">
        <span class="group-name">{groupLabel(key)}</span>
        <span class="group-rule" aria-hidden="true"></span>
        <span class="group-count">{decks.length} {decks.length === 1 ? 'deck' : 'decks'}</span>
      </div>
      <div class="deck-grid">
        {#each decks as deck (deck.id)}
          <DeckCard
            {deck}
            tags={contextTags(deck, axes)}
            onSelect={() => onSelectDeck(deck)}
          />
        {/each}
      </div>
    </section>
  {/each}

  {#if groupedDecks.size === 0}
    <div class="empty-state">
      <i class="fas fa-search empty-icon" aria-hidden="true"></i>
      <p class="empty-text">No decks match these filters</p>
    </div>
  {/if}
</div>

<style>
  .browse-grid-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .deck-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .group-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, #fff);
    white-space: nowrap;
  }

  .group-rule {
    flex: 1;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .group-count {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    white-space: nowrap;
  }

  .deck-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 24px;
    text-align: center;
  }

  .empty-icon {
    font-size: 2.5rem;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.2));
  }

  .empty-text {
    margin: 0;
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  @media (max-width: 768px) {
    .browse-grid-container { padding: 16px; gap: 24px; }
    .deck-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check 2>&1 | tail -20`
Expected: No errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckBrowseGrid.svelte
git commit -m "feat(decks): add grouped responsive grid for deck browsing"
```

---

### Task 6: DeckBrowser Rewrite

**Files:**
- Modify: `src/lib/features/choreo-card/components/DeckBrowser.svelte`

Replace the drilldown browse layer with the new FilterBar + Grid. The deck interior snippet (lines ~492–700 in the current file) stays **unchanged** — copy it exactly. All interior state management stays.

**What gets removed:**
- Imports: `DeckDrillDown`, `DeckFilterSidebar`, `DeckResultsPanel`, `createDrillDownState`, `setDrillDownContext`
- `drillState` creation and context setting
- `handleSidebarDeckSelect` function
- Desktop sync `$effect` (lines 95–107)
- Desktop split layout template
- Mobile `DeckDrillDown` rendering

**What gets added:**
- Imports: `DeckBrowseFilterBar`, `DeckBrowseGrid`, `createDeckBrowseState`, `setBrowseContext`
- `browseState` creation
- `handleBrowseDeckSelect` function
- Scroll position persistence
- Unified browse template (same on desktop + mobile, responsive via CSS)

**What stays unchanged:**
- All interior state: `viewMode`, `cardSize`, `selectedTheme`, `isExporting`, `renderedPairs`, etc.
- All VTG lookups: `VTG_ABBREVIATIONS`, `TURNS_TO_RATIO`, etc.
- All interior functions: `handleExportPDF`, `handleExportZIP`, `groupByStartPosition`, etc.
- The `deckInterior()` snippet and its entire template
- The `CardInspectModal` rendering
- The `isDesktop` detection (still used for interior breadcrumb vs. no breadcrumb)
- All interior styles

- [ ] **Step 1: Update imports section**

In `DeckBrowser.svelte`, replace the drilldown imports (lines 14–19) with browse imports:

Old:
```typescript
  import DeckDrillDown from "./drilldown/DeckDrillDown.svelte";
  import DeckFilterSidebar from "./drilldown/sidebar/DeckFilterSidebar.svelte";
  import DeckResultsPanel from "./drilldown/DeckResultsPanel.svelte";
  import { createDrillDownState } from "../state/deck-drilldown-state.svelte";
  import { setDrillDownContext } from "../context/deck-drilldown-context";
```

New:
```typescript
  import DeckBrowseFilterBar from "./DeckBrowseFilterBar.svelte";
  import DeckBrowseGrid from "./DeckBrowseGrid.svelte";
  import { createDeckBrowseState } from "../state/deck-browse-state.svelte";
  import { setBrowseContext } from "../context/deck-browse-context";
```

- [ ] **Step 2: Replace drilldown state with browse state**

Remove the drilldown state block (lines 77–107):

```typescript
  // OLD — delete:
  const drillState = createDrillDownState(() => decks);
  setDrillDownContext(drillState);
  function handleSidebarDeckSelect(deck) { ... }
  $effect(() => { if (!isDesktop) return; ... });
```

Replace with:

```typescript
  const browseState = createDeckBrowseState(() => decks);
  setBrowseContext(browseState);

  let scrollContainer: HTMLDivElement | null = $state(null);

  function handleBrowseDeckSelect(deck: Deck) {
    onSelectDeck(deck.id, null);
  }

  function handleBrowseScroll() {
    if (scrollContainer && !selectedDeckId) {
      browseState.setScrollY(scrollContainer.scrollTop);
    }
  }

  $effect(() => {
    if (scrollContainer && !selectedDeckId && browseState.scrollY > 0) {
      requestAnimationFrame(() => {
        scrollContainer?.scrollTo(0, browseState.scrollY);
      });
    }
  });
```

- [ ] **Step 3: Replace the template**

Replace the main template block (lines 429–489) with:

```svelte
<div class="deck-browser" bind:this={scrollContainer} onscroll={handleBrowseScroll}>
  {#if selectedDeck || (selectedDeckId && decks.length === 0)}
    {#if !selectedDeck}
      <div class="loading" role="status" aria-live="polite">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Loading deck...
      </div>
    {:else}
      <div class="level-container level-interior">
        <div class="top-bar">
          <nav class="breadcrumb" aria-label="Deck navigation">
            <button class="crumb" onclick={onBackToCollections} type="button">
              <i class="fas fa-arrow-left" aria-hidden="true" style="margin-right:6px;font-size:11px;"></i>
              Back to browser
            </button>
            <span class="crumb-sep" aria-hidden="true">›</span>
            <span class="crumb current">{tkaDesignation}</span>
            {#if vtgDesignation}
              <span class="crumb-sep" aria-hidden="true">·</span>
              <span class="crumb vtg-label">{vtgDesignation}</span>
            {/if}
          </nav>
        </div>
        {@render deckInterior()}
      </div>
    {/if}
  {:else if isLoading || decks.length === 0}
    <div class="loading" role="status" aria-live="polite">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      Loading decks...
    </div>
  {:else}
    <DeckBrowseFilterBar state={browseState} />
    <DeckBrowseGrid
      groupedDecks={browseState.groupedDecks}
      collection={browseState.collection}
      onSelectDeck={handleBrowseDeckSelect}
    />
  {/if}
</div>
```

- [ ] **Step 4: Remove unused styles**

Delete these style blocks that were only used by the drilldown desktop split:

```css
  .desktop-split { ... }
  .desktop-right-panel { ... }
```

Remove the `class:desktop-integrated={isDesktop}` from the root div (it's now just `class="deck-browser"`).

- [ ] **Step 5: Run typecheck**

Run: `npm run check 2>&1 | tail -30`
Expected: Clean or only unrelated existing warnings. Fix any type errors from the refactoring.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckBrowser.svelte
git commit -m "feat(decks): rewrite DeckBrowser with filter bar + grouped grid, keep interior"
```

---

### Task 7: ChoreoCardTab Cleanup

**Files:**
- Modify: `src/lib/features/choreo-card/components/ChoreoCardTab.svelte`

Remove drilldown-era state that's now managed by the browse state factory.

- [ ] **Step 1: Remove `selectedCollection` state and related code**

Delete these lines:

```typescript
  const STORAGE_KEY_SELECTED_COLLECTION = "choreoCard.selectedCollection";
  // ...
  let selectedCollection = $state<string | null>(getPersistedString(STORAGE_KEY_SELECTED_COLLECTION));
  let vtgActiveView = $state<"family" | "ratio" | "reversal">("family");
```

Delete the `handleSelectCollection` function:
```typescript
  function handleSelectCollection(collectionId: string) {
    selectedCollection = collectionId;
    persist(STORAGE_KEY_SELECTED_COLLECTION, collectionId);
    pushNavState();
  }
```

Delete the `handleSelectVtgFamily` function (VTG family is now inferred by the interior):
```typescript
  function handleSelectVtgFamily(familyId: string | null) { ... }
```

Delete `handleVtgViewChange`:
```typescript
  function handleVtgViewChange(view: "family" | "ratio" | "reversal") { ... }
```

- [ ] **Step 2: Simplify `handleBackToCollections`**

Replace:
```typescript
  function handleBackToCollections() {
    selectedCollection = null;
    selectedDeckId = null;
    selectedVtgFamily = null;
    vtgActiveView = "family";
    deckSequences = [];
    persist(STORAGE_KEY_SELECTED_COLLECTION, null);
    persist(STORAGE_KEY_SELECTED_DECK, null);
    persist(STORAGE_KEY_VTG_FAMILY, null);
    pushNavState();
  }
```

With:
```typescript
  function handleBackToCollections() {
    selectedDeckId = null;
    selectedVtgFamily = null;
    deckSequences = [];
    persist(STORAGE_KEY_SELECTED_DECK, null);
    persist(STORAGE_KEY_VTG_FAMILY, null);
    pushNavState();
  }
```

- [ ] **Step 3: Simplify browser history encoding**

In `DeckNavState`, remove `collection` and `vtgView`:

```typescript
  interface DeckNavState {
    deckId: string | null;
    vtgFamily: string | null;
  }
```

Update `buildCurrentNavState`:
```typescript
  function buildCurrentNavState(): DeckNavState {
    return {
      deckId: selectedDeckId,
      vtgFamily: selectedVtgFamily,
    };
  }
```

Update `encodeNavHash`:
```typescript
  function encodeNavHash(state: DeckNavState): string {
    const params = new URLSearchParams();
    if (state.deckId) params.set("deck", state.deckId);
    if (state.vtgFamily) params.set("vtgFamily", state.vtgFamily);
    const str = params.toString();
    return str ? `deck-nav:${str}` : "";
  }
```

Update `decodeNavHash`:
```typescript
  function decodeNavHash(hash: string): DeckNavState | null {
    if (!hash.startsWith("#deck-nav:")) return null;
    try {
      const params = new URLSearchParams(hash.slice("#deck-nav:".length));
      return {
        deckId: params.get("deck"),
        vtgFamily: params.get("vtgFamily"),
      };
    } catch {
      return null;
    }
  }
```

Update `restoreNavState`:
```typescript
  async function restoreNavState(state: DeckNavState) {
    isRestoringFromHistory = true;
    try {
      selectedDeckId = state.deckId;
      selectedVtgFamily = state.vtgFamily;
      deckSequences = [];
      persist(STORAGE_KEY_SELECTED_DECK, state.deckId);
      if (state.deckId) {
        if (decks.length === 0) await loadDecks();
        await handleSelectDeckSequences(state.deckId);
      }
    } finally {
      isRestoringFromHistory = false;
    }
  }
```

Update the popstate fallback:
```typescript
  void restoreNavState({ deckId: null, vtgFamily: null });
```

Update `onMount` hash restore:
```typescript
  if (hashState) {
    isRestoringFromHistory = true;
    selectedDeckId = hashState.deckId;
    selectedVtgFamily = hashState.vtgFamily;
    persist(STORAGE_KEY_SELECTED_DECK, hashState.deckId);
    isRestoringFromHistory = false;
  }
```

- [ ] **Step 4: Clean up legacy key migration**

Remove `STORAGE_KEY_SELECTED_COLLECTION` from LEGACY_KEYS if it's referenced. It's not in the legacy map, so no change needed — just verify.

- [ ] **Step 5: Run typecheck + build**

Run: `npm run check 2>&1 | tail -20`
Run: `npm run build 2>&1 | tail -20`
Expected: Both pass (drilldown imports removed from DeckBrowser, ChoreoCardTab no longer references deleted state).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/ChoreoCardTab.svelte
git commit -m "refactor(decks): remove drilldown wiring from ChoreoCardTab, simplify nav state"
```

---

### Task 8: Delete Drilldown Files

**Files:**
- Delete: `src/lib/features/choreo-card/components/drilldown/` (23 files)
- Delete: `src/lib/features/choreo-card/state/deck-drilldown-state.svelte.ts`
- Delete: `src/lib/features/choreo-card/state/deck-drilldown-types.ts`
- Delete: `src/lib/features/choreo-card/context/deck-drilldown-context.ts`

- [ ] **Step 1: Verify no remaining imports of drilldown modules**

Run: `grep -r "drilldown\|drill-down\|DrillDown\|DeckDrillDown\|DeckFilterSidebar\|DeckResultsPanel\|DrillBreadcrumb\|DrillPill" src/lib/features/choreo-card/ --include="*.svelte" --include="*.ts" -l`

Expected: Zero results (all references removed in Tasks 6 + 7). If any file still imports drilldown code, fix it first.

- [ ] **Step 2: Delete the drilldown directory**

```bash
rm -rf src/lib/features/choreo-card/components/drilldown/
```

- [ ] **Step 3: Delete the drilldown state + types + context**

```bash
rm src/lib/features/choreo-card/state/deck-drilldown-state.svelte.ts
rm src/lib/features/choreo-card/state/deck-drilldown-types.ts
rm src/lib/features/choreo-card/context/deck-drilldown-context.ts
```

- [ ] **Step 4: Clear sessionStorage key**

The old drilldown stored state in `sessionStorage` under key `deckDrillDown.state`. This is ephemeral and will naturally expire. No code change needed.

- [ ] **Step 5: Run full build**

Run: `npm run build 2>&1 | tail -20`
Expected: BUILD SUCCESS. Zero references to deleted files remain.

- [ ] **Step 6: Run tests**

Run: `npm run test 2>&1 | tail -20`
Expected: All tests pass. No test referenced the drilldown state directly (it had no tests).

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/features/choreo-card/components/drilldown/ src/lib/features/choreo-card/state/deck-drilldown-state.svelte.ts src/lib/features/choreo-card/state/deck-drilldown-types.ts src/lib/features/choreo-card/context/deck-drilldown-context.ts
git commit -m "chore(decks): delete drilldown components, state, types, and context (26 files)"
```

---

### Task 9: Pictograph Thumbnails (lazy-loaded)

**Files:**
- Modify: `src/lib/features/choreo-card/components/DeckCard.svelte`

Replace the placeholder SVG dots with a lazy-loaded PictographRenderer showing beat 1 of the deck's first sequence. Uses IntersectionObserver to only load when visible.

- [ ] **Step 1: Add thumbnail loading to DeckCard**

Add these imports and state to DeckCard's script:

```typescript
  import { container } from "$lib/shared/di";
  import type { IDeckLoader } from "../services/contracts/IDeckLoader";
  import PictographRenderer from "$lib/shared/pictograph/rendering/components/PictographRenderer.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

  let cardEl: HTMLButtonElement | null = $state(null);
  let beatData = $state<PictographData | null>(null);
  let loadAttempted = $state(false);
```

Add IntersectionObserver effect:

```typescript
  $effect(() => {
    if (!cardEl || loadAttempted) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadAttempted = true;
          observer.disconnect();
          loadThumbnail();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(cardEl);
    return () => observer.disconnect();
  });

  async function loadThumbnail() {
    const firstSeqId = deck.families[0]?.sequenceIds[0];
    if (!firstSeqId) return;
    try {
      const deckLoader = container.items.deckLoader as IDeckLoader;
      const seqs = await deckLoader.loadSequencesByIds(deck.id, [firstSeqId]);
      const seq = seqs[0];
      if (!seq?.steps?.[0]) return;
      beatData = seq.steps[0] as unknown as PictographData;
    } catch { /* silently fail — placeholder stays */ }
  }
```

Replace the placeholder SVG in the template:

```svelte
  <div class="card-picto" aria-hidden="true">
    {#if beatData}
      <PictographRenderer
        pictograph={beatData}
        size={36}
        showGrid={false}
        showTKA={false}
        showWord={false}
      />
    {:else}
      <svg viewBox="0 0 36 36" width="36" height="36">
        <circle cx="18" cy="4" r="3" fill="rgba(255,255,255,0.15)" />
        <circle cx="32" cy="18" r="3" fill="rgba(255,255,255,0.15)" />
        <circle cx="18" cy="32" r="3" fill="rgba(255,255,255,0.15)" />
        <circle cx="4" cy="18" r="3" fill="rgba(255,255,255,0.15)" />
      </svg>
    {/if}
  </div>
```

Add `bind:this={cardEl}` to the button element.

**Important:** Before implementing, verify the PictographRenderer prop interface by reading:
```
src/lib/shared/pictograph/rendering/components/PictographRenderer.svelte
```
The `pictograph` prop type, `size` prop, and visibility toggles must match the actual component. Adjust the import path and prop names to match what exists.

Also verify the `IDeckLoader.loadSequencesByIds` return type — the sequence's `steps[0]` structure must be compatible with PictographData. If not, use `get_pictograph_data` MCP tool or extract the pictograph from `seq.startPosition` instead.

- [ ] **Step 2: Run typecheck**

Run: `npm run check 2>&1 | tail -20`
Expected: Clean. Fix any prop type mismatches.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckCard.svelte
git commit -m "feat(decks): add lazy-loaded pictograph thumbnails to DeckCard"
```

---

### Task 10: Build + Typecheck + Verification

- [ ] **Step 1: Full typecheck**

Run: `npm run check 2>&1`
Expected: No errors.

- [ ] **Step 2: Full build**

Run: `npm run build 2>&1`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Run all tests**

Run: `npm run test 2>&1`
Expected: All tests pass, including the new `deck-browse-filters.test.ts`.

- [ ] **Step 4: Visual verification**

Start the dev server on port 5174 and navigate to the Choreo Cards → Decks tab.

Verify:
- [ ] LOOPs collection shows all decks grouped by loop type immediately on load
- [ ] VTG toggle switches to VTG decks grouped by VTG family
- [ ] Filter chips narrow results (selecting "Rotated" shows only rotated decks)
- [ ] Multiple chips in same row = OR (selecting Rotated + Mirrored shows both)
- [ ] Chips across rows = AND (selecting Rotated + Halved only shows rotated-halved)
- [ ] "Clear filters" button resets all filters
- [ ] Clicking a deck card enters the deck interior view
- [ ] "Back to browser" returns to the browse grid
- [ ] Scroll position restores when returning to browse
- [ ] Grid is max-width 1200px centered on wide screens
- [ ] Grid is 2 columns on narrow screens (< 768px)
- [ ] Filter area collapses on mobile with chevron toggle
- [ ] Cards show reversal dot strip on the right
- [ ] Group headers show "Rotated ──── 42 decks" format
- [ ] Context-determined tags only show varying properties per group
- [ ] VTG collection uses purple accent color on pills and chips

If you cannot visually verify, say: "I cannot verify this visually. Please open the Decks tab and check the points above."

- [ ] **Step 5: Fix any issues found, commit**

```bash
git add -A
git commit -m "fix(decks): address visual verification issues from deck tab redesign"
```
