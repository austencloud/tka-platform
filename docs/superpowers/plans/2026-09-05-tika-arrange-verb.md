# TIKA Arrange Verb and Capability Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let TIKA reshape the cast where the playhead sits ("put them in a line") without authoring a timeline move, and put every TIKA verb behind one registry that generates the planner prompt, reviewer rules, validators, local patterns, and battery baselines.

**Architecture:** A `tika-capabilities/` folder holds one descriptor per verb (schema, planner line, reviewer line, worked examples, optional local pattern, optional plan veto, summary text). The registry index derives the action schema union, prompt sections, validator chain, and local interpreter from those descriptors. A new `arrange-formation` verb executes through the existing Formation-tool operation (`applyPresetToFormation`) or a new `transformFormationSpots` state op; a client executor module replaces the per-type branches in `StageModule.svelte`.

**Tech Stack:** SvelteKit, Svelte 5 runes, zod, Vercel AI SDK (`generateText` + `Output.object`), Vitest (`npm test -- --run <files>` from the worktree), prettier run from `E:/tka-platform` on worktree paths.

Spec: `docs/superpowers/specs/2026-09-05-tika-arrange-verb-design.md`. Worktree: `E:/worktrees/tka-platform/tika-arrange-verb`, branch `codex/tika-arrange-verb`. Commit with explicit pathspecs and the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

| Path                                                                                     | Responsibility                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/features/stage/domain/tika-director-vocabulary.ts` (create)                     | Formation and presentation enums and their zod schemas. Leaf module so capability files never import the schema root.                                                                                                                                               |
| `src/lib/features/stage/domain/tika-capabilities/capability.ts` (create)                 | `TikaCapability` interface, `TikaCapabilityExample`, `TikaCapabilityVeto`, `TikaLocalContext`.                                                                                                                                                                      |
| `src/lib/features/stage/domain/tika-capabilities/assign-distinct-props.ts` (create)      | Props descriptor.                                                                                                                                                                                                                                                   |
| `src/lib/features/stage/domain/tika-capabilities/assign-distinct-characters.ts` (create) | Characters descriptor plus the presentation-count veto (moved from plan-validation).                                                                                                                                                                                |
| `src/lib/features/stage/domain/tika-capabilities/assign-distinct-sequences.ts` (create)  | Sequences descriptor.                                                                                                                                                                                                                                               |
| `src/lib/features/stage/domain/tika-capabilities/formation-transition.ts` (create)       | Move descriptor plus the timing veto (moved from plan-validation), exports `currentDuration` and `validateTikaDirectorPlanTiming`.                                                                                                                                  |
| `src/lib/features/stage/domain/tika-capabilities/arrange-formation.ts` (create)          | Arrange descriptor: schema, local patterns, veto, summaries.                                                                                                                                                                                                        |
| `src/lib/features/stage/domain/tika-capabilities/index.ts` (create)                      | `TIKA_CAPABILITIES`, `TikaDirectorActionSchema`, `TikaDirectorAction`, `plannerCapabilityLines()`, `plannerExampleLines()`, `reviewerCapabilityLines()`, `validateTikaDirectorPlan()`, `interpretWithCapabilities()`.                                               |
| `src/lib/features/stage/domain/tika-director.ts` (modify)                                | Re-export vocabulary and the registry's action schema; keep response/request schemas.                                                                                                                                                                               |
| `src/lib/features/stage/domain/tika-director-plan-validation.ts` (modify)                | Thin re-export of the registry chain and the two named validators.                                                                                                                                                                                                  |
| `src/lib/features/stage/domain/tika-director-interpreter.ts` (modify)                    | Normalize the command, delegate to the registry, accept a `{ currentBeat }` context.                                                                                                                                                                                |
| `src/lib/features/stage/domain/active-formation.ts` (modify)                             | Add `resolveArrangeTargetIndex`.                                                                                                                                                                                                                                    |
| `src/lib/features/stage/state/stage-choreography-state.svelte.ts` (modify)               | Add `transformFormationSpots`.                                                                                                                                                                                                                                      |
| `src/lib/features/stage/services/tika-director-executor.ts` (create)                     | `executeTikaDirectorPlan`, `TIKA_EXECUTED_ACTION_TYPES`.                                                                                                                                                                                                            |
| `src/lib/features/stage/services/tika-director-service.ts` (modify)                      | Pass `currentBeat` to the local interpreter.                                                                                                                                                                                                                        |
| `src/lib/features/stage/services/server/tika-director-planner.ts` (modify)               | Build the prompt from the registry; narrowed duration rule.                                                                                                                                                                                                         |
| `src/lib/features/stage/services/server/tika-director-reviewer.ts` (modify)              | Build capability lines from the registry; Arrange-aware duration line.                                                                                                                                                                                              |
| `src/lib/features/stage/StageModule.svelte` (modify)                                     | Call the executor.                                                                                                                                                                                                                                                  |
| `scripts/tika/verify-director-live.ts` (modify)                                          | Flip three cases, add arrange cases, add registry example baselines.                                                                                                                                                                                                |
| Tests                                                                                    | `tests/unit/stage/tika-capabilities-contract.test.ts` (create), `tests/unit/stage/tika-director-executor.test.ts` (create), `tests/unit/stage/active-formation.test.ts` (create); modify interpreter, plan-validation, choreography-state, planner, reviewer tests. |

Run tests from the worktree root with:

```bash
cd E:/worktrees/tka-platform/tika-arrange-verb && npm test -- --run <paths>
```

---

### Task 1: Vocabulary leaf module and capability contract types

**Files:**

- Create: `src/lib/features/stage/domain/tika-director-vocabulary.ts`
- Create: `src/lib/features/stage/domain/tika-capabilities/capability.ts`
- Modify: `src/lib/features/stage/domain/tika-director.ts`

- [ ] **Step 1: Create the vocabulary module** (moved verbatim from `tika-director.ts`)

```ts
import { z } from "zod";

