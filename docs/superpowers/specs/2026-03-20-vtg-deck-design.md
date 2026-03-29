# VTG Motions Deck

**Date:** 2026-03-20
**Status:** Ready for implementation

## Overview

19 VTG base motions as quartered and halved rotated LOOPs. Each card represents one fundamental VTG motion category — the building blocks everything else is built on.

## The 19 VTG Motions

### Same-Direction (Quartered Rotated LOOPs — 90° per slice, 4-beat)

1-beat seeds. Both hands shift in the same spatial direction. Each letter qualifies when its endPosition = rotate90CW(startPosition).

| # | Seed | Word | VTG | Position | Motions |
|---|------|------|-----|----------|---------|
| 1 | A | AAAA | Split-Same | alpha1 | pro/pro cw/cw |
| 2 | B | BBBB | Split-Same | alpha1 | anti/anti ccw/ccw |
| 3 | C | CCCC | Split-Same | alpha1 | anti/pro ccw/cw |
| 4 | G | GGGG | Tog-Same | beta5 | pro/pro cw/cw |
| 5 | H | HHHH | Tog-Same | beta5 | anti/anti ccw/ccw |
| 6 | I | IIII | Tog-Same | beta5 | anti/pro ccw/cw |
| 7 | S | SSSS | Quarter-Same | gamma11 | pro/pro cw/cw |
| 8 | T | TTTT | Quarter-Same | gamma11 | anti/anti ccw/ccw |
| 9 | U | UUUU | Quarter-Same | gamma11 | pro/anti cw/ccw |
| 10 | V | VVVV | Quarter-Same | gamma11 | anti/pro ccw/cw |

### Opposite-Direction (Halved Rotated LOOPs — 180° per slice, 4-beat)

2-beat seeds. Hands go in opposite directions, crossing position groups (alpha↔beta) or jumping within gamma. The 2-beat seed completes a 180° position rotation.

**Split-Opp** (start from alpha, cross to beta and back):

| # | Seed | Word | VTG | Starting Position |
|---|------|------|-----|-------------------|
| 11 | JD | JDJD | Split-Opp | alpha1 |
| 12 | KE | KEKE | Split-Opp | alpha1 |
| 13 | LF | LFLF | Split-Opp | alpha1 |

**Tog-Opp** (start from beta, cross to alpha and back):

| # | Seed | Word | VTG | Starting Position |
|---|------|------|-----|-------------------|
| 14 | DJ | DJDJ | Tog-Opp | beta5 |
| 15 | EK | EKEK | Tog-Opp | beta5 |
| 16 | FL | FLFL | Tog-Opp | beta5 |

**Quarter-Opp** (stay in gamma, 180° jumps within gamma group):

| # | Seed | Word | VTG | Starting Position |
|---|------|------|-----|-------------------|
| 17 | MP | MPMP | Quarter-Opp | gamma11 |
| 18 | NQ | NQNQ | Quarter-Opp | gamma11 |
| 19 | OR | OROR | Quarter-Opp | gamma11 |

## Gamma 180° Rotation Map (corrected)

Gamma has 8 positions (1,3,5,7,9,11,13,15). 180° = +4 positions:

```
gamma1 → gamma5,   gamma5 → gamma9,   gamma9 → gamma13,  gamma13 → gamma1
gamma3 → gamma7,   gamma7 → gamma11,  gamma11 → gamma15, gamma15 → gamma3
```

## Implementation Notes

### Seeder modifications

The existing `seed-l1-deck.ts` seeder handles quartered LOOPs (90° slices, 2-beat seeds, 8-beat output). For the VTG deck we need:

1. **1-beat seed support** for quartered LOOPs (same-direction motions)
   - Input: [startPos, beat1] → executeLOOP produces 4-beat sequence
   - Use `SliceSize.QUARTERED` with LOOPType.ROTATED

2. **Halved LOOP support** for opposite-direction motions
   - Input: [startPos, beat1, beat2] → executeLOOP produces 4-beat sequence
   - Use `SliceSize.HALVED` with LOOPType.ROTATED

3. **Corrected gamma 180° map** for position validation

### What NOT to include

- Dash/Dual-Dash motions (Φ-, Ψ-, Λ) — these form valid halved LOOPs but aren't VTG-based. Save for a separate dash-focused deck.

### Deck metadata

```
Firestore: decks/l1-vtg-motions
name: "Level 1: VTG Motions"
description: "The 19 fundamental VTG motion categories as rotated LOOPs."
level: 1
gridMode: diamond
totalSequences: 19
families: [
  { id: "split-same", label: "Split-Same", typeCombo: "Quartered" },
  { id: "tog-same", label: "Tog-Same", typeCombo: "Quartered" },
  { id: "quarter-same", label: "Quarter-Same", typeCombo: "Quartered" },
  { id: "split-opp", label: "Split-Opp", typeCombo: "Halved" },
  { id: "tog-opp", label: "Tog-Opp", typeCombo: "Halved" },
  { id: "quarter-opp", label: "Quarter-Opp", typeCombo: "Halved" },
]
```

### Hand paths

Each of the 19 sequences gets a `handPathId` computed the same way as the L1 quartered deck — tracing the actual locations each hand visits across all beats, color-canonical.

### Future deck expansion (from this session's brainstorming)

These ideas build on the VTG deck and the existing L1 quartered deck:

1. **Turn variations**: Apply 1, 2, or 3 turns to every motion in the existing decks → L2 versions
2. **Turn patterns**: Alternating turn assignments (e.g., 1 turn on red beat 1, 1 turn on blue beat 2)
3. **Reversals**: Allow prop reversals in quartered LOOPs → new dimension of variations
4. **Dash deck**: Φ-, Ψ-, Λ and other dash-heavy combinations as their own deck
