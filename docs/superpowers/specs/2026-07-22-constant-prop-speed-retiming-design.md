# Constant Prop Speed Retiming Design

**Status:** Paused. Current implementation is not product-correct.

**Date:** 2026-07-22

**Sequence that exposed the idea:** `WAA5`

**Sequence ID:** `fd735514-1798-4630-8d32-591941ce08be`

## Product sentence

Retiming changes the shared duration of each pictograph so both props can rotate at one continuous rate across the sequence, but only when the two prop motions are compatible with the same beat lengths.

## The correction that governs this feature

Duration belongs to the pictograph, not to Blue or Red.

A pictograph has one duration value. That value controls the time available to both props. The feature therefore cannot offer separate Blue, Red, Left, or Right targets. Choosing one prop and deriving the shared beat lengths from it may make that prop constant, but it also changes the other prop's speed without controlling the result. That is not the product described here.

The current hand selector is wrong for this feature and must be removed.

The first supported version is intentionally strict:

- The command always evaluates both props.
- Blue and Red must have the same additional turn count within every pictograph.
- The solver must also compare the actual signed staff rotation produced by each motion. Equal stored turn counts are not enough by themselves because turns are additional rotation on top of the motion's base rotation.
- Every accepted beat must give both props compatible nonzero rotation under one shared duration.
- Do not broaden the feature to unequal but proportional prop rates without a later product decision.

## Why raw turn equality is not the whole calculation

The Flow Arts MCP domain reference confirms that one TKA turn is 180 degrees of additional rotation. Shift motions also contain an inherent base rotation. A 0-turn shift still rotates, while a 0-turn dash or static may not.

The solver must use the same effective staff rotation delta as the animator. It may use the stored `turns` value as a product eligibility gate, but it cannot calculate speed from `turns` alone.

For pictograph `i`:

```text
blue speed magnitude = abs(blue rotation delta i) / shared duration i
red speed magnitude  = abs(red rotation delta i)  / shared duration i
```

There is only one `shared duration i`.

For the strict first version, an accepted pictograph must satisfy:

```text
blue turns i == red turns i
abs(blue rotation delta i) == abs(red rotation delta i)
```

Each prop must also keep its own rotation direction across the whole sequence. Blue and Red may rotate in opposite directions from one another if each direction stays stable and their speed magnitudes remain equal.

The wider mathematical case, where the two rotation series remain in a constant ratio but do not match, is out of scope. The current service partially supports that case. Do not preserve it accidentally while removing the hand selector.

## The WAA5 seed sequence

The supplied sequence is:

```text
# A
id: fd735514-1798-4630-8d32-591941ce08be
owner: PBp3GSBO6igCKPwJyLZNmVEmamI3
4 beats | difficulty: ? | loop: none | grid: diamond

1 A alpha5>alpha7
  blue: pro cw n>e t=2 in>in hand:cw
  red:  pro cw s>w t=2 in>in hand:cw
2 A alpha7>alpha1
  blue: pro cw e>s t=0 in>in hand:cw
  red:  pro cw w>n t=0 in>in hand:cw
3 A alpha1>alpha3
  blue: pro cw s>w t=2 in>in hand:cw
  red:  pro cw n>e t=2 in>in hand:cw
4 A alpha3>alpha5
  blue: pro cw w>n t=0 in>in hand:cw
  red:  pro cw e>s t=0 in>in hand:cw
```

The formatted copy omitted duration at the time of the report. The supplied screenshot shows `2×` on beats 1 and 3 and the default duration on beats 2 and 4. The observed timing pattern is therefore:

```text
[2, 1, 2, 1]
```

The current solver test expects:

```text
[5, 1, 5, 1]
```

That expectation comes from calculated staff deltas of 450 degrees and 90 degrees. This conflicts with the user's observed `2×` result. Do not settle the discrepancy by trusting either the current unit test or a visual impression alone.

WAA5 is the required end-to-end fixture. The next implementation must sample the actual animation path over time and answer:

1. What angular distance does the production animator execute on each beat?
2. Does `duration: 2` produce the observed constant rate?
3. Does the animator apply effort easing to staff rotation, making only the average per-beat rate constant?
4. Is the current endpoint calculation the same calculation used by every viewer and preview path?

Until those answers agree, the UI must not show an `Exact` badge.

## Meaning of "constant"

