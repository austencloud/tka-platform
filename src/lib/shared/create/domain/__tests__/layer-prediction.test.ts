import { describe, expect, it } from "vitest";
import { predictLayerSignature } from "../layer-prediction";

describe("predictLayerSignature", () => {
  it("holds layer 1 when no prop ever crosses", () => {
    // Whole turns keep a prop where it is, so nothing leaves radial.
    expect(
      predictLayerSignature({
        leftStartOrientation: "in",
        rightStartOrientation: "in",
        lanes: { left: [1], right: [2] },
        length: 4,
      })
    ).toEqual({ signature: "1111", uncertain: false });
  });

  it("crosses on a half turn", () => {
    // Blue takes a half turn every step and red never does, so the pair swings
    // between both-radial and blue-alone-non-radial. That second one is layer
    // 4: layer 3 is the other way round, red non-radial and blue not.
    expect(
      predictLayerSignature({
        leftStartOrientation: "in",
        rightStartOrientation: "in",
        lanes: { left: [0.5], right: [0] },
        length: 4,
      })
    ).toEqual({ signature: "4141", uncertain: false });
  });

  it("puts red alone in layer 3, the mirror of blue alone", () => {
    expect(
      predictLayerSignature({
        leftStartOrientation: "in",
        rightStartOrientation: "in",
        lanes: { left: [0], right: [0.5] },
        length: 4,
      })
    ).toEqual({ signature: "3131", uncertain: false });
  });

  it("starts from the layer the orientations describe", () => {
    // Both props start non-radial, which is layer 2.
    expect(
      predictLayerSignature({
        leftStartOrientation: "clock",
        rightStartOrientation: "clock",
        lanes: { left: [0], right: [0] },
        length: 2,
      })
    ).toEqual({ signature: "22", uncertain: false });
  });

  it("admits it cannot know when a float is involved", () => {
    // A float crosses only on a cw/ccw hand path, which depends on the letter,
    // and no letter has been chosen yet.
    const result = predictLayerSignature({
      leftStartOrientation: "in",
      rightStartOrientation: "in",
      lanes: { left: ["fl"], right: [0] },
      length: 2,
    });
    expect(result.uncertain).toBe(true);
  });

  it("has nothing to say when a lane is empty", () => {
    expect(
      predictLayerSignature({
        leftStartOrientation: "in",
        rightStartOrientation: "in",
        lanes: { left: [], right: [] },
        length: 4,
      })
    ).toEqual({ signature: "", uncertain: false });
  });
});
