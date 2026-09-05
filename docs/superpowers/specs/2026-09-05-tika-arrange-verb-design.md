# TIKA Director: the Arrange verb and the capability registry

Date: 2026-09-05. Status: approved by Austen in conversation; batch 1 of the
TIKA parity programme.

## Why

Austen, looking at four performers at count 0, typed "Could you put them in a
line". TIKA asked "How many beats should the transition take?". He wanted what
the rail's Formation tool button does: reshape the cast where the playhead is.
TIKA's only formation verb is `formation-transition`, which authors a timed
move into the timeline, and its rules forbid inventing a duration, so a bare
shape had one legal reading and it asked. The live battery certified that
behaviour ("adv missing duration", "missing timing compound"), so passing it
proved the spec was followed, not that the product was right.

## Decisions taken in the design conversation

| Question | Decision |
| --- | --- |
| Remit | Parity: anything clickable on the Stage can be said to TIKA, delivered in batches. |
| First batch | Arrange vs Move split with relative tweaks. Later batches: richer moves; naming performers, specific looks, cast size; tempo, seek, play. |
| Motion verb with no count ("move to a line") | Arrange now. The reply hints how to make it a move. Only an explicit count creates a transition. |
| Referring to performers (batch 3) | By name, stage position, look, and number. |
| Bare arrangement mid-transition | Reshape the destination set; the move keeps its timing. |
| Cast growth (batch 3) | New performers refit the current shape, as the Performers panel does. |
| Relative tweaks | In batch 1: spacing (wider, tighter) and shift (forward, back, left, right); "more" repeats the last tweak. |
| Reply style | One line that names every inferred choice. |
| Live verification budget | Targeted `--grep` subsets only; one full battery before merge. |
| Architecture | Capability registry: one descriptor per verb generates prompt, reviewer rules, validators, executor wiring, and battery baselines. |
| Order | Arrange first, in the registry, migrating today's four actions with it. |

## The two verbs

**Arrange** reshapes the set the playhead is on. Nothing is added to the
timeline. It is what the Formation tool button does, so it executes through the
same operation, `applyPresetToFormation`.

**Move** is today's `formation-transition`: a destination set plus a transition
from the current count.

### Inference rule (planner, reviewer, and local interpreter all follow it)

1. A count is present ("over 8", "in 4 counts", "8 beats circle") means Move.
   Nothing else does.
2. No count means Arrange. Motion verbs change nothing: "move to a line",
   "go to a circle", "transition to a V" arrange now.
3. A unit TIKA cannot convert (seconds, bars, measures) still gets one
   clarification, as today.
4. Every Arrange reply names the choice: "Arranged the cast in a line at count
   0. Say over 8 counts to make it a move." Every Move reply names the count.

### Target set for Arrange

