---
status: archived
---
# Deck Browser Redesign — Design Spec

**Date:** 2026-04-04
**Status:** Draft (iterating)
**Problem:** After filtering to a specific LOOP configuration, users see dozens of identical-looking deck cards with no way to distinguish them. The turn dimension is invisible, the hierarchy dumps too many results at the final step, and the navigation doesn't build toward a clear deck identity.

---

## Core Concept

Every system deck is a **named physical product** — a bounded set of sequences that can be printed, packaged, and held. Like a Magic: The Gathering set, each deck has a canonical identity derived from its position in the dimension hierarchy. The browser is a progressive drill-down that narrows from thousands of possibilities to a single deck in meaningful steps.

---

## The Three Entry Points

The top-level deck browser shows three hero cards:

| Entry | Contents | Navigation |
|-------|----------|------------|
| **LOOPs** | System decks enumerated from combinatorial space | 5-step dimension drill-down |
| **VTG** | System decks organized by per-hand motion categories | 4-step drill-down (no step count) |
| **My Decks** | User-created decks (promoted collections) | By name, date, or custom order |

**My Decks** are existing `LibraryCollection` documents where an optional `deckMetadata` field is present. When a user "promotes" a collection to a deck, it gains a canonical name, card back template reference, and appears here. Creation UI is out of scope for this spec.

---

## The Drill-Down Steps

### Step 1: Collection

**What you choose:** LOOPs or VTG

**Visual:** Two large hero cards plus My Decks. Each shows icon, description, aggregate stats. Generous padding, subtle glow on hover.

### Step 2: Shape (LOOPs path)

**What you choose:** Loop Type + Slice Type + Grid Mode

**Visual:** Pill rows, vertically stacked with section labels.

- **Loop Type:** Multi-select pills. Rotated, Mirrored, Swapped, Inverted, Rewound. Users can combine types to create composite decks (e.g., Rotated + Mirrored). Only populated values shown.
- **Slice:** Halved, Quartered. **Quartered is only available when Rotated is selected.** All other loop types auto-lock to Halved. If Rotated is not selected, the Slice row shows "Halved" as a locked pill.
- **Grid:** Diamond, Box.

**Behavior:** Only populated values shown. Single-value sub-dimensions auto-lock. All-single steps auto-advance.

### Step 2: Category (VTG path)

**What you choose:** VTG Family + Grid Mode

VTG families are displayed as **elemental cards** with their canonical icons and accent colors, grouped by Same Direction and Opposite Direction:

**Same Direction:** Split-Same (Water), Tog-Same (Earth), Quarter-Same (Sun)
**Opposite Direction:** Split-Opp (Fire), Tog-Opp (Air), Quarter-Opp (Moon)

Grid pills (Diamond / Box) sit below the elemental cards. No loop type or slice pills on this path.

### Step 3: Step Count (LOOPs path only)

**What you choose:** Step count (4, 8, 16, 32)

**Visual:** Single pill row. Only values with existing decks shown.

**VTG skips this step entirely.** VTG sequences are always 4 steps long (displayed as 8 counts via the LOOP doubling). This is fixed and not a user choice.

### Step 4: Turn Pattern

**What you choose:** A named turn pattern

Turn patterns define per-step, per-hand turn values. They are grouped by complexity tier.

**Visual:** Cards grouped under tier section headers (text labels, no level badges — levels mean something specific in TKA and do NOT map to Simple/Medium/Complex).

**"Uniform" is a single card** that expands into a sub-picker for the specific uniform value (0T, 0.5T, 1T, 1.5T, 2T, 2.5T, 3T). Each uniform value shows its VTG ratio equivalent. This prevents 7 cards from cluttering the main view.

**Other turn pattern cards** show:
- Bar-chart visualization (blue/red bars per step, height = turn value)
- Pattern name
- Clear description spelling out actual turn values (e.g., "Blue 2T every step, red 1T every step")
- Per-step notation in footer with colored blue/red numbers

**Step-count-dependent:** The turn pattern cards shown are filtered to those compatible with the selected step count. Complex patterns requiring 8+ steps don't appear for 4-step sequences.

**VTG path:** Cards show VTG ratio/timing language as primary label. Since VTG sequences are always 4 steps, only 4-step compatible patterns appear — primarily Uniform variations and simple 4-step patterns. Complex 8-step patterns (Pyramid, Float Wave, Contrast) do not appear on the VTG path.

**LOOPs path:** Cards show turn values as primary with VTG ratio as subtitle.

**Tier grouping (NOT the same as TKA levels):**
- **Simple — Uniform:** Single card that advances to a sub-screen for uniform value selection (0T through 3T)
- **Simple — Patterned:** Alternating, and other symmetric patterns
- **Medium:** Alternating Opposition, Blue Leads, Red Leads
- **Complex:** Pyramid, Half Steps, Float Wave, Contrast, Diverge (only for 8+ step sequences)
- **My Patterns:** User's saved custom turn patterns from `users/{userId}/turnPatterns` in Firestore. Same bar-chart card format. Only appears if the user has saved patterns. Uses existing `TurnPatternManager` infrastructure — no new data model needed. If empty, shows a subtle hint: "Save a custom turn pattern in Create to use it here."

