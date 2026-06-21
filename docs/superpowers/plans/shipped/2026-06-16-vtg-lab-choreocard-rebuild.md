# VTG Lab Explorer — ChoreoCard Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the VTG Lab Explorer's bare 4-across pictograph strips with a per-mode 7×7 turn matrix of real `ChoreoCard`s sourced from the deck-releaser's TnD catalog pipeline.

**Architecture:** A pure adapter loads the `l1-tnd-motions` base catalog once, classifies seeds into the 6 TnD families, enumerates each family's seeds × 49 turn patterns via the existing `buildTnDCards`, and resolves them to `SequenceData` with `resolveDeckSequences`. A new `VtgModeMatrix` renders one extracted `TurnMatrixGrid` per seed, lazily mounting a `ChoreoCard` per cell. `ModeExplorer` keeps its header and swaps its body. `SequenceStrip` is retired.

**Tech Stack:** Svelte 5 (runes), Vitest, Firestore catalog loaders, existing `choreo-card` composer/variation services.

Spec: `docs/superpowers/specs/2026-06-16-vtg-lab-choreocard-rebuild-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/features/lab/vtg-lab/domain/vtg-tnd-family-map.ts` | VTG mode → TnD family id | Create |
| `src/lib/features/lab/vtg-lab/domain/tnd-turn-patterns.ts` | The 49 turn-pattern strings + per-seed grouping (pure) | Create |
| `src/lib/features/lab/vtg-lab/domain/__tests__/tnd-turn-patterns.test.ts` | Tests for the pure helpers | Create |
| `src/lib/features/lab/vtg-lab/services/resolve-tnd-family-cards.ts` | Async: load → classify → enumerate → resolve → group by seed | Create |
| `src/lib/features/choreo-card/components/TurnMatrixGrid.svelte` | Shared 7×7 grid shell + axis headers + `cell` snippet | Create |
| `src/lib/features/choreo-card/components/TnDTurnMatrix.svelte` | Refactor to consume `TurnMatrixGrid` | Modify |
| `src/lib/features/lab/vtg-lab/components/VtgModeMatrix.svelte` | Per-seed matrices of lazy `ChoreoCard` cells | Create |
| `src/lib/features/lab/vtg-lab/components/ModeExplorer.svelte` | Keep header, render `VtgModeMatrix` | Modify |
| `src/lib/features/lab/vtg-lab/components/SequenceStrip.svelte` | Retire | Delete |

`vtg-sequence-data.ts` and `PictographContainer` are **untouched** (RosettaPanel still uses them).

---

## Task 1: VTG mode → TnD family mapping

**Files:**
- Create: `src/lib/features/lab/vtg-lab/domain/vtg-tnd-family-map.ts`
- Test: `src/lib/features/lab/vtg-lab/domain/__tests__/tnd-turn-patterns.test.ts` (shared test file, created in Task 2; mapping assertions added here)

- [ ] **Step 1: Create the mapping**

`src/lib/features/lab/vtg-lab/domain/vtg-tnd-family-map.ts`:

```ts
import type { VTGMode } from "$lib/features/learn/domain/constants/vtg-experience-data";

/**
 * The 6 VTG modes map 1:1 to the 6 TnD families used by the deck releaser
 * (deck-composer FAMILY_ORDER). Timing (1st letter) + direction (2nd letter):
 *   S=split, T=together, Q=quarter | S=same, O=opposite.
 */
export const VTG_MODE_TO_TND_FAMILY: Record<VTGMode, string> = {
  SS: "split-same",
  TS: "tog-same",
  SO: "split-opp",
  TO: "tog-opp",
  QS: "quarter-same",
  QO: "quarter-opp",
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run check:fast 2>&1 | grep -i "vtg-tnd-family-map" || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/vtg-lab/domain/vtg-tnd-family-map.ts
git commit -m "feat(vtg-lab): add VTG mode to TnD family mapping" -- src/lib/features/lab/vtg-lab/domain/vtg-tnd-family-map.ts
```

---

## Task 2: Pure turn-pattern helpers (49 patterns + per-seed grouping)

