# Generalized LOOP Deck Enumerator

**Date:** 2026-03-25
**Status:** Approved

## Purpose

Exhaustively enumerate every valid LOOP sequence for a given configuration (LOOP type, slice size, seed length, level, grid mode), deduplicate to one representative per letter-combination, group by hand-path family, and output as a browsable deck (JSON file and/or Firestore collection).

## Algorithm

1. **Load CSV** — Read the pictograph dataframe for the specified grid mode. Build an adjacency map: `position → list of variations reachable from that position`.
2. **Filter to level** — L1 keeps only 0-turn motions. L2 adds 0 and 1-turn. L3 adds 0, 0.5 (float), and 1-turn. Filtering happens at adjacency map construction time — variations with turns outside the level's pool are excluded before the tree walk begins.
3. **Validate LOOP type + slice size** — Reject invalid combinations (e.g. quartered + mirrored). See the Valid Combinations table below.
4. **For each valid start position** (alpha1, beta5, gamma11 for diamond grid):
   - Look up the required end position from the **LOOP-type-specific position map** (see End Position Constraints table below).
   - **Depth-first tree walk** of N beats (seed length). At each depth, branch on every valid variation from the current position. At the final depth, keep only paths that land on the required end position.
   - **Boundary continuity check** — validate that the LOOP transformation produces valid prop rotation continuity at the seed↔derived boundary (see Boundary Continuity section).
5. **Execute LOOP** — Run each valid seed through the appropriate LOOP executor (via `loopExecutorSelector.getExecutor(loopType).executeLOOP(seed, sliceSize)`) to produce the full circular sequence and derive the complete word.
6. **Deduplicate** — By `(startPosition, word)` pair. Two seeds from the same start position that produce the same full word are duplicates. Seeds from different start positions that produce the same word are kept as separate entries (they have different underlying motions). Keep the first variation encountered as the representative.
7. **Group** — By hand-path family. The family key uses the same coarse grouping as the L1 deck: letter-type names (e.g. "Dual-Shift", "Cross-Shift") rather than individual motion types.
8. **Output** — Print a count table to the console. Optionally write full enumeration to a JSON file and/or seed to Firestore as a browsable deck collection.

## End Position Constraints by LOOP Type

Each LOOP type has a specific position map that determines where the seed must end for the LOOP to close:

| LOOP Type | Position Map | End Position Rule |
|-----------|-------------|-------------------|
| `rotated` | `HALF_POSITION_MAP` (halved) or `QUARTER_POSITION_MAP_CW` (quartered) | 180° or 90° CW rotation of start |
| `mirrored` | `VERTICAL_MIRROR_POSITION_MAP` | Vertical mirror of start |
| `flipped` | `HORIZONTAL_MIRROR_POSITION_MAP` | Horizontal mirror of start |
| `swapped` | `SWAPPED_POSITION_MAP` | Swapped position of start |
| `inverted` | Identity | End must equal start |
| `swapped_inverted` | Identity (inverted requires same, swap is on motions) | End must equal start |
| `mirrored_swapped` | `SWAPPED(VERTICAL_MIRROR(start))` | Composed: mirror then swap |
| `mirrored_inverted` | `VERTICAL_MIRROR_POSITION_MAP` | Mirror (invert is on motions) |
| `rotated_swapped` | `SWAPPED(HALF/QUARTER(start))` | Composed: rotate then swap |
| `rotated_inverted` | `HALF/QUARTER_POSITION_MAP` | Rotation (invert is on motions) |
| `mirrored_rotated` | Composed | Mirror + rotation |
| Compound 3-way/4-way | Composed from components | Follow executor validation sets |
| `rewound` | Identity | End must equal start (reversed playback) |

The enumerator reads the validation sets directly from the sequence engine (`INVERTED_LOOP_VALIDATION_SET`, `MIRRORED_SWAPPED_VALIDATION_SET`, `HALVED_LOOPS`, `QUARTERED_LOOPS`) to determine valid start→end pairs rather than computing them manually.

## Valid LOOP Type + Slice Size Combinations

Some executors only support halved mode. The enumerator rejects invalid combinations at startup:

| LOOP Type | Halved | Quartered |
|-----------|--------|-----------|
| `rotated` | Yes | Yes |
| `mirrored` | Yes | No |
| `flipped` | Yes | No |
| `swapped` | Yes | No |
| `inverted` | Yes | No |
| `swapped_inverted` | Yes | No |
| `mirrored_swapped` | Yes | No |
| `mirrored_inverted` | Yes | No |
| `rotated_swapped` | Yes | Yes |
| `rotated_inverted` | Yes | Yes |
| `mirrored_rotated` | Yes | Yes |
| Compound 3-way/4-way | Yes | No |
| `rewound` | Yes | No |

## Boundary Continuity

When a LOOP executor transforms a seed into the derived slice, the prop rotation direction at the boundary (last seed beat → first derived beat) must be physically continuous. Different LOOP types have different continuity rules:

| LOOP Type | Boundary Rule |
|-----------|--------------|
| `rotated` | `seed_last.rotDir === derived_first.rotDir` (rotation preserves direction) |
| `mirrored` | `seed_last.rotDir === flip(derived_first.rotDir)` (mirror flips direction) |
| `inverted` | `seed_last.rotDir === flip(derived_first.rotDir)` (invert flips direction) |
| `swapped` | Swap is on hands, not direction — check per-hand continuity |
| Compound types | Follow from component transformations |

