# Deck Browsing Redesign — Smart Collection Pages

**Date:** 2026-03-26
**Status:** Approved
**Problem:** Current 4-level linear drill-down (Collections → Decks → Families → Sequences) requires 5-7 clicks to reach content, offers no filtering, no cross-cutting views, no previews until the deepest level. Won't scale to hundreds of decks across LOOP types, levels, grid modes, and non-LOOP categories.

**Solution:** Flatten to 3 levels with faceted filtering. Reuse existing Browse module infrastructure (grid, thumbnails, sidebar, sort, view mode, chip base). Build new filter panels using the reusable `FilterChipRow` + `FilterChipBase` primitives rather than trying to genericize `InlineFilterPanel`.

---

## Design Constraints

- **Retrieval-first** for domain experts who know TKA vocabulary
- **Deck-first navigation** — user picks a deck, then filters within it
- **Length and sequence count visible early** — key decision info before clicking in
- **Growth axes:** LOOP types (15+), levels (L1-L3 now, L4-L6 eventually), grid modes (3), non-LOOP decks
- **Families = one filter among many**, not a mandatory hierarchy step
- **Desktop-first**, mobile-adaptable later
- **Tab inside Choreo Cards** (not a new module)
- **No data model changes** — Deck/DeckFamily interfaces and Firestore structure unchanged

---

## Navigation Structure

### Level 0: Collection Picker (minimal changes)

Same hero cards as today. Enriched stats:
- Deck count, total sequence count (existing)
- Level range (e.g. "L1-L2") — derived from deck metadata
- Beat range (e.g. "4-16 beats") — derived from deck metadata

Auto-skip if only one collection has decks (same pattern as existing single-deck auto-select).

New collections (Compositional, User-Created) just add entries to `COLLECTION_REGISTRY`. The registry stays in `DeckBrowser.svelte` where it currently lives — it's a UI-level mapping, not domain logic.

**Loading state:** Spinner while decks load from Firestore. **Empty state:** "No decks available" with icon (existing). **Error state:** Handled by parent `ChoreoCardTab` which owns the loader call.

### Level 1: Collection Page (NEW — replaces old Levels 1+2)

Single filterable list of all decks in a collection. Replaces the old deck list AND family list screens.

**Layout:** Flex row with `SectionIndexSidebar` (reuse) on the left + `BrowseLayout` (reuse) for the main content area on the right. The flex row wrapper lives in `DeckBrowser.svelte`.

**Top bar (inside BrowseLayout):**
- Breadcrumb: `Collections › LOOPs`
- Filter toggle button → opens `InlineFilterPanel` (reuse)
- `SortPopover` (reuse) — options: Name, Level, Beat Count, Sequence Count

**Filter bar** via new `DeckListFilterPanel` (uses `FilterChipRow` + `FilterChipBase` primitives):
- `LevelFilterChip` (reuse) — L1, L2, L3
- `LengthFilterChip` (reuse) — populated from actual deck beat counts
- `PatternFilterChip` (reuse) — LOOP type (rotated, mirrored, flipped, etc.)
- `GridModeFilterChip` (reuse) — diamond, box, skewed

Note: `InlineFilterPanel` is hardcoded to Browse-specific filter types and can't be genericized without risk of regressing Browse. Instead, build `DeckListFilterPanel` using the same primitives (`FilterChipRow`, `FilterChipBase`) that `InlineFilterPanel` uses. Same visual language, different filter set.

**Main content:** List of `DeckRow` (new component). Each row:
- Collection accent icon
- Deck name
- Level badge (existing `DIFFICULTY_LEVELS` styling)
- Beat count — derived from sequence data in the deck's families, or from a `beatCount` field if present on the Firestore document (seeding scripts already write this for most decks)
- Sequence count (formatted: "47" vs "22.6k")
- Grid mode icon
- Family count (subtle, secondary)

