# Type 6 Static Steps Under an Explicit Turn Pattern

**Date:** 2026-08-16
**Status:** Awaiting approval

## Why

Type 6 letters (α, β, γ) are static: neither hand moves. MCP's canon —
`list_letters_by_type(6)` — describes them as *"Both hands remain stationary. The
props may still rotate... Focus is entirely on prop rotation"* and *"Good for
'breathing space' in sequences."* Prop rotation is the whole point of the type. A
zero-turn Type 6 is its degenerate case, not its normal one.

The generator can never produce one mid-sequence. Type 6 appears only as a starting
position. That exclusion was reasonable as a default — a randomly-chosen static step
with no turns reads as standing still — but it is applied as a blanket rule, so it
also fires in the one case where a static step is exactly what was asked for: when a
user has set an explicit turn pattern (or layer-signature target) and a step carries
turns. There, the static letter is the carrier of the figure, and refusing it makes
the pattern unrepresentable.

The engine already represents static-with-turns end to end — orientation math handles
it (`OrientationCalculator.ts:191`), `TurnMaterializer` resolves direction at non-zero
turns, and BeamSearch already enriches static motions with allocated turns
(`BeamSearch.ts:351`). No legality gate anywhere rejects it. A sequence that already
contains one round-trips today. Only generation cannot produce it.

## What is actually broken

The policy this spec wants is **already written**. `Type6Constraint.ts:36-53` reads:
reject at L1; at L2+ allow **when at least one hand has turns > 0**. That is the rule,
in code, with the reasoning in its docblock.

It cannot run. Four independent gates are closed, and the last two mean the constraint
would reject everything even if the first two opened:

| # | Gate | Where | Effect |
| --- | --- | --- | --- |
| 1 | `nonType6` pool pre-filter | `BeamSearch.ts:451`, consumed at `:596` | Every Type 6 variation is stripped from the candidate pool before scoring |
| 2 | `nonType6ForReachability` | `SequenceBuilder.ts:863` | Same exclusion in the reachability precompute, so Type 6 paths are pruned before the beam runs |
| 3 | `context.level` never populated | all 8 scoring sites | `level ?? 1` → "Type 6 not allowed at L1", at every level |
| 4 | `context.turnAllocation` never populated | all 8 scoring sites | `!turns` → "Type 6 requires turns > 0", on every candidate |

Gates 3 and 4 are not a single omission. BeamSearch calls
`scoreAndRankVariations` at eight sites — `:238` and `:338` (word-driven), `:525`
and `:637` (free generation), `:752`, `:783`, `:831`, `:871` (bridge insertion) —
and every one of them builds its context inline as
`{ stepIndex, totalSteps, previousSteps, letter }`. None passes either field.
`level` is worse than unpassed: the string does not occur anywhere in
`BeamSearch.ts`, so it is not available to pass.

`ConstraintContext` declares both `level?` and `turnAllocation?`
(`constraints/types.ts:45-48`). BeamSearch builds its context as
`{ stepIndex, totalSteps, previousSteps, letter }` and passes neither. So
`Type6Constraint`'s only reachable branch has always been `"Not Type 6"`; its
allow-branch is dead code that has never executed.

The `turnPattern` docblock is aspirational for the same reason.
`SequenceBuilder.ts:234` promises *"a zeroed step will not be given a static letter
that needs turns to be worth anything"* — describing a discrimination that cannot
happen, because no static letter is ever offered and the allocation the sentence turns
on never reaches the constraint.

**The turns are available.** Both turn sources are pure functions of step index:
`patternSource.at(i, color)` indexes modulo its period, `allocationSource.at(i, color)`
indexes a fixed array decided up front (`TurnSource.ts:31-49`). Either can be consulted
*before* scoring. Today they are consulted only after, by `enrichWithTurns`
(`BeamSearch.ts:345`), which is why the ordering looks like "choose letter, then
allocate turns" when it does not have to be.

## The change

Keep `Type6Constraint` exactly as written. It is correct. Give it the inputs it needs
and stop pre-filtering its subjects.

**1. Populate the constraint context — through one helper, not eight edits.** Add a
private method on BeamSearch that builds the scoring context, and route all eight call
sites through it. Editing eight inline object literals invites the ninth to be written
without the fields; a single constructor makes that impossible.

The helper reads `turnSource.at(stepIndex, "blue" | "red")` and adds `level` and
`turnAllocation` to the existing four fields. A `"fl"` (float) is a rotation, so it
maps to a positive number for the `> 0` test. `turnAllocation` has no other consumer
in the engine — a grep finds it declared in `constraints/types.ts` and read only by
`Type6Constraint` — so populating it cannot disturb another constraint.

`level` must be threaded in first: it does not currently exist anywhere in
`BeamSearch.ts`. It travels from `BuildOptions` through `SequenceBuilder` into the
BeamSearch config alongside `beamWidth`.

