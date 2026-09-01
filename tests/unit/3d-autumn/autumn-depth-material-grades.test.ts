import { describe, expect, it } from "vitest";
import { AUTUMN_DEPTH_MATERIAL_GRADES } from "../../../scripts/autumn-depth-material-grades.mjs";

describe("Autumn depth material grades", () => {
  it("keeps every imported depth family inside one warm palette", () => {
    const profiles = Object.values(AUTUMN_DEPTH_MATERIAL_GRADES);

    expect(profiles.map(({ prefix }) => prefix)).toEqual([
      "Autumn Birch PBR",
      "Autumn Larch PBR",
      "Autumn Snag PBR",
      "Autumn Willow PBR",
    ]);

    for (const profile of profiles) {
      const [right, green, left, alpha] = profile.tint;
      expect(right).toBeGreaterThan(green);
      expect(right).toBeGreaterThan(left);
      expect(Math.max(right, green, left)).toBeLessThanOrEqual(1);
      expect(alpha).toBe(1);
      expect(profile.roughnessFloor).toBeGreaterThanOrEqual(0.84);
      expect(profile.normalScale).toBeLessThanOrEqual(0.66);
    }
  });

  it("keeps the gold larch distinct without returning to silver", () => {
    const { larch, birch, willow, snag } = AUTUMN_DEPTH_MATERIAL_GRADES;

    expect(larch.tint[0]).toBe(1);
    expect(larch.tint[2]).toBeLessThan(0.3);
    expect(birch.tint[1]).toBeLessThan(0.55);
    expect(willow.tint[2]).toBeLessThan(0.35);
    expect(snag.tint[0]).toBeLessThan(0.5);
  });
});
