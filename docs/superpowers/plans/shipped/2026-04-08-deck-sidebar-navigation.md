# Deck Sidebar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the step-by-step breadcrumb wizard in the Deck tab with a sidebar filter panel on desktop (≥1024px), keeping the mobile wizard intact.

**Architecture:** Add a responsive layout fork in `DeckDrillDown.svelte` — desktop renders `DeckFilterSidebar` + `DeckResultsPanel` side-by-side, mobile keeps the existing wizard. The state machine (`deck-drilldown-state.svelte.ts`) is completely untouched. New components call the same `selectPath`, `selectShape`, etc. methods.

**Tech Stack:** Svelte 5, TypeScript, CSS media queries, existing DrillPill/GridModeCard/ElementalFamilyCard components.

**Spec:** `docs/superpowers/specs/2026-04-07-deck-sidebar-navigation-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/features/choreo-card/components/drilldown/sidebar/SidebarFilterSection.svelte` | Reusable wrapper for each filter section (label, state, expand/collapse) |
| Create | `src/lib/features/choreo-card/components/drilldown/sidebar/CollectionSection.svelte` | LOOPs / VTG chip selector |
| Create | `src/lib/features/choreo-card/components/drilldown/sidebar/ShapeSection.svelte` | Loop type + slice + grid pills |
| Create | `src/lib/features/choreo-card/components/drilldown/sidebar/CategorySection.svelte` | VTG family compact cards + grid mode |
| Create | `src/lib/features/choreo-card/components/drilldown/sidebar/StepCountSection.svelte` | Step count pills |
| Create | `src/lib/features/choreo-card/components/drilldown/sidebar/TurnPatternSection.svelte` | Turn pattern pills with inline uniform expansion |
| Create | `src/lib/features/choreo-card/components/drilldown/sidebar/ReversalSection.svelte` | Reversal pattern pills with dot visualization |
| Create | `src/lib/features/choreo-card/components/drilldown/sidebar/DeckFilterSidebar.svelte` | Orchestrates all sections, reads state from context |
| Create | `src/lib/features/choreo-card/components/drilldown/DeckResultsPanel.svelte` | Filtered deck card grid with count header |
| Modify | `src/lib/features/choreo-card/components/drilldown/DeckDrillDown.svelte` | Add desktop/mobile layout fork |
| Modify | `src/lib/features/choreo-card/state/deck-drilldown-state.svelte.ts` | Remove debug console.logs (cleanup) |

---

### Task 1: SidebarFilterSection wrapper

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/sidebar/SidebarFilterSection.svelte`

This is the reusable container every sidebar section uses. It handles the label, the three visual states (active, selected, disabled), and the accent border.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/choreo-card/components/drilldown/sidebar/SidebarFilterSection.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  type SectionState = 'active' | 'selected' | 'disabled';

  interface Props {
    label: string;
    state: SectionState;
    accentColor?: string;
    disabledMessage?: string;
    children: Snippet;
  }

  let {
    label,
    state,
    accentColor = '#63b7cd',
    disabledMessage = '',
    children,
  }: Props = $props();
</script>

<div
  class="filter-section"
  class:active={state === 'active' || state === 'selected'}
  class:disabled={state === 'disabled'}
  style="--sf-accent: {accentColor}"
>
  <div class="section-label">{label}</div>
  {#if state === 'disabled'}
    <div class="disabled-msg">{disabledMessage}</div>
  {:else}
    {@render children()}
  {/if}
</div>

<style>
  .filter-section {
    padding: 14px 16px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: border-color 0.15s ease, opacity 0.15s ease;
  }

  .filter-section.active {
    border-color: rgba(var(--sf-accent-rgb, 99,183,205), 0.25);
    background: rgba(var(--sf-accent-rgb, 99,183,205), 0.03);
  }

  .filter-section.disabled {
    opacity: 0.3;
    border-style: dashed;
  }

  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.45;
    margin-bottom: 10px;
    font-weight: 600;
  }

  .disabled-msg {
    font-size: 12px;
    opacity: 0.5;
    padding: 4px 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .filter-section { transition: none; }
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors related to SidebarFilterSection.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/sidebar/SidebarFilterSection.svelte
git commit -m "feat(cards): add SidebarFilterSection wrapper component"
```

---

