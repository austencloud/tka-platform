import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PropSvgLoader } from "./prop-svg-loader";
import type { MotionData } from "../../shared/domain/models/motion-data";
import type { PropPlacementData } from "../domain/models/prop-placement-data";
import { HandSide } from "../../shared/domain/enums/pictograph-enums";
import { getMotionColor } from "$lib/shared/utils/svg-color-utils";

// The pictographs draw the same fan build the animator does. Picking
// DoodleGrip Fire in the Fan chooser used to change only the animation
// canvas and the 3D scene, while every pictograph kept drawing the generic
// fan, because this loader built its path from the prop type alone.

const root = process.cwd();

class StaticFileLoader extends PropSvgLoader {
  readonly fetched: string[] = [];
  override async fetchSvgContent(href: string): Promise<string> {
    this.fetched.push(href);
    const file = href.replace(/\?.*$/, "");
    return fs.readFileSync(path.join(root, "static", file), "utf8");
  }
}

const placement: PropPlacementData = {
  positionX: 475,
  positionY: 475,
  rotationAngle: 0,
} as PropPlacementData;

function motion(propType: string, hand: HandSide): MotionData {
  return { propType, hand } as unknown as MotionData;
}

describe("PropSvgLoader fan builds", () => {
  it("draws the chosen fan build in the hand color and leaves its materials alone", async () => {
    const loader = new StaticFileLoader();
    const result = await loader.loadPropSvg(
      placement,
      motion("fan", HandSide.RIGHT),
      false,
      {
        themeMode: "dark",
        fanAppearance: { build: "fire", frameColor: "black", cover: "covered" },
      }
    );

    expect(loader.fetched[0]).toMatch(/\/appearances\/fan-fire-covered\.svg/);
    const svg = result.svgData!.svgContent;
    const red = getMotionColor(HandSide.RIGHT, "dark");
    expect(svg).toContain(`data-fan-frame="" fill="none" stroke="${red}"`);
    // Kevlar wick and the fitted cover keep their physical colors.
    expect(svg).toMatch(/data-fire-wick="[^"]*" fill="#f5e6b8"/);
    expect(svg).toContain('data-fan-cover=""');
    expect(svg).not.toContain('fill="#df255f"'.replace("#df255f", red));
    expect(result.svgData!.viewBox).toEqual({ width: 260, height: 207 });
    expect(result.svgData!.center).toEqual({ x: 130, y: 103.5 });
  });

  it("scales the build into Big Fan's box so placement stays on the same pivot", async () => {
    const loader = new StaticFileLoader();
    const result = await loader.loadPropSvg(
      placement,
      motion("bigfan", HandSide.LEFT),
      false,
      { themeMode: "dark", fanAppearance: { build: "day", frameColor: "white", cover: "bare" } }
    );

    expect(loader.fetched[0]).toMatch(/\/appearances\/fan-day\.svg/);
    expect(result.svgData!.viewBox).toEqual({ width: 600, height: 566.9 });
    expect(result.svgData!.svgContent).toContain('scale(1.8461538)');
  });

  it("keeps the pictograph fan for the Pictograph build and for non-fan props", async () => {
    const loader = new StaticFileLoader();
    await loader.loadPropSvg(placement, motion("fan", HandSide.LEFT), false, {
      themeMode: "dark",
      fanAppearance: { build: "pictograph", frameColor: "black", cover: "bare" },
    });
    await loader.loadPropSvg(placement, motion("staff", HandSide.LEFT), false, {
      themeMode: "dark",
      fanAppearance: { build: "fire", frameColor: "black", cover: "bare" },
    });
    expect(loader.fetched).toEqual([
      "/images/props/pictograph/fan.svg",
      "/images/props/pictograph/staff.svg",
    ]);
  });

  it("does not serve one build's cached artwork for another", async () => {
    const loader = new StaticFileLoader();
    const fire = await loader.loadPropSvg(placement, motion("fan", HandSide.LEFT), false, {
      themeMode: "dark",
      fanAppearance: { build: "fire", frameColor: "black", cover: "bare" },
    });
    const lotus = await loader.loadPropSvg(placement, motion("fan", HandSide.LEFT), false, {
      themeMode: "dark",
      fanAppearance: { build: "lotus", frameColor: "black", cover: "bare" },
    });
    const big = await loader.loadPropSvg(placement, motion("bigfan", HandSide.LEFT), false, {
      themeMode: "dark",
      fanAppearance: { build: "fire", frameColor: "black", cover: "bare" },
    });
    expect(fire.svgData!.svgContent).not.toEqual(lotus.svgData!.svgContent);
    expect(fire.svgData!.viewBox).not.toEqual(big.svgData!.viewBox);
  });
});