Retiming alone can equalize average angular velocity across pictographs. It cannot guarantee constant instantaneous angular velocity inside each pictograph when staff rotation is passed through nonlinear effort easing.

The shipped wording must follow the behavior:

- Use `Constant prop speed` and `Exact` only if staff angle is linear in time and runtime sampling proves the rate is constant.
- Otherwise use `Even prop speed` and describe the result as equal average rotation per beat.

Hand-path easing may remain expressive, but staff-rotation easing must be understood before the stronger claim ships.

## Current implementation inventory

### Implemented in commit `573f4fde9e`

- [`constant-prop-speed.ts`](../../../src/lib/features/create/shared/services/constant-prop-speed.ts) calculates effective rotation deltas and duration ratios.
- [`DurationPatternView.svelte`](../../../src/lib/features/create/shared/components/sequence-actions/DurationPatternView.svelte) presents analysis, a per-beat rate summary, preview loading, and apply.
- [`DurationPreviewWorkspace.svelte`](../../../src/lib/features/create/shared/components/sequence-actions/DurationPreviewWorkspace.svelte) previews a duration-aware animation and a duration-proportional timeline.
- The sequence actions panel enters duration preview mode, supports an undo snapshot, and applies the updated sequence through the active sequence state.
- Duration controls and sequence-grid duration indicators were added.

These pieces are useful scaffolding, but the constant-speed product is not complete.

### Implemented in commit `c10b60fa48`

- [`claude-code-copier.ts`](../../../src/lib/shared/browse/services/claude-code-copier.ts) now emits `d=beats` for every pictograph.
- [`ClaudeCodeCopier.test.ts`](../../../tests/unit/services/ClaudeCodeCopier.test.ts) verifies integer and fractional durations in copied sequence text.
- [`constant-prop-speed.test.ts`](../../../tests/unit/services/constant-prop-speed.test.ts) covers the current solver.

The copy-format change is valid and should remain.

One constant-speed test is product-invalid. It deliberately creates unequal Blue and Red turn patterns, rejects `Both`, then expects `Blue` alone to succeed. That test must be replaced. Its passing state documents the bug rather than proving the feature.

### Existing duration model

- [`StepData`](../../../src/lib/shared/foundation/domain/models/step-data.ts) has one `duration` value.
- [`duration-pattern-data.ts`](../../../src/lib/features/create/shared/domain/models/duration-pattern-data.ts) states that both hands share the step duration.
- [`duration-pattern-manager.ts`](../../../src/lib/features/create/shared/services/duration-pattern-manager.ts) writes one duration to each step.
- [`sequence-decomposer.ts`](../../../src/lib/shared/foundation/services/sequence-decomposer.ts) copies the shared duration into both solo-prop step records.
- [`step-deriver.ts`](../../../src/lib/shared/foundation/services/step-deriver.ts) restores the step duration from Blue, which is currently authoritative.

The data model supports duration. The user's reload report is not proof that choreo cards can never store it.

## What is wrong today

| Area | Current behavior | Required behavior |
| --- | --- | --- |
| Target selection | Accepts `blue`, `red`, or `both` | No prop target. Always evaluate the pair |
| Single-prop analysis | Derives shared durations from one prop and leaves the other unconstrained | Reject the sequence unless both props satisfy the pair contract |
| Both-prop compatibility | Accepts a constant proportional ratio | First version requires matched per-pictograph turns and matched effective rotation magnitudes |
| Success copy | Can show `Exact` from calculated averages | Show `Exact` only after runtime angular-rate proof |
| WAA5 expectation | Unit test expects `[5, 1, 5, 1]` | Resolve against production animation; screenshot reports `[2, 1, 2, 1]` |
| Apply persistence | Updates state, then relies on a 500 ms debounced workspace save | A deliberate Apply must flush persistence before the panel exits |
| Reload confidence | Source model can carry duration, but the reported HMR reload lost it | Prove workspace, full reload, library, and public-load round trips |

## Redesigned interaction

### Entry

Keep the feature inside Duration. It is a way to derive a duration pattern, not a prop transform.

### Card

The card contains:

- Title: `Constant prop speed` only after the runtime definition is proven. Use `Even prop speed` until then.
- One sentence: `Retimes each pictograph so Blue and Red can keep the same rotation rate.`
- No hand selector.
- A compatibility result for the whole sequence.
- A Blue rate label and Red rate label, each with its text label and established color token. Color is reinforcement, not the only identifier.
- A per-beat list showing effective rotation and proposed duration.
- `Preview timing` and `Apply to sequence`.

