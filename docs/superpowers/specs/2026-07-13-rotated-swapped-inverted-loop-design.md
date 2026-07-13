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
- [x] Engine test suite green (vitest run in packages/sequence-engine — 36 files / 282 tests pass)
- [x] App unit tests green (12 files / 146 tests via vitest: loop-type-utils, loop-labeler, loop-viability)
- [x] Full `npm run check`: zero errors in this change's files (2 remaining errors are in ComposerTunnelDemo.svelte — unrelated in-flight composer work from another session)
- [x] Runtime proof: production builder generated 12/12 halved samples; every beta-start sample detector round-trips as `rotated_swapped_inverted` with components {inverted, rotated, swapped}

## Known behavior parity (pre-existing, NOT introduced here)

Baseline run of shipped ROTATED_SWAPPED shows identical characteristics, so the
new type matches its sibling exactly:
- beta starts: correct loop + correct detection (both types)
- alpha starts: rotation+swap cancel per-hand → degenerate loop detected as the
  swap/invert remainder (both types)
- gamma starts: builder's rotate-only seam target yields unclassifiable loops
  (both types — builder `determineEndPosition` targets rotate(start), app
  validator expects swap(rotate(start)); divergence predates this change)
- quartered: 0 samples in 80-120 attempts (both types)

Fixing alpha/gamma targeting for swap+rotate combos would change shipped
ROTATED_SWAPPED behavior too — separate project, flagged to Austen.