The Stage's active set is the last set whose `atBeat` is at or before the
playhead (or the set pinned by selection). If the playhead is inside the next
set's transition window (`next.atBeat - next.transitionBeats <= beat <
next.atBeat`), the target is that next set: the cast is walking into it, and
reshaping where they came from would rewrite the move. Otherwise the target is
the active set. This lives in a small pure function,
`resolveArrangeTargetIndex`, beside `resolveActiveFormationIndex`.

## The `arrange-formation` action

Exactly one of three fields:

- `shape`: one of the sixteen named formations. Executes through
  `applyPresetToFormation` on the target set.
- `spacing`: `"wider"` or `"tighter"`. Scales every spot about the set's
  centroid by a fixed step of 15 percent (factor 1.15 or 1/1.15).
- `shift`: `"forward"`, `"back"`, `"left"`, `"right"`. Slides every spot by one
  metre.

Stage coordinates run `x` in `[0, stageWidth]` and `z` in `[0, stageDepth]`,
with `z = 0` the audience edge (top of the drill chart, world +Z). Forward
decreases `z`; left decreases `x`, which is the audience's left in the 3D view
and screen-left on the drill chart. Spacing and shift clamp every spot to the
stage floor.

Spacing and shift need one new choreography-state operation,
`transformFormationSpots(formationId, { scale?, dx?, dz? })`, which pushes one
undo entry and sets `presetId` to `"custom"`, as a drag does.

"More" goes to the model with history, which re-emits the previous tweak. The
local interpreter never handles it.

### Plan rules (deterministic validator)

- At most one `arrange-formation` with `shape` per plan.
- `arrange-formation` never appears with `formation-transition`: both claim
  the same set.
- "A wider circle" is two arrange actions, shape then spacing, in that order.
  The validator allows exactly that pair (shape followed by one spacing or one
  shift). Two shapes, or a tweak before its shape, are rejected as unsupported.
- The existing timing gate keeps vetoing a `formation-transition` whose count
  the prompt does not state. Its question changes to "Arrange them now, or
  move over how many counts?" so a misclassified motion verb offers the
  arrange path.

### Existing rules that change

- Planner: "Do not guess missing transition duration" narrows to units it
  cannot convert. The clarify example for "different props and transition to
  a circle" becomes an apply with props plus an arrange.
- Reviewer: "Duration must come from the user's request" is scoped to Move,
  with a line describing Arrange.
- Battery: "adv missing duration" ("circle formation") and "missing timing
  compound" expect Arrange. "adv instantly" ("snap them into a circle right
  now") expects Arrange. New cases: "could you put them in a line", "line",
  "circle please", "move to a V", "go to a circle", "a bit wider", "tighter",
  "shift them left", "a wider circle", "wider, then a circle over 8" (the one
  legal pairing with a Move is rejected: it is two verbs on one set), and
  "line over 8 counts" stays a Move.

### Local interpreter

Model-free handling for complete, standalone commands with no history:

- Bare shape with optional politeness and filler: "line", "circle please",
  "put them in a V", "make a circle", "arrange them in a line", "move to a
  line", "go to a circle", "transition to a V", "snap them into a circle".
- Bare tweak: "wider", "a bit wider", "tighter", "closer together", "spread
  them out", "forward", "back", "left", "right", "shift them left".
- Shape plus count keeps resolving to Move as today.
- "more", names, scope words, and anything with history return null.

Summaries name the choice, using the same sentences the model is taught.

## Capability registry

One folder, `src/lib/features/stage/domain/tika-capabilities/`, one file per
verb, each exporting a `TikaCapability` descriptor:

```ts
interface TikaCapability<A extends TikaDirectorAction = TikaDirectorAction> {
  type: A["type"];
  schema: z.ZodType<A>;
  /** One line for the planner's "Supported actions" list. */
  plannerLine: string;
  /** One line for the reviewer's "Capabilities" list. */
  reviewerLine: string;
  /** Worked decision examples, at least two, in the planner's existing format. */
  examples: readonly string[];
  /** Optional model-free patterns for the local interpreter. */
  local?: (command: string) => A | null;
  /** Optional plan-level veto. Never adds or changes actions. */
  validate?: (request: TikaDirectorRequest, plan: TikaDirectorApply) => TikaDirectorResponse;
  /** Human summary fragment for local responses. */
  describe: (action: A) => string;
}
```

Execution stays on the client. Each descriptor also names its executor in a
client-side table in `services/tika-director-executor.ts`, keyed by `type`,
receiving `{ stageState, viewer, choreography, requestBeat, activeSetIndex }`
and returning whether the document or viewer changed. `StageModule.svelte`
loses its per-type branches and calls the executor table.

The registry (`index.ts`) exports the ordered list of capabilities and derives:

- `TikaDirectorActionSchema` as a discriminated union of every `schema`.
- The planner's "Supported actions" lines and "Decision examples" block.
- The reviewer's "Capabilities" lines.
- The validator chain run by `planStageDirection` and by the API route.
- The local interpreter's action resolvers.

Today's four actions migrate unchanged. Arrange joins as the fifth. The prompt
rules that are not per-verb (negation, partial execution, undo, injection)
stay as one hand-written block in the planner.

A unit test iterates the registry and asserts every descriptor has a schema,
planner line, reviewer line, at least two examples that parse against its own
schema, a `describe`, and an executor entry. The live battery reads every
descriptor's examples as baseline cases and keeps its hand-written adversarial
cases on top.

Not changing: two model calls (planner with `Output.object`, reviewer veto);
the response shape (apply, clarify, unsupported); the single-use undo; the
production admin gate on the API route.

## Testing

Unit tests first, no API calls:

- Registry contract test as above.
- Interpreter: bare shapes and tweaks resolve locally to Arrange with exact
  fields; "move to a line" resolves to Arrange; shape plus count resolves to
  Move; "more", names, scope and history-dependent phrasings return null.
- Validator: Arrange plus Move rejected; shape then spacing allowed; two
  shapes rejected; tweak before shape rejected; the timing gate's new question.
- `resolveArrangeTargetIndex`: at a set, before a window, inside a window.
- `transformFormationSpots`: scale about centroid, shift, clamp to the floor,
  preset becomes custom, one undo entry.
- Executor against a real choreography state: Arrange at count 0 reshapes the
  first set and adds no set; Arrange inside a transition window reshapes the
  destination and keeps `transitionBeats`; undo restores.
- Planner and reviewer prompt tests keep passing against the generated text.

Live verification, targeted only: the formation subset of the battery
(`--grep=` on the new names plus the existing formation cases), about 25 cases,
roughly 130k input tokens, rerun once after any prompt wording change. One full
battery before merge.

Browser: in `/test/stage` on a worktree server, "put them in a line" shows a
line on the drill chart at the current count with no new set; "circle over 8"
adds a set with an 8-count transition. Screenshots for both.

Merge: scoped commits on `codex/tika-arrange-verb`, then `wt:finish` with
`--route /stage/scene`.

## Out of scope for batch 1

Facing ("face the audience"), swapping or moving named performers, cast
changes, chains and delayed starts, tempo and playback, world and camera. Each
later batch adds descriptors to the registry.
