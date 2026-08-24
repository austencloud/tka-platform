import { afterEach, describe, expect, it } from "vitest";

import {
  PropType,
  propFinishState,
  propHasFanAppearanceOptions,
  propHasFinishVariants,
} from "@austencloud/scene-3d";

afterEach(() => {
  propFinishState.set("fire");
  propFinishState.setFanBuild("pictograph");
  propFinishState.setFanFrameColor("black");
  propFinishState.setFanCover("bare");
});

describe("fan appearance state", () => {
  it("keeps fan builds separate from the generic fire/day finish axis", () => {
    expect(propHasFinishVariants(PropType.FAN)).toBe(false);
    expect(propHasFinishVariants(PropType.BIGFAN)).toBe(false);
    expect(propHasFinishVariants(PropType.TRIAD)).toBe(true);
    expect(propHasFanAppearanceOptions(PropType.FAN)).toBe(true);
    expect(propHasFanAppearanceOptions(PropType.BIGFAN)).toBe(true);

    expect(propHasFanAppearanceOptions(PropType.CLUB)).toBe(false);
    expect(propHasFanAppearanceOptions(PropType.TRIAD)).toBe(false);
  });

  it("defaults to the canonical pictograph and keeps physical options independent", () => {
    expect(propFinishState.fanBuild).toBe("pictograph");

    propFinishState.setFanBuild("day");
    propFinishState.set("day");
    propFinishState.setFanFrameColor("white");
    propFinishState.setFanCover("covered");

    expect(propFinishState.finish).toBe("day");
    expect(propFinishState.fanBuild).toBe("day");
    expect(propFinishState.fanFrameColor).toBe("white");
    expect(propFinishState.fanCover).toBe("covered");

    propFinishState.set("fire");
    expect(propFinishState.fanBuild).toBe("day");
    expect(propFinishState.fanFrameColor).toBe("white");
    expect(propFinishState.fanCover).toBe("covered");
  });
});
