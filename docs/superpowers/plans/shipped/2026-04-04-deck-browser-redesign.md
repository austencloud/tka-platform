# Deck Browser Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat deck browser with a 5-step progressive drill-down that surfaces turn patterns, reversal patterns, and step count as distinct navigable dimensions, producing uniquely identified printable decks.

**Architecture:** New `DeckDrillDown` component replaces `DeckBrowser`'s collection/deck-list views. A state factory manages the current step, selections, and breadcrumb trail. Each step is its own Svelte component. The existing `DeckLoader` feeds data; new filtering logic narrows decks at each step.

**Tech Stack:** Svelte 5 (runes), TypeScript, ITI DI, Firebase/Firestore, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-04-04-deck-browser-redesign-design.md`
**Mockup:** `.superpowers/brainstorm/103613-1775331314/deck-browser-final.html`

---

## Phase 1: Data Model & State Foundation

### Task 1: Update Deck Interface

**Files:**
- Modify: `src/lib/features/choreo-card/domain/models/Deck.ts`

- [ ] **Step 1: Update the Deck interface**

Add new required fields and rename `beatCount`:

```typescript
export interface Deck {
  readonly id: string;
  readonly name: string;
  readonly canonicalName: string;
  readonly description: string;
  readonly families: readonly DeckFamily[];
  readonly totalSequences: number;
  readonly gridMode: GridMode;
  readonly level: number;
  readonly collection: 'LOOPs' | 'VTG';
  readonly loopType: string;
  readonly sliceType: 'halved' | 'quartered';
  readonly stepCount: number;
  readonly turnPattern: string;
  readonly reversalPattern: string;
}
```

- [ ] **Step 2: Fix all TypeScript errors from the rename**

Search for `beatCount` and `deck.turns` across the codebase and update to `stepCount` and `turnPattern`. Key files:
- `src/lib/features/choreo-card/components/LoopCollectionView.svelte` (references `d.beatCount`)
- `src/lib/features/choreo-card/components/LoopBeatGrid.svelte`
- `src/lib/features/choreo-card/domain/deck-sort.ts`
- `src/lib/features/choreo-card/services/implementations/DeckLoader.ts`

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors related to Deck interface

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/domain/models/Deck.ts
# + all files touched in step 2
git commit -m "refactor(deck): rename beatCount→stepCount, add canonicalName and turnPattern fields"
```

---

### Task 2: Create Drill-Down State Factory

**Files:**
- Create: `src/lib/features/choreo-card/state/deck-drilldown-state.svelte.ts`
- Create: `src/lib/features/choreo-card/state/deck-drilldown-types.ts`
- Create: `src/lib/features/choreo-card/context/deck-drilldown-context.ts`

- [ ] **Step 1: Define types**

```typescript
// deck-drilldown-types.ts
export type DrillPath = 'LOOPs' | 'VTG';

export type DrillStepId =
  | 'collection'
  | 'shape'        // LOOPs Step 2
  | 'category'     // VTG Step 2
  | 'stepcount'    // LOOPs Step 3
  | 'turn'         // Step 4
  | 'uniform'      // Step 4b (Uniform sub-screen)
  | 'reversal';    // Step 5

export interface BreadcrumbSegment {
  readonly label: string;
  readonly stepId: DrillStepId;
}

export interface ShapeSelections {
  readonly loopTypes: readonly string[];   // multi-select
  readonly sliceType: 'halved' | 'quartered';
  readonly gridMode: string;
}

export interface CategorySelections {
  readonly vtgFamily: string;
  readonly gridMode: string;
}

export interface DrillSelections {
  readonly path: DrillPath | null;
  readonly shape: ShapeSelections | null;
  readonly category: CategorySelections | null;
  readonly stepCount: number | null;
  readonly turnPattern: string | null;
  readonly reversalPattern: string | null;
}
```

- [ ] **Step 2: Create state factory**