**Files:**
- Create: `src/lib/features/lab/vtg-lab/domain/tnd-turn-patterns.ts`
- Test: `src/lib/features/lab/vtg-lab/domain/__tests__/tnd-turn-patterns.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/features/lab/vtg-lab/domain/__tests__/tnd-turn-patterns.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { allTurnPatterns, groupCardsBySeed } from "../tnd-turn-patterns";
import { VTG_MODE_TO_TND_FAMILY } from "../vtg-tnd-family-map";

describe("VTG_MODE_TO_TND_FAMILY", () => {
  it("maps all 6 modes to distinct families", () => {
    const families = Object.values(VTG_MODE_TO_TND_FAMILY);
    expect(families).toHaveLength(6);
    expect(new Set(families).size).toBe(6);
    expect(VTG_MODE_TO_TND_FAMILY.SO).toBe("split-opp");
    expect(VTG_MODE_TO_TND_FAMILY.TO).toBe("tog-opp");
  });
});

describe("allTurnPatterns", () => {
  it("returns the 49 blue|red combinations in TURN_VALUES order", () => {
    const p = allTurnPatterns();
    expect(p).toHaveLength(49);
    expect(p[0]).toBe("0|0");
    expect(p).toContain("0.5|1");
    expect(p).toContain("3|3");
    expect(new Set(p).size).toBe(49);
  });
});

describe("groupCardsBySeed", () => {
  it("zips cards to resolved sequences and buckets them by seed + turn pattern", () => {
    const cards = [
      { sequenceId: "MPMP", sourceCatalogId: "l1-tnd-motions", word: "MPMP", footer: { center: "Split-Same", iconPath: "/a.svg" }, variation: { turnPattern: "0|0" } },
      { sequenceId: "MPMP", sourceCatalogId: "l1-tnd-motions", word: "MPMP", footer: { center: "Split-Same", iconPath: "/a.svg" }, variation: { turnPattern: "1|1" } },
      { sequenceId: "DJDJ", sourceCatalogId: "l1-tnd-motions", word: "DJDJ", footer: { center: "Split-Same", iconPath: "/a.svg" }, variation: { turnPattern: "0|0" } },
    ] as any[];
    const resolved = [
      { sequence: { id: "s1" }, turnLoopClosed: true },
      { sequence: { id: "s2" }, turnLoopClosed: true },
      { sequence: { id: "s3" }, turnLoopClosed: true },
    ] as any[];

    const seeds = groupCardsBySeed(cards, resolved);
    expect(seeds).toHaveLength(2);
    expect(seeds[0].seedId).toBe("MPMP");
    expect(seeds[0].byTurn.get("0|0")?.id).toBe("s1");
    expect(seeds[0].byTurn.get("1|1")?.id).toBe("s2");
    expect(seeds[1].seedId).toBe("DJDJ");
    expect(seeds[1].byTurn.get("0|0")?.id).toBe("s3");
    expect(seeds[0].footer.center).toBe("Split-Same");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/lab/vtg-lab/domain/__tests__/tnd-turn-patterns.test.ts`
Expected: FAIL — "Failed to resolve import ../tnd-turn-patterns".

- [ ] **Step 3: Write the implementation**

`src/lib/features/lab/vtg-lab/domain/tnd-turn-patterns.ts`:

```ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { CardFooter } from "$lib/features/choreo-card/domain/models/DeckRelease";
import type { ResolvedDeckSequence } from "$lib/features/choreo-card/services/deck-variation";
import { TURN_VALUES } from "$lib/features/choreo-card/domain/turn-pattern-parser";

/** Matches deck-composer's formatTurn: integers bare, halves as X.0/X.5. */
function formatTurn(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** The full 7×7 = 49 blue|red turn patterns, blue-major (matches buildTnDCards order is per-pattern, see groupCardsBySeed). */
export function allTurnPatterns(): string[] {
  const out: string[] = [];
  for (const blue of TURN_VALUES) {
    for (const red of TURN_VALUES) {
      out.push(`${formatTurn(blue)}|${formatTurn(red)}`);
    }
  }
  return out;
}

/** A base seed plus its resolved sequence per turn pattern. */
export interface SeedMatrix {
  seedId: string;
  word: string;
  footer: CardFooter;
  byTurn: Map<string, SequenceData>;
}

/** Minimal card shape this grouping needs (subset of DeckReleaseCard). */
export interface GroupableCard {
  sequenceId: string;
  word: string;
  footer: CardFooter;
  variation?: { turnPattern?: string };
}

/**
 * Zip cards to their positionally-resolved sequences (resolveDeckSequences
 * preserves order and never drops when bases are present), then bucket by seed
 * id and turn pattern. Seed order follows first appearance in `cards`.
 */
export function groupCardsBySeed(
  cards: GroupableCard[],
  resolved: ResolvedDeckSequence[],
): SeedMatrix[] {
  const bySeed = new Map<string, SeedMatrix>();
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!;
    const res = resolved[i];
    if (!res) continue;
    let entry = bySeed.get(card.sequenceId);
    if (!entry) {
      entry = { seedId: card.sequenceId, word: card.word, footer: card.footer, byTurn: new Map() };
      bySeed.set(card.sequenceId, entry);
    }
    const tp = card.variation?.turnPattern ?? "0|0";
    entry.byTurn.set(tp, res.sequence);
  }
  return [...bySeed.values()];
}
```