### Compatible sequence

Show the proposed timing before mutation. Preview uses the normal duration-preview workspace and does not persist.

Do not call the result exact until the runtime verification gate passes.

### Incompatible sequence

Explain the first blocking beat and keep the sequence unchanged.

Example:

> Blue and Red rotate by different amounts on beat 2, so one beat length cannot keep both speeds constant.

Other blocking reasons:

- a prop has no visible motion
- a prop stops rotating
- a prop reverses its rotation direction
- Blue and Red have different turn counts in a pictograph
- effective rotation magnitudes do not match
- an exact duration exceeds the supported range
- animation semantics cannot produce a constant instantaneous rate

Do not fall back to "make Blue constant" or "make Red constant."

## Solver contract

Replace the target-based API with a pair-only analysis:

```ts
type ConstantPropSpeedAnalysis =
  | {
      success: true;
      durations: readonly number[];
      blueDegreesPerDurationUnit: number;
      redDegreesPerDurationUnit: number;
      steps: readonly ConstantPropSpeedStep[];
    }
  | {
      success: false;
      reason:
        | "empty-sequence"
        | "missing-motion"
        | "turn-mismatch"
        | "effective-rotation-mismatch"
        | "zero-spin"
        | "direction-change"
        | "duration-limit"
        | "runtime-model-mismatch";
      affectedSteps: readonly number[];
    };
```

There is no `TargetHand` parameter and no nullable rate for an unselected prop.

### Calculation

1. Read both visible motions for every step.
2. Compare stored Blue and Red turn counts for that step.
3. Calculate signed staff rotation delta through the animator's canonical endpoint calculation.
4. Reject zero rotation.
5. Verify that each prop keeps its direction across the sequence.
6. Verify equal effective rotation magnitude between Blue and Red within every step.
7. Choose a shared target rate and calculate one duration for every step.
8. Normalize so the smallest duration is `1`, unless the canonical duration system establishes a different basis.
9. Reject results outside the supported duration range.
10. Recalculate both rate series from the proposed durations and assert equality within a documented numeric tolerance.
11. Verify the result with the production animation sampler before returning an exact result.

The algorithm changes duration only. It does not alter turns, motion type, rotation direction, orientation, hand path, or letter.

## Persistence contract

### Workspace and HMR

Preview is temporary. Apply is durable.

The current state setter schedules a workspace save after 500 ms. A hot module reload can interrupt that window. A deliberate duration Apply must:

1. update the active sequence
2. immediately flush the active create-mode state to its existing local-storage key
3. await confirmation that the serialized sequence contains the new duration values
4. then exit preview mode

The general beat-edit debounce may remain. This explicit action should not depend on it.

### Library and Firestore

Library save must decompose the shared duration into both solo-prop records. Hydration may continue to treat Blue as authoritative only while a round-trip invariant guarantees the two stored values match.

Required invariant:

```text
blueSoloProp.steps[i].duration
  == redSoloProp.steps[i].duration
  == hydratedSequence.steps[i].duration
```

If the stored solo-prop durations disagree, loading should report or repair the mismatch through one documented policy. Silent disagreement is not acceptable.

### Existing cards

Do not run a backend migration that invents timing.

- A missing duration means the legacy default of `1`.
- If a legacy document still contains a trustworthy duration in an older `steps` payload while its compositional fields lack it, add a tested compatibility backfill.
- If no stored source contains a nondefault duration, it cannot be reconstructed from the pictographs alone.

Before changing Firestore data, query representative old and new cards and record which fields actually exist.

## Copy and interchange format

Every copied sequence step must include duration, including the default:

```text
step = number [letter] [position>position] d=beats [rev:BR]
```

WAA5 should copy with explicit timing once its expected values are resolved:

```text
1 A alpha5>alpha7 d=?
2 A alpha7>alpha1 d=1
3 A alpha1>alpha3 d=?
4 A alpha3>alpha5 d=1
```

The nondefault values stay `?` in this design because the screenshot and current solver disagree. The implementation must replace them with a runtime-proven result.

## Verification plan

### Pure tests