```typescript
// deck-drilldown-state.svelte.ts
import type { Deck } from '../domain/models/Deck';
import type { DrillPath, DrillStepId, BreadcrumbSegment, DrillSelections } from './deck-drilldown-types';

export function createDrillDownState(allDecks: Deck[]) {
  let currentStep = $state<DrillStepId>('collection');
  let selections = $state<DrillSelections>({
    path: null, shape: null, category: null,
    stepCount: null, turnPattern: null, reversalPattern: null,
  });
  let breadcrumbs = $state<BreadcrumbSegment[]>([]);

  const filteredDecks = $derived(filterDecks(allDecks, selections));
  const availableStepCounts = $derived(
    [...new Set(filteredDecks.map(d => d.stepCount))].sort((a, b) => a - b)
  );
  const availableTurnPatterns = $derived(
    [...new Set(filteredDecks.map(d => d.turnPattern))]
  );
  const availableReversalPatterns = $derived(
    [...new Set(filteredDecks.map(d => d.reversalPattern))]
  );
  const selectedDeck = $derived(
    filteredDecks.length === 1 ? filteredDecks[0] : null
  );

  function goTo(stepId: DrillStepId) { currentStep = stepId; }

  function selectPath(path: DrillPath) {
    selections = { ...selections, path };
    breadcrumbs = [{ label: path, stepId: 'collection' }];
    // Auto-advance: VTG → category, LOOPs → shape
    currentStep = path === 'VTG' ? 'category' : 'shape';
    breadcrumbs = [...breadcrumbs, { label: currentStep === 'category' ? 'Category' : 'Shape', stepId: currentStep }];
  }

  function selectShape(shape: ShapeSelections) {
    selections = { ...selections, shape };
    const label = shape.loopTypes.join('+') + ' \u00B7 ' + shape.sliceType + ' \u00B7 ' + shape.gridMode;
    breadcrumbs = [breadcrumbs[0], { label, stepId: 'shape' }];
    // Auto-advance: if only one step count, skip to turn
    if (availableStepCounts.length === 1) {
      selections = { ...selections, stepCount: availableStepCounts[0] };
      breadcrumbs = [...breadcrumbs, { label: availableStepCounts[0] + '-Step', stepId: 'stepcount' }, { label: 'Turn Pattern', stepId: 'turn' }];
      currentStep = 'turn';
    } else {
      breadcrumbs = [...breadcrumbs, { label: 'Step Count', stepId: 'stepcount' }];
      currentStep = 'stepcount';
    }
  }

  function selectCategory(cat: CategorySelections) {
    selections = { ...selections, category, stepCount: 4 }; // VTG always 4 steps
    breadcrumbs = [breadcrumbs[0], { label: cat.vtgFamily + ' \u00B7 ' + cat.gridMode, stepId: 'category' }, { label: 'Turn Pattern', stepId: 'turn' }];
    currentStep = 'turn';
  }

  function selectStepCount(count: number) {
    selections = { ...selections, stepCount: count };
    breadcrumbs = [...breadcrumbs.slice(0, 2), { label: count + '-Step', stepId: 'stepcount' }, { label: 'Turn Pattern', stepId: 'turn' }];
    currentStep = 'turn';
  }

  function selectTurnPattern(pattern: string) {
    selections = { ...selections, turnPattern: pattern };
    breadcrumbs = [...breadcrumbs.filter(b => b.stepId !== 'turn' && b.stepId !== 'reversal'), { label: pattern, stepId: 'turn' }, { label: 'Reversal Pattern', stepId: 'reversal' }];
    currentStep = 'reversal';
    // Auto-advance: if only one reversal pattern, select it and jump to deck
    if (availableReversalPatterns.length === 1) {
      selectReversalPattern(availableReversalPatterns[0]);
    }
  }

  function selectReversalPattern(pattern: string) {
    selections = { ...selections, reversalPattern: pattern };
    breadcrumbs = [...breadcrumbs.filter(b => b.stepId !== 'reversal'), { label: pattern, stepId: 'reversal' }];
  }

  function goBackTo(index: number) {
    const target = breadcrumbs[index];
    breadcrumbs = breadcrumbs.slice(0, index + 1);
    // Reset selections for steps after target
    const stepOrder: DrillStepId[] = ['collection', 'shape', 'category', 'stepcount', 'turn', 'uniform', 'reversal'];
    const targetIdx = stepOrder.indexOf(target.stepId);
    if (targetIdx < stepOrder.indexOf('stepcount')) selections = { ...selections, stepCount: null, turnPattern: null, reversalPattern: null };
    if (targetIdx < stepOrder.indexOf('turn')) selections = { ...selections, turnPattern: null, reversalPattern: null };
    if (targetIdx < stepOrder.indexOf('reversal')) selections = { ...selections, reversalPattern: null };
    currentStep = target.stepId;
  }

  return {
    get currentStep() { return currentStep; },
    get selections() { return selections; },
    get breadcrumbs() { return breadcrumbs; },
    get filteredDecks() { return filteredDecks; },
    get availableStepCounts() { return availableStepCounts; },
    get availableTurnPatterns() { return availableTurnPatterns; },
    get availableReversalPatterns() { return availableReversalPatterns; },
    get selectedDeck() { return selectedDeck; },
    goTo, selectPath, selectShape, selectCategory,
    selectStepCount, selectTurnPattern, selectReversalPattern,
    goBackTo,
  };
}

function filterDecks(decks: Deck[], sel: DrillSelections): Deck[] {
  return decks.filter(d => {
    if (sel.path && d.collection !== sel.path) return false;
    if (sel.shape) {
      if (!sel.shape.loopTypes.some(lt => d.loopType.includes(lt.toLowerCase()))) return false;
      if (d.sliceType !== sel.shape.sliceType) return false;
      if (d.gridMode !== sel.shape.gridMode) return false;
    }
    if (sel.category) {
      if (d.collection !== 'VTG') return false;
      // Match VTG family against deck's families array (each family has a typeCombo that maps to a VTG family)
      const hasFamilyMatch = d.families.some(f => f.id === sel.category!.vtgFamily.toLowerCase().replace('-', '_'));
      if (!hasFamilyMatch) return false;
      if (d.gridMode !== sel.category.gridMode) return false;
    }
    if (sel.stepCount !== null && d.stepCount !== sel.stepCount) return false;
    if (sel.turnPattern !== null && d.turnPattern !== sel.turnPattern) return false;
    if (sel.reversalPattern !== null && d.reversalPattern !== sel.reversalPattern) return false;
    return true;
  });
}
```

