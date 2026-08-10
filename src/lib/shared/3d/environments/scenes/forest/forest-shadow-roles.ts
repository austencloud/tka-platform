export interface ForestShadowRole {
  cast: boolean;
  receive: boolean;
}

const NO_SHADOWS: ForestShadowRole = { cast: false, receive: false };
const RECEIVER_ONLY: ForestShadowRole = { cast: false, receive: true };

/**
 * Keep the moon depth pass bounded. The 295-tree authored woodland remains out
 * of the shadow map; only terrain that can display stage and campsite contact
 * receives it. Their separate runtime owners decide which local meshes cast.
 */
export function resolveForestShadowRole(role: unknown): ForestShadowRole {
  return role === "terrain" || role === "camp-shelf"
    ? RECEIVER_ONLY
    : NO_SHADOWS;
}
