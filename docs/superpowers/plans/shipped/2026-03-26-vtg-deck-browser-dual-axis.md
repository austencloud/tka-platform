# VTG Deck Browser: Dual-Axis Grouping — Implementation Plan

**Date:** 2026-03-26
**Spec:** `docs/superpowers/specs/2026-03-26-vtg-deck-browser-dual-axis-design.md`

---

## Phase 1: Data Layer

### Step 1.1 — Extend the Deck interface with VTG fields

**Files modified:**
- `src/lib/features/choreo-card/domain/models/Deck.ts`

**What:** Add optional `vtgRatio` and `turns` fields to the `Deck` interface. The Firestore documents already contain these fields (written by the seed script), but the TypeScript interface doesn't declare them.

```
readonly vtgRatio?: string;   // "1:1", "2:1", etc.
readonly turns?: number;       // 0, 0.5, 1, 1.5, 2, 2.5, 3
```

**Dependencies:** None.

---

### Step 1.2 — Add 6:1 ratio to the seed script

**Files modified:**
- `scripts/seed-vtg-turn-decks.cjs`

**What:** Add a 6:1 entry to the `TURN_VARIANTS` array:
```
{ ratio: "6:1", turns: 2.5, deckId: "vtg-6to1-motions", name: "VTG Motions (6:1 ratio)" }
```

Remove or update the comment that says "6:1 is skipped per VTG convention." Then run the script to seed the new deck to Firestore.

**Dependencies:** None.

---

### Step 1.3 — Create elemental theme config

**Files created:**
- `src/lib/features/choreo-card/domain/elemental-theme.ts`

**What:** Define the `ElementalTheme` interface and a `VTG_ELEMENTAL_THEMES` array mapping each VTG family ID to its visual properties (element name, accent color, SVG path). The six entries match the spec table:

| Family ID | Element | Accent Color | SVG Path |
|-----------|---------|-------------|----------|
| split-same | water | #63b7cd | /images/elements/water.svg |
| tog-same | earth | #75A874 | /images/elements/earth.svg |
| quarter-same | sun | #ffde17 | /images/elements/sun.svg |
| split-opp | fire | #f2673a | /images/elements/fire.svg |
| tog-opp | air | #78b7e3 | /images/elements/air.svg |
| quarter-opp | moon | #6a4199 | /images/elements/moon.svg |

Also export a `VTG_RATIO_LEVEL_MAP` mapping each ratio string to its TKA level number (1:1 -> 1, 3:1/5:1/7:1 -> 2, 2:1/4:1/6:1 -> 3). This is consumed by the ratio grid to assign level badge colors.

Also export a `VTG_RATIO_TURNS_MAP` mapping each ratio string to its turn count for display labels.

**Dependencies:** None. This is a pure data file in `domain/` alongside `Deck.ts` and `deck-sort.ts`.

---

### Step 1.4 — Create the VTG family sequence aggregator service

**Files created:**
- `src/lib/features/choreo-card/services/contracts/IVtgFamilyAggregator.ts`
- `src/lib/features/choreo-card/services/implementations/VtgFamilyAggregator.ts`

**What:** A service that loads sequences from multiple VTG decks and filters them to a single family. The spec says: "parallel `DeckLoader.loadDeckSequences()` calls for all VTG decks, then filter each deck's sequences to the selected family."

Interface:
- `aggregateFamilySequences(familyId: string, decks: Deck[]): Promise<{ ratio: string; sequences: SequenceData[] }[]>` — returns sequences grouped by ratio for one family across all VTG decks.

Implementation receives `IDeckLoader` via constructor injection. For each VTG deck, calls `loadDeckSequences()` in parallel (`Promise.all`), then filters each deck's result to sequences belonging to the given family ID (using the deck's `families[].sequenceIds`). Returns an array of `{ ratio, sequences }` objects sorted by ratio.

**Dependencies:** Step 1.1 (Deck interface needs `vtgRatio` field). Uses existing `IDeckLoader` from `services/contracts/IDeckLoader.ts`.

---

### Step 1.5 — Register VtgFamilyAggregator in DI container

**Files modified:**
- `src/lib/shared/di/containers/build-container.ts` (where `deckLoader` is registered)
- `src/lib/shared/di/container-types.ts` (if build-container type needs updating)

**What:** Register `vtgFamilyAggregator` in the same container as `deckLoader`, injecting the loader as a dependency:
```
vtgFamilyAggregator: () => new VtgFamilyAggregator(/* deckLoader from same container */)
```

