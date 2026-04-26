# Card Back Deck Identity Glyphs — Design Spec

**Date:** 2026-04-04
**Status:** Draft — needs physical print test before finalizing layout
**Depends on:** Deck Browser Redesign (must ship first so turn pattern and reversal pattern are deck dimensions)

---

## Problem

When cards from multiple decks get mixed together, there's no way to sort them back. The card back shows level, LOOP icons, step count, start position, word, and mandala — but nothing identifying which **turn pattern** or **reversal pattern** the sequence belongs to. These are the key dimensions that differentiate one deck from another.

---

## Solution: Period-Compressed Visual Glyphs

Add two small visual indicators to the card back footer:

1. **Turn pattern glyph** — the same blue/red bar chart used in the deck browser drill-down, shrunk to card-back scale
2. **Reversal pattern glyph** — the same red/blue dot pairs used in the deck browser, shrunk to card-back scale

Both glyphs show only the **minimum repeating unit** (the pattern's period), not the full sequence length. This means:
- Simple patterns (period 1-2) produce tiny glyphs
- Complex patterns (period 8+) produce wider glyphs
- The glyph WIDTH itself signals the pattern's complexity

This is language-free — anyone who has seen the deck browser UI recognizes the same visual language on the card.

---

## Current Card Back Layout

**File:** `src/lib/features/choreo-card/components/card-back/CardBack.svelte`
**Data:** `src/lib/features/choreo-card/components/card-back/card-back-data.ts`

The card is 2.5" × 3.5" (poker size), rendered using container query units (`cqi`) so it scales to any display size while maintaining proportions.

### Current element positions:

```
┌─────────────────────────────┐
│ [Level]  CHOREO CARDS  [LOOP│
│  badge]                icons]│
│                              │
│           WORD               │
│        (pronunciation)       │
│                              │
│         ┌────────┐           │
│         │mandala │           │
│         └────────┘           │
│        (VTG ratio)           │
│     (LOOP explanation)       │
│                              │
│  8        tkaflowarts.com  ┌┐│
│ STEPS                      │·│
│                             └┘│
└─────────────────────────────┘
   ↑ bottom-left          bottom-right ↑
     (step count)         (start position
                           mini-grid)
```

### Key CSS positions (all in `cqi` units):
- Top corners: `top: 3.2cqi; left/right: 3.2cqi`
- Bottom corners: `bottom: 3.2cqi; left/right: 3.2cqi`
- Top brand: `top: 3.6cqi; centered`
- Bottom URL: `bottom: 3.6cqi; centered`
- Corner badges: `8cqi` diameter circles
- Start position mini-grid: `~8cqi` square

---

## Changes

### 1. Move URL to top

**Before:** `tkaflowarts.com` is alone at bottom center
**After:** `tkaflowarts.com` moves to a subtitle line under "CHOREO CARDS" at the top

In `CardBack.svelte`, replace:
```html
<!-- URL: pinned to bottom center -->
<div class="bottom-url">tkaflowarts.com</div>
```

With the URL integrated into the top brand:
```html
<div class="top-brand">
  <span class="brand">CHOREO CARDS</span>
  <span class="brand-url">tkaflowarts.com</span>
</div>
```

The `.top-brand` becomes a flex column with the URL as a smaller, dimmer line below the brand name.

### 2. Add deck identity glyphs at bottom center

The freed bottom-center space gets two glyphs separated by a thin vertical divider:

```html
<div class="deck-identity">
  <TurnPatternGlyph entries={turnEntries} />
  <div class="glyph-divider"></div>
  <ReversalPatternGlyph sequence={reversalSequence} />
</div>
```

Position: `bottom: 3.2cqi; left: 50%; transform: translateX(-50%);` centered between the two bottom corners.

**Max width constraint:** The glyphs must not overlap the bottom-left (step count) or bottom-right (start position) corners. Available width is roughly `100% - 2*(3.2cqi + 10cqi)` = about 74cqi. If combined glyph width exceeds this, scale down the individual dot/bar sizes.

---

## New Components

### TurnPatternGlyph.svelte

**File:** `src/lib/features/choreo-card/components/card-back/TurnPatternGlyph.svelte`

Renders a period-compressed bar chart of turn values.

**Props:**
```typescript
interface Props {
  entries: { blue: number | 'fl'; red: number | 'fl' }[];  // One entry per period step
}
```

**Visual:**
- Blue bar on left, red bar on right, per entry
- Bar height proportional to turn value: `height = value * heightPerTurn` (where `heightPerTurn = 3cqi` gives max 3T = 9cqi tall)
- Float values rendered as purple bars at minimum height
- 0T rendered as minimum-height bars (2px equivalent in cqi)
- Bars use `border-radius` on top corners only
- Gap between bar groups: `0.8cqi`
- Gap between blue/red within a group: `0.4cqi`

**Y-axis reference (optional, needs print test):**
A single tiny "3" marker at the top-left of the chart area, with faint tick lines at 1T and 2T. This makes the bar heights precisely readable without being visually heavy. If it's too cluttered at print scale, remove it — the bars are still useful as relative indicators.

### ReversalPatternGlyph.svelte

**File:** `src/lib/features/choreo-card/components/card-back/ReversalPatternGlyph.svelte`

Renders period-compressed reversal dot pairs.

**Props:**
```typescript
interface Props {
  sequence: string;  // The reversal sequence string, e.g., "RBRB" or "PPPP"
  period: number;    // Show only this many columns
}
```

**Visual:**
- One column per period step
- Each column is a vertical pair: top dot = red hand, bottom dot = blue hand
- Dot states: filled red (`R` or `P`), filled blue (`B` or `P`), empty (no reversal = `-`)
- Dot diameter: `1.6cqi`
- Gap between dots in a pair: `0.4cqi`
- Gap between columns: `0.8cqi`

**Period compression logic:**
Show `sequence.slice(0, period)` columns. The `period` field is already defined on every reversal pattern in `src/lib/features/choreo-card/domain/reversal-patterns.ts`:

```typescript
// From REVERSAL_PATTERNS:
{ id: 'continuous', sequence: '----', period: 1 }   // → 1 column
{ id: 'book',       sequence: 'PPPP', period: 1 }   // → 1 column  
{ id: 'alternating', sequence: 'RBRB', period: 2 }  // → 2 columns
{ id: 'solo-1',     sequence: 'RBBRBRRB', period: 8 } // → 8 columns
```

### Glyph Divider

A thin vertical line between the two glyphs:
```css
.glyph-divider {
  width: 0.3cqi;
  height: 5cqi;
  background: rgba(255, 255, 255, 0.07);
  margin: 0 1.2cqi;
}
```

---

## Data Derivation

### In `card-back-data.ts`

Add two new fields to `CardBackData`:

```typescript
export interface CardBackData {
  // ... existing fields ...
  
  /** Period-compressed turn pattern entries for the glyph */
  turnGlyphEntries: { blue: number | 'fl'; red: number | 'fl' }[];
  
  /** Reversal pattern sequence string (from pattern definition) */
  reversalSequence: string;
  
  /** Reversal pattern period (number of columns to show) */
  reversalPeriod: number;
}
```

**Deriving turn glyph entries:**

The turn pattern for a deck is stored as `deck.turnPattern` (e.g., `"uniform-1t"`, `"alternating"`, `"pyramid"`). To get the per-step entries:

1. Look up the turn pattern template from `src/lib/features/create/shared/domain/templates/turn-pattern-templates.ts`
2. Extract the entries array (has `blue` and `red` per step)
3. Determine the period (for uniform patterns, period = 1; for alternating, period = 2; etc.)
4. Slice to one period

For sequences that don't belong to a system deck (user sequences), derive from the actual motion data — scan `sequence.steps[*].motions.{blue,red}.turns` and detect the repeating period.

**Deriving reversal data:**

1. Look up reversal pattern from `getReversalPattern(deck.reversalPattern)` (already imported in card-back-data.ts via reversal-patterns.ts)
2. Extract `.sequence` and `.period`
3. If no pattern found, default to continuous (sequence `"----"`, period 1)

---

## Overflow Handling

When both glyphs are wide (e.g., Pyramid turn pattern period 8 + Solo 1 reversal period 8), the combined footer may be too wide for the available space between the bottom corners.

**Strategy:** Calculate the combined width. If it exceeds `~60cqi`:
1. Reduce bar width and dot diameter by a scaling factor
2. Reduce gaps proportionally
3. Minimum bar width: `0.8cqi`, minimum dot diameter: `1.2cqi`

This ensures the glyphs always fit, even for the most complex patterns. The scaling is proportional so the visual shape is preserved.

---

## Interaction with Existing Elements

### VTG Ratio Label

Currently, when `vtgRatio` is not null, a ratio label (e.g., "3:1") is shown below the mandala in the center content area. This is redundant with the turn pattern glyph — a uniform 1T turn pattern IS a 3:1 ratio.

**Decision:** Keep the VTG ratio label for now. It's familiar to VTG users and provides the textual complement to the visual glyph. Removing it is a future simplification once users are accustomed to reading glyphs.

### LOOP Explanation Text

The LOOP explanation text below the mandala is not affected. It explains the LOOP transformation (what "rotated" means), not the turn or reversal pattern.

---

## Print Considerations

The card is physically 2.5" × 3.5" (63.5mm × 88.9mm). At this scale:

- A `1.6cqi` dot at 250px card width = ~4px on screen. At 300 DPI print = ~0.2mm diameter. This is small but visible.
- Bar charts with `1cqi` wide bars = similar scale.
- The glyphs will be subtle. They're not meant to be the primary visual — they're deck sorting aids that you notice when you're looking for them.

**A physical print test is required** before committing to the exact sizes. The spec provides the proportional layout; the cqi values may need tuning after seeing a printed card.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/features/choreo-card/components/card-back/TurnPatternGlyph.svelte` | Bar chart glyph component |
| `src/lib/features/choreo-card/components/card-back/ReversalPatternGlyph.svelte` | Dot pattern glyph component |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/features/choreo-card/components/card-back/CardBack.svelte` | Move URL to top, add deck identity footer with both glyphs |
| `src/lib/features/choreo-card/components/card-back/card-back-data.ts` | Add `turnGlyphEntries`, `reversalSequence`, `reversalPeriod` to `CardBackData` and `deriveCardBackData()` |

## Files to Read (reference, don't modify)

| File | What it provides |
|------|-----------------|
| `src/lib/features/choreo-card/domain/reversal-patterns.ts` | `REVERSAL_PATTERNS` array with `sequence` and `period` fields, `getReversalPattern()` lookup |
| `src/lib/features/create/shared/domain/templates/turn-pattern-templates.ts` | Turn pattern templates with per-step entries |
| `src/lib/features/create/shared/services/implementations/TurnPatternManager.ts` | Service for loading user's saved patterns from Firestore |
| `src/lib/features/choreo-card/domain/elemental-theme.ts` | `VTG_TURNS_RATIO_MAP` for ratio ↔ turn value mapping |
| `src/lib/features/choreo-card/components/card-back/card-back-theme-visuals.ts` | Theme-aware color derivation |

---

## Design Mockups

All in `.superpowers/brainstorm/103613-1775331314/`:
- `card-back-footer.html` — initial 4 layout options (URL at bottom)
- `card-back-footer-v2.html` — URL moved to top, 4 refined options with text name variants
- `card-back-4k.html` — period-compressed glyphs at full scale, 7 cards showing Simple → Medium → Complex progression
- `card-back-periods.html` — comparison table of full vs compressed reversal patterns

---

## Open Questions (resolve during or after print test)

1. **Y-axis markers on turn bars:** Should there be a tiny "3" marker or tick lines? Or are relative heights sufficient? Needs print test.
2. **Canonical name text:** Should the full deck name (e.g., "Quartered Rotated · 8-Step · Uniform 1T · Book · Diamond") appear as tiny text below the glyphs? Mockup option B showed this. May be too small to read at print scale.
3. **Turn pattern period detection:** Uniform patterns have period 1, but the turn pattern template system doesn't currently have an explicit `period` field like reversal patterns do. Need to either add one or compute it from the entries array.
4. **Corner extension alternative:** Option D in the mockups put turn bars under step count (bottom-left) and reversal dots under start position (bottom-right) instead of centering both. This avoids the overflow problem entirely but makes each corner busier. Worth revisiting if centered layout has print-scale issues.

---

## Implementation Order

1. **Create glyph components** (TurnPatternGlyph, ReversalPatternGlyph) — pure presentational, easy to test in isolation
2. **Update card-back-data.ts** — add derivation logic for turn and reversal glyph data
3. **Update CardBack.svelte** — move URL, add glyphs to footer
4. **Print test** — export a few sample cards, print at actual size, evaluate readability
5. **Tune** — adjust cqi values based on print results