### Step 5: Reversal Pattern (Terminal Step)

**What you choose:** Reversal Pattern — each card IS one final deck

**Visual:** Cards with dot-pattern visualization (red/blue reversal indicators per step), pattern name, description, sequence/family counts. The full canonical deck name shown in a footer.

Each card represents a unique, bounded, printable deck. Clicking opens the deck interior.

---

## Breadcrumb Navigation

Builds as you progress. Each segment clickable to go back.

**LOOPs example:**
```
LOOPs › Rotated · Quartered · Diamond › 8-Step › Uniform 1T › Continuous
```

**VTG example:**
```
VTG › Split-Same · Diamond › Uniform 1T › Continuous
```

The breadcrumb at the terminal step forms the deck's canonical display name.

---

## Deck Naming Convention

```
[SliceType] [LoopType] · [StepCount]-Step · [TurnPattern] · [ReversalPattern] · [GridMode]
```

Examples:
- `Quartered Rotated · 8-Step · Uniform 0T · Continuous · Diamond`
- `Halved Mirrored · 4-Step · Blue Leads · Book · Box`
- `Quartered Rotated+Mirrored · 16-Step · Pyramid · Alternating · Diamond`

VTG example:
- `Split-Same · Uniform 1T · Continuous · Diamond`

---

## Deck Identity and Sequence Ownership

**One canonical home per sequence.** Priority rule:

1. **Simplest turn pattern first** (Uniform 0T before Uniform 1T before patterned)
2. **Simplest reversal pattern** (continuous before book before alternating) — ordered by period length ascending
3. **Alphabetical tiebreak** on deck canonical name

The enumeration scripts enforce this during seeding — a sequence's `deckId` field records its canonical home.

**System decks are immutable.** Contents defined by enumeration algorithm.
**User decks (My Decks) are mutable.** Promoted collections, user curates freely.

---

## User Decks (My Decks) — Extended Collection Model

```typescript
interface DeckMetadata {
  displayName: string;
  cardBackTemplateId?: string;
  printConfig?: {
    cardSize: 'poker' | 'tarot' | 'mini';
    includeStartPosition: boolean;
  };
  promotedAt: Timestamp;
}
```

Query: `users/{userId}/collections` where `deckMetadata` exists.

---

## Auto-Skip and Auto-Advance Rules

1. **Single-value sub-dimension:** Pre-selected, shown as locked pill.
2. **All sub-dimensions single-value in a step:** Skip entire step, add to breadcrumb.
3. **Single deck remaining after any step:** Jump to deck interior.

---

## Data Model Changes

### Deck Interface (updated)

```typescript
interface Deck {
  readonly id: string;
  readonly name: string;              // Short display name
  readonly canonicalName: string;     // Full derived name
  readonly description: string;
  readonly families: readonly DeckFamily[];
  readonly totalSequences: number;
  readonly gridMode: GridMode;
  readonly level: number;
  readonly collection: 'LOOPs' | 'VTG';
  readonly loopType: string;          // Can be composite: "rotated+mirrored"
  readonly sliceType: 'halved' | 'quartered';
  readonly stepCount: number;
  readonly turnPattern: string;       // e.g., "uniform-0t", "alternating", "pyramid"
  readonly reversalPattern: string;
}
```

Key changes:
- `beatCount` → `stepCount` (pictographs are steps, not beats)
- `turns` → `turnPattern` (full taxonomy, not single number)
- `loopType` can now be composite (e.g., "rotated+mirrored")
- `canonicalName` added
- `collection` and `sliceType` made required

**Migration:** Extend `scripts/backfill-deck-metadata.cjs` to populate new fields.

### LibraryCollection (extended)

```typescript
interface LibraryCollection {
  // ... all existing fields unchanged ...
  deckMetadata?: DeckMetadata;
}
```

---

## Slice Type Rules

**Only Rotated allows Quartered.** All other loop types (Mirrored, Swapped, Inverted, Rewound) are Halved only.

When a non-Rotated type is selected in Step 2, the Slice row auto-locks to "Halved" with no Quartered option.

When Rotated is part of a multi-select (e.g., Rotated + Mirrored), Quartered may still be available depending on whether the composite supports it.

---

## What This Replaces

- `LoopCollectionView` with pill bars
- Axis toggle (By Beats / By Turns / By Reversal)
- Drill-down grids (`LoopBeatGrid`, `LoopTurnsGrid`, `LoopReversalGrid`)
- `DeckCard` showing only reversal pattern info

All replaced by the 5-step drill-down system.

---

## Visual Design Direction

