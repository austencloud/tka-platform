# Deck Browsing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten the 4-level deck drill-down to 3 levels with faceted filtering, reducing click depth from 5-7 to 3.

**Architecture:** Replace the current DeckBrowser's rigid Collection → Deck → Family → Sequence hierarchy with Collection → Filterable Deck List → Filterable Deck Interior. Families and start positions become filter chips instead of navigation levels. Reuse Browse module's filter chip primitives (FilterChipBase, FilterChipRow) and sidebar (SectionIndexSidebar) for visual consistency.

**Tech Stack:** Svelte 5 (runes), TypeScript, ITI DI, existing FilterChipBase/FilterChipRow/SectionIndexSidebar from Browse module.

**Spec:** `docs/superpowers/specs/2026-03-26-deck-browsing-redesign-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/features/choreo-card/components/DeckRow.svelte` | Rich clickable row for deck list (Level 1) |
| `src/lib/features/choreo-card/components/filters/FamilyFilterChip.svelte` | Multi-select motion type pill chip |
| `src/lib/features/choreo-card/components/filters/DeckListFilterPanel.svelte` | Filter bar for Level 1 (collection page) |
| `src/lib/features/choreo-card/components/filters/DeckInteriorFilterPanel.svelte` | Filter bar for Level 2 (deck interior) |
| `src/lib/features/choreo-card/domain/deck-sort.ts` | Sort enum + comparators for deck list |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/features/choreo-card/components/DeckBrowser.svelte` | Full rewrite — 3-level navigation with filters |
| `src/lib/features/choreo-card/components/ChoreoCardTab.svelte` | Remove family selection state, simplify callbacks |

### Reused (No Changes)
| File | Usage |
|------|-------|
| `src/lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte` | Base for all new filter chips |
| `src/lib/features/browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte` | Horizontal chip layout |
| `src/lib/features/browse/sequences/navigation/components/SectionIndexSidebar.svelte` | Sidebar index for Level 1 and Level 2 |
| `src/lib/features/browse/shared/domain/models/browse-models.ts` | `BrowseSection` type for sidebar sections |
| `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte` | Sequence card rendering in deck interior |
| `src/lib/shared/config/difficulty-styles.ts` | `DIFFICULTY_LEVELS` for level badges |

---

## Task 1: Create DeckRow Component

**Files:**
- Create: `src/lib/features/choreo-card/components/DeckRow.svelte`

- [ ] **Step 1: Create DeckRow.svelte**

```svelte
<!--
  DeckRow.svelte — Rich clickable row for deck list (Level 1).
  Shows deck name, level badge, beat count, sequence count, grid mode, family count.
-->
<script lang="ts">
  import type { Deck } from "../domain/models/Deck";
  import { DIFFICULTY_LEVELS } from "$lib/shared/config/difficulty-styles";

  interface Props {
    deck: Deck;
    accentColor: string;
    accentIcon: string;
    onSelect: (deckId: string) => void;
  }

  const { deck, accentColor, accentIcon, onSelect }: Props = $props();

  const levelStyle = $derived(DIFFICULTY_LEVELS[deck.level]);

  function formatCount(n: number): string {
    if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
    if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  }

  const familyCount = $derived(deck.families.length);
</script>

<button
  class="deck-row"
  onclick={() => onSelect(deck.id)}
  type="button"
  aria-label="Open deck: {deck.name}"