export const TIKA_DIRECTOR_FORMATIONS = [
  "line",
  "triangle",
  "diamond",
  "circle",
  "v-shape",
  "grid",
  "grid-2x2",
  "stagger",
  "cluster",
  "diagonal",
  "solo",
  "tunnel-stack",
  "back-to-back",
  "facing-each-other",
  "stage-lr",
  "side-by-side",
] as const;
export const TikaDirectorFormationSchema = z.enum(TIKA_DIRECTOR_FORMATIONS);

/** Product-assigned look labels; see shared/3d/config/character-presentation. */
export const TIKA_DIRECTOR_PRESENTATIONS = [
  "masculine",
  "feminine",
  "androgynous",
] as const;
export const TikaDirectorPresentationSchema = z.enum(
  TIKA_DIRECTOR_PRESENTATIONS
);

export type TikaDirectorFormation = z.infer<typeof TikaDirectorFormationSchema>;
export type TikaDirectorPresentation = z.infer<
  typeof TikaDirectorPresentationSchema
>;
```

- [ ] **Step 2: Create the capability contract**

```ts
import type { z } from "zod";
import type {
  TikaDirectorRequest,
  TikaDirectorResponse,
} from "../tika-director";

/** A worked decision the planner is taught; also a live battery baseline. */
export interface TikaCapabilityExample {
  user: string;
  conversation?: TikaDirectorRequest["conversation"];
  scene?: Partial<TikaDirectorRequest["scene"]>;
  response: TikaDirectorResponse;
  /** One trailing sentence of rationale shown after the example. */
  note?: string;
}

export type TikaCapabilityVeto =
  | { kind: "clarify"; question: string }
  | { kind: "unsupported"; message: string };

export interface TikaLocalContext {
  currentBeat: number;
}

export interface TikaCapability<A extends { type: string } = { type: string }> {
  type: A["type"];
  schema: z.ZodType<A>;
  /** One line for the planner's "Supported actions" list, without the leading type. */
  plannerLine: string;
  /** One line for the reviewer's capability block. */
  reviewerLine: string;
  examples: readonly TikaCapabilityExample[];
  /** Model-free pattern for a complete, normalized, standalone command. */
  local?: (command: string) => A | null;
  /** Plan-level veto over the whole action list. Never adds or changes actions. */
  validate?: (
    request: Pick<TikaDirectorRequest, "prompt" | "conversation" | "scene">,
    actions: readonly { type: string }[]
  ) => TikaCapabilityVeto | null;
  /** Summary sentence for a locally interpreted action. */
  describe: (action: A, context: TikaLocalContext) => string;
}
```

- [ ] **Step 3: Make `tika-director.ts` re-export the vocabulary** (delete the local enum definitions, add `export * from "./tika-director-vocabulary";` and import the two schemas for use). Run `npm test -- --run tests/unit/stage/tika-director-interpreter.test.ts` to confirm nothing broke. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(tika): split director vocabulary into a leaf module" -- src/lib/features/stage/domain/tika-director-vocabulary.ts src/lib/features/stage/domain/tika-capabilities/capability.ts src/lib/features/stage/domain/tika-director.ts
```

---

### Task 2: Migrate the four existing verbs into descriptors and derive the schema, prompts, validators

**Files:**

