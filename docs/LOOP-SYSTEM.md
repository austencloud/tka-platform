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
| **Swapped** | shuffle | #26e600 | Blue and red hands swap roles |
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

## Version History

- **v1.1** (2025-12-23): Added "modular" component for multi-motif independent transformations
- **v1.0** (2025-12-15): Initial taxonomy with 7 base components

---

_Consolidated from: LOOP-DETECTION-ALGORITHM.md, LOOP-PATTERN-TYPES.md, LOOP-TAXONOMY.md_
