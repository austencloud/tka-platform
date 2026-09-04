import { describe, expect, it } from "vitest";

import { interpretStageDirectionLocally } from "$lib/features/stage/domain/tika-director-interpreter";
import { TIKA_DIRECTOR_FORMATIONS } from "$lib/features/stage/domain/tika-director";

describe("TIKA Stage direction interpreter", () => {
  it.each([
    [
      "Give every performer in this scene a different prop",
      "assign-distinct-props",
    ],
    ["Give every performer a different prop", "assign-distinct-props"],
    [
      "Every character should be a different avatar",
      "assign-distinct-characters",
    ],
    ["Make every avatar different", "assign-distinct-characters"],
  ])("recognizes the complete cast command: %s", (prompt, type) => {
    expect(interpretStageDirectionLocally(prompt)).toMatchObject({
      kind: "apply",
      actions: [{ type }],
    });
  });

  it.each([
    "Put them all in a V shape and have them transition to a circle over 4 beats",
    "Put them in a V shape, then transition to a circle over 4 beats",
    "Put them in a V shape and transition to a circle over 4 beats",
  ])("preserves the flagship formation command: %s", (prompt) => {
    expect(interpretStageDirectionLocally(prompt)).toMatchObject({
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

  const orderedPairs = TIKA_DIRECTOR_FORMATIONS.flatMap((start) =>
    TIKA_DIRECTOR_FORMATIONS.filter((end) => end !== start).map(
      (end) => [start, end] as const
    )
  );
  it.each(orderedPairs)(
    "preserves requested order from %s to %s",
    (start, end) => {
      expect(
        interpretStageDirectionLocally(
          `Transition from a ${start} to a ${end} over 4 beats`
        )
      ).toMatchObject({
        kind: "apply",
        actions: [
          {
            type: "formation-transition",
            startFormation: start,
            endFormation: end,
            durationBeats: 4,
          },
        ],
      });
    }
  );

  it.each(["2x2 grid", "2×2 grid", "two by two grid"])(
    "treats %s as one destination, not two formations",
    (alias) => {
      const result = interpretStageDirectionLocally(
        `Move to a ${alias} over 4 beats`
      );
      expect(result).toMatchObject({
        kind: "apply",
        actions: [
          {
            type: "formation-transition",
            endFormation: "grid-2x2",
            durationBeats: 4,
          },
        ],
      });
      if (result?.kind === "apply")
        expect(result.actions[0]).not.toHaveProperty("startFormation");
    }
  );

  it.each([
    "Do not give every performer a different prop",
    "Never give every performer a different prop",
    "Use different avatars but keep all props the same",
    "Give only Alice and Bob different props; leave everyone else alone",
    "Give every performer a different prop, but use only staffs",
    "Give everyone different props, then transition to a circle",
    "Give every performer a different prop and turn off the lights",
    "Use different props and different avatars, then move to a circle in 8 beats",
    "Move from a V to a circle over 4 beats, then to a line over 8 beats",
    "In 8 beats, move to a circle over 4 beats",
    "Only if there are eight performers, give everyone different props",
    "What would happen if I gave everyone different props?",
    "Give every performer a different prop?",
    "Make all of the avatars female and give them different props",
    "Make every avatar different and leave gender unconstrained",
    "Transition to a circle",
    "Make the lighting feel haunted",
    "Move to a circle over 0 beats",
    "Move to a circle over 65 beats",
    "Move to a circle over 1.5 beats",
    "Move to a circle over -4 beats",
    "Move to a circle over 999999999999999999999999999999 beats",
    "Move to a circle or a line over 4 beats",
    "Move from a circle, not a V shape, to a line over 4 beats",
    "Move to a circle over 4 beats; do not change anything yet",
  ])("defers the entire request without mutation: %s", (prompt) => {
    expect(interpretStageDirectionLocally(prompt)).toBeNull();
  });
});