Rather than reimplementing these rules, the enumerator validates continuity **after** executing the LOOP: check that every consecutive step pair in the full circular sequence has matching `endLocation → startLocation` chains. If the executor produces a discontinuity, the seed is rejected.

## Quartered Rotation Direction

For `rotated` quartered LOOPs, `QUARTER_POSITION_MAP_CW` (clockwise 90°) is the canonical direction, matching the existing L1 deck. CCW quartered produces a different (and equally valid) deck. The enumerator defaults to CW. A future `--rotationDir ccw` flag can enable CCW enumeration.

## CLI Interface

```
node scripts/enumerate-deck.cjs \
  --loopType rotated \
  --slice halved \
  --seedLength 3 \
  --level 1 \
  --gridMode diamond \
  [--dry-run]           # count + table only, no Firestore write
  [--out deck.json]     # save full enumeration to JSON file
  [--seed-firestore]    # write to Firestore as browsable deck
```

### Required flags

| Flag | Values | Description |
|------|--------|-------------|
| `--loopType` | Any `LOOPType` string (e.g. `rotated`) | Which LOOP transformation to apply |
| `--slice` | `halved` or `quartered` | Slice size for the LOOP |
| `--seedLength` | Integer (e.g. 2, 3, 4) | Number of beats in the seed before LOOP extension |
| `--level` | 1, 2, 3 | Difficulty level (controls turn pool) |

### Optional flags

| Flag | Default | Description |
|------|---------|-------------|
| `--gridMode` | `diamond` | Grid mode for the CSV data |
| `--dry-run` | false | Print counts only, no file/Firestore output |
| `--out <path>` | none | Write full enumeration to a JSON file |
| `--seed-firestore` | false | Write deck entries to Firestore |
| `--startPositions` | auto | Comma-separated list to override default start positions |

## Data Model

### Per-deck entry

```typescript
{
  word: string;              // Full derived word after LOOP extension (e.g. "OAΣOAΣ")
  seedWord: string;          // Seed letters only (e.g. "OAΣ")
  letterCount: number;       // Total beat count of full sequence
  steps: SequenceStep[];     // Full circular sequence (engine format)
  startPosition: string;     // e.g. "alpha1"
  handPathFamily: string;    // Coarse grouping (e.g. "Dual-Shift+Cross-Shift+Dual-Shift")
  loopType: string;          // e.g. "rotated"
  sliceSize: string;         // e.g. "halved"
  level: number;
  gridMode: string;
}
```

### Firestore path

```
decks/{loopType}_{sliceSize}_L{level}_{gridMode}/sequences/{startPosition}_{word}
```

Example: `decks/rotated_halved_L1_diamond/sequences/alpha1_OAΣOAΣ`

Note: `startPosition` is part of the document ID because the same word from different start positions represents different sequences.

## Level Filtering

| Level | Turns Pool | Description |
|-------|-----------|-------------|
| 1 | 0 only | Shifts and statics without rotation |
| 2 | 0 and 1 | Adds 1-turn motions (180° additional rotation) |
| 3 | 0, 0.5, 1 | Adds float motions (0.5 = 90° additional rotation) |

The CSV's `turns` column is matched against these pools. The pool is checked against actual CSV data at startup to confirm the expected values exist.

## Hand-Path Family Grouping

Uses the same coarse grouping as the L1 deck: letter-type names rather than individual motion types. For example, letter O is a "Cross-Shift" (one pro, one anti), letter A is a "Dual-Shift" (both pro). The family key is the sequence of these type names joined by `+`.

Computed from seed beats only — derived beats follow deterministically from the LOOP transformation.

## Validation

The first validation target: run `--loopType rotated --slice quartered --seedLength 2 --level 1` and verify it produces the same 192 sequences as the existing `enumerate-l1-deck.cjs`. This confirms the generalized enumerator subsumes the existing one.

## Scaling Estimates

| Config | Seed Length | Start Positions | Rough Tree Size | After LOOP Filter | After Dedup |
|--------|-----------|-----------------|-----------------|-------------------|-------------|
| L1 quartered 2-beat | 2 | 3 | ~400 | ~200 | 192 |
| L1 halved 3-beat | 3 | 3 | ~8,000 | TBD | TBD |
| L1 halved 4-beat | 4 | 3 | ~160,000 | TBD | TBD |
| L2 quartered 2-beat | 2 | 3 | ~2,000+ | TBD | TBD |

The tree walk uses DFS (not BFS) to avoid memory explosion at larger seed lengths. Only valid completed seeds are accumulated; intermediate states are stack frames only.

## Implementation Notes

- **CJS script** — standalone, no TypeScript build dependency for the script itself
- **Sequence engine dependency** — requires `npm run build` in `packages/sequence-engine` first. The script imports compiled JS for LOOP executors, position maps, and validation sets.
- **Box/skewed grid modes** — deferred. Diamond is the immediate target. Other grid modes would use their respective CSV files and potentially different canonical start positions.

## File Location

`scripts/enumerate-deck.cjs`

## Replaces

`scripts/enumerate-l1-deck.cjs` becomes redundant once the generalized enumerator is validated against its output. The old script can be archived after confirmation.
