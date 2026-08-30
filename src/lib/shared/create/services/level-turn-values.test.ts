import { describe, expect, it } from "vitest";
import {
  clampMaxTurnIntensity,
  clampTurnToLevel,
  levelForTurnValue,
  levelForTurns,
  maxTurnIntensitiesForLevel,
  turnValuesForLevel,
} from "./level-turn-values";

describe("turnValuesForLevel", () => {
  it("gives Level 1 base motions only", () => {
    expect(turnValuesForLevel(1)).toEqual([0]);
  });

  it("gives Level 2 whole turns", () => {
    expect(turnValuesForLevel(2)).toEqual([0, 1, 2, 3]);
  });

  it("places the Level 3 float immediately before 0", () => {
    expect(turnValuesForLevel(3)).toEqual(["fl", 0, 0.5, 1, 1.5, 2, 2.5, 3]);
  });

  it("gives Level 4 every quarter turn and retains floats", () => {
    expect(turnValuesForLevel(4)).toEqual([
      "fl",
      0,
      0.25,
      0.5,
      0.75,
      1,
      1.25,
      1.5,
      1.75,
      2,
      2.25,
      2.5,
      2.75,
      3,
    ]);
  });

  it("clamps out-of-range levels into 1-4", () => {
    expect(turnValuesForLevel(0)).toEqual(turnValuesForLevel(1));
    expect(turnValuesForLevel(7)).toEqual(turnValuesForLevel(4));
  });
});

describe("maxTurnIntensitiesForLevel", () => {
  it("uses the same selectable ceilings as Generate", () => {
    expect(maxTurnIntensitiesForLevel(1)).toEqual([]);
    expect(maxTurnIntensitiesForLevel(2)).toEqual([1, 2, 3]);
    expect(maxTurnIntensitiesForLevel(3)).toEqual([0.5, 1, 1.5, 2, 2.5, 3]);
    expect(maxTurnIntensitiesForLevel(4)).toEqual([
      0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3,
    ]);
  });

  it("clamps a saved ceiling when the level changes", () => {
    expect(clampMaxTurnIntensity(0.5, 2)).toBe(1);
    expect(clampMaxTurnIntensity(2.5, 2)).toBe(2);
    expect(clampMaxTurnIntensity(1.5, 3)).toBe(1.5);
    expect(clampMaxTurnIntensity(2, 1)).toBe(2);
  });
});

describe("clampTurnToLevel", () => {
  it("leaves a legal value alone", () => {
    expect(clampTurnToLevel(2, 2)).toBe(2);
    expect(clampTurnToLevel("fl", 3)).toBe("fl");
    expect(clampTurnToLevel(1.5, 3)).toBe(1.5);
  });

  it("collapses a float to 0 when the level can't hold it", () => {
    expect(clampTurnToLevel("fl", 2)).toBe(0);
    expect(clampTurnToLevel("fl", 1)).toBe(0);
  });

  it("snaps half turns to the nearest whole turn at Level 2", () => {
    expect(clampTurnToLevel(1.5, 2)).toBe(1);
    expect(clampTurnToLevel(2.5, 2)).toBe(2);
  });

  it("rounds a tie down rather than inventing a bigger turn", () => {
    expect(clampTurnToLevel(0.5, 2)).toBe(0);
  });

  it("flattens everything to 0 at Level 1", () => {
    expect(clampTurnToLevel(3, 1)).toBe(0);
    expect(clampTurnToLevel(0.5, 1)).toBe(0);
    expect(clampTurnToLevel("fl", 1)).toBe(0);
  });
});

describe("levelForTurnValue", () => {
  it("maps a value to the lowest level that permits it", () => {
    expect(levelForTurnValue(0)).toBe(1);
    expect(levelForTurnValue(2)).toBe(2);
    expect(levelForTurnValue(1.5)).toBe(3);
    expect(levelForTurnValue(1.25)).toBe(4);
    expect(levelForTurnValue("fl")).toBe(3);
  });

  it("takes the higher of the two hands", () => {
    expect(levelForTurns(0, 0)).toBe(1);
    expect(levelForTurns(2, 0)).toBe(2);
    expect(levelForTurns(1, "fl")).toBe(3);
  });
});
