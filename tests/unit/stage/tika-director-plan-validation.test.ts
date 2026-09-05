import { describe, expect, it } from "vitest";
import { validateTikaDirectorPlanTiming } from "$lib/features/stage/domain/tika-director-plan-validation";
import type {
  TikaDirectorConversationMessage,
  TikaDirectorResponse,
} from "$lib/features/stage/domain/tika-director";

function plan(durationBeats = 4): TikaDirectorResponse {
  return {
    kind: "apply",
    summary: "Applied props and transition.",
    actions: [
      { type: "assign-distinct-props" },
      { type: "formation-transition", endFormation: "circle", durationBeats },
    ],
  };
}

function validate(
  prompt: string,
  duration = 4,
  conversation: TikaDirectorConversationMessage[] = []
) {
  return validateTikaDirectorPlanTiming(
    { prompt, conversation },
    plan(duration)
  );
}

describe("TIKA plan timing admission", () => {
  it("rejects the observed invented playhead duration atomically", () => {
    const result = validate(
      "Give everyone different props and transition to a circle",
      8
    );
    expect(result.kind).toBe("clarify");
    expect(result).not.toHaveProperty("actions");
  });

  it.each([
    ["Transition to a circle over 4 beats", 4],
    ["Transition to a circle in four beats", 4],
    ["Move to a circle for sixty-four beats", 64],
    ["Move to a circle over twenty one beats", 21],
    ["Over four beats, transition to a circle", 4],
    [
      "Give everyone different props and transition to a circle over four beats",
      4,
    ],
  ])("admits grounded timing unchanged: %s", (prompt, duration) => {
    const response = plan(duration);
    expect(
      validateTikaDirectorPlanTiming({ prompt, conversation: [] }, response)
    ).toBe(response);
  });

  it.each([
    // The Stage timeline labels beats as counts.
    ["Transition to a circle over 8 counts", 8],
    ["Go to a V in 16 counts", 16],
    // A bare number after over/in is beats on a Stage; only a foreign unit is not.
    ["keep the props, keep the avatars, circle over 4", 4],
    // Verbless single-clause phrasings still pin their one duration to the move.
    ["from a row to a ring over 4 beats", 4],
    ["4 beats circle", 4],
    ["snap them into a circle over 1 beat", 1],
    ["form a chevron over 4 beats", 4],
    [
      "ok so put them in a line then have them go to a circle over 8 counts and also give everyone different props",
      8,
    ],
  ])(
    "admits counts, bare numbers, and verbless clauses: %s",
    (prompt, duration) => {
      const response = plan(duration);
      expect(
        validateTikaDirectorPlanTiming({ prompt, conversation: [] }, response)
      ).toBe(response);
    }
  );

  it.each([
    "move to a circle over 4 seconds",
    "transition to a circle over two bars",
    "transition to a circle over 4 measures",
    "circle over 4.5 beats",
  ])("still rejects foreign or fractional units: %s", (prompt) => {
    expect(validate(prompt, 4).kind).toBe("clarify");
  });

  it("keeps timing attached to the transition when a later clause preserves props", () => {
    const response: TikaDirectorResponse = {
      kind: "apply",
      summary: "Transitioned to a circle over four beats.",
      actions: [
        {
          type: "formation-transition",
          endFormation: "circle",
          durationBeats: 4,
        },
      ],
    };
    expect(
      validateTikaDirectorPlanTiming(
        {
          prompt:
            "Transition to a circle over four beats, do not change the props",
          conversation: [],
        },
        response
      )
    ).toBe(response);
  });

  it.each([
    "Transition to a circle",
    "Transition to a circle over four beats, not eight",
    "Give everyone different props for eight beats and transition to a circle",
    "Transition to a circle and give everyone different props for eight beats",
    "Earlier we moved to a line over eight beats. Now transition to a circle",
    "Move to a circle over eight beats then to a line over four beats",
    "Transition to a circle over 0 beats",
    "Transition to a circle over 65 beats",
    "Transition to a circle over 1.5 beats",
    "Transition to a circle over -8 beats",
  ])(
    "rejects missing, unrelated, ambiguous, or mismatched timing: %s",
    (prompt) => {
      expect(validate(prompt, 8).kind).toBe("clarify");
    }
  );

  it.each([
    "In eight beats, transition to a circle over four beats",
    "At beat12, transition to a circle over four beats",
    "At beat twelve, transition to a circle over four beats",
    "Wait eight beats then move to a circle over four beats",
    "After eight beats move to a circle over four beats",
  ])("rejects unrepresentable delayed starts: %s", (prompt) => {
    const result = validate(prompt);
    expect(result.kind).toBe("unsupported");
    expect(result).not.toHaveProperty("actions");
  });

  const clarification: TikaDirectorConversationMessage[] = [
    {
      role: "user",
      content: "Give everyone different props and transition to a circle",
    },
    {
      role: "assistant",
      content: "How many beats should the transition take?",
    },
  ];
  it.each(["4", "four", "four beats", "Over four beats."])(
    "accepts immediate duration answer: %s",
    (prompt) => {
      expect(validate(prompt, 4, clarification).kind).toBe("apply");
    }
  );

  it("does not borrow timing from a completed command in history", () => {
    expect(
      validate("Now move to a circle", 8, [
        { role: "user", content: "Move to a line over eight beats" },
        { role: "assistant", content: "Applied line over eight beats." },
      ]).kind
    ).toBe("clarify");
  });

  it("accepts a repeated duration after a direct clarification without looping", () => {
    expect(
      validate("four", 4, [
        {
          role: "user",
          content:
            "Transition to a circle over four beats, do not change the props",
        },
        {
          role: "assistant",
          content: "How many beats should the transition take?",
        },
      ]).kind
    ).toBe("apply");
  });

  it("requires an unresolved immediate clarification, not any historical question", () => {
    expect(
      validate("4", 4, [
        ...clarification,
        { role: "user", content: "Make every avatar different" },
        { role: "assistant", content: "Applied distinct avatars." },
      ]).kind
    ).toBe("clarify");
    expect(
      validate("4", 4, [
        { role: "user", content: "Transition to a circle over eight beats" },
        { role: "assistant", content: "Applied eight beats. Anything else?" },
      ]).kind
    ).toBe("clarify");
  });

  it("does not change clarification, unsupported, or appearance-only responses", () => {
    const responses: TikaDirectorResponse[] = [
      { kind: "clarify", question: "Which formation?" },
      { kind: "unsupported", message: "Cannot do that." },
      {
        kind: "apply",
        summary: "Applied props.",
        actions: [{ type: "assign-distinct-props" }],
      },
    ];
    for (const response of responses) {
      expect(
        validateTikaDirectorPlanTiming(
          { prompt: "Make every prop different", conversation: [] },
          response
        )
      ).toBe(response);
    }
  });
});
