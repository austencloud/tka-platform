---
status: archived
---
# Deck Browser: Sidebar Filter Navigation

**Date:** 2026-04-07
**Status:** Draft
**Problem:** The deck drilldown uses a breadcrumb wizard that wastes desktop screen space. On a 4K monitor, seeing one step at a time with a growing breadcrumb trail feels cramped and disorienting. The breadcrumb trail also grows by 2 entries per step (label + value), exposes implementation terms to users, and disconnects entirely when entering a deck interior.

**Solution:** On desktop (≥1024px), replace the step-by-step wizard with a sidebar filter panel. All filter sections visible at once, deck results updating live on the right. On mobile (<1024px), keep the existing wizard. Same state machine, different presentation.

---

## Architecture

### What changes

| Layer | Current | New |
|-------|---------|-----|
| **DeckDrillDown.svelte** | Renders one step at a time via `{#key state.currentStep}` | Desktop: renders `DeckFilterSidebar` + `DeckResultsPanel` side-by-side. Mobile: keeps current wizard. |
| **DrillBreadcrumb.svelte** | Shown during drilldown | **Removed on desktop.** The sidebar IS the navigation. Mobile keeps it. |
| **State machine** | `deck-drilldown-state.svelte.ts` | **No changes.** Same selections, same filtering, same `goBackTo`. The sidebar just calls the same `selectPath`, `selectShape`, etc. |
| **Step components** | Full-page centered layouts (ShapeStep, TurnPatternStep, etc.) | **Reused on mobile.** On desktop, their content is extracted into sidebar filter sections. |

### What stays the same

- `deck-drilldown-state.svelte.ts` — untouched. Same state machine, same filtering logic, same session persistence.
- `deck-drilldown-types.ts` — untouched.
- `deck-drilldown-context.ts` — untouched.
- `DeckBrowser.svelte` — the deck interior (after selecting a deck) stays the same.
- All mobile behavior — identical to current.

### Responsive breakpoint

- **Desktop:** `min-width: 1024px` — sidebar layout
- **Mobile:** `max-width: 1023px` — current wizard

This matches the existing `DESKTOP` constant in `device-constants.ts`.

---

## Desktop Layout: Sidebar + Results

