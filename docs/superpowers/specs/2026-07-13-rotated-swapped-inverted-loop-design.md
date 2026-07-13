# ROTATED_SWAPPED_INVERTED LOOP Type — Design

Date: 2026-07-13
Status: approved (conversational — Austen picked "A": implement the missing combo)

## Problem

The combo builder's only reachable dead-end is Rotated + Swapped + Inverted: every
other subset of {Mirrored, Rotated, Swapped, Inverted} maps to an implemented
LOOPType, so the "COMBO NOT SUPPORTED" disabled button and warning badge exist for
exactly one state. Domain math (MCP compositional LOOP theory) says the combo is
VALID: ROTATE is inner, SWAP/INVERT compose as outer, and all beta positions are
swap fixed points (inversion is position-free). It's unimplemented, not impossible.

## Decision

Implement `ROTATED_SWAPPED_INVERTED = "rotated_swapped_inverted"` end to end. After
this, no invalid combo state is reachable in the builder (Flipped/Rewound extensions
are already greyed out by `canExtendCombo`), so the dead-end UI can never show.
The dead-end message itself stays as a defensive fallback for hypothetical future
unmapped combos — no UI redesign needed.

## Why no new engine execution code

The live generation path is: GeneratePanel → config-mapper `buildLoopSpec` →
`GenerationOptions.loopSpecWire` → engine `spec-executor.ts` `executeSymmetricSpec`,
which is component-driven (fuses SWAPPED+INVERTED via FusedExecutor per period,
ROTATED as separate stage per documented rules). Same for the modern end-position
path `determineEndPositionForSpec` — generic over the component set. Only the gate
(`IMPLEMENTED_COMBOS`) blocks the combo today.

## Ledger

### Engine side (packages/sequence-engine)
- [x] `src/loop/loop-types.ts` — enum member + display-name map + description map + combo/extended lists
- [x] `src/loop/serialization/loop-type-tokens.ts` — mirror enum/display/description/token lists
- [x] `src/loop/detection/LOOPDetector.ts` `deriveLoopTypeFromComponents` size===3 branch: {ROTATED, SWAPPED, INVERTED} → new type (real gap: currently returns null)
- [x] `src/loop/targeting/LOOPEndPositionSelector.ts` deprecated `determineEndPosition()` switch — add case routing to `rotatedSelector.determineRotatedEndPosition(period, startPosition)` (rotation precedence, same as other ROTATED combos)
- [x] `src/generation/capacity/minimum-length-calculator.ts` `basePatternMinimum()` — add to the `return 2` bucket
- [x] Tests: extend existing enumerating tests (spec-executor parity, detection) with the new type

### App side (src/lib, mcp-server)
- [x] Both `circular-models.ts` copies (features/create/generate/circular + shared/foundation) — enum + display map + list
- [x] `src/lib/shared/create/services/loop-type-utils.ts` `IMPLEMENTED_COMBOS` — add [R,S,I] entry (this unlocks the UI)
- [x] `src/lib/features/create/shared/services/loop-validator.ts` — table entries + switch case (pattern-match neighboring ROTATED combos)
- [x] `src/lib/features/create/spell/services/loop-end-position-resolver.ts` — add case (match ROTATED-combo precedent)
- [x] `src/lib/features/create/generate/circular/services/loop-executor-selector.ts` + `loop-end-position-selector.ts` (legacy extend path) — wire new type following existing per-type pattern; new executor pattern-matched from `mirrored-swapped-inverted-loop-executor.ts` if the composition utilities make it small, else route extend flow's error message accurately
- [x] Card label maps: `ConsolidatedLOOPCard.svelte`, `LOOPCard.svelte` — concatenate existing i18n keys (no new JSON keys)
- [x] loop-labeler: `loop-type-definitions.ts`, `transformation-families.ts`, `transformation-priority.ts`, `candidate-formatter.ts`
- [x] `src/lib/shared/voice-control/services/handlers/generator-command-handler.ts` — display map
- [x] `mcp-server/src/core/engine-generation-adapter.ts` + `src/tools/sequence-tools.ts` — lookup tables
- [x] Tests: `tests/unit/services/loop-type-utils.test.ts` — new combo mapping
- [x] Grep confirm guest gating needs nothing per-type

### Verification (Fable, main loop)
- [x] Engine test suite green (vitest run in packages/sequence-engine — 187 files / 3419 tests pass)
- [x] One full `npm run check` green (0 errors, 21 pre-existing a11y warnings)
- [x] Runtime proof: generate a rotated_swapped_inverted sequence via local engine build (2/4/8-beat, beta seeds, detector round-trips all three)
