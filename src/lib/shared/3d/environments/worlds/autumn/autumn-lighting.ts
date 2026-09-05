import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  PointLight,
} from "three";

import type { AutumnQualityConfig } from "../../scenes/autumn/quality/autumn-quality";
import { AUTUMN_MOON_DIRECTION } from "../../scenes/autumn/runtime/lighting/autumn-moon";

export interface AutumnLightingRig {
  object: Group;
  setGroundY(groundY: number): void;
  setQuality(quality: AutumnQualityConfig): void;
  setActive(active: boolean): void;
  dispose(): void;
}

/** Exact imperative form of AutumnLighting's seven-light dusk rig. */
export function createAutumnLightingRig(
  quality: AutumnQualityConfig,
  groundY: number
): AutumnLightingRig {
  const root = new Group();
  root.name = "autumn-lighting";
  const moonLength = Math.hypot(...AUTUMN_MOON_DIRECTION);
  const moonPosition = AUTUMN_MOON_DIRECTION.map(
    (component) => (component / moonLength) * 42
  ) as [number, number, number];

  const moon = new DirectionalLight("#b9c6f2", 2.05);
  moon.name = "autumn-moon-key";
  moon.position.set(
    moonPosition[0],
    moonPosition[1] + groundY,
    moonPosition[2]
  );
  moon.castShadow = quality.shadows;
  moon.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 110;
  moon.shadow.camera.left = -20;
  moon.shadow.camera.right = 20;
  moon.shadow.camera.top = 20;
  moon.shadow.camera.bottom = -20;
  moon.shadow.bias = -0.00035;
  moon.shadow.normalBias = 0.055;
  moon.shadow.radius = 5;
  moon.shadow.intensity = 0.38;

  const ember = new DirectionalLight("#ff8748", 1.05);
  ember.name = "autumn-ember-key";
  ember.position.set(14, 7, 16);
  const shadowFill = new DirectionalLight("#6f6396", 0.62);
  shadowFill.name = "autumn-shadow-fill";
  shadowFill.position.set(-8, 5, 26);
  const hemisphere = new HemisphereLight("#8a6ba0", "#462e28", 0.92);
  hemisphere.name = "autumn-hemisphere";
  const ambient = new AmbientLight("#c2a2c0", 0.46);
  ambient.name = "autumn-ambient";
  const pond = new PointLight("#8170c5", 0.45, 16, 2);
  pond.name = "autumn-pond-light";
  pond.position.set(-14, groundY + 4.2, 9);
  const clearing = new PointLight("#ffad67", 1.15, 14, 2);
  clearing.name = "autumn-clearing-light";
  clearing.position.set(0, groundY + 5.5, 2.5);
  root.add(moon, ember, shadowFill, hemisphere, ambient, pond, clearing);
  let activeQuality = quality;
  let disposed = false;

  return {
    object: root,
    setGroundY(nextGroundY) {
      if (disposed) return;
      moon.position.y = moonPosition[1] + nextGroundY;
      pond.position.y = nextGroundY + 4.2;
      clearing.position.y = nextGroundY + 5.5;
    },
    setQuality(nextQuality) {
      if (disposed) return;
      activeQuality = nextQuality;
      moon.castShadow = nextQuality.shadows && root.visible;
      moon.shadow.mapSize.set(
        nextQuality.shadowMapSize,
        nextQuality.shadowMapSize
      );
      moon.shadow.map?.dispose();
      moon.shadow.map = null;
    },
    setActive(active) {
      if (disposed) return;
      root.visible = active;
      moon.castShadow = activeQuality.shadows && active;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      moon.shadow.map?.dispose();
      root.clear();
    },
  };
}