- The public analyzer API has no Blue, Red, Left, Right, or `TargetHand` mode.
- A sequence with Blue and Red turns `[1, 2]` and `[1, 1]` is rejected.
- A sequence with equal raw turns but unequal effective rotation is rejected.
- A prop reversal is rejected with the correct beat numbers.
- A zero-rotation beat is rejected.
- Every accepted result has one duration per pictograph.
- Every accepted result keeps both calculated rate series constant within tolerance.
- Every accepted result keeps Blue and Red speed magnitudes equal within tolerance.
- Duration limits fail without mutating the sequence.
- Applying a duration pattern changes no motion fields.
- Copy output includes `d=` for integer, fractional, and default durations.
- Decompose and hydrate preserve the same duration on both solo-prop records.

### WAA5 runtime test

Build the exact four-step fixture from canonical domain data. For each candidate duration pattern:

1. sample staff angle at a fixed high rate through the production animation path
2. unwrap angles across full rotations
3. calculate angular velocity between samples
4. compare Blue and Red
5. compare the two-turn and zero-turn beats
6. run with the actual effort preset used by Sequence Viewer

The accepted timing is the one that matches the user's observation and the sampled production behavior. If neither `[2, 1, 2, 1]` nor `[5, 1, 5, 1]` is constant, the model or the claim must change before UI work resumes.

### Persistence tests

- Apply WAA5 timing and inspect the active Assemble local-storage record.
- Trigger the state restoration path and verify all four durations.
- Perform a full page reload and verify all four durations.
- Save to the library, reload from Dexie, and verify all four durations.
- Complete Firestore save and hydration, then verify the invariant across Blue, Red, and derived steps.
- Load a legacy fixture with no duration and confirm the default is `1`.
- Load a legacy fixture with duration only in the old `steps` payload and verify the chosen compatibility policy.

### Browser proof

Interactive browser verification requires explicit permission in the active conversation.

After permission:

- Open the exact WAA5 route.
- Confirm there is no prop selector in the constant-speed card.
- Preview, apply, and reload.
- Record the displayed duration values before and after reload.
- Capture the relevant local-storage payload and console state.
- Compare the animation before and after retiming at slow playback speed.

## Acceptance gates

The feature is complete only when all of these are true:

- The UI cannot imply that constant speed applies to one prop independently.
- The analyzer has no single-prop mode.
- Every applied duration is visibly and structurally shared by both props.
- Incompatible sequences explain why no shared timing exists.
- WAA5 has one runtime-proven expected timing pattern.
- The `Exact` label matches measured production animation behavior.
- Copied sequence text includes every duration.
- Deliberate Apply survives HMR and full reload.
- Library and Firestore round trips preserve duration.
- Legacy cards default safely without invented data.
- The invalid single-hand test has been removed or rewritten.
- Focused tests and runtime proof pass in the same completion report.

## Implementation order

1. Freeze the current single-prop behavior as known incorrect in issue or feedback tracking.
2. Add the production-animation WAA5 sampling test and resolve `2×` versus `5×`.
3. Replace the target-based service contract with pair-only analysis.
4. Remove the hand selector and all single-prop success copy.
5. Rewrite the invalid test before adding new success cases.
6. Add immediate persistence flush for deliberate Apply.
7. Add workspace, Dexie, Firestore, hydration, and legacy fixtures.
8. Verify the interaction in the real Sequence Viewer after explicit browser permission.

Do not start with cosmetic changes. The runtime timing result and pair-only contract determine the UI.

## Research record

- [MoveIt time parameterization](https://moveit.picknik.ai/main/doc/examples/time_parameterization/time_parameterization_tutorial.html) treats timing as post-processing applied to an existing multi-joint path under shared trajectory constraints. This feature should follow the same conceptual boundary: preserve pictograph geometry and solve timing jointly.
- [Ruckig: Jerk-limited Real-time Trajectory Generation with Arbitrary Target States](https://arxiv.org/abs/2105.04830) describes complete time synchronization across multiple degrees of freedom. The relevant lesson here is that synchronized channels share a timeline; one channel's timing cannot be changed without affecting the others.
- The Flow Arts MCP `base-rotation` reference was queried on 2026-07-22. It confirms that turn count is additional rotation and that shift motions have inherent base rotation.

## Out of scope

- Per-prop duration data
- Changing turn counts to force compatibility
- Automatically changing motion types or rotation directions
- A best-fit approximation that silently varies one prop's rate
- Retrofitting guessed timing onto old cards
- General unequal proportional rates
- Acceleration, jerk, or biomechanical optimization
