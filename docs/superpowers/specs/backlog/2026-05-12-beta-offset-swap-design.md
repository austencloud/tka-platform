---
status: backlog
value: 3
effort: M
remaining: "Body status: Approved (autonomous mode)"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Beta Offset Swap — Design Spec

**Date:** 2026-05-12
**Status:** Approved (autonomous mode)
**Legacy parity:** Porting from Python desktop app

## Problem

When both hands end at the same grid location (beta position), props and arrows are offset left/right so they don't overlap. The legacy Python app let users swap which hand gets which side via a hotkey. The web platform calculates beta offsets deterministically with no user override. The JSON arrow placement data even contains `swap_beta_*` flags from the legacy app, but the web app never reads them.

## Design

### Data Model

Add `betaSwapped?: boolean` to `PictographData`. Since `StepData extends PictographData`, it inherits the field. Default `undefined`/`false` = normal offset direction.

### Prop Offset Swap

`PropPlacer.calculateBetaOffset()` returns `{x, y}` per color. When `pictographData.betaSwapped` is true, negate the result: `{x: -x, y: -y}`. Since blue and red get opposite directions, negating both effectively swaps their positions.

### Arrow Offset Swap

`SpecialPlacementLookup.lookupByColor()` resolves arrow adjustments by color key ("blue"/"red"). When `pictographData.betaSwapped` is true, swap the color key used for lookup — blue arrows get red's adjustment and vice versa.

### MCP Standalone Renderer

Same negation logic where `calculateBetaOffset` is called in `standalone-renderer.ts`.

### Hotkey

`B` key in the step editor (when step is selected, not start position). Follows the ArrowAdjustmentPanel keyboard handling pattern. Toggle behavior — press once to swap, press again to unswap.

### StepOperator Handler

New `BetaSwapHandler.ts` following the `DurationHandler` pattern:
- `toggleBetaSwap(stepNumber, createModuleState)` 
- Gets current step, flips `betaSwapped`, writes updated sequence

### Step Editor UI

Visual indicator in the StepEditorPanel header when `betaSwapped` is active — small badge similar to the cascade indicator. Shows "β⇄" when active.

### Transform Integration

- `colorSwapBeat`: Preserves `betaSwapped` unchanged. Swapping colors + existing swap = the offset assignment stays correct because both operations cancel.
- Other transforms (mirror, flip, rotate, invert, rewind): Pass through `betaSwapped` unchanged — these transforms don't affect which hand gets which beta offset side.

### Factory

`createStepData` passes through `betaSwapped` from input data via spread.

### Persistence

`betaSwapped` is a property on `PictographData`/`StepData`. It flows through existing sequence serialization (JSON.stringify of sequence data) and deserialization. No schema migration needed — `undefined` = false = normal behavior.

## Files Changed

1. `src/lib/shared/pictograph/shared/domain/models/PictographData.ts` — add field
2. `src/lib/shared/pictograph/prop/services/implementations/PropPlacer.ts` — negate offset
3. `src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/SpecialPlacementLookup.ts` — swap color key
4. `src/lib/features/create/shared/services/implementations/step-operations/BetaSwapHandler.ts` — new handler
5. `src/lib/features/create/shared/services/implementations/StepOperator.ts` — add method
6. `src/lib/features/create/shared/components/coordinators/StepEditorCoordinator.svelte` — wire handler
7. `src/lib/features/create/shared/components/sequence-actions/StepEditorPanel.svelte` — hotkey + indicator
8. `src/lib/shared/create/services/step-transforms.ts` — pass through in colorSwapBeat
9. `mcp-server-pkg/src/core/standalone-renderer.ts` — negate offset when betaSwapped

## Not in Scope

- Reading legacy `swap_beta_*` flags from JSON data (those encode per-configuration defaults, not per-beat user overrides — different concern)
- Batch swap across multiple beats
- Alt+hotkey overlay entry (can add later if useful)
