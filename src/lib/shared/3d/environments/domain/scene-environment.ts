import { BackgroundType } from "@austencloud/backgrounds";

/**
 * A 3D scene environment is authored content. Its id deliberately lives in a
 * different domain from the application's 2D background preference, even
 * while the first catalog happens to use matching slugs.
 */
export const SceneEnvironmentId = {
  COSMIC: "cosmic",
  WINTER: "winter",
  OCEAN: "ocean",
  EMBER: "ember",
  BLOSSOM: "blossom",
  FOREST: "forest",
  AUTUMN: "autumn",
  RAINBOW: "rainbow",
  CELESTIAL: "celestial",
  VOID: "void",
} as const;

export type SceneEnvironmentId =
  (typeof SceneEnvironmentId)[keyof typeof SceneEnvironmentId];

export interface SceneEnvironmentDefinition {
  id: SceneEnvironmentId;
  label: string;
  icon: string;
  /**
   * Environment3D still routes its established renderers through
   * BackgroundType. This adapter is renderer plumbing, not shared preference
   * state, and lets the user-facing catalogs diverge independently.
   */
  rendererKey: BackgroundType;
  /** Optional art-direction pairing used only for first-use migration. */
  pairedBackgroundId?: BackgroundType;
}

export const SCENE_ENVIRONMENTS = [
  {
    id: SceneEnvironmentId.COSMIC,
    label: "Cosmic",
    icon: "fa-moon",
    rendererKey: BackgroundType.COSMIC,
    pairedBackgroundId: BackgroundType.COSMIC,
  },
  {
    id: SceneEnvironmentId.WINTER,
    label: "Winter",
    icon: "fa-snowflake",
    rendererKey: BackgroundType.WINTER,
    pairedBackgroundId: BackgroundType.WINTER,
  },
  {
    id: SceneEnvironmentId.OCEAN,
    label: "Ocean",
    icon: "fa-water",
    rendererKey: BackgroundType.OCEAN,
    pairedBackgroundId: BackgroundType.OCEAN,
  },
  {
    id: SceneEnvironmentId.EMBER,
    label: "Ember",
    icon: "fa-fire",
    rendererKey: BackgroundType.EMBER,
    pairedBackgroundId: BackgroundType.EMBER,
  },
  {
    id: SceneEnvironmentId.BLOSSOM,
    label: "Blossom",
    icon: "fa-spa",
    rendererKey: BackgroundType.BLOSSOM,
    pairedBackgroundId: BackgroundType.BLOSSOM,
  },
  {
    id: SceneEnvironmentId.FOREST,
    label: "Forest",
    icon: "fa-tree",
    rendererKey: BackgroundType.FOREST,
    pairedBackgroundId: BackgroundType.FOREST,
  },
  {
    id: SceneEnvironmentId.AUTUMN,
    label: "Autumn",
    icon: "fa-leaf",
    rendererKey: BackgroundType.AUTUMN,
    pairedBackgroundId: BackgroundType.AUTUMN,
  },
  {
    id: SceneEnvironmentId.RAINBOW,
    label: "Rainbow",
    icon: "fa-rainbow",
    rendererKey: BackgroundType.PRIDE,
    pairedBackgroundId: BackgroundType.PRIDE,
  },
  {
    id: SceneEnvironmentId.CELESTIAL,
    label: "Celestial",
    icon: "fa-cloud-sun",
    rendererKey: BackgroundType.CELESTIAL,
    pairedBackgroundId: BackgroundType.CELESTIAL,
  },
  {
    id: SceneEnvironmentId.VOID,
    label: "Void",
    icon: "fa-square",
    rendererKey: BackgroundType.VOID,
    pairedBackgroundId: BackgroundType.VOID,
  },
] as const satisfies readonly SceneEnvironmentDefinition[];

export const DEFAULT_SCENE_ENVIRONMENT_ID = SceneEnvironmentId.COSMIC;

/**
 * Where the viewer remembers the environment the user last chose. It lives here
 * rather than inside the viewer's state module so asset warming can read that
 * choice without pulling the whole viewer into the eager bundle.
 */
export const VIEWER_3D_ENVIRONMENT_STORAGE_KEY = "tka-viewer3d-environment";

const environmentById = new Map<SceneEnvironmentId, SceneEnvironmentDefinition>(
  SCENE_ENVIRONMENTS.map((environment) => [environment.id, environment])
);

export function isSceneEnvironmentId(
  value: unknown
): value is SceneEnvironmentId {
  return (
    typeof value === "string" &&
    environmentById.has(value as SceneEnvironmentId)
  );
}

export function normalizeSceneEnvironmentId(
  value: unknown,
  fallback: SceneEnvironmentId = DEFAULT_SCENE_ENVIRONMENT_ID
): SceneEnvironmentId {
  return isSceneEnvironmentId(value) ? value : fallback;
}

export function getSceneEnvironmentDefinition(
  id: SceneEnvironmentId
): SceneEnvironmentDefinition {
  return environmentById.get(id) ?? environmentById.get(fallbackEnvironment())!;
}

export function getSceneEnvironmentRendererKey(
  id: SceneEnvironmentId
): BackgroundType {
  return getSceneEnvironmentDefinition(id).rendererKey;
}

export function sceneEnvironmentIdForBackground(
  backgroundId: BackgroundType | string | null | undefined,
  fallback: SceneEnvironmentId = DEFAULT_SCENE_ENVIRONMENT_ID
): SceneEnvironmentId {
  const match = SCENE_ENVIRONMENTS.find(
    (environment) => environment.pairedBackgroundId === backgroundId
  );
  return match?.id ?? fallback;
}

function fallbackEnvironment(): SceneEnvironmentId {
  return DEFAULT_SCENE_ENVIRONMENT_ID;
}

