# LOOP Period Viability — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-04-19-loop-period-viability-design.md`
**Date:** 2026-04-19

---

## Overview

Four phases (A-D). Each phase is a clean vertical slice that keeps tests green. The core insight from the spec: **period 4 is viable iff the LOOP type contains ROTATED.** All implementation work flows from that rule.

**Execution order:**
- A → B → C → D (each unlocks the next).
- A is the foundation: the `LoopViabilityService` that every other phase consumes.
- B is visible UX (tooltip on disabled button).
- C is defense-in-depth at generation time.
- D is cleanup of the dead `sliceSize` parameter now that `period` is fully plumbed.

**Non-destructive principle:** until D, all old APIs stay functional. Existing executors keep their `sliceSize` parameter until D's contract migration.

**Verification philosophy:** every phase ends with `npm run check` clean + relevant tests passing. No phase is "done" without both.

---

## Phase A — LoopViabilityService

**Goal:** single authoritative service that answers "is this (type, period, level, gridMode) combination generatable?" Everything downstream consumes this.

**New files:**
- `src/lib/features/create/generate/shared/services/contracts/ILoopViabilityService.ts`
- `src/lib/features/create/generate/shared/services/implementations/LoopViabilityService.ts`
- `src/lib/features/create/generate/shared/domain/errors/LoopViabilityError.ts`
- `tests/unit/features/create/generate/loop-viability-service.test.ts`

**Shape:**

```ts
export interface LoopViabilityCheck {
  viable: boolean;
  reason?: string;          // human-readable explanation when !viable
  suggestion?: string;      // optional actionable follow-up
}

export interface ILoopViabilityService {
  check(args: {
    loopType: LOOPType;
    period: number;
    level?: number;         // optional — no current rule uses it, reserved for future
    gridMode?: GridMode;    // optional — same
  }): LoopViabilityCheck;
}
```

**Rule implementation:**

1. `period === 1` → `{viable: false, reason: "Period 1 is not a LOOP."}` (defensive — UI should never submit period 1)
2. `period === 2` → always `{viable: true}` (every LOOP type supports halved)
3. `period === 4`:
   - `ROTATED_LOOP_TYPES.has(loopType)` → `{viable: true}`
   - otherwise → `{viable: false, reason: "Quartered requires a rotation component.", suggestion: "Try 'rotated' alone, or add rotation to your current type."}`
4. `period === 8` → `{viable: false, reason: "Period 8 requires Level 7+ (not yet available)."}` (reserved)
5. Otherwise (unknown period) → `{viable: false, reason: "Period must be 2 or 4."}`

**Tests (tabulated, ~20 cases):**

- Every entry in the spec §4.1 table has a test.
- Period 2 ✓ for all types.
- Period 4 ✓ for `ROTATED`, `ROTATED_INVERTED`, `ROTATED_SWAPPED`, `MIRRORED_ROTATED`, `MIRRORED_INVERTED_ROTATED`, `MIRRORED_ROTATED_INVERTED_SWAPPED`.
- Period 4 ✗ (with correct reason) for `MIRRORED`, `FLIPPED`, `SWAPPED`, `INVERTED`, `REWOUND`, `MIRRORED_INVERTED`, `MIRRORED_SWAPPED`, `SWAPPED_INVERTED`.
- Period 1, 3, 5, 7, 8 → all infeasible with reason strings.

**DI wiring:**
- Register singleton in `src/lib/shared/di/container.ts` (or whatever the current DI surface is — inspect first).
- Export via `container.items.loopViabilityService`.

**Verification:**
- `npm run check` clean.
- All tabulated tests pass.
- No existing tests regress.

---

## Phase B — Wire viability into PeriodCard UI

**Goal:** user sees the period 4 option as visually disabled with an explanatory tooltip when their selected LOOP type can't support it.

**Files:**
- `src/lib/features/create/generate/components/cards/PeriodCard.svelte` — add `disabledOptions` + `disabledReason` props
- `src/lib/features/create/generate/components/cards/ToggleCard.svelte` — extend to support disabling individual options (check current API first; might already support it)
- `src/lib/features/create/generate/shared/services/implementations/CardConfigurator.ts` — compute viability per option and pass to PeriodCard

**Approach:**

1. Inspect `ToggleCard.svelte`. If it doesn't already support per-option disable + tooltip, add:
   - `disabledValues?: Array<Option["value"]>`
   - `disabledReason?: (value: Option["value"]) => string | null`