- [ ] **Step 3: Create context file**

Per project state-management rules (`docs/superpowers/specs/2026-03-10-unified-state-management-design.md`), state must be distributed via context:

```typescript
// src/lib/features/choreo-card/context/deck-drilldown-context.ts
import { getContext, setContext } from 'svelte';
import type { createDrillDownState } from '../state/deck-drilldown-state.svelte';

type DrillDownState = ReturnType<typeof createDrillDownState>;

const KEY = Symbol('deck-drilldown');

export function setDrillDownContext(state: DrillDownState) {
  setContext(KEY, state);
}

export function getDrillDownContext(): DrillDownState {
  return getContext<DrillDownState>(KEY);
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS (new files, no consumers yet)

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/state/deck-drilldown-state.svelte.ts src/lib/features/choreo-card/state/deck-drilldown-types.ts src/lib/features/choreo-card/context/deck-drilldown-context.ts
git commit -m "feat(deck-browser): add drill-down state factory, types, and context"
```

---

## Phase 2: Step Components

### Task 3: Breadcrumb Component

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/DrillBreadcrumb.svelte`

- [ ] **Step 1: Build component**

Props: `breadcrumbs: BreadcrumbSegment[]`, `accentColor: string`, `onNavigate: (index: number) => void`

Renders clickable segments with `›` separators. Last segment is non-clickable (current). Animate new segments in with opacity+translateX (200ms ease-out). Use CSS custom properties for accent color theming (LOOPs blue vs VTG purple).

- [ ] **Step 2: Verify in isolation**

Temporarily render in ChoreoCardTab with mock data to verify appearance.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/DrillBreadcrumb.svelte
git commit -m "feat(deck-browser): add breadcrumb navigation component"
```