### Task 2: CollectionSection

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/sidebar/CollectionSection.svelte`

Two chips: LOOPs and VTG. Clicking one calls `state.selectPath()`.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/choreo-card/components/drilldown/sidebar/CollectionSection.svelte -->
<script lang="ts">
  import type { DrillPath } from '../../../state/deck-drilldown-types';
  import DrillPill from '../DrillPill.svelte';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    selectedPath: DrillPath | null;
    accentColor: string;
    onSelectPath: (path: DrillPath) => void;
  }

  let { selectedPath, accentColor, onSelectPath }: Props = $props();

  const paths: DrillPath[] = ['LOOPs', 'VTG'];
</script>

<SidebarFilterSection
  label="Collection"
  state="active"
  {accentColor}
>
  <div class="pill-row">
    {#each paths as path}
      <DrillPill
        label={path}
        selected={selectedPath === path}
        onClick={() => onSelectPath(path)}
      />
    {/each}
  </div>
</SidebarFilterSection>

<style>
  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/sidebar/CollectionSection.svelte
git commit -m "feat(cards): add CollectionSection for sidebar"
```

---

### Task 3: ShapeSection

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/sidebar/ShapeSection.svelte`

Compact version of ShapeStep. Loop type multi-select pills, slice pills, grid mode pills. No "Continue" button — calls `onSelectShape` whenever any selection changes.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/choreo-card/components/drilldown/sidebar/ShapeSection.svelte -->
<script lang="ts">
  import type { Deck } from '../../../domain/models/Deck';
  import type { ShapeSelections } from '../../../state/deck-drilldown-types';
  import DrillPill from '../DrillPill.svelte';
  import GridModeCard from '../GridModeCard.svelte';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    decks: Deck[];
    currentShape: ShapeSelections | null;
    accentColor: string;
    onSelectShape: (shape: ShapeSelections) => void;
  }

  let { decks, currentShape, accentColor, onSelectShape }: Props = $props();

  const LOOP_TYPE_ORDER = ['Rotated', 'Mirrored', 'Swapped', 'Inverted', 'Rewound'] as const;
  const SLICE_OPTIONS = ['Halved', 'Quartered'] as const;
  const GRID_OPTIONS = ['Diamond', 'Box'] as const;

  let availableLoopTypes = $derived(
    LOOP_TYPE_ORDER.filter((lt) =>
      decks.some((d) => d.loopType?.toLowerCase() === lt.toLowerCase())
    )
  );

  let availableGridModes = $derived(
    GRID_OPTIONS.filter((g) =>
      decks.some((d) => d.gridMode.toLowerCase() === g.toLowerCase())
    )
  );

  // Initialize from currentShape or defaults
  let selectedLoopTypes = $state<string[]>(
    currentShape ? currentShape.loopTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)) : []
  );
  let selectedSlice = $state<string>(
    currentShape ? currentShape.sliceType.charAt(0).toUpperCase() + currentShape.sliceType.slice(1) : 'Halved'
  );
  let selectedGrid = $state<string>(
    currentShape ? currentShape.gridMode.charAt(0).toUpperCase() + currentShape.gridMode.slice(1) : ''
  );

  // Auto-select first loop type if none selected
  $effect(() => {
    if (selectedLoopTypes.length === 0 && availableLoopTypes.length > 0) {
      selectedLoopTypes = [availableLoopTypes[0]!];
    }
  });

  $effect(() => {
    if (!selectedGrid && availableGridModes.length > 0) {
      selectedGrid = availableGridModes[0]!;
    }
  });

  let rotatedSelected = $derived(
    selectedLoopTypes.some((lt) => lt.toLowerCase() === 'rotated')
  );
  let quarteredLocked = $derived(!rotatedSelected);

  $effect(() => {
    if (quarteredLocked && selectedSlice === 'Quartered') {
      selectedSlice = 'Halved';
    }
  });

  function emitSelection(): void {
    if (selectedLoopTypes.length === 0 || !selectedGrid) return;
    onSelectShape({
      loopTypes: selectedLoopTypes.map((lt) => lt.toLowerCase()),
      sliceType: selectedSlice.toLowerCase() as 'halved' | 'quartered',
      gridMode: selectedGrid.toLowerCase(),
    });
  }

  function toggleLoopType(lt: string): void {
    const idx = selectedLoopTypes.indexOf(lt);
    if (idx >= 0) {
      if (selectedLoopTypes.length > 1) {
        selectedLoopTypes = selectedLoopTypes.filter((_, i) => i !== idx);
      }
    } else {
      selectedLoopTypes = [...selectedLoopTypes, lt];
    }
    emitSelection();
  }

  function selectSlice(s: string): void {
    if (s === 'Quartered' && quarteredLocked) return;
    selectedSlice = s;
    emitSelection();
  }

  function selectGrid(g: string): void {
    selectedGrid = g;
    emitSelection();
  }
</script>

<SidebarFilterSection label="Shape" state="active" {accentColor}>
  <div class="sub-group">
    <span class="sub-label">LOOP TYPE</span>
    <div class="pill-row">
      {#each availableLoopTypes as lt}
        <DrillPill
          label={lt}
          selected={selectedLoopTypes.includes(lt)}
          onClick={() => toggleLoopType(lt)}
        />
      {/each}
    </div>
  </div>

  <div class="sub-group">
    <span class="sub-label">SLICE</span>
    <div class="pill-row">
      {#each SLICE_OPTIONS as s}
        <DrillPill
          label={s}
          selected={selectedSlice === s}
          locked={s === 'Quartered' && quarteredLocked}
          onClick={() => selectSlice(s)}
        />
      {/each}
    </div>
  </div>

  {#if availableGridModes.length > 0}
    <div class="sub-group">
      <span class="sub-label">GRID</span>
      <div class="grid-row">
        {#each availableGridModes as g}
          <GridModeCard
            mode={g.toLowerCase() as 'diamond' | 'box'}
            selected={selectedGrid === g}
            onClick={() => selectGrid(g)}
          />
        {/each}
      </div>
    </div>
  {/if}
</SidebarFilterSection>

<style>
  .sub-group {
    margin-bottom: 12px;
  }

  .sub-group:last-child {
    margin-bottom: 0;
  }

  .sub-label {
    display: block;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(255, 255, 255, 0.2);
    margin-bottom: 8px;
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .grid-row {
    display: flex;
    gap: 8px;
  }

  /* Compact the grid mode cards for sidebar */
  .grid-row :global(.grid-mode-card) {
    padding: 10px 16px;
  }

  .grid-row :global(.grid-svg) {
    width: 40px;
    height: 40px;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/sidebar/ShapeSection.svelte
git commit -m "feat(cards): add ShapeSection for sidebar"
```

