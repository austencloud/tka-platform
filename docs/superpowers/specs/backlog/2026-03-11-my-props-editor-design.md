---
status: backlog
value: 3
effort: M
remaining: Full build — prop collection editor
depends_on: ""
plan_path: plans/backlog/2026-03-11-my-props-editor.md
tags: []
last_triaged: 2026-04-26
---
# My Props Editor — Design Spec

## Problem

The "Pick your props" card in the Account popover does nothing useful. The existing `PropSelectionSheet` is built for single-prop rendering selection — it doesn't support multi-select or favorites. Users have no way to declare which props they spin with or set a favorite, even though the data model (`propsISpinWith[]`, `favoriteProp`) already supports it.

## Solution

A dedicated bottom drawer with a two-phase inline morph:

1. **Phase 1** — "What do you spin?" Multi-select curated prop families.
2. **Phase 2** — "Your go-to?" Pick one favorite from your selections.

One drawer, two phases, no navigation. Content morphs in place.

---

## Entry Point

The `MyPropsCard` in `AccountPopover` triggers the drawer. Clicking it closes the popover and opens the My Props editor drawer.

---

## Phase 1: "What do you spin?"

### Header

Text: **"What do you spin?"** — left-aligned, standard drawer header weight.

### Curated Prop Grid

A flat grid of base prop families. One card per family, no variants. The grid shows the canonical representative of each family.

**Families shown (16 total):**

| Section | Props |
|---------|-------|
| Staves & Clubs | Staff, Club, Fan |
| Curved Props | Buugeng, Trigeng, Minihoop, Triad, Triquetra |
| Novelty | Chicken, Guitar, Doublestar, Eightrings, Contactball, Torch |
| Other | Hand, Sword |

