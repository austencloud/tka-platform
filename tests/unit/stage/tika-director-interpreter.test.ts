import { describe, expect, it } from "vitest";

import { interpretStageDirectionLocally } from "$lib/features/stage/domain/tika-director-interpreter";

describe("TIKA Stage direction interpreter", () => {
  it("compiles the three high-confidence Stage directions", () => {
    expect(
      interpretStageDirectionLocally(
        "Give every performer in this scene a different prop"
      )
    ).toMatchObject({
      kind: "apply",
      actions: [{ type: "assign-distinct-props" }],
    });
    expect(
      interpretStageDirectionLocally(
        "Every character should be a different avatar"
      )
    ).toMatchObject({
      kind: "apply",
      actions: [{ type: "assign-distinct-characters" }],
    });
    expect(
      interpretStageDirectionLocally(
        "Put them all in a V shape and have them transition to a circle over 4 beats"
      )
    ).toMatchObject({
      kind: "apply",
      actions: [
        {
          type: "formation-transition",
          startFormation: "v-shape",
          endFormation: "circle",
          durationBeats: 4,
        },
      ],
    });
  });

  it("combines independent cast and blocking instructions in one plan", () => {
    const result = interpretStageDirectionLocally(
      "Use different props and different avatars, then move to a circle in 8 beats"
    );

    expect(result).toMatchObject({
      kind: "apply",
      actions: [
        { type: "assign-distinct-props" },
        { type: "assign-distinct-characters" },
        {
          type: "formation-transition",
          endFormation: "circle",
          durationBeats: 8,
        },
      ],
    });
  });

  it("asks instead of inferring gender from avatar appearance", () => {
    const result = interpretStageDirectionLocally(
      "Make all of the avatars female and give them different props"
    );

    expect(result).toMatchObject({
      kind: "clarify",
    });
    expect(result).not.toHaveProperty("actions");
  });

  it("defers incomplete or unknown intent to the model", () => {
    expect(interpretStageDirectionLocally("Transition to a circle")).toBeNull();
    expect(
      interpretStageDirectionLocally("Make the lighting feel haunted")
    ).toBeNull();
  });
});