---

### Task 4: CategorySection

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/sidebar/CategorySection.svelte`

Compact VTG family cards + grid mode. No "Continue" button — emits on selection.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/choreo-card/components/drilldown/sidebar/CategorySection.svelte -->
<script lang="ts">
  import type { CategorySelections } from '../../../state/deck-drilldown-types';
  import { VTG_ELEMENTAL_THEMES } from '../../../domain/elemental-theme';
  import ElementalFamilyCard from '../ElementalFamilyCard.svelte';
  import GridModeCard from '../GridModeCard.svelte';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    currentCategory: CategorySelections | null;
    accentColor: string;
    onSelectCategory: (category: CategorySelections) => void;
  }

  let { currentCategory, accentColor, onSelectCategory }: Props = $props();

  const FAMILY_LABELS: Record<string, string> = {
    'split-same': 'Split-Same',
    'tog-same': 'Tog-Same',
    'quarter-same': 'Quarter-Same',
    'split-opp': 'Split-Opp',
    'tog-opp': 'Tog-Opp',
    'quarter-opp': 'Quarter-Opp',
  };

  const sameFamilies = VTG_ELEMENTAL_THEMES.filter((t) => t.familyId.endsWith('-same'));
  const oppFamilies = VTG_ELEMENTAL_THEMES.filter((t) => t.familyId.endsWith('-opp'));

  let selectedFamily = $state<string>(currentCategory?.vtgFamily ?? '');
  let selectedGrid = $state<string>(
    currentCategory ? currentCategory.gridMode.charAt(0).toUpperCase() + currentCategory.gridMode.slice(1) : 'Diamond'
  );

  function selectFamily(familyId: string): void {
    selectedFamily = familyId;
    emitSelection();
  }

  function selectGrid(g: string): void {
    selectedGrid = g;
    emitSelection();
  }

  function emitSelection(): void {
    if (!selectedFamily || !selectedGrid) return;
    onSelectCategory({
      vtgFamily: selectedFamily,
      gridMode: selectedGrid.toLowerCase(),
    });
  }
</script>

<SidebarFilterSection label="Category" state="active" {accentColor}>
  <div class="sub-group">
    <span class="sub-label">SAME DIRECTION</span>
    <div class="family-grid">
      {#each sameFamilies as theme}
        <ElementalFamilyCard
          familyId={theme.familyId}
          familyLabel={FAMILY_LABELS[theme.familyId] ?? theme.familyId}
          element={theme.element}
          accentColor={theme.accentColor}
          selected={selectedFamily === theme.familyId}
          onClick={() => selectFamily(theme.familyId)}
        />
      {/each}
    </div>
  </div>

  <div class="sub-group">
    <span class="sub-label">OPPOSITE DIRECTION</span>
    <div class="family-grid">
      {#each oppFamilies as theme}
        <ElementalFamilyCard
          familyId={theme.familyId}
          familyLabel={FAMILY_LABELS[theme.familyId] ?? theme.familyId}
          element={theme.element}
          accentColor={theme.accentColor}
          selected={selectedFamily === theme.familyId}
          onClick={() => selectFamily(theme.familyId)}
        />
      {/each}
    </div>
  </div>

  <div class="sub-group">
    <span class="sub-label">GRID</span>
    <div class="grid-row">
      <GridModeCard mode="diamond" selected={selectedGrid === 'Diamond'} onClick={() => selectGrid('Diamond')} />
      <GridModeCard mode="box" selected={selectedGrid === 'Box'} onClick={() => selectGrid('Box')} />
    </div>
  </div>
</SidebarFilterSection>

<style>
  .sub-group {
    margin-bottom: 12px;
  }

  .sub-group:last-child {
    margin-bottom: 0;
  }

  .sub-label {
    display: block;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(255, 255, 255, 0.2);
    margin-bottom: 8px;
  }

  .family-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  /* Compact elemental cards for sidebar */
  .family-grid :global(.elemental-card) {
    padding: 14px 10px;
  }

  .family-grid :global(.element-icon) {
    width: 28px;
    height: 28px;
    margin-bottom: 8px;
  }

  .family-grid :global(.family-name) {
    font-size: 11px;
  }

  .family-grid :global(.element-name) {
    font-size: 9px;
  }

  .grid-row {
    display: flex;
    gap: 8px;
  }

  .grid-row :global(.grid-mode-card) {
    padding: 10px 16px;
  }

  .grid-row :global(.grid-svg) {
    width: 40px;
    height: 40px;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/sidebar/CategorySection.svelte
git commit -m "feat(cards): add CategorySection for sidebar"
```