```
┌─────────────────────────────────────────────────────┐
│ DeckDrillDown (flex row, gap: 24px)                 │
│                                                     │
│ ┌──────────────┐  ┌──────────────────────────────┐  │
│ │ FILTER       │  │ RESULTS                      │  │
│ │ SIDEBAR      │  │                              │  │
│ │ (260px)      │  │ "12 decks match"             │  │
│ │              │  │                              │  │
│ │ ┌──────────┐ │  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │  │
│ │ │Collection│ │  │ │deck│ │deck│ │deck│ │deck│ │  │
│ │ │ LOOPs VTG│ │  │ │card│ │card│ │card│ │card│ │  │
│ │ └──────────┘ │  │ └────┘ └────┘ └────┘ └────┘ │  │
│ │ ┌──────────┐ │  │                              │  │
│ │ │  Shape   │ │  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │  │
│ │ │ Rot Mir  │ │  │ │deck│ │deck│ │deck│ │deck│ │  │
│ │ │ Swap Inv │ │  │ │card│ │card│ │card│ │card│ │  │
│ │ └──────────┘ │  │ └────┘ └────┘ └────┘ └────┘ │  │
│ │ ┌──────────┐ │  │                              │  │
│ │ │  Steps   │ │  │                              │  │
│ │ │  4 8 16  │ │  │                              │  │
│ │ └──────────┘ │  │                              │  │
│ │ ┌──────────┐ │  │                              │  │
│ │ │  Turn    │ │  │                              │  │
│ │ │ Uni Alt  │ │  │                              │  │
│ │ └──────────┘ │  │                              │  │
│ │ ┌──────────┐ │  │                              │  │
│ │ │ Reversal │ │  │                              │  │
│ │ │ (greyed) │ │  │                              │  │
│ │ └──────────┘ │  │                              │  │
│ └──────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Sidebar sections

Each section maps 1:1 to a drill step:

| Section | Step ID | LOOPs path | VTG path |
|---------|---------|-----------|----------|
| Collection | `collection` | LOOPs / VTG | LOOPs / VTG |
| Shape | `shape` | Loop types + slice + grid pills | *hidden* |
| Category | `category` | *hidden* | VTG family cards (compact) |
| Steps | `stepcount` | Step count pills | *hidden* |
| Turn Pattern | `turn` | Turn pattern pills | Turn pattern pills |
| Reversal | `reversal` | Reversal pattern pills | Reversal pattern pills |

**Visibility rules:**
- LOOPs path: Collection, Shape, Steps, Turn, Reversal
- VTG path: Collection, Category, Turn, Reversal
- Before any path selected: only Collection is active, rest are hidden

### Section states

Each section has one of three visual states:

1. **Active** — has selections available, user can interact. Accent border on left, full opacity.
2. **Selected** — user has made a choice. Shows selected value as a chip. Clicking the chip opens the section for editing.
3. **Disabled** — upstream dependency not met. Dashed border, 30% opacity, "Select [upstream] first..." text.

**One-option auto-select:** When a section has exactly 1 available option (the current auto-skip behavior), show it as pre-selected with slightly muted styling. The user sees what was auto-resolved rather than the section being hidden.

### Section content (sidebar-compact versions)

The sidebar sections are **compact versions** of the existing step components, not the step components themselves. The step components are full-page centered layouts with titles, descriptions, and large cards. The sidebar needs tight, minimal chip/pill layouts.

| Section | Sidebar rendering |
|---------|------------------|
| Collection | Two chips: LOOPs, VTG |
| Shape | Loop type pills (multi-select), slice pills, grid mode pills — stacked vertically, no "Continue" button |
| Category | Compact ElementalFamilyCard grid (2 columns, smaller) |
| Steps | Number pills in a row |
| Turn | Pill per available pattern. "Uniform" expands inline to show sub-values (0T, 1T, etc.) |
| Reversal | Pill per available pattern with dot visualization |

**No "Continue" buttons.** On desktop, each selection immediately takes effect. The state machine handles cascading resets.

### Results panel

The right side shows the `filteredDecks` from the state machine, rendered as deck cards in a responsive grid.

**Before full selection:** Shows all decks matching current filters. Each deck card shows:
- Reversal pattern dot visualization
- Deck name / canonical designation
- Sequence count
- Family count

**Clicking a deck card:** Calls `onSelectDeck(deck)` — same as current, transitions to deck interior.

**Header:** Shows count like "12 decks match" or "1 deck — click to open".

### No breadcrumbs on desktop

The sidebar replaces breadcrumbs entirely. Your current state is visible at a glance from the sidebar. Clicking any selected chip in any section opens that section for editing and resets downstream selections (via the existing `goBackTo` / `resetSelectionsAfter` logic).

---

## Mobile Layout: Current Wizard (unchanged)

Below 1024px, the component renders the current step-by-step wizard with breadcrumbs. The only change is wrapping the layout choice in a media query / viewport check.

The existing step components (CollectionStep, ShapeStep, CategoryStep, StepCountStep, TurnPatternStep, UniformSubStep, ReversalPatternStep) continue to be used on mobile.

---

## New Components

### `DeckFilterSidebar.svelte`
- Renders all filter sections vertically
- Receives the drill-down state from context
- Each section: label, content (pills/chips), state indicator
- Handles all selection callbacks by calling state methods directly

### `DeckResultsPanel.svelte`  
- Renders `filteredDecks` as a card grid
- Shows deck count header
- Handles deck selection click
- Reusable — also shown in the sidebar layout

### `SidebarFilterSection.svelte`
- Reusable wrapper for each filter section
- Props: label, state (active/selected/disabled), children
- Handles expand/collapse and accent styling

---

## Interaction details

### Changing an upstream filter on desktop
1. User clicks a different Shape pill
2. `state.selectShape()` fires → resets stepCount, turnPattern, reversalPattern
3. Steps, Turn, and Reversal sections revert to their active/disabled states
4. Results panel updates immediately via `$derived(filteredDecks)`

### VTG path on desktop
1. User clicks VTG in Collection section
2. Shape section hides, Category section appears
3. Steps section hides (VTG skips step count)
4. Turn and Reversal sections show for VTG path

### Uniform turn sub-selection
On desktop, clicking "Uniform" in the Turn section expands it inline to show the sub-values (0T, 0.5T, 1T, etc.) rather than navigating to a separate UniformSubStep page.

### Transition to deck interior
When the user clicks a deck card in the results panel, the same `onSelectDeck` callback fires. The DeckBrowser switches to its interior view with the "Back to browser" button. This part is unchanged — the sidebar only governs the drilldown, not the deck interior.

---

## Scope

### In scope
- New `DeckFilterSidebar.svelte` component
- New `DeckResultsPanel.svelte` component  
- New `SidebarFilterSection.svelte` component
- Modify `DeckDrillDown.svelte` to conditionally render sidebar vs. wizard based on viewport
- Remove console.log debug statements from `deck-drilldown-state.svelte.ts` and `DeckDrillDown.svelte` (cleanup while we're here)

### Out of scope
- Changes to deck interior view (DeckBrowser post-selection)
- Changes to state machine logic
- Changes to mobile wizard behavior
- Changes to step component internals (they stay for mobile)
- VTG family drilldown (VtgFamilyDrillDown.svelte — separate component, separate flow)

---

## Risk assessment

**Low risk.** The state machine is untouched. The sidebar is a new presentation layer calling the same methods. Mobile is unchanged. The only modification to existing code is `DeckDrillDown.svelte` gaining a viewport-conditional render path.

**Reversibility:** If the sidebar doesn't feel right, remove the three new components and revert the conditional in DeckDrillDown. The wizard code stays intact throughout.
