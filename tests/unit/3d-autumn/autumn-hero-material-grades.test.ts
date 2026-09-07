import { describe, expect, it } from "vitest";

import { AUTUMN_HERO_MATERIAL_GRADES } from "../../../scripts/autumn-hero-material-grades.mjs";

describe("Autumn hero material grades", () => {
  it("keeps the pale Hero B atlas inside the foreground autumn value range", () => {
    const [right, green, left] = AUTUMN_HERO_MATERIAL_GRADES.heroB.tint;
    const luminance = right * 0.2126 + green * 0.7152 + left * 0.0722;

    expect(right / left).toBeGreaterThan(2.3);
    expect(luminance).toBeLessThan(0.61);
    expect(right).toBeGreaterThan(green);
    expect(green).toBeGreaterThan(left);
  });

  it("retains separate red and copper hero families", () => {
    expect(AUTUMN_HERO_MATERIAL_GRADES.heroA.tint).not.toEqual(
      AUTUMN_HERO_MATERIAL_GRADES.heroB.tint
    );
    expect(AUTUMN_HERO_MATERIAL_GRADES.heroB.roughnessFloor).toBeGreaterThan(
      AUTUMN_HERO_MATERIAL_GRADES.heroA.roughnessFloor
    );
  });
});