- **Generous whitespace.** Steps breathe. Content centered, well-spaced on 4K monitors.
- **Depth and glow.** Selected states use subtle box-shadow glow. Cards lift on hover.
- **Progressive reveal.** Each step forward = opening a door. Breadcrumb grows, content transitions.
- **Turn pattern bar charts.** Blue/red bar-chart visualizations make turn values immediately parseable. Bar height maps to turn value. Purple bars for float.
- **Elemental theming for VTG.** Family cards use canonical element icons and accent colors.
- **Smooth transitions.** Step changes animate. Respect `prefers-reduced-motion`.

---

## Animation & Interaction Inventory

Every interaction below must be implemented faithfully. This is what makes the browser feel premium vs. flat. All animations respect `prefers-reduced-motion: reduce` (instant transitions, no transforms).

### Step Transitions

| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Advance to next step | Outgoing step fades + slides up 12px. Incoming step fades in + slides up from 12px below. | 250ms | ease-out |
| Navigate back via breadcrumb | Reverse: outgoing slides down, incoming slides up from above. | 200ms | ease-out |
| Auto-advance (single option) | Brief 400ms pause showing the locked value highlighted, then standard transition. |  |  |

### Card Interactions

| Element | Hover | Active/Press | Selected |
|---------|-------|-------------|----------|
| Hero cards (Step 1) | `translateY(-6px)`, border brightens, radial glow fades in behind card, `box-shadow: 0 20px 60px rgba(0,0,0,0.3)` | `translateY(-2px)`, shadow compresses | N/A (click advances) |
| Turn/Reversal pattern cards | `translateY(-4px)`, border goes accent color, `box-shadow: 0 12px 40px` + subtle accent glow | `translateY(-1px)` | Border accent at 50% opacity, persistent glow |
| Elemental family cards (VTG) | `translateY(-4px)`, border + glow in element's accent color | `translateY(-1px)` | Element glow persistent, icon opacity 1.0 |

### Pill Interactions

| State | Visual |
|-------|--------|
| Default | `border: 1.5px solid rgba(255,255,255,0.1)`, muted text |
| Hover | Border brightens to 25% white, text brightens |
| Selected | Accent-colored background at 12% opacity, accent border at 40%, accent text, subtle `box-shadow` glow |
| Locked (single option) | Muted accent, italic, no hover response |
| Multi-select (loop types) | Same as selected but multiple can be active. Deselect by clicking again. |

### Breadcrumb Animation

| Event | Animation |
|-------|-----------|
| New segment added | New segment slides in from right, opacity 0→1, 200ms ease-out |
| Segment clicked (go back) | Segments to the right of clicked one fade out + slide right, 150ms |
| Hover on clickable segment | Subtle background highlight, 100ms |

### Card Entrance (Stagger)

When a step's cards appear, they don't all pop in at once:

- Cards enter with 50ms stagger delay between each
- Each card: opacity 0→1, translateY(8px)→0, 200ms ease-out
- Creates a "cascade" feel as you enter a new step

### Bar Chart Animation (Turn Patterns)

When turn pattern cards appear, the bars animate up from zero height:

- Bars grow from height 0 to final height
- 300ms duration, ease-out
- 30ms stagger between bar groups (left to right)
- Creates a "building up" effect that draws the eye to the visualization

### Selection → Auto-Advance

When clicking a turn pattern card (which auto-advances to reversal step):

1. Card gets selected border + glow (instant)
2. 400ms pause for user to register their choice
3. Step transition plays (fade out current, fade in next)

### Dot Pattern Animation (Reversal Cards)

Reversal pattern dots could pulse subtly on hover to draw attention:

- On card hover, dots that are "active" (red or blue, not empty) pulse opacity 0.7→1.0→0.7
- 1.5s cycle, infinite while hovered
- Subtle — draws the eye to the pattern without being distracting

### Background

- Starfield particles (CSS radial gradients) are static — no animation
- Subtle vignette at edges (radial-gradient overlay darkening corners)
- The LOOPs path uses a cool blue-tinted ambient glow, VTG path uses warm purple

### Responsive Behavior

| Breakpoint | Adaptation |
|-----------|------------|
| > 1200px | 3-column card grids, generous padding, hero cards side by side |
| 768-1200px | 2-column grids, reduced padding |
| < 768px | Single column, pills wrap, hero cards stack, cards full-width |
| Touch devices | Hover effects become active-state only, touch targets minimum 44px |

---

## Out of Scope

- User deck creation/promotion UI
- Card back visual design
- Print layout and page composition
- Mixed/non-uniform turn enumeration for non-system decks
- Deck enumeration algorithm changes
- Deck interior redesign (separate spec)

---

## Open Questions

1. **Composite loop types:** What combinations are valid? Which composites can be quartered? (Research in progress)
2. **Auto-advance animation:** Pause briefly at skipped step or jump instantly?
3. **Empty states:** Hide pills with no decks, or gray them out?
4. **Turn pattern sub-picker for Uniform:** Inline expansion or modal/drawer?
