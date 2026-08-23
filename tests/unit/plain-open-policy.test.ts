import { describe, expect, it } from "vitest";
import {
  resolvePlainOpenPerformerSettings,
  resolveInitialDefaultProp,
} from "../../src/lib/shared/3d/domain/plain-open-policy";

const fullSettings = {
  prop: "fans",
  effortId: "linear",
  effect: "fire",
  staffLengthCm: 120,
};

describe("resolvePlainOpenPerformerSettings", () => {
  it("passes settings through verbatim on a preset-sourced open", () => {
    expect(resolvePlainOpenPerformerSettings(fullSettings, true)).toEqual(
      fullSettings
    );
  });

  it("strips prop and staffLengthCm on a plain open, keeping effort/effect", () => {
    expect(resolvePlainOpenPerformerSettings(fullSettings, false)).toEqual({
      prop: null,
      effortId: "linear",
      effect: "fire",
      staffLengthCm: null,
    });
  });

  it("returns undefined for absent settings", () => {
    expect(resolvePlainOpenPerformerSettings(undefined, false)).toBeUndefined();
  });
});

describe("resolveInitialDefaultProp", () => {
  it("prefers the app prop on a plain open", () => {
    expect(
      resolveInitialDefaultProp({
        presetSourced: false,
        appProp: "fans",
        persistedProp: "staff",
      })
    ).toBe("fans");
  });

  it("prefers the persisted prop on a preset-sourced open", () => {
    expect(
      resolveInitialDefaultProp({
        presetSourced: true,
        appProp: "fans",
        persistedProp: "buugeng",
      })
    ).toBe("buugeng");
  });

  it("falls back to the persisted prop when the app prop is absent", () => {
    expect(
      resolveInitialDefaultProp({
        presetSourced: false,
        appProp: null,
        persistedProp: "staff",
      })
    ).toBe("staff");
  });
});
