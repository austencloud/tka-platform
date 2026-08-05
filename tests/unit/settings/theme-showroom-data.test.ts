import { BackgroundType } from "@austencloud/backgrounds";
import { describe, expect, it } from "vitest";

import {
  getShowroomTheme,
  SHOWROOM_THEMES,
} from "$lib/shared/settings/components/tabs/background/showroom/theme-showroom-data";

describe("theme showroom data", () => {
  it("covers every selectable environment exactly once", () => {
    const expectedTypes = [
      BackgroundType.EMBER,
      BackgroundType.COSMIC,
      BackgroundType.OCEAN,
      BackgroundType.FOREST,
      BackgroundType.WINTER,
      BackgroundType.RAINBOW,
      BackgroundType.BLOSSOM,
      BackgroundType.AUTUMN,
      BackgroundType.CELESTIAL,
      BackgroundType.VOID,
    ];

    expect(SHOWROOM_THEMES.map((theme) => theme.id)).toEqual(expectedTypes);
    expect(new Set(SHOWROOM_THEMES.map((theme) => theme.id)).size).toBe(10);
  });

  it("provides card art and camera framing for every environment", () => {
    for (const theme of SHOWROOM_THEMES) {
      expect(theme.card.type).toBe(theme.id);
      expect(theme.card.gradient).toBeTruthy();
      expect(theme.card.accentColor).toBeTruthy();
      expect(theme.camera.position).toHaveLength(3);
      expect(theme.camera.target).toHaveLength(3);
      expect(theme.camera.fov).toBeGreaterThan(0);
      expect(getShowroomTheme(theme.id)).toBe(theme);
    }
  });
});