If build-container uses ITI's `.add()` chaining, the aggregator can reference the loader from the container's own items.

**Dependencies:** Step 1.4.

---

## Phase 2: Components

### Step 2.1 — VtgCollectionView (orchestrator)

**Files created:**
- `src/lib/features/choreo-card/components/VtgCollectionView.svelte`

**What:** The main orchestrator for the VTG collection page. Owns the Family/Ratio toggle state and delegates rendering to the active grid component.

Props:
- `decks: Deck[]` — all VTG decks
- `onSelectDeck: (deckId: string) => void` — for ratio card taps (navigate to existing deck interior)
- `onSelectFamily: (familyId: string) => void` — for family card taps (navigate to family drill-down)

Local state (Svelte 5 runes):
- `activeView: "family" | "ratio"` — defaults to `"family"` per spec
- Toggle is a pill-style segmented control at the top

Template structure:
1. Pill toggle (`Family | Ratio`)
2. `{#if activeView === "family"}` -> render `VtgFamilyGrid`
3. `{:else}` -> render `VtgRatioGrid`

Styling: toggle uses `var(--theme-card-bg)` background, active pill uses `var(--theme-accent)`.

**Dependencies:** Steps 2.2 and 2.3 (the grid components it renders).

---

### Step 2.2 — VtgFamilyGrid + VtgFamilyCard

**Files created:**
- `src/lib/features/choreo-card/components/VtgFamilyGrid.svelte`
- `src/lib/features/choreo-card/components/VtgFamilyCard.svelte`

**What:**

**VtgFamilyGrid:** A 3x2 CSS grid of `VtgFamilyCard` components. Iterates over `VTG_ELEMENTAL_THEMES` (from Step 1.3). For each family, computes:
- `ratioCount`: how many VTG decks contain this family
- `sequenceCount`: sum of `sequenceIds.length` across matching families in all decks

Props: `decks: Deck[]`, `onSelectFamily: (familyId: string) => void`

The grid matches family IDs from `VTG_ELEMENTAL_THEMES` against `deck.families[].id` across all provided decks.

**VtgFamilyCard:** Single card with elemental theming per spec.

Props: `theme: ElementalTheme`, `ratioCount: number`, `sequenceCount: number`, `onSelect: () => void`

Visual layout (per spec):
- Elemental SVG icon via `<img>` tag (48px, `filter: drop-shadow(...)`)
- Family name in accent color (font-size 17px, bold)
- Element name uppercase subtitle (font-size `var(--font-size-compact, 12px)`, muted)
- Footer: "{ratioCount} ratios, {sequenceCount} sequences"
- Background: `var(--theme-card-bg)` with subtle gradient overlay tinted to `--accent`
- Border: accent color at 35% opacity
- Hover: `transform: translateY(-4px)` + intensified box-shadow glow

CSS custom property `--accent` set via inline style from `theme.accentColor`.

**Dependencies:** Step 1.3 (elemental theme config).

---

### Step 2.3 — VtgRatioGrid + VtgRatioCard

**Files created:**
- `src/lib/features/choreo-card/components/VtgRatioGrid.svelte`
- `src/lib/features/choreo-card/components/VtgRatioCard.svelte`

**What:**

**VtgRatioGrid:** Renders ratio cards in 3 rows by level (1-3-3 layout per spec).

Props: `decks: Deck[]`, `onSelectDeck: (deckId: string) => void`

