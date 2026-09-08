# LOOP Analysis Guide

> **Living Document**: This guide captures insights about LOOP (Linked Orbital Offset Pattern) analysis browseed during labeling sessions. Future AI agents and users should update this as new patterns are understood.

---

## Core Principle

**LOOP type is determined by analyzing the actual motion data between beats, NOT by the sequence name or letters.**

The same letter combination (e.g., "AB" vs "BA") can have completely different LOOP types depending on:

- The specific hand paths used
- The version/variation of the sequence
- How the performer chose to execute the movements

**Always analyze beat-to-beat relationships in the motion data.**

---

## Transformation Definitions

### Positional Transformations

| Transform    | Description                                    | Position Changes |
| ------------ | ---------------------------------------------- | ---------------- |
| **ROTATED**  | 180° rotation around center                    | n↔s AND e↔w      |
| **FLIPPED**  | Reflection across horizontal axis (top↔bottom) | n↔s only         |
| **MIRRORED** | Reflection across vertical axis (left↔right)   | e↔w only         |

### Other Transformations

| Transform    | Description                                                                            |
| ------------ | -------------------------------------------------------------------------------------- |
| **SWAPPED**  | Left and right props exchange roles (positions AND motion types must match after swap) |
| **INVERTED** | Motion types swap: pro↔anti                                                            |
| **SAME**     | Beats are identical (no transformation)                                                |

---

## Combined Transformations

Combined transformations (e.g., "ROTATED + SWAPPED") are only valid when applying both operations **in sequence** produces the observed result.

**Important**: Just because two beats satisfy ROTATED individually AND satisfy SWAPPED individually does NOT mean "ROTATED + SWAPPED" is valid. You must actually:

1. Apply rotation to beat 1
2. Then apply swap to the rotated result
3. Check if that matches beat 2

Symmetric beat patterns can satisfy multiple individual checks without the combination being meaningful.

---

## Analysis Tips

1. **Don't trust the sequence name** - Always look at the actual motion data
2. **Check motion types** - SWAPPED requires motion types to also match after swapping, not just positions
3. **Symmetric patterns are tricky** - When both props have the same motion type (e.g., both anti), multiple transformations may technically pass but only one is the "true" relationship
4. **Use beat-pair mode for complex sequences** - When a sequence has different relationships between different beat pairs, use beat-pair mode to label each relationship separately

---

## Labeling Modes

### Whole Sequence Mode

Use when the entire sequence exhibits a consistent transformation pattern throughout.

### Section Mode

Use when different parts of the sequence have different LOOP patterns. Can also designate base words (AAAA, BBBB, etc.) for hybrid sequences.

### Beat-Pair Mode

Use to analyze specific beat-to-beat relationships. Best for:

- Complex sequences with varying patterns
- Verifying what transformation exists between specific beats
- Hybrid sequences that combine multiple base words

---

## Session Insights Log

_Add dated entries as new patterns are browseed:_

### 2024-12-20

- Realized that position-only checks for SWAPPED cause false positives. Fixed by requiring motion types to also match.
- Combined transformation detection was incorrectly assuming "if A passes AND B passes, then A+B passes". Fixed to actually apply transformations in sequence.
- Added SAME detection for identical beats.

---

_Last updated: 2024-12-20_
