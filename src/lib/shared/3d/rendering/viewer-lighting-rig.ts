import { AmbientLight, DirectionalLight, Group } from "three";

export interface ViewerBaseLightingProfile {
  ambientIntensity: number;
  directionalIntensity: number;
}

export const VIEWER_KEY_LIGHT_POSITION = [5, 10, 5] as const;

export const VIEWER_PROTECTED_LIGHTING = {
  ambientIntensity: 0.75,
  directionalIntensity: 1.1,
  directionalPosition: [-4, 9, 7] as const,
} as const;

/**
 * Resolve the two lights owned by the viewer rather than by an environment.
 *
 * Keeping this policy renderer-neutral prevents a worker-rendered performer
 * from silently receiving different illumination from the same performer in
 * the Threlte viewer.
 */
export function resolveViewerBaseLighting(
  hasEnvironment: boolean,
  isNightEnvironment: boolean
): ViewerBaseLightingProfile {
  if (isNightEnvironment) {
    return { ambientIntensity: 0.2, directionalIntensity: 0.4 };
  }
  if (hasEnvironment) {
    return { ambientIntensity: 0.3, directionalIntensity: 0.6 };
  }
  return { ambientIntensity: 0.4, directionalIntensity: 0.8 };
}

/** Build the base-pass light graph used by a worker-owned complete frame. */
export function createViewerBaseLightingGroup(
  profile: ViewerBaseLightingProfile
): Group {
  const root = new Group();
  root.name = "viewer-base-lighting";

  const ambient = new AmbientLight(0xffffff, profile.ambientIntensity);
  ambient.name = "viewer-base-ambient";
  root.add(ambient);

  const key = new DirectionalLight(0xffffff, profile.directionalIntensity);
  key.name = "viewer-base-key";
  key.position.set(...VIEWER_KEY_LIGHT_POSITION);
  root.add(key);

  return root;
}
