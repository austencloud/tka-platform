# Modular LOOP Explanations on Card Backs

**Date:** 2026-03-19
**Status:** Design
**Scope:** LOOPDetector output enrichment + card back description generation

---

## Problem

The card back currently shows LOOP component icons (rotated, mirrored, flipped, swapped, inverted, rewound) and a generic "Loops back each cycle" message. Users see that a sequence is a LOOP but have no idea what the components mean for their specific sequence.

A simple LOOP like a halved flip is easy to grasp from the icon alone. But a modular LOOP like AAKE has multiple seeds with independent, nested transformations at different intervals. The flat icon list loses all that structure.

The goal: generate plain-English, sequence-specific LOOP explanations that appear on card backs.

---

## LOOP Component Definitions

For reference throughout this spec:

| Component | What it means |
|-----------|---------------|
| ROTATED | Positions rotate around the grid center (90deg quartered, 180deg halved) |
| MIRRORED | Positions mirror across the vertical axis (left/right, east/west) |
| FLIPPED | Positions mirror across the horizontal axis (top/bottom, north/south) |
| SWAPPED | Blue and red hands trade choreographic roles |
| INVERTED | Motion types flip (pro/anti) |
| REWOUND | Second half plays in temporal reverse |

---

## Classification

### Simple LOOPs

Single transformation applied uniformly across the whole sequence at one interval.

Examples:
- Halved flip: the second half mirrors the first half top-to-bottom.
- Quartered rotation: each quarter rotates 90deg from the previous one.

Description format: one sentence naming the transformation and cycle count.

### Modular LOOPs

Multiple seeds with independent transformations, possibly at nested intervals.

Example: AAKE (16 beats, 4 lines of 4).

```
Line 1: AA KE
Line 2: AA KE
Line 3: AA KE
Line 4: AA KE
```

Seeds: AA and KE. Each seed has its own transformation story:

- **KE seed, inner flip**: KE at line 1 vs line 2 is flipped (N/S). Same for line 3 vs line 4.
- **KE seed, outer flip**: KE at lines 1-2 vs lines 3-4 is also flipped.
- **AA seed**: AA flips between adjacent lines. The outer relationship (lines 1-2 vs 3-4) admits two valid readings: identical repetition or halved rotation+swap. Both describe the same geometry.

This nesting (inner transformations within line pairs, outer transformations between line pairs) is what makes modular LOOPs richer than simple ones.

---

## Description Format

### Simple LOOPs

One sentence. Name the transformation in plain terms and state the cycle count.

Examples:
- "Each half mirrors top and bottom. 2 reps return to start."
- "Each quarter rotates 90deg around the grid. 4 reps return to start."
- "Each half swaps blue and red roles. 2 reps return to start."

### Modular LOOPs

Name the seeds, then describe each seed's transformations at each interval.

Example for AAKE:
> Seeds: AA, KE.
> AA flips between lines.
> KE flips within each line pair and again between pairs.
> 4 cycles return to start.

Rules:
- Always name the seeds first so the reader knows the building blocks.
- Describe transformations from innermost interval outward.
- Use "between lines" / "within line pairs" / "between line pairs" for interval language.
- State the total cycle count at the end.
- When two valid readings exist for the same geometry, pick the simpler one unless the user asks for detail.

### Tone

Assume the reader knows what a sequence is, what beats are, and what the prop names mean. Don't assume they know LOOP algebra, group theory, or transformation composition. ELI5 the transformations.

---

## Required Detector Output

The current LOOPDetector returns a flat list of components. That's enough for icon display but not for description generation. The detector (or a wrapper) needs to output:

### 1. Seed Decomposition

Which beat ranges form which seed. For AAKE:

```
seeds: [
  { name: "AA", beatRanges: [[1,2], [5,6], [9,10], [13,14]] },
  { name: "KE", beatRanges: [[3,4], [7,8], [11,12], [15,16]] }
]
```

### 2. Per-Seed Transformations

What transformation applies to each seed, at what interval.

```
seedTransformations: [
  {
    seed: "AA",
    transformations: [
      { component: "FLIPPED", interval: "line", description: "flips between adjacent lines" }
    ]
  },
  {
    seed: "KE",
    transformations: [
      { component: "FLIPPED", interval: "inner", description: "flips within each line pair" },
      { component: "FLIPPED", interval: "outer", description: "flips between line pairs" }
    ]
  }
]
```

### 3. Nesting Structure

Which intervals are nested inside which. For a quartered 16-beat sequence:

```
intervals: [
  { id: "line", scope: "adjacent lines (1v2, 3v4)", level: 0 },
  { id: "pair", scope: "line pairs (1-2 vs 3-4)", level: 1 }
]
```

### 4. Cycle Count

How many repetitions of the full sequence return to the starting state.

---

## Implementation Approach

Create a new **LOOPExplainer** service rather than expanding the existing LOOPDetector. Reasons:

- Single responsibility. The detector answers "is this a LOOP and what components?" The explainer answers "what does this LOOP mean in plain English?"
- The detector's flat component list is still correct and useful for icon display.
- The explainer consumes detector output plus the raw beat data to produce structured descriptions.

### Service Shape

```typescript
interface ILOOPExplainer {
  explain(
    beats: BeatData[],
    loopComponents: LOOPComponent[]
  ): LOOPExplanation;
}

interface LOOPExplanation {
  type: "simple" | "modular";
  seeds: SeedInfo[];
  seedTransformations: SeedTransformation[];
  cycleCount: number;
  summary: string;        // The plain-English description for the card back
}
```

The `summary` field is the final rendered text. The structured fields exist so the card back renderer can format them however it wants (bold seed names, line breaks between seeds, etc.) rather than being locked into a single string.

### Registration

Standard DI pattern: interface in `services/contracts/ILOOPExplainer.ts`, implementation in `services/implementations/LOOPExplainer.ts`, registered in the choreo-card container.

---

## Card Back Integration

The card back already has a LOOP section that shows component icons. The explanation text goes below the icons. Layout:

```
[rotated] [flipped] [swapped]    <-- existing icons

Seeds: AA, KE.                   <-- new explanation text
AA flips between lines.
KE flips within each line pair
and again between pairs.
4 cycles return to start.
```

For simple LOOPs, the explanation is a single line below the icons. For modular LOOPs, it's a short paragraph.

---

## Scope

This is a future effort. Current state:
- Card back shows LOOP component icons.
- Card back shows a generic "Loops back each cycle" message.
- LOOPDetector returns flat component lists.

This spec describes the upgrade path. Implementation order:
1. Enrich LOOPDetector output with seed decomposition (or build LOOPExplainer that derives it).
2. Build the summary text generator.
3. Wire into card back rendering.

No changes to the existing icon display. The explanation is additive.
