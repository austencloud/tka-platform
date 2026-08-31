import { describe, expect, it } from "vitest";
import { allocateTurns } from "../../../src/generation/turns/TurnAllocator.js";

describe("TurnAllocator hard output constraints", () => {
  it("uses the required turn value on every step for both hands", () => {
    expect(allocateTurns(4, 2, 2, { requiredTurns: 1 })).toEqual({
      left: [1, 1, 1, 1],
      right: [1, 1, 1, 1],
    });
  });

  it("rejects a required turn value unavailable at the requested level", () => {
    expect(() => allocateTurns(4, 1, 3, { requiredTurns: 1 })).toThrow(
      /unavailable at level 1/
    );
  });

  it("does not allocate float when a hard motion type must survive emission", () => {
    for (let sample = 0; sample < 100; sample++) {
      const allocation = allocateTurns(8, 3, 3, { allowFloat: false });
      expect(allocation.left).not.toContain("fl");
      expect(allocation.right).not.toContain("fl");
    }
  });
});
