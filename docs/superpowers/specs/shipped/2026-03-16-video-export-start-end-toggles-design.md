# Video Export Start/End Position Toggles

**Date:** 2026-03-16

## Summary

Two toggles in the video export settings panel that control whether the export includes a 1-beat start position pause and a 1-beat end hold freeze.

## Toggles

| Toggle | Label | Default | Persisted |
|--------|-------|---------|-----------|
| Include start position | "Start Position" | ON | Yes (localStorage) |
| Include end hold | "End Hold" | ON if non-looping, OFF if loopable | Yes |

## Behavior Matrix

| Start Position | End Hold | Result |
|----------------|----------|--------|
| ON | ON | Current "showcase" behavior. 1-beat initial pose, motion, 1-beat freeze. |
| OFF | ON | Export begins at beat 1 (first motion step). End freeze included. |
| ON | OFF | Start pose shown, export ends at completion of last motion step. |
| OFF | OFF | Clean loop-ready clip. Just the motion, nothing extra. Trails/effects stay continuous if combined with Repeat. |

## UI Location

In ExportVideoDrawer, as a new row between Effects and Repeat. Two chip-style toggles, same visual pattern as the effect chips.

## State Changes

Add to `VideoExportOptions` interface:

```typescript
includeStartPosition: boolean;  // default: true
includeEndHold: boolean;        // default: !isSeamlesslyLoopable
```

Both persisted to localStorage with all other export options.

`includeEndHold` defaults based on `isSeamlesslyLoopable`: loopable sequences default to OFF (clean loops), non-loopable default to ON (showcase).

## Export Orchestrator Changes

`VideoExportOrchestrator.ts` currently hardcodes `startPositionDuration` and `endPositionHoldDuration` to 1 beat each. These become conditional:

- `startPositionDuration = includeStartPosition ? 1 : 0`
- `endPositionHoldDuration = includeEndHold ? 1 : 0`

The three-phase timeline logic (start position phase / motion phase / end hold phase) stays intact. Disabled phases just have duration 0.

## Files to Modify

1. **`src/lib/shared/sequence-viewer/state/export-options-state.svelte.ts`** — Add `includeStartPosition` and `includeEndHold` to `VideoExportOptions` interface and state, with localStorage persistence and smart defaults.

2. **`src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`** — Add toggle UI row with two chip-style toggles between Effects and Repeat rows.

3. **`src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts`** — Replace hardcoded duration values with conditional logic based on new options.

4. **`src/lib/shared/sequence-viewer/services/implementations/SequenceModalExporter.svelte.ts`** — Pass `includeStartPosition` and `includeEndHold` through to the orchestrator.

## Key Constraint

The VideoExportOrchestrator was recently fixed to properly handle the three-phase timeline (beat 0 = start position, beat 1+ = motion steps, final beat = end hold). The new toggles control phase inclusion within that same structure. No refactoring of the timeline logic needed, just duration changes.