> Note: `buildTnDCards` emits cards pattern-outer, entry-inner, so a single seed's
> cards are interleaved across the array — `groupCardsBySeed` buckets by id, so
> order within the array does not matter. The positional zip to `resolved` is what
> must stay aligned, and `resolveDeckSequences` guarantees that.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/features/lab/vtg-lab/domain/__tests__/tnd-turn-patterns.test.ts`
Expected: PASS (3 suites).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/vtg-lab/domain/tnd-turn-patterns.ts src/lib/features/lab/vtg-lab/domain/__tests__/tnd-turn-patterns.test.ts
git commit -m "feat(vtg-lab): pure turn-pattern enumeration + per-seed grouping" -- src/lib/features/lab/vtg-lab/domain/tnd-turn-patterns.ts src/lib/features/lab/vtg-lab/domain/__tests__/tnd-turn-patterns.test.ts
```

---

## Task 3: Async adapter — resolve a family's seed matrices

**Files:**
- Create: `src/lib/features/lab/vtg-lab/services/resolve-tnd-family-cards.ts`

This composes existing services exactly as `parity-deck-source.ts:loadParityDeck` does. IO-bound (Firestore) so it is verified at runtime in Task 7, not unit-tested.

- [ ] **Step 1: Write the implementation**

`src/lib/features/lab/vtg-lab/services/resolve-tnd-family-cards.ts`:

```ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  TND_BASE_CATALOG_ID,
  buildTnDSeedClasses,
  getTnDFamilyOptions,
  buildTnDCards,
} from "$lib/features/choreo-card/services/deck-composer";
import { loadCatalogSequences } from "$lib/features/choreo-card/services/catalog-loader";
import { resolveDeckSequences } from "$lib/features/choreo-card/services/deck-variation";
import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { allTurnPatterns, groupCardsBySeed, type SeedMatrix } from "../domain/tnd-turn-patterns";

/**
 * For one TnD family (diamond), return its base seeds each with the full 7×7
 * turn grid resolved to SequenceData. Mirrors the deck-releaser TnD compose path
 * (deck-composer + deck-variation) so the cards are exactly what production ships.
 */
export async function resolveTnDFamilyCards(familyId: string): Promise<SeedMatrix[]> {
  const baseSeqs = await loadCatalogSequences(TND_BASE_CATALOG_ID);
  const seedClasses = buildTnDSeedClasses(baseSeqs);
  const families = getTnDFamilyOptions(seedClasses, ["diamond"]);
  const family = families.find((f) => f.familyId === familyId);
  if (!family) return [];

  const patterns = new Set(allTurnPatterns());
  const cards = buildTnDCards(families, new Set([familyId]), patterns, ["radial"]);
  if (cards.length === 0) return [];

  const baseByKey = new Map<string, SequenceData>();
  for (const s of baseSeqs) baseByKey.set(`${TND_BASE_CATALOG_ID}::${s.id}`, s);

  const edges = await loadDiamondEdges();
  const resolved = resolveDeckSequences(cards, baseByKey, edges);
  return groupCardsBySeed(cards, resolved);
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run check:fast 2>&1 | grep -i "resolve-tnd-family-cards" || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/vtg-lab/services/resolve-tnd-family-cards.ts
git commit -m "feat(vtg-lab): async adapter resolving a TnD family to seed matrices" -- src/lib/features/lab/vtg-lab/services/resolve-tnd-family-cards.ts
```

---

## Task 4: Extract `TurnMatrixGrid` shared shell + refactor `TnDTurnMatrix`

**Files:**
- Create: `src/lib/features/choreo-card/components/TurnMatrixGrid.svelte`
- Modify: `src/lib/features/choreo-card/components/TnDTurnMatrix.svelte`