- Create: the four descriptor files and `index.ts` under `tika-capabilities/`
- Modify: `tika-director.ts` (action schema comes from the registry), `tika-director-plan-validation.ts` (re-exports), `tika-director-interpreter.ts`, planner, reviewer
- Test: `tests/unit/stage/tika-capabilities-contract.test.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from "vitest";
import {
  TIKA_CAPABILITIES,
  TikaDirectorActionSchema,
} from "$lib/features/stage/domain/tika-capabilities";
import { TikaDirectorResponseSchema } from "$lib/features/stage/domain/tika-director";
import { TIKA_EXECUTED_ACTION_TYPES } from "$lib/features/stage/services/tika-director-executor";

describe("TIKA capability registry contract", () => {
  it("lists every action type exactly once", () => {
    const types = TIKA_CAPABILITIES.map((c) => c.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual(
      expect.arrayContaining([
        "assign-distinct-props",
        "assign-distinct-characters",
        "assign-distinct-sequences",
        "formation-transition",
        "arrange-formation",
      ])
    );
  });
  it.each(TIKA_CAPABILITIES.map((c) => [c.type, c] as const))(
    "%s is fully described",
    (_type, capability) => {
      expect(capability.plannerLine.length).toBeGreaterThan(20);
      expect(capability.reviewerLine.length).toBeGreaterThan(20);
      expect(capability.examples.length).toBeGreaterThanOrEqual(2);
      for (const example of capability.examples) {
        expect(TikaDirectorResponseSchema.parse(example.response)).toBeTruthy();
        if (example.response.kind === "apply") {
          for (const action of example.response.actions)
            TikaDirectorActionSchema.parse(action);
        }
      }
      expect(TIKA_EXECUTED_ACTION_TYPES.has(capability.type)).toBe(true);
    }
  );
  it("accepts exactly the registry's schemas in the action union", () => {
    for (const capability of TIKA_CAPABILITIES) {
      expect(TikaDirectorActionSchema.options).toContain(capability.schema);
    }
    expect(TikaDirectorActionSchema.options).toHaveLength(
      TIKA_CAPABILITIES.length
    );
  });
});
```

Run: `npm test -- --run tests/unit/stage/tika-capabilities-contract.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 2: Write the four descriptor files.** Each exports `<name>Capability` and its action type. Planner and reviewer lines are the existing sentences from `tika-director-planner.ts` and `tika-director-reviewer.ts`, moved without rewording. The character descriptor's `validate` is the body of `validateTikaDirectorPlanCatalog`; the formation-transition descriptor's `validate` is `validateTikaDirectorPlanTiming` and the file also exports `currentDuration(text)` and `normalizeDirectorText(text)`. Existing planner examples move to the descriptor they illustrate as `TikaCapabilityExample` objects, e.g.

```ts
{
  user: "Give each performer their own sequence from my library",
  scene: { librarySequenceCount: 12 },
  response: { kind: "apply", summary: "Assign a different saved sequence to every performer.", actions: [{ type: "assign-distinct-sequences" }] },
}
```

- [ ] **Step 3: Write `index.ts`**

```ts
import { z } from "zod";
import type {
  TikaCapability,
  TikaCapabilityExample,
  TikaLocalContext,
} from "./capability";
import { assignDistinctPropsCapability } from "./assign-distinct-props";
import { assignDistinctCharactersCapability } from "./assign-distinct-characters";
import { assignDistinctSequencesCapability } from "./assign-distinct-sequences";
import { formationTransitionCapability } from "./formation-transition";
import { arrangeFormationCapability } from "./arrange-formation";

export const TIKA_CAPABILITIES = [
  assignDistinctPropsCapability,
  assignDistinctCharactersCapability,
  assignDistinctSequencesCapability,
  formationTransitionCapability,
  arrangeFormationCapability,
] as const satisfies readonly TikaCapability<any>[];

export const TikaDirectorActionSchema = z.discriminatedUnion("type", [
  assignDistinctPropsCapability.schema,
  assignDistinctCharactersCapability.schema,
  assignDistinctSequencesCapability.schema,
  formationTransitionCapability.schema,
  arrangeFormationCapability.schema,
]);
export type TikaDirectorAction = z.infer<typeof TikaDirectorActionSchema>;

