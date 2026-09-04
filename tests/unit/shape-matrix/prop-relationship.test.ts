import { describe, expect, it } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  derivePropElementalType,
  derivePropRelationship,
} from "$lib/shared/shape-matrix/domain/prop-relationship";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { Flower } from "$lib/shared/shape-matrix/domain/flower-signature";

function flower(turns: number, style: "pro" | "anti" = "pro"): Flower {
  return {
    style,
    turns,
    ori: "in",
    grid: "diamond",
    petals: style === "pro" ? turns * 2 : turns * 2 + 2,
  };
}

function sequence(
  leftDirection: "cw" | "ccw" | "noRotation",
  rightDirection: "cw" | "ccw" | "noRotation",
  redOrientation: "in" | "out" = "in"
): SequenceData {
  return {
    steps: [
      {
        motions: {
          left: {
            startLocation: "s",
            startOrientation: "in",
            rotationDirection: leftDirection,
            turns: 0,
          },
          right: {
            startLocation: "n",
            startOrientation: redOrientation,
            rotationDirection: rightDirection,
            turns: 0,
          },
        },
      },
    ],
  } as unknown as SequenceData;
}

describe("prop relationship", () => {
  it("keeps direction but withholds timing when turn amounts differ", () => {
    expect(
      derivePropRelationship(sequence("cw", "cw"), {
        left: flower(1),
        right: flower(1.5),
      })
    ).toEqual({
      kind: "direction-only",
      direction: "same",
      timing: null,
      element: null,
    });
  });

  it("classifies equal-rate rotating props with their own element", () => {
    const result = derivePropRelationship(sequence("cw", "cw"), {
      left: flower(1),
      right: flower(1),
    });
    expect(result.kind).toBe("full");
    if (result.kind === "full") expect(result.element.element).toBe("water");
  });

  it("adapts a sequence directly for ordinary viewer annotations", () => {
    expect(derivePropElementalType(sequence("cw", "cw"))).toBe("water");
  });

  it("does not invent direction or timing for float", () => {
    const float: Flower = {
      style: "float",
      turns: "fl",
      ori: "in",
      grid: "diamond",
      petals: 0,
    };
    expect(
      derivePropRelationship(sequence("noRotation", "noRotation"), {
        left: float,
        right: float,
      })
    ).toEqual({ kind: "float", direction: null, timing: null, element: null });
  });
});