Implementation:
1. Group VTG decks by level using `VTG_RATIO_LEVEL_MAP` (or the deck's own `level` field)
2. Row 1 (L1): single centered card (1:1)
3. Row 2 (L2): three cards (3:1, 5:1, 7:1)
4. Row 3 (L3): three cards (2:1, 4:1, 6:1)

Each row has a subtle level label. Row containers use flexbox with `justify-content: center` and `gap`.

Special case: the 1:1 deck has `deckId: "l1-vtg-motions"` while others follow the `vtg-Xto1-motions` pattern. Match decks by `vtgRatio` field (Step 1.1) or by name pattern.

**VtgRatioCard:** Single card with level theming.

Props: `deck: Deck`, `levelStyle: DifficultyLevelStyle`, `onSelect: () => void`

Visual layout (per spec):
- Level badge (28px circle, canonical gradient from `DIFFICULTY_LEVELS[deck.level]`)
- Ratio number large and bold (32px)
- Turn count subtitle (e.g., "1 turn", "0.5 turns")
- Footer: "{familyCount} families, {sequenceCount} sequences"
- Card theme: tinted to level gradient (use first color stop from `levelStyle.stops[0].color` at low opacity)

**Dependencies:** Step 1.1 (Deck needs `vtgRatio`), Step 1.3 (`VTG_RATIO_LEVEL_MAP`, `VTG_RATIO_TURNS_MAP`). Uses `DIFFICULTY_LEVELS` from `difficulty-styles.ts`.

---

### Step 2.4 — VtgFamilyDrillDown (family drill-down view)

**Files created:**
- `src/lib/features/choreo-card/components/VtgFamilyDrillDown.svelte`

**What:** The view shown when a user taps a family card. Displays all sequences for one family across all VTG ratios, with light section headers per ratio.

Props:
- `familyId: string`
- `familyLabel: string`
- `decks: Deck[]` — all VTG decks
- `handPointsVisible`, `showGrid`, `showTKA`, `showWord`, `includeStartPosition` — pass-through card display options
- `onSelectSequence: (sequence: SequenceData) => void`
- `onBack: () => void`

Behavior:
1. On mount, uses `VtgFamilyAggregator` (from DI container) to load sequences
2. Shows loading spinner during fetch
3. Renders sequences grouped by ratio with section headers like "1:1 (0 turns)", "3:1 (1 turn)", etc.
4. Each section uses the existing `DeckFamilySection.svelte` pattern (card grid with lazy loading) or a simpler flat grid with `ChoreoCard` components
5. Breadcrumb: Collections > VTG > {familyLabel} (e.g., "Split-Same (Water)")

**Dependencies:** Step 1.4/1.5 (VtgFamilyAggregator in DI), Step 1.3 (to display family theme info in the header).

---

## Phase 3: Integration

### Step 3.1 — Wire VtgCollectionView into DeckBrowser

**Files modified:**
- `src/lib/features/choreo-card/components/DeckBrowser.svelte`

**What:** In the Level 1 section (`{:else if selectedCollection}`), add a conditional: when `selectedCollection === "VTG"` and no deck is selected, render `VtgCollectionView` instead of the default deck list with `DeckRow` components.

Also need to handle the family drill-down navigation state. Add new local state:
- `selectedVtgFamily: string | null` — tracks which family card was tapped

Navigation flow changes:
- `selectedCollection === "VTG"` + `selectedVtgFamily === null` + `selectedDeckId === null` -> show `VtgCollectionView`
- `selectedCollection === "VTG"` + `selectedVtgFamily !== null` -> show `VtgFamilyDrillDown`
- `selectedCollection === "VTG"` + `selectedDeckId !== null` -> show existing deck interior (for ratio card taps)

Update breadcrumb rendering to handle the family drill-down case.

The existing `onBackToDeckList` callback works for ratio card -> back navigation. For family drill-down -> back, set `selectedVtgFamily = null`.

Disable the auto-skip-single-deck `$effect` for VTG collection (it currently auto-selects if there's only 1 deck, but VTG has 7+ decks anyway, so this is unlikely to trigger — but worth guarding).

**Dependencies:** Steps 2.1, 2.4. This is the main integration point.

---

### Step 3.2 — Remove the VTG filter/sort controls for VTG collection

**Files modified:**
- `src/lib/features/choreo-card/components/DeckBrowser.svelte`

**What:** The existing Level 1 view shows filter and sort action chips. For VTG, these are replaced by the family/ratio toggle inside `VtgCollectionView`. Hide the filter/sort top-bar actions when `selectedCollection === "VTG"` and the VTG collection view is active.

**Dependencies:** Step 3.1.

---

## Phase 4: Polish

### Step 4.1 — Mobile responsive grid layouts

**Files modified:**
- `VtgFamilyGrid.svelte` (styles)
- `VtgRatioGrid.svelte` (styles)
- `VtgCollectionView.svelte` (styles)

**What:** Add responsive breakpoints per spec:
- **VtgFamilyGrid:** 3x2 grid on desktop. At `max-width: 768px`, collapse to 2 columns. At `max-width: 480px`, collapse to 1 column.
- **VtgRatioGrid:** The 1-3-3 layout needs responsive handling. At `max-width: 768px`, L2 and L3 rows should wrap (e.g., 2+1 on medium screens, 1 column on narrow).
- **Toggle:** Full-width pill on mobile.

Use container queries (`cqw`) where the grid is inside a resizable container, otherwise use media queries.

**Dependencies:** Steps 2.1, 2.2, 2.3.

---

### Step 4.2 — Hover states and transitions

**Files modified:**
- `VtgFamilyCard.svelte` (styles)
- `VtgRatioCard.svelte` (styles)

**What:** Per spec:
- Hover: `transform: translateY(-4px)` + intensified glow shadow using accent color
- Transition: `transition: transform 0.2s ease, box-shadow 0.2s ease`
- Focus-visible: `outline: 2px solid var(--theme-accent)` with 2px offset
- `prefers-reduced-motion`: disable transform transitions

These should match the existing card interaction patterns in the codebase (see `DeckRow.svelte` and `collection-hero` in `DeckBrowser.svelte`).

**Dependencies:** Steps 2.2, 2.3.

---

### Step 4.3 — Loading and empty states for family drill-down

**Files modified:**
- `VtgFamilyDrillDown.svelte`

**What:** Handle three states:
1. **Loading:** Spinner while `VtgFamilyAggregator` fetches from multiple decks. Use the same `.loading` pattern from `DeckBrowser.svelte`.
2. **Empty:** "No sequences found for {family name}" with a back button. Unlikely but possible if a family has zero sequences at a given ratio.
3. **Error:** If any deck load fails, show partial results with a note about which ratios couldn't be loaded.

**Dependencies:** Step 2.4.

---

### Step 4.4 — Seed the 6:1 deck to Firestore

**What:** Run the updated seed script (Step 1.2) to create the `vtg-6to1-motions` deck in Firestore:
```
node scripts/seed-vtg-turn-decks.cjs
```

Verify with `--dry-run` first. The script will create 19 sequences at 2.5 turns with properly chained orientations, plus the deck metadata document.

Also verify the existing `l1-vtg-motions` deck has `vtgRatio: "1:1"` and `turns: 0` fields. If not, update it with a one-off Firestore write (can add to the seed script as a post-step).

**Dependencies:** Step 1.2.

---

## Dependency Graph

```
Phase 1 (Data):
  1.1 (Deck interface) ─┐
  1.2 (6:1 seed)        │  no deps between these
  1.3 (theme config) ───┤
                        │
  1.4 (aggregator) ─────┤ depends on 1.1
  1.5 (DI registration) ┘ depends on 1.4

Phase 2 (Components):
  2.1 (VtgCollectionView) ── depends on 2.2, 2.3
  2.2 (FamilyGrid + Card) ── depends on 1.3
  2.3 (RatioGrid + Card) ─── depends on 1.1, 1.3
  2.4 (FamilyDrillDown) ──── depends on 1.4, 1.5, 1.3

Phase 3 (Integration):
  3.1 (DeckBrowser wiring) ─ depends on 2.1, 2.4
  3.2 (hide VTG filters) ─── depends on 3.1

Phase 4 (Polish):
  4.1 (responsive) ────────── depends on 2.1, 2.2, 2.3
  4.2 (hover/transitions) ─── depends on 2.2, 2.3
  4.3 (loading/empty) ──────── depends on 2.4
  4.4 (seed 6:1) ────────────── depends on 1.2
```

## File Summary

### New files (10)
| File | Purpose |
|------|---------|
| `src/lib/features/choreo-card/domain/elemental-theme.ts` | VTG family visual config + ratio-level mapping |
| `src/lib/features/choreo-card/services/contracts/IVtgFamilyAggregator.ts` | Interface for cross-deck family loading |
| `src/lib/features/choreo-card/services/implementations/VtgFamilyAggregator.ts` | Loads sequences from all VTG decks, filters to one family |
| `src/lib/features/choreo-card/components/VtgCollectionView.svelte` | Orchestrator with Family/Ratio toggle |
| `src/lib/features/choreo-card/components/VtgFamilyGrid.svelte` | 3x2 grid of family cards |
| `src/lib/features/choreo-card/components/VtgFamilyCard.svelte` | Elemental-themed family card |
| `src/lib/features/choreo-card/components/VtgRatioGrid.svelte` | 1-3-3 level-grouped ratio layout |
| `src/lib/features/choreo-card/components/VtgRatioCard.svelte` | Level-themed ratio card |
| `src/lib/features/choreo-card/components/VtgFamilyDrillDown.svelte` | Family drill-down with cross-deck sequences |

### Modified files (4)
| File | Change |
|------|--------|
| `src/lib/features/choreo-card/domain/models/Deck.ts` | Add `vtgRatio?` and `turns?` fields |
| `scripts/seed-vtg-turn-decks.cjs` | Add 6:1 ratio entry to TURN_VARIANTS |
| `src/lib/shared/di/containers/build-container.ts` | Register VtgFamilyAggregator |
| `src/lib/features/choreo-card/components/DeckBrowser.svelte` | VTG-specific rendering path + family navigation state |