Quiad is excluded (it's an internal test prop). Poi is excluded (restricted subset, not a static prop — see TKA domain rules).

**Card layout:**
- CSS grid, 4 columns on desktop/tablet, 3 columns on narrow mobile
- Each card: prop SVG image (48px), family label below (12px compact)
- Aspect ratio ~1:1, generous tap targets (min 44px)

**Selection behavior:**
- Tap toggles selection on/off
- Selected state: checkmark badge top-right, accent border (1.5px `--theme-accent`), subtle scale 1.02
- Deselected state: `--theme-card-bg` background, `--theme-stroke` border
- Haptic feedback on toggle

### Selection Footer Bar

Appears at the bottom of the drawer when 1+ props are selected. Sticky positioned above the drawer handle.

**Contents:**
- Horizontal row of miniature prop SVGs (24px) for each selected prop, scrollable if many
- Count label: "{n} props" (e.g., "3 props")
- CTA button (pill, accent-colored):
  - **1 selection:** "Done" — auto-favorites and closes
  - **2+ selections:** "Set favorite →"

**When 0 selections:** Footer bar is hidden. Drawer can be dismissed via backdrop/escape/handle.

---

## Phase 2: "Your go-to?"

Triggered when user taps "Set favorite →" with 2+ selections.

### Transition

- Grid content crossfades out (200ms fade + 8px translateY)
- Selected props animate in as larger cards (300ms, staggered 50ms each)
- Header text crossfades to **"Your go-to?"**
- No explicit step indicators — the morph provides spatial continuity

### Favorite Picker Layout

- Selected props displayed as larger cards (80px SVG, family label, centered)
- Horizontal row if 2-4 props, 2-column grid if 5+
- Each card tappable

### Favorite Selection

- Tap a card to crown it as favorite
- Visual: gold star badge appears (top-left), accent ring pulses once
- Haptic: success vibration
- After 400ms pause (so user sees the result), drawer auto-closes

### Back Navigation

A subtle "← Back" text button in the header lets the user return to Phase 1 to change selections.

---

## Reopening With Existing Data

When the drawer opens and the user already has `propsISpinWith` data:

- Phase 1 pre-selects existing props by normalizing each stored value via `getBasePropType()` before comparing against the family grid entries. This handles cases where variant types (e.g., BIGSTAFF) were stored — they map back to the base family (STAFF).
- The current `favoriteProp` shows a gold star badge on its card
- User can add/remove props and re-favorite freely
- The footer bar reflects current selections immediately

## Loading & Saving States

- **Initial load:** While `propState.loading` is true, the grid renders in a skeleton/disabled state (cards visible but non-interactive, slight opacity reduction). The footer bar is hidden.
- **During save:** While `propState.saving` is true, the CTA button shows a spinner and is disabled. Individual card toggles remain interactive (optimistic UI — the state updates locally first, persists async).
- **Save failure:** If a toggle or favorite fails to persist, the state factory already handles this by not rolling back local state (fire-and-forget). A future enhancement could add error feedback, but for v1 this matches the existing pattern used elsewhere.

---

## Data Flow

```
AccountPopover
  → owns PropPreferenceState via createPropPreferenceState(persister, userId)
  → passes propState as prop to both MyPropsCard (display) and MyPropsDrawer (editing)

MyPropsCard
  → reads propState.favoriteProp, propState.propsISpinWith for display
  → click → close popover → open MyPropsDrawer

MyPropsDrawer
  → receives propState as prop (does NOT create its own instance)
  → Phase 1: propState.toggleProp(basePropType) on each tap
  → Phase 2: propState.setFavorite(basePropType) on favorite tap
  → on close: state already persisted (each toggle/favorite calls persister immediately)
```

**State ownership:** `AccountPopover` is the sole owner of `PropPreferenceState`. Both `MyPropsCard` and `MyPropsDrawer` receive it as a prop. This avoids duplicate state instances and concurrent Firestore writes.

Each `toggleProp` and `setFavorite` call persists to Firestore immediately via `PropPreferencePersister`. No "save" button needed — the footer bar CTA just advances to Phase 2 or closes the drawer.

**Base type normalization:** `toggleProp` and `setFavorite` are always called with the base prop type from `PROP_FAMILIES`. The grid always passes `family.base` (e.g., `PropType.STAFF`), never a variant.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Zero selections + close | Drawer closes, no changes |
| Select 1 + tap "Done" | Auto-favorites that prop, closes |
| Select 2+ + tap "Set favorite" | Morph to Phase 2 |
| Deselect current favorite in Phase 1 | `favoriteProp` cleared by `toggleProp`. `MyPropsDrawer` then checks: if 1 prop remains, calls `setFavorite` on it |
| Remove all selections | Footer bar hides, user is back to clean state |
| Catdog combos | Out of scope. Managed in Settings PropTypeTab |

---

## Component Structure

### New Files

| File | Responsibility |
|------|----------------|
| `src/lib/shared/navigation/components/account/MyPropsDrawer.svelte` | Drawer shell, phase state machine, morph transitions |
| `src/lib/shared/navigation/components/account/PropFamilyGrid.svelte` | Curated grid of base prop families with multi-select |
| `src/lib/shared/navigation/components/account/PropFamilyCard.svelte` | Individual toggleable prop card |
| `src/lib/shared/navigation/components/account/SelectionFooterBar.svelte` | Sticky footer with chips + CTA |
| `src/lib/shared/navigation/components/account/FavoritePicker.svelte` | Phase 2 — larger cards for favorite selection |

### Modified Files

| File | Change |
|------|--------|
| `AccountPopover.svelte` | Remove inline `PropSelectionSheet`. Own `PropPreferenceState`, pass to `MyPropsCard` and `MyPropsDrawer` |
| `MyPropsCard.svelte` | Accept `propState` as a prop instead of creating its own instance internally |

### Reused

- `Drawer.svelte` — existing drawer primitive
- `createPropPreferenceState()` — existing state factory (toggleProp, setFavorite)
- `PropTypeDisplayRegistry` — prop images and labels (`getPropTypeDisplayInfo`)
- `getBasePropType()` — normalizes variant types back to base family when loading existing `propsISpinWith`

---

## Curated Family List Definition

A static array defined in `PropFamilyGrid.svelte` (or a small constants file if reused):

```typescript
const PROP_FAMILIES = [
  // Staves & Clubs
  { base: PropType.STAFF, label: "Staff" },
  { base: PropType.CLUB, label: "Club" },
  { base: PropType.FAN, label: "Fan" },
  // Curved Props
  { base: PropType.BUUGENG, label: "Buugeng" },
  { base: PropType.TRIGENG, label: "Trigeng" },
  { base: PropType.MINIHOOP, label: "Hoop" },
  { base: PropType.TRIAD, label: "Triad" },
  { base: PropType.TRIQUETRA, label: "Triquetra" },
  // Novelty
  { base: PropType.CHICKEN, label: "Chicken" },
  { base: PropType.GUITAR, label: "Guitar" },
  { base: PropType.DOUBLESTAR, label: "Double Star" },
  { base: PropType.EIGHTRINGS, label: "Eight Rings" },
  { base: PropType.CONTACTBALL, label: "Contact Ball" },
  { base: PropType.TORCH, label: "Torch" },
  // Other
  { base: PropType.HAND, label: "Hand" },
  { base: PropType.SWORD, label: "Sword" },
];
```

When the user selects "Staff", all staff variants (STAFF, SIMPLESTAFF, BIGSTAFF, STAFF2) are treated as belonging to that family. The `propsISpinWith` array stores the base prop type.

---

## Styling

- Drawer: `--theme-panel-bg` background, no blur (per panel background rules)
- Cards: `--theme-card-bg` default, `--theme-accent` border when selected
- Checkmark badge: white icon on accent-colored circle (16px), top-right with 4px offset
- Star badge (favorite): gold (`var(--semantic-warning, #f59e0b)`) on white circle, top-left
- Footer bar: slightly elevated (`--theme-card-bg` with `--theme-stroke` top border)
- CTA button: `--theme-accent` background, white text, pill border-radius
- All transitions respect `prefers-reduced-motion: reduce`
- Typography: labels use `--font-size-compact` (12px), header uses `--font-size-sm` (14px) weight 600

---

## Accessibility

- All cards are `<button>` elements with `aria-pressed` for toggle state
- Favorite cards use `aria-label="Set {name} as favorite"`
- Footer bar CTA has descriptive `aria-label`
- Drawer has `ariaLabel="My props editor"`
- Phase transition announced via `aria-live="polite"` region for header text change
- Keyboard: Tab through cards, Space/Enter to toggle, Escape to close
- Reduced motion: crossfade replaced with instant swap, no scale animations
