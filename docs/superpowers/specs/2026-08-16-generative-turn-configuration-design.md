# Generative Turn Configuration

Date: 2026-08-16
Status: design, awaiting review

## The gap

Turn authoring exists only after generation. The Actions panel carries a full
two lane turn pattern editor (`TurnPatternView` over `PatternStripEditor`) with
values `[0, 0.5, 1, 1.5, 2, 2.5, 3, "fl"]` and the shared rhythm catalog. The
Generate panel offers a single scalar: `TurnIntensityCard`, a stepper for max
intensity.

So a whole capability surface is reachable for a sequence you already have and
unreachable for one you are about to make. You cannot say what turn pattern you
want, and therefore cannot say what layer pattern you want, before generating.

Austen, 2026-08-15:

> There's a whole turn capability surface available in Actions that is not
> available as a generative tool. We don't have any access to specify more about
> what turn pattern we wanna apply and therefore what layer pattern will be the
> result of that from before we click generation.

## Two facts this design rests on

**Turns are orthogonal to letters.** The layer signature depends only on the
flip vector and the start layer. Never on letters, positions, or hand paths.
Every motion can take any turn value its level allows. This is the result
established by the layer signature work (`layer-signature.ts`,
`layer-targeting.ts`) and it means a requested turn pattern never has to fight
the letter search for feasibility.

**A period has no length.** The strip the user draws is a period, not a fixed
array. `stripToTurnPattern` already tiles it with `tilePeriod`. Consumed by
index modulo its period, a pattern has a defined value at every step index that
will ever exist, including bridge steps inserted during search.

## Decisions

| Question | Decision |
| --- | --- |
| Card shape | One card, two modes. Intensity by default, Pattern on switch. |
| Layer surface | Live derived readout under the strip. No layer authoring control. |
| LOOP period | Strip periods restrict to divisors of the LOOP period. |
| Level 1 | No Turns card at all, unchanged from today. |
| Where the pattern lands | Into `BuildOptions`, consulted during the beam search. |

## Architecture

The pattern goes into the build, not onto the result.

### Why not stamp after the build

The obvious cheap approach is to generate as today and then apply the tiled
pattern to the finished sequence with `applyPattern`, the same firebase free
path Actions uses. It propagates orientations correctly and needs no engine
change.

It is wrong, and `Type6Constraint` shows why. Type 6 letters are the static
family, lowercase Greek alpha, beta, gamma: both hands stationary, props still
rotating. At level 2 and above the constraint admits them only when a hand has
turns above zero, because a Type 6 step with zero turns is a step where nothing
happens at all. The beam search picks gamma for a step *because* it expects
turns there. Stamping zero onto that step afterward falsifies the premise the
letter was chosen on, leaving a choice between shipping a dead step and refusing
the user's pattern. Both are bad and neither is the user's fault.

The constraint is not the obstacle. Stamping after the build is.

### Where it goes instead

`BuildOptions` gains a turn pattern. The beam search already consults turns per
step at `BeamSearch.ts:65`, applying `turnAllocation.blue[stepIndex]` to each
variation before scoring, and the constraint context already carries
`turnAllocation` per candidate (`constraints/types.ts:48`). The search therefore
already knows the turns when it chooses a letter. Feeding it the pattern instead
of a random allocation means it simply never offers alpha, beta, or gamma at an
index the pattern zeroes. No warning, no dead step, no compromise: the user gets
the exact pattern and a valid sequence.

### The bridge blocker, and why this routes around it

Turn allocation is eager and length bound. The word path calls
`allocateTurns(letters.length, ...)` at `SequenceBuilder.ts:578`, but the search
inserts bridge steps between letters with no direct transition, so the sequence
runs longer than the word. Consumption then guards on length at
`SequenceBuilder.ts:1288`:

```ts
stepTurnIndex >= 0 && stepTurnIndex < turnAllocation.blue.length
  ? turnAllocation.blue[stepTurnIndex]
  : undefined
```

Past the letter count that guard falls through and trailing steps get no turns.
This is the open blocker on layer targeting for bridged words.

A pattern consumed as `pattern.blue[stepIndex % period]` cannot fall through.
Every index resolves, bridges included. Pattern driven generation does not
inherit the blocker.

This also names the eventual fix for the random path (allocate lazily by index
rather than eagerly by count) but that stays out of scope here.

### The isolation preset

The `isolation` constraint preset pins `turns: 0`
(`preset-constraints.ts:59`). It is itself a turn specification, so it and
Pattern mode are mutually exclusive. Pattern mode is disabled while isolation is
selected, and the card says why.

## The Turns card

`TurnIntensityCard` becomes `TurnsCard` with two modes.

**Intensity**, the default, is today's stepper unchanged. Pick a max, get random
turns.

**Pattern** renders the existing `PatternStripEditor` with the same
`StripBinding` `TurnPatternView` uses: two lanes, blue and red,
`PER_HAND_RHYTHMS`, `laneColors: ["blue", "red"]`. Not a new editor. The same
one. Building a second would violate `never-hand-roll.md`, and the editor
already solves lanes, rhythms, periods, and amounts.

