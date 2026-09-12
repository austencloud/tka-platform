# Mirrored hands in Generate

Date: 2026-09-12
Status: draft, awaiting Austen's review and Kristen's answers (see Open questions)
Feedback: `f2SKgV5rqEMJoHhTGggD` (create / generate), submitted by ssnss
(Krysten and Ryan), transcribed by Austen

## Problem

Kristen wants Generate to produce sequences where the left hand traces the
mirror image of the right hand on every step, so the two trails form one
bilaterally symmetric mandala. Generate picks whole pictographs and scores
them on prop continuity, hand-path continuity, and dash preference. Nothing
constrains how the two hands relate to each other inside a step, so the only
way to get a mirrored sequence today is to build it by hand in Construct.

The word "Mirrored" already exists in Generate as a LOOP type, where step
N+k reflects step N later in time. That is a different relationship (between
steps) from the one Kristen wants (between hands, inside one step). The two
compose but must not share a control or a label.

## Decision

Add a **Symmetry** setting to Generate's Customize drawer. It is a hard,
per-step constraint on the relationship between the left and right motions,
enforced inside the engine's existing beam search by one new constraint plus
a linked turn allocation. Launch exposes two values, Off and Mirrored, with an
Inverted modifier. Saved Setups carry it automatically, which covers "save
that as a preset".

The engine side is written against a location map, not a letter list, so the
grid-mode dependency (D/E/J/K in diamond, M/N/P/Q in box) is emergent and
later relationships (unison, opposite, top/bottom flip) are one-line
additions. Only the vertical-axis mirror is reachable from the UI at launch.

## Semantics

"Mirrored" holds for a step when the left motion is the reflection of the
right motion across the north-south (vertical) axis:

| Field                 | Mirrored                          | Mirrored + Inverted    |
| --------------------- | --------------------------------- | ---------------------- |
| start / end locations | left = reflect-N-S(right)         | same                   |
| motion type           | equal                             | pro and anti swapped   |
| turns                 | equal, including float            | equal, including float |
| rotation direction    | opposite (follows from the above) | same (follows)         |

Reflection across N-S: e and w swap, ne and nw swap, se and sw swap, n and s
stay. This is `REFLECTION_LOCATION_MAPS["north-south"]`, already used by the
mirrored LOOP executor. Rotation direction is implied by locations plus
motion type for shifts, so it is checked as an assertion, not a second rule.
Dash and static steps qualify when both hands dash or both stay; at zero
turns their direction is `noRotation` on both sides.

Orientation follows the same reflection: in and out map to themselves, clock
and counter swap. With equal turns and reflected paths, both hands stay in
the same radial or nonradial class, so the pair never lands in layer 3.

### What the dataframes say

Counted directly from `static/data/pictographs/*PictographDataframe.csv`
(576 rows each):

| Grid    | Mirrored rows | Letters           | Eligible start positions |
| ------- | ------------- | ----------------- | ------------------------ |
| Diamond | 24            | D E J K Φ- Ψ- α β | α3, α7, β1, β5           |
| Box     | 24            | M N P Q Λ- γ      | γ2, γ6, γ12, γ16         |

Mirrored + Inverted adds F and L in diamond (16 rows) and O and R in box.
The same census gives the neighbours for later: unison (identity map) is
G/H with I inverted, opposite (rotate 180) is A/B with C inverted, in both
grids. This matches the 6-element framing: diamond D/J are Air/Fire, box
M/P are the ones that mirror.

In diamond the mirrored vocabulary alternates alpha at the sides (hands at
E and W) with beta at top or bottom. Gamma is never mirror-symmetric in
diamond, and alpha and beta are never mirror-symmetric in box. Classic 3
(α1, β5, γ11) leaves only β5 as a usable start in diamond.

## Engine

`packages/sequence-engine/src/generation`

- `ConstraintOptions.handRelationship?: { transform: HandTransform; inverted?: boolean }`
  where `HandTransform` names a location map. Launch value from the app is
  `{ transform: "reflect-north-south" }` or the same with `inverted: true`.
  The map table lives next to `pair-relation.ts`, which already holds the
  rotation maps; export them instead of copying.
