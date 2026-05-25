# VTG Turn Matrix Browser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat VTG catalog card grid with a 7×7 blue-turns × red-turns matrix and a separate By Family flat-sequence view.

**Architecture:** Two new Svelte components (`VtgTurnMatrix`, `VtgFamilyBrowser`) inserted conditionally into the existing `CatalogBrowseGrid`. State extended with `vtgViewMode`. A small `turn-pattern-parser.ts` utility resolves catalog turn patterns to `{blue, red}` coordinates.

**Tech Stack:** Svelte 5 (runes), CSS Grid, existing catalog state/types system.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/features/choreo-card/domain/turn-pattern-parser.ts` | Parse turn patterns → `{blue, red}` coords |
| Create | `src/lib/features/choreo-card/components/VtgTurnMatrix.svelte` | 7×7 grid with axis headers, cell states, click |
| Create | `src/lib/features/choreo-card/components/VtgFamilyBrowser.svelte` | Family picker + flat sequence grid |
| Modify | `src/lib/features/choreo-card/state/catalog-browse-types.ts` | Add `VtgViewMode` type, extend `SavedCatalogBrowseState` |
| Modify | `src/lib/features/choreo-card/state/catalog-browse-state.svelte.ts` | Add `vtgViewMode` state + getter/setter |
| Modify | `src/lib/features/choreo-card/components/CatalogBrowseFilterBar.svelte` | Add view mode toggle for VTG, remove VTG family/turn chips |
| Modify | `src/lib/features/choreo-card/components/CatalogBrowseGrid.svelte` | Route VTG to matrix or family browser |
| Test | `src/lib/features/choreo-card/domain/__tests__/turn-pattern-parser.test.ts` | Unit tests for parser |

---

### Task 1: Turn Pattern Parser

**Files:**
- Create: `src/lib/features/choreo-card/domain/turn-pattern-parser.ts`
- Create: `src/lib/features/choreo-card/domain/__tests__/turn-pattern-parser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/features/choreo-card/domain/__tests__/turn-pattern-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseTurnPattern, TURN_VALUES } from "../turn-pattern-parser";