The strip's value palette comes from `getTurnPool(level, maxTurnIntensity)`, the
single owner of what turns exist at a level. Illegal values cannot be drawn.
Dropping from level 3 to level 2 rounds existing half turns to the nearest whole
using the same `nearest()` rule `retargetMotionFlip` applies.

Level 1 shows no Turns card, unchanged from today. There are no turns to
configure.

Level 2 keeps both modes. Whole turns are real turns and a rhythm over them is
worth authoring, even though no arrangement of whole turns can change a layer.
Only the readout is withheld there, not the strip.

## The layer readout

Under the strip, the layer signature the current settings will produce, updating
live as the strip is edited.

It is fully determined before generation. The signature is the start layer plus
the flip vector, and nothing else:

- Start layer comes from the start orientations. Both radial gives layer 1, both
  non radial gives 2, split gives 3 or 4.
- The flip vector comes from the strip. A prop crosses on a half turn and holds
  on a whole one.

One honest exception: a float crosses only on a cw or ccw hand path, which is
letter dependent. Floats render as uncertain for that step rather than guessing.

The readout is hidden at levels 1 and 2. Below level 3 there are no half turns
and only radial start orientations are selectable, so the signature is always
`111...1` and carries no information. The level gate on orientations and the
level gate on turns are the same gate.

## LOOP

When a LOOP is active, selectable strip periods restrict to divisors of the LOOP
period, so turns repeat in lockstep with the shape rather than drifting against
it.

One consequence to surface: if total crossings per prop come out odd, the layers
do not return home on the repeat. `enforceHandFlipParity` already exists to
detect and report this.

## Folded in: start orientation

Start orientation already exists and is not missing. `CustomizeExpandedOverlay`
edits `blueStartOrientation` and `redStartOrientation`, gated by
`startOrientationsForLevel` (`level-orientation-policy.ts:21`): in and out below
level 3, plus clock and counter at level 3. It has prior bug fixes recorded
against it.

It is folded into this spec because the layer readout is meaningless if the
control that sets the start layer is buried and unusable. Two faults:

**Wrong control.** `PropOrientationControl` is a stepper. For two options at
level 2 or four at level 3 a stepper hides the alternatives, spends three hit
targets to display one value, and makes the user click blind to discover what
exists. `chip-primitives.md` names this case, mutually exclusive with exactly
one active, as `SegmentedControl`, and documents `tone: "blue" | "red"` for prop
identity specifically. Replace the stepper with `SegmentedControl`.

**Wrong container.** Start orientation is a form roughly 150px tall that
receives a full height drill panel, because it is one of four peer rows in
`SettingsDrillPanel` alongside two position grids that genuinely need the space.

Stretching the form to fill is explicitly ruled out. From
`CustomizeExpandedOverlay.svelte:470`:

> Spreading these across a full-height pane was tried and reverted: at 1315px
> the three Style axes ended up 275px apart and stopped reading as one group. A
> form's rows belong together; the leftover height is the panel's problem, not
> theirs.

That conclusion stands. The fix is to stop granting the height, not to fill it.

**The fix.** Fold start orientation into the Start Position drill, beneath the
grid. `MultiSelectPositionPicker` already receives `blueStartOrientation` and
`redStartOrientation` to draw the props
(`CustomizeExpandedOverlay.svelte:372`). It is already rendering the thing this
control sets, so putting them together means the props reorient live as the
choice is made. This removes a drill row, removes the near empty panel, and
improves both controls.

Ripple: `PropOrientationControl` is also consumed by `StartPositionEditMode` and
has a component test at `PropOrientationControl.svelte.test.ts`. All three move
together.

## Testing

Unit:

- A pattern resolves at every step index of a bridged word, where random
  allocation currently yields `undefined`.
- Strip palette matches `getTurnPool` at each level.
- Level 3 to level 2 rounds half turns to whole.
- The predicted layer readout equals the signature the builder actually
  produces, asserted through the generate path. This carries the letter
  independence claim into the app.
- A pattern that zeroes an index causes the search to avoid Type 6 letters at
  that index rather than producing a dead step.
- LOOP period restriction admits only divisors.

Component: the segmented start orientation control, per
`component-test-discipline.md`, since this is a fix to an interactive control
that already carries a test.

Visual: the Turns card in both modes and the reworked Start Position drill,
across the seven viewports in `visual-verification-mandatory.md`. Both are
changes to size, count, and structure, so the rule fires.

## Out of scope

- Saved and named turn patterns in Generate. The existing `PresetCard` captures
  whole generation settings and would pick the strip up without extra work.
- Direct layer pattern authoring. The engine supports it via
  `targetLayerPattern`, which currently has no consumer anywhere in `src/`, but
  two inputs writing the same underlying thing is not worth the surface yet.
- Fixing eager random turn allocation for bridged words. Named above, still its
  own task.
- Deliberate rest or hold steps. If a zero turn Type 6 is ever wanted as a
  breathing beat, that is a rest feature, not a turn pattern concern.

## Risk

Fuse also passes `maxTurnIntensity` into the engine and will inherit the new
`BuildOptions` field whether or not it exposes a strip. It should default to
absent and behave exactly as today.