- New `HandRelationshipConstraint` (hard, `IVariationConstraint`) in
  `constraints/style/hand-relationship-constraint.ts`. `evaluate` checks the
  table above against `candidate.leftMotion` and `candidate.rightMotion`.
  `couldSatisfy` is the same predicate, so the reachability pre-filter in
  `buildByLength` and the first-step scoring in `BeamSearch` exclude every
  non-symmetric position without new start-selection code. A test proves
  it: N seeded builds in diamond all start at α3, α7, β1 or β5.
- `buildConstraintSet` pushes the constraint when `handRelationship` is set.
- `TurnAllocationOptions.linkHands?: boolean`. When set, `allocateTurns`
  rolls the right lane and copies it to the left, float included.
  `resolveTurnAllocationOptions` sets it whenever `handRelationship` is
  present. A `turnPattern` with unequal lanes plus `handRelationship` throws
  a named error; Generate never sends `turnPattern` (the persistence
  normalizer strips it), so this only guards MCP and lab callers.
- Dash and static steps with turns get their direction in
  `materializeTurn`, today by continuity or a coin flip. Under a
  relationship the left direction is derived from the materialized right
  direction (opposite for a reflection, same when inverted). Add
  `TurnMaterializationOptions.forcedRotationDirection` and use it for the
  left hand in `SequenceBuilder`'s finalize loop.
- Start orientation: the orchestrator derives `leftStartOrientation` from
  `rightStartOrientation` through the reflection (in and out unchanged,
  clock and counter swapped) whenever a relationship is active, ignoring
  whatever the UI stored for the left hand.

### LOOP compatibility

A relationship is preserved by a LOOP component exactly when the two
transforms commute. For the vertical-axis mirror:

| LOOP component                           | With Mirrored hands |
| ---------------------------------------- | ------------------- |
| rotated 180 (halved)                     | closes              |
| mirrored, axis north-south               | closes              |
| flipped (axis east-west)                 | closes              |
| swapped, inverted, rewound               | close               |
| rotated 90 (quartered rotation)          | cannot close        |
| mirrored, diagonal axis (NE-SW or NW-SE) | cannot close        |