The grid geometry (corner + red column headers + blue row headers + `grid-template: auto repeat(7,1fr)`, cqi-sized) is extracted verbatim from `TnDTurnMatrix` and exposes a `cell(blue, red)` snippet. `TnDTurnMatrix`'s existing select/navigate cell markup becomes the snippet body — no behavior change for its two consumers (deck-releaser picker, catalog browser).

- [ ] **Step 1: Create `TurnMatrixGrid.svelte`**

`src/lib/features/choreo-card/components/TurnMatrixGrid.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import { TURN_VALUES } from "../domain/turn-pattern-parser";

  interface Props {
    /** Rendered per cell with that cell's blue/red turn values. */
    cell: Snippet<[number, number]>;
    /** Optional content above the grid (e.g. preset bar). */
    header?: Snippet;
    ariaLabel?: string;
  }
  const { cell, header, ariaLabel = "Turn combination matrix" }: Props = $props();

  function formatTurn(v: number): string {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
</script>

<div class="matrix-container">
  {#if header}{@render header()}{/if}

  <div class="matrix-grid-wrapper">
    <div class="matrix-grid" role="grid" aria-label={ariaLabel}>
      <div class="header-cell corner" role="presentation">
        <span class="corner-blue">B</span>
        <span class="corner-sep">/</span>
        <span class="corner-red">R</span>
      </div>

      {#each TURN_VALUES as red (red)}
        <div class="header-cell col-header" role="columnheader" aria-label="Red {red} turns">
          <span class="header-val red-val">{formatTurn(red)}</span>
        </div>
      {/each}

      {#each TURN_VALUES as blue (blue)}
        <div class="header-cell row-header" role="rowheader" aria-label="Blue {blue} turns">
          <span class="header-val blue-val">{formatTurn(blue)}</span>
        </div>
        {#each TURN_VALUES as red (red)}
          {@render cell(blue, red)}
        {/each}
      {/each}
    </div>
  </div>
</div>

<style>
  .matrix-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    width: 100%;
    padding: 4px 0;
    box-sizing: border-box;
  }
  .matrix-grid-wrapper {
    width: 100%;
    max-width: 600px;
    container-type: inline-size;
  }
  .matrix-grid {
    display: grid;
    grid-template-columns: auto repeat(7, 1fr);
    grid-template-rows: auto repeat(7, 1fr);
    gap: clamp(4px, 1cqi, 8px);
    width: 100%;
  }
  .header-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(4px, 1cqi, 8px);
  }
  .corner {
    font-size: clamp(10px, 2.3cqi, 14px);
    font-weight: 700;
    gap: 1px;
    display: flex;
    align-items: baseline;
  }
  .corner-blue { color: #60a5fa; }
  .corner-sep { color: rgba(255, 255, 255, 0.2); font-weight: 400; }
  .corner-red { color: #f87171; }
  .header-val {
    font-size: clamp(11px, 2.5cqi, 15px);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .red-val { color: #f87171; }
  .blue-val { color: #60a5fa; }
  .col-header { border-bottom: 1px solid rgba(248, 113, 113, 0.15); }
  .row-header { border-right: 1px solid rgba(96, 165, 250, 0.15); }
  @media (max-width: 640px) {
    .matrix-container { padding: 12px; }
    .matrix-grid-wrapper { width: clamp(280px, 90vw, 480px); }
  }
</style>
```

- [ ] **Step 2: Refactor `TnDTurnMatrix.svelte` to consume it**

Replace the markup block (current lines ~94–191, the `<div class="matrix-container">…</div>`) with a `TurnMatrixGrid` whose `header` snippet is the existing preset bar and whose `cell` snippet is the existing per-cell select/navigate logic. Keep all script logic and the cell/`.empty` styles. Add at top of `<script>`:

```ts
import TurnMatrixGrid from "./TurnMatrixGrid.svelte";
```

New template body:

