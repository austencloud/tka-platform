# LOOP Detection System

This document consolidates the LOOP (Continuous Assembly Pattern) detection algorithm, pattern types, and taxonomy.

---

## Overview

A **LOOP** is a sequence that:
1. Returns to its starting position (circular)
2. Follows a structured transformation pattern between its halves/quarters

**Important:** The LOOP type is determined by **beat data** (positions, motion types, colors), not by the word or letters.

---

## LOOP Types

| Type | Definition |
|------|------------|
| **Strict LOOP** | Single transformation applies uniformly to ALL beat pairs |
| **Compound LOOP** | Different transformations at different intervals |
| **Modular LOOP** | Multiple distinct patterns at the SAME interval |
| **Freeform** | Circular but no recognizable pattern |

---

## LOOP Components

| Component | Icon | Color | Description |
|-----------|------|-------|-------------|
| **Rotated** | rotate | #36c3ff | Positions rotate 180° (halved) or 90° (quartered) |
| **Swapped** | shuffle | #2ecc71 | Blue and red hands swap roles |
| **Mirrored** | left-right | #6F2DA8 | Positions mirror vertically (left ↔ right) |
| **Flipped** | up-down | #14b8a6 | Positions mirror horizontally (top ↔ bottom) |
| **Inverted** | yin-yang | #eb7d00 | Pro ↔ Anti motion types flip |
| **Rewound** | backward | #ec4899 | Second half plays in reverse |
| **Repeated** | repeat | #f59e0b | Sequence repeats 2-4x for circularity |
| **Modular** | layer-group | #8b5cf6 | Multiple motifs transform independently |

---

## Transformation Intervals

- **Halved (½)**: Transformation at 180° / midpoint
- **Quartered (¼)**: Transformation at 90° intervals

Components can combine:
- **rotated+swapped**: Positions rotate AND colors swap
- **mirrored+swapped+inverted**: All three transformations

---

## Position Transform Maps

### ROTATE_180

```
n ↔ s
e ↔ w
ne ↔ sw
nw ↔ se
```

### ROTATE_90_CCW

```
n → w → s → e → n
ne → nw → sw → se → ne
```

### MIRROR_VERTICAL (left/right)

```
e ↔ w
ne ↔ nw
se ↔ sw
```

### FLIP_HORIZONTAL (top/bottom)

```
n ↔ s
ne ↔ se
nw ↔ sw
```

---

## Detection Algorithm

### Step 1: Check Circularity

```
IF last beat's end position ≠ start position:
    RETURN "Not circular, not a LOOP"
```

### Step 2: Check Beat Count

```
IF beat count is odd:
    Cannot be a structured LOOP (halved comparison impossible)

IF beat count % 4 ≠ 0:
    Skip quartered detection (only check halved)
```

### Step 3: Halved Detection

For each beat pair `(i, i + halfLength)`:

1. **ROTATED**: Are positions rotated 180°?
2. **SWAPPED**: Are colors exchanged (with same positions)?
3. **MIRRORED**: Are positions mirrored left/right?
4. **FLIPPED**: Are positions flipped top/bottom?
5. **INVERTED**: Are motion types inverted?
6. **REPEATED**: Are beats identical?
7. **Compound patterns**: Apply transforms in sequence

### Step 4: Quartered Detection

For sequences divisible by 4, check 90° rotation patterns at each quarter transition.

### Step 5: Mixed-Slice Detection

Components can operate at different slice granularities:

**Rotated(¼) + Swapped(½)** means:
- Rotation happens at 90° per quarter
- Swap happens only at the half boundary

---

## When is Swap "Meaningful"?

**Meaningful when:**
- Hands have DIFFERENT motion types (one pro, one anti)
- The swap exchanges distinct choreographic roles

**Not meaningful when:**
- Both hands have SAME motion type
- Swapping produces identical choreography

**Exception:** For mixed-slice patterns, swap IS meaningful even with same motion types.