Where the source returns `undefined` (a bridge step past a fixed allocation's length),
the step reads as no-turns and Type 6 is correctly refused there — which is the right
answer for a bridge, since nothing asked for a static one.

**2. Gate the two pool filters** on a new `allowStaticSteps` option, threaded from
`BuildOptions` into BeamSearch and into the reachability precompute. Both filters must
share the gate: opening one without the other lets the beam consider Type 6 candidates
that reachability has already pruned the paths to.

**3. Default it to explicit intent.**

```ts
allowStaticSteps ?? Boolean(options.turnPattern || options.layerSignature)
```

Undirected generation keeps today's behaviour byte for byte. Pattern-driven and
layer-targeted generation admit static steps, where `Type6Constraint` then does the
per-step work it was written for.

### Why gated rather than always-on

Always-on is mechanically feasible — `allocationSource` is step-indexable too, so
random generation could feed the constraint just as well. The objection is taste, not
capability. At L2+ random allocation puts turns > 0 on most steps, so
`Type6Constraint` would admit α/β/γ nearly everywhere and ordinary generated sequences
would fill with static steps. That is the "boring" failure inverted, not fixed. Gating
on explicit intent draws the line where the user has actually asked for a specific
figure.

`allowStaticSteps` is an explicit boolean precisely so this call is reversible without
touching the mechanism: pass `true` to see the always-on behaviour, `false` to refuse
statics even under a pattern.

### Out of scope: `constrained-builder.ts`

`constrained-builder.ts` is the pre-refactor original — `BeamSearch.ts:8` records that
BeamSearch was *"Refactored from constrained-builder.ts into a class."* It carries its
own hardcoded `TYPE_6_LETTERS = ["α", "β", "γ"]` (`:40`) and its own six scoring sites.
`SequenceBuilder` does not use it; it survives as an export from
`generation/index.ts:128`.

Leave it alone. It is a second path with its own gates, and changing both at once
doubles the surface while only one of them is reachable from the app. If it turns out
to have live callers outside this package, that is a separate decision about retiring
it, not a reason to widen this change.

## The letter set

Two docblocks — `LetterClassifier.ts:10` and `Type6Constraint.ts:4` — say Type 6 is
"α, β, γ, ζ, η, τ, ⊕", and `LetterClassifier.ts:44` classifies all seven.

Canonical source is `packages/domain/src/constants/letter-registry.ts:27`:
`type6: { letters: ["α", "β", "γ"] }`, out of 47 letters total. MCP agrees. The
alphabet has three Type 6 letters.

The extra four are not canon. They are the synthesized position-statics that
`BeamSearch.staticLetterForPosition` (`:950-958`) fabricates for zeta / eta / tau /
terra positions when the variation pool holds no real static there. Classifying them
as Type 6 is defensible — it makes `isType6` cover what the generator can itself
emit — so **do not change the classifier**. Correct the two docblocks to say which
three letters are canonical and why the other four are listed, so the next reader does
not take a synthesis fallback for alphabet canon.

Practically: opening the gate admits α, β, γ. The other four never appear in
`getAllVariations`, which is why they have to be synthesized in the first place.

## Testing

Unit, on the engine:

- `Type6Constraint` reached with `{ level: 3, turnAllocation: { blue: 1, red: 0 } }`
  returns satisfied — the allow-branch executing for the first time.
- Same constraint at `level: 1`, and at `level: 3` with `{ blue: 0, red: 0 }`, still
  rejects.
- A build with `turnPattern` whose lanes put turns on every step produces at least one
  Type 6 step across a seeded run, and every Type 6 step it produces carries turns > 0
  on at least one hand.
- A build with no `turnPattern` produces zero Type 6 steps — the regression guard on
  undirected generation being unchanged.
- `allowStaticSteps: false` alongside a `turnPattern` produces zero Type 6 steps.
- A Type 6 step's `startPosition === endPosition`, so the sequence's position walk is
  unchanged across it.

Existing suites must stay green, in particular the beam-search and reachability tests
and `turn-pattern-level`.

No visual verification: this is engine-only and ships no UI. The
`TurnPatternSection` copy written in the turn-pattern redesign — *"The generator only
picks letters that can carry the figure"* — stays true and becomes more true.

## Relationship to the turn-pattern redesign

Independent and compatible. `docs/superpowers/plans/2026-08-16-turn-pattern-redesign.md`
is UI only and touches no engine file; this spec is engine only and touches no
component. Either can ship first. Together they close the loop: that plan lets a user
express a figure, this one lets the generator carry it.

## Open questions

None. The scoping call (gated on explicit intent, via an overridable
`allowStaticSteps`) is made above and is the one decision worth revisiting if the
always-on behaviour turns out to read better in practice.