describe("parseTurnPattern", () => {
  it("parses symmetric uniform-Nt format", () => {
    expect(parseTurnPattern("uniform-0t")).toEqual({ blue: 0, red: 0 });
    expect(parseTurnPattern("uniform-2t")).toEqual({ blue: 2, red: 2 });
    expect(parseTurnPattern("uniform 1.5t")).toEqual({ blue: 1.5, red: 1.5 });
  });

  it("parses asymmetric pipe-separated format", () => {
    expect(parseTurnPattern("0.5|1")).toEqual({ blue: 0.5, red: 1 });
    expect(parseTurnPattern("3|0")).toEqual({ blue: 3, red: 0 });
    expect(parseTurnPattern("1.5|2.5")).toEqual({ blue: 1.5, red: 2.5 });
  });

  it("returns null for unparseable patterns", () => {
    expect(parseTurnPattern("")).toBeNull();
    expect(parseTurnPattern("continuous")).toBeNull();
  });

  it("exports TURN_VALUES as [0, 0.5, 1, 1.5, 2, 2.5, 3]", () => {
    expect(TURN_VALUES).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/features/choreo-card/domain/__tests__/turn-pattern-parser.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create `src/lib/features/choreo-card/domain/turn-pattern-parser.ts`:

```typescript
export const TURN_VALUES = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;

export interface TurnCoord {
  blue: number;
  red: number;
}

export function parseTurnPattern(pattern: string): TurnCoord | null {
  if (!pattern) return null;

  const uniformMatch = pattern.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
  if (uniformMatch) {
    const turns = parseFloat(uniformMatch[1]!);
    return { blue: turns, red: turns };
  }

  const pipeMatch = pattern.match(/^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/);
  if (pipeMatch) {
    return { blue: parseFloat(pipeMatch[1]!), red: parseFloat(pipeMatch[2]!) };
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/features/choreo-card/domain/__tests__/turn-pattern-parser.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/domain/turn-pattern-parser.ts src/lib/features/choreo-card/domain/__tests__/turn-pattern-parser.test.ts
git commit -m "feat(choreo-card): add turn pattern parser for VTG matrix"
```

---

### Task 2: Extend State with VTG View Mode

**Files:**
- Modify: `src/lib/features/choreo-card/state/catalog-browse-types.ts`
- Modify: `src/lib/features/choreo-card/state/catalog-browse-state.svelte.ts`

- [ ] **Step 1: Add VtgViewMode type and extend SavedCatalogBrowseState**

In `src/lib/features/choreo-card/state/catalog-browse-types.ts`, add after the existing `VTG_FAMILY_KEYS` line:

```typescript
export type VtgViewMode = 'turns' | 'family';
```

Update the `SavedCatalogBrowseState` interface to include the new field:

```typescript
export interface SavedCatalogBrowseState {
  collection: 'LOOPs' | 'VTG';
  filters: FilterState;
  scrollY: number;
  vtgViewMode?: VtgViewMode;
}
```

- [ ] **Step 2: Add vtgViewMode state to catalog-browse-state.svelte.ts**

In `src/lib/features/choreo-card/state/catalog-browse-state.svelte.ts`, inside `createCatalogBrowseState`:

After the line `let scrollY = $state(saved?.scrollY ?? 0);`, add:

```typescript
let vtgViewMode = $state<VtgViewMode>(saved?.vtgViewMode ?? 'turns');
```

Add the import at the top:

```typescript
import type { FilterState, AvailableFilters, SavedCatalogBrowseState, VtgViewMode } from './catalog-browse-types';
```

In the `$effect` that saves to localStorage, update the snapshot to include `vtgViewMode`:

```typescript
const snapshot: SavedCatalogBrowseState = { collection, filters, scrollY, vtgViewMode };
```

Add to the returned object:

```typescript
get vtgViewMode() { return vtgViewMode; },
setVtgViewMode(mode: VtgViewMode) { vtgViewMode = mode; },
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/state/catalog-browse-types.ts src/lib/features/choreo-card/state/catalog-browse-state.svelte.ts
git commit -m "feat(choreo-card): add vtgViewMode state for turn matrix"
```

---

### Task 3: VtgTurnMatrix Component

**Files:**
- Create: `src/lib/features/choreo-card/components/VtgTurnMatrix.svelte`

- [ ] **Step 1: Create the matrix component**

Create `src/lib/features/choreo-card/components/VtgTurnMatrix.svelte`:

```svelte
<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import { parseTurnPattern, TURN_VALUES } from "../domain/turn-pattern-parser";

  interface Props {
    catalogs: Catalog[];
    onSelectCatalog: (catalog: Catalog) => void;
  }

  const { catalogs, onSelectCatalog }: Props = $props();

  type CellKey = `${number},${number}`;

  const catalogMap = $derived.by(() => {
    const map = new Map<CellKey, Catalog>();
    for (const catalog of catalogs) {
      const coord = parseTurnPattern(catalog.turnPattern);
      if (!coord) continue;
      const key: CellKey = `${coord.blue},${coord.red}`;
      map.set(key, catalog);
    }
    return map;
  });

  function cellCatalog(blue: number, red: number): Catalog | undefined {
    return catalogMap.get(`${blue},${red}`);
  }

  function formatTurn(v: number): string {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
</script>

<div class="matrix-container">
  <div class="matrix-label red-label">Red Hand Turns</div>

  <div class="matrix-grid" role="grid" aria-label="VTG turn combination matrix">
    <!-- Top-left corner (empty) -->
    <div class="matrix-corner" role="presentation"></div>

    <!-- Column headers (red) -->
    {#each TURN_VALUES as red (red)}
      <div class="matrix-col-header" role="columnheader" aria-label="Red {red} turns">
        {formatTurn(red)}
      </div>
    {/each}

    <!-- Rows -->
    {#each TURN_VALUES as blue (blue)}
      <!-- Row header (blue) -->
      <div class="matrix-row-header" role="rowheader" aria-label="Blue {blue} turns">
        {formatTurn(blue)}
      </div>

      <!-- Cells -->
      {#each TURN_VALUES as red (red)}
        {@const catalog = cellCatalog(blue, red)}
        {@const isSymmetric = blue === red}
        {#if catalog}
          <button
            type="button"
            class="matrix-cell"
            class:symmetric={isSymmetric}
            role="gridcell"
            aria-label="{catalog.totalSequences} sequences, blue {blue} turns, red {red} turns{isSymmetric ? ' (symmetric)' : ''}"
            onclick={() => onSelectCatalog(catalog)}
          >
            <span class="cell-count">{catalog.totalSequences}</span>
            {#if isSymmetric}
              <span class="cell-marker" aria-hidden="true">&#9670;</span>
            {/if}
          </button>
        {:else}
          <div
            class="matrix-cell empty"
            role="gridcell"
            aria-label="No deck for blue {blue}, red {red}"
          ></div>
        {/if}
      {/each}
    {/each}
  </div>

  <div class="matrix-label blue-label">Blue Hand Turns</div>
</div>

<style>
  .matrix-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
  }

  .matrix-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .red-label { color: #ED1C24; }
  .blue-label { color: #3575E2; }

  .matrix-grid {
    display: grid;
    grid-template-columns: 48px repeat(7, 1fr);
    grid-template-rows: 36px repeat(7, 1fr);
    gap: 2px;
    max-width: 640px;
    width: 100%;
    aspect-ratio: 8 / 8;
  }

  .matrix-corner {
    background: transparent;
  }

  .matrix-col-header,
  .matrix-row-header {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
  }

  .matrix-col-header { color: #ED1C24; }
  .matrix-row-header { color: #3575E2; }

  .matrix-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: rgba(183, 99, 205, 0.06);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    font: inherit;
    transition: background 0.15s ease, transform 0.15s ease;
    min-height: 0;
  }

  .matrix-cell:hover {
    background: rgba(183, 99, 205, 0.15);
    transform: scale(1.02);
  }

  .matrix-cell:focus-visible {
    outline: 2px solid rgba(183, 99, 205, 0.6);
    outline-offset: 1px;
  }

  .matrix-cell.symmetric {
    background: rgba(183, 99, 205, 0.2);
    border-color: rgba(183, 99, 205, 0.35);
  }

  .matrix-cell.symmetric:hover {
    background: rgba(183, 99, 205, 0.3);
  }

  .matrix-cell.empty {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.04);
    cursor: default;
  }

  .cell-count {
    font-size: 13px;
    font-weight: 600;
  }

  .cell-marker {
    font-size: 8px;
    color: rgba(183, 99, 205, 0.7);
    line-height: 1;
  }

  @media (max-width: 768px) {
    .matrix-container { padding: 16px; }
    .matrix-grid {
      grid-template-columns: 36px repeat(7, 1fr);
      grid-template-rows: 28px repeat(7, 1fr);
      max-width: 100%;
    }
    .matrix-col-header, .matrix-row-header { font-size: 11px; }
    .cell-count { font-size: 11px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .matrix-cell { transition: none; }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/VtgTurnMatrix.svelte
git commit -m "feat(choreo-card): add VtgTurnMatrix 7x7 grid component"
```

---

### Task 4: VtgFamilyBrowser Component

**Files:**
- Create: `src/lib/features/choreo-card/components/VtgFamilyBrowser.svelte`

- [ ] **Step 1: Create the family browser component**

Create `src/lib/features/choreo-card/components/VtgFamilyBrowser.svelte`:

```svelte
<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { VTG_FAMILY_KEYS } from "../state/catalog-browse-types";
  import { parseTurnPattern } from "../domain/turn-pattern-parser";
  import { inferVtgFamily } from "../state/catalog-browse-state.svelte";

  interface FamilyInfo {
    id: string;
    name: string;
    iconPath: string;
    sequenceCount: number;
  }

  interface Props {
    catalogs: Catalog[];
    onSelectSequence: (sequence: SequenceData) => void;
  }

  const { catalogs, onSelectSequence }: Props = $props();

  const FAMILY_META: Record<string, { name: string; iconPath: string }> = {
    "split-same":   { name: "Split-Same",   iconPath: "/images/elements/water-v2.png" },
    "tog-same":     { name: "Tog-Same",     iconPath: "/images/elements/earth-v2.png" },
    "quarter-same": { name: "Quarter-Same", iconPath: "/images/elements/sun-v2.png" },
    "split-opp":    { name: "Split-Opp",    iconPath: "/images/elements/fire-v2.png" },
    "tog-opp":      { name: "Tog-Opp",      iconPath: "/images/elements/air-v2.png" },
    "quarter-opp":  { name: "Quarter-Opp",  iconPath: "/images/elements/moon-v2.png" },
  };

  let selectedFamily = $state<string | null>(null);

  const familyInfos = $derived.by((): FamilyInfo[] => {
    const counts = new Map<string, number>();
    for (const catalog of catalogs) {
      const family = inferVtgFamily(catalog);
      for (const fam of catalog.families) {
        const key = VTG_FAMILY_KEYS.find(k => fam.id.toLowerCase().includes(k)) ?? family;
        counts.set(key, (counts.get(key) ?? 0) + fam.sequenceIds.length);
      }
    }

    return VTG_FAMILY_KEYS
      .filter(k => counts.has(k))
      .map(k => ({
        id: k,
        name: FAMILY_META[k]?.name ?? k,
        iconPath: FAMILY_META[k]?.iconPath ?? "",
        sequenceCount: counts.get(k) ?? 0,
      }));
  });

  interface FamilySequenceEntry {
    sequenceId: string;
    catalogId: string;
    turnLabel: string;
    word: string;
  }

  const familySequences = $derived.by((): FamilySequenceEntry[] => {
    if (!selectedFamily) return [];
    const entries: FamilySequenceEntry[] = [];

    for (const catalog of catalogs) {
      const coord = parseTurnPattern(catalog.turnPattern);
      const turnLabel = coord
        ? (coord.blue === coord.red ? `${coord.blue}` : `${coord.blue}|${coord.red}`)
        : catalog.turnPattern;

      for (const fam of catalog.families) {
        if (!fam.id.toLowerCase().includes(selectedFamily)) continue;
        for (const seqId of fam.sequenceIds) {
          entries.push({
            sequenceId: seqId,
            catalogId: catalog.id,
            turnLabel,
            word: seqId,
          });
        }
      }
    }

    entries.sort((a, b) => a.turnLabel.localeCompare(b.turnLabel) || a.word.localeCompare(b.word));
    return entries;
  });
</script>

<div class="family-browser">
  {#if !selectedFamily}
    <div class="family-picker">
      {#each familyInfos as info (info.id)}
        <button
          type="button"
          class="family-button"
          aria-label="{info.name} — {info.sequenceCount} sequences"
          onclick={() => { selectedFamily = info.id; }}
        >
          {#if info.iconPath}
            <img src={info.iconPath} alt="" class="family-icon" aria-hidden="true" />
          {/if}
          <span class="family-name">{info.name}</span>
          <span class="family-count">{info.sequenceCount}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="family-sequences">
      <div class="family-header">
        <button
          type="button"
          class="back-btn"
          aria-label="Back to family picker"
          onclick={() => { selectedFamily = null; }}
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
        <span class="family-title">
          {FAMILY_META[selectedFamily]?.name ?? selectedFamily}
        </span>
        <span class="family-seq-count">{familySequences.length} sequences</span>
      </div>

      <div class="sequence-grid">
        {#each familySequences as entry (entry.sequenceId + entry.catalogId)}
          <button
            type="button"
            class="sequence-card"
            aria-label="{entry.word} (turns: {entry.turnLabel})"
            onclick={() => onSelectSequence({ id: entry.sequenceId, word: entry.word } as SequenceData)}
          >
            <span class="seq-word">{entry.word}</span>
            <span class="seq-turns">{entry.turnLabel}</span>
          </button>
        {/each}
      </div>

      {#if familySequences.length === 0}
        <div class="empty-state">
          <p>No sequences found for this family.</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .family-browser {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ── Family Picker ── */

  .family-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .family-button {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .family-button:hover {
    border-color: rgba(183, 99, 205, 0.4);
    background: rgba(183, 99, 205, 0.08);
  }

  .family-button:focus-visible {
    outline: 2px solid rgba(183, 99, 205, 0.6);
    outline-offset: 2px;
  }

  .family-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .family-name { flex: 1; text-align: left; }

  .family-count {
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-weight: 400;
  }

  /* ── Family Sequences ── */

  .family-sequences {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .family-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .back-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .family-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .family-seq-count {
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-left: auto;
  }

  .sequence-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }

  .sequence-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font: inherit;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .sequence-card:hover {
    border-color: rgba(183, 99, 205, 0.35);
  }

  .seq-word {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .seq-turns {
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .empty-state {
    padding: 48px 24px;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 14px;
  }

  @media (max-width: 768px) {
    .family-browser { padding: 16px; }
    .family-picker { grid-template-columns: repeat(2, 1fr); }
    .sequence-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
  }

  @media (prefers-reduced-motion: reduce) {
    .family-button, .sequence-card, .back-btn { transition: none; }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/VtgFamilyBrowser.svelte
git commit -m "feat(choreo-card): add VtgFamilyBrowser with family picker + sequence grid"
```

---

### Task 5: Update CatalogBrowseFilterBar — VTG View Mode Toggle

**Files:**
- Modify: `src/lib/features/choreo-card/components/CatalogBrowseFilterBar.svelte`

- [ ] **Step 1: Add view mode toggle for VTG**

In `CatalogBrowseFilterBar.svelte`, add after the existing `collection-toggle` div, inside the `.filter-header`:

```svelte
{#if catalogState.collection === 'VTG'}
  <div class="vtg-view-toggle" role="radiogroup" aria-label="VTG view mode">
    <button
      class="view-pill"
      class:active={catalogState.vtgViewMode === 'turns'}
      type="button"
      role="radio"
      aria-checked={catalogState.vtgViewMode === 'turns'}
      onclick={() => catalogState.setVtgViewMode('turns')}
    >By Turns</button>
    <button
      class="view-pill"
      class:active={catalogState.vtgViewMode === 'family'}
      type="button"
      role="radio"
      aria-checked={catalogState.vtgViewMode === 'family'}
      onclick={() => catalogState.setVtgViewMode('family')}
    >By Family</button>
  </div>
{/if}
```

- [ ] **Step 2: Remove VTG family chips and turn-pattern chips for VTG mode**

Wrap the existing VTG family chips `{#each}` block and the turn patterns `{#each}` block in the filter rows so they only render for LOOPs:

In the first `FilterChipRow` (lines 74-96), the VTG branch already exists. Replace the entire `{:else}` block for VTG families with nothing — remove the VTG family chips when in VTG mode:

```svelte
<FilterChipRow>
  {#if catalogState.collection === 'LOOPs'}
    {#each catalogState.availableFilters.loopTypes as type (type)}
      <FilterChipBase
        label={loopTypeLabel(type)}
        active={catalogState.filters.loopTypes.includes(type)}
        mode="toggle"
        chipColor={chipColor}
        onclick={() => catalogState.toggleFilter('loopTypes', type)}
      />
    {/each}
  {/if}
</FilterChipRow>
```

In the second `FilterChipRow` (lines 98-147), wrap the entire block so it only renders for LOOPs:

```svelte
{#if catalogState.collection === 'LOOPs'}
  <FilterChipRow>
    {#each catalogState.availableFilters.sliceTypes as slice (slice)}
      <!-- ... existing slice/grid/step/turn chips unchanged ... -->
    {/each}
    <!-- ... rest of the row unchanged ... -->
  </FilterChipRow>
{/if}
```

- [ ] **Step 3: Add styles for the view mode toggle**

Add to the `<style>` block:

```css
.vtg-view-toggle {
  display: flex;
}

.view-pill {
  padding: 8px 16px;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-pill:first-child { border-radius: 8px 0 0 8px; }
.view-pill:last-child { border-radius: 0 8px 8px 0; border-left: 0; }

.view-pill.active {
  background: var(--vtg-accent-bg, rgba(183, 99, 205, 0.15));
  border-color: var(--vtg-accent-border, rgba(183, 99, 205, 0.4));
  color: var(--theme-text, #fff);
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/CatalogBrowseFilterBar.svelte
git commit -m "feat(choreo-card): add VTG view mode toggle, hide VTG filter chips"
```

---

### Task 6: Wire VtgTurnMatrix and VtgFamilyBrowser into CatalogBrowseGrid

**Files:**
- Modify: `src/lib/features/choreo-card/components/CatalogBrowseGrid.svelte`

- [ ] **Step 1: Conditionally render matrix or family browser for VTG**

Replace the entire content of `CatalogBrowseGrid.svelte`:

```svelte
<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { VtgViewMode } from "../state/catalog-browse-types";
  import CatalogCard from "./CatalogCard.svelte";
  import VtgTurnMatrix from "./VtgTurnMatrix.svelte";
  import VtgFamilyBrowser from "./VtgFamilyBrowser.svelte";
  import { LOOP_TYPE_LABELS } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { VTG_FAMILY_LABELS } from "../state/catalog-browse-types";

  interface Props {
    groupedCatalogs: Map<string, Catalog[]>;
    collection: 'LOOPs' | 'VTG';
    vtgViewMode?: VtgViewMode;
    allVtgCatalogs?: Catalog[];
    onSelectCatalog: (catalog: Catalog) => void;
    onSelectSequence?: (sequence: SequenceData) => void;
  }

  const {
    groupedCatalogs,
    collection,
    vtgViewMode = 'turns',
    allVtgCatalogs = [],
    onSelectCatalog,
    onSelectSequence,
  }: Props = $props();

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

  function computeVaryingAxes(catalogs: Catalog[]) {
    if (catalogs.length <= 1) return { stepCount: false, turn: false, reversal: false, slice: false, grid: false };
    return {
      stepCount: new Set(catalogs.map(d => d.stepCount)).size > 1,
      turn: new Set(catalogs.map(d => d.turnPattern)).size > 1,
      reversal: new Set(catalogs.map(d => d.reversalPattern)).size > 1,
      slice: new Set(catalogs.map(d => d.sliceType)).size > 1,
      grid: new Set(catalogs.map(d => d.gridMode)).size > 1,
    };
  }

  function contextTags(catalog: Catalog, axes: ReturnType<typeof computeVaryingAxes>): string {
    const parts: string[] = [];
    if (axes.stepCount) parts.push(`${catalog.stepCount}-step`);
    if (axes.slice) parts.push(capitalize(catalog.sliceType));
    if (axes.turn) parts.push(formatTurn(catalog.turnPattern));
    if (axes.grid) parts.push(capitalize(catalog.gridMode));
    if (parts.length === 0 && !axes.reversal) {
      parts.push(formatTurn(catalog.turnPattern));
    }
    return parts.join(' · ');
  }
</script>

{#if collection === 'VTG' && vtgViewMode === 'turns'}
  <VtgTurnMatrix catalogs={allVtgCatalogs} {onSelectCatalog} />
{:else if collection === 'VTG' && vtgViewMode === 'family'}
  <VtgFamilyBrowser
    catalogs={allVtgCatalogs}
    onSelectSequence={onSelectSequence ?? (() => {})}
  />
{:else}
  <div class="browse-grid-container">
    {#each [...groupedCatalogs.entries()] as [key, items] (key)}
      {@const axes = computeVaryingAxes(items)}
      <section class="catalog-group">
        <div class="group-header">
          <span class="group-name">{groupLabel(key)}</span>
          <span class="group-rule" aria-hidden="true"></span>
          <span class="group-count">{items.length} {items.length === 1 ? 'catalog' : 'catalogs'}</span>
        </div>
        <div class="catalog-grid">
          {#each items as catalog (catalog.id)}
            <CatalogCard
              {catalog}
              tags={contextTags(catalog, axes)}
              onSelect={() => onSelectCatalog(catalog)}
            />
          {/each}
        </div>
      </section>
    {/each}

    {#if groupedCatalogs.size === 0}
      <div class="empty-state">
        <i class="fas fa-search empty-icon" aria-hidden="true"></i>
        <p class="empty-text">No catalogs match these filters</p>
      </div>
    {/if}
  </div>
{/if}

<!-- Keep all existing styles exactly as-is -->
<style>
  .browse-grid-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .catalog-group {
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

  .catalog-grid {
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
    .catalog-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  }
</style>
```

- [ ] **Step 2: Update CatalogBrowser.svelte to pass new props**

In `src/lib/features/choreo-card/components/CatalogBrowser.svelte`, update the `CatalogBrowseGrid` usage (around line 500-505). Change from:

```svelte
<CatalogBrowseGrid
  groupedCatalogs={browseState.groupedCatalogs}
  collection={browseState.collection}
  onSelectCatalog={handleBrowseCatalogSelect}
/>
```

To:

```svelte
<CatalogBrowseGrid
  groupedCatalogs={browseState.groupedCatalogs}
  collection={browseState.collection}
  vtgViewMode={browseState.vtgViewMode}
  allVtgCatalogs={browseState.collection === 'VTG' ? browseState.filteredCatalogs : []}
  onSelectCatalog={handleBrowseCatalogSelect}
  onSelectSequence={onSelectSequence}
/>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/CatalogBrowseGrid.svelte src/lib/features/choreo-card/components/CatalogBrowser.svelte
git commit -m "feat(choreo-card): wire VTG matrix and family browser into browse grid"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 2: Run existing tests**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass, no regressions

- [ ] **Step 3: Build verification**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Visual verification**

Navigate to the app → Choreo Cards → VTG tab. Verify:
1. "By Turns" / "By Family" toggle appears
2. By Turns shows 7×7 matrix with blue/red headers
3. Diagonal cells (symmetric) have stronger purple fill
4. Clicking a cell drills into the catalog interior
5. "By Family" shows 6 family buttons with element icons
6. Clicking a family shows flat sequence grid
7. LOOPs tab is unchanged

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix(choreo-card): address VTG matrix verification issues"
```
