/** Opt-in provider check. Uses synthetic scene data and never executes a plan. */
import assert from "node:assert/strict";
import { TikaModelProvider } from "../../src/lib/features/tika/services/tika-model-provider";
import { planStageDirection } from "../../src/lib/features/stage/services/server/tika-director-planner";
import { reviewStageDirection } from "../../src/lib/features/stage/services/server/tika-director-reviewer";
import type {
  TikaDirectorRequest,
  TikaDirectorResponse,
} from "../../src/lib/features/stage/domain/tika-director";

if (!process.argv.includes("--live")) {
  throw new Error(
    "Pass --live with ANTHROPIC_API_KEY set to run this billed, synthetic provider check."
  );
}
assert(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY is required");
const modelKey =
  process.argv.find((arg) => arg.startsWith("--model="))?.slice(8) ??
  "sonnet-5";
const model = new TikaModelProvider(process.env.ANTHROPIC_API_KEY, "").getModel(
  modelKey
);
const reviewer = new TikaModelProvider(
  process.env.ANTHROPIC_API_KEY,
  ""
).getModel("sonnet-5");
const scene: TikaDirectorRequest["scene"] = {
  id: "synthetic-review",
  name: "Synthetic review",
  bpm: 120,
  currentBeat: 8,
  performers: ["A", "B", "C"].map((label) => ({
    id: label,
    label,
    characterId: "x-bot",
    prop: "staff",
  })),
  formations: [{ atBeat: 0, presetId: "line" }],
};
const cases: Array<{
  name: string;
  prompt: string;
  conversation?: TikaDirectorRequest["conversation"];
  scene?: Partial<TikaDirectorRequest["scene"]>;
  check: (response: TikaDirectorResponse) => void;
}> = [
  {
    name: "distinct props",
    prompt: "Please give each person their own different prop.",
    check: (r) => {
      assert.equal(r.kind, "apply");
      if (r.kind === "apply")
        assert.deepEqual(r.actions, [{ type: "assign-distinct-props" }]);
    },
  },
  {
    name: "reversed formation",
    prompt: "Transition from circle to V shape over four beats.",
    check: (r) => {
      assert.equal(r.kind, "apply");
      if (r.kind === "apply")
        assert.deepEqual(r.actions, [
          {
            type: "formation-transition",
            startFormation: "circle",
            endFormation: "v-shape",
            durationBeats: 4,
          },
        ]);
    },
  },
  {
    name: "negation",
    prompt: "Do not give every performer a different prop.",
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "unchanged avatars",
    prompt: "Give everyone different props but keep their avatars unchanged.",
    check: (r) => {
      assert.equal(r.kind, "apply");
      if (r.kind === "apply")
        assert.deepEqual(r.actions, [{ type: "assign-distinct-props" }]);
    },
  },
  {
    name: "subset",
    prompt: "Give only performer A a different prop; leave B and C alone.",
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "missing timing compound",
    prompt: "Give everyone different props and transition to a circle.",
    check: (r) => assert.equal(r.kind, "clarify"),
  },
  {
    name: "excluded catalog",
    prompt: "Give everyone different props but never use fans.",
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "explanation only",
    prompt: "Explain how I could give everyone different props.",
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "unsupported compound",
    prompt: "Make every avatar different and turn off the lights.",
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "gender clarification",
    prompt: "Make all the avatars female.",
    check: (r) => assert.equal(r.kind, "clarify"),
  },
  {
    name: "clarification answer",
    prompt: "Yes, make every avatar different and leave gender unconstrained.",
    conversation: [
      { role: "user", content: "Make all the avatars female and different." },
      {
        role: "assistant",
        content:
          "I cannot filter gender. Should I assign different avatars without that constraint?",
      },
    ],
    check: (r) => {
      assert.equal(r.kind, "apply");
      if (r.kind === "apply")
        assert.deepEqual(r.actions, [{ type: "assign-distinct-characters" }]);
    },
  },
  {
    name: "context preserves exclusion",
    prompt: "Okay, make every prop different.",
    conversation: [
      { role: "user", content: "Never use fans in this scene." },
      {
        role: "assistant",
        content:
          "The available action cannot exclude fans. Would you like to remove that restriction?",
      },
    ],
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "two transitions",
    prompt: "Go from V to circle over 4 beats, then line over 8 beats.",
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "delayed start",
    prompt: "In eight beats, transition to circle over four beats.",
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "holdout preserved props with transition",
    prompt: "Transition to a circle over four beats, do not change the props.",
    check: (r) => {
      assert.equal(r.kind, "apply");
      if (r.kind === "apply")
        assert.deepEqual(r.actions, [
          {
            type: "formation-transition",
            endFormation: "circle",
            durationBeats: 4,
          },
        ]);
    },
  },
  {
    name: "holdout compound cast assignment",
    prompt:
      "Please give everyone distinct avatars and distinct props, using the entire available catalogs.",
    check: (r) => {
      assert.equal(r.kind, "apply");
      if (r.kind === "apply")
        assert.deepEqual(r.actions.map((a) => a.type).sort(), [
          "assign-distinct-characters",
          "assign-distinct-props",
        ]);
    },
  },
  {
    name: "holdout old constraint",
    prompt: "Give every performer a different prop.",
    conversation: [
      { role: "user", content: "Never use fans in this scene." },
      {
        role: "assistant",
        content: "I cannot exclude fans from a distinct-prop assignment.",
      },
      ...Array.from({ length: 4 }, () => [
        { role: "user" as const, content: "Keep the scene unchanged." },
        { role: "assistant" as const, content: "No changes requested." },
      ]).flat(),
    ],
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "distinct sequences from library",
    prompt: "Give each performer their own sequence from my library.",
    scene: { librarySequenceCount: 12 },
    check: (r) => {
      assert.equal(r.kind, "apply");
      if (r.kind === "apply")
        assert.deepEqual(r.actions, [{ type: "assign-distinct-sequences" }]);
    },
  },
  {
    name: "distinct sequences after clarification (Austen transcript)",
    prompt:
      "I was hoping they could each perform a different actual flow sequence, like a different word loaded from my library. Are you capable of that?",
    conversation: [
      { role: "user", content: "Can you give each one a different sequence" },
      {
        role: "assistant",
        content:
          "Could you clarify what you mean by 'different sequence'? Do you want each performer assigned a different prop, a different avatar, or a different saved sequence?",
      },
    ],
    scene: { librarySequenceCount: 40 },
    check: (r) => {
      assert.equal(r.kind, "apply");
      if (r.kind === "apply")
        assert.deepEqual(r.actions, [{ type: "assign-distinct-sequences" }]);
    },
  },
  {
    name: "named sequence is unsupported",
    prompt: "Give performer B the sequence ABC from my library.",
    scene: { librarySequenceCount: 12 },
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "empty library refuses sequences",
    prompt: "Give everyone a different sequence from my library.",
    scene: { librarySequenceCount: 0 },
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "library smaller than cast",
    prompt: "Give each of them a different word.",
    scene: { librarySequenceCount: 2 },
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "sequences plus props compound",
    prompt: "Give everyone a different sequence and a different prop.",
    scene: { librarySequenceCount: 12 },
    check: (r) => {
      assert.equal(r.kind, "apply");
      if (r.kind === "apply")
        assert.deepEqual([...r.actions.map((a) => a.type)].sort(), [
          "assign-distinct-props",
          "assign-distinct-sequences",
        ]);
    },
  },
  {
    name: "holdout sequences by length filter",
    prompt: "Give each performer a different 8-count sequence from my library.",
    scene: { librarySequenceCount: 30 },
    check: (r) => assert.notEqual(r.kind, "apply"),
  },
  {
    name: "holdout sequence question only",
    prompt:
      "Could you give them each a different sequence, or is that not something you can do?",
    scene: { librarySequenceCount: 30 },
    check: (r) => {
      // A question about capability may be answered or applied; it must never
      // apply anything other than the single sequence action.
      if (r.kind === "apply")
        assert.deepEqual(r.actions, [{ type: "assign-distinct-sequences" }]);
    },
  },
];

let failed = 0;
let inputTokens = 0;
let outputTokens = 0;
let attempted = 0;
for (const testCase of cases) {
  if (
    process.argv.includes("--holdout") &&
    !testCase.name.startsWith("holdout")
  )
    continue;
  const selectedCase = process.argv
    .find((arg) => arg.startsWith("--case="))
    ?.slice(7);
  if (selectedCase && testCase.name !== selectedCase) continue;
  const grep = process.argv.find((arg) => arg.startsWith("--grep="))?.slice(7);
  if (grep && !testCase.name.includes(grep)) continue;
  const caseScene = { ...scene, ...testCase.scene };
  attempted++;
  const started = Date.now();
  let observed: TikaDirectorResponse | undefined;
  try {
    const result = await planStageDirection(
      model,
      {
        scene: caseScene,
        prompt: testCase.prompt,
        conversation: testCase.conversation ?? [],
      },
      AbortSignal.timeout(30_000)
    );
    inputTokens += result.usage.inputTokens ?? 0;
    outputTokens += result.usage.outputTokens ?? 0;
    const reviewed = await reviewStageDirection(
      reviewer,
      {
        scene: caseScene,
        prompt: testCase.prompt,
        conversation: testCase.conversation ?? [],
      },
      result.response,
      AbortSignal.timeout(30_000)
    );
    inputTokens += reviewed.usage?.inputTokens ?? 0;
    outputTokens += reviewed.usage?.outputTokens ?? 0;
    observed = reviewed.response;
    testCase.check(reviewed.response);
    console.log(
      JSON.stringify({
        case: testCase.name,
        pass: true,
        ms: Date.now() - started,
        response: reviewed.response,
      })
    );
  } catch (cause) {
    failed++;
    // Provider exceptions can carry request credentials; print only a safe type.
    const generatedText =
      cause &&
      typeof cause === "object" &&
      "text" in cause &&
      typeof cause.text === "string"
        ? cause.text.slice(0, 1200)
        : undefined;
    console.log(
      JSON.stringify({
        case: testCase.name,
        pass: false,
        error: cause instanceof Error ? cause.name : "UnknownError",
        response: observed,
        generatedText,
      })
    );
  }
}
console.log(
  JSON.stringify({
    model: modelKey,
    passed: attempted - failed,
    failed,
    inputTokens,
    outputTokens,
  })
);
process.exitCode = failed ? 1 : 0;
