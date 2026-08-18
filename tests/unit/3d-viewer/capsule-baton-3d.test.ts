import { describe, expect, it } from "vitest";

import { PropType } from "@austencloud/scene-3d";
import { resolvePropTipAnchors3D } from "$lib/shared/3d/effects/prop-tip-geometry-3d";
import { toScenePropType } from "$lib/shared/3d/domain/scene-prop-type";
import { PropType as AppPropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { resolvePropModel } from "../../../node_modules/@austencloud/scene-3d/src/lib/components/props/prop-model-registry";

/** The staff length the 3D rig hands the tip bridge, in metres. */
const STAFF_LENGTH_M = 0.8636;
const STAFF_HALF_M = STAFF_LENGTH_M / 2;

/**
 * `capsule-baton.glb`'s own numbers, printed by
 * `scripts/build-capsule-baton-model.py` and gated by
 * `scripts/verify-capsule-baton-glb.cjs`.
 */
const CAP_TIP_M = 0.4318;
const GLOW_CENTRE_M = 0.3996883;

describe("capsule baton 3D", () => {
  it("loads its own model instead of borrowing the staff's", () => {
    // The app enum passes straight through to the scene enum, so the baton
    // reaching its model at all depends on both carrying "capsule_baton".
    expect(toScenePropType(AppPropType.CAPSULE_BATON)).toBe(
      PropType.CAPSULE_BATON
    );
    expect(toScenePropType(AppPropType.CAPSULE_BATON)).not.toBe(
      PropType.STAFF
    );

    expect(resolvePropModel(PropType.CAPSULE_BATON)).toMatchObject({
      entry: {
        modelUrl: "/models/props/capsule-baton.glb",
        scale: 1,
        gripOffsetY: 0,
      },
      scale: 1,
    });
    // Bilateral prop: flipping it would change nothing but the winding.
    expect(
      resolvePropModel(PropType.CAPSULE_BATON)!.entry.flipLongAxis
    ).toBeFalsy();
  });

  it("emits from the two lit caps, not from a staff's ends", () => {
    const anchors = resolvePropTipAnchors3D(
      PropType.CAPSULE_BATON,
      STAFF_HALF_M
    );

    expect(anchors).toHaveLength(2);
    expect(anchors.map((anchor) => anchor.effectTipIndex)).toEqual([0, 1]);

    // Both emitters land on a cap's glow centre. The old two-ended default put
    // them at +/- staffHalfLength, which for this prop is 32mm past each cap --
    // outside the mesh, in mid-air.
    expect(anchors[1].axialOffset).toBeCloseTo(GLOW_CENTRE_M, 6);
    expect(anchors[0].axialOffset).toBeCloseTo(-GLOW_CENTRE_M, 6);
    expect(anchors[1].axialOffset).toBeLessThan(CAP_TIP_M);
    expect(anchors[1].axialOffset).not.toBeCloseTo(STAFF_HALF_M, 4);
  });

  it("keeps the staff family on the plain half-length pair", () => {
    // The baton's entry must not become the two-ended default.
    for (const propType of [PropType.STAFF, PropType.DOUBLESTAR]) {
      const anchors = resolvePropTipAnchors3D(propType, STAFF_HALF_M);
      expect(anchors).toHaveLength(2);
      expect(anchors[1].axialOffset).toBeCloseTo(STAFF_HALF_M, 6);
      expect(anchors[0].axialOffset).toBeCloseTo(-STAFF_HALF_M, 6);
    }
  });
});
