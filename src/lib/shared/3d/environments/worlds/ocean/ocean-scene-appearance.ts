import {
  Color,
  FogExp2,
  PMREMGenerator,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const OCEAN_ENVIRONMENT_INTENSITY = 0.05;
export const OCEAN_FOG_DENSITY = 0.026;
export const OCEAN_BACKGROUND_COLOR = "#0a2438";

const oceanEnvironmentTextures = new WeakMap<WebGLRenderer, Texture>();

export function getOceanEnvironmentTexture(renderer: WebGLRenderer): Texture {
  const existing = oceanEnvironmentTextures.get(renderer);
  if (existing) return existing;
  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  oceanEnvironmentTextures.set(renderer, texture);
  return texture;
}

export interface OceanSceneAppearance {
  dispose(): void;
}

/** Owns Ocean's exact scene-global fog, background, and soft PMREM fill. */
export function applyOceanSceneAppearance(options: {
  scene: Scene;
  renderer: WebGLRenderer;
  enableFog: boolean;
  enableImageBasedLighting: boolean;
}): OceanSceneAppearance {
  const { scene, renderer } = options;
  const previous = {
    background: scene.background,
    fog: scene.fog,
    environment: scene.environment,
    environmentIntensity: scene.environmentIntensity,
  };
  const background = new Color(OCEAN_BACKGROUND_COLOR);
  const fog = options.enableFog
    ? new FogExp2(background.getHex(), OCEAN_FOG_DENSITY)
    : null;
  const environment = options.enableImageBasedLighting
    ? getOceanEnvironmentTexture(renderer)
    : null;

  scene.background = background;
  scene.fog = fog;
  scene.environment = environment;
  scene.environmentIntensity = options.enableImageBasedLighting
    ? OCEAN_ENVIRONMENT_INTENSITY
    : previous.environmentIntensity;

  return {
    dispose() {
      if (scene.background === background) scene.background = previous.background;
      if (scene.fog === fog) scene.fog = previous.fog;
      if (scene.environment === environment) {
        scene.environment = previous.environment;
      }
      scene.environmentIntensity = previous.environmentIntensity;
    },
  };
}