---

### Task 5: StepCountSection

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/sidebar/StepCountSection.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/choreo-card/components/drilldown/sidebar/StepCountSection.svelte -->
<script lang="ts">
  import DrillPill from '../DrillPill.svelte';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    availableCounts: number[];
    selectedCount: number | null;
    accentColor: string;
    onSelectCount: (count: number) => void;
  }

  let { availableCounts, selectedCount, accentColor, onSelectCount }: Props = $props();

  const sectionState = $derived(availableCounts.length > 0 ? 'active' as const : 'disabled' as const);
</script>

<SidebarFilterSection
  label="Steps"
  state={sectionState}
  {accentColor}
  disabledMessage="Select shape first..."
>
  <div class="pill-row">
    {#each availableCounts as count}
      <DrillPill
        label={String(count)}
        selected={selectedCount === count}
        onClick={() => onSelectCount(count)}
      />
    {/each}
  </div>
</SidebarFilterSection>

<style>
  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/sidebar/StepCountSection.svelte
git commit -m "feat(cards): add StepCountSection for sidebar"
```

---

### Task 6: TurnPatternSection

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/sidebar/TurnPatternSection.svelte`

Turn pattern pills. Clicking "Uniform" expands inline sub-values (0T, 0.5T, ..., 3T). All others select directly.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/choreo-card/components/drilldown/sidebar/TurnPatternSection.svelte -->
<script lang="ts">
  import DrillPill from '../DrillPill.svelte';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    availablePatterns: string[];
    selectedPattern: string | null;
    accentColor: string;
    onSelectPattern: (pattern: string) => void;
  }

  let { availablePatterns, selectedPattern, accentColor, onSelectPattern }: Props = $props();

  const sectionState = $derived(availablePatterns.length > 0 ? 'active' as const : 'disabled' as const);

  const hasUniform = $derived(availablePatterns.some(p => p.toLowerCase().startsWith('uniform')));

  // Non-uniform patterns for direct selection
  const directPatterns = $derived(
    availablePatterns.filter(p => !p.toLowerCase().startsWith('uniform'))
  );

  // Whether the selected pattern is a uniform variant
  const isUniformSelected = $derived(
    selectedPattern !== null && selectedPattern.toLowerCase().match(/^\d/)
  );

  let uniformExpanded = $state(false);

  const UNIFORM_VALUES = [
    { label: '0t', display: '0T' },
    { label: '0.5t', display: '0.5T' },
    { label: '1t', display: '1T' },
    { label: '1.5t', display: '1.5T' },
    { label: '2t', display: '2T' },
    { label: '2.5t', display: '2.5T' },
    { label: '3t', display: '3T' },
  ];

  function handleUniformClick(): void {
    uniformExpanded = !uniformExpanded;
  }

  function handleUniformValue(label: string): void {
    uniformExpanded = false;
    onSelectPattern(label);
  }

  function formatPatternLabel(pattern: string): string {
    return pattern
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
</script>

<SidebarFilterSection
  label="Turn Pattern"
  state={sectionState}
  {accentColor}
  disabledMessage="Select earlier filters first..."
>
  <div class="pill-row">
    {#if hasUniform}
      <DrillPill
        label="Uniform"
        selected={uniformExpanded || !!isUniformSelected}
        onClick={handleUniformClick}
      />
    {/if}
    {#each directPatterns as pattern}
      <DrillPill
        label={formatPatternLabel(pattern)}
        selected={selectedPattern === pattern}
        onClick={() => onSelectPattern(pattern)}
      />
    {/each}
  </div>

  {#if uniformExpanded}
    <div class="uniform-values">
      {#each UNIFORM_VALUES as v}
        <DrillPill
          label={v.display}
          selected={selectedPattern === v.label}
          onClick={() => handleUniformValue(v.label)}
        />
      {/each}
    </div>
  {/if}
</SidebarFilterSection>

<style>
  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .uniform-values {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/sidebar/TurnPatternSection.svelte
git commit -m "feat(cards): add TurnPatternSection for sidebar"
```

---

### Task 7: ReversalSection

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/sidebar/ReversalSection.svelte`

Reversal pattern pills with dot visualization. Clicking one selects it (doesn't open a deck — that happens via the results panel).

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/choreo-card/components/drilldown/sidebar/ReversalSection.svelte -->
<script lang="ts">
  import type { Deck } from '../../../domain/models/Deck';
  import { getReversalPattern } from '../../../domain/reversal-patterns';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    filteredDecks: Deck[];
    selectedPattern: string | null;
    accentColor: string;
    onSelectPattern: (pattern: string) => void;
  }

  let { filteredDecks, selectedPattern, accentColor, onSelectPattern }: Props = $props();

  // Deduplicate by reversal pattern
  const uniquePatterns = $derived.by(() => {
    const seen = new Set<string>();
    const result: { id: string; label: string; symbols: string[] }[] = [];
    for (const deck of filteredDecks) {
      const key = deck.reversalPattern.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const pattern = getReversalPattern(deck.reversalPattern);
      const label = pattern?.label ?? deck.reversalPattern;
      const period = pattern?.period ?? 4;
      const seq = pattern?.sequence ?? deck.reversalPattern;
      const symbols = seq.slice(0, Math.min(4, period)).split('');
      result.push({ id: deck.reversalPattern, label, symbols });
    }
    return result;
  });

  const sectionState = $derived(uniquePatterns.length > 0 ? 'active' as const : 'disabled' as const);

  function getDotPair(symbol: string): [boolean, boolean] {
    switch (symbol) {
      case 'P': return [true, true];
      case 'R': return [true, false];
      case 'B': return [false, true];
      default: return [false, false];
    }
  }
</script>

<SidebarFilterSection
  label="Reversal"
  state={sectionState}
  {accentColor}
  disabledMessage="Select turn pattern first..."
>
  <div class="reversal-pills">
    {#each uniquePatterns as pat}
      <button
        class="reversal-pill"
        class:selected={selectedPattern === pat.id}
        onclick={() => onSelectPattern(pat.id)}
        aria-pressed={selectedPattern === pat.id}
      >
        <div class="dots">
          {#each pat.symbols as symbol}
            {@const [red, blue] = getDotPair(symbol)}
            <div class="dot-pair">
              <div class="dot" class:red class:empty={!red}></div>
              <div class="dot" class:blue class:empty={!blue}></div>
            </div>
          {/each}
        </div>
        <span class="rev-label">{pat.label}</span>
      </button>
    {/each}
  </div>
</SidebarFilterSection>

<style>
  .reversal-pills {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .reversal-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.015);
    cursor: pointer;
    font-family: inherit;
    color: rgba(255, 255, 255, 0.5);
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .reversal-pill:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .reversal-pill.selected {
    border-color: rgba(var(--sf-accent-rgb, 99,183,205), 0.4);
    background: rgba(var(--sf-accent-rgb, 99,183,205), 0.08);
    color: rgba(255, 255, 255, 0.85);
  }

  .dots {
    display: flex;
    gap: 3px;
  }

  .dot-pair {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .dot.red { background: #e74c3c; }
  .dot.blue { background: #3498db; }
  .dot.empty { background: rgba(255, 255, 255, 0.06); }

  .rev-label {
    font-size: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .reversal-pill { transition: none; }
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/sidebar/ReversalSection.svelte
git commit -m "feat(cards): add ReversalSection for sidebar"
```

---

### Task 8: DeckFilterSidebar orchestrator

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/sidebar/DeckFilterSidebar.svelte`

Orchestrates all sections. Reads state from context. Shows/hides sections based on selected path. Calls state methods on user interaction.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/choreo-card/components/drilldown/sidebar/DeckFilterSidebar.svelte -->
<script lang="ts">
  import type { DrillDownState } from '../../../state/deck-drilldown-state.svelte';
  import CollectionSection from './CollectionSection.svelte';
  import ShapeSection from './ShapeSection.svelte';
  import CategorySection from './CategorySection.svelte';
  import StepCountSection from './StepCountSection.svelte';
  import TurnPatternSection from './TurnPatternSection.svelte';
  import ReversalSection from './ReversalSection.svelte';

  interface Props {
    state: DrillDownState;
    allDecks: Deck[];
  }

  import type { Deck } from '../../../domain/models/Deck';

  let { state, allDecks }: Props = $props();

  const accentColor = $derived(
    state.selections.path === 'VTG' ? '#b763cd' : '#63b7cd'
  );

  const isLoops = $derived(state.selections.path === 'LOOPs');
  const isVtg = $derived(state.selections.path === 'VTG');
  const hasPath = $derived(state.selections.path !== null);

  // Decks filtered to current collection only (for ShapeSection to derive available types)
  const collectionDecks = $derived(
    hasPath ? allDecks.filter(d => d.collection === state.selections.path) : []
  );
</script>

<aside class="filter-sidebar" style="--accent: {accentColor}; --accent-rgb: {state.selections.path === 'VTG' ? '183,99,205' : '99,183,205'}">
  <CollectionSection
    selectedPath={state.selections.path}
    {accentColor}
    onSelectPath={state.selectPath}
  />

  {#if isLoops}
    <ShapeSection
      decks={collectionDecks}
      currentShape={state.selections.shape}
      {accentColor}
      onSelectShape={state.selectShape}
    />

    <StepCountSection
      availableCounts={state.availableStepCounts}
      selectedCount={state.selections.stepCount}
      {accentColor}
      onSelectCount={state.selectStepCount}
    />
  {/if}

  {#if isVtg}
    <CategorySection
      currentCategory={state.selections.category}
      {accentColor}
      onSelectCategory={state.selectCategory}
    />
  {/if}

  {#if hasPath}
    <TurnPatternSection
      availablePatterns={state.availableTurnPatterns}
      selectedPattern={state.selections.turnPattern}
      {accentColor}
      onSelectPattern={state.selectTurnPattern}
    />

    <ReversalSection
      filteredDecks={state.filteredDecks}
      selectedPattern={state.selections.reversalPattern}
      {accentColor}
      onSelectPattern={state.selectReversalPattern}
    />
  {/if}
</aside>

<style>
  .filter-sidebar {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    max-height: calc(100vh - 120px);
    padding-right: 8px;
  }

  /* Thin scrollbar for sidebar */
  .filter-sidebar::-webkit-scrollbar {
    width: 4px;
  }

  .filter-sidebar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .filter-sidebar::-webkit-scrollbar-track {
    background: transparent;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/sidebar/DeckFilterSidebar.svelte
git commit -m "feat(cards): add DeckFilterSidebar orchestrator"
```

---

### Task 9: DeckResultsPanel

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/DeckResultsPanel.svelte`

Shows filtered decks as a card grid. Header with count. Click opens deck.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/choreo-card/components/drilldown/DeckResultsPanel.svelte -->
<script lang="ts">
  import type { Deck } from '../../domain/models/Deck';

  interface Props {
    decks: Deck[];
    onSelectDeck: (deck: Deck) => void;
  }

  let { decks, onSelectDeck }: Props = $props();

  function formatCount(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
</script>

<div class="results-panel">
  <div class="results-header">
    {#if decks.length === 0}
      <span>No decks match</span>
    {:else if decks.length === 1}
      <span>1 deck — click to open</span>
    {:else}
      <span>{decks.length} decks match</span>
    {/if}
  </div>

  <div class="deck-grid">
    {#each decks as deck, i (deck.id)}
      <button
        class="deck-card"
        style="animation-delay: {Math.min(i * 30, 300)}ms"
        onclick={() => onSelectDeck(deck)}
        aria-label="Open {deck.canonicalName ?? deck.name} with {deck.totalSequences} sequences"
      >
        <span class="deck-name">{deck.canonicalName || deck.name}</span>
        <div class="deck-meta">
          <span>{formatCount(deck.totalSequences)} seq</span>
          <span>{deck.families.length} families</span>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .results-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .results-header {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 16px;
  }

  .deck-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
    align-content: start;
    flex: 1;
    overflow-y: auto;
  }

  .deck-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    color: var(--theme-text, #ffffff);
    text-align: center;
    min-height: 100px;
    animation: card-enter 0.25s ease-out both;
    transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }

  .deck-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .deck-card:focus-visible {
    outline: 2px solid var(--accent, #63b7cd);
    outline-offset: 2px;
  }

  .deck-name {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
  }

  .deck-meta {
    display: flex;
    gap: 10px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
  }

  @keyframes card-enter {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .deck-card { animation: none; transition: none; }
    .deck-card:hover { transform: none; }
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/DeckResultsPanel.svelte
git commit -m "feat(cards): add DeckResultsPanel for sidebar layout"
```

---

### Task 10: Wire desktop layout into DeckDrillDown

**Files:**
- Modify: `src/lib/features/choreo-card/components/drilldown/DeckDrillDown.svelte`

Add responsive layout fork. Desktop (≥1024px): sidebar + results. Mobile: current wizard.

- [ ] **Step 1: Add viewport detection and import new components**

In `DeckDrillDown.svelte`, add the imports and a `isDesktop` reactive state using `matchMedia`:

Add these imports after the existing ones:
```typescript
import DeckFilterSidebar from './sidebar/DeckFilterSidebar.svelte';
import DeckResultsPanel from './DeckResultsPanel.svelte';
import { BREAKPOINTS } from '$lib/shared/device/domain/constants/device-constants';
```

Add viewport detection after the `state` creation:
```typescript
let isDesktop = $state(false);

$effect(() => {
  if (typeof window === 'undefined') return;
  const mq = window.matchMedia(`(min-width: ${BREAKPOINTS.DESKTOP}px)`);
  isDesktop = mq.matches;
  const handler = (e: MediaQueryListEvent) => { isDesktop = e.matches; };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
});
```

- [ ] **Step 2: Add the desktop layout branch in the template**

Replace the template section of `DeckDrillDown.svelte`. The `{#if isDesktop}` branch renders sidebar + results. The `{:else}` branch keeps the existing wizard code unchanged:

```svelte
<div class="drilldown" class:desktop={isDesktop} style="--accent:{accentColor};--accent-rgb:{accentRgb}">
  <div class="ambient-glow {glowClass}"></div>

  {#if isDesktop}
    <!-- Desktop: sidebar + results side-by-side -->
    <div class="desktop-layout">
      <DeckFilterSidebar {state} allDecks={decks} />
      <DeckResultsPanel
        decks={state.filteredDecks}
        onSelectDeck={handleDeckSelect}
      />
    </div>
  {:else}
    <!-- Mobile: existing wizard -->
    {#if state.breadcrumbs.length > 0}
      <DrillBreadcrumb
        breadcrumbs={state.breadcrumbs}
        accentColor={accentColor}
        onNavigate={state.goBackTo}
      />
    {/if}

    {#key state.currentStep}
      <div class="step-content">
        {#if state.currentStep === 'collection'}
          <CollectionStep decks={decks} onSelectPath={state.selectPath} />
        {:else if state.currentStep === 'shape'}
          <ShapeStep decks={state.filteredDecks} onContinue={state.selectShape} />
        {:else if state.currentStep === 'category'}
          <CategoryStep onContinue={state.selectCategory} />
        {:else if state.currentStep === 'stepcount'}
          <StepCountStep
            availableCounts={state.availableStepCounts}
            onSelect={state.selectStepCount}
          />
        {:else if state.currentStep === 'turn'}
          <TurnPatternStep
            stepCount={state.selections.stepCount ?? 4}
            path={state.selections.path ?? 'LOOPs'}
            availablePatterns={state.availableTurnPatterns}
            onSelectPattern={state.selectTurnPattern}
            onSelectUniform={() => state.goTo('uniform')}
          />
        {:else if state.currentStep === 'uniform'}
          <UniformSubStep onSelect={state.selectTurnPattern} />
        {:else if state.currentStep === 'reversal'}
          <ReversalPatternStep
            decks={state.filteredDecks}
            breadcrumbs={state.breadcrumbs}
            onSelectDeck={handleDeckSelect}
          />
        {/if}
      </div>
    {/key}
  {/if}
</div>
```

- [ ] **Step 3: Add desktop layout CSS**

Add to the `<style>` block:

```css
.desktop-layout {
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 0;
}

.drilldown.desktop {
  padding: 24px 32px;
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/DeckDrillDown.svelte
git commit -m "feat(cards): wire desktop sidebar layout into DeckDrillDown"
```

---

### Task 11: Clean up debug console.logs

**Files:**
- Modify: `src/lib/features/choreo-card/state/deck-drilldown-state.svelte.ts`
- Modify: `src/lib/features/choreo-card/components/drilldown/DeckDrillDown.svelte`
- Modify: `src/lib/features/choreo-card/components/drilldown/ShapeStep.svelte`
- Modify: `src/lib/features/choreo-card/components/drilldown/TurnPatternStep.svelte`

- [ ] **Step 1: Remove console.logs from deck-drilldown-state.svelte.ts**

Remove lines 65-79 (the `console.log('[filterDecks]...')` calls inside `filterDecks()`). Keep the function logic, just remove the 5 console.log lines.

- [ ] **Step 2: Remove console.logs from DeckDrillDown.svelte**

Remove the `$effect` block at lines 22-27 that logs deck counts.

- [ ] **Step 3: Remove console.logs from ShapeStep.svelte**

Remove the `$effect` block at lines 19-25 that logs deck counts.

- [ ] **Step 4: Remove console.log from TurnPatternStep.svelte**

Remove the `$effect` at line 20-22 that logs available patterns.

- [ ] **Step 5: Verify it compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/state/deck-drilldown-state.svelte.ts src/lib/features/choreo-card/components/drilldown/DeckDrillDown.svelte src/lib/features/choreo-card/components/drilldown/ShapeStep.svelte src/lib/features/choreo-card/components/drilldown/TurnPatternStep.svelte
git commit -m "chore(cards): remove debug console.logs from drilldown"
```

---

### Task 12: Verify end-to-end

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No type errors in new or modified files.

- [ ] **Step 3: Manual verification notice**

State to user: "I cannot verify the visual layout. Please open the Deck tab on your desktop browser and confirm:
1. The sidebar appears on the left with all filter sections
2. Deck results appear on the right and update as you click filters
3. Resizing the browser below 1024px switches to the mobile wizard
4. The mobile wizard still works as before with breadcrumbs"