---

## Detection Priority

1. Three-component compounds override individuals
2. Two-component compounds override single components
3. Mixed-slice patterns take precedence
4. Quartered patterns can override halved if more specific

---

## Rewound LOOPs

**Rewound is a temporal transformation**, unlike the geometric transformations (rotated, mirrored, swapped). It plays the sequence backwards to complete the circle.

### How Rewound Works

1. Take the original sequence: `[1, 2, 3, 4]`
2. Reverse the steps and swap their start/end positions
3. Reverse rotation directions (CW ↔ CCW)
4. Append to create: `[1, 2, 3, 4, 4', 3', 2', 1']`

### Key Properties

- **Works on ANY sequence** - no position validation needed (unlike rotation-based LOOPs)
- **Always halved** - no interval concept; it inherently doubles the sequence
- **Letters are DERIVED** - reversing E's motions produces K, not E (they are motion inverses)

### Example: CAKE → CAKEKEAC

```
Seed word: CAKE (4 beats)
Rewound:   Each beat is reversed
Result:    CAKE + derived letters = CAKEKEAC (8 beats)
```

The derived letters come from analyzing the reversed motion parameters, not from reversing the letter order.

### Rewound Motion Transformation

For each reversed beat:
- `startLocation` ← previous beat's `endLocation`
- `endLocation` ← source beat's `startLocation`
- `rotationDirection`: CW → CCW, CCW → CW
- `startOrientation` ← source's `endOrientation`
- `endOrientation` ← source's `startOrientation`

### Compound: Rewound + Inverted

`rewound_inverted` combines:
- Temporal reversal (play backwards)
- Motion type inversion (pro ↔ anti)

---

## Modular LOOPs

A **modular LOOP** has distinct motifs that transform independently at different intervals.

**Key characteristics:**
1. Multiple motifs (2+ distinct recurring phrases)
2. Independent transformations (each motif has its own rule)
3. Different intervals (one at quarters, another at halves)
4. Overall sequence remains circular

**Example - AAKE:**
- **AA motif**: Alternates rotation CCW/CW every quarter
- **KE motif**: Swaps destination at halfway point

---

## Decision Tree

```
Is it circular? (ends where it starts)
├─ NO → Not a LOOP
└─ YES
   │
   Does the entire sequence follow one transformation?
   ├─ YES → Strict LOOP (rotated, swapped, etc.)
   └─ NO
      │
      Do sections relate with the same transformation?
      ├─ YES → Section LOOP
      └─ NO
         │
         Do distinct motifs transform independently?
         ├─ YES → Modular
         └─ NO → Freeform or Unknown
```

---

## Summary Flowchart

```
┌─────────────────────────────────┐
│ Is sequence circular?           │
└─────────────┬───────────────────┘
              │ No → Not a LOOP
              │ Yes ↓
┌─────────────────────────────────┐
│ Check halved comparisons        │
│ (beat i vs beat i+half)         │
└─────────────┬───────────────────┘
              ↓
┌─────────────────────────────────┐
│ Beat count divisible by 4?      │
└─────────────┬───────────────────┘
              │ No → Use halved results
              │ Yes ↓
┌─────────────────────────────────┐
│ Check quartered patterns        │
│ (90° rotation at quarters)      │
└─────────────┬───────────────────┘
              ↓
┌─────────────────────────────────┐
│ Map components to LOOP type     │
└─────────────────────────────────┘
```

---

## Compositional LOOP Theory

> **Added Feb 2026.** Discovered through analysis of an 8-beat LFLFLFLFLFLFLFLFLFL sequence from alpha1.
> The current flat component detection ({MIRRORED, SWAPPED, INVERTED}) loses structural information.
> This section describes the ordered compositional algebra that captures HOW a LOOP is constructed.

### Turn Independence