---

### Task 4: Step 1 — Collection Picker

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/CollectionStep.svelte`

- [ ] **Step 1: Build component**

Three hero cards: LOOPs, VTG, My Decks. Props: `decks: Deck[]`, `onSelectPath: (path: DrillPath) => void`. Show aggregate stats per collection. Style from mockup: generous padding, radial glow on hover, translateY(-6px) lift, path-specific accent colors.

Reference mockup CSS classes: `.hero`, `.hero-ico`, `.hero-name`, `.hero-desc`, `.hero-stat`.

- [ ] **Step 2: Add card entrance stagger animation**

Cards animate in with 50ms stagger delay. Use CSS `animation-delay` on `:nth-child`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/CollectionStep.svelte
git commit -m "feat(deck-browser): add collection picker step with hero cards"
```

---

### Task 5: Step 2a — Shape Step (LOOPs)

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/ShapeStep.svelte`
- Create: `src/lib/features/choreo-card/components/drilldown/DrillPill.svelte`

- [ ] **Step 1: Build DrillPill component**

Reusable pill button with states: default, hover, selected (`on`), locked. Props: `label: string`, `selected: boolean`, `locked: boolean`, `onClick: () => void`. CSS from mockup `.pill` class.

- [ ] **Step 2: Build ShapeStep component**

Three pill groups: Loop Type (multi-select), Slice (single-select, Quartered locked when no Rotated), Grid (single-select). Props: `decks: Deck[]`, `onContinue: (shape: ShapeSelections) => void`.

Key logic: when Rotated is deselected, auto-lock Slice to Halved. When Rotated is re-selected, unlock Quartered option. Only show values that have matching decks.

- [ ] **Step 3: Verify slice locking behavior**

Test: select Mirrored only → Slice should show "Halved" locked. Select Rotated → both Halved/Quartered available.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/ShapeStep.svelte src/lib/features/choreo-card/components/drilldown/DrillPill.svelte
git commit -m "feat(deck-browser): add shape step with multi-select loop type and slice locking"
```

---

### Task 6: Step 2b — Category Step (VTG)

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/CategoryStep.svelte`
- Create: `src/lib/features/choreo-card/components/drilldown/ElementalFamilyCard.svelte`

- [ ] **Step 1: Build ElementalFamilyCard**

Card showing element SVG icon, family name, element name. Props: `familyId: string`, `element: string`, `accentColor: string`, `selected: boolean`, `onClick: () => void`. Use the actual SVG icons from `static/images/elements/`. Style from mockup `.el-card` class with `color-mix` for glow effects.

- [ ] **Step 2: Build CategoryStep**

Two rows: "Same Direction" (Water, Earth, Sun) and "Opposite Direction" (Fire, Air, Moon). Plus Grid pills below. Uses `VTG_ELEMENTAL_THEMES` from `elemental-theme.ts` for colors. Props: `onContinue: (category: CategorySelections) => void`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/CategoryStep.svelte src/lib/features/choreo-card/components/drilldown/ElementalFamilyCard.svelte
git commit -m "feat(deck-browser): add VTG category step with elemental family cards"
```

---

### Task 7: Step 3 — Step Count (LOOPs only)

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/StepCountStep.svelte`

- [ ] **Step 1: Build component**

Single pill row showing available step counts. Props: `availableCounts: number[]`, `onSelect: (count: number) => void`. Auto-skip if only one count available.

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/StepCountStep.svelte
git commit -m "feat(deck-browser): add step count selection step"
```

---

