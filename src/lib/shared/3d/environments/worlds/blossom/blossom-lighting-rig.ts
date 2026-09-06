import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  PointLight,
} from "three";

import type { BlossomSceneConfig } from "../../domain/models/scene-configs";
import type { BlossomRuntimeConfig } from "../../scenes/cherry-blossom/blossom-runtime";

export interface BlossomLightingRig {
  object: Group;
  setGroundY(groundY: number): void;
  dispose(): void;
}

/** Exact moon, horizon, hemisphere, and lantern rig from BlossomScene. */
export function createBlossomLightingRig(
  config: BlossomSceneConfig,
  runtime: BlossomRuntimeConfig,
  groundY: number,
  stageZOffset: number
): BlossomLightingRig {
  const root = new Group();
  root.name = "blossom-lighting";
  const moon = config.moonLight?.enabled ? config.moonLight : null;
  const keyPosition = moon?.position ?? [-22, 30, -34];

  const key = new DirectionalLight(
    moon?.color ?? "#d9ddff",
    runtime.lights.key
  );
  key.name = "blossom-moon-key";
  key.castShadow = runtime.effects.shadows;
  key.shadow.mapSize.set(
    runtime.effects.shadowMapSize,
    runtime.effects.shadowMapSize
  );
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 110;
  key.shadow.camera.left = -22;
  key.shadow.camera.right = 22;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -22;
  key.shadow.bias = -0.00065;
  key.shadow.normalBias = 0.04;
  key.shadow.radius = 3;
  key.shadow.intensity = 0.56;
  root.add(key);

  const warmFill = new DirectionalLight("#ffb889", 0.8);
  warmFill.name = "blossom-warm-fill";
  root.add(warmFill);
  const coolFill = new DirectionalLight("#a6c5e4", 0.2);
  coolFill.name = "blossom-cool-fill";
  root.add(coolFill);
  const hemisphere = new HemisphereLight(
    config.hemisphereLight.skyColor,
    config.hemisphereLight.groundColor,
    runtime.lights.hemisphere
  );
  hemisphere.name = "blossom-hemisphere-light";
  root.add(hemisphere);
  const ambient = new AmbientLight("#748da3", 0.08);
  ambient.name = "blossom-ambient-light";
  root.add(ambient);

  const practicals = [
    { color: "#ffc080", intensity: 24, distance: 11, x: 5, y: 1.7, z: -8 },
    { color: "#ffc080", intensity: 24, distance: 11, x: -7, y: 1.7, z: -9.5 },
    { color: "#ffb07c", intensity: 42, distance: 15, x: -12, y: 1.7, z: 7 },
  ];
  const practicalLights = practicals
    .slice(0, runtime.effects.lanternLights)
    .map((definition, index) => {
      const light = new PointLight(
        definition.color,
        definition.intensity,
        definition.distance,
        2
      );
      light.name = `blossom-lantern-light-${index}`;
      root.add(light);
      return { light, definition };
    });

  function setGroundY(nextGroundY: number): void {
    key.position.set(
      keyPosition[0],
      keyPosition[1] + nextGroundY,
      keyPosition[2] + stageZOffset
    );
    warmFill.position.set(18, 8 + nextGroundY, 22 + stageZOffset);
    coolFill.position.set(-12, 6 + nextGroundY, 18 + stageZOffset);
    for (const { light, definition } of practicalLights) {
      light.position.set(
        definition.x,
        nextGroundY + definition.y,
        definition.z + stageZOffset
      );
    }
  }
  setGroundY(groundY);

  return {
    object: root,
    setGroundY,
    dispose() {
      key.shadow.map?.dispose();
      root.clear();
    },
  };
}