The LOOP algebra operates on a reduced space of:
- **Grid positions** (where hands are)
- **Motion types** (pro / anti / static / dash / float)
- **Hand identity** (blue / red)

**Turn values and orientations do not affect LOOP classification.** You can set every turn to 0 and the LOOP type is unchanged. The detector already confirms this - none of its checks examine turn counts or orientations.

Every LOOP type has a "canonical zero-turn form" that represents its pure algebraic skeleton. The performed sequence is that skeleton dressed with turn values:

```
Performed Sequence = LOOP Skeleton + Turn Assignment
```

Turn assignment is a separate creative choice layered on top of the algebraic structure.

### Compositional Notation

Instead of flat component bags like `{MIRRORED, SWAPPED, INVERTED}`, express LOOPs as ordered compositions:

- `/` = applied **simultaneously** as one compound operation
- `+` = applied **sequentially** (this pattern, then that transformation on top)

Example: `SWAPPED + MIRRORED/INVERTED`

This reads as a construction recipe:
1. Take a SWAPPED inner pattern (seed doubled via hand-role swap)
2. Apply MIRRORED and INVERTED simultaneously to that block (mirror positions to opposite side + flip pro/anti)

The flat label `{MIRRORED, SWAPPED, INVERTED}` doesn't tell you which transformation came first or how the sequence was built. The compositional notation preserves the construction order.

### The Fixed-Point Theorem

For the composition `INNER + OUTER`:
- INNER produces a circular sub-pattern: starts at S, ends at S
- OUTER takes that sub-pattern and applies a transformation to double it
- The outer half must start at S (continuity) and end at S (circularity)

**Therefore: T(S) = S for any outer transform T.** The starting position must be a **fixed point** of the outer transformation.

### Computed Fixed Points

From the actual position maps in the codebase:

