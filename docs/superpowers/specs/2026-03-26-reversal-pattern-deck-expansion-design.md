# Reversal Pattern Deck Expansion

## Problem

The deck system currently only generates **continuous** sequences (no reversals). Reversal patterns — systematic rules for which performer(s) reverse their prop rotation direction on which beats — are a major axis of the movement space that the system doesn't cover.

Additionally, the LOOP collection browser is a flat list with no meaningful organization, while the VTG browser has a polished multi-axis card layout. Both need reversal patterns as a browseable dimension.

## Key Insight

"Opening and closing the book" (following a continuous hand path with prop reversals on every beat) is NOT a new loop type. It's a regular quartered rotated LOOP with prop reversals applied. The reversal pattern is orthogonal to loop type, hand path family, beat count, and turn count — it's a new dimension that multiplies across all existing decks.

## Reversal Pattern Vocabulary

15 named patterns across 5 families. Full notation and construction rules in `docs/reference/reversal-patterns.md`.

### Notation

| Symbol | Meaning |
|--------|---------|
| `-` | No reversal |
| `R` | Red reverses only |
| `B` | Blue reverses only |
| `P` | Pair (both reverse) |

### Patterns

| Name | Pattern | Period | Family |
|------|---------|--------|--------|
| Continuous | `----` | 1 | Simple |
| Book | `PPPP` | 1 | Simple |
| Red Book | `RRRR` | 1 | Simple |
| Blue Book | `BBBB` | 1 | Simple |
| Long Book | `P-P-` | 2 | Simple |
| Alternating | `RBRB` | 2 | Simple |
| Solo 1 | `RBBRBRRB` | 8 | Solo |
| Solo 2 | `RBBRBRRBBRRBRBBR` | 16 | Solo |
| Solo 3 | `RBBRBRRBBRRBRBBRBRRBRBBRRBBRBRRB` | 32 | Solo |
| Dense Weave 1 | `RPBPRPBP` | 8 | Dense Weave |
| Dense Weave 2 | `RPBPRPBPBPRPBPRP` | 16 | Dense Weave |
| Dense Weave 3 | `RPBPRPBPBPRPBPRPBPRPBPRPRPBPRPBP` | 32 | Dense Weave |
| Sparse Weave 1 | `RBRPBRBP` | 8 | Sparse Weave |
| Sparse Weave 2 | `RBRPBRBPBRBPRBRP` | 16 | Sparse Weave |
| Sparse Weave 3 | `RBRPBRBPBRBPRBRPBRBPRBRPRBRPBRBP` | 32 | Sparse Weave |

### Complement Rule

All tiered patterns (Solo, Dense Weave, Sparse Weave) are built by a single construction rule: take the seed, swap every R↔B (P and - unchanged) to produce the complement, append the complement. This doubles the period each tier.

### Compatibility

A pattern works with a sequence when the pattern's period divides evenly into the beat count.

| Period | Compatible beat counts |
|--------|----------------------|
| 1 | Any |
| 2 | Any even (4, 6, 8, ...) |
| 8 | 8, 16, 24, 32, ... |
| 16 | 16, 32, 48, ... |
| 32 | 32, 64, ... |

## Data Model

### Deck Interface Extension

```typescript
interface Deck {
  // existing fields
  id: string;
  name: string;
  collection: string;
  families: DeckFamily[];
  totalSequences: number;
  gridMode: string;
  level: number;
  vtgRatio?: string;
  turns?: number;

  // new fields
  reversalPattern?: string;   // pattern id, e.g. "book", "dense-weave-1". Defaults to "continuous".
  loopType?: string;          // "strict_rotated", etc. Required for LOOP decks. Absent for VTG decks.
  beatCount?: number;         // 4, 6, 8, 12, 16
}
```

### Reversal Pattern Definition

```typescript
interface ReversalPatternDef {
  id: string;           // "book", "red-book", "solo-1", "dense-weave-2", etc.
  label: string;        // "Book", "Red Book", "Solo 1", "Dense Weave 2"
  family: string;       // "simple", "solo", "dense-weave", "sparse-weave"
  sequence: string;     // "PPPP", "RBBRBRRB", etc.
  period: number;       // 1, 2, 8, 16, 32
  minBeats: number;     // minimum sequence length (= period). No sequences have fewer than 4 beats.
}
```

This config lives in a shared TypeScript file (e.g. `src/lib/features/choreo-card/domain/reversal-patterns.ts`). The enumerator scripts (CJS) inline a copy of this config rather than importing TypeScript — same pattern as the existing deck enumerator which inlines validation sets.

## Enumerator Pipeline

The existing generalized deck enumerator adds an optional `--reversalPattern` flag:

```bash
node scripts/enumerate-deck.cjs \
  --loopType strict_rotated \
  --slice quartered \
  --seedLength 1 \
  --level 1 \
  --gridMode diamond \
  --reversalPattern book
```

### Pipeline Steps

1. **Enumerate** — DFS tree walk produces valid LOOP seeds (existing logic, unchanged)
2. **Execute LOOP** — apply LOOP transformation to derive full sequence (existing logic, unchanged)
3. **Apply reversal pattern** — for each beat at index `i`, read `pattern[i % period]`:
   - `P`: set `blueReversal = true, redReversal = true`
   - `R`: set `redReversal = true, blueReversal = false`
   - `B`: set `blueReversal = true, redReversal = false`
   - `-`: set both `false`