"Cannot close" is structural: the seed would have to end at a position that
is not mirror-symmetric, and the hard constraint forbids every step that
lands there. `checkLoopViability` gains `handRelationship` in its args and
returns a reason plus suggestion for the two bad rows ("Quartered rotation
can't close with mirrored hands. Use halved, or turn Symmetry off."). The
existing pre-flight check in `generate-actions` already turns that into a
toast. If a caller forces the combination anyway, the engine's search fails
with its normal closure error.

LOOP extension itself needs no change: the executors transform both hands of
each seed step with one map, so a relationship that survives the seed
survives the loop.

## App

`src/lib/features/create/generate` and `src/lib/shared/create`

- `UIGenerationConfig.handRelationship: HandRelationshipSetting` with values
  `"off" | "mirrored" | "mirrored-inverted"` (type in
  `src/lib/shared/create/domain/hand-relationship.ts`, next to
  `generation-style.ts`, but not part of `GenerationStylePolicy`, so Fuse is
  untouched). Default `"off"` in `GENERATE_DEFAULT_CONFIG`.
- Persist it in `SerializedConfig` (save and load). The persistence
  normalizer passes it through; Saved Setups and community favorites store
  the whole config record already, so a setup saved with Mirrored on
  restores Mirrored on. Reset All restores Off.
- `GenerationOptions` (foundation `generate-models`) gains the field;
  `uiConfigToGenerationOptions` copies it; `GenerationOrchestrator.mapConstraints`
  maps it to `ConstraintOptions.handRelationship` and derives the left start
  orientation as described above.
- The MCP `generate` tool reaches the engine option for free. Exposing it as
  a tool parameter is a follow-up, not part of this change.

### Customize drawer

- A fourth drill row after End Position: label **Symmetry**, value "Off",
  "Mirrored", or "Mirrored, inverted". "Hands" is already the label of the
  hand-path continuity axis, so this row must not be called Hands.
- Drill screen: two option buttons in the `GenerationStylePanel` pattern,
  Off and Mirrored, with a stacked hint line:
  - Off: "Each hand is chosen on its own."
  - Mirrored: "The left hand traces the mirror image of the right, every
    step."
    Below them, shown only when Mirrored is on, a toggle **Inverted** with
    the hint "Left hand uses the opposite motion type. Pro on the right is
    anti on the left."
    No option or hint uses the word "hybrid".
- Collapsed Customize card: `buildCustomizeSummary` adds the fact
  "Symmetry: Mirrored" (or "Mirrored, inverted") so the card leaves the
  Default badge, the same way Props or Dashes do.
- Start Position screen: while Symmetry is on, the left orientation control
  is locked and reads "Follows right", reusing the disabled row treatment End
  Position already has under LOOP. Position cells are not filtered at
  launch; the engine excludes non-symmetric starts and the user sees the
  ordinary generation error if they block every symmetric one.
- End Position: an end position that is not mirror-symmetric is
  unreachable and surfaces as the ordinary generation error. Filtering the
  picker is a follow-up.
- LOOP overlay: no new control. The two incompatible combos fail the
  pre-flight check with the reason above.

## Testing

Engine (Vitest, `packages/sequence-engine`):

- `HandRelationshipConstraint` against the real diamond and box dataframes:
  exactly the letters and counts in the census table; Inverted yields F/L
  and O/R.
- `allocateTurns` with `linkHands`: left equals right on every step,
  including `"fl"`.
- Materialized dash and static turns under Mirrored have opposite rotation
  directions; under Inverted, the same.
- Seeded builds: diamond L1 length 8 Mirrored, every step satisfies the
  predicate and starts at an eligible position; L3 with turn intensity 3
  keeps turns equal; Mirrored plus rotated 180 halved closes; Mirrored plus
  quartered rotated returns the closure error.

App:

- `customize-summary` fact for the new row; `generate-config` save and load
  round trip; `checkLoopViability` for the two incompatible rows.
- Browser: Customize drawer row and drill screen at the phone tier (bottom
  sheet) and the desktop tier (side panel). Generate one mirrored sequence
  and read the steps' motions from the workspace to confirm the predicate
  on real output, then look at the mandala trail.

## Not in scope

- Unison, Opposite, Flipped relationships in the UI. The engine accepts
  them; the picker does not offer them until someone asks.
- Symmetry badge on sequence cards or sequence metadata.
- Filtering the start and end position pickers to symmetric positions.
- Fuse.
- MCP tool parameter.

## Open questions

For Kristen (Austen to relay):

1. Is "mirror" always across the body's vertical axis (left and right
   swap), or does she also picture top and bottom symmetry? Launch assumes
   vertical only.
2. Should both hands always take the same number of turns (a true mirror),
   or would mirrored paths with independent turns also be useful? Launch
   assumes equal turns, and both hands float together.
3. Would she use the inverted variant (same paths, one hand pro and the
   other anti; F and L in diamond)? If not, the toggle can wait.
4. Does she want this together with LOOPs (Mirrored hands plus a rotated
   180 loop, for example) or mostly freeform? That decides how much LOOP
   polish matters at launch.
5. Which grid does she mostly spin in? In diamond, Mirrored limits the
   letters to D/E/J/K (alpha at the sides, beta at top or bottom). In box it
   is M/N/P/Q on gamma. Is that the vocabulary she expects?

For Austen:

1. Row name: "Symmetry" is the proposal, because "Hands" is taken. Other
   candidates: "Hand Relationship", "Mirror".
2. Launch scope: Mirrored plus Inverted only (recommended), or the full
   picker with Unison, Opposite and Flipped, since the engine cost is the
   same and only copy and tests grow?
3. Incompatible LOOP combos: block with a reason at generate time
   (recommended, matches the existing viability path), or auto-coerce
   quartered to halved the way non-rotation types already are?