| Transform | Fixed-point positions (can be OUTER from these) |
|---|---|
| **MIRROR (vertical)** | alpha1, alpha5, beta1, beta5 |
| **FLIP (horizontal)** | alpha3, alpha7, beta3, beta7 |
| **SWAP** | beta1 through beta8 (all beta) |
| **ROTATE 180deg** | terra1 only |
| **INVERTED** | ALL positions (doesn't change positions) |

**Key insight:** Swap is identity on beta because swapping two hands at the same grid location changes nothing positionally. This is why beta enables the most compositions.

### Compound Outer Fixed Points

For compound outer transforms, intersect the fixed-point sets:

| Compound Outer | Valid Starting Positions |
|---|---|
| MIRROR/INVERTED | alpha1, alpha5, beta1, beta5 |
| FLIP/INVERTED | alpha3, alpha7, beta3, beta7 |
| SWAP/INVERTED | all beta |
| MIRROR/SWAP | beta1, beta5 only |
| FLIP/SWAP | beta3, beta7 only |
| MIRROR/FLIP | none (L1-4), terra1 (L5) |
| MIRROR/SWAP/INVERTED | beta1, beta5 only |
| FLIP/SWAP/INVERTED | beta3, beta7 only |

### Rotation Is Always Inner

**No standard L1-L4 grid position is a fixed point under 180deg rotation.**

- alpha1 -> alpha5 (moves)
- beta3 -> beta7 (moves)
- gamma1 -> gamma5 (moves)
- Only terra1 (both hands at center, L5) maps to itself

**Proof:** ROTATE cannot be an outer transform from any standard position. It must be the innermost structural layer or standalone. This is not a design choice - it's a mathematical constraint.

For ROTATE as INNER, the seed goes S -> ROTATE(S), which is always a different position, producing non-degenerate structure from any starting point. Then geometric transforms (MIRROR, FLIP, SWAP) can layer on top as outer.

### Composability Matrix

Checked against the actual position maps. "inner: degenerate" means the inner transform doesn't change positions (T(S) = S).

**From alpha1:**

| Composition | Inner valid? | Outer valid? | Overall |
|---|---|---|---|
| SWAP + MIRROR/INV | alpha1->alpha5 yes | MIRROR(alpha1)=alpha1 yes | VALID |
| SWAP + FLIP/INV | alpha1->alpha5 yes | FLIP(alpha1)=alpha5 no | BLOCKED |
| SWAP + INVERTED | alpha1->alpha5 yes | always yes | VALID |
| ROTATE + SWAP | alpha1->alpha5 yes | SWAP(alpha1)=alpha5 no | BLOCKED |
| ROTATE + MIRROR/INV | alpha1->alpha5 yes | MIRROR(alpha1)=alpha1 yes | VALID |
| MIRROR/INV + SWAP | alpha1->alpha1 degenerate | SWAP(alpha1)=alpha5 no | BLOCKED |

**From beta3:**

| Composition | Inner valid? | Outer valid? | Overall |
|---|---|---|---|
| SWAP + MIRROR/INV | beta3->beta3 degenerate | MIRROR(beta3)=beta7 no | BLOCKED |
| SWAP + FLIP/INV | beta3->beta3 degenerate | FLIP(beta3)=beta3 yes | degenerate inner |
| ROTATE + SWAP | beta3->beta7 yes | SWAP(beta3)=beta3 yes | VALID |
| ROTATE + FLIP/INV | beta3->beta7 yes | FLIP(beta3)=beta3 yes | VALID |
| MIRROR/INV + SWAP | beta3->beta7 yes | SWAP(beta3)=beta3 yes | VALID |

**From beta1:**

| Composition | Inner valid? | Outer valid? | Overall |
|---|---|---|---|
| SWAP + MIRROR/INV | degenerate | MIRROR(beta1)=beta1 yes | degenerate inner |
| ROTATE + SWAP | beta1->beta5 yes | SWAP(beta1)=beta1 yes | VALID |
| ROTATE + MIRROR/INV | beta1->beta5 yes | MIRROR(beta1)=beta1 yes | VALID |
| MIRROR/INV + SWAP | beta1->beta1 degenerate | SWAP(beta1)=beta1 yes | degenerate inner |

### Key Results

1. **Order matters.** `SWAP + MIRROR/INV` (valid from alpha1) and `MIRROR/INV + SWAP` (valid from beta3, not alpha1) are different compositions from different positions. They are NOT interchangeable.

2. **Beta is the universal connector.** All beta positions are SWAP fixed points. beta1/beta5 additionally support MIRROR as outer. beta3/beta7 support FLIP as outer. Beta enables the widest range of compositions.

3. **ROTATE is always the innermost layer.** Mathematical proof: no L1-L4 position is a 180deg rotation fixed point. Rotation produces non-degenerate structure from any position, making it ideal as the inner seed transformation.

4. **INVERTED is always free.** It has no positional constraint (all positions are fixed points). It can be added to any outer transform via `/` without restricting valid starting positions.

5. **The current flat detection ({MIRRORED, SWAPPED, INVERTED}) loses information.** The same component set can correspond to different compositional structures depending on starting position and construction order.

### Future Work

- Encode composability constraints as data structures in the generator
- Allow users to specify LOOP composition order (e.g., "SWAPPED + MIRRORED/INVERTED") rather than flat type
- Extend fixed-point analysis to L5+ positions (tau, terra)
- Investigate whether every multi-component LOOP has a unique decomposition or allows multiple valid orderings

---

## Version History

- **v2.0** (2026-02-19): Added Compositional LOOP Theory - ordered composition notation, fixed-point theorem, composability matrix, proof that rotation is always inner, turn independence
- **v1.1** (2025-12-23): Added "modular" component for multi-motif independent transformations
- **v1.0** (2025-12-15): Initial taxonomy with 7 base components

---

_Consolidated from: LOOP-DETECTION-ALGORITHM.md, LOOP-PATTERN-TYPES.md, LOOP-TAXONOMY.md_
