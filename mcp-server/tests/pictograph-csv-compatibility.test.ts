import { describe, expect, it } from "vitest";
import { NodeDataProvider } from "../src/adapters/NodeDataProvider.js";
import { ensureDataLoaded } from "../src/shared/server-context.js";

describe("pictograph CSV compatibility", () => {
  it("maps the stable blue/red CSV headers into canonical MCP motions", () => {
    const pictograph = ensureDataLoaded("diamond").find(
      (candidate) => candidate.letter === "A"
    );

    expect(pictograph?.leftMotion).toMatchObject({
      hand: "left",
      motionType: expect.any(String),
      startLocation: expect.any(String),
      endLocation: expect.any(String),
      rotationDirection: expect.any(String),
    });
    expect(pictograph?.rightMotion).toMatchObject({
      hand: "right",
      motionType: expect.any(String),
      startLocation: expect.any(String),
      endLocation: expect.any(String),
      rotationDirection: expect.any(String),
    });
    expect(pictograph?.leftMotion.motionType).not.toBe("");
    expect(pictograph?.rightMotion.motionType).not.toBe("");
  });

  it("feeds canonical letter variations to the sequence engine", async () => {
    const variations = await new NodeDataProvider(
      "diamond"
    ).loadLetterVariations("A");

    expect(variations.length).toBeGreaterThan(0);
    expect(variations[0]).toMatchObject({
      leftMotionType: expect.any(String),
      leftStartLocation: expect.any(String),
      leftEndLocation: expect.any(String),
      rightMotionType: expect.any(String),
      rightStartLocation: expect.any(String),
      rightEndLocation: expect.any(String),
    });
    expect(variations[0]!.leftMotionType).not.toBe("");
    expect(variations[0]!.rightMotionType).not.toBe("");
  });
});
