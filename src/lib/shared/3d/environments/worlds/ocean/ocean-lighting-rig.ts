import {
  DirectionalLight,
  Group,
  HemisphereLight,
  Object3D,
  PointLight,
  SpotLight,
} from "three";
import {
  OCEAN_STAGE_DECK_OFFSET_METERS,
  OCEAN_STAGE_TO_SURFACE_METERS,
} from "../../domain/models/ocean-water-depth";
import {
  COLUMN_UP,
  HERO_TARGET_XZ,
  SUN_POS,
  keyLightPosition,
} from "../../scenes/ocean/runtime/atmosphere/god-ray-axis";

export interface OceanLightingRig {
  object: Group;
  sunLight: DirectionalLight;
  setGroundY(groundY: number): void;
  setHemisphereEnabled(enabled: boolean): void;
  dispose(): void;
}

/** Exact renderer-neutral light rig used by the production Ocean scene. */
export function createOceanLightingRig(options: {
  groundY: number;
  hemisphereEnabled?: boolean;
}): OceanLightingRig {
  const root = new Group();
  root.name = "OceanLightingRig";

  const hemisphere = new HemisphereLight(
    "#3a6b7a",
    "#0a1a14",
    options.hemisphereEnabled === false ? 0 : 0.09,
  );
  hemisphere.name = "OceanHemisphereFill";

  const sunLight = new DirectionalLight("#dde8ee", 0.28);
  sunLight.name = "OceanSun";
  sunLight.position.copy(SUN_POS);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.bias = -0.0002;
  sunLight.shadow.normalBias = 0.04;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 80;
  sunLight.shadow.camera.left = -20;
  sunLight.shadow.camera.right = 20;
  sunLight.shadow.camera.top = 20;
  sunLight.shadow.camera.bottom = -20;
  sunLight.shadow.camera.updateProjectionMatrix();

  const keyTarget = new Object3D();
  keyTarget.name = "OceanKeyTarget";
  const keyAxisDistance = OCEAN_STAGE_TO_SURFACE_METERS / COLUMN_UP.y;
  const keyLight = new SpotLight(
    "#cfe6f5",
    260 * Math.pow(keyAxisDistance / 9.83, 2),
    34,
    Math.atan(3.05 / keyAxisDistance),
    0.55,
    2,
  );
  keyLight.name = "OceanStageKey";
  keyLight.target = keyTarget;

  const torchRight = new PointLight("#ff7722", 13, 10, 2);
  torchRight.name = "OceanTorchRight";
  torchRight.position.set(6.2, 1.9, 2.25);
  const torchLeft = new PointLight("#ff7722", 13, 10, 2);
  torchLeft.name = "OceanTorchLeft";
  torchLeft.position.set(-6.2, 1.9, 2.25);

  root.add(
    hemisphere,
    sunLight,
    keyTarget,
    keyLight,
    torchRight,
    torchLeft,
  );

  function setGroundY(groundY: number): void {
    const position = keyLightPosition(groundY);
    keyLight.position.copy(position);
    keyTarget.position.set(
      HERO_TARGET_XZ.x,
      groundY + OCEAN_STAGE_DECK_OFFSET_METERS,
      HERO_TARGET_XZ.z,
    );
  }

  setGroundY(options.groundY);

  return {
    object: root,
    sunLight,
    setGroundY,
    setHemisphereEnabled(enabled) {
      hemisphere.intensity = enabled ? 0.09 : 0;
    },
    dispose() {
      sunLight.shadow.map?.dispose();
      root.clear();
    },
  };
}
