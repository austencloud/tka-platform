import { describe, expect, it } from "vitest";
import {
  clampPerformerPosition,
  getPointerIntent,
  intersectGroundPlane,
  isWithinMinimumTouchTarget,
  resolveCameraRelativeNudge,
  resolveTouchIntent,
} from "$lib/shared/3d/components/performer-interaction/performer-pointer-interaction.svelte";

describe("performer pointer interaction", () => {
  it("keeps movement inside the click threshold until travel exceeds 8px", () => {
    expect(getPointerIntent({ x: 10, y: 10 }, { x: 18, y: 10 })).toBe("click");
    expect(getPointerIntent({ x: 10, y: 10 }, { x: 18.01, y: 10 })).toBe(
      "drag"
    );
  });

  it("uses immediate touch drag only for the selected performer", () => {
    expect(
      resolveTouchIntent({ selected: true, heldMs: 0, travelPx: 5.01 })
    ).toBe("drag");
    expect(
      resolveTouchIntent({ selected: false, heldMs: 249, travelPx: 4 })
    ).toBe("tap");
    expect(
      resolveTouchIntent({ selected: false, heldMs: 250, travelPx: 4 })
    ).toBe("drag");
    expect(
      resolveTouchIntent({ selected: false, heldMs: 300, travelPx: 5.01 })
    ).toBe("camera");
  });

  it("keeps a 44px minimum touch target around projected performers", () => {
    expect(isWithinMinimumTouchTarget({ x: 22, y: 0 }, { x: 0, y: 0 })).toBe(
      true
    );
    expect(isWithinMinimumTouchTarget({ x: 22.01, y: 0 }, { x: 0, y: 0 })).toBe(
      false
    );
  });

  it("intersects the stage plane and preserves the original grab offset", () => {
    expect(
      intersectGroundPlane(
        { x: 0, y: 4, z: 0 },
        { x: 0.5, y: -1, z: 0.25 },
        0,
        { x: 1, z: -2 }
      )
    ).toEqual({ x: 3, z: -1 });
  });

  it("rejects grazing rays instead of sending a performer toward infinity", () => {
    expect(
      intersectGroundPlane(
        { x: 0, y: 4, z: 0 },
        { x: 1, y: -0.00001, z: 0 },
        0,
        { x: 0, z: 0 }
      )
    ).toBeNull();
  });

  it("clamps to the stable deck bounds with performer clearance", () => {
    expect(
      clampPerformerPosition(
        { x: 20, z: -20 },
        { width: 10, depth: 8, zOffset: 1 },
        0.5
      )
    ).toEqual({ x: 4.5, z: -2.5 });
  });

  it("snaps camera-relative arrow movement to the nearest stage axis", () => {
    expect(resolveCameraRelativeNudge("ArrowUp", Math.PI / 2, 0.25)).toEqual({
      x: -0.25,
      z: 0,
    });
    expect(resolveCameraRelativeNudge("ArrowRight", Math.PI / 2, 1)).toEqual({
      x: 0,
      z: -1,
    });
  });
});