Note: LOOP type is not currently a field on the `Deck` model. For the initial implementation, derive it from `deck.name` (all algorithmic deck names contain the LOOP type, e.g. "L1 Halved Strict Rotated"). Long-term, add a `loopType` field to the Deck Firestore documents during the next seeding run. This is backward-compatible — existing decks without the field just won't show a LOOP type tag.

**Loading state:** Spinner centered in main content. **Empty state:** "No decks match these filters" with clear-filters button. **Error state:** Handled by parent `ChoreoCardTab`.

**Sidebar sections:** Grouped by current sort dimension. Sort by level → sections "Level 1", "Level 2". Sort by beats → sections "4 beats", "8 beats".

### Level 2: Deck Interior (replaces old Levels 2+3)

All sequences shown immediately. Families and start positions are filters, not navigation levels.

**Layout:** Same flex row wrapper: `SectionIndexSidebar` (reuse) + `BrowseLayout` (reuse).

**Top bar (inside BrowseLayout):**
- Breadcrumb: `Collections › LOOPs › L1 Quartered Rotated`
- Deck meta line: "128 sequences across 10 families · 8 beats · Diamond grid"
- Filter toggle, `SortPopover` (reuse), `ViewModeToggle` (reuse)

**Filter bar** via new `DeckInteriorFilterPanel` (uses `FilterChipRow` + `FilterChipBase` primitives):
- `FamilyFilterChip` (new) — motion type pills as multi-select dropdown
- `PositionFilterChip` (reuse) — Alpha, Beta, Gamma toggle
- `LevelFilterChip` (reuse) — if deck spans multiple levels

**Main content:** `BrowseGrid` (reuse) with `ChoreoCardThumbnail` (reuse).

**Default grouping:** When no family filter active → group by family (motion type section headers with pills). When one or more families selected → group by start position within those families. When all families selected (same as none) → revert to group by family. `SectionIndexSidebar` shows the active grouping.

**Loading strategy** (threshold based on `deck.totalSequences` from the Deck Firestore document):
- Small decks (< 500 sequences): load all on entry via `loadDeckSequences()`
- Large decks (500+): load first family's sequences by default via `loadSequencesByIds()`, lazy-load others as user filters. Show prompt: "Showing [Family] ([N] sequences). Select a family to explore."

---

## New Components (4)

### 1. DeckRow

**File:** `src/lib/features/choreo-card/components/DeckRow.svelte`

```typescript
interface Props {
  deck: Deck;
  accentColor: string;
  accentIcon: string;
  onSelect: (deckId: string) => void;
}
```

Rich clickable row: icon, name, level badge, beat count, sequence count, grid mode icon, family count. Hover state, focus-visible outline. Uses existing `DIFFICULTY_LEVELS` for badge styling.

### 2. FamilyFilterChip

**File:** `src/lib/features/choreo-card/components/filters/FamilyFilterChip.svelte`

```typescript
interface Props {
  families: DeckFamily[];
  selectedFamilyIds: string[];
  onFilterChange: (familyIds: string[]) => void;
  getFilteredCount?: (familyId: string) => number;
}
```

Extends `FilterChipBase` (existing). Dropdown shows motion type pills using existing `parseFamilyLabel` + `MOTION_TYPE_INFO` color system from current `DeckBrowser.svelte`. Multi-select: clicking a pill toggles it. Active pills highlighted, inactive dimmed. Count badge per pill.

### 3. DeckListFilterPanel

**File:** `src/lib/features/choreo-card/components/filters/DeckListFilterPanel.svelte`

```typescript
interface Props {
  isOpen: boolean;
  activeLevel: number | null;
  activeLength: number | null;
  activeGridMode: string | null;
  activeLoopType: string | null;
  availableLengths: number[];
  onFilterChange: (type: string, value?: unknown) => void;
  onRemoveFilter: (type: string) => void;
}
```

Composes `FilterChipRow` + `LevelFilterChip` + `LengthFilterChip` + `PatternFilterChip` + `GridModeFilterChip`. Used at Level 1 (collection page). Same visual language as Browse's `InlineFilterPanel` but with deck-specific filter set.

### 4. DeckInteriorFilterPanel