```svelte
<TurnMatrixGrid ariaLabel="TnD turn combination matrix">
  {#snippet header()}
    {#if selectable}
      <div class="preset-bar">
        {#each presets as preset (preset.id)}
          <FilterChipBase
            label={preset.label}
            icon={"fas " + preset.icon}
            mode="action"
            chipColor={preset.id === "clear" ? "#f87171" : "var(--theme-accent)"}
            onclick={() => onSetPatterns?.(preset.build())}
          />
        {/each}
      </div>
    {/if}
  {/snippet}

  {#snippet cell(blue, red)}
    {@const isSymmetric = blue === red}
    {#if selectable}
      {@const c = selectMap.get(`${blue},${red}`)}
      {#if c}
        {@const isSelected = selected?.has(c.turnPattern) ?? false}
        <button
          type="button"
          class="cell"
          class:symmetric={isSymmetric}
          class:selected={isSelected}
          role="gridcell"
          aria-selected={isSelected}
          aria-label="Blue {blue} red {red}, {c.count} sequences{isSymmetric ? ' (matched)' : ''}{isSelected ? ' — selected' : ''}"
          onclick={() => onToggle?.(c.turnPattern)}
        >
          <span class="turn-pair">
            <span class="turn-blue">{blue}</span><span class="turn-sep">|</span><span class="turn-red">{red}</span>
          </span>
          <span class="cell-count">{c.count}</span>
        </button>
      {:else}
        <div class="cell empty" role="gridcell" aria-label="No deck for blue {blue}, red {red}"></div>
      {/if}
    {:else}
      {@const catalog = catalogMap.get(`${blue},${red}`)}
      {#if catalog}
        <button
          type="button"
          class="cell"
          class:symmetric={isSymmetric}
          role="gridcell"
          aria-label="{catalog.totalSequences} sequences, blue {blue} red {red}{isSymmetric ? ' (symmetric)' : ''}"
          onclick={() => onSelectCatalog?.(catalog)}
        >
          <span class="turn-pair">
            <span class="turn-blue">{blue}</span><span class="turn-sep">|</span><span class="turn-red">{red}</span>
          </span>
          <span class="cell-count">{catalog.totalSequences} seq</span>
        </button>
      {:else}
        <div class="cell empty" role="gridcell" aria-label="No deck for blue {blue}, red {red}"></div>
      {/if}
    {/if}
  {/snippet}
</TurnMatrixGrid>
```

Delete from `TnDTurnMatrix.svelte`'s `<style>` the now-unused `.matrix-container`, `.matrix-grid-wrapper`, `.matrix-grid`, `.header-cell`, `.corner*`, `.header-val`, `.red-val`, `.blue-val`, `.col-header`, `.row-header` rules (moved to `TurnMatrixGrid`). Keep `.preset-bar`, `.cell*`, `.turn-*`, `.cell-count`, and the responsive `.cell-count { display:none }` rule. Remove the local `formatTurn` if no longer referenced (the snippet now receives numeric blue/red directly; the previous markup wrapped them in `formatTurn` — values are already `0, 0.5, …` so render them directly).

- [ ] **Step 3: Type-check**

Run: `npm run check:fast 2>&1 | grep -iE "TnDTurnMatrix|TurnMatrixGrid" || echo "clean"`
Expected: `clean`

- [ ] **Step 4: Visual parity check (manual)**

The dev server is on `:5173`. Open the two existing consumers and confirm the grid renders identically (axis labels, cells, presets, selection):
- Deck releaser TnD picker (Choreo Card module → deck releaser → TnD mode).
- Catalog browser turn matrix.

Record: "both render identically to pre-refactor" before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/TurnMatrixGrid.svelte src/lib/features/choreo-card/components/TnDTurnMatrix.svelte
git commit -m "refactor(choreo-card): extract TurnMatrixGrid shell from TnDTurnMatrix" -- src/lib/features/choreo-card/components/TurnMatrixGrid.svelte src/lib/features/choreo-card/components/TnDTurnMatrix.svelte
```

---

## Task 5: `LazyCardCell` + `VtgModeMatrix` — per-seed matrices of lazy `ChoreoCard` cells

**Files:**
- Create: `src/lib/features/lab/vtg-lab/components/LazyCardCell.svelte`
- Create: `src/lib/features/lab/vtg-lab/components/VtgModeMatrix.svelte`

`VtgModeMatrix` renders one `TurnMatrixGrid` per seed. Each cell is a `LazyCardCell` that reserves a fixed 5:7 box (no layout shift) and mounts its `ChoreoCard` only once scrolled near view (IntersectionObserver). `ChoreoCard` already caches its thumbnail via `PropAwareThumbnail` Firebase caching.

- [ ] **Step 1: Create `LazyCardCell.svelte`**

`src/lib/features/lab/vtg-lab/components/LazyCardCell.svelte`:

```svelte
<script lang="ts">
  import ChoreoCard from "$lib/features/choreo-card/components/ChoreoCard.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    sequence: SequenceData;
    notes: string;
  }
  const { sequence, notes }: Props = $props();

  let mounted = $state(false);

  function lazy(node: HTMLElement) {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          mounted = true;
          obs.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(node);
    return { destroy: () => obs.disconnect() };
  }
