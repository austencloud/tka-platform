import { describe, expect, it } from "vitest";
import { areStartPositionsEquivalent } from "$lib/features/create/construct/start-position-picker/services/start-position-equivalence";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

function position({
  id,
  startPosition,
  blueLocation = "n",
  blueOrientation = "in",
  redLocation = "s",
  redOrientation = "in",
}: {
  id: string;
  startPosition?: string;
  blueLocation?: string;
  blueOrientation?: string;
  redLocation?: string;
  redOrientation?: string;
}): PictographData {
  return {
    id,
    letter: startPosition ? (startPosition[0] as never) : null,
    startPosition: startPosition as never,
    gridMode: "diamond",
    motions: {
      blue: {
        endLocation: blueLocation,
        endOrientation: blueOrientation,
        gridMode: "diamond",
        isVisible: true,
      } as never,
      red: {
        endLocation: redLocation,
        endOrientation: redOrientation,
        gridMode: "diamond",
        isVisible: true,
      } as never,
    },
  };
}

describe("start position equivalence", () => {
  it("ignores object identity and render metadata for a canonical pose", () => {
    expect(
      areStartPositionsEquivalent(
        position({ id: "render-a", startPosition: "gamma15" }),
        position({ id: "render-b", startPosition: "gamma15" })
      )
    ).toBe(true);
  });

  it("rejects a different canonical variation", () => {
    expect(
      areStartPositionsEquivalent(
        position({ id: "current", startPosition: "gamma15" }),
        position({ id: "submitted", startPosition: "gamma13" })
      )
    ).toBe(false);
  });

  it("compares both hand boundaries for a custom pose", () => {
    const current = position({ id: "current" });

    expect(
      areStartPositionsEquivalent(current, position({ id: "same-pose" }))
    ).toBe(true);
    expect(
      areStartPositionsEquivalent(
        current,
        position({ id: "different-pose", redOrientation: "out" })
      )
    ).toBe(false);
  });
});
