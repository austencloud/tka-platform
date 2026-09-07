import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  Object3D,
  PointLight,
} from "three";
import type { HemisphereLightConfig } from "../../domain/models/scene-configs/shared-scene-config";
import {
  FOREST_NIGHT_LIGHTING,
  type ForestLightingConfig,
} from "../../domain/models/scene-configs/forest-scene-config";

export interface ForestLightingRigOptions {
  hemisphere: HemisphereLightConfig;
  profile?: ForestLightingConfig;
  groundY?: number;
  anchor?: { x: number; y: number; z: number };
  shadowExtentMeters?: number;
  keyLightDistanceMeters?: number;
  shadowAnchorSnapMeters?: number;
  shadowRefreshIntervalSeconds?: number;
  shadowRefreshMinimumFrameGap?: number;
  shadowMapSize?: number;
  shadowsEnabled?: boolean;
}

export interface ForestLightingRig {
  object: Group;
  update(deltaSeconds: number): void;
  setGroundY(groundY: number): void;
  dispose(): void;
}

function snap(value: number, gridMeters: number): number {
  return gridMeters <= 0 ? value : Math.round(value / gridMeters) * gridMeters;
}

/** Exact renderer-neutral owner of Forest's motivated production light rig. */
export function createForestLightingRig(
  options: ForestLightingRigOptions
): ForestLightingRig {
  const root = new Group();
  root.name = "forest-lighting-rig";
  const profile = options.profile ?? FOREST_NIGHT_LIGHTING;
  const shadowsEnabled = options.shadowsEnabled ?? true;
  const anchor = options.anchor ?? {
    x: 0,
    y: options.groundY ?? 0,
    z: 0,
  };
  const snapMeters = Math.max(0, options.shadowAnchorSnapMeters ?? 0);
  const anchorX = snap(anchor.x, snapMeters);
  const anchorY = snap(anchor.y, snapMeters > 0 ? Math.min(1, snapMeters) : 0);
  const anchorZ = snap(anchor.z, snapMeters);
  const keyDistance = options.keyLightDistanceMeters ?? 64;
  const direction = profile.key.direction;
  const length = Math.hypot(...direction);
  const keyPosition =
    length === 0
      ? ([anchorX + 12, anchorY + 22, anchorZ - 58] as const)
      : ([
          anchorX + (direction[0] / length) * keyDistance,
          anchorY + (direction[1] / length) * keyDistance,
          anchorZ + (direction[2] / length) * keyDistance,
        ] as const);

  const target = new Object3D();
  target.name = "forest-key-target";
  target.position.set(anchorX, anchorY, anchorZ);
  target.updateMatrixWorld();
  root.add(target);

  const key = new DirectionalLight(profile.key.color, profile.key.intensity);
  key.name = "forest-key-light";
  key.position.set(...keyPosition);
  key.target = target;
  key.castShadow = shadowsEnabled;
  const mapSize = options.shadowMapSize ?? 2048;
  key.shadow.mapSize.set(mapSize, mapSize);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 140;
  const extent = options.shadowExtentMeters;
  key.shadow.camera.left = extent ? -extent : -28;
  key.shadow.camera.right = extent ?? 48;
  key.shadow.camera.top = extent ?? 30;
  key.shadow.camera.bottom = extent ? -extent : -30;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.035;
  key.shadow.radius = 3;
  key.shadow.intensity = profile.key.shadowIntensity;
  const controlledRefresh =
    snapMeters > 0 || (options.shadowRefreshIntervalSeconds ?? 0) > 0;
  key.shadow.autoUpdate = !controlledRefresh;
  key.shadow.needsUpdate = shadowsEnabled;
  root.add(key);

  const fill = new DirectionalLight(profile.fill.color, profile.fill.intensity);
  fill.name = "forest-fill-light";
  root.add(fill);
  const hemisphere = new HemisphereLight(
    options.hemisphere.skyColor,
    options.hemisphere.groundColor,
    options.hemisphere.intensity
  );
  hemisphere.name = "forest-hemisphere-light";
  root.add(hemisphere);
  const ambient = new AmbientLight(
    profile.ambient.color,
    profile.ambient.intensity
  );
  ambient.name = "forest-ambient-light";
  root.add(ambient);
  const stage =
    profile.stage.intensity > 0
      ? new PointLight(
          profile.stage.color,
          profile.stage.intensity,
          profile.stage.distance,
          2
        )
      : null;
  if (stage) {
    stage.name = "forest-stage-light";
    root.add(stage);
  }

  let groundY = options.groundY ?? 0;
  let refreshElapsed = 0;
  let refreshFrames = 0;
  let disposed = false;

  function setGroundY(nextGroundY: number): void {
    groundY = nextGroundY;
    fill.position.set(-18, 7 + groundY, 26);
    stage?.position.set(-1.5, 5.5 + groundY, 2);
  }
  setGroundY(groundY);

  return {
    object: root,
    update(deltaSeconds) {
      if (disposed || !shadowsEnabled) return;
      const interval = Math.max(0, options.shadowRefreshIntervalSeconds ?? 0);
      if (interval <= 0) return;
      refreshElapsed += Math.max(0, deltaSeconds);
      refreshFrames += 1;
      if (
        refreshElapsed < interval ||
        refreshFrames < Math.max(0, options.shadowRefreshMinimumFrameGap ?? 0)
      ) {
        return;
      }
      refreshElapsed %= interval;
      refreshFrames = 0;
      key.shadow.needsUpdate = true;
    },
    setGroundY,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.clear();
    },
  };
}