>
  <div class="deck-row-left">
    <i class="fas fa-{accentIcon} deck-icon" style="color: {accentColor}" aria-hidden="true"></i>
    <span class="deck-name">{deck.name}</span>
  </div>
  <div class="deck-row-meta">
    {#if levelStyle}
      <span
        class="level-badge"
        style="background: {levelStyle.cssBg}; border-color: {levelStyle.border}; color: {levelStyle.text}"
      >L{deck.level}</span>
    {/if}
    <span class="meta-chip" title="Grid mode">{deck.gridMode}</span>
    <span class="meta-chip" title="Families">{familyCount} {familyCount === 1 ? 'family' : 'families'}</span>
  </div>
  <span class="deck-count">{formatCount(deck.totalSequences)} cards</span>
</button>

<style>
  .deck-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #fff);
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: border-color 0.15s ease;
    width: 100%;
  }

  .deck-row:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .deck-row:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .deck-row-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .deck-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .deck-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .deck-row-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .level-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    border: 1px solid;
  }

  .meta-chip {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: capitalize;
  }

  .deck-count {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors related to DeckRow

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckRow.svelte
git commit -m "feat(decks): add DeckRow component for deck list"
```

---

## Task 2: Create Deck Sort Enum

**Files:**
- Create: `src/lib/features/choreo-card/domain/deck-sort.ts`

- [ ] **Step 1: Create sort enum and comparators**

```typescript
// deck-sort.ts — Sort methods and comparators for deck list.

export enum DeckSortMethod {
  NAME = "name",
  LEVEL = "level",
  SEQUENCE_COUNT = "count",
}

export const DECK_SORT_LABELS: Record<DeckSortMethod, string> = {
  [DeckSortMethod.NAME]: "Name",
  [DeckSortMethod.LEVEL]: "Level",
  [DeckSortMethod.SEQUENCE_COUNT]: "Cards",
};

export const DECK_SORT_ICONS: Record<DeckSortMethod, string> = {
  [DeckSortMethod.NAME]: "fa-sort-alpha-down",
  [DeckSortMethod.LEVEL]: "fa-layer-group",
  [DeckSortMethod.SEQUENCE_COUNT]: "fa-sort-numeric-down",
};

import type { Deck } from "./models/Deck";

const comparators: Record<DeckSortMethod, (a: Deck, b: Deck) => number> = {
  [DeckSortMethod.NAME]: (a, b) => a.name.localeCompare(b.name),
  [DeckSortMethod.LEVEL]: (a, b) => a.level - b.level || a.name.localeCompare(b.name),
  [DeckSortMethod.SEQUENCE_COUNT]: (a, b) => a.totalSequences - b.totalSequences || a.name.localeCompare(b.name),
};

export function sortDecks(decks: Deck[], method: DeckSortMethod): Deck[] {
  return [...decks].sort(comparators[method]);
}

/** Generate section labels for SectionIndexSidebar based on sort method. */
export function getDeckSectionKey(deck: Deck, method: DeckSortMethod): string {
  switch (method) {
    case DeckSortMethod.LEVEL: return `Level ${deck.level}`;
    case DeckSortMethod.SEQUENCE_COUNT: {
      if (deck.totalSequences < 100) return "< 100";
      if (deck.totalSequences < 1000) return "100-999";
      if (deck.totalSequences < 10000) return "1k-10k";
      return "10k+";
    }
    case DeckSortMethod.NAME:
    default: return deck.name.charAt(0).toUpperCase();
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/domain/deck-sort.ts
git commit -m "feat(decks): add deck sort enum and comparators"
```

---

## Task 3: Create FamilyFilterChip

**Files:**
- Create: `src/lib/features/choreo-card/components/filters/FamilyFilterChip.svelte`

- [ ] **Step 1: Create the component**

This chip extends FilterChipBase (from Browse) with motion type pills as a multi-select dropdown. Follow the pattern from LevelFilterChip but with pill rendering.

```svelte
<!--
  FamilyFilterChip.svelte — Multi-select filter chip showing motion type family pills.
  Uses FilterChipBase from Browse module for consistent chip styling.
-->
<script lang="ts">
  import FilterChipBase from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte";
  import type { DeckFamily } from "../../domain/models/Deck";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  interface Props {
    families: DeckFamily[];
    selectedFamilyIds: string[];
    onFilterChange: (familyIds: string[]) => void;
  }

  const { families, selectedFamilyIds, onFilterChange }: Props = $props();

  let isOpen = $state(false);
  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = (container.items as Record<string, unknown>).hapticFeedback as IHapticFeedback ?? null;
  });

  const isActive = $derived(selectedFamilyIds.length > 0);
  const label = $derived(
    selectedFamilyIds.length === 0 ? "Family"
    : selectedFamilyIds.length === 1
      ? families.find(f => f.id === selectedFamilyIds[0])?.label ?? "Family"
      : `${selectedFamilyIds.length} families`
  );

  const MOTION_TYPE_INFO: Record<string, { abbrev: string; colors: [string, string] }> = {
    "Dual-Shift": { abbrev: "DS", colors: ["#36c3ff", "#6F2DA8"] },
    "Shift":      { abbrev: "Sh", colors: ["#6F2DA8", "#6F2DA8"] },
    "Cross-Shift":{ abbrev: "CS", colors: ["#26e600", "#6F2DA8"] },
    "Dash":       { abbrev: "D",  colors: ["#26e600", "#26e600"] },
    "Dual-Dash":  { abbrev: "DD", colors: ["#00b3ff", "#26e600"] },
    "Static":     { abbrev: "St", colors: ["#eb7d00", "#eb7d00"] },
  };

  interface PillData {
    abbrev: string;
    colors: [string, string];
    isDual: boolean;
  }

  function parsePills(typeCombo: string): PillData[] {
    return typeCombo.split("+").map(seg => {
      const name = seg.trim();
      const info = MOTION_TYPE_INFO[name];
      const colors: [string, string] = info?.colors ?? ["#888", "#888"];
      return { abbrev: info?.abbrev ?? name, colors, isDual: colors[0] !== colors[1] };
    });
  }

  function handleToggle() {
    isOpen = !isOpen;
  }

  function handleSelect(familyId: string) {
    hapticService?.trigger("selection");
    const isSelected = selectedFamilyIds.includes(familyId);
    const next = isSelected
      ? selectedFamilyIds.filter(id => id !== familyId)
      : [...selectedFamilyIds, familyId];
    onFilterChange(next);
  }

  function handleClear() {
    hapticService?.trigger("selection");
    onFilterChange([]);
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".family-chip-wrapper")) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (!isOpen) return;
    document.addEventListener("click", handleClickOutside, true);
    return () => document.removeEventListener("click", handleClickOutside, true);
  });
