import { describe, expect, it } from "vitest";

import { PropType } from "../enums/prop-type";
import {
  DEFAULT_FAN_APPEARANCE,
  fanAppearanceArtwork,
  fanBuildPreviewOptions,
  compactFanLookPreviewOptions,
  normalizeFanAppearance,
  parseFanRenderKey,
  resolveFanRenderKey,
} from "../fan-appearance";

describe("fan appearance", () => {
  it("defaults to the bare DoodleGrip Fire build", () => {
    expect(normalizeFanAppearance(undefined)).toEqual({
      build: "fire",
      frameColor: "black",
      cover: "bare",
    });
    expect(resolveFanRenderKey("fan", normalizeFanAppearance(null))).toBe(
      "fan__fire_bare"
    );
  });

  it("normalizes stale persisted values without changing the default", () => {
    expect(
      normalizeFanAppearance({
        build: "unknown" as never,
        frameColor: "white",
        cover: "covered",
      })
    ).toEqual({
      build: DEFAULT_FAN_APPEARANCE.build,
      frameColor: "white",
      cover: "covered",
    });
  });

  it("keeps appearance out of choreography prop identity", () => {
    const appearance = {
      build: "lotus" as const,
      frameColor: "black" as const,
      cover: "bare" as const,
    };

    expect(resolveFanRenderKey(PropType.FAN, appearance)).toBe("fan__lotus");
    expect(resolveFanRenderKey(PropType.BIGFAN, appearance)).toBe(
      "bigfan__lotus"
    );
    expect(resolveFanRenderKey(PropType.CLUB, appearance)).toBe("club");
    expect(parseFanRenderKey("fan__lotus")).toEqual({
      propType: "fan",
      build: "lotus",
      frameColor: "black",
      cover: "bare",
    });
  });

  it("keys every visible fan modifier into the texture cache", () => {
    expect(
      resolveFanRenderKey(PropType.FAN, {
        build: "fire",
        frameColor: "black",
        cover: "covered",
      })
    ).toBe("fan__fire_covered");
    expect(
      resolveFanRenderKey(PropType.FAN, {
        build: "day",
        frameColor: "white",
        cover: "covered",
      })
    ).toBe("fan__day_white_covered");
  });

  it("maps each physical build to the shared artwork owner", () => {
    expect(fanAppearanceArtwork("pictograph")).toBeNull();
    expect(fanAppearanceArtwork("fire")).toBe(
      "/images/props/appearances/fan-fire.svg?v=2"
    );
    expect(fanAppearanceArtwork("fire", "covered")).toBe(
      "/images/props/appearances/fan-fire-covered.svg?v=2"
    );
    expect(fanAppearanceArtwork("lotus")).toBe(
      "/images/props/appearances/fan-lotus.svg?v=7"
    );
    expect(fanAppearanceArtwork("day")).toBe(
      "/images/props/appearances/fan-day.svg?v=3"
    );
    expect(fanAppearanceArtwork("day", "covered")).toBe(
      "/images/props/appearances/fan-day-covered.svg?v=3"
    );
    expect(
      fanBuildPreviewOptions(DEFAULT_FAN_APPEARANCE).find(
        ({ id }) => id === "lotus"
      )?.image
    ).toBe("/images/props/build-previews/fan-lotus-bare-complete.webp?v=6");
  });

  it("keeps the compact 2D covered fan as one direct, honest choice", () => {
    const options = compactFanLookPreviewOptions(DEFAULT_FAN_APPEARANCE);
    const covered = options.find(({ id }) => id === "covered-fire");
    const fire = options.find(({ id }) => id === "fire");

    expect(covered).toMatchObject({
      label: "Covered Fan",
      image: "/images/props/build-previews/fan-fire-covered-complete.webp",
    });
    expect(fire?.image).toBe(
      "/images/props/build-previews/fan-fire-bare-complete.webp"
    );
    expect(options.map(({ id }) => id)).not.toContain("bare");
    expect(fire?.imageScale).toBe(1.92);
    expect(options.find(({ id }) => id === "lotus")?.imageScale).toBe(1.81);
  });
});