export function plannerCapabilityLines(): string[] {
  return TIKA_CAPABILITIES.map((c) => `- ${c.type}: ${c.plannerLine}`);
}
export function plannerExampleLines(): string[] {
  return TIKA_CAPABILITIES.flatMap((c) => c.examples.map(renderExample));
}
export function reviewerCapabilityLines(): string[] {
  return TIKA_CAPABILITIES.map((c) => c.reviewerLine);
}
function renderExample(example: TikaCapabilityExample): string {
  const context = [
    example.conversation ? `after ${JSON.stringify(example.conversation)}` : "",
    example.scene ? `with scene ${JSON.stringify(example.scene)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `User: '${example.user}'${context ? ` ${context}` : ""} -> response ${JSON.stringify(example.response)}.${example.note ? ` ${example.note}` : ""}`;
}
export function validateTikaDirectorPlan(request, response) {
  /* runs every capability.validate in order; first veto wins */
}
export function interpretWithCapabilities(
  command: string,
  context: TikaLocalContext
) {
  /* first capability.local hit -> {kind:"apply", summary: describe(action, context), actions:[action]} */
}
```

- [ ] **Step 4: Rewire consumers.** `tika-director.ts` imports `TikaDirectorActionSchema` from the registry and re-exports it and `TikaDirectorAction`. `tika-director-plan-validation.ts` becomes re-exports of `validateTikaDirectorPlanTiming` (from formation-transition), `validateTikaDirectorPlanCatalog` (from assign-distinct-characters), and `validateTikaDirectorPlan` (from index). Planner: replace the hard-coded capability lines and per-verb examples with `...plannerCapabilityLines()` and `...plannerExampleLines()`; call `validateTikaDirectorPlan`. Reviewer: replace the capability lines with `...reviewerCapabilityLines()`. Interpreter: normalize, then `interpretWithCapabilities`.

- [ ] **Step 5: Run the TIKA suite.** `npm test -- --run tests/unit/stage/tika-*.test.ts`. Expected: everything green except the contract test's `arrange-formation` expectation (Task 3).

- [ ] **Step 6: Commit** with the pathspec of every file above.

---

### Task 3: `arrange-formation` descriptor with local patterns and vetoes

**Files:**

- Create: `src/lib/features/stage/domain/tika-capabilities/arrange-formation.ts`
- Test: `tests/unit/stage/tika-director-interpreter.test.ts`, `tests/unit/stage/tika-director-plan-validation.test.ts`

- [ ] **Step 1: Failing interpreter tests**

```ts
it.each([
  ["Could you put them in a line", "line"],
  ["line", "line"],
  ["circle please", "circle"],
  ["Put them in a V", "v-shape"],
  ["make a circle", "circle"],
  ["arrange them in a line", "line"],
  ["move to a line", "line"],
  ["go to a circle", "circle"],
  ["Transition to a circle", "circle"],
  ["snap them into a circle", "circle"],
  ["circle formation", "circle"],
])("arranges the cast now for a bare shape: %s", (prompt, shape) => {
  expect(
    interpretStageDirectionLocally(prompt, { currentBeat: 0 })
  ).toMatchObject({
    kind: "apply",
    summary: expect.stringMatching(/at count 0/),
    actions: [{ type: "arrange-formation", shape }],
  });
});
it.each([
  ["wider", { spacing: "wider" }],
  ["a bit wider", { spacing: "wider" }],
  ["tighter", { spacing: "tighter" }],
  ["closer together", { spacing: "tighter" }],
  ["spread them out", { spacing: "wider" }],
  ["shift them left", { shift: "left" }],
  ["move them forward", { shift: "forward" }],
  ["back", { shift: "back" }],
  ["everyone to the right", { shift: "right" }],
])("tweaks the current set locally: %s", (prompt, fields) => {
  expect(
    interpretStageDirectionLocally(prompt, { currentBeat: 8 })
  ).toMatchObject({
    kind: "apply",
    actions: [{ type: "arrange-formation", ...fields }],
  });
});
it.each(["more", "a wider circle", "put A in front", "wider on the left side"])(
  "defers relative and scoped arrangement to the model: %s",
  (prompt) =>
    expect(
      interpretStageDirectionLocally(prompt, { currentBeat: 0 })
    ).toBeNull()
);
```

Remove `"Transition to a circle"` from the existing "defers the entire request" list (it now arranges).

- [ ] **Step 2: Failing validator tests**

```ts
const arrange = (fields) => ({ type: "arrange-formation", ...fields });
const transition = {
  type: "formation-transition",
  endFormation: "circle",
  durationBeats: 4,
};
const applyPlan = (actions) => ({ kind: "apply", summary: "x", actions });
const check = (prompt, actions) =>
  validateTikaDirectorPlan(
    { prompt, conversation: [], scene },
    applyPlan(actions)
  );

it("rejects arranging and moving in one plan", () => {
  expect(
    check("circle then wider over 4 beats", [
      arrange({ shape: "circle" }),
      transition,
    ]).kind
  ).toBe("unsupported");
});
it("allows shape then one spacing tweak", () => {
  const plan = applyPlan([
    arrange({ shape: "circle" }),
    arrange({ spacing: "wider" }),
  ]);
  expect(
    validateTikaDirectorPlan(
      { prompt: "a wider circle", conversation: [], scene },
      plan
    )
  ).toBe(plan);
});
it.each([
  [[arrange({ shape: "circle" }), arrange({ shape: "line" })]],
  [[arrange({ spacing: "wider" }), arrange({ shape: "circle" })]],
  [[arrange({})]],
  [[arrange({ shape: "circle", spacing: "wider" })]],
  [
    [
      arrange({ shape: "circle" }),
      arrange({ spacing: "wider" }),
      arrange({ shift: "left" }),
    ],
  ],
])("rejects malformed arrange sets", (actions) => {
  expect(check("whatever", actions).kind).toBe("unsupported");
});
it("asks when a count is present but the plan arranges now", () => {
  const result = check("circle over 8 counts", [arrange({ shape: "circle" })]);
  expect(result.kind).toBe("clarify");
});
it("offers the arrange path when a transition lacks a count", () => {
  const result = check("transition to a circle", [transition]);
  expect(result).toEqual({
    kind: "clarify",
    question: "Arrange them in a circle now, or move over how many counts?",
  });
});
```

The last expectation replaces the existing `"How many beats should the transition take?"` text in the timing veto; the veto names the destination when the plan has exactly one transition and otherwise asks "Arrange them now, or move over how many counts?". Update `clarificationDuration`'s question regex to `/\b(?:how many (?:beats|counts)|how long|what duration|which duration)\b[^?]*\?/i`.

- [ ] **Step 3: Implement the descriptor**

```ts
export const ArrangeFormationSchema = z
  .object({
    type: z.literal("arrange-formation"),
    shape: TikaDirectorFormationSchema.optional(),
    spacing: z.enum(["wider", "tighter"]).optional(),
    shift: z.enum(["forward", "back", "left", "right"]).optional(),
  })
  .strict();
export type ArrangeFormationAction = z.infer<typeof ArrangeFormationSchema>;
```

Local patterns (command already lower-cased, politeness stripped by the interpreter; the descriptor additionally strips leading `could you|can you|would you|will you|let's|lets` and trailing `now|right now|for me|formation|shape`):

```ts
const SHAPE_COMMAND =
  /^(?:(?:put|get|place|arrange|set|snap|shift) (?:them|everyone|the cast|the performers|us)(?: all)? (?:in|into|to) |(?:make|form|do|try) |(?:move|go|transition|switch|change) (?:to |into )|(?:transition|move|go|switch) (?:them|everyone) (?:to |into ))?(?:a |the |an )?(?<shape>.+?)$/;
const SPACING_WORDS = new Map([
  ["wider", "wider"],
  ["spread out", "wider"],
  ["spread them out", "wider"],
  ["more space", "wider"],
  ["further apart", "wider"],
  ["farther apart", "wider"],
  ["tighter", "tighter"],
  ["closer", "tighter"],
  ["closer together", "tighter"],
  ["less space", "tighter"],
  ["bring them in", "tighter"],
]);
const SHIFT_COMMAND =
  /^(?:(?:shift|move|slide|nudge|step|bring) )?(?:them |everyone |the cast |us )?(?:a (?:bit|little|touch|step) )?(?:to the |to |up |down )?(?<dir>forward|forwards|front|back|backward|backwards|left|right)$/;
```

`local(command)`: try `SHAPE_COMMAND` and look the `shape` group up in `FORMATION_ALIASES` (moved into this file and exported for the transition descriptor); then `SPACING_WORDS` after stripping a leading `(a (bit|little|touch) |slightly |much |even )`; then `SHIFT_COMMAND` mapping `front`→`forward`, `backward(s)`→`back`, `forwards`→`forward`. Anything containing a digit or a number word returns null so counts always reach the Move pattern or the model.

`describe(action, { currentBeat })`:

- shape: `Arranged the cast in a ${label} at count ${beat}. Say "over 8 counts" to make it a move.`
- spacing: `Spread the cast ${wider|tighter} at count ${beat}.` / `Pulled the cast tighter at count ${beat}.`
- shift: `Shifted the cast ${dir} at count ${beat}.`

`validate(request, actions)`: implements the five rules from the spec (exactly one field each; never with a transition; at most two, ordered shape then tweak; a stated count plus a shape arrange yields clarify `Did you want them in a ${shape} now, or a move over ${n} counts?`).

Planner line: `arrange the cast where the playhead sits, changing no timing: exactly one of shape (a named formation), spacing ('wider' or 'tighter', one step), or shift ('forward', 'back', 'left', 'right', one metre). A request with NO count is ALWAYS an arrange, even with motion verbs like move, go, transition, snap. 'A wider circle' is two actions in order: shape, then spacing. 'More' repeats the previous tweak. The summary must name the choice and hint the alternative, e.g. "Arranging the cast in a line at the current count. Say over 8 counts to make it a move."`

Reviewer line: `arrange-formation reshapes the set at the current count without adding timeline movement. A request with no count is an arrange, including motion verbs. It never appears with formation-transition. Exactly one field per action; a shape may be followed by one spacing or shift tweak.`

Examples (all parse against the schemas): "Could you put them in a line" → apply arrange line; "move to a circle" → apply arrange circle; "a wider circle" → apply shape + spacing; "a bit wider" → apply spacing wider; "Different props and transition to a circle." → apply props + arrange circle (replaces the old clarify example).

- [ ] **Step 4: Run** `npm test -- --run tests/unit/stage/tika-director-interpreter.test.ts tests/unit/stage/tika-director-plan-validation.test.ts tests/unit/stage/tika-capabilities-contract.test.ts`. Expected: PASS (contract still fails on the executor set until Task 5).

- [ ] **Step 5: Planner and reviewer rule wording.** In the planner's hand-written rules replace "Do not guess missing transition duration, start time, formation order, or ambiguous references. Ask one concise question…" with "A formation request with no count is an arrange-formation, never a question. Only seconds, bars, or measures, a missing start formation the user implied, an ambiguous formation order, or an ambiguous reference earn one concise question. Never ask for a duration, start, or destination the message already states." Keep "Emit at most one formation transition." In the reviewer replace "Duration must come from the user's request or an unambiguous answer to a duration question, not the current beat." with "A formation-transition's duration must come from the user's request or an unambiguous answer to a duration question, never the current beat; a formation request with no count is arrange-formation, not a transition to reject." Add planner tests asserting `/arrange-formation/` and `/no count is (?:an|ALWAYS an) arrange/i`; reviewer test asserting the system contains `arrange-formation`.

- [ ] **Step 6: Commit.**

---

### Task 4: `resolveArrangeTargetIndex` and `transformFormationSpots`

**Files:**

- Modify: `src/lib/features/stage/domain/active-formation.ts`
- Modify: `src/lib/features/stage/state/stage-choreography-state.svelte.ts` (add op next to `applyPresetToFormation`, export it, add to the `StageChoreographyState` interface)
- Test: `tests/unit/stage/active-formation.test.ts` (create), `tests/unit/stage/stage-choreography-state.test.ts`

- [ ] **Step 1: Failing target tests**

```ts
const sets = [
  { id: "a", atBeat: 0, transitionBeats: 0, spots: {} },
  { id: "b", atBeat: 16, transitionBeats: 8, spots: {} },
] as Formation[];
it("targets the active set away from any transition window", () =>
  expect(resolveArrangeTargetIndex(sets, null, 4)).toBe(0));
it("targets the destination inside its transition window", () => {
  expect(resolveArrangeTargetIndex(sets, null, 8)).toBe(1);
  expect(resolveArrangeTargetIndex(sets, null, 15)).toBe(1);
});
it("targets the set the playhead sits on", () =>
  expect(resolveArrangeTargetIndex(sets, null, 16)).toBe(1));
it("honors a pinned selection", () =>
  expect(resolveArrangeTargetIndex(sets, "a", 12)).toBe(0));
it("returns -1 with no sets", () =>
  expect(resolveArrangeTargetIndex([], null, 0)).toBe(-1));
```

- [ ] **Step 2: Implement**

```ts
export function resolveArrangeTargetIndex(
  formations,
  selectedFormationId,
  beat
): number {
  const active = resolveActiveFormationIndex(
    formations,
    selectedFormationId,
    beat
  );
  if (active < 0) return active;
  if (selectedFormationId && formations[active]!.id === selectedFormationId)
    return active;
  const next = formations[active + 1];
  if (
    next &&
    next.transitionBeats > 0 &&
    beat >= next.atBeat - next.transitionBeats
  )
    return active + 1;
  return active;
}
```

- [ ] **Step 3: Failing state tests**

```ts
it("scales the set about its centroid and clamps to the floor", () => {
  const state = createStageChoreographyState();
  const set = state.choreography.formations[0]!;
  const before = JSON.parse(JSON.stringify(set.spots));
  expect(state.transformFormationSpots(set.id, { scale: 1.15 })).toBe(true);
  const ids = Object.keys(before);
  const cx = ids.reduce((s, id) => s + before[id].x, 0) / ids.length;
  for (const id of ids) {
    expect(set.spots[id]!.x).toBeCloseTo(
      Math.min(
        state.choreography.stageWidth,
        Math.max(0, cx + (before[id].x - cx) * 1.15)
      ),
      6
    );
  }
  expect(set.presetId).toBe("custom");
  state.undo();
  expect(state.choreography.formations[0]!.spots).toEqual(before);
});
it("shifts every spot and pushes a single undo entry", () => {
  const state = createStageChoreographyState();
  const set = state.choreography.formations[0]!;
  const before = JSON.parse(JSON.stringify(set.spots));
  const revision = state.historyRevision;
  state.transformFormationSpots(set.id, { dz: -1 });
  for (const id of Object.keys(before))
    expect(set.spots[id]!.z).toBeCloseTo(Math.max(0, before[id].z - 1), 6);
  expect(state.historyRevision).toBe(revision + 1);
});
it("returns false for an unknown set", () =>
  expect(
    createStageChoreographyState().transformFormationSpots("nope", { dx: 1 })
  ).toBe(false));
```

- [ ] **Step 4: Implement** (after `applyPresetToFormation`)

```ts
/** Spacing and nudges for TIKA's Arrange verb. One history entry, like a drag. */
function transformFormationSpots(
  formationId: string,
  transform: { scale?: number; dx?: number; dz?: number }
): boolean {
  const formation = findFormation(formationId);
  if (!formation) return false;
  const spots = Object.values(formation.spots);
  if (spots.length === 0) return false;
  const scale = transform.scale ?? 1;
  const centerX = spots.reduce((sum, spot) => sum + spot.x, 0) / spots.length;
  const centerZ = spots.reduce((sum, spot) => sum + spot.z, 0) / spots.length;
  pushUndo();
  for (const spot of spots) {
    spot.x = Math.min(
      choreography.stageWidth,
      Math.max(0, centerX + (spot.x - centerX) * scale + (transform.dx ?? 0))
    );
    spot.z = Math.min(
      choreography.stageDepth,
      Math.max(0, centerZ + (spot.z - centerZ) * scale + (transform.dz ?? 0))
    );
  }
  formation.presetId = "custom";
  normalizeFormationTrack();
  return true;
}
```

- [ ] **Step 5: Run** `npm test -- --run tests/unit/stage/active-formation.test.ts tests/unit/stage/stage-choreography-state.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit.**

---

### Task 5: Client executor module and StageModule wiring

**Files:**

- Create: `src/lib/features/stage/services/tika-director-executor.ts`
- Modify: `src/lib/features/stage/StageModule.svelte:330-440`, `src/lib/features/stage/services/tika-director-service.ts`
- Test: `tests/unit/stage/tika-director-executor.test.ts`

- [ ] **Step 1: Failing executor tests** against a real `createStageChoreographyState()` and a stub viewer `{ applyPerformerAppearanceAssignments: vi.fn(() => true), performerManager: { cancelFormationTransition: vi.fn() }, undo: vi.fn() }`:

- Arrange at count 0 with `shape: "line"` reshapes set 0 to the line preset positions (`generatePresetPositions("line", 3, 10, 8)`), adds no set, cancels the viewer transition, and the returned undo restores the spots.
- Arrange inside a transition window (author `applyFormationTransition("circle", 8, undefined, 8)` first, then arrange at beat 12 with `shape: "v-shape"`) reshapes the destination at beat 16, keeps `transitionBeats` 8, and leaves set at beat 8 alone.
- Arrange `spacing: "wider"` then `shift: "left"` in one plan: both applied, one undo call restores everything (executor calls `stageState.undo()` once per state op it made).
- Move (`formation-transition`) still adds the destination set with the count.
- Props plan calls `applyPerformerAppearanceAssignments` once and undo calls `viewer.undo`.
- Two transitions throw "competing formation moves".

- [ ] **Step 2: Implement**

```ts
export const TIKA_EXECUTED_ACTION_TYPES: ReadonlySet<string> = new Set([
  "assign-distinct-props",
  "assign-distinct-characters",
  "assign-distinct-sequences",
  "formation-transition",
  "arrange-formation",
]);
export interface TikaDirectorExecutionContext {
  stageState: Pick<
    StageChoreographyState,
    | "choreography"
    | "assertFormationTransitionAllowed"
    | "applyFormationTransition"
    | "applyPresetToFormation"
    | "transformFormationSpots"
    | "assignPerformerSequences"
    | "undo"
  >;
  viewer: {
    applyPerformerAppearanceAssignments(
      a: ViewerPerformerAppearanceAssignment[]
    ): boolean;
    performerManager: { cancelFormationTransition(): void };
    undo(): void;
  };
  requestBeat: number;
  selectedFormationId: string | null;
  seedKey: string;
  sequencePicks: readonly DirectorSequenceAssignment[];
  preloadSequence?: (sequence: SequenceData) => void;
}
const SPACING_STEP = 1.15;
const SHIFT_METRES = 1;
export function executeTikaDirectorPlan(
  response: Extract<TikaDirectorResponse, { kind: "apply" }>,
  ctx
): (() => void) | undefined;
```

Body: reject >1 transition (existing message) and arrange+transition (same set); appearance assignments as today; sequences as today; transition as today; for each arrange action in order: target = `resolveArrangeTargetIndex(formations, selectedFormationId, requestBeat)`, `shape` → `applyPresetToFormation(target.id, shape)` (counts as one stage undo), `spacing` → `transformFormationSpots(target.id, { scale: wider ? SPACING_STEP : 1 / SPACING_STEP })`, `shift` → `{ dx: left ? -1 : right ? 1 : 0, dz: forward ? -1 : back ? 1 : 0 }`; then `viewer.performerManager.cancelFormationTransition()`. Track `stageUndoCount`; the returned closure calls `stageState.undo()` that many times, then `viewer.undo()` if the viewer changed.

- [ ] **Step 3: Wire StageModule.** Replace the apply closure body in `directStageWithTika` with a call to `executeTikaDirectorPlan(response, { stageState, viewer, requestBeat, selectedFormationId: editMode.selectedFormationId, seedKey: \`${choreography.id}:${prompt}\`, sequencePicks, preloadSequence: (s) => preloadedSequences.set(s.id, s) })`. Pass `{ currentBeat: input.currentBeat }`to`interpretStageDirectionLocally` in the service.

- [ ] **Step 4: Run** `npm test -- --run tests/unit/stage/`. Expected: PASS including the contract test.

- [ ] **Step 5: Commit.**

---

### Task 6: Live battery cases and registry baselines

**Files:**

- Modify: `scripts/tika/verify-director-live.ts`

- [ ] **Step 1: Add helpers**

```ts
type Arrange = Extract<TikaDirectorAction, { type: "arrange-formation" }>;
const arrangeExactly = (fields: Partial<Arrange>[]) => (r) => {
  assert.equal(r.kind, "apply", JSON.stringify(r));
  if (r.kind !== "apply") return;
  const arranges = r.actions.filter(
    (a): a is Arrange => a.type === "arrange-formation"
  );
  assert.equal(arranges.length, fields.length, JSON.stringify(r));
  assert.equal(r.actions.length, fields.length, JSON.stringify(r));
  fields.forEach((f, i) =>
    assert.deepEqual(
      arranges[i],
      { type: "arrange-formation", ...f },
      JSON.stringify(r)
    )
  );
};
```

- [ ] **Step 2: Flip** "adv missing duration" → `arrangeExactly([{ shape: "circle" }])`; "missing timing compound" → `exactly(["assign-distinct-props", "arrange-formation"])`; "adv instantly" → `arrangeExactly([{ shape: "circle" }])`.

- [ ] **Step 3: Add cases** (names start with `arrange` so `--grep=arrange` selects them): "arrange polite line" ("Could you put them in a line"), "arrange bare line" ("line"), "arrange circle please", "arrange move to V" ("move to a V"), "arrange go to circle", "arrange a bit wider", "arrange tighter", "arrange shift left" ("shift them left"), "arrange wider circle" → `[{shape:"circle"},{spacing:"wider"}]`, "arrange then move" ("wider, then a circle over 8") → `noApply`, "arrange more after wider" (conversation: user "a bit wider", assistant "Spread the cast wider at count 8." then prompt "more") → `arrangeExactly([{ spacing: "wider" }])`, "arrange line with count stays move" ("line over 8 counts") → `formationExactly("line", 8)`, "arrange now answer" (conversation: user "transition to a circle", assistant "Arrange them in a circle now, or move over how many counts?" then prompt "now") → `arrangeExactly([{ shape: "circle" }])`.

- [ ] **Step 4: Registry baselines.** After `cases` is built, append for every capability example:

```ts
for (const capability of TIKA_CAPABILITIES) {
  capability.examples.forEach((example, index) => {
    cases.push({
      name: `example ${capability.type} ${index + 1}`,
      prompt: example.user,
      conversation: example.conversation,
      scene: example.scene,
      check: (r) => {
        assert.equal(r.kind, example.response.kind, JSON.stringify(r));
        if (r.kind === "apply" && example.response.kind === "apply")
          assert.deepEqual(
            actionTypes(r),
            example.response.actions.map((a) => a.type).sort()
          );
      },
    });
  });
}
```

- [ ] **Step 5: Type-check the script** with `node --import tsx -e "import('./scripts/tika/verify-director-live.ts').catch(e => { if (!/--live/.test(String(e))) throw e; })"` (the `--live` guard throwing is the expected outcome). Commit.

---

### Task 7: Live verification (targeted), prettier, browser check, finish

- [ ] **Step 1:** Repoint the scratchpad wrapper `run-live.mjs` `cwd` to `E:/worktrees/tka-platform/tika-arrange-verb`. Run `--grep=arrange`, `--grep=example`, then `--case=` for: "adv missing duration", "missing timing compound", "adv instantly", "adv terse", "adv keep keep circle", "adv now suffix", "two transitions", "adv then back", "reversed formation", "clarification answer", "adv seconds not beats". Fix prompt wording on failures and rerun only the failed cases. Record input token totals.
- [ ] **Step 2:** Prettier from `E:/tka-platform` on every changed worktree path; rerun `npm test -- --run tests/unit/stage/`.
- [ ] **Step 3:** Start a worktree Vite server on port 5427 (PowerShell `Start-Process`), open `/test/stage` in a fresh Browser pane tab, type "put them in a line" into the TIKA panel, screenshot the drill chart and the timeline (one set), then "circle over 8" and screenshot (new set, 8-count transition). Stop the server in the same turn.
- [ ] **Step 4:** Full battery once (`--live` with no filter). Commit any wording fix. `git merge --no-edit main` if main moved, rerun the stage suite, then from PowerShell in `E:/tka-platform`: `npm run wt:finish -- codex/tika-arrange-verb --route /stage/scene`.
