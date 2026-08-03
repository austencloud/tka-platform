import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UNLOCKABLE_POOL } from "$lib/shared/gamification/domain/prop-pool";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  PROP_PICKER_SECTIONS,
  getAllVariations,
  hasBigVariant,
  isBigVariant,
  isPropActive,
  toggleBigVariant,
} from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

describe("Big Fan reactivation", () => {
  it("is active and reachable from the flat prop picker", () => {
    const bigSection = PROP_PICKER_SECTIONS.find(
      (section) => section.label === "Big"
    );

    expect(isPropActive(PropType.BIGFAN)).toBe(true);
    expect(bigSection?.props).toContain(PropType.BIGFAN);
  });

  it("toggles through the shared Fan size controls", () => {
    expect(hasBigVariant(PropType.FAN)).toBe(true);
    expect(isBigVariant(PropType.BIGFAN)).toBe(true);
    expect(toggleBigVariant(PropType.FAN)).toBe(PropType.BIGFAN);
    expect(toggleBigVariant(PropType.BIGFAN)).toBe(PropType.FAN);
    expect(getAllVariations(PropType.FAN)).toEqual([
      PropType.FAN,
      PropType.BIGFAN,
    ]);
  });

  it("remains claimable if prop locking is restored", () => {
    expect(UNLOCKABLE_POOL).toContain(PropType.BIGFAN);
  });

  it("keeps the 3D grip-to-rim scale aligned with the authored 2D asset", () => {
    const scenePropSource = readFileSync(
      resolve(
        process.cwd(),
        "node_modules/@austencloud/scene-3d/src/lib/components/props/Prop3D.svelte"
      ),
      "utf8"
    );

    expect(600 / 260).toBe(30 / 13);
    expect(scenePropSource).toContain("const BIG_FAN_SCALE = 30 / 13");
    expect(scenePropSource).toContain("scale={BIG_FAN_SCALE}");
  });
});
