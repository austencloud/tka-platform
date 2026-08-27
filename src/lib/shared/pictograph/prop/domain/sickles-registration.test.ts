import { describe, expect, it } from "vitest";
import {
  PROP_MODEL_REGISTRY,
  PropType as ScenePropType,
} from "@austencloud/scene-3d";

import { getTipPointsBaseline } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import { getPropDimensions } from "$lib/shared/animation-engine/services/IPropTextureLoader";
import { toScenePropType } from "$lib/shared/3d/domain/scene-prop-type";
import { resolvePropTipAnchors3D } from "$lib/shared/3d/effects/prop-tip-geometry-3d";
import {
  getBilateralEndLabels,
  isSmallProp,
  isUnilateralProp,
} from "./enums/prop-classification";
import { PropType } from "./enums/prop-type";
import { getCompositionRecipe } from "./prop-composition-recipes";
import { propTipEnds } from "./prop-tip-ends";
import {
  getAllVariations,
  getBasePropType,
  getBasePropsByCategory,
  getPropTypeDisplayInfo,
} from "./prop-type-display-registry";

describe("Sickles prop registration", () => {
  it("registers one shared GLB for the app and 3D package", () => {
    expect(toScenePropType(PropType.SICKLES)).toBe(ScenePropType.SICKLES);
    expect(PROP_MODEL_REGISTRY[ScenePropType.SICKLES]).toMatchObject({
      modelUrl: "/models/props/sickles.glb",
      scale: 1,
      gripOffsetY: 0,
    });
  });

  it("keeps the 2D and 3D tracked blade apex aligned", () => {
    expect(getPropDimensions(PropType.SICKLES)).toEqual({
      width: 440,
      height: 260,
    });
    expect(getTipPointsBaseline(PropType.SICKLES).points).toEqual([
      { dx: 192, dy: 0 },
    ]);
    expect(
      resolvePropTipAnchors3D(PropType.SICKLES, 0.4318, {
        fanBuild: "pictograph",
        finish: "day",
      })
    ).toEqual([
      { effectTipIndex: 1, offset: { x: 0, y: 0.274416, z: 0 } },
    ]);
  });

  it("classifies Sickles as a small, one-ended paired prop", () => {
    expect(isUnilateralProp(PropType.SICKLES)).toBe(true);
    expect(isSmallProp(PropType.SICKLES)).toBe(true);
    expect(propTipEnds(PropType.SICKLES)).toBe(1);
    expect(getBilateralEndLabels(PropType.SICKLES)).toEqual([
      "Tip End",
      "Hilt End",
    ]);
    expect(getCompositionRecipe(PropType.SICKLES).blue).not.toEqual(
      getCompositionRecipe(PropType.SICKLES).red
    );
  });

  it("groups Sickles under Sword in the standard prop picker", () => {
    expect(getPropTypeDisplayInfo(PropType.SICKLES)).toMatchObject({
      label: "Sickles",
      image: "/images/props/buttons/sickles.svg",
      category: "singles",
    });
    expect(getBasePropType(PropType.SICKLES)).toBe(PropType.SWORD);
    expect(getAllVariations(PropType.SWORD)).toEqual([
      PropType.SWORD,
      PropType.SICKLES,
    ]);
    expect(getBasePropsByCategory().get("singles")).toContain(PropType.SWORD);
    expect(getBasePropsByCategory().get("singles")).not.toContain(
      PropType.SICKLES
    );
  });
});