4. **Transform motions** — flip motion type (pro↔anti) on reversed hands. At L1 (0 turns), statics have no rotation to reverse so this only affects shift/dash motions. L2+ will need to handle the static case explicitly.
5. **Recompute letters** — look up the new letter from the transformed motion type pair using the same CSV pictograph dataframe the enumerator already loads. The letter is determined by (blue_motion_type, red_motion_type, hand_path_family), which the CSV maps to letters.
6. **Recompute orientations** — recalculate start/end orientations per beat from the flipped motion types
7. **Re-validate LOOP boundary** — check that the last beat's end state connects to the first beat's start state. Reject if broken.
8. **Output** — sequences that pass validation are written to the deck

### Word Field

After reversal transformation, the letters change, so the `word` field stores the **post-reversal** word. The `seedWord` stores the post-reversal seed. The continuous (pre-reversal) word is not preserved on the sequence — it can be reconstructed by looking up the same sequence in the continuous deck if needed.

### Orientation Hypothesis

When the same turn value is applied on every beat, reversals may always preserve orientation continuity (the math cancels out symmetrically). This needs empirical verification during implementation. If the hypothesis holds, step 7 becomes a no-op for uniform-turn-value decks. If it doesn't, step 7 filters out incompatible sequences.

## Firestore Structure

```
decks/
  l1-vtg-motions/                                    # continuous (existing)
  l1-vtg-motions-book/                               # book reversal
  l1-vtg-motions-red-book/                           # red book reversal
  l1-vtg-motions-blue-book/                          # blue book reversal
  l1-vtg-motions-long-book/                          # long book reversal
  l1-vtg-motions-alternating/                        # alternating reversal
  strict_rotated_quartered_L1_diamond/               # continuous LOOP (existing)
  strict_rotated_quartered_L1_diamond_book/          # book reversal
  ...
```

Each deck document includes the `reversalPattern` field for the UI to categorize.

## UI Design

### LOOP Collection Redesign

Replace the current flat list with a structured multi-axis browser.

**Top level: Loop Type selector**

Pill bar: `Rotated | Mirrored | Swapped | Inverted | Rewound`

Only Rotated is populated initially. Others show as disabled/coming-soon.

**Within each loop type: Three "BY" views**

Toggle between three organizational axes (same pattern as VTG's BY FAMILY | BY RATIO):

- **BY BEATS** — cards for each beat count (4, 6, 8, 12, 16). Card shows beat count prominently, sequence count, level badge.
- **BY TURNS** — cards for each turn value (0, 0.5, 1, 1.5, 2, 2.5, 3). Same layout as VTG ratio view.
- **BY REVERSAL** — cards for each reversal pattern. Grouped by family (Simple, Solo, Dense Weave, Sparse Weave). Card shows pattern name, the pattern string visually, sequence count.

**Default view**: BY BEATS (the most intuitive first question: "how long?").

**Drill-down**: Clicking any card filters to sequences matching that dimension. Same interaction as VTG family drill-down.

### VTG View Extension

The existing BY FAMILY | BY RATIO toggle gains a third option: **BY REVERSAL**.

Shows reversal pattern cards with sequence counts. Clicking drills down to sequences with that reversal pattern across all VTG families.

### Reversal Pattern Card Design

Each reversal card should visually represent the pattern — not just the name. A compact visual showing the R/B/P/- sequence as colored dots or marks:
- R = red dot
- B = blue dot
- P = both dots (or a combined marker)
- `-` = empty/dim marker

This makes the patterns scannable without reading the notation string.

## Phasing

### Phase 1: Simple Patterns (6 patterns)

- Implement reversal pattern definitions config
- Extend enumerator with `--reversalPattern` flag
- Apply reversal transformation + motion type flip + letter recomputation
- Verify orientation hypothesis empirically
- Seed VTG decks with all 6 simple reversal patterns
- Seed existing LOOP decks with all 6 simple patterns
- Add BY REVERSAL toggle to VTG view
- Redesign LOOP collection with loop type selector + three-axis browse

**VTG beat count note**: VTG decks are 4-beat sequences. Only the 6 simple patterns (period 1-2) are compatible with 4 beats. Solo and Weave families require 8+ beats and will never appear in VTG BY REVERSAL. This is expected — those patterns only make sense in longer sequences.

**If the orientation hypothesis fails**: some reversal patterns will filter out sequences, meaning reversal decks may have fewer sequences than the continuous deck. The UI handles this naturally (sequence count on each card reflects actual count). Phase 1 verifies this before seeding at scale.

### Phase 2: Solo + Weave Patterns (9 patterns)

- Add Solo 1-3, Dense Weave 1-3, Sparse Weave 1-3 to config
- Seed decks with compatible beat counts (8+ for tier 1, 16+ for tier 2, 32+ for tier 3)
- Update UI to show family groupings in the BY REVERSAL view

### Phase 3: Additional Loop Types

- Seed Mirrored, Swapped, Inverted, Rewound LOOPs with reversal patterns
- Enable disabled loop type pills in the UI

## Open Questions

1. **Orientation continuity under reversals** — verify empirically that uniform turn values preserve LOOP boundary continuity. If not, the enumerator filter handles it.
2. **VTG labeling** — when a reversal pattern changes the letters (G→H), display the new letters but label the card by underlying hand path family + reversal pattern. The hand path is what the spinner physically does.
3. **Reversal pattern card visual** — exact design for the colored dot representation of patterns. Needs mockup during implementation.
