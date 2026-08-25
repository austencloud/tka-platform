import { describe, expect, it } from "vitest";
import { shouldMirrorProp } from "./canvas-2d-transform-helper";
import { pictographKeyHasher } from "./pictograph-key-hasher";
import type { DirectRenderOptions } from "./IDirectRenderer";
import type { PreparedPictographData } from "$lib/shared/pictograph/shared/domain/models/prepared-pictograph-data";
import type { PictographVisibilityOptions } from "$lib/shared/render/utils/pictograph-to-svg";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

// The rasterized path (choreo-card cells, exports, card fronts) draws props
// through shouldMirrorProp, while the live SVG pictograph draws them through
// PropSvg's shouldMirror. Only PropSvg honored the buugeng chirality setting,
// so a flipped buugeng showed one handedness in the 2D animation canvas and
// the opposite one in the Choreo card. These lock the two paths together.

const pictograph = {
  letter: "G",
  motions: {
    blue: {
      motionType: "pro",
      startLocation: "e",
      endLocation: "s",
      startOrientation: "in",
      endOrientation: "in",
      rotationDirection: "cw",
      turns: 0,
      propType: PropType.BUUGENG,
    },
    red: {
      motionType: "pro",
      startLocation: "w",
      endLocation: "s",
      startOrientation: "in",
      endOrientation: "in",
      rotationDirection: "ccw",
      turns: 0,
      propType: PropType.BUUGENG,
    },
  },
} as unknown as PreparedPictographData;

function options(
  visibility: Partial<PictographVisibilityOptions>
): DirectRenderOptions {
  return {
    size: 480,
    visibility: {
      bluePropType: PropType.BUUGENG,
      redPropType: PropType.BUUGENG,
      ...visibility,
    },
  };
}

describe("shouldMirrorProp — buugeng chirality", () => {
  it("does not mirror either prop when neither is flipped", () => {
    const o = options({});
    expect(shouldMirrorProp("blue", pictograph, o)).toBe(false);
    expect(shouldMirrorProp("red", pictograph, o)).toBe(false);
  });

  it("mirrors only the flipped blue prop", () => {
    const o = options({ blueBuugengFlipped: true });
    expect(shouldMirrorProp("blue", pictograph, o)).toBe(true);
    expect(shouldMirrorProp("red", pictograph, o)).toBe(false);
  });

  it("mirrors only the flipped red prop", () => {
    const o = options({ redBuugengFlipped: true });
    expect(shouldMirrorProp("blue", pictograph, o)).toBe(false);
    expect(shouldMirrorProp("red", pictograph, o)).toBe(true);
  });

  it("ignores chirality for props outside the buugeng family", () => {
    const o = options({
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
      blueBuugengFlipped: true,
      redBuugengFlipped: true,
    });
    expect(shouldMirrorProp("blue", pictograph, o)).toBe(false);
    expect(shouldMirrorProp("red", pictograph, o)).toBe(false);
  });

  it("still mirrors the red HAND prop", () => {
    const o = options({
      bluePropType: PropType.HAND,
      redPropType: PropType.HAND,
    });
    expect(shouldMirrorProp("red", pictograph, o)).toBe(true);
    expect(shouldMirrorProp("blue", pictograph, o)).toBe(false);
  });
});

describe("pictograph cache key — buugeng chirality", () => {
  const base: PictographVisibilityOptions = {
    bluePropType: PropType.BUUGENG,
    redPropType: PropType.BUUGENG,
  };

  it("gives a flipped render its own key", () => {
    const unflipped = pictographKeyHasher.deriveKey(pictograph, base);
    const flipped = pictographKeyHasher.deriveKey(pictograph, {
      ...base,
      blueBuugengFlipped: true,
    });
    expect(flipped).not.toBe(unflipped);
  });

  it("distinguishes blue-flipped from red-flipped", () => {
    expect(
      pictographKeyHasher.deriveKey(pictograph, {
        ...base,
        blueBuugengFlipped: true,
      })
    ).not.toBe(
      pictographKeyHasher.deriveKey(pictograph, {
        ...base,
        redBuugengFlipped: true,
      })
    );
  });

  it("leaves the established key untouched when nothing is flipped", () => {
    expect(
      pictographKeyHasher.deriveKey(pictograph, {
        ...base,
        blueBuugengFlipped: false,
        redBuugengFlipped: false,
      })
    ).toBe(pictographKeyHasher.deriveKey(pictograph, base));
  });

  it("does not re-key a non-buugeng prop whose flip flag happens to be set", () => {
    const staff: PictographVisibilityOptions = {
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
    };
    expect(
      pictographKeyHasher.deriveKey(pictograph, {
        ...staff,
        blueBuugengFlipped: true,
        redBuugengFlipped: true,
      })
    ).toBe(pictographKeyHasher.deriveKey(pictograph, staff));
  });
});