### Task 8: Step 4 — Turn Pattern

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/TurnPatternStep.svelte`
- Create: `src/lib/features/choreo-card/components/drilldown/TurnPatternCard.svelte`
- Create: `src/lib/features/choreo-card/components/drilldown/TurnBarChart.svelte`
- Create: `src/lib/features/choreo-card/components/drilldown/UniformSubStep.svelte`

- [ ] **Step 1: Build TurnBarChart**

Visualization component. Props: `entries: { blue: number; red: number }[]`, `animate: boolean`. Renders blue/red bar pairs, height proportional to turn value (14px per turn). Purple bars for float values. Bar grow animation on mount (300ms ease-out, 30ms stagger).

- [ ] **Step 2: Build TurnPatternCard**

Card wrapping TurnBarChart with pattern name, description, and per-step notation. Props: `name: string`, `description: string`, `entries: { blue: number; red: number }[]`, `meta: string`, `onClick: () => void`. Style from mockup `.card` class.

- [ ] **Step 3: Build TurnPatternStep**

Groups cards by tier (Simple, Medium, Complex, My Patterns). Props: `stepCount: number`, `path: DrillPath`, `onSelectPattern: (pattern: string) => void`, `onSelectUniform: () => void`. Filters patterns by step count compatibility. Hides Complex tier when stepCount < 8. Shows "My Patterns" section using `TurnPatternManager.getUserPatterns()`.

"Uniform" card is special — clicking it calls `onSelectUniform()` which advances to the UniformSubStep.

**DI Note:** "My Patterns" uses `TurnPatternManager` from `src/lib/features/create/shared/services/implementations/TurnPatternManager.ts`. This service is already registered in the DI container. Access via `container.items.turnPatternManager` to load user patterns. Import `container` from `$lib/shared/di`.

- [ ] **Step 4: Build UniformSubStep**

Grid of 7 cards (0T through 3T) each with flat bar charts at the correct height and VTG ratio in meta. Props: `onSelect: (pattern: string) => void`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/TurnPatternStep.svelte src/lib/features/choreo-card/components/drilldown/TurnPatternCard.svelte src/lib/features/choreo-card/components/drilldown/TurnBarChart.svelte src/lib/features/choreo-card/components/drilldown/UniformSubStep.svelte
git commit -m "feat(deck-browser): add turn pattern step with bar chart visualization and uniform sub-screen"
```

---

### Task 9: Step 5 — Reversal Pattern (Terminal)

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/ReversalPatternStep.svelte`

- [ ] **Step 1: Build component**

Renders reversal pattern cards using existing dot visualization pattern from current `DeckCard.svelte`. Each card = one final deck. Props: `decks: Deck[]`, `breadcrumbs: BreadcrumbSegment[]`, `onSelectDeck: (deck: Deck) => void`. Shows canonical name banner at bottom.

Reuse `getReversalPattern()` from `reversal-patterns.ts` for dot pattern data.

- [ ] **Step 2: Add dot pulse animation on hover**

Active dots (red/blue, not empty) pulse opacity 0.7→1.0→0.7 on card hover, 1.5s cycle.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/ReversalPatternStep.svelte
git commit -m "feat(deck-browser): add reversal pattern terminal step with canonical name display"
```

---

## Phase 3: Orchestration & Integration

### Task 10: Drill-Down Orchestrator

**Files:**
- Create: `src/lib/features/choreo-card/components/drilldown/DeckDrillDown.svelte`

- [ ] **Step 1: Build orchestrator component**

Renders the active step based on `currentStep` from state factory. Manages step transitions (fade+slide animation, 250ms). Shows breadcrumb at top. Passes ambient glow color based on selected path (LOOPs blue, VTG purple).

Props: `decks: Deck[]`, `onSelectDeck: (deck: Deck) => void`.

Instantiates state factory via `createDrillDownState(decks)`. Routes to step components:
- `collection` → `CollectionStep`
- `shape` → `ShapeStep`
- `category` → `CategoryStep`
- `stepcount` → `StepCountStep`
- `turn` → `TurnPatternStep`
- `uniform` → `UniformSubStep`
- `reversal` → `ReversalPatternStep`

- [ ] **Step 2: Add step transition animation**