2. `PeriodCard.svelte` accepts `loopType` and uses injected `loopViabilityService` (via `container.items`) to compute which of {2, 4} are disabled. Build the `disabledValues` array and `disabledReason` map.
3. `CardConfigurator.buildCardDescriptors` already computes `currentPeriod`; add a `loopType` pass-through to the PeriodCard props.
4. Visual treatment for disabled: reduced opacity (40%), `cursor: not-allowed`, native `title` attribute + an aria-describedby region for screen readers. No focus trap — user can still tab past it.
5. Clicking a disabled option is a no-op (don't fire `onToggle`).

**Tests:**
- Unit test (`tests/unit/features/create/generate/card-configurator.test.ts`): verify that when `loopType === MIRRORED`, the PeriodCard descriptor's `disabledValues` includes `4` and excludes `2`.
- Visual/interaction test deferred — manual verification in dev server (see §Verification below).

**Verification:**
- `npm run check` clean.
- Targeted unit tests pass.
- Manual: curl `localhost:5173/create`, load the generator, select mirrored + loop enabled, confirm period 4 button shows disabled with tooltip text "Quartered requires a rotation component." When type switches to rotated, period 4 re-enables.

---

## Phase C — Runtime viability check at generation

**Goal:** defense-in-depth. Even if a bad combo slips through the UI (from a URL param, a favorite, a preset restore), the generator rejects it with a clear error rather than silently downgrading.

**Files:**
- `src/lib/features/create/generate/state/generate-actions.svelte.ts` — add pre-flight viability check before generator dispatch
- `src/lib/features/create/generate/components/cards/GenerateButtonCard.svelte` — display the `LoopViabilityError` inline below the button
- `src/lib/features/create/generate/state/generate-actions.svelte.ts` — expose `generationError` state for the UI

**Approach:**

1. In `onGenerateClicked`, before calling the generator:
   ```ts
   if (config.loopEnabled) {
     const check = loopViabilityService.check({
       loopType: config.loopType,
       period: config.period ?? periodFromSliceSize(config.sliceSize),
       level: config.level,
       gridMode: config.gridMode
     });
     if (!check.viable) {
       generationError = new LoopViabilityError(check.reason, check.suggestion);
       return;
     }
   }
   generationError = null;
   ```
2. `GenerateButtonCard` shows `generationError` in a small toast or inline message when non-null. Cleared on next successful generation or config change.
3. Toast copy: `"{reason}. {suggestion}"` formatted.

**Tests:**
- Unit test: `generate-actions` rejects MIRRORED + period 4 with a LoopViabilityError (mock the generator to verify it was never called).
- Unit test: ROTATED + period 4 proceeds to generator.

**Verification:**
- `npm run check` clean.
- Targeted tests pass.
- Manual: force a bad config (e.g. via localStorage poison or URL param) and confirm the error surface appears instead of a silent period-2 output.

---

## Phase D — Drop `sliceSize` from ILOOPExecutor contract

**Goal:** remove the vestigial `sliceSize` parameter from the executor interface and every implementation. The `period` integer is now the only quantity that flows through.

**Files:**
- `src/lib/features/create/generate/circular/services/contracts/ILOOPExecutor.ts` — change signature: `executeLOOP(sequence, period: number)`.
- `src/lib/features/create/generate/circular/services/implementations/*LOOPExecutor.ts` — 15 files. All non-rotated executors get a runtime assert `if (period !== 2) throw new LoopViabilityError(...)`. Rotated executor branches on period 2 vs 4.
- `src/lib/features/create/generate/circular/services/contracts/ILOOPEndPositionSelector.ts` + `IRotatedEndPositionSelector.ts` — similar signature change.
- `src/lib/features/create/generate/circular/services/implementations/LOOPEndPositionSelector.ts` + `RotatedEndPositionSelector.ts` — accept `period` instead of `sliceSize`.
- All call sites — grep for `executeLOOP(` and `sliceSize` in the circular subtree; update to pass `period` directly.

**Approach:**

1. Change the `ILOOPExecutor` interface first. TypeScript will flag every caller.
2. Walk each implementation file and replace:
   ```ts
   executeLOOP(sequence: StepData[], _sliceSize: SliceSize): StepData[] {
   ```
   with:
   ```ts
   executeLOOP(sequence: StepData[], period: number): StepData[] {
     if (period !== 2) {
       throw new LoopViabilityError(
         `${this.constructor.name} supports period 2 only.`
       );
     }
   ```
3. `StrictRotatedLOOPExecutor` keeps its period branch; convert the existing `sliceSize === QUARTERED` checks to `period === 4`.
4. `RotatedEndPositionSelector` same conversion.
5. Remove the helper calls to `periodFromSliceSize` from `CardConfigurator.deriveLoopMinOverride` — just pass `config.period` directly once the config state is migrated.
6. Deprecated-but-functional: `SliceSize` enum stays (Phase 10 left it `@deprecated`). Only the executor signature migrates. A future cleanup pass can delete SliceSize entirely once all migration data is confirmed stable.

**Tests:**
- Existing executor tests keep passing (they already call with a period-equivalent, just under the `sliceSize` name).
- New negative test: `StrictMirroredLOOPExecutor.executeLOOP(validSeq, 4)` throws `LoopViabilityError`.
- New negative test: `RewoundLOOPExecutor.executeLOOP(validSeq, 4)` throws.

**Verification:**
- `npm run check` clean across the whole workspace.
- Full unit suite (`npm test`) passes.
- Manual: generate a period-4 rotated LOOP in the dev server, confirm output actually has period 4 (via `detect_loop_pattern` MCP on the resulting word).

---

## Phase E — Verification sweep (not a real phase, just the gate before calling "done")

- `npm run check` — zero errors.
- `npm test` — all green.
- Manual browser smoke: mirrored + period 4 at L2 → disabled button with tooltip. Mirrored + period 4 forced via URL → error banner. Rotated + period 4 → generates a period-4 sequence. Rotated + period 2 → generates a period-2 sequence.
- All four phase changes committed with the plan file referenced in each commit message.

---

## Rollback notes

If A-C ship but D hits a blocker, the work is still useful: the UI will correctly gate infeasible combos, and runtime will reject them. The executor contract migration can ship independently later. If you need to roll back, revert in reverse phase order: D → C → B → A.