</script>

<div class="lazy-cell" use:lazy>
  {#if mounted}
    <ChoreoCard {sequence} cardMode showWord customNotesText={notes} showQRCodes={false} />
  {/if}
</div>

<style>
  .lazy-cell {
    width: 100%;
    aspect-ratio: 5 / 7;
  }
</style>
```

- [ ] **Step 2: Create `VtgModeMatrix.svelte`**

`src/lib/features/lab/vtg-lab/components/VtgModeMatrix.svelte`:

```svelte
<script lang="ts">
  import TurnMatrixGrid from "$lib/features/choreo-card/components/TurnMatrixGrid.svelte";
  import LazyCardCell from "./LazyCardCell.svelte";
  import { resolveTnDFamilyCards } from "../services/resolve-tnd-family-cards";
  import type { SeedMatrix } from "../domain/tnd-turn-patterns";

  interface Props {
    /** TnD family id, e.g. "split-opp". */
    familyId: string;
  }
  const { familyId }: Props = $props();

  let seeds = $state<SeedMatrix[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    const fam = familyId;
    loading = true;
    error = null;
    seeds = [];
    resolveTnDFamilyCards(fam)
      .then((res) => {
        if (fam !== familyId) return; // stale
        seeds = res;
      })
      .catch((e) => {
        error = e instanceof Error ? e.message : "Failed to load sequences";
      })
      .finally(() => {
        if (fam === familyId) loading = false;
      });
  });

  function turnKey(blue: number, red: number): string {
    const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
    return `${f(blue)}|${f(red)}`;
  }
</script>