Wrap step content in a keyed block (`{#key currentStep}`) with CSS animation. Forward = slide up, backward = slide down (track direction in state).

- [ ] **Step 3: Add ambient background glow**

Fixed-position blurred gradient that shifts color based on `selections.path`. LOOPs = `rgba(99,183,205,.06)`, VTG = `rgba(183,99,205,.06)`. Fade transition on path change.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/DeckDrillDown.svelte
git commit -m "feat(deck-browser): add drill-down orchestrator with step transitions and ambient glow"
```

---

### Task 11: Wire Into DeckBrowser

**Files:**
- Modify: `src/lib/features/choreo-card/components/DeckBrowser.svelte`

- [ ] **Step 1: Replace collection/deck-list views with DeckDrillDown**

In DeckBrowser, the current level 0 (collection picker) and level 1 (deck list) are replaced by `DeckDrillDown`. The drill-down handles all navigation up until a specific deck is selected, at which point DeckBrowser switches to the existing deck interior view (level 2).

Remove imports: `LoopCollectionView`, `VtgCollectionView`, `VtgFamilyDrillDown`, `LoopBeatGrid`, `LoopTurnsGrid`, `LoopReversalGrid`, `DeckCard`.

Add import: `DeckDrillDown`.

The `DeckDrillDown.onSelectDeck` callback triggers the existing `onSelectDeck` prop which loads sequences for the deck interior.

- [ ] **Step 2: Remove dead components**

After wiring is verified, remove the old components that are no longer imported anywhere:
- `LoopCollectionView.svelte`
- `LoopBeatGrid.svelte`
- `LoopTurnsGrid.svelte`
- `LoopReversalGrid.svelte`
- `LoopDeckFilters.svelte`
- `VtgCollectionView.svelte` (if fully replaced)
- `VtgFamilyGrid.svelte` (if fully replaced)
- `VtgFamilyCard.svelte` (if fully replaced)
- `VtgFamilyDrillDown.svelte` (if fully replaced)
- `VtgRatioGrid.svelte` (if fully replaced)
- `VtgRatioCard.svelte` (if fully replaced)
- `VtgReversalGrid.svelte` (if fully replaced)
- `DeckCard.svelte` (replaced by ReversalPatternStep)

Only remove files with zero remaining imports. Check with grep first.

- [ ] **Step 3: Verify full flow**

Test both paths:
1. LOOPs → Shape → Step Count → Turn Pattern → Uniform → Reversal → Deck opens
2. VTG → Category → Turn Pattern → Reversal → Deck opens
3. Breadcrumb back-navigation at each step
4. Auto-skip when only one option

- [ ] **Step 4: Run typecheck and build**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckBrowser.svelte
# + any removed files
git commit -m "feat(deck-browser): integrate drill-down, remove old collection/deck views"
```

---

## Phase 4: Data Extension & Polish

### Task 12: Add DeckMetadata to LibraryCollection

**Files:**
- Modify: `src/lib/features/library/domain/models/Collection.ts`

- [ ] **Step 1: Add optional deckMetadata field**

```typescript
import type { Timestamp } from 'firebase/firestore';

export interface DeckMetadata {
  readonly displayName: string;
  readonly cardBackTemplateId?: string;
  readonly printConfig?: {
    readonly cardSize: 'poker' | 'tarot' | 'mini';
    readonly includeStartPosition: boolean;
  };
  readonly promotedAt: Timestamp;
}

// Add to existing LibraryCollection interface:
//   readonly deckMetadata?: DeckMetadata;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/library/domain/models/Collection.ts
git commit -m "feat(library): add DeckMetadata to LibraryCollection for user deck promotion"
```

---

### Task 13: CSS Polish & Animations

**Files:**
- Modify: All drilldown components created in Tasks 3-10

- [ ] **Step 1: Audit against mockup**