**File:** `src/lib/features/choreo-card/components/filters/DeckInteriorFilterPanel.svelte`

```typescript
interface Props {
  isOpen: boolean;
  families: DeckFamily[];
  selectedFamilyIds: string[];
  activePosition: string | null;
  activeLevel: number | null;
  onFilterChange: (type: string, value?: unknown) => void;
  onRemoveFilter: (type: string) => void;
}
```

Composes `FilterChipRow` + `FamilyFilterChip` + `PositionFilterChip` + `LevelFilterChip`. Used at Level 2 (deck interior).

---

## Component Reuse Map

| Component | Source | Change |
|-----------|--------|--------|
| BrowseLayout | browse/shared | None — deck pages compose sidebar externally alongside BrowseLayout |
| FilterChipBase | browse/filtering/chips | None |
| FilterChipRow | browse/filtering | None |
| LevelFilterChip | browse/filtering/chips | None |
| LengthFilterChip | browse/filtering/chips | None |
| PatternFilterChip | browse/filtering/chips | None |
| GridModeFilterChip | browse/filtering/chips | None |
| PositionFilterChip | browse/filtering/chips | None |
| SortPopover | browse/shared | Add "Sequence Count" option |
| ViewModeToggle | browse/shared | None |
| SectionIndexSidebar | browse/navigation | None |
| BrowseGrid | browse/display | None (already takes SequenceData[]) |
| ChoreoCardThumbnail | browse/display | None |
| VirtualizedSequenceGrid | browse/display | None |
| **DeckRow** | **NEW** | Deck list row component |
| **FamilyFilterChip** | **NEW** | Motion type pill multi-select chip |
| **DeckListFilterPanel** | **NEW** | Composes FilterChipRow + chips for Level 1 |
| **DeckInteriorFilterPanel** | **NEW** | Composes FilterChipRow + chips for Level 2 |

Note: `InlineFilterPanel` is NOT reused — it's hardcoded to Browse-specific filter types (`BrowseFilterType`, `SequenceFilterType`). Instead, the two new filter panels use the same underlying primitives (`FilterChipRow`, `FilterChipBase`) for visual consistency without coupling to Browse state.

Note: `BrowseLayout` provides the main content container. `SectionIndexSidebar` is composed alongside it in the deck page's own layout wrapper (flexbox row with sidebar + BrowseLayout). This avoids modifying BrowseLayout's interface.

---

## State Management

### Removed
- `selectedFamilyId` as navigation state (families are now filters)
- `expandedGroups` (start position collapsibles gone)

### Kept
- `selectedDeckId` — persisted to localStorage
- `selectedCollection` — now also persisted to localStorage (was ephemeral)

### Added
- Filter state: `{ familyIds: string[], startPositions: string[], level: number | null }`
- Sort state: `{ method: string, direction: 'asc' | 'desc' }`
- Both are local component state, not persisted

---

## Click Depth Comparison

| Action | Before | After |
|--------|:------:|:-----:|
| See a sequence in a known deck | 5-7 | **3** |
| Filter by family within a deck | mandatory drill-down | **1 filter click** |
| Filter by start position | mandatory drill-down | **1 filter click** |
| Switch between families | back + new family click | **toggle filter chip** |
| Switch between decks | back + back + click | **breadcrumb + click** |

---

## Migration

- `DeckBrowser.svelte` — rewritten (same file, new implementation)
- `DeckFamilySection.svelte` — no longer used as navigation. Keep for now if hand path summary cards are still wanted as a section within deck interior. Can be removed later.
- `ChoreoCardTab.svelte` — simplified: remove family selection state, remove family-level callbacks
- No Firestore changes. No data model changes. No new collections or documents.

---

## Future Extensions (not in scope, but unblocked)

- **Search bar** at Level 1 for text search across deck names/properties
- **Cross-collection search** spanning all collections
- **User-created decks** as a new collection type
- **Compositional decks** as a new collection type
- **Deck comparison** side-by-side
- **Mobile layout** with bottom-sheet filters instead of sidebar