</script>

<div class="family-chip-wrapper">
  <FilterChipBase
    {label}
    icon="fas fa-project-diagram"
    active={isActive}
    chipColor="#8b5cf6"
    mode="dropdown"
    expanded={isOpen}
    onclick={handleToggle}
  >
    {#snippet children()}
      <div class="family-popover" role="listbox" aria-label="Filter by family">
        <button
          class="popover-option"
          class:selected={selectedFamilyIds.length === 0}
          onclick={handleClear}
          role="option"
          aria-selected={selectedFamilyIds.length === 0}
          type="button"
        >
          <span>All Families</span>
          {#if selectedFamilyIds.length === 0}
            <i class="fas fa-check" aria-hidden="true"></i>
          {/if}
        </button>
        <div class="popover-separator" role="separator"></div>
        {#each families as family (family.id)}
          {@const selected = selectedFamilyIds.includes(family.id)}
          {@const pills = parsePills(family.typeCombo)}
          <button
            class="popover-option family-option"
            class:selected
            onclick={() => handleSelect(family.id)}
            role="option"
            aria-selected={selected}
            type="button"
          >
            <span class="family-pills">
              {#each pills as pill, i}
                {#if i > 0}<span class="pill-sep" aria-hidden="true">+</span>{/if}
                <span
                  class="motion-pill"
                  class:dual={pill.isDual}
                  style="--c1: {pill.colors[0]}; --c2: {pill.colors[1]}"
                >{pill.abbrev}</span>
              {/each}
            </span>
            <span class="family-meta">{family.sequenceIds.length}</span>
            {#if selected}
              <i class="fas fa-check" aria-hidden="true"></i>
            {/if}
          </button>
        {/each}
      </div>
    {/snippet}
  </FilterChipBase>
</div>

<style>
  .family-chip-wrapper {
    position: relative;
  }

  .family-popover {
    display: flex;
    flex-direction: column;
    min-width: 220px;
    max-height: 320px;
    overflow-y: auto;
  }

  .popover-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    border-radius: 4px;
    text-align: left;
    width: 100%;
  }

  .popover-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .popover-option.selected {
    background: rgba(139, 92, 246, 0.15);
  }

  .popover-separator {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 4px 0;
  }

  .family-pills {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pill-sep {
    font-size: 10px;
    opacity: 0.4;
  }

  .motion-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    background: var(--c1);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .motion-pill.dual {
    background: linear-gradient(135deg, var(--c1), var(--c2));
  }

  .family-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin-left: auto;
    padding-right: 4px;
  }

  .fa-check {
    font-size: 12px;
    color: #8b5cf6;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/filters/FamilyFilterChip.svelte
git commit -m "feat(decks): add FamilyFilterChip — multi-select motion type pill filter"
```

---

## Task 4: Create DeckListFilterPanel

**Files:**
- Create: `src/lib/features/choreo-card/components/filters/DeckListFilterPanel.svelte`

- [ ] **Step 1: Create the filter panel for Level 1**

Composes FilterChipRow with level and grid mode chips for filtering the deck list.

```svelte
<!--
  DeckListFilterPanel.svelte — Filter bar for the collection page (Level 1).
  Composes FilterChipRow + individual chips from Browse module.
-->
<script lang="ts">
  import FilterChipRow from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte";
  import LevelFilterChip from "$lib/features/browse/sequences/filtering/components/inline-filter/chips/LevelFilterChip.svelte";
  import GridModeFilterChip from "$lib/features/browse/sequences/filtering/components/inline-filter/chips/GridModeFilterChip.svelte";

  interface Props {
    isOpen: boolean;
    activeLevel: number | null;
    activeGridMode: string | null;
    onLevelChange: (level: number | null) => void;
    onGridModeChange: (gridMode: string | null) => void;
  }

  const { isOpen, activeLevel, activeGridMode, onLevelChange, onGridModeChange }: Props = $props();
</script>

{#if isOpen}
  <div class="deck-list-filters">
    <FilterChipRow>
      {#snippet children()}
        <LevelFilterChip activeLevel={activeLevel} onSelect={onLevelChange} />
        <GridModeFilterChip activeGridMode={activeGridMode} onSelect={onGridModeChange} />
      {/snippet}
    </FilterChipRow>
  </div>
{/if}

<style>
  .deck-list-filters {
    padding: 0 4px;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/filters/DeckListFilterPanel.svelte
git commit -m "feat(decks): add DeckListFilterPanel for collection page filtering"
```

---

## Task 5: Create DeckInteriorFilterPanel

**Files:**
- Create: `src/lib/features/choreo-card/components/filters/DeckInteriorFilterPanel.svelte`

- [ ] **Step 1: Create the filter panel for Level 2**

Composes FilterChipRow with FamilyFilterChip and a start position chip.

```svelte
<!--
  DeckInteriorFilterPanel.svelte — Filter bar for the deck interior (Level 2).
  Family multi-select + start position filter.
-->
<script lang="ts">
  import FilterChipRow from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte";
  import FilterChipBase from "$lib/features/browse/sequences/filtering/components/inline-filter/FilterChipBase.svelte";
  import FamilyFilterChip from "./FamilyFilterChip.svelte";
  import type { DeckFamily } from "../../domain/models/Deck";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  interface Props {
    isOpen: boolean;
    families: DeckFamily[];
    selectedFamilyIds: string[];
    activePosition: string | null;
    onFamilyChange: (familyIds: string[]) => void;
    onPositionChange: (position: string | null) => void;
  }

  const {
    isOpen, families, selectedFamilyIds, activePosition,
    onFamilyChange, onPositionChange,
  }: Props = $props();

  let posOpen = $state(false);
  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = (container.items as Record<string, unknown>).hapticFeedback as IHapticFeedback ?? null;
  });

  const positions = [
    { id: "alpha", label: "Alpha (α)" },
    { id: "beta", label: "Beta (β)" },
    { id: "gamma", label: "Gamma (γ)" },
  ];

  const posLabel = $derived(
    activePosition
      ? positions.find(p => p.id === activePosition)?.label ?? "Position"
      : "Position"
  );

  function handlePosSelect(posId: string | null) {
    hapticService?.trigger("selection");
    onPositionChange(posId === activePosition ? null : posId);
    posOpen = false;
  }

  function handlePosClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".pos-chip-wrapper")) {
      posOpen = false;
    }
  }

  $effect(() => {
    if (!posOpen) return;
    document.addEventListener("click", handlePosClickOutside, true);
    return () => document.removeEventListener("click", handlePosClickOutside, true);
  });
</script>

{#if isOpen}
  <div class="deck-interior-filters">
    <FilterChipRow>
      {#snippet children()}
        <FamilyFilterChip
          {families}
          {selectedFamilyIds}
          onFilterChange={onFamilyChange}
        />
        <div class="pos-chip-wrapper">
          <FilterChipBase
            label={posLabel}
            icon="fas fa-crosshairs"
            active={activePosition !== null}
            chipColor="#06b6d4"
            mode="dropdown"
            expanded={posOpen}
            onclick={() => { posOpen = !posOpen; }}
          >
            {#snippet children()}
              <div class="pos-popover" role="listbox" aria-label="Filter by start position">
                <button
                  class="popover-option"
                  class:selected={activePosition === null}
                  onclick={() => handlePosSelect(null)}
                  role="option"
                  aria-selected={activePosition === null}
                  type="button"
                >
                  <span>All Positions</span>
                  {#if activePosition === null}
                    <i class="fas fa-check" aria-hidden="true"></i>
                  {/if}
                </button>
                <div class="popover-separator" role="separator"></div>
                {#each positions as pos (pos.id)}
                  <button
                    class="popover-option"
                    class:selected={activePosition === pos.id}
                    onclick={() => handlePosSelect(pos.id)}
                    role="option"
                    aria-selected={activePosition === pos.id}
                    type="button"
                  >
                    <span>{pos.label}</span>
                    {#if activePosition === pos.id}
                      <i class="fas fa-check" aria-hidden="true"></i>
                    {/if}
                  </button>
                {/each}
              </div>
            {/snippet}
          </FilterChipBase>
        </div>
      {/snippet}
    </FilterChipRow>
  </div>
{/if}

<style>
  .deck-interior-filters {
    padding: 0 4px;
  }

  .pos-chip-wrapper {
    position: relative;
  }

  .pos-popover {
    display: flex;
    flex-direction: column;
    min-width: 180px;
  }

  .popover-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    border-radius: 4px;
    text-align: left;
    width: 100%;
  }

  .popover-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .popover-option.selected {
    background: rgba(6, 182, 212, 0.15);
  }

  .popover-separator {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 4px 0;
  }

  .fa-check {
    font-size: 12px;
    color: #06b6d4;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/filters/DeckInteriorFilterPanel.svelte
git commit -m "feat(decks): add DeckInteriorFilterPanel for deck interior filtering"
```

---

## Task 6: Simplify ChoreoCardTab State

**Files:**
- Modify: `src/lib/features/choreo-card/components/ChoreoCardTab.svelte`

- [ ] **Step 1: Remove family selection state and simplify deck callbacks**

Key changes:
1. Remove `selectedFamilyId` state variable
2. Remove `handleSelectFamily()` function
3. Remove `handleBackToFamilies()` function
4. Change `handleSelectDeck()` to load ALL sequences for small decks (< 500) or first family for large decks
5. Add `selectedCollection` state with localStorage persistence
6. Remove the `onSelectFamily`, `onBackToFamilies` props from the DeckBrowser render

```typescript
// REMOVE these:
// let selectedFamilyId = $state<string | null>(null);
// function handleSelectFamily(familyId: string) { ... }
// function handleBackToFamilies() { ... }

// ADD selectedCollection persistence:
const STORAGE_KEY_SELECTED_COLLECTION = "choreoCard.selectedCollection";
let selectedCollection = $state<string | null>(getPersistedString(STORAGE_KEY_SELECTED_COLLECTION));

// MODIFY handleSelectDeck to load sequences:
async function handleSelectDeck(deckId: string) {
  selectedDeckId = deckId;
  persistString(STORAGE_KEY_SELECTED_DECK, deckId);
  deckSequences = [];
  isDeckLoading = true;
  try {
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;
    if (deck.totalSequences < 500) {
      deckSequences = await deckLoader.loadDeckSequences(deckId);
    } else {
      // Load first family only for large decks
      const firstFamily = deck.families[0];
      if (firstFamily) {
        deckSequences = await deckLoader.loadSequencesByIds(deckId, [...firstFamily.sequenceIds]);
      }
    }
  } catch (err) {
    console.error("Failed to load deck sequences:", err);
  } finally {
    isDeckLoading = false;
  }
}

// ADD collection handlers:
function handleSelectCollection(collectionId: string) {
  selectedCollection = collectionId;
  persistString(STORAGE_KEY_SELECTED_COLLECTION, collectionId);
}

function handleBackToCollections() {
  selectedCollection = null;
  localStorage.removeItem(STORAGE_KEY_SELECTED_COLLECTION);
}

// MODIFY handleBackToDeckList:
function handleBackToDeckList() {
  selectedDeckId = null;
  deckSequences = [];
  localStorage.removeItem(STORAGE_KEY_SELECTED_DECK);
}

// ADD: load more sequences for a family (large decks)
async function handleLoadFamilySequences(familyIds: string[]) {
  const deck = decks.find(d => d.id === selectedDeckId);
  if (!deck) return;
  isDeckLoading = true;
  try {
    const seqIds = deck.families
      .filter(f => familyIds.includes(f.id))
      .flatMap(f => [...f.sequenceIds]);
    deckSequences = await deckLoader.loadSequencesByIds(selectedDeckId!, seqIds);
  } catch (err) {
    console.error("Failed to load family sequences:", err);
  } finally {
    isDeckLoading = false;
  }
}
```

Update the DeckBrowser render to pass the new simplified props (the exact render update happens in Task 7 when DeckBrowser is rewritten).

- [ ] **Step 2: Verify it compiles**

Run: `npm run check 2>&1 | head -20`
Expected: Errors about DeckBrowser props (expected — DeckBrowser hasn't been rewritten yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/ChoreoCardTab.svelte
git commit -m "refactor(decks): simplify ChoreoCardTab — remove family navigation state"
```

---

## Task 7: Rewrite DeckBrowser

**Files:**
- Modify: `src/lib/features/choreo-card/components/DeckBrowser.svelte`

This is the main task. The component goes from 4-level drill-down to 3-level with filters.

- [ ] **Step 1: Rewrite DeckBrowser.svelte**

The new component has three views controlled by `selectedDeck` and `selectedCollection`:
- `!selectedCollection` → Level 0 (collection picker)
- `selectedCollection && !selectedDeck` → Level 1 (collection page with deck list + filters)
- `selectedDeck` → Level 2 (deck interior with sequence grid + filters)

New Props interface:
```typescript
interface Props {
  decks: Deck[];
  selectedDeckId: string | null;
  selectedCollection: string | null;
  deckSequences: SequenceData[];
  isLoading: boolean;
  handPointsVisible?: boolean;
  showGrid?: boolean;
  showTKA?: boolean;
  showWord?: boolean;
  includeStartPosition?: boolean;
  onSelectCollection: (collectionId: string) => void;
  onBackToCollections: () => void;
  onSelectDeck: (deckId: string) => void;
  onBackToDeckList: () => void;
  onSelectSequence: (sequence: SequenceData) => void;
  onLoadFamilySequences: (familyIds: string[]) => void;
  onContextMenu?: (x: number, y: number, rerender: () => void) => void;
}
```

Key implementation details:

**Level 0 (Collection Picker):** Keep existing hero cards. Add level range + beat range stats derived from deck metadata:
```typescript
const levelRange = $derived.by(() => {
  const levels = colDecks.map(d => d.level);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  return min === max ? `L${min}` : `L${min}-L${max}`;
});
```

**Level 1 (Collection Page):** Flex row with `SectionIndexSidebar` + main content. Main content has breadcrumb, filter toggle, sort selector (using a local sort popover since SortPopover is coupled to BrowseSortMethod), `DeckListFilterPanel`, and list of `DeckRow` components. Filter state is local:
```typescript
let deckListFilters = $state({ level: null as number | null, gridMode: null as string | null });
let deckSortMethod = $state(DeckSortMethod.NAME);
let filtersOpen = $state(false);
```

**Level 2 (Deck Interior):** Flex row with optional `SectionIndexSidebar` + main content. Main content has breadcrumb, deck meta line, filter toggle, `DeckInteriorFilterPanel`, and a CSS grid of `ChoreoCard` components (reusing the existing card rendering pattern from DeckFamilySection). Filter state:
```typescript
let interiorFilters = $state({ familyIds: [] as string[], position: null as string | null });
```

Filtered sequences derived:
```typescript
const filteredSequences = $derived.by(() => {
  let seqs = deckSequences;
  // Filter by family
  if (interiorFilters.familyIds.length > 0) {
    const allowedIds = new Set(
      selectedDeck!.families
        .filter(f => interiorFilters.familyIds.includes(f.id))
        .flatMap(f => [...f.sequenceIds])
    );
    seqs = seqs.filter(s => allowedIds.has(s.id));
  }
  // Filter by start position
  if (interiorFilters.position) {
    seqs = seqs.filter(s => {
      const gridPos = s.startPosition?.gridPosition ?? s.startPosition?.startPosition ?? "";
      return gridPos.startsWith(interiorFilters.position!);
    });
  }
  return seqs;
});
```

Section grouping for sidebar:
```typescript
const interiorSections = $derived.by(() => {
  if (interiorFilters.familyIds.length > 0) {
    // Group by start position
    return groupByStartPosition(filteredSequences);
  }
  // Group by family
  return groupByFamily(filteredSequences, selectedDeck!);
});
```

Sequence grid uses ChoreoCard directly (same pattern as current DeckFamilySection):
```svelte
<div class="sequence-grid">
  {#each filteredSequences as sequence (sequence.id)}
    <ChoreoCard
      sequenceData={sequence}
      {handPointsVisible}
      {showGrid}
      {showTKA}
      {showWord}
      {includeStartPosition}
      onCardClick={() => onSelectSequence(sequence)}
    />
  {/each}
</div>
```

The full implementation should be ~350-450 lines (current file is ~540 lines with extensive styling). Most of the Level 0 hero card styling can be preserved. Level 1 and Level 2 get new layouts.

- [ ] **Step 2: Update ChoreoCardTab to pass new props**

Update the `<DeckBrowser>` render in ChoreoCardTab to use the new Props interface:
```svelte
<DeckBrowser
  {decks}
  {selectedDeckId}
  {selectedCollection}
  {deckSequences}
  isLoading={isDeckLoading}
  {handPointsVisible}
  {showGrid}
  {showTKA}
  {showWord}
  {includeStartPosition}
  onSelectCollection={handleSelectCollection}
  onBackToCollections={handleBackToCollections}
  onSelectDeck={handleSelectDeck}
  onBackToDeckList={handleBackToDeckList}
  onSelectSequence={handleSelectSequence}
  onLoadFamilySequences={handleLoadFamilySequences}
  onContextMenu={openCardContextMenu}
/>
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No type errors

- [ ] **Step 4: Build verification**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckBrowser.svelte src/lib/features/choreo-card/components/ChoreoCardTab.svelte
git commit -m "feat(decks): rewrite DeckBrowser — 3-level navigation with faceted filtering

Replace 4-level drill-down (Collection → Deck → Family → Sequences)
with 3-level (Collection → Filterable Deck List → Filterable Deck Interior).
Families and start positions are now filter chips, not navigation levels.
Click depth reduced from 5-7 to 3."
```

---

## Task 8: Polish and Verify

**Files:** All modified files from above

- [ ] **Step 1: Type check the full project**

Run: `npm run check 2>&1 | tail -30`
Expected: No new errors introduced

- [ ] **Step 2: Build the full project**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Verify DeckFamilySection is no longer imported**

Run: `grep -r "DeckFamilySection" src/ --include="*.svelte" --include="*.ts"`
Expected: Only the component file itself and possibly old imports that need cleanup. If DeckBrowser no longer imports it, it's dead code. Leave it for now (can be cleaned up separately).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(decks): polish deck browsing redesign — type fixes and cleanup"
```

---

## Verification Checklist

After all tasks complete, verify these behaviors:

1. **Level 0:** Collection hero cards show deck count, card count, level range
2. **Level 1:** Clicking a collection shows a filterable deck list with DeckRow components
3. **Level 1:** Level and grid mode filter chips work
4. **Level 1:** Sort by name/level/count works
5. **Level 2:** Clicking a deck shows all sequences (or first family for large decks)
6. **Level 2:** Family filter chip shows motion type pills, multi-select works
7. **Level 2:** Position filter chip filters by alpha/beta/gamma
8. **Level 2:** Sequences are grouped by family (no filter) or by position (with family filter)
9. **Breadcrumbs:** Each level has working breadcrumb navigation back to any parent
10. **Persistence:** selectedDeckId and selectedCollection survive page refresh
11. **Click depth:** 3 clicks from collection picker to viewing a sequence