Open the final mockup at `.superpowers/brainstorm/103613-1775331314/deck-browser-final.html` and compare each step visually to the implementation. Check:
- Spacing and padding on 4K monitors
- Hover glow effects
- Card entrance stagger
- Bar chart grow animation
- Vignette background overlay

- [ ] **Step 2: Add reduced-motion support**

Every component with CSS animations must include:
```css
@media (prefers-reduced-motion: reduce) {
  .animated-element { animation: none; transition: none; }
  .hover-lift:hover { transform: none; }
}
```

- [ ] **Step 3: Add responsive breakpoints**

- `> 1200px`: 3-column card grids
- `768-1200px`: 2-column grids
- `< 768px`: 1-column, pills wrap, hero cards stack

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/drilldown/
git commit -m "style(deck-browser): polish animations, reduced-motion support, responsive breakpoints"
```

---

### Task 14: Backfill Deck Metadata Script

> **IMPORTANT:** This must be run BEFORE Task 11 (integration). The drill-down reads `stepCount`, `turnPattern`, and `canonicalName` from Firestore. If these fields are missing, the browser shows empty results.

**Files:**
- Modify: `scripts/backfill-deck-metadata.cjs`

- [ ] **Step 1: Extend backfill script**

Add logic to populate `canonicalName`, convert `beatCount` → `stepCount`, convert `turns` → `turnPattern` (e.g., `turns: 0` → `turnPattern: "uniform-0t"`), and ensure `collection` and `sliceType` are set on all existing deck documents.

- [ ] **Step 2: Dry-run the backfill**

Run: `node scripts/backfill-deck-metadata.cjs --dry-run`
Verify output shows correct transformations without writing.

- [ ] **Step 3: Run backfill**

Run: `node scripts/backfill-deck-metadata.cjs`
Verify deck documents updated in Firestore.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-deck-metadata.cjs
git commit -m "feat(scripts): extend deck metadata backfill with stepCount, turnPattern, canonicalName"
```

---

## File Map Summary

**New files (16):**
```
src/lib/features/choreo-card/state/deck-drilldown-types.ts
src/lib/features/choreo-card/state/deck-drilldown-state.svelte.ts
src/lib/features/choreo-card/context/deck-drilldown-context.ts
src/lib/features/choreo-card/components/drilldown/DrillBreadcrumb.svelte
src/lib/features/choreo-card/components/drilldown/DrillPill.svelte
src/lib/features/choreo-card/components/drilldown/CollectionStep.svelte
src/lib/features/choreo-card/components/drilldown/ShapeStep.svelte
src/lib/features/choreo-card/components/drilldown/CategoryStep.svelte
src/lib/features/choreo-card/components/drilldown/ElementalFamilyCard.svelte
src/lib/features/choreo-card/components/drilldown/StepCountStep.svelte
src/lib/features/choreo-card/components/drilldown/TurnPatternStep.svelte
src/lib/features/choreo-card/components/drilldown/TurnPatternCard.svelte
src/lib/features/choreo-card/components/drilldown/TurnBarChart.svelte
src/lib/features/choreo-card/components/drilldown/UniformSubStep.svelte
src/lib/features/choreo-card/components/drilldown/ReversalPatternStep.svelte
src/lib/features/choreo-card/components/drilldown/DeckDrillDown.svelte
```

**Modified files (4):**
```
src/lib/features/choreo-card/domain/models/Deck.ts
src/lib/features/choreo-card/components/DeckBrowser.svelte
src/lib/features/library/domain/models/Collection.ts
scripts/backfill-deck-metadata.cjs
```

**Removed files (after verification, ~10-13):**
```
src/lib/features/choreo-card/components/LoopCollectionView.svelte
src/lib/features/choreo-card/components/LoopBeatGrid.svelte
src/lib/features/choreo-card/components/LoopTurnsGrid.svelte
src/lib/features/choreo-card/components/LoopReversalGrid.svelte
src/lib/features/choreo-card/components/LoopDeckFilters.svelte
(+ possibly VtgCollectionView, VtgFamilyGrid, VtgFamilyDrillDown if fully replaced)
```
