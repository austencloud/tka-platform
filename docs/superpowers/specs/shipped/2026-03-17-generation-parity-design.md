# MCP generate_sequence: Full Generate Tab Parity

**Date:** 2026-03-17
**Status:** Approved

## Problem

The MCP `generate_sequence` tool only supports word-based generation via the legacy random-walk builder. The app's Generate tab supports length-based freeform generation, 14 LOOP types with beam-search-targeted end positions, the 3-axis constraint system, and start position targeting. Separate `generate_loop_image`/`generate_loop_sequence` tools exist but only support 2 of 14 LOOP types and use the inferior retry-based approach.

## Decision

Consolidate all generation into `generate_sequence` using a hybrid routing approach:
- Plain word generation: existing legacy builder (proven, no regressions)
- Length-based or LOOP generation: engine's `SequenceBuilder` with beam search

Deprecate `generate_loop_image` and `generate_loop_sequence`.

## New Parameters

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `length` | number (1-256) | -- | Freeform mode. Must provide `word` OR `length`. |
| `loopType` | enum (14 types) | -- | Triggers LOOP extension via engine |
| `sliceSize` | "halved" \| "quartered" | "halved" | Only meaningful with `loopType` |
| `handPathMode` | "smooth" \| "mixed" \| "choppy" | "mixed" | 3-axis hand path continuity |
| `motionTypeFilter` | "no-dash" \| "prefer-dash" | -- | 3-axis motion family filter |
| `startPosition` | string | -- | Grid position targeting (e.g. "beta3") |

### LOOP Type Enum Values

All 14 types from the app:
`rotated`, `mirrored`, `flipped`, `swapped`, `inverted`,
`swapped_inverted`, `rotated_inverted`, `mirrored_swapped`, `mirrored_inverted`, `rotated_swapped`,
`mirrored_rotated`, `mirrored_inverted_rotated`, `mirrored_rotated_inverted_swapped`,
`strict_rewound`

### Validation Rules

1. Must provide `word` OR `length` (error if neither)
2. `word` + `length` together: `word` wins (spell mode with LOOP)
3. `sliceSize` without `loopType`: ignored
4. `loopType` triggers engine path regardless of word/length

## Routing Logic

```
if (loopType || (!word && length)):
  -> engine SequenceBuilder path (new)
else:
  -> legacy builder path (unchanged)
```

## Engine Integration

### New file: `mcp-server/src/core/engine-generation-adapter.ts`

Responsibilities:
1. Map MCP params to engine `BuildOptions`
2. Instantiate `MCPVariationProvider` with loaded pictograph data
3. Call `SequenceBuilder.build()`
4. Convert `BuildResult.sequence` to renderer-compatible steps
5. Handle constraint mapping (3-axis to engine ConstraintOptions)

### Seed Length Calculation

When LOOP is active, the user-specified length is the TOTAL output length. The seed is:
- Quartered: `Math.max(1, Math.floor(totalLength / 4))`
- Halved: `Math.max(1, Math.floor(totalLength / 2))`
- No LOOP: length as-is

### Constraint Mapping

The existing `constraintPreset` enum values (smooth, reversal, isolation, etc.) continue to work via the engine's preset system. The new 3-axis params layer on top:

| MCP Param | Engine ConstraintOption |
|-----------|----------------------|
| `handPathMode: "smooth"` | `handPathContinuity: "continuous"` |
| `handPathMode: "choppy"` | `handPathContinuity: "force-reversals"` |
| `handPathMode: "mixed"` | `handPathContinuity: "allow-reversals"` |
| `motionTypeFilter: "no-dash"` | `motionTypeExclusions: ["dash"]` |
| `motionTypeFilter: "prefer-dash"` | `motionTypePreference: "dash"` |

### BuildResult to Renderer Steps

The engine's `SequenceStep` and the renderer's step format share the same field names (letter, startPosition, endPosition, blueMotion, redMotion, beatIndex, isBridge). Direct mapping with minimal transformation.

### LOOP Component Auto-population

When `loopType` is provided, auto-derive `loopComponents` for rendering:
- `rotated` -> `["rotated"]`
- `mirrored_rotated` -> `["mirrored", "rotated"]`
- `strict_rewound` -> `["rewound"]`
- etc.

## Deprecation

Mark `generate_loop_image` and `generate_loop_sequence` descriptions with "[DEPRECATED] Use generate_sequence with loopType parameter instead." Keep them functional for backwards compatibility.

## Files Changed

| File | Change |
|------|--------|
| `mcp-server/src/tools/sequence-tools.ts` | Add new params, routing logic |
| `mcp-server/src/core/engine-generation-adapter.ts` | NEW: engine integration adapter |
| `mcp-server/src/tools/loop-tools.ts` | Deprecation notices |

## Bugfix Included

The engine's `BeamSearch.searchByLength` had a bug where single-beat seeds (e.g., 4-beat quartered LOOP: seedLength = 4/4 = 1) bypassed end-position filtering. Fixed in `packages/sequence-engine/src/generation/builder/BeamSearch.ts`.
