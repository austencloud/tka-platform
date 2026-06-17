import { describe, it, expect } from "vitest";
import { TYPE1_ROTATION, type VtgGroup } from "@tka/domain";

const lettersIn = (g: VtgGroup) =>
  Object.entries(TYPE1_ROTATION)
    .filter(([, v]) => v.vtgGroup === g)
    .map(([k]) => k)
    .sort();

const patternsIn = (g: VtgGroup) =>
  Object.values(TYPE1_ROTATION)
    .filter((v) => v.vtgGroup === g)
    .map((v) => v.rotationPattern)
    .sort();

describe("TYPE1_ROTATION canonical data", () => {
  it("covers exactly the 22 Type 1 letters A-V", () => {
    expect(Object.keys(TYPE1_ROTATION).sort()).toEqual(
      "ABCDEFGHIJKLMNOPQRSTUV".split("").sort()
    );
  });

  it("symmetric groups each have one pro, one anti, one hybrid", () => {
    for (const g of ["ss", "so", "ts", "to"] as VtgGroup[]) {
      expect(patternsIn(g)).toEqual(["anti", "hybrid", "pro"]);
    }
  });

  it("quarter-same is exactly S, T, U, V", () => {
    expect(lettersIn("qs")).toEqual(["S", "T", "U", "V"]);
  });

  it("quarter-same is the only group with two hybrids (U, V)", () => {
    const hybridLetters = Object.entries(TYPE1_ROTATION)
      .filter(([, v]) => v.rotationPattern === "hybrid")
      .map(([k]) => k);
    expect(hybridLetters.sort()).toEqual("CFILORUV".split("").sort());
    expect(TYPE1_ROTATION.U.leaderRotation).toBe("pro");
    expect(TYPE1_ROTATION.V.leaderRotation).toBe("anti");
  });

  it("leaderRotation is present IFF the group is quarter-same", () => {
    for (const [letter, entry] of Object.entries(TYPE1_ROTATION)) {
      const hasLeader = entry.leaderRotation !== undefined;
      const isQs = entry.vtgGroup === "qs";
      expect(hasLeader, `${letter} leaderRotation vs qs`).toBe(isQs);
    }
  });

  it("quarter-opposite M-R have NO leader/follower (the M-R correction)", () => {
    for (const letter of "MNOPQR".split("")) {
      expect(TYPE1_ROTATION[letter].leaderRotation).toBeUndefined();
    }
  });

  it("rotationPattern counts: 7 pro, 7 anti, 8 hybrid = 22", () => {
    const count = (p: string) =>
      Object.values(TYPE1_ROTATION).filter((v) => v.rotationPattern === p).length;
    expect(count("pro")).toBe(7);
    expect(count("anti")).toBe(7);
    expect(count("hybrid")).toBe(8);
  });
});