{#if loading}
  <div class="status" role="status">Loading sequences…</div>
{:else if error}
  <div class="status error" role="alert"><i class="fas fa-triangle-exclamation"></i> {error}</div>
{:else if seeds.length === 0}
  <div class="status">No sequences for this family.</div>
{:else}
  {#each seeds as seed (seed.seedId)}
    <section class="seed-block">
      <h3 class="seed-title">{seed.word}</h3>
      <TurnMatrixGrid ariaLabel="{seed.word} turn matrix">
        {#snippet cell(blue, red)}
          {@const seq = seed.byTurn.get(turnKey(blue, red))}
          {#if seq}
            <LazyCardCell sequence={seq} notes={seed.footer.center} />
          {:else}
            <div class="card-empty" aria-label="No sequence for {blue}|{red}"></div>
          {/if}
        {/snippet}
      </TurnMatrixGrid>
    </section>
  {/each}
{/if}

<style>
  .status {
    padding: 2rem;
    text-align: center;
    color: var(--theme-text-secondary, #888);
    font-size: var(--font-size-min, 14px);
  }
  .status.error { color: #fbbf24; }
  .seed-block {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .seed-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-secondary, #888);
  }
  .card-empty {
    width: 100%;
    aspect-ratio: 5 / 7;
    border-radius: clamp(4px, 1cqi, 8px);
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.03);
  }
</style>
```

- [ ] **Step 3: Type-check**

Run: `npm run check:fast 2>&1 | grep -iE "VtgModeMatrix|LazyCardCell" || echo "clean"`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/vtg-lab/components/VtgModeMatrix.svelte src/lib/features/lab/vtg-lab/components/LazyCardCell.svelte
git commit -m "feat(vtg-lab): per-seed 7x7 ChoreoCard matrix with lazy cells" -- src/lib/features/lab/vtg-lab/components/VtgModeMatrix.svelte src/lib/features/lab/vtg-lab/components/LazyCardCell.svelte
```

---

## Task 6: Rewrite `ModeExplorer` body, retire `SequenceStrip`

**Files:**
- Modify: `src/lib/features/lab/vtg-lab/components/ModeExplorer.svelte`
- Delete: `src/lib/features/lab/vtg-lab/components/SequenceStrip.svelte`

- [ ] **Step 1: Swap the body**

In `ModeExplorer.svelte`, replace the imports block (lines 7–12) with:

```ts
import { VTG_MODE_INFO } from "$lib/features/learn/domain/constants/vtg-experience-data";
import type { VtgModeGroup } from "../domain/vtg-lab-types";
import { VTG_MODE_TO_TND_FAMILY } from "../domain/vtg-tnd-family-map";
import VtgModeMatrix from "./VtgModeMatrix.svelte";
```

Delete the `bluePropType`, `redPropType`, `chains`, and `groupedChains` deriveds (lines 22–52). Keep `modeInfo` / `modeColor`. Add:

```ts
const familyId = $derived(VTG_MODE_TO_TND_FAMILY[modeGroup.mode]);
```

Replace the `{#each groupedChains …}` block (lines 80–96) with:

```svelte
<VtgModeMatrix {familyId} />
```

Leave the `.mode-header` block and all header styles intact. Remove the now-unused `.rotation-group`, `.rotation-label`, `.strips-stack` style rules.

- [ ] **Step 2: Delete `SequenceStrip`**

```bash
git rm src/lib/features/lab/vtg-lab/components/SequenceStrip.svelte
```

- [ ] **Step 3: Confirm no dangling imports**

Run: `grep -rn "SequenceStrip" src/ || echo "no refs"`
Expected: `no refs`

- [ ] **Step 4: Type-check**

Run: `npm run check:fast 2>&1 | grep -iE "ModeExplorer|SequenceStrip" || echo "clean"`
Expected: `clean`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/vtg-lab/components/ModeExplorer.svelte
git commit -m "feat(vtg-lab): render ChoreoCard matrix in ModeExplorer, retire SequenceStrip" -- src/lib/features/lab/vtg-lab/components/ModeExplorer.svelte src/lib/features/lab/vtg-lab/components/SequenceStrip.svelte
```

---

## Task 7: Full verification

- [ ] **Step 1: Full type check**

Run: `npm run check > /tmp/vtg-final.log 2>&1; grep -ciE "error" /tmp/vtg-final.log; grep -iE "vtg-lab|TurnMatrixGrid|TnDTurnMatrix" /tmp/vtg-final.log || echo "no errors in touched files"`
Expected: no errors attributable to the touched files (project baseline errors elsewhere are pre-existing — compare against the baseline count from before this work).

- [ ] **Step 2: Run the unit tests**

Run: `npx vitest run src/lib/features/lab/vtg-lab/`
Expected: PASS.

- [ ] **Step 3: Runtime verification (manual, dev server :5173)**

Open Lab → VTG → Explorer. For each mode chip (SS…QO):
- Mode header still shows name / Type / TKA position + motion.
- A 7×7 matrix renders per seed, axis-labelled blue (rows) × red (cols).
- Cells are real ChoreoCards (word + pictograph thumbnail + TnD footer), not bare pictographs.
- Scrolling lazily fills offscreen cells; no layout shift as they mount.
- SO shows "Split-Opposite" content; the matrix reflects that family's seeds.

Capture confirmation (screenshot or "confirmed renders as cards") — per verification protocol, do not claim done without it.

- [ ] **Step 4: Confirm the two TnDTurnMatrix consumers still work** (deck-releaser TnD picker, catalog browser) — already checked in Task 4 Step 4; re-confirm nothing regressed after the later commits.

---

## Self-Review

- **Spec coverage:** mode→family (T1), 49-turn enumeration + grouping (T2), resolve pipeline (T3), shared `TurnMatrixGrid` no-fork (T4), `VtgModeMatrix` + lazy cells (T5), `ModeExplorer` rewrite + `SequenceStrip` retire (T6), header kept (T6 Step 1), `vtg-sequence-data` preserved (file structure note), perf/lazy (T5). All covered.
- **Type consistency:** `SeedMatrix`/`GroupableCard` defined in T2 and consumed in T3/T5; `resolveTnDFamilyCards(familyId)` defined T3, called T5; `VTG_MODE_TO_TND_FAMILY` defined T1, used T6; `TurnMatrixGrid` `cell` snippet signature `(blue:number, red:number)` consistent T4/T5.
- **Placeholder scan:** the only placeholder shell (CardCell snippet in T5 Step 1) is explicitly replaced in T5 Step 2 with `LazyCardCell`. No TBDs.
- **Open risk:** seed-count per family unverified against live catalog — if large, matrices stack and scroll (acceptable v1, no pagination). `resolveDeckSequences` order-alignment is the load-bearing assumption, asserted by the `groupCardsBySeed` test + verified at runtime in T7.
