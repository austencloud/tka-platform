import { Object3D, PointLight, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { FireRenderer3D } from "$lib/shared/3d/effects/fire/fire-renderer-3d";
import { QualityTier } from "$lib/shared/3d/effects/types";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { resolveFire3D } from "$lib/shared/effects/translators/webgl3d-translator";

describe("FireRenderer3D local lighting", () => {
  it("keeps a fast, stalling wick below the facial-detail washout ceiling", () => {
    const parent = new Object3D();
    const renderer = new FireRenderer3D(QualityTier.HIGH);
    renderer.initialize(parent);
    renderer.updateConfig(resolveFire3D(DEFAULT_EFFECTS_CONFIG.fire));

    renderer.update(
      [
        {
          position: new Vector3(0, 1.6, 0),
          velocityX: 0,
          velocityY: 0,
          velocityZ: 0,
          speed: 10,
          jerk: 60,
        },
      ],
      1 / 60
    );

    const activeLight = parent.children.find(
      (child): child is PointLight =>
        child instanceof PointLight && child.visible
    );
    expect(activeLight).toBeDefined();
    expect(activeLight!.intensity).toBeGreaterThan(0);
    expect(activeLight!.intensity).toBeLessThanOrEqual(0.5);

    renderer.dispose();
  });
});
